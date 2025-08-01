import React, { useState } from 'react'
import {
  PlayIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  EyeIcon,
  FolderOpenIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { useFlowStore } from '@/stores/flow-store'
import { schedulerService } from '@/services'
import FlowSaveModal from '@/components/modals/FlowSaveModal'
import FlowLoadModal from '@/components/modals/FlowLoadModal'

interface FlowToolbarProps {
  flowData: {
    nodes: any[]
    connections: any[]
    metadata?: Record<string, any>
  }
  onFlowLoad: (flow: any) => void
  onClearCanvas: () => void
  onPreview: () => void
  isDirty: boolean
}

const FlowToolbar: React.FC<FlowToolbarProps> = ({
  flowData,
  onFlowLoad,
  onClearCanvas,
  onPreview,
  isDirty,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const { currentFlow, setCurrentFlow } = useFlowStore()

  const handleSaveFlow = (savedFlow: any) => {
    setCurrentFlow(savedFlow)
    toast.success('Flow saved successfully')
  }

  const handleLoadFlow = (loadedFlow: any) => {
    setCurrentFlow(loadedFlow)
    onFlowLoad(loadedFlow)
    toast.success(`Flow "${loadedFlow.name}" loaded successfully`)
  }

  const handleExportFlow = () => {
    if (flowData.nodes.length === 0) {
      toast.error('Cannot export empty flow')
      return
    }

    const exportData = {
      name: currentFlow?.name || 'Untitled Flow',
      description: currentFlow?.description || '',
      nodes: flowData.nodes,
      connections: flowData.connections,
      metadata: {
        ...flowData.metadata,
        exportedAt: new Date().toISOString(),
        version: currentFlow?.version || 1,
      },
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportData.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Flow exported successfully')
  }

  const handleImportFlow = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = e => {
        try {
          const importedFlow = JSON.parse(e.target?.result as string)

          // Validate the imported flow structure
          if (!importedFlow.nodes || !importedFlow.connections) {
            toast.error('Invalid flow file format')
            return
          }

          // Clear current flow and load imported data
          onFlowLoad(importedFlow)
          setCurrentFlow(null) // Reset current flow since this is imported
          toast.success(
            `Flow "${importedFlow.name || 'Imported Flow'}" imported successfully`
          )
        } catch (error) {
          toast.error('Failed to parse flow file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleClearCanvas = () => {
    if (flowData?.nodes?.length === 0) {
      toast.error('Canvas is already empty')
      return
    }

    if (
      isDirty &&
      !confirm(
        'Are you sure you want to clear the canvas? Any unsaved changes will be lost.'
      )
    ) {
      return
    }

    onClearCanvas()
    setCurrentFlow(null)
    toast.success('Canvas cleared')
  }

  const handleExecuteFlow = async () => {
    if (!currentFlow) {
      toast.error('Please save the flow before executing it')
      return
    }

    if (flowData.nodes.length === 0) {
      toast.error('Cannot execute an empty flow')
      return
    }

    setIsExecuting(true)
    try {
      const result = await schedulerService.executeFlow(currentFlow.id, {
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
        nodes: flowData.nodes,
        connections: flowData.connections
      })

      toast.success(`Flow execution started! Execution ID: ${result.executionId}`)
      
      // Optionally navigate to execution details or show a modal
    } catch (error: any) {
      toast.error(`Failed to execute flow: ${error.message}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const getFlowStatus = () => {
    if (!currentFlow) {
      return flowData?.nodes?.length > 0 ? 'Unsaved changes' : 'New flow'
    }
    return isDirty ? 'Unsaved changes' : 'Saved'
  }

  const getStatusColor = () => {
    if (!currentFlow || isDirty) {
      return 'bg-yellow-100 text-yellow-800'
    }
    return 'bg-green-100 text-green-800'
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Flow Builder
            </h2>
            <span className={`px-2 py-1 text-xs rounded ${getStatusColor()}`}>
              {getFlowStatus()}
            </span>
            {currentFlow && (
              <span className="text-sm text-gray-600">
                {currentFlow.name} (v{currentFlow.version})
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onPreview}
              className="btn-secondary flex items-center space-x-2"
              disabled={flowData?.nodes?.length === 0}
            >
              <EyeIcon className="w-4 h-4" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => setShowLoadModal(true)}
              className="btn-secondary flex items-center space-x-2"
            >
              <FolderOpenIcon className="w-4 h-4" />
              <span>Load</span>
            </button>

            <button
              onClick={handleImportFlow}
              className="btn-secondary flex items-center space-x-2"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              <span>Import</span>
            </button>

            <button
              onClick={handleExportFlow}
              className="btn-secondary flex items-center space-x-2"
              disabled={flowData?.nodes?.length === 0}
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              <span>Export</span>
            </button>

            <div className="w-px h-6 bg-gray-300 mx-2"></div>

            <button
              onClick={handleClearCanvas}
              className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Clear</span>
            </button>

            <button
              onClick={handleExecuteFlow}
              className="btn-success flex items-center space-x-2"
              disabled={!currentFlow || flowData?.nodes?.length === 0 || isExecuting}
            >
              <PlayIcon className="w-4 h-4" />
              <span>{isExecuting ? 'Executing...' : 'Execute Flow'}</span>
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              className="btn-primary flex items-center space-x-2"
              disabled={flowData?.nodes?.length === 0}
            >
              <DocumentCheckIcon className="w-4 h-4" />
              <span>{currentFlow ? 'Update Flow' : 'Save Flow'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FlowSaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveFlow}
        flowData={flowData}
        existingFlow={currentFlow}
      />

      <FlowLoadModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadFlow}
      />
    </>
  )
}

export default FlowToolbar
