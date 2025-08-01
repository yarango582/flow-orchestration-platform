import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum NodeCategory {
  DATABASE = 'database',
  TRANSFORMATION = 'transformation',
  EXTERNAL_API = 'external-api',
  NOTIFICATION = 'notification',
  STORAGE = 'storage',
  LOGIC = 'logic',
  AI_ML = 'ai-ml',
}

export interface NodeInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    enum?: any[];
  };
}

export interface NodeOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any';
  description?: string;
  schema?: Record<string, any>;
}

export interface CompatibilityRule {
  targetType: string;
  outputPin: string;
  targetInputPin: string;
  compatibility: 'full' | 'partial' | 'conditional' | 'none';
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }>;
  transformations?: Array<{
    from: string;
    to: string;
    function: string;
  }>;
}

export interface NodeConfiguration {
  timeout?: number;
  retries?: number;
  concurrency?: number;
  batchSize?: number;
}

@Entity('node_definitions')
@Unique(['type', 'version'])
@Index(['type'])
@Index(['category'])
@Index(['createdAt'])
export class NodeDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column()
  version: string;

  @Column({
    type: 'enum',
    enum: NodeCategory,
  })
  category: NodeCategory;

  @Column({ nullable: true })
  icon?: string;

  @Column('jsonb')
  inputs: NodeInput[];

  @Column('jsonb')
  outputs: NodeOutput[];

  @Column('jsonb')
  compatibilityMatrix: CompatibilityRule[];

  @Column('jsonb', { nullable: true })
  configuration?: NodeConfiguration;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}