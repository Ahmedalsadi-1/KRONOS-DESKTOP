// Service layer type definitions

import { EventEmitter } from 'events';

// Base service interface
export interface Service extends EventEmitter {
  name: string;
  version: string;
  status: ServiceStatus;
  dependencies: string[];
  config: ServiceConfig;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<ServiceHealth>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getStatus(): ServiceStatus;
}

// Service status enum
export enum ServiceStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

// Service configuration
export interface ServiceConfig {
  enabled: boolean;
  autoStart: boolean;
  restartOnError: boolean;
  maxRestarts: number;
  restartDelay: number;
  timeout: number;
  port?: number;
  host?: string;
  protocol?: string;
  endpoints?: Record<string, string>;
  environment?: Record<string, string>;
}

// Service health check result
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  uptime: number;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

// Project Manager Service
export interface ProjectManagerService extends Service {
  projects: Map<string, any>;
  getProjects(): Promise<any[]>;
  createProject(config: any): Promise<any>;
  updateProject(id: string, config: any): Promise<any>;
  deleteProject(id: string): Promise<void>;
  startProject(id: string): Promise<void>;
  stopProject(id: string): Promise<void>;
  restartProject(id: string): Promise<void>;
  getProjectStatus(id: string): Promise<any>;
}

// Process Monitor Service
export interface ProcessMonitorService extends Service {
  processes: Map<number, any>;
  systemMetrics: any;
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getSystemMetrics(): Promise<any>;
  getProcessInfo(pid: number): Promise<any>;
  getTopProcesses(limit?: number): Promise<any[]>;
  killProcess(pid: number): Promise<void>;
}

// WebSocket Manager Service
export interface WebSocketManagerService extends Service {
  connections: Map<string, any>;
  servers: Map<string, any>;
  createServer(config: any): Promise<any>;
  connect(url: string, options?: any): Promise<any>;
  broadcast(message: any): Promise<void>;
  getConnectionStats(): any;
}

// Auth Manager Service
export interface AuthManagerService extends Service {
  configs: Map<string, any>;
  sessions: Map<string, any>;
  createConfig(config: any): Promise<any>;
  updateConfig(id: string, config: any): Promise<any>;
  deleteConfig(id: string): Promise<void>;
  validateConfig(id: string): Promise<any>;
  getConfig(id: string): Promise<any>;
  getConfigs(): Promise<any[]>;
}

// Service registry
export interface ServiceRegistry {
  services: Map<string, Service>;
  register(service: Service): Promise<void>;
  unregister(name: string): Promise<void>;
  getService<T extends Service>(name: string): T | undefined;
  getServices(): Service[];
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
  getServiceStatus(): Record<string, ServiceStatus>;
}

// Service manager
export interface ServiceManager extends Service {
  registry: ServiceRegistry;
  loadServices(): Promise<void>;
  unloadService(name: string): Promise<void>;
  getServiceInfo(name: string): any;
  getAllServiceInfo(): Record<string, any>;
  createService(name: string, config: any): Promise<Service>;
}

// Service events
export interface ServiceEvent {
  serviceName: string;
  type: ServiceEventType;
  timestamp: Date;
  data?: any;
  error?: string;
}

export enum ServiceEventType {
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  CONFIG_CHANGED = 'config_changed',
  DEPENDENCY_CHANGED = 'dependency_changed'
}

// Service metrics
export interface ServiceMetrics {
  name: string;
  status: ServiceStatus;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestCount: number;
  errorCount: number;
  lastActivity: Date;
}

// Service discovery
export interface ServiceDiscovery {
  services: Map<string, ServiceInfo>;
  register(service: ServiceInfo): Promise<void>;
  unregister(name: string): Promise<void>;
  discover(query: any): Promise<ServiceInfo[]>;
  getService(name: string): ServiceInfo | undefined;
}

export interface ServiceInfo {
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: string;
  metadata?: Record<string, any>;
  healthCheck?: string;
  dependencies?: string[];
  tags?: string[];
}

// Service load balancer
export interface ServiceLoadBalancer {
  services: Map<string, ServiceInfo[]>;
  selectService(serviceName: string): ServiceInfo | undefined;
  addService(service: ServiceInfo): void;
  removeService(serviceName: string, host: string): void;
  getHealthyServices(serviceName: string): ServiceInfo[];
}

// Service configuration manager
export interface ServiceConfigManager {
  configs: Map<string, ServiceConfig>;
  getConfig(serviceName: string): ServiceConfig | undefined;
  setConfig(serviceName: string, config: ServiceConfig): void;
  deleteConfig(serviceName: string): void;
  validateConfig(config: ServiceConfig): boolean;
  mergeConfigs(defaults: ServiceConfig, overrides: Partial<ServiceConfig>): ServiceConfig;
}
