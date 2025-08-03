import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CatalogRepository } from './catalog.repository';
import {
  CreateNodeDefinitionDto,
  NodeDefinitionDto,
  NodeVersionDto,
  NodeCategoryDto,
  CompatibilityCheckDto,
  CompatibilityCheckRequestDto,
} from './dto';
import { NodeDefinition, NodeCategory } from '../database/entities/node-definition.entity';

// Import from node-core library
import { 
  NodeRegistry, 
  INode, 
  CompatibilityValidator,
  PostgreSQLQueryNode,
  DataFilterNode,
  FieldMapperNode,
  MongoDBOperationsNode
} from '@flow-platform/node-core';

@Injectable()
export class CatalogService implements OnModuleInit {
  private nodeRegistry: NodeRegistry;
  private compatibilityValidator: CompatibilityValidator;

  constructor(
    private readonly catalogRepository: CatalogRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.nodeRegistry = new NodeRegistry();
    this.compatibilityValidator = new CompatibilityValidator();
    this.initializeNodeRegistry();
  }

  private initializeNodeRegistry(): void {
    // Register all available node types from node-core
    this.nodeRegistry.register(PostgreSQLQueryNode, 'postgresql-query');
    this.nodeRegistry.register(DataFilterNode, 'data-filter');
    this.nodeRegistry.register(FieldMapperNode, 'field-mapper');
    this.nodeRegistry.register(MongoDBOperationsNode, 'mongodb-operations');
    
    this.logger.info('Node registry initialized with available node types', {
      availableTypes: this.nodeRegistry.getAvailableTypes()
    });
  }

  // Getter to expose nodeRegistry for dependency injection
  getNodeRegistry(): NodeRegistry {
    return this.nodeRegistry;
  }

  async onModuleInit() {
    // Initialize node registry and load available nodes from node-core
    await this.syncNodesFromRegistry();
    
    // Force resync for existing nodes with incorrect metadata
    await this.forceResyncNodes();
  }

  private async forceResyncNodes(): Promise<void> {
    this.logger.info('Force resyncing nodes with updated metadata');
    
    try {
      // Delete and recreate postgresql-query node
      const existingPgNode = await this.catalogRepository.findByType('postgresql-query');
      if (existingPgNode) {
        // Delete existing node
        await this.catalogRepository.delete(existingPgNode.id);
        this.logger.info('Deleted existing postgresql-query node for resync');
      }
      
      // Recreate with correct metadata
      const pgNodeClass = this.nodeRegistry.getAllNodes().get('postgresql-query');
      if (pgNodeClass) {
        const nodeInstance = new pgNodeClass();
        const metadata = this.extractNodeMetadata(nodeInstance);
        
        await this.catalogRepository.create({
          type: metadata.type,
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          category: metadata.category,
          inputs: metadata.inputs,
          outputs: metadata.outputs,
          compatibilityMatrix: metadata.compatibilityMatrix,
          configuration: metadata.configuration,
          metadata: metadata.additionalMetadata,
        });
        
        this.logger.info('Force resynced postgresql-query node with correct metadata');
      }
    } catch (error) {
      this.logger.error('Failed to force resync nodes', error);
    }
  }

  async getNodes(options: {
    category?: NodeCategory;
    version?: string;
    search?: string;
  } = {}): Promise<NodeDefinitionDto[]> {
    const nodes = await this.catalogRepository.findAll(options);
    return nodes.map(this.mapNodeToDto);
  }

  async registerNode(createNodeDto: CreateNodeDefinitionDto): Promise<NodeDefinitionDto> {
    this.logger.info('Registering new node', {
      type: createNodeDto.type,
      version: createNodeDto.version,
    });

    // Check if node with same type and version already exists
    const existingNode = await this.catalogRepository.findByTypeAndVersion(
      createNodeDto.type,
      createNodeDto.version,
    );

    if (existingNode) {
      throw new ConflictException(
        `Node with type '${createNodeDto.type}' and version '${createNodeDto.version}' already exists`,
      );
    }

    // Validate the node definition
    this.validateNodeDefinition(createNodeDto);

    const nodeData: Partial<NodeDefinition> = {
      ...createNodeDto,
      inputs: createNodeDto.inputs as any, // Type assertion for compatibility
      outputs: createNodeDto.outputs as any,
      compatibilityMatrix: createNodeDto.compatibilityMatrix as any,
    };

    const node = await this.catalogRepository.create(nodeData);

    this.logger.info('Node registered successfully', {
      nodeId: node.id,
      type: node.type,
      version: node.version,
    });

    return this.mapNodeToDto(node);
  }

