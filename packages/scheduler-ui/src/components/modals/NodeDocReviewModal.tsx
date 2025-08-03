import React, { useState, useEffect } from 'react'
import {
  XMarkIcon,
  InformationCircleIcon,
  CodeBracketIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { dynamicNodeCatalogService } from '../../services/dynamic-node-catalog.service'

interface NodeDocumentationModalProps {
  isOpen: boolean
  onClose: () => void
  nodeType?: string
}

type TabType = 'overview' | 'usage' | 'requirements' | 'troubleshooting' | 'best-practices'

const NodeDocReviewModal: React.FC<NodeDocumentationModalProps> = ({
  isOpen,
  onClose,
  nodeType
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [documentation, setDocumentation] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && nodeType) {
      loadDocumentation()
    }
  }, [isOpen, nodeType])

  const loadDocumentation = async () => {
    if (!nodeType) return
    
    try {
      setLoading(true)
      const doc = await dynamicNodeCatalogService.getNodeDocumentation(nodeType)
      setDocumentation(doc)
    } catch (error) {
      console.error('Error loading documentation:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const tabs: Array<{ id: TabType; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overview', label: 'Información General', icon: InformationCircleIcon },
    { id: 'usage', label: 'Ejemplos de Uso', icon: CodeBracketIcon },
    { id: 'requirements', label: 'Requisitos', icon: TagIcon },
    { id: 'troubleshooting', label: 'Solución de Problemas', icon: ExclamationTriangleIcon },
    { id: 'best-practices', label: 'Mejores Prácticas', icon: LightBulbIcon }
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Propósito</h3>
        <p className="text-gray-700 leading-relaxed">
          {documentation?.purpose || 'Información no disponible'}
        </p>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Entradas</h3>
        <div className="space-y-2">
          {documentation?.inputs?.map((input: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-mono text-sm text-blue-600">{input.name}</span>
                <p className="text-xs text-gray-600 mt-1">{input.description}</p>
              </div>
              <span className="px-2 py-1 text-xs bg-white rounded font-mono">
                {input.type}
              </span>
            </div>
          )) || <p className="text-gray-500">Sin entradas definidas</p>}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Salidas</h3>
        <div className="space-y-2">
          {documentation?.outputs?.map((output: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <span className="font-mono text-sm text-green-600">{output.name}</span>
                <p className="text-xs text-gray-600 mt-1">{output.description}</p>
              </div>
              <span className="px-2 py-1 text-xs bg-white rounded font-mono">
                {output.type}
              </span>
            </div>
          )) || <p className="text-gray-500">Sin salidas definidas</p>}
        </div>
      </div>
    </div>
  )

  const renderUsageExamples = () => (
    <div className="space-y-6">
      {documentation?.usageExamples?.map((example: any, index: number) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{example.title}</h3>
          <p className="text-gray-600 mb-4">{example.description}</p>
          
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-green-400 text-sm">
              <code>{JSON.stringify(example.configuration, null, 2)}</code>
            </pre>
          </div>
          
          {example.expectedOutput && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Salida Esperada:</h4>
              <div className="bg-blue-50 rounded-lg p-3">
                <pre className="text-blue-800 text-sm">
                  <code>{JSON.stringify(example.expectedOutput, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )) || <p className="text-gray-500">No hay ejemplos disponibles</p>}
    </div>
  )

  const renderRequirements = () => (
    <div className="space-y-4">
      {documentation?.requirements?.map((req: string, index: number) => (
        <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
          <TagIcon className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-gray-700">{req}</p>
        </div>
      )) || <p className="text-gray-500">No hay requisitos específicos</p>}
    </div>
  )

  const renderTroubleshooting = () => (
    <div className="space-y-4">
      {documentation?.troubleshooting?.map((item: any, index: number) => (
        <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h3 className="text-lg font-semibold text-red-900 mb-2">{item.issue}</h3>
          <p className="text-red-700 mb-3">{item.description}</p>
          <div>
            <h4 className="text-sm font-semibold text-red-800 mb-2">Solución:</h4>
            <p className="text-red-700">{item.solution}</p>
          </div>
        </div>
      )) || <p className="text-gray-500">No hay problemas conocidos documentados</p>}
    </div>
  )

  const renderBestPractices = () => (
    <div className="space-y-4">
      {documentation?.bestPractices?.map((practice: string, index: number) => (
        <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
          <LightBulbIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-gray-700">{practice}</p>
        </div>
      )) || <p className="text-gray-500">No hay mejores prácticas documentadas</p>}
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'usage':
        return renderUsageExamples()
      case 'requirements':
        return renderRequirements()
      case 'troubleshooting':
        return renderTroubleshooting()
      case 'best-practices':
        return renderBestPractices()
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpenIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {documentation?.name || nodeType}
              </h2>
              <p className="text-sm text-gray-600">Documentación del Nodo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Cargando documentación...</span>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  )
}

export default NodeDocReviewModal
