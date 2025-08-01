import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleQueryDto {
  @ApiProperty({
    description: 'Page number',
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by flow ID',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  flowId?: string;

  @ApiProperty({
    description: 'Filter by enabled status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Filter schedules with next run before this date',
    format: 'date-time',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  nextRunBefore?: string;
}