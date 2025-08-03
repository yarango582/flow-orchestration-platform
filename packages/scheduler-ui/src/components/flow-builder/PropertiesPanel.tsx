import React, { useEffect, useState } from 'react'
import { Node } from 'reactflow'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { dynamicNodeCatalogService, DynamicNodeDefinition } from '../../services/dynamic-node-catalog.service'

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
  /** 1️⃣  Config local que SÍ se puede escribir */
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({})
  /** Metadata dinámica del nodo seleccionado */
  const [nodeMetadata, setNodeMetadata] = useState<DynamicNodeDefinition | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)

  /** 2️⃣  Mantener el localConfig alineado al cambiar de nodo */
  useEffect(() => {
    if (selectedNode) {
      console.log('PropertiesPanel: Loading config for node:', selectedNode.id, selectedNode.data?.config)
      setLocalConfig(selectedNode.data?.config ?? {})
      
      // Cargar metadata dinámica
      loadNodeMetadata(selectedNode.data.type)
    } else {
      setLocalConfig({})
      setNodeMetadata(null)
    }
  }, [selectedNode])

  /** Cargar metadata dinámica desde node-core */
  const loadNodeMetadata = async (nodeType: string) => {
    try {
      setLoadingMetadata(true)
      console.log('🔄 Loading dynamic metadata for node type:', nodeType)
      
      const metadata = await dynamicNodeCatalogService.getDynamicNodeDefinition(nodeType)
      if (metadata) {
        setNodeMetadata(metadata)
        console.log('✅ Loaded metadata for node:', nodeType, metadata)
        
        // Set default values from metadata if not already set
        const defaultConfig: Record<string, any> = {}
        metadata.inputs.forEach(input => {
          if (input.defaultValue !== undefined && localConfig[input.name] === undefined) {
            defaultConfig[input.name] = input.defaultValue
          }
        })
        
        if (Object.keys(defaultConfig).length > 0) {
          setLocalConfig(prev => ({ ...defaultConfig, ...prev }))
        }
      } else {
        setNodeMetadata(null)
        console.warn('❌ No metadata found for node type:', nodeType)
      }
    } catch (error) {
      console.error('❌ Failed to load node metadata:', error)
      setNodeMetadata(null)
    } finally {
      setLoadingMetadata(false)
    }
  }

  /** 3️⃣  Editar el localConfig sin tocar ReactFlow todavía */
  const handleLocalChange = (key: string, value: any) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }))
  }

  /** 4️⃣  Enviar al flujo cuando el usuario termine (onBlur) */
  const commitConfig = () => {
    if (selectedNode) {
      console.log('PropertiesPanel: Committing config:', localConfig)
      onUpdateConfig(selectedNode.id, localConfig)
    }
  }

  /* ---------- Render específico por tipo ---------- */
  const renderNodeConfig = () => {
    if (!selectedNode) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p>Selecciona un nodo para ver sus propiedades</p>
        </div>
      )
    }

    if (loadingMetadata) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
          <p>Cargando configuración desde node-core...</p>
        </div>
      )
    }

    // Usar metadata dinámica si está disponible
    if (nodeMetadata) {
      return (
        <div className="space-y-4">
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-800 font-medium">🔗 Configuración Dinámica</span>
              <span className="text-green-600">v{nodeMetadata.version}</span>
            </div>
            <p className="text-green-700 text-xs mt-1">{nodeMetadata.description}</p>
          </div>

          {nodeMetadata.inputs.map((input) => (
            <div key={input.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="text-xs text-gray-500 mb-2">
                {input.description}
              </div>
              
              {input.type === 'string' && (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={input.defaultValue || `Ingresa ${input.name}`}
                  value={localConfig[input.name] || ''}
                  onChange={(e) => handleLocalChange(input.name, e.target.value)}
                  onBlur={commitConfig}
                />
              )}
              
              {input.type === 'number' && (
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={input.defaultValue?.toString() || '0'}
                  value={localConfig[input.name] || ''}
                  onChange={(e) => handleLocalChange(input.name, parseFloat(e.target.value) || 0)}
                  onBlur={commitConfig}
                />
              )}
              
              {input.type === 'boolean' && (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localConfig[input.name] !== undefined ? localConfig[input.name].toString() : ''}
                  onChange={(e) => handleLocalChange(input.name, e.target.value === 'true')}
                  onBlur={commitConfig}
                >
                  <option value="">Seleccionar...</option>
                  <option value="true">Verdadero</option>
                  <option value="false">Falso</option>
                </select>
              )}
              
              {input.type === 'array' && (
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={input.defaultValue ? JSON.stringify(input.defaultValue, null, 2) : '[]'}
                  value={localConfig[input.name] ? JSON.stringify(localConfig[input.name], null, 2) : ''}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      handleLocalChange(input.name, parsed)
                    } catch {
                      // Invalid JSON, keep raw value for now
                    }
                  }}
                  onBlur={commitConfig}
                />
              )}
              
              {input.type === 'object' && (
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder={input.defaultValue ? JSON.stringify(input.defaultValue, null, 2) : '{}'}
                  value={localConfig[input.name] ? JSON.stringify(localConfig[input.name], null, 2) : ''}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      handleLocalChange(input.name, parsed)
                    } catch {
                      // Invalid JSON, keep raw value for now
                    }
                  }}
                  onBlur={commitConfig}
                />
              )}
              
              {/* Validation info */}
              {input.validation && (
                <div className="text-xs text-gray-400 mt-1">
                  {input.validation.pattern && <div>Patrón: {input.validation.pattern}</div>}
                  {input.validation.minLength && <div>Mín. caracteres: {input.validation.minLength}</div>}
                  {input.validation.maxLength && <div>Máx. caracteres: {input.validation.maxLength}</div>}
                  {input.validation.minimum !== undefined && <div>Valor mínimo: {input.validation.minimum}</div>}
                  {input.validation.maximum !== undefined && <div>Valor máximo: {input.validation.maximum}</div>}
                  {input.validation.enum && <div>Valores permitidos: {input.validation.enum.join(', ')}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Fallback para nodos sin metadata dinámica
    return (
      <div className="space-y-4">
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-800 font-medium text-sm">⚠️ Configuración Estática</div>
          <p className="text-yellow-700 text-xs mt-1">No se encontró metadata dinámica para este nodo</p>
        </div>
        
        <div className="text-center text-gray-500 py-4">
          <p>Configuración no disponible para este tipo de nodo</p>
          <p className="text-xs mt-2">Tipo: {selectedNode.data.type}</p>
        </div>
      </div>
    )
  }

  // Debug buttons (optional, can remove in production)
  const debugButtons = (
    <div className="space-y-2 p-3 bg-gray-50 border-t border-gray-200">
      <div className="text-xs text-gray-600">Debug:</div>
      <div className="flex gap-2">
        <button
          onClick={() => console.log('Current localConfig:', localConfig)}
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Log Config
        </button>
        <button
          onClick={() => console.log('Node metadata:', nodeMetadata)}
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          Log Metadata
        </button>
        <button
          onClick={commitConfig}
          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
        >
          Force Save
        </button>
      </div>
    </div>
  )

  return (
    <div className={clsx(
      'h-full bg-white border-l border-gray-200 transition-all duration-300 flex flex-col',
      isOpen ? 'w-80' : 'w-12'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        {isOpen && (
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-medium text-gray-900">
              ⚙️ Propiedades
            </h2>
            {nodeMetadata && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                🔗 dinámico
              </span>
            )}
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
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {renderNodeConfig()}
          </div>
          {/* Debug buttons in development */}
          {process.env.NODE_ENV === 'development' && debugButtons}
        </div>
      )}
    </div>
  )
}

export default PropertiesPanel
