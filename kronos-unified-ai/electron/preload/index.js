const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  startApp: (appKey) => ipcRenderer.invoke('start-app', appKey),
  stopApp: (appKey) => ipcRenderer.invoke('stop-app', appKey),
  getAppStatus: (appKey) => ipcRenderer.invoke('get-app-status', appKey),
  getApps: () => ipcRenderer.invoke('get-apps'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  getEmbeddedServices: () => ipcRenderer.invoke('get-embedded-services'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  analyzeImage: (imageData) => ipcRenderer.invoke('analyze-image', imageData),
  onAppStarted: (callback) => {
    ipcRenderer.on('app-started', (_, appKey) => callback(appKey));
  },
  onAppStopped: (callback) => {
    ipcRenderer.on('app-stopped', (_, appKey) => callback(appKey));
  },
  onAppClosed: (callback) => {
    ipcRenderer.on('app-closed', (_, appKey) => callback(appKey));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);