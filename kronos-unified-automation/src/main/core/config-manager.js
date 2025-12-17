const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Centralized configuration management system
 * Handles application configuration, environment variables, and service-specific settings
 */
class ConfigManager {
  constructor() {
    this.config = new Map();
    this.watchers = new Map();
    this.configDir = path.join(app.getPath('userData'), 'config');
    this.encryptedCache = new Map();
    this.schemaCache = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize configuration manager
   */
  async initialize() {
    try {
      await this.ensureConfigDirectory();
      await this.loadDefaultConfigurations();
      await this.loadUserConfigurations();
      await this.validateConfigurations();
      this.startConfigWatchers();
      this.isInitialized = true;
      console.log('[ConfigManager] Initialized successfully');
    } catch (error) {
      console.error('[ConfigManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Ensure configuration directory exists
   */
  async ensureConfigDirectory() {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.mkdir(path.join(this.configDir, 'schemas'), { recursive: true });
      await fs.mkdir(path.join(this.configDir, 'secrets'), { recursive: true });
    }
  }

  /**
   * Load default configurations
   */
  async loadDefaultConfigurations() {
    const defaultConfigs = {
      'app': {
        name: 'Unified Automation Platform',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: 3000,
        maxConcurrentProjects: 10,
        logLevel: 'info',
        logDirectory: path.join(app.getPath('logs'), 'automation-platform'),
        autoSave: true,
        autoSaveInterval: 30000, // 30 seconds
        theme: 'dark',
        language: 'en'
      },
      'services': {
        healthCheckInterval: 30000, // 30 seconds
        restartOnFailure: true,
        maxRestartAttempts: 3,
        shutdownTimeout: 10000, // 10 seconds
        startupTimeout: 30000, // 30 seconds
        serviceDiscovery: {
          enabled: true,
          interval: 60000, // 1 minute
          timeout: 5000, // 5 seconds
          retries: 3
        }
      },
      'security': {
        encryptSecrets: true,
        sessionTimeout: 3600000, // 1 hour
        maxLoginAttempts: 5,
        lockoutDuration: 900000, // 15 minutes
        requireAuthentication: false, // For development
        jwtSecret: crypto.randomBytes(32).toString('hex'),
        encryptionKey: crypto.randomBytes(32).toString('hex')
      },
      'ui': {
        refreshInterval: 5000, // 5 seconds
        maxLogLines: 1000,
        enableAnimations: true,
        compactMode: false,
        showSystemMetrics: true,
        showNetworkInfo: true
      },
      'websocket': {
        reconnectInterval: 5000, // 5 seconds
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000, // 30 seconds
        maxMessageSize: 1048576, // 1MB
        compressionEnabled: true
      },
      'projects': {
        defaultTimeout: 300000, // 5 minutes
        maxRetries: 3,
        cleanupOnExit: true,
        backupBeforeUpdate: true,
        maxBackupFiles: 10,
        allowedExtensions: ['.js', '.ts', '.json', '.yml', '.yaml', '.py'],
        blockedCommands: ['rm', 'del', 'format', 'fdisk', 'mkfs']
      }
    };

    // Load default configurations
    for (const [key, value] of Object.entries(defaultConfigs)) {
      this.config.set(`default.${key}`, value);
    }
  }

  /**
   * Load user configurations from files
   */
  async loadUserConfigurations() {
    try {
      const configFiles = [
        path.join(this.configDir, 'app.json'),
        path.join(this.configDir, 'services.json'),
        path.join(this.configDir, 'security.json')
      ];

      for (const configFile of configFiles) {
        try {
          const content = await fs.readFile(configFile, 'utf8');
          const userConfig = JSON.parse(content);
          const configKey = path.basename(configFile, '.json');
          
          // Merge with defaults, user config takes precedence
          const defaultKey = `default.${configKey}`;
          const defaultConfig = this.config.get(defaultKey) || {};
          const mergedConfig = { ...defaultConfig, ...userConfig };
          
          this.config.set(`user.${configKey}`, mergedConfig);
          console.log(`[ConfigManager] Loaded user config: ${configFile}`);
        } catch (fileError) {
          if (fileError.code !== 'ENOENT') {
            console.warn(`[ConfigManager] Failed to load config file ${configFile}:`, fileError.message);
          }
        }
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to load user configurations:', error);
    }
  }

  /**
   * Validate all configurations
   */
  async validateConfigurations() {
    const validationRules = {
      'app.port': { type: 'number', min: 1024, max: 65535 },
      'app.maxConcurrentProjects': { type: 'number', min: 1, max: 100 },
      'services.healthCheckInterval': { type: 'number', min: 5000, max: 300000 },
      'security.sessionTimeout': { type: 'number', min: 60000, max: 86400000 },
      'ui.refreshInterval': { type: 'number', min: 1000, max: 60000 }
    };

    for (const [key, rule] of Object.entries(validationRules)) {
      const value = this.get(key);
      if (value !== undefined) {
        if (typeof value !== rule.type) {
          throw new Error(`Configuration validation failed: ${key} must be of type ${rule.type}`);
        }
        if (rule.min !== undefined && value < rule.min) {
          throw new Error(`Configuration validation failed: ${key} must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          throw new Error(`Configuration validation failed: ${key} must be <= ${rule.max}`);
        }
      }
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    // Try user config first, then default
    const userValue = this.config.get(`user.${key}`);
    if (userValue !== undefined) return userValue;
    
    const defaultValue_ = this.config.get(`default.${key}`);
    if (defaultValue_ !== undefined) return defaultValue_;
    
    return defaultValue;
  }

  /**
   * Set configuration value
   */
  set(key, value, persist = true) {
    this.config.set(`user.${key}`, value);
    
    if (persist) {
      this.scheduleSave(key);
    }
    
    // Notify watchers
    this.notifyWatchers(key, value);
  }

  /**
   * Get configuration section
   */
  getSection(section) {
    const result = {};
    for (const [key, value] of this.config.entries()) {
      if (key.startsWith(`${section}.`) || key.startsWith(`default.${section}`) || key.startsWith(`user.${section}`)) {
        const cleanKey = key.replace(/^(default|user)\./, '');
        if (cleanKey.startsWith(`${section}.`)) {
          const nestedKey = cleanKey.replace(`${section}.`, '');
          this.setNestedValue(result, nestedKey, value);
        }
      }
    }
    return result;
  }

  /**
   * Set nested value in object
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Watch configuration changes
   */
  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key).add(callback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(key);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  /**
   * Notify watchers of configuration change
   */
  notifyWatchers(key, value) {
    const watchers = this.watchers.get(key);
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(value, key);
        } catch (error) {
          console.error(`[ConfigManager] Error in configuration watcher for ${key}:`, error);
        }
      });
    }
  }

  /**
   * Start configuration watchers
   */
  startConfigWatchers() {
    // Watch for file changes in config directory
    this.configWatcher = require('fs').watch(this.configDir, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        console.log(`[ConfigManager] Configuration file changed: ${filename}`);
        this.loadUserConfigurations();
      }
    });
  }

  /**
   * Schedule configuration save
   */
  scheduleSave(key) {
    if (this.saveTimers && this.saveTimers.has(key)) {
      clearTimeout(this.saveTimers.get(key));
    }
    
    if (!this.saveTimers) {
      this.saveTimers = new Map();
    }
    
    const timer = setTimeout(() => {
      this.saveConfiguration(key);
      this.saveTimers.delete(key);
    }, 1000); // Debounce saves
    
    this.saveTimers.set(key, timer);
  }

  /**
   * Save specific configuration
   */
  async saveConfiguration(key) {
    try {
      const [scope, section, ...rest] = key.split('.');
      if (scope !== 'user') return;
      
      const configFile = path.join(this.configDir, `${section}.json`);
      const sectionConfig = this.getSection(section);
      
      await fs.writeFile(configFile, JSON.stringify(sectionConfig, null, 2));
      console.log(`[ConfigManager] Saved configuration: ${key}`);
    } catch (error) {
      console.error(`[ConfigManager] Failed to save configuration ${key}:`, error);
    }
  }

  /**
   * Get environment variable with fallback
   */
  getEnvVar(name, defaultValue = null) {
    return process.env[name] || defaultValue;
  }

  /**
   * Set environment variable
   */
  setEnvVar(name, value) {
    process.env[name] = value;
    this.set(`env.${name}`, value, false);
  }

  /**
   * Encrypt sensitive configuration value
   */
  encryptValue(value, key = null) {
    if (!this.get('security.encryptSecrets')) {
      return value;
    }
    
    const encryptionKey = key || this.get('security.encryptionKey');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
    
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive configuration value
   */
  decryptValue(encryptedValue, key = null) {
    if (!this.get('security.encryptSecrets')) {
      return encryptedValue;
    }
    
    try {
      const encryptionKey = key || this.get('security.encryptionKey');
      const [ivHex, encrypted] = encryptedValue.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[ConfigManager] Failed to decrypt value:', error);
      return null;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset(key = null) {
    if (key) {
      // Reset specific key
      this.config.delete(`user.${key}`);
      await this.saveConfiguration(key);
    } else {
      // Reset all user configurations
      for (const key of this.config.keys()) {
        if (key.startsWith('user.')) {
          this.config.delete(key);
        }
      }
    }
  }

  /**
   * Export configuration
   */
  export(includeDefaults = false) {
    const result = {};
    
    for (const [key, value] of this.config.entries()) {
      if (includeDefaults || key.startsWith('user.')) {
        const cleanKey = key.replace(/^(default|user)\./, '');
        this.setNestedValue(result, cleanKey, value);
      }
    }
    
    return result;
  }

  /**
   * Import configuration
   */
  async import(config, merge = true) {
    if (!merge) {
      // Clear existing user configs
      for (const key of this.config.keys()) {
        if (key.startsWith('user.')) {
          this.config.delete(key);
        }
      }
    }
    
    // Set new configurations
    for (const [key, value] of Object.entries(config)) {
      this.set(key, value, false);
    }
    
    // Save all configurations
    await this.saveAllConfigurations();
  }

  /**
   * Save all user configurations
   */
  async saveAllConfigurations() {
    const userConfigs = {};
    
    for (const [key, value] of this.config.entries()) {
      if (key.startsWith('user.')) {
        const cleanKey = key.replace('user.', '');
        this.setNestedValue(userConfigs, cleanKey, value);
      }
    }
    
    // Save each section
    for (const [section, config] of Object.entries(userConfigs)) {
      const configFile = path.join(this.configDir, `${section}.json`);
      try {
        await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      } catch (error) {
        console.error(`[ConfigManager] Failed to save ${section} config:`, error);
      }
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (this.configWatcher) {
      this.configWatcher.close();
    }
    
    if (this.saveTimers) {
      for (const timer of this.saveTimers.values()) {
        clearTimeout(timer);
      }
    }
    
    await this.saveAllConfigurations();
    this.config.clear();
    this.watchers.clear();
    this.encryptedCache.clear();
    this.schemaCache.clear();
    
    console.log('[ConfigManager] Shutdown complete');
  }
}

module.exports = ConfigManager;
