export type CompatibilityLevel = 'full' | 'partial' | 'conditional' | 'none'

export interface CompatibilityRule {
  targetType: string
  outputPin: string
  targetInputPin: string
  compatibility: CompatibilityLevel
}