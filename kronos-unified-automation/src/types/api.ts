// API communication and WebSocket type definitions

export enum MessageType {
  // Project messages
  PROJECT_LIST_REQUEST = 'project:list:request',
  PROJECT_LIST_RESPONSE = 'project:list:response',
  PROJECT_CREATE_REQUEST = 'project:create:request',
  PROJECT_CREATE_RESPONSE = 'project:create:response',
  PROJECT_UPDATE_REQUEST = 'project:update:request',
  PROJECT_UPDATE_RESPONSE = 'project:update:response',
  PROJECT_DELETE_REQUEST = 'project:delete:request',
  PROJECT_DELETE_RESPONSE = 'project:delete:response',
  PROJECT_ACTION_REQUEST = 'project:action:request',
  PROJECT_ACTION_RESPONSE = 'project:action:response',
  PROJECT_STATUS_UPDATE = 'project:status:update',
  PROJECT_METRICS_UPDATE = 'project:metrics:update',

  // Task messages
  TASK_LIST_REQUEST = 'task:list:request',
  TASK_LIST_RESPONSE = 'task:list:response',
  TASK_CREATE_REQUEST = 'task:create:request',
  TASK_CREATE_RESPONSE = 'task:create:response',
  TASK_UPDATE_REQUEST = 'task:update:request',
  TASK_UPDATE_RESPONSE = 'task:update:response',
  TASK_DELETE_REQUEST = 'task:delete:request',
  TASK_DELETE_RESPONSE = 'task:delete:response',
  TASK_ACTION_REQUEST = 'task:action:request',
  TASK_ACTION_RESPONSE = 'task:action:response',
  TASK_STATUS_UPDATE = 'task:status:update',
  TASK_LOG_UPDATE = 'task:log:update',

  // Auth messages
  AUTH_LIST_REQUEST = 'auth:list:request',
  AUTH_LIST_RESPONSE = 'auth:list:response',
  AUTH_CREATE_REQUEST = 'auth:create:request',
  AUTH_CREATE_RESPONSE = 'auth:create:response',
  AUTH_UPDATE_REQUEST = 'auth:update:request',
  AUTH_UPDATE_RESPONSE = 'auth:update:response',
  AUTH_DELETE_REQUEST = 'auth:delete:request',
  AUTH_DELETE_RESPONSE = 'auth:delete:response',
  AUTH_ACTION_REQUEST = 'auth:action:request',
  AUTH_ACTION_RESPONSE = 'auth:action:response',
  AUTH_STATUS_UPDATE = 'auth:status:update',

  // System messages
  SYSTEM_METRICS_REQUEST = 'system:metrics:request',
  SYSTEM_METRICS_RESPONSE = 'system:metrics:response',
  SYSTEM_METRICS_UPDATE = 'system:metrics:update',
  SYSTEM_ALERT = 'system:alert',
  SYSTEM_ACTION_REQUEST = 'system:action:request',
  SYSTEM_ACTION_RESPONSE = 'system:action:response',

  // Connection messages
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',
  HEARTBEAT = 'heartbeat',

  // Error messages
  ERROR = 'error',
  TIMEOUT = 'timeout',

  // Custom messages
  CUSTOM = 'custom'
}

export interface WebSocketMessage {
  id: string;
  type: MessageType;
  timestamp: Date;
  source: string;
  target?: string;
  payload: any;
  metadata?: {
    sessionId?: string;
    userId?: string;
    correlationId?: string;
    retryCount?: number;
    timeout?: number;
  };
}

export interface APIRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

export interface APIResponse {
  id: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
}

export interface StreamConfig {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  maxRetries: number;
  heartbeatInterval: number;
  compression: boolean;
  encryption: boolean;
}

export interface StreamMessage {
  id: string;
  type: MessageType;
  data: any;
  timestamp: Date;
  sequence: number;
  chunk?: {
    index: number;
    total: number;
    hash: string;
  };
}

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  latency?: number;
  error?: string;
}

export interface RateLimit {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  currentCount: number;
  resetTime: Date;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'ttl';
}

export interface APIConfig {
  baseURL: string;
  version: string;
  timeout: number;
  retries: number;
  rateLimit: RateLimit;
  cache: CacheConfig;
  stream: StreamConfig;
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyLength: number;
  };
  compression: {
    enabled: boolean;
    algorithm: string;
    threshold: number;
  };
}
