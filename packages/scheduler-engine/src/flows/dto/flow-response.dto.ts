import { ApiProperty } from '@nestjs/swagger';
import { FlowStatus, NodeInstance, NodeConnection } from '../../database/entities/flow.entity';

export class FlowSummaryDto {
  @ApiProperty({ description: 'Flow unique identifier' })
  id: string;

  @ApiProperty({ description: 'Flow name' })
  name: string;

  @ApiProperty({ description: 'Flow description' })
  description?: string;

  @ApiProperty({ description: 'Flow version' })
  version: number;

  @ApiProperty({ description: 'Flow status', enum: FlowStatus })
  status: FlowStatus;

  @ApiProperty({ description: 'Number of nodes in the flow' })
  nodeCount: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class FlowDto {
  @ApiProperty({ description: 'Flow unique identifier' })
  id: string;

  @ApiProperty({ description: 'Flow name' })
  name: string;

  @ApiProperty({ description: 'Flow description' })
  description?: string;

  @ApiProperty({ description: 'Array of node instances' })
  nodes: NodeInstance[];

  @ApiProperty({ description: 'Array of node connections' })
  connections: NodeConnection[];

  @ApiProperty({ description: 'Flow version' })
  version: number;

  @ApiProperty({ description: 'Flow status', enum: FlowStatus })
  status: FlowStatus;

  @ApiProperty({ description: 'Flow variables' })
  variables?: Array<{
    name: string;
    type: string;
    value: any;
  }>;

  @ApiProperty({ description: 'Flow secrets' })
  secrets?: Array<{
    name: string;
    value: any;
  }>;

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creator user ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

export class PaginatedFlowsDto {
  @ApiProperty({ description: 'Array of flows', type: [FlowSummaryDto] })
  data: FlowSummaryDto[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

export class ValidationErrorDto {
  @ApiProperty({ description: 'Error code' })
  code: string;

  @ApiProperty({ description: 'Error message' })
  message: string;

  @ApiProperty({ description: 'Node ID where error occurred' })
  nodeId?: string;

  @ApiProperty({ description: 'Field that caused the error' })
  field?: string;
}

export class ValidationWarningDto {
  @ApiProperty({ description: 'Warning code' })
  code: string;

  @ApiProperty({ description: 'Warning message' })
  message: string;

  @ApiProperty({ description: 'Node ID related to warning' })
  nodeId?: string;
}

export class FlowValidationDto {
  @ApiProperty({ description: 'Whether the flow is valid' })
  valid: boolean;

  @ApiProperty({ description: 'Array of validation errors', type: [ValidationErrorDto] })
  errors: ValidationErrorDto[];

  @ApiProperty({ description: 'Array of validation warnings', type: [ValidationWarningDto] })
  warnings: ValidationWarningDto[];
}

export class FlowVersionDto {
  @ApiProperty({ description: 'Version number' })
  version: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Creator user ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Change description' })
  changes?: string;

  @ApiProperty({ description: 'Number of nodes' })
  nodeCount: number;
}