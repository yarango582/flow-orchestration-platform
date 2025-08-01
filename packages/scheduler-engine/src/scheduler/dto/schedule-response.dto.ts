import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatus } from '../../database/entities/execution.entity';

export class ScheduleDto {
  @ApiProperty({ description: 'Schedule unique identifier' })
  id: string;

  @ApiProperty({ description: 'Associated flow ID' })
  flowId: string;

  @ApiProperty({ description: 'Schedule name' })
  name: string;

  @ApiProperty({ description: 'Schedule description' })
  description?: string;

  @ApiProperty({ description: 'Cron expression' })
  cronExpression: string;

  @ApiProperty({ description: 'Timezone' })
  timezone: string;

  @ApiProperty({ description: 'Whether schedule is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Maximum retries on failure' })
  maxRetries: number;

  @ApiProperty({ description: 'Retry delay in seconds' })
  retryDelay: number;

  @ApiProperty({ description: 'Last execution timestamp' })
  lastRun?: Date;

  @ApiProperty({ description: 'Next scheduled execution' })
  nextRun?: Date;

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creator user ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PaginatedSchedulesDto {
  @ApiProperty({ description: 'Array of schedules', type: [ScheduleDto] })
  data: ScheduleDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ExecutionDto {
  @ApiProperty({ description: 'Execution unique identifier' })
  id: string;

  @ApiProperty({ description: 'Associated flow ID' })
  flowId: string;

  @ApiProperty({ description: 'Associated schedule ID' })
  scheduleId?: string;

  @ApiProperty({ description: 'Execution status', enum: ExecutionStatus })
  status: ExecutionStatus;

  @ApiProperty({ description: 'Execution start time' })
  startTime: Date;

  @ApiProperty({ description: 'Execution end time' })
  endTime?: Date;

  @ApiProperty({ description: 'Execution duration in milliseconds' })
  duration?: number;

  @ApiProperty({ description: 'Number of records processed' })
  recordsProcessed: number;

  @ApiProperty({ description: 'Error message if failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'Number of retry attempts' })
  retryCount: number;
}

export class NodeExecutionDto {
  @ApiProperty({ description: 'Node ID' })
  nodeId: string;

  @ApiProperty({ description: 'Node type' })
  nodeType: string;

  @ApiProperty({ description: 'Node execution status', enum: ExecutionStatus })
  status: ExecutionStatus;

  @ApiProperty({ description: 'Node execution start time' })
  startTime: Date;

  @ApiProperty({ description: 'Node execution end time' })
  endTime?: Date;

  @ApiProperty({ description: 'Node execution duration in milliseconds' })
  duration?: number;

  @ApiProperty({ description: 'Records processed by this node' })
  recordsProcessed?: number;

  @ApiProperty({ description: 'Error message if node failed' })
  errorMessage?: string;
}

export class ExecutionDetailDto extends ExecutionDto {
  @ApiProperty({ description: 'Node-level execution details', type: [NodeExecutionDto] })
  nodeExecutions?: NodeExecutionDto[];

  @ApiProperty({ description: 'Additional execution metadata' })
  metadata?: Record<string, any>;
}

export class ExecutionLogDto {
  @ApiProperty({ description: 'Log timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Log level', enum: ['debug', 'info', 'warn', 'error'] })
  level: 'debug' | 'info' | 'warn' | 'error';

  @ApiProperty({ description: 'Log message' })
  message: string;

  @ApiProperty({ description: 'Associated node ID' })
  nodeId?: string;

  @ApiProperty({ description: 'Additional log metadata' })
  metadata?: Record<string, any>;
}

export class PaginatedExecutionsDto {
  @ApiProperty({ description: 'Array of executions', type: [ExecutionDto] })
  data: ExecutionDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class BulkOperationResultDto {
  @ApiProperty({ description: 'Number of successful operations' })
  successCount: number;

  @ApiProperty({ description: 'Number of failed operations' })
  failureCount: number;

  @ApiProperty({ description: 'Array of errors for failed operations' })
  errors: Array<{
    scheduleId: string;
    error: string;
  }>;
}

export class JobStatsDto {
  @ApiProperty({ description: 'Number of waiting jobs' })
  waiting: number;

  @ApiProperty({ description: 'Number of active jobs' })
  active: number;

  @ApiProperty({ description: 'Number of completed jobs' })
  completed: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  failed: number;

  @ApiProperty({ description: 'Number of delayed jobs' })
  delayed: number;

  @ApiProperty({ description: 'Number of paused jobs' })
  paused: number;
}