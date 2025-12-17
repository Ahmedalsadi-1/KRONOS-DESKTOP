const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Workflow Persistence Layer - Handles saving/loading workflow definitions and execution history
 * Uses file system for storage with JSON format
 */
class WorkflowPersistence extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      storagePath: options.storagePath || path.join(process.cwd(), 'data', 'workflows'),
      maxExecutionsPerWorkflow: options.maxExecutionsPerWorkflow || 1000,
      compressionEnabled: options.compressionEnabled || false,
      backupEnabled: options.backupEnabled || true,
      backupInterval: options.backupInterval || 3600000, // 1 hour
      ...options
    };

    this.workflowsPath = path.join(this.options.storagePath, 'definitions');
    this.executionsPath = path.join(this.options.storagePath, 'executions');
    this.templatesPath = path.join(this.options.storagePath, 'templates');
    this.backupsPath = path.join(this.options.storagePath, 'backups');

    this.cache = new Map();
    this.backupInterval = null;

    this.logger = {
      info: (message) => console.log(`[WorkflowPersistence] ${message}`),
      warn: (message) => console.warn(`[WorkflowPersistence] ${message}`),
      error: (message, error) => console.error(`[WorkflowPersistence] ${message}`, error)
    };
  }

  /**
   * Initialize the persistence layer
   */
  async initialize(serviceRegistry) {
    try {
      this.serviceRegistry = serviceRegistry;

      this.logger.info('Initializing Workflow Persistence...');

      // Register with service registry
      await this.serviceRegistry.register('workflow-persistence', this, {
        dependencies: ['config-manager'],
        autoStart: true
      });

      // Ensure directories exist
      await this.ensureDirectories();

      // Load cache
      await this.loadCache();

      // Start backup process if enabled
      if (this.options.backupEnabled) {
        this.startBackupProcess();
      }

      this.logger.info('Workflow Persistence initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Workflow Persistence', error);
      throw error;
    }
  }

  /**
   * Save a workflow definition
   */
  async saveWorkflow(workflow) {
    try {
      const fileName = `${workflow.id}.json`;
      const filePath = path.join(this.workflowsPath, fileName);

      // Prepare workflow for storage
      const workflowData = {
        ...workflow,
        updatedAt: new Date(),
        _version: '1.0',
        _checksum: this.generateChecksum(workflow)
      };

      // Write to file
      await fs.writeFile(filePath, JSON.stringify(workflowData, null, 2), 'utf8');

      // Update cache
      this.cache.set(`workflow:${workflow.id}`, workflowData);

      this.logger.info(`Saved workflow: ${workflow.name} (${workflow.id})`);
      this.emit('workflow:saved', { workflowId: workflow.id, workflow: workflowData });

      return workflowData;
    } catch (error) {
      this.logger.error(`Failed to save workflow ${workflow.id}`, error);
      throw error;
    }
  }

  /**
   * Load a workflow definition
   */
  async loadWorkflow(workflowId) {
    try {
      // Check cache first
      const cacheKey = `workflow:${workflowId}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const fileName = `${workflowId}.json`;
      const filePath = path.join(this.workflowsPath, fileName);

      // Read from file
      const data = await fs.readFile(filePath, 'utf8');
      const workflow = JSON.parse(data);

      // Validate checksum
      const expectedChecksum = workflow._checksum;
      delete workflow._checksum;
      const actualChecksum = this.generateChecksum(workflow);

      if (expectedChecksum && expectedChecksum !== actualChecksum) {
        this.logger.warn(`Checksum mismatch for workflow ${workflowId}`);
      }

      // Update cache
      this.cache.set(cacheKey, workflow);

      this.logger.info(`Loaded workflow: ${workflow.name} (${workflowId})`);
      return workflow;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Workflow not found
      }
      this.logger.error(`Failed to load workflow ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * Delete a workflow definition
   */
  async deleteWorkflow(workflowId) {
    try {
      const fileName = `${workflowId}.json`;
      const filePath = path.join(this.workflowsPath, fileName);

      // Delete file
      await fs.unlink(filePath);

      // Remove from cache
      this.cache.delete(`workflow:${workflowId}`);

      // Also delete associated executions
      await this.deleteWorkflowExecutions(workflowId);

      this.logger.info(`Deleted workflow: ${workflowId}`);
      this.emit('workflow:deleted', { workflowId });

      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Workflow not found
      }
      this.logger.error(`Failed to delete workflow ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * List all workflow definitions
   */
  async listWorkflows(filters = {}) {
    try {
      const files = await fs.readdir(this.workflowsPath);
      const workflows = [];

      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const workflowId = path.basename(file, '.json');
            const workflow = await this.loadWorkflow(workflowId);

            if (workflow && this.matchesFilters(workflow, filters)) {
              workflows.push(workflow);
            }
          } catch (error) {
            this.logger.warn(`Failed to load workflow from ${file}: ${error.message}`);
          }
        }
      }

      // Sort by creation date (newest first)
      workflows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return workflows;
    } catch (error) {
      this.logger.error('Failed to list workflows', error);
      throw error;
    }
  }

  /**
   * Save a workflow execution
   */
  async saveExecution(execution) {
    try {
      const workflowPath = path.join(this.executionsPath, execution.workflowId);
      await this.ensureDirectory(workflowPath);

      const fileName = `${execution.id}.json`;
      const filePath = path.join(workflowPath, fileName);

      // Prepare execution for storage
      const executionData = {
        ...execution,
        _version: '1.0',
        _savedAt: new Date()
      };

      // Write to file
      await fs.writeFile(filePath, JSON.stringify(executionData, null, 2), 'utf8');

      // Update cache
      this.cache.set(`execution:${execution.id}`, executionData);

      // Clean up old executions if needed
      await this.cleanupOldExecutions(execution.workflowId);

      this.logger.info(`Saved execution: ${execution.id} for workflow ${execution.workflowId}`);
      this.emit('execution:saved', { executionId: execution.id, execution: executionData });

      return executionData;
    } catch (error) {
      this.logger.error(`Failed to save execution ${execution.id}`, error);
      throw error;
    }
  }

  /**
   * Load a workflow execution
   */
  async loadExecution(executionId) {
    try {
      // Check cache first
      const cacheKey = `execution:${executionId}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Find execution file (we need to search through workflow directories)
      const workflowDirs = await fs.readdir(this.executionsPath);

      for (const workflowDir of workflowDirs) {
        const workflowPath = path.join(this.executionsPath, workflowDir);
        const stat = await fs.stat(workflowPath);

        if (stat.isDirectory()) {
          try {
            const filePath = path.join(workflowPath, `${executionId}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const execution = JSON.parse(data);

            // Update cache
            this.cache.set(cacheKey, execution);

            return execution;
          } catch (error) {
            // Continue searching
          }
        }
      }

      return null; // Execution not found
    } catch (error) {
      this.logger.error(`Failed to load execution ${executionId}`, error);
      throw error;
    }
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(workflowId, filters = {}) {
    try {
      const workflowPath = path.join(this.executionsPath, workflowId);

      try {
        const files = await fs.readdir(workflowPath);
        const executions = [];

        for (const file of files) {
          if (path.extname(file) === '.json') {
            try {
              const executionId = path.basename(file, '.json');
              const execution = await this.loadExecution(executionId);

              if (execution && this.matchesExecutionFilters(execution, filters)) {
                executions.push(execution);
              }
            } catch (error) {
              this.logger.warn(`Failed to load execution from ${file}: ${error.message}`);
            }
          }
        }

        // Sort by start time (newest first)
        executions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

        return executions;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return []; // No executions for this workflow
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to list executions for workflow ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * Delete executions for a workflow
   */
  async deleteWorkflowExecutions(workflowId) {
    try {
      const workflowPath = path.join(this.executionsPath, workflowId);

      try {
        const files = await fs.readdir(workflowPath);

        for (const file of files) {
          if (path.extname(file) === '.json') {
            const filePath = path.join(workflowPath, file);
            await fs.unlink(filePath);

            // Remove from cache
            const executionId = path.basename(file, '.json');
            this.cache.delete(`execution:${executionId}`);
          }
        }

        // Remove directory if empty
        await fs.rmdir(workflowPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      this.logger.info(`Deleted executions for workflow: ${workflowId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete executions for workflow ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * Save a workflow template
   */
  async saveTemplate(template) {
    try {
      const fileName = `${template.id}.json`;
      const filePath = path.join(this.templatesPath, fileName);

      const templateData = {
        ...template,
        _version: '1.0',
        _savedAt: new Date()
      };

      await fs.writeFile(filePath, JSON.stringify(templateData, null, 2), 'utf8');

      this.logger.info(`Saved template: ${template.name} (${template.id})`);
      this.emit('template:saved', { templateId: template.id, template: templateData });

      return templateData;
    } catch (error) {
      this.logger.error(`Failed to save template ${template.id}`, error);
      throw error;
    }
  }

  /**
   * Load workflow templates
   */
  async listTemplates(filters = {}) {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templates = [];

      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const filePath = path.join(this.templatesPath, file);
            const data = await fs.readFile(filePath, 'utf8');
            const template = JSON.parse(data);

            if (this.matchesTemplateFilters(template, filters)) {
              templates.push(template);
            }
          } catch (error) {
            this.logger.warn(`Failed to load template from ${file}: ${error.message}`);
          }
        }
      }

      return templates;
    } catch (error) {
      this.logger.error('Failed to list templates', error);
      throw error;
    }
  }

  /**
   * Export workflow data
   */
  async exportWorkflow(workflowId, includeExecutions = false) {
    try {
      const workflow = await this.loadWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const exportData = {
        workflow,
        exportedAt: new Date(),
        version: '1.0'
      };

      if (includeExecutions) {
        exportData.executions = await this.listExecutions(workflowId);
      }

      return exportData;
    } catch (error) {
      this.logger.error(`Failed to export workflow ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * Import workflow data
   */
  async importWorkflow(importData) {
    try {
      const { workflow, executions } = importData;

      // Save workflow
      const savedWorkflow = await this.saveWorkflow(workflow);

      // Save executions if included
      if (executions && executions.length > 0) {
        for (const execution of executions) {
          await this.saveExecution(execution);
        }
      }

      this.logger.info(`Imported workflow: ${workflow.name} (${workflow.id})`);
      this.emit('workflow:imported', { workflowId: workflow.id, workflow: savedWorkflow });

      return savedWorkflow;
    } catch (error) {
      this.logger.error('Failed to import workflow', error);
      throw error;
    }
  }

  /**
   * Create backup of all workflow data
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.backupsPath, `backup-${timestamp}`);

      await this.ensureDirectory(backupDir);

      // Copy all directories
      const dirsToBackup = ['definitions', 'executions', 'templates'];
      for (const dir of dirsToBackup) {
        const sourceDir = path.join(this.options.storagePath, dir);
        const targetDir = path.join(backupDir, dir);

        try {
          await this.copyDirectory(sourceDir, targetDir);
        } catch (error) {
          this.logger.warn(`Failed to backup ${dir}: ${error.message}`);
        }
      }

      // Clean up old backups (keep last 10)
      await this.cleanupOldBackups();

      this.logger.info(`Created backup: ${timestamp}`);
      this.emit('backup:created', { timestamp, path: backupDir });

      return backupDir;
    } catch (error) {
      this.logger.error('Failed to create backup', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.options.storagePath,
      this.workflowsPath,
      this.executionsPath,
      this.templatesPath,
      this.backupsPath
    ];

    for (const dir of dirs) {
      await this.ensureDirectory(dir);
    }
  }

  /**
   * Ensure a directory exists
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Load data into cache
   */
  async loadCache() {
    try {
      // Load recently accessed workflows into cache
      const workflows = await this.listWorkflows();
      for (const workflow of workflows.slice(0, 50)) { // Cache last 50 workflows
        this.cache.set(`workflow:${workflow.id}`, workflow);
      }

      this.logger.info(`Loaded ${this.cache.size} items into cache`);
    } catch (error) {
      this.logger.warn(`Failed to load cache: ${error.message}`);
    }
  }

  /**
   * Generate checksum for data integrity
   */
  generateChecksum(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Check if workflow matches filters
   */
  matchesFilters(workflow, filters) {
    if (filters.status && workflow.status !== filters.status) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const workflowTags = workflow.metadata?.tags || [];
      if (!filters.tags.some(tag => workflowTags.includes(tag))) {
        return false;
      }
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      const searchableText = `${workflow.name} ${workflow.description || ''}`.toLowerCase();
      if (!searchableText.includes(search)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if execution matches filters
   */
  matchesExecutionFilters(execution, filters) {
    if (filters.status && execution.status !== filters.status) {
      return false;
    }

    if (filters.dateRange) {
      const execDate = new Date(execution.startedAt);
      if (execDate < filters.dateRange.start || execDate > filters.dateRange.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if template matches filters
   */
  matchesTemplateFilters(template, filters) {
    if (filters.category && template.category !== filters.category) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some(tag => template.tags.includes(tag))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clean up old executions for a workflow
   */
  async cleanupOldExecutions(workflowId) {
    try {
      const executions = await this.listExecutions(workflowId);
      if (executions.length <= this.options.maxExecutionsPerWorkflow) {
        return;
      }

      // Sort by date (oldest first) and delete excess
      const toDelete = executions
        .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
        .slice(0, executions.length - this.options.maxExecutionsPerWorkflow);

      for (const execution of toDelete) {
        const filePath = path.join(this.executionsPath, workflowId, `${execution.id}.json`);
        try {
          await fs.unlink(filePath);
          this.cache.delete(`execution:${execution.id}`);
        } catch (error) {
          this.logger.warn(`Failed to delete old execution ${execution.id}: ${error.message}`);
        }
      }

      if (toDelete.length > 0) {
        this.logger.info(`Cleaned up ${toDelete.length} old executions for workflow ${workflowId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old executions for ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups() {
    try {
      const backups = await fs.readdir(this.backupsPath);
      const backupDirs = backups
        .filter(name => name.startsWith('backup-'))
        .sort()
        .reverse(); // Newest first

      if (backupDirs.length > 10) {
        const toDelete = backupDirs.slice(10); // Keep last 10

        for (const backup of toDelete) {
          const backupPath = path.join(this.backupsPath, backup);
          await fs.rm(backupPath, { recursive: true, force: true });
        }

        this.logger.info(`Cleaned up ${toDelete.length} old backups`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(source, target) {
    await this.ensureDirectory(target);

    const files = await fs.readdir(source);

    for (const file of files) {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);

      const stat = await fs.stat(sourcePath);

      if (stat.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  /**
   * Start automatic backup process
   */
  startBackupProcess() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        this.logger.error('Automatic backup failed', error);
      }
    }, this.options.backupInterval);

    this.logger.info(`Started automatic backup process (interval: ${this.options.backupInterval}ms)`);
  }

  /**
   * Shutdown the persistence layer
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Workflow Persistence...');

      // Stop backup process
      if (this.backupInterval) {
        clearInterval(this.backupInterval);
        this.backupInterval = null;
      }

      // Create final backup
      if (this.options.backupEnabled) {
        try {
          await this.createBackup();
        } catch (error) {
          this.logger.warn(`Failed to create final backup: ${error.message}`);
        }
      }

      // Clear cache
      this.cache.clear();

      this.logger.info('Workflow Persistence shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during Workflow Persistence shutdown', error);
      throw error;
    }
  }
}

module.exports = WorkflowPersistence;