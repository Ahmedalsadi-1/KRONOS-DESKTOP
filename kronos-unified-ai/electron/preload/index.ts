import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  startApp: (appKey: string) => Promise<void>;
  stopApp: (appKey: string) => Promise<void>;
  getAppStatus: (appKey: string) => Promise<boolean>;
  getApps: () => Promise<any>;
  getSettings: () => Promise<any>;
  setSettings: (settings: any) => Promise<void>;
  onAppStarted: (callback: (appKey: string) => void) => void;
  onAppStopped: (callback: (appKey: string) => void) => void;
  onAppClosed: (callback: (appKey: string) => void) => void;
  onOpenSettings: (callback: () => void) => void;
}

const electronAPI: ElectronAPI = {
  startApp: (appKey: string) => ipcRenderer.invoke('start-app', appKey),
  stopApp: (appKey: string) => ipcRenderer.invoke('stop-app', appKey),
  getAppStatus: (appKey: string) => ipcRenderer.invoke('get-app-status', appKey),
  getApps: () => ipcRenderer.invoke('get-apps'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: any) => ipcRenderer.invoke('set-settings', settings),
  onAppStarted: (callback: (appKey: string) => void) => {
    ipcRenderer.on('app-started', (_, appKey) => callback(appKey));
  },
  onAppStopped: (callback: (appKey: string) => void) => {
    ipcRenderer.on('app-stopped', (_, appKey) => callback(appKey));
  },
  onAppClosed: (callback: (appKey: string) => void) => {
    ipcRenderer.on('app-closed', (_, appKey) => callback(appKey));
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback());
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);