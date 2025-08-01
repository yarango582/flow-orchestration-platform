import { ApiProperty } from '@nestjs/swagger';
import { NodeCategory } from '../../database/entities/node-definition.entity';

export class NodeDefinitionDto {
  @ApiProperty({ description: 'Node unique identifier' })
  id: string;

  @ApiProperty({ description: 'Node type identifier' })
  type: string;

  @ApiProperty({ description: 'Human-readable name' })
  name: string;

  @ApiProperty({ description: 'Node description' })
  description?: string;

  @ApiProperty({ description: 'Node version' })
  version: string;

  @ApiProperty({ description: 'Node category', enum: NodeCategory })
  category: NodeCategory;

  @ApiProperty({ description: 'Icon URL' })
  icon?: string;

  @ApiProperty({ description: 'Input parameters' })
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    defaultValue?: any;
    validation?: any;
  }>;

  @ApiProperty({ description: 'Output parameters' })
  outputs: Array<{
    name: string;
    type: string;
    description?: string;
    schema?: any;
  }>;

  @ApiProperty({ description: 'Compatibility matrix' })
  compatibilityMatrix: Array<{
    targetType: string;
    outputPin: string;
    targetInputPin: string;
    compatibility: string;
    conditions?: any[];
    transformations?: any[];
  }>;

  @ApiProperty({ description: 'Node configuration' })
  configuration?: {
    timeout?: number;
    retries?: number;
    concurrency?: number;
    batchSize?: number;
  };

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class NodeVersionDto {
  @ApiProperty({ description: 'Version number' })
  version: string;

  @ApiProperty({ description: 'Release date' })
  releaseDate: Date;

  @ApiProperty({ description: 'Change log' })
  changelog?: string;

  @ApiProperty({ description: 'Whether version is deprecated' })
  deprecated: boolean;

  @ApiProperty({ description: 'Whether version has breaking changes' })
  breaking: boolean;
}

export class NodeCategoryDto {
  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Category description' })
  description: string;

  @ApiProperty({ description: 'Category icon' })
  icon?: string;

  @ApiProperty({ description: 'Number of nodes in category' })
  nodeCount: number;
}

export class CompatibilityCheckDto {
  @ApiProperty({ description: 'Whether nodes are compatible' })
  compatible: boolean;

  @ApiProperty({ 
    description: 'Compatibility level',
    enum: ['full', 'partial', 'conditional', 'none'],
  })
  compatibility: 'full' | 'partial' | 'conditional' | 'none';

  @ApiProperty({ description: 'Compatibility issues' })
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
  }>;

  @ApiProperty({ description: 'Required transformations' })
  requiredTransformations: Array<{
    from: string;
    to: string;
    transformation: string;
  }>;
}

export class CompatibilityCheckRequestDto {
  @ApiProperty({ description: 'Source node information' })
  sourceNode: {
    type: string;
    version: string;
  };

  @ApiProperty({ description: 'Target node information' })
  targetNode: {
    type: string;
    version: string;
  };

  @ApiProperty({ description: 'Connection information' })
  connection: {
    outputPin: string;
    inputPin: string;
  };
}