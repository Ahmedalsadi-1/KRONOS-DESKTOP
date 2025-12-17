const express = require('express');

// KRONOS Enhanced Service Registry with Health Monitoring & Load Balancing
class KronosServiceRegistry {
  constructor(port = 8080) {
    this.port = port;
    this.app = express();
    this.services = new Map();
    this.healthChecks = new Map();
    this.loadBalancers = new Map();
    this.requestCounts = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupHealthMonitoring();
    this.setupLoadBalancing();
    this.loadInitialServices();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '1mb' }));

    // Request logging with correlation IDs
    this.app.use((req, res, next) => {
      const correlationId = req.headers['x-correlation-id'] ||
                           req.headers['x-request-id'] ||
                           `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      req.correlationId = correlationId;
      res.setHeader('x-correlation-id', correlationId);

      console.log(`${new Date().toISOString()} - ${req.method} ${req.path} [${correlationId}]`);
      next();
    });
  }

  setupRoutes() {
    // Enhanced service registration with metadata
    this.app.post('/services', (req, res) => {
      const { name, type, endpoint, metadata = {}, healthCheck } = req.body;

      if (!name || !type || !endpoint) {
        return res.status(400).json({
          error: 'Missing required fields: name, type, endpoint',
          correlationId: req.correlationId
        });
      }

      const serviceId = `svc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const service = {
        id: serviceId,
        name,
        type,
        endpoint,
        metadata,
        healthCheck,
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        status: 'healthy',
        version: metadata.version || '1.0.0',
        loadFactor: 0,
        requestCount: 0
      };

      this.services.set(serviceId, service);

      // Setup health monitoring if health check is provided
      if (healthCheck) {
        this.setupHealthCheck(serviceId, service);
      }

      // Setup load balancing for this service type
      this.updateLoadBalancer(name, service);

      console.log(`Service registered: ${serviceId} (${name})`);

      res.status(201).json({
        serviceId,
        message: 'Service registered successfully',
        correlationId: req.correlationId
      });
    });

    // Enhanced service discovery with load balancing
    this.app.get('/services/:name', (req, res) => {
      const { name } = req.params;
      const { strategy = 'round-robin' } = req.query;

      const balancer = this.loadBalancers.get(name);
      if (!balancer || balancer.instances.length === 0) {
        return res.status(404).json({
          error: 'No healthy services available',
          service: name,
          correlationId: req.correlationId
        });
      }

      const service = this.selectService(balancer, strategy);
      if (!service) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          service: name,
          correlationId: req.correlationId
        });
      }

      // Update request count for load balancing
      service.requestCount++;

      console.log(`Service discovered: ${name} -> ${service.endpoint} [${strategy}]`);

      res.json({
        service: {
          id: service.id,
          name: service.name,
          endpoint: service.endpoint,
          version: service.version,
          metadata: service.metadata
        },
        correlationId: req.correlationId
      });
    });

    // Service heartbeat with enhanced monitoring
    this.app.post('/services/:serviceId/heartbeat', (req, res) => {
      const { serviceId } = req.params;
      const { metrics } = req.body;

      const service = this.services.get(serviceId);
      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          correlationId: req.correlationId
        });
      }

      service.lastHeartbeat = new Date();
      service.status = 'healthy';

      // Update metrics if provided
      if (metrics) {
        service.loadFactor = metrics.loadFactor || service.loadFactor;
        service.metadata = { ...service.metadata, metrics };
      }

      // Update load balancer
      this.updateLoadBalancer(service.name, service);

      res.json({
        message: 'Heartbeat received',
        timestamp: service.lastHeartbeat,
        correlationId: req.correlationId
      });
    });

    // Unregister service with cleanup
    this.app.delete('/services/:serviceId', (req, res) => {
      const { serviceId } = req.params;

      const service = this.services.get(serviceId);
      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          correlationId: req.correlationId
        });
      }

      // Remove from services
      this.services.delete(serviceId);

      // Remove from load balancer
      this.removeFromLoadBalancer(service.name, serviceId);

      // Clear health check
      if (this.healthChecks.has(serviceId)) {
        clearInterval(this.healthChecks.get(serviceId));
        this.healthChecks.delete(serviceId);
      }

      console.log(`Service unregistered: ${serviceId} (${service.name})`);

      res.json({
        message: 'Service unregistered successfully',
        correlationId: req.correlationId
      });
    });

    // Get all services with health status
    this.app.get('/services', (req, res) => {
      const services = Array.from(this.services.values()).map(service => ({
        id: service.id,
        name: service.name,
        type: service.type,
        endpoint: service.endpoint,
        status: service.status,
        version: service.version,
        loadFactor: service.loadFactor,
        requestCount: service.requestCount,
        lastHeartbeat: service.lastHeartbeat,
        registeredAt: service.registeredAt
      }));

      const summary = {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        unhealthy: services.filter(s => s.status === 'unhealthy').length,
        byType: {}
      };

      // Group by type
      services.forEach(service => {
        summary.byType[service.type] = (summary.byType[service.type] || 0) + 1;
      });

      res.json({
        services,
        summary,
        correlationId: req.correlationId
      });
    });

    // Load balancer status
    this.app.get('/load-balancers', (req, res) => {
      const balancers = {};
      for (const [name, balancer] of this.loadBalancers) {
        balancers[name] = {
          instanceCount: balancer.instances.length,
          healthyCount: balancer.instances.filter(s => s.status === 'healthy').length,
          totalRequests: balancer.instances.reduce((sum, s) => sum + s.requestCount, 0),
          strategy: balancer.strategy
        };
      }

      res.json({
        loadBalancers: balancers,
        correlationId: req.correlationId
      });
    });

    // Health check endpoint with detailed status
    this.app.get('/health', (req, res) => {
      const services = Array.from(this.services.values());
      const healthyServices = services.filter(s => s.status === 'healthy').length;

      const health = {
        status: healthyServices === services.length ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          total: services.length,
          healthy: healthyServices,
          unhealthy: services.length - healthyServices
        },
        loadBalancers: this.loadBalancers.size,
        healthChecks: this.healthChecks.size,
        uptime: process.uptime(),
        correlationId: req.correlationId
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Service mesh configuration endpoint
    this.app.get('/mesh-config', (req, res) => {
      const meshConfig = {
        services: Array.from(this.services.values()).map(service => ({
          name: service.name,
          endpoints: [service.endpoint],
          healthCheck: service.healthCheck,
          metadata: service.metadata
        })),
        loadBalancers: Array.from(this.loadBalancers.entries()).map(([name, balancer]) => ({
          service: name,
          strategy: balancer.strategy,
          instances: balancer.instances.length
        }))
      };

      res.json({
        meshConfig,
        correlationId: req.correlationId
      });
    });
  }

  setupHealthMonitoring() {
    // Comprehensive health monitoring system
    setInterval(async () => {
      console.log('🔍 Running health checks...');

      for (const [serviceId, service] of this.services) {
        try {
          if (service.healthCheck && service.status !== 'unhealthy') {
            const isHealthy = await this.performHealthCheck(service);

            if (!isHealthy) {
              service.status = 'unhealthy';
              console.log(`❌ Service unhealthy: ${service.name} (${serviceId})`);
            }
          } else {
            // Check heartbeat age for services without explicit health checks
            const timeSinceHeartbeat = Date.now() - service.lastHeartbeat.getTime();
            if (timeSinceHeartbeat > 60000) { // 1 minute
              service.status = 'unhealthy';
              console.log(`⏰ Heartbeat expired: ${service.name} (${timeSinceHeartbeat}ms ago)`);
            }
          }

          // Update load balancer with health status
          this.updateLoadBalancer(service.name, service);

        } catch (error) {
          service.status = 'unhealthy';
          console.error(`Health check error for ${service.name}:`, error.message);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  async performHealthCheck(service) {
    try {
      const response = await fetch(service.healthCheck.endpoint || `${service.endpoint}/health`, {
        timeout: service.healthCheck.timeout || 5000,
        headers: service.healthCheck.headers || {}
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  setupLoadBalancing() {
    // Initialize load balancers for core services
    const coreServices = ['kronos-api-gateway', 'kronos-service-registry', 'kronos-config-service'];

    coreServices.forEach(serviceName => {
      this.loadBalancers.set(serviceName, {
        instances: [],
        currentIndex: 0,
        strategy: 'round-robin'
      });
    });

    console.log(`⚖️ Load balancing initialized for ${coreServices.length} core services`);
  }

  updateLoadBalancer(serviceName, service) {
    if (!this.loadBalancers.has(serviceName)) {
      this.loadBalancers.set(serviceName, {
        instances: [],
        currentIndex: 0,
        strategy: 'round-robin'
      });
    }

    const balancer = this.loadBalancers.get(serviceName);
    const existingIndex = balancer.instances.findIndex(s => s.id === service.id);

    if (existingIndex >= 0) {
      balancer.instances[existingIndex] = service;
    } else {
      balancer.instances.push(service);
    }

    // Remove unhealthy instances
    balancer.instances = balancer.instances.filter(s => s.status === 'healthy');
  }

  removeFromLoadBalancer(serviceName, serviceId) {
    const balancer = this.loadBalancers.get(serviceName);
    if (balancer) {
      balancer.instances = balancer.instances.filter(s => s.id !== serviceId);
    }
  }

  selectService(balancer, strategy) {
    if (balancer.instances.length === 0) return null;

    const healthyInstances = balancer.instances.filter(s => s.status === 'healthy');
    if (healthyInstances.length === 0) return null;

    switch (strategy) {
      case 'least-loaded':
        return healthyInstances.reduce((min, current) =>
          current.loadFactor < min.loadFactor ? current : min
        );

      case 'random':
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];

      case 'round-robin':
      default:
        const instance = healthyInstances[balancer.currentIndex % healthyInstances.length];
        balancer.currentIndex = (balancer.currentIndex + 1) % healthyInstances.length;
        return instance;
    }
  }

  setupHealthCheck(serviceId, service) {
    if (!service.healthCheck) return;

    const interval = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck(service);

        if (isHealthy && service.status !== 'healthy') {
          service.status = 'healthy';
          console.log(`✅ Service recovered: ${service.name}`);
        } else if (!isHealthy && service.status === 'healthy') {
          service.status = 'unhealthy';
          console.log(`❌ Service became unhealthy: ${service.name}`);
        }

        service.lastHeartbeat = new Date();
        this.updateLoadBalancer(service.name, service);

      } catch (error) {
        service.status = 'unhealthy';
        console.error(`Health check failed for ${service.name}:`, error.message);
      }
    }, service.healthCheck.interval || 30000);

    this.healthChecks.set(serviceId, interval);
  }

  loadInitialServices() {
    // Load core KRONOS services
    const coreServices = [
      {
        id: 'kronos-service-registry',
        name: 'kronos-service-registry',
        type: 'infrastructure',
        endpoint: `http://localhost:${this.port}`,
        status: 'healthy',
        metadata: { core: true, version: '1.0.0' }
      },
      {
        id: 'kronos-api-gateway',
        name: 'kronos-api-gateway',
        type: 'infrastructure',
        endpoint: 'http://localhost:3000',
        status: 'healthy',
        metadata: { core: true, version: '1.0.0' }
      },
      {
        id: 'kronos-config-service',
        name: 'kronos-config-service',
        type: 'infrastructure',
        endpoint: 'http://localhost:4000',
        status: 'healthy',
        metadata: { core: true, version: '1.0.0' }
      }
    ];

    coreServices.forEach(service => {
      this.services.set(service.id, {
        ...service,
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        loadFactor: 0,
        requestCount: 0
      });

      this.updateLoadBalancer(service.name, this.services.get(service.id));
    });

    console.log(`📦 Loaded ${coreServices.length} core services`);
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🔍 KRONOS Enhanced Service Registry running on port ${this.port}`);
      console.log(`📊 Health monitoring active - checking every 30 seconds`);
      console.log(`⚖️ Load balancing enabled for ${this.loadBalancers.size} services`);
      console.log(`🌐 Ready at http://localhost:${this.port}`);
      console.log(`🔗 Service mesh configuration available at /mesh-config`);
    });
  }
}

// Start the enhanced service registry
const registry = new KronosServiceRegistry(8080);
registry.start();

module.exports = KronosServiceRegistry;