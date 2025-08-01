import { BaseNode } from '../../base/base-node'
import { NodeResult } from '../../interfaces/node.interface'

interface FieldMapping {
  sourceField: string
  targetField: string
  transformation: 'rename' | 'cast' | 'function' | 'default'
  transformValue?: any
}

interface FieldMapperInput {
  source: any[] | any
  mapping: FieldMapping[]
}

interface FieldMapperOutput {
  mapped: any[] | any
}

export class FieldMapperNode extends BaseNode<FieldMapperInput, FieldMapperOutput, any> {
  readonly type = 'field-mapper'
  readonly version = '1.0.0'
  readonly category = 'transformation'
  
  async execute(input: FieldMapperInput): Promise<NodeResult<FieldMapperOutput>> {
    const startTime = Date.now()
    
    try {
      const isArray = Array.isArray(input.source)
      const sourceData = isArray ? input.source : [input.source]
      
      const mapped = sourceData.map((item: any) => {
        const result: any = {}
        
        input.mapping.forEach(mapping => {
          const sourceValue = item[mapping.sourceField]
          
          switch (mapping.transformation) {
            case 'rename':
              result[mapping.targetField] = sourceValue
              break
            case 'cast':
              result[mapping.targetField] = this.castValue(sourceValue, mapping.transformValue)
              break
            case 'function':
              result[mapping.targetField] = this.applyFunction(sourceValue, mapping.transformValue)
              break
            case 'default':
              result[mapping.targetField] = sourceValue || mapping.transformValue
              break
          }
        })
        
        return result
      })
      
      const executionTime = Date.now() - startTime
      
      return {
        success: true,
        data: {
          mapped: isArray ? mapped : mapped[0]
        },
        metrics: {
          executionTime,
          recordsProcessed: mapped.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  private castValue(value: any, targetType: string): any {
    switch (targetType) {
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      default:
        return value
    }
  }
  
  private applyFunction(value: any, functionName: string): any {
    switch (functionName) {
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      case 'trim':
        return String(value).trim()
      default:
        return value
    }
  }
  
  validate(input: FieldMapperInput): boolean {
    return super.validate(input) && 
           !!input.source && 
           Array.isArray(input.mapping)
  }
}