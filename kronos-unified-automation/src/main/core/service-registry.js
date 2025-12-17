const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

/**
 * Service Registry - Core service management system
 * Manages service lifecycle, dependencies, and health monitoring
 */
class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.serviceConfigs = new Map();
    this.serviceHealth = new Map();
    this.dependencyGraph = new Map();
    this.startupOrder = [];
    this.shutdownOrder = [];
    this.healthCheckInterval = null;
    this.configManager = null;
    
    this.logger = {
      info: (message, service) => console.log(`[ServiceRegistry] ${service ? `[${service}] ` : ''}${message}`),
      warn: (message, service) => console.warn(`[ServiceRegistry] ${service ? `[${service}] ` : ''}${message}`),
      error: (message, service, error) => console.error(`[ServiceRegistry] ${service ? `[${service}] ` : ''}${message}`, error)
    };
  }

  /**
   * Initialize the service registry
   */
  async initialize(configManager) {
    try {
      this.configManager = configManager;
      this.logger.info('Initializing Service Registry...');
      
      // Load service configurations
      await this.loadServiceConfigs();
      
      // Build dependency graph
      this.buildDependencyGraph();
      
      // Calculate startup and shutdown orders
      this.calculateServiceOrders();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.logger.info('Service Registry initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Service Registry', null, error);
      throw error;
    }
  }

  /**
   * Register a service with the registry
   */
  async register(serviceName, serviceInstance, config = {}) {
    try {
      if (this.services.has(serviceName)) {
        throw new Error(`Service ${serviceName} is already registered`);
      }

      this.logger.info(`Registering service: ${serviceName}`);
      
      // Validate service interface
      this.validateServiceInterface(serviceInstance);
      
      // Store service and config
      this.services.set(serviceName, serviceInstance);
      this.serviceConfigs.set(serviceName, {
        enabled: true,
        autoStart: true,
        restartOnError: true,
        maxRestarts: 3,
        restartDelay: 5000,
        timeout: 30000,
        ...config
      });

      // Initialize health tracking
      this.serviceHealth.set(serviceName, {
        status: 'stopped',
        uptime: 0,
        lastCheck: new Date(),
        restartCount: 0,
        errorCount: 0,
        lastError: null
      });

      // Set up event listeners
      this.setupServiceEventListeners(serviceName, serviceInstance);
      
      // Update dependency graph
      this.updateDependencyGraph(serviceName);
      
      this.logger.info(`Service ${serviceName} registered successfully`);
      this.emit('service:registered', { name: serviceName, service: serviceInstance });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register service ${serviceName}`, null, error);
      throw error;
    }
  }

  /**
   * Unregister a service from the registry
   */
  async unregister(serviceName) {
    try {
      if (!this.services.has(serviceName)) {
        throw new Error(`Service ${serviceName} is not registered`);
      }

      this.logger.info(`Unregistering service: ${serviceName}`);
      
      // Stop the service if running
      const service = this.services.get(serviceName);
      if (service.getStatus() === 'running') {
        await this.stopService(serviceName);
      }
      
      // Remove from registry
      this.services.delete(serviceName);
      this.serviceConfigs.delete(serviceName);
      this.serviceHealth.delete(serviceName);
      
      // Update dependency graph
      this.removeFromDependencyGraph(serviceName);
      
      this.logger.info(`Service ${serviceName} unregistered successfully`);
      this.emit('service:unregistered', { name: serviceName });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister service ${serviceName}`, null, error);
      throw error;
    }
  }

  /**
   * Get a service by name
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get all registered services
   */
  getServices() {
    return Array.from(this.services.keys());
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceName) {
    return this.serviceConfigs.get(serviceName);
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName) {
    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses() {
    const statuses = {};
    for (const [name, service] of this.services) {
      statuses[name] = {
        status: service.getStatus(),
        health: this.serviceHealth.get(name),
        config: this.serviceConfigs.get(name)
      };
    }
    return statuses;
  }

  /**
   * Start all registered services
   */
  async startAll() {
    try {
      this.logger.info('Starting all services...');
      this.emit('services:starting');
      
      const results = {};
      for (const serviceName of this.startupOrder) {
        try {
          if (this.shouldStartService(serviceName)) {
            await this.startService(serviceName);
            results[serviceName] = { success: true };
          } else {
            results[serviceName] = { success: false, reason: 'disabled' };
          }
        } catch (error) {
          this.logger.error(`Failed to start service ${serviceName}`, null, error);
          results[serviceName] = { success: false, error: error.message };
        }
      }
      
      this.emit('services:started', results);
      this.logger.info('All services start attempt completed');
      
      return results;
    } catch (error) {
      this.logger.error('Failed to start services', null, error);
      throw error;
    }
  }

  /**
   * Stop all registered services
   */
  async stopAll() {
    try {
      this.logger.info('Stopping all services...');
      this.emit('services:stopping');
      
      const results = {};
      for (const serviceName of this.shutdownOrder) {
        try {
          await this.stopService(serviceName);
          results[serviceName] = { success: true };
        } catch (error) {
          this.logger.error(`Failed to stop service ${serviceName}`, null, error);
          results[serviceName] = { success: false, error: error.message };
        }
      }
      
      this.emit('services:stopped', results);
      this.logger.info('All services stopped');
      
      return results;
    } catch (error) {
      this.logger.error('Failed to stop services', null, error);
      throw error;
    }
  }

  /**
   * Start a specific service
   */
  async startService(serviceName) {
    try {
      const service = this.services.get(serviceName);
      const config = this.serviceConfigs.get(serviceName);
      
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }
      
      if (!config.enabled) {
        this.logger.info(`Service ${serviceName} is disabled, skipping start`);
        return false;
      }
      
      const currentStatus = service.getStatus();
      if (currentStatus === 'running') {
        this.logger.info(`Service ${serviceName} is already running`);
        return true;
      }
      
      this.logger.info(`Starting service: ${serviceName}`);
      this.updateServiceHealth(serviceName, { status: 'starting' });
      
      // Set timeout for service startup
      const startupPromise = service.start();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service startup timeout')), config.timeout);
      });
      
      await Promise.race([startupPromise, timeoutPromise]);
      
      this.updateServiceHealth(serviceName, { 
        status: 'running', 
        lastStart: new Date(),
        restartCount: 0 
      });
      
      this.emit('service:started', { name: serviceName });
      this.logger.info(`Service ${serviceName} started successfully`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start service ${serviceName}`, null, error);
      await this.handleServiceError(serviceName, error);
      throw error;
    }
  }

  /**
   * Stop a specific service
   */
  async stopService(serviceName) {
    try {
      const service = this.services.get(serviceName);
      
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }
      
      const currentStatus = service.getStatus();
      if (currentStatus !== 'running') {
        this.logger.info(`Service ${serviceName} is not running (status: ${currentStatus})`);
        return true;
      }
      
      this.logger.info(`Stopping service: ${serviceName}`);
      this.updateServiceHealth(serviceName, { status: 'stopping' });
      
      await service.stop();
      
      this.updateServiceHealth(serviceName, { 
        status: 'stopped',
        lastStop: new Date()
      });
      
      this.emit('service:stopped', { name: serviceName });
      this.logger.info(`Service ${serviceName} stopped successfully`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop service ${serviceName}`, null, error);
      throw error;
    }
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName) {
    try {
      this.logger.info(`Restarting service: ${serviceName}`);
      
      await this.stopService(serviceName);
      
      // Wait for shutdown to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await this.startService(serviceName);
      
      this.emit('service:restarted', { name: serviceName });
      this.logger.info(`Service ${serviceName} restarted successfully`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to restart service ${serviceName}`, null, error);
      throw error;
    }
  }

  /**
   * Validate service interface
   */
  validateServiceInterface(service) {
    const requiredMethods = ['start', 'stop', 'restart', 'getStatus', 'healthCheck'];
    const requiredProperties = ['name', 'status', 'dependencies'];
    
    for (const method of requiredMethods) {
      if (typeof service[method] !== 'function') {
        throw new Error(`Service must implement ${method} method`);
      }
    }
    
    for (const prop of requiredProperties) {
      if (!(prop in service)) {
        throw new Error(`Service must have ${prop} property`);
      }
    }
  }

  /**
   * Set up event listeners for a service
   */
  setupServiceEventListeners(serviceName, service) {
    service.on('error', (error) => {
      this.logger.error(`Service ${serviceName} emitted error`, null, error);
      this.handleServiceError(serviceName, error);
    });
    
    service.on('statusChanged', (newStatus) => {
      this.updateServiceHealth(serviceName, { status: newStatus });
      this.emit('service:statusChanged', { name: serviceName, status: newStatus });
    });
    
    service.on('healthCheck', (health) => {
      this.updateServiceHealth(serviceName, { lastCheck: new Date(), health });
      this.emit('service:healthCheck', { name: serviceName, health });
    });
  }

  /**
   * Handle service errors
   */
  async handleServiceError(serviceName, error) {
    const health = this.serviceHealth.get(serviceName);
    const config = this.serviceConfigs.get(serviceName);
    
    if (!health || !config) return;
    
    health.errorCount++;
    health.lastError = {
      message: error.message,
      timestamp: new Date(),
      stack: error.stack
    };
    
    // Update status based on error handling policy
    if (config.restartOnError && health.restartCount < config.maxRestarts) {
      health.status = 'restarting';
      this.updateServiceHealth(serviceName, { 
        status: 'restarting',
        restartCount: health.restartCount + 1
      });
      
      // Schedule restart with delay
      setTimeout(async () => {
        try {
          await this.startService(serviceName);
        } catch (restartError) {
          this.logger.error(`Failed to restart service ${serviceName}`, null, restartError);
          health.status = 'error';
        }
      }, config.restartDelay);
    } else {
      health.status = 'error';
    }
  }

  /**
   * Update service health information
   */
  updateServiceHealth(serviceName, updates) {
    const health = this.serviceHealth.get(serviceName);
    if (health) {
      Object.assign(health, updates);
      this.serviceHealth.set(serviceName, health);
    }
  }

  /**
   * Load service configurations
   */
  async loadServiceConfigs() {
    try {
      const configPath = path.join(__dirname, '../../config/services.json');
      try {
        const configData = await fs.readFile(configPath, 'utf8');
        const configs = JSON.parse(configData);
        
        for (const [serviceName, config] of Object.entries(configs)) {
          this.serviceConfigs.set(serviceName, config);
        }
        
        this.logger.info(`Loaded ${Object.keys(configs).length} service configurations`);
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          this.logger.warn('Service configuration file not found, using defaults');
        } else {
          throw fileError;
        }
      }
    } catch (error) {
      this.logger.error('Failed to load service configurations', null, error);
      throw error;
    }
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    this.dependencyGraph.clear();
    
    for (const [serviceName, service] of this.services) {
      const dependencies = service.dependencies || [];
      this.dependencyGraph.set(serviceName, new Set(dependencies));
    }
    
    this.logger.info('Built dependency graph');
  }

  /**
   * Update dependency graph for a service
   */
  updateDependencyGraph(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      const dependencies = service.dependencies || [];
      this.dependencyGraph.set(serviceName, new Set(dependencies));
      this.calculateServiceOrders();
    }
  }

  /**
   * Remove service from dependency graph
   */
  removeFromDependencyGraph(serviceName) {
    this.dependencyGraph.delete(serviceName);
    
    // Remove from other services' dependencies
    for (const [name, deps] of this.dependencyGraph) {
      deps.delete(serviceName);
    }
    
    this.calculateServiceOrders();
  }

  /**
   * Calculate startup and shutdown orders based on dependencies
   */
  calculateServiceOrders() {
    try {
      // Topological sort for startup order
      this.startupOrder = this.topologicalSort();
      
      // Reverse for shutdown order
      this.shutdownOrder = [...this.startupOrder].reverse();
      
      this.logger.info(`Calculated service orders - Startup: ${this.startupOrder.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to calculate service orders', null, error);
      // Fallback to alphabetical order
      this.startupOrder = Array.from(this.services.keys()).sort();
      this.shutdownOrder = [...this.startupOrder].reverse();
    }
  }

  /**
   * Topological sort to determine service startup order
   */
  topologicalSort() {
    const visited = new Set();
    const visiting = new Set();
    const result = [];
    
    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      
      visiting.add(serviceName);
      
      const dependencies = this.dependencyGraph.get(serviceName) || new Set();
      for (const dep of dependencies) {
        if (this.services.has(dep)) {
          visit(dep);
        }
      }
      
      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };
    
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }
    
    return result;
  }

  /**
   * Check if a service should be started
   */
  shouldStartService(serviceName) {
    const config = this.serviceConfigs.get(serviceName);
    return config && config.enabled && config.autoStart;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
    
    this.logger.info('Health monitoring started');
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks() {
    for (const [serviceName, service] of this.services) {
      try {
        if (service.getStatus() === 'running') {
          const health = await service.healthCheck();
          this.updateServiceHealth(serviceName, { 
            lastCheck: new Date(),
            health 
          });
        }
      } catch (error) {
        this.logger.error(`Health check failed for service ${serviceName}`, null, error);
        await this.handleServiceError(serviceName, error);
      }
    }
  }

  /**
   * Shutdown the service registry
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Service Registry...');
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      // Stop all services
      await this.stopAll();
      
      // Clear all data
      this.services.clear();
      this.serviceConfigs.clear();
      this.serviceHealth.clear();
      this.dependencyGraph.clear();
      this.startupOrder = [];
      this.shutdownOrder = [];
      
      this.logger.info('Service Registry shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during Service Registry shutdown', null, error);
      throw error;
    }
  }
}

module.exports = ServiceRegistry;
