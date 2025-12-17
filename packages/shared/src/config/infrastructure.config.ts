// infrastructure.config.ts
import { ConfigService } from '@nestjs/config';

export const infrastructureConfig = (configService: ConfigService) => ({
  // Database
  database: {
    host: configService.get('DATABASE_HOST', 'localhost'),
    port: configService.get('DATABASE_PORT', 5432),
    database: configService.get('DATABASE_NAME', 'kronos'),
    username: configService.get('DATABASE_USER', 'postgres'),
    password: configService.get('DATABASE_PASSWORD'),
    ssl: configService.get('DATABASE_SSL', false),
    maxConnections: configService.get('DATABASE_MAX_CONNECTIONS', 20),
  },

  // Redis Cache
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get('REDIS_DB', 0),
    ttl: configService.get('REDIS_TTL', 3600), // 1 hour default
  },

  // JWT Authentication
  jwt: {
    secret: configService.get('JWT_SECRET', 'default-secret-key'),
    expiresIn: configService.get('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    issuer: configService.get('JWT_ISSUER', 'kronos-auth'),
    audience: configService.get('JWT_AUDIENCE', 'kronos-services'),
  },

  // File Storage
  fileStorage: {
    provider: configService.get('FILE_STORAGE_PROVIDER', 'local'),
    bucket: configService.get('AWS_S3_BUCKET'),
    region: configService.get('AWS_REGION', 'us-east-1'),
    accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
    localPath: configService.get('FILE_STORAGE_LOCAL_PATH', './uploads'),
    baseUrl: configService.get('FILE_STORAGE_BASE_URL', 'http://localhost:3000/files'),
    maxFileSize: configService.get('FILE_STORAGE_MAX_SIZE', 10 * 1024 * 1024), // 10MB
    allowedTypes: configService.get('FILE_STORAGE_ALLOWED_TYPES', ['image/*', 'application/pdf']),
  },

  // Service Registry
  serviceRegistry: {
    name: configService.get('SERVICE_NAME'),
    id: configService.get('SERVICE_ID', 'default'),
    version: configService.get('SERVICE_VERSION', '1.0.0'),
    host: configService.get('SERVICE_HOST', 'localhost'),
    port: configService.get('SERVICE_PORT', 3000),
    protocol: configService.get('SERVICE_PROTOCOL', 'http'),
    heartbeatInterval: configService.get('SERVICE_HEARTBEAT_INTERVAL', 30000), // 30 seconds
    ttl: configService.get('SERVICE_TTL', 60000), // 1 minute
  },

  // API Configuration
  api: {
    prefix: configService.get('API_PREFIX', 'api'),
    version: configService.get('API_VERSION', 'v1'),
    cors: {
      origin: configService.get('CORS_ORIGIN', '*'),
      credentials: configService.get('CORS_CREDENTIALS', true),
    },
    rateLimit: {
      ttl: configService.get('RATE_LIMIT_TTL', 60), // 1 minute
      limit: configService.get('RATE_LIMIT_MAX', 100), // requests per window
    },
  },

  // Security
  security: {
    bcryptRounds: configService.get('BCRYPT_ROUNDS', 12),
    sessionTimeout: configService.get('SESSION_TIMEOUT', 24 * 60 * 60 * 1000), // 24 hours
    passwordMinLength: configService.get('PASSWORD_MIN_LENGTH', 8),
  },
});

export type InfrastructureConfig = ReturnType<typeof infrastructureConfig>;