import { BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

interface AppConfig {
  name: string;
  command: string;
  args?: string[];
  port?: number;
  env?: Record<string, string>;
}

interface LaunchOptions {
  width?: number;
  height?: number;
  resizable?: boolean;
  floating?: boolean;
  tab?: string;
  fullscreen?: boolean;
  splitView?: boolean;
  position?: 'left' | 'right' | 'center';
}

interface RunningApp {
  id: string;
  name: string;
  process?: ChildProcess;
  window?: BrowserWindow;
  port?: number;
  status: 'running' | 'stopped' | 'error';
  startTime: Date;
}

export class AppLauncher {
  private runningApps: Map<string, RunningApp> = new Map();
  private appConfigs: Map<string, AppConfig> = new Map();
  private nextAppId = 1;

  constructor() {
    this.initializeAppConfigs();
  }

  private initializeAppConfigs(): void {
    // Configure available applications
    this.appConfigs.set('postiz', {
      name: 'Postiz',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3000,
      env: { NODE_ENV: 'development' },
    });

    this.appConfigs.set('bytebot', {
      name: 'Bytebot',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3001,
      env: { NODE_ENV: 'development' },
    });

    this.appConfigs.set('open-computer-use', {
      name: 'Open Computer Use',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3002,
      env: { NODE_ENV: 'development' },
    });

    this.appConfigs.set('gbox', {
      name: 'GBox',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3003,
      env: { NODE_ENV: 'development' },
    });

    this.appConfigs.set('ai-browser', {
      name: 'AI Browser',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3004,
      env: { NODE_ENV: 'development' },
    });
  }

  async launchApp(
    parentWindow: BrowserWindow | null,
    appName: string,
    options: LaunchOptions = {}
  ): Promise<RunningApp> {
    const config = this.appConfigs.get(appName);
    if (!config) {
      throw new Error(`Application '${appName}' not found`);
    }

    const appId = `${appName}-${this.nextAppId++}`;

    try {
      // Start the application process
      const process = spawn(config.command, config.args, {
        cwd: join(process.cwd(), appName),
        env: { ...process.env, ...config.env },
        stdio: 'pipe',
      });

      // Wait for app to be ready
      await this.waitForAppReady(config.port || 3000);

      // Create window if needed
      let appWindow: BrowserWindow | undefined;
      if (options.floating || options.fullscreen) {
        appWindow = this.createAppWindow(appId, config, options);
      }

      const runningApp: RunningApp = {
        id: appId,
        name: config.name,
        process,
        window: appWindow,
        port: config.port,
        status: 'running',
        startTime: new Date(),
      };

      this.runningApps.set(appId, runningApp);

      // Notify renderer of app launch
      if (parentWindow) {
        parentWindow.webContents.send('app:launched', {
          id: appId,
          name: config.name,
          port: config.port,
          options,
        });
      }

      return runningApp;
    } catch (error) {
      console.error(`Failed to launch app '${appName}':`, error);
      throw error;
    }
  }

  private createAppWindow(
    appId: string,
    config: AppConfig,
    options: LaunchOptions
  ): BrowserWindow {
    const window = new BrowserWindow({
      width: options.width || 1200,
      height: options.height || 800,
      resizable: options.resizable !== false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    if (options.fullscreen) {
      window.setFullScreen(true);
    }

    if (options.floating) {
      window.setAlwaysOnTop(true);
    }

    // Load app URL
    const url = `http://localhost:${config.port}`;
    window.loadURL(url);

    window.on('closed', () => {
      const app = this.runningApps.get(appId);
      if (app) {
        app.window = undefined;
      }
    });

    return window;
  }

  private waitForAppReady(port: number, maxAttempts = 30): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const checkReady = () => {
        attempts++;

        // Simple health check
        fetch(`http://localhost:${port}/health`)
          .then(() => resolve())
          .catch(() => {
            if (attempts < maxAttempts) {
              setTimeout(checkReady, 1000);
            } else {
              reject(new Error(`App on port ${port} failed to start`));
            }
          });
      };

      checkReady();
    });
  }

  async closeApp(appId: string): Promise<void> {
    const app = this.runningApps.get(appId);
    if (!app) {
      throw new Error(`App '${appId}' not found`);
    }

    if (app.process) {
      app.process.kill();
    }

    if (app.window) {
      app.window.close();
    }

    app.status = 'stopped';
    this.runningApps.delete(appId);
  }

  async closeAllApps(): Promise<void> {
    const appIds = Array.from(this.runningApps.keys());
    for (const appId of appIds) {
      await this.closeApp(appId);
    }
  }

  listAvailableApps(): AppConfig[] {
    return Array.from(this.appConfigs.values());
  }

  listRunningApps(): RunningApp[] {
    return Array.from(this.runningApps.values());
  }

  getAppStatus(appId: string): RunningApp | undefined {
    return this.runningApps.get(appId);
  }
}
