import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PositionDto {
  @ApiProperty({ description: 'X coordinate' })
  @IsString()
  x: number;

  @ApiProperty({ description: 'Y coordinate' })
  @IsString()
  y: number;
}

export class NodeInstanceDto {
  @ApiProperty({ description: 'Unique node identifier within the flow' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Node type identifier' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Node version (semantic versioning)' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Node configuration object' })
  @IsObject()
  config: Record<string, any>;

  @ApiProperty({ description: 'Node position in the canvas', type: PositionDto })
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;
}

export class NodeConnectionDto {
  @ApiProperty({ description: 'Source node ID' })
  @IsString()
  fromNodeId: string;

  @ApiProperty({ description: 'Source node output pin' })
  @IsString()
  fromOutput: string;

  @ApiProperty({ description: 'Target node ID' })
  @IsString()
  toNodeId: string;

  @ApiProperty({ description: 'Target node input pin' })
  @IsString()
  toInput: string;
}

export class CreateFlowDto {
  @ApiProperty({
    description: 'Flow name',
    minLength: 1,
    maxLength: 100,
    example: 'User Synchronization Flow',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Flow description',
    maxLength: 500,
    required: false,
    example: 'Flow that queries users from database and sends to external service',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Array of node instances in the flow',
    type: [NodeInstanceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeInstanceDto)
  nodes: NodeInstanceDto[];

  @ApiProperty({
    description: 'Array of connections between nodes',
    type: [NodeConnectionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeConnectionDto)
  connections: NodeConnectionDto[];

  @ApiProperty({
    description: 'Additional metadata for the flow',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}