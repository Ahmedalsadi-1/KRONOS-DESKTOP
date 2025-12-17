const {
  WorkflowStatus,
  WorkflowStepType,
  WorkflowTriggerType,
  WorkflowConditionOperator
} = require('../../../types');

/**
 * Workflow Validator - Validates workflow definitions and logic
 * Ensures workflows are well-formed and can execute successfully
 */
class WorkflowValidator {
  constructor(options = {}) {
    this.options = {
      maxSteps: options.maxSteps || 100,
      maxDepth: options.maxDepth || 10,
      allowCycles: options.allowCycles || false,
      strictMode: options.strictMode || false,
      ...options
    };

    this.logger = {
      info: (message) => console.log(`[WorkflowValidator] ${message}`),
      warn: (message) => console.warn(`[WorkflowValidator] ${message}`),
      error: (message, error) => console.error(`[WorkflowValidator] ${message}`, error)
    };
  }

  /**
   * Initialize the validator
   */
  async initialize(serviceRegistry) {
    try {
      this.serviceRegistry = serviceRegistry;

      this.logger.info('Initializing Workflow Validator...');

      // Register with service registry
      await this.serviceRegistry.register('workflow-validator', this, {
        dependencies: ['config-manager'],
        autoStart: true
      });

      this.logger.info('Workflow Validator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Workflow Validator', error);
      throw error;
    }
  }

  /**
   * Validate a complete workflow definition
   */
  async validateWorkflow(workflow) {
    try {
      const errors = [];
      const warnings = [];

      // Basic structure validation
      this.validateBasicStructure(workflow, errors);

      // Step validation
      if (workflow.steps) {
        this.validateSteps(workflow.steps, errors, warnings);
      }

      // Dependency validation
      if (workflow.steps) {
        this.validateDependencies(workflow.steps, errors, warnings);
      }

      // Trigger validation
      if (workflow.trigger) {
        this.validateTrigger(workflow.trigger, errors, warnings);
      }

      // Settings validation
      if (workflow.settings) {
        this.validateSettings(workflow.settings, errors, warnings);
      }

      // Variables validation
      if (workflow.variables) {
        this.validateVariables(workflow.variables, errors, warnings);
      }

      // Metadata validation
      if (workflow.metadata) {
        this.validateMetadata(workflow.metadata, errors, warnings);
      }

      // Execution path validation
      if (workflow.steps) {
        this.validateExecutionPaths(workflow.steps, errors, warnings);
      }

      const isValid = errors.length === 0;

      return {
        isValid,
        errors,
        warnings,
        suggestions: this.generateSuggestions(workflow, errors, warnings)
      };
    } catch (error) {
      this.logger.error('Workflow validation failed', error);
      return {
        isValid: false,
        errors: [{ type: 'error', message: `Validation failed: ${error.message}` }],
        warnings: [],
        suggestions: ['Fix validation errors before proceeding']
      };
    }
  }

  /**
   * Validate basic workflow structure
   */
  validateBasicStructure(workflow, errors) {
    if (!workflow.id) {
      errors.push({ type: 'error', message: 'Workflow ID is required' });
    } else if (!this.isValidId(workflow.id)) {
      errors.push({ type: 'error', message: 'Workflow ID must be alphanumeric with hyphens/underscores' });
    }

    if (!workflow.name) {
      errors.push({ type: 'error', message: 'Workflow name is required' });
    } else if (workflow.name.length > 100) {
      errors.push({ type: 'error', message: 'Workflow name must be 100 characters or less' });
    }

    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push({ type: 'error', message: 'Workflow steps must be an array' });
    } else if (workflow.steps.length === 0) {
      errors.push({ type: 'error', message: 'Workflow must have at least one step' });
    } else if (workflow.steps.length > this.options.maxSteps) {
      errors.push({
        type: 'error',
        message: `Workflow cannot have more than ${this.options.maxSteps} steps`
      });
    }

