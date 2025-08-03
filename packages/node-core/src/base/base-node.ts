import { INode, NodeResult } from '../interfaces/node.interface'
import { CompatibilityRule } from '../interfaces/compatibility.interface'

export interface NodeMetadata {
  type: string
  name: string
  description: string
  version: string
  category: 'database' | 'transformation' | 'external-api' | 'notification' | 'storage' | 'logic' | 'ai-ml'
  icon?: string
  inputs: NodeInputMetadata[]
  outputs: NodeOutputMetadata[]
  compatibilityMatrix?: CompatibilityRule[]
  configuration?: NodeConfigurationMetadata
  tags?: string[]
  relatedNodes?: string[]
  documentation?: NodeDocumentationMetadata
}

export interface NodeDocumentationMetadata {
  purpose: string
  usageExamples: NodeUsageExampleMetadata[]
  requirements?: string[]
  limitations?: string[]
  troubleshooting?: NodeTroubleshootingMetadata[]
  bestPractices?: string[]
}

export interface NodeUsageExampleMetadata {
  title: string
  description: string
  inputExample: Record<string, any>
  expectedOutput: Record<string, any>
  notes?: string
}

export interface NodeTroubleshootingMetadata {
  issue: string
  solution: string
  category: 'connection' | 'configuration' | 'performance' | 'validation' | 'other'
}

export interface NodeInputMetadata {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any'
  required: boolean
  description: string
  defaultValue?: any
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    minimum?: number
    maximum?: number
    enum?: any[]
  }
}

export interface NodeOutputMetadata {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any'
  description: string
  schema?: Record<string, any>
}

export interface NodeConfigurationMetadata {
  timeout?: number
  retries?: number
  concurrency?: number
  batchSize?: number
}

export abstract class BaseNode<TInput, TOutput, TConfig> implements INode<TInput, TOutput, TConfig> {
  abstract readonly type: string
  abstract readonly version: string
  abstract readonly category: string
  
  protected config: TConfig
  
  constructor(config: TConfig) {
    this.config = config
  }
  
  abstract execute(input: TInput, context?: any): Promise<NodeResult<TOutput>>
  
  validate(input: TInput): boolean {
    return input !== null && input !== undefined
  }
  
  getConfig(): TConfig {
    return this.config
  }

  // Static method that must be implemented by all nodes to provide metadata
  // This ensures dynamic metadata discovery from the library itself
  static getMetadata(): NodeMetadata {
    throw new Error('Static getMetadata() method must be implemented by node classes')
  }
}