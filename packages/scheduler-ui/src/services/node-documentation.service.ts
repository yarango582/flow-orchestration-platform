import { 
  NodeDocumentation, 
  TypeDefinition, 
  ConfigurationOption, 
  ValidationRule, 
  UsageExample, 
  ErrorScenario 
} from '../types/catalog'

// Import actual node classes
import { PostgreSQLQueryNode } from '../../../node-core/src/nodes/database/postgresql-query.node'
import { MongoDBOperationsNode } from '../../../node-core/src/nodes/database/mongodb-operations.node'
import { DataFilterNode } from '../../../node-core/src/nodes/transformation/data-filter.node'
import { FieldMapperNode } from '../../../node-core/src/nodes/transformation/field-mapper.node'

// Icon imports for documentation
import {
  CircleStackIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline'

export class NodeDocumentationService {
  private static instance: NodeDocumentationService
  private documentationCache: Map<string, NodeDocumentation> = new Map()

  private constructor() {
    this.initializeDocumentation()
  }

  public static getInstance(): NodeDocumentationService {
    if (!NodeDocumentationService.instance) {
      NodeDocumentationService.instance = new NodeDocumentationService()
    }
    return NodeDocumentationService.instance
  }

  private initializeDocumentation(): void {
    // Initialize documentation for all available nodes
    this.generatePostgreSQLDocumentation()
    this.generateMongoDBDocumentation()
    this.generateDataFilterDocumentation()
    this.generateFieldMapperDocumentation()
  }

  public getAllNodeDocumentation(): NodeDocumentation[] {
    return Array.from(this.documentationCache.values())
  }

  public getNodeDocumentation(nodeType: string): NodeDocumentation | null {
    return this.documentationCache.get(nodeType) || null
  }

  public getNodesByCategory(category: string): NodeDocumentation[] {
    return Array.from(this.documentationCache.values())
      .filter(doc => doc.category === category)
  }

  private generatePostgreSQLDocumentation(): void {
    const node = new PostgreSQLQueryNode({})
    
    const documentation: NodeDocumentation = {
      type: node.type,
      name: 'PostgreSQL Query',
      version: node.version,
      category: node.category as any,
      description: 'Ejecuta consultas SQL en bases de datos PostgreSQL con soporte para prepared statements y pooling de conexiones.',
      purpose: 'Permite realizar operaciones de lectura y escritura en bases de datos PostgreSQL de forma eficiente y segura.',
      icon: CircleStackIcon,

      inputTypes: [
        {
          name: 'connectionString',
          type: 'string',
          description: 'Cadena de conexión a la base de datos PostgreSQL',
          required: true,
          examples: ['postgresql://user:password@localhost:5432/dbname']
        },
        {
          name: 'query',
          type: 'string',
          description: 'Consulta SQL a ejecutar',
          required: true,
          examples: ['SELECT * FROM users WHERE id = $1', 'INSERT INTO users (name, email) VALUES ($1, $2)']
        },
        {
          name: 'parameters',
          type: 'array',
          description: 'Parámetros para prepared statements',
          required: false,
          examples: [[1], ['John Doe', 'john@example.com']]
        }
      ],

      outputTypes: [
        {
          name: 'result',
          type: 'array',
          description: 'Resultados de la consulta SQL',
          examples: [[{ id: 1, name: 'John', email: 'john@example.com' }]]
        },
        {
          name: 'rowCount',
          type: 'number',
          description: 'Número de filas afectadas o devueltas',
          examples: [1, 0, 100]
        }
      ],

      configurationOptions: [
        {
          name: 'timeout',
          type: 'number',
          description: 'Tiempo máximo de espera en milisegundos',
          required: false,
          defaultValue: 30000,
          examples: [5000, 30000, 60000]
        },
        {
          name: 'poolSize',
          type: 'number',
          description: 'Tamaño del pool de conexiones',
          required: false,
          defaultValue: 10,
          examples: [5, 10, 20]
        }
      ],

      validationRules: [
        {
          field: 'connectionString',
          rule: 'required',
          message: 'La cadena de conexión es obligatoria',
          severity: 'error'
        },
        {
          field: 'query',
          rule: 'required',
          message: 'La consulta SQL es obligatoria',
          severity: 'error'
        }
      ],

      errorHandling: [
        {
          scenario: 'Error de conexión',
          cause: 'Credenciales incorrectas o servidor no disponible',
          errorType: 'ConnectionError',
          solution: 'Verificar las credenciales y la disponibilidad del servidor',
          prevention: 'Implementar health checks y validación de conexión'
        },
        {
          scenario: 'Error de sintaxis SQL',
          cause: 'Consulta SQL malformada',
          errorType: 'SyntaxError',
          solution: 'Revisar la sintaxis de la consulta SQL',
          prevention: 'Usar prepared statements y validación de consultas'
        }
      ],

      usageExamples: [
        {
          title: 'Consulta simple',
          description: 'Obtener todos los usuarios de la base de datos',
          input: {
            connectionString: 'postgresql://user:pass@localhost:5432/mydb',
            query: 'SELECT * FROM users',
            parameters: []
          },
          expectedOutput: {
            result: [{ id: 1, name: 'John', email: 'john@example.com' }],
            rowCount: 1
          }
        },
        {
          title: 'Consulta con parámetros',
          description: 'Buscar usuario por ID usando prepared statement',
          input: {
            connectionString: 'postgresql://user:pass@localhost:5432/mydb',
            query: 'SELECT * FROM users WHERE id = $1',
            parameters: [1]
          },
          expectedOutput: {
            result: [{ id: 1, name: 'John', email: 'john@example.com' }],
            rowCount: 1
          }
        }
      ],

      bestPractices: [
        'Usar siempre prepared statements para prevenir inyección SQL',
        'Configurar timeouts apropiados para evitar bloqueos',
        'Implementar pooling de conexiones para mejor rendimiento',
        'Validar datos de entrada antes de ejecutar consultas'
      ],

      commonPitfalls: [
        'No usar prepared statements puede llevar a vulnerabilidades de seguridad',
        'Consultas muy complejas pueden causar timeouts',
        'No cerrar conexiones puede agotar el pool de conexiones'
      ],

      performanceNotes: [
        'El pooling de conexiones mejora significativamente el rendimiento',
        'Índices apropiados en la base de datos son cruciales para consultas rápidas',
        'Evitar SELECT * en tablas grandes'
      ],

      resourceRequirements: {
        memory: 'Mínimo 64MB, recomendado 256MB',
        network: 'Conexión estable a la base de datos',
        cpu: 'Bajo consumo de CPU'
      },

      tags: ['database', 'sql', 'postgresql', 'query'],
      relatedNodes: ['mongodb-operations', 'data-filter'],
      documentationUrl: 'https://www.postgresql.org/docs/'
    }

    this.documentationCache.set(node.type, documentation)
  }

  private generateMongoDBDocumentation(): void {
    const node = new MongoDBOperationsNode({})
    
    const documentation: NodeDocumentation = {
      type: node.type,
      name: 'MongoDB Operations',
      version: node.version,
      category: node.category as any,
      description: 'Realiza operaciones CRUD en bases de datos MongoDB con soporte para agregaciones y transacciones.',
      purpose: 'Permite interactuar con bases de datos MongoDB realizando operaciones de lectura, escritura, actualización y eliminación.',
      icon: CircleStackIcon,

      inputTypes: [
        {
          name: 'connectionString',
          type: 'string',
          description: 'Cadena de conexión a MongoDB',
          required: true,
          examples: ['mongodb://localhost:27017', 'mongodb+srv://user:pass@cluster.mongodb.net']
        },
        {
          name: 'database',
          type: 'string',
          description: 'Nombre de la base de datos',
          required: true,
          examples: ['myapp', 'production', 'test']
        },
        {
          name: 'collection',
          type: 'string', 
          description: 'Nombre de la colección',
          required: true,
          examples: ['users', 'products', 'orders']
        },
        {
          name: 'operation',
          type: 'string',
          description: 'Tipo de operación a realizar',
          required: true,
          examples: ['find', 'insertOne', 'updateMany', 'deleteOne', 'aggregate']
        },
        {
          name: 'query',
          type: 'object',
          description: 'Filtro de búsqueda para la operación',
          required: false,
          examples: [{ status: 'active' }, { age: { $gt: 18 } }]
        },
        {
          name: 'document',
          type: 'object',
          description: 'Documento(s) para operaciones de inserción',
          required: false,
          examples: [{ name: 'John', email: 'john@example.com' }]
        }
      ],

      outputTypes: [
        {
          name: 'result',
          type: 'any',
          description: 'Resultado de la operación MongoDB',
          examples: [[{ _id: '...', name: 'John' }], { insertedId: '...' }]
        },
        {
          name: 'matchedCount',
          type: 'number',
          description: 'Número de documentos que coincidieron con el filtro',
          examples: [0, 1, 100]
        },
        {
          name: 'modifiedCount',
          type: 'number',
          description: 'Número de documentos modificados',
          examples: [0, 1, 50]
        },
        {
          name: 'operationType',
          type: 'string',
          description: 'Tipo de operación ejecutada',
          examples: ['find', 'insertOne', 'updateMany']
        }
      ],

      configurationOptions: [
        {
          name: 'connectionPool.maxPoolSize',
          type: 'number',
          description: 'Tamaño máximo del pool de conexiones',
          required: false,
          defaultValue: 10,
          examples: [5, 10, 20]
        },
        {
          name: 'defaultTimeout',
          type: 'number',
          description: 'Timeout por defecto en milisegundos',
          required: false,
          defaultValue: 30000,
          examples: [5000, 30000, 60000]
        }
      ],

      validationRules: [
        {
          field: 'connectionString',
          rule: 'required',
          message: 'La cadena de conexión es obligatoria',
          severity: 'error'
        },
        {
          field: 'database',
          rule: 'required',
          message: 'El nombre de la base de datos es obligatorio',
          severity: 'error'
        },
        {
          field: 'collection',
          rule: 'required',
          message: 'El nombre de la colección es obligatorio',
          severity: 'error'
        }
      ],

      errorHandling: [
        {
          scenario: 'Error de conexión',
          cause: 'Servidor MongoDB no disponible o credenciales incorrectas',
          errorType: 'MongoServerError',
          solution: 'Verificar conexión y credenciales',
          prevention: 'Implementar health checks y manejo de reconexión'
        },
        {
          scenario: 'Documento duplicado',
          cause: 'Intento de insertar documento con _id existente',
          errorType: 'DuplicateKeyError',
          solution: 'Usar upsert o verificar existencia antes de insertar',
          prevention: 'Generar IDs únicos o usar operaciones condicionales'
        }
      ],

      usageExamples: [
        {
          title: 'Buscar documentos',
          description: 'Buscar usuarios activos',
          input: {
            connectionString: 'mongodb://localhost:27017',
            database: 'myapp',
            collection: 'users',
            operation: 'find',
            query: { status: 'active' }
          },
          expectedOutput: {
            result: [{ _id: '...', name: 'John', status: 'active' }],
            matchedCount: 1,
            operationType: 'find'
          }
        },
        {
          title: 'Insertar documento',
          description: 'Crear nuevo usuario',
          input: {
            connectionString: 'mongodb://localhost:27017',
            database: 'myapp',
            collection: 'users',
            operation: 'insertOne',
            document: { name: 'Jane', email: 'jane@example.com' }
          },
          expectedOutput: {
            result: { insertedId: '...' },
            insertedCount: 1,
            operationType: 'insertOne'
          }
        }
      ],

      bestPractices: [
        'Usar índices apropiados para mejorar rendimiento de consultas',
        'Implementar validación de esquemas en la aplicación',
        'Usar conexiones reutilizables y pool de conexiones',
        'Manejar errores de red y reconexión automática'
      ],

      commonPitfalls: [
        'No indexar campos frecuentemente consultados',
        'Realizar operaciones costosas sin límites',
        'No validar datos antes de insertar'
      ],

      performanceNotes: [
        'Los índices son cruciales para consultas eficientes',
        'Las agregaciones pueden ser costosas en colecciones grandes',
        'Usar proyecciones para limitar datos transferidos'
      ],

      resourceRequirements: {
        memory: 'Variable según el tamaño de datos y operaciones',
        network: 'Conexión estable a MongoDB',
        storage: 'Espacio para datos y índices'
      },

      tags: ['database', 'mongodb', 'nosql', 'crud'],
      relatedNodes: ['postgresql-query', 'data-filter'],
      documentationUrl: 'https://docs.mongodb.com/'
    }

    this.documentationCache.set(node.type, documentation)
  }

  private generateDataFilterDocumentation(): void {
    const node = new DataFilterNode({})
    
    const documentation: NodeDocumentation = {
      type: node.type,
      name: 'Data Filter',
      version: node.version,
      category: node.category as any,
      description: 'Filtra arrays de datos basado en condiciones lógicas complejas con soporte para múltiples operadores.',
      purpose: 'Permite filtrar conjuntos de datos aplicando condiciones específicas para obtener subconjuntos que cumplan criterios determinados.',
      icon: FunnelIcon,

      inputTypes: [
        {
          name: 'data',
          type: 'array',
          description: 'Array de datos a filtrar',
          required: true,
          examples: [[{ name: 'John', age: 25 }, { name: 'Jane', age: 30 }]]
        },
        {
          name: 'conditions',
          type: 'array',
          description: 'Array de condiciones para el filtrado',
          required: true,
          properties: {
            field: {
              name: 'field',
              type: 'string',
              description: 'Campo a evaluar'
            },
            operator: {
              name: 'operator',
              type: 'string',
              description: 'Operador de comparación'
            },
            value: {
              name: 'value',
              type: 'any',
              description: 'Valor de comparación'
            }
          },
          examples: [[{ field: 'age', operator: 'greater_than', value: 18 }]]
        }
      ],

      outputTypes: [
        {
          name: 'filtered',
          type: 'array',
          description: 'Array de datos filtrados',
          examples: [[{ name: 'Jane', age: 30 }]]
        },
        {
          name: 'filtered_count',
          type: 'number',
          description: 'Número de elementos que pasaron el filtro',
          examples: [1, 0, 100]
        }
      ],

      configurationOptions: [],

      validationRules: [
        {
          field: 'data',
          rule: 'array',
          message: 'Los datos deben ser un array',
          severity: 'error'
        },
        {
          field: 'conditions',
          rule: 'array',
          message: 'Las condiciones deben ser un array',
          severity: 'error'
        }
      ],

      errorHandling: [
        {
          scenario: 'Campo inexistente',
          cause: 'Referencia a un campo que no existe en los datos',
          errorType: 'FieldNotFoundError',
          solution: 'Verificar que el campo existe en los datos de entrada',
          prevention: 'Validar esquema de datos antes del filtrado'
        },
        {
          scenario: 'Operador no válido',
          cause: 'Uso de un operador no soportado',
          errorType: 'InvalidOperatorError',
          solution: 'Usar operadores válidos: equals, not_equals, greater_than, less_than, contains',
          prevention: 'Validar operadores antes de la ejecución'
        }
      ],

      usageExamples: [
        {
          title: 'Filtro simple por edad',
          description: 'Filtrar usuarios mayores de 18 años',
          input: {
            data: [
              { name: 'John', age: 16 },
              { name: 'Jane', age: 25 },
              { name: 'Bob', age: 30 }
            ],
            conditions: [
              { field: 'age', operator: 'greater_than', value: 18 }
            ]
          },
          expectedOutput: {
            filtered: [
              { name: 'Jane', age: 25 },
              { name: 'Bob', age: 30 }
            ],
            filtered_count: 2
          }
        },
        {
          title: 'Filtro múltiple',
          description: 'Filtrar usuarios activos con edad específica',
          input: {
            data: [
              { name: 'John', age: 25, status: 'active' },
              { name: 'Jane', age: 25, status: 'inactive' },
              { name: 'Bob', age: 30, status: 'active' }
            ],
            conditions: [
              { field: 'age', operator: 'equals', value: 25 },
              { field: 'status', operator: 'equals', value: 'active' }
            ]
          },
          expectedOutput: {
            filtered: [{ name: 'John', age: 25, status: 'active' }],
            filtered_count: 1
          }
        }
      ],

      bestPractices: [
        'Validar que los campos existen antes de aplicar filtros',
        'Usar operadores apropiados según el tipo de dato',
        'Considerar el rendimiento con grandes volúmenes de datos',
        'Combinar múltiples condiciones de forma lógica'
      ],

      commonPitfalls: [
        'No validar la existencia de campos puede causar errores',
        'Usar operadores incorrectos para tipos de datos específicos',
        'No considerar valores null o undefined en los datos'
      ],

      performanceNotes: [
        'El rendimiento depende del tamaño del array de datos',
        'Filtros complejos pueden ser costosos computacionalmente',
        'Considerar pre-filtrar datos en la fuente cuando sea posible'
      ],

      resourceRequirements: {
        memory: 'Proporcional al tamaño de los datos',
        cpu: 'Bajo a moderado según complejidad de filtros'
      },

      tags: ['transformation', 'filter', 'data-processing', 'array'],
      relatedNodes: ['field-mapper', 'postgresql-query', 'mongodb-operations'],
    }

    this.documentationCache.set(node.type, documentation)
  }

  private generateFieldMapperDocumentation(): void {
    const node = new FieldMapperNode({})
    
    const documentation: NodeDocumentation = {
      type: node.type,
      name: 'Field Mapper',
      version: node.version,
      category: node.category as any,
      description: 'Transforma y mapea campos de datos con soporte para funciones personalizadas y templates.',
      purpose: 'Permite transformar la estructura de datos mapeando, renombrando y aplicando transformaciones a campos específicos.',
      icon: ArrowsRightLeftIcon,

      inputTypes: [
        {
          name: 'source',
          type: 'object',
          description: 'Datos fuente a transformar (objeto o array de objetos)',
          required: true,
          examples: [
            { firstName: 'John', lastName: 'Doe', age: '25' },
            [{ firstName: 'John', lastName: 'Doe' }]
          ]
        },
        {
          name: 'mapping',
          type: 'array',
          description: 'Array de reglas de mapeo',
          required: true,
          properties: {
            sourceField: {
              name: 'sourceField',
              type: 'string',
              description: 'Campo fuente'
            },
            targetField: {
              name: 'targetField',
              type: 'string',
              description: 'Campo destino'
            },
            transformation: {
              name: 'transformation',
              type: 'string',
              description: 'Tipo de transformación'
            },
            transformValue: {
              name: 'transformValue',
              type: 'any',
              description: 'Valor para la transformación'
            }
          },
          examples: [[
            { sourceField: 'firstName', targetField: 'name', transformation: 'rename' },
            { sourceField: 'age', targetField: 'age', transformation: 'cast', transformValue: 'number' }
          ]]
        }
      ],

      outputTypes: [
        {
          name: 'mapped',
          type: 'object',
          description: 'Datos transformados según las reglas de mapeo',
          examples: [
            { name: 'John', age: 25 },
            [{ name: 'John', age: 25 }]
          ]
        }
      ],

      configurationOptions: [],

      validationRules: [
        {
          field: 'source',
          rule: 'required',
          message: 'Los datos fuente son obligatorios',
          severity: 'error'
        },
        {
          field: 'mapping',
          rule: 'array',
          message: 'Las reglas de mapeo deben ser un array',
          severity: 'error'
        }
      ],

      errorHandling: [
        {
          scenario: 'Campo fuente inexistente',
          cause: 'Referencia a un campo que no existe en los datos fuente',
          errorType: 'SourceFieldNotFoundError',
          solution: 'Verificar que el campo fuente existe en los datos',
          prevention: 'Validar esquema de datos antes del mapeo'
        },
        {
          scenario: 'Transformación no válida',
          cause: 'Uso de una transformación no soportada',
          errorType: 'InvalidTransformationError',
          solution: 'Usar transformaciones válidas: rename, cast, function, default',
          prevention: 'Validar tipos de transformación antes de la ejecución'
        }
      ],

      usageExamples: [
        {
          title: 'Mapeo simple',
          description: 'Renombrar campos y cambiar tipos',
          input: {
            source: { firstName: 'John', lastName: 'Doe', age: '25' },
            mapping: [
              { sourceField: 'firstName', targetField: 'name', transformation: 'rename' },
              { sourceField: 'age', targetField: 'age', transformation: 'cast', transformValue: 'number' }
            ]
          },
          expectedOutput: {
            mapped: { name: 'John', age: 25 }
          }
        },
        {
          title: 'Mapeo con funciones',
          description: 'Aplicar transformaciones de texto',
          input: {
            source: { name: 'john doe', email: ' JOHN@EXAMPLE.COM ' },
            mapping: [
              { sourceField: 'name', targetField: 'fullName', transformation: 'function', transformValue: 'uppercase' },
              { sourceField: 'email', targetField: 'email', transformation: 'function', transformValue: 'trim' }
            ]
          },
          expectedOutput: {
            mapped: { fullName: 'JOHN DOE', email: 'JOHN@EXAMPLE.COM' }
          }
        },
        {
          title: 'Mapeo con valores por defecto',
          description: 'Asignar valores por defecto a campos faltantes',
          input: {
            source: { name: 'John' },
            mapping: [
              { sourceField: 'name', targetField: 'name', transformation: 'rename' },
              { sourceField: 'status', targetField: 'status', transformation: 'default', transformValue: 'active' }
            ]
          },
          expectedOutput: {
            mapped: { name: 'John', status: 'active' }
          }
        }
      ],

      bestPractices: [
        'Definir mapeos claros y consistentes',
        'Validar tipos de datos antes de las transformaciones',
        'Usar valores por defecto para campos opcionales',
        'Documentar las reglas de mapeo para mantenimiento'
      ],

      commonPitfalls: [
        'No validar la existencia de campos fuente',
        'Aplicar transformaciones incompatibles con el tipo de dato',
        'No manejar valores null o undefined adecuadamente'
      ],

      performanceNotes: [
        'El rendimiento depende del número de campos y transformaciones',
        'Transformaciones de funciones pueden ser más costosas',
        'Considerar cachear reglas de mapeo complejas'
      ],

      resourceRequirements: {
        memory: 'Bajo, proporcional al tamaño de datos',
        cpu: 'Bajo a moderado según transformaciones'
      },

      tags: ['transformation', 'mapping', 'data-processing', 'field-transformation'],
      relatedNodes: ['data-filter', 'postgresql-query', 'mongodb-operations'],
    }

    this.documentationCache.set(node.type, documentation)
  }

  public refreshDocumentation(): void {
    this.documentationCache.clear()
    this.initializeDocumentation()
  }

  public searchNodes(query: string): NodeDocumentation[] {
    const searchTerm = query.toLowerCase()
    return Array.from(this.documentationCache.values()).filter(doc => 
      doc.name.toLowerCase().includes(searchTerm) ||
      doc.description.toLowerCase().includes(searchTerm) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      doc.category.toLowerCase().includes(searchTerm)
    )
  }
}

// Export singleton instance
export const nodeDocumentationService = NodeDocumentationService.getInstance()