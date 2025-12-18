const express = require('express');
const Queue = require('bull');
const { createClient } = require('redis');
const winston = require('winston');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { Resource } = require('@opentelemetry/resources');

// KRONOS Orchestration Engine with comprehensive OpenTelemetry instrumentation
class KronosOrchestrationEngineWithTracing {
  constructor(port = 5001) {
    this.port = port;
    this.app = express();
    this.redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.logger = this.setupLogger();
    
    // Workflow queues with tracing
    this.workflowQueue = new Queue('kronos-workflows', {
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        // Enable tracing for queue operations
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.taskQueue = new Queue('kronos-tasks', {
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.activeWorkflows = new Map();
    this.workflowDefinitions = new Map();
    
    // Initialize OpenTelemetry
    this.initializeTracing();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupQueueProcessors();
    this.loadWorkflowDefinitions();
  }

  initializeTracing() {
    const serviceName = 'kronos-orchestration-engine';
    const serviceVersion = '1.0.0';
    
    // Configure trace provider with performance optimizations
    const traceProvider = new NodeSDK.NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `orchestration-engine-${process.env.HOSTNAME || 'unknown'}`,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        'service.namespace': 'kronos',
        'platform.version': '1.0.0',
        'service.type': 'workflow',
        'service.priority': 'critical'
      }),
      exporters: [
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
          headers: {
            'x-service-name': serviceName,
            'x-service-version': serviceVersion
          }
        }),
        new NodeSDK.ConsoleSpanExporter()
      ],
      spanProcessors: [
        new NodeSDK.BatchSpanProcessor()
      ],
      // Enable sampling for orchestration engine (lower sampling for critical path)
      sampler: new NodeSDK.TraceIdRatioBasedSampler(0.05) // 5% sampling
    });

    const { trace, context, propagation } = NodeSDK.trace;
    trace.setGlobalTracerProvider(traceProvider);
    
    this.tracer = trace.getTracer(serviceName, serviceVersion);
    this.propagation = propagation;
    this.context = context;
    
    console.log('🔍 OpenTelemetry initialized for Orchestration Engine');
  }

  setupLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, traceId, spanId, correlationId }) => {
          const traceInfo = traceId && spanId ? ` [${traceId}:${spanId}]` : '';
          const corrInfo = correlationId ? ` [${correlationId}]` : '';
          return `${timestamp} - ${level.toUpperCase()} - ${traceInfo}${corrInfo} - ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/orchestration-engine.log',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    
    // Enhanced middleware with distributed tracing
    this.app.use((req, res, next) => {
      // Extract trace context from headers
      const incomingTraceId = req.headers['x-trace-id'];
      const incomingSpanId = req.headers['x-span-id'];
      const incomingCorrelationId = req.headers['x-correlation-id'];
      
      let parentSpan;
      if (incomingTraceId && incomingSpanId) {
        parentSpan = this.tracer.startSpan('inherited.request', {
          kind: NodeSDK.SpanKind.SERVER,
          attributes: {
            'http.method': req.method,
            'http.url': req.url,
            'parent.trace.id': incomingTraceId,
            'parent.span.id': incomingSpanId,
            'correlation.id': incomingCorrelationId
          }
        });
      }
      
      // Create span for this request
      const span = this.tracer.startSpan(`${req.method} ${req.path}`, {
        kind: NodeSDK.SpanKind.SERVER,
        parent: parentSpan?.spanContext(),
        attributes: {
          'http.method': req.method,
          'http.url': req.path,
          'correlation.id': incomingCorrelationId || this.generateCorrelationId(),
          'service.cluster': 'kronos-platform'
        }
      });

      // Inject trace context into request
      req.traceId = span.spanContext().traceId;
      req.spanId = span.spanContext().spanId;
      req.correlationId = span.getAttribute('correlation.id');
      req.propagationContext = this.propagation.active();

      this.logger.info('Orchestration request', {
        method: req.method,
        url: req.url,
        traceId: req.traceId,
        spanId: req.spanId,
        correlationId: req.correlationId,
        parentTraceId: incomingTraceId,
        parentSpanId: incomingSpanId
      });
      
      next();
    });
  }

  generateCorrelationId() {
    return `orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setupRoutes() {
    // Workflow management with tracing
    this.app.post('/workflows', this.createTracedWorkflow.bind(this));
    this.app.get('/workflows', this.listTracedWorkflows.bind(this));
    this.app.get('/workflows/:id', this.getTracedWorkflow.bind(this));
    this.app.post('/workflows/:id/execute', this.executeTracedWorkflow.bind(this));
    this.app.delete('/workflows/:id', this.cancelTracedWorkflow.bind(this));

    // Task management with tracing
    this.app.post('/tasks', this.createTracedTask.bind(this));
    this.app.get('/tasks/:id', this.getTracedTask.bind(this));
    this.app.post('/tasks/:id/retry', this.retryTracedTask.bind(this));

    // Orchestration status with tracing
    this.app.get('/status', this.getTracedOrchestrationStatus.bind(this));
    this.app.get('/health', this.healthCheckWithTracing.bind(this));

    // AI-powered workflow suggestions with tracing
    this.app.post('/ai/optimize', this.optimizeTracedWorkflow.bind(this));
    this.app.post('/ai/generate', this.generateTracedWorkflow.bind(this));
  }

  // Enhanced workflow creation with tracing
  async createTracedWorkflow(req, res) {
    const span = this.tracer.startSpan('workflow.create', {
      attributes: {
        'correlation.id': req.correlationId || this.generateCorrelationId(),
        'service.type': 'workflow',
        'operation.name': 'create_workflow'
      }
    });

    try {
      const { name, description, definition, triggers, schedule } = req.body;
      
      const workflowId = uuidv4();
      const workflow = {
        id: workflowId,
        name,
        description,
        definition,
        triggers: triggers || [],
        schedule: schedule || null,
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        metadata: {}
      };

      this.workflowDefinitions.set(workflowId, workflow);
      
      span.setAttributes({
        'workflow.id': workflowId,
        'workflow.name': name,
        'workflow.steps.count': definition?.steps?.length || 0
      });

      if (triggers && triggers.length > 0) {
        await this.setupWorkflowTriggers(workflow);
      }

      if (schedule) {
        await this.setupWorkflowSchedule(workflow);
      }

      this.logger.info('Workflow created', { 
        workflowId, 
        name, 
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });

      res.status(201).json({
        workflowId,
        message: 'Workflow created successfully',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
      
      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

    } catch (error) {
      span.setAttributes({
        'error.type': 'creation_failed',
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      this.logger.error('Workflow creation failed', { 
        error, 
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });
      
      res.status(500).json({ 
        error: 'Workflow creation failed',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
    }
  }

  // Enhanced workflow execution with tracing
  async executeTracedWorkflow(req, res) {
    const span = this.tracer.startSpan('workflow.execute', {
      attributes: {
        'correlation.id': req.correlationId || this.generateCorrelationId(),
        'workflow.id': req.params.id,
        'service.type': 'workflow',
        'operation.name': 'execute_workflow'
      }
    });

    try {
      const { id } = req.params;
      const { parameters, priority = 'normal' } = req.body;
      
      const workflow = this.workflowDefinitions.get(id);
      if (!workflow) {
        span.setAttributes({
          'error.type': 'workflow_not_found',
          'workflow.id': id
        });
        span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        span.end();
        return res.status(404).json({ 
          error: 'Workflow not found',
          correlationId: req.correlationId,
          traceId: req.traceId,
          spanId: req.spanId
        });
      }

      const executionId = uuidv4();
      const execution = {
        id: executionId,
        workflowId: id,
        status: 'queued',
        parameters: parameters || {},
        priority,
        startedAt: null,
        completedAt: null,
        steps: [],
        currentStep: 0,
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      };

      // Add to workflow queue with tracing
      await this.workflowQueue.add('execute-workflow', execution, {
        priority: this.getPriorityValue(priority),
        removeOnComplete: false,
        removeOnFail: false,
        // Add tracing to job
        jobId: executionId,
        data: execution,
        opts: {
          // Add job-specific trace context
          headers: {
            'x-trace-id': req.traceId,
            'x-span-id': req.spanId,
            'x-correlation-id': req.correlationId
          }
        }
      });
      
      this.activeWorkflows.set(executionId, execution);
      
      span.setAttributes({
        'execution.id': executionId,
        'workflow.id': id,
        'execution.priority': priority
      });

      this.logger.info('Workflow execution queued', { 
        workflowId: id, 
        executionId, 
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });

      res.json({
        executionId,
        message: 'Workflow execution queued',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
      
      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

    } catch (error) {
      span.setAttributes({
        'error.type': 'execution_queuing_failed',
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      this.logger.error('Workflow execution failed', { 
        error, 
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });
      
      res.status(500).json({ 
        error: 'Workflow execution failed',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
    }
  }

  // Traced workflow execution processor with performance monitoring
  setupQueueProcessors() {
    this.workflowQueue.process('execute-workflow', async (job) => {
      const execution = job.data;
      
      const span = this.tracer.startSpan('workflow.execution', {
        kind: NodeSDK.SpanKind.INTERNAL,
        attributes: {
          'execution.id': execution.id,
          'workflow.id': execution.workflowId,
          'correlation.id': execution.correlationId,
          'queue.job.id': job.id
        }
      });

      try {
        execution.status = 'running';
        execution.startedAt = new Date();
        this.activeWorkflows.set(execution.id, execution);
        
        span.setAttributes({
          'execution.status': 'running',
          'execution.started_at': execution.startedAt.toISOString()
        });

        this.logger.info('Starting workflow execution', { 
          executionId: execution.id,
          workflowId: execution.workflowId,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          correlationId: execution.correlationId
        });

        const result = await this.executeWorkflowStepsWithTracing(execution, span);
        
        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.result = result;
        
        span.setAttributes({
          'execution.status': 'completed',
          'execution.completed_at': execution.completedAt.toISOString(),
          'execution.duration_ms': execution.completedAt.getTime() - execution.startedAt.getTime(),
          'execution.steps.completed': execution.steps.filter(s => s.status === 'completed').length,
          'execution.steps.failed': execution.steps.filter(s => s.status === 'failed').length
        });

        this.logger.info('Workflow execution completed', { 
          executionId: execution.id,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          correlationId: execution.correlationId,
          duration: execution.completedAt.getTime() - execution.startedAt.getTime()
        });
        
        span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
        span.end();
        return result;
        
      } catch (error) {
        execution.status = 'failed';
        execution.completedAt = new Date();
        execution.error = error.message;
        
        span.setAttributes({
          'execution.status': 'failed',
          'execution.error': error.message,
          'execution.failed_at': execution.completedAt.toISOString()
        });
        span.recordException(error);
        span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        span.end();
        
        this.logger.error('Workflow execution failed', { 
          executionId: execution.id,
          error: error.message,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          correlationId: execution.correlationId
        });
        
        throw error;
      } finally {
        this.activeWorkflows.set(execution.id, execution);
        span.end();
      }
    });
  }

  // Enhanced workflow step execution with tracing
  async executeWorkflowStepsWithTracing(execution, parentSpan) {
    const workflow = this.workflowDefinitions.get(execution.workflowId);
    const steps = workflow.definition.steps || [];
    const results = {};
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      execution.currentStep = i;
      
      const stepSpan = this.tracer.startSpan('workflow.step', {
        parent: parentSpan,
        attributes: {
          'step.id': step.id,
          'step.type': step.type,
          'execution.id': execution.id,
          'step.name': step.name || `Step ${i}`
        }
      });

      try {
        this.logger.info('Executing workflow step', { 
          executionId: execution.id,
          step: i,
          type: step.type,
          traceId: stepSpan.spanContext().traceId,
          spanId: stepSpan.spanContext().spanId,
          correlationId: execution.correlationId
        });

        const stepResult = await this.executeWorkflowStepWithTracing(step, execution.parameters, results, stepSpan);
        
        results[step.id] = stepResult;
        execution.steps.push({
          id: step.id,
          status: 'completed',
          result: stepResult,
          executedAt: new Date()
        });
        
        stepSpan.setAttributes({
          'step.status': 'completed',
          'step.duration_ms': Date.now() - stepSpan.startTime
        });
        stepSpan.setStatus({ code: NodeSDK.SpanStatusCode.OK });
        stepSpan.end();

      } catch (error) {
        execution.steps.push({
          id: step.id,
          status: 'failed',
          error: error.message,
          executedAt: new Date()
        });
        
        stepSpan.setAttributes({
          'step.status': 'failed',
          'step.error': error.message
        });
        stepSpan.recordException(error);
        stepSpan.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        stepSpan.end();
        
        this.logger.error('Workflow step failed', { 
          executionId: execution.id,
          step: i,
          error: error.message,
          traceId: stepSpan.spanContext().traceId,
          spanId: stepSpan.spanContext().spanId,
          correlationId: execution.correlationId
        });
        
        // Check if step has error handling
        if (step.onError === 'continue') {
          parentSpan.setAttributes({
            'step.error.handled': 'continue',
            'step.id': step.id
          });
          continue;
        } else if (step.onError === 'retry') {
          parentSpan.setAttributes({
            'step.error.handled': 'retry',
            'step.id': step.id,
            'step.retry.count': (execution.steps.filter(s => s.id === step.id).length || 0) + 1
          });
          i--; // Retry same step
          continue;
        } else {
          parentSpan.setAttributes({
            'step.error.handled': 'fail',
            'step.id': step.id
          });
          throw error; // Fail workflow
        }
      }
    }
    
    parentSpan.setAttributes({
      'workflow.steps.total': steps.length,
      'workflow.steps.completed': execution.steps.filter(s => s.status === 'completed').length,
      'workflow.steps.failed': execution.steps.filter(s => s.status === 'failed').length
    });
    
    return results;
  }

  // Enhanced service call with tracing
  async executeWorkflowStepWithTracing(step, parameters, previousResults, parentSpan) {
    const serviceCallSpan = this.tracer.startSpan('service.call', {
      parent: parentSpan,
      attributes: {
        'step.type': step.type,
        'service.target': step.type
      }
    });

    try {
      let result;
      
      switch (step.type) {
        case 'kronos-desktop-agent':
          result = await this.executeDesktopAgentStepWithTracing(step, parameters, serviceCallSpan);
          break;
        case 'kronos-ui-automation':
          result = await this.executeUIAutomationStepWithTracing(step, parameters, serviceCallSpan);
          break;
        case 'kronos-web-automation':
          result = await this.executeWebAutomationStepWithTracing(step, parameters, serviceCallSpan);
          break;
        case 'kronos-ai-generate':
          result = await this.executeAIGenerationStepWithTracing(step, parameters, serviceCallSpan);
          break;
        case 'kronos-social-post':
          result = await this.executeSocialPostStepWithTracing(step, parameters, serviceCallSpan);
          break;
        case 'condition':
          result = await this.evaluateConditionWithTracing(step, parameters, previousResults, serviceCallSpan);
          break;
        case 'delay':
          result = await this.executeDelay(step);
          break;
        default:
          result = await this.executeViaServiceRegistryWithTracing(step, parameters, serviceCallSpan);
          break;
      }
      
      serviceCallSpan.setAttributes({
        'service.call.success': true,
        'service.call.duration_ms': Date.now() - serviceCallSpan.startTime
      });
      serviceCallSpan.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      serviceCallSpan.end();
      
      return result;
      
    } catch (error) {
      serviceCallSpan.setAttributes({
        'service.call.error': true,
        'service.call.error.message': error.message
      });
      serviceCallSpan.recordException(error);
      serviceCallSpan.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      serviceCallSpan.end();
      
      this.logger.error('Service call failed', { 
        step: step.type, 
        error: error.message,
        traceId: serviceCallSpan.spanContext().traceId,
        spanId: serviceCallSpan.spanContext().spanId,
        correlationId: parentSpan?.getAttribute?.('correlation.id')
      });
      
      throw error;
    }
  }

  // Enhanced service registry calls with tracing
  async executeViaServiceRegistryWithTracing(step, parameters, parentSpan) {
    const serviceRegistrySpan = this.tracer.startSpan('service.registry.lookup', {
      parent: parentSpan,
      attributes: {
        'step.type': step.type,
        'service.registry.target': step.type
      }
    });

    try {
      // Get service endpoint from registry
      const registryResponse = await axios.get(`http://localhost:8080/services/${step.type}`, {
        headers: {
          'x-trace-id': parentSpan?.spanContext()?.traceId,
          'x-span-id': parentSpan?.spanContext()?.spanId,
          'x-correlation-id': parentSpan?.getAttribute?.('correlation.id')
        }
      });
      
      const service = registryResponse.data.service;
      
      serviceRegistrySpan.setAttributes({
        'service.found': true,
        'service.name': service.name,
        'service.endpoint': service.endpoint
      });

      // Execute via service with enhanced tracing
      const response = await axios.post(`${service.endpoint}/api/execute`, {
        step,
        parameters,
        headers: {
          'x-trace-id': parentSpan?.spanContext()?.traceId,
          'x-span-id': parentSpan?.spanContext()?.spanId,
          'x-correlation-id': parentSpan?.getAttribute?.('correlation.id')
        }
      }, {
        timeout: 30000
      });
      
      serviceRegistrySpan.setAttributes({
        'service.call.completed': true,
        'service.call.duration_ms': Date.now() - serviceRegistrySpan.startTime
      });
      serviceRegistrySpan.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      serviceRegistrySpan.end();
      
      return response.data;
      
    } catch (error) {
      serviceRegistrySpan.setAttributes({
        'service.call.error': true,
        'service.call.error.message': error.message
      });
      serviceRegistrySpan.recordException(error);
      serviceRegistrySpan.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      serviceRegistrySpan.end();
      
      this.logger.error('Service registry execution failed', { 
        step: step.type, 
        error: error.message,
        traceId: serviceRegistrySpan.spanContext()?.traceId,
        spanId: serviceRegistrySpan.spanContext()?.spanId,
        correlationId: parentSpan?.getAttribute?.('correlation.id')
      });
      
      throw error;
    }
  }

  // Additional traced methods would follow the same pattern...
  async optimizeTracedWorkflow(req, res) {
    const span = this.tracer.startSpan('workflow.optimize', {
      attributes: {
        'correlation.id': req.correlationId || this.generateCorrelationId(),
        'service.type': 'workflow',
        'operation.name': 'optimize_workflow'
      }
    });

    try {
      const { workflowId, optimizationGoals } = req.body;
      
      const workflow = this.workflowDefinitions.get(workflowId);
      if (!workflow) {
        span.setAttributes({
          'error.type': 'workflow_not_found',
          'workflow.id': workflowId
        });
        span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        span.end();
        return res.status(404).json({ 
          error: 'Workflow not found',
          correlationId: req.correlationId,
          traceId: span.traceId,
          spanId: req.spanId
        });
      }

      // AI-powered optimization with tracing
      const optimizations = await this.generateWorkflowOptimizationsWithTracing(workflow, optimizationGoals, span);
      
      res.json({
        workflowId,
        optimizations,
        correlationId: req.correlationId,
        traceId: span.traceId,
        spanId: req.spanId
      });
      
      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

    } catch (error) {
      span.setAttributes({
        'error.type': 'optimization_failed',
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      this.logger.error('Workflow optimization failed', { 
        error, 
        traceId: span.traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });
      
      res.status(500).json({ 
        error: 'Optimization failed',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
    }
  }

  // Additional traced methods follow same pattern...
  async generateTracedWorkflow(req, res) {
    const span = this.tracer.startSpan('workflow.generate', {
      attributes: {
        'correlation.id': req.correlationId || this.generateCorrelationId(),
        'service.type': 'workflow',
        'operation.name': 'generate_workflow'
      }
    });

    try {
      const { description, parameters } = req.body;
      
      // AI-powered workflow generation with tracing
      const workflowDefinition = await this.generateWorkflowFromDescriptionWithTracing(description, parameters, span);
      
      res.json({
        workflow: workflowDefinition,
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
      
      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

    } catch (error) {
      span.setAttributes({
        'error.type': 'generation_failed',
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      this.logger.error('Workflow generation failed', { 
        error, 
        traceId: span.traceId,
        spanId: span.spanContext().spanId,
        correlationId: req.correlationId
      });
      
      res.status(500).json({ 
        error: 'Generation failed',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
    }
  }

  // Enhanced health check with tracing
  async healthCheckWithTracing(req, res) {
    const span = this.tracer.startSpan('health.check', {
      attributes: {
        'correlation.id': req.correlationId || this.generateCorrelationId(),
        'service.type': 'workflow',
        'operation.name': 'health_check'
      }
    });

    try {
      const status = {
        activeWorkflows: this.activeWorkflows.size,
        workflowDefinitions: this.workflowDefinitions.size,
        workflowQueue: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        },
        taskQueue: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };

      span.setAttributes({
        'status.healthy': true,
        'active.workflows': this.activeWorkflows.size,
        'workflow.definitions': this.workflowDefinitions.size
      });

      res.json({
        status,
        correlationId: req.correlationId,
        traceId: span.traceId,
        spanId: req.spanId
      });
      
      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

    } catch (error) {
      span.setAttributes({
        'error.type': 'health_check_failed',
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      res.status(500).json({ 
        error: 'Health check failed',
        correlationId: req.correlationId,
        traceId: req.traceId,
        spanId: req.spanId
      });
    }
  }

  // Helper methods with tracing would follow same pattern...
  getPriorityValue(priority) {
    const priorities = { low: 1, normal: 5, high: 10, urgent: 20 };
    return priorities[priority] || 5;
  }

  async start() {
    const span = this.tracer.startSpan('server.startup', {
      attributes: {
        'service.port': this.port,
        'workflow.definitions.loaded': this.workflowDefinitions.size
      }
    });

    try {
      await this.redis.connect();
      
      span.setAttributes({
        'redis.connected': true,
        'service.discovery.initialized': true
      });

      console.log('Connected to Redis for orchestration');
      
      this.app.listen(this.port, () => {
        span.setAttributes({
          'server.listening': true,
          'routes.count': this.routes.length,
          'services.count': this.services.size
        });

        console.log(`🚀 KRONOS Orchestration Engine with distributed tracing running on port ${this.port}`);
        console.log(`📋 Loaded ${this.workflowDefinitions.size} traced workflow definitions`);
        console.log(`⚙️  Active workflow executions: ${this.activeWorkflows.size}`);
        console.log(`🔄 Workflow and task queues initialized with tracing`);
        console.log(`🤖 AI-powered optimization and generation ready`);
        console.log(`🌐 Ready at http://localhost:${this.port}`);
        console.log(`🔍 OpenTelemetry tracing active`);
        
        span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
        span.end();
      });
      
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      console.error('Failed to start Orchestration Engine:', error);
      throw error;
    }
  }
}

// Start the enhanced orchestration engine
const orchestrationEngine = new KronosOrchestrationEngineWithTracing(5001);
orchestrationEngine.start().catch(console.error);

module.exports = KronosOrchestrationEngineWithTracing;