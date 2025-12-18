import { EventEmitter } from 'events';
import * as ssh2 from 'ssh2';
import { SSHProtocol } from './protocols/ssh';
import { RDPProtocol } from './protocols/rdp';
import { VNCProtocol } from './protocols/vnc';
import { NetworkScanner } from './discovery/network-scanner';
import { ResourceMonitor } from './monitoring/resource-monitor';
import { LoadBalancer } from './monitoring/load-balancer';

/**
 * Multi-Machine Connection Manager
 * 
 * Manages connections to multiple remote machines using various protocols.
 * Provides centralized control, monitoring, and load balancing across distributed machines.
 */
export interface MachineConfig {
  id: string;
  name: string;
  hostname: string;
  port: number;
  protocol: 'ssh' | 'rdp' | 'vnc';
  credentials: {
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
  capabilities: string[];
  resourceLimits: {
    maxCpu: number;
    maxMemory: number;
    maxConcurrentTasks: number;
  };
  metadata: {
    location?: string;
    environment?: 'production' | 'staging' | 'development';
    tags?: string[];
  };
}

export interface ConnectionStatus {
  machineId: string;
  isConnected: boolean;
  lastHeartbeat: Date;
  connectionTime?: Date;
  errorMessage?: string;
  latency: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface TaskExecution {
  id: string;
  machineId: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export class ConnectionManager extends EventEmitter {
  private machines: Map<string, MachineConfig> = new Map();
  private connections: Map<string, any> = new Map();
  private statuses: Map<string, ConnectionStatus> = new Map();
  private runningTasks: Map<string, TaskExecution> = new Map();
  
  private sshProtocol: SSHProtocol;
  private rdpProtocol: RDPProtocol;
  private vncProtocol: VNCProtocol;
  private networkScanner: NetworkScanner;
  private resourceMonitor: ResourceMonitor;
  private loadBalancer: LoadBalancer;

  constructor() {
    super();
    this.sshProtocol = new SSHProtocol();
    this.rdpProtocol = new RDPProtocol();
    this.vncProtocol = new VNCProtocol();
    this.networkScanner = new NetworkScanner();
    this.resourceMonitor = new ResourceMonitor();
    this.loadBalancer = new LoadBalancer(this);
    
    // Set up periodic monitoring
    this.startMonitoring();
  }

  /**
   * Add a new machine to the connection manager
   */
  async addMachine(config: MachineConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateMachineConfig(config);
      
      // Add to machine registry
      this.machines.set(config.id, config);
      
      // Initialize status
      this.statuses.set(config.id, {
        machineId: config.id,
        isConnected: false,
        lastHeartbeat: new Date(),
        latency: -1,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 }
      });
      
      // Test connection
      await this.testConnection(config.id);
      
      this.emit('machineAdded', config);
    } catch (error) {
      this.emit('error', { type: 'addMachine', machineId: config.id, error: error.message });
      throw error;
    }
  }

  /**
   * Remove a machine from the connection manager
   */
  async removeMachine(machineId: string): Promise<void> {
    try {
      // Disconnect if connected
      await this.disconnectMachine(machineId);
      
      // Remove from registry
      this.machines.delete(machineId);
      this.statuses.delete(machineId);
      
      this.emit('machineRemoved', machineId);
    } catch (error) {
      this.emit('error', { type: 'removeMachine', machineId, error: error.message });
      throw error;
    }
  }

  /**
   * Connect to a specific machine
   */
  async connectMachine(machineId: string): Promise<void> {
    const config = this.machines.get(machineId);
    if (!config) {
      throw new Error(`Machine ${machineId} not found`);
    }

    try {
      let connection: any;

      // Create connection based on protocol
      switch (config.protocol) {
        case 'ssh':
          connection = await this.sshProtocol.connect(config);
          break;
        case 'rdp':
          connection = await this.rdpProtocol.connect(config);
          break;
        case 'vnc':
          connection = await this.vncProtocol.connect(config);
          break;
        default:
          throw new Error(`Unsupported protocol: ${config.protocol}`);
      }

      // Store connection
      this.connections.set(machineId, connection);

      // Update status
      const status = this.statuses.get(machineId);
      if (status) {
        status.isConnected = true;
        status.connectionTime = new Date();
        status.lastHeartbeat = new Date();
        this.statuses.set(machineId, status);
      }

      this.emit('machineConnected', { machineId, config });
    } catch (error) {
      const status = this.statuses.get(machineId);
      if (status) {
        status.isConnected = false;
        status.errorMessage = error.message;
        this.statuses.set(machineId, status);
      }
      
      this.emit('error', { type: 'connectMachine', machineId, error: error.message });
      throw error;
    }
  }