  async getNodeByType(type: string, version?: string): Promise<NodeDefinitionDto> {
    const node = await this.catalogRepository.findByType(type, version);
    
    if (!node) {
      throw new NotFoundException(
        `Node with type '${type}' ${version ? `and version '${version}'` : ''} not found`,
      );
    }

    return this.mapNodeToDto(node);
  }

  async getNodeVersions(type: string): Promise<NodeVersionDto[]> {
    const nodes = await this.catalogRepository.findVersionsByType(type);
    
    if (nodes.length === 0) {
      throw new NotFoundException(`No nodes found with type '${type}'`);
    }

    return nodes.map(node => ({
      version: node.version,
      releaseDate: node.createdAt,
      changelog: `Version ${node.version}`, // In production, maintain proper changelog
      deprecated: false, // Would be tracked in metadata
      breaking: false, // Would be tracked in metadata
    }));
  }

  async getNodeCompatibility(type: string, version?: string): Promise<any[]> {
    const node = await this.catalogRepository.findByType(type, version);
    
    if (!node) {
      throw new NotFoundException(
        `Node with type '${type}' ${version ? `and version '${version}'` : ''} not found`,
      );
    }

    return node.compatibilityMatrix;
  }

  async checkCompatibility(request: CompatibilityCheckRequestDto): Promise<CompatibilityCheckDto> {
    this.logger.info('Checking node compatibility', {
      sourceType: request.sourceNode.type,
      targetType: request.targetNode.type,
      connection: request.connection,
    });

    const [sourceNode, targetNode] = await Promise.all([
      this.catalogRepository.findByTypeAndVersion(
        request.sourceNode.type,
        request.sourceNode.version,
      ),
      this.catalogRepository.findByTypeAndVersion(
        request.targetNode.type,
        request.targetNode.version,
      ),
    ]);

    if (!sourceNode) {
      throw new NotFoundException(
        `Source node '${request.sourceNode.type}' version '${request.sourceNode.version}' not found`,
      );
    }

    if (!targetNode) {
      throw new NotFoundException(
        `Target node '${request.targetNode.type}' version '${request.targetNode.version}' not found`,
      );
    }

    // Find compatibility rule
    const compatibilityRule = sourceNode.compatibilityMatrix.find(
      rule =>
        rule.targetType === targetNode.type &&
        rule.outputPin === request.connection.outputPin &&
        rule.targetInputPin === request.connection.inputPin,
    );

    if (!compatibilityRule) {
      return {
        compatible: false,
        compatibility: 'none',
        issues: [
          {
            type: 'error',
            message: `No compatibility rule found for connection from ${sourceNode.type}.${request.connection.outputPin} to ${targetNode.type}.${request.connection.inputPin}`,
          },
        ],
        requiredTransformations: [],
      };
    }

    // Validate output exists in source node
    const sourceOutput = sourceNode.outputs.find(
      output => output.name === request.connection.outputPin,
    );
    if (!sourceOutput) {
      return {
        compatible: false,
        compatibility: 'none',
        issues: [
          {
            type: 'error',
            message: `Output pin '${request.connection.outputPin}' not found in source node`,
            field: 'outputPin',
          },
        ],
        requiredTransformations: [],
      };
    }

    // Validate input exists in target node
    const targetInput = targetNode.inputs.find(
      input => input.name === request.connection.inputPin,
    );
    if (!targetInput) {
      return {
        compatible: false,
        compatibility: 'none',
        issues: [
          {
            type: 'error',
            message: `Input pin '${request.connection.inputPin}' not found in target node`,
            field: 'inputPin',
          },
        ],
        requiredTransformations: [],
      };
    }

    // Check type compatibility
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      field?: string;
    }> = [];

