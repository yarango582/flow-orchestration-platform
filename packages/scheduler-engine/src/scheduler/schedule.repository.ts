import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, LessThan } from 'typeorm';
import { Schedule } from '../database/entities/schedule.entity';
import { ScheduleQueryDto } from './dto/schedule-query.dto';

@Injectable()
export class ScheduleRepository {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
  ) {}

  async create(scheduleData: Partial<Schedule>): Promise<Schedule> {
    const schedule = this.scheduleRepository.create(scheduleData);
    return this.scheduleRepository.save(schedule);
  }

  async findById(id: string): Promise<Schedule | null> {
    return this.scheduleRepository.findOne({
      where: { id },
      relations: ['flow', 'executions'],
    });
  }

  async findMany(query: ScheduleQueryDto): Promise<[Schedule[], number]> {
    const { page = 1, limit = 20, flowId, enabled, nextRunBefore } = query;
    const skip = (page - 1) * limit;

    const options: FindManyOptions<Schedule> = {
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['flow'],
    };

    const where: any = {};

    if (flowId) {
      where.flowId = flowId;
    }

    if (typeof enabled === 'boolean') {
      where.enabled = enabled;
    }

    if (nextRunBefore) {
      where.nextRun = LessThan(new Date(nextRunBefore));
    }

    if (Object.keys(where).length > 0) {
      options.where = where;
    }

    return this.scheduleRepository.findAndCount(options);
  }

  async update(id: string, updateData: Partial<Schedule>): Promise<Schedule | null> {
    await this.scheduleRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.scheduleRepository.delete(id);
    return result.affected > 0;
  }

  async findByFlowId(flowId: string): Promise<Schedule[]> {
    return this.scheduleRepository.find({
      where: { flowId },
      relations: ['flow'],
    });
  }

  async findEnabledSchedules(): Promise<Schedule[]> {
    return this.scheduleRepository.find({
      where: { enabled: true },
      relations: ['flow'],
    });
  }

  async findSchedulesDueForExecution(before: Date = new Date()): Promise<Schedule[]> {
    return this.scheduleRepository.find({
      where: {
        enabled: true,
        nextRun: LessThan(before),
      },
      relations: ['flow'],
    });
  }

  async updateLastRun(id: string, lastRun: Date, nextRun?: Date): Promise<void> {
    const updateData: Partial<Schedule> = { lastRun };
    if (nextRun) {
      updateData.nextRun = nextRun;
    }
    await this.scheduleRepository.update(id, updateData);
  }

  async bulkUpdateEnabled(scheduleIds: string[], enabled: boolean): Promise<number> {
    const result = await this.scheduleRepository
      .createQueryBuilder()
      .update(Schedule)
      .set({ enabled })
      .whereInIds(scheduleIds)
      .execute();

    return result.affected || 0;
  }

  async getScheduleStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    dueNow: number;
  }> {
    const [total, enabled, dueNow] = await Promise.all([
      this.scheduleRepository.count(),
      this.scheduleRepository.count({ where: { enabled: true } }),
      this.scheduleRepository.count({
        where: {
          enabled: true,
          nextRun: LessThan(new Date()),
        },
      }),
    ]);

    return {
      total,
      enabled,
      disabled: total - enabled,
      dueNow,
    };
  }
}