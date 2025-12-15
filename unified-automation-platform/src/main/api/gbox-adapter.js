const { BaseAPIAdapter, APIError } = require('./base-adapter');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Gbox API Adapter
 * Handles communication with gbox Go CLI and MCP server infrastructure
 */
class GboxAdapter extends BaseAPIAdapter {
  constructor(config = {}) {
    super({
      name: 'Gbox',
      version: '1.0.0',
      baseUrl: config.baseUrl || 'http://localhost:8003',
      timeout: config.timeout || 30000,
      authRequired: config.authRequired || false,
      supportedFeatures: [
        'device-management',
        'container-provisioning', 
        'mcp-integration',
        'infrastructure-automation',
        'service-deployment',
        'resource-monitoring'
      ],
      healthCheckPath: '/health',
      ...config
    });

    this.gboxPath = config.gboxPath || 'gbox';
    this.workspacePath = config.workspacePath || path.join(__dirname, '../../../gbox');
    this.activeContainers = new Map();
    this.devices = new Map();
    this.mcpServers = new Map();
    this.deployments = new Map();
  }

  /**
   * Setup authentication if required
   */
  async setupAuthentication() {
    // Gbox typically doesn't require authentication for local development
    this.isAuthenticated = true;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    try {
      console.log('[Gbox] Initializing adapter...');
      
      // Check if gbox CLI is available
      await this.checkGboxInstallation();
      
      // Check workspace structure
      await this.checkWorkspaceStructure();
      
      // Test connection
      await this.checkHealth();
      
      this.isConnected = true;
      this.emit('connected');
      
      console.log('[Gbox] Adapter initialized successfully');
    } catch (error) {
      console.error('[Gbox] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check if gbox CLI is installed
   */
  async checkGboxInstallation() {
    try {
      const version = await this.runCommand([this.gboxPath, 'version']);
      console.log('[Gbox] Gbox version:', version.stdout.trim());
      
      // Check available commands
      const commands = await this.runCommand([this.gboxPath, 'list']);
      console.log('[Gbox] Available commands:', commands.stdout.trim());
      
    } catch (error) {
      console.warn('[Gbox] Gbox CLI not found or not working properly:', error.message);
      throw new Error('Gbox CLI installation check failed');
    }
  }

  /**
   * Check workspace structure
   */
  async checkWorkspaceStructure() {
    try {
      const workspaceFiles = [
        'gbox.yaml',
        'devices.json',
        'containers',
        'mcp-servers'
      ];
      
      for (const file of workspaceFiles) {
        const filePath = path.join(this.workspacePath, file);
        try {
          await fs.access(filePath);
          console.log(`[Gbox] Found workspace file: ${file}`);
        } catch (error) {
          console.warn(`[Gbox] Workspace file not found: ${file}`);
        }
      }
    } catch (error) {
      console.error('[Gbox] Workspace check failed:', error);
    }
  }

  /**
   * Create a new task (infrastructure deployment/management)
   */
  async createTask(taskData) {
    try {
      console.log('[Gbox] Creating task:', taskData.title);
      
      const taskId = taskData.id || this.generateTaskId();
      
      const task = {
        id: taskId,
        platform: 'gbox',
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: taskData.description || taskData.prompt,
        operations: [],
        containers: [],
        devices: [],
        mcpServers: [],
        metadata: {
          gboxPath: this.gboxPath,
          workspacePath: this.workspacePath,
          deploymentType: taskData.deploymentType || 'container',
          resourceLimits: taskData.resourceLimits || {},
          environment: taskData.environment || 'development'
        }
      };

      this.activeTasks.set(taskId, task);
      
      // Execute the infrastructure task
      await this.executeInfrastructureTask(task);
      
      this.emit('taskCreated', task);
      console.log('[Gbox] Task created and started:', taskId);
      
      return task;
      
    } catch (error) {
      console.error('[Gbox] Failed to create task:', error);
      throw new APIError(500, 'Task Creation Failed', { 
        message: error.message,
        taskData 
      });
    }
  }

  /**
   * Execute infrastructure task
   */
  async executeInfrastructureTask(task) {
    try {
      task.status = 'executing';
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      
      // Parse task description to determine infrastructure operations
      const operations = this.parseTaskOperations(task.description);
      
      for (const operation of operations) {
       (task, operation);
      }
      
      await this.executeOperation // Mark as completed
      task.status = 'completed';
      task.completedAt = new Date();
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      this.emit('taskCompleted', task);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      this.emit('taskFailed', task);
    }
  }

  /**
   * Parse task description into infrastructure operations
   */
  parseTaskOperations(description) {
    const operations = [];
    const lowerDesc = description.toLowerCase();
    
    // Container operations
    if (lowerDesc.includes('deploy') || lowerDesc.includes('container')) {
      operations.push({
        type: 'deploy_container',
        resource: this.extractResourceName(description),
        config: this.extractContainerConfig(description)
      });
    }
    
    // Device management
    if (lowerDesc.includes('device') || lowerDesc.includes('provision')) {
      operations.push({
        type: 'provision_device',
        resource: this.extractResourceName(description),
        config: this.extractDeviceConfig(description)
      });
    }
    
    // MCP server operations
    if (lowerDesc.includes('mcp') || lowerDesc.includes('server')) {
      operations.push({
        type: 'setup_mcp',
        resource: this.extractResourceName(description),
        config: this.extractMCPConfig(description)
      });
    }
    
    // Monitoring operations
    if (lowerDesc.includes('monitor') || lowerDesc.includes('status')) {
      operations.push({
        type: 'monitor_resources',
        config: this.extractMonitoringConfig(description)
      });
    }
    
    return operations.length > 0 ? operations : [{
      type: 'generic_deployment',
      resource: 'default',
      config: { description }
    }];
  }

  /**
   * Execute individual infrastructure operation
   */
  async executeOperation(task, operation) {
    const operationLog = {
      timestamp: new Date(),
      type: operation.type,
      resource: operation.resource,
      status: 'started'
    };
    
    try {
      task.operations.push(operationLog);
      this.emit('operationStarted', { taskId: task.id, operation });
      
      let result;
      
      switch (operation.type) {
        case 'deploy_container':
          result = await this.deployContainer(operation.resource, operation.config);
          break;
        case 'provision_device':
          result = await this.provisionDevice(operation.resource, operation.config);
          break;
        case 'setup_mcp':
          result = await this.setupMCPServer(operation.resource, operation.config);
          break;
        case 'monitor_resources':
          result = await this.monitorResources(operation.config);
          break;
        default:
          result = await this.executeGenericOperation(operation);
      }
      
      operationLog.status = 'completed';
      operationLog.result = result;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      
      this.emit('operationCompleted', { taskId: task.id, operation, result });
      
    } catch (error) {
      operationLog.status = 'failed';
      operationLog.error = error.message;
      task.updatedAt = new Date();
      this.activeTasks.set(task.id, task);
      
      this.emit('operationFailed', { taskId: task.id, operation, error: error.message });
      throw error;
    }
  }

  /**
   * Deploy container
   */
  async deployContainer(resourceName, config) {
    try {
      console.log(`[Gbox] Deploying container: ${resourceName}`);
      
      const args = [
        'deploy',
        resourceName,
        '--config', JSON.stringify(config)
      ];
      
      const result = await this.runCommand([this.gboxPath, ...args]);
      
      const containerInfo = {
        id: `${resourceName}_${Date.now()}`,
        name: resourceName,
        status: 'deployed',
        createdAt: new Date(),
        config: config,
        deploymentResult: result.stdout
      };
      
      this.activeContainers.set(containerInfo.id, containerInfo);
      
      if (!task.containers) task.containers = [];
      task.containers.push(containerInfo);
      
      return containerInfo;
      
    } catch (error) {
      console.error(`[Gbox] Container deployment failed:`, error);
      throw error;
    }
  }

  /**
   * Provision device
   */
  async provisionDevice(deviceName, config) {
    try {
      console.log(`[Gbox] Provisioning device: ${deviceName}`);
      
      const args = [
        'device',
        'provision',
        deviceName,
        '--config', JSON.stringify(config)
      ];
      
      const result = await this.runCommand([this.gboxPath, ...args]);
      
      const deviceInfo = {
        id: `${deviceName}_${Date.now()}`,
        name: deviceName,
        status: 'provisioned',
        createdAt: new Date(),
        config: config,
        provisioningResult: result.stdout
      };
      
      this.devices.set(deviceInfo.id, deviceInfo);
      
      return deviceInfo;
      
    } catch (error) {
      console.error(`[Gbox] Device provisioning failed:`, error);
      throw error;
    }
  }

  /**
   * Setup MCP server
   */
  async setupMCPServer(serverName, config) {
    try {
      console.log(`[Gbox] Setting up MCP server: ${serverName}`);
      
      const args = [
        'mcp',
        'setup',
        serverName,
        '--config', JSON.stringify(config)
      ];
      
      const result = await this.runCommand([this.gboxPath, ...args]);
      
      const mcpInfo = {
        id: `${serverName}_${Date.now()}`,
        name: serverName,
        status: 'running',
        createdAt: new Date(),
        config: config,
        setupResult: result.stdout
      };
      
      this.mcpServers.set(mcpInfo.id, mcpInfo);
      
      return mcpInfo;
      
    } catch (error) {
      console.error(`[Gbox] MCP server setup failed:`, error);
      throw error;
    }
  }

  /**
   * Monitor resources
   */
  async monitorResources(config) {
    try {
      console.log('[Gbox] Monitoring resources...');
      
      const args = ['monitor', '--format', 'json'];
      if (config.duration) {
        args.push('--duration', config.duration.toString());
      }
      
      const result = await this.runCommand([this.gboxPath, ...args]);
      
      const monitoringData = JSON.parse(result.stdout);
      
      return {
        timestamp: new Date(),
        resources: monitoringData,
        summary: this.generateResourceSummary(monitoringData)
      };
      
    } catch (error) {
      console.error('[Gbox] Resource monitoring failed:', error);
      throw error;
    }
  }

  /**
   * Execute generic operation
   */
  async executeGenericOperation(operation) {
    try {
      console.log(`[Gbox] Executing generic operation: ${operation.type}`);
      
      const args = [operation.type, operation.resource];
      const result = await this.runCommand([this.gboxPath, ...args]);
      
      return {
        operation: operation.type,
        resource: operation.resource,
        result: result.stdout,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`[Gbox] Generic operation failed:`, error);
      throw error;
    }
  }

  /**
   * Extract resource name from description
   */
  extractResourceName(description) {
    // Simple extraction - in practice, this would use NLP
    const words = description.split(/\s+/);
    const potentialNames = words.filter(word => 
      word.length > 3 && 
      !['deploy', 'container', 'device', 'server', 'mcp', 'monitor'].includes(word.toLowerCase())
    );
    
    return potentialNames[0] || 'default';
  }

  /**
   * Extract container configuration
   */
  extractContainerConfig(description) {
    const config = {
      image: 'ubuntu:latest',
      ports: [],
      environment: {},
      resources: {}
    };
    
    // Parse port mappings
    const portMatches = description.match(/port[s]?[:\s]+(\d+)/gi);
    if (portMatches) {
      config.ports = portMatches.map(match => parseInt(match.match(/\d+/)[0]));
    }
    
    // Parse resource limits
    const cpuMatch = description.match(/cpu[:\s]+(\d+)/i);
    if (cpuMatch) {
      config.resources.cpu = parseInt(cpuMatch[1]);
    }
    
    const memMatch = description.match(/memory[:\s]+(\d+)(mb|gb)/i);
    if (memMatch) {
      const value = parseInt(memMatch[1]);
      const unit = memMatch[2].toLowerCase();
      config.resources.memory = unit === 'gb' ? value * 1024 : value;
    }
    
    return config;
  }

  /**
   * Extract device configuration
   */
  extractDeviceConfig(description) {
    return {
      type: 'virtual',
      capabilities: ['automation', 'monitoring'],
      resources: {
        cpu: 2,
        memory: 4096,
        storage: 10240
      }
    };
  }

  /**
   * Extract MCP configuration
   */
  extractMCPConfig(description) {
    return {
      protocol: 'stdio',
      tools: ['automation', 'monitoring'],
      environment: 'development'
    };
  }

  /**
   * Extract monitoring configuration
   */
  extractMonitoringConfig(description) {
    const config = {
      duration: 300, // 5 minutes default
      metrics: ['cpu', 'memory', 'disk', 'network']
    };
    
    const durationMatch = description.match(/(\d+)\s*(second|minute|hour)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      config.duration = unit === 'minute' ? value * 60 : 
                     unit === 'hour' ? value * 3600 : value;
    }
    
    return config;
  }

  /**
   * Generate resource summary
   */
  generateResourceSummary(monitoringData) {
    return {
      totalContainers: monitoringData.containers?.length || 0,
      activeDevices: monitoringData.devices?.filter(d => d.status === 'active').length || 0,
      runningMCP: monitoringData.mcp_servers?.filter(s => s.status === 'running').length || 0,
      resourceUtilization: {
        cpu: monitoringData.cpu_usage || 0,
        memory: monitoringData.memory_usage || 0,
        disk: monitoringData.disk_usage || 0
      }
    };
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
      
      return task;
      
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
   * Cancel a running task
   */
  async cancelTask(taskId) {
    try {
      console.log('[Gbox] Cancelling task:', taskId);
      
      const task = this.activeTasks.get(taskId);
      if (task) {
        // Clean up any deployed resources
        if (task.containers) {
          for (const container of task.containers) {
            try {
              await this.runCommand([this.gboxPath, 'stop', container.name]);
              await this.runCommand([this.gboxPath, 'remove', container.name]);
            } catch (error) {
              console.warn(`[Gbox] Failed to cleanup container ${container.name}:`, error);
            }
          }
        }
        
        task.status = 'cancelled';
        task.cancelledAt = new Date();
        task.updatedAt = new Date();
        this.activeTasks.set(taskId, task);
        this.emit('taskCancelled', task);
      }
      
      console.log('[Gbox] Task cancelled successfully:', taskId);
      return true;
      
    } catch (error) {
      console.error('[Gbox] Failed to cancel task:', error);
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
      let tasks = Array.from(this.activeTasks.values());
      
      // Apply filters
      if (filters.status) {
        tasks = tasks.filter(task => task.status === filters.status);
      }
      
      if (filters.limit) {
        tasks = tasks.slice(0, filters.limit);
      }
      
      // Sort by creation date
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return tasks;
      
    } catch (error) {
      console.error('[Gbox] Failed to get tasks:', error);
      throw new APIError(500, 'Failed to Fetch Tasks', { 
        message: error.message,
        filters 
      });
    }
  }

  /**
   * Create WebSocket stream for real-time infrastructure updates
   */
  createTaskStream(taskId, options = {}) {
    // Simulate streaming with periodic updates
    const streamInfo = {
      taskId,
      connected: true,
      updateInterval: options.updateInterval || 5000,
      timer: null
    };
    
    // Set up periodic updates
    streamInfo.timer = setInterval(() => {
      const task = this.activeTasks.get(taskId);
      if (task) {
        this.emit('streamMessage', {
          taskId,
          data: {
            type: 'status_update',
            task: task,
            timestamp: new Date()
          }
        });
      }
    }, streamInfo.updateInterval);
    
    this.taskStreams = this.taskStreams || new Map();
    this.taskStreams.set(taskId, streamInfo);
    
    console.log('[Gbox] Task stream created for:', taskId);
    return streamInfo;
  }

  /**
   * Get list of active containers
   */
  async getContainers(filters = {}) {
    try {
      let containers = Array.from(this.activeContainers.values());
      
      if (filters.status) {
        containers = containers.filter(container => container.status === filters.status);
      }
      
      return containers;
      
    } catch (error) {
      console.error('[Gbox] Failed to get containers:', error);
      throw error;
    }
  }

  /**
   * Get list of devices
   */
  async getDevices(filters = {}) {
    try {
      let devices = Array.from(this.devices.values());
      
      if (filters.status) {
        devices = devices.filter(device => device.status === filters.status);
      }
      
      return devices;
      
    } catch (error) {
      console.error('[Gbox] Failed to get devices:', error);
      throw error;
    }
  }

  /**
   * Get list of MCP servers
   */
  async getMCPServers(filters = {}) {
    try {
      let servers = Array.from(this.mcpServers.values());
      
      if (filters.status) {
        servers = servers.filter(server => server.status === filters.status);
      }
      
      return servers;
      
    } catch (error) {
      console.error('[Gbox] Failed to get MCP servers:', error);
      throw error;
    }
  }

  /**
   * Run command and return result
   */
  runCommand(args) {
    return new Promise((resolve, reject) => {
      const process = spawn(args[0], args.slice(1), {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Map platform task status to unified status
   */
  mapTaskStatus(platformStatus) {
    const statusMap = {
      'queued': 'queued',
      'executing': 'executing',
      'running': 'executing',
      'deployed': 'completed',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'error': 'failed'
    };
    
    return statusMap[platformStatus] || 'unknown';
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `gbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get platform-specific capabilities
   */
  getCapabilities() {
    return {
      name: this.config.name,
      version: this.config.version,
      features: this.config.supportedFeatures,
      maxConcurrentTasks: 5,
      supportedOperations: [
        'deploy_container', 'provision_device', 'setup_mcp',
        'monitor_resources', 'scale_service', 'rollback_deployment'
      ],
      requirements: {
        go: '1.19+',
        docker: true,
        kubernetes: false, // Optional
        mcp: true
      },
      infrastructureTypes: [
        'container', 'virtual_machine', 'physical_device', 'cloud_service'
      ]
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear all active tasks
    this.activeTasks.clear();
    
    // Clean up containers
    for (const [containerId, container] of this.activeContainers) {
      try {
        await this.runCommand([this.gboxPath, 'stop', container.name]);
        await this.runCommand([this.gboxPath, 'remove', container.name]);
      } catch (error) {
        console.warn(`[Gbox] Failed to cleanup container ${container.name}:`, error);
      }
    }
    this.activeContainers.clear();
    
    // Clear devices and MCP servers
    this.devices.clear();
    this.mcpServers.clear();
    this.deployments.clear();
    
    // Close streams
    if (this.taskStreams) {
      for (const [taskId, stream] of this.taskStreams) {
        if (stream.timer) {
          clearInterval(stream.timer);
        }
      }
      this.taskStreams.clear();
    }
    
    await super.disconnect();
  }
}

module.exports = GboxAdapter;
