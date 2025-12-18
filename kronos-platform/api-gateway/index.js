const express = require('express');

// KRONOS API Gateway - Unified entry point for all platform services
class KronosAPIGateway {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.routes = [];
    this.services = new Map();
    this.requestCounts = new Map();

    this.setupMiddleware();
    this.loadRoutes();
    this.setupServiceDiscovery();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  loadRoutes() {
    // KRONOS Platform Routes
    this.routes = [
      // Service Registry Routes (bypass auth)
      {
        path: '/api/v1/services',
        method: 'GET',
        targetService: 'service-registry',
        authRequired: false
      },
      {
        path: '/health',
        method: 'GET',
        targetService: 'service-registry',
        authRequired: false
      },

      // Desktop Agent Routes
      {
        path: '/api/v1/desktop/:action',
        method: 'POST',
        targetService: 'kronos-desktop-agent',
        authRequired: true,
        rateLimit: { windowMs: 60 * 1000, max: 60 }
      },

      // Web Automation Routes
      {
        path: '/api/v1/web/automate',
        method: 'POST',
        targetService: 'kronos-web-automation',
        authRequired: true,
        rateLimit: { windowMs: 60 * 1000, max: 30 }
      },

      // Workflow Routes
      {
        path: '/api/v1/workflows',
        method: 'GET',
        targetService: 'kronos-workflow-studio',
        authRequired: true
      },
      {
        path: '/api/v1/workflows',
        method: 'POST',
        targetService: 'kronos-workflow-studio',
        authRequired: true,
        rateLimit: { windowMs: 60 * 1000, max: 20 }
      },

      // AI Services Routes
      {
        path: '/api/v1/ai/generate',
        method: 'POST',
        targetService: 'kronos-unified-ai',
        authRequired: true,
        rateLimit: { windowMs: 60 * 1000, max: 50 }
      }
    ];

    this.setupRouteHandlers();
  }

  setupRouteHandlers() {
    this.routes.forEach(route => {
      this.app[route.method.toLowerCase()](
        route.path,
        (req, res, next) => this.rateLimit(route, req, res, next),
        (req, res, next) => this.authenticate(route, req, res, next),
        (req, res) => this.routeHandler(route, req, res)
      );
    });
  }

  rateLimit(route, req, res, next) {
    if (!route.rateLimit) return next();

    const key = `${req.ip}-${route.path}`;
    const now = Date.now();
    const window = route.rateLimit.windowMs;
    const max = route.rateLimit.max;

    const current = this.requestCounts.get(key);
    if (!current || now > current.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + window });
      return next();
    }

    if (current.count >= max) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }

    current.count++;
    next();
  }

  authenticate(route, req, res, next) {
    if (!route.authRequired) return next();

    // Simple API key authentication for now
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    if (!apiKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement proper authentication
    next();
  }

  routeHandler(route, req, res) {
    try {
      const service = this.services.get(route.targetService);

      if (!service || service.status !== 'healthy') {
        return res.status(503).json({
          error: 'Service unavailable',
          service: route.targetService
        });
      }

      // Mock response for now - TODO: Implement actual service forwarding
      const mockResponse = {
        service: route.targetService,
        endpoint: service.endpoint,
        action: req.params.action || req.method,
        status: 'processed',
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substr(2, 9)
      };

      res.json(mockResponse);

    } catch (error) {
      console.error('Route handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  setupServiceDiscovery() {
    // Set up mock services for development
    this.services.set('service-registry', {
      id: '1',
      name: 'service-registry',
      type: 'infrastructure',
      endpoint: 'http://localhost:8080',
      status: 'healthy'
    });

    this.services.set('kronos-desktop-agent', {
      id: '2',
      name: 'kronos-desktop-agent',
      type: 'automation',
      endpoint: 'http://localhost:9990',
      status: 'healthy'
    });

    this.services.set('kronos-web-automation', {
      id: '3',
      name: 'kronos-web-automation',
      type: 'automation',
      endpoint: 'http://localhost:3001',
      status: 'healthy'
    });

    this.services.set('kronos-workflow-studio', {
      id: '4',
      name: 'kronos-workflow-studio',
      type: 'workflow',
      endpoint: 'http://localhost:3002',
      status: 'healthy'
    });

    this.services.set('kronos-unified-ai', {
      id: '5',
      name: 'kronos-unified-ai',
      type: 'ai',
      endpoint: 'http://localhost:3003',
      status: 'healthy'
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 KRONOS API Gateway running on port ${this.port}`);
      console.log(`📋 Registered ${this.routes.length} routes`);
      console.log(`🔗 Connected to ${this.services.size} services`);
      console.log(`🌐 Ready to handle requests at http://localhost:${this.port}`);
    });
  }
}

// Start the API Gateway
const gateway = new KronosAPIGateway(3000);
gateway.start();

module.exports = KronosAPIGateway;