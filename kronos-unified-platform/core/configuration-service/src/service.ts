/**
 * KRONOS Unified Platform - Configuration Service
 * Centralized configuration management with environment-specific profiles and hot-reloading
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface ConfigurationService {
  // Service interfaces
  get<T = any>(key: string): T;
  set<T = any>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  getAll(): Record<string, any>;
  
  // Environment management
  getEnvironment(): string;
  switchEnvironment(env: string): Promise<void>;
  listEnvironments(): string[];
  
  // Service configuration
  registerService(serviceName: string, config: ServiceConfig): void;
  getServiceConfig(serviceName: string): ServiceConfig | null;
  getAllServiceConfigs(): Record<string, ServiceConfig>;
  
  // Configuration validation
  validateConfig(config: Record<string, any>): ValidationResult;
  getSchema(serviceName?: string): Record<string, any>;
  
  // Event handling
  on(event: 'configChanged' | 'environmentChanged' | 'serviceRegistered', listener: (data: any) => void): void;
  off(event: 'configChanged' | 'environmentChanged' | 'serviceRegistered', listener: (data: any) => void): void;
  
  // Persistence
  save(): Promise<void>;
  load(): Promise<void>;
  reset(): Promise<void>;
}

export interface ServiceConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  environment: string;
  resources: ResourceConfig;
  endpoints: EndpointConfig[];
  secrets: Record<string, string>;
  metadata: Record<string, any>;
  dependencies: string[];
}

export interface ResourceConfig {
  cpu: string;
  memory: string;
  storage: string;
  replicas: number;
  scaling: ScalingConfig;
}

export interface ScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number;
  targetMemory: number;
}

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  authentication: boolean;
  rateLimit?: RateLimitConfig;
  timeout?: number;
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

export class UnifiedConfigurationService extends EventEmitter implements ConfigurationService {
  private config: Map<string, any> = new Map();
  private serviceConfigs: Map<string, ServiceConfig> = new Map();
  private currentEnvironment: string;
  private configPath: string;
  private watchInterval?: NodeJS.Timeout;
  private validationSchemas: Map<string, Record<string, any>> = new Map();

  constructor(configPath: string = './config', defaultEnvironment: string = 'development') {
    super();
    this.configPath = configPath;
    this.currentEnvironment = defaultEnvironment;
    this.initializeSchemas();
    this.setupFileWatcher();
  }

  /**
   * Initialize validation schemas for all services
   */
  private initializeSchemas(): void {
    // Core platform schema
    this.validationSchemas.set('platform', {
      type: 'object',
      required: ['apiGateway', 'serviceRegistry', 'orchestrationEngine'],
      properties: {
        apiGateway: {
          type: 'object',
          required: ['port', 'jwtSecret'],
          properties: {
            port: { type: 'number', minimum: 1024, maximum: 65535 },
            jwtSecret: { type: 'string', minLength: 32 },
            cors: {
              type: 'object',
              properties: {
                origin: { anyOf: [{ type: 'string' }, { type: 'array' }] },
                credentials: { type: 'boolean' }
              }
            }
          }
        },
        serviceRegistry: {
          type: 'object',
          required: ['port'],
          properties: {
            port: { type: 'number', minimum: 1024, maximum: 65535 },
            healthCheckInterval: { type: 'number', minimum: 1000 },
            maxRetries: { type: 'number', minimum: 1, maximum: 10 }
          }
        }
      }
    });

    // Service-specific schemas
    this.validationSchemas.set('browser-controller', {
      type: 'object',
      required: ['port', 'headless'],
      properties: {
        port: { type: 'number', minimum: 1024, maximum: 65535 },
        headless: { type: 'boolean' },
        selenium: {
          type: 'object',
          properties: {
            timeout: { type: 'number', minimum: 1000 },
            windowSize: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } }
          }
        }
      }
    });

    this.validationSchemas.set('agent-orchestrator', {
      type: 'object',
      required: ['port', 'maxConcurrentTasks'],
      properties: {
        port: { type: 'number', minimum: 1024, maximum: 65535 },
        maxConcurrentTasks: { type: 'number', minimum: 1, maximum: 100 },
        taskTimeout: { type: 'number', minimum: 1000 },
        retryAttempts: { type: 'number', minimum: 0, maximum: 10 }
      }
    });

    this.validationSchemas.set('social-scheduler', {
      type: 'object',
      required: ['port', 'platforms'],
      properties: {
        port: { type: 'number', minimum: 1024, maximum: 65535 },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'] }
        },
        maxPostsPerDay: { type: 'number', minimum: 1, maximum: 100 },
        rateLimits: { type: 'object' }
      }
    });
  }

  /**
   * Set up file watcher for configuration changes
   */
  private setupFileWatcher(): void {
    this.watchInterval = setInterval(async () => {
      try {
        const envConfigPath = path.join(this.configPath, `env.${this.currentEnvironment}.json`);
        if (fs.existsSync(envConfigPath)) {
          const stats = fs.statSync(envConfigPath);
          // TODO: Implement file change detection and hot-reloading
          // For now, just periodic reload
          await this.load();
        }
      } catch (error) {
        console.error('[ConfigurationService] Error checking config files:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  // Configuration Service Implementation

  public get<T = any>(key: string): T {
    return this.config.get(key);
  }

  public set<T = any>(key: string, value: T): void {
    const oldValue = this.config.get(key);
    this.config.set(key, value);
    
    // Emit change event
    this.emit('configChanged', {
      key,
      oldValue,
      newValue: value,
      environment: this.currentEnvironment
    });
    
    console.log(`[ConfigurationService] Updated config: ${key} = ${JSON.stringify(value)}`);
  }

  public has(key: string): boolean {
    return this.config.has(key);
  }

  public delete(key: string): void {
    const oldValue = this.config.get(key);
    this.config.delete(key);
    
    this.emit('configChanged', {
      key,
      oldValue,
      newValue: null,
      environment: this.currentEnvironment
    });
  }

  public clear(): void {
    const oldConfig = new Map(this.config);
    this.config.clear();
    
    this.emit('configChanged', {
      type: 'clear',
      oldConfig,
      newConfig: new Map(),
      environment: this.currentEnvironment
    });
  }

  public getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.config.entries()) {
      result[key] = value;
    }
    return result;
  }

  // Environment Management

  public getEnvironment(): string {
    return this.currentEnvironment;
  }

  public async switchEnvironment(env: string): Promise<void> {
    if (!this.listEnvironments().includes(env)) {
      throw new Error(`Environment '${env}' does not exist. Available: ${this.listEnvironments().join(', ')}`);
    }

    const oldEnvironment = this.currentEnvironment;
    this.currentEnvironment = env;
    
    await this.load();
    
    this.emit('environmentChanged', {
      oldEnvironment,
      newEnvironment: env,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[ConfigurationService] Switched environment from ${oldEnvironment} to ${env}`);
  }

  public listEnvironments(): string[] {
    const environments = ['development', 'staging', 'production'];
    try {
      const files = fs.readdirSync(this.configPath);
      return files
        .filter(file => file.startsWith('env.') && file.endsWith('.json'))
        .map(file => file.replace('env.', '').replace('.json', ''))
        .filter(env => environments.includes(env));
    } catch (error) {
      return environments; // Return defaults if directory doesn't exist
    }
  }

  // Service Configuration

  public registerService(serviceName: string, config: ServiceConfig): void {
    // Validate service configuration
    const validation = this.validateServiceConfig(serviceName, config);
    if (!validation.valid) {
      throw new Error(`Invalid service configuration for ${serviceName}: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.serviceConfigs.set(serviceName, config);
    
    this.emit('serviceRegistered', {
      serviceName,
      config,
      environment: this.currentEnvironment
    });
    
    console.log(`[ConfigurationService] Registered service: ${serviceName}`);
  }

  public getServiceConfig(serviceName: string): ServiceConfig | null {
    return this.serviceConfigs.get(serviceName) || null;
  }

  public getAllServiceConfigs(): Record<string, ServiceConfig> {
    const result: Record<string, ServiceConfig> = {};
    for (const [name, config] of this.serviceConfigs.entries()) {
      result[name] = config;
    }
    return result;
  }

  // Configuration Validation

  public validateConfig(config: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    for (const [key, value] of Object.entries(config)) {
      if (value === undefined || value === null) {
        errors.push({
          field: key,
          message: 'Configuration value cannot be null or undefined',
          code: 'NULL_VALUE'
        });
      }
    }

    // Environment-specific validation
    if (this.currentEnvironment === 'production') {
      // Production-specific validations
      if (config.debug === true) {
        warnings.push({
          field: 'debug',
          message: 'Debug mode enabled in production',
          suggestion: 'Consider disabling debug mode in production for security'
        });
      }

      if (!config.ssl || !config.ssl.enabled) {
        errors.push({
          field: 'ssl',
          message: 'SSL/TLS must be enabled in production',
          code: 'SSL_REQUIRED'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateServiceConfig(serviceName: string, config: ServiceConfig): ValidationResult {
    const schema = this.validationSchemas.get(serviceName);
    if (!schema) {
      return {
        valid: true,
        errors: [],
        warnings: [{
          field: 'schema',
          message: `No validation schema found for service: ${serviceName}`,
          suggestion: 'Consider adding a validation schema for better error detection'
        }]
      };
    }

    // Basic schema validation (simplified)
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in config)) {
          errors.push({
            field: requiredField,
            message: `Required field '${requiredField}' is missing`,
            code: 'REQUIRED_FIELD'
          });
        }
      }
    }

    // Validate resource constraints
    if (config.resources) {
      if (config.resources.replicas < 1) {
        errors.push({
          field: 'resources.replicas',
          message: 'Number of replicas must be at least 1',
          code: 'INVALID_REPLICAS'
        });
      }

      if (config.resources.scaling) {
        if (config.resources.scaling.maxReplicas < config.resources.scaling.minReplicas) {
          errors.push({
            field: 'resources.scaling',
            message: 'Max replicas must be greater than or equal to min replicas',
            code: 'INVALID_SCALING'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public getSchema(serviceName?: string): Record<string, any> {
    if (serviceName) {
      return this.validationSchemas.get(serviceName) || {};
    }
    
    // Return merged schema for all services
    const mergedSchema: Record<string, any> = {};
    for (const [name, schema] of this.validationSchemas.entries()) {
      mergedSchema[name] = schema;
    }
    return mergedSchema;
  }

  // Event Handling (inherited from EventEmitter)

  // Persistence

  public async save(): Promise<void> {
    try {
      const configDir = this.configPath;
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const envConfigPath = path.join(configDir, `env.${this.currentEnvironment}.json`);
      const configData = {
        environment: this.currentEnvironment,
        timestamp: new Date().toISOString(),
        config: Object.fromEntries(this.config),
        services: Object.fromEntries(this.serviceConfigs)
      };

      fs.writeFileSync(envConfigPath, JSON.stringify(configData, null, 2));
      console.log(`[ConfigurationService] Saved configuration for environment: ${this.currentEnvironment}`);
    } catch (error) {
      console.error('[ConfigurationService] Failed to save configuration:', error);
      throw error;
    }
  }

  public async load(): Promise<void> {
    try {
      const envConfigPath = path.join(this.configPath, `env.${this.currentEnvironment}.json`);
      
      if (!fs.existsSync(envConfigPath)) {
        console.log(`[ConfigurationService] Configuration file not found for environment: ${this.currentEnvironment}, using defaults`);
        this.loadDefaults();
        return;
      }

      const configData = JSON.parse(fs.readFileSync(envConfigPath, 'utf-8'));
      
      // Load main configuration
      this.config.clear();
      if (configData.config) {
        for (const [key, value] of Object.entries(configData.config)) {
          this.config.set(key, value);
        }
      }

      // Load service configurations
      this.serviceConfigs.clear();
      if (configData.services) {
        for (const [name, serviceConfig] of Object.entries(configData.services)) {
          this.serviceConfigs.set(name, serviceConfig as ServiceConfig);
        }
      }

      console.log(`[ConfigurationService] Loaded configuration for environment: ${this.currentEnvironment}`);
    } catch (error) {
      console.error('[ConfigurationService] Failed to load configuration:', error);
      // Fall back to defaults on error
      this.loadDefaults();
    }
  }

  private loadDefaults(): void {
    // Set default configuration values
    this.config.set('platform.debug', this.currentEnvironment === 'development');
    this.config.set('platform.logLevel', 'info');
    this.config.set('platform.port', 3000);
    this.config.set('database.url', 'mongodb://localhost:27017/kronos');
    this.config.set('redis.url', 'redis://localhost:6379');
    
    console.log('[ConfigurationService] Loaded default configuration');
  }

  public async reset(): Promise<void> {
    this.config.clear();
    this.serviceConfigs.clear();
    await this.load();
    
    this.emit('configChanged', {
      type: 'reset',
      environment: this.currentEnvironment
    });
    
    console.log('[ConfigurationService] Configuration reset to defaults');
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
    this.removeAllListeners();
  }
}
