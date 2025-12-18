const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const axios = require('axios');
const semver = require('semver');

// Import services from parent directory
const AIServices = require('../unified-ai-ecosystem/electron/main/index.js');

class KRONOSDistribution {
  constructor() {
    this.mainWindow = null;
    this.config = null;
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.isFirstRun = true;
    
    // Initialize logging
    log.transports.file.level = 'info';
    log.info('KRONOS Distribution Manager initialized');
  }

  async initialize() {
    try {
      log.info('Starting KRONOS Desktop Agent...');
      
      // Check if first run
      await this.checkFirstRun();
      
      // Load configuration
      await this.loadConfiguration();
      
      // Initialize auto updater
      this.setupAutoUpdater();
      
      // Create main window
      await this.createMainWindow();
      
      // Setup IPC handlers
      this.setupIPCHandlers();
      
      // Setup menu
      this.setupApplicationMenu();
      
      // Initialize embedded AI services
      await this.initializeAIServices();
      
      log.info('KRONOS Desktop Agent started successfully');
    } catch (error) {
      log.error('Failed to initialize KRONOS:', error);
      dialog.showErrorBox('Initialization Error', `Failed to start KRONOS: ${error.message}`);
      app.quit();
    }
  }

  async checkFirstRun() {
    try {
      const configExists = await fs.access(this.configPath).then(() => true).catch(() => false);
      if (!configExists) {
        log.info('First run detected - starting setup wizard');
        await this.runSetupWizard();
        this.isFirstRun = false;
      }
    } catch (error) {
      log.error('Error checking first run:', error);
    }
  }

