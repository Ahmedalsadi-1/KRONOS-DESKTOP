const { EventEmitter } = require('events');
const crypto = require('crypto');
const {
  WorkflowStatus,
  WorkflowStepStatus,
  WorkflowTriggerType,
  WorkflowStepType
} = require('../../../types');

/**
 * Workflow Engine - Core workflow execution and management system
 * Manages workflow lifecycle, step execution, and state transitions
 */
class WorkflowEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxConcurrentExecutions: options.maxConcurrentExecutions || 10,
      executionTimeout: options.executionTimeout || 3600000, // 1 hour
      retryAttempts: options.retryAttempts || 3,
      ...options
    };

    this.workflows = new Map();
    this.executions = new Map();
    this.activeExecutions = new Map();
    this.stepExecutors = new Map();
    this.workflowValidators = new Map();

    this.logger = {
      info: (message, workflowId, executionId) => console.log(`[WorkflowEngine] ${workflowId ? `[${workflowId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`),
      warn: (message, workflowId, executionId) => console.warn(`[WorkflowEngine] ${workflowId ? `[${workflowId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`),
      error: (message, workflowId, executionId, error) => console.error(`[WorkflowEngine] ${workflowId ? `[${workflowId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`, error)
    };
  }

  /**
   * Initialize the workflow engine
   */
  async initialize(serviceRegistry, stepExecutor) {
    try {
      this.serviceRegistry = serviceRegistry;
      this.stepExecutor = stepExecutor;

      this.logger.info('Initializing Workflow Engine...');

      // Register with service registry
      await this.serviceRegistry.register('workflow-engine', this, {
        dependencies: ['config-manager', 'websocket-manager'],
        autoStart: true
      });

      // Set up event listeners
      this.setupEventListeners();

      this.logger.info('Workflow Engine initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Workflow Engine', null, null, error);
      throw error;
    }
  }

  /**
   * Register a workflow definition
   */
  async registerWorkflow(workflowDefinition) {
    try {
      const workflowId = workflowDefinition.id || crypto.randomUUID();

      // Validate workflow
      const validation = await this.validateWorkflow(workflowDefinition);
      if (!validation.isValid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }

      const workflow = {
        ...workflowDefinition,
        id: workflowId,
        version: workflowDefinition.version || '1.0.0',
        status: workflowDefinition.status || WorkflowStatus.DRAFT,
        createdAt: workflowDefinition.createdAt || new Date(),
        updatedAt: new Date(),
        validation
      };

      this.workflows.set(workflowId, workflow);

      this.logger.info(`Registered workflow: ${workflow.name} (${workflowId})`);
      this.emit('workflow:registered', { workflowId, workflow });

      return workflowId;
    } catch (error) {
      this.logger.error('Failed to register workflow', null, null, error);
      throw error;
    }
  }

  /**
   * Update an existing workflow
   */
  async updateWorkflow(workflowId, updates) {
    try {
      const existingWorkflow = this.workflows.get(workflowId);
      if (!existingWorkflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Validate updated workflow
      const updatedWorkflow = { ...existingWorkflow, ...updates };
      const validation = await this.validateWorkflow(updatedWorkflow);

      if (!validation.isValid) {
        throw new Error(`Invalid workflow update: ${validation.errors.join(', ')}`);
      }

      updatedWorkflow.updatedAt = new Date();
      updatedWorkflow.validation = validation;

      this.workflows.set(workflowId, updatedWorkflow);

      this.logger.info(`Updated workflow: ${workflowId}`);
      this.emit('workflow:updated', { workflowId, workflow: updatedWorkflow });

      return updatedWorkflow;
    } catch (error) {
      this.logger.error('Failed to update workflow', workflowId, null, error);
      throw error;
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId) {
    try {
      if (!this.workflows.has(workflowId)) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Stop any active executions
      const activeExecutions = Array.from(this.activeExecutions.values())
        .filter(exec => exec.workflowId === workflowId);

      for (const execution of activeExecutions) {
        await this.cancelExecution(execution.id);
      }

      this.workflows.delete(workflowId);

      this.logger.info(`Deleted workflow: ${workflowId}`);
      this.emit('workflow:deleted', { workflowId });

      return true;
    } catch (error) {
      this.logger.error('Failed to delete workflow', workflowId, null, error);
      throw error;
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId, options = {}) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      if (workflow.status !== WorkflowStatus.ACTIVE) {
        throw new Error(`Workflow ${workflowId} is not active`);
      }

      // Check concurrent execution limits
      if (this.activeExecutions.size >= this.options.maxConcurrentExecutions) {
        throw new Error('Maximum concurrent executions reached');
      }

      const executionId = crypto.randomUUID();
      const execution = {
        id: executionId,
        workflowId,
        status: WorkflowStatus.RUNNING,
        trigger: options.trigger || { type: WorkflowTriggerType.MANUAL },
        startedAt: new Date(),
        steps: this.initializeExecutionSteps(workflow.steps),
        variables: { ...workflow.variables, ...options.variables },
        result: null,
        error: null,
        executionTime: null,
        metadata: {
          initiatedBy: options.initiatedBy || 'system',
          source: options.source || 'api',
          tags: options.tags || [],
          ...options.metadata
        }
      };

      this.executions.set(executionId, execution);
      this.activeExecutions.set(executionId, execution);

      this.logger.info(`Starting workflow execution: ${executionId}`, workflowId, executionId);
      this.emit('execution:started', { executionId, execution });

      // Start execution asynchronously
      this.executeWorkflowAsync(execution)
        .catch(error => {
          this.logger.error('Workflow execution failed', workflowId, executionId, error);
          this.handleExecutionError(execution, error);
        });

      return {
        executionId,
        status: execution.status,
        startedAt: execution.startedAt,
        estimatedCompletion: new Date(Date.now() + workflow.settings.maxExecutionTime)
      };
    } catch (error) {
      this.logger.error('Failed to start workflow execution', workflowId, null, error);
      throw error;
    }
  }

  /**
   * Execute workflow asynchronously
   */
  async executeWorkflowAsync(execution) {
    try {
      const workflow = this.workflows.get(execution.workflowId);
      const startTime = Date.now();

      // Execute steps in topological order
      const executionOrder = this.calculateExecutionOrder(workflow.steps);

      for (const stepId of executionOrder) {
        const step = workflow.steps.find(s => s.id === stepId);
        if (!step) continue;

        // Check if execution was cancelled
        if (execution.status === WorkflowStatus.CANCELLED) {
          break;
        }

        await this.executeStep(execution, step);
      }

      // Complete execution
      execution.status = WorkflowStatus.COMPLETED;
      execution.completedAt = new Date();
      execution.executionTime = Date.now() - startTime;

      this.logger.info(`Workflow execution completed: ${execution.id}`, execution.workflowId, execution.id);
      this.emit('execution:completed', { executionId: execution.id, execution });

    } catch (error) {
      this.handleExecutionError(execution, error);
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(execution, step) {
    try {
      const executionStep = execution.steps.find(s => s.stepId === step.id);
      if (!executionStep) return;

      executionStep.status = WorkflowStepStatus.RUNNING;
      executionStep.startedAt = new Date();

      this.emit('step:started', {
        executionId: execution.id,
        stepId: step.id,
        step: executionStep
      });

      // Execute the step based on its type
      const result = await this.stepExecutor.executeStep(step, execution.variables, {
        executionId: execution.id,
        workflowId: execution.workflowId
      });

      executionStep.status = WorkflowStepStatus.COMPLETED;
      executionStep.completedAt = new Date();
      executionStep.result = result;
      executionStep.executionTime = Date.now() - executionStep.startedAt.getTime();

      // Update workflow variables with step result
      if (result && typeof result === 'object') {
        Object.assign(execution.variables, result);
      }

      this.logger.info(`Step completed: ${step.id}`, execution.workflowId, execution.id);
      this.emit('step:completed', {
        executionId: execution.id,
        stepId: step.id,
        step: executionStep,
        result
      });

    } catch (error) {
      executionStep.status = WorkflowStepStatus.FAILED;
      executionStep.completedAt = new Date();
      executionStep.error = error.message;
      executionStep.executionTime = Date.now() - executionStep.startedAt.getTime();

      this.logger.error(`Step failed: ${step.id}`, execution.workflowId, execution.id, error);
      this.emit('step:failed', {
        executionId: execution.id,
        stepId: step.id,
        step: executionStep,
        error
      });

      // Handle step error based on configuration
      await this.handleStepError(execution, step, error);
    }
  }

  /**
   * Cancel a workflow execution
   */
  async cancelExecution(executionId) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      if (execution.status !== WorkflowStatus.RUNNING) {
        return false;
      }

      execution.status = WorkflowStatus.CANCELLED;
      execution.completedAt = new Date();

      // Cancel running steps
      for (const step of execution.steps) {
        if (step.status === WorkflowStepStatus.RUNNING) {
          step.status = WorkflowStepStatus.CANCELLED;
          step.completedAt = new Date();
        }
      }

      this.activeExecutions.delete(executionId);

      this.logger.info(`Cancelled workflow execution: ${executionId}`, execution.workflowId, executionId);
      this.emit('execution:cancelled', { executionId, execution });

      return true;
    } catch (error) {
      this.logger.error('Failed to cancel execution', null, executionId, error);
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  /**
   * List workflows with filtering
   */
  listWorkflows(filters = {}) {
    let workflows = Array.from(this.workflows.values());

    if (filters.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }

    if (filters.tags && filters.tags.length > 0) {
      workflows = workflows.filter(w =>
        filters.tags.some(tag => w.metadata.tags?.includes(tag))
      );
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      workflows = workflows.filter(w =>
        w.name.toLowerCase().includes(search) ||
        w.description?.toLowerCase().includes(search)
      );
    }

    return workflows;
  }

  /**
   * List executions with filtering
   */
  listExecutions(filters = {}) {
    let executions = Array.from(this.executions.values());

    if (filters.workflowId) {
      executions = executions.filter(e => e.workflowId === filters.workflowId);
    }

    if (filters.status) {
      executions = executions.filter(e => e.status === filters.status);
    }

    if (filters.dateRange) {
      executions = executions.filter(e =>
        e.startedAt >= filters.dateRange.start &&
        e.startedAt <= filters.dateRange.end
      );
    }

    return executions;
  }

  /**
   * Validate workflow definition
   */
  async validateWorkflow(workflow) {
    // Basic validation - can be extended with more complex rules
    const errors = [];
    const warnings = [];

    if (!workflow.name) {
      errors.push('Workflow name is required');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // Check for duplicate step IDs
    const stepIds = workflow.steps?.map(s => s.id) || [];
    const uniqueStepIds = new Set(stepIds);
    if (stepIds.length !== uniqueStepIds.size) {
      errors.push('Workflow contains duplicate step IDs');
    }

    // Check for circular dependencies
    if (workflow.steps) {
      const circularDeps = this.detectCircularDependencies(workflow.steps);
      if (circularDeps.length > 0) {
        errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Initialize execution steps
   */
  initializeExecutionSteps(steps) {
    return steps.map(step => ({
      stepId: step.id,
      status: WorkflowStepStatus.PENDING,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      retryCount: 0,
      executionTime: null
    }));
  }

  /**
   * Calculate execution order based on dependencies
   */
  calculateExecutionOrder(steps) {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (stepId) => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving ${stepId}`);
      }

      visiting.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const dep of step.dependencies) {
          if (steps.some(s => s.id === dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * Handle execution error
   */
  handleExecutionError(execution, error) {
    execution.status = WorkflowStatus.FAILED;
    execution.completedAt = new Date();
    execution.error = error.message;
    execution.executionTime = Date.now() - execution.startedAt.getTime();

    this.activeExecutions.delete(execution.id);

    this.logger.error('Workflow execution failed', execution.workflowId, execution.id, error);
    this.emit('execution:failed', { executionId: execution.id, execution, error });
  }

  /**
   * Handle step error
   */
  async handleStepError(execution, step, error) {
    const workflow = this.workflows.get(execution.workflowId);
    const stepConfig = step.errorHandling || {};

    switch (stepConfig.onError) {
      case 'continue':
        // Continue to next step
        break;
      case 'fail':
        // Fail the entire workflow
        execution.status = WorkflowStatus.FAILED;
        execution.error = `Step ${step.id} failed: ${error.message}`;
        break;
      case 'retry':
        // Retry logic would be implemented here
        break;
      case 'goto':
        // Jump to specific step
        if (stepConfig.gotoStep) {
          // Implementation for goto logic
        }
        break;
      default:
        // Default behavior: fail workflow
        execution.status = WorkflowStatus.FAILED;
        execution.error = `Step ${step.id} failed: ${error.message}`;
    }
  }

  /**
   * Detect circular dependencies in workflow steps
   */
  detectCircularDependencies(steps) {
    const circularDeps = [];

    const dfs = (stepId, path = []) => {
      if (path.includes(stepId)) {
        const cycleStart = path.indexOf(stepId);
        circularDeps.push(path.slice(cycleStart).join(' -> ') + ` -> ${stepId}`);
        return;
      }

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const dep of step.dependencies) {
          dfs(dep, [...path, stepId]);
        }
      }
    };

    for (const step of steps) {
      dfs(step.id);
    }

    return circularDeps;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for service registry events
    this.serviceRegistry.on('service:started', (data) => {
      this.logger.info(`Service started: ${data.name}`);
    });

    this.serviceRegistry.on('service:stopped', (data) => {
      this.logger.info(`Service stopped: ${data.name}`);
    });
  }

  /**
   * Shutdown the workflow engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Workflow Engine...');

      // Cancel all active executions
      for (const [executionId, execution] of this.activeExecutions) {
        await this.cancelExecution(executionId);
      }

      // Clear all data
      this.workflows.clear();
      this.executions.clear();
      this.activeExecutions.clear();

      this.logger.info('Workflow Engine shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during Workflow Engine shutdown', null, null, error);
      throw error;
    }
  }
}

module.exports = WorkflowEngine;