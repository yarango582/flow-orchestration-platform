import { INode, NodeResult } from '../interfaces/node.interface'

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
}