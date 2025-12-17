// Task-related type definitions

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  PAUSED = 'paused'
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum TaskType {
  PROJECT_START = 'project:start',
  PROJECT_STOP = 'project:stop',
  PROJECT_RESTART = 'project:restart',
  PROJECT_INSTALL = 'project:install',
  PROJECT_UPDATE = 'project:update',
  PROJECT_CONFIGURE = 'project:configure',
  SYSTEM_CHECK = 'system:check',
  CLEANUP = 'system:cleanup',
  BACKUP = 'system:backup',
  HEALTH_CHECK = 'system:health',
  CUSTOM = 'custom'
}

export interface TaskConfig {
  id: string;
  name: string;
  type: TaskType;
  priority: TaskPriority;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task extends TaskConfig {
  status: TaskStatus;
  projectId?: string;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  logs?: TaskLog[];
  result?: any;
  parentId?: string;
  children?: string[];
  retryAttempt?: number;
  maxRetries?: number;
}

export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source?: string;
}

export interface TaskCreateRequest {
  name: string;
  type: TaskType;
  priority?: TaskPriority;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  dependencies?: string[];
  projectId?: string;
  metadata?: Record<string, any>;
  payload?: any;
}

export interface TaskUpdateRequest {
  id: string;
  name?: string;
  priority?: TaskPriority;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface TaskActionRequest {
  id: string;
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'retry' | 'cancel' | 'delete';
  options?: Record<string, any>;
}

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  projectId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  filtered: number;
  running: number;
  pending: number;
  completed: number;
  failed: number;
}

export interface TaskActionResponse {
  success: boolean;
  message: string;
  task?: Task;
  error?: string;
}

export interface TaskStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byType: Record<TaskType, number>;
  avgDuration: number;
  successRate: number;
  recentTasks: Task[];
}

export interface TaskQueue {
  id: string;
  name: string;
  tasks: Task[];
  maxConcurrent: number;
  currentConcurrent: number;
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  createdAt: Date;
}
