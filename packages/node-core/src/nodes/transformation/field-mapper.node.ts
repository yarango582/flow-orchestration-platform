import { BaseNode, NodeMetadata } from '../../base/base-node'
import { NodeResult } from '../../interfaces/node.interface'

interface FieldMapping {
  sourceField: string
  targetField: string
  transformation: 'rename' | 'function' | 'constant'
  parameters?: {
    functionBody?: string
    constantValue?: any
  }
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
  
  static getMetadata(): NodeMetadata {
    return {
      type: 'field-mapper',
      name: 'Field Mapper',
      description: 'Maps and transforms fields from input to output format with custom transformations and functions',
      version: '1.0.0',
      category: 'transformation',
      icon: 'transform',
      inputs: [
        {
          name: 'source',
          type: 'array',
          required: true,
          description: 'Source data to map (array of objects or single object)'
        },
        {
          name: 'mapping',
          type: 'array',
          required: true,
          description: 'Array of field mapping configurations',
          defaultValue: [
            {
              sourceField: 'id',
              targetField: 'identifier',
              transformation: 'rename'
            }
          ]
        }
      ],
      outputs: [
        {
          name: 'mapped',
          type: 'array',
          description: 'Mapped data with transformed fields',
          schema: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      ],
      compatibilityMatrix: [
        {
          targetType: 'data-filter',
          outputPin: 'mapped',
          targetInputPin: 'data',
          compatibility: 'full'
        },
        {
          targetType: 'mongodb-operations',
          outputPin: 'mapped',
          targetInputPin: 'data',
          compatibility: 'full'
        }
      ],
      configuration: {
        timeout: 15000,
        retries: 2,
        concurrency: 1,
        batchSize: 2000
      },
      tags: ['transformation', 'mapping', 'field-transformation'],
      relatedNodes: ['data-filter', 'postgresql-query', 'mongodb-operations']
    }
  }
  
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
            case 'function':
              if (mapping.parameters?.functionBody) {
                try {
                  const func = new Function('value', mapping.parameters.functionBody)
                  result[mapping.targetField] = func(sourceValue)
                } catch {
                  result[mapping.targetField] = sourceValue
                }
              } else {
                result[mapping.targetField] = sourceValue
              }
              break
            case 'constant':
              result[mapping.targetField] = mapping.parameters?.constantValue
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
          recordsProcessed: sourceData.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  validate(input: FieldMapperInput): boolean {
    return super.validate(input) && 
           (Array.isArray(input.source) || typeof input.source === 'object') &&
           Array.isArray(input.mapping)
  }
}