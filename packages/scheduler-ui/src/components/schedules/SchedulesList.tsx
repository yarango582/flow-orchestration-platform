import React, { useState, useEffect } from 'react'
import {
  ClockIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { schedulerService } from '@/services'
import { Schedule } from '@/types/api'
import { useLoadingState } from '@/hooks/useLoadingState'
import LoadingSpinner from '../ui/LoadingSpinner'
import ScheduleFormModal from '../modals/ScheduleFormModal'

const SchedulesList: React.FC = () => {
  const { isLoading, withLoading } = useLoadingState()
  
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const PAGE_SIZE = 20

  useEffect(() => {
    loadSchedulesData()
  }, [currentPage, searchQuery, statusFilter])

  const loadSchedulesData = async () => {
    await withLoading(async () => {
      try {
        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
          ...(searchQuery && { search: searchQuery }),
          ...(statusFilter !== 'all' && { enabled: statusFilter === 'enabled' })
        }
        
        const response = await schedulerService.getSchedules(params)
        setSchedules(response.data || [])
        setTotalPages(Math.ceil((response.pagination?.total || 0) / PAGE_SIZE))
        setTotalItems(response.pagination?.total || 0)
      } catch (error: any) {
        toast.error(`Failed to load schedules: ${error.message}`)
        setSchedules([])
      }
    })
  }

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!confirm(`Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`)) {
      return
    }

    await withLoading(async () => {
      try {
        await schedulerService.deleteSchedule(schedule.id)
        toast.success(`Schedule "${schedule.name}" deleted successfully`)
        loadSchedulesData()
      } catch (error: any) {
        // Handle specific error for DELETE operations that return no JSON
        if (error.message?.includes('Unexpected end of JSON input')) {
          // If it's the JSON parsing error, it might actually be a successful delete (204 No Content)
          toast.success(`Schedule "${schedule.name}" deleted successfully`)
          loadSchedulesData()
        } else {
          toast.error(`Failed to delete schedule: ${error.message}`)
        }
      }
    })
  }

  const handleToggleSchedule = async (schedule: Schedule) => {
    await withLoading(async () => {
      try {
        if (schedule.enabled) {
          await schedulerService.disableSchedule(schedule.id)
        } else {
          await schedulerService.enableSchedule(schedule.id)
        }
        const action = schedule.enabled ? 'disabled' : 'enabled'
        toast.success(`Schedule "${schedule.name}" has been ${action}`)
        loadSchedulesData()
      } catch (error: any) {
        toast.error(`Failed to toggle schedule: ${error.message}`)
      }
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (status: 'all' | 'enabled' | 'disabled') => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const handleCreateSchedule = (newSchedule: Schedule) => {
    setSchedules(prev => [newSchedule, ...prev])
    setShowCreateModal(false)
    toast.success('Schedule created successfully!')
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

  const getStatusBadge = (enabled: boolean) => {
    return enabled 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800'
  }

  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = !searchQuery || 
      schedule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schedule.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      (statusFilter === 'all') ||
      (statusFilter === 'enabled' && schedule.enabled) ||
      (statusFilter === 'disabled' && !schedule.enabled)
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-600 mt-1">
            Manage automated flow execution schedules
          </p>
        </div>
        <button
          className="btn-primary flex items-center space-x-2"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon className="w-5 h-5" />
          <span>Create Schedule</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search schedules..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'enabled' | 'disabled')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedules List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <ClockIcon className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first schedule.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {schedule.name}
                        </div>
                        {schedule.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {schedule.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Flow ID: {schedule.flowId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(schedule.enabled)}`}>
                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {schedule.cronExpression}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {schedule.nextRun ? formatDate(schedule.nextRun) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {schedule.lastRun ? formatDate(schedule.lastRun) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleToggleSchedule(schedule)}
                          className={`${
                            schedule.enabled 
                              ? 'text-yellow-600 hover:text-yellow-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                          title={schedule.enabled ? 'Disable Schedule' : 'Enable Schedule'}
                        >
                          {schedule.enabled ? (
                            <PauseIcon className="w-4 h-4" />
                          ) : (
                            <PlayIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Schedule"
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
                  {totalItems} schedules
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

      {/* Create Schedule Modal */}
      <ScheduleFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateSchedule}
      />
    </div>
  )
}

export default SchedulesList