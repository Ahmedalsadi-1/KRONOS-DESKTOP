const { EventEmitter } = require('events');
const { APIError } = require('./base-adapter');
const OpenComputerUseAdapter = require('./opencomputer-adapter');
const UITARSAdapter = require('./uitars-adapter');
const GboxAdapter = require('./gbox-adapter');
const BytebotAdapter = require('./bytebot-adapter');

/**
 * Unified API Manager
 * Coordinates multiple automation platforms into a single unified interface
 */
class UnifiedAPIManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      defaultPlatform: 'opencomputer',
      loadBalancing: true,
      failoverEnabled: true,
      monitoringEnabled: true,
      maxConcurrentTasks: 10,
      taskQueueSize: 50,
      ...config
    };

    // Adapter registry
    this.adapters = new Map();
    this.adapterConfigs = new Map();

    // Task management
    this.activeTasks = new Map();
    this.taskQueue = [];
    this.taskPriorityQueue = [];

    // Load balancing
    this.taskDistribution = new Map();
    this.adapterLoad = new Map();
    this.healthStatus = new Map();

    // Monitoring
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeTasks: 0,
      averageResponseTime: 0,
      adapterUsage: {},
      errors: []
    };

    // Real-time streams
    this.activeStreams = new Map();

    // Initialize event listeners
    this.setupEventHandling();
  }

  /**
   * Setup event handling for coordination
   */
  setupEventHandling() {
    // Handle global events
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());

    // Setup periodic health checks
    if (this.config.monitoringEnabled) {
      setInterval(() => this.performHealthChecks(), 30000);
    }

    // Setup task distribution monitoring
    setInterval(() => this.balanceLoad(), 10000);
  }

  /**
   * Register an adapter with the manager
   */
  async registerAdapter(name, adapter, config = {}) {
    try {
      console.log(`[UnifiedAPI] Registering adapter: ${name}`);

      // Store configuration
      this.adapterConfigs.set(name, config);

      // Initialize adapter
      await adapter.initialize();

      // Setup event forwarding
      this.setupAdapterEvents(name, adapter);

      // Register adapter
      this.adapters.set(name, adapter);
      this.adapterLoad.set(name, 0);
      this.healthStatus.set(name, 'healthy');

      // Initialize metrics
      this.metrics.adapterUsage[name] = {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        lastUsed: null
      };

      this.emit('adapterRegistered', { name, adapter, config });

      console.log(`[UnifiedAPI] Adapter registered successfully: ${name}`);

    } catch (error) {
      console.error(`[UnifiedAPI] Failed to register adapter ${name}:`, error);
      this.healthStatus.set(name, 'unhealthy');
      throw error;
    }
  }

  /**
   * Setup adapter event forwarding
   */
  setupAdapterEvents(adapterName, adapter) {
    const events = [
      'connected', 'disconnected', 'taskCreated', 'taskCompleted',
      'taskFailed', 'taskCancelled', 'streamMessage', 'websocketConnected',
      'websocketDisconnected', 'automationUpdate', 'sessionUpdated'
    ];

    events.forEach(event => {
      adapter.on(event, (data) => {
        // Add adapter context to event
        const enhancedData = {
          ...data,
          adapter: adapterName,
          timestamp: new Date()
        };

        // Forward to unified manager events
        const unifiedEvent = `${adapterName}:${event}`;
        this.emit(unifiedEvent, enhancedData);

        // Also emit as unified event if needed
        if (event.startsWith('task')) {
          this.emit('taskUpdate', enhancedData);
        }
      });
    });
  }

  /**
   * Initialize with default adapters
   */
  async initialize() {
    try {
      console.log('[UnifiedAPI] Initializing unified API manager...');

      // Register built-in adapters
      const defaultAdapters = [
        {
          name: 'opencomputer',
          adapter: new OpenComputerUseAdapter(),
          config: { priority: 1, capabilities: ['web-automation', 'api-integration'] }
        },
        {
          name: 'uitars',
          adapter: new UITARSAdapter(),
          config: { priority: 1, capabilities: ['desktop-automation', 'ai-vision'] }
        },
        {
          name: 'gbox',
          adapter: new GboxAdapter(),
          config: { priority: 2, capabilities: ['container-management', 'infrastructure'] }
        },
        {
          name: 'bytebot',
          adapter: new BytebotAdapter(),
          config: { priority: 1, capabilities: ['computer-automation', 'input-simulation'] }
        }
      ];

      // Register all adapters concurrently
      await Promise.all(
        defaultAdapters.map(({ name, adapter, config }) =>
          this.registerAdapter(name, adapter, config)
        )
      );

      // Start task processing
      this.startTaskProcessor();

      this.emit('initialized', { adapterCount: this.adapters.size });

      console.log(`[UnifiedAPI] Unified API manager initialized with ${this.adapters.size} adapters`);

    } catch (error) {
      console.error('[UnifiedAPI] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create a unified task across potentially multiple platforms
   */
  async createUnifiedTask(taskData) {
    try {
      const startTime = Date.now();

      console.log('[UnifiedAPI] Creating unified task:', taskData.title);

      // Determine which adapter(s) should handle this task
      const taskAnalysis = await this.analyzeTaskRequirements(taskData);

      if (taskAnalysis.requiresMultipleAdapters) {
        return await this.createMultiAdapterTask(taskAnalysis, taskData);
      } else {
        return await this.createSingleAdapterTask(taskAnalysis.adapter, taskData);
      }

    } catch (error) {
      console.error('[UnifiedAPI] Failed to create unified task:', error);
      this.metrics.failedTasks++;
      throw new APIError(500, 'Unified Task Creation Failed', {
        message: error.message,
        taskData,
        analysis: await this.analyzeTaskRequirements(taskData).catch(() => null)
      });
    }
  }

  /**
   * Analyze task requirements to determine best adapter(s)
   */
  async analyzeTaskRequirements(taskData) {
    const requirements = {
      platforms: this.extractPlatforms(taskData),
      capabilities: this.extractCapabilities(taskData),
      priority: taskData.priority || 'normal',
      requiresMultipleAdapters: false,
      adapter: null,
      secondaryAdapters: []
    };

    // Multi-adapter scenarios
    if (requirements.platforms.length > 1) {
      requirements.requiresMultipleAdapters = true;
      requirements.adapter = this.selectPrimaryAdapter(requirements);
      requirements.secondaryAdapters = requirements.platforms.filter(p => p !== requirements.adapter);
    } else {
      requirements.adapter = requirements.platforms[0] || this.selectOptimalAdapter(requirements);
    }

    return requirements;
  }

  /**
   * Create task on single adapter
   */
  async createSingleAdapterTask(adapter, taskData) {
    const taskId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if we're at capacity
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return await this.queueTask(adapter, taskData, { unifiedTaskId: taskId });
    }

    const adapterInstance = this.adapters.get(adapter);
    if (!adapterInstance) {
      throw new Error(`Adapter not found: ${adapter}`);
    }

    // Create task with unified tracking
    const task = await adapterInstance.createTask({
      ...taskData,
      id: taskId,
      unified: true
    });

    // Track in unified system
    task.unifiedId = taskId;
    task.adapter = adapter;
    this.activeTasks.set(taskId, task);
    this.taskDistribution.set(taskId, adapter);
    this.adapterLoad.set(adapter, (this.adapterLoad.get(adapter) || 0) + 1);

    // Update metrics
    this.metrics.totalTasks++;
    this.metrics.activeTasks++;
    this.metrics.adapterUsage[adapter].totalTasks++;

    this.emit('unifiedTaskCreated', task);

    return task;
  }

  /**
   * Create task spanning multiple adapters
   */
  async createMultiAdapterTask(taskAnalysis, taskData) {
    const taskId = `multi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[UnifiedAPI] Creating multi-adapter task ${taskId} for ${taskAnalysis.secondaryAdapters.length + 1} adapters`);

    // Split task into sub-tasks
    const subTasks = await this.splitTaskByAdapters(taskAnalysis, taskData, taskId);

    // Execute sub-tasks concurrently
    const results = await Promise.allSettled(
      subTasks.map(({ adapter, subTaskData }) =>
        this.createSubTask(adapter, subTaskData, taskId)
      )
    );

    // Combine results
    const combinedTask = {
      id: taskId,
      type: 'multiAdapter',
      status: 'executing',
      subTasks: results.map((result, index) => ({
        adapter: subTasks[index].adapter,
        status: result.status,
        task: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      })),
      createdAt: new Date(),
      taskData
    };

    this.activeTasks.set(taskId, combinedTask);

    this.emit('multiAdapterTaskCreated', combinedTask);

    return combinedTask;
  }

  /**
   * Split task across multiple adapters
   */
  splitTaskByAdapters(analysis, taskData, parentTaskId) {
    const subTasks = [];

    // Primary adapter task
    subTasks.push({
      adapter: analysis.adapter,
      taskData: {
        ...taskData,
        id: `${parentTaskId}_primary`,
        primary: true,
        parentTaskId
      }
    });

    // Secondary adapter tasks
    analysis.secondaryAdapters.forEach(adapter => {
      subTasks.push({
        adapter,
        taskData: {
          ...taskData,
          id: `${parentTaskId}_${adapter}`,
          primary: false,
          parentTaskId,
          dependencies: [subTasks[0].taskData.id] // Depends on primary
        }
      });
    });

    return subTasks;
  }

  /**
   * Create sub-task for multi-adapter execution
   */
  async createSubTask(adapter, taskData, parentTaskId) {
    try {
      const adapterInstance = this.adapters.get(adapter);
      if (!adapterInstance) {
        throw new Error(`Adapter not found: ${adapter}`);
      }

      const task = await adapterInstance.createTask(taskData);

      // Ensure sub-task knows about parent
      task.parentTaskId = parentTaskId;

      return task;

    } catch (error) {
      console.error(`[UnifiedAPI] Sub-task creation failed for ${adapter}:`, error);
      throw error;
    }
  }

  /**
   * Queue task when at capacity
   */
  async queueTask(adapter, taskData, metadata = {}) {
    return new Promise((resolve, reject) => {
      if (this.taskQueue.length >= this.config.taskQueueSize) {
        reject(new Error('Task queue full'));
        return;
      }

      const queuedTask = {
        adapter,
        taskData,
        metadata,
        resolve,
        reject,
        queuedAt: new Date(),
        priority: taskData.priority || 'normal'
      };

      // Add to appropriate queue
      if (queuedTask.priority === 'high') {
        this.taskPriorityQueue.unshift(queuedTask);
      } else {
        this.taskQueue.push(queuedTask);
      }

      console.log(`[UnifiedAPI] Task queued: ${adapter} (${queuedTask.priority} priority)`);
    });
  }

  /**
   * Start task processing (handles queued tasks)
   */
  startTaskProcessor() {
    setInterval(() => {
      this.processTaskQueue();
    }, 2000); // Process every 2 seconds
  }

  /**
   * Process queued tasks
   */
  async processTaskQueue() {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return; // At capacity
    }

    // Process priority queue first
    const taskToProcess = this.taskPriorityQueue.shift() || this.taskQueue.shift();
    if (!taskToProcess) return;

    try {
      const task = await this.createSingleAdapterTask(taskToProcess.adapter, taskToProcess.taskData);
      taskToProcess.resolve(task);
    } catch (error) {
      taskToProcess.reject(error);
    }
  }

  /**
   * Extract platform requirements from task data
   */
  extractPlatforms(taskData) {
    const platforms = [];
    const description = (taskData.description || taskData.prompt || '').toLowerCase();

    if (description.includes('opencomputer') || description.includes('open computer') || description.includes('web') || description.includes('api')) {
      platforms.push('opencomputer');
    }

    if (description.includes('uitars') || description.includes('ui-tars') || description.includes('desktop') || description.includes('vision')) {
      platforms.push('uitars');
    }

    if (description.includes('gbox') || description.includes('container') || description.includes('infrastructure') || description.includes('deploy')) {
      platforms.push('gbox');
    }

    if (description.includes('bytebot') || description.includes('computer') || description.includes('automation') || description.includes('input')) {
      platforms.push('bytebot');
    }

    // Remove duplicates
    return [...new Set(platforms)];
  }

  /**
   * Extract capability requirements
   */
  extractCapabilities(taskData) {
    const capabilities = [];
    const description = (taskData.description || taskData.prompt || '').toLowerCase();

    if (description.includes('click') || description.includes('mouse')) capabilities.push('mouse-control');
    if (description.includes('type') || description.includes('keyboard')) capabilities.push('keyboard-input');
    if (description.includes('screenshot') || description.includes('capture')) capabilities.push('screen-capture');
    if (description.includes('web') || description.includes('browser')) capabilities.push('web-automation');
    if (description.includes('application') || description.includes('open')) capabilities.push('application-control');
    if (description.includes('container') || description.includes('docker')) capabilities.push('container-management');
    if (description.includes('deploy') || description.includes('infrastructure')) capabilities.push('infrastructure');

    return capabilities;
  }

  /**
   * Select optimal adapter for task
   */
  selectOptimalAdapter(requirements) {
    if (requirements.adapters && requirements.adapters.length > 0) {
      return this.selectBalancedAdapter(requirements.adapters);
    }

    // Find adapters with matching capabilities
    const matchingAdapters = [];
    for (const [name, adapter] of this.adapters) {
      const capabilities = this.adapterConfigs.get(name).capabilities || [];
      const hasRequiredCapabilities = requirements.capabilities.every(cap =>
        capabilities.includes(cap)
      );

      if (hasRequiredCapabilities && this.healthStatus.get(name) === 'healthy') {
        matchingAdapters.push(name);
      }
    }

    if (matchingAdapters.length > 0) {
      return this.selectBalancedAdapter(matchingAdapters);
    }

    // Fallback to default platform
    return this.config.defaultPlatform;
  }

  /**
   * Select balanced adapter (load balancing)
   */
  selectBalancedAdapter(adapterList) {
    if (!this.config.loadBalancing || adapterList.length === 1) {
      return adapterList[0];
    }

    let selectedAdapter = adapterList[0];
    let minLoad = Infinity;

    for (const adapter of adapterList) {
      const load = this.adapterLoad.get(adapter) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAdapter = adapter;
      }
    }

    return selectedAdapter;
  }

  /**
   * Select primary adapter for multi-adapter tasks
   */
  selectPrimaryAdapter(requirements) {
    // Prioritize based on config
    const priorityOrder = ['opencomputer', 'uitars', 'bytebot', 'gbox'];

    for (const platform of priorityOrder) {
      if (requirements.platforms.includes(platform)) {
        return platform;
      }
    }

    return requirements.platforms[0];
  }

  /**
   * Get task status across adapters
   */
  async getTaskStatus(taskId) {
    try {
      const task = this.activeTasks.get(taskId);
      if (!task) {
        throw new APIError(404, 'Task Not Found', { taskId });
      }

      // For multi-adapter tasks, aggregate status
      if (task.type === 'multiAdapter') {
        return await this.getMultiAdapterTaskStatus(task);
      }

      // For single adapter tasks, get from specific adapter
      const adapterName = this.taskDistribution.get(taskId);
      if (adapterName) {
        const adapter = this.adapters.get(adapterName);
        if (adapter) {
          return await adapter.getTaskStatus(taskId);
        }
      }

      return { ...task, status: 'unknown' };

    } catch (error) {
      throw new APIError(500, 'Failed to Get Task Status', {
        message: error.message,
        taskId
      });
    }
  }

  /**
   * Get status for multi-adapter tasks
   */
  async getMultiAdapterTaskStatus(multiTask) {
    try {
      const subTaskStatuses = [];

      // Get status from each sub-task
      for (const subTask of multiTask.subTasks) {
        if (subTask.task) {
          try {
            const adapter = this.adapters.get(subTask.adapter);
            if (adapter) {
              const status = await adapter.getTaskStatus(subTask.task.id);
              subTaskStatuses.push({
                adapter: subTask.adapter,
                status: status
              });
            }
          } catch (error) {
            subTaskStatuses.push({
              adapter: subTask.adapter,
              status: 'error',
              error: error.message
            });
          }
        }
      }

      // Determine overall status
      const overallStatus = this.calculateMultiTaskStatus(subTaskStatuses);

      return {
        ...multiTask,
        status: overallStatus,
        subTaskStatuses,
        updatedAt: new Date()
      };

    } catch (error) {
      console.error('[UnifiedAPI] Failed to get multi-adapter task status:', error);
      return { ...multiTask, status: 'error', error: error.message };
    }
  }

  /**
   * Calculate overall status from sub-task statuses
   */
  calculateMultiTaskStatus(subTaskStatuses) {
    const statusCounts = {};
    subTaskStatuses.forEach(({ status }) => {
      const actualStatus = status.status || status;
      statusCounts[actualStatus] = (statusCounts[actualStatus] || 0) + 1;
    });

    // If any sub-task failed, overall task failed
    if (statusCounts.failed || statusCounts.error) {
      return 'failed';
    }

    // If all completed, overall task completed
    if (statusCounts.completed === subTaskStatuses.length) {
      return 'completed';
    }

    // If any still executing, overall still executing
    if (statusCounts.executing || statusCounts.running) {
      return 'executing';
    }

    return 'unknown';
  }

  /**
   * Cancel task across adapters
   */
  async cancelTask(taskId) {
    try {
      const task = this.activeTasks.get(taskId);
      if (!task) {
        return false;
      }

      if (task.type === 'multiAdapter') {
        // Cancel all sub-tasks
        for (const subTask of task.subTasks) {
          try {
            const adapter = this.adapters.get(subTask.adapter);
            if (adapter && subTask.task) {
              await adapter.cancelTask(subTask.task.id);
            }
          } catch (error) {
            console.warn(`[UnifiedAPI] Failed to cancel sub-task ${subTask.adapter}:`, error.message);
          }
        }
        task.status = 'cancelled';
        task.cancelledAt = new Date();
      } else {
        // Cancel single adapter task
        const adapterName = this.taskDistribution.get(taskId);
        if (adapterName) {
          const adapter = this.adapters.get(adapterName);
          if (adapter) {
            await adapter.cancelTask(taskId);
          }
        }
      }

      this.adapterLoad.set(task.adapter || 'unknown', (this.adapterLoad.get(task.adapter || 'unknown') || 0) - 1);

      return true;

    } catch (error) {
      console.error('[UnifiedAPI] Failed to cancel task:', error);
      return false;
    }
  }

  /**
   * Create unified streaming connection
   */
  createUnifiedStream(taskId, options = {}) {
    const streamInfo = {
      taskId,
      adapters: [],
      streamType: options.streamType || 'aggregated',
      connected: false,
      streams: new Map(),
      callbacks: new Map()
    };

    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.type === 'multiAdapter') {
      // Create streams for all adapters
      for (const subTask of task.subTasks) {
        if (subTask.task && this.adapters.has(subTask.adapter)) {
          const adapter = this.adapters.get(subTask.adapter);
          const adapterStream = adapter.createTaskStream(subTask.task.id, options);
          streamInfo.streams.set(subTask.adapter, adapterStream);
          streamInfo.adapters.push(subTask.adapter);

          // Setup data forwarding
          adapter.on('streamMessage', (data) => {
            if (data.taskId === subTask.task.id) {
              this.emit('streamMessage', {
                ...data,
                adapter: subTask.adapter,
                unifiedTaskId: taskId
              });
            }
          });
        }
      }
    } else {
      // Create single adapter stream
      const adapterName = this.taskDistribution.get(taskId);
      if (adapterName) {
        const adapter = this.adapters.get(adapterName);
        const adapterStream = adapter.createTaskStream(taskId, options);
        streamInfo.streams.set(adapterName, adapterStream);
        streamInfo.adapters.push(adapterName);
      }
    }

    streamInfo.connected = true;
    this.activeStreams.set(taskId, streamInfo);

    console.log(`[UnifiedAPI] Unified stream created for ${streamInfo.adapters.join(', ')}`);
    return streamInfo;
  }

  /**
   * Get list of all tasks across adapters
   */
  async getTasks(filters = {}) {
    try {
      const allTasks = [];

      // Get tasks from each adapter
      for (const [adapterName, adapter] of this.adapters) {
        try {
          const adapterTasks = await adapter.getTasks(filters);
          adapterTasks.forEach(task => {
            allTasks.push({
              ...task,
              adapter: adapterName,
              unifiedId: task.unifiedId || task.id
            });
          });
        } catch (error) {
          console.warn(`[UnifiedAPI] Failed to get tasks from ${adapterName}:`, error.message);
        }
      }

      // Apply unified filters
      if (filters.platform) {
        allTasks.filter(task => task.adapter === filters.platform);
      }

      if (filters.status) {
        allTasks.filter(task => task.status === filters.status);
      }

      // Sort by creation date
      allTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return allTasks;

    } catch (error) {
      console.error('[UnifiedAPI] Failed to get tasks:', error);
      throw error;
    }
  }

  /**
   * Get platform capabilities across all adapters
   */
  getCapabilities() {
    const capabilities = {
      platforms: {},
      totalAdapters: this.adapters.size,
      crossPlatformFeatures: [
        'task-orchestration',
        'load-balancing',
        'failover',
        'monitoring',
        'real-time-streaming'
      ],
      supportedFeatures: [],
      health: Object.fromEntries(this.healthStatus)
    };

    for (const [name, adapter] of this.adapters) {
      try {
        capabilities.platforms[name] = adapter.getCapabilities();
        if (capabilities.platforms[name].features) {
          capabilities.supportedFeatures.push(...capabilities.platforms[name].features);
        }
      } catch (error) {
        console.warn(`[UnifiedAPI] Failed to get capabilities for ${name}:`, error.message);
      }
    }

    // Remove duplicates
    capabilities.supportedFeatures = [...new Set(capabilities.supportedFeatures)];

    return capabilities;
  }

  /**
   * Perform health checks on all adapters
   */
  async performHealthChecks() {
    for (const [name, adapter] of this.adapters) {
      try {
        const isHealthy = await adapter.checkHealth().then(() => true).catch(() => false);
        const previousHealth = this.healthStatus.get(name);

        this.healthStatus.set(name, isHealthy ? 'healthy' : 'unhealthy');

        // Emit events for health changes
        if (previousHealth !== this.healthStatus.get(name)) {
          this.emit('adapterHealthChange', {
            adapter: name,
            status: this.healthStatus.get(name),
            timestamp: new Date()
          });
        }
      } catch (error) {
        this.healthStatus.set(name, 'unhealthy');
        console.warn(`[UnifiedAPI] Health check failed for ${name}:`, error.message);
      }
    }
  }

  /**
   * Balance load across adapters
   */
  balanceLoad() {
    if (!this.config.loadBalancing) return;

    const loads = Object.fromEntries(this.adapterLoad);

    // Check if we need load balancing
    const avgLoad = Object.values(loads).reduce((sum, load) => sum + load, 0) / Object.values(loads).length;
    const maxLoad = Math.max(...Object.values(loads));

    if (maxLoad > avgLoad * 1.5) {
      console.log('[UnifiedAPI] Load imbalance detected, rebalancing...');
      // Could implement more sophisticated load balancing here
    }
  }

  /**
   * Get metrics and monitoring data
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTasksByAdapter: Object.fromEntries(this.adapterLoad),
      health: Object.fromEntries(this.healthStatus),
      queueSize: this.taskQueue.length + this.taskPriorityQueue.length,
      streams: this.activeStreams.size
    };
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    console.log('[UnifiedAPI] Initiating graceful shutdown...');

    // Cancel all active tasks
    const cancelPromises = [];
    for (const [taskId, task] of this.activeTasks) {
      cancelPromises.push(this.cancelTask(taskId));
    }

    // Wait for cancellations to complete (with timeout)
    await Promise.race([
      Promise.all(cancelPromises),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    // Cleanup adapters
    const cleanupPromises = [];
    for (const [name, adapter] of this.adapters) {
      cleanupPromises.push(
        adapter.cleanup().catch(error =>
          console.warn(`[UnifiedAPI] Cleanup failed for ${name}:`, error.message)
        )
      );
    }

    await Promise.all(cleanupPromises);

    this.emit('shutdown');
    console.log('[UnifiedAPI] Graceful shutdown completed');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.gracefulShutdown();
  }
}

module.exports = UnifiedAPIManager;
