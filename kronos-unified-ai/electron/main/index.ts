import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import { spawn } from 'child_process';
import Store from 'electron-store';

const store = new Store();
let mainWindow: BrowserWindow;
let childProcesses: { [key: string]: any } = {};

const apps = {
  'open-computer-use': {
    name: 'Open Computer Use',
    path: path.join(__dirname, '../../open-computer-use'),
    command: 'npm run dev',
    port: 3003,
    description: 'AI-powered computer control and automation'
  },
  'ai-browser': {
    name: 'AI Browser',
    path: path.join(__dirname, '../../ai-browser'),
    command: 'npm run dev',
    port: 3000,
    description: 'Intelligent web automation and browsing'
  },
  'ui-tars': {
    name: 'UI-TARS',
    path: path.join(__dirname, '../../UI-TARS-desktop'),
    command: 'python -m ui_tars.app',
    port: null,
    description: 'UI automation with vision-language models'
  },
  'gbox': {
    name: 'GBox',
    path: path.join(__dirname, '../../gbox'),
    command: './gbox server',
    port: 8080,
    description: 'Android device automation platform'
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../preload/index.js')
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          click: () => {
            mainWindow.webContents.send('open-settings');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Applications',
      submenu: Object.entries(apps).map(([key, app]) => ({
        label: `${app.name} - ${app.description}`,
        click: () => {
          startApp(key);
        }
      }))
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Unified AI Ecosystem',
              message: 'Unified AI Ecosystem v1.0.0',
              detail: 'Integrated platform for AI-powered automation tools'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startApp(appKey: string) {
  const appConfig = apps[appKey];
  if (!appConfig) return;

  if (childProcesses[appKey]) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: `${appConfig.name} is already running`
    });
    return;
  }

  try {
    const [cmd, ...args] = appConfig.command.split(' ');
    const child = spawn(cmd, args, {
      cwd: appConfig.path,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    childProcesses[appKey] = child;

    child.stdout?.on('data', (data) => {
      console.log(`[${appConfig.name}] ${data}`);
    });

    child.stderr?.on('data', (data) => {
      console.error(`[${appConfig.name}] ${data}`);
    });

    child.on('close', (code) => {
      console.log(`${appConfig.name} exited with code ${code}`);
      delete childProcesses[appKey];
      mainWindow.webContents.send('app-closed', appKey);
    });

    mainWindow.webContents.send('app-started', appKey);

    // Open in browser if it has a port
    if (appConfig.port) {
      setTimeout(() => {
        shell.openExternal(`http://localhost:${appConfig.port}`);
      }, 3000);
    }

  } catch (error) {
    console.error(`Failed to start ${appConfig.name}:`, error);
    dialog.showErrorBox('Error', `Failed to start ${appConfig.name}`);
  }
}

function stopApp(appKey: string) {
  const child = childProcesses[appKey];
  if (child) {
    child.kill();
    delete childProcesses[appKey];
    mainWindow.webContents.send('app-stopped', appKey);
  }
}

// IPC handlers
ipcMain.handle('start-app', async (event, appKey) => {
  startApp(appKey);
});

ipcMain.handle('stop-app', async (event, appKey) => {
  stopApp(appKey);
});

ipcMain.handle('get-app-status', async (event, appKey) => {
  return !!childProcesses[appKey];
});

ipcMain.handle('get-apps', async () => {
  return apps;
});

ipcMain.handle('get-settings', async () => {
  return store.get('settings', {});
});

ipcMain.handle('set-settings', async (event, settings) => {
  store.set('settings', settings);
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  // Kill all child processes
  Object.values(childProcesses).forEach(child => {
    child.kill();
  });
  childProcesses = {};

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app shutdown
process.on('exit', () => {
  Object.values(childProcesses).forEach(child => {
    child.kill();
  });
});

process.on('SIGINT', () => {
  Object.values(childProcesses).forEach(child => {
    child.kill();
  });
  process.exit();
});

process.on('SIGTERM', () => {
  Object.values(childProcesses).forEach(child => {
    child.kill();
  });
  process.exit();
});