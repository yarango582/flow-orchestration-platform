import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface NodeTemplate {
  type: string
  name: string
  category: string
  description: string
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'postgresql-query',
    name: 'PostgreSQL Query',
    category: 'database',
    description: 'Ejecuta consultas SQL en PostgreSQL'
  },
  {
    type: 'data-filter',
    name: 'Filtro de Datos',
    category: 'transformation',
    description: 'Filtra datos según condiciones'
  },
  {
    type: 'field-mapper',
    name: 'Mapeo de Campos',
    category: 'transformation',
    description: 'Transforma y mapea campos de datos'
  },
  {
    type: 'http-request',
    name: 'HTTP Request',
    category: 'external-api',
    description: 'Realiza peticiones HTTP'
  }
]

const categoryColors = {
  database: 'bg-blue-100 text-blue-800',
  transformation: 'bg-green-100 text-green-800',
  'external-api': 'bg-orange-100 text-orange-800'
}

interface NodeSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onAddNode: (type: string, name: string, category: string) => void
}

const NodeSidebar: React.FC<NodeSidebarProps> = ({ isOpen, onToggle, onAddNode }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string, name: string, category: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('nodeName', name)
    event.dataTransfer.setData('nodeCategory', category)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className={clsx(
      'bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0',
      isOpen ? 'w-80' : 'w-12'
    )}>
      {/* Toggle Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 h-16">
        {isOpen && (
          <h2 className="text-lg font-semibold text-gray-900">
            Catálogo de Nodos
          </h2>
        )}
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          {isOpen ? (
            <ChevronLeftIcon className="w-5 h-5" />
          ) : (
            <ChevronRightIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Node List */}
      {isOpen && (
        <div className="p-4 space-y-3 custom-scrollbar overflow-y-auto h-full">
          <div className="text-sm text-gray-600 mb-4">
            Arrastra los nodos al canvas para crear tu flujo
          </div>
          
          {nodeTemplates.map((template) => (
            <div
              key={template.type}
              className="p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-move bg-white"
              draggable
              onDragStart={(e) => onDragStart(e, template.type, template.name, template.category)}
              onClick={() => onAddNode(template.type, template.name, template.category)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 text-sm">
                  {template.name}
                </h3>
                <span className={clsx(
                  'px-2 py-1 text-xs rounded-md font-medium',
                  categoryColors[template.category as keyof typeof categoryColors]
                )}>
                  {template.category.replace('-', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {template.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NodeSidebar