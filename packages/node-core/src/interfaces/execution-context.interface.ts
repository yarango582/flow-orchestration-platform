export interface ExecutionContext {
  flowId: string
  executionId: string
  nodeId: string
  logger: any
  config: Record<string, any>
}