const express = require('express');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { v1_1_0 } = require('@opentelemetry/exporters-jaeger');
const { Resource } = require('@opentelemetry/resources');

// KRONOS API Gateway with OpenTelemetry instrumentation
class KronosAPIGatewayWithTracing {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.routes = [];
    this.services = new Map();
    this.requestCounts = new Map();
    
    // Initialize OpenTelemetry
    this.initializeTracing();
    
    this.setupMiddleware();
    this.loadRoutes();
    this.setupServiceDiscovery();
    this.setupBrowserCapabilities();
  }

  initializeTracing() {
    const serviceName = 'kronos-api-gateway';
    const serviceVersion = '1.0.0';
    
    // Configure trace provider
    const traceProvider = new NodeSDK.NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `api-gateway-${process.env.HOSTNAME || 'unknown'}`,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        'service.namespace': 'kronos',
        'platform.version': '1.0.0'
      }),
      exporters: [
        // Jaeger exporter
        new v1_1_0.JaegerExporter({
          endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14250',
        serviceName: serviceName,
          serviceVersion: serviceVersion
        }),
        
        // OTLP HTTP exporter for redundancy
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
          headers: {
            'x-service-name': serviceName,
            'x-service-version': serviceVersion
          }
        })
      ],
      spanProcessors: [
        new BatchSpanProcessor(new SimpleSpanProcessor())
      ]
    });

    // Register the trace provider
    const { trace } = NodeSDK.trace;
    trace.setGlobalTracerProvider(traceProvider);
    
    this.tracer = trace.getTracer(serviceName, serviceVersion);
    console.log('🔍 OpenTelemetry initialized for API Gateway');
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Enhanced request middleware with distributed tracing
    this.app.use((req, res, next) => {
      // Start span for incoming request
      const span = this.tracer.startSpan(`${req.method} ${req.path}`, {
        kind: NodeSDK.SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.path,
          'http.user_agent': req.headers['user-agent'] || 'unknown',
          'client.ip': req.ip || 'unknown'
        }
      });

      // Add correlation ID if not present
      const correlationId = req.headers['x-correlation-id'] || 
                        req.headers['x-request-id'] ||
                        this.generateCorrelationId();
      
      span.setAttributes({
        'correlation.id': correlationId,
        'service.cluster': 'kronos-platform'
      });

      // Inject span context into request
      req.traceId = span.spanContext().traceId;
      req.spanId = span.spanContext().spanId;
      req.correlationId = correlationId;

      console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${correlationId}`);
      
      // Enhanced response with tracing headers
      const originalResJson = res.json;
      const originalResStatus = res.status;
      
      res.setHeader('x-trace-id', span.spanContext().traceId);
      res.setHeader('x-span-id', span.spanContext().spanId);
      res.setHeader('x-correlation-id', correlationId);
      res.setHeader('x-service-name', 'kronos-api-gateway');
      
      next();
    });
  }

  generateCorrelationId() {
    return `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  loadRoutes() {
    // Enhanced routes with tracing
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
         rateLimit: { windowMs: 60 * 1000, max: 60 },
         tracing: {
           sampling: 0.1, // 10% sampling for desktop operations
           attributes: {
             'service.type': 'automation',
             'service.priority': 'medium'
           }
         }
       },
       {
         path: '/api/v1/desktop/task',
         method: 'POST',
         targetService: 'kronos-desktop-agent',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 30 },
         tracing: {
           sampling: 0.25, // 25% sampling for tasks
           attributes: {
             'service.type': 'automation',
             'service.priority': 'low'
           }
         }
       },
       {
         path: '/api/v1/desktop/screenshot',
         method: 'GET',
         targetService: 'kronos-desktop-agent',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 20 },
         tracing: {
           sampling: 0.5, // 50% sampling for screenshots
           attributes: {
             'service.type': 'automation',
             'operation.type': 'screenshot'
           }
         }
       },
       {
         path: '/api/v1/desktop/vnc',
         method: 'GET',
         targetService: 'kronos-desktop-agent',
         authRequired: true,
         tracing: {
           sampling: 0.3 // 30% sampling for VNC
         }
       },
      
       // Web Automation Routes
       {
         path: '/api/v1/web/automate',
         method: 'POST',
         targetService: 'kronos-web-automation',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 30 },
         tracing: {
           sampling: 0.15, // 15% sampling for web automation
           attributes: {
             'service.type': 'automation',
             'service.priority': 'medium'
           }
         }
       },
       {
         path: '/api/v1/ui/analyze',
         method: 'POST',
         targetService: 'kronos-ui-automation',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 20 },
         tracing: {
           sampling: 0.1, // 10% sampling for UI analysis (expensive)
           attributes: {
             'service.type': 'vision-automation',
             'service.priority': 'high'
           }
         }
       },
       {
         path: '/api/v1/ui/action',
         method: 'POST',
         targetService: 'kronos-ui-automation',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 30 },
         tracing: {
           sampling: 0.15 // 15% sampling for UI actions
         }
       },
       {
         path: '/api/v1/ui/screenshot',
         method: 'POST',
         targetService: 'kronos-ui-automation',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 15 },
         tracing: {
           sampling: 0.2, // 20% sampling for screenshots
           attributes: {
             'service.type': 'vision-automation',
             'operation.type': 'screenshot'
           }
         }
       },
       {
         path: '/api/v1/ui/task',
         method: 'POST',
         targetService: 'kronos-ui-automation',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 25 },
         tracing: {
           sampling: 0.1 // 10% sampling for tasks
         }
       },
      
       // Browser Automation Routes - KRONOS Web Automation Integration
       {
         path: '/api/v1/browser/chat',
         method: 'POST',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 100 },
         tracing: {
           sampling: 0.2, // 20% sampling for chat operations
           attributes: {
             'service.type': 'browser-automation',
             'operation.type': 'chat',
             'service.priority': 'medium'
           }
         }
       },
       {
         path: '/api/v1/browser/:chatId',
         method: 'GET',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         tracing: {
           sampling: 0.1 // 10% sampling for browser operations
         }
       },
       {
         path: '/api/v1/browser/vm/control',
         method: 'POST',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 50 },
         tracing: {
           sampling: 0.05, // 5% sampling for VM control (critical path)
           attributes: {
             'service.type': 'browser-automation',
             'operation.type': 'vm-control',
             'service.priority': 'high'
           }
         }
       },
       {
         path: '/api/v1/browser/screenshot',
         method: 'POST',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 20 },
         tracing: {
           sampling: 0.15 // 15% sampling for screenshots
           attributes: {
             'service.type': 'browser-automation',
             'operation.type': 'screenshot'
           }
         }
       },
       {
         path: '/api/v1/browser/search',
         method: 'POST',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 30 },
         tracing: {
           sampling: 0.1 // 10% sampling for search
           attributes: {
             'service.type': 'browser-automation',
             'operation.type': 'search'
           }
         }
       },
       {
         path: '/api/v1/browser/billing/credits',
         method: 'GET',
         targetService: 'kronos-browser-automation-backend',
         authRequired: true,
         tracing: {
           sampling: 0.05 // 5% sampling for billing queries
         }
       },
      
       // Workflow Routes
       {
         path: '/api/v1/workflows',
         method: 'GET',
         targetService: 'kronos-workflow-studio',
         authRequired: true,
         tracing: {
           sampling: 0.05 // 5% sampling for workflow queries
           attributes: {
             'service.type': 'workflow',
             'service.priority': 'low'
           }
         }
       },
       {
         path: '/api/v1/workflows',
         method: 'POST',
         targetService: 'kronos-workflow-studio',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 20 },
         tracing: {
           sampling: 0.02, // 2% sampling for workflow execution
           attributes: {
             'service.type': 'workflow',
             'service.priority': 'critical'
           }
         }
       },
      
       // AI Services Routes
       {
         path: '/api/v1/ai/generate',
         method: 'POST',
         targetService: 'kronos-unified-ai',
         authRequired: true,
         rateLimit: { windowMs: 60 * 1000, max: 50 },
         tracing: {
           sampling: 0.01, // 1% sampling for AI generation
           attributes: {
             'service.type': 'ai',
             'service.priority': 'high'
           }
         }
       }
     ];

    this.setupRouteHandlers();
  }

  setupRouteHandlers() {
    this.routes.forEach(route => {
      this.app[route.method.toLowerCase()](
        route.path,
        (req, res, next) => this.createTracedRoute(route, req, res, next),
        (req, res) => this.routeHandler(route, req, res)
      );
    });
  }

  createTracedRoute(route, req, res, next) {
    return async (req, res, next) => {
      const correlationId = req.correlationId || this.generateCorrelationId();
      
      // Continue existing span for rate limiting
      let span;
      if (req.traceId && req.spanId) {
        span = this.tracer.startSpan(route.targetService || 'api-gateway', {
          kind: NodeSDK.SpanKind.INTERNAL,
          attributes: {
            'operation.name': route.path,
            'service.target': route.targetService,
            'correlation.id': correlationId
          }
        });
      }

      // Rate limiting with tracing
      const rateLimitResult = this.rateLimitWithTracing(route, req, res, span);
      if (rateLimitResult.limited) {
        if (span) span.setAttributes({
          'rate.limit.exceeded': true,
          'rate.limit.reset_after': rateLimitResult.resetAfter
        });
        return;
      }

      // Authentication with tracing
      const authResult = this.authenticateWithTracing(route, req, res, span);
      if (authResult.authenticated === false) {
        if (span) span.setAttributes({
          'auth.failed': true,
          'auth.reason': authResult.reason
        });
        return;
      }

      next();
    };
  }

  rateLimitWithTracing(route, req, res, next, parentSpan) {
    if (!route.rateLimit) return { limited: false };
    
    const key = `${req.ip}-${route.path}`;
    const now = Date.now();
    const window = route.rateLimit.windowMs;
    const max = route.rateLimit.max;
    
    const current = this.requestCounts.get(key);
    if (!current || now > current.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + window });
      if (parentSpan) parentSpan.setAttributes({
        'rate.limit.bucket': 'new',
        'rate.limit.count': 1
      });
      return { limited: false };
    }

    if (current.count >= max) {
      if (parentSpan) parentSpan.setAttributes({
        'rate.limit.exceeded': true,
        'rate.limit.current': current.count,
        'rate.limit.max': max,
        'rate.limit.reset_after': Math.ceil((current.resetTime - now) / 1000)
      });
      
      return {
        limited: true,
        resetAfter: Math.ceil((current.resetTime - now) / 1000)
      };
    }

    current.count++;
    if (parentSpan) parentSpan.setAttributes({
      'rate.limit.current': current.count,
      'rate.limit.bucket_age': Math.floor((now - (current.resetTime - window)) / 1000)
    });
    
    return { limited: false };
  }

  authenticateWithTracing(route, req, res, parentSpan) {
    if (!route.authRequired) return { authenticated: true };
    
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    if (!apiKey) {
      if (parentSpan) parentSpan.setAttributes({
        'auth.failed': true,
        'auth.reason': 'missing_api_key'
      });
      return { authenticated: false, reason: 'missing_api_key' };
    }

    // TODO: Implement proper JWT validation with tracing
    if (parentSpan) parentSpan.setAttributes({
      'auth.success': true,
      'auth.method': 'api_key'
    });
    
    return { authenticated: true };
  }

  routeHandler(route, req, res) {
    try {
      const span = this.tracer.startSpan(`route:${route.targetService}`, {
        kind: NodeSDK.SpanKind.INTERNAL,
        attributes: {
          'route.path': route.path,
          'service.target': route.targetService,
          'correlation.id': req.correlationId,
          'http.method': req.method
        }
      });

      const service = this.services.get(route.targetService);
      
      if (!service || service.status !== 'healthy') {
        span.setAttributes({
          'service.unavailable': true,
          'service.name': route.targetService
        });
        span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        span.recordException(new Error(`Service unavailable: ${route.targetService}`));
        return res.status(503).json({
          error: 'Service unavailable',
          service: route.targetService,
          traceId: req.traceId,
          correlationId: req.correlationId
        });
      }

      // Add service call tracing
      const serviceCallSpan = this.tracer.startSpan(`service.call:${route.targetService}`, {
        kind: NodeSDK.SpanKind.CLIENT,
        attributes: {
          'service.name': service.name,
          'service.endpoint': service.endpoint,
          'service.type': service.type || 'unknown'
        }
      });

      // Mock response for now - TODO: Implement actual service forwarding with tracing
      const mockResponse = {
        service: route.targetService,
        endpoint: service.endpoint,
        action: req.params.action || req.method,
        status: 'processed',
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substr(2, 9),
        traceId: req.traceId,
        correlationId: req.correlationId
      };

      serviceCallSpan.setAttributes({
        'service.call.success': true,
        'service.call.duration_ms': Date.now() - serviceCallSpan.startTime
      });

      serviceCallSpan.end();

      span.setAttributes({
        'service.call.completed': true,
        'response.status': 'mock'
      });

      span.setStatus({ code: NodeSDK.SpanStatusCode.OK });
      span.end();

      res.json(mockResponse);

    } catch (error) {
      span.setAttributes({
        'route.handler.error': true,
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      console.error('Route handler error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        traceId: req.traceId,
        correlationId: req.correlationId
      });
    }
  }

  setupServiceDiscovery() {
    // Enhanced service discovery with tracing
    const services = [
      {
        id: '1',
        name: 'service-registry',
        type: 'infrastructure',
        endpoint: 'http://docker-kronos-service-registry-1:8080',
        status: 'healthy',
        tracing: {
          sampling: 0.05, // 5% sampling for infrastructure
          attributes: {
            'service.type': 'infrastructure',
            'service.priority': 'low'
          }
        }
      },
      {
        id: '2',
        name: 'kronos-config-service',
        type: 'configuration',
        endpoint: 'http://docker-kronos-config-service-1:4000',
        status: 'healthy',
        tracing: {
          sampling: 0.01 // 1% sampling for config service
        }
      },
      {
        id: '3',
        name: 'kronos-redis',
        type: 'cache',
        endpoint: 'redis://docker-kronos-redis-1:6379',
        status: 'healthy',
        tracing: {
          sampling: 0.0 // No sampling for cache
        }
      },
      {
        id: '4',
        name: 'kronos-desktop-agent',
        type: 'automation',
        endpoint: 'http://localhost:9990',
        status: 'healthy',
        tracing: {
          sampling: 0.25, // 25% sampling for desktop automation
          attributes: {
            'service.type': 'automation',
            'service.priority': 'medium'
          }
        }
      },
      {
        id: '5',
        name: 'kronos-web-automation',
        type: 'automation',
        endpoint: 'http://localhost:3001',
        status: 'healthy',
        tracing: {
          sampling: 0.15, // 15% sampling for web automation
          attributes: {
            'service.type': 'automation',
            'service.priority': 'medium'
          }
        }
      },
      {
        id: '6',
        name: 'kronos-workflow-studio',
        type: 'workflow',
        endpoint: 'http://localhost:3002',
        status: 'healthy',
        tracing: {
          sampling: 0.05, // 5% sampling for workflow studio
          attributes: {
            'service.type': 'workflow',
            'service.priority': 'low'
          }
        }
      },
      {
        id: '7',
        name: 'kronos-unified-ai',
        type: 'ai',
        endpoint: 'http://localhost:3003',
        status: 'healthy',
        tracing: {
          sampling: 0.01, // 1% sampling for AI generation
          attributes: {
            'service.type': 'ai',
            'service.priority': 'high'
          }
        }
      },
      {
        id: '8',
        name: 'kronos-browser-automation',
        type: 'automation',
        endpoint: 'http://localhost:3002',
        status: 'healthy',
        capabilities: ['web-scraping', 'browser-control', 'screenshot', 'form-filling'],
        browsers: ['chrome', 'firefox', 'edge'],
        tracing: {
          sampling: 0.2, // 20% sampling for browser automation
          attributes: {
            'service.type': 'automation',
            'service.priority': 'medium'
          }
        }
      },
      {
        id: '9',
        name: 'kronos-browser-automation-backend',
        type: 'automation-api',
        endpoint: 'http://localhost:8002',
        status: 'healthy',
        capabilities: ['chat-api', 'vm-control', 'screenshot-service', 'billing'],
        tracing: {
          sampling: 0.05, // 5% sampling for backend API
          attributes: {
            'service.type': 'automation-api',
            'service.priority': 'medium'
          }
        }
      },
      {
        id: '10',
        name: 'kronos-ui-automation',
        type: 'vision-automation',
        endpoint: 'http://localhost:8003',
        status: 'healthy',
        capabilities: ['vision-language', 'gui-interaction', 'screen-analysis', 'action-prediction', 'coordinate-mapping'],
        model: 'UI-TARS-1.5-7B',
        device: 'cpu',
        benchmarks: ['OSWorld-42.5%', 'ScreenSpot-V2-94.2%', 'AndroidWorld-64.2%'],
        tracing: {
          sampling: 0.1, // 10% sampling for UI automation
          attributes: {
            'service.type': 'vision-automation',
            'service.priority': 'high'
          }
        }
      }
    ];

    services.forEach(service => {
      this.services.set(service.name, service);
    });

    console.log(`🔗 Service discovery initialized with ${services.length} traced services`);
  }

  setupBrowserCapabilities() {
    // Browser capability detection with tracing
    this.browserCapabilities = {
      chrome: {
        version: '>=90',
        features: ['headless', 'extensions', 'stealth', 'proxy', 'user-agent-spoofing'],
        performance: 'high'
      },
      firefox: {
        version: '>=88',
        features: ['headless', 'extensions', 'stealth', 'proxy'],
        performance: 'medium'
      },
      edge: {
        version: '>=90',
        features: ['headless', 'extensions', 'stealth'],
        performance: 'high'
      }
    };

    console.log('🌐 Browser capability detection initialized with tracing');
  }

  // Enhanced route handler with distributed tracing and browser capability routing
  routeHandler(route, req, res) {
    try {
      const span = this.tracer.startSpan(`route.handler:${route.targetService}`, {
        kind: NodeSDK.SpanKind.INTERNAL,
        attributes: {
          'route.path': route.path,
          'service.target': route.targetService,
          'correlation.id': req.correlationId,
          'http.method': req.method,
          'trace.id': req.traceId,
          'span.id': req.spanId
        }
      });

      const service = this.services.get(route.targetService);
      
      if (!service || service.status !== 'healthy') {
        span.setAttributes({
          'service.unavailable': true,
          'service.name': route.targetService
        });
        span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
        span.recordException(new Error(`Service unavailable: ${route.targetService}`));
        return res.status(503).json({
          error: 'Service unavailable',
          service: route.targetService,
          traceId: req.traceId,
          correlationId: req.correlationId
        });
      }

      // Browser capability routing for automation services with tracing
      if (route.targetService.includes('browser-automation')) {
        const browserReq = this.detectBrowserRequirements(req);
        if (browserReq && !this.canHandleBrowserRequest(service, browserReq)) {
          const alternativeService = this.findAlternativeBrowserService(browserReq);
          if (alternativeService) {
            span.setAttributes({
              'service.routing': 'alternative',
              'alternative.service': alternativeService.name,
              'routing.reason': 'browser_capability_mismatch'
            });
            console.log(`🔄 Routing browser request to alternative service: ${alternativeService.name}`);
            return this.routeToServiceWithTracing(alternativeService, route, req, res, span);
          }
        }
      }

      // Service-to-service call with tracing
      return this.routeToServiceWithTracing(service, route, req, res, span);

    } catch (error) {
      span.setAttributes({
        'route.handler.error': true,
        'error.message': error.message
      });
      span.recordException(error);
      span.setStatus({ code: NodeSDK.SpanStatusCode.ERROR });
      span.end();
      
      console.error('Route handler error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        traceId: req.traceId,
        correlationId: req.correlationId
      });
    }
  }

  routeToServiceWithTracing(service, route, req, res, parentSpan) {
    const serviceCallSpan = this.tracer.startSpan(`service.proxy:${service.name}`, {
      kind: NodeSDK.SpanKind.CLIENT,
      attributes: {
        'service.name': service.name,
        'service.endpoint': service.endpoint,
        'service.type': service.type || 'unknown',
        'correlation.id': req.correlationId,
        'parent.trace.id': req.traceId,
        'parent.span.id': req.spanId
      }
    });

    // Enhanced service routing with browser capability headers and tracing
    const correlationId = req.correlationId || 
                     req.headers['x-request-id'] ||
                     `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const headers = {
      ...req.headers,
      'x-trace-id': req.traceId,
      'x-span-id': req.spanId,
      'x-correlation-id': correlationId,
      'x-service-name': service.name,
      'x-service-type': service.type,
      'x-gateway-route': route.path
    };

    if (service.capabilities) {
      headers['x-service-capabilities'] = service.capabilities.join(',');
    }
    if (service.browsers) {
      headers['x-supported-browsers'] = service.browsers.join(',');
    }

    // Mock response with enhanced tracing metadata
    const response = {
      service: service.name,
      endpoint: service.endpoint,
      action: req.params.action || req.method,
      status: 'routed',
      timestamp: new Date().toISOString(),
      correlationId,
      traceId: req.traceId,
      requestId: Math.random().toString(36).substr(2, 9)
    };

    serviceCallSpan.setAttributes({
      'service.call.success': true,
      'service.call.duration_ms': Date.now() - serviceCallSpan.startTime,
      'response.mock': true
    });

    serviceCallSpan.end();
    parentSpan.setAttributes({
      'service.proxy.completed': true,
      'service.target': service.name
    });

    res.setHeaders(headers);
    res.json(response);
  }

  start() {
    this.app.listen(this.port, () => {
      const span = this.tracer.startSpan('server.startup', {
        kind: NodeSDK.SpanKind.INTERNAL,
        attributes: {
          'server.port': this.port,
          'routes.count': this.routes.length,
          'services.count': this.services.size
        }
      });

      console.log(`🚀 KRONOS API Gateway with distributed tracing running on port ${this.port}`);
      console.log(`📋 Registered ${this.routes.length} traced routes`);
      console.log(`🔗 Connected to ${this.services.size} traced services`);
      console.log(`🌐 Ready to handle requests with distributed tracing at http://localhost:${this.port}`);
      console.log(`🔍 OpenTelemetry tracing initialized`);
      
      span.end();
    });
  }
}

// Start API Gateway with enhanced tracing
const gateway = new KronosAPIGatewayWithTracing(3000);
gateway.start();

module.exports = KronosAPIGatewayWithTracing;