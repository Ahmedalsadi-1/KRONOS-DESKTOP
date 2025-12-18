import { ConnectionManager, MachineConfig } from '../connection-manager';

/**
 * Resource Monitor for Multi-Machine Systems
 * 
 * Monitors resource usage across connected machines
 */
export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
  };
  load: {
    oneMinute: number;
    fiveMinute: number;
    fifteenMinute: number;
  };
  uptime: number;
}

export interface ResourceLimits {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  processes: number;
}

export interface ResourceAlert {
  machineId: string;
  resourceType: 'cpu' | 'memory' | 'disk' | 'network';
  currentValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  message: string;
}

export interface PerformanceMetrics {
  machineId: string;
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export class ResourceMonitor {
  private static readonly MONITORING_INTERVAL = 60000; // 1 minute
  private static readonly ALERT_THRESHOLDS = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    disk: { warning: 85, critical: 95 },
    network: { warning: 80, critical: 90 }
  };

  private connectionManager: ConnectionManager;
  private resourceHistory: Map<string, ResourceUsage[]> = new Map();
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private activeAlerts: Map<string, ResourceAlert[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring: boolean = false;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Start monitoring all connected machines
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Resource monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting resource monitoring...');

    // Monitor every minute
    const interval = setInterval(async () => {
      await this.monitorAllMachines();
    }, ResourceMonitor.MONITORING_INTERVAL);

    // Store interval for cleanup
    this.monitoringIntervals.set('global', interval);

    console.log('Resource monitoring started');
  }

