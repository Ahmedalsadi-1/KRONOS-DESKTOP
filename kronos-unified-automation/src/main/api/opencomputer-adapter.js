const { BaseAPIAdapter, APIError } = require('./base-adapter');
const WebSocket = require('ws');

/**
 * OpenComputerUse API Adapter
 * Handles communication with open-computer-use FastAPI backend
 */
class OpenComputerUseAdapter extends BaseAPIAdapter {
  constructor(config = {}) {
    super({
      name: 'OpenComputerUse',
      version: '1.0.0',
      baseUrl: config.baseUrl || 'http://localhost:8001',
      timeout: config.timeout || 60000, // Longer timeout for AI tasks
      authRequired: config.authRequired || false,
      supportedFeatures: [
        'task-creation',
        'task-monitoring', 
        'task-streaming',
        'multi-agent',
        'agent-management',
        'file-operations',
        'screenshot-capture',
        'web-automation'
      ],
      healthCheckPath: '/health',
      ...config
    });

    this.agents = new Map();
    this.activeTasks = new Map();
    this.taskStreams = new Map();
    this.agentConfigs = config.agentConfigs || {};
  }

  /**
   * Setup authentication if required
   */
  async setupAuthentication() {
    // OpenComputerUse typically doesn't require auth for local development
    // Override this method if authentication is needed
    this.isAuthenticated = true;
  }

  /**
   * Create a new task
   */
  async createTask(taskData) {
    try {
      console.log('[OpenComputerUse] Creating task:', taskData.title);
      
      const requestData = {
        task_id: taskData.id || this.generateTaskId(),
        prompt: taskData.description || taskData.prompt,
        agent: taskData.agent || 'default',
        max_iterations: taskData.maxIterations || 10,
        screenshot_interval: taskData.screenshotInterval || 5,
        headless: taskData.headless !== false, // Default to headless
        browser_use: taskData.browserUse || false,
        enable_ocr: taskData.enableOCR || false,
        use_vision: taskData.useVision !== false, // Default to vision enabled
        continue_on_failure: taskData.continueOnFailure || false,
        max_failures: taskData.maxFailures || 3,
        context: taskData.context || {},
        files: taskData.files || [],
        urls: taskData.urls || [],
        cookies: taskData.cookies || [],
        user_agent: taskData.userAgent,
        viewport: taskData.viewport || { width: 1920, height: 1080 }
      };

      const response = await this.makeRequestWithRetry('POST', '/tasks', {
        body: requestData
      });

      if (!response.data || !response.data.task_id) {
        throw new APIError(500, 'Invalid Response', { message: 'Task creation response missing task_id' });
      }

      const task = {
        id: response.data.task_id,
        platform: 'opencomputer-use',
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        data: response.data,
        metadata: {
          agent: requestData.agent,
          prompt: requestData.prompt,
          iterations: requestData.max_iterations,
          features: this.extractFeatures(requestData)
        }
      };

      this.activeTasks.set(task.id, task);
      this.emit('taskCreated', task);

      console.log('[OpenComputerUse] Task created successfully:', task.id);
      return task;

    } catch (error) {
      console.error('[OpenComputerUse] Failed to create task:', error);
      throw new APIError(500, 'Task Creation Failed', { 
        message: error.message,
        taskData 
      });
    }
  }

  /**
   * Get task status and details
   */
  async getTaskStatus(taskId) {
    try {
      const response = await this.makeRequestWithRetry('GET', `/tasks/${taskId}`);
      
      const taskData = response.data;
      const task = this.activeTasks.get(taskId) || {
        id: taskId,
        platform: 'opencomputer-use',
        createdAt: new Date()
      };

      // Update task information
      task.status = this.mapTaskStatus(taskData.status);
      task.updatedAt = new Date();
      task.result = taskData.result;
      task.error = taskData.error;
      task.progress = taskData.progress || 0;
      task.iteration = taskData.current_iteration || 0;
      task.maxIterations = taskData.max_iterations;
      task.agent = taskData.agent;
      task.screenshots = taskData.screenshots || [];
      task.logs = taskData.logs || [];
      
      if (taskData.metadata) {
        task.metadata = { ...task.metadata, ...taskData.metadata };
      }

      this.activeTasks.set(taskId, task);
      this.emit('taskUpdated', task);

      return task;

    } catch (error) {
      if (error.status === 404) {
        throw new APIError(404, 'Task Not Found', { taskId });
      }
      throw error;
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId) {
    try {
      console.log('[OpenComputerUse] Cancelling task:', taskId);
      
      await this.makeRequestWithRetry('POST', `/tasks/${taskId}/cancel`);
      
      const task = this.activeTasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
        task.updatedAt = new Date();
        this.activeTasks.set(taskId, task);
        this.emit('taskCancelled', task);
      }

      // Close WebSocket stream if exists
      const stream = this.taskStreams.get(taskId);
      if (stream) {
        stream.close();
        this.taskStreams.delete(taskId);
      }

      console.log('[OpenComputerUse] Task cancelled successfully:', taskId);
      return true;

    } catch (error) {
      console.error('[OpenComputerUse] Failed to cancel task:', error);
      throw new APIError(500, 'Task Cancellation Failed', { 
        message: error.message,
        taskId 
      });
    }
  }

