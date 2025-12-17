// React component type definitions

import { ReactNode, CSSProperties } from 'react';
import { Project, ProjectCreateRequest, ProjectUpdateRequest, ProjectActionRequest } from './project';
import { Task, TaskCreateRequest, TaskUpdateRequest, TaskActionRequest, TaskFilter } from './task';
import { AuthConfig, AuthCreateRequest, AuthUpdateRequest, AuthActionRequest } from './auth';
import { SystemMetrics, SystemAlert, ProcessInfo, SystemActionRequest } from './system';

// Base component props
export interface BaseComponentProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  testId?: string;
  'data-testid'?: string;
}

// Header component types
export interface HeaderProps extends BaseComponentProps {
  title: string;
  subtitle?: string;
  showStatus: boolean;
  showNotifications: boolean;
  onMenuToggle?: () => void;
  onSettingsClick?: () => void;
  onNotificationClick?: () => void;
}

// Project Manager component types
export interface ProjectManagerProps extends BaseComponentProps {
  projects: Project[];
  selectedProject?: string;
  onProjectSelect?: (projectId: string) => void;
  onProjectCreate?: (config: ProjectCreateRequest) => void;
  onProjectUpdate?: (config: ProjectUpdateRequest) => void;
  onProjectDelete?: (projectId: string) => void;
  onProjectAction?: (request: ProjectActionRequest) => void;
  onRefresh?: () => void;
}

// Task Monitor component types
export interface TaskMonitorProps extends BaseComponentProps {
  tasks: Task[];
  selectedTask?: string;
  onTaskSelect?: (taskId: string) => void;
  onTaskCreate?: (config: TaskCreateRequest) => void;
  onTaskUpdate?: (config: TaskUpdateRequest) => void;
  onTaskAction?: (request: TaskActionRequest) => void;
  onTaskCancel?: (taskId: string) => void;
  onFilterChange?: (filter: TaskFilter) => void;
  filter?: TaskFilter;
}

// Auth Manager component types
export interface AuthManagerProps extends BaseComponentProps {
  authConfigs: AuthConfig[];
  selectedConfig?: string;
  onConfigSelect?: (configId: string) => void;
  onConfigCreate?: (config: AuthCreateRequest) => void;
  onConfigUpdate?: (config: AuthUpdateRequest) => void;
  onConfigDelete?: (configId: string) => void;
  onConfigAction?: (request: AuthActionRequest) => void;
  onTestConnection?: (configId: string) => void;
}

// System Monitor component types
export interface SystemMonitorProps extends BaseComponentProps {
  metrics: SystemMetrics;
  alerts: SystemAlert[];
  processes: ProcessInfo[];
  onSystemAction?: (request: SystemActionRequest) => void;
  onAlertAcknowledge?: (alertId: string) => void;
  onProcessSelect?: (process: ProcessInfo) => void;
  autoRefresh: boolean;
  refreshInterval: number;
}

// Loading Spinner component types
export interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  message?: string;
  overlay?: boolean;
}

// Error Boundary component types
export interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

// Status Bar component types
export interface StatusBarProps extends BaseComponentProps {
  status: 'online' | 'offline' | 'connecting' | 'error';
  message?: string;
  showTimestamp: boolean;
  showVersion: boolean;
  version?: string;
  onStatusClick?: () => void;
}

// Modal component types
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  title: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
  maskClosable?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showConfirm?: boolean;
  showCancel?: boolean;
}

// Form component types
export interface FormFieldProps extends BaseComponentProps {
  label: string;
  name: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  value?: any;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  help?: string;
  options?: Array<{ label: string; value: any }>;
  onChange?: (value: any, name: string) => void;
  onBlur?: (value: any, name: string) => void;
  onFocus?: (value: any, name: string) => void;
}

// Table component types
export interface TableColumn<T = any> {
  key: string;
  title: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T, index: number) => ReactNode;
}

export interface TableProps<T = any> extends BaseComponentProps {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyText?: string;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onRowClick?: (record: T, index: number) => void;
  onRowDoubleClick?: (record: T, index: number) => void;
  selection?: {
    selectedRowKeys: string[];
    onChange: (selectedRowKeys: string[], selectedRows: T[]) => void;
  };
}

// Card component types
export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  avatar?: ReactNode;
  cover?: ReactNode;
  actions?: ReactNode[];
  loading?: boolean;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

// Notification component types
export interface NotificationProps extends BaseComponentProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  onClose?: () => void;
}

// Tooltip component types
export interface TooltipProps extends BaseComponentProps {
  title: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  overlay?: ReactNode;
}

// Progress component types
export interface ProgressProps extends BaseComponentProps {
  percent: number;
  status?: 'normal' | 'exception' | 'active' | 'success';
  showInfo?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  format?: (percent: number) => ReactNode;
}

// Tag component types
export interface TagProps extends BaseComponentProps {
  color?: string;
  closable?: boolean;
  visible?: boolean;
  onClose?: () => void;
  onClick?: () => void;
}

// Badge component types
export interface BadgeProps extends BaseComponentProps {
  count?: number;
  overflowCount?: number;
  showZero?: boolean;
  status?: 'success' | 'processing' | 'default' | 'error' | 'warning';
  text?: string;
  dot?: boolean;
}
