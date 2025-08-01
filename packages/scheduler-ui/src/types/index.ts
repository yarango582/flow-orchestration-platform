export interface Flow {
  id: string
  name: string
  description?: string
  nodes: NodeInstance[]
  connections: NodeConnection[]
  version: number
  status: 'draft' | 'active' | 'inactive' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface NodeInstance {
  id: string
  type: string
  version: string
  config: Record<string, any>
  position: { x: number; y: number }
}

export interface NodeConnection {
  fromNodeId: string
  fromOutput: string
  toNodeId: string
  toInput: string
}

export interface Schedule {
  id: string
  flowId: string
  name: string
  description?: string
  cronExpression: string
  timezone: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  createdAt: string
  updatedAt: string
}

export interface Execution {
  id: string
  flowId: string
  scheduleId?: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout'
  startTime: string
  endTime?: string
  duration?: number
  recordsProcessed: number
  errorMessage?: string
}

export interface NodeDefinition {
  type: string
  name: string
  description: string
  version: string
  category: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
}

export interface NodeInput {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface NodeOutput {
  name: string
  type: string
  description?: string
}