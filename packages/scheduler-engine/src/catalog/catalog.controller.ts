import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
  constructor(private readonly catalogService: CatalogService) {}

  @Get('nodes')
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