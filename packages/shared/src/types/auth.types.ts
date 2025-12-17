// Authentication Types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface OAuthProvider {
  name: 'google' | 'github' | 'microsoft';
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
}

// Permission definitions
export const PERMISSIONS = {
  // User management
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Task management
  TASK_READ: 'task:read',
  TASK_WRITE: 'task:write',
  TASK_DELETE: 'task:delete',

  // Computer control
  COMPUTER_READ: 'computer:read',
  COMPUTER_CONTROL: 'computer:control',

  // Admin
  ADMIN_USERS: 'admin:users',
  ADMIN_SYSTEM: 'admin:system',

  // Service registry
  SERVICE_READ: 'service:read',
  SERVICE_WRITE: 'service:write',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role definitions
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SERVICE: 'service',
  COMPUTER: 'computer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.USER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.COMPUTER_READ,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_WRITE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.COMPUTER_READ,
    PERMISSIONS.COMPUTER_CONTROL,
    PERMISSIONS.ADMIN_USERS,
    PERMISSIONS.ADMIN_SYSTEM,
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_WRITE,
  ],
  [ROLES.SERVICE]: [
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.COMPUTER_CONTROL,
    PERMISSIONS.SERVICE_READ,
  ],
  [ROLES.COMPUTER]: [
    PERMISSIONS.COMPUTER_CONTROL,
  ],
};