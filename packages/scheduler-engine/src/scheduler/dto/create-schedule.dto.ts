import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Flow ID to schedule',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  flowId: string;

  @ApiProperty({
    description: 'Schedule name',
    minLength: 1,
    maxLength: 100,
    example: 'Daily User Synchronization',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Schedule description',
    maxLength: 500,
    required: false,
    example: 'Synchronizes users from HR database every weekday at 9 AM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Cron expression for scheduling',
    example: '0 9 * * 1-5',
  })
  @IsString()
  cronExpression: string;

  @ApiProperty({
    description: 'Timezone for the schedule',
    default: 'UTC',
    example: 'America/Mexico_City',
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @ApiProperty({
    description: 'Whether the schedule is enabled',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({
    description: 'Maximum number of retries on failure',
    minimum: 0,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number = 3;

  @ApiProperty({
    description: 'Delay between retries in seconds',
    minimum: 1,
    default: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  retryDelay?: number = 300;

  @ApiProperty({
    description: 'Additional metadata for the schedule',
    required: false,
    example: { department: 'HR', priority: 'high' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}