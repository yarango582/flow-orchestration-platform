import React, { useState } from 'react'
import {
  XMarkIcon,
  InformationCircleIcon,
  CodeBracketIcon,
  CogIcon,
  ExclamationTriangleIcon,
  BookOpenIcon,
  ChartBarIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { NodeDocumentation, TypeDefinition, UsageExample } from '../../types/catalog'

interface NodeDocumentationModalProps {
  isOpen: boolean
  onClose: () => void
  documentation: NodeDocumentation | null
}

type TabType = 'overview' | 'inputs-outputs' | 'configuration' | 'examples' | 'validation' | 'performance'

const NodeDocumentationModal: React.FC<NodeDocumentationModalProps> = ({
  isOpen,
  onClose,
  documentation
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  if (!isOpen || !documentation) return null

  const tabs: Array<{ id: TabType; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overview', label: 'Información General', icon: InformationCircleIcon },
    { id: 'inputs-outputs', label: 'Entradas y Salidas', icon: CodeBracketIcon },
    { id: 'configuration', label: 'Configuración', icon: CogIcon },
    { id: 'examples', label: 'Ejemplos', icon: BookOpenIcon },
    { id: 'validation', label: 'Validación y Errores', icon: ExclamationTriangleIcon },
    { id: 'performance', label: 'Rendimiento', icon: ChartBarIcon }
  ]

  const Icon = documentation.icon

  const renderTypeDefinition = (typeDef: TypeDefinition) => (
    <div key={typeDef.name} className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-900">{typeDef.name}</span>
          <span className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded">
            {typeDef.type}
          </span>
          {typeDef.required && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
              Requerido
            </span>
          )}
        </div>
      </div>
      
      {typeDef.description && (
        <p className="text-gray-600 text-sm mb-3">{typeDef.description}</p>
      )}
      
      {typeDef.examples && typeDef.examples.length > 0 && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Ejemplos:</h5>
          <div className="space-y-1">
            {typeDef.examples.map((example, idx) => (
              <code key={idx} className="block text-xs bg-gray-50 p-2 rounded text-gray-800">
                {JSON.stringify(example, null, 2)}
              </code>
            ))}
          </div>
        </div>
      )}
      
      {typeDef.defaultValue !== undefined && (
        <div className="text-sm">
          <span className="font-medium text-gray-700">Valor por defecto: </span>
          <code className="bg-gray-50 px-2 py-1 rounded text-gray-800">
            {JSON.stringify(typeDef.defaultValue)}
          </code>
        </div>
      )}
    </div>
  )

  const renderUsageExample = (example: UsageExample, index: number) => (
    <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
      <h4 className="font-semibold text-gray-900 mb-2">{example.title}</h4>
      <p className="text-gray-600 text-sm mb-4">{example.description}</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Entrada:</h5>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto text-gray-800">
            {JSON.stringify(example.input, null, 2)}
          </pre>
        </div>
        
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Salida Esperada:</h5>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto text-gray-800">
            {JSON.stringify(example.expectedOutput, null, 2)}
          </pre>
        </div>
      </div>
      
      {example.config && (
        <div className="mt-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Configuración:</h5>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto text-gray-800">
            {JSON.stringify(example.config, null, 2)}
          </pre>
        </div>
      )}
      
      {example.notes && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <InformationCircleIcon className="w-4 h-4 inline mr-1" />
            {example.notes}
          </p>
        </div>
      )}
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Descripción</h3>
              <p className="text-gray-700">{documentation.description}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Propósito</h3>
              <p className="text-gray-700">{documentation.purpose}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Información Técnica</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Versión</div>
                  <div className="text-lg font-semibold text-gray-900">{documentation.version}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Categoría</div>
                  <div className="text-lg font-semibold text-gray-900 capitalize">
                    {documentation.category.replace('-', ' ')}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-500">Tipo</div>
                  <div className="text-lg font-mono text-gray-900">{documentation.type}</div>
                </div>
              </div>
            </div>

            {documentation.tags && documentation.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  <TagIcon className="w-5 h-5 inline mr-2" />
                  Etiquetas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {documentation.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {documentation.relatedNodes && documentation.relatedNodes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Nodos Relacionados</h3>
                <div className="flex flex-wrap gap-2">
                  {documentation.relatedNodes.map((nodeType, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded font-mono"
                    >
                      {nodeType}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'inputs-outputs':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipos de Entrada</h3>
              {documentation.inputTypes.length > 0 ? (
                <div className="space-y-4">
                  {documentation.inputTypes.map(renderTypeDefinition)}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay entradas definidas</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipos de Salida</h3>
              {documentation.outputTypes.length > 0 ? (
                <div className="space-y-4">
                  {documentation.outputTypes.map(renderTypeDefinition)}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay salidas definidas</p>
              )}
            </div>
          </div>
        )

      case 'configuration':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Opciones de Configuración</h3>
              {documentation.configurationOptions.length > 0 ? (
                <div className="space-y-4">
                  {documentation.configurationOptions.map((config, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">{config.name}</span>
                          <span className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded">
                            {config.type}
                          </span>
                          {config.required && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                              Requerido
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3">{config.description}</p>
                      
                      {config.defaultValue !== undefined && (
                        <div className="text-sm mb-2">
                          <span className="font-medium text-gray-700">Valor por defecto: </span>
                          <code className="bg-gray-50 px-2 py-1 rounded text-gray-800">
                            {JSON.stringify(config.defaultValue)}
                          </code>
                        </div>
                      )}
                      
                      {config.examples && config.examples.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Ejemplos:</h5>
                          <div className="flex flex-wrap gap-2">
                            {config.examples.map((example, idx) => (
                              <code key={idx} className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-800">
                                {JSON.stringify(example)}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay opciones de configuración específicas</p>
              )}
            </div>
          </div>
        )

      case 'examples':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ejemplos de Uso</h3>
              {documentation.usageExamples.length > 0 ? (
                <div className="space-y-6">
                  {documentation.usageExamples.map(renderUsageExample)}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay ejemplos disponibles</p>
              )}
            </div>
          </div>
        )

      case 'validation':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reglas de Validación</h3>
              {documentation.validationRules.length > 0 ? (
                <div className="space-y-3">
                  {documentation.validationRules.map((rule, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg ${
                        rule.severity === 'error'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <ExclamationTriangleIcon
                          className={`w-4 h-4 ${
                            rule.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{rule.field}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {rule.rule}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{rule.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay reglas de validación específicas</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Escenarios de Error</h3>
              {documentation.errorHandling.length > 0 ? (
                <div className="space-y-4">
                  {documentation.errorHandling.map((error, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                        <h4 className="font-semibold text-gray-900">{error.scenario}</h4>
                        <span className="px-2 py-1 text-xs font-mono bg-red-100 text-red-700 rounded">
                          {error.errorType}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Causa: </span>
                          <span className="text-gray-600">{error.cause}</span>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Solución: </span>
                          <span className="text-gray-600">{error.solution}</span>
                        </div>
                        
                        {error.prevention && (
                          <div>
                            <span className="font-medium text-gray-700">Prevención: </span>
                            <span className="text-gray-600">{error.prevention}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No hay escenarios de error documentados</p>
              )}
            </div>
          </div>
        )

      case 'performance':
        return (
          <div className="space-y-6">
            {documentation.performanceNotes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notas de Rendimiento</h3>
                <div className="space-y-2">
                  {documentation.performanceNotes.map((note, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <ChartBarIcon className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                      <p className="text-gray-700 text-sm">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {documentation.resourceRequirements && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Requisitos de Recursos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(documentation.resourceRequirements).map(([resource, requirement]) => (
                    requirement && (
                      <div key={resource} className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-500 capitalize mb-1">
                          {resource}
                        </div>
                        <div className="text-gray-900">{requirement}</div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {documentation.bestPractices.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mejores Prácticas</h3>
                <div className="space-y-2">
                  {documentation.bestPractices.map((practice, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 text-sm">{practice}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {documentation.commonPitfalls.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Errores Comunes</h3>
                <div className="space-y-2">
                  {documentation.commonPitfalls.map((pitfall, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 text-sm">{pitfall}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={onClose}
            >
              <span className="sr-only">Cerrar</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center space-x-4">
              {Icon && <Icon className="w-10 h-10 text-gray-600" />}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{documentation.name}</h2>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-sm text-gray-500">v{documentation.version}</span>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded capitalize">
                    {documentation.category.replace('-', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <TabIcon
                      className={`-ml-0.5 mr-2 h-5 w-5 ${
                        activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="mt-6 max-h-96 overflow-y-auto">
            {renderTabContent()}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NodeDocumentationModal