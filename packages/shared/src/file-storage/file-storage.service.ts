import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { FileStorageConfig } from '../types/database.types';

@Injectable()
export class FileStorageService {
  private s3Client?: AWS.S3;
  private config: FileStorageConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      provider: this.configService.get('FILE_STORAGE_PROVIDER', 'local'),
      bucket: this.configService.get('AWS_S3_BUCKET'),
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      localPath: this.configService.get('FILE_STORAGE_LOCAL_PATH', './uploads'),
      maxFileSize: this.configService.get('FILE_STORAGE_MAX_SIZE', 10 * 1024 * 1024), // 10MB
      allowedTypes: this.configService.get('FILE_STORAGE_ALLOWED_TYPES', ['image/*', 'application/pdf']),
    };

    if (this.config.provider === 's3') {
      this.initializeS3Client();
    } else {
      this.ensureLocalDirectory();
    }
  }

  private initializeS3Client(): void {
    if (!this.config.accessKeyId || !this.config.secretAccessKey || !this.config.bucket) {
      throw new Error('AWS S3 configuration is incomplete');
    }

    this.s3Client = new AWS.S3({
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
    });
  }

  private ensureLocalDirectory(): void {
    if (!this.config.localPath) return;

    if (!fs.existsSync(this.config.localPath)) {
      fs.mkdirSync(this.config.localPath, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    options: {
      folder?: string;
      filename?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ url: string; path: string; metadata: Record<string, any> }> {
    this.validateFile(file);

    const filename = options.filename || this.generateFilename(file);
    const filePath = options.folder ? `${options.folder}/${filename}` : filename;

    if (this.config.provider === 's3') {
      return await this.uploadToS3(file, filePath, options.metadata);
    } else {
      return await this.saveToLocal(file, filePath, options.metadata);
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    if (this.config.provider === 's3') {
      return await this.downloadFromS3(filePath);
    } else {
      return await this.readFromLocal(filePath);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.config.provider === 's3') {
      await this.deleteFromS3(filePath);
    } else {
      await this.deleteFromLocal(filePath);
    }
  }

  async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (this.config.provider === 's3') {
      return await this.getSignedS3Url(filePath, expiresIn);
    } else {
      return this.getLocalFileUrl(filePath);
    }
  }

  async listFiles(folder?: string): Promise<string[]> {
    if (this.config.provider === 's3') {
      return await this.listS3Files(folder);
    } else {
      return await this.listLocalFiles(folder);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new Error('No file provided');
    }

    if (this.config.maxFileSize && file.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    if (this.config.allowedTypes && this.config.allowedTypes.length > 0) {
      const isAllowed = this.config.allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.mimetype.startsWith(type.slice(0, -1));
        }
        return file.mimetype === type;
      });

      if (!isAllowed) {
        throw new Error(`File type ${file.mimetype} is not allowed`);
      }
    }
  }

  private generateFilename(file: Express.Multer.File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    return `${basename}-${timestamp}-${random}${extension}`;
  }

  // S3 Implementation
  private async uploadToS3(
    file: Express.Multer.File,
    filePath: string,
    metadata?: Record<string, any>
  ): Promise<{ url: string; path: string; metadata: Record<string, any> }> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not initialized');
    }

    const uploadParams = {
      Bucket: this.config.bucket,
      Key: filePath,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: metadata ? Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [k, String(v)])
      ) : undefined,
    };

    await this.s3Client.upload(uploadParams).promise();

    const url = await this.getSignedS3Url(filePath);

    return {
      url,
      path: filePath,
      metadata: metadata || {},
    };
  }

  private async downloadFromS3(filePath: string): Promise<Buffer> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not initialized');
    }

    const downloadParams = {
      Bucket: this.config.bucket,
      Key: filePath,
    };

    const result = await this.s3Client.getObject(downloadParams).promise();
    return result.Body as Buffer;
  }

  private async deleteFromS3(filePath: string): Promise<void> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not initialized');
    }

    const deleteParams = {
      Bucket: this.config.bucket,
      Key: filePath,
    };

    await this.s3Client.deleteObject(deleteParams).promise();
  }

  private async getSignedS3Url(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not initialized');
    }

    const signedUrlParams = {
      Bucket: this.config.bucket,
      Key: filePath,
      Expires: expiresIn,
    };

    return this.s3Client.getSignedUrlPromise('getObject', signedUrlParams);
  }

  private async listS3Files(folder?: string): Promise<string[]> {
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('S3 client not initialized');
    }

    const listParams = {
      Bucket: this.config.bucket,
      Prefix: folder,
    };

    const result = await this.s3Client.listObjectsV2(listParams).promise();
    return result.Contents?.map(obj => obj.Key || '').filter(key => key) || [];
  }

  // Local File System Implementation
  private async saveToLocal(
    file: Express.Multer.File,
    filePath: string,
    metadata?: Record<string, any>
  ): Promise<{ url: string; path: string; metadata: Record<string, any> }> {
    if (!this.config.localPath) {
      throw new Error('Local storage path not configured');
    }

    const fullPath = path.join(this.config.localPath, filePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file
    await fs.promises.writeFile(fullPath, file.buffer);

    const url = this.getLocalFileUrl(filePath);

    return {
      url,
      path: filePath,
      metadata: metadata || {},
    };
  }

  private async readFromLocal(filePath: string): Promise<Buffer> {
    if (!this.config.localPath) {
      throw new Error('Local storage path not configured');
    }

    const fullPath = path.join(this.config.localPath, filePath);
    return await fs.promises.readFile(fullPath);
  }

  private async deleteFromLocal(filePath: string): Promise<void> {
    if (!this.config.localPath) {
      throw new Error('Local storage path not configured');
    }

    const fullPath = path.join(this.config.localPath, filePath);
    await fs.promises.unlink(fullPath);
  }

  private getLocalFileUrl(filePath: string): string {
    const baseUrl = this.configService.get('FILE_STORAGE_BASE_URL', 'http://localhost:3000/files');
    return `${baseUrl}/${filePath}`;
  }

  private async listLocalFiles(folder?: string): Promise<string[]> {
    if (!this.config.localPath) {
      return [];
    }

    const searchPath = folder ? path.join(this.config.localPath, folder) : this.config.localPath;

    if (!fs.existsSync(searchPath)) {
      return [];
    }

    const files = await fs.promises.readdir(searchPath, { withFileTypes: true });
    return files
      .filter(file => file.isFile())
      .map(file => folder ? `${folder}/${file.name}` : file.name);
  }
}