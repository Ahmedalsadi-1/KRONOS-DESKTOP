/**
 * Plugin execution statistics and monitoring
 */

export interface ExecutionStats {
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  errorCount: number;
  lastError?: Error;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests?: number;
  outputSize?: number;
}

export interface SecurityContext {
  permissions: string[];
  sandboxPath?: string;
  resourceLimits: {
    maxMemory: number;
    maxCpu: number;
    maxFileSize: number;
    maxNetworkRequests: number;
  };
  auditTrail: SecurityAudit[];
}

export interface SecurityAudit {
  timestamp: Date;
  action: string;
  user?: string;
  ip?: string;
  result: 'success' | 'failure' | 'warning';
  details?: string;
}

export interface PluginSecurity {
  codeSignature?: string;
  sha256Hash?: string;
  permissions: SecurityProfile[];
  vulnerabilities?: VulnerabilityReport[];
}

export interface SecurityProfile {
  level: 'low' | 'medium' | 'high' | 'critical';
  sandboxType: 'full' | 'restricted' | 'minimal';
  allowedDomains?: string[];
  allowedEndpoints?: string[];
  maxMemoryUsage?: number;
  maxCpuUsage?: number;
}

export interface VulnerabilityReport {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  affectedFiles?: string[];
  cve?: string;
  fixedIn?: string;
  reportedDate: Date;
  score: number;
}