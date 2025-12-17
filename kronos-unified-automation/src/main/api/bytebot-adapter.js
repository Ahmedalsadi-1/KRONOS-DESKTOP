const { BaseAPIAdapter, APIError } = require('./base-adapter');
const axios = require('axios');
const WebSocket = require('ws');

/**
 * Bytebot API Adapter
 * Handles communication with Bytebot platform for computer automation tasks
 */
class BytebotAdapter extends BaseAPIAdapter {
  constructor(config = {}) {
    super({
      name: 'Bytebot',
      version: '1.0.0',
      baseUrl: config.baseUrl || 'http://localhost:4004',
      timeout: config.timeout || 30000,
      authRequired: config.authRequired !== false, // auth typically required
      supportedFeatures: [
        'computer-control',
        'desktop-automation',
        'screen-capture',
        'input-simulation',
        'process-automation',
        'file-system-access',
        'application-interaction'
      ],
      healthCheckPath: '/health',
      ...config
    });

    this.apiKey = config.apiKey;
    this.authToken = config.authToken;
    this.websocketUrl = config.websocketUrl || 'ws://localhost:4004/ws';
    this.activeSessions = new Map();
    this.automationTasks = new Map();
    this.connectedSockets = new Map();
  }

  /**
   * Setup authorization headers
   */
  async setupAuthentication() {
    if (this.config.authRequired) {
      if (!this.apiKey && !this.authToken) {
        // Try to get token from environment or config
        this.apiKey = process.env.BYTEBOT_API_KEY;
        this.authToken = process.env.BYTEBOT_AUTH_TOKEN;
      }

      if (!this.apiKey && !this.authToken) {
        console.warn('[Bytebot] No authentication credentials provided');
      } else {
        this.authToken = this.authToken || await this.authenticateWithKey(this.apiKey);
      }
    }

    this.isAuthenticated = true;
  }

