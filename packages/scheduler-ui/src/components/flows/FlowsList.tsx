import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { useFlowStore } from '@/stores/flow-store'
import { flowService, schedulerService } from '@/services'
import { Flow, FlowSummary, FlowStatus } from '@/types/api'
import { useLoadingState } from '@/hooks/useLoadingState'
import LoadingSpinner from '../ui/LoadingSpinner'

const FlowsList: React.FC = () => {
  const navigate = useNavigate()
  const { isLoading, withLoading } = useLoadingState()
  const { setCurrentFlow } = useFlowStore()
  
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FlowStatus | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  const PAGE_SIZE = 10

  useEffect(() => {
    loadFlows()
  }, [currentPage, searchQuery, statusFilter])

  const loadFlows = async () => {
    const result = await withLoading(async () => {
      try {
        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
          ...(searchQuery && { search: searchQuery }),
          ...(statusFilter !== 'all' && { status: statusFilter })
        }
        
        const response = await flowService.getFlows(params)
        setFlows(response.data)
        setTotalPages(Math.ceil(response.total / PAGE_SIZE))
        setTotalItems(response.total)
        return true
      } catch (error: any) {
        toast.error(`Failed to load flows: ${error.message}`)
        return false
      }
    })

    if (!result) {
      setFlows([])
    }
  }

  const handleCreateFlow = () => {
    setCurrentFlow(null)
    navigate('/flow-builder')
  }

  const handleEditFlow = async (flowId: string) => {
    const result = await withLoading(async () => {
      try {
        const flow = await flowService.getFlow(flowId)
        setCurrentFlow(flow)
        navigate('/flow-builder')
        return true
      } catch (error: any) {
        toast.error(`Failed to load flow: ${error.message}`)
        return false
      }
    })
  }

  const handleDuplicateFlow = async (flow: FlowSummary) => {
    const result = await withLoading(async () => {
      try {
        const duplicatedFlow = await flowService.duplicateFlow(flow.id, `${flow.name} (Copy)`)
        toast.success(`Flow "${duplicatedFlow.name}" created successfully`)
        loadFlows()
        return true
      } catch (error: any) {
        toast.error(`Failed to duplicate flow: ${error.message}`)
        return false
      }
    })
  }

  const handleDeleteFlow = async (flow: FlowSummary) => {
    if (!confirm(`Are you sure you want to delete "${flow.name}"? This action cannot be undone.`)) {
      return
    }

    const result = await withLoading(async () => {
      try {
        await flowService.deleteFlow(flow.id)
        toast.success(`Flow "${flow.name}" deleted successfully`)
        loadFlows()
        return true
      } catch (error: any) {
        // Handle specific error for flows with active schedules
        if (error.code === 'CONFLICT' || error.message?.includes('active schedules')) {
          toast.error(
            `Cannot delete "${flow.name}" because it has active schedules. Please disable or delete all associated schedules first.`,
            { duration: 6000 }
          )
        } else {
          toast.error(`Failed to delete flow: ${error.message}`)
        }
        return false
      }
    })
  }

  const handleExecuteFlow = async (flow: FlowSummary) => {
    const result = await withLoading(async () => {
      try {
        const execution = await schedulerService.executeFlow(flow.id)
        toast.success(`Flow execution started! Execution ID: ${execution.executionId}`)
        return true
      } catch (error: any) {
        toast.error(`Failed to execute flow: ${error.message}`)
        return false
      }
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (status: FlowStatus | 'all') => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const getStatusBadge = (status: FlowStatus) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      archived: 'bg-red-100 text-red-800'
    }
    return badges[status] || badges.draft
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flows</h1>
          <p className="text-gray-600 mt-1">
            Manage and organize your data processing flows
          </p>
        </div>
        <button
          onClick={handleCreateFlow}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Create Flow</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flows..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as FlowStatus | 'all')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flows List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : flows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <DocumentDuplicateIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No flows found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first flow.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button onClick={handleCreateFlow} className="btn-primary">
              Create Your First Flow
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nodes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flows && flows.length > 0 && flows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {flow.name}
                        </div>
                        {flow.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {flow.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(flow.status)}`}>
                        {flow.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {flow.nodeCount || 0} nodes
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(flow.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(flow.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleExecuteFlow(flow)}
                          disabled={flow.status !== 'active'}
                          className="text-green-600 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                          title="Execute Flow"
                        >
                          <PlayIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditFlow(flow.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit Flow"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateFlow(flow)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Duplicate Flow"
                        >
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFlow(flow)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Flow"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                  {totalItems} flows
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
    </div>
  )
}

export default FlowsList