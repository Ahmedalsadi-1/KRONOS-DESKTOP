/**
 * KRONOS Unified Platform - Unified Logging System
 * Centralized logging with structured logging, correlation IDs, and multi-level support
 */

import winston from 'winston';
import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  outputs: LogOutput[];
  format: LogFormat;
  retention: RetentionPolicy;
}

export interface LogOutput {
  type: 'console' | 'file' | 'database' | 'elasticsearch' | 'datadog' | 'newrelic';
  config: Record<string, any>;
  filters?: LogFilter[];
}

export interface LogFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: any;
}

export interface LogFormat {
  timestamp: 'iso' | 'unix' | 'custom';
  includeStack: boolean;
  includeCorrelationId: boolean;
  includeUserId: boolean;
  includeMetadata: boolean;
}

export interface RetentionPolicy {
  days: number;
  archiveAfter?: number;
  compression?: boolean;
}

export interface MetricsData {
  service: string;
  timestamp: string;
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  labels?: Record<string, string>;
}

export class UnifiedLogger extends EventEmitter {
  private logger: winston.Logger;
  private config: LoggerConfig;
  private metrics: Map<string, MetricsData> = new Map();
  private correlationMap: Map<string, {
    startTime: number;
    request: any;
    userId?: string;
  }> = new Map();

  constructor(config: LoggerConfig) {
    super();
    this.config = config;
    this.logger = this.createWinstonLogger();
    this.setupMetricsCollection();
  }

  /**
   * Create Winston logger instance
   */
  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console output
    if (this.config.outputs.some(o => o.type === 'console')) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
          })
        )
      }));
    }

    // File output
    const fileOutputs = this.config.outputs.filter(o => o.type === 'file');
    fileOutputs.forEach(output => {
      transports.push(
        new winston.transports.File({
          filename: output.config.errorFile || 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        new winston.transports.File({
          filename: output.config.combinedFile || 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );
    });

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: this.config.format.includeStack }),
        winston.format.json()
      ),
      transports,
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }

  /**
   * Collect service metrics
   */
  private collectMetrics(): void {
    const processMetrics = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metricsData: MetricsData = {
      service: this.config.service,
      timestamp: new Date().toISOString(),
      metrics: {
        requestCount: 0, // Will be updated by request tracking
        errorCount: 0,   // Will be updated by error tracking
        averageResponseTime: 0, // Will be calculated from correlation data
        activeConnections: this.correlationMap.size,
        memoryUsage: processMetrics.heapUsed / 1024 / 1024, // MB
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000 // seconds
      }
    };

    this.metrics.set(this.config.service, metricsData);
    this.emit('metrics', metricsData);
  }

  /**
   * Start request tracking
   */
  public startRequest(request: any): string {
    const correlationId = this.generateCorrelationId();
    
    this.correlationMap.set(correlationId, {
      startTime: Date.now(),
      request,
      userId: request.userId
    });

    this.log('debug', 'Request started', {
      correlationId,
      method: request.method,
      path: request.path,
      userId: request.userId,
      ip: request.ip,
      userAgent: request.get?.('User-Agent')
    });

    return correlationId;
  }

  /**
   * End request tracking
   */
  public endRequest(correlationId: string, response: any, error?: Error): void {
    const correlation = this.correlationMap.get(correlationId);
    if (!correlation) return;

    const duration = Date.now() - correlation.startTime;
    
    if (error) {
      this.log('error', 'Request failed', {
        correlationId,
        duration,
        error: this.formatError(error),
        statusCode: response?.statusCode || 500
      });
    } else {
      this.log('info', 'Request completed', {
        correlationId,
        duration,
        statusCode: response?.statusCode || 200,
        method: correlation.request.method,
        path: correlation.request.path
      });
    }

    this.correlationMap.delete(correlationId);
  }

  /**
   * Log message with structured data
   */
  public log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      metadata
    };

    // Apply output filters
    if (!this.shouldLog(logEntry)) {
      return;
    }

    // Log based on level
    switch (level) {
      case 'error':
        this.logger.error(message, metadata);
        break;
      case 'warn':
        this.logger.warn(message, metadata);
        break;
      case 'info':
        this.logger.info(message, metadata);
        break;
      case 'debug':
        this.logger.debug(message, metadata);
        break;
      case 'verbose':
        this.logger.verbose(message, metadata);
        break;
    }

    // Emit log event for external processing
    this.emit('log', logEntry);
  }

  /**
   * Check if log entry should be processed
   */
  private shouldLog(entry: LogEntry): boolean {
    for (const output of this.config.outputs) {
      if (output.filters) {
        for (const filter of output.filters) {
          const fieldValue = this.getFieldValue(entry, filter.field);
          if (!this.matchesFilter(fieldValue, filter.operator, filter.value)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Get field value from log entry
   */
  private getFieldValue(entry: LogEntry, field: string): any {
    if (field in entry) {
      return (entry as any)[field];
    }
    if (entry.metadata && field in entry.metadata) {
      return entry.metadata[field];
    }
    return undefined;
  }

  /**
   * Check if field value matches filter
   */
  private matchesFilter(value: any, operator: string, filterValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === filterValue;
      case 'contains':
        return typeof value === 'string' && value.includes(filterValue);
      case 'startsWith':
        return typeof value === 'string' && value.startsWith(filterValue);
      case 'endsWith':
        return typeof value === 'string' && value.endsWith(filterValue);
      case 'regex':
        return new RegExp(filterValue).test(String(value));
      default:
        return true;
    }
  }

  /**
   * Convenience methods for different log levels
   */
  public error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, {
      ...metadata,
      error: error ? this.formatError(error) : undefined
    });
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  public verbose(message: string, metadata?: Record<string, any>): void {
    this.log('verbose', message, metadata);
  }

  /**
   * Log user actions
   */
  public logUserAction(userId: string, action: string, metadata?: Record<string, any>): void {
    this.log('info', `User action: ${action}`, {
      ...metadata,
      userId,
      action,
      type: 'user_action'
    });
  }

  /**
   * Log system events
   */
  public logSystemEvent(event: string, metadata?: Record<string, any>): void {
    this.log('info', `System event: ${event}`, {
      ...metadata,
      event,
      type: 'system_event'
    });
  }

  /**
   * Log performance metrics
   */
  public logPerformance(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.log('info', `Performance: ${operation}`, {
      ...metadata,
      operation,
      duration,
      type: 'performance'
    });
  }

  /**
   * Log security events
   */
  public logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.log(level, `Security event: ${event}`, {
      ...metadata,
      event,
      severity,
      type: 'security'
    });
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error): {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  } {
    return {
      name: error.name,
      message: error.message,
      stack: this.config.format.includeStack ? error.stack : undefined,
      code: (error as any).code
    };
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current metrics
   */
  public getMetrics(service?: string): MetricsData | Map<string, MetricsData> {
    if (service) {
      return this.metrics.get(service) || {} as MetricsData;
    }
    return this.metrics;
  }

  /**
   * Get log entries (for testing/debugging)
   */
  public getLogEntries(level?: LogLevel): LogEntry[] {
    // This would typically query a log store
    // For now, return empty array as logs are streamed
    return [];
  }

  /**
   * Update logger configuration
   */
  public updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger = this.createWinstonLogger();
    this.log('info', 'Logger configuration updated', { newConfig });
  }

  /**
   * Flush logs (for graceful shutdown)
   */
  public async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.correlationMap.clear();
    this.metrics.clear();
    this.removeAllListeners();
  }
}
