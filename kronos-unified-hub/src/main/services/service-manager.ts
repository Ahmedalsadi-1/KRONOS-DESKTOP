import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Service {
  id: string;
  name: string;
  type: 'docker' | 'process' | 'mcp-server';
  status: 'running' | 'stopped' | 'error';
  port?: number;
  cpu?: number;
  memory?: number;
  uptime?: number;
  logs?: string[];
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck?: Date;
}

export class ServiceManager {
  private services: Map<string, Service> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    // Docker services
    const dockerServices = [
      { id: 'onlysnarf', name: 'OnlySnarf', port: 5005 },
      { id: 'instapy', name: 'InstaPy', port: 5001 },
      { id: 'instagrapi', name: 'InstaGrapi', port: 5002 },
      { id: 'tiktok_api', name: 'TikTok API', port: 5003 },
      { id: 'pytube', name: 'PyTube', port: 5004 },
      { id: 'youtube_upload', name: 'YouTube Upload', port: 5005 },
      { id: 'agent-orchestrator', name: 'Agent Orchestrator', port: 8080 },
    ];

    dockerServices.forEach((service) => {
      this.services.set(service.id, {
        ...service,
        type: 'docker',
        status: 'stopped',
      });
    });

    // MCP Servers
    const mcpServers = [
      { id: 'bytebot-mcp', name: 'Bytebot MCP', port: 3000 },
      { id: 'browser-mcp', name: 'Browser Tools MCP', port: 3001 },
      { id: 'gbox-mcp', name: 'GBox Android MCP', port: 3002 },
    ];

    mcpServers.forEach((service) => {
      this.services.set(service.id, {
        ...service,
        type: 'mcp-server',
        status: 'stopped',
      });
    });
  }

  async listServices(): Promise<Service[]> {
    try {
      // Check Docker services
      const { stdout } = await execAsync('docker ps -a --format "{{.Names}},{{.Status}}"');
      const lines = stdout.split('\n').filter((line) => line.trim());

      lines.forEach((line) => {
        const [name, status] = line.split(',');
        const service = this.services.get(name);
        if (service) {
          service.status = status.includes('Up') ? 'running' : 'stopped';
        }
      });
    } catch (error) {
      console.warn('Docker not available or no services running');
    }

    return Array.from(this.services.values());
  }

  async startServices(serviceNames: string[]): Promise<void> {
    try {
      const services = serviceNames.map((name) => this.services.get(name)).filter(Boolean);

      for (const service of services) {
        if (!service) continue;

        if (service.type === 'docker') {
          await execAsync(`docker-compose up -d ${service.id}`);
          service.status = 'running';

          // Start health checks
          this.startHealthCheck(service.id);
        }
      }
    } catch (error) {
      console.error('Failed to start services:', error);
      throw error;
    }
  }

  async stopServices(serviceNames: string[]): Promise<void> {
    try {
      const services = serviceNames.map((name) => this.services.get(name)).filter(Boolean);

      for (const service of services) {
        if (!service) continue;

        if (service.type === 'docker') {
          await execAsync(`docker-compose down ${service.id}`);
          service.status = 'stopped';

          // Stop health checks
          this.stopHealthCheck(service.id);
        }
      }
    } catch (error) {
      console.error('Failed to stop services:', error);
      throw error;
    }
  }

  async stopAllServices(): Promise<void> {
    try {
      await execAsync('docker-compose down');
      this.services.forEach((service) => {
        service.status = 'stopped';
        this.stopHealthCheck(service.id);
      });
    } catch (error) {
      console.warn('Failed to stop all services:', error);
    }
  }

  async scaleService(serviceName: string, replicas: number): Promise<void> {
    try {
      await execAsync(`docker-compose up -d --scale ${serviceName}=${replicas}`);
    } catch (error) {
      console.error(`Failed to scale service '${serviceName}':`, error);
      throw error;
    }
  }

  async getLogs(serviceName: string, options: { lines?: number; follow?: boolean } = {}): Promise<string[]> {
    try {
      const lines = options.lines || 100;
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${serviceName}`);
      return stdout.split('\n').filter((line) => line.trim());
    } catch (error) {
      console.error(`Failed to get logs for service '${serviceName}':`, error);
      return [];
    }
  }

  async getHealthStatus(): Promise<ServiceHealth[]> {
    const health: ServiceHealth[] = [];

    for (const service of this.services.values()) {
      if (service.status !== 'running') {
        health.push({
          service: service.name,
          status: 'unknown',
          lastCheck: new Date(),
        });
        continue;
      }

      try {
        const startTime = Date.now();
        const response = await fetch(`http://localhost:${service.port}/health`, {
          timeout: 5000,
        });
        const responseTime = Date.now() - startTime;

        health.push({
          service: service.name,
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime,
          lastCheck: new Date(),
        });
      } catch (error) {
        health.push({
          service: service.name,
          status: 'unhealthy',
          lastCheck: new Date(),
        });
      }
    }

    return health;
  }

  async getServiceMetrics(serviceName: string): Promise<Partial<Service>> {
    try {
      const { stdout } = await execAsync(
        `docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}}" ${serviceName}`
      );

      const [cpuStr, memStr] = stdout.split(',');
      const cpu = parseFloat(cpuStr.replace('%', ''));
      const memory = parseFloat(memStr.split('/')[0].replace('MiB', '').trim());

      return { cpu, memory };
    } catch (error) {
      console.warn(`Failed to get metrics for service '${serviceName}':`, error);
      return {};
    }
  }

  private startHealthCheck(serviceId: string): void {
    if (this.healthCheckIntervals.has(serviceId)) {
      return; // Already checking
    }

    const interval = setInterval(async () => {
      try {
        const service = this.services.get(serviceId);
        if (!service || service.status !== 'running') {
          this.stopHealthCheck(serviceId);
          return;
        }

        const response = await fetch(`http://localhost:${service.port}/health`, {
          timeout: 5000,
        });

        service.status = response.ok ? 'running' : 'error';
      } catch (error) {
        const service = this.services.get(serviceId);
        if (service) {
          service.status = 'error';
        }
      }
    }, 10000); // Check every 10 seconds

    this.healthCheckIntervals.set(serviceId, interval);
  }

  private stopHealthCheck(serviceId: string): void {
    const interval = this.healthCheckIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceId);
    }
  }

  getService(serviceId: string): Service | undefined {
    return this.services.get(serviceId);
  }

  getAllServices(): Service[] {
    return Array.from(this.services.values());
  }
}
