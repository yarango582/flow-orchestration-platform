import React, { useState, useEffect } from 'react'
import {
  CircleStackIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  GlobeAltIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { dynamicNodeCatalogService, DynamicNodeDefinition } from '../../services/dynamic-node-catalog.service'
import NodeDocReviewModal from '../modals/NodeDocReviewModal'

const NodeCatalog: React.FC = () => {
  const [nodes, setNodes] = useState<DynamicNodeDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<DynamicNodeDefinition | null>(null)
  const [showDocumentation, setShowDocumentation] = useState(false)

  useEffect(() => {
    loadNodes()
  }, [])

  const loadNodes = async () => {
    try {
      setLoading(true)
      setError(null)
      const dynamicNodes = await dynamicNodeCatalogService.getDynamicNodeDefinitions()
      setNodes(dynamicNodes)
    } catch (err) {
      setError('Error loading node catalog')
      console.error('Error loading nodes:', err)
    } finally {
      setLoading(false)
    }
  }

  const getIconForNode = (nodeType: string) => {
    switch (nodeType) {
      case 'postgresql-query':
      case 'mongodb-operations':
        return CircleStackIcon
      case 'data-filter':
        return FunnelIcon
      case 'field-mapper':
        return ArrowsRightLeftIcon
      default:
        return GlobeAltIcon
    }
  }

  const handleShowDocumentation = (node: DynamicNodeDefinition) => {
    setSelectedNode(node)
    setShowDocumentation(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando catálogo de nodos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-600">
        <DocumentTextIcon className="h-12 w-12 mb-2" />
        <p>{error}</p>
        <button 
          onClick={loadNodes}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Catálogo de Nodos</h2>
        <p className="text-gray-600">
          Descubre todos los nodos disponibles y su documentación completa.
          Los datos provienen directamente de la librería node-core.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => {
          const Icon = getIconForNode(node.type)
          return (
            <div key={node.type} className="group">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{node.name}</h3>
                      <p className="text-sm text-blue-600 capitalize">{node.category.replace('-', ' ')}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {node.description}
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Entradas ({node.inputs?.length || 0})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {node.inputs?.slice(0, 3).map((input) => (
                          <span
                            key={input.name}
                            className="px-2 py-1 text-xs bg-white rounded-md font-mono"
                          >
                            {input.name}
                          </span>
                        ))}
                        {node.inputs && node.inputs.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 rounded-md">
                            +{node.inputs.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Salidas ({node.outputs?.length || 0})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {node.outputs?.map((output) => (
                          <span
                            key={output.name}
                            className="px-2 py-1 text-xs bg-white rounded-md font-mono"
                          >
                            {output.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                    <button 
                      onClick={() => handleShowDocumentation(node)}
                      className="w-full btn-secondary text-sm flex items-center justify-center"
                    >
                      <DocumentTextIcon className="w-4 h-4 mr-2" />
                      Ver Documentación
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de documentación */}
      <NodeDocReviewModal
        isOpen={showDocumentation}
        onClose={() => setShowDocumentation(false)}
        nodeType={selectedNode?.type}
      />
    </div>
  )
}

export default NodeCatalog
