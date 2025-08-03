export type CompatibilityLevel = 'full' | 'partial' | 'conditional' | 'none'

export interface CompatibilityRule {
  targetType: string
  outputPin: string
  targetInputPin: string
  compatibility: CompatibilityLevel
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