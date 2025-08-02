// Node definition interface for UI
export interface NodeDefinition {
  type: string
  name: string
  description: string
  version: string
  category: string
  inputs: NodeInput[]
  outputs: NodeOutput[]
  icon?: string
}

export interface NodeInput {
  name: string
  type: string
  required: boolean
  description: string
  defaultValue?: any
}

export interface NodeOutput {
  name: string
  type: string
  description: string
}

class NodeRegistryService {
  private nodeDefinitions: Map<string, NodeDefinition> = new Map()

  constructor() {
    this.initializeNodes()
  }

  private initializeNodes() {
    // Define node metadata for UI (without importing node-core classes)
    this.nodeDefinitions.set('postgresql-query', {
      type: 'postgresql-query',
      name: 'PostgreSQL Query',
      description: 'Executes SQL queries against PostgreSQL database',
      version: '1.0.0',
      category: 'database',
      inputs: [
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'SQL query to execute',
          defaultValue: 'SELECT * FROM users LIMIT 10'
        },
        {
          name: 'connection',
          type: 'object',
          required: true,
          description: 'Database connection configuration'
        }
      ],
      outputs: [
        {
          name: 'result',
          type: 'array',
          description: 'Query execution result'
        },
        {
          name: 'rowCount',
          type: 'number',
          description: 'Number of rows returned'
        }
      ]
    })

    this.nodeDefinitions.set('data-filter', {
      type: 'data-filter',
      name: 'Data Filter',
      description: 'Filters data based on specified conditions',
      version: '1.0.0',
      category: 'transformation',
      inputs: [
        {
          name: 'data',
          type: 'array',
          required: true,
          description: 'Input data to filter'
        },
        {
          name: 'conditions',
          type: 'array',
          required: true,
          description: 'Filter conditions'
        }
      ],
      outputs: [
        {
          name: 'filteredData',
          type: 'array',
          description: 'Filtered data result'
        },
        {
          name: 'filteredCount',
          type: 'number',
          description: 'Number of filtered items'
        }
      ]
    })

    this.nodeDefinitions.set('field-mapper', {
      type: 'field-mapper',
      name: 'Field Mapper',
      description: 'Maps and transforms fields from input to output format',
      version: '1.0.0',
      category: 'transformation',
      inputs: [
        {
          name: 'source',
          type: 'array|object',
          required: true,
          description: 'Input data to map'
        },
        {
          name: 'mapping',
          type: 'array',
          required: true,
          description: 'Field mapping configuration'
        }
      ],
      outputs: [
        {
          name: 'mapped',
          type: 'array|object',
          description: 'Mapped data result'
        }
      ]
    })

    this.nodeDefinitions.set('http-request', {
      type: 'http-request',
      name: 'HTTP Request',
      description: 'Makes HTTP requests to external APIs',
      version: '1.0.0',
      category: 'external-api',
      inputs: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'Request URL'
        },
        {
          name: 'method',
          type: 'string',
          required: true,
          description: 'HTTP method',
          defaultValue: 'GET'
        },
        {
          name: 'headers',
          type: 'object',
          required: false,
          description: 'Request headers'
        },
        {
          name: 'body',
          type: 'object',
          required: false,
          description: 'Request body'
        }
      ],
      outputs: [
        {
          name: 'response',
          type: 'object',
          description: 'HTTP response'
        },
        {
          name: 'statusCode',
          type: 'number',
          description: 'HTTP status code'
        }
      ]
    })

    this.nodeDefinitions.set('mongodb-operations', {
      type: 'mongodb-operations',
      name: 'MongoDB Operations',
      description: 'Performs operations on MongoDB collections',
      version: '1.0.0',
      category: 'database',
      inputs: [
        {
          name: 'operation',
          type: 'string',
          required: true,
          description: 'MongoDB operation to perform'
        },
        {
          name: 'collection',
          type: 'string',
          required: true,
          description: 'Target collection name'
        },
        {
          name: 'data',
          type: 'object',
          required: false,
          description: 'Operation data'
        }
      ],
      outputs: [
        {
          name: 'result',
          type: 'array|object',
          description: 'Operation result'
        },
        {
          name: 'count',
          type: 'number',
          description: 'Number of affected documents'
        }
      ]
    })
  }

  /**
   * Get all available node definitions
   */
  getAllNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values())
  }

  /**
   * Get a specific node definition by type
   */
  getNodeDefinition(type: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(type)
  }

  /**
   * Get available node types
   */
  getAvailableTypes(): string[] {
    return Array.from(this.nodeDefinitions.keys())
  }

  /**
   * Check if a node type exists
   */
  hasNodeType(type: string): boolean {
    return this.nodeDefinitions.has(type)
  }

  /**
   * Validate node connections
   */
  validateConnection(fromType: string, fromOutput: string, toType: string, toInput: string): boolean {
    const fromNode = this.getNodeDefinition(fromType)
    const toNode = this.getNodeDefinition(toType)

    if (!fromNode || !toNode) {
      return false
    }

    const hasValidOutput = fromNode.outputs.some(output => output.name === fromOutput)
    const hasValidInput = toNode.inputs.some(input => input.name === toInput)

    return hasValidOutput && hasValidInput
  }
}

// Export singleton instance
export const nodeRegistryService = new NodeRegistryService()
