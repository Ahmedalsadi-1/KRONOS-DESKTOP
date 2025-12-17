import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Auth
import { AuthModule } from './auth/auth.module';

// Infrastructure Services
import { CacheService } from './cache/cache.service';
import { ServiceRegistryService } from './service-registry/service-registry.service';
import { FileStorageService } from './file-storage/file-storage.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
  ],
  providers: [
    CacheService,
    ServiceRegistryService,
    FileStorageService,
  ],
  exports: [
    AuthModule,
    CacheService,
    ServiceRegistryService,
    FileStorageService,
  ],
})
export class InfrastructureModule {}