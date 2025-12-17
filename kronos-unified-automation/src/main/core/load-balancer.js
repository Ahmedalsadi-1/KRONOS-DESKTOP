const { EventEmitter } = require('events');
const crypto = require('crypto');
const net = require('net');

/**
 * Load Balancer for distributing requests across multiple service instances
 * Provides various load balancing algorithms and health checking
 */
class LoadBalancer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      algorithm: config.algorithm || 'round-robin', // round-robin, random, least-connections, weighted, consistent-hash
      healthCheckEnabled: config.healthCheckEnabled !== false,
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      healthCheckTimeout: config.healthCheckTimeout || 5000, // 5 seconds
      healthCheckPath: config.healthCheckPath || '/health',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      circuitBreakerEnabled: config.circuitBreakerEnabled !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      circuitBreakerRecovery: config.circuitBreakerRecovery || 0.5, // 50% success rate to recover
      stickySessions: config.stickySessions || false,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      metricsEnabled: config.metricsEnabled !== false,
      ...config
    };

    this.pools = new Map(); // poolName -> ServicePool
    this.backends = new Map(); // backendId -> BackendInfo
    this.sessions = new Map(); // sessionId -> SessionInfo
    this.metrics = new Map(); // backendId -> Metrics
    this.circuitBreakers = new Map(); // backendId -> CircuitBreaker
    this.routingTable = new Map(); // hash -> backendId for consistent hashing
    this.nextIndex = new Map(); // For round-robin algorithm
    this.random = crypto.randomBytes(4).readUInt32BE(0);
  }

  /**
   * Initialize load balancer
   */
  async initialize() {
    try {
      if (this.config.healthCheckEnabled) {
        this.startHealthChecks();
      }
      
      if (this.config.metricsEnabled) {
        this.startMetricsCollection();
      }
      
      console.log('[LoadBalancer] Initialized successfully');
    } catch (error) {
      console.error('[LoadBalancer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create service pool
   */
  createPool(name, config = {}) {
    const pool = new ServicePool(name, {
      ...this.config,
      ...config
    });
    
    this.pools.set(name, pool);
    pool.on('backendAdded', (backend) => this.handleBackendAdded(backend));
    pool.on('backendRemoved', (backend) => this.handleBackendRemoved(backend));
    pool.on('healthChanged', (backendId, isHealthy) => this.handleHealthChanged(backendId, isHealthy));
    
    return pool;
  }

  /**
   * Get service pool
   */
  getPool(name) {
    return this.pools.get(name);
  }

  /**
   * Add backend to pool
   */
  async addBackend(poolName, backendInfo) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    await pool.addBackend(backendInfo);
    this.registerBackend(backendInfo);
  }

  /**
   * Remove backend from pool
   */
  async removeBackend(poolName, backendId) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    await pool.removeBackend(backendId);
    this.unregisterBackend(backendId);
  }

  /**
   * Route request to backend
   */
  async routeRequest(poolName, request, sessionId = null) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    const backends = pool.getHealthyBackends();
    if (backends.length === 0) {
      throw new Error(`No healthy backends available in pool ${poolName}`);
    }
    
    // Handle sticky sessions
    if (this.config.stickySessions && sessionId) {
      const session = this.getSession(sessionId);
      if (session && session.backendId && this.isBackendHealthy(session.backendId)) {
        const backend = this.getBackend(session.backendId);
        if (backend) {
          return this.executeRequest(backend, request, sessionId);
        }
      }
    }
    
    // Select backend using configured algorithm
    const selectedBackend = this.selectBackend(backends, request, sessionId);
    
    if (!selectedBackend) {
      throw new Error('Failed to select backend');
    }
    
    // Create session if sticky sessions enabled
    if (this.config.stickySessions && sessionId) {
      this.createSession(sessionId, selectedBackend.id);
    }
    
    return this.executeRequest(selectedBackend, request, sessionId);
  }

  /**
   * Select backend using configured algorithm
   */
  selectBackend(backends, request, sessionId) {
    switch (this.config.algorithm) {
      case 'round-robin':
        return this.selectRoundRobin(backends);
      case 'random':
        return this.selectRandom(backends);
      case 'least-connections':
        return this.selectLeastConnections(backends);
      case 'weighted':
        return this.selectWeighted(backends);
      case 'consistent-hash':
        return this.selectConsistentHash(backends, request);
      case 'least-response-time':
        return this.selectLeastResponseTime(backends);
      default:
        return this.selectRoundRobin(backends);
    }
  }

  /**
   * Round-robin selection
   */
  selectRoundRobin(backends) {
    const poolName = this.getPoolNameForBackends(backends);
    if (!this.nextIndex.has(poolName)) {
      this.nextIndex.set(poolName, 0);
    }
    
    const index = this.nextIndex.get(poolName);
    const selected = backends[index % backends.length];
    this.nextIndex.set(poolName, (index + 1) % backends.length);
    
    return selected;
  }

  /**
   * Random selection
   */
  selectRandom(backends) {
    const index = Math.floor(Math.random() * backends.length);
    return backends[index];
  }

  /**
   * Least connections selection
   */
  selectLeastConnections(backends) {
    return backends.reduce((min, backend) => {
      const connections = this.getBackendConnections(backend.id);
      return (!min || connections < this.getBackendConnections(min.id)) ? backend : min;
    });
  }

  /**
   * Weighted selection
   */
  selectWeighted(backends) {
    const weights = backends.map(backend => backend.weight || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < backends.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return backends[i];
      }
    }
    
    return backends[0];
  }

  /**
   * Consistent hash selection
   */
  selectConsistentHash(backends, request) {
    const hash = this.hashRequest(request);
    const sortedBackends = this.getSortedBackendsByHash(backends);
    
    for (const backend of sortedBackends) {
      const backendHash = this.getBackendHash(backend.id);
      if (hash >= backendHash) {
        return backend;
      }
    }
    
    return sortedBackends[0]; // Wrap around to first backend
  }

  /**
   * Least response time selection
   */
  selectLeastResponseTime(backends) {
    return backends.reduce((min, backend) => {
      const metrics = this.metrics.get(backend.id);
      const responseTime = metrics ? metrics.averageResponseTime : Infinity;
      
      const minMetrics = min ? this.metrics.get(min.id) : null;
      const minResponseTime = minMetrics ? minMetrics.averageResponseTime : Infinity;
      
      return (!min || responseTime < minResponseTime) ? backend : min;
    });
  }

  /**
   * Execute request on backend
   */
  async executeRequest(backend, request, sessionId) {
    const circuitBreaker = this.getCircuitBreaker(backend.id);
    
    if (!circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker open for backend ${backend.id}`);
    }
    
    const startTime = Date.now();
    let success = false;
    let error = null;
    
    try {
      const response = await this.sendRequestToBackend(backend, request);
      success = true;
      
      this.updateMetrics(backend.id, {
        responseTime: Date.now() - startTime,
        success: true,
        timestamp: new Date()
      });
      
      circuitBreaker.recordSuccess();
      return response;
      
    } catch (err) {
      error = err;
      success = false;
      
      this.updateMetrics(backend.id, {
        responseTime: Date.now() - startTime,
        success: false,
        error: err.message,
        timestamp: new Date()
      });
      
      circuitBreaker.recordFailure();
      throw err;
      
    } finally {
      this.emit('requestCompleted', {
        backendId: backend.id,
        request,
        sessionId,
        responseTime: Date.now() - startTime,
        success,
        error
      });
    }
  }

  /**
   * Send request to backend
   */
  async sendRequestToBackend(backend, request) {
    if (backend.protocol === 'http' || backend.protocol === 'https') {
      return this.sendHttpRequest(backend, request);
    } else if (backend.protocol === 'ws' || backend.protocol === 'wss') {
      return this.sendWebSocketRequest(backend, request);
    } else if (backend.protocol === 'tcp') {
      return this.sendTcpRequest(backend, request);
    } else {
      throw new Error(`Unsupported protocol: ${backend.protocol}`);
    }
  }

  /**
   * Send HTTP request to backend
   */
  async sendHttpRequest(backend, request) {
    const fetch = require('fetch');
    
    const url = new URL(request.path || '/', backend.url);
    if (request.query) {
      Object.entries(request.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    
    const options = {
      method: request.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LoadBalancer/1.0',
        ...request.headers
      }
    };
    
    if (request.body) {
      options.body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }
    
    const response = await fetch(url.toString(), options);
    
    if (!response.ok) {
      throw new Error(`Backend ${backend.id} returned ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  /**
   * Send WebSocket request to backend
   */
  async sendWebSocketRequest(backend, request) {
    return new Promise((resolve, reject) => {
      const WebSocket = require('ws');
      const ws = new WebSocket(backend.url);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket request to ${backend.id} timed out`));
      }, this.config.healthCheckTimeout);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        
        if (request.message) {
          ws.send(JSON.stringify(request.message));
        }
        
        ws.on('message', (data) => {
          try {
            const response = JSON.parse(data);
            ws.close();
            resolve(response);
          } catch (err) {
            ws.close();
            reject(err);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send TCP request to backend
   */
  async sendTcpRequest(backend, request) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`TCP request to ${backend.id} timed out`));
      }, this.config.healthCheckTimeout);
      
      socket.connect(backend.port, backend.host, () => {
        clearTimeout(timeout);
        
        const message = typeof request.message === 'string' ? request.message : JSON.stringify(request.message);
        socket.write(message);
      });
      
      let data = '';
      
      socket.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      socket.on('end', () => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (err) {
          resolve(data);
        }
      });
      
      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Hash request for consistent hashing
   */
  hashRequest(request) {
    const hashInput = request.key || request.sessionId || request.ip || JSON.stringify(request);
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Get sorted backends by hash for consistent hashing
   */
  getSortedBackendsByHash(backends) {
    return backends.sort((a, b) => {
      const hashA = this.getBackendHash(a.id);
      const hashB = this.getBackendHash(b.id);
      return hashA.localeCompare(hashB);
    });
  }

  /**
   * Get backend hash for consistent hashing
   */
  getBackendHash(backendId) {
    if (!this.routingTable.has(backendId)) {
      const hash = crypto.createHash('md5').update(backendId).digest('hex');
      this.routingTable.set(backendId, hash);
    }
    return this.routingTable.get(backendId);
  }

  /**
   * Get pool name for backends
   */
  getPoolNameForBackends(backends) {
    for (const [poolName, pool] of this.pools) {
      if (backends.every(backend => pool.hasBackend(backend.id))) {
        return poolName;
      }
    }
    return 'default';
  }

  /**
   * Get backend connections count
   */
  getBackendConnections(backendId) {
    const metrics = this.metrics.get(backendId);
    return metrics ? metrics.activeConnections : 0;
  }

  /**
   * Check if backend is healthy
   */
  isBackendHealthy(backendId) {
    const backend = this.backends.get(backendId);
    return backend && backend.healthy;
  }

  /**
   * Register backend
   */
  registerBackend(backendInfo) {
    this.backends.set(backendInfo.id, {
      ...backendInfo,
      healthy: true,
      lastHealthCheck: new Date()
    });
    
    this.initializeMetrics(backendInfo.id);
    this.initializeCircuitBreaker(backendInfo.id);
  }

  /**
   * Unregister backend
   */
  unregisterBackend(backendId) {
    this.backends.delete(backendId);
    this.metrics.delete(backendId);
    this.circuitBreakers.delete(backendId);
    this.routingTable.delete(backendId);
  }

  /**
   * Initialize metrics for backend
   */
  initializeMetrics(backendId) {
    this.metrics.set(backendId, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeConnections: 0,
      lastRequest: null,
      errors: []
    });
  }

  /**
   * Update metrics for backend
   */
  updateMetrics(backendId, metricData) {
    const metrics = this.metrics.get(backendId);
    if (!metrics) return;
    
    metrics.totalRequests++;
    metrics.lastRequest = metricData.timestamp;
    
    if (metricData.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errors.push({
        error: metricData.error,
        timestamp: metricData.timestamp
      });
      
      // Keep only last 10 errors
      if (metrics.errors.length > 10) {
        metrics.errors.shift();
      }
    }
    
    // Update average response time
    const alpha = 0.1; // Exponential moving average factor
    if (metrics.averageResponseTime === 0) {
      metrics.averageResponseTime = metricData.responseTime;
    } else {
      metrics.averageResponseTime = alpha * metricData.responseTime + (1 - alpha) * metrics.averageResponseTime;
    }
  }

  /**
   * Initialize circuit breaker for backend
   */
  initializeCircuitBreaker(backendId) {
    this.circuitBreakers.set(backendId, new CircuitBreaker({
      threshold: this.config.circuitBreakerThreshold,
      timeout: this.config.circuitBreakerTimeout,
      recovery: this.config.circuitBreakerRecovery
    }));
  }

  /**
   * Get circuit breaker for backend
   */
  getCircuitBreaker(backendId) {
    return this.circuitBreakers.get(backendId);
  }

  /**
   * Create session for sticky sessions
   */
  createSession(sessionId, backendId) {
    this.sessions.set(sessionId, {
      backendId,
      createdAt: new Date(),
      lastAccessed: new Date()
    });
    
    // Clean up expired sessions periodically
    setTimeout(() => this.cleanupSessions(), 60000); // Every minute
  }

  /**
   * Get session
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check if session expired
    if (Date.now() - session.lastAccessed > this.config.sessionTimeout) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Update last accessed time
    session.lastAccessed = new Date();
    return session;
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = Date.now();
    const timeout = this.config.sessionTimeout;
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessed > timeout) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all backends
   */
  async performHealthChecks() {
    for (const [backendId, backend] of this.backends) {
      try {
        const isHealthy = await this.checkBackendHealth(backend);
        
        if (backend.healthy !== isHealthy) {
          backend.healthy = isHealthy;
          backend.lastHealthCheck = new Date();
          this.emit('healthChanged', backendId, isHealthy);
        }
        
      } catch (error) {
        if (backend.healthy !== false) {
          backend.healthy = false;
          backend.lastHealthCheck = new Date();
          this.emit('healthChanged', backendId, false);
        }
      }
    }
  }

  /**
   * Check backend health
   */
  async checkBackendHealth(backend) {
    if (backend.protocol === 'http' || backend.protocol === 'https') {
      return await this.checkHttpHealth(backend);
    } else if (backend.protocol === 'tcp') {
      return await this.checkTcpHealth(backend);
    } else {
      return true; // Assume healthy for unknown protocols
    }
  }

  /**
   * Check HTTP backend health
   */
  async checkHttpHealth(backend) {
    try {
      const fetch = require('fetch');
      const url = new URL(this.config.healthCheckPath, backend.url);
      
      const response = await fetch(url.toString(), {
        timeout: this.config.healthCheckTimeout,
        method: 'GET'
      });
      
      return response.ok;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Check TCP backend health
   */
  async checkTcpHealth(backend) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, this.config.healthCheckTimeout);
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      
      socket.connect(backend.port, backend.host);
    });
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.emit('metricsUpdate', this.getMetricsSummary());
    }, 60000); // Every minute
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary = {
      totalBackends: this.backends.size,
      healthyBackends: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      pools: {}
    };
    
    let totalResponseTime = 0;
    let totalErrors = 0;
    
    for (const [backendId, metrics] of this.metrics) {
      summary.totalRequests += metrics.totalRequests;
      totalResponseTime += metrics.averageResponseTime;
      totalErrors += metrics.failedRequests;
      
      if (this.backends.get(backendId)?.healthy) {
        summary.healthyBackends++;
      }
    }
    
    if (this.metrics.size > 0) {
      summary.averageResponseTime = totalResponseTime / this.metrics.size;
      summary.errorRate = summary.totalRequests > 0 ? totalErrors / summary.totalRequests : 0;
    }
    
    // Pool-specific metrics
    for (const [poolName, pool] of this.pools) {
      summary.pools[poolName] = {
        totalBackends: pool.getAllBackends().length,
        healthyBackends: pool.getHealthyBackends().length,
        algorithm: pool.config.algorithm
      };
    }
    
    return summary;
  }

  /**
   * Handle backend events
   */
  handleBackendAdded(backend) {
    this.registerBackend(backend);
    this.emit('backendAdded', backend);
  }

  handleBackendRemoved(backend) {
    this.unregisterBackend(backend.id);
    this.emit('backendRemoved', backend);
  }

  handleHealthChanged(backendId, isHealthy) {
    this.emit('healthChanged', backendId, isHealthy);
  }

  /**
   * Get load balancer statistics
   */
  getStatistics() {
    return {
      pools: this.pools.size,
      backends: this.backends.size,
      sessions: this.sessions.size,
      metrics: this.metrics.size,
      circuitBreakers: this.circuitBreakers.size,
      config: this.config
    };
  }

  /**
   * Shutdown load balancer
   */
  async shutdown() {
    console.log('[LoadBalancer] Shutting down...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all circuit breakers
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    
    // Clear all data
    this.pools.clear();
    this.backends.clear();
    this.sessions.clear();
    this.metrics.clear();
    this.circuitBreakers.clear();
    this.routingTable.clear();
    this.nextIndex.clear();
    
    console.log('[LoadBalancer] Shutdown complete');
  }
}

/**
 * Service Pool
 */
class ServicePool extends EventEmitter {
  constructor(name, config) {
    super();
    this.name = name;
    this.config = config;
    this.backends = new Map(); // backendId -> BackendInfo
    this.healthyBackends = new Set();
  }

  async addBackend(backendInfo) {
    const backend = {
      ...backendInfo,
      pool: this.name,
      addedAt: new Date()
    };
    
    this.backends.set(backendInfo.id, backend);
    this.healthyBackends.add(backendInfo.id);
    
    this.emit('backendAdded', backend);
  }

  async removeBackend(backendId) {
    const backend = this.backends.get(backendId);
    if (!backend) return;
    
    this.backends.delete(backendId);
    this.healthyBackends.delete(backendId);
    
    this.emit('backendRemoved', backend);
  }

  hasBackend(backendId) {
    return this.backends.has(backendId);
  }

  getAllBackends() {
    return Array.from(this.backends.values());
  }

  getHealthyBackends() {
    const healthyBackends = [];
    for (const backendId of this.healthyBackends) {
      const backend = this.backends.get(backendId);
      if (backend) {
        healthyBackends.push(backend);
      }
    }
    return healthyBackends;
  }

  setBackendHealth(backendId, isHealthy) {
    if (isHealthy) {
      this.healthyBackends.add(backendId);
    } else {
      this.healthyBackends.delete(backendId);
    }
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  constructor(config) {
    this.threshold = config.threshold || 5;
    this.timeout = config.timeout || 60000;
    this.recovery = config.recovery || 0.5;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    } else if (this.state === 'HALF_OPEN') {
      return true;
    } else { // OPEN
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      return false;
    }
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) { // Need 2 successes to close
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

module.exports = LoadBalancer;
