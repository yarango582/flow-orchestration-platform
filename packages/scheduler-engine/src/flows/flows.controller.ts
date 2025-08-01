import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FlowsService } from './flows.service';
import {
  CreateFlowDto,
  UpdateFlowDto,
  FlowQueryDto,
  FlowDto,
  PaginatedFlowsDto,
  FlowValidationDto,
  FlowVersionDto,
} from './dto';

@ApiTags('flows')
@ApiBearerAuth()
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new flow' })
  @ApiResponse({
    status: 201,
    description: 'Flow created successfully',
    type: FlowDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Flow name already exists',
  })
  async createFlow(@Body() createFlowDto: CreateFlowDto): Promise<FlowDto> {
    return this.flowsService.createFlow(createFlowDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of flows' })
  @ApiResponse({
    status: 200,
    description: 'Flows retrieved successfully',
    type: PaginatedFlowsDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'active', 'inactive', 'archived'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getFlows(@Query() query: FlowQueryDto): Promise<PaginatedFlowsDto> {
    return this.flowsService.getFlows(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flow by ID' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiResponse({
    status: 200,
    description: 'Flow retrieved successfully',
    type: FlowDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async getFlowById(@Param('id', ParseUUIDPipe) id: string): Promise<FlowDto> {
    return this.flowsService.getFlowById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update flow' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiResponse({
    status: 200,
    description: 'Flow updated successfully',
    type: FlowDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - name already exists or validation error',
  })
  async updateFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFlowDto: UpdateFlowDto,
  ): Promise<FlowDto> {
    return this.flowsService.updateFlow(id, updateFlowDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete flow' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiResponse({
    status: 204,
    description: 'Flow deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete - has active schedules',
  })
  async deleteFlow(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.flowsService.deleteFlow(id);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate flow compatibility' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiResponse({
    status: 200,
    description: 'Flow validation completed',
    type: FlowValidationDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async validateFlow(@Param('id', ParseUUIDPipe) id: string): Promise<FlowValidationDto> {
    const flow = await this.flowsService.getFlowById(id);
    return this.flowsService.validateFlow(flow);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get flow version history' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiResponse({
    status: 200,
    description: 'Version history retrieved',
    type: [FlowVersionDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async getFlowVersions(@Param('id', ParseUUIDPipe) id: string): Promise<FlowVersionDto[]> {
    return this.flowsService.getFlowVersions(id);
  }

  @Post(':id/versions/:version/rollback')
  @ApiOperation({ summary: 'Rollback to previous version' })
  @ApiParam({ name: 'id', description: 'Flow UUID' })
  @ApiParam({ name: 'version', description: 'Version number to rollback to' })
  @ApiResponse({
    status: 200,
    description: 'Rollback successful',
    type: FlowDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid version number',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async rollbackFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<FlowDto> {
    return this.flowsService.rollbackToVersion(id, version);
  }
}