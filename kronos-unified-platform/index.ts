/**
 * KRONOS Unified Platform - Main Application Entry Point
 * Integrates all foundation components into a unified system
 */

import { UnifiedAPIGateway } from './core/api-gateway/src/gateway';
import { ServiceRegistry } from './core/service-discovery/src/registry';
import { UnifiedConfigurationService } from './core/configuration-service/src/service';
import { UnifiedLogger } from './core/observability-platform/src/logger';
import { ServiceInfo, HealthStatus } from './core/service-discovery/src/registry';

export interface PlatformConfig {
  apiGateway: {
    port: number;
    jwtSecret: string;
    cors: {
      origin: string | string[];
      credentials: boolean;
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };
  serviceRegistry: {
    port: number;
    healthCheckInterval: number;
    maxRetries: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    service: string;
    outputs: Array<{
      type: 'console' | 'file';
      config: Record<string, any>;
    }>;
  };
  environment: string;
}

export class KronosUnifiedPlatform {
  private config: PlatformConfig;
  private logger: UnifiedLogger;
  private configService: UnifiedConfigurationService;
  private serviceRegistry: ServiceRegistry;
  private apiGateway?: UnifiedAPIGateway;
  private isRunning = false;

  constructor(config: PlatformConfig) {
    this.config = config;
    this.logger = new UnifiedLogger({
      level: config.logging.level,
      service: config.logging.service,
      outputs: config.logging.outputs,
      format: {
        timestamp: 'iso',
        includeStack: true,
        includeCorrelationId: true,
        includeUserId: true,
        includeMetadata: true
      },
      retention: {
        days: 30,
        compression: true
      }
    });
    
    this.configService = new UnifiedConfigurationService('./config', config.environment);
    this.serviceRegistry = new ServiceRegistry();
  }

  /**
   * Initialize the platform
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing KRONOS Unified Platform...', {
        environment: this.config.environment,
        components: ['ServiceRegistry', 'ConfigurationService', 'APIGateway', 'Logger']
      });

      // Load configuration
      await this.configService.load();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Initialize core services
      await this.initializeCoreServices();
      
      // Register built-in services
      await this.registerBuiltinServices();
      
      this.logger.info('KRONOS Unified Platform initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize KRONOS Unified Platform', error);
      throw error;
    }
  }

  /**
   * Start the platform
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Platform is already running');
      return;
    }

    try {
      this.logger.info('Starting KRONOS Unified Platform...');

      // Start API Gateway
      this.apiGateway = new UnifiedAPIGateway(this.serviceRegistry, {
        port: this.config.apiGateway.port,
        jwtSecret: this.config.apiGateway.jwtSecret,
        cors: this.config.apiGateway.cors,
        rateLimit: this.config.apiGateway.rateLimit,
        services: {}
      });

      await this.apiGateway.start();
      
      this.isRunning = true;
      
      this.logger.info('KRONOS Unified Platform started successfully', {
        apiGatewayPort: this.config.apiGateway.port,
        healthCheck: `http://localhost:${this.config.apiGateway.port}/health`
      });

      // Log startup summary
      this.logStartupSummary();

    } catch (error) {
      this.logger.error('Failed to start KRONOS Unified Platform', error);
      throw error;
    }
  }

  /**
   * Stop the platform
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Platform is not running');
      return;
    }

    try {
      this.logger.info('Stopping KRONOS Unified Platform...');

      // Stop API Gateway
      if (this.apiGateway) {
        await this.apiGateway.stop();
      }

      // Clean up service registry
      this.serviceRegistry.destroy();
      
      // Clean up logger
      await this.logger.flush();

      this.isRunning = false;
      this.logger.info('KRONOS Unified Platform stopped successfully');

    } catch (error) {
      this.logger.error('Error while stopping KRONOS Unified Platform', error);
      throw error;
    }
  }

  /**
   * Get platform status
   */
  public getStatus(): {
    isRunning: boolean;
    uptime: number;
    services: {
      total: number;
      healthy: number;
      unhealthy: number;
      unknown: number;
    };
    version: string;
    environment: string;
  } {
    const stats = this.serviceRegistry.getStatistics();
    
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      services: stats,
      version: '1.0.0',
      environment: this.config.environment
    };
  }

  /**
   * Register a new service
   */
  public async registerService(serviceInfo: ServiceInfo): Promise<void> {
    await this.serviceRegistry.registerService(serviceInfo);
    this.logger.info('Service registered', {
      serviceId: serviceInfo.id,
      serviceName: serviceInfo.name,
      serviceType: serviceInfo.type
    });
  }

  /**
   * Get service information
   */
  public getService(serviceId: string) {
    return this.serviceRegistry.getService(serviceId);
  }

  /**
   * Discover services
   */
  public async discoverService(serviceName: string, type?: string) {
    return await this.serviceRegistry.discoverService(serviceName, type);
  }

  /**
   * Get all registered services
   */
  public getAllServices() {
    return this.serviceRegistry.getAllServices();
  }

  /**
   * Get configuration service
   */
  public getConfigService() {
    return this.configService;
  }

  /**
   * Get logger
   */
  public getLogger() {
    return this.logger;
  }

  /**
   * Get service registry
   */
  public getServiceRegistry() {
    return this.serviceRegistry;
  }

  /**
   * Initialize core platform services
   */
  private async initializeCoreServices(): Promise<void> {
    // Core services are automatically initialized through constructor
    this.logger.info('Core services initialized');
  }

  /**
   * Register built-in platform services
   */
  private async registerBuiltinServices(): Promise<void> {
    const services: ServiceInfo[] = [
      {
        id: 'kronos-service-registry',
        name: 'service-registry',
        version: '1.0.0',
        type: 'orchestrator',
        host: 'localhost',
        port: this.config.serviceRegistry.port,
        protocol: 'http',
        endpoints: [
          {
            path: '/health',
            method: 'GET',
            authentication: false
          },
          {
            path: '/api/services',
            method: 'GET',
            authentication: false
          }
        ],
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000,
          retries: 3,
          healthyThreshold: 2,
          unhealthyThreshold: 3
        },
        dependencies: [],
        metadata: {
          description: 'KRONOS Service Registry',
          capabilities: ['service-discovery', 'health-monitoring']
        },
        status: 'active',
        registeredAt: new Date(),
        lastHeartbeat: new Date()
      },
      {
        id: 'kronos-api-gateway',
        name: 'api-gateway',
        version: '1.0.0',
        type: 'orchestrator',
        host: 'localhost',
        port: this.config.apiGateway.port,
        protocol: 'http',
        endpoints: [
          {
            path: '/health',
            method: 'GET',
            authentication: false
          },
          {
            path: '/api/services',
            method: 'GET',
            authentication: false
          },
          {
            path: '/api/auth/login',
            method: 'POST',
            authentication: false
          }
        ],
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000,
          retries: 3,
          healthyThreshold: 2,
          unhealthyThreshold: 3
        },
        dependencies: ['kronos-service-registry'],
        metadata: {
          description: 'KRONOS API Gateway',
          capabilities: ['routing', 'authentication', 'rate-limiting']
        },
        status: 'active',
        registeredAt: new Date(),
        lastHeartbeat: new Date()
      }
    ];

    for (const service of services) {
      await this.registerService(service);
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Configuration change events
    this.configService.on('configChanged', (data) => {
      this.logger.info('Configuration changed', data);
    });

    this.configService.on('environmentChanged', (data) => {
      this.logger.info('Environment changed', data);
    });

    this.configService.on('serviceRegistered', (data) => {
      this.logger.info('Service registered via config', data);
    });

    // Service registry events
    this.serviceRegistry.on('serviceRegistered', (data) => {
      this.logger.info('Service registered', data);
    });

    this.serviceRegistry.on('serviceUnregistered', (data) => {
      this.logger.info('Service unregistered', data);
    });

    this.serviceRegistry.on('serviceHealthChanged', (data) => {
      if (data.health.status === 'unhealthy') {
        this.logger.warn('Service health degraded', data);
      } else if (data.health.status === 'healthy') {
        this.logger.info('Service health recovered', data);
      }
    });
  }

  /**
   * Log startup summary
   */
  private logStartupSummary(): void {
    const status = this.getStatus();
    
    this.logger.info('=== KRONOS Unified Platform Startup Summary ===', {
      version: status.version,
      environment: status.environment,
      uptime: `${status.uptime}s`,
      apiGateway: `http://localhost:${this.config.apiGateway.port}`,
      healthCheck: `http://localhost:${this.config.apiGateway.port}/health`,
      services: status.services,
      capabilities: [
        'Unified API Gateway',
        'Service Discovery & Registry',
        'Centralized Configuration Management',
        'Unified Logging & Observability',
        'Health Monitoring',
        'Authentication & Authorization',
        'Rate Limiting',
        'Request/Response Correlation'
      ]
    });

    this.logger.info('Platform is ready to accept requests!');
  }

  /**
   * Graceful shutdown handler
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
}

// Export platform components for external use
export { UnifiedAPIGateway };
export { ServiceRegistry };
export { UnifiedConfigurationService };
export { UnifiedLogger };

// Default configuration for development
export const defaultConfig: PlatformConfig = {
  apiGateway: {
    port: 3000,
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // limit each IP to 1000 requests per windowMs
    }
  },
  serviceRegistry: {
    port: 3001,
    healthCheckInterval: 30000,
    maxRetries: 3
  },
  logging: {
    level: process.env.LOG_LEVEL as any || 'info',
    service: 'kronos-platform',
    outputs: [
      {
        type: 'console',
        config: {}
      },
      {
        type: 'file',
        config: {
          errorFile: 'logs/error.log',
          combinedFile: 'logs/combined.log'
        }
      }
    ]
  },
  environment: process.env.NODE_ENV || 'development'
};

// CLI entry point
if (require.main === module) {
  const platform = new KronosUnifiedPlatform(defaultConfig);
  
  // Setup graceful shutdown
  platform['setupGracefulShutdown']();
  
  // Start platform
  platform.initialize()
    .then(() => platform.start())
    .catch((error) => {
      console.error('Failed to start KRONOS Unified Platform:', error);
      process.exit(1);
    });
}

export default KronosUnifiedPlatform;
