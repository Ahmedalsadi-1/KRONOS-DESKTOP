import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { join } from 'path';
import { isDev } from './utils';
import { AppLauncher } from './services/app-launcher';
import { DeviceManager } from './services/device-manager';
import { ServiceManager } from './services/service-manager';
import { WorkflowEngine } from './services/workflow-engine';

let mainWindow: BrowserWindow | null = null;

// Service instances
const appLauncher = new AppLauncher();
const deviceManager = new DeviceManager();
const serviceManager = new ServiceManager();
const workflowEngine = new WorkflowEngine();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About KRONOS',
          click: () => {
            // Show about dialog
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for App Launcher
ipcMain.handle('app:launch', async (event, appName: string, options: any) => {
  return await appLauncher.launchApp(mainWindow, appName, options);
});

ipcMain.handle('app:list', async () => {
  return appLauncher.listAvailableApps();
});

ipcMain.handle('app:close', async (event, appId: string) => {
  return await appLauncher.closeApp(appId);
});

// IPC Handlers for Device Manager
ipcMain.handle('device:list', async () => {
  return await deviceManager.listDevices();
});

ipcMain.handle('device:connect', async (event, deviceId: string, options: any) => {
  return await deviceManager.connectDevice(deviceId, options);
});

ipcMain.handle('device:disconnect', async (event, deviceId: string) => {
  return await deviceManager.disconnectDevice(deviceId);
});

ipcMain.handle('device:execute', async (event, deviceId: string, command: any) => {
  return await deviceManager.executeCommand(deviceId, command);
});

// IPC Handlers for Service Manager
ipcMain.handle('service:list', async () => {
  return await serviceManager.listServices();
});

ipcMain.handle('service:start', async (event, serviceNames: string[]) => {
  return await serviceManager.startServices(serviceNames);
});

ipcMain.handle('service:stop', async (event, serviceNames: string[]) => {
  return await serviceManager.stopServices(serviceNames);
});

ipcMain.handle('service:logs', async (event, serviceName: string, options: any) => {
  return await serviceManager.getLogs(serviceName, options);
});

ipcMain.handle('service:health', async () => {
  return await serviceManager.getHealthStatus();
});

// IPC Handlers for Workflow Engine
ipcMain.handle('workflow:create', async (event, workflowData: any) => {
  return await workflowEngine.createWorkflow(workflowData);
});

ipcMain.handle('workflow:execute', async (event, workflowId: string) => {
  return await workflowEngine.executeWorkflow(workflowId);
});

ipcMain.handle('workflow:list', async () => {
  return await workflowEngine.listWorkflows();
});

ipcMain.handle('workflow:history', async (event, workflowId: string) => {
  return await workflowEngine.getWorkflowHistory(workflowId);
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Cleanup on exit
app.on('before-quit', async () => {
  await appLauncher.closeAllApps();
  await serviceManager.stopAllServices();
});

export { mainWindow };
