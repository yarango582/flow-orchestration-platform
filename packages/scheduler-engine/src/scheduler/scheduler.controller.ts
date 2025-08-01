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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
  ScheduleDto,
  PaginatedSchedulesDto,
  ExecutionDto,
  PaginatedExecutionsDto,
  BulkOperationResultDto,
  JobStatsDto,
} from './dto';

@ApiTags('scheduler')
@ApiBearerAuth()
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // Schedule Management Endpoints

  @Post('schedules')
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({
    status: 201,
    description: 'Schedule created successfully',
    type: ScheduleDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or cron expression',
  })
  @ApiResponse({
    status: 404,
    description: 'Flow not found',
  })
  async createSchedule(@Body() createScheduleDto: CreateScheduleDto): Promise<ScheduleDto> {
    return this.schedulerService.createSchedule(createScheduleDto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get list of schedules' })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    type: PaginatedSchedulesDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'flowId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean })
  @ApiQuery({ name: 'nextRunBefore', required: false, schema: { type: 'string', format: 'date-time' } })
  async getSchedules(@Query() query: ScheduleQueryDto): Promise<PaginatedSchedulesDto> {
    return this.schedulerService.getSchedules(query);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get schedule by ID' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule retrieved successfully',
    type: ScheduleDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Schedule not found',
  })
  async getScheduleById(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleDto> {
    return this.schedulerService.getScheduleById(id);
  }

  @Put('schedules/:id')
  @ApiOperation({ summary: 'Update schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule updated successfully',
    type: ScheduleDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or cron expression',
  })
  @ApiResponse({
    status: 404,
    description: 'Schedule not found',
  })
  async updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ): Promise<ScheduleDto> {
    return this.schedulerService.updateSchedule(id, updateScheduleDto);
  }

  @Delete('schedules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 204,
    description: 'Schedule deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Schedule not found',
  })
  async deleteSchedule(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.schedulerService.deleteSchedule(id);
  }

  @Post('schedules/:id/enable')
  @ApiOperation({ summary: 'Enable schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule enabled successfully',
    type: ScheduleDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Schedule not found',
  })
  async enableSchedule(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleDto> {
    return this.schedulerService.enableSchedule(id);
  }

  @Post('schedules/:id/disable')
  @ApiOperation({ summary: 'Disable schedule' })
  @ApiParam({ name: 'id', description: 'Schedule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule disabled successfully',
    type: ScheduleDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Schedule not found',
  })
  async disableSchedule(@Param('id', ParseUUIDPipe) id: string): Promise<ScheduleDto> {
    return this.schedulerService.disableSchedule(id);
  }

  @Post('schedules/bulk/enable')
  @ApiOperation({ summary: 'Enable multiple schedules' })
  @ApiResponse({
    status: 200,
    description: 'Bulk enable operation completed',
    type: BulkOperationResultDto,
  })
  async bulkEnableSchedules(
    @Body() body: { scheduleIds: string[] },
  ): Promise<BulkOperationResultDto> {
    return this.schedulerService.bulkEnableSchedules(body.scheduleIds);
  }

  @Post('schedules/bulk/disable')
  @ApiOperation({ summary: 'Disable multiple schedules' })
  @ApiResponse({
    status: 200,
    description: 'Bulk disable operation completed',
    type: BulkOperationResultDto,
  })
  async bulkDisableSchedules(
    @Body() body: { scheduleIds: string[] },
  ): Promise<BulkOperationResultDto> {
    return this.schedulerService.bulkDisableSchedules(body.scheduleIds);
  }

  // Execution Management Endpoints

  @Get('executions')
  @ApiOperation({ summary: 'Get execution history' })
  @ApiResponse({
    status: 200,
    description: 'Executions retrieved successfully',
    type: PaginatedExecutionsDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'flowId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'scheduleId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'timeout'] 
  })
  @ApiQuery({ name: 'startTimeFrom', required: false, schema: { type: 'string', format: 'date-time' } })
  @ApiQuery({ name: 'startTimeTo', required: false, schema: { type: 'string', format: 'date-time' } })
  async getExecutions(@Query() query: any): Promise<PaginatedExecutionsDto> {
    return this.schedulerService.getExecutions(query);
  }

  @Get('executions/:id')
  @ApiOperation({ summary: 'Get execution details' })
  @ApiParam({ name: 'id', description: 'Execution UUID' })
  @ApiResponse({
    status: 200,
    description: 'Execution details retrieved',
    type: ExecutionDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async getExecutionById(@Param('id', ParseUUIDPipe) id: string): Promise<ExecutionDto> {
    return this.schedulerService.getExecutionById(id);
  }

  @Get('executions/:id/logs')
  @ApiOperation({ summary: 'Get execution logs' })
  @ApiParam({ name: 'id', description: 'Execution UUID' })
  @ApiQuery({ name: 'level', required: false, enum: ['debug', 'info', 'warn', 'error'] })
  @ApiQuery({ name: 'nodeId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Execution logs retrieved',
  })
  async getExecutionLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('level') level?: string,
    @Query('nodeId') nodeId?: string,
  ): Promise<any[]> {
    // This would be implemented to return filtered logs
    // For now, return empty array
    return [];
  }

  @Post('executions/:id/retry')
  @ApiOperation({ summary: 'Retry failed execution' })
  @ApiParam({ name: 'id', description: 'Execution UUID' })
  @ApiResponse({
    status: 202,
    description: 'Retry scheduled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Execution cannot be retried',
  })
  @ApiResponse({
    status: 404,
    description: 'Execution not found',
  })
  async retryExecution(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ executionId: string; message: string }> {
    return this.schedulerService.retryExecution(id);
  }

  // Job Queue Management

  @Get('jobs/stats')
  @ApiOperation({ summary: 'Get job queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Job statistics retrieved',
    type: JobStatsDto,
  })
  async getJobStats(): Promise<JobStatsDto> {
    return this.schedulerService.getJobStats();
  }
}