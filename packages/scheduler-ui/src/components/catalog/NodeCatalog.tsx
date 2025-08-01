import React from 'react'
import {
  CircleStackIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'

const mockNodes = [
  {
    type: 'postgresql-query',
    name: 'PostgreSQL Query',
    category: 'database',
    version: '1.0.0',
    description: 'Ejecuta consultas SQL en bases de datos PostgreSQL con soporte para prepared statements y pooling de conexiones.',
    inputs: ['connectionString', 'query', 'parameters'],
    outputs: ['result', 'rowCount'],
    icon: CircleStackIcon
  },
  {
    type: 'data-filter',
    name: 'Filtro de Datos',
    category: 'transformation',
    version: '1.0.0',
    description: 'Filtra arrays de datos basado en condiciones lógicas complejas con soporte para múltiples operadores.',
    inputs: ['data', 'conditions'],
    outputs: ['filtered', 'filtered_count'],
    icon: FunnelIcon
  },
  {
    type: 'field-mapper',
    name: 'Mapeo de Campos',
    category: 'transformation',
    version: '1.0.0',
    description: 'Transforma y mapea campos de datos con soporte para funciones personalizadas y templates.',
    inputs: ['source', 'mapping'],
    outputs: ['mapped'],
    icon: ArrowsRightLeftIcon
  },
  {
    type: 'http-request',
    name: 'HTTP Request',
    category: 'external-api',
    version: '1.0.0',
    description: 'Realiza peticiones HTTP con soporte para diferentes métodos, headers personalizados y manejo de errores.',
    inputs: ['url', 'method', 'headers', 'body'],
    outputs: ['response', 'status_code'],
    icon: GlobeAltIcon
  }
]

const categoryColors = {
  database: 'bg-blue-50 border-blue-200 text-blue-800',
  transformation: 'bg-green-50 border-green-200 text-green-800',
  'external-api': 'bg-orange-50 border-orange-200 text-orange-800'
}

const NodeCatalog: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Catálogo de Nodos
        </h1>
        <p className="text-gray-600 mt-2">
          Explora todos los nodos disponibles para construir tus flujos de trabajo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockNodes.map((node) => {
          const Icon = node.icon
          return (
            <div
              key={node.type}
              className={`card hover:shadow-lg transition-shadow border-2 ${categoryColors[node.category as keyof typeof categoryColors]}`}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <Icon className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold truncate">
                      {node.name}
                    </h3>
                    <span className="text-xs bg-white px-2 py-1 rounded-md font-medium">
                      v{node.version}
                    </span>
                  </div>
                  
                  <span className="inline-block px-2 py-1 text-xs rounded-md font-medium bg-white mb-3">
                    {node.category.replace('-', ' ')}
                  </span>
                  
                  <p className="text-sm opacity-90 mb-4 line-clamp-3">
                    {node.description}
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Entradas:</h4>
                      <div className="flex flex-wrap gap-1">
                        {node.inputs.map((input) => (
                          <span
                            key={input}
                            className="px-2 py-1 text-xs bg-white rounded-md font-mono"
                          >
                            {input}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1">Salidas:</h4>
                      <div className="flex flex-wrap gap-1">
                        {node.outputs.map((output) => (
                          <span
                            key={output}
                            className="px-2 py-1 text-xs bg-white rounded-md font-mono"
                          >
                            {output}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                    <button className="w-full btn-secondary text-sm">
                      Ver Documentación
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NodeCatalog