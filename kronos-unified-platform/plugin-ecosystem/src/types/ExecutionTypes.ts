/**
 * Execution and runtime types for plugin ecosystem
 */

export interface ExecutionStats {
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  errorCount: number;
  lastError?: Error;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests?: number;
  outputSize?: number;
}

export interface PluginManager {
  // Plugin Discovery
  discover(directory?: string): Promise<PluginInstance[]>;
  search(query: PluginSearchQuery): Promise<PluginMetadata[]>;
  getMetadata(pluginId: string): Promise<PluginMetadata | null>;
  
  // Plugin Lifecycle
  install(plugin: string | PluginMetadata): Promise<PluginInstance>;
  uninstall(pluginId: string): Promise<void>;
  update(pluginId: string, version?: string): Promise<PluginInstance>;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  
  // Plugin Security
  validate(plugin: PluginManifest): Promise<ValidationResult>;
  sign(plugin: string | PluginManifest): Promise<string>;
  scan(pluginPath: string): Promise<VulnerabilityReport>;
  
  // Plugin Runtime
  execute(pluginId: string, input?: any): Promise<any>;
  getExecutionStats(pluginId: string): Promise<ExecutionStats | undefined>;
  terminate(pluginId: string): Promise<void>;
}

export interface PluginSearchQuery {
  text?: string;
  category?: PluginCategory;
  author?: string;
  tags?: string[];
  price?: { min?: number; max?: number };
  verified?: boolean;
  compatibility?: {
    kronos?: string;
    node?: string;
  };
}

export interface ValidationTypes {
  ValidationResult;
  ValidationError;
  ValidationWarning;
  ValidationSuggestion;
}