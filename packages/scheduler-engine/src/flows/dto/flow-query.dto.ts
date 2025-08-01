import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { FlowStatus } from '../../database/entities/flow.entity';

export class FlowQueryDto {
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
    description: 'Filter by flow status',
    enum: FlowStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FlowStatus)
  status?: FlowStatus;

  @ApiProperty({
    description: 'Search in flow name and description',
    required: false,
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  search?: string;
}