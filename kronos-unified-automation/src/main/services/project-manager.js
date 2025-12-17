const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class ProjectManager extends EventEmitter {
  constructor() {
    super();
    this.projects = new Map();
    this.processes = new Map();
    this.tasks = new Map();
    
    this.initializeProjects();
  }

  async initializeProjects() {
    // Define all supported projects
    const projectConfigs = [
      {
        id: 'open-computer-use',
        name: 'Open Computer Use',
        description: 'Advanced orchestration for AI computer control',
        ports: [3000, 8001],
        workingDirectory: path.join(__dirname, '../../../open-computer-use'),
        startCommand: 'npm start',
        stopCommand: 'pkill -f "npm start"',
        healthCheckUrl: 'http://localhost:3000/health',
        status: 'stopped'
      },
      {
        id: 'ui-tars-desktop',
        name: 'UI-TARS Desktop',
        description: 'Vision-language task automation',
        ports: [],
        workingDirectory: path.join(__dirname, '../../../UI-TARS-desktop'),
        startCommand: 'python main.py',
        stopCommand: 'pkill -f "python main.py"',
        status: 'stopped'
      },
      {
        id: 'gbox',
        name: 'GBox',
        description: 'Android automation platform',
        ports: [],
        workingDirectory: path.join(__dirname, '../../../gbox'),
        startCommand: 'echo "GBox setup disabled - missing required scripts"',
        stopCommand: 'pkill -f "gbox"',
        status: 'stopped'
      },
      {
        id: 'bytebot',
        name: 'ByteBot',
        description: 'AI agent system',
        ports: [3001],
        workingDirectory: path.join(__dirname, '../../../bytebot'),
        startCommand: 'npm run dev',
        stopCommand: 'pkill -f "npm run dev"',
        healthCheckUrl: 'http://localhost:3001/health',
        status: 'stopped'
      }
    ];

    for (const config of projectConfigs) {
      this.projects.set(config.id, config);
    }

    // Check project availability
    await this.checkProjectAvailability();
  }

  async checkProjectAvailability() {
    for (const [projectId, config] of this.projects) {
      try {
        await fs.access(config.workingDirectory);
        config.available = true;
      } catch (error) {
        console.warn(`Project ${projectId} not available at ${config.workingDirectory}`);
        config.available = false;
        config.status = 'unavailable';
      }
    }
  }

  async startProject(projectId) {
    const config = this.projects.get(projectId);
    if (!config) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (!config.available) {
      throw new Error(`Project ${projectId} is not available`);
    }

    if (config.status === 'running') {
      return; // Already running
    }

    try {
      config.status = 'starting';
      this.emit('status-change', projectId, config.status);

      // Check dependencies first
      await this.checkDependencies(projectId);

      // Start the process
      const process = spawn(config.startCommand, {
        cwd: config.workingDirectory,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store process reference
      this.processes.set(projectId, process);

      // Handle process events
      process.stdout.on('data', (data) => {
        console.log(`[${projectId}] ${data.toString().trim()}`);
      });

      process.stderr.on('data', (data) => {
        console.error(`[${projectId}] ${data.toString().trim()}`);
      });

      process.on('close', (code) => {
        console.log(`[${projectId}] Process exited with code ${code}`);
        config.status = 'stopped';
        this.processes.delete(projectId);
        this.emit('status-change', projectId, config.status);
      });

      process.on('error', (error) => {
        console.error(`[${projectId}] Process error:`, error);
        config.status = 'error';
        this.processes.delete(projectId);
        this.emit('status-change', projectId, config.status);
      });

      // Wait a moment then check if it's actually running
      setTimeout(async () => {
        const isRunning = await this.checkServiceHealth(projectId);
        if (isRunning) {
          config.status = 'running';
          this.emit('status-change', projectId, config.status);
        } else {
          config.status = 'error';
          this.emit('status-change', projectId, config.status);
        }
      }, 5000);

    } catch (error) {
      config.status = 'error';
      this.emit('status-change', projectId, config.status);
      throw error;
    }
  }

  async stopProject(projectId) {
    const config = this.projects.get(projectId);
    if (!config) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (config.status !== 'running' && config.status !== 'starting') {
      return; // Not running
    }

    try {
      const process = this.processes.get(projectId);
      if (process) {
        process.kill('SIGTERM');
        
        // Force kill after 10 seconds if still running
        setTimeout(() => {
          if (this.processes.has(projectId)) {
            process.kill('SIGKILL');
          }
        }, 10000);
      } else {
        // Fallback: try to kill by command
        exec(config.stopCommand, (error) => {
          if (error) {
            console.warn(`Failed to stop ${projectId} gracefully:`, error.message);
          }
        });
      }

      config.status = 'stopped';
      this.emit('status-change', projectId, config.status);
      
    } catch (error) {
      console.error(`Failed to stop project ${projectId}:`, error);
      config.status = 'error';
      this.emit('status-change', projectId, config.status);
      throw error;
    }
  }

  async getProjectStatus(projectId) {
    const config = this.projects.get(projectId);
    if (!config) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Check if process is still alive
    const process = this.processes.get(projectId);
    if (process && process.killed) {
      config.status = 'stopped';
      this.processes.delete(projectId);
    }

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      status: config.status,
      available: config.available,
      ports: config.ports,
      healthCheckUrl: config.healthCheckUrl
    };
  }

  async listProjects() {
    const projects = [];
    
    for (const [projectId, config] of this.projects) {
      const status = await this.getProjectStatus(projectId);
      projects.push(status);
    }

    return projects;
  }

  async checkDependencies(projectId) {
    const config = this.projects.get(projectId);
    if (!config) {
      throw new Error(`Project ${projectId} not found`);
    }

    const dependencies = [];

    // Check for required tools based on project type
    switch (projectId) {
      case 'open-computer-use':
      case 'bytebot':
        dependencies.push('node', 'npm');
        break;
      case 'ui-tars-desktop':
        dependencies.push('python3', 'pip');
        break;
      case 'gbox':
        dependencies.push('go', 'adb');
        break;
    }

    const missingDeps = [];
    for (const dep of dependencies) {
      try {
        await this.checkCommand(dep);
      } catch (error) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
    }

    return true;
  }

  async checkCommand(command) {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`${command} --version`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  async checkServiceHealth(projectId) {
    const config = this.projects.get(projectId);
    if (!config || !config.healthCheckUrl) {
      return true; // No health check available
    }

    try {
      const axios = require('axios');
      const response = await axios.get(config.healthCheckUrl, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async createUnifiedTask(projectId, taskData) {
    const config = this.projects.get(projectId);
    if (!config) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (config.status !== 'running') {
      throw new Error(`Project ${projectId} is not running`);
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
      id: taskId,
      projectId,
      title: taskData.title,
      description: taskData.description,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      streamUrl: taskData.streamUrl
    };

    this.tasks.set(taskId, task);

    // Start task execution
    this.executeTask(task);

    return taskId;
  }

  async executeTask(task) {
    try {
      task.status = 'executing';
      task.updatedAt = new Date();
      this.emit('task-update', task.id, { status: 'executing', progress: 0 });

      // Project-specific task execution
      const result = await this.executeTaskForProject(task);

      task.status = 'completed';
      task.result = result;
      task.updatedAt = new Date();
      this.emit('task-update', task.id, { status: 'completed', result });

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = new Date();
      this.emit('task-update', task.id, { status: 'failed', error: error.message });
    }
  }

  async executeTaskForProject(task) {
    // This will be implemented in Phase 4 with API adapters
    // For now, return a mock result
    return {
      message: `Task "${task.title}" executed successfully on ${task.projectId}`,
      timestamp: new Date().toISOString()
    };
  }

  async getProjectTasks(projectId) {
    const tasks = [];
    for (const [taskId, task] of this.tasks) {
      if (task.projectId === projectId) {
        tasks.push(task);
      }
    }
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return false; // Can't cancel finished tasks
    }

    task.status = 'cancelled';
    task.updatedAt = new Date();
    this.emit('task-update', taskId, { status: 'cancelled' });

    return true;
  }

  async stopAllProjects() {
    const projects = await this.listProjects();
    for (const project of projects) {
      if (project.status === 'running') {
        try {
          await this.stopProject(project.id);
        } catch (error) {
          console.error(`Failed to stop ${project.id}:`, error);
        }
      }
    }
  }
}

module.exports = ProjectManager;
