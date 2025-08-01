import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../decorators/public.decorator';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  dependencies: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
  };
  uptime: number;
  version: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Health check result',
  })
  async getHealth(): Promise<HealthCheckResponse> {
    return this.healthService.getHealthStatus();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to accept requests',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async getReadiness(): Promise<{ ready: boolean }> {
    const ready = await this.healthService.isReady();
    return { ready };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  async getLiveness(): Promise<{ alive: boolean }> {
    return { alive: true };
  }
}