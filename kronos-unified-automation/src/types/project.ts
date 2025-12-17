// Project-related type definitions

export enum ProjectType {
  OPEN_COMPUTER_USE = 'open-computer-use',
  UI_TARS_DESKTOP = 'ui-tars-desktop',
  GBOX = 'gbox',
  BYTEBOT = 'bytebot',
  AI_BROWSER = 'ai-browser',
  INSTAGRAPI = 'instagrapi',
  INSTAPY = 'instapy',
  N8N = 'n8n',
  OLLAMA = 'ollama',
  ONLYSNARF = 'onlysnarf',
  PYTUBE = 'pytube',
  SOLANA = 'solana',
  TIKTOK_API = 'tiktok_api',
  TIKTOPY = 'tiktokpy'
}

export enum ProjectStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  INSTALLING = 'installing',
  UPDATING = 'updating',
  CONFIGURING = 'configuring'
}

export interface ProjectConfig {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  version: string;
  workingDirectory: string;
  executablePath?: string;
  args?: string[];
  env?: Record<string, string>;
  dependencies?: string[];
  scripts?: Record<string, string>;
  ports?: number[];
  healthCheck?: {
    endpoint?: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  autoRestart?: boolean;
  restartDelay?: number;
  maxRestarts?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project extends ProjectConfig {
  status: ProjectStatus;
  pid?: number;
  exitCode?: number;
  lastStart?: Date;
  lastStop?: Date;
  error?: string;
  uptime?: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface ProjectMetrics {
  id: string;
  status: ProjectStatus;
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface ProjectCreateRequest {
  name: string;
  type: ProjectType;
  description?: string;
  workingDirectory?: string;
  config?: Partial<ProjectConfig>;
}

export interface ProjectUpdateRequest {
  id: string;
  name?: string;
  description?: string;
  config?: Partial<ProjectConfig>;
}

export interface ProjectActionRequest {
  id: string;
  action: 'start' | 'stop' | 'restart' | 'install' | 'update' | 'configure';
  options?: Record<string, any>;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  running: number;
  stopped: number;
  error: number;
}

export interface ProjectActionResponse {
  success: boolean;
  message: string;
  project?: Project;
  error?: string;
}
