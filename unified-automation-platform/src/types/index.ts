// Core type definitions for the Unified Automation Platform

export * from './project';
export * from './task';
export * from './auth';
export * from './system';
export * from './api';
export * from './components';
export * from './services';
export * from './electron';

// Re-export commonly used types
export type {
  Project,
  ProjectConfig,
  ProjectStatus,
  ProjectType,
  Task,
  TaskStatus,
  TaskPriority,
  AuthConfig,
  SystemMetrics,
  IPCRequest,
  IPCResponse,
  WebSocketMessage
} from './project';