  async loadConfiguration() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      log.info('Configuration loaded successfully');
    } catch (error) {
      log.warn('Could not load config, using defaults:', error);
      this.config = {
        version: '1.0.0',
        autoStart: false,
        startMinimized: false,
        checkUpdates: true,
        theme: 'dark',
        services: {
          ai: true,
          webAutomation: true,
          computerVision: true,
          androidControl: true
        },
        distribution: {
          platform: process.platform,
          arch: process.arch,
          installDate: new Date().toISOString()
        }
      };
      await this.saveConfiguration();
    }
  }

  async saveConfiguration() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      log.info('Configuration saved successfully');
    } catch (error) {
      log.error('Failed to save configuration:', error);
    }
  }

  async runSetupWizard() {
    try {
      const setupWindow = new BrowserWindow({
        width: 800,
        height: 600,
        parent: this.mainWindow,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      setupWindow.loadFile(path.join(__dirname, '../renderer/setup-wizard.html'));
      setupWindow.show();

      return new Promise((resolve) => {
        setupWindow.on('closed', () => {
          resolve();
        });
      });
    } catch (error) {
      log.error('Setup wizard failed:', error);
    }
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      show: false,
      icon: path.join(__dirname, '../../build-resources/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js'),
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    // Load the main application
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      if (!this.config.startMinimized) {
        this.mainWindow.show();
      } else {
        this.mainWindow.minimize();
      }
      log.info('Main window created and shown');
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupAutoUpdater() {
    if (process.env.NODE_ENV === 'development') {
      log.info('Auto-updater disabled in development mode');
      return;
    }

    const updateUrl = 'https://github.com/kronos-ai/kronos-desktop-agent/releases/latest';
    
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.showUpdateNotification(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.showUpdateReadyNotification();
    });

    autoUpdater.on('error', (error) => {
      log.error('Updater error:', error);
    });
  }

  showUpdateNotification(info) {
    if (!this.mainWindow) return;
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'KRONOS Update Available',
      message: `Version ${info.version} is available.\n\nCurrent version: ${app.getVersion()}\n\nWould you like to update?`,
      buttons: ['Update Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  }

  showUpdateReadyNotification() {
    if (!this.mainWindow) return;
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'KRONOS Ready to Update',
      message: 'Update has been downloaded. The application will restart to complete the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }

  async initializeAIServices() {
    try {
      log.info('Initializing embedded AI services...');
      
      // Initialize the AI services from the existing module
      if (AIServices && typeof AIServices.initialize === 'function') {
        await AIServices.initialize();
        log.info('AI services initialized successfully');
      } else {
        log.warn('AI services module not found or invalid');
      }
    } catch (error) {
      log.error('Failed to initialize AI services:', error);
    }
  }

  setupIPCHandlers() {
    // Configuration handlers
    ipcMain.handle('config:get', async () => {
      return this.config;
    });

    ipcMain.handle('config:set', async (event, newConfig) => {
      this.config = { ...this.config, ...newConfig };
      await this.saveConfiguration();
      return { success: true };
    });

    ipcMain.handle('config:reset', async () => {
      this.config = await this.getDefaultConfiguration();
      await this.saveConfiguration();
      return { success: true };
    });

    // Application info handlers
    ipcMain.handle('app:getInfo', async () => {
      return {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome
      };
    });

    ipcMain.handle('app:relaunch', async () => {
      app.relaunch();
      app.exit();
    });

    ipcMain.handle('app:checkUpdates', async () => {
      autoUpdater.checkForUpdatesAndNotify();
      return { checking: true };
    });

    // Services management handlers
    ipcMain.handle('services:getStatus', async () => {
      try {
        if (AIServices && typeof AIServices.getSystemInfo === 'function') {
          return await AIServices.getSystemInfo();
        } else {
          return { error: 'AI services not available' };
        }
      } catch (error) {
        log.error('Failed to get services status:', error);
        return { error: error.message };
      }
    });

    ipcMain.handle('services:restart', async () => {
      try {
        if (AIServices && typeof AIServices.initialize === 'function') {
          await AIServices.initialize();
          log.info('AI services restarted');
          return { success: true };
        } else {
          return { error: 'AI services not available' };
        }
      } catch (error) {
        log.error('Failed to restart services:', error);
        return { error: error.message };
      }
    });

    // Distribution info handlers
    ipcMain.handle('dist:getInfo', async () => {
      return {
        isDistributed: app.isPackaged,
        installPath: app.getAppPath(),
        userDataPath: app.getPath('userData'),
        logsPath: app.getPath('logs'),
        configPath: this.configPath
      };
    });
  }

  setupApplicationMenu() {
    const template = [
      {
        label: 'KRONOS',
        submenu: [
          {
            label: 'About KRONOS',
            click: () => this.showAboutDialog()
          },
          { type: 'separator' },
          {
            label: 'Preferences',
            accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
            click: () => this.mainWindow.webContents.send('open-preferences')
          },
          { type: 'separator' },
          {
            label: 'Check for Updates',
            click: () => {
              autoUpdater.checkForUpdatesAndNotify();
            }
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.cleanup();
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Services',
        submenu: [
          {
            label: 'Restart AI Services',
            click: () => {
              this.mainWindow.webContents.send('restart-services');
            }
          },
          {
            label: 'Service Status',
            click: () => {
              this.mainWindow.webContents.send('show-service-status');
            }
          },
          { type: 'separator' },
          {
            label: 'Configuration Wizard',
            click: () => {
              this.runSetupWizard();
            }
          }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Open Logs Folder',
            click: () => {
              shell.openPath(app.getPath('logs'));
            }
          },
          {
            label: 'Open Config Folder',
            click: () => {
              shell.openPath(app.getPath('userData'));
            }
          },
          { type: 'separator' },
          {
            label: 'Developer Tools',
            accelerator: process.platform === 'darwin' ? 'Option+Cmd+I' : 'Ctrl+Shift+I',
            click: () => {
              this.mainWindow.webContents.toggleDevTools();
            }
          }
        ]
      }
    ];

    const menu = require('electron').Menu.buildFromTemplate(template);
    require('electron').Menu.setApplicationMenu(menu);
  }

  showAboutDialog() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About KRONOS Desktop Agent',
      message: `KRONOS Desktop Agent
Version: ${app.getVersion()}
Platform: ${process.platform} (${process.arch})
Electron: ${process.versions.electron}

A comprehensive AI-powered desktop automation platform.

© 2024 KRONOS AI Team`,
      buttons: ['OK']
    });
  }

  async getDefaultConfiguration() {
    return {
      version: '1.0.0',
      autoStart: false,
      startMinimized: false,
      checkUpdates: true,
      theme: 'dark',
      services: {
        ai: true,
        webAutomation: true,
        computerVision: true,
        androidControl: true
      },
      distribution: {
        platform: process.platform,
        arch: process.arch,
        installDate: new Date().toISOString()
      }
    };
  }

  async cleanup() {
    try {
      log.info('Cleaning up KRONOS Distribution Manager...');
      
      // Cleanup AI services
      if (AIServices && typeof AIServices.cleanup === 'function') {
        await AIServices.cleanup();
      }
      
      // Save configuration
      await this.saveConfiguration();
      
      log.info('KRONOS cleanup completed');
    } catch (error) {
      log.error('Cleanup error:', error);
    }
  }
}

// Initialize the distribution manager
const distribution = new KRONOSDistribution();

// Electron app lifecycle
app.whenReady().then(async () => {
  await distribution.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (distribution.mainWindow === null) {
    distribution.createMainWindow();
  }
});

app.on('before-quit', async () => {
  await distribution.cleanup();
});

process.on('SIGINT', async () => {
  await distribution.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await distribution.cleanup();
  process.exit(0);
});