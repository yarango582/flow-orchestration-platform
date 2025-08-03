import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import {
  CreateNodeDefinitionDto,
  NodeDefinitionDto,
  NodeVersionDto,
  NodeCategoryDto,
  CompatibilityCheckDto,
  CompatibilityCheckRequestDto,
} from './dto';
import { NodeCategory } from '../database/entities/node-definition.entity';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);
  
  constructor(private readonly catalogService: CatalogService) {}

    @Get('metadata')
  @ApiOperation({ 
    summary: 'Get dynamic node metadata from node-core library',
    description: 'Returns live metadata directly from the node-core library, ensuring no duplication'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dynamic node metadata retrieved successfully',
    type: [NodeDefinitionDto]
  })
  async getDynamicNodeMetadata(): Promise<NodeDefinitionDto[]> {
    this.logger.log('Getting dynamic node metadata from node-core library');
    
    // Get the NodeRegistry instance
    const nodeRegistry = this.catalogService.getNodeRegistry();
    const allMetadata = nodeRegistry.getAllNodesMetadata();
    
    const dynamicNodes: NodeDefinitionDto[] = [];
    
    for (const [type, metadata] of allMetadata) {
      const nodeDto: NodeDefinitionDto = {
        id: `dynamic-${type}`,
        type: metadata.type,
        name: metadata.name,
        description: metadata.description,
        version: metadata.version,
        category: metadata.category as any,
        icon: metadata.icon,
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
        compatibilityMatrix: metadata.compatibilityMatrix?.map(rule => ({
          targetType: rule.targetType,
          outputPin: rule.outputPin,
          targetInputPin: rule.targetInputPin,
          compatibility: rule.compatibility,
          conditions: rule.conditions,
          transformations: rule.transformations
        })) || [],
        configuration: metadata.configuration,
        metadata: {
          tags: metadata.tags,
          relatedNodes: metadata.relatedNodes,
          dynamicSource: true // Mark as coming from dynamic source
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      dynamicNodes.push(nodeDto);
    }
    
    this.logger.log(`Retrieved ${dynamicNodes.length} dynamic node definitions from node-core`);
    return dynamicNodes;
  }

  @Get('documentation/:nodeType')
  @ApiOperation({ 
    summary: 'Get comprehensive documentation for a specific node type',
    description: 'Returns detailed documentation including usage examples, requirements, limitations, troubleshooting guides, and best practices from the node-core library'
  })
  @ApiParam({ 
    name: 'nodeType', 
    description: 'The type identifier of the node',
    type: String 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Node documentation retrieved successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Node type not found'
  })
  async getNodeDocumentation(@Param('nodeType') nodeType: string): Promise<any> {
    this.logger.log(`Getting documentation for node type: ${nodeType}`);
    
    // Get the NodeRegistry instance from catalogService
    const nodeRegistry = this.catalogService.getNodeRegistry();
    
    // Get the specific node class
    const nodeClasses = nodeRegistry.getAllNodes();
    const nodeClass = nodeClasses.get(nodeType);
    
    if (!nodeClass) {
      this.logger.warn(`Node type '${nodeType}' not found in registry`);
      throw new Error(`Node type '${nodeType}' not found`);
    }
    
    // Get both metadata and documentation
    const metadata = nodeClass.getMetadata();
    const documentation = nodeClass.getDocumentation?.() || null;
    
    const result = {
      type: metadata.type,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      version: metadata.version,
      inputs: metadata.inputs,
      outputs: metadata.outputs,
      // Documentation specific fields
      purpose: documentation?.purpose || metadata.description,
      usageExamples: documentation?.usageExamples || [],
      requirements: documentation?.requirements || [],
      limitations: documentation?.limitations || [],
      troubleshooting: documentation?.troubleshooting || [],
      bestPractices: documentation?.bestPractices || [],
      relatedNodes: documentation?.relatedNodes || metadata.relatedNodes || [],
      tags: documentation?.tags || metadata.tags || []
    };
    
    this.logger.log(`Retrieved documentation for node type: ${nodeType}`);
    return { data: result };
  }

  @Get()
  @ApiOperation({ summary: 'Get node catalog' })
  @ApiResponse({
    status: 200,
    description: 'Node catalog retrieved successfully',
    type: [NodeDefinitionDto],
  })
  @ApiQuery({ 
    name: 'category', 
    required: false, 
    enum: NodeCategory,
    description: 'Filter by node category',
  })
  @ApiQuery({ 
    name: 'version', 
    required: false, 
    type: String,
    description: 'Filter by specific version',
  })
  @ApiQuery({ 
    name: 'search', 
    required: false, 
    type: String,
    description: 'Search in node names',
  })
  async getNodes(
    @Query('category') category?: NodeCategory,
    @Query('version') version?: string,
    @Query('search') search?: string,
  ): Promise<NodeDefinitionDto[]> {
    return this.catalogService.getNodes({ category, version, search });
  }

  @Post('nodes')
  @ApiOperation({ summary: 'Register new node type' })
  @ApiResponse({
    status: 201,
    description: 'Node registered successfully',
    type: NodeDefinitionDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid node definition',
  })
  @ApiResponse({
    status: 409,
    description: 'Node with same type and version already exists',
  })
  async registerNode(@Body() createNodeDto: CreateNodeDefinitionDto): Promise<NodeDefinitionDto> {
    return this.catalogService.registerNode(createNodeDto);
  }

  @Get('nodes/:type')
  @ApiOperation({ summary: 'Get node by type' })
  @ApiParam({ name: 'type', description: 'Node type identifier' })
  @ApiQuery({ 
    name: 'version', 
    required: false, 
    type: String,
    description: 'Specific version, defaults to latest',
  })
  @ApiResponse({
    status: 200,
    description: 'Node definition retrieved',
    type: NodeDefinitionDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  async getNodeByType(
    @Param('type') type: string,
    @Query('version') version?: string,
  ): Promise<NodeDefinitionDto> {
    return this.catalogService.getNodeByType(type, version);
  }

  @Get('nodes/:type/versions')
  @ApiOperation({ summary: 'Get node versions' })
  @ApiParam({ name: 'type', description: 'Node type identifier' })
  @ApiResponse({
    status: 200,
    description: 'Node versions retrieved',
    type: [NodeVersionDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Node type not found',
  })
  async getNodeVersions(@Param('type') type: string): Promise<NodeVersionDto[]> {
    return this.catalogService.getNodeVersions(type);
  }

  @Get('nodes/:type/compatibility')
  @ApiOperation({ summary: 'Get node compatibility matrix' })
  @ApiParam({ name: 'type', description: 'Node type identifier' })
  @ApiQuery({ 
    name: 'version', 
    required: false, 
    type: String,
    description: 'Specific version, defaults to latest',
  })
  @ApiResponse({
    status: 200,
    description: 'Compatibility matrix retrieved',
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  async getNodeCompatibility(
    @Param('type') type: string,
    @Query('version') version?: string,
  ): Promise<any[]> {
    return this.catalogService.getNodeCompatibility(type, version);
  }

  @Post('compatibility/check')
  @ApiOperation({ summary: 'Check node compatibility' })
  @ApiResponse({
    status: 200,
    description: 'Compatibility check completed',
    type: CompatibilityCheckDto,
  })
  @ApiResponse({
    status: 404,
    description: 'One or both nodes not found',
  })
  async checkCompatibility(
    @Body() request: CompatibilityCheckRequestDto,
  ): Promise<CompatibilityCheckDto> {
    return this.catalogService.checkCompatibility(request);
  }

  @Get('compatibility/matrix')
  @ApiOperation({ summary: 'Get global compatibility matrix' })
  @ApiResponse({
    status: 200,
    description: 'Global compatibility matrix retrieved',
  })
  async getCompatibilityMatrix(): Promise<Record<string, any[]>> {
    return this.catalogService.getCompatibilityMatrix();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get node categories' })
  @ApiResponse({
    status: 200,
    description: 'Node categories retrieved',
    type: [NodeCategoryDto],
  })
  async getCategories(): Promise<NodeCategoryDto[]> {
    return this.catalogService.getCategories();
  }
}