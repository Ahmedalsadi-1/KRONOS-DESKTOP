const { BrowserWindow } = require('electron');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class ControlRouter extends EventEmitter {
  constructor({ projectManager, webSocketManager }) {
    super();
    this.projectManager = projectManager;
    this.webSocketManager = webSocketManager;
    this.activeTasks = new Map();
  }

  async listBackends() {
    const projects = await this.projectManager.listProjects();
    return projects.filter((p) => p.available !== false);
  }

  async startBackend(projectId) {
    await this.projectManager.startProject(projectId);
    return this.projectManager.getProjectStatus(projectId);
  }

  async stopBackend(projectId) {
    await this.projectManager.stopProject(projectId);
    return this.projectManager.getProjectStatus(projectId);
  }

  async createTask({ projectId, prompt, options = {} }) {
    const taskId = uuidv4();
    const taskData = {
      id: taskId,
      description: prompt,
      prompt,
      ...options
    };

    // Only OpenComputerUse is wired here for now; UI-TARS can be added similarly
    if (projectId === 'open-computer-use') {
      const created = await this.projectManager.createUnifiedTask(projectId, taskData);
      this.activeTasks.set(taskId, { projectId, taskId });
      return { taskId: created, projectId };
    }

    // Fallback: just store a stub
    this.activeTasks.set(taskId, { projectId, taskId, status: 'queued' });
    return { taskId, projectId };
  }

  async cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;
    await this.projectManager.cancelTask(taskId);
    this.activeTasks.delete(taskId);
    return true;
  }

  attachTaskStreaming(mainWindow) {
    // Forward task updates emitted by project manager
    this.projectManager.on('task-update', (taskId, payload) => {
      mainWindow.webContents.send('control:task-update', { taskId, ...payload });
    });
  }
}

module.exports = ControlRouter;
