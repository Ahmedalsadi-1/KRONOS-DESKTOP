// System monitoring and management type definitions

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    frequency?: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
    buffers?: number;
    cached?: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    percentage: number;
    readBytes: number;
    writeBytes: number;
    readTime: number;
    writeTime: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    errorsIn: number;
    errorsOut: number;
    interfaces: NetworkInterface[];
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
    stopped: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'loopback' | 'other';
  mac?: string;
  ip?: string;
  ipv6?: string;
  subnet?: string;
  gateway?: string;
  dns?: string[];
  status: 'up' | 'down' | 'unknown';
  speed?: number;
  duplex?: 'full' | 'half' | 'unknown';
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  cwd?: string;
  exe?: string;
  user?: string;
  cpu: number;
  memory: number;
  priority?: number;
  status: 'running' | 'sleeping' | 'stopped' | 'zombie' | 'dead';
  createTime: number;
  parentPid?: number;
  children?: number[];
  threads?: number;
  handles?: number;
  environment?: Record<string, string>;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'process' | 'system';
  title: string;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface SystemConfig {
  monitoring: {
    enabled: boolean;
    interval: number;
    retention: number;
    alerts: {
      enabled: boolean;
      thresholds: {
        cpu: number;
        memory: number;
        disk: number;
        network: number;
      };
      cooldown: number;
    };
  };
  performance: {
    maxProcesses: number;
    processCacheSize: number;
    historyRetention: number;
  };
  notifications: {
    enabled: boolean;
    methods: string[];
    webhook?: string;
    email?: string;
  };
}

export interface SystemInfo {
  platform: string;
  arch: string;
  type: string;
  release: string;
  version: string;
  hostname: string;
  uptime: number;
  bootTime: number;
  timezone: string;
  locale: string;
  nodeVersion: string;
  electronVersion: string;
  homeDir: string;
  tempDir: string;
  userDir: string;
}

export interface SystemActionRequest {
  action: 'restart' | 'shutdown' | 'sleep' | 'hibernate' | 'cleanup' | 'optimize' | 'update';
  options?: Record<string, any>;
}

export interface SystemStats {
  summary: SystemMetrics;
  history: SystemMetrics[];
  alerts: SystemAlert[];
  topProcesses: ProcessInfo[];
  systemInfo: SystemInfo;
  config: SystemConfig;
}

export interface SystemResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}
