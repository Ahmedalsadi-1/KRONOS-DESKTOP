const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog methods
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Configuration management
  newConfiguration: () => ipcRenderer.send('new-configuration'),
  openConfiguration: (filePath) => ipcRenderer.send('open-configuration', filePath),
  saveConfiguration: () => ipcRenderer.send('save-configuration'),
  exportSettings: () => ipcRenderer.send('export-settings'),

  // Preferences
  openPreferences: () => ipcRenderer.send('open-preferences'),

  // Automation controls
  startAllAgents: () => ipcRenderer.send('start-all-agents'),
  stopAllAgents: () => ipcRenderer.send('stop-all-agents'),
  connectMachine: () => ipcRenderer.send('connect-machine'),
  manageMachines: () => ipcRenderer.send('manage-machines'),

  // Deep linking
  onDeepLink: (callback) => ipcRenderer.on('deep-link', (event, url) => callback(url)),
  
  // App lifecycle
  onAppBeforeQuit: (callback) => ipcRenderer.on('app-before-quit', callback),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Security and environment
  isElectron: true,
  platform: process.platform,
  versions: process.versions,

  // Machine connectivity helpers
  discoverMachines: (networkRange) => ipcRenderer.invoke('discover-machines', networkRange),
  connectToMachine: (machineConfig) => ipcRenderer.invoke('connect-machine', machineConfig),
  disconnectMachine: (machineId) => ipcRenderer.invoke('disconnect-machine', machineId),
  getMachineStatus: (machineId) => ipcRenderer.invoke('get-machine-status', machineId),

  // Configuration encryption
  encryptConfig: (data, key) => ipcRenderer.invoke('encrypt-config', data, key),
  decryptConfig: (encryptedData, key) => ipcRenderer.invoke('decrypt-config', encryptedData, key),

  // System integration
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('show-item-in-folder', fullPath),

  // File system operations
  readFile: (filePath, options) => ipcRenderer.invoke('read-file', filePath, options),
  writeFile: (filePath, data, options) => ipcRenderer.invoke('write-file', filePath, data, options),
  exists: (filePath) => ipcRenderer.invoke('exists', filePath),

  // Environment variables
  getEnv: (key) => ipcRenderer.invoke('get-env', key),
  setEnv: (key, value) => ipcRenderer.invoke('set-env', key, value),

  // Logging
  log: (level, message, data) => ipcRenderer.invoke('log', level, message, data),
  getLogs: (options) => ipcRenderer.invoke('get-logs', options),

  // Network utilities
  ping: (host) => ipcRenderer.invoke('ping', host),
  scanPorts: (host, ports) => ipcRenderer.invoke('scan-ports', host, ports),

  // Notification helpers
  showNotification: (title, options) => ipcRenderer.invoke('show-notification', title, options),
});

// Remove listeners when the window is unloaded
window.addEventListener('beforeunload', () => {
  ipcRenderer.removeAllListeners('deep-link');
  ipcRenderer.removeAllListeners('app-before-quit');
});

// Error handling for IPC
ipcRenderer.on('error', (event, error) => {
  console.error('Electron IPC Error:', error);
  // You could emit this to the renderer process if needed
});

// Console helpers for development
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('devAPI', {
    reload: () => ipcRenderer.send('reload-app'),
    toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
    openDevTools: () => ipcRenderer.send('open-devtools'),
    closeDevTools: () => ipcRenderer.send('close-devtools'),
    isDev: true
  });
}