  /**
   * Stop monitoring all machines
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Clear all intervals
    this.monitoringIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.monitoringIntervals.clear();

    console.log('Resource monitoring stopped');
  }

  /**
   * Monitor specific machine
   */
  async monitorMachine(machineId: string): Promise<ResourceUsage> {
    try {
      const status = this.connectionManager.getMachineStatus(machineId);
      if (!status || !status.isConnected) {
        throw new Error(`Machine ${machineId} is not connected`);
      }

      // Get system information based on protocol
      const resourceUsage = await this.getResourceUsageForMachine(machineId);
      
      // Store in history
      this.addToHistory(machineId, resourceUsage);
      
      // Check for alerts
      await this.checkResourceAlerts(machineId, resourceUsage);

      return resourceUsage;
    } catch (error) {
      console.warn(`Failed to monitor machine ${machineId}:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor all connected machines
   */
  private async monitorAllMachines(): Promise<void> {
    const connectedMachines = this.connectionManager.getConnectedMachines();

    await Promise.allSettled(
      connectedMachines.map(machineId => this.monitorMachine(machineId))
    );
  }

  /**
   * Get resource usage for specific machine
   */
  private async getResourceUsageForMachine(machineId: string): Promise<ResourceUsage> {
    const status = this.connectionManager.getMachineStatus(machineId);
    if (!status) {
      throw new Error(`Machine ${machineId} not found`);
    }

    // Since we don't have actual SSH/RDP connections in this simulation,
    // we'll generate realistic mock data based on the machine's characteristics
    return this.generateMockResourceUsage(machineId);
  }

  /**
   * Generate mock resource usage data
   */
  private generateMockResourceUsage(machineId: string): ResourceUsage {
    const machineConfig = this.getMachineConfig(machineId);
    
    // Generate realistic resource usage with some variation
    const baseLoad = this.getMachineBaseLoad(machineId);
    
    return {
      cpu: Math.min(100, Math.max(0, baseLoad.cpu + (Math.random() - 0.5) * 20)),
      memory: Math.min(100, Math.max(0, baseLoad.memory + (Math.random() - 0.5) * 10)),
      disk: Math.min(100, Math.max(0, baseLoad.disk + (Math.random() - 0.5) * 5)),
      network: {
        bytesIn: Math.floor(Math.random() * 1000000) + 100000, // 100KB - 1MB
        bytesOut: Math.floor(Math.random() * 500000) + 50000,  // 50KB - 500KB
        connections: Math.floor(Math.random() * 100) + 10      // 10-110 connections
      },
      processes: {
        total: Math.floor(Math.random() * 200) + 50,           // 50-250 processes
        running: Math.floor(Math.random() * 20) + 5,           // 5-25 running
        sleeping: Math.floor(Math.random() * 180) + 45         // 45-225 sleeping
      },
      load: {
        oneMinute: Math.max(0, baseLoad.cpu / 100 * (Math.random() * 0.5 + 0.75)),
        fiveMinute: Math.max(0, baseLoad.cpu / 100 * (Math.random() * 0.3 + 0.85)),
        fifteenMinute: Math.max(0, baseLoad.cpu / 100 * (Math.random() * 0.2 + 0.9))
      },
      uptime: Math.floor(Math.random() * 86400 * 30) + 3600   // 1 hour to 30 days
    };
  }

  /**
   * Get machine configuration
   */
  private getMachineConfig(machineId: string): MachineConfig | undefined {
    // This would normally come from the connection manager
    // For now, we'll return a default configuration
    return {
      id: machineId,
      name: `Machine ${machineId}`,
      hostname: `machine-${machineId}`,
      port: 22,
      protocol: 'ssh',
      credentials: { username: 'user' },
      capabilities: ['remote_execution'],
      resourceLimits: { maxCpu: 100, maxMemory: 8192, maxConcurrentTasks: 10 },
      metadata: {}
    };
  }

  /**
   * Get machine base load (baseline resource usage)
   */
  private getMachineBaseLoad(machineId: string): { cpu: number; memory: number; disk: number } {
    // Use machine ID hash to create consistent baseline
    const hash = this.simpleHash(machineId);
    
    return {
      cpu: (hash % 40) + 20,    // 20-60% CPU baseline
      memory: (hash % 30) + 50, // 50-80% memory baseline
      disk: (hash % 20) + 60    // 60-80% disk baseline
    };
  }

  /**
   * Simple hash function for consistent baseline generation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Add resource usage to history
   */
  private addToHistory(machineId: string, usage: ResourceUsage): void {
    // Get or create history array
    const history = this.resourceHistory.get(machineId) || [];
    
    // Add new entry
    history.push(usage);
    
    // Keep only last 100 entries (about 100 minutes of data)
    if (history.length > 100) {
      history.shift();
    }
    
    this.resourceHistory.set(machineId, history);
  }

  /**
   * Check for resource alerts
   */
  private async checkResourceAlerts(machineId: string, usage: ResourceUsage): Promise<void> {
    const alerts: ResourceAlert[] = [];

    // Check CPU usage
    if (usage.cpu >= ResourceMonitor.ALERT_THRESHOLDS.cpu.critical) {
      alerts.push({
        machineId,
        resourceType: 'cpu',
        currentValue: usage.cpu,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.cpu.critical,
        severity: 'critical',
        timestamp: new Date(),
        message: `Critical CPU usage: ${usage.cpu.toFixed(1)}%`
      });
    } else if (usage.cpu >= ResourceMonitor.ALERT_THRESHOLDS.cpu.warning) {
      alerts.push({
        machineId,
        resourceType: 'cpu',
        currentValue: usage.cpu,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.cpu.warning,
        severity: 'warning',
        timestamp: new Date(),
        message: `High CPU usage: ${usage.cpu.toFixed(1)}%`
      });
    }

    // Check memory usage
    if (usage.memory >= ResourceMonitor.ALERT_THRESHOLDS.memory.critical) {
      alerts.push({
        machineId,
        resourceType: 'memory',
        currentValue: usage.memory,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.memory.critical,
        severity: 'critical',
        timestamp: new Date(),
        message: `Critical memory usage: ${usage.memory.toFixed(1)}%`
      });
    } else if (usage.memory >= ResourceMonitor.ALERT_THRESHOLDS.memory.warning) {
      alerts.push({
        machineId,
        resourceType: 'memory',
        currentValue: usage.memory,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.memory.warning,
        severity: 'warning',
        timestamp: new Date(),
        message: `High memory usage: ${usage.memory.toFixed(1)}%`
      });
    }

    // Check disk usage
    if (usage.disk >= ResourceMonitor.ALERT_THRESHOLDS.disk.critical) {
      alerts.push({
        machineId,
        resourceType: 'disk',
        currentValue: usage.disk,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.disk.critical,
        severity: 'critical',
        timestamp: new Date(),
        message: `Critical disk usage: ${usage.disk.toFixed(1)}%`
      });
    } else if (usage.disk >= ResourceMonitor.ALERT_THRESHOLDS.disk.warning) {
      alerts.push({
        machineId,
        resourceType: 'disk',
        currentValue: usage.disk,
        threshold: ResourceMonitor.ALERT_THRESHOLDS.disk.warning,
        severity: 'warning',
        timestamp: new Date(),
        message: `High disk usage: ${usage.disk.toFixed(1)}%`
      });
    }

    // Store alerts
    if (alerts.length > 0) {
      const existingAlerts = this.activeAlerts.get(machineId) || [];
      this.activeAlerts.set(machineId, [...existingAlerts, ...alerts]);
      
      // Log alerts
      alerts.forEach(alert => {
        const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
        console[logLevel](`[${alert.severity.toUpperCase()}] Machine ${machineId}: ${alert.message}`);
      });
    }
  }

  /**
   * Get current resource usage for machine
   */
  getCurrentResourceUsage(machineId: string): ResourceUsage | null {
    const history = this.resourceHistory.get(machineId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get resource usage history for machine
   */
  getResourceHistory(machineId: string, limit: number = 60): ResourceUsage[] {
    const history = this.resourceHistory.get(machineId) || [];
    return history.slice(-limit);
  }

  /**
   * Get performance metrics for machine
   */
  getPerformanceMetrics(machineId: string, limit: number = 60): PerformanceMetrics[] {
    const history = this.performanceHistory.get(machineId) || [];
    return history.slice(-limit);
  }

  /**
   * Get active alerts for machine
   */
  getActiveAlerts(machineId: string): ResourceAlert[] {
    return this.activeAlerts.get(machineId) || [];
  }

  /**
   * Get all active alerts
   */
  getAllActiveAlerts(): ResourceAlert[] {
    const allAlerts: ResourceAlert[] = [];
    this.activeAlerts.forEach(alerts => {
      allAlerts.push(...alerts);
    });
    return allAlerts;
  }

  /**
   * Clear alerts for machine
   */
  clearAlerts(machineId: string): void {
    this.activeAlerts.delete(machineId);
  }

  /**
   * Clear specific alert
   */
  clearAlert(machineId: string, alertIndex: number): void {
    const alerts = this.activeAlerts.get(machineId) || [];
    if (alertIndex >= 0 && alertIndex < alerts.length) {
      alerts.splice(alertIndex, 1);
      this.activeAlerts.set(machineId, alerts);
    }
  }

  /**
   * Get resource monitoring summary
   */
  getMonitoringSummary(): {
    totalMachines: number;
    monitoredMachines: number;
    activeAlerts: number;
    criticalAlerts: number;
    averageResourceUsage: {
      cpu: number;
      memory: number;
      disk: number;
    };
  } {
    const connectedMachines = this.connectionManager.getConnectedMachines();
    const monitoredMachines = this.resourceHistory.size;
    const allAlerts = this.getAllActiveAlerts();
    const criticalAlerts = allAlerts.filter(alert => alert.severity === 'critical');

    // Calculate average resource usage
    let totalCpu = 0, totalMemory = 0, totalDisk = 0, count = 0;
    
    connectedMachines.forEach(machineId => {
      const usage = this.getCurrentResourceUsage(machineId);
      if (usage) {
        totalCpu += usage.cpu;
        totalMemory += usage.memory;
        totalDisk += usage.disk;
        count++;
      }
    });

    return {
      totalMachines: connectedMachines.length,
      monitoredMachines,
      activeAlerts: allAlerts.length,
      criticalAlerts: criticalAlerts.length,
      averageResourceUsage: {
        cpu: count > 0 ? totalCpu / count : 0,
        memory: count > 0 ? totalMemory / count : 0,
        disk: count > 0 ? totalDisk / count : 0
      }
    };
  }

  /**
   * Check if machine is within resource limits
   */
  isWithinLimits(machineId: string, limits: ResourceLimits): { isWithin: boolean; violations: string[] } {
    const usage = this.getCurrentResourceUsage(machineId);
    if (!usage) {
      return { isWithin: false, violations: ['No resource data available'] };
    }

    const violations: string[] = [];

    if (usage.cpu > limits.cpu) {
      violations.push(`CPU usage ${usage.cpu.toFixed(1)}% exceeds limit ${limits.cpu}%`);
    }

    if (usage.memory > limits.memory) {
      violations.push(`Memory usage ${usage.memory.toFixed(1)}% exceeds limit ${limits.memory}%`);
    }

    if (usage.disk > limits.disk) {
      violations.push(`Disk usage ${usage.disk.toFixed(1)}% exceeds limit ${limits.disk}%`);
    }

    if (usage.network.bytesIn + usage.network.bytesOut > limits.network) {
      violations.push(`Network usage exceeds limit ${limits.network} bytes`);
    }

    if (usage.processes.total > limits.processes) {
      violations.push(`Process count ${usage.processes.total} exceeds limit ${limits.processes}`);
    }

    return {
      isWithin: violations.length === 0,
      violations
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.resourceHistory.clear();
    this.performanceHistory.clear();
    this.activeAlerts.clear();
  }
}

export default ResourceMonitor;
