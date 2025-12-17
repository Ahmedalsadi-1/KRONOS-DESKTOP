import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'redis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis.RedisClientType;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = Redis.createClient({
      socket: {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
      },
      password: this.configService.get('REDIS_PASSWORD'),
      database: this.configService.get('REDIS_DB', 0),
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      console.error('Cache decrement error:', error);
      return 0;
    }
  }

  // Hash operations
  async hget(hash: string, field: string): Promise<string | null> {
    try {
      const result = await this.client.hGet(hash, field);
      return result ?? null;
    } catch (error) {
      console.error('Cache hget error:', error);
      return null;
    }
  }

  async hset(hash: string, field: string, value: any): Promise<void> {
    try {
      await this.client.hSet(hash, field, JSON.stringify(value));
    } catch (error) {
      console.error('Cache hset error:', error);
    }
  }

  async hgetall(hash: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.client.hGetAll(hash);
      const parsed: Record<string, any> = {};
      for (const [key, value] of Object.entries(result)) {
        try {
          parsed[key] = JSON.parse(value);
        } catch {
          parsed[key] = value;
        }
      }
      return parsed;
    } catch (error) {
      console.error('Cache hgetall error:', error);
      return null;
    }
  }

  // Set operations
  async sadd(set: string, ...members: string[]): Promise<void> {
    try {
      await this.client.sAdd(set, members);
    } catch (error) {
      console.error('Cache sadd error:', error);
    }
  }

  async smembers(set: string): Promise<string[]> {
    try {
      return await this.client.sMembers(set);
    } catch (error) {
      console.error('Cache smembers error:', error);
      return [];
    }
  }

  // List operations
  async lpush(list: string, ...values: any[]): Promise<void> {
    try {
      const serializedValues = values.map(v => JSON.stringify(v));
      await this.client.lPush(list, serializedValues);
    } catch (error) {
      console.error('Cache lpush error:', error);
    }
  }

  async rpop(list: string): Promise<any | null> {
    try {
      const value = await this.client.rPop(list);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache rpop error:', error);
      return null;
    }
  }

  // Utility methods
  generateKey(...parts: string[]): string {
    return parts.join(':');
  }

  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Cache clear pattern error:', error);
    }
  }

  async getClient(): Promise<Redis.RedisClientType> {
    return this.client;
  }
}