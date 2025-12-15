/**
 * Security and validation types for plugin ecosystem
 */

export interface SecurityProfile {
  level: 'low' | 'medium' | 'high' | 'critical';
  sandboxType: 'full' | 'restricted' | 'minimal';
  allowedDomains?: string[];
  allowedEndpoints?: string[];
  maxMemoryUsage?: number;
  maxCpuUsage?: number;
  networkPolicy?: 'allow-all' | 'whitelist' | 'deny-list';
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

export interface SecurityAudit {
  timestamp: Date;
  action: string;
  user?: string;
  ip?: string;
  result: 'success' | 'failure' | 'warning';
  details?: string;
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