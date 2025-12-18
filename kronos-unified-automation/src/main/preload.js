const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Project management
  startProject: (projectId) => ipcRenderer.invoke('project:start', projectId),
  stopProject: (projectId) => ipcRenderer.invoke('project:stop', projectId),
  getProjectStatus: (projectId) => ipcRenderer.invoke('project:status', projectId),
  listProjects: () => ipcRenderer.invoke('project:list'),
  getProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (projectData) => ipcRenderer.invoke('project:create', projectData),
  updateProject: (projectData) => ipcRenderer.invoke('project:update', projectData),
  deleteProject: (projectId) => ipcRenderer.invoke('project:delete', projectId),
  
  // Task management
  createTask: (taskData) => ipcRenderer.invoke('task:create', taskData),
  listTasks: (projectId) => ipcRenderer.invoke('task:list', projectId),
  cancelTask: (taskId) => ipcRenderer.invoke('task:cancel', taskId),
  updateTask: (taskData) => ipcRenderer.invoke('task:update', taskData),
  deleteTask: (taskId) => ipcRenderer.invoke('task:delete', taskId),
  
  // Authentication
  login: (authData) => ipcRenderer.invoke('auth:login', authData),
  logout: (platform) => ipcRenderer.invoke('auth:logout', platform),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  refreshAuth: (platform) => ipcRenderer.invoke('auth:refresh', platform),
  
  // System status
  getSystemStatus: () => ipcRenderer.invoke('system:status'),
  
  // WebSocket status
  getWsStatus: () => ipcRenderer.invoke('ws:status'),
  
  // Streaming
  connectStream: (projectId, taskId) => ipcRenderer.invoke('stream:connect', projectId, taskId),
  disconnectStream: (taskId) => ipcRenderer.invoke('stream:disconnect', taskId),

  // Control widget
  controlListBackends: () => ipcRenderer.invoke('control:list-backends'),
  controlStartBackend: (projectId) => ipcRenderer.invoke('control:start-backend', projectId),
  controlStopBackend: (projectId) => ipcRenderer.invoke('control:stop-backend', projectId),
  controlCreateTask: (payload) => ipcRenderer.invoke('control:create-task', payload),
  controlCancelTask: (taskId) => ipcRenderer.invoke('control:cancel-task', taskId),
  
  // Event listeners
  onProjectStatusChanged: (callback) => ipcRenderer.on('project-status-changed', callback),
  onTaskUpdated: (callback) => ipcRenderer.on('task-updated', callback),
  onServiceHealthChanged: (callback) => ipcRenderer.on('service-health-changed', callback),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', callback),
  onWsStatusChange: (callback) => ipcRenderer.on('ws-status-changed', callback),
  onProjectUpdate: (callback) => ipcRenderer.on('project-updated', callback),
  onTaskUpdate: (callback) => ipcRenderer.on('task-updated', callback),
  onSystemStatusUpdate: (callback) => ipcRenderer.on('system-status-updated', callback),
  onControlTaskUpdate: (callback) => ipcRenderer.on('control:task-update', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Platform information
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Security: Prevent new window creation
window.open = () => {
  throw new Error('Window creation is disabled');
};

// Security: Prevent navigation
window.addEventListener('beforeunload', (event) => {
  event.preventDefault();
  event.returnValue = '';
});
