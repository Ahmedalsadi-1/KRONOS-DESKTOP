const { app, BrowserWindow, ipcMain, Menu } = require('electron');

const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Import service modules
const ProjectManager = require('./services/project-manager');
const ProcessMonitor = require('./services/process-monitor');
const WebSocketManager = require('./services/websocket-manager');
const AuthManager = require('./services/auth-manager');

console.log('App object:', typeof app, app ? 'available' : 'undefined');
if (!app) {
  console.error('Electron app object not available. Exiting.');
  process.exit(1);
}

// Global variables
let mainWindow = null;
let projectManager = null;
let processMonitor = null;
let webSocketManager = null;
let authManager = null;

// Initialize services
function initializeServices() {
  projectManager = new ProjectManager();
  processMonitor = new ProcessMonitor();
  webSocketManager = new WebSocketManager();
  authManager = new AuthManager();
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup application menu
function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            cleanup();
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Fullscreen' }
      ]
    },
    {
      label: 'Projects',
      submenu: [
        {
          label: 'Start All Services',
          click: () => {
            mainWindow.webContents.send('menu-action', 'start-all');
          }
        },
        {
          label: 'Stop All Services',
          click: () => {
            mainWindow.webContents.send('menu-action', 'stop-all');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-action', 'show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Setup IPC handlers
function setupIPC() {
  // Project management IPC handlers
  ipcMain.handle('project:start', async (event, projectId) => {
    try {
      await projectManager.startProject(projectId);
      return { success: true };
    } catch (error) {
      console.error('Failed to start project:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project:stop', async (event, projectId) => {
    try {
      await projectManager.stopProject(projectId);
      return { success: true };
    } catch (error) {
      console.error('Failed to stop project:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project:status', async (event, projectId) => {
    try {
      const status = await projectManager.getProjectStatus(projectId);
      return { success: true, status };
    } catch (error) {
      console.error('Failed to get project status:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project:list', async () => {
    try {
      const projects = await projectManager.listProjects();
      return { success: true, projects };
    } catch (error) {
      console.error('Failed to list projects:', error);
      return { success: false, error: error.message };
    }
  });

  // Task management IPC handlers
  ipcMain.handle('task:create', async (event, projectId, taskData) => {
    try {
      const taskId = await projectManager.createUnifiedTask(projectId, taskData);
      return { success: true, taskId };
    } catch (error) {
      console.error('Failed to create task:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('task:list', async (event, projectId) => {
    try {
      const tasks = await projectManager.getProjectTasks(projectId);
      return { success: true, tasks };
    } catch (error) {
      console.error('Failed to list tasks:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('task:cancel', async (event, taskId) => {
    try {
      const success = await projectManager.cancelTask(taskId);
      return { success };
    } catch (error) {
      console.error('Failed to cancel task:', error);
      return { success: false, error: error.message };
    }
  });

  // Authentication IPC handlers
  ipcMain.handle('auth:login', async (event, projectId, credentials) => {
    try {
      const tokens = await authManager.authenticatePlatform(projectId, credentials);
      return { success: true, tokens };
    } catch (error) {
      console.error('Authentication failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:logout', async (event, projectId) => {
    try {
      await authManager.clearAuthData(projectId);
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      return { success: false, error: error.message };
    }
  });

  // WebSocket streaming IPC handlers
  ipcMain.handle('stream:connect', async (event, projectId, taskId) => {
    try {
      const connection = await webSocketManager.connectToTaskStream(projectId, taskId);
      return { success: true, streamUrl: connection.url };
    } catch (error) {
      console.error('Failed to connect to stream:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stream:disconnect', async (event, taskId) => {
    try {
      webSocketManager.disconnectTaskStream(taskId);
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect stream:', error);
      return { success: false, error: error.message };
    }
  });
}

// Setup event handlers
function setupEventHandlers() {
  // Project status updates
  projectManager.on('status-change', (projectId, status) => {
    if (mainWindow) {
      mainWindow.webContents.send('project-status-changed', { projectId, status });
    }
  });

  // Task updates
  projectManager.on('task-update', (taskId, update) => {
    if (mainWindow) {
      mainWindow.webContents.send('task-updated', { taskId, update });
    }
  });

  // Process monitoring
  processMonitor.on('health-change', (projectId, health) => {
    if (mainWindow) {
      mainWindow.webContents.send('service-health-changed', { projectId, health });
    }
  });

  // Menu actions from renderer
  ipcMain.on('menu-action', (event, action) => {
    switch (action) {
      case 'start-all':
        handleStartAll();
        break;
      case 'stop-all':
        handleStopAll();
        break;
      case 'show-about':
        showAboutDialog();
        break;
    }
  });
}

// Application handlers
async function handleStartAll() {
  try {
    const projects = await projectManager.listProjects();
    for (const project of projects) {
      if (project.status === 'stopped') {
        await projectManager.startProject(project.id);
      }
    }
  } catch (error) {
    console.error('Failed to start all projects:', error);
  }
}

async function handleStopAll() {
  try {
    const projects = await projectManager.listProjects();
    for (const project of projects) {
      if (project.status === 'running') {
        await projectManager.stopProject(project.id);
      }
    }
  } catch (error) {
    console.error('Failed to stop all projects:', error);
  }
}

function showAboutDialog() {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Unified Automation Platform',
    message: 'Unified Automation Platform v1.0.0',
    detail: 'A comprehensive Electron desktop application for managing AI computer automation projects.',
    buttons: ['OK']
  });
}

function cleanup() {
  // Stop all running projects
  if (projectManager) {
    projectManager.stopAllProjects();
  }

  // Close all WebSocket connections
  if (webSocketManager) {
    webSocketManager.disconnectAll();
  }

  // Clear authentication data
  if (authManager) {
    authManager.clearAllAuth();
  }
}

// Initialize the application when ready
app.whenReady().then(() => {
  initializeServices();
  createWindow();
  setupMenu();
  setupIPC();
  setupEventHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
// End of main.js - application initialization handled by app.whenReady() above
