// Authentication and authorization type definitions

export enum AuthProvider {
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  JWT = 'jwt',
  BASIC = 'basic',
  BEARER = 'bearer',
  CUSTOM = 'custom'
}

export enum AuthStatus {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired',
  ERROR = 'error',
  REVOKED = 'revoked'
}

export interface AuthConfig {
  id: string;
  platform: string;
  provider: AuthProvider;
  status: AuthStatus;
  credentials: AuthCredentials;
  settings: AuthSettings;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount?: number;
}

export interface AuthCredentials {
  type: 'apiKey' | 'token' | 'username' | 'certificate' | 'custom';
  value: string;
  encrypted: boolean;
  hash?: string;
  salt?: string;
  iv?: string;
  metadata?: Record<string, any>;
}

export interface AuthSettings {
  autoRefresh: boolean;
  refreshInterval?: number;
  maxRetries: number;
  timeout: number;
  headers?: Record<string, string>;
  endpoints?: {
    auth?: string;
    refresh?: string;
    validate?: string;
    logout?: string;
  };
  scopes?: string[];
  permissions?: string[];
}

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
  expiresAt?: Date;
  scopes?: string[];
  permissions?: string[];
  userInfo?: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  expiresAt?: Date;
  scope?: string[];
}

export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  avatar?: string;
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface AuthSession {
  id: string;
  user: AuthUser;
  platform: string;
  provider: AuthProvider;
  createdAt: Date;
  lastActivity: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface AuthCreateRequest {
  platform: string;
  provider: AuthProvider;
  credentials: Partial<AuthCredentials>;
  settings?: Partial<AuthSettings>;
  metadata?: Record<string, any>;
}

export interface AuthUpdateRequest {
  id: string;
  credentials?: Partial<AuthCredentials>;
  settings?: Partial<AuthSettings>;
  metadata?: Record<string, any>;
}

export interface AuthActionRequest {
  id: string;
  action: 'validate' | 'refresh' | 'revoke' | 'test' | 'export' | 'import';
  options?: Record<string, any>;
}

export interface AuthListResponse {
  configs: AuthConfig[];
  total: number;
  byStatus: Record<AuthStatus, number>;
  byProvider: Record<AuthProvider, number>;
}

export interface AuthActionResponse {
  success: boolean;
  message: string;
  config?: AuthConfig;
  validation?: AuthValidationResult;
  token?: AuthToken;
  user?: AuthUser;
  error?: string;
}

export interface AuthStats {
  totalConfigs: number;
  activeConfigs: number;
  expiredConfigs: number;
  byPlatform: Record<string, number>;
  byProvider: Record<AuthProvider, number>;
  recentActivity: AuthSession[];
}
