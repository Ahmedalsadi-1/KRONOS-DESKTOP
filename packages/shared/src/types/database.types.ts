// Database Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl?: number;
}

export interface FileStorageConfig {
  provider: 's3' | 'local';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  localPath?: string;
  maxFileSize?: number;
  allowedTypes?: string[];
}

// Pagination types
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Common database entity fields
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Service registry types
export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc';
  status: 'healthy' | 'unhealthy' | 'unknown';
  metadata: Record<string, any>;
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface ServiceEndpoint {
  serviceId: string;
  path: string;
  method: string;
  description?: string;
  requiresAuth: boolean;
  rateLimit?: number;
}