import { BaseNode } from '../../base/base-node'
import { NodeResult } from '../../interfaces/node.interface'

interface FilterCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: any
}

interface DataFilterInput {
  data: any[]
  conditions: FilterCondition[]
}

interface DataFilterOutput {
  filtered: any[]
  filtered_count: number
}

export class DataFilterNode extends BaseNode<DataFilterInput, DataFilterOutput, any> {
  readonly type = 'data-filter'
  readonly version = '1.0.0'
  readonly category = 'transformation'
  
  async execute(input: DataFilterInput): Promise<NodeResult<DataFilterOutput>> {
    const startTime = Date.now()
    
    try {
      const filtered = input.data.filter(item => {
        return input.conditions.every(condition => {
          const fieldValue = item[condition.field]
          
          switch (condition.operator) {
            case 'equals':
              return fieldValue === condition.value
            case 'not_equals':
              return fieldValue !== condition.value
            case 'greater_than':
              return fieldValue > condition.value
            case 'less_than':
              return fieldValue < condition.value
            case 'contains':
              return String(fieldValue).includes(String(condition.value))
            default:
              return false
          }
        })
      })
      
      const executionTime = Date.now() - startTime
      
      return {
        success: true,
        data: {
          filtered,
          filtered_count: filtered.length
        },
        metrics: {
          executionTime,
          recordsProcessed: filtered.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  validate(input: DataFilterInput): boolean {
    return super.validate(input) && 
           Array.isArray(input.data) && 
           Array.isArray(input.conditions)
  }
}