    if (sourceOutput.type !== targetInput.type && 
        sourceOutput.type !== 'any' && 
        targetInput.type !== 'any') {
      issues.push({
        type: 'warning',
        message: `Type mismatch: source outputs '${sourceOutput.type}' but target expects '${targetInput.type}'`,
      });
    }

    const result: CompatibilityCheckDto = {
      compatible: compatibilityRule.compatibility !== 'none',
      compatibility: compatibilityRule.compatibility as any,
      issues,
      requiredTransformations: (compatibilityRule.transformations || []).map(t => ({
        from: t.from,
        to: t.to,
        transformation: t.function
      })),
    };

    this.logger.info('Compatibility check completed', {
      compatible: result.compatible,
      compatibility: result.compatibility,
      issuesCount: result.issues.length,
    });

    return result;
  }

  async getCompatibilityMatrix(): Promise<Record<string, any[]>> {
    const nodes = await this.catalogRepository.findAll();
    const matrix: Record<string, any[]> = {};

    for (const node of nodes) {
      matrix[node.type] = node.compatibilityMatrix;
    }

    return matrix;
  }

  async getCategories(): Promise<NodeCategoryDto[]> {
    const categories = await this.catalogRepository.getCategories();
    
    const categoryInfo: Record<string, { description: string; icon?: string }> = {
      [NodeCategory.DATABASE]: {
        description: 'Database operations and connections',
        icon: 'database',
      },
      [NodeCategory.TRANSFORMATION]: {
        description: 'Data transformation and processing',
        icon: 'transform',
      },
      [NodeCategory.EXTERNAL_API]: {
        description: 'External API integrations',
        icon: 'api',
      },
      [NodeCategory.NOTIFICATION]: {
        description: 'Notification and messaging',
        icon: 'bell',
      },
      [NodeCategory.STORAGE]: {
        description: 'File and data storage',
        icon: 'storage',
      },
      [NodeCategory.LOGIC]: {
        description: 'Business logic and control flow',
        icon: 'logic',
      },
      [NodeCategory.AI_ML]: {
        description: 'AI and Machine Learning operations',
        icon: 'brain',
      },
    };

    return categories.map(cat => ({
      name: cat.name,
      description: categoryInfo[cat.name]?.description || 'Node category',
      icon: categoryInfo[cat.name]?.icon,
      nodeCount: cat.count,
    }));
  }

  // Private methods

  private async syncNodesFromRegistry(): Promise<void> {
    this.logger.info('Syncing nodes from node-core registry');

    try {
      // Get available nodes from node-core registry
      const availableNodes = this.nodeRegistry.getAllNodes();

      for (const [nodeType, nodeClass] of availableNodes.entries()) {
        try {
          // Create an instance to get metadata
          const nodeInstance = new nodeClass();
          const metadata = this.extractNodeMetadata(nodeInstance);

          // Check if this node version already exists
          const exists = await this.catalogRepository.existsByTypeAndVersion(
            metadata.type,
            metadata.version,
          );

          if (!exists) {
            await this.catalogRepository.create({
              type: metadata.type,
              name: metadata.name,
              description: metadata.description,
              version: metadata.version,
              category: metadata.category,
              inputs: metadata.inputs,
              outputs: metadata.outputs,
              compatibilityMatrix: metadata.compatibilityMatrix,
              configuration: metadata.configuration,
              metadata: metadata.additionalMetadata,
            });

            this.logger.info('Synced node from registry', {
              type: metadata.type,
              version: metadata.version,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to sync node from registry', {
            nodeType,
            error: error.message,
          });
        }
      }

      this.logger.info('Node sync completed');
    } catch (error) {
      this.logger.error('Failed to sync nodes from registry', error);
    }
  }

  private extractNodeMetadata(nodeInstance: INode): any {
    // Try to get metadata from static getMetadata method first
    const NodeClass = nodeInstance.constructor as any
    
    if (typeof NodeClass.getMetadata === 'function') {
      try {
        const metadata = NodeClass.getMetadata()
        return {
          type: metadata.type,
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          category: metadata.category,
          inputs: metadata.inputs.map(input => ({
            name: input.name,
            type: input.type,
            required: input.required,
            description: input.description,
            defaultValue: input.defaultValue,
            validation: input.validation
          })),
          outputs: metadata.outputs.map(output => ({
            name: output.name,
            type: output.type,
            description: output.description,
            schema: output.schema
          })),
          compatibilityMatrix: metadata.compatibilityMatrix || [],
          configuration: metadata.configuration || {},
          additionalMetadata: {
            tags: metadata.tags,
            relatedNodes: metadata.relatedNodes,
            icon: metadata.icon
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to get metadata from static method for ${nodeInstance.type}:`, error)
      }
    }
    
    // Fallback to hardcoded metadata for backward compatibility
    if (nodeInstance.type === 'postgresql-query') {
      return {
        type: 'postgresql-query',
        name: 'PostgreSQL Query',
        description: 'Execute SQL queries against PostgreSQL database',
        version: '1.0.0',
        category: NodeCategory.DATABASE,
        inputs: [
          {
            name: 'connectionString',
            type: 'string',
            required: true,
            description: 'PostgreSQL connection string'
          },
          {
            name: 'query',
            type: 'string', 
            required: true,
            description: 'SQL query to execute'
          },
          {
            name: 'parameters',
            type: 'array',
            required: false,
            description: 'Query parameters'
          }
        ],
        outputs: [
          {
            name: 'result',
            type: 'array',
            description: 'Query results'
          },
          {
            name: 'rowCount',
            type: 'number',
            description: 'Number of rows affected'
          }
        ],
        compatibilityMatrix: [],
        configuration: {},
        additionalMetadata: {},
      };
    }
    
    // For other nodes, return default metadata
    return {
      type: nodeInstance.constructor.name.toLowerCase().replace(/node$/, ''),
      name: nodeInstance.constructor.name,
      description: 'Auto-generated from node-core',
      version: '1.0.0',
      category: NodeCategory.TRANSFORMATION, // Default category
      inputs: [],
      outputs: [],
      compatibilityMatrix: [],
      configuration: {},
      additionalMetadata: {},
    };
  }

  private validateNodeDefinition(nodeDto: CreateNodeDefinitionDto): void {
    // Validate node type format
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nodeDto.type)) {
      throw new BadRequestException('Node type must be in kebab-case format');
    }

    // Validate version format
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(nodeDto.version)) {
      throw new BadRequestException('Version must follow semantic versioning (x.y.z)');
    }

    // Validate inputs and outputs have unique names
    const inputNames = nodeDto.inputs.map(input => input.name);
    const uniqueInputNames = new Set(inputNames);
    if (inputNames.length !== uniqueInputNames.size) {
      throw new BadRequestException('Input names must be unique');
    }

    const outputNames = nodeDto.outputs.map(output => output.name);
    const uniqueOutputNames = new Set(outputNames);
    if (outputNames.length !== uniqueOutputNames.size) {
      throw new BadRequestException('Output names must be unique');
    }

    // Validate compatibility matrix references valid inputs/outputs
    for (const rule of nodeDto.compatibilityMatrix) {
      const outputExists = outputNames.includes(rule.outputPin);
      if (!outputExists) {
        throw new BadRequestException(
          `Compatibility rule references non-existent output pin: ${rule.outputPin}`,
        );
      }
    }
  }

  private mapNodeToDto(node: NodeDefinition): NodeDefinitionDto {
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      description: node.description,
      version: node.version,
      category: node.category,
      icon: node.icon,
      inputs: node.inputs,
      outputs: node.outputs,
      compatibilityMatrix: node.compatibilityMatrix,
      configuration: node.configuration,
      metadata: node.metadata,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  // Method needed by other services
  async getNodeDefinitionByType(type: string): Promise<NodeDefinitionDto | null> {
    // Get the latest version of the node type
    const nodeDefinitions = await this.catalogRepository.findAll({ 
      category: undefined, 
      version: undefined, 
      search: undefined 
    });
    
    const nodeOfType = nodeDefinitions
      .filter(node => node.type === type)
      .sort((a, b) => b.version.localeCompare(a.version))[0]; // Get latest version
    
    return nodeOfType ? this.mapNodeToDto(nodeOfType) : null;
  }
}