import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Flow } from './flow.entity';
import { Schedule } from './schedule.entity';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface NodeExecution {
  nodeId: string;
  nodeType: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordsProcessed?: number;
  errorMessage?: string;
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  nodeId?: string;
  metadata?: Record<string, any>;
}

@Entity('executions')
@Index(['flowId'])
@Index(['scheduleId'])
@Index(['status'])
@Index(['startTime'])
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  flowId: string;

  @Column('uuid', { nullable: true })
  scheduleId?: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime?: Date;

  @Column({ nullable: true })
  duration?: number; // milliseconds

  @Column({ default: 0 })
  recordsProcessed: number;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column('jsonb', { nullable: true })
  nodeExecutions?: NodeExecution[];

  @Column('jsonb', { nullable: true })
  logs?: ExecutionLog[];

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Flow, (flow) => flow.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow: Flow;

  @ManyToOne(() => Schedule, (schedule) => schedule.executions, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'scheduleId' })
  schedule?: Schedule;
}