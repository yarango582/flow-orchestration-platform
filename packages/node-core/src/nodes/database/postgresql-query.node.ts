import { BaseNode, NodeMetadata } from '../../base/base-node'
import { NodeResult } from '../../interfaces/node.interface'
import { Client } from 'pg'

interface PostgreSQLInput {
  connectionString: string
  query: string
  parameters?: any[]
}

interface PostgreSQLOutput {
  result: any[]
  rowCount: number
}

interface PostgreSQLConfig {
  timeout?: number
  poolSize?: number
}

export class PostgreSQLQueryNode extends BaseNode<PostgreSQLInput, PostgreSQLOutput, PostgreSQLConfig> {
  readonly type = 'postgresql-query'
  readonly version = '1.0.0'
  readonly category = 'database'
  
  static getMetadata(): NodeMetadata {
    return {
      type: 'postgresql-query',
      name: 'PostgreSQL Query',
      description: 'Executes SQL queries against PostgreSQL database with connection pooling and parameter binding',
      version: '1.0.0',
      category: 'database',
      icon: 'postgresql',
      inputs: [
        {
          name: 'connectionString',
          type: 'string',
          required: true,
          description: 'PostgreSQL connection string (e.g., postgresql://user:password@host:port/database)',
          validation: {
            pattern: '^postgresql://.*'
          }
        },
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'SQL query to execute with optional parameter placeholders ($1, $2, etc.)',
          defaultValue: 'SELECT * FROM users LIMIT 10'
        },
        {
          name: 'parameters',
          type: 'array',
          required: false,
          description: 'Array of parameters for parameterized queries',
          defaultValue: []
        }
      ],
      outputs: [
        {
          name: 'result',
          type: 'array',
          description: 'Array of rows returned by the query',
          schema: {
            type: 'array',
            items: { type: 'object' }
          }
        },
        {
          name: 'rowCount',
          type: 'number',
          description: 'Number of rows affected or returned by the query'
        }
      ],
      compatibilityMatrix: [
        {
          targetType: 'data-filter',
          outputPin: 'result',
          targetInputPin: 'data',
          compatibility: 'full'
        },
        {
          targetType: 'field-mapper',
          outputPin: 'result',
          targetInputPin: 'source',
          compatibility: 'full'
        }
      ],
      configuration: {
        timeout: 30000,
        retries: 3,
        concurrency: 1,
        batchSize: 1000
      },
      tags: ['database', 'postgresql', 'sql', 'query'],
      relatedNodes: ['data-filter', 'field-mapper', 'mongodb-operations'],
      documentation: {
        purpose: 'Ejecuta consultas SQL en bases de datos PostgreSQL con soporte para prepared statements, pooling de conexiones y manejo robusto de errores.',
        usageExamples: [
          {
            title: 'Consulta básica de selección',
            description: 'Obtener todos los registros de una tabla con límite',
            inputExample: {
              connectionString: 'postgresql://postgres:password@localhost:5432/mydb',
              query: 'SELECT * FROM users LIMIT 10',
              parameters: []
            },
            expectedOutput: {
              result: [
                { id: 1, name: 'Juan Pérez', email: 'juan@example.com' },
                { id: 2, name: 'María López', email: 'maria@example.com' }
              ],
              rowCount: 2
            },
            notes: 'Para consultas simples no se necesitan parámetros'
          },
          {
            title: 'Consulta con parámetros',
            description: 'Usar prepared statements para seguridad y rendimiento',
            inputExample: {
              connectionString: 'postgresql://postgres:password@localhost:5432/mydb',
              query: 'SELECT * FROM users WHERE age > $1 AND city = $2',
              parameters: [25, 'Madrid']
            },
            expectedOutput: {
              result: [
                { id: 3, name: 'Carlos Ruiz', age: 30, city: 'Madrid' }
              ],
              rowCount: 1
            },
            notes: 'Los parámetros previenen inyección SQL y mejoran el rendimiento'
          },
          {
            title: 'Inserción de datos',
            description: 'Insertar nuevos registros y obtener los IDs generados',
            inputExample: {
              connectionString: 'postgresql://postgres:password@localhost:5432/mydb',
              query: 'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
              parameters: ['Ana García', 'ana@example.com']
            },
            expectedOutput: {
              result: [{ id: 4 }],
              rowCount: 1
            },
            notes: 'RETURNING permite obtener datos del registro insertado'
          }
        ],
        requirements: [
          'Base de datos PostgreSQL activa y accesible',
          'Credenciales válidas con permisos apropiados',
          'String de conexión en formato postgresql://',
          'Red accesible desde el servidor de ejecución'
        ],
        limitations: [
          'Máximo 1000 registros por consulta por defecto',
          'Timeout de 30 segundos por consulta',
          'No soporta transacciones multi-query',
          'Conexiones se cierran después de cada ejecución'
        ],
        troubleshooting: [
          {
            issue: 'Error de conexión "ECONNREFUSED"',
            solution: 'Verificar que PostgreSQL esté ejecutándose y sea accesible en la dirección especificada. Revisar firewall y configuración de red.',
            category: 'connection'
          },
          {
            issue: 'Error de autenticación',
            solution: 'Verificar usuario, contraseña y permisos de la base de datos. Revisar configuración de pg_hba.conf.',
            category: 'connection'
          },
          {
            issue: 'Consulta muy lenta',
            solution: 'Revisar índices de la tabla, optimizar la consulta SQL, considerar usar LIMIT, verificar estadísticas de la base de datos.',
            category: 'performance'
          },
          {
            issue: 'Error de sintaxis SQL',
            solution: 'Verificar la sintaxis de la consulta SQL, validar nombres de tablas y columnas, revisar tipos de datos de los parámetros.',
            category: 'validation'
          }
        ],
        bestPractices: [
          'Usar siempre parámetros ($1, $2, etc.) en lugar de concatenar valores directamente',
          'Implementar manejo de errores apropiado en el flujo',
          'Usar LIMIT en consultas SELECT para evitar resultados masivos',
          'Validar datos de entrada antes de ejecutar consultas',
          'Monitorear el rendimiento de consultas frecuentes',
          'Usar índices apropiados en las tablas consultadas',
          'Considerar paginación para grandes volúmenes de datos'
        ]
      }
    }
  }
  
  async execute(input: PostgreSQLInput): Promise<NodeResult<PostgreSQLOutput>> {
    const startTime = Date.now()
    
    let client: Client | undefined
    
    try {
      // Create PostgreSQL client
      client = new Client({
        connectionString: input.connectionString,
        connectionTimeoutMillis: this.config?.timeout || 30000,
      })

      // Connect to the database
      await client.connect()

      // Execute the query with parameters
      const queryResult = await client.query(input.query, input.parameters || [])
      
      const executionTime = Date.now() - startTime
      
      return {
        success: true,
        data: {
          result: queryResult.rows,
          rowCount: queryResult.rowCount || 0
        },
        metrics: {
          executionTime,
          recordsProcessed: queryResult.rowCount || 0
        }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown PostgreSQL error',
        metrics: {
          executionTime,
          recordsProcessed: 0
        }
      }
    } finally {
      // Always close the connection
      if (client) {
        try {
          await client.end()
        } catch (closeError) {
          console.warn('Error closing PostgreSQL connection:', closeError)
        }
      }
    }
  }
  
  validate(input: PostgreSQLInput): boolean {
    return super.validate(input) && 
           !!input.connectionString && 
           !!input.query
  }
}