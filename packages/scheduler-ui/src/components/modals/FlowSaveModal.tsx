import React, { useState } from 'react'
// Assuming you have these dependencies installed:
// npm install react-hook-form @hookform/resolvers zod @headlessui/react @heroicons/react react-hot-toast
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog } from '@headlessui/react'
import { XMarkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
// These are assumed to be your internal service and type definitions
import { flowService } from '@/services'
import { CreateFlowRequest, UpdateFlowRequest, FlowStatus } from '@/types/api'

// Zod schema for form validation
const flowSaveSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
})

// Type derived from the Zod schema
type FlowSaveFormData = z.infer<typeof flowSaveSchema>

// Props interface for the component
interface FlowSaveModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (flow: any) => void
  flowData: {
    nodes: any[]
    connections: any[]
    metadata?: Record<string, any>
  }
  existingFlow?: {
    id: string
    name: string
    description?: string
    status: FlowStatus
  }
}

/**
 * A modal component for saving or updating a flow, with validation and form handling.
 */
const FlowSaveModal: React.FC<FlowSaveModalProps> = ({
  isOpen,
  onClose,
  onSave,
  flowData,
  existingFlow,
}) => {
  // State for loading indicators and validation results
  const [isLoading, setIsLoading] = useState(false)
  const [validationResults, setValidationResults] = useState<any>(null)

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<FlowSaveFormData>({
    resolver: zodResolver(flowSaveSchema),
    defaultValues: {
      name: existingFlow?.name || '',
      description: existingFlow?.description || '',
    },
  })

  /**
   * Validates the flow data, checking for empty flows and server-side issues.
   * @returns {Promise<boolean>} - True if the flow is valid, false otherwise.
   */
  const validateFlow = async (): Promise<boolean> => {
    if (flowData.nodes.length === 0) {
      toast.error('Cannot save an empty flow.')
      return false
    }

    try {
      setIsLoading(true)
      // Only run server-side validation for existing flows
      if (existingFlow) {
        const validation = await flowService.validateFlow(existingFlow.id)
        setValidationResults(validation)

        if (!validation.valid) {
          toast.error(`Flow has ${validation.errors.length} validation errors.`)
          return false
        }

        if (validation.warnings.length > 0) {
          toast.error(`Flow has ${validation.warnings.length} warnings.`)
        }
      }
      return true
    } catch (error: any) {
      toast.error('Failed to validate flow: ' + error.message)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handles form submission, validates the flow, and calls the appropriate service.
   * @param data - The validated form data.
   */
  const onSubmit = async (data: FlowSaveFormData) => {
    const isValidFlow = await validateFlow()
    if (!isValidFlow) return

    setIsLoading(true)
    try {
      console.log('FlowSaveModal: Original flowData.nodes:', flowData.nodes)
      
      // Transform nodes to match backend expectations
      const transformedNodes = flowData.nodes.map(node => {
        console.log('FlowSaveModal: Processing node:', node)
        console.log('FlowSaveModal: Node has config directly:', node.config)
        console.log('FlowSaveModal: Node has data.config:', node.data?.config)
        const transformed = {
          id: node.id,
          type: node.data?.type || node.type,
          version: "1.0.0", // Default version
          position: {
            x: String(node.position?.x || 0),
            y: String(node.position?.y || 0)
          },
          config: node.config || node.data?.config || {}
        }
        console.log('FlowSaveModal: Transformed node:', transformed)
        console.log('FlowSaveModal: Final config being sent:', transformed.config)
        return transformed
      })
      
      console.log('FlowSaveModal: Final transformedNodes:', transformedNodes)

      // Transform connections to match backend expectations  
      const transformedConnections = flowData.connections.map(conn => {
        console.log('Connection data:', conn) // Debug log
        return {
          fromNodeId: String(conn.fromNodeId),
          fromOutput: String(conn.fromOutput || 'output'),
          toNodeId: String(conn.toNodeId),
          toInput: String(conn.toInput || 'input')
        }
      })

      let savedFlow
      if (existingFlow) {
        // Prepare and send update request (without status)
        const updateRequest: UpdateFlowRequest = {
          name: data.name,
          description: data.description,
          nodes: transformedNodes,
          connections: transformedConnections,
          metadata: flowData.metadata,
        }
        savedFlow = await flowService.updateFlow(existingFlow.id, updateRequest)
        toast.success('Flow updated successfully!')
      } else {
        // Prepare and send create request (without status)
        const createRequest: CreateFlowRequest = {
          name: data.name,
          description: data.description,
          nodes: transformedNodes,
          connections: transformedConnections,
          metadata: flowData.metadata,
        }
        savedFlow = await flowService.createFlow(createRequest)
        toast.success('Flow saved successfully!')
      }

      onSave(savedFlow)
      handleClose()
    } catch (error: any) {
      toast.error('Failed to save flow: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Resets form state and closes the modal.
   */
  const handleClose = () => {
    reset({
      name: existingFlow?.name || '',
      description: existingFlow?.description || '',
    })
    setValidationResults(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />

      {/* Modal Content */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                <DocumentCheckIcon className="w-5 h-5 mr-2 text-blue-600" />
                {existingFlow ? 'Update Flow' : 'Save New Flow'}
              </Dialog.Title>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Flow Name Input */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Flow Name *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  id="name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a name for the flow"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Description Input */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  {...register('description')}
                  id="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter an optional description"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Flow Statistics */}
              <div className="bg-gray-50 p-3 rounded-md border">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Flow Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nodes:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {flowData?.nodes?.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Connections:</span>
                    <span className="ml-2 font-medium text-gray-800">
                      {flowData?.connections?.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Validation Results Display */}
              {validationResults && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Validation Results
                  </h4>
                  {validationResults.errors.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm text-red-600 font-medium">
                        Errors ({validationResults.errors.length}):
                      </p>
                      <ul className="text-sm text-red-600 list-disc list-inside">
                        {validationResults.errors.map(
                          (error: any, index: number) => (
                            <li key={index}>{error.message}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                  {validationResults.warnings.length > 0 && (
                    <div>
                      <p className="text-sm text-yellow-700 font-medium">
                        Warnings ({validationResults.warnings.length}):
                      </p>
                      <ul className="text-sm text-yellow-700 list-disc list-inside">
                        {validationResults.warnings.map(
                          (warning: any, index: number) => (
                            <li key={index}>{warning.message}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !isValid || isLoading || flowData?.nodes?.length === 0
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? 'Saving...'
                    : existingFlow
                      ? 'Update Flow'
                      : 'Save Flow'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  )
}

export default FlowSaveModal
