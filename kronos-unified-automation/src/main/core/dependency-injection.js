const { EventEmitter } = require('events');

/**
 * Dependency Injection Container
 * Manages service instantiation and dependency resolution
 */
class DIContainer extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
    this.modules = new Map();
    this.config = new Map();
    
    this.logger = {
      info: (message) => console.log(`[DIContainer] ${message}`),
      warn: (message) => console.warn(`[DIContainer] ${message}`),
      error: (message, error) => console.error(`[DIContainer] ${message}`, error)
    };
  }

  /**
   * Register a service factory
   */
  register(name, factory, options = {}) {
    try {
      if (this.factories.has(name)) {
        throw new Error(`Service factory ${name} is already registered`);
      }

      const serviceDefinition = {
        name,
        factory,
        scope: options.scope || 'singleton', // 'singleton', 'transient', 'scoped'
        dependencies: options.dependencies || [],
        config: options.config || {},
        tags: options.tags || [],
        priority: options.priority || 0,
        enabled: options.enabled !== false,
        condition: options.condition || null
      };

      this.factories.set(name, serviceDefinition);
      this.logger.info(`Registered service factory: ${name} (${serviceDefinition.scope})`);
      
      this.emit('service:registered', { name, definition: serviceDefinition });
      return this;
    } catch (error) {
      this.logger.error(`Failed to register service factory ${name}`, error);
      throw error;
    }
  }

  /**
   * Register multiple services from a module
   */
  registerModule(moduleName, moduleDefinition) {
    try {
      if (this.modules.has(moduleName)) {
        throw new Error(`Module ${moduleName} is already registered`);
      }

      const module = {
        name: moduleName,
        ...moduleDefinition,
        registered: new Date()
      };

      this.modules.set(moduleName, module);

      // Register all services in the module
      if (module.services) {
        for (const [name, factory] of Object.entries(module.services)) {
          this.register(`${moduleName}.${name}`, factory, module.servicesConfig?.[name] || {});
        }
      }

      // Register module dependencies
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (!this.modules.has(dep)) {
            throw new Error(`Module dependency ${dep} not found for module ${moduleName}`);
          }
        }
      }

      this.logger.info(`Registered module: ${moduleName}`);
      this.emit('module:registered', { name: moduleName, module });
      
      return this;
    } catch (error) {
      this.logger.error(`Failed to register module ${moduleName}`, error);
      throw error;
    }
  }

  /**
   * Resolve a service by name
   */
  async resolve(serviceName, context = {}) {
    try {
      // Check if it's already instantiated (for singletons)
      if (this.singletons.has(serviceName)) {
        return this.singletons.get(serviceName);
      }

      // Get service definition
      const definition = this.factories.get(serviceName);
      if (!definition) {
        throw new Error(`Service ${serviceName} not found`);
      }

      // Check if service is enabled
      if (!definition.enabled) {
        throw new Error(`Service ${serviceName} is disabled`);
      }

      // Check condition if provided
      if (definition.condition && !this.evaluateCondition(definition.condition, context)) {
        throw new Error(`Service ${serviceName} condition not met`);
      }

      // Resolve dependencies
      const dependencies = await this.resolveDependencies(definition.dependencies, context);

      // Create service instance
      const instance = await this.createServiceInstance(definition, dependencies, context);

      // Store singleton instances
      if (definition.scope === 'singleton') {
        this.singletons.set(serviceName, instance);
      }

      this.logger.info(`Resolved service: ${serviceName}`);
      this.emit('service:resolved', { name: serviceName, instance, context });
      
      return instance;
    } catch (error) {
      this.logger.error(`Failed to resolve service ${serviceName}`, error);
      throw error;
    }
  }

  /**
   * Resolve multiple services
   */
  async resolveMany(serviceNames, context = {}) {
    const results = {};
    const errors = {};

    for (const name of serviceNames) {
      try {
        results[name] = await this.resolve(name, context);
      } catch (error) {
        errors[name] = error;
      }
    }

    return { results, errors };
  }

  /**
   * Resolve all services with a specific tag
   */
  async resolveByTag(tag, context = {}) {
    const taggedServices = [];

    for (const [name, definition] of this.factories) {
      if (definition.tags.includes(tag) && definition.enabled) {
        try {
          const instance = await this.resolve(name, context);
          taggedServices.push({ name, instance, definition });
        } catch (error) {
          this.logger.error(`Failed to resolve tagged service ${name}`, error);
        }
      }
    }

    return taggedServices;
  }

  /**
   * Resolve dependencies for a service
   */
  async resolveDependencies(dependencies, context) {
    const resolved = {};

    for (const depName of dependencies) {
      try {
        resolved[depName] = await this.resolve(depName, context);
      } catch (error) {
        this.logger.error(`Failed to resolve dependency ${depName}`, error);
        throw new Error(`Failed to resolve dependency ${depName} for service: ${error.message}`);
      }
    }

    return resolved;
  }

  /**
   * Create a service instance
   */
  async createServiceInstance(definition, dependencies, context) {
    try {
      const { factory, config } = definition;

      // Prepare factory arguments
      const args = [];

      // Add dependencies as first arguments
      if (typeof factory === 'function') {
        // Check if factory expects dependencies object
        const factoryStr = factory.toString();
        const expectsDependencies = factoryStr.includes('dependencies') || 
                                   factoryStr.includes('deps') ||
                                   factory.length === 1;

        if (expectsDependencies) {
          args.push(dependencies);
        } else {
          // Add dependencies as named arguments
          Object.assign(args, dependencies);
        }

        // Add config as second argument if expected
        if (factory.length >= 2 || factoryStr.includes('config')) {
          args.push(config);
        }

        // Add context as third argument if expected
        if (factory.length >= 3 || factoryStr.includes('context')) {
          args.push(context);
        }

        // Call factory
        const instance = await factory(...args);
        return instance;
      } else if (typeof factory === 'object' && factory.create) {
        // Factory is an object with create method
        return await factory.create(dependencies, config, context);
      } else {
        throw new Error('Invalid factory type');
      }
    } catch (error) {
      this.logger.error(`Failed to create service instance for ${definition.name}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a condition function
   */
  evaluateCondition(condition, context) {
    try {
      if (typeof condition === 'function') {
        return condition(context, this);
      } else if (typeof condition === 'object') {
        // Simple condition object: { key: value, ... }
        for (const [key, value] of Object.entries(condition)) {
          if (context[key] !== value) {
            return false;
          }
        }
        return true;
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate condition', error);
      return false;
    }
  }

  /**
   * Get service definition
   */
  getDefinition(serviceName) {
    return this.factories.get(serviceName);
  }

  /**
   * Get all registered service names
   */
  getServiceNames() {
    return Array.from(this.factories.keys());
  }

  /**
   * Get services by scope
   */
  getServicesByScope(scope) {
    const services = [];
    for (const [name, definition] of this.factories) {
      if (definition.scope === scope) {
        services.push(name);
      }
    }
    return services;
  }

  /**
   * Check if a service is registered
   */
  hasService(serviceName) {
    return this.factories.has(serviceName);
  }

  /**
   * Check if a module is registered
   */
  hasModule(moduleName) {
    return this.modules.has(moduleName);
  }

  /**
   * Unregister a service
   */
  unregister(serviceName) {
    try {
      if (!this.factories.has(serviceName)) {
        throw new Error(`Service ${serviceName} not found`);
      }

      this.factories.delete(serviceName);
      
      // Remove singleton instance if exists
      if (this.singletons.has(serviceName)) {
        this.singletons.delete(serviceName);
      }

      this.logger.info(`Unregistered service: ${serviceName}`);
      this.emit('service:unregistered', { name: serviceName });
      
      return this;
    } catch (error) {
      this.logger.error(`Failed to unregister service ${serviceName}`, error);
      throw error;
    }
  }

  /**
   * Unregister a module
   */
  unregisterModule(moduleName) {
    try {
      if (!this.modules.has(moduleName)) {
        throw new Error(`Module ${moduleName} not found`);
      }

      const module = this.modules.get(moduleName);
      
      // Unregister all services in the module
      if (module.services) {
        for (const name of Object.keys(module.services)) {
          this.unregister(`${moduleName}.${name}`);
        }
      }

      this.modules.delete(moduleName);
      
      this.logger.info(`Unregistered module: ${moduleName}`);
      this.emit('module:unregistered', { name: moduleName });
      
      return this;
    } catch (error) {
      this.logger.error(`Failed to unregister module ${moduleName}`, error);
      throw error;
    }
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.factories.clear();
    this.singletons.clear();
    this.modules.clear();
    this.config.clear();
    
    this.logger.info('Container cleared');
    this.emit('cleared');
  }

  /**
   * Get container statistics
   */
  getStats() {
    return {
      services: this.factories.size,
      singletons: this.singletons.size,
      modules: this.modules.size,
      servicesByScope: {
        singleton: this.getServicesByScope('singleton').length,
        transient: this.getServicesByScope('transient').length,
        scoped: this.getServicesByScope('scoped').length
      },
      totalDependencies: Array.from(this.factories.values())
        .reduce((sum, def) => sum + def.dependencies.length, 0)
    };
  }

  /**
   * Validate container configuration
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check for circular dependencies
    const circularDeps = this.findCircularDependencies();
    if (circularDeps.length > 0) {
      errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
    }

    // Check for missing dependencies
    for (const [name, definition] of this.factories) {
      for (const dep of definition.dependencies) {
        if (!this.factories.has(dep)) {
          errors.push(`Service ${name} depends on missing service ${dep}`);
        }
      }
    }

    // Check for missing module dependencies
    for (const [name, module] of this.modules) {
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (!this.modules.has(dep)) {
            errors.push(`Module ${name} depends on missing module ${dep}`);
          }
        }
      }
    }

    return { errors, warnings, valid: errors.length === 0 };
  }

  /**
   * Find circular dependencies
   */
  findCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    const circularDeps = [];

    const dfs = (serviceName, path = []) => {
      if (recursionStack.has(serviceName)) {
        // Found a cycle
        const cycleStart = path.indexOf(serviceName);
        if (cycleStart !== -1) {
          circularDeps.push(path.slice(cycleStart).join(' -> ') + ` -> ${serviceName}`);
        }
        return;
      }

      if (visited.has(serviceName)) return;

      visited.add(serviceName);
      recursionStack.add(serviceName);

      const definition = this.factories.get(serviceName);
      if (definition) {
        for (const dep of definition.dependencies) {
          if (this.factories.has(dep)) {
            dfs(dep, [...path, serviceName]);
          }
        }
      }

      recursionStack.delete(serviceName);
    };

    for (const serviceName of this.factories.keys()) {
      if (!visited.has(serviceName)) {
        dfs(serviceName);
      }
    }

    return circularDeps;
  }

  /**
   * Shutdown the container
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down DI Container...');

      // Dispose all singleton instances that have a dispose method
      for (const [name, instance] of this.singletons) {
        try {
          if (typeof instance.dispose === 'function') {
            await instance.dispose();
          } else if (typeof instance.shutdown === 'function') {
            await instance.shutdown();
          } else if (typeof instance.close === 'function') {
            await instance.close();
          }
        } catch (error) {
          this.logger.error(`Error disposing singleton ${name}`, error);
        }
      }

      // Clear all data
      this.clear();

      this.logger.info('DI Container shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during DI Container shutdown', error);
      throw error;
    }
  }
}

module.exports = DIContainer;
