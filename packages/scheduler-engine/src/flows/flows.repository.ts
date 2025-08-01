import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like, ILike } from 'typeorm';
import { Flow, FlowStatus } from '../database/entities/flow.entity';
import { FlowQueryDto } from './dto/flow-query.dto';

@Injectable()
export class FlowsRepository {
  constructor(
    @InjectRepository(Flow)
    private readonly flowRepository: Repository<Flow>,
  ) {}

  async create(flowData: Partial<Flow>): Promise<Flow> {
    const flow = this.flowRepository.create(flowData);
    return this.flowRepository.save(flow);
  }

  async findById(id: string): Promise<Flow | null> {
    return this.flowRepository.findOne({
      where: { id },
      relations: ['schedules', 'executions'],
    });
  }

  async findMany(query: FlowQueryDto): Promise<[Flow[], number]> {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const options: FindManyOptions<Flow> = {
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    };

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (search && search.length >= 3) {
      where.name = ILike(`%${search}%`);
    }

    if (Object.keys(where).length > 0) {
      options.where = where;
    }

    return this.flowRepository.findAndCount(options);
  }

  async update(id: string, updateData: Partial<Flow>): Promise<Flow | null> {
    await this.flowRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.flowRepository.delete(id);
    return result.affected > 0;
  }

  async findByName(name: string): Promise<Flow | null> {
    return this.flowRepository.findOne({ where: { name } });
  }

  async findActiveFlows(): Promise<Flow[]> {
    return this.flowRepository.find({
      where: { status: FlowStatus.ACTIVE },
      relations: ['schedules'],
    });
  }

  async incrementVersion(id: string): Promise<Flow | null> {
    const flow = await this.findById(id);
    if (!flow) return null;

    flow.version += 1;
    return this.flowRepository.save(flow);
  }

  async findVersionHistory(id: string): Promise<Flow[]> {
    // Note: This is a simplified version. In production, you might want
    // to store version history in a separate table
    return this.flowRepository.find({
      where: { id },
      order: { version: 'DESC' },
    });
  }

  async getFlowStatsByStatus(): Promise<Record<FlowStatus, number>> {
    const flows = await this.flowRepository
      .createQueryBuilder('flow')
      .select('flow.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('flow.status')
      .getRawMany();

    const stats: Record<FlowStatus, number> = {
      [FlowStatus.DRAFT]: 0,
      [FlowStatus.ACTIVE]: 0,
      [FlowStatus.INACTIVE]: 0,
      [FlowStatus.ARCHIVED]: 0,
    };

    flows.forEach((stat) => {
      stats[stat.status as FlowStatus] = parseInt(stat.count);
    });

    return stats;
  }
}