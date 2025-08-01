import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { Execution, ExecutionStatus } from '../database/entities/execution.entity';

export interface ExecutionQueryOptions {
  page?: number;
  limit?: number;
  flowId?: string;
  scheduleId?: string;
  status?: ExecutionStatus;
  startTimeFrom?: Date;
  startTimeTo?: Date;
}

@Injectable()
export class ExecutionRepository {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async create(executionData: Partial<Execution>): Promise<Execution> {
    const execution = this.executionRepository.create(executionData);
    return this.executionRepository.save(execution);
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executionRepository.findOne({
      where: { id },
      relations: ['flow', 'schedule'],
    });
  }

  async findMany(options: ExecutionQueryOptions): Promise<[Execution[], number]> {
    const {
      page = 1,
      limit = 20,
      flowId,
      scheduleId,
      status,
      startTimeFrom,
      startTimeTo,
    } = options;
    
    const skip = (page - 1) * limit;

    const queryOptions: FindManyOptions<Execution> = {
      skip,
      take: limit,
      order: { startTime: 'DESC' },
      relations: ['flow', 'schedule'],
    };

    const where: any = {};

    if (flowId) {
      where.flowId = flowId;
    }

    if (scheduleId) {
      where.scheduleId = scheduleId;
    }

    if (status) {
      where.status = status;
    }

    if (startTimeFrom && startTimeTo) {
      where.startTime = Between(startTimeFrom, startTimeTo);
    } else if (startTimeFrom) {
      where.startTime = Between(startTimeFrom, new Date());
    }

    if (Object.keys(where).length > 0) {
      queryOptions.where = where;
    }

    return this.executionRepository.findAndCount(queryOptions);
  }

  async update(id: string, updateData: Partial<Execution>): Promise<Execution | null> {
    await this.executionRepository.update(id, updateData);
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: ExecutionStatus,
    endTime?: Date,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<Execution> = { status };
    
    if (endTime) {
      updateData.endTime = endTime;
      
      // Calculate duration if we have start time
      const execution = await this.findById(id);
      if (execution && execution.startTime) {
        updateData.duration = endTime.getTime() - execution.startTime.getTime();
      }
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.executionRepository.update(id, updateData);
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.executionRepository
      .createQueryBuilder()
      .update(Execution)
      .set({ retryCount: () => 'retry_count + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async findRunningExecutions(): Promise<Execution[]> {
    return this.executionRepository.find({
      where: { status: ExecutionStatus.RUNNING },
      relations: ['flow', 'schedule'],
    });
  }

  async findFailedExecutions(limit: number = 50): Promise<Execution[]> {
    return this.executionRepository.find({
      where: { status: ExecutionStatus.FAILED },
      order: { startTime: 'DESC' },
      take: limit,
      relations: ['flow', 'schedule'],
    });
  }

  async getExecutionStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    success: number;
    failed: number;
    cancelled: number;
    timeout: number;
  }> {
    const stats = await this.executionRepository
      .createQueryBuilder('execution')
      .select('execution.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('execution.status')
      .getRawMany();

    const result = {
      total: 0,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      cancelled: 0,
      timeout: 0,
    };

    stats.forEach((stat) => {
      const count = parseInt(stat.count);
      result.total += count;
      result[stat.status as keyof typeof result] = count;
    });

    return result;
  }

  async getRecentExecutions(flowId?: string, limit: number = 10): Promise<Execution[]> {
    const where: any = {};
    if (flowId) {
      where.flowId = flowId;
    }

    return this.executionRepository.find({
      where,
      order: { startTime: 'DESC' },
      take: limit,
      relations: ['flow', 'schedule'],
    });
  }

  async getExecutionMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    executionsByDay: Array<{ date: string; count: number }>;
  }> {
    const executions = await this.executionRepository.find({
      where: {
        startTime: Between(startDate, endDate),
      },
    });

    const total = executions.length;
    const successful = executions.filter(e => e.status === ExecutionStatus.SUCCESS).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const completedExecutions = executions.filter(e => e.duration);
    const averageDuration = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
      : 0;

    // Group by day
    const executionsByDay = executions.reduce((acc, execution) => {
      const date = execution.startTime.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions: total,
      successRate,
      averageDuration,
      executionsByDay: Object.entries(executionsByDay).map(([date, count]) => ({
        date,
        count,
      })),
    };
  }
}