const { EventEmitter } = require('events');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

/**
 * Unified Streaming Manager
 * Handles real-time data streams, task monitoring, and inter-platform communication
 */
class StreamManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      port: config.port || 3001,
      host: config.host || 'localhost',
      enablePersistence: config.enablePersistence || true,
      maxConnections: config.maxConnections || 1000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      reconnectionEnabled: config.reconnectionEnabled !== false,
      compressionEnabled: config.compressionEnabled || true,
      ...config
    };

    // Server components
    this.server = null;
    this.wss = null;

    // Connection management
    this.connections = new Map();
    this.clientMetadata = new Map();
    this.subscriptionManager = new Map();

    // Task streaming
    this.taskStreams = new Map();
    this.streamBuffers = new Map();

    // Dynamic data streams
    this.dataStreams = new Map();
    this.streamFilters = new Map();

    // Performance monitoring
    this.metrics = {
      totalConnections: 0,
      activeStreams: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: [],
      avgResponseTime: 0
    };

    // Persistence
    this.persistencePath = config.persistencePath || './streaming-data.json';
  }

  /**
   * Initialize the streaming manager
   */
  async initialize() {
    try {
      console.log('[StreamManager] Initializing streaming manager...');

      // Create HTTP server for WebSocket upgrade handling
      this.server = http.createServer(this.handleHTTPRequest.bind(this));

      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: this.server,
        perMessageDeflate: this.config.compressionEnabled,
        maxPayload: 1024 * 1024 * 50 // 50MB max payload
      });

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers();

      // Start the server
      await this.startServer();

      // Setup stream monitoring
      this.setupStreamMonitoring();

      // Load persisted data if enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedData();
      }

      console.log(`[StreamManager] Streaming manager initialized on port ${this.config.port}`);

      this.emit('initialized');

    } catch (error) {
      console.error('[StreamManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent'] || 'unknown',
        connectedAt: new Date(),
        lastActivity: new Date(),
        authenticated: false,
        subscriptions: new Set()
      };

      // Store connection
      this.connections.set(clientId, ws);
      this.clientMetadata.set(clientId, clientInfo);
      this.subscriptionManager.set(clientId, new Set());

      console.log(`[StreamManager] Client connected: ${clientId}`);

      // Setup message handling
      ws.on('message', (data) => {
        try {
          const message = this.parseMessage(data);
          this.handleClientMessage(clientId, message, ws);
        } catch (error) {
          console.error(`[StreamManager] Failed to handle message from ${clientId}:`, error);
          this.sendError(clientId, 'INVALID_MESSAGE', 'Failed to parse message');
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[StreamManager] Client disconnected: ${clientId} (${code})`);
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[StreamManager] Client error for ${clientId}:`, error);
        this.handleClientError(clientId, error);
      });

      ws.on('pong', () => {
        clientInfo.lastActivity = new Date();
      });

      // Send welcome message
      this.sendMessage(clientId, 'WELCOME', {
        clientId,
        version: '1.0.0',
        capabilities: this.getCapabilities()
      });

      // Start heartbeat
      this.startHeartbeat(clientId);

      this.metrics.totalConnections++;
      this.emit('clientConnected', clientInfo);
    });
  }

  /**
   * Setup stream monitoring and cleanup
   */
  setupStreamMonitoring() {
    // Periodic cleanup of inactive connections
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, this.config.heartbeatInterval);

    // Stream buffer management
    setInterval(() => {
      this.manageStreamBuffers();
    }, 60000); // Every minute

    // Metrics collection
    setInterval(() => {
      this.updateMetrics();
    }, 30000); // Every 30 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  /**
   * Start the HTTP/WebSocket server
   */
  startServer() {
    return new Promise((resolve, reject) => {
      const server = this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[StreamManager] Server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });

      server.on('error', (error) => {
        console.error('[StreamManager] Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle HTTP requests (for health checks, etc.)
   */
  handleHTTPRequest(req, res) {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        connections: this.connections.size,
        streams: this.activeStreams.size,
        uptime: process.uptime()
      }));
    } else if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.metrics));
    } else {
      res.writeHead(404);
      res.end();
    }
  }

  /**
   * Parse incoming WebSocket message
   */
  parseMessage(data) {
    try {
      if (Buffer.isBuffer(data)) {
        data = data.toString();
      }

      // Handle binary messages (screenshots, etc.)
      if (data.startsWith('data:image/') || data.startsWith('data:application/')) {
        return { type: 'BINARY_DATA', data: data };
      }

      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Invalid message format: ${error.message}`);
    }
  }

  /**
   * Handle messages from clients
   */
  async handleClientMessage(clientId, message, ws) {
    try {
      this.metrics.messagesReceived++;

      switch (message.type) {
        case 'AUTHENTICATE':
          await this.handleAuthentication(clientId, message);
          break;

        case 'SUBSCRIBE':
          this.handleSubscription(clientId, message);
          break;

        case 'UNSUBSCRIBE':
          this.handleUnsubscription(clientId, message);
          break;

        case 'STREAM_DATA':
          await this.handleStreamData(clientId, message);
          break;

        case 'PING':
          this.sendMessage(clientId, 'PONG', { timestamp: Date.now() });
          break;

        case 'BINARY_DATA':
          await this.handleBinaryData(clientId, message);
          break;

        default:
          console.warn(`[StreamManager] Unknown message type: ${message.type} from ${clientId}`);
          this.sendError(clientId, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      }

      // Update client activity
      const clientInfo = this.clientMetadata.get(clientId);
      if (clientInfo) {
        clientInfo.lastActivity = new Date();
      }

    } catch (error) {
      console.error(`[StreamManager] Error handling message from ${clientId}:`, error);
      this.sendError(clientId, 'MESSAGE_HANDLING_ERROR', error.message);
    }
  }

  /**
   * Handle client authentication
   */
  async handleAuthentication(clientId, message) {
    try {
      // Basic authentication - in production, implement proper auth
      const { token, apiKey } = message.data || {};

      const isValid = this.validateAuthCredentials(token, apiKey);

      if (isValid) {
        const clientInfo = this.clientMetadata.get(clientId);
        clientInfo.authenticated = true;
        clientInfo.authenticatedAt = new Date();

        this.sendMessage(clientId, 'AUTHENTICATED', {
          clientId,
          capabilities: this.getFullCapabilities()
        });

        this.emit('clientAuthenticated', { clientId, ...clientInfo });
      } else {
        this.sendError(clientId, 'AUTHENTICATION_FAILED', 'Invalid credentials');
        this.disconnectClient(clientId); // Disconnect on auth failure
      }

    } catch (error) {
      console.error('[StreamManager] Authentication error:', error);
      this.sendError(clientId, 'AUTHENTICATION_ERROR', error.message);
    }
  }

  /**
   * Validate authentication credentials
   */
  validateAuthCredentials(token, apiKey) {
    // Simple validation - in production, implement proper token/API key validation
    return !!(token || apiKey); // Allow any non-empty token/key for demo
  }

  /**
   * Handle client subscription requests
   */
  handleSubscription(clientId, message) {
    const { streamId, filters } = message.data || {};

    if (!streamId) {
      this.sendError(clientId, 'INVALID_SUBSCRIPTION', 'Stream ID required');
      return;
    }

    const clientSubscriptions = this.subscriptionManager.get(clientId);
    clientSubscriptions.add(streamId);

    // Store filters if provided
    if (filters) {
      this.streamFilters.set(`${clientId}:${streamId}`, filters);
    }

    this.sendMessage(clientId, 'SUBSCRIBED', { streamId, filters });

    console.log(`[StreamManager] Client ${clientId} subscribed to ${streamId}`);

    this.emit('subscriptionCreated', { clientId, streamId, filters });
  }

  /**
   * Handle client unsubscription requests
   */
  handleUnsubscription(clientId, message) {
    const { streamId } = message.data || {};

    const clientSubscriptions = this.subscriptionManager.get(clientId);
    clientSubscriptions.delete(streamId);

    // Remove filters
    this.streamFilters.delete(`${clientId}:${streamId}`);

    this.sendMessage(clientId, 'UNSUBSCRIBED', { streamId });

    console.log(`[StreamManager] Client ${clientId} unsubscribed from ${streamId}`);

    this.emit('subscriptionRemoved', { clientId, streamId });
  }

  /**
   * Handle stream data from clients
   */
  async handleStreamData(clientId, message) {
    const { streamId, data, metadata } = message.data || {};

    if (!streamId) {
      this.sendError(clientId, 'INVALID_STREAM_DATA', 'Stream ID required');
      return;
    }

    // Route data to all subscribers of this stream
    this.routeStreamData(streamId, data, {
      ...metadata,
      sourceClientId: clientId,
      timestamp: Date.now()
    });

    this.emit('streamDataReceived', {
      streamId,
      data,
      sourceClientId: clientId,
      metadata
    });
  }

  /**
   * Handle binary data (screenshots, files, etc.)
   */
  async handleBinaryData(clientId, message) {
    const { data, filename, streamId, metadata } = message;

    // Store binary data
    const dataId = uuidv4();
    const binaryData = {
      id: dataId,
      clientId,
      filename: filename || `binary_${dataId}`,
      data: data, // base64 encoded
      size: Buffer.byteLength(data, 'base64'),
      receivedAt: new Date(),
      metadata
    };

    // Emit for processing
    this.emit('binaryDataReceived', binaryData);

    // Acknowledge receipt
    this.sendMessage(clientId, 'BINARY_DATA_ACK', {
      dataId,
      size: binaryData.size,
      filename: binaryData.filename
    });

    // Route to stream if specified
    if (streamId) {
      this.routeStreamData(streamId, {
        type: 'binary',
        dataId,
        filename: binaryData.filename,
        size: binaryData.size,
        metadata
      }, { sourceClientId: clientId });
    }
  }

  /**
   * Route stream data to subscribed clients
   */
  routeStreamData(streamId, data, metadata = {}) {
    const routedClients = [];

    // Find all clients subscribed to this stream
    for (const [clientId, subscriptions] of this.subscriptionManager) {
      if (subscriptions.has(streamId)) {
        const clientInfo = this.clientMetadata.get(clientId);
        if (clientInfo && clientInfo.authenticated) {
          // Apply filters if any
          const filterKey = `${clientId}:${streamId}`;
          const filters = this.streamFilters.get(filterKey);

          if (this.applyFilters(data, filters)) {
            this.sendMessage(clientId, 'STREAM_DATA', {
              streamId,
              data,
              metadata: {
                ...metadata,
                routedAt: Date.now()
              }
            });
            routedClients.push(clientId);
          }
        }
      }
    }

    console.log(`[StreamManager] Routed stream data ${streamId} to ${routedClients.length} clients`);

    return routedClients;
  }

  /**
   * Apply filters to stream data
   */
  applyFilters(data, filters) {
    if (!filters) return true;

    // Simple filter implementation - can be expanded
    if (filters.minValue !== undefined && data.value < filters.minValue) return false;
    if (filters.maxValue !== undefined && data.value > filters.maxValue) return false;
    if (filters.includeTypes && !filters.includeTypes.includes(data.type)) return false;
    if (filters.excludeTypes && filters.excludeTypes.includes(data.type)) return false;

    return true;
  }

  /**
   * Send message to specific client
   */
  sendMessage(clientId, type, data = {}) {
    try {
      const ws = this.connections.get(clientId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn(`[StreamManager] Cannot send message to ${clientId}: connection not available`);
        return false;
      }

      const message = {
        type,
        data,
        timestamp: Date.now(),
        messageId: uuidv4()
      };

      ws.send(JSON.stringify(message));
      this.metrics.messagesSent++;

      return true;

    } catch (error) {
      console.error(`[StreamManager] Failed to send message to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send error message to client
   */
  sendError(clientId, code, message, details = {}) {
    this.sendMessage(clientId, 'ERROR', {
      code,
      message,
      ...details
    });

    this.metrics.errors.push({
      clientId,
      code,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Create a new task stream for real-time task monitoring
   */
  createTaskStream(taskId, taskManager, options = {}) {
    const streamId = `task_${taskId}`;
    const stream = {
      id: streamId,
      taskId,
      taskManager,
      options,
      subscribers: new Set(),
      createdAt: new Date(),
      lastActivity: new Date()
    };

    // Setup task event forwarding
    const eventHandler = (event, data) => {
      const streamData = {
        type: 'task_event',
        event,
        taskId,
        data: {
          ...data,
          timestamp: Date.now()
        }
      };

      this.routeStreamData(streamId, streamData, { eventType: event });
    };

    // Listen to task manager events
    taskManager.on('taskCreated', (data) => data.id === taskId && eventHandler('created', data));
    taskManager.on('taskCompleted', (data) => data.id === taskId && eventHandler('completed', data));
    taskManager.on('taskFailed', (data) => data.id === taskId && eventHandler('failed', data));
    taskManager.on('taskUpdated', (data) => data.id === taskId && eventHandler('updated', data));

    this.taskStreams.set(taskId, stream);

    console.log(`[StreamManager] Task stream created: ${streamId}`);

    return stream;
  }

  /**
   * Create data stream for sensor/monitoring data
   */
  createDataStream(streamId, options = {}) {
    const stream = {
      id: streamId,
      options,
      createdAt: new Date(),
      buffers: [],
      aggregators: new Map()
    };

    // Setup data buffering if needed
    if (options.bufferSize) {
      stream.buffers = new Array(options.bufferSize);
      this.streamBuffers.set(streamId, stream.buffers);
    }

    this.dataStreams.set(streamId, stream);

    console.log(`[StreamManager] Data stream created: ${streamId}`);

    return stream;
  }

  /**
   * Start heartbeat monitoring for client
   */
  startHeartbeat(clientId) {
    const ws = this.connections.get(clientId);

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, this.config.heartbeatInterval);

    // Store for cleanup
    const clientInfo = this.clientMetadata.get(clientId);
    clientInfo.heartbeatTimer = heartbeat;
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnect(clientId) {
    console.log(`[StreamManager] Handling disconnect for client: ${clientId}`);

    // Clear subscriptions
    this.subscriptionManager.delete(clientId);

    // Clear filters
    for (const [key, _] of this.streamFilters) {
      if (key.startsWith(`${clientId}:`)) {
        this.streamFilters.delete(key);
      }
    }

    // Clear heartbeat timer
    const clientInfo = this.clientMetadata.get(clientId);
    if (clientInfo && clientInfo.heartbeatTimer) {
      clearInterval(clientInfo.heartbeatTimer);
    }

    // Remove from connections
    this.connections.delete(clientId);
    this.clientMetadata.delete(clientId);

    this.emit('clientDisconnected', { clientId });
  }

  /**
   * Handle client errors
   */
  handleClientError(clientId, error) {
    console.error(`[StreamManager] Client error for ${clientId}:`, error);

    this.sendError(clientId, 'CLIENT_ERROR', error.message);

    // Log error
    this.metrics.errors.push({
      clientId,
      error: error.message,
      timestamp: Date.now()
    });

    this.emit('clientError', { clientId, error });
  }

  /**
   * Disconnect client forcefully
   */
  disconnectClient(clientId) {
    const ws = this.connections.get(clientId);
    if (ws) {
      ws.close(1000, 'Disconnected by server');
    }
  }

  /**
   * Cleanup inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = this.config.heartbeatInterval * 2; // 2x heartbeat interval

    for (const [clientId, clientInfo] of this.clientMetadata) {
      if (now - clientInfo.lastActivity > timeout) {
        console.log(`[StreamManager] Disconnecting inactive client: ${clientId}`);
        this.disconnectClient(clientId);

        // Clean up subscriptions and filters
        this.subscriptionManager.delete(clientId);
        for (const [key, _] of this.streamFilters) {
          if (key.startsWith(`${clientId}:`)) {
            this.streamFilters.delete(key);
          }
        }
      }
    }
  }

  /**
   * Manage stream buffer sizes
   */
  manageStreamBuffers() {
    for (const [streamId, buffer] of this.streamBuffers) {
      // Keep buffer size in check
      if (buffer.length > 1000) { // Max 1000 items per buffer
        buffer.splice(0, buffer.length - 500); // Keep last 500 items
      }
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    this.metrics.activeStreams = this.taskStreams.size + this.dataStreams.size;
    this.metrics.activeClients = this.connections.size;

    // Calculate average response time (placeholder - could be improved)
    this.metrics.avgResponseTime = 50; // ms

    this.emit('metricsUpdated', { ...this.metrics });
  }

  /**
   * Get streaming capabilities
   */
  getCapabilities() {
    return {
      streams: true,
      tasks: true,
      monitoring: true,
      binaryData: true,
      compression: this.config.compressionEnabled,
      authentication: true,
      filters: true
    };
  }

  /**
   * Get full capabilities (after authentication)
   */
  getFullCapabilities() {
    return {
      ...this.getCapabilities(),
      dataStreams: true,
      bufferManagement: true,
      persistence: this.config.enablePersistence,
      maxConnections: this.config.maxConnections
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastMessage(type, data = {}) {
    const clients = Array.from(this.connections.keys());
    let sentCount = 0;

    for (const clientId of clients) {
      if (this.sendMessage(clientId, type, data)) {
        sentCount++;
      }
    }

    console.log(`[StreamManager] Broadcast ${type} to ${sentCount}/${clients.length} clients`);

    return sentCount;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.connections.size,
      authenticatedConnections: Array.from(this.clientMetadata.values()).filter(c => c.authenticated).length,
      subscriptionCount: Array.from(this.subscriptionManager.values()).reduce((sum, subs) => sum + subs.size, 0)
    };
  }

  /**
   * Load persisted data
   */
  async loadPersistedData() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const persisted = JSON.parse(data);

      console.log(`[StreamManager] Loaded persisted data: ${Object.keys(persisted).length} items`);

      // Could restore streams, subscriptions, etc. here

    } catch (error) {
      console.warn(`[StreamManager] Failed to load persisted data: ${error.message}`);
    }
  }

  /**
   * Save current state for persistence
   */
  async persistData() {
    if (!this.config.enablePersistence) return;

    try {
      const dataToPersist = {
        streams: {},
        subscriptions: Object.fromEntries(this.subscriptionManager),
        filters: Object.fromEntries(this.streamFilters),
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      };

      // Save minimal stream info
      for (const [taskId, stream] of this.taskStreams) {
        dataToPersist.streams[taskId] = {
          id: stream.id,
          createdAt: stream.createdAt,
          options: stream.options
        };
      }

      await fs.writeFile(this.persistencePath, JSON.stringify(dataToPersist, null, 2));

    } catch (error) {
      console.error(`[StreamManager] Failed to persist data: ${error.message}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    console.log('[StreamManager] Initiating graceful shutdown...');

    // Save persistence data
    if (this.config.enablePersistence) {
      await this.persistData();
    }

    // Broadcast shutdown message
    this.broadcastMessage('SERVER_SHUTDOWN', {
      reason: 'Server shutdown initiated',
      timestamp: Date.now()
    });

    // Close all connections
    const closePromises = [];
    for (const [clientId, ws] of this.connections) {
      closePromises.push(new Promise((resolve) => {
        ws.on('close', resolve);
        ws.close(1001, 'Server shutdown');
      }));
    }

    await Promise.all(closePromises);

    // Close server
    if (this.server) {
      this.server.close(() => {
        console.log('[StreamManager] HTTP server closed');
      });
    }

    // Cleanup timers
    for (const clientInfo of this.clientMetadata.values()) {
      if (clientInfo.heartbeatTimer) {
        clearInterval(clientInfo.heartbeatTimer);
      }
    }

    console.log('[StreamManager] Graceful shutdown completed');
    this.emit('shutdown');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.gracefulShutdown();
  }
}

module.exports = StreamManager;
