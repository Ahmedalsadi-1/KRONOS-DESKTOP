/**
 * Application type definitions for KRONOS Application Launcher
 * Defines the structure of applications that can be launched and managed
 */

export interface Application {
  id: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  executable: string;
  args?: string[];
  env?: Record<string, string>;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  resizable: boolean;
  status: 'available' | 'running' | 'error';
  port?: number;
}

export interface ApplicationMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  status: 'available' | 'running' | 'error';
}

export interface LaunchOptions {
  width?: number;
  height?: number;
  resizable?: boolean;
  floating?: boolean;
  tab?: string;
  fullscreen?: boolean;
  splitView?: boolean;
  position?: 'left' | 'right' | 'center';
}

export interface ApplicationRegistry {
  applications: Application[];
  lastUpdated: number;
}
