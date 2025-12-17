const { EventEmitter } = require('events');
const {
  WorkflowStepType,
  WorkflowConditionOperator,
  WorkflowStepStatus
} = require('../../../types');

/**
 * Workflow Step Executor - Handles execution of individual workflow steps
 * Supports different step types: task, condition, loop, parallel, delay, transform
 */
class WorkflowStepExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      defaultTimeout: options.defaultTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      ...options
    };

    this.platformAdapters = new Map();
    this.customExecutors = new Map();

    this.logger = {
      info: (message, stepId, executionId) => console.log(`[WorkflowStepExecutor] ${stepId ? `[${stepId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`),
      warn: (message, stepId, executionId) => console.warn(`[WorkflowStepExecutor] ${stepId ? `[${stepId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`),
      error: (message, stepId, executionId, error) => console.error(`[WorkflowStepExecutor] ${stepId ? `[${stepId}] ` : ''}${executionId ? `[${executionId}] ` : ''}${message}`, error)
    };
  }

  /**
   * Initialize the step executor
   */
  async initialize(serviceRegistry) {
    try {
      this.serviceRegistry = serviceRegistry;

      this.logger.info('Initializing Workflow Step Executor...');

      // Register with service registry
      await this.serviceRegistry.register('workflow-step-executor', this, {
        dependencies: ['config-manager'],
        autoStart: true
      });

      // Discover and register platform adapters
      await this.discoverPlatformAdapters();

      this.logger.info('Workflow Step Executor initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Workflow Step Executor', null, null, error);
      throw error;
    }
  }

  /**
   * Register a platform adapter
   */
  registerPlatformAdapter(platformName, adapter) {
    this.platformAdapters.set(platformName, adapter);
    this.logger.info(`Registered platform adapter: ${platformName}`);
  }

  /**
   * Register a custom step executor
   */
  registerCustomExecutor(stepType, executor) {
    this.customExecutors.set(stepType, executor);
    this.logger.info(`Registered custom executor for step type: ${stepType}`);
  }

  /**
   * Execute a workflow step
   */
  async executeStep(step, variables, context = {}) {
    try {
      const { executionId, workflowId } = context;
      const startTime = Date.now();

      this.logger.info(`Executing step: ${step.type}`, step.id, executionId);

      let result;

      switch (step.type) {
        case WorkflowStepType.TASK:
          result = await this.executeTaskStep(step, variables, context);
          break;
        case WorkflowStepType.CONDITION:
          result = await this.executeConditionStep(step, variables, context);
          break;
        case WorkflowStepType.LOOP:
          result = await this.executeLoopStep(step, variables, context);
          break;
        case WorkflowStepType.PARALLEL:
          result = await this.executeParallelStep(step, variables, context);
          break;
        case WorkflowStepType.DELAY:
          result = await this.executeDelayStep(step, variables, context);
          break;
        case WorkflowStepType.TRANSFORM:
          result = await this.executeTransformStep(step, variables, context);
          break;
        default:
          // Check for custom executors
          const customExecutor = this.customExecutors.get(step.type);
          if (customExecutor) {
            result = await customExecutor.execute(step, variables, context);
          } else {
            throw new Error(`Unknown step type: ${step.type}`);
          }
      }

      const executionTime = Date.now() - startTime;
      this.logger.info(`Step executed successfully in ${executionTime}ms`, step.id, executionId);

      return result;
    } catch (error) {
      this.logger.error(`Step execution failed: ${error.message}`, step.id, context.executionId, error);
      throw error;
    }
  }

  /**
   * Execute a task step (calls platform API)
   */
  async executeTaskStep(step, variables, context) {
    const { platform, taskType, parameters, timeout } = step.config;

    if (!platform) {
      throw new Error('Platform is required for task steps');
    }

    const adapter = this.platformAdapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platform}`);
    }

    // Resolve parameters with variable substitution
    const resolvedParams = this.resolveVariables(parameters || {}, variables);

    // Execute the task
    const result = await this.executeWithTimeout(
      () => adapter.createTask({
        type: taskType,
        ...resolvedParams
      }),
      timeout || this.options.defaultTimeout
    );

    return result;
  }

  /**
   * Execute a condition step
   */
  async executeConditionStep(step, variables, context) {
    const { conditions, trueStep, falseStep } = step.config;

    if (!conditions || conditions.length === 0) {
      throw new Error('Conditions are required for condition steps');
    }

    // Evaluate all conditions
    let conditionResult = true;
    for (const condition of conditions) {
      const result = this.evaluateCondition(condition, variables);
      if (!result) {
        conditionResult = false;
        break;
      }
    }

    return {
      conditionResult,
      nextStep: conditionResult ? trueStep : falseStep,
      evaluatedConditions: conditions
    };
  }

  /**
   * Execute a loop step
   */
  async executeLoopStep(step, variables, context) {
    const { iterations, loopVariable, loopStep } = step.config;
    const results = [];

    if (!loopStep) {
      throw new Error('Loop step is required for loop steps');
    }

    const maxIterations = Math.min(iterations || 10, 100); // Safety limit

    for (let i = 0; i < maxIterations; i++) {
      // Set loop variable
      const loopVars = {
        ...variables,
        [loopVariable || 'loopIndex']: i,
        loopIteration: i,
        loopTotal: maxIterations
      };

      try {
        const result = await this.executeStep({
          id: `${step.id}_iteration_${i}`,
          type: WorkflowStepType.TASK, // Assume loop step is a task
          config: { ...step.config, loopStep: undefined } // Remove loop config
        }, loopVars, context);

        results.push(result);

        // Check if we should break the loop
        if (result && result.breakLoop) {
          break;
        }
      } catch (error) {
        results.push({ error: error.message, iteration: i });
        // Continue to next iteration unless configured to fail
        if (step.config.failOnError) {
          throw error;
        }
      }
    }

    return {
      iterations: results.length,
      results,
      loopVariable: loopVariable || 'loopIndex'
    };
  }

  /**
   * Execute a parallel step
   */
  async executeParallelStep(step, variables, context) {
    const { parallelSteps } = step.config;

    if (!parallelSteps || parallelSteps.length === 0) {
      throw new Error('Parallel steps are required for parallel steps');
    }

    // Execute all steps in parallel
    const promises = parallelSteps.map(async (stepId) => {
      try {
        // Find the actual step definition (this would be passed from workflow engine)
        const stepDef = context.workflowSteps?.find(s => s.id === stepId);
        if (!stepDef) {
          throw new Error(`Parallel step not found: ${stepId}`);
        }

        const result = await this.executeStep(stepDef, variables, context);
        return { stepId, success: true, result };
      } catch (error) {
        return { stepId, success: false, error: error.message };
      }
    });

    const results = await Promise.all(promises);

    return {
      parallelSteps: parallelSteps.length,
      results,
      allSuccessful: results.every(r => r.success)
    };
  }

  /**
   * Execute a delay step
   */
  async executeDelayStep(step, variables, context) {
    const { delayMs } = step.config;
    const delay = Math.min(delayMs || 1000, 300000); // Max 5 minutes

    this.logger.info(`Delaying execution for ${delay}ms`, step.id, context.executionId);

    await this.delay(delay);

    return {
      delayed: true,
      delayMs: delay,
      timestamp: new Date()
    };
  }

  /**
   * Execute a transform step
   */
  async executeTransformStep(step, variables, context) {
    const { transformFunction, inputMapping } = step.config;

    if (!transformFunction) {
      throw new Error('Transform function is required for transform steps');
    }

    // Map inputs
    const inputs = {};
    if (inputMapping) {
      for (const [key, varPath] of Object.entries(inputMapping)) {
        inputs[key] = this.getNestedValue(variables, varPath);
      }
    }

    // Execute transform function
    let result;
    try {
      if (typeof transformFunction === 'string') {
        // Simple expression evaluation (basic implementation)
        result = this.evaluateExpression(transformFunction, { ...variables, ...inputs });
      } else if (typeof transformFunction === 'function') {
        result = await transformFunction(inputs, variables, context);
      } else {
        throw new Error('Invalid transform function');
      }
    } catch (error) {
      throw new Error(`Transform execution failed: ${error.message}`);
    }

    return {
      transformed: true,
      inputs,
      result,
      transformFunction: typeof transformFunction === 'string' ? transformFunction : 'custom function'
    };
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(condition, variables) {
    const { variable, operator, value, caseSensitive } = condition;

    const actualValue = this.getNestedValue(variables, variable);
    let compareValue = value;

    // Handle case sensitivity for strings
    if (typeof actualValue === 'string' && typeof compareValue === 'string' && !caseSensitive) {
      compareValue = compareValue.toLowerCase();
    }

    switch (operator) {
      case WorkflowConditionOperator.EQUALS:
        return actualValue === compareValue;
      case WorkflowConditionOperator.NOT_EQUALS:
        return actualValue !== compareValue;
      case WorkflowConditionOperator.CONTAINS:
        return typeof actualValue === 'string' && actualValue.includes(compareValue);
      case WorkflowConditionOperator.NOT_CONTAINS:
        return typeof actualValue === 'string' && !actualValue.includes(compareValue);
      case WorkflowConditionOperator.GREATER_THAN:
        return actualValue > compareValue;
      case WorkflowConditionOperator.LESS_THAN:
        return actualValue < compareValue;
      case WorkflowConditionOperator.IS_EMPTY:
        return actualValue == null || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);
      case WorkflowConditionOperator.IS_NOT_EMPTY:
        return actualValue != null && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);
      case WorkflowConditionOperator.REGEX_MATCH:
        return typeof actualValue === 'string' && new RegExp(compareValue).test(actualValue);
      default:
        return false;
    }
  }

  /**
   * Resolve variables in parameters
   */
  resolveVariables(params, variables) {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    const resolved = { ...params };

    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string') {
        // Replace ${variable} patterns
        resolved[key] = value.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
          const varValue = this.getNestedValue(variables, varPath);
          return varValue != null ? String(varValue) : match;
        });
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveVariables(value, variables);
      }
    }

    return resolved;
  }

  /**
   * Get nested value from variables object
   */
  getNestedValue(obj, path) {
    if (!path) return obj;

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Evaluate a simple expression
   */
  evaluateExpression(expression, context) {
    // Basic expression evaluation - in production, use a proper expression engine
    try {
      // Simple variable substitution and basic operations
      let result = expression;

      // Replace variables
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        result = result.replace(regex, JSON.stringify(value));
      }

      // Basic arithmetic and string operations
      // This is a simplified implementation - use a proper expression parser in production
      if (result.includes('+') || result.includes('-') || result.includes('*') || result.includes('/')) {
        // For now, just return the expression as-is
        return result;
      }

      return result;
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error.message}`);
    }
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Step execution timeout')), timeout)
      )
    ]);
  }

  /**
   * Discover platform adapters from service registry
   */
  async discoverPlatformAdapters() {
    try {
      // Get all services that end with '-adapter'
      const allServices = this.serviceRegistry.getServices();
      const adapterServices = allServices.filter(name => name.endsWith('-adapter'));

      for (const serviceName of adapterServices) {
        try {
          const adapter = this.serviceRegistry.getService(serviceName);
          if (adapter && adapter.config && adapter.config.name) {
            this.registerPlatformAdapter(adapter.config.name, adapter);
          }
        } catch (error) {
          this.logger.warn(`Failed to register adapter ${serviceName}: ${error.message}`);
        }
      }

      this.logger.info(`Discovered ${this.platformAdapters.size} platform adapters`);
    } catch (error) {
      this.logger.error('Failed to discover platform adapters', null, null, error);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the step executor
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Workflow Step Executor...');

      // Clear adapters and executors
      this.platformAdapters.clear();
      this.customExecutors.clear();

      this.logger.info('Workflow Step Executor shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during Workflow Step Executor shutdown', null, null, error);
      throw error;
    }
  }
}

module.exports = WorkflowStepExecutor;