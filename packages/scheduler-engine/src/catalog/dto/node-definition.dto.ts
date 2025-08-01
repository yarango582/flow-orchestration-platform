import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsOptional,
  IsObject,
  IsEnum,
  IsBoolean,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NodeCategory } from '../../database/entities/node-definition.entity';

export class ValidationRulesDto {
  @ApiProperty({ description: 'Minimum length for string values', required: false })
  @IsOptional()
  minLength?: number;

  @ApiProperty({ description: 'Maximum length for string values', required: false })
  @IsOptional()
  maxLength?: number;

  @ApiProperty({ description: 'Regular expression pattern', required: false })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiProperty({ description: 'Minimum value for numeric values', required: false })
  @IsOptional()
  minimum?: number;

  @ApiProperty({ description: 'Maximum value for numeric values', required: false })
  @IsOptional()
  maximum?: number;

  @ApiProperty({ description: 'Enumerated values', required: false })
  @IsOptional()
  @IsArray()
  enum?: any[];
}

export class NodeInputDto {
  @ApiProperty({ description: 'Input parameter name' })
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Input data type',
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date', 'binary', 'any'],
  })
  @IsEnum(['string', 'number', 'boolean', 'array', 'object', 'date', 'binary', 'any'])
  type: string;

  @ApiProperty({ description: 'Whether this input is required' })
  @IsBoolean()
  required: boolean;

  @ApiProperty({ description: 'Input description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Default value', required: false })
  @IsOptional()
  defaultValue?: any;

  @ApiProperty({ description: 'Validation rules', type: ValidationRulesDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ValidationRulesDto)
  validation?: ValidationRulesDto;
}

export class NodeOutputDto {
  @ApiProperty({ description: 'Output parameter name' })
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Output data type',
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date', 'binary', 'any'],
  })
  @IsEnum(['string', 'number', 'boolean', 'array', 'object', 'date', 'binary', 'any'])
  type: string;

  @ApiProperty({ description: 'Output description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'JSON Schema for the output', required: false })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;
}

export class CompatibilityConditionDto {
  @ApiProperty({ description: 'Field to evaluate' })
  @IsString()
  field: string;

  @ApiProperty({ 
    description: 'Comparison operator',
    enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'],
  })
  @IsEnum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains'])
  operator: string;

  @ApiProperty({ description: 'Value to compare against' })
  value: any;
}

export class CompatibilityTransformationDto {
  @ApiProperty({ description: 'Source field' })
  @IsString()
  from: string;

  @ApiProperty({ description: 'Target field' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'Transformation function' })
  @IsString()
  function: string;
}

export class CompatibilityRuleDto {
  @ApiProperty({ description: 'Target node type' })
  @IsString()
  targetType: string;

  @ApiProperty({ description: 'Output pin name' })
  @IsString()
  outputPin: string;

  @ApiProperty({ description: 'Target input pin name' })
  @IsString()
  targetInputPin: string;

  @ApiProperty({ 
    description: 'Compatibility level',
    enum: ['full', 'partial', 'conditional', 'none'],
  })
  @IsEnum(['full', 'partial', 'conditional', 'none'])
  compatibility: string;

  @ApiProperty({ 
    description: 'Conditions for compatibility', 
    type: [CompatibilityConditionDto],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompatibilityConditionDto)
  conditions?: CompatibilityConditionDto[];

  @ApiProperty({ 
    description: 'Required transformations', 
    type: [CompatibilityTransformationDto],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompatibilityTransformationDto)
  transformations?: CompatibilityTransformationDto[];
}

export class NodeConfigurationDto {
  @ApiProperty({ description: 'Execution timeout in milliseconds', required: false, default: 30000 })
  @IsOptional()
  timeout?: number;

  @ApiProperty({ description: 'Number of retries on failure', required: false, default: 0 })
  @IsOptional()
  retries?: number;

  @ApiProperty({ description: 'Concurrency level', required: false, default: 1 })
  @IsOptional()
  concurrency?: number;

  @ApiProperty({ description: 'Batch size for processing', required: false, default: 100 })
  @IsOptional()
  batchSize?: number;
}

export class CreateNodeDefinitionDto {
  @ApiProperty({ 
    description: 'Node type identifier (kebab-case)',
    pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
    example: 'postgresql-query',
  })
  @IsString()
  type: string;

  @ApiProperty({ 
    description: 'Human-readable node name',
    minLength: 1,
    maxLength: 100,
    example: 'PostgreSQL Query',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    description: 'Node description',
    maxLength: 500,
    required: false,
    example: 'Executes SQL queries against PostgreSQL database',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ 
    description: 'Node version (semantic versioning)',
    pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$',
    example: '1.0.0',
  })
  @IsString()
  version: string;

  @ApiProperty({ 
    description: 'Node category',
    enum: NodeCategory,
  })
  @IsEnum(NodeCategory)
  category: NodeCategory;

  @ApiProperty({ description: 'Icon URL', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ 
    description: 'Input parameters',
    type: [NodeInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeInputDto)
  inputs: NodeInputDto[];

  @ApiProperty({ 
    description: 'Output parameters',
    type: [NodeOutputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeOutputDto)
  outputs: NodeOutputDto[];

  @ApiProperty({ 
    description: 'Compatibility matrix',
    type: [CompatibilityRuleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompatibilityRuleDto)
  compatibilityMatrix: CompatibilityRuleDto[];

  @ApiProperty({ 
    description: 'Node configuration',
    type: NodeConfigurationDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NodeConfigurationDto)
  configuration?: NodeConfigurationDto;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}