  /**
   * Authenticate using API key
   */
  async authenticateWithKey(apiKey) {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/token`, {
        api_key: apiKey
      });

      return response.data.token;
    } catch (error) {
      console.error('[Bytebot] Authentication failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    try {
      console.log('[Bytebot] Initializing adapter...');

      // Setup authentication
      await this.setupAuthentication();

      // Check connection
      await this.checkHealth();

      // Setup WebSocket if available
      await this.setupWebSocket();

      this.isConnected = true;
      this.emit('connected');

      console.log('[Bytebot] Adapter initialized successfully');
    } catch (error) {
      console.error('[Bytebot] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket connection for real-time updates
   */
  async setupWebSocket() {
    try {
      if (!this.websocketUrl) return;

      const ws = new WebSocket(this.websocketUrl, [], {
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      ws.on('open', () => {
        console.log('[Bytebot] WebSocket connected');
        this.emit('websocketConnected');

        // Send heartbeat
        setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30000);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.warn('[Bytebot] Failed to parse WebSocket message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('[Bytebot] WebSocket error:', error);
        this.emit('websocketError', error);
      });

      ws.on('close', () => {
        console.log('[Bytebot] WebSocket disconnected');
        this.emit('websocketDisconnected');
      });

      // Store for cleanup
      this.wsConnection = ws;

      // Wait for initial connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.once('error', reject);
      });

    } catch (error) {
      console.warn('[Bytebot] WebSocket setup failed, continuing without real-time updates:', error.message);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'automation_update':
        this.emit('automationUpdate', message.data);
        break;
      case 'session_status':
        this.handleSessionUpdate(message.data);
        break;
      case 'task_complete':
        this.emit('taskCompleted', message.data);
        break;
      case 'error':
        console.error('[Bytebot] WebSocket error:', message.data);
        this.emit('automationError', message.data);
        break;
    }
  }

  /**
   * Handle session status updates
   */
  handleSessionUpdate(data) {
    const session = this.activeSessions.get(data.sessionId);
    if (session) {
      Object.assign(session, data);
      this.emit('sessionUpdated', session);
    }
  }

  /**
   * Create a new automation task
   */
  async createTask(taskData) {
    try {
      console.log('[Bytebot] Creating automation task:', taskData.title);

      const taskId = taskData.id || this.generateTaskId();

      const task = {
        id: taskId,
        platform: 'bytebot',
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: taskData.description || taskData.prompt,
        automation: {
          actions: [],
          screenshots: [],
          sessionId: null,
          config: {
            takeScreenshots: true,
            headless: false,
            timeout: taskData.timeout || 30000,
            maxRetries: taskData.maxRetries || 3,
            ...taskData.automationConfig
          }
        },
        metadata: {
          userAgent: taskData.userAgent || 'Bytebot AI Assistant',
          environment: 'development',
          capabilities: taskData.capabilities || this.getCapabilities()
        }
      };

      this.activeTasks.set(taskId, task);

      // Parse and execute automation
      await this.executeAutomationTask(task);

      this.emit('taskCreated', task);
      console.log('[Bytebot] Automation task created:', taskId);

      return task;

    } catch (error) {
      console.error('[Bytebot] Failed to create task:', error);
      throw new APIError(500, 'Task Creation Failed', {
        message: error.message,
        taskData
      });
    }
  }

  /**
   * Execute automation task
   */
  async executeAutomationTask(task) {
    try {
      task.status = 'executing';
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);

      // Start desktop session
      const sessionId = await this.startSession(task);
      task.automation.sessionId = sessionId;

      // Parse actions from description
      const actions = this.parseAutomationActions(task.description);
      task.automation.actions = actions;

      // Execute actions sequentially
      for (const action of actions) {
        await this.executeAction(task, action);
      }

      // Mark as completed
      task.status = 'completed';
      task.completedAt = new Date();
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);

      // Close session
      await this.endSession(sessionId);

      this.emit('taskCompleted', task);

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      this.emit('taskFailed', task);
      throw error;
    }
  }

  /**
   * Start a desktop automation session
   */
  async startSession(task) {
    try {
      const sessionConfig = {
        timeout: task.automation.config.timeout,
        takeScreenshots: task.automation.config.takeScreenshots,
        capabilities: task.metadata.capabilities,
        userAgent: task.metadata.userAgent
      };

      const headers = this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {};

      const response = await axios.post(`${this.baseUrl}/sessions/start`, sessionConfig, { headers });
      const sessionId = response.data.sessionId;

      this.activeSessions.set(sessionId, {
        id: sessionId,
        taskId: task.id,
        status: 'active',
        startedAt: new Date(),
        config: sessionConfig
      });

      return sessionId;

    } catch (error) {
      console.error('[Bytebot] Failed to start session:', error);
      throw error;
    }
  }

  /**
   * End a desktop automation session
   */
  async endSession(sessionId) {
    try {
      const headers = this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {};

      await axios.post(`${this.baseUrl}/sessions/${sessionId}/end`, {}, { headers });

      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'ended';
        session.endedAt = new Date();
      }

    } catch (error) {
      console.warn('[Bytebot] Failed to end session gracefully:', error.message);
    }
  }

  /**
   * Parse automation actions from task description
   */
  parseAutomationActions(description) {
    const actions = [];
    const lowerDesc = description.toLowerCase();

    // Mouse actions
    if (lowerDesc.includes('click') || lowerDesc.includes('mouse')) {
      actions.push({
        type: 'click',
        target: this.extractClickTarget(description),
        config: { button: 'left', clickCount: 1 }
      });
    }

    // Keyboard actions
    if (lowerDesc.includes('type') || lowerDesc.includes('keyboard') || lowerDesc.includes('text')) {
      actions.push({
        type: 'type_text',
        content: this.extractTextToType(description)
      });
    }

    // Navigation actions
    if (lowerDesc.includes('navigate') || lowerDesc.includes('visit') || lowerDesc.includes('url')) {
      actions.push({
        type: 'navigate',
        url: this.extractUrl(description)
      });
    }

    // Screenshot actions
    if (lowerDesc.includes('screenshot') || lowerDesc.includes('capture')) {
      actions.push({
        type: 'screenshot',
        location: this.extractScreenshotPath(description) || 'task_screenshot.png'
      });
    }

    // Application actions
    if (lowerDesc.includes('open') && lowerDesc.includes('application')) {
      actions.push({
        type: 'open_application',
        application: this.extractApplicationName(description)
      });
    }

    // Wait actions
    if (lowerDesc.includes('wait') || lowerDesc.includes('pause')) {
      actions.push({
        type: 'wait',
        duration: this.extractWaitDuration(description) || 2000
      });
    }

    return actions.length > 0 ? actions : [{
      type: 'custom_action',
      description: description
    }];
  }

  /**
   * Execute individual automation action
   */
  async executeAction(task, action) {
    try {
      console.log(`[Bytebot] Executing action: ${action.type}`);

      const headers = this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {};
      const sessionId = task.automation.sessionId;

      let response;

      switch (action.type) {
        case 'click':
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/click`,
            action.config,
            { headers }
          );
          break;

