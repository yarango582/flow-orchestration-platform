import React from 'react'
import { Node } from 'reactflow'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PropertiesPanelProps {
  isOpen: boolean
  onToggle: () => void
  selectedNode: Node | null
  onUpdateConfig: (nodeId: string, config: any) => void
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  isOpen,
  onToggle,
  selectedNode,
  onUpdateConfig,
}) => {
  const handleConfigChange = (key: string, value: any) => {
    if (selectedNode) {
      onUpdateConfig(selectedNode.id, { [key]: value })
    }
  }

  const renderNodeConfig = () => {
    if (!selectedNode) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p>Selecciona un nodo para ver sus propiedades</p>
        </div>
      )
    }

    const { data } = selectedNode

    switch (data.type) {
      case 'postgresql-query':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cadena de Conexión
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="postgresql://user:pass@host:port/db"
                value={data.config?.connectionString || ''}
                onChange={(e) => handleConfigChange('connectionString', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consulta SQL
              </label>
              <textarea
                className="input-field h-24 resize-none"
                placeholder="SELECT * FROM users WHERE active = $1"
                value={data.config?.query || ''}
                onChange={(e) => handleConfigChange('query', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parámetros (JSON)
              </label>
              <textarea
                className="input-field h-16 resize-none"
                placeholder='[true, "active"]'
                value={data.config?.parameters ? JSON.stringify(data.config.parameters, null, 2) : '[]'}
                onChange={(e) => {
                  try {
                    const params = JSON.parse(e.target.value)
                    handleConfigChange('parameters', params)
                  } catch {
                    // Ignore invalid JSON
                  }
                }}
              />
            </div>
          </div>
        )

      case 'data-filter':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condiciones de Filtro (JSON)
              </label>
              <textarea
                className="input-field h-32 resize-none"
                placeholder='[{"field": "status", "operator": "equals", "value": "active"}]'
                value={data.config?.conditions ? JSON.stringify(data.config.conditions, null, 2) : '[]'}
                onChange={(e) => {
                  try {
                    const conditions = JSON.parse(e.target.value)
                    handleConfigChange('conditions', conditions)
                  } catch {
                    // Ignore invalid JSON
                  }
                }}
              />
            </div>
            <div className="text-xs text-gray-600">
              <p>Operadores soportados:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>equals, not_equals</li>
                <li>greater_than, less_than</li>
                <li>contains, in</li>
              </ul>
            </div>
          </div>
        )

      case 'field-mapper':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mapeo de Campos (JSON)
              </label>
              <textarea
                className="input-field h-32 resize-none"
                placeholder='[{"sourceField": "name", "targetField": "full_name", "transformation": "rename"}]'
                value={data.config?.mapping ? JSON.stringify(data.config.mapping, null, 2) : '[]'}
                onChange={(e) => {
                  try {
                    const mapping = JSON.parse(e.target.value)
                    handleConfigChange('mapping', mapping)
                  } catch {
                    // Ignore invalid JSON
                  }
                }}
              />
            </div>
            <div className="text-xs text-gray-600">
              <p>Transformaciones soportadas:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>rename, cast, function</li>
                <li>template, default</li>
              </ul>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center text-gray-500 py-8">
            <p>Sin configuración disponible para este tipo de nodo</p>
          </div>
        )
    }
  }

  return (
    <div className={clsx(
      'bg-white border-l border-gray-200 transition-all duration-300 flex-shrink-0',
      isOpen ? 'w-80' : 'w-12'
    )}>
      {/* Toggle Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 h-16">
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          {isOpen ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronLeftIcon className="w-5 h-5" />
          )}
        </button>
        
        {isOpen && (
          <h2 className="text-lg font-semibold text-gray-900">
            Propiedades
          </h2>
        )}
      </div>

      {/* Properties Content */}
      {isOpen && (
        <div className="p-4 custom-scrollbar overflow-y-auto h-full">
          {selectedNode && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">
                {selectedNode.data.name}
              </h3>
              <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                {selectedNode.data.category}
              </span>
            </div>
          )}
          
          {renderNodeConfig()}
        </div>
      )}
    </div>
  )
}

export default PropertiesPanel