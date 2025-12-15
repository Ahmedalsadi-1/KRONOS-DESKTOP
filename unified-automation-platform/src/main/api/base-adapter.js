const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Base API Adapter Class
 * Provides common functionality for all platform-specific adapters
 */
class BaseAPIAdapter extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      name: config.name,
      version: config.version || '1.0.0',
      baseUrl: config.baseUrl,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      authRequired: config.authRequired || false,
      supportedFeatures: config.supportedFeatures || [],
      healthCheckPath: config.healthCheckPath || '/health',
      ...config
    };

    this.isConnected = false;
    this.isAuthenticated = false;
    this.authTokens = null;
    this.lastActivity = new Date();
    this.connectionMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null
    };

    this.retryQueue = [];
    this.activeRequests = new Map();
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    try {
      console.log(`[${this.config.name}] Initializing adapter...`);
      
      // Validate configuration
      this.validateConfig();
      
      // Check health
      await this.checkHealth();
      
      // Setup authentication if required
      if (this.config.authRequired) {
        await this.setupAuthentication();
      }
      
      this.isConnected = true;
      this.emit('connected');
      
      console.log(`[${this.config.name}] Adapter initialized successfully`);
    } catch (error) {
      console.error(`[${this.config.name}] Failed to initialize:`, error);
      throw error;
    }
  }

  /**
   * Validate adapter configuration
   */
  validateConfig() {
    if (!this.config.name) {
      throw new Error('Adapter name is required');
    }
    
    if (!this.config.baseUrl) {
      throw new Error('Base URL is required');
    }
    
    // Validate URL format
    try {
      new URL(this.config.baseUrl);
    } catch (error) {
      throw new Error(`Invalid base URL: ${this.config.baseUrl}`);
    }
  }

  /**
   * Check service health
   */
  async checkHealth() {
    try {
      const healthUrl = new URL(this.config.healthCheckPath, this.config.baseUrl).toString();
      const response = await this.makeRequest('GET', healthUrl);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      this.isConnected = true;
      this.emit('healthCheck', { status: 'healthy', timestamp: new Date() });
      
      return true;
    } catch (error) {
      this.isConnected = false;
      this.emit('healthCheck', { status: 'unhealthy', error: error.message, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * Setup authentication (override in subclasses)
   */
  async setupAuthentication() {
    // Default implementation - override in subclasses
    if (this.config.authRequired) {
      throw new Error('Authentication required but not implemented');
    }
  }

  /**
   * Create a task (override in subclasses)
   */
  async createTask(taskData) {
    throw new Error('createTask must be implemented by subclass');
  }

  /**
   * Get task status (override in subclasses)
   */
  async getTaskStatus(taskId) {
    throw new Error('getTaskStatus must be implemented by subclass');
  }

  /**
   * Cancel task (override in subclasses)
   */
  async cancelTask(taskId) {
    throw new Error('cancelTask must be implemented by subclass');
  }

  /**
   * Get tasks list (override in subclasses)
   */
  async getTasks(filters = {}) {
    throw new Error('getTasks must be implemented by subclass');
  }

  /**
   * Create WebSocket connection for task streaming (override in subclasses)
   */
  createTaskStream(taskId, options = {}) {
    throw new Error('createTaskStream must be implemented by subclass');
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeRequest(method, url, options = {}) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      this.updateLastActivity();
      this.connectionMetrics.totalRequests++;
      
      const fetch = require('fetch');
      
      const requestOptions = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `${this.config.name}/${this.config.version}`,
          ...this.getAuthHeaders(),
          ...options.headers
        },
        timeout: this.config.timeout,
        ...options
      };

      // Add body for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(requestOptions.method) && options.body) {
        requestOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      const response = await fetch(url, requestOptions);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      
      if (response.ok) {
        this.connectionMetrics.successfulRequests++;
        this.connectionMetrics.lastError = null;
        
        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return {
            ok: response.ok,
            status: response.status,
            data: await response.json(),
            headers: response.headers,
            responseTime
          };
        } else {
          return {
            ok: response.ok,
            status: response.status,
            data: await response.text(),
            headers: response.headers,
            responseTime
          };
        }
      } else {
        throw new APIError(response.status, response.statusText, await this.parseErrorResponse(response));
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.connectionMetrics.failedRequests++;
      this.connectionMetrics.lastError = error.message;
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle network errors
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new APIError(408, 'Request Timeout', { message: 'Request timed out' });
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        throw new APIError(503, 'Service Unavailable', { message: 'Service is not reachable' });
      } else {
        throw new APIError(500, 'Internal Server Error', { message: error.message });
      }
    }
  }

  /**
   * Make request with retry logic
   */
  async makeRequestWithRetry(method, url, options = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        return await this.makeRequest(method, url, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication errors or client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          break;
        }
        
        // Don't retry on last attempt
        if (attempt === this.config.retries) {
          break;
        }
        
        // Wait before retrying
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
        
        this.emit('retry', { attempt: attempt + 1, delay, error: error.message });
      }
    }
    
    throw lastError;
  }

  /**
   * Get authentication headers (override in subclasses)
   */
  getAuthHeaders() {
    const headers = {};
    
    if (this.isAuthenticated && this.authTokens) {
      if (this.authTokens.accessToken) {
        headers['Authorization'] = `Bearer ${this.authTokens.accessToken}`;
      } else if (this.authTokens.apiKey) {
        headers['X-API-Key'] = this.authTokens.apiKey;
      }
    }
    
    return headers;
  }

  /**
   * Parse error response
   */
  async parseErrorResponse(response) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return { message: await response.text() };
      }
    } catch (error) {
      return { message: 'Unknown error' };
    }
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity() {
    this.lastActivity = new Date();
  }

  /**
   * Update response time metrics
   */
  updateResponseTime(responseTime) {
    const alpha = 0.1; // Exponential moving average
    if (this.connectionMetrics.averageResponseTime === 0) {
      this.connectionMetrics.averageResponseTime = responseTime;
    } else {
      this.connectionMetrics.averageResponseTime = alpha * responseTime + (1 - alpha) * this.connectionMetrics.averageResponseTime;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get adapter status
   */
  getStatus() {
    return {
      name: this.config.name,
      version: this.config.version,
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      baseUrl: this.config.baseUrl,
      lastActivity: this.lastActivity,
      metrics: { ...this.connectionMetrics },
      features: this.config.supportedFeatures
    };
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    return {
      ...this.connectionMetrics,
      successRate: this.connectionMetrics.totalRequests > 0 
        ? (this.connectionMetrics.successfulRequests / this.connectionMetrics.totalRequests) * 100 
        : 0,
      uptime: Date.now() - this.lastActivity.getTime()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.connectionMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null
    };
    this.emit('metricsReset');
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    console.log(`[${this.config.name}] Disconnecting adapter...`);
    
    this.isConnected = false;
    this.isAuthenticated = false;
    this.authTokens = null;
    
    // Cancel active requests
    for (const [requestId, request] of this.activeRequests) {
      if (request.abortController) {
        request.abortController.abort();
      }
    }
    this.activeRequests.clear();
    
    this.emit('disconnected');
    console.log(`[${this.config.name}] Adapter disconnected`);
  }

  /**
   * Reconnect to service
   */
  async reconnect() {
    console.log(`[${this.config.name}] Reconnecting adapter...`);
    
    try {
      await this.disconnect();
      await this.initialize();
      this.emit('reconnected');
    } catch (error) {
      console.error(`[${this.config.name}] Reconnection failed:`, error);
      throw error;
    }
  }
}

/**
 * Custom API Error Class
 */
class APIError extends Error {
  constructor(status, statusText, details = {}) {
    super(details.message || statusText);
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

module.exports = {
  BaseAPIAdapter,
  APIError
};
