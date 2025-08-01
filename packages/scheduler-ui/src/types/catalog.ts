// Node Catalog Service Types
export type NodeCategoryEnum = 'database' | 'transformation' | 'external-api' | 'notification' | 'storage' | 'logic' | 'ai-ml'
export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'binary' | 'any'
export type CompatibilityLevel = 'full' | 'partial' | 'conditional' | 'none'

export interface ValidationRules {
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  enum?: Array<string | number | boolean>
}

export interface NodeInput {
  name: string
  type: DataType
  required: boolean
  description?: string
  defaultValue?: string | number | boolean | any[] | Record<string, any>
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
  compatibility: CompatibilityLevel
  conditions?: Array<{
    field: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
    value: string | number | boolean
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
  compatibility: CompatibilityLevel
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

export interface CompatibilityCheckRequest {
  sourceNode: {
    type: string
    version: string
  }
  targetNode: {
    type: string
    version: string
  }
  connection: {
    outputPin: string
    inputPin: string
  }
}

// Node Documentation Types
export interface TypeDefinition {
  name: string
  type: string
  description?: string
  properties?: Record<string, TypeDefinition>
  required?: boolean
  defaultValue?: any
  validation?: ValidationRules
  examples?: any[]
}

export interface ConfigurationOption {
  name: string
  type: string
  description: string
  required: boolean
  defaultValue?: any
  validation?: ValidationRules
  examples?: any[]
}

export interface ValidationRule {
  field: string
  rule: string
  message: string
  severity: 'error' | 'warning'
}

export interface UsageExample {
  title: string
  description: string
  input: Record<string, any>
  config?: Record<string, any>
  expectedOutput: Record<string, any>
  notes?: string
}

export interface ErrorScenario {
  scenario: string
  cause: string
  errorType: string
  solution: string
  prevention?: string
}

export interface NodeDocumentation {
  // Basic information
  type: string
  name: string
  version: string
  category: NodeCategoryEnum
  description: string
  purpose: string
  icon?: any

  // Technical specifications
  inputTypes: TypeDefinition[]
  outputTypes: TypeDefinition[]
  configurationOptions: ConfigurationOption[]
  
  // Validation and behavior
  validationRules: ValidationRule[]
  errorHandling: ErrorScenario[]
  
  // Usage guidance
  usageExamples: UsageExample[]
  bestPractices: string[]
  commonPitfalls: string[]
  
  // Performance characteristics
  performanceNotes: string[]
  resourceRequirements?: {
    memory?: string
    cpu?: string
    network?: string
    storage?: string
  }
  
  // Version and compatibility
  changelog?: string[]
  deprecationWarnings?: string[]
  compatibleVersions?: string[]
  
  // Additional metadata
  tags?: string[]
  relatedNodes?: string[]
  documentationUrl?: string
  sourceCodeUrl?: string
}