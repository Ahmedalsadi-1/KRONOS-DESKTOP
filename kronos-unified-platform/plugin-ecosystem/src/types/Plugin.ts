/**
 * Plugin types and interfaces for KRONOS plugin ecosystem
 */

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  email?: string;
  url?: string;
  category: PluginCategory;
  permissions: PluginPermission[];
  dependencies: string[];
  engines: {
    kronos: string;
    node: string;
  };
  repository?: {
    type: 'git' | 'hg';
    url: string;
  };
  keywords: string[];
  license: string;
  main: string;
  exports?: {
    '.': string;
    [key: string]: string;
  };
  files: string[];
  icons?: {
    '16': string;
    '32': string;
    '64': string;
    '128': string;
    '256': string;
    '512': string;
    '1024': string;
    [size: string]: string;
  };
  screenshots?: string[];
  documentation?: {
    readme?: string;
    api?: string;
    changelog?: string;
    examples?: string;
  };
  security?: {
    codeSignature?: string;
    sha256Hash?: string;
    permissions?: SecurityProfile[];
    vulnerabilities?: VulnerabilityReport[];
  };
  compatibility: {
    kronosVersions: string[];
    nodeVersions: string[];
    platforms: Platform[];
  };
  marketplace?: {
    price?: number;
    tier?: 'free' | 'premium' | 'enterprise';
    downloads?: number;
    rating?: number;
    verified?: boolean;
  };
}

export enum PluginCategory {
  CORE = 'core',
  INTEGRATION = 'integration',
  UI = 'ui',
  AUTOMATION = 'automation',
  SECURITY = 'security',
  DATA = 'data',
  MONITORING = 'monitoring'
}

export enum PluginPermission {
  FILE_SYSTEM = 'file-system',
  NETWORK = 'network',
  SYSTEM = 'system',
  CAMERA = 'camera',
  MICROPHONE = 'microphone',
  LOCATION = 'location',
  NOTIFICATIONS = 'notifications',
  PROCESS_CONTROL = 'process-control',
  USER_DATA = 'user-data',
  DATABASE = 'database',
  API_ACCESS = 'api-access',
  CRYPTOGRAPHY = 'cryptography'
}

export interface PluginInstance {
  id: string;
  metadata: PluginMetadata;
  status: PluginStatus;
  configPath: string;
  installDate: Date;
  lastUpdated: Date;
  executionStats: ExecutionStats;
  securityContext: SecurityContext;
}

export enum PluginStatus {
  INSTALLED = 'installed',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
  UPDATING = 'updating',
  LOADING = 'loading'
}

export enum Platform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web'
}

export interface PluginManifest {
  plugin: PluginMetadata;
  runtime: RuntimeConfig;
  security: SecurityConfig;
  build: BuildConfig;
}

export interface RuntimeConfig {
  entryPoint: string;
  environment: 'node' | 'python' | 'web' | 'native';
  dependencies: RuntimeDependency[];
  hooks: LifecycleHook[];
  resources: ResourceConfig[];
}

export interface RuntimeDependency {
  name: string;
  version: string;
  optional: boolean;
  type: 'plugin' | 'npm' | 'system' | 'mcp';
}

export interface LifecycleHook {
  name: string;
  type: 'before-install' | 'after-install' | 'before-uninstall' | 'after-uninstall' | 'before-update' | 'after-update' | 'before-execute' | 'after-execute';
  handler: string;
  async: boolean;
}

export interface ResourceConfig {
  type: 'file' | 'directory' | 'network' | 'memory' | 'database';
  path: string;
  permissions: PluginPermission[];
  access: 'read' | 'write' | 'read-write' | 'execute';
}

export interface SecurityConfig {
  sandbox: SandboxConfig;
  permissions: PermissionConfig;
  validation: ValidationConfig;
  signing: SigningConfig;
}

export interface SandboxConfig {
  enabled: boolean;
  type: 'isolated' | 'shared' | 'restricted';
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
}

export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxFileSize: number;
  maxNetworkRequests: number;
  maxFiles: number;
}

export interface NetworkPolicy {
  mode: 'allow-all' | 'whitelist' | 'deny-list';
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowedProtocols?: string[];
}

export interface PermissionConfig {
  required: PluginPermission[];
  optional: PluginPermission[];
  requested: PluginPermission[];
  autoApprove: PluginPermission[];
  requireUserConsent: PluginPermission[];
}

export interface ValidationConfig {
  rules: ValidationRule[];
  autoFix: boolean;
  scanOnInstall: boolean;
  scanOnUpdate: boolean;
}

export interface ValidationRule {
  name: string;
  type: 'syntax' | 'security' | 'performance' | 'compatibility';
  severity: 'error' | 'warning' | 'info';
  pattern?: RegExp;
  validator: string;
  autoFix?: string;
}

export interface SigningConfig {
  required: boolean;
  algorithm: 'rsa-2048' | 'rsa-4096' | 'ecdsa-p256' | 'ecdsa-p384';
  certificateChain: boolean;
  timestampAuthority: string;
}

export interface BuildConfig {
  entry: string;
  output: OutputConfig;
  minify: boolean;
  sourceMap: boolean;
  externalModules: string[];
}

export interface OutputConfig {
  format: 'cjs' | 'esm' | 'umd' | 'iife';
  target: string;
  polyfills: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation?: string;
}

export interface ValidationSuggestion {
  field: string;
  suggestion: string;
  autoApply?: boolean;
}