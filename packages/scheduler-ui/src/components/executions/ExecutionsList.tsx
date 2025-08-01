import React, { useState, useEffect } from 'react'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { schedulerService } from '@/services'
import { Execution, ExecutionStatus } from '@/types/api'
import { useLoadingState } from '@/hooks/useLoadingState'
import LoadingSpinner from '../ui/LoadingSpinner'
import ExecutionDetailsModal from '../modals/ExecutionDetailsModal'

const ExecutionsList: React.FC = () => {
  const { isLoading, withLoading } = useLoadingState()

  const [executions, setExecutions] = useState<Execution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const PAGE_SIZE = 20

  useEffect(() => {
    loadExecutions()
  }, [currentPage, searchQuery, statusFilter])

  // Auto-refresh running executions every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (executions.some(execution => execution.status === 'running')) {
        loadExecutions()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [executions])

  const loadExecutions = async () => {
    const result = await withLoading(async () => {
      try {
        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
          ...(searchQuery && { search: searchQuery }),
          ...(statusFilter !== 'all' && { status: statusFilter })
        }

        const response = await schedulerService.getExecutions(params)
        setExecutions(response.data)
        setTotalPages(Math.ceil(response.total / PAGE_SIZE))
        setTotalItems(response.total)
        return true
      } catch (error: any) {
        toast.error(`Failed to load executions: ${error.message}`)
        return false
      }
    })

    if (!result) {
      setExecutions([])
    }
  }

  const handleViewDetails = (execution: Execution) => {
    setSelectedExecution(execution)
    setShowDetailsModal(true)
  }

  const handleRetryExecution = async (execution: Execution) => {
    if (execution.status !== 'failed') {
      toast.error('Only failed executions can be retried')
      return
    }

    const result = await withLoading(async () => {
      try {
        const retryResult = await schedulerService.retryExecution(execution.id)
        toast.success(`Execution retried successfully! New execution ID: ${retryResult.executionId}`)
        loadExecutions()
        return true
      } catch (error: any) {
        toast.error(`Failed to retry execution: ${error.message}`)
        return false
      }
    })
  }

  const handleCancelExecution = async (execution: Execution) => {
    if (execution.status !== 'running') {
      toast.error('Only running executions can be cancelled')
      return
    }

    if (!confirm(`Are you sure you want to cancel the execution for "${execution.flowName}"?`)) {
      return
    }

    const result = await withLoading(async () => {
      try {
        await schedulerService.cancelExecution(execution.id)
        toast.success('Execution cancelled successfully')
        loadExecutions()
        return true
      } catch (error: any) {
        toast.error(`Failed to cancel execution: ${error.message}`)
        return false
      }
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (status: ExecutionStatus | 'all') => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'success':
        return CheckCircleIcon
      case 'failed':
        return XCircleIcon
      case 'running':
        return ClockIcon
      case 'cancelled':
        return StopIcon
      case 'pending':
        return ClockIcon
      default:
        return InformationCircleIcon
    }
  }

  const getStatusBadge = (status: ExecutionStatus) => {
    const badges = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800'
    }
    return badges[status] || badges.pending
  }

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'N/A'

    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = end.getTime() - start.getTime()

    if (duration < 1000) return '<1s'

    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatRecordsProcessed = (count?: number) => {
    if (count === undefined || count === null) return 'N/A'
    return count.toLocaleString()
  }

  const filteredExecutions = executions?.length > 0 ? executions.filter(execution => {
    const matchesSearch = !searchQuery ||
      execution.flowName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.scheduleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || execution.status === statusFilter

    return matchesSearch && matchesStatus
  }) : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage flow execution history and status
          </p>
        </div>
        <button
          onClick={loadExecutions}
          className="btn-secondary flex items-center space-x-2"
        >
          <ArrowPathIcon className="w-5 h-5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search executions..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as ExecutionStatus | 'all')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executions List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredExecutions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <ClockIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No executions found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No executions have been run yet. Execute a flow to see results here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Execution
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExecutions.map((execution) => {
                  const StatusIcon = getStatusIcon(execution.status)

                  return (
                    <tr key={execution.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {execution.id}
                          </div>
                          {execution.scheduleName && (
                            <div className="text-sm text-gray-500">
                              Schedule: {execution.scheduleName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {execution.flowName || 'Unknown Flow'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <StatusIcon className={`w-4 h-4 mr-2 ${execution.status === 'running' ? 'animate-spin' : ''}`} />
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(execution.status)}`}>
                            {execution.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(execution.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(execution.startTime, execution.endTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatRecordsProcessed(execution.recordsProcessed)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(execution)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>

                          {execution.status === 'failed' && (
                            <button
                              onClick={() => handleRetryExecution(execution)}
                              className="text-green-600 hover:text-green-900"
                              title="Retry Execution"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </button>
                          )}

                          {execution.status === 'running' && (
                            <button
                              onClick={() => handleCancelExecution(execution)}
                              className="text-red-600 hover:text-red-900"
                              title="Cancel Execution"
                            >
                              <StopIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(currentPage * PAGE_SIZE, totalItems)} of{' '}
                  {totalItems} executions
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Execution Details Modal */}
      <ExecutionDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setSelectedExecution(null)
        }}
        execution={selectedExecution}
      />
    </div>
  )
}

export default ExecutionsList