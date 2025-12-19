export interface MCPMessage {
  id: string;
  method: string;
  params?: any;
  jsonrpc: '2.0';
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: MCPError;
  jsonrpc: '2.0';
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface AgentConfig {
  name: string;
  url: string;
  port?: number;
  protocol: 'http' | 'websocket' | 'tcp';
  timeout: number;
  retryAttempts: number;
}

export interface TestResult {
  testName: string;
  duration: number;
  success: boolean;
  error?: string;
  metrics?: TestMetrics;
}

export interface TestMetrics {
  messagesPerSecond: number;
  averageLatency: number;
  totalMessages: number;
  errorCount: number;
  throughput: number;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage?: number;
}

export interface StressTestConfig {
  duration: number; // in seconds
  concurrentConnections: number;
  messageRate: number; // messages per second
  rampUpTime: number; // in seconds
}

export interface BenchmarkConfig {
  warmUpIterations: number;
  testIterations: number;
  cooldownTime: number;
  percentileReporting: number[];
}

export interface AgentInteraction {
  fromAgent: string;
  toAgent: string;
  message: MCPMessage;
  expectedResponse?: any;
  timeout?: number;
}

export interface StreamingTestConfig {
  streamDuration: number;
  chunkSize: number;
  totalDataSize: number;
  concurrentStreams: number;
}

export enum ErrorType {
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export interface ErrorTestCase {
  type: ErrorType;
  trigger: () => Promise<void>;
  expectedBehavior: string;
}