import { CompatibilityLevel } from '../interfaces/compatibility.interface'

export class CompatibilityValidator {
  static check(sourceType: string, targetType: string): { level: CompatibilityLevel; valid: boolean } {
    // Comprehensive compatibility matrix including MongoDB operations
    const matrix: Record<string, Record<string, CompatibilityLevel>> = {
      // PostgreSQL Query Node compatibility
      'postgresql-query': {
        'data-filter': 'full',
        'field-mapper': 'full',
        'mongodb-operations': 'partial' // result → document for inserts
      },
      
      // MongoDB Operations Node compatibility
      'mongodb-operations': {
        'data-filter': 'full',        // result → data
        'field-mapper': 'full',       // result → source
        'postgresql-query': 'partial', // documents → query parameters
        'mongodb-operations': 'full'   // chaining MongoDB operations
      },
      
      // Data Filter Node compatibility
      'data-filter': {
        'field-mapper': 'full',
        'mongodb-operations': 'full',  // filtered → document/query
        'postgresql-query': 'partial'  // filtered → parameters
      },
      
      // Field Mapper Node compatibility
      'field-mapper': {
        'mongodb-operations': 'full',  // mapped → document/query
        'postgresql-query': 'partial', // mapped → parameters
        'data-filter': 'full'         // mapped → data
      }
    }
    
    const level = matrix[sourceType]?.[targetType] || 'none'
    return {
      level,
      valid: level !== 'none'
    }
  }
  
  /**
   * Get compatibility details for MongoDB operations
   */
  static getMongoDBCompatibilityDetails(sourceType: string, targetType: string): string {
    const compatibilityMap: Record<string, Record<string, string>> = {
      'postgresql-query': {
        'mongodb-operations': 'PostgreSQL result can be transformed to MongoDB documents for insert operations'
      },
      'mongodb-operations': {
        'data-filter': 'MongoDB query results can be filtered using data-filter node',
        'field-mapper': 'MongoDB documents can be field-mapped for transformation',
        'postgresql-query': 'MongoDB results can be used as parameters for PostgreSQL queries (with transformation)',
        'mongodb-operations': 'MongoDB operations can be chained (e.g., find → update, aggregate → insert)'
      },
      'data-filter': {
        'mongodb-operations': 'Filtered data can be used for MongoDB insert/update operations or as query criteria'
      },
      'field-mapper': {
        'mongodb-operations': 'Mapped fields can be used for MongoDB operations (documents, queries, updates)'
      }
    }
    
    return compatibilityMap[sourceType]?.[targetType] || 'No specific compatibility details available'
  }

  /**
   * Validate compatibility between two node pins with schemas (static method)
   */
  static async validateCompatibility(
    source: { type: string; pin: string; schema?: any },
    target: { type: string; pin: string; schema?: any }
  ): Promise<{
    compatible: boolean;
    issues?: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
  }> {
    const basicCheck = CompatibilityValidator.check(source.type, target.type)
    
    const issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }> = []
    
    if (!basicCheck.valid) {
      issues.push({
        severity: 'error',
        message: `No compatibility rule found between ${source.type} and ${target.type}`
      })
    }
    
    // Schema compatibility checks
    if (source.schema && target.schema) {
      if (source.schema.type !== target.schema.type && 
          source.schema.type !== 'any' && 
          target.schema.type !== 'any') {
        issues.push({
          severity: 'warning',
          message: `Schema type mismatch: source outputs '${source.schema.type}' but target expects '${target.schema.type}'`
        })
      }
    }
    
    return {
      compatible: basicCheck.valid && issues.filter(i => i.severity === 'error').length === 0,
      issues
    }
  }

  /**
   * Instance method for validate compatibility (for instances of the class)
   */
  async validateCompatibilityInstance(
    source: { type: string; pin: string; schema?: any },
    target: { type: string; pin: string; schema?: any }
  ): Promise<{
    compatible: boolean;
    issues?: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
  }> {
    return CompatibilityValidator.validateCompatibility(source, target)
  }
}