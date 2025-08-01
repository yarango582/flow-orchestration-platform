import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Flow } from './flow.entity';
import { Execution } from './execution.entity';

@Entity('schedules')
@Index(['flowId'])
@Index(['enabled'])
@Index(['nextRun'])
@Index(['createdAt'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  flowId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column()
  cronExpression: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 300 })
  retryDelay: number; // seconds

  @Column({ type: 'timestamp', nullable: true })
  lastRun?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRun?: Date;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @Column('uuid', { nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Flow, (flow) => flow.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow: Flow;

  @OneToMany(() => Execution, (execution) => execution.schedule)
  executions: Execution[];
}