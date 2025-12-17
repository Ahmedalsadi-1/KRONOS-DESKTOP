import express from 'express';

// Simple service registry for KRONOS platform
interface ServiceInfo {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy';
}

class KronosServiceRegistry {
  private app: express.Application;
  private services: Map<string, ServiceInfo> = new Map();

  constructor(private port: number = 8080) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Register service
    this.app.post('/services', (req, res) => {
      const { name, type, endpoint } = req.body;
      const id = Date.now().toString();

      const service: ServiceInfo = {
        id,
        name,
        type,
        endpoint,
        status: 'healthy'
      };

      this.services.set(id, service);
      res.json({ id, message: 'Service registered' });
    });

    // Get all services
    this.app.get('/services', (req, res) => {
      const services = Array.from(this.services.values());
      res.json({ services, count: services.length });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        services: this.services.size,
        timestamp: new Date().toISOString()
      });
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      console.log(`KRONOS Service Registry running on port ${this.port}`);
    });
  }
}

// Start the registry
const registry = new KronosServiceRegistry();
registry.start();
      try {
        const { serviceId } = req.params;

        if (this.services.has(serviceId)) {
          this.services.delete(serviceId);
          await this.redis.del(`service:${serviceId}`);

          this.logger.info('Service unregistered', { serviceId });
          res.json({ message: 'Service unregistered successfully' });
        } else {
          res.status(404).json({ error: 'Service not found' });
        }
      } catch (error) {
        this.logger.error('Service unregistration failed', { error });
        res.status(500).json({ error: 'Unregistration failed' });
      }
    });

    // Get all services
    this.app.get('/services', async (req: Request, res: Response) => {
      try {
        const services = Array.from(this.services.values());
        res.json({
          services,
          count: services.length
        });
      } catch (error) {
        this.logger.error('Failed to retrieve services', { error });
        res.status(500).json({ error: 'Failed to retrieve services' });
      }
    });

    // Get service by ID
    this.app.get('/services/:serviceId', (req, res) => {
      const { serviceId } = req.params;
      const service = this.services.get(serviceId);

      if (service) {
        res.json(service);
      } else {
        res.status(404).json({ error: 'Service not found' });
      }
    });

    // Get services by type
    this.app.get('/services/type/:type', (req, res) => {
      const { type } = req.params;
      const services = Array.from(this.services.values())
        .filter(service => service.type === type);

      res.json({
        services,
        count: services.length
      });
    });

    // Service heartbeat
    this.app.post('/services/:serviceId/heartbeat', (req, res) => {
      const { serviceId } = req.params;
      const service = this.services.get(serviceId);

      if (service) {
        service.lastHeartbeat = new Date();
        service.status = 'healthy';
        this.services.set(serviceId, service);

        res.json({ message: 'Heartbeat received' });
      } else {
        res.status(404).json({ error: 'Service not found' });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const totalServices = this.services.size;
      const healthyServices = Array.from(this.services.values())
        .filter(service => service.status === 'healthy').length;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          total: totalServices,
          healthy: healthyServices,
          unhealthy: totalServices - healthyServices
        }
      });
    });
  }

  private setupHealthChecks(): void {
    // Run health checks every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      this.logger.debug('Running health checks');

      for (const [serviceId, service] of this.services) {
        try {
          if (service.healthEndpoint) {
            const response = await fetch(service.healthEndpoint, {
              timeout: 5000 // 5 second timeout
            });

            if (response.ok) {
              service.status = 'healthy';
            } else {
              service.status = 'unhealthy';
            }
          } else {
            // If no health endpoint, check if service responded recently
            const timeSinceLastHeartbeat = Date.now() - service.lastHeartbeat.getTime();
            if (timeSinceLastHeartbeat > 60000) { // 1 minute
              service.status = 'unhealthy';
            }
          }

          service.lastHeartbeat = new Date();
          this.services.set(serviceId, service);
        } catch (error) {
          service.status = 'unhealthy';
          this.services.set(serviceId, service);
          this.logger.warn('Health check failed', { serviceId, serviceName: service.name, error });
        }
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');

      // Load existing services from Redis on startup
      await this.loadServicesFromRedis();

      this.app.listen(this.port, () => {
        this.logger.info(`KRONOS Service Registry listening on port ${this.port}`);
      });
    } catch (error) {
      this.logger.error('Failed to start service registry', { error });
      throw error;
    }
  }

  private async loadServicesFromRedis(): Promise<void> {
    try {
      const keys = await this.redis.keys('service:*');
      for (const key of keys) {
        const serviceData = await this.redis.get(key);
        if (serviceData) {
          const service: ServiceInstance = JSON.parse(serviceData);
          this.services.set(service.id, service);
        }
      }
      this.logger.info(`Loaded ${this.services.size} services from Redis`);
    } catch (error) {
      this.logger.error('Failed to load services from Redis', { error });
    }
  }

  async stop(): Promise<void> {
    await this.redis.disconnect();
    this.logger.info('Service registry stopped');
  }
}

// Start the service registry
if (require.main === module) {
  const registry = new ServiceRegistry();
  registry.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    registry.stop().then(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    registry.stop().then(() => process.exit(0));
  });
}

export default ServiceRegistry;