        case 'type_text':
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/type`,
            { text: action.content },
            { headers }
          );
          break;

        case 'navigate':
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/navigate`,
            { url: action.url },
            { headers }
          );
          break;

        case 'screenshot':
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/screenshot`,
            { savePath: action.location },
            { headers }
          );
          task.automation.screenshots.push({
            path: action.location,
            timestamp: new Date(),
            action: action
          });
          break;

        case 'open_application':
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/open_app`,
            { application: action.application },
            { headers }
          );
          break;

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, action.duration));
          response = { status: 200, data: { success: true } };
          break;

        default:
          // Custom action - attempt generic execution
          response = await axios.post(`${this.baseUrl}/sessions/${sessionId}/execute`,
            { action: action.type, params: action },
            { headers }
          );
      }

      // Record action result
      action.executedAt = new Date();
      action.result = response.data;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);

      this.emit('actionCompleted', { taskId: task.id, action, result: response.data });

    } catch (error) {
      action.error = error.message;
      action.failedAt = new Date();
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);

      this.emit('actionFailed', { taskId: task.id, action, error: error.message });
      throw error;
    }
  }

  /**
   * Utility methods for extracting action parameters
   */
  extractClickTarget(description) {
    // Look for coordinates like (100, 200) or x:100,y:200
    const coordMatch = description.match(/\(?(\d+)\s*[,\s]\s*(\d+)\)?/);
    if (coordMatch) {
      return {
        type: 'coordinates',
        x: parseInt(coordMatch[1]),
        y: parseInt(coordMatch[2])
      };
    }

    // Look for element selectors or text
    const elementMatch = description.match(/click\s+(?:on\s+)?([\w\s]+)/i);
    if (elementMatch) {
      return {
        type: 'selector',
        selector: elementMatch[1].trim()
      };
    }

    return { type: 'center', selector: 'center' };
  }

  extractTextToType(description) {
    const matches = description.match(/type\s+["']([^"']+)["']/i) ||
                   description.match(/type\s+([^\s.,]+)/i);
    return matches ? matches[1] : 'Hello World';
  }

  extractUrl(description) {
    const urlMatch = description.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : 'https://google.com';
  }

  extractScreenshotPath(description) {
    const pathMatch = description.match(/save\s+(?:to\s+)?["']?([^\s"']+\.(?:png|jpg|jpeg))["']?/i);
    return pathMatch ? pathMatch[1] : null;
  }

  extractApplicationName(description) {
    const appMatch = description.match(/open\s+(?:application\s+)?["']?([^"']+)["']?/i);
    return appMatch ? appMatch[1] : 'Calculator';
  }

  extractWaitDuration(description) {
    const durationMatch = description.match(/wait\s+(\d+)\s*(?:ms|milliseconds?|s|seconds?)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      return unit.startsWith('s') ? value * 1000 : value;
    }
    return 2000; // default 2 seconds
  }

  /**
   * Get task status and details
   */
  async getTaskStatus(taskId) {
    try {
      const task = this.activeTasks.get(taskId);
      if (!task) {
        throw new APIError(404, 'Task Not Found', { taskId });
      }

      return {
        ...task,
        automation: task.automation
      };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(500, 'Failed to Get Task Status', {
        message: error.message,
        taskId
      });
    }
  }

  /**
   * Cancel a running automation task
   */
  async cancelTask(taskId) {
    try {
      console.log('[Bytebot] Cancellingautomation task:', taskId);

      const task = this.activeTasks.get(taskId);
      if (task && task.automation.sessionId) {
        // End the session
        await this.endSession(task.automation.sessionId);
      }

      if (task) {
        task.status = 'cancelled';
        task.cancelledAt = new Date();
        task.updatedAt = new Date();
        this.activeTasks.set(taskId, task);
        this.emit('taskCancelled', task);
      }

      console.log('[Bytebot] Task cancelled successfully:', taskId);
      return true;

    } catch (error) {
      console.error('[Bytebot] Failed to cancel task:', error);
      throw new APIError(500, 'Task Cancellation Failed', {
        message: error.message,
        taskId
      });
    }
  }

  /**
   * Get list of running sessions
   */
  async getSessions(filters = {}) {
    try {
      const sessions = Array.from(this.activeSessions.values());

      if (filters.status) {
        return sessions.filter(session => session.status === filters.status);
      }

      return sessions;

    } catch (error) {
      console.error('[Bytebot] Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get automation capabilities and features
   */
  getCapabilities() {
    return {
      name: this.config.name,
      version: this.config.version,
      features: this.config.supportedFeatures,
      supportedActions: [
        'click', 'type_text', 'navigate', 'screenshot',
        'open_application', 'wait', 'scroll', 'drag_drop',
        'keyboard_shortcuts', 'context_menu', 'file_upload'
      ],
      sessionManagement: true,
      webAutomation: true,
      desktopAutomation: true,
      crossPlatform: true,
      supportedBrowsers: ['chrome', 'firefox', 'safari', 'edge'],
      supportedOS: ['windows', 'macos', 'linux']
    };
  }

  /**
   * Create WebSocket stream for real-time automation updates
   */
  createTaskStream(taskId, options = {}) {
    const streamInfo = {
      taskId,
      connected: false,
      updateInterval: options.updateInterval || 1000,
      timer: null,
      sessionId: null
    };

    // Get session ID for the task
    const task = this.activeTasks.get(taskId);
    if (task && task.automation.sessionId) {
      streamInfo.sessionId = task.automation.sessionId;
      streamInfo.connected = true;
    }

    this.taskStreams = this.taskStreams || new Map();
    this.taskStreams.set(taskId, streamInfo);

    console.log('[Bytebot] Task stream created for:', taskId);
    return streamInfo;
  }

  /**
   * Execute custom automation script
   */
  async executeScript(sessionId, script) {
    try {
      const headers = this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {};

      const response = await axios.post(
        `${this.baseUrl}/sessions/${sessionId}/execute_script`,
        { script: script },
        { headers }
      );

      return response.data;

    } catch (error) {
      console.error('[Bytebot] Script execution failed:', error);
      throw error;
    }
  }

  /**
   * Get screenshot from current session
   */
  async getScreenshot(sessionId, filename = 'screenshot.png') {
    try {
      const headers = this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {};

      const response = await axios.get(
        `${this.baseUrl}/sessions/${sessionId}/screenshot`,
        {
          headers,
          responseType: 'arraybuffer'
        }
      );

      // Save screenshot to file
      const fs = require('fs').promises;
      await fs.writeFile(filename, Buffer.from(response.data));

      return {
        path: filename,
        timestamp: new Date(),
        size: response.data.length
      };

    } catch (error) {
      console.error('[Bytebot] Screenshot capture failed:', error);
      throw error;
    }
  }

  /**
   * Map platform task status to unified status
   */
  mapTaskStatus(platformStatus) {
    const statusMap = {
      'queued': 'queued',
      'executing': 'executing',
      'running': 'executing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'paused': 'paused'
    };

    return statusMap[platformStatus] || 'unknown';
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `bytebot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // End all active sessions
      for (const [sessionId, session] of this.activeSessions) {
        try {
          await this.endSession(sessionId);
        } catch (error) {
          console.warn(`[Bytebot] Failed to cleanup session ${sessionId}:`, error.message);
        }
      }

      // Close WebSocket connection
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.wsConnection.close();
      }

      // Clear active tasks and sessions
      this.activeTasks.clear();
      this.activeSessions.clear();
      this.automationTasks.clear();

      await super.disconnect();

    } catch (error) {
      console.error('[Bytebot] Cleanup failed:', error);
    }
  }
}

module.exports = BytebotAdapter;
