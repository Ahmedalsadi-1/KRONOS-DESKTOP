/**
 * KRONOS Unified Platform - API Gateway
 * Single entry point for all KRONOS services with authentication, routing, and load balancing
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { ServiceRegistry } from '../service-discovery/src/registry';
import { ServiceInstance } from '../service-discovery/src/registry';

export interface GatewayConfig {
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
  services: {
    [serviceName: string]: {
      target: string;
      pathRewrite?: { [pattern: string]: string };
      authRequired?: boolean;
      rateLimit?: {
        requests: number;
        windowMs: number;
      };
    };
  };
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export class UnifiedAPIGateway {
  private app: express.Application;
  private serviceRegistry: ServiceRegistry;
  private config: GatewayConfig;
  private healthCheckInterval: NodeJS.Timeout;

  constructor(serviceRegistry: ServiceRegistry, config: GatewayConfig) {
    this.app = express();
    this.serviceRegistry = serviceRegistry;
    this.config = config;
    this.setupMiddleware();
    this.setupRoutes();
    this.startHealthChecks();
  }

  /**
   * Initialize the Express application with middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API Gateway] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  /**
   * Set up all API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.serviceRegistry.getStatistics()
      });
    });

    // Service discovery endpoints
    this.app.get('/api/services', async (req, res) => {
      try {
        const { type, name } = req.query;
        let services = this.serviceRegistry.getAllServices();

        // Filter by type if specified
        if (type) {
          services = services.filter(s => s.service.type === type);
        }

        // Filter by name if specified
        if (name) {
          services = services.filter(s => s.service.name === name);
        }

        res.json({
          services: services.map(s => ({
            id: s.service.id,
            name: s.service.name,
            type: s.service.type,
            status: s.service.status,
            health: s.health,
            endpoints: s.service.endpoints
          }))
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to retrieve services',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Service registration endpoint (admin only)
    this.app.post('/api/services/register', this.authenticate, this.authorize(['admin']), async (req, res) => {
      try {
        const serviceInfo = req.body;
        await this.serviceRegistry.registerService(serviceInfo);
        res.status(201).json({
          message: 'Service registered successfully',
          serviceId: serviceInfo.id
        });
      } catch (error) {
        res.status(400).json({
          error: 'Failed to register service',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Authentication endpoints
    this.app.post('/api/auth/login', this.authenticateUser);
    this.app.post('/api/auth/refresh', this.refreshToken);
    this.app.post('/api/auth/logout', this.authenticate, this.logout);

    // Proxy routes for each service
    this.setupServiceProxies();

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        message: `The requested route ${req.originalUrl} does not exist`
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[API Gateway] Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  /**
   * Set up proxy routes for all registered services
   */
  private setupServiceProxies(): void {
    // Get all services from registry and create proxies
    const services = this.serviceRegistry.getAllServices();
    
    services.forEach(serviceInstance => {
      const service = serviceInstance.service;
      const basePath = `/api/${service.type}/${service.name}`;
      
      // Create proxy middleware for this service
      const proxy = createProxyMiddleware({
        target: `${service.protocol}://${service.host}:${service.port}`,
        changeOrigin: true,
        pathRewrite: {
          [`^${basePath}`]: '/', // Remove the base path when forwarding
        },
        timeout: service.endpoints.find(e => e.path === '/health')?.timeout || 30000,
        onError: (err, req, res) => {
          console.error(`[API Gateway] Proxy error for ${service.name}:`, err);
          if (!res.headersSent) {
            res.status(503).json({
              error: 'Service unavailable',
              message: `Service ${service.name} is currently unavailable`
            });
          }
        },
        onProxyReq: (proxyReq, req, res) => {
          // Add authentication headers if user is authenticated
          const user = (req as any).user;
          if (user) {
            proxyReq.setHeader('X-User-ID', user.id);
            proxyReq.setHeader('X-User-Roles', user.roles.join(','));
            proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] || this.generateRequestId());
          }
        }
      });

      // Apply authentication middleware if required
      const authMiddleware = service.endpoints.some(e => e.authentication) 
        ? this.authenticate 
        : (req: express.Request, res: express.Response, next: express.NextFunction) => next();

      // Mount the proxy with appropriate middleware
      this.app.use(basePath, authMiddleware, proxy);
    });
  }

  /**
   * User authentication middleware
   */
  private authenticate = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'No token provided'
        });
      }

      const decoded = jwt.verify(token, this.config.jwtSecret) as AuthUser;
      (req as any).user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication failed'
      });
    }
  };

  /**
   * Authorization middleware
   */
  private authorize = (requiredRoles: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const hasRole = requiredRoles.some(role => user.roles.includes(role));
      if (!hasRole) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required roles: ${requiredRoles.join(', ')}`
        });
      }

      next();
    };
  };

  /**
   * User login endpoint
   */
  private authenticateUser = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Email and password required'
        });
        return;
      }

      // TODO: Integrate with actual user authentication service
      // For now, return a mock successful authentication
      const user: AuthUser = {
        id: 'user-123',
        email,
        roles: ['user'],
        permissions: ['read', 'write']
      };

      const token = jwt.sign(user, this.config.jwtSecret, { expiresIn: '24h' });
      const refreshToken = jwt.sign({ id: user.id }, this.config.jwtSecret, { expiresIn: '7d' });

      res.json({
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Token refresh endpoint
   */
  private refreshToken = (req: express.Request, res: express.Response): void => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({
          error: 'Refresh token required'
        });
        return;
      }

      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as { id: string };
      
      // TODO: Retrieve user information from user service
      const user: AuthUser = {
        id: decoded.id,
        email: 'user@example.com',
        roles: ['user'],
        permissions: ['read', 'write']
      };

      const newToken = jwt.sign(user, this.config.jwtSecret, { expiresIn: '24h' });

      res.json({
        message: 'Token refreshed successfully',
        token: newToken
      });
    } catch (error) {
      res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token has expired or is invalid'
      });
    }
  };

  /**
   * Logout endpoint
   */
  private logout = (req: express.Request, res: express.Response): void => {
    // TODO: Implement token blacklisting or session invalidation
    res.json({
      message: 'Logout successful'
    });
  };

  /**
   * Extract JWT token from request
   */
  private extractToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const services = this.serviceRegistry.getAllServices();
      services.forEach(service => {
        // Update service load information
        this.serviceRegistry.updateServiceLoad(service.service.id, Math.random() * 100);
      });
    }, 30000); // Update every 30 seconds
  }

  /**
   * Start the API Gateway server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(this.config.port, () => {
          console.log(`[API Gateway] Server running on port ${this.config.port}`);
          console.log(`[API Gateway] Health check available at http://localhost:${this.config.port}/health`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the API Gateway server
   */
  public async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // TODO: Close any open connections and clean up resources
    console.log('[API Gateway] Server stopped');
  }

  /**
   * Get Express application instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }
}