    if (workflow.status && !Object.values(WorkflowStatus).includes(workflow.status)) {
      errors.push({ type: 'error', message: 'Invalid workflow status' });
    }
  }

  /**
   * Validate individual workflow steps
   */
  validateSteps(steps, errors, warnings) {
    const stepIds = new Set();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Basic step validation
      if (!step.id) {
        errors.push({ type: 'error', message: `Step ${i} is missing an ID` });
        continue;
      }

      if (!this.isValidId(step.id)) {
        errors.push({
          type: 'error',
          message: `Step ${step.id} has invalid ID format`,
          stepId: step.id
        });
      }

      if (stepIds.has(step.id)) {
        errors.push({
          type: 'error',
          message: `Duplicate step ID: ${step.id}`,
          stepId: step.id
        });
      }
      stepIds.add(step.id);

      if (!step.name) {
        errors.push({
          type: 'error',
          message: `Step ${step.id} is missing a name`,
          stepId: step.id
        });
      }

      if (!step.type || !Object.values(WorkflowStepType).includes(step.type)) {
        errors.push({
          type: 'error',
          message: `Step ${step.id} has invalid type: ${step.type}`,
          stepId: step.id
        });
      }

      // Type-specific validation
      this.validateStepByType(step, errors, warnings);
    }
  }

  /**
   * Validate step based on its type
   */
  validateStepByType(step, errors, warnings) {
    switch (step.type) {
      case WorkflowStepType.TASK:
        this.validateTaskStep(step, errors, warnings);
        break;
      case WorkflowStepType.CONDITION:
        this.validateConditionStep(step, errors, warnings);
        break;
      case WorkflowStepType.LOOP:
        this.validateLoopStep(step, errors, warnings);
        break;
      case WorkflowStepType.PARALLEL:
        this.validateParallelStep(step, errors, warnings);
        break;
      case WorkflowStepType.DELAY:
        this.validateDelayStep(step, errors, warnings);
        break;
      case WorkflowStepType.TRANSFORM:
        this.validateTransformStep(step, errors, warnings);
        break;
    }

    // Validate dependencies
    if (step.dependencies) {
      if (!Array.isArray(step.dependencies)) {
        errors.push({
          type: 'error',
          message: `Step ${step.id} dependencies must be an array`,
          stepId: step.id
        });
      } else {
        for (const dep of step.dependencies) {
          if (typeof dep !== 'string') {
            errors.push({
              type: 'error',
              message: `Step ${step.id} has invalid dependency: ${dep}`,
              stepId: step.id
            });
          }
        }
      }
    }

    // Validate retry configuration
    if (step.retryConfig) {
      this.validateRetryConfig(step.retryConfig, step.id, errors, warnings);
    }

    // Validate error handling
    if (step.errorHandling) {
      this.validateErrorHandling(step.errorHandling, step.id, errors, warnings);
    }
  }

  /**
   * Validate task step
   */
  validateTaskStep(step, errors, warnings) {
    const config = step.config || {};

    if (!config.platform) {
      errors.push({
        type: 'error',
        message: `Task step ${step.id} must specify a platform`,
        stepId: step.id
      });
    }

    if (!config.taskType && !config.parameters) {
      warnings.push({
        type: 'warning',
        message: `Task step ${step.id} should specify taskType or parameters`,
        stepId: step.id
      });
    }

    // Validate platform availability (would check service registry)
    if (config.platform && !this.isPlatformAvailable(config.platform)) {
      warnings.push({
        type: 'warning',
        message: `Platform ${config.platform} may not be available`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate condition step
   */
  validateConditionStep(step, errors, warnings) {
    const config = step.config || {};

    if (!config.conditions || !Array.isArray(config.conditions)) {
      errors.push({
        type: 'error',
        message: `Condition step ${step.id} must have conditions array`,
        stepId: step.id
      });
      return;
    }

    for (let i = 0; i < config.conditions.length; i++) {
      const condition = config.conditions[i];
      this.validateCondition(condition, i, step.id, errors, warnings);
    }

    if (!config.trueStep && !config.falseStep) {
      warnings.push({
        type: 'warning',
        message: `Condition step ${step.id} has no next steps defined`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate loop step
   */
  validateLoopStep(step, errors, warnings) {
    const config = step.config || {};

    if (!config.loopStep) {
      errors.push({
        type: 'error',
        message: `Loop step ${step.id} must specify loopStep`,
        stepId: step.id
      });
    }

    if (config.iterations && (config.iterations < 1 || config.iterations > 1000)) {
      errors.push({
        type: 'error',
        message: `Loop step ${step.id} iterations must be between 1 and 1000`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate parallel step
   */
  validateParallelStep(step, errors, warnings) {
    const config = step.config || {};

    if (!config.parallelSteps || !Array.isArray(config.parallelSteps)) {
      errors.push({
        type: 'error',
        message: `Parallel step ${step.id} must have parallelSteps array`,
        stepId: step.id
      });
    } else if (config.parallelSteps.length === 0) {
      errors.push({
        type: 'error',
        message: `Parallel step ${step.id} must have at least one parallel step`,
        stepId: step.id
      });
    } else if (config.parallelSteps.length > 10) {
      warnings.push({
        type: 'warning',
        message: `Parallel step ${step.id} has many parallel steps (${config.parallelSteps.length})`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate delay step
   */
  validateDelayStep(step, errors, warnings) {
    const config = step.config || {};

    if (config.delayMs && (config.delayMs < 0 || config.delayMs > 300000)) { // 5 minutes max
      errors.push({
        type: 'error',
        message: `Delay step ${step.id} delay must be between 0 and 300000ms`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate transform step
   */
  validateTransformStep(step, errors, warnings) {
    const config = step.config || {};

    if (!config.transformFunction) {
      errors.push({
        type: 'error',
        message: `Transform step ${step.id} must have transformFunction`,
        stepId: step.id
      });
    }
  }

  /**
   * Validate a single condition
   */
  validateCondition(condition, index, stepId, errors, warnings) {
    if (!condition.variable) {
      errors.push({
        type: 'error',
        message: `Condition ${index} in step ${stepId} missing variable`,
        stepId
      });
    }

    if (!condition.operator || !Object.values(WorkflowConditionOperator).includes(condition.operator)) {
      errors.push({
        type: 'error',
        message: `Condition ${index} in step ${stepId} has invalid operator`,
        stepId
      });
    }

    // Operator-specific validation
    if (condition.operator === WorkflowConditionOperator.REGEX_MATCH && !condition.value) {
      errors.push({
        type: 'error',
        message: `Regex condition ${index} in step ${stepId} needs a pattern`,
        stepId
      });
    }
  }

  /**
   * Validate retry configuration
   */
  validateRetryConfig(retryConfig, stepId, errors, warnings) {
    if (retryConfig.maxRetries && (retryConfig.maxRetries < 0 || retryConfig.maxRetries > 10)) {
      errors.push({
        type: 'error',
        message: `Step ${stepId} maxRetries must be between 0 and 10`,
        stepId
      });
    }

    if (retryConfig.backoffMultiplier && retryConfig.backoffMultiplier < 1) {
      warnings.push({
        type: 'warning',
        message: `Step ${stepId} backoffMultiplier should be >= 1`,
        stepId
      });
    }
  }

  /**
   * Validate error handling configuration
   */
  validateErrorHandling(errorHandling, stepId, errors, warnings) {
    if (!['continue', 'fail', 'retry', 'goto'].includes(errorHandling.onError)) {
      errors.push({
        type: 'error',
        message: `Step ${stepId} has invalid error handling action`,
        stepId
      });
    }

    if (errorHandling.onError === 'goto' && !errorHandling.gotoStep) {
      errors.push({
        type: 'error',
        message: `Step ${stepId} goto action requires gotoStep`,
        stepId
      });
    }
  }

  /**
   * Validate workflow dependencies
   */
  validateDependencies(steps, errors, warnings) {
    const stepMap = new Map(steps.map(step => [step.id, step]));

    for (const step of steps) {
      for (const depId of step.dependencies || []) {
        if (!stepMap.has(depId)) {
          errors.push({
            type: 'error',
            message: `Step ${step.id} depends on non-existent step: ${depId}`,
            stepId: step.id
          });
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(steps);
    for (const cycle of circularDeps) {
      errors.push({
        type: 'error',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`
      });
    }
  }

  /**
   * Validate trigger configuration
   */
  validateTrigger(trigger, errors, warnings) {
    if (!trigger.type || !Object.values(WorkflowTriggerType).includes(trigger.type)) {
      errors.push({ type: 'error', message: 'Invalid trigger type' });
      return;
    }

    switch (trigger.type) {
      case WorkflowTriggerType.SCHEDULE:
        if (!trigger.config.cron) {
          errors.push({ type: 'error', message: 'Schedule trigger requires cron expression' });
        }
        break;
      case WorkflowTriggerType.EVENT:
        if (!trigger.config.source || !trigger.config.eventType) {
          errors.push({ type: 'error', message: 'Event trigger requires source and eventType' });
        }
        break;
      case WorkflowTriggerType.WEBHOOK:
        if (!trigger.config.url) {
          errors.push({ type: 'error', message: 'Webhook trigger requires URL' });
        }
        break;
    }
  }

  /**
   * Validate workflow settings
   */
  validateSettings(settings, errors, warnings) {
    if (settings.maxExecutionTime && settings.maxExecutionTime < 1000) {
      warnings.push({
        type: 'warning',
        message: 'maxExecutionTime is very low (< 1 second)'
      });
    }

    if (settings.timeout && settings.timeout < 1000) {
      warnings.push({
        type: 'warning',
        message: 'timeout is very low (< 1 second)'
      });
    }

    if (settings.maxRetries && settings.maxRetries > 10) {
      warnings.push({
        type: 'warning',
        message: 'maxRetries is very high (> 10)'
      });
    }
  }

  /**
   * Validate workflow variables
   */
  validateVariables(variables, errors, warnings) {
    // Check for reserved variable names
    const reservedNames = ['result', 'error', 'stepId', 'executionId', 'workflowId'];
    for (const varName of Object.keys(variables)) {
      if (reservedNames.includes(varName)) {
        warnings.push({
          type: 'warning',
          message: `Variable name '${varName}' is reserved`
        });
      }
    }
  }

  /**
   * Validate workflow metadata
   */
  validateMetadata(metadata, errors, warnings) {
    if (metadata.tags && !Array.isArray(metadata.tags)) {
      errors.push({ type: 'error', message: 'Metadata tags must be an array' });
    }
  }

  /**
   * Validate execution paths
   */
  validateExecutionPaths(steps, errors, warnings) {
    const reachableSteps = this.findReachableSteps(steps);

    for (const step of steps) {
      if (!reachableSteps.has(step.id)) {
        warnings.push({
          type: 'warning',
          message: `Step ${step.id} may not be reachable`,
          stepId: step.id
        });
      }
    }

    // Check for dead ends
    const deadEnds = this.findDeadEndSteps(steps);
    for (const stepId of deadEnds) {
      warnings.push({
        type: 'warning',
        message: `Step ${stepId} is a dead end (no outgoing connections)`,
        stepId
      });
    }
  }

  /**
   * Find reachable steps from workflow start
   */
  findReachableSteps(steps) {
    const reachable = new Set();
    const toVisit = [];

    // Find entry points (steps with no dependencies)
    for (const step of steps) {
      if (!step.dependencies || step.dependencies.length === 0) {
        toVisit.push(step.id);
      }
    }

    while (toVisit.length > 0) {
      const currentId = toVisit.pop();
      if (reachable.has(currentId)) continue;

      reachable.add(currentId);
      const currentStep = steps.find(s => s.id === currentId);

      if (currentStep) {
        // Add next steps based on step type
        this.addNextSteps(currentStep, steps, toVisit);
      }
    }

    return reachable;
  }

  /**
   * Add next steps for a given step
   */
  addNextSteps(step, allSteps, toVisit) {
    switch (step.type) {
      case WorkflowStepType.CONDITION:
        if (step.config.trueStep) toVisit.push(step.config.trueStep);
        if (step.config.falseStep) toVisit.push(step.config.falseStep);
        break;
      case WorkflowStepType.LOOP:
        if (step.config.loopStep) toVisit.push(step.config.loopStep);
        break;
      case WorkflowStepType.PARALLEL:
        if (step.config.parallelSteps) {
          toVisit.push(...step.config.parallelSteps);
        }
        break;
      default:
        // For other step types, find steps that depend on this one
        for (const otherStep of allSteps) {
          if (otherStep.dependencies?.includes(step.id)) {
            toVisit.push(otherStep.id);
          }
        }
    }
  }

  /**
   * Find dead end steps
   */
  findDeadEndSteps(steps) {
    const deadEnds = [];
    const stepMap = new Map(steps.map(s => [s.id, s]));

    for (const step of steps) {
      const hasOutgoing = this.hasOutgoingConnections(step, steps);
      if (!hasOutgoing) {
        deadEnds.push(step.id);
      }
    }

    return deadEnds;
  }

  /**
   * Check if a step has outgoing connections
   */
  hasOutgoingConnections(step, allSteps) {
    // Check dependencies of other steps
    for (const otherStep of allSteps) {
      if (otherStep.dependencies?.includes(step.id)) {
        return true;
      }
    }

    // Check step-specific connections
    switch (step.type) {
      case WorkflowStepType.CONDITION:
        return !!(step.config.trueStep || step.config.falseStep);
      case WorkflowStepType.LOOP:
        return !!step.config.loopStep;
      case WorkflowStepType.PARALLEL:
        return !!(step.config.parallelSteps && step.config.parallelSteps.length > 0);
      default:
        return false;
    }
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(steps) {
    const circularDeps = [];
    const stepMap = new Map(steps.map(s => [s.id, s]));

    const dfs = (stepId, path = []) => {
      if (path.includes(stepId)) {
        const cycleStart = path.indexOf(stepId);
        circularDeps.push(path.slice(cycleStart).concat(stepId));
        return;
      }

      const step = stepMap.get(stepId);
      if (!step) return;

      const newPath = [...path, stepId];

      for (const depId of step.dependencies || []) {
        dfs(depId, newPath);
      }

      // Check step-specific dependencies
      this.addNextSteps(step, steps, []).forEach(nextId => {
        dfs(nextId, newPath);
      });
    };

    for (const step of steps) {
      dfs(step.id);
    }

    return circularDeps;
  }

  /**
   * Generate suggestions based on validation results
   */
  generateSuggestions(workflow, errors, warnings) {
    const suggestions = [];

    if (errors.some(e => e.message.includes('circular dependency'))) {
      suggestions.push('Review and fix circular dependencies in workflow steps');
    }

    if (errors.some(e => e.message.includes('platform'))) {
      suggestions.push('Ensure all required platforms are installed and configured');
    }

    if (warnings.some(w => w.message.includes('dead end'))) {
      suggestions.push('Consider adding error handling or completion steps');
    }

    if (warnings.some(w => w.message.includes('not reachable'))) {
      suggestions.push('Remove or connect unreachable steps');
    }

    if (!workflow.trigger || workflow.trigger.type === WorkflowTriggerType.MANUAL) {
      suggestions.push('Consider adding automated triggers for better workflow automation');
    }

    return suggestions;
  }

  /**
   * Check if platform is available
   */
  isPlatformAvailable(platformName) {
    // This would check the service registry for available platforms
    // For now, return true as a placeholder
    return true;
  }

  /**
   * Check if ID is valid
   */
  isValidId(id) {
    return /^[a-zA-Z0-9_-]+$/.test(id);
  }

  /**
   * Shutdown the validator
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Workflow Validator...');
      this.logger.info('Workflow Validator shutdown complete');
    } catch (error) {
      this.logger.error('Error during Workflow Validator shutdown', error);
      throw error;
    }
  }
}

module.exports = WorkflowValidator;