  /**
   * Disconnect from a specific machine
   */
  async disconnectMachine(machineId: string): Promise<void> {
    const connection = this.connections.get(machineId);
    const config = this.machines.get(machineId);

    if (connection && config) {
      try {
        switch (config.protocol) {
          case 'ssh':
            await this.sshProtocol.disconnect(connection);
            break;
          case 'rdp':
            await this.rdpProtocol.disconnect(connection);
            break;
          case 'vnc':
            await this.vncProtocol.disconnect(connection);
            break;
        }
      } catch (error) {
        console.warn(`Error disconnecting from machine ${machineId}:`, error.message);
      }
    }

    // Clean up
    this.connections.delete(machineId);

    const status = this.statuses.get(machineId);
    if (status) {
      status.isConnected = false;
      status.connectionTime = undefined;
      status.errorMessage = undefined;
      this.statuses.set(machineId, status);
    }

    this.emit('machineDisconnected', machineId);
  }

  /**
   * Execute a command on a specific machine
   */
  async executeCommand(
    machineId: string,
    command: string,
    options: {
      timeout?: number;
      workingDirectory?: string;
      environment?: Record<string, string>;
    } = {}
  ): Promise<any> {
    const config = this.machines.get(machineId);
    if (!config) {
      throw new Error(`Machine ${machineId} not found`);
    }

    const task: TaskExecution = {
      id: this.generateTaskId(),
      machineId,
      command,
      status: 'pending',
      startedAt: new Date()
    };

    this.runningTasks.set(task.id, task);

    try {
      task.status = 'running';
      let result: any;

      switch (config.protocol) {
        case 'ssh':
          result = await this.sshProtocol.executeCommand(
            this.connections.get(machineId),
            command,
            options
          );
          break;
        case 'rdp':
          result = await this.rdpProtocol.executeCommand(
            this.connections.get(machineId),
            command,
            options
          );
          break;
        case 'vnc':
          // VNC doesn't support direct command execution
          throw new Error('VNC protocol does not support command execution');
        default:
          throw new Error(`Unsupported protocol: ${config.protocol}`);
      }

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      this.emit('taskCompleted', task);
      return result;
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error.message;

      this.emit('taskFailed', task);
      throw error;
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Get all connected machines
   */
  getConnectedMachines(): string[] {
    return Array.from(this.statuses.entries())
      .filter(([, status]) => status.isConnected)
      .map(([machineId]) => machineId);
  }

  /**
   * Get machine status
   */
  getMachineStatus(machineId: string): ConnectionStatus | undefined {
    return this.statuses.get(machineId);
  }

  /**
   * Get all machine statuses
   */
  getAllStatuses(): Record<string, ConnectionStatus> {
    return Object.fromEntries(this.statuses.entries());
  }

  /**
   * Discover machines on the network
   */
  async discoverMachines(
    networkRange: string,
    protocols: ('ssh' | 'rdp' | 'vnc')[] = ['ssh']
  ): Promise<MachineConfig[]> {
    try {
      const discoveredHosts = await this.networkScanner.scanNetwork(networkRange, protocols);
      
      // Convert discovered hosts to machine configurations
      const machines: MachineConfig[] = discoveredHosts.map(host => ({
        id: this.generateMachineId(),
        name: `Discovered ${host.hostname}`,
        hostname: host.ip,
        port: host.port,
        protocol: host.protocol,
        credentials: {
          username: '', // To be filled by user
          password: ''  // To be filled by user
        },
        capabilities: ['remote_execution', 'file_transfer'],
        resourceLimits: {
          maxCpu: 100,
          maxMemory: 8192,
          maxConcurrentTasks: 5
        },
        metadata: {
          environment: 'discovered',
          tags: ['auto-discovered']
        }
      }));

      return machines;
    } catch (error) {
      this.emit('error', { type: 'discoverMachines', error: error.message });
      throw error;
    }
  }

  /**
   * Get optimal machine for task execution using load balancer
   */
  async getOptimalMachine(taskRequirements: {
    cpu?: number;
    memory?: number;
    maxExecutionTime?: number;
    protocol?: 'ssh' | 'rdp' | 'vnc';
  }): Promise<string | null> {
    const availableMachines = this.getConnectedMachines();
    
    if (availableMachines.length === 0) {
      return null;
    }

    return this.loadBalancer.selectOptimalMachine(availableMachines, taskRequirements);
  }

  /**
   * Test connection to a machine
   */
  private async testConnection(machineId: string): Promise<boolean> {
    try {
      await this.connectMachine(machineId);
      await this.disconnectMachine(machineId);
      return true;
    } catch (error) {
      const status = this.statuses.get(machineId);
      if (status) {
        status.errorMessage = error.message;
        this.statuses.set(machineId, status);
      }
      return false;
    }
  }

  /**
   * Start periodic monitoring of all machines
   */
  private startMonitoring(): void {
    // Monitor connection health every 30 seconds
    setInterval(() => {
      this.monitorConnections();
    }, 30000);

    // Monitor resource usage every 60 seconds
    setInterval(() => {
      this.monitorResources();
    }, 60000);
  }

  /**
   * Monitor connection health
   */
  private async monitorConnections(): Promise<void> {
    const connectedMachines = this.getConnectedMachines();

    for (const machineId of connectedMachines) {
      try {
        const status = this.statuses.get(machineId);
        if (status) {
          // Test latency
          const startTime = Date.now();
          await this.pingMachine(machineId);
          status.latency = Date.now() - startTime;
          status.lastHeartbeat = new Date();
          this.statuses.set(machineId, status);
        }
      } catch (error) {
        console.warn(`Connection health check failed for ${machineId}:`, error.message);
        
        const status = this.statuses.get(machineId);
        if (status) {
          status.isConnected = false;
          status.errorMessage = error.message;
          this.statuses.set(machineId, status);
        }

        this.emit('machineDisconnected', machineId);
      }
    }
  }

  /**
   * Monitor resource usage
   */
  private async monitorResources(): Promise<void> {
    const connectedMachines = this.getConnectedMachines();

    for (const machineId of connectedMachines) {
      try {
        const usage = await this.resourceMonitor.getResourceUsage(machineId);
        const status = this.statuses.get(machineId);
        
        if (status) {
          status.resourceUsage = usage;
          this.statuses.set(machineId, status);
        }
      } catch (error) {
        console.warn(`Resource monitoring failed for ${machineId}:`, error.message);
      }
    }
  }

  /**
   * Ping a machine to test connectivity
   */
  private async pingMachine(machineId: string): Promise<void> {
    const config = this.machines.get(machineId);
    if (!config) {
      throw new Error(`Machine ${machineId} not found`);
    }

    switch (config.protocol) {
      case 'ssh':
        await this.sshProtocol.ping(this.connections.get(machineId));
        break;
      case 'rdp':
        await this.rdpProtocol.ping(this.connections.get(machineId));
        break;
      case 'vnc':
        await this.vncProtocol.ping(this.connections.get(machineId));
        break;
    }
  }

  /**
   * Validate machine configuration
   */
  private validateMachineConfig(config: MachineConfig): void {
    if (!config.id) {
      throw new Error('Machine ID is required');
    }

    if (!config.hostname) {
      throw new Error('Machine hostname is required');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      throw new Error('Valid port number is required');
    }

    if (!['ssh', 'rdp', 'vnc'].includes(config.protocol)) {
      throw new Error('Invalid protocol. Must be ssh, rdp, or vnc');
    }

    if (!config.credentials.username) {
      throw new Error('Username is required');
    }

    if (!config.credentials.password && !config.credentials.privateKey) {
      throw new Error('Either password or private key is required');
    }
  }

  /**
   * Generate unique machine ID
   */
  private generateMachineId(): string {
    return `machine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): TaskExecution[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskExecution | undefined {
    return this.runningTasks.get(taskId);
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Disconnect all machines
    const connectedMachines = this.getConnectedMachines();
    await Promise.all(connectedMachines.map(machineId => 
      this.disconnectMachine(machineId).catch(error => 
        console.warn(`Error disconnecting ${machineId}:`, error.message)
      )
    ));

    // Clear all data
    this.machines.clear();
    this.connections.clear();
    this.statuses.clear();
    this.runningTasks.clear();

    this.emit('shutdown');
  }
}

export default ConnectionManager;
