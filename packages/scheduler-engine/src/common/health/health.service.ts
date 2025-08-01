import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import Redis from 'redis';
import { HealthCheckResponse } from './health.controller';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private redisClient: Redis.RedisClientType;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.initializeRedisClient();
  }

  async getHealthStatus(): Promise<HealthCheckResponse> {
    const dependencies = await this.checkDependencies();
    
    const status = this.determineOverallStatus(dependencies);
    
    return {
      status,
      timestamp: new Date().toISOString(),
      dependencies,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '0.1.0',
    };
  }

  async isReady(): Promise<boolean> {
    const dependencies = await this.checkDependencies();
    return dependencies.database === 'healthy' && dependencies.redis === 'healthy';
  }

  private async checkDependencies(): Promise<{
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
  }> {
    const [databaseHealth, redisHealth] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      database: databaseHealth.status === 'fulfilled' && databaseHealth.value 
        ? 'healthy' 
        : 'unhealthy',
      redis: redisHealth.status === 'fulfilled' && redisHealth.value 
        ? 'healthy' 
        : 'unhealthy',
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.connection.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      if (!this.redisClient) {
        return false;
      }
      
      const result = await this.redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }

  private determineOverallStatus(dependencies: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
  }): 'healthy' | 'degraded' | 'unhealthy' {
    const healthyCount = Object.values(dependencies).filter(
      status => status === 'healthy',
    ).length;

    if (healthyCount === Object.keys(dependencies).length) {
      return 'healthy';
    } else if (healthyCount > 0) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private initializeRedisClient(): void {
    try {
      const redisConfig = {
        host: this.configService.get('redis.host'),
        port: this.configService.get('redis.port'),
        password: this.configService.get('redis.password'),
        db: this.configService.get('redis.db'),
      };

      this.redisClient = Redis.createClient(redisConfig);
      
      this.redisClient.on('error', (error) => {
        this.logger.error('Redis client error', error);
      });

      this.redisClient.connect().catch((error) => {
        this.logger.error('Failed to connect to Redis', error);
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis client', error);
    }
  }
}