  /**
   * Get list of tasks with optional filters
   */
  async getTasks(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.agent) queryParams.append('agent', filters.agent);
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.offset) queryParams.append('offset', filters.offset.toString());
      
      const response = await this.makeRequestWithRetry('GET', `/tasks?${queryParams.toString()}`);
      
      const tasks = response.data.tasks || [];
      
      return tasks.map(taskData => ({
        id: taskData.task_id,
        platform: 'opencomputer-use',
        status: this.mapTaskStatus(taskData.status),
        createdAt: new Date(taskData.created_at),
        updatedAt: new Date(taskData.updated_at),
        result: taskData.result,
        error: taskData.error,
        progress: taskData.progress || 0,
        agent: taskData.agent,
        metadata: {
          prompt: taskData.prompt,
          iterations: taskData.max_iterations,
          ...taskData.metadata
        }
      }));

    } catch (error) {
      console.error('[OpenComputerUse] Failed to get tasks:', error);
      throw new APIError(500, 'Failed to Fetch Tasks', { 
        message: error.message,
        filters 
      });
    }
  }

  /**
   * Create WebSocket stream for real-time task updates
   */
  createTaskStream(taskId, options = {}) {
    try {
      console.log('[OpenComputerUse] Creating task stream for:', taskId);
      
      const streamUrl = new URL(`/ws/tasks/${taskId}`, this.config.baseUrl.replace('http', 'ws')).toString();
      const ws = new WebSocket(streamUrl, {
        headers: this.getAuthHeaders()
      });

      const streamInfo = {
        taskId,
        websocket: ws,
        connected: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: options.maxReconnectAttempts || 5,
        reconnectDelay: options.reconnectDelay || 1000,
        ...options
      };

      // Handle WebSocket events
      ws.on('open', () => {
        console.log('[OpenComputerUse] WebSocket connected for task:', taskId);
        streamInfo.connected = true;
        streamInfo.reconnectAttempts = 0;
        this.emit('streamConnected', { taskId, stream: ws });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleStreamMessage(taskId, message);
        } catch (error) {
          console.error('[OpenComputerUse] Failed to parse stream message:', error);
        }
      });

      ws.on('close', () => {
        console.log('[OpenComputerUse] WebSocket closed for task:', taskId);
        streamInfo.connected = false;
        this.emit('streamDisconnected', { taskId });
        
        // Attempt reconnection if enabled
        if (options.autoReconnect !== false && streamInfo.reconnectAttempts < streamInfo.maxReconnectAttempts) {
          setTimeout(() => {
            if (!streamInfo.connected) {
              streamInfo.reconnectAttempts++;
              console.log('[OpenComputerUse] Attempting to reconnect stream:', taskId, `(${streamInfo.reconnectAttempts}/${streamInfo.maxReconnectAttempts})`);
              this.reconnectStream(taskId);
            }
          }, streamInfo.reconnectDelay * Math.pow(2, streamInfo.reconnectAttempts));
        } else {
          this.taskStreams.delete(taskId);
        }
      });

      ws.on('error', (error) => {
        console.error('[OpenComputerUse] WebSocket error for task:', taskId, error);
        this.emit('streamError', { taskId, error: error.message });
      });

      this.taskStreams.set(taskId, streamInfo);
      return streamInfo;

    } catch (error) {
      console.error('[OpenComputerUse] Failed to create task stream:', error);
      throw new APIError(500, 'Stream Creation Failed', { 
        message: error.message,
        taskId 
      });
    }
  }

  /**
   * Reconnect WebSocket stream
   */
  reconnectStream(taskId) {
    const streamInfo = this.taskStreams.get(taskId);
    if (!streamInfo) return;

    try {
      const streamUrl = new URL(`/ws/tasks/${taskId}`, this.config.baseUrl.replace('http', 'ws')).toString();
      const ws = new WebSocket(streamUrl, {
        headers: this.getAuthHeaders()
      });

      streamInfo.websocket = ws;
      
      // Copy event handlers (simplified - in practice you'd want to preserve them)
      ws.on('open', () => {
        streamInfo.connected = true;
        streamInfo.reconnectAttempts = 0;
        this.emit('streamReconnected', { taskId });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleStreamMessage(taskId, message);
        } catch (error) {
          console.error('[OpenComputerUse] Failed to parse reconnected stream message:', error);
        }
      });

      ws.on('close', () => {
        streamInfo.connected = false;
        this.emit('streamDisconnected', { taskId });
      });

      ws.on('error', (error) => {
        console.error('[OpenComputerUse] Reconnected WebSocket error for task:', taskId, error);
      });

    } catch (error) {
      console.error('[OpenComputerUse] Failed to reconnect stream:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleStreamMessage(taskId, message) {
    try {
      switch (message.type) {
        case 'task_update':
          this.handleTaskUpdate(taskId, message.data);
          break;
        case 'agent_action':
          this.handleAgentAction(taskId, message.data);
          break;
        case 'screenshot':
          this.handleScreenshot(taskId, message.data);
          break;
        case 'log':
          this.handleLog(taskId, message.data);
          break;
        case 'error':
          this.handleStreamError(taskId, message.data);
          break;
        default:
          console.log('[OpenComputerUse] Unknown stream message type:', message.type);
      }
    } catch (error) {
      console.error('[OpenComputerUse] Error handling stream message:', error);
    }
  }

  /**
   * Handle task update message
   */
  handleTaskUpdate(taskId, data) {
    const task = this.activeTasks.get(taskId) || { id: taskId, platform: 'opencomputer-use' };
    
    task.status = this.mapTaskStatus(data.status);
    task.updatedAt = new Date();
    task.progress = data.progress || 0;
    task.iteration = data.current_iteration || 0;
    
    if (data.result) task.result = data.result;
    if (data.error) task.error = data.error;
    
    this.activeTasks.set(taskId, task);
    this.emit('taskStreamUpdate', task);
  }

  /**
   * Handle agent action message
   */
  handleAgentAction(taskId, data) {
    this.emit('agentAction', {
      taskId,
      agent: data.agent,
      action: data.action,
      timestamp: new Date(),
      data: data
    });
  }

  /**
   * Handle screenshot message
   */
  handleScreenshot(taskId, data) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      if (!task.screenshots) task.screenshots = [];
      task.screenshots.push({
        id: data.id,
        timestamp: new Date(data.timestamp),
        url: data.url,
        description: data.description
      });
      this.activeTasks.set(taskId, task);
    }
    
    this.emit('screenshot', {
      taskId,
      screenshot: data
    });
  }

  /**
   * Handle log message
   */
  handleLog(taskId, data) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      if (!task.logs) task.logs = [];
      task.logs.push({
        timestamp: new Date(data.timestamp),
        level: data.level,
        message: data.message,
        agent: data.agent
      });
      this.activeTasks.set(taskId, task);
    }
    
    this.emit('log', {
      taskId,
      log: data
    });
  }

  /**
   * Handle stream error message
   */
  handleStreamError(taskId, data) {
    console.error('[OpenComputerUse] Stream error for task:', taskId, data);
    this.emit('streamError', {
      taskId,
      error: data.message,
      code: data.code
    });
  }

  /**
   * Get available agents
   */
  async getAgents() {
    try {
      const response = await this.makeRequestWithRetry('GET', '/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error('[OpenComputerUse] Failed to get agents:', error);
      return [];
    }
  }

  /**
   * Configure agent
   */
  async configureAgent(agentName, config) {
    try {
      const response = await this.makeRequestWithRetry('POST', `/agents/${agentName}/config`, {
        body: config
      });
      
      this.agentConfigs[agentName] = config;
      return response.data;
    } catch (error) {
      console.error('[OpenComputerUse] Failed to configure agent:', error);
      throw error;
    }
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(options = {}) {
    try {
      const response = await this.makeRequestWithRetry('POST', '/screenshot', {
        body: {
          url: options.url,
          element: options.element,
          full_page: options.fullPage || false,
          quality: options.quality || 80,
          format: options.format || 'png'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('[OpenComputerUse] Failed to capture screenshot:', error);
      throw error;
    }
  }

  /**
   * Map platform task status to unified status
   */
  mapTaskStatus(platformStatus) {
    const statusMap = {
      'queued': 'queued',
      'running': 'executing',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'timeout': 'failed',
      'error': 'failed'
    };
    
    return statusMap[platformStatus] || 'unknown';
  }

  /**
   * Extract enabled features from task data
   */
  extractFeatures(taskData) {
    const features = [];
    
    if (taskData.browser_use) features.push('browser-automation');
    if (taskData.use_vision) features.push('vision');
    if (taskData.enable_ocr) features.push('ocr');
    if (taskData.files && taskData.files.length > 0) features.push('file-operations');
    if (taskData.urls && taskData.urls.length > 0) features.push('web-navigation');
    
    return features;
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `ocu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get task by ID from cache
   */
  getCachedTask(taskId) {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks() {
    return Array.from(this.activeTasks.values()).filter(task => 
      ['queued', 'executing'].includes(task.status)
    );
  }

  /**
   * Get platform-specific capabilities
   */
  getCapabilities() {
    return {
      name: this.config.name,
      version: this.config.version,
      features: this.config.supportedFeatures,
      maxConcurrentTasks: 10,
      supportedAgents: ['browser_use', 'computer_use', 'vision'],
      supportedActions: [
        'click', 'type', 'scroll', 'drag', 'key_press',
        'screenshot', 'navigate', 'wait', 'extract_text'
      ],
      requirements: {
        python: '3.8+',
        playwright: true,
        opencv: true,
        pytesseract: true
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Close all task streams
    for (const [taskId, streamInfo] of this.taskStreams) {
      if (streamInfo.websocket) {
        streamInfo.websocket.close();
      }
    }
    this.taskStreams.clear();
    
    // Clear active tasks
    this.activeTasks.clear();
    this.agents.clear();
    
    await super.disconnect();
  }
}

module.exports = OpenComputerUseAdapter;
