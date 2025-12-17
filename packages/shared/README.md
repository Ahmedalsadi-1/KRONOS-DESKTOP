# Shared Infrastructure Package

This package provides unified infrastructure components for the Kronos monorepo, including authentication, caching, service registry, and file storage.

## Features

- **Authentication System**: JWT-based authentication with role-based permissions
- **Caching Service**: Redis-based caching with TTL support
- **Service Registry**: Decentralized service discovery and health monitoring
- **File Storage**: S3 and local file storage with unified API
- **Database Schema**: Prisma-based shared database models

## Installation

```bash
npm install @kronos-desktop-agent/shared
```

## Environment Variables

### Authentication
```env
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=15m
```

### Database
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kronos
```

### Redis Cache
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

### File Storage (S3)
```env
FILE_STORAGE_PROVIDER=s3
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### File Storage (Local)
```env
FILE_STORAGE_PROVIDER=local
FILE_STORAGE_LOCAL_PATH=./uploads
FILE_STORAGE_BASE_URL=http://localhost:3000/files
FILE_STORAGE_MAX_SIZE=10485760
FILE_STORAGE_ALLOWED_TYPES=image/*,application/pdf
```

### Service Registry
```env
SERVICE_NAME=your-service-name
SERVICE_ID=unique-service-id
SERVICE_VERSION=1.0.0
SERVICE_HOST=localhost
SERVICE_PORT=3000
SERVICE_PROTOCOL=http
```

## Usage

### Basic Setup

```typescript
import { InfrastructureModule } from '@kronos-desktop-agent/shared';

@Module({
  imports: [InfrastructureModule],
  // ...
})
export class AppModule {}
```

### Authentication

```typescript
import { AuthService } from '@kronos-desktop-agent/shared';

@Injectable()
export class UserService {
  constructor(private authService: AuthService) {}

  async login(credentials: LoginRequest) {
    return await this.authService.login(credentials);
  }
}
```

### Caching

```typescript
import { CacheService } from '@kronos-desktop-agent/shared';

@Injectable()
export class DataService {
  constructor(private cacheService: CacheService) {}

  async getData(key: string) {
    let data = await this.cacheService.get(key);
    if (!data) {
      data = await this.fetchFromDatabase(key);
      await this.cacheService.set(key, data, 300); // 5 minutes TTL
    }
    return data;
  }
}
```

### Service Registry

```typescript
import { ServiceRegistryService } from '@kronos-desktop-agent/shared';

@Injectable()
export class ApiGatewayService {
  constructor(private registry: ServiceRegistryService) {}

  async callService(serviceName: string, endpoint: string) {
    const service = await this.registry.discoverService(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    // Make request to service
    return await this.httpService.get(`${service.protocol}://${service.host}:${service.port}${endpoint}`);
  }
}
```

### File Storage

```typescript
import { FileStorageService } from '@kronos-desktop-agent/shared';

@Injectable()
export class FileService {
  constructor(private fileStorage: FileStorageService) {}

  async uploadFile(file: Express.Multer.File) {
    return await this.fileStorage.uploadFile(file, {
      folder: 'uploads',
      metadata: { uploadedBy: 'user123' }
    });
  }
}
```

## API Standards

This package enforces the API standards defined in `/docs/api-standards.md`. All services using this package should follow these conventions.

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm run test
```

### Linting
```bash
npm run lint
```

## Database Migrations

```bash
# Generate migration
npx prisma migrate dev --name your-migration-name

# Apply migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## Service Registration

Services automatically register themselves with the service registry on startup. Configure the service environment variables above to enable registration.

## Health Checks

The service registry provides health check endpoints:

- `GET /health/registry` - Service registry health
- `GET /health/services` - Registered services status

## Security Considerations

- JWT tokens expire in 15 minutes
- Refresh tokens should be stored securely
- File uploads are validated for type and size
- CORS and rate limiting should be configured at the service level
- Environment variables should never be committed to version control