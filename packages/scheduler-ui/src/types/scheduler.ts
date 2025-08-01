// Scheduler Service Types
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout'

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

export interface ExecutionDetail extends Execution {
  nodeExecutions: NodeExecution[]
  metadata?: Record<string, any>
}

export interface ExecutionLog {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  nodeId?: string
  metadata?: Record<string, any>
}

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