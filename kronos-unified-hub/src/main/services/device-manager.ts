import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Device {
  id: string;
  name: string;
  type: 'android-emulator' | 'android-physical' | 'computer' | 'vm';
  status: 'connected' | 'offline' | 'error';
  platform?: string;
  model?: string;
  osVersion?: string;
  metrics?: DeviceMetrics;
}

export interface DeviceMetrics {
  cpu: number;
  memory: number;
  storage: number;
  battery?: number;
  temperature?: number;
}

export interface DeviceCommand {
  command: string;
  args?: Record<string, any>;
  timeout?: number;
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();
  private metricsIntervals: Map<string, NodeJS.Timeout> = new Map();

  async listDevices(): Promise<Device[]> {
    try {
      // Get Android devices via adb
      const androidDevices = await this.getAndroidDevices();

      // Get local computers/VMs
      const localDevices = await this.getLocalDevices();

      const allDevices = [...androidDevices, ...localDevices];

      // Update cache
      allDevices.forEach((device) => {
        this.devices.set(device.id, device);
      });

      return allDevices;
    } catch (error) {
      console.error('Failed to list devices:', error);
      return Array.from(this.devices.values());
    }
  }

  private async getAndroidDevices(): Promise<Device[]> {
    try {
      const { stdout } = await execAsync('adb devices -l');
      const lines = stdout.split('\n').slice(1);

      return lines
        .filter((line) => line.trim() && !line.includes('List of attached'))
        .map((line) => {
          const parts = line.split(/\s+/);
          const id = parts[0];
          const status = parts[1] as 'device' | 'offline' | 'unauthorized';

          return {
            id,
            name: `Android Device (${id})`,
            type: id.includes('emulator') ? 'android-emulator' : 'android-physical',
            status: status === 'device' ? 'connected' : 'offline',
            platform: 'Android',
          };
        });
    } catch (error) {
      console.warn('ADB not available or no Android devices found');
      return [];
    }
  }

  private async getLocalDevices(): Promise<Device[]> {
    // This would integrate with GBox or other VM management tools
    return [
      {
        id: 'localhost',
        name: 'Local Computer',
        type: 'computer',
        status: 'connected',
        platform: process.platform,
      },
    ];
  }

  async connectDevice(deviceId: string, options: any): Promise<Device> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device '${deviceId}' not found`);
    }

    try {
      if (device.type === 'android-emulator') {
        // Connect to Android emulator
        await execAsync(`adb connect ${deviceId}`);
      }

      device.status = 'connected';

      // Start monitoring metrics
      this.startMetricsMonitoring(deviceId);

      return device;
    } catch (error) {
      device.status = 'error';
      throw error;
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device '${deviceId}' not found`);
    }

    // Stop metrics monitoring
    this.stopMetricsMonitoring(deviceId);

    if (device.type === 'android-emulator') {
      await execAsync(`adb disconnect ${deviceId}`);
    }

    device.status = 'offline';
  }

  async executeCommand(deviceId: string, command: DeviceCommand): Promise<any> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device '${deviceId}' not found`);
    }

    if (device.status !== 'connected') {
      throw new Error(`Device '${deviceId}' is not connected`);
    }

    try {
      switch (command.command) {
        case 'screenshot':
          return await this.takeScreenshot(deviceId);
        case 'shell':
          return await this.executeShell(deviceId, command.args?.command);
        case 'install':
          return await this.installApp(deviceId, command.args?.path);
        case 'uninstall':
          return await this.uninstallApp(deviceId, command.args?.package);
        case 'metrics':
          return device.metrics;
        default:
          throw new Error(`Unknown command: ${command.command}`);
      }
    } catch (error) {
      console.error(`Failed to execute command on device '${deviceId}':`, error);
      throw error;
    }
  }

  private async takeScreenshot(deviceId: string): Promise<Buffer> {
    const { stdout } = await execAsync(`adb -s ${deviceId} shell screencap -p`);
    return Buffer.from(stdout, 'binary');
  }

  private async executeShell(deviceId: string, shellCommand: string): Promise<string> {
    const { stdout } = await execAsync(`adb -s ${deviceId} shell ${shellCommand}`);
    return stdout;
  }

  private async installApp(deviceId: string, apkPath: string): Promise<void> {
    await execAsync(`adb -s ${deviceId} install ${apkPath}`);
  }

  private async uninstallApp(deviceId: string, packageName: string): Promise<void> {
    await execAsync(`adb -s ${deviceId} uninstall ${packageName}`);
  }

  private startMetricsMonitoring(deviceId: string): void {
    if (this.metricsIntervals.has(deviceId)) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        const device = this.devices.get(deviceId);
        if (!device) {
          this.stopMetricsMonitoring(deviceId);
          return;
        }

        // Get device metrics
        const metrics = await this.getDeviceMetrics(deviceId);
        device.metrics = metrics;
      } catch (error) {
        console.warn(`Failed to get metrics for device '${deviceId}':`, error);
      }
    }, 5000); // Update every 5 seconds

    this.metricsIntervals.set(deviceId, interval);
  }

  private stopMetricsMonitoring(deviceId: string): void {
    const interval = this.metricsIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.metricsIntervals.delete(deviceId);
    }
  }

  private async getDeviceMetrics(deviceId: string): Promise<DeviceMetrics> {
    try {
      // Get CPU usage
      const { stdout: cpuOutput } = await execAsync(
        `adb -s ${deviceId} shell "top -n 1 | grep Cpu"`
      );
      const cpuMatch = cpuOutput.match(/(\d+)%/);
      const cpu = cpuMatch ? parseInt(cpuMatch[1]) : 0;

      // Get memory usage
      const { stdout: memOutput } = await execAsync(
        `adb -s ${deviceId} shell "cat /proc/meminfo | grep MemAvailable"`
      );
      const memMatch = memOutput.match(/(\d+)/);
      const memory = memMatch ? parseInt(memMatch[1]) : 0;

      // Get storage usage
      const { stdout: storageOutput } = await execAsync(
        `adb -s ${deviceId} shell "df /data | tail -1"`
      );
      const storageMatch = storageOutput.match(/(\d+)%/);
      const storage = storageMatch ? parseInt(storageMatch[1]) : 0;

      return { cpu, memory, storage };
    } catch (error) {
      console.warn(`Failed to get metrics for device '${deviceId}':`, error);
      return { cpu: 0, memory: 0, storage: 0 };
    }
  }

  getDevice(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }
}
