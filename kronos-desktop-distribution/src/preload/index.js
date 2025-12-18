const { contextBridge, ipcRenderer } = require('electron');

// Configuration Management
contextBridge.exposeInMainWorld('kronosConfig', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),
  resetConfig: () => ipcRenderer.invoke('config:reset')
});

// Application Information
contextBridge.exposeInMainWorld('kronosApp', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  checkUpdates: () => ipcRenderer.invoke('app:checkUpdates')
});

// Services Management
contextBridge.exposeInMainWorld('kronosServices', {
  getStatus: () => ipcRenderer.invoke('services:getStatus'),
  restart: () => ipcRenderer.invoke('services:restart')
});

// Distribution Information
contextBridge.exposeInMainWorld('kronosDist', {
  getInfo: () => ipcRenderer.invoke('dist:getInfo')
});

// Event Listeners
contextBridge.exposeInMainWorld('kronosEvents', {
  onPreferencesOpen: (callback) => {
    ipcRenderer.on('open-preferences', callback);
  },
  onRestartServices: (callback) => {
    ipcRenderer.on('restart-services', callback);
  },
  onShowServiceStatus: (callback) => {
    ipcRenderer.on('show-service-status', callback);
  },
  onMenuAction: (action, callback) => {
    ipcRenderer.on(`menu-${action}`, callback);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('KRONOS Desktop Agent preload script loaded');
  
  // Notify main process that renderer is ready
  if (typeof ipcRenderer.send === 'function') {
    ipcRenderer.send('renderer-ready');
  }
});