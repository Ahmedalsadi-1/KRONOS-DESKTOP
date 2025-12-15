/**
 * Plugin Registry Service - Central registry for plugin discovery and metadata management
 */

import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PluginMetadata, PluginInstance, PluginStatus, PluginSearchQuery, PluginManager, ValidationResult } from '../types/Plugin';

export class PluginRegistry extends EventEmitter implements PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private pluginPaths: string[] = [];
  private configPath: string;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || path.join(process.env.HOME || '', '.kronos', 'plugins');
  }

  /**
   * Discover plugins from configured directories
   */
  async discover(directory?: string): Promise<PluginInstance[]> {
    const searchPaths = directory ? [directory] : this.getPluginPaths();
    const discovered: PluginInstance[] = [];

    for (const searchPath of searchPaths) {
      if (!(await this.pathExists(searchPath))) continue;
      
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory && this.looksLikePlugin(entry.name)) {
          try {
            const pluginPath = path.join(searchPath, entry.name);
            const plugin = await this.loadPluginFromPath(pluginPath);
            if (plugin) {
              discovered.push(plugin);
            }
          } catch (error) {
            this.emit('error', `Failed to load plugin from ${entry.name}: ${error}`);
          }
        }
      }
    }

    this.emit('pluginsDiscovered', discovered);
    return discovered;
  }

  /**
   * Search plugins by query
   */
  async search(query: PluginSearchQuery): Promise<PluginMetadata[]> {
    const results: PluginMetadata[] = [];

    for (const [, plugin] of this.plugins) {
      if (this.matchesQuery(plugin.metadata, query)) {
        results.push(plugin.metadata);
      }
    }

    return results.sort((a, b) => {
      // Sort by relevance (name match > category match)
      const aScore = this.calculateRelevanceScore(a, query);
      const bScore = this.calculateRelevanceScore(b, query);
      return bScore - aScore;
    });
  }

  /**
   * Get plugin metadata by ID
   */
  async getMetadata(pluginId: string): Promise<PluginMetadata | null> {
    const plugin = this.plugins.get(pluginId);
    return plugin ? plugin.metadata : null;
  }

  /**
   * Register a plugin instance
   */
  async register(plugin: PluginInstance): Promise<void> {
    // Validate plugin before registration
    const validation = await this.validateBasic(plugin.metadata);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
    }

    this.plugins.set(plugin.id, plugin);
    this.emit('pluginRegistered', plugin);
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      this.plugins.delete(pluginId);
      this.emit('pluginUnregistered', plugin);
    }
  }

  /**
   * Install a plugin
   */
  async install(plugin: string | PluginMetadata): Promise<PluginInstance> {
    const metadata = typeof plugin === 'string' ? 
      await this.getPluginMetadata(plugin) : plugin;
      
    if (!metadata) {
      throw new Error('Plugin not found for installation');
    }

    // Create plugin instance
    const pluginInstance: PluginInstance = {
      id: metadata.id,
      metadata,
      status: PluginStatus.INSTALLED,
      configPath: path.join(this.configPath, 'installed', metadata.id, 'config.json'),
      installDate: new Date(),
      lastUpdated: new Date(),
      executionStats: {
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        errorCount: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      securityContext: {
        permissions: metadata.permissions || [],
        resourceLimits: {
          maxMemory: 512 * 1024 * 1024, // 512MB
          maxCpu: 50, // 50% CPU
          maxFileSize: 100 * 1024 * 1024, // 100MB
          maxNetworkRequests: 1000
        },
        auditTrail: []
      }
    };

    await this.register(pluginInstance);
    this.emit('pluginInstalled', pluginInstance);
    return pluginInstance;
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      this.plugins.delete(pluginId);
      this.emit('pluginUninstalled', plugin);
    }
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status = PluginStatus.ENABLED;
      this.emit('pluginEnabled', plugin);
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.status = PluginStatus.DISABLED;
      this.emit('pluginDisabled', plugin);
    }
  }

  /**
   * Update a plugin
   */
  async update(pluginId: string, version?: string): Promise<PluginInstance> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.lastUpdated = new Date();
      this.emit('pluginUpdated', plugin);
    }
    return plugin || this.createDefaultPlugin(pluginId);
  }

  /**
   * Execute a plugin
   */
  async execute(pluginId: string, input?: any): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.status !== PluginStatus.ENABLED) {
      throw new Error(`Plugin ${pluginId} is not installed or enabled`);
    }

    const startTime = Date.now();
    try {
      // Update execution stats
      plugin.executionStats.executionCount++;
      plugin.executionStats.lastError = undefined;

      // This would delegate to the actual runtime service
      const result = await this.executePluginCode(plugin, input);
      
      const executionTime = Date.now() - startTime;
      plugin.executionStats.totalExecutionTime += executionTime;
      plugin.executionStats.averageExecutionTime = 
        plugin.executionStats.totalExecutionTime / plugin.executionStats.executionCount;

      this.emit('pluginExecuted', { plugin, result, executionTime });
      return result;
    } catch (error) {
      plugin.executionStats.errorCount++;
      plugin.executionStats.lastError = error as Error;
      this.emit('pluginError', { plugin, error });
      throw error;
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(pluginId: string): Promise<ExecutionStats | undefined> {
    const plugin = this.plugins.get(pluginId);
    return plugin ? plugin.executionStats : undefined;
  }

  /**
   * Terminate a plugin execution
   */
  async terminate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      // Termination logic would be implemented in runtime service
      this.emit('pluginTerminated', plugin);
    }
  }

  /**
   * Validate a plugin (basic validation)
   */
  async validate(pluginManifest: any): Promise<ValidationResult> {
    return this.validateBasic(pluginManifest);
  }

  /**
   * List all registered plugins
   */
  list(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin paths from various sources
   */
  private getPluginPaths(): string[] {
    const paths: string[] = [
      path.join(this.configPath, 'installed'),
      path.join(this.configPath, 'marketplace'),
      path.join(process.cwd(), 'node_modules', '.bin'),
      '/usr/local/lib/kronos-plugins',
      '/opt/kronos/plugins'
    ];

    return paths.filter(p => this.pathExists(p));
  }

  /**
   * Check if directory looks like a plugin
   */
  private looksLikePlugin(dirname: string): boolean {
    return (
      dirname.includes('plugin') ||
      dirname.includes('kronos') ||
      fs.readdir(dirname).then(entries => 
        entries.some(entry => 
          entry.isFile() && 
          (entry.name === 'package.json' || entry.name === 'plugin.json')
        )
      ).catch(() => false)
    );
  }

  /**
   * Load plugin from path
   */
  private async loadPluginFromPath(pluginPath: string): Promise<PluginInstance | null> {
    const manifestPath = path.join(pluginPath, 'package.json');
    if (!(await this.pathExists(manifestPath))) {
      return null;
    }

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const metadata: PluginMetadata = JSON.parse(manifestContent);
      
      // Validate required fields
      if (!this.validateMetadata(metadata)) {
        throw new Error('Invalid plugin metadata');
      }

      const plugin: PluginInstance = {
        id: metadata.id,
        metadata,
        status: PluginStatus.INSTALLED,
        configPath: path.join(pluginPath, 'config.json'),
        installDate: new Date(),
        lastUpdated: new Date(),
        executionStats: {
          executionCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          errorCount: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        securityContext: {
          permissions: metadata.permissions || [],
          resourceLimits: {
            maxMemory: 512 * 1024 * 1024, // 512MB
            maxCpu: 50, // 50% CPU
            maxFileSize: 100 * 1024 * 1024, // 100MB
            maxNetworkRequests: 1000
          },
          auditTrail: []
        }
      };

      return plugin;
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      return null;
    }
  }

  /**
   * Validate plugin metadata
   */
  private validateMetadata(metadata: any): boolean {
    const required = ['id', 'name', 'version', 'description', 'category'];
    return required.every(field => metadata[field] && typeof metadata[field] === 'string');
  }

  /**
   * Check if plugin matches search query
   */
  private matchesQuery(metadata: PluginMetadata, query: PluginSearchQuery): boolean {
    if (!query || Object.keys(query).length === 0) return true;

    let matches = true;

    if (query.text && !this.matchesText(metadata, query.text)) {
      matches = false;
    }

    if (query.category && metadata.category !== query.category) {
      matches = false;
    }

    if (query.author && !metadata.author?.toLowerCase().includes(query.author.toLowerCase())) {
      matches = false;
    }

    if (query.tags && query.tags.length > 0) {
      const pluginTags = metadata.keywords || [];
      const hasMatchingTag = query.tags.some(tag => 
        pluginTags.some(pluginTag => pluginTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasMatchingTag) matches = false;
    }

    return matches;
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(metadata: PluginMetadata, query: PluginSearchQuery): number {
    let score = 0;

    if (query.text) {
      if (metadata.name.toLowerCase().includes(query.text.toLowerCase())) score += 10;
      if (metadata.description.toLowerCase().includes(query.text.toLowerCase())) score += 5;
    }

    if (query.category && metadata.category === query.category) {
      score += 8;
    }

    if (query.author && metadata.author?.toLowerCase().includes(query.author.toLowerCase())) {
      score += 3;
    }

    return score;
  }

  /**
   * Check if path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate plugin (basic validation)
   */
  private async validateBasic(metadata: any): Promise<{ valid: boolean; errors: string[] }> {
    // This would integrate with validation service
    // For now, basic validation
    const errors: string[] = [];

    if (!metadata.id || !/^[a-z0-9-]+$/.test(metadata.id)) {
      errors.push('Invalid plugin ID format');
    }

    if (!metadata.name || metadata.name.length < 2) {
      errors.push('Plugin name must be at least 2 characters');
    }

    if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push('Invalid version format (use semantic versioning)');
    }

    if (!metadata.category || !Object.values(['core', 'integration', 'ui', 'automation', 'security', 'data', 'monitoring']).includes(metadata.category)) {
      errors.push('Invalid plugin category');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute plugin code (placeholder)
   */
  private async executePluginCode(plugin: PluginInstance, input?: any): Promise<any> {
    // This would delegate to the actual runtime service
    // For now, return a placeholder
    return { pluginId: plugin.id, input, timestamp: new Date().toISOString() };
  }

  /**
   * Get plugin metadata (placeholder)
   */
  private async getPluginMetadata(pluginId: string): Promise<PluginMetadata | null> {
    // This would search in marketplace and local plugins
    return null;
  }

  /**
   * Create default plugin instance
   */
  private createDefaultPlugin(pluginId: string): PluginInstance {
    return {
      id: pluginId,
      metadata: {
        id: pluginId,
        name: pluginId,
        version: '1.0.0',
        description: 'Unknown plugin',
        category: 'core' as any,
        permissions: [],
        dependencies: [],
        engines: { kronos: '1.0.0', node: '>=18.0.0' }
      },
      status: PluginStatus.ERROR,
      configPath: '',
      installDate: new Date(),
      lastUpdated: new Date(),
      executionStats: {
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        errorCount: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      securityContext: {
        permissions: [],
        resourceLimits: {
          maxMemory: 512 * 1024 * 1024,
          maxCpu: 50,
          maxFileSize: 100 * 1024 * 1024,
          maxNetworkRequests: 1000
        },
        auditTrail: []
      }
    };
  }
}