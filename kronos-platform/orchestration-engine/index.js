const express = require('express');
const Queue = require('bull');
const { createClient } = require('redis');
const winston = require('winston');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// KRONOS Orchestration Engine - AI-powered workflow orchestration
class KronosOrchestrationEngine {
  constructor(port = 5001) {
    this.port = port;
    this.app = express();
    this.redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.logger = this.setupLogger();

    // Workflow queues for different priorities
    this.workflowQueue = new Queue('kronos-workflows', {
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' }
    });

    this.taskQueue = new Queue('kronos-tasks', {
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' }
    });

    // Active workflows and tasks tracking
    this.activeWorkflows = new Map();
    this.workflowDefinitions = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupQueueProcessors();
    this.loadWorkflowDefinitions();
  }

  setupLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
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

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('Orchestration request', {
        method: req.method,
        url: req.url,
        correlationId: req.headers['x-correlation-id']
      });
      next();
    });
  }

  setupRoutes() {
    // Workflow management
    this.app.post('/workflows', this.createWorkflow.bind(this));
    this.app.get('/workflows', this.listWorkflows.bind(this));
    this.app.get('/workflows/:id', this.getWorkflow.bind(this));
    this.app.post('/workflows/:id/execute', this.executeWorkflow.bind(this));
    this.app.delete('/workflows/:id', this.cancelWorkflow.bind(this));

    // Task management
    this.app.post('/tasks', this.createTask.bind(this));
    this.app.get('/tasks/:id', this.getTask.bind(this));
    this.app.post('/tasks/:id/retry', this.retryTask.bind(this));

    // Orchestration status
    this.app.get('/status', this.getOrchestrationStatus.bind(this));
    this.app.get('/health', this.healthCheck.bind(this));

    // AI-powered workflow suggestions
    this.app.post('/ai/optimize', this.optimizeWorkflow.bind(this));
    this.app.post('/ai/generate', this.generateWorkflow.bind(this));
  }

  async createWorkflow(req, res) {
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

      // Store workflow definition
      this.workflowDefinitions.set(workflowId, workflow);

      // Set up triggers if specified
      if (triggers && triggers.length > 0) {
        await this.setupWorkflowTriggers(workflow);
      }

      // Set up schedule if specified
      if (schedule) {
        await this.setupWorkflowSchedule(workflow);
      }

      this.logger.info('Workflow created', { workflowId, name });

      res.status(201).json({
        workflowId,
        message: 'Workflow created successfully',
        correlationId: req.headers['x-correlation-id']
      });
    } catch (error) {
      this.logger.error('Workflow creation failed', { error });
      res.status(500).json({ error: 'Workflow creation failed' });
    }
  }

  async executeWorkflow(req, res) {
    try {
      const { id } = req.params;
      const { parameters, priority = 'normal' } = req.body;

      const workflow = this.workflowDefinitions.get(id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
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
        correlationId: req.headers['x-correlation-id']
      };

      // Add to workflow queue
      await this.workflowQueue.add('execute-workflow', execution, {
        priority: this.getPriorityValue(priority),
        removeOnComplete: false,
        removeOnFail: false
      });

      this.activeWorkflows.set(executionId, execution);

      this.logger.info('Workflow execution queued', { workflowId: id, executionId });

      res.json({
        executionId,
        message: 'Workflow execution queued',
        correlationId: req.headers['x-correlation-id']
      });
    } catch (error) {
      this.logger.error('Workflow execution failed', { error });
      res.status(500).json({ error: 'Workflow execution failed' });
    }
  }

  setupQueueProcessors() {
    // Workflow execution processor
    this.workflowQueue.process('execute-workflow', async (job) => {
      const execution = job.data;

      try {
        execution.status = 'running';
        execution.startedAt = new Date();
        this.activeWorkflows.set(execution.id, execution);

        this.logger.info('Starting workflow execution', { executionId: execution.id });

        const result = await this.executeWorkflowSteps(execution);

        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.result = result;

        this.logger.info('Workflow execution completed', { executionId: execution.id });

        return result;
      } catch (error) {
        execution.status = 'failed';
        execution.completedAt = new Date();
        execution.error = error.message;

        this.logger.error('Workflow execution failed', {
          executionId: execution.id,
          error: error.message
        });

        throw error;
      } finally {
        this.activeWorkflows.set(execution.id, execution);
      }
    });

    // Task execution processor
    this.taskQueue.process('execute-task', async (job) => {
      const task = job.data;

      try {
        this.logger.info('Executing task', { taskId: task.id, type: task.type });

        const result = await this.executeTask(task);

        this.logger.info('Task execution completed', { taskId: task.id });
        return result;
      } catch (error) {
        this.logger.error('Task execution failed', { taskId: task.id, error: error.message });
        throw error;
      }
    });
  }

  async executeWorkflowSteps(execution) {
    const workflow = this.workflowDefinitions.get(execution.workflowId);
    const steps = workflow.definition.steps || [];

    const results = {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      execution.currentStep = i;

      try {
        this.logger.info('Executing workflow step', {
          executionId: execution.id,
          step: i,
          type: step.type
        });

        const stepResult = await this.executeWorkflowStep(step, execution.parameters, results);

        results[step.id] = stepResult;
        execution.steps.push({
          id: step.id,
          status: 'completed',
          result: stepResult,
          executedAt: new Date()
        });

      } catch (error) {
        execution.steps.push({
          id: step.id,
          status: 'failed',
          error: error.message,
          executedAt: new Date()
        });

        // Check if step has error handling
        if (step.onError === 'continue') {
          continue;
        } else if (step.onError === 'retry') {
          i--; // Retry the same step
          continue;
        } else {
          throw error; // Fail the workflow
        }
      }
    }

    return results;
  }

  async executeWorkflowStep(step, parameters, previousResults) {
    switch (step.type) {
      case 'kronos-desktop-agent':
        return await this.executeDesktopAgentStep(step, parameters);

      case 'kronos-ui-automation':
        return await this.executeUIAutomationStep(step, parameters);

      case 'kronos-web-automation':
        return await this.executeWebAutomationStep(step, parameters);

      case 'kronos-ai-generate':
        return await this.executeAIGenerationStep(step, parameters);

      case 'kronos-social-post':
        return await this.executeSocialPostStep(step, parameters);

      case 'condition':
        return await this.evaluateCondition(step, parameters, previousResults);

      case 'delay':
        return await this.executeDelay(step);

      default:
        // Execute via service registry
        return await this.executeViaServiceRegistry(step, parameters);
    }
  }

  async executeDesktopAgentStep(step, parameters) {
    // Call KRONOS Desktop Agent service
    const response = await axios.post('http://localhost:9990/api/execute', {
      action: step.action,
      parameters: { ...parameters, ...step.parameters }
    }, {
      timeout: 30000
    });

    return response.data;
  }

  async executeUIAutomationStep(step, parameters) {
    // Call KRONOS UI Automation service
    const response = await axios.post('http://localhost:8003/api/execute', {
      action: step.action,
      image: step.image || parameters.screenshot,
      instructions: step.instructions,
      parameters: { ...parameters, ...step.parameters }
    }, {
      timeout: 60000
    });

    return response.data;
  }

  async executeWebAutomationStep(step, parameters) {
    // Call KRONOS Web Automation service
    const response = await axios.post('http://localhost:3001/api/automate', {
      url: step.url,
      actions: step.actions,
      parameters: { ...parameters, ...step.parameters }
    }, {
      timeout: 60000
    });

    return response.data;
  }

  async executeAIGenerationStep(step, parameters) {
    // Call KRONOS AI service
    const response = await axios.post('http://localhost:3003/api/generate', {
      prompt: step.prompt,
      model: step.model || 'claude-3-sonnet-20240229',
      parameters: { ...parameters, ...step.parameters }
    }, {
      timeout: 120000
    });

    return response.data;
  }

  async executeSocialPostStep(step, parameters) {
    // Call KRONOS Social Scheduler
    const response = await axios.post('http://localhost:3002/api/social/posts', {
      platform: step.platform,
      content: step.content,
      schedule: step.schedule,
      parameters: { ...parameters, ...step.parameters }
    });

    return response.data;
  }

  async evaluateCondition(step, parameters, previousResults) {
    // Evaluate conditional logic
    const condition = step.condition;

    // Simple condition evaluation (can be extended with a proper expression evaluator)
    if (condition.type === 'value') {
      const leftValue = this.resolveValue(condition.left, parameters, previousResults);
      const rightValue = this.resolveValue(condition.right, parameters, previousResults);

      switch (condition.operator) {
        case 'equals': return leftValue === rightValue;
        case 'not_equals': return leftValue !== rightValue;
        case 'greater_than': return leftValue > rightValue;
        case 'less_than': return leftValue < rightValue;
        default: return false;
      }
    }

    return false;
  }

  resolveValue(value, parameters, previousResults) {
    if (typeof value === 'string' && value.startsWith('$')) {
      if (value.startsWith('$.parameters.')) {
        return this.getNestedValue(parameters, value.substring(13));
      } else if (value.startsWith('$.results.')) {
        return this.getNestedValue(previousResults, value.substring(10));
      }
    }
    return value;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async executeDelay(step) {
    const delay = step.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return { delayed: delay };
  }

  async executeViaServiceRegistry(step, parameters) {
    // Route to appropriate service via service registry
    try {
      // Get service endpoint from registry
      const registryResponse = await axios.get(`http://localhost:8080/services/${step.type}`);
      const service = registryResponse.data.service;

      // Execute via service
      const response = await axios.post(`${service.endpoint}/api/execute`, {
        step,
        parameters
      });

      return response.data;
    } catch (error) {
      this.logger.error('Service registry execution failed', { step: step.type, error: error.message });
      throw error;
    }
  }

  async executeTask(task) {
    // Route task to appropriate service
    const taskRoutes = {
      'desktop-action': 'http://localhost:9990/api/execute',
      'ui-automation': 'http://localhost:8003/api/execute',
      'vision-gui': 'http://localhost:8003/api/analyze',
      'web-scraping': 'http://localhost:3001/api/scrape',
      'ai-generation': 'http://localhost:3003/api/generate',
      'social-post': 'http://localhost:3002/api/social/posts',
      'file-processing': 'http://localhost:4000/api/process'
    };

    const endpoint = taskRoutes[task.type];
    if (!endpoint) {
      throw new Error(`Unknown task type: ${task.type}`);
    }

    const response = await axios.post(endpoint, task.parameters);
    return response.data;
  }

  async setupWorkflowTriggers(workflow) {
    // Set up webhook triggers, schedule triggers, etc.
    for (const trigger of workflow.triggers) {
      if (trigger.type === 'webhook') {
        // Create webhook endpoint for this workflow
        this.app.post(`/webhooks/workflow/${workflow.id}`, async (req, res) => {
          await this.executeWorkflow({ params: { id: workflow.id }, body: req.body }, { json: () => {} });
          res.json({ message: 'Workflow triggered' });
        });
      }
    }
  }

  async setupWorkflowSchedule(workflow) {
    // Set up cron schedules for workflows
    // This would use node-cron or similar
    console.log(`Setting up schedule for workflow ${workflow.id}: ${workflow.schedule}`);
  }

  // AI-powered workflow optimization
  async optimizeWorkflow(req, res) {
    try {
      const { workflowId, optimizationGoals } = req.body;

      const workflow = this.workflowDefinitions.get(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // AI-powered optimization suggestions
      const optimizations = await this.generateWorkflowOptimizations(workflow, optimizationGoals);

      res.json({
        workflowId,
        optimizations,
        correlationId: req.headers['x-correlation-id']
      });
    } catch (error) {
      this.logger.error('Workflow optimization failed', { error });
      res.status(500).json({ error: 'Optimization failed' });
    }
  }

  // AI-powered workflow generation from natural language
  async generateWorkflow(req, res) {
    try {
      const { description, parameters } = req.body;

      // AI-powered workflow generation
      const workflowDefinition = await this.generateWorkflowFromDescription(description, parameters);

      res.json({
        workflow: workflowDefinition,
        correlationId: req.headers['x-correlation-id']
      });
    } catch (error) {
      this.logger.error('Workflow generation failed', { error });
      res.status(500).json({ error: 'Generation failed' });
    }
  }

  async generateWorkflowOptimizations(workflow, goals) {
    // AI-powered optimization analysis
    const optimizations = [];

    // Parallel execution opportunities
    if (goals.includes('performance')) {
      const parallelSteps = this.identifyParallelSteps(workflow.definition);
      if (parallelSteps.length > 0) {
        optimizations.push({
          type: 'parallelization',
          description: 'Steps can be executed in parallel',
          steps: parallelSteps,
          impact: 'high'
        });
      }
    }

    // Redundant step elimination
    if (goals.includes('efficiency')) {
      const redundantSteps = this.identifyRedundantSteps(workflow.definition);
      if (redundantSteps.length > 0) {
        optimizations.push({
          type: 'redundancy_elimination',
          description: 'Redundant steps can be removed',
          steps: redundantSteps,
          impact: 'medium'
        });
      }
    }

    // Error handling improvements
    if (goals.includes('reliability')) {
      optimizations.push({
        type: 'error_handling',
        description: 'Add comprehensive error handling',
        recommendations: [
          'Add retry logic for failed steps',
          'Implement fallback mechanisms',
          'Add timeout configurations'
        ],
        impact: 'high'
      });
    }

    return optimizations;
  }

  async generateWorkflowFromDescription(description, parameters) {
    // AI-powered workflow generation from natural language
    // This would integrate with KRONOS AI service
    const workflow = {
      name: 'Generated Workflow',
      description: `Generated from: ${description}`,
      definition: {
        steps: [
          {
            id: 'analyze-requirements',
            type: 'kronos-ai-generate',
            name: 'Analyze Requirements',
            parameters: { prompt: description }
          },
          {
            id: 'execute-tasks',
            type: 'kronos-desktop-agent',
            name: 'Execute Tasks',
            dependsOn: ['analyze-requirements']
          }
        ]
      }
    };

    return workflow;
  }

  identifyParallelSteps(definition) {
    // Simple parallel execution analysis
    const steps = definition.steps || [];
    const parallelGroups = [];

    // Identify steps that don't depend on each other
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        if (!this.stepsDependOnEachOther(steps[i], steps[j])) {
          parallelGroups.push([steps[i].id, steps[j].id]);
        }
      }
    }

    return parallelGroups;
  }

  identifyRedundantSteps(definition) {
    // Simple redundancy analysis
    const steps = definition.steps || [];
    const redundant = [];

    // Check for duplicate actions
    const actionMap = new Map();
    steps.forEach(step => {
      const key = `${step.type}-${JSON.stringify(step.parameters)}`;
      if (actionMap.has(key)) {
        redundant.push(step.id);
      } else {
        actionMap.set(key, step.id);
      }
    });

    return redundant;
  }

  stepsDependOnEachOther(step1, step2) {
    // Simple dependency analysis
    return step1.dependsOn?.includes(step2.id) || step2.dependsOn?.includes(step1.id);
  }

  getPriorityValue(priority) {
    const priorities = { low: 1, normal: 5, high: 10, urgent: 20 };
    return priorities[priority] || 5;
  }

  listWorkflows(req, res) {
    const workflows = Array.from(this.workflowDefinitions.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      createdAt: w.createdAt,
      version: w.version
    }));

    res.json({
      workflows,
      count: workflows.length,
      correlationId: req.headers['x-correlation-id']
    });
  }

  getWorkflow(req, res) {
    const { id } = req.params;
    const workflow = this.workflowDefinitions.get(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({
      workflow,
      correlationId: req.headers['x-correlation-id']
    });
  }

  cancelWorkflow(req, res) {
    const { id } = req.params;

    // Cancel active executions
    const activeExecutions = Array.from(this.activeWorkflows.values())
      .filter(e => e.workflowId === id && e.status === 'running');

    activeExecutions.forEach(execution => {
      execution.status = 'cancelled';
      this.activeWorkflows.set(execution.id, execution);
    });

    res.json({
      message: 'Workflow cancelled',
      cancelledExecutions: activeExecutions.length,
      correlationId: req.headers['x-correlation-id']
    });
  }

  createTask(req, res) {
    const { type, parameters, priority = 'normal' } = req.body;
    const taskId = uuidv4();

    const task = {
      id: taskId,
      type,
      parameters,
      priority,
      status: 'queued',
      createdAt: new Date()
    };

    this.taskQueue.add('execute-task', task, {
      priority: this.getPriorityValue(priority)
    });

    res.status(201).json({
      taskId,
      message: 'Task queued successfully',
      correlationId: req.headers['x-correlation-id']
    });
  }

  getTask(req, res) {
    // This would need a task storage mechanism
    res.json({
      message: 'Task status endpoint - implementation pending',
      correlationId: req.headers['x-correlation-id']
    });
  }

  retryTask(req, res) {
    // Implementation for retrying failed tasks
    res.json({
      message: 'Task retry endpoint - implementation pending',
      correlationId: req.headers['x-correlation-id']
    });
  }

  getOrchestrationStatus(req, res) {
    const status = {
      activeWorkflows: this.activeWorkflows.size,
      workflowDefinitions: this.workflowDefinitions.size,
      workflowQueue: {
        waiting: 0, // Would need to query Bull queue
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

    res.json({
      status,
      correlationId: req.headers['x-correlation-id']
    });
  }

  healthCheck(req, res) {
    res.json({
      status: 'healthy',
      service: 'orchestration-engine',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      correlationId: req.headers['x-correlation-id']
    });
  }

  loadWorkflowDefinitions() {
    // Load default workflow templates
    const defaultWorkflows = [
      {
        id: 'social-media-automation',
        name: 'Social Media Automation',
        description: 'Generate and post content across multiple social platforms',
        definition: {
          steps: [
            {
              id: 'generate-content',
              type: 'kronos-ai-generate',
              name: 'Generate Content',
              parameters: { prompt: 'Create engaging social media content' }
            },
            {
              id: 'post-twitter',
              type: 'kronos-social-post',
              name: 'Post to Twitter',
              platform: 'twitter',
              dependsOn: ['generate-content']
            },
            {
              id: 'post-linkedin',
              type: 'kronos-social-post',
              name: 'Post to LinkedIn',
              platform: 'linkedin',
              dependsOn: ['generate-content']
            }
          ]
        }
      },
      {
        id: 'web-data-extraction',
        name: 'Web Data Extraction',
        description: 'Extract and process data from websites',
        definition: {
          steps: [
            {
              id: 'scrape-website',
              type: 'kronos-web-automation',
              name: 'Scrape Website',
              parameters: { url: '{{url}}', selectors: ['.data-item'] }
            },
            {
              id: 'process-data',
              type: 'kronos-ai-generate',
              name: 'Process Data',
              dependsOn: ['scrape-website'],
              parameters: { prompt: 'Analyze and summarize this data: {{results}}' }
            }
          ]
        }
      },
      {
        id: 'browser-automation-workflow',
        name: 'Browser Automation Workflow',
        description: 'Perform complex browser automation tasks with AI guidance',
        definition: {
          steps: [
            {
              id: 'browser-navigate',
              type: 'kronos-browser-automation',
              name: 'Navigate to Website',
              parameters: {
                action: 'navigate',
                url: '{{targetUrl}}',
                browser: '{{browserType}}',
                headless: '{{headlessMode}}'
              }
            },
            {
              id: 'browser-interact',
              type: 'kronos-browser-automation',
              name: 'Interact with Page',
              dependsOn: ['browser-navigate'],
              parameters: {
                action: 'interact',
                instructions: '{{userInstructions}}',
                screenshot: true
              }
            },
            {
              id: 'browser-extract',
              type: 'kronos-browser-automation',
              name: 'Extract Data',
              dependsOn: ['browser-interact'],
              parameters: {
                action: 'extract',
                selectors: '{{dataSelectors}}',
                format: 'structured'
              }
            },
            {
              id: 'ai-analyze',
              type: 'kronos-ai-generate',
              name: 'Analyze Results',
              dependsOn: ['browser-extract'],
              parameters: {
                prompt: 'Analyze this extracted data and provide insights: {{extractedData}}'
              }
            }
          ]
        }
      },
      {
        id: 'multi-browser-testing',
        name: 'Multi-Browser Testing Suite',
        description: 'Test web applications across multiple browsers',
        definition: {
          steps: [
            {
              id: 'test-chrome',
              type: 'kronos-browser-automation',
              name: 'Test in Chrome',
              parameters: {
                action: 'test',
                browser: 'chrome',
                testCases: '{{testCases}}',
                url: '{{testUrl}}'
              }
            },
            {
              id: 'test-firefox',
              type: 'kronos-browser-automation',
              name: 'Test in Firefox',
              parameters: {
                action: 'test',
                browser: 'firefox',
                testCases: '{{testCases}}',
                url: '{{testUrl}}'
              }
            },
            {
              id: 'test-edge',
              type: 'kronos-browser-automation',
              name: 'Test in Edge',
              parameters: {
                action: 'test',
                browser: 'edge',
                testCases: '{{testCases}}',
                url: '{{testUrl}}'
              }
            },
            {
              id: 'generate-report',
              type: 'kronos-ai-generate',
              name: 'Generate Test Report',
              dependsOn: ['test-chrome', 'test-firefox', 'test-edge'],
              parameters: {
                prompt: 'Generate a comprehensive test report from these browser test results: Chrome: {{test-chrome.result}}, Firefox: {{test-firefox.result}}, Edge: {{test-edge.result}}'
              }
            }
          ]
        }
      },
       {
         id: 'web-form-automation',
         name: 'Web Form Automation',
         description: 'Automatically fill and submit web forms',
         definition: {
           steps: [
             {
               id: 'navigate-to-form',
               type: 'kronos-browser-automation',
               name: 'Navigate to Form',
               parameters: {
                 action: 'navigate',
                 url: '{{formUrl}}',
                 waitForSelector: '{{formSelector}}'
               }
             },
             {
               id: 'fill-form-fields',
               type: 'kronos-browser-automation',
               name: 'Fill Form Fields',
               dependsOn: ['navigate-to-form'],
               parameters: {
                 action: 'fillForm',
                 formData: '{{formData}}',
                 submit: false
               }
             },
             {
               id: 'validate-form',
               type: 'kronos-browser-automation',
               name: 'Validate Form',
               dependsOn: ['fill-form-fields'],
               parameters: {
                 action: 'validate',
                 validationRules: '{{validationRules}}'
               }
             },
             {
               id: 'submit-form',
               type: 'kronos-browser-automation',
               name: 'Submit Form',
               dependsOn: ['validate-form'],
               parameters: {
                 action: 'submit',
                 waitForResponse: true
               }
             }
           ]
         }
       },
       {
         id: 'desktop-application-automation',
         name: 'Desktop Application Automation',
         description: 'Automate complex desktop application workflows',
         definition: {
           steps: [
             {
               id: 'launch-application',
               type: 'kronos-desktop-agent',
               name: 'Launch Application',
               parameters: {
                 action: 'launch_app',
                 application: '{{applicationName}}',
                 parameters: '{{appParameters}}'
               }
             },
             {
               id: 'navigate-ui',
               type: 'kronos-ui-automation',
               name: 'Navigate UI',
               dependsOn: ['launch-application'],
               parameters: {
                 action: 'navigate',
                 instructions: 'Navigate to {{targetSection}} in the application',
                 screenshot: true
               }
             },
             {
               id: 'perform-actions',
               type: 'kronos-ui-automation',
               name: 'Perform Actions',
               dependsOn: ['navigate-ui'],
               parameters: {
                 action: 'interact',
                 instructions: '{{userInstructions}}',
                 screenshot: true
               }
             },
             {
               id: 'extract-data',
               type: 'kronos-ui-automation',
               name: 'Extract Data',
               dependsOn: ['perform-actions'],
               parameters: {
                 action: 'extract',
                 instructions: 'Extract {{dataType}} from the current screen',
                 format: 'structured'
               }
             }
           ]
         }
       },
       {
         id: 'vision-guided-desktop-automation',
         name: 'Vision-Guided Desktop Automation',
         description: 'Use computer vision to guide complex desktop automation tasks',
         definition: {
           steps: [
             {
               id: 'capture-screen',
               type: 'kronos-desktop-agent',
               name: 'Capture Screen',
               parameters: {
                 action: 'screenshot',
                 fullScreen: true
               }
             },
             {
               id: 'analyze-screen',
               type: 'kronos-ui-automation',
               name: 'Analyze Screen',
               dependsOn: ['capture-screen'],
               parameters: {
                 action: 'analyze',
                 instructions: 'Analyze the current desktop screen and identify key UI elements',
                 image: '{{screenshotResult}}'
               }
             },
             {
               id: 'plan-actions',
               type: 'kronos-ai-generate',
               name: 'Plan Actions',
               dependsOn: ['analyze-screen'],
               parameters: {
                 prompt: 'Based on this screen analysis: {{analysisResult}}, plan the next steps to {{taskDescription}}'
               }
             },
             {
               id: 'execute-actions',
               type: 'kronos-desktop-agent',
               name: 'Execute Actions',
               dependsOn: ['plan-actions'],
               parameters: {
                 action: 'execute_plan',
                 plan: '{{actionPlan}}'
               }
             }
           ]
         }
       },
       {
         id: 'multi-modal-document-processing',
         name: 'Multi-Modal Document Processing',
         description: 'Process documents using desktop applications and vision analysis',
         definition: {
           steps: [
             {
               id: 'open-document',
               type: 'kronos-desktop-agent',
               name: 'Open Document',
               parameters: {
                 action: 'open_file',
                 filePath: '{{documentPath}}',
                 application: '{{preferredApp}}'
               }
             },
             {
               id: 'capture-document-view',
               type: 'kronos-desktop-agent',
               name: 'Capture Document View',
               dependsOn: ['open-document'],
               parameters: {
                 action: 'screenshot',
                 region: 'application-window'
               }
             },
             {
               id: 'analyze-document-content',
               type: 'kronos-ui-automation',
               name: 'Analyze Document Content',
               dependsOn: ['capture-document-view'],
               parameters: {
                 action: 'analyze_document',
                 instructions: 'Extract and analyze the content from this document screenshot',
                 image: '{{screenshotResult}}',
                 documentType: '{{documentType}}'
               }
             },
             {
               id: 'process-extracted-data',
               type: 'kronos-ai-generate',
               name: 'Process Extracted Data',
               dependsOn: ['analyze-document-content'],
               parameters: {
                 prompt: 'Process this extracted document data: {{extractedData}} and {{processingInstructions}}'
               }
             },
             {
               id: 'save-results',
               type: 'kronos-desktop-agent',
               name: 'Save Results',
               dependsOn: ['process-extracted-data'],
               parameters: {
                 action: 'save_file',
                 content: '{{processedData}}',
                 filePath: '{{outputPath}}'
               }
             }
           ]
         }
       },
      {
        id: 'browser-automation-workflow',
        name: 'Browser Automation Workflow',
        description: 'Perform complex browser automation tasks with AI guidance',
        definition: {
          steps: [
            {
              id: 'browser-navigate',
              type: 'kronos-browser-automation',
              name: 'Navigate to Website',
              parameters: {
                action: 'navigate',
                url: '{{targetUrl}}',
                browser: '{{browserType}}',
                headless: '{{headlessMode}}'
              }
            },
            {
              id: 'browser-interact',
              type: 'kronos-browser-automation',
              name: 'Interact with Page',
              dependsOn: ['browser-navigate'],
              parameters: {
                action: 'interact',
                instructions: '{{userInstructions}}',
                screenshot: true
              }
            },
            {
              id: 'ai-analyze',
              type: 'kronos-ai-generate',
              name: 'Analyze Results',
              dependsOn: ['browser-interact'],
              parameters: {
                prompt: 'Analyze this browser automation result and provide insights: {{browser-interact.result}}'
              }
            }
          ]
        }
      }
    ];

    defaultWorkflows.forEach(workflow => {
      this.workflowDefinitions.set(workflow.id, {
        ...workflow,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        metadata: { template: true }
      });
    });

    console.log(`Loaded ${defaultWorkflows.length} default workflow templates`);
  }

  async start() {
    try {
      await this.redis.connect();
      console.log('Connected to Redis for orchestration');

      this.app.listen(this.port, () => {
        console.log(`🚀 KRONOS Orchestration Engine running on port ${this.port}`);
        console.log(`📋 Loaded ${this.workflowDefinitions.size} workflow definitions`);
        console.log(`⚙️  Active workflow executions: ${this.activeWorkflows.size}`);
        console.log(`🔄 Workflow and task queues initialized`);
        console.log(`🤖 AI-powered optimization and generation ready`);
        console.log(`🌐 Ready at http://localhost:${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start Orchestration Engine:', error);
      throw error;
    }
  }

  async stop() {
    await this.workflowQueue.close();
    await this.taskQueue.close();
    await this.redis.disconnect();
    console.log('Orchestration Engine stopped');
  }
}

// Start the orchestration engine
const orchestrationEngine = new KronosOrchestrationEngine(5001);
orchestrationEngine.start().catch(console.error);

module.exports = KronosOrchestrationEngine;