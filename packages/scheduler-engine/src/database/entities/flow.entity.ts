import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Schedule } from './schedule.entity';
import { Execution } from './execution.entity';

export enum FlowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export interface NodeInstance {
  id: string;
  type: string;
  version: string;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
  };
}

export interface NodeConnection {
  fromNodeId: string;
  fromOutput: string;
  toNodeId: string;
  toInput: string;
}

@Entity('flows')
@Index(['name'])
@Index(['status'])
@Index(['createdAt'])
export class Flow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column('jsonb')
  nodes: NodeInstance[];

  @Column('jsonb')
  connections: NodeConnection[];

  @Column({ default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: FlowStatus,
    default: FlowStatus.DRAFT,
  })
  status: FlowStatus;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @Column('uuid', { nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Schedule, (schedule) => schedule.flow)
  schedules: Schedule[];

  @OneToMany(() => Execution, (execution) => execution.flow)
  executions: Execution[];
}