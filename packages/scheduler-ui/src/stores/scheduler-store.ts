import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { schedulerService, realtimeService } from '@/services'
import { 
  Schedule, 
  CreateScheduleRequest, 
  UpdateScheduleRequest, 
  Execution, 
  ExecutionDetail,
  JobStats,
  BulkOperationResult
} from '@/types/api'

interface SchedulerStore {
  // State
  schedules: Schedule[]
  executions: Execution[]
  jobStats: JobStats | null
  runningExecutions: Execution[]
  isLoading: boolean
  error: string | null

  // Actions
  setSchedules: (schedules: Schedule[]) => void
  setExecutions: (executions: Execution[]) => void
  setJobStats: (stats: JobStats) => void
  setRunningExecutions: (executions: Execution[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Schedule Operations
  loadSchedules: (params?: any) => Promise<void>
  createSchedule: (request: CreateScheduleRequest) => Promise<Schedule>
  updateSchedule: (id: string, request: UpdateScheduleRequest) => Promise<Schedule>
  deleteSchedule: (id: string) => Promise<void>
  enableSchedule: (id: string) => Promise<Schedule>
  disableSchedule: (id: string) => Promise<Schedule>
  bulkEnableSchedules: (scheduleIds: string[]) => Promise<BulkOperationResult>
  bulkDisableSchedules: (scheduleIds: string[]) => Promise<BulkOperationResult>

  // Execution Operations
  loadExecutions: (params?: any) => Promise<void>
  getExecution: (id: string) => Promise<ExecutionDetail>
  retryExecution: (id: string) => Promise<void>
  cancelExecution: (id: string) => Promise<void>
  executeFlow: (flowId: string, metadata?: Record<string, any>) => Promise<string>

  // Monitoring
  loadJobStats: () => Promise<void>
  loadRunningExecutions: () => Promise<void>
  subscribeToRealtimeUpdates: () => void
  unsubscribeFromRealtimeUpdates: () => void

  // Utility functions
  getScheduleById: (id: string) => Schedule | undefined
  getExecutionById: (id: string) => Execution | undefined
  getSchedulesForFlow: (flowId: string) => Schedule[]
  clearError: () => void
  reset: () => void
}

export const useSchedulerStore = create<SchedulerStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    schedules: [],
    executions: [],
    jobStats: null,
    runningExecutions: [],
    isLoading: false,
    error: null,

    // Basic setters
    setSchedules: (schedules) => set({ schedules }),
    setExecutions: (executions) => set({ executions }),
    setJobStats: (stats) => set({ jobStats: stats }),
    setRunningExecutions: (executions) => set({ runningExecutions: executions }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // Schedule Operations
    loadSchedules: async (params) => {
      try {
        set({ isLoading: true, error: null })
        const response = await schedulerService.getSchedules(params)
        set({ schedules: response.data })
      } catch (error: any) {
        set({ error: error.message || 'Failed to load schedules' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    createSchedule: async (request: CreateScheduleRequest) => {
      try {
        set({ isLoading: true, error: null })
        const schedule = await schedulerService.createSchedule(request)
        
        // Add to schedules list
        const schedules = [...get().schedules, schedule]
        set({ schedules })
        
        return schedule
      } catch (error: any) {
        set({ error: error.message || 'Failed to create schedule' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    updateSchedule: async (id: string, request: UpdateScheduleRequest) => {
      try {
        set({ isLoading: true, error: null })
        const schedule = await schedulerService.updateSchedule(id, request)
        
        // Update schedule in list
        const schedules = get().schedules.map(s => 
          s.id === id ? schedule : s
        )
        set({ schedules })
        
        return schedule
      } catch (error: any) {
        set({ error: error.message || 'Failed to update schedule' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    deleteSchedule: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        await schedulerService.deleteSchedule(id)
        
        // Remove from schedules list
        const schedules = get().schedules.filter(s => s.id !== id)
        set({ schedules })
      } catch (error: any) {
        set({ error: error.message || 'Failed to delete schedule' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    enableSchedule: async (id: string) => {
      try {
        const schedule = await schedulerService.enableSchedule(id)
        
        // Update schedule in list
        const schedules = get().schedules.map(s => 
          s.id === id ? schedule : s
        )
        set({ schedules })
        
        return schedule
      } catch (error: any) {
        set({ error: error.message || 'Failed to enable schedule' })
        throw error
      }
    },

    disableSchedule: async (id: string) => {
      try {
        const schedule = await schedulerService.disableSchedule(id)
        
        // Update schedule in list
        const schedules = get().schedules.map(s => 
          s.id === id ? schedule : s
        )
        set({ schedules })
        
        return schedule
      } catch (error: any) {
        set({ error: error.message || 'Failed to disable schedule' })
        throw error
      }
    },

    bulkEnableSchedules: async (scheduleIds: string[]) => {
      try {
        set({ isLoading: true, error: null })
        const result = await schedulerService.enableSchedules(scheduleIds)
        
        // Refresh schedules to get updated states
        await get().loadSchedules()
        
        return result
      } catch (error: any) {
        set({ error: error.message || 'Failed to enable schedules' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    bulkDisableSchedules: async (scheduleIds: string[]) => {
      try {
        set({ isLoading: true, error: null })
        const result = await schedulerService.disableSchedules(scheduleIds)
        
        // Refresh schedules to get updated states
        await get().loadSchedules()
        
        return result
      } catch (error: any) {
        set({ error: error.message || 'Failed to disable schedules' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    // Execution Operations
    loadExecutions: async (params) => {
      try {
        set({ isLoading: true, error: null })
        const response = await schedulerService.getExecutions(params)
        set({ executions: response.data })
      } catch (error: any) {
        set({ error: error.message || 'Failed to load executions' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    getExecution: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        const execution = await schedulerService.getExecution(id)
        return execution
      } catch (error: any) {
        set({ error: error.message || 'Failed to load execution' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    retryExecution: async (id: string) => {
      try {
        await schedulerService.retryExecution(id)
        
        // Refresh executions to get updated states
        await get().loadExecutions()
      } catch (error: any) {
        set({ error: error.message || 'Failed to retry execution' })
        throw error
      }
    },

    cancelExecution: async (id: string) => {
      try {
        await schedulerService.cancelExecution(id)
        
        // Update execution in list
        const executions = get().executions.map(e => 
          e.id === id ? { ...e, status: 'cancelled' as const } : e
        )
        set({ executions })
        
        // Remove from running executions
        const runningExecutions = get().runningExecutions.filter(e => e.id !== id)
        set({ runningExecutions })
      } catch (error: any) {
        set({ error: error.message || 'Failed to cancel execution' })
        throw error
      }
    },

    executeFlow: async (flowId: string, metadata?: Record<string, any>) => {
      try {
        const result = await schedulerService.executeFlow(flowId, metadata)
        
        // Refresh executions and running executions
        await Promise.all([
          get().loadExecutions(),
          get().loadRunningExecutions()
        ])
        
        return result.executionId
      } catch (error: any) {
        set({ error: error.message || 'Failed to execute flow' })
        throw error
      }
    },

    // Monitoring
    loadJobStats: async () => {
      try {
        const stats = await schedulerService.getJobStats()
        set({ jobStats: stats })
      } catch (error: any) {
        set({ error: error.message || 'Failed to load job stats' })
        throw error
      }
    },

    loadRunningExecutions: async () => {
      try {
        const executions = await schedulerService.getRunningExecutions()
        set({ runningExecutions: executions })
      } catch (error: any) {
        set({ error: error.message || 'Failed to load running executions' })
        throw error
      }
    },

    subscribeToRealtimeUpdates: () => {
      // Subscribe to system updates for job stats
      realtimeService.subscribeToSystemUpdates((update) => {
        if (update.type === 'job_stats') {
          set({ jobStats: update.data })
        }
      })

      // Subscribe to all executions for real-time updates
      realtimeService.subscribeToAllExecutions((update) => {
        const { executions, runningExecutions } = get()
        
        // Update executions list
        const updatedExecutions = executions.map(e => 
          e.id === update.executionId ? { ...e, ...update } : e
        )
        
        // Update running executions
        let updatedRunningExecutions = [...runningExecutions]
        
        if (update.status === 'running') {
          // Add to running if not already there
          if (!updatedRunningExecutions.find(e => e.id === update.executionId)) {
            updatedRunningExecutions.push(update as any)
          } else {
            // Update existing
            updatedRunningExecutions = updatedRunningExecutions.map(e =>
              e.id === update.executionId ? { ...e, ...update } : e
            )
          }
        } else if (['success', 'failed', 'cancelled', 'timeout'].includes(update.status)) {
          // Remove from running executions
          updatedRunningExecutions = updatedRunningExecutions.filter(e => e.id !== update.executionId)
        }
        
        set({ 
          executions: updatedExecutions,
          runningExecutions: updatedRunningExecutions
        })
      })
    },

    unsubscribeFromRealtimeUpdates: () => {
      realtimeService.unsubscribeFromSystemUpdates()
      realtimeService.unsubscribeFromAllExecutions()
    },

    // Utility functions
    getScheduleById: (id: string) => {
      return get().schedules.find(s => s.id === id)
    },

    getExecutionById: (id: string) => {
      return get().executions.find(e => e.id === id)
    },

    getSchedulesForFlow: (flowId: string) => {
      return get().schedules.filter(s => s.flowId === flowId)
    },

    clearError: () => set({ error: null }),

    reset: () => set({
      schedules: [],
      executions: [],
      jobStats: null,
      runningExecutions: [],
      isLoading: false,
      error: null
    })
  }))
)