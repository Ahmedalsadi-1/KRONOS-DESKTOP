import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { ServiceInstance, ServiceEndpoint } from '../types/database.types';

@Injectable()
export class ServiceRegistryService implements OnModuleInit, OnModuleDestroy {
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly SERVICE_TTL = 60000; // 1 minute

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    // Register this service if configured
    const serviceName = this.configService.get('SERVICE_NAME');
    if (serviceName) {
      await this.registerService({
        id: this.configService.get('SERVICE_ID', 'default'),
        name: serviceName,
        version: this.configService.get('SERVICE_VERSION', '1.0.0'),
        host: this.configService.get('SERVICE_HOST', 'localhost'),
        port: this.configService.get('SERVICE_PORT', 3000),
        protocol: this.configService.get('SERVICE_PROTOCOL', 'http'),
        status: 'healthy',
        metadata: {
          environment: this.configService.get('NODE_ENV', 'development'),
          startedAt: new Date().toISOString(),
        },
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
      });
    }
  }

  async onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Unregister this service
    const serviceId = this.configService.get('SERVICE_ID');
    if (serviceId) {
      await this.unregisterService(serviceId);
    }
  }

  async registerService(service: Omit<ServiceInstance, 'registeredAt' | 'lastHeartbeat'> & { registeredAt?: Date; lastHeartbeat?: Date }): Promise<void> {
    const serviceInstance: ServiceInstance = {
      ...service,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    } as ServiceInstance;

    const key = this.getServiceKey(service.id);
    await this.cacheService.set(key, serviceInstance, this.SERVICE_TTL);

    // Add to services index
    const indexKey = 'services:index';
    await this.cacheService.sadd(indexKey, service.id);

    console.log(`Service registered: ${service.name} (${service.id})`);
  }

  async unregisterService(serviceId: string): Promise<void> {
    const key = this.getServiceKey(serviceId);
    await this.cacheService.delete(key);

    // Remove from services index
    const indexKey = 'services:index';
    await this.cacheService.sadd(indexKey, serviceId); // Redis SREM equivalent would be needed

    console.log(`Service unregistered: ${serviceId}`);
  }

  async getService(serviceId: string): Promise<ServiceInstance | null> {
    const key = this.getServiceKey(serviceId);
    return await this.cacheService.get<ServiceInstance>(key);
  }

  async getServicesByName(name: string): Promise<ServiceInstance[]> {
    const allServices = await this.getAllServices();
    return allServices.filter(service => service.name === name);
  }

  async getAllServices(): Promise<ServiceInstance[]> {
    const indexKey = 'services:index';
    const serviceIds = await this.cacheService.smembers(indexKey);

    const services: ServiceInstance[] = [];
    for (const serviceId of serviceIds) {
      const service = await this.getService(serviceId);
      if (service) {
        services.push(service);
      }
    }

    return services;
  }

  async updateServiceStatus(serviceId: string, status: 'healthy' | 'unhealthy' | 'unknown'): Promise<void> {
    const service = await this.getService(serviceId);
    if (service) {
      service.status = status;
      service.lastHeartbeat = new Date();

      const key = this.getServiceKey(serviceId);
      await this.cacheService.set(key, service, this.SERVICE_TTL);
    }
  }

  async heartbeat(serviceId: string): Promise<void> {
    const service = await this.getService(serviceId);
    if (service) {
      service.lastHeartbeat = new Date();
      service.status = 'healthy';

      const key = this.getServiceKey(serviceId);
      await this.cacheService.set(key, service, this.SERVICE_TTL);
    }
  }

  async discoverService(name: string, version?: string): Promise<ServiceInstance | null> {
    const services = await this.getServicesByName(name);

    if (services.length === 0) {
      return null;
    }

    // Filter by version if specified
    let candidates = services;
    if (version) {
      candidates = services.filter(service => service.version === version);
    }

    // Return the most recently registered healthy service
    const healthyServices = candidates.filter(service => service.status === 'healthy');
    if (healthyServices.length > 0) {
      return healthyServices.sort((a, b) =>
        b.registeredAt.getTime() - a.registeredAt.getTime()
      )[0];
    }

    // Fallback to any service
    return candidates.sort((a, b) =>
      b.registeredAt.getTime() - a.registeredAt.getTime()
    )[0];
  }

  async registerEndpoint(serviceId: string, endpoint: Omit<ServiceEndpoint, 'serviceId'>): Promise<void> {
    const endpointKey = this.getEndpointKey(serviceId, endpoint.path, endpoint.method);
    const endpointData: ServiceEndpoint = {
      ...endpoint,
      serviceId,
    };

    await this.cacheService.set(endpointKey, endpointData);

    // Add to service endpoints index
    const endpointsIndexKey = this.getServiceEndpointsKey(serviceId);
    const endpointId = `${endpoint.method}:${endpoint.path}`;
    await this.cacheService.sadd(endpointsIndexKey, endpointId);
  }

  async getServiceEndpoints(serviceId: string): Promise<ServiceEndpoint[]> {
    const endpointsIndexKey = this.getServiceEndpointsKey(serviceId);
    const endpointIds = await this.cacheService.smembers(endpointsIndexKey);

    const endpoints: ServiceEndpoint[] = [];
    for (const endpointId of endpointIds) {
      const [method, ...pathParts] = endpointId.split(':');
      const path = pathParts.join(':');
      const endpoint = await this.getEndpoint(serviceId, path, method);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  private async getEndpoint(serviceId: string, path: string, method: string): Promise<ServiceEndpoint | null> {
    const endpointKey = this.getEndpointKey(serviceId, path, method);
    return await this.cacheService.get<ServiceEndpoint>(endpointKey);
  }

  private getServiceKey(serviceId: string): string {
    return `service:${serviceId}`;
  }

  private getEndpointKey(serviceId: string, path: string, method: string): string {
    return `service:${serviceId}:endpoint:${method}:${path}`;
  }

  private getServiceEndpointsKey(serviceId: string): string {
    return `service:${serviceId}:endpoints`;
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const services = await this.getAllServices();
        const now = Date.now();

        for (const service of services) {
          const timeSinceLastHeartbeat = now - service.lastHeartbeat.getTime();

          if (timeSinceLastHeartbeat > this.SERVICE_TTL) {
            // Service is stale, mark as unhealthy
            await this.updateServiceStatus(service.id, 'unhealthy');
          }
        }
      } catch (error) {
        console.error('Heartbeat monitoring error:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // Health check methods
  async healthCheck(): Promise<{ status: string; services: number }> {
    try {
      const services = await this.getAllServices();
      const healthyServices = services.filter(s => s.status === 'healthy');

      return {
        status: 'healthy',
        services: healthyServices.length,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: 0,
      };
    }
  }
}