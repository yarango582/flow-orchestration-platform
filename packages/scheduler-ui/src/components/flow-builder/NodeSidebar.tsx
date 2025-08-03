import React, { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { dynamicNodeCatalogService, DynamicNodeDefinition } from '../../services/dynamic-node-catalog.service'

const categoryColors = {
  database: 'bg-blue-100 text-blue-800',
  transformation: 'bg-green-100 text-green-800',
  'external-api': 'bg-orange-100 text-orange-800',
  storage: 'bg-purple-100 text-purple-800',
  notification: 'bg-yellow-100 text-yellow-800',
  logic: 'bg-gray-100 text-gray-800',
  'ai-ml': 'bg-red-100 text-red-800'
}

interface NodeSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onAddNode: (type: string, name: string, category: string) => void
}

export default function NodeSidebar({ isOpen, onToggle, onAddNode }: NodeSidebarProps) {
  const [nodeTemplates, setNodeTemplates] = useState<DynamicNodeDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDynamicNodes()
  }, [])

  const loadDynamicNodes = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Loading dynamic node definitions from node-core library...')
      const dynamicNodes = await dynamicNodeCatalogService.getDynamicNodeDefinitions()
      
      if (dynamicNodes.length === 0) {
        throw new Error('No dynamic nodes found from node-core library')
      }
      
      setNodeTemplates(dynamicNodes)
      console.log(`✅ Loaded ${dynamicNodes.length} dynamic nodes:`, dynamicNodes.map(n => n.type))
      
    } catch (error) {
      console.error('❌ Failed to load dynamic nodes:', error)
      setError(error instanceof Error ? error.message : 'Failed to load node definitions')
      
      // Fallback to empty array - no hardcoded nodes
      setNodeTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const onDragStart = (event: React.DragEvent, type: string, name: string, category: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type, name, category }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const refreshNodes = () => {
    dynamicNodeCatalogService.clearCache()
    loadDynamicNodes()
  }

  return (
    <div className={clsx(
      'h-full bg-gray-50 border-r border-gray-200 transition-all duration-300 flex flex-col',
      isOpen ? 'w-80' : 'w-12'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        {isOpen && (
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-medium text-gray-900">
              📦 Catálogo Dinámico
            </h2>
            <button
              onClick={refreshNodes}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:border-blue-300"
              title="Actualizar desde node-core"
            >
              🔄 Refresh
            </button>
          </div>
        )}
        <button
          onClick={onToggle}
          className={clsx(
            'p-2 rounded-md hover:bg-gray-100 transition-colors',
            !isOpen && 'mx-auto'
          )}
        >
          {isOpen ? (
            <ChevronLeftIcon className="h-5 w-5" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Node List */}
      {isOpen && (
        <div className="p-4 space-y-3 custom-scrollbar overflow-y-auto h-full">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 mt-2">
                Cargando nodos desde node-core...
              </p>
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 text-sm mb-2">⚠️ Error</div>
              <p className="text-xs text-gray-600 mb-3">{error}</p>
              <button
                onClick={refreshNodes}
                className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1 rounded border border-blue-200"
              >
                Reintentar
              </button>
            </div>
          )}
          
          {!loading && !error && nodeTemplates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">
                No hay nodos disponibles
              </p>
              <button
                onClick={refreshNodes}
                className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1 rounded border border-blue-200 mt-2"
              >
                Recargar
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="text-sm text-gray-600 mb-4">
              <div className="flex items-center justify-between">
                <span>Arrastra los nodos al canvas</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {nodeTemplates.length} nodos
                </span>
              </div>
            </div>
          )}
          
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
                <div className="flex flex-col items-end gap-1">
                  <span className={clsx(
                    'px-2 py-1 text-xs rounded-md font-medium',
                    categoryColors[template.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-800'
                  )}>
                    {template.category.replace('-', ' ')}
                  </span>
                  {template.dynamicSource && (
                    <span className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded">
                      🔗 node-core
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600">
                {template.description}
              </p>
              {template.version && (
                <p className="text-xs text-gray-400 mt-1">
                  v{template.version}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
