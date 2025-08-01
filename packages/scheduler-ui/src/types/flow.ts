// Flow Management Service Types
export type FlowStatus = 'draft' | 'active' | 'inactive' | 'archived'

export interface Position {
  x: number
  y: number
}

export interface NodeConnection {
  fromNodeId: string
  fromOutput: string
  toNodeId: string
  toInput: string
}

export interface NodeInstance {
  id: string
  type: string
  version: string
  config: Record<string, any>
  position: Position
}

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

export interface FlowValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}