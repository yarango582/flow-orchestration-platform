import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FlowsRepository } from './flows.repository';
import { CreateFlowDto, UpdateFlowDto, FlowQueryDto } from './dto';
import { Flow, FlowStatus } from '../database/entities/flow.entity';
import {
  FlowDto,
  FlowSummaryDto,
  PaginatedFlowsDto,
  FlowValidationDto,
  FlowVersionDto,
  ValidationErrorDto,
  ValidationWarningDto,
} from './dto/flow-response.dto';

@Injectable()
export class FlowsService {
  constructor(
    private readonly flowsRepository: FlowsRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async createFlow(createFlowDto: CreateFlowDto): Promise<FlowDto> {
    this.logger.info('Creating new flow', { name: createFlowDto.name });

    // Check if flow name already exists
    const existingFlow = await this.flowsRepository.findByName(createFlowDto.name);
    if (existingFlow) {
      throw new ConflictException(`Flow with name '${createFlowDto.name}' already exists`);
    }

    // Validate flow structure
    const validation = await this.validateFlow(createFlowDto);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Flow validation failed',
        errors: validation.errors,
      });
    }

    const flowData: Partial<Flow> = {
      ...createFlowDto,
      status: FlowStatus.DRAFT,
      version: 1,
    };

    const flow = await this.flowsRepository.create(flowData);
    
    this.logger.info('Flow created successfully', { 
      flowId: flow.id, 
      name: flow.name 
    });

    return this.mapFlowToDto(flow);
  }

  async getFlows(query: FlowQueryDto): Promise<PaginatedFlowsDto> {
    const [flows, total] = await this.flowsRepository.findMany(query);
    
    const data = flows.map(this.mapFlowToSummaryDto);
    
    return {
      data,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async getFlowById(id: string): Promise<FlowDto> {
    const flow = await this.flowsRepository.findById(id);
    if (!flow) {
      throw new NotFoundException(`Flow with ID '${id}' not found`);
    }
    
    return this.mapFlowToDto(flow);
  }

  async updateFlow(id: string, updateFlowDto: UpdateFlowDto): Promise<FlowDto> {
    this.logger.info('Updating flow', { flowId: id });

    const existingFlow = await this.flowsRepository.findById(id);
    if (!existingFlow) {
      throw new NotFoundException(`Flow with ID '${id}' not found`);
    }

    // Check name uniqueness if name is being updated
    if (updateFlowDto.name && updateFlowDto.name !== existingFlow.name) {
      const nameExists = await this.flowsRepository.findByName(updateFlowDto.name);
      if (nameExists) {
        throw new ConflictException(`Flow with name '${updateFlowDto.name}' already exists`);
      }
    }

    // Validate flow if nodes or connections are being updated
    if (updateFlowDto.nodes || updateFlowDto.connections) {
      const flowToValidate = {
        ...existingFlow,
        ...updateFlowDto,
      };
      
      const validation = await this.validateFlow(flowToValidate);
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Flow validation failed',
          errors: validation.errors,
        });
      }
    }

    const updatedFlow = await this.flowsRepository.update(id, updateFlowDto);
    
    this.logger.info('Flow updated successfully', { flowId: id });
    
    return this.mapFlowToDto(updatedFlow);
  }

  async deleteFlow(id: string): Promise<void> {
    this.logger.info('Deleting flow', { flowId: id });

    const flow = await this.flowsRepository.findById(id);
    if (!flow) {
      throw new NotFoundException(`Flow with ID '${id}' not found`);
    }

    // Check if flow has active schedules
    if (flow.schedules && flow.schedules.some(s => s.enabled)) {
      throw new ConflictException('Cannot delete flow with active schedules');
    }

    const deleted = await this.flowsRepository.delete(id);
    if (!deleted) {
      throw new BadRequestException('Failed to delete flow');
    }

    this.logger.info('Flow deleted successfully', { flowId: id });
  }

  async validateFlow(flowData: Partial<Flow>): Promise<FlowValidationDto> {
    const errors: ValidationErrorDto[] = [];
    const warnings: ValidationWarningDto[] = [];

    // Basic validation
    if (!flowData.nodes || flowData.nodes.length === 0) {
      errors.push({
        code: 'NO_NODES',
        message: 'Flow must contain at least one node',
      });
    }

    // Validate node connections
    if (flowData.connections) {
      for (const connection of flowData.connections) {
        const fromNode = flowData.nodes?.find(n => n.id === connection.fromNodeId);
        const toNode = flowData.nodes?.find(n => n.id === connection.toNodeId);

        if (!fromNode) {
          errors.push({
            code: 'INVALID_CONNECTION',
            message: `Source node '${connection.fromNodeId}' not found`,
            nodeId: connection.fromNodeId,
          });
        }

        if (!toNode) {
          errors.push({
            code: 'INVALID_CONNECTION',
            message: `Target node '${connection.toNodeId}' not found`,
            nodeId: connection.toNodeId,
          });
        }
      }
    }

    // Check for orphaned nodes
    if (flowData.nodes && flowData.connections) {
      const connectedNodes = new Set<string>();
      flowData.connections.forEach(conn => {
        connectedNodes.add(conn.fromNodeId);
        connectedNodes.add(conn.toNodeId);
      });

      const orphanedNodes = flowData.nodes.filter(node => !connectedNodes.has(node.id));
      orphanedNodes.forEach(node => {
        warnings.push({
          code: 'ORPHANED_NODE',
          message: `Node '${node.id}' is not connected to any other nodes`,
          nodeId: node.id,
        });
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getFlowVersions(id: string): Promise<FlowVersionDto[]> {
    const flow = await this.flowsRepository.findById(id);
    if (!flow) {
      throw new NotFoundException(`Flow with ID '${id}' not found`);
    }

    const versions = await this.flowsRepository.findVersionHistory(id);
    
    return versions.map(version => ({
      version: version.version,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      nodeCount: version.nodes?.length || 0,
      changes: `Version ${version.version}`, // In production, track actual changes
    }));
  }

  async rollbackToVersion(id: string, version: number): Promise<FlowDto> {
    this.logger.info('Rolling back flow to version', { flowId: id, version });

    const flow = await this.flowsRepository.findById(id);
    if (!flow) {
      throw new NotFoundException(`Flow with ID '${id}' not found`);
    }

    if (version >= flow.version) {
      throw new BadRequestException('Cannot rollback to current or future version');
    }

    // In a real implementation, you would retrieve the specific version
    // For now, we'll just increment the version
    const updatedFlow = await this.flowsRepository.incrementVersion(id);
    
    this.logger.info('Flow rolled back successfully', { flowId: id, version });
    
    return this.mapFlowToDto(updatedFlow);
  }

  private mapFlowToDto(flow: Flow): FlowDto {
    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      nodes: flow.nodes,
      connections: flow.connections,
      version: flow.version,
      status: flow.status,
      metadata: flow.metadata,
      createdBy: flow.createdBy,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    };
  }

  private mapFlowToSummaryDto(flow: Flow): FlowSummaryDto {
    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      version: flow.version,
      status: flow.status,
      nodeCount: flow.nodes?.length || 0,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    };
  }
}