import React, { useState } from 'react'
import {
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { useSchedulerStore } from '@/stores/scheduler-store'
import { Schedule } from '@/types/api'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useLoadingState } from '@/hooks/useLoadingState'

interface BulkOperationsPanelProps {
  selectedSchedules: Schedule[]
  onSelectionChange: (schedules: Schedule[]) => void
  onRefresh: () => void
}

const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  selectedSchedules,
  onSelectionChange,
  onRefresh
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<'enable' | 'disable' | 'delete' | null>(null)
  
  const { bulkEnableSchedules, bulkDisableSchedules, deleteSchedule } = useSchedulerStore()
  const { handleError } = useErrorHandler()
  const { isLoading, withLoading } = useLoadingState()

  const selectedCount = selectedSchedules.length
  const enabledCount = selectedSchedules.filter(s => s.enabled).length
  const disabledCount = selectedCount - enabledCount

  const handleBulkEnable = async () => {
    const scheduleIds = selectedSchedules
      .filter(s => !s.enabled)
      .map(s => s.id)
    
    if (scheduleIds.length === 0) {
      toast.error('No disabled schedules selected')
      return
    }

    const result = await withLoading(async () => {
      return await bulkEnableSchedules(scheduleIds)
    })

    if (result) {
      const { successCount, failureCount, errors } = result
      
      if (successCount > 0) {
        toast.success(`Successfully enabled ${successCount} schedule${successCount > 1 ? 's' : ''}`)
      }
      
      if (failureCount > 0) {
        toast.error(`Failed to enable ${failureCount} schedule${failureCount > 1 ? 's' : ''}`)
        errors.forEach(error => {
          console.error(`Failed to enable schedule ${error.scheduleId}: ${error.error}`)
        })
      }
      
      onSelectionChange([])
      onRefresh()
    }
  }

  const handleBulkDisable = async () => {
    const scheduleIds = selectedSchedules
      .filter(s => s.enabled)
      .map(s => s.id)
    
    if (scheduleIds.length === 0) {
      toast.error('No enabled schedules selected')
      return
    }

    const result = await withLoading(async () => {
      return await bulkDisableSchedules(scheduleIds)
    })

    if (result) {
      const { successCount, failureCount, errors } = result
      
      if (successCount > 0) {
        toast.success(`Successfully disabled ${successCount} schedule${successCount > 1 ? 's' : ''}`)
      }
      
      if (failureCount > 0) {
        toast.error(`Failed to disable ${failureCount} schedule${failureCount > 1 ? 's' : ''}`)
        errors.forEach(error => {
          console.error(`Failed to disable schedule ${error.scheduleId}: ${error.error}`)
        })
      }
      
      onSelectionChange([])
      onRefresh()
    }
  }

  const handleBulkDelete = async () => {
    if (!pendingOperation) return

    let successCount = 0
    let failureCount = 0
    const errors: string[] = []

    await withLoading(async () => {
      for (const schedule of selectedSchedules) {
        try {
          await deleteSchedule(schedule.id)
          successCount++
        } catch (error: any) {
          failureCount++
          errors.push(`${schedule.name}: ${error.message}`)
        }
      }
    })

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} schedule${successCount > 1 ? 's' : ''}`)
    }
    
    if (failureCount > 0) {
      toast.error(`Failed to delete ${failureCount} schedule${failureCount > 1 ? 's' : ''}`)
      errors.forEach(error => console.error(`Delete error: ${error}`))
    }
    
    setShowConfirmDialog(false)
    setPendingOperation(null)
    onSelectionChange([])
    onRefresh()
  }

  const confirmBulkOperation = (operation: 'enable' | 'disable' | 'delete') => {
    if (operation === 'delete') {
      setPendingOperation(operation)
      setShowConfirmDialog(true)
    } else if (operation === 'enable') {
      handleBulkEnable()
    } else if (operation === 'disable') {
      handleBulkDisable()
    }
  }

  const getOperationText = () => {
    if (pendingOperation === 'delete') {
      return {
        title: 'Delete Schedules',
        message: `Are you sure you want to delete ${selectedCount} schedule${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmClass: 'bg-red-600 hover:bg-red-700'
      }
    }
    return { title: '', message: '', confirmText: '', confirmClass: '' }
  }

  if (selectedCount === 0) {
    return null
  }

  const operationText = getOperationText()

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedCount} schedule{selectedCount > 1 ? 's' : ''} selected
              </span>
            </div>
            
            {enabledCount > 0 && (
              <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">
                {enabledCount} enabled
              </span>
            )}
            
            {disabledCount > 0 && (
              <span className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {disabledCount} disabled
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {disabledCount > 0 && (
              <button
                onClick={() => confirmBulkOperation('enable')}
                disabled={isLoading}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="w-4 h-4" />
                <span>Enable {disabledCount}</span>
              </button>
            )}
            
            {enabledCount > 0 && (
              <button
                onClick={() => confirmBulkOperation('disable')}
                disabled={isLoading}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PauseIcon className="w-4 h-4" />
                <span>Disable {enabledCount}</span>
              </button>
            )}
            
            <button
              onClick={() => confirmBulkOperation('delete')}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Delete</span>
            </button>
            
            <div className="w-px h-4 bg-gray-300" />
            
            <button
              onClick={() => onSelectionChange([])}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear selection
            </button>
          </div>
        </div>
        
        {isLoading && (
          <div className="mt-3 flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-700">Processing operation...</span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <TrashIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {operationText.title}
                  </h3>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-6">
                {operationText.message}
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setPendingOperation(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${operationText.confirmClass}`}
                >
                  {isLoading ? 'Deleting...' : operationText.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BulkOperationsPanel
