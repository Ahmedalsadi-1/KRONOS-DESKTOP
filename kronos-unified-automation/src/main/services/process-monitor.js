const { EventEmitter } = require('events');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ProcessMonitor extends EventEmitter {
  constructor() {
    super();
    this.healthChecks = new Map();
    this.monitoringIntervals = new Map();
    this.systemMetrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      uptime: 0
    };
    
    this.startSystemMonitoring();
  }

  startSystemMonitoring() {
    // Monitor system resources every 5 seconds
    setInterval(async () => {
      await this.collectSystemMetrics();
    }, 5000);

    // Initial collection
    this.collectSystemMetrics();
  }

  async collectSystemMetrics() {
    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();
      const uptime = os.uptime();

      this.systemMetrics = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        uptime: uptime
      };

      this.emit('system-metrics-updated', this.systemMetrics);
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const totalTime = (endTime[0] * 1000000 + endTime[1]) / 1000; // Convert to microseconds
        const totalUsage = endUsage.user + endUsage.system;

        const cpuPercent = (totalUsage / totalTime) * 100;
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;
    
    return {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      percent: Math.round(usagePercent * 100) / 100
    };
  }

  async getDiskUsage() {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
        const lines = stdout.trim().split('\n');
        let totalSize = 0;
        let totalFree = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 3) {
            totalSize += parseInt(parts[1]);
            totalFree += parseInt(parts[2]);
          }
        }
        
        const used = totalSize - totalFree;
        const usagePercent = (used / totalSize) * 100;
        
        return {
          used,
          free: totalFree,
          total: totalSize,
          percent: Math.round(usagePercent * 100) / 100
        };
      } else {
        const { stdout } = await execAsync('df -h / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        const total = this.parseSize(parts[1]);
        const used = this.parseSize(parts[2]);
        const free = this.parseSize(parts[3]);
        const usagePercent = (used / total) * 100;
        
        return {
          used,
          free,
          total,
          percent: Math.round(usagePercent * 100) / 100
        };
      }
    } catch (error) {
      console.warn('Failed to get disk usage:', error.message);
      return { used: 0, free: 0, total: 0, percent: 0 };
    }
  }

  parseSize(sizeStr) {
    const units = { B: 1, K: 1024, M: 1024**2, G: 1024**3, T: 1024**4 };
    const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    return Math.round(value * (units[unit] || 1));
  }

  startProjectHealthMonitoring(projectId, healthCheckUrl, intervalMs = 30000) {
    if (this.monitoringIntervals.has(projectId)) {
      this.clearProjectHealthMonitoring(projectId);
    }

    const checkHealth = async () => {
      try {
        const isHealthy = await this.checkEndpointHealth(healthCheckUrl);
        const health = {
          projectId,
          isHealthy,
          timestamp: new Date(),
          responseTime: isHealthy ? await this.measureResponseTime(healthCheckUrl) : null,
          error: null
        };

        this.healthChecks.set(projectId, health);
        this.emit('health-change', projectId, health);

      } catch (error) {
        const health = {
          projectId,
          isHealthy: false,
          timestamp: new Date(),
          responseTime: null,
          error: error.message
        };

        this.healthChecks.set(projectId, health);
        this.emit('health-change', projectId, health);
      }
    };

    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, intervalMs);
    this.monitoringIntervals.set(projectId, interval);
  }

  clearProjectHealthMonitoring(projectId) {
    const interval = this.monitoringIntervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(projectId);
    }
    
    this.healthChecks.delete(projectId);
  }

  async checkEndpointHealth(url) {
    if (!url) return true;

    try {
      const axios = require('axios');
      const response = await axios.get(url, { 
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept any 2xx-4xx status as healthy
      });
      
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }

  async measureResponseTime(url) {
    if (!url) return null;

    try {
      const start = Date.now();
      const axios = require('axios');
      await axios.get(url, { timeout: 10000 });
      return Date.now() - start;
    } catch (error) {
      return null;
    }
  }

  getProjectHealth(projectId) {
    return this.healthChecks.get(projectId) || {
      projectId,
      isHealthy: false,
      timestamp: null,
      responseTime: null,
      error: 'No health data available'
    };
  }

  getAllProjectHealth() {
    const health = {};
    for (const [projectId, data] of this.healthChecks) {
      health[projectId] = data;
    }
    return health;
  }

  getSystemMetrics() {
    return { ...this.systemMetrics };
  }

  getProcessInfo(projectId) {
    try {
      const { spawn } = require('child_process');
      
      if (process.platform === 'win32') {
        return new Promise((resolve) => {
          exec(`tasklist /FI "IMAGENAME eq ${projectId}*" /FO CSV`, (error, stdout) => {
            if (error) {
              resolve(null);
              return;
            }
            
            const lines = stdout.trim().split('\n');
            if (lines.length > 1) {
              const data = lines[1].split(',').map(s => s.replace(/"/g, ''));
              resolve({
                pid: parseInt(data[1]),
                name: data[0],
                memory: data[4]
              });
            } else {
              resolve(null);
            }
          });
        });
      } else {
        return new Promise((resolve) => {
          exec(`ps aux | grep ${projectId} | grep -v grep`, (error, stdout) => {
            if (error) {
              resolve(null);
              return;
            }
            
            const lines = stdout.trim().split('\n');
            if (lines.length > 0) {
              const parts = lines[0].split(/\s+/);
              resolve({
                pid: parseInt(parts[1]),
                name: parts[10],
                cpu: parseFloat(parts[2]),
                memory: parseFloat(3)
              });
            } else {
              resolve(null);
            }
          });
        });
      }
    } catch (error) {
      console.warn(`Failed to get process info for ${projectId}:`, error.message);
      return null;
    }
  }

  async checkPortAvailability(port, host = 'localhost') {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, host, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  cleanup() {
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    this.healthChecks.clear();
  }
}

module.exports = ProcessMonitor;
