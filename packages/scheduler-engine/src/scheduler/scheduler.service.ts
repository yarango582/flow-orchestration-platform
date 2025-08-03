import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as cron from 'node-cron';
import { ScheduleRepository } from './schedule.repository';
import { ExecutionRepository } from './execution.repository';
import { FlowsService } from '../flows/flows.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
  ScheduleDto,
  PaginatedSchedulesDto,
  ExecutionDto,
  ExecutionDetailDto,
  NodeExecutionDto,
  PaginatedExecutionsDto,
  BulkOperationResultDto,
  JobStatsDto,
} from './dto';
import { Schedule } from '../database/entities/schedule.entity';
import { Execution, ExecutionStatus } from '../database/entities/execution.entity';

export interface FlowExecutionJobData {
  scheduleId: string;
  flowId: string;
  executionId: string;
  retryCount?: number;
  maxRetries?: number;
}

@Injectable()
export class SchedulerService {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly flowsService: FlowsService,
    @InjectQueue('flow-execution') private readonly flowExecutionQueue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.initializeSchedulerWatcher();
  }

  async createSchedule(createScheduleDto: CreateScheduleDto): Promise<ScheduleDto> {
    this.logger.info('Creating new schedule', {
      name: createScheduleDto.name,
      flowId: createScheduleDto.flowId,
    });

    // Verify that the flow exists
    try {
      await this.flowsService.getFlowById(createScheduleDto.flowId);
    } catch (error) {
      throw new NotFoundException(`Flow with ID '${createScheduleDto.flowId}' not found`);
    }

    // Validate cron expression
    if (!cron.validate(createScheduleDto.cronExpression)) {
      throw new BadRequestException(`Invalid cron expression: ${createScheduleDto.cronExpression}`);
    }

    // Calculate next run time
    const nextRun = this.calculateNextRun(
      createScheduleDto.cronExpression,
      createScheduleDto.timezone,
    );

    const scheduleData: Partial<Schedule> = {
      ...createScheduleDto,
      nextRun,
    };

    const schedule = await this.scheduleRepository.create(scheduleData);

    // Schedule the job if enabled
    if (schedule.enabled) {
      await this.scheduleJob(schedule);
    }

    this.logger.info('Schedule created successfully', {
      scheduleId: schedule.id,
      name: schedule.name,
      nextRun,
    });

    return this.mapScheduleToDto(schedule);
  }

  async getSchedules(query: ScheduleQueryDto): Promise<PaginatedSchedulesDto> {
    const [schedules, total] = await this.scheduleRepository.findMany(query);

    const data = schedules.map(this.mapScheduleToDto);

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

  async getScheduleById(id: string): Promise<ScheduleDto> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    return this.mapScheduleToDto(schedule);
  }

  async updateSchedule(id: string, updateScheduleDto: UpdateScheduleDto): Promise<ScheduleDto> {
    this.logger.info('Updating schedule', { scheduleId: id });

    const existingSchedule = await this.scheduleRepository.findById(id);
    if (!existingSchedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    // Validate cron expression if provided
    if (updateScheduleDto.cronExpression) {
      if (!cron.validate(updateScheduleDto.cronExpression)) {
        throw new BadRequestException(`Invalid cron expression: ${updateScheduleDto.cronExpression}`);
      }
    }

    // Calculate new next run time if cron or timezone changed
    let nextRun = existingSchedule.nextRun;
    if (updateScheduleDto.cronExpression || updateScheduleDto.timezone) {
      const cronExpression = updateScheduleDto.cronExpression || existingSchedule.cronExpression;
      const timezone = updateScheduleDto.timezone || existingSchedule.timezone;
      nextRun = this.calculateNextRun(cronExpression, timezone);
    }

    const updateData = {
      ...updateScheduleDto,
      nextRun,
    };

    const updatedSchedule = await this.scheduleRepository.update(id, updateData);

    // Re-schedule job if enabled or cron/timezone changed
    if (updatedSchedule.enabled && (updateScheduleDto.cronExpression || updateScheduleDto.timezone)) {
      await this.rescheduleJob(updatedSchedule);
    }

    this.logger.info('Schedule updated successfully', { scheduleId: id });

    return this.mapScheduleToDto(updatedSchedule);
  }

  async deleteSchedule(id: string): Promise<void> {
    this.logger.info('Deleting schedule', { scheduleId: id });

    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    // Cancel any pending jobs
    await this.cancelScheduledJobs(id);

    const deleted = await this.scheduleRepository.delete(id);
    if (!deleted) {
      throw new BadRequestException('Failed to delete schedule');
    }

    this.logger.info('Schedule deleted successfully', { scheduleId: id });
  }

  async enableSchedule(id: string): Promise<ScheduleDto> {
    return this.updateScheduleStatus(id, true);
  }

  async disableSchedule(id: string): Promise<ScheduleDto> {
    return this.updateScheduleStatus(id, false);
  }

  async bulkEnableSchedules(scheduleIds: string[]): Promise<BulkOperationResultDto> {
    return this.bulkUpdateScheduleStatus(scheduleIds, true);
  }

  async bulkDisableSchedules(scheduleIds: string[]): Promise<BulkOperationResultDto> {
    return this.bulkUpdateScheduleStatus(scheduleIds, false);
  }

  async getExecutions(options: any): Promise<PaginatedExecutionsDto> {
    const [executions, total] = await this.executionRepository.findMany(options);

    const data = executions.map(this.mapExecutionToDto);

    return {
      data,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total,
        totalPages: Math.ceil(total / (options.limit || 20)),
      },
    };
  }

  async getExecutionById(id: string): Promise<ExecutionDetailDto> {
    const execution = await this.executionRepository.findById(id);
    if (!execution) {
      throw new NotFoundException(`Execution with ID '${id}' not found`);
    }

    return this.mapExecutionToDetailDto(execution);
  }

  async retryExecution(id: string): Promise<{ executionId: string; message: string }> {
    this.logger.info('Retrying execution', { executionId: id });

    const execution = await this.executionRepository.findById(id);
    if (!execution) {
      throw new NotFoundException(`Execution with ID '${id}' not found`);
    }

    if (execution.status !== ExecutionStatus.FAILED) {
      throw new BadRequestException('Only failed executions can be retried');
    }

    // Create new execution for retry
    const newExecution = await this.executionRepository.create({
      flowId: execution.flowId,
      scheduleId: execution.scheduleId,
      status: ExecutionStatus.PENDING,
      startTime: new Date(),
      retryCount: execution.retryCount + 1,
    });

    // Queue the execution
    await this.flowExecutionQueue.add('execute-flow', {
      scheduleId: execution.scheduleId,
      flowId: execution.flowId,
      executionId: newExecution.id,
      retryCount: newExecution.retryCount,
    });

    this.logger.info('Execution retry queued', {
      originalExecutionId: id,
      newExecutionId: newExecution.id,
    });

    return {
      executionId: newExecution.id,
      message: 'Execution retry has been queued',
    };
  }

  async getJobStats(): Promise<JobStatsDto> {
    const counts = await this.flowExecutionQueue.getJobCounts();

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: (counts as any).paused || 0,
    };
  }

  // Private methods

  private async updateScheduleStatus(id: string, enabled: boolean): Promise<ScheduleDto> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    const updatedSchedule = await this.scheduleRepository.update(id, { enabled });

    if (enabled) {
      await this.scheduleJob(updatedSchedule);
    } else {
      await this.cancelScheduledJobs(id);
    }

    this.logger.info(`Schedule ${enabled ? 'enabled' : 'disabled'}`, { scheduleId: id });

    return this.mapScheduleToDto(updatedSchedule);
  }

  private async bulkUpdateScheduleStatus(
    scheduleIds: string[],
    enabled: boolean,
  ): Promise<BulkOperationResultDto> {
    const errors: Array<{ scheduleId: string; error: string }> = [];
    let successCount = 0;

    for (const scheduleId of scheduleIds) {
      try {
        await this.updateScheduleStatus(scheduleId, enabled);
        successCount++;
      } catch (error) {
        errors.push({
          scheduleId,
          error: error.message,
        });
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors,
    };
  }

  private calculateNextRun(cronExpression: string, timezone: string = 'UTC'): Date {
    // This is a simplified implementation
    // In production, use a proper cron library like node-cron or cron-parser
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Add 1 minute as fallback
    return nextRun;
  }

  private async scheduleJob(schedule: Schedule): Promise<void> {
    // Add job to queue with delay based on nextRun
    const delay = schedule.nextRun ? schedule.nextRun.getTime() - Date.now() : 0;

    if (delay > 0) {
      await this.flowExecutionQueue.add(
        'execute-flow',
        {
          scheduleId: schedule.id,
          flowId: schedule.flowId,
        },
        {
          delay,
          attempts: schedule.maxRetries + 1,
          backoff: {
            type: 'exponential',
            delay: schedule.retryDelay * 1000,
          },
        },
      );
    }
  }

  private async rescheduleJob(schedule: Schedule): Promise<void> {
    await this.cancelScheduledJobs(schedule.id);
    if (schedule.enabled) {
      await this.scheduleJob(schedule);
    }
  }

  private async cancelScheduledJobs(scheduleId: string): Promise<void> {
    const jobs = await this.flowExecutionQueue.getJobs(['delayed', 'waiting']);
    const jobsToCancel = jobs.filter(
      (job) => job.data.scheduleId === scheduleId,
    );

    for (const job of jobsToCancel) {
      await job.remove();
    }
  }

  private initializeSchedulerWatcher(): void {
    // Set up a periodic check for schedules that need to be executed
    setInterval(async () => {
      try {
        const dueSchedules = await this.scheduleRepository.findSchedulesDueForExecution();
        
        for (const schedule of dueSchedules) {
          await this.executeSchedule(schedule);
        }
      } catch (error) {
        this.logger.error('Error in scheduler watcher', error);
      }
    }, 60000); // Check every minute
  }

  private async executeSchedule(schedule: Schedule): Promise<void> {
    this.logger.info('Executing scheduled flow', {
      scheduleId: schedule.id,
      flowId: schedule.flowId,
    });

    // Create execution record
    const execution = await this.executionRepository.create({
      flowId: schedule.flowId,
      scheduleId: schedule.id,
      status: ExecutionStatus.PENDING,
      startTime: new Date(),
    });

    // Queue the execution
    await this.flowExecutionQueue.add('execute-flow', {
      scheduleId: schedule.id,
      flowId: schedule.flowId,
      executionId: execution.id,
    });

    // Update schedule's last run and next run
    const nextRun = this.calculateNextRun(schedule.cronExpression, schedule.timezone);
    await this.scheduleRepository.updateLastRun(schedule.id, new Date(), nextRun);
  }

  private mapScheduleToDto(schedule: Schedule): ScheduleDto {
    return {
      id: schedule.id,
      flowId: schedule.flowId,
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      enabled: schedule.enabled,
      maxRetries: schedule.maxRetries,
      retryDelay: schedule.retryDelay,
      lastRun: schedule.lastRun,
      nextRun: schedule.nextRun,
      metadata: schedule.metadata,
      createdBy: schedule.createdBy,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  private mapExecutionToDto(execution: Execution): ExecutionDto {
    return {
      id: execution.id,
      flowId: execution.flowId,
      scheduleId: execution.scheduleId,
      status: execution.status,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.duration,
      recordsProcessed: execution.recordsProcessed,
      errorMessage: execution.errorMessage,
      retryCount: execution.retryCount,
    };
  }

  private mapExecutionToDetailDto(execution: Execution): ExecutionDetailDto {
    const baseDto = this.mapExecutionToDto(execution);
    
    return {
      ...baseDto,
      nodeExecutions: execution.nodeExecutions?.map(node => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        status: node.status,
        startTime: node.startTime,
        endTime: node.endTime,
        duration: node.duration,
        recordsProcessed: node.recordsProcessed,
        errorMessage: node.errorMessage,
      })) || [],
      metadata: execution.metadata,
    };
  }
}