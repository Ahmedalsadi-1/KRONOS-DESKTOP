#!/usr/bin/env node

const { app, dialog, shell } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Configuration Wizard Script
class SetupWizard {
  constructor() {
    this.mainWindow = null;
    this.config = null;
    this.configPath = path.join(app.getPath('userData'), 'kronos-config.json');
  }

  async run() {
    try {
      console.log('Starting KRONOS Setup Wizard...');
      
      // Check if already configured
      const configExists = await fs.access(this.configPath).then(() => true).catch(() => false);
      
      if (configExists) {
        const result = await this.showDialog(
          'KRONOS Configuration Found',
          'KRONOS appears to already be configured. Would you like to:\n\n1. Reset configuration\n2. Run main application\n3. Exit setup',
          ['Reset', 'Run', 'Exit']
        );
        
        switch (result.response) {
          case 0: // Reset
            await this.resetConfiguration();
            await this.runMainApp();
            break;
          case 1: // Run main app
            await this.runMainApp();
            break;
          case 2: // Exit
            console.log('Setup wizard completed - user chose to exit');
            process.exit(0);
            break;
        }
      } else {
        // First time setup
        await this.performFirstTimeSetup();
        await this.runMainApp();
      }
    } catch (error) {
      console.error('Setup wizard failed:', error);
      process.exit(1);
    }
  }

  async resetConfiguration() {
    try {
      await fs.unlink(this.configPath);
      console.log('Configuration reset successfully');
    } catch (error) {
      console.error('Failed to reset configuration:', error);
    }
  }

  async runMainApp() {
    const mainAppPath = path.join(__dirname, '../unified-automation-platform/dist/main.js');
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      console.log('Starting main KRONOS application...');
      
      const child = spawn('electron', [mainAppPath], {
        detached: true,
        stdio: 'inherit'
      });
      
      child.on('error', (error) => {
        console.error('Failed to start main app:', error);
        reject(error);
      });
      
      child.on('spawn', () => {
        console.log('Main KRONOS application started');
        resolve();
      });
      
      // Detach from current process
      child.unref();
    });
  }

  async performFirstTimeSetup() {
    console.log('Performing first-time setup...');
    
    // Create default configuration
    const defaultConfig = {
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
    
    try {
      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('Default configuration created');
      
      await this.showDialog(
        'Setup Complete',
        'KRONOS Desktop Agent has been configured successfully!\n\nThe application will now start with default settings.\n\nYou can modify these settings later through the preferences menu.',
        ['OK']
      );
    } catch (error) {
      console.error('Failed to create configuration:', error);
      throw error;
    }
  }

  async showDialog(title, message, buttons) {
    return new Promise((resolve) => {
      const setupWindow = new BrowserWindow({
        width: 400,
        height: 250,
        parent: this.mainWindow,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      setupWindow.loadFile(path.join(__dirname, 'setup-dialog.html'));
      setupWindow.show();

      const responseHandler = async (event, response) => {
        resolve({ response });
        setupWindow.close();
      };

      // Create simple HTML for dialog
      const dialogHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background: #1a1a1a; 
              color: white; 
            }
            .container { 
              padding: 20px; 
            }
            .button { 
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              cursor: pointer; 
              margin: 5px; 
              border-radius: 5px;
            }
            .button:hover { 
              background: #0056b3; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${title}</h2>
            <p>${message}</p>
            ${buttons.map((btn, index) => `
              <button class="button" onclick="window.electronAPI.sendResponse(${index})">${btn}</button>
            `).join('')}
          </div>
        </body>
        </html>
      `;

      setupWindow.webContents.on('did-finish-load', () => {
        setupWindow.webContents.executeJavaScript(`
          const buttons = ${JSON.stringify(buttons)};
          const message = \`${message}\`;
          
          document.body.innerHTML = \`
            <div class="container">
              <h2>\${title}</h2>
              <p>\${message}</p>
              \${buttons.map((btn, index) => \`
                <button class="button" onclick="window.electronAPI.sendResponse(${index})">\${btn}</button>
              \`).join('')}
            </div>
          \`;
          
          window.electronAPI = {
            sendResponse: function(index) {
              require('electron').ipcRenderer.send('dialog-response', index);
            }
          };
        `);
      });

      setupWindow.webContents.on('ipc-message', responseHandler);
      setupWindow.on('closed', () => {
        console.log('Setup dialog closed without response');
        resolve({ response: -1 }); // User closed dialog
      });
    });
  }
}

// Run setup wizard if this script is called directly
if (require.main === module) {
  const wizard = new SetupWizard();
  wizard.run();
}

module.exports = SetupWizard;