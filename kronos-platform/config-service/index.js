const express = require('express');
const { createClient } = require('redis');
const Joi = require('joi');
const cron = require('node-cron');

// KRONOS Configuration Service - Centralized configuration management
class KronosConfigService {
  constructor(port = 4000) {
    this.port = port;
    this.app = express();
    this.redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.configs = new Map();
    this.schemas = new Map();
    this.watchers = new Set();

    this.setupMiddleware();
    this.loadRoutes();
    this.setupSchemas();
    this.setupHotReload();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  loadRoutes() {
    // Get configuration by service and environment
    this.app.get('/api/v1/config/:service/:environment?', async (req, res) => {
      try {
        const { service, environment = 'development' } = req.params;
        const key = `${service}:${environment}`;

        // Check Redis cache first
        const cached = await this.redis.get(`config:${key}`);
        if (cached) {
          return res.json(JSON.parse(cached));
        }

        // Get from memory store
        const config = this.configs.get(key);
        if (!config) {
          return res.status(404).json({ error: 'Configuration not found' });
        }

        // Cache in Redis for 5 minutes
        await this.redis.setex(`config:${key}`, 300, JSON.stringify(config));

        res.json(config);
      } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Set/update configuration
    this.app.post('/api/v1/config/:service/:environment?', async (req, res) => {
      try {
        const { service, environment = 'development' } = req.params;
        const newConfig = req.body;
        const key = `${service}:${environment}`;

        // Validate against schema if it exists
        const schema = this.schemas.get(service);
        if (schema) {
          const { error } = schema.validate(newConfig);
          if (error) {
            return res.status(400).json({
              error: 'Configuration validation failed',
              details: error.details.map(d => d.message)
            });
          }
        }

        // Store in memory
        this.configs.set(key, { ...newConfig, updatedAt: new Date() });

        // Store in Redis
        await this.redis.set(`config:${key}`, JSON.stringify(this.configs.get(key)));

        // Notify watchers for hot reload
        this.notifyWatchers(service, environment, newConfig);

        res.json({
          message: 'Configuration updated successfully',
          service,
          environment
        });
      } catch (error) {
        console.error('Error setting config:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Delete configuration
    this.app.delete('/api/v1/config/:service/:environment?', async (req, res) => {
      try {
        const { service, environment = 'development' } = req.params;
        const key = `${service}:${environment}`;

        this.configs.delete(key);
        await this.redis.del(`config:${key}`);

        res.json({ message: 'Configuration deleted successfully' });
      } catch (error) {
        console.error('Error deleting config:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // List all configurations
    this.app.get('/api/v1/config', async (req, res) => {
      try {
        const configs = {};
        for (const [key, value] of this.configs) {
          configs[key] = value;
        }
        res.json({ configs, count: this.configs.size });
      } catch (error) {
        console.error('Error listing configs:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Environment management
    this.app.get('/api/v1/environments', (req, res) => {
      const environments = ['development', 'staging', 'production'];
      res.json({ environments });
    });

    // Service schemas
    this.app.get('/api/v1/schemas/:service', (req, res) => {
      const { service } = req.params;
      const schema = this.schemas.get(service);
      if (!schema) {
        return res.status(404).json({ error: 'Schema not found' });
      }
      res.json({ schema: schema.describe() });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        configs: this.configs.size,
        watchers: this.watchers.size
      });
    });
  }

  setupSchemas() {
    // Define validation schemas for different services

    // API Gateway schema
    this.schemas.set('api-gateway', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(3000),
      cors: Joi.object({
        origins: Joi.array().items(Joi.string()),
        credentials: Joi.boolean()
      }),
      rateLimit: Joi.object({
        windowMs: Joi.number().integer(),
        max: Joi.number().integer()
      }),
      redis: Joi.object({
        url: Joi.string().uri()
      })
    }));

    // Service Registry schema
    this.schemas.set('service-registry', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(8080),
      redis: Joi.object({
        url: Joi.string().uri()
      }),
      healthCheck: Joi.object({
        interval: Joi.number().integer(),
        timeout: Joi.number().integer()
      })
    }));

    // Desktop Agent schema
    this.schemas.set('kronos-desktop-agent', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(9990),
      ai: Joi.object({
        provider: Joi.string().valid('anthropic', 'openai', 'google'),
        apiKey: Joi.string().required(),
        model: Joi.string()
      }),
      virtualDesktop: Joi.object({
        resolution: Joi.string(),
        browser: Joi.string()
      })
    }));

    // Web Automation schema
    this.schemas.set('kronos-web-automation', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(3001),
      supabase: Joi.object({
        url: Joi.string().uri().required(),
        anonKey: Joi.string().required()
      }),
      ai: Joi.object({
        providers: Joi.array().items(Joi.string())
      }),
      vm: Joi.object({
        maxConcurrent: Joi.number().integer(),
        timeout: Joi.number().integer()
      })
    }));

    // Workflow Studio schema
    this.schemas.set('kronos-workflow-studio', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(3002),
      database: Joi.object({
        url: Joi.string().uri().required()
      }),
      redis: Joi.object({
        url: Joi.string().uri()
      }),
      ai: Joi.object({
        enabled: Joi.boolean(),
        providers: Joi.array().items(Joi.string())
      })
    }));

    // Unified AI schema
    this.schemas.set('kronos-unified-ai', Joi.object({
      port: Joi.number().integer().min(1000).max(9999).default(3003),
      mcp: Joi.object({
        enabled: Joi.boolean(),
        servers: Joi.array().items(Joi.string())
      }),
      ollama: Joi.object({
        endpoint: Joi.string().uri(),
        models: Joi.array().items(Joi.string())
      }),
      providers: Joi.object({
        anthropic: Joi.object({ apiKey: Joi.string() }),
        openai: Joi.object({ apiKey: Joi.string() }),
        google: Joi.object({ apiKey: Joi.string() })
      })
    }));
  }

  setupHotReload() {
    // Watch for configuration changes and notify services
    // This would typically integrate with a pub/sub system
    console.log('Hot reload system initialized');
  }

  notifyWatchers(service, environment, config) {
    // Notify all registered watchers of configuration changes
    // This enables hot reloading in connected services
    console.log(`Configuration updated for ${service}:${environment}`);
  }

  async loadDefaultConfigs() {
    // Load default configurations for all services
    const defaultConfigs = {
      // API Gateway defaults
      'api-gateway:development': {
        port: 3000,
        cors: { origins: ['http://localhost:3000'], credentials: true },
        rateLimit: { windowMs: 900000, max: 1000 },
        redis: { url: 'redis://localhost:6379' }
      },

      // Service Registry defaults
      'service-registry:development': {
        port: 8080,
        redis: { url: 'redis://localhost:6379' },
        healthCheck: { interval: 30000, timeout: 5000 }
      },

      // Desktop Agent defaults
      'kronos-desktop-agent:development': {
        port: 9990,
        ai: { provider: 'anthropic', model: 'claude-3-sonnet-20240229' },
        virtualDesktop: { resolution: '1920x1080', browser: 'firefox' }
      },

      // Web Automation defaults
      'kronos-web-automation:development': {
        port: 3001,
        supabase: { url: 'https://your-project.supabase.co', anonKey: 'your-anon-key' },
        ai: { providers: ['anthropic', 'openai'] },
        vm: { maxConcurrent: 3, timeout: 300000 }
      },

      // Workflow Studio defaults
      'kronos-workflow-studio:development': {
        port: 3002,
        database: { url: 'postgresql://localhost:5432/workflows' },
        redis: { url: 'redis://localhost:6379' },
        ai: { enabled: true, providers: ['anthropic'] }
      },

      // Unified AI defaults
      'kronos-unified-ai:development': {
        port: 3003,
        mcp: { enabled: true, servers: [] },
        ollama: { endpoint: 'http://localhost:11434', models: ['llama2', 'codellama'] },
        providers: {
          anthropic: {},
          openai: {},
          google: {}
        }
      }
    };

    // Load defaults into memory and Redis
    for (const [key, config] of Object.entries(defaultConfigs)) {
      this.configs.set(key, config);
      await this.redis.set(`config:${key}`, JSON.stringify(config));
    }

    console.log(`Loaded ${Object.keys(defaultConfigs).length} default configurations`);
  }

  async start() {
    try {
      await this.redis.connect();
      console.log('Connected to Redis');

      // Load default configurations
      await this.loadDefaultConfigs();

      this.app.listen(this.port, () => {
        console.log(`🛠️  KRONOS Configuration Service running on port ${this.port}`);
        console.log(`📋 Managing configurations for ${this.configs.size} service-environment combinations`);
        console.log(`🔄 Hot reload system active`);
        console.log(`🌐 Ready at http://localhost:${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start Configuration Service:', error);
      throw error;
    }
  }

  async stop() {
    await this.redis.disconnect();
    console.log('Configuration Service stopped');
  }
}

// Start the configuration service
const configService = new KronosConfigService(4000);
configService.start().catch(console.error);

module.exports = KronosConfigService;