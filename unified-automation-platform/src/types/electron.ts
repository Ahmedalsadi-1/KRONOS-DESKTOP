// Electron-specific type definitions

import { BrowserWindow, Menu, shell, dialog } from 'electron';

// Main process types
export interface MainProcessConfig {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  center?: boolean;
  resizable?: boolean;
  movable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  alwaysOnTop?: boolean;
  fullscreenable?: boolean;
  skipTaskbar?: boolean;
  kiosk?: boolean;
  title?: string;
  icon?: string;
  show?: boolean;
  frame?: boolean;
  transparent?: boolean;
  vibrancy?: string;
  backgroundColor?: string;
  webPreferences: WebPreferences;
}

export interface WebPreferences {
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  enableRemoteModule?: boolean;
  preload?: string;
  webSecurity?: boolean;
  allowRunningInsecureContent?: boolean;
  experimentalFeatures?: boolean;
  webviewTag?: boolean;
  scrollBounce?: boolean;
  backgroundThrottling?: boolean;
}

// IPC types
export interface IPCRequest {
  id: string;
  method: string;
  params?: any[];
  options?: {
    timeout?: number;
    retries?: number;
    requireResponse?: boolean;
  };
}

export interface IPCResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    duration: number;
    source: string;
  };
}

export interface IPCError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

// Menu types
export interface MenuItemConfig {
  label?: string;
  role?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  accelerator?: string;
  click?: (item: any, browserWindow: BrowserWindow | null) => void;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  submenu?: MenuItemConfig[];
  id?: string;
  before?: string | string[];
  after?: string | string[];
  beforeGroupContaining?: string;
  afterGroupContaining?: string;
}

export interface MenuTemplate {
  id?: string;
  label?: string;
  submenu?: MenuItemConfig[];
}

// Dialog types
export interface DialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
  properties?: string[];
  message?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
}

export interface SaveDialogOptions extends DialogOptions {
  defaultPath?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
}

export interface OpenDialogOptions extends DialogOptions {
  defaultPath?: string;
  filters?: {
    name: string;
    extensions: string[];
  }[];
  properties?: string[];
}

export interface MessageBoxOptions {
  type?: 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  cancelId?: number;
  noLink?: boolean;
}

// Window types
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: WindowBounds;
  isFullScreen: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
  isVisible: boolean;
}

// App types
export interface AppConfig {
  name: string;
  version: string;
  author: string;
  description?: string;
  main?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  scripts?: Record<string, string>;
  build?: {
    appId?: string;
    productName?: string;
    directories?: {
      output?: string;
    };
    files?: string[];
    extraFiles?: string[];
    extraMetadata?: any;
    mac?: {
      category?: string;
      icon?: string;
      target?: string | string[];
    };
    win?: {
      target?: string | string[];
      icon?: string;
    };
    linux?: {
      target?: string | string[];
      icon?: string;
      category?: string;
    };
  };
}

// System tray types
export interface TrayConfig {
  title?: string;
  tooltip?: string;
  icon?: string;
  iconRetina?: string;
  iconTemplate?: string;
  menu?: MenuItemConfig[];
}

// Notification types
export interface NotificationOptions {
  title: string;
  body?: string;
  subtitle?: string;
  silent?: boolean;
  sound?: string;
  icon?: string;
  iconPath?: string;
  hasReply?: boolean;
  timeoutType?: 'default' | 'never' | 'apns-specific';
  urgency?: 'normal' | 'critical' | 'low';
  closeButtonText?: string;
  actions?: {
    type: 'button';
    text: string;
  }[];
  replyPlaceholder?: string;
 荧光?: boolean;
}

// Protocol types
export interface ProtocolConfig {
  scheme: string;
  privileges?: {
    standard?: boolean;
    supportFetchAPI?: boolean;
    corsEnabled?: boolean;
    stream?: boolean;
    appStartedBypassingSecurity?: boolean;
  };
}

// Auto-updater types
export interface AutoUpdaterConfig {
  provider?: 'github' | 'bitbucket' | 'generic' | 's3' | 'spaces' | 'gitlab' | 'bintray' | 'hockeyapp' | 'release' | 'snap-store';
  url?: string;
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
  path?: string;
  token?: string;
  owner?: string;
  repo?: string;
  private?: boolean;
  requestHeaders?: Record<string, string>;
  publishAutoUpdate?: boolean;
  createDashboardDirectory?: boolean;
  useMultipleRangeRequest?: boolean;
}

// Shell types
export interface ShellConfig {
  openExternal(url: string, options?: {
    activate?: boolean;
    workingDirectory?: string;
  }): Promise<void>;
  openPath(path: string): Promise<string>;
  showItemInFolder(fullPath: string): void;
  moveItemToTrash(fullPath: string): boolean;
  beep(): void;
  setUserTasks(tasks: any[]): void;
  writeShortcutLink(shortcutPath: string, options: {
    target: string;
    cwd?: string;
    args?: string;
    description?: string;
    icon?: string;
    iconIndex?: number;
  }): Promise<void>;
  readShortcutLink(shortcutPath: string): Promise<any>;
}

// Power monitor types
export interface PowerMonitorConfig {
  onSuspend?: () => void;
  onResume?: () => void;
  onAC?: () => void;
  onBattery?: () => void;
  onShutdown?: () => void;
  onLockScreen?: () => void;
  onUnlockScreen?: () => void;
}

// Native theme types
export interface NativeThemeConfig {
  shouldUseDarkColors?: boolean;
  shouldUseHighContrastColors?: boolean;
  shouldUseInvertedColorScheme?: boolean;
  getColorSource?: () => string;
}

// App events types
export interface AppEvent {
  name: string;
  handler: (...args: any[]) => void | Promise<void>;
}

// Clipboard types
export interface ClipboardConfig {
  read(): string;
  readRichText(): string;
  readHTML(): string;
  readImage(): Buffer;
  write(text: string): void;
  writeRichText(text: string): void;
  writeHTML(markup: string): void;
  writeBuffer(format: string, buffer: Buffer): void;
  clear(): void;
  availableFormats(type?: 'selection' | 'clipboard'): string[];
  readBuffer(format: string): Buffer;
  writeBuffer(format: string, buffer: Buffer): void;
}

// Global shortcut types
export interface GlobalShortcutConfig {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
  isRegistered(accelerator: string): boolean;
  getAllAccelerators(): string[];
}
