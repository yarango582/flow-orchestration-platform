export interface NodeResult<T = any> {
  success: boolean
  data?: T
  error?: string
  metrics?: {
    executionTime: number
    recordsProcessed: number
  }
  recordsProcessed?: number
  duration?: number
  rollbackData?: any
}

export interface INode<TInput = any, TOutput = any, TConfig = any> {
  readonly type: string
  readonly version: string
  readonly category: string
  
  execute(input: TInput, context?: any): Promise<NodeResult<TOutput>>
  validate(input: TInput): boolean
  getConfig(): TConfig
}