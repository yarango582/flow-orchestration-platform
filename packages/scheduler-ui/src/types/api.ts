// Base API types
export interface ApiResponse<T> {
  data: T
  pagination?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
}

// Flow Management API Types
export interface Flow {
  id: string
  name: string
  description?: string
  nodes: NodeInstance[]
  connections: NodeConnection[]
  version: number
  status: FlowStatus
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface FlowSummary {
  id: string
  name: string
  description?: string
  version: number
  status: FlowStatus
  nodeCount: number
  createdAt: string
  updatedAt: string
}

export interface NodeInstance {
  id: string
  type: string
  version: string
  config: Record<string, any>
  position: Position
}

export interface NodeConnection {
  fromNodeId: string
  fromOutput: string
  toNodeId: string
  toInput: string
}

export interface Position {
  x: number
  y: number
}

export type FlowStatus = 'draft' | 'active' | 'inactive' | 'archived'

export interface FlowVersion {
  version: number
  createdAt: string
  createdBy?: string
  changes?: string
  nodeCount: number
}

export interface CreateFlowRequest {
  name: string
  description?: string
  nodes: NodeInstance[]
  connections: NodeConnection[]
  metadata?: Record<string, any>
}

export interface UpdateFlowRequest extends CreateFlowRequest {
  status?: FlowStatus
}

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  field?: string
}

export interface ValidationWarning {
  code: string
  message: string
  nodeId?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// Scheduler API Types
export interface Schedule {
  id: string
  flowId: string
  name: string
  description?: string
  cronExpression: string
  timezone: string
  enabled: boolean
  maxRetries: number
  retryDelay: number
  lastRun?: string
  nextRun?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface CreateScheduleRequest {
  flowId: string
  name: string
  description?: string
  cronExpression: string
  timezone?: string
  enabled?: boolean
  maxRetries?: number
  retryDelay?: number
  metadata?: Record<string, any>
}

export interface UpdateScheduleRequest {
  name?: string
  description?: string
  cronExpression?: string
  timezone?: string
  enabled?: boolean
  maxRetries?: number
  retryDelay?: number
  metadata?: Record<string, any>
}

export interface Execution {
  id: string
  flowId: string
  scheduleId?: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  duration?: number
  recordsProcessed: number
  errorMessage?: string
  retryCount: number
}

export interface ExecutionDetail extends Execution {
  nodeExecutions: NodeExecution[]
  metadata?: Record<string, any>
}

export interface NodeExecution {
  nodeId: string
  nodeType: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  duration?: number
  recordsProcessed: number
  errorMessage?: string
}

export interface ExecutionLog {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  nodeId?: string
  metadata?: Record<string, any>
}

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout'

export interface BulkOperationResult {
  successCount: number
  failureCount: number
  errors: Array<{
    scheduleId: string
    error: string
  }>
}

export interface JobStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

// Node Catalog API Types
export interface NodeDefinition {
  type: string
  name: string
  description?: string
  version: string
  category: NodeCategoryEnum
  icon?: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
  compatibilityMatrix: CompatibilityRule[]
  configuration?: NodeConfiguration
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface NodeInput {
  name: string
  type: DataType
  required: boolean
  description?: string
  defaultValue?: any
  validation?: ValidationRules
}

export interface NodeOutput {
  name: string
  type: DataType
  description?: string
  schema?: Record<string, any>
}

export interface CompatibilityRule {
  targetType: string
  outputPin: string
  targetInputPin: string
  compatibility: 'full' | 'partial' | 'conditional' | 'none'
  conditions?: Array<{
    field: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
    value: any
  }>
  transformations?: Array<{
    from: string
    to: string
    function: string
  }>
}

export interface NodeConfiguration {
  timeout?: number
  retries?: number
  concurrency?: number
  batchSize?: number
}

export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any'

export interface ValidationRules {
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  enum?: any[]
}

export interface NodeVersion {
  version: string
  releaseDate: string
  changelog?: string
  deprecated: boolean
  breaking: boolean
}

export interface NodeCategory {
  name: string
  description?: string
  icon?: string
  nodeCount: number
}

export type NodeCategoryEnum = 'database' | 'transformation' | 'external-api' | 'notification' | 'storage' | 'logic' | 'ai-ml'

export interface CreateNodeRequest {
  type: string
  name: string
  description?: string
  version: string
  category: NodeCategoryEnum
  icon?: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
  compatibilityMatrix: CompatibilityRule[]
  configuration?: NodeConfiguration
  metadata?: Record<string, any>
}

export interface CompatibilityCheck {
  compatible: boolean
  compatibility: 'full' | 'partial' | 'conditional' | 'none'
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    message: string
    field?: string
  }>
  requiredTransformations: Array<{
    from: string
    to: string
    transformation: string
  }>
}

// Health Check
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  dependencies: Record<string, 'healthy' | 'unhealthy'>
}

// Query Parameters
export interface FlowQueryParams {
  page?: number
  limit?: number
  status?: FlowStatus
  search?: string
}

export interface ScheduleQueryParams {
  page?: number
  limit?: number
  flowId?: string
  enabled?: boolean
  nextRunBefore?: string
}

export interface ExecutionQueryParams {
  page?: number
  limit?: number
  flowId?: string
  scheduleId?: string
  status?: ExecutionStatus
  startTimeFrom?: string
  startTimeTo?: string
}

export interface NodeQueryParams {
  category?: NodeCategoryEnum
  version?: string
  search?: string
}

export interface ExecutionLogParams {
  level?: 'debug' | 'info' | 'warn' | 'error'
  nodeId?: string
}