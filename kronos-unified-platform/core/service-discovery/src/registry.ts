/**
 * KRONOS Unified Platform - Service Registry
 * Centralized service registration and discovery management
 */

export interface ServiceInfo {
  id: string;
  name: string;
  version: string;
  type: 'browser' | 'social' | 'desktop' | 'environment' | 'content' | 'orchestrator';
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  endpoints: ServiceEndpoint[];
  healthCheck: HealthCheckConfig;
  dependencies: string[];
  metadata: Record<string, any>;
  status: 'active' | 'inactive' | 'deprecated';
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface ServiceEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authentication: boolean;
  rateLimit?: RateLimit;
  timeout?: number;
}

export interface RateLimit {
  requests: number;
  window: number; // milliseconds
}

export interface HealthCheckConfig {
  path: string;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface ServiceInstance {
  service: ServiceInfo;
  health: HealthStatus;
  load: number;
  responseTime: number;
  lastCheck: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  details?: Record<string, any>;
  lastCheck: Date;
}

export class ServiceRegistry {
  private services: Map<string, ServiceInstance> = new Map();
  private healthCheckers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a new service with the platform
   */
  async registerService(serviceInfo: ServiceInfo): Promise<void> {
    try {
      // Validate service information
      this.validateServiceInfo(serviceInfo);

      // Create service instance
      const instance: ServiceInstance = {
        service: serviceInfo,
        health: { status: 'unknown', lastCheck: new Date() },
        load: 0,
        responseTime: 0,
        lastCheck: new Date()
      };

      // Register service
      this.services.set(serviceInfo.id, instance);

      // Start health checking
      this.startHealthCheck(serviceInfo.id);

      // Log registration
      console.log(`[ServiceRegistry] Registered service: ${serviceInfo.name} (${serviceInfo.id})`);

    } catch (error) {
      console.error(`[ServiceRegistry] Failed to register service ${serviceInfo.name}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a service from the platform
   */
  async unregisterService(serviceId: string): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Service ${serviceId} not found`);
      }

      // Stop health checking
      this.stopHealthCheck(serviceId);

      // Remove from registry
      this.services.delete(serviceId);

      console.log(`[ServiceRegistry] Unregistered service: ${serviceId}`);

    } catch (error) {
      console.error(`[ServiceRegistry] Failed to unregister service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Discover services by name and type
   */
  async discoverService(serviceName: string, type?: string): Promise<ServiceInstance[]> {
    try {
      const results: ServiceInstance[] = [];

      for (const [id, instance] of this.services) {
        // Check if service matches name
        if (instance.service.name === serviceName && instance.service.status === 'active') {
          // Filter by type if specified
          if (!type || instance.service.type === type) {
            results.push(instance);
          }
        }
      }

      // Sort by health status and load
      results.sort((a, b) => {
        if (a.health.status !== b.health.status) {
          return a.health.status === 'healthy' ? -1 : 1;
        }
        return a.load - b.load;
      });

      return results;

    } catch (error) {
      console.error(`[ServiceRegistry] Failed to discover service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service by ID
   */
  getService(serviceId: string): ServiceInstance | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceId: string, health: HealthStatus): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.health = health;
      service.lastCheck = new Date();
    }
  }

  /**
   * Start health checking for a service
   */
  private startHealthCheck(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (!service) return;

    const config = service.service.healthCheck;
    const checkInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck(service.service);
        this.updateServiceHealth(serviceId, health);
      } catch (error) {
        console.error(`[ServiceRegistry] Health check failed for ${serviceId}:`, error);
        this.updateServiceHealth(serviceId, {
          status: 'unhealthy',
          message: 'Health check failed',
          lastCheck: new Date()
        });
      }
    }, config.interval);

    this.healthCheckers.set(serviceId, checkInterval);
  }

  /**
   * Stop health checking for a service
   */
  private stopHealthCheck(serviceId: string): void {
    const checker = this.healthCheckers.get(serviceId);
    if (checker) {
      clearInterval(checker);
      this.healthCheckers.delete(serviceId);
    }
  }

  /**
   * Perform health check for a service
   */
  private async performHealthCheck(service: ServiceInfo): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      const healthUrl = `${service.protocol}://${service.host}:${service.port}${service.healthCheck.path}`;
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        timeout: service.healthCheck.timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          status: 'healthy',
          message: 'Service is healthy',
          details: {
            responseTime,
            statusCode: response.status
          },
          lastCheck: new Date()
        };
      } else {
        return {
          status: 'unhealthy',
          message: `Service returned status ${response.status}`,
          details: {
            responseTime,
            statusCode: response.status
          },
          lastCheck: new Date()
        };
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date()
      };
    }
  }

  /**
   * Validate service information
   */
  private validateServiceInfo(serviceInfo: ServiceInfo): void {
    if (!serviceInfo.id || !serviceInfo.name || !serviceInfo.version) {
      throw new Error('Service ID, name, and version are required');
    }

    if (!serviceInfo.host || !serviceInfo.port) {
      throw new Error('Service host and port are required');
    }

    if (!['http', 'https', 'ws', 'wss'].includes(serviceInfo.protocol)) {
      throw new Error('Invalid protocol specified');
    }

    if (!serviceInfo.healthCheck) {
      throw new Error('Health check configuration is required');
    }
  }

  /**
   * Update service load information
   */
  updateServiceLoad(serviceId: string, load: number): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.load = load;
    }
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    unknownServices: number;
  } {
    const stats = {
      totalServices: this.services.size,
      healthyServices: 0,
      unhealthyServices: 0,
      unknownServices: 0
    };

    for (const instance of this.services.values()) {
      switch (instance.health.status) {
        case 'healthy':
          stats.healthyServices++;
          break;
        case 'unhealthy':
          stats.unhealthyServices++;
          break;
        default:
          stats.unknownServices++;
      }
    }

    return stats;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop all health checkers
    for (const checker of this.healthCheckers.values()) {
      clearInterval(checker);
    }
    this.healthCheckers.clear();
    this.services.clear();
  }
}
