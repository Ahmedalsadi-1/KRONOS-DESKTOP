// Workflow Orchestration Type Definitions

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

export enum WorkflowTriggerType {
  MANUAL = 'manual',
  SCHEDULE = 'schedule',
  EVENT = 'event',
  WEBHOOK = 'webhook'
}

export enum WorkflowStepType {
  TASK = 'task',
  CONDITION = 'condition',
  LOOP = 'loop',
  PARALLEL = 'parallel',
  DELAY = 'delay',
  TRANSFORM = 'transform'
}

export enum WorkflowConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  REGEX_MATCH = 'regex_match'
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config: {
    schedule?: {
      cron: string;
      timezone?: string;
    };
    event?: {
      source: string;
      eventType: string;
      filters?: Record<string, any>;
    };
    webhook?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
    };
  };
}

export interface WorkflowCondition {
  variable: string;
  operator: WorkflowConditionOperator;
  value: any;
  caseSensitive?: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: WorkflowStepType;
  config: {
    // Task step config
    platform?: string;
    taskType?: string;
    parameters?: Record<string, any>;
    timeout?: number;

    // Condition step config
    conditions?: WorkflowCondition[];
    trueStep?: string;
    falseStep?: string;

    // Loop step config
    iterations?: number;
    loopVariable?: string;
    loopStep?: string;

    // Parallel step config
    parallelSteps?: string[];

    // Delay step config
    delayMs?: number;

    // Transform step config
    transformFunction?: string;
    inputMapping?: Record<string, string>;
  };
  dependencies: string[]; // Step IDs this step depends on
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  errorHandling?: {
    onError: 'continue' | 'fail' | 'retry' | 'goto';
    gotoStep?: string;
  };
}

export interface WorkflowExecutionStep {
  stepId: string;
  status: WorkflowStepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retryCount: number;
  executionTime?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  startedAt: Date;
  completedAt?: Date;
  steps: WorkflowExecutionStep[];
  variables: Record<string, any>;
  result?: any;
  error?: string;
  executionTime?: number;
  metadata: {
    initiatedBy: string;
    source: string;
    tags?: string[];
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables: Record<string, any>;
  settings: {
    maxExecutionTime: number;
    timeout: number;
    maxRetries: number;
    enableLogging: boolean;
    enableMetrics: boolean;
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
    category?: string;
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  workflow: Omit<Workflow, 'id' | 'metadata'>;
  usage: {
    totalRuns: number;
    successRate: number;
    averageExecutionTime: number;
  };
}

export interface WorkflowMetrics {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  stepMetrics: {
    stepId: string;
    averageExecutionTime: number;
    successRate: number;
    errorCount: number;
  }[];
  lastExecutedAt?: Date;
}

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
  metadata: {
    createdBy: string;
    createdAt: Date;
  };
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: {
    type: 'error' | 'warning';
    message: string;
    stepId?: string;
    field?: string;
  }[];
  suggestions: string[];
}

// API Types for workflow operations
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
  settings?: Partial<Workflow['settings']>;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  trigger?: WorkflowTrigger;
  steps?: WorkflowStep[];
  variables?: Record<string, any>;
  settings?: Partial<Workflow['settings']>;
  status?: WorkflowStatus;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  variables?: Record<string, any>;
  trigger?: WorkflowTrigger;
  metadata?: {
    initiatedBy: string;
    source: string;
    tags?: string[];
  };
}

export interface WorkflowExecutionResponse {
  executionId: string;
  status: WorkflowStatus;
  startedAt: Date;
  estimatedCompletion?: Date;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowExecutionListResponse {
  executions: WorkflowExecution[];
  total: number;
  page: number;
  pageSize: number;
}