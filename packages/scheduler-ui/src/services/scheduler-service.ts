/**
 * Scheduler Service
 * Handles all operations related to schedules, executions, and job monitoring
 */

import { apiClient } from './api-client'
import {
  Schedule,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  Execution,
  ExecutionDetail,
  ExecutionLog,
  BulkOperationResult,
  JobStats,
  ScheduleQueryParams,
  ExecutionQueryParams,
  ExecutionLogParams,
  ApiResponse
} from '@/types/api'

export class SchedulerService {
  /**
   * Get paginated list of schedules
   */
  async getSchedules(params?: ScheduleQueryParams): Promise<ApiResponse<Schedule[]>> {
    const response = await apiClient.get<{ data: ApiResponse<Schedule[]> }>(
      apiClient.getUrl('/scheduler/schedules'),
      params
    )
    return response.data
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.get<{ data: Schedule }>(
      apiClient.getUrl(`/scheduler/schedules/${id}`)
    )
    return response.data
  }

  /**
   * Create new schedule
   */
  async createSchedule(schedule: CreateScheduleRequest): Promise<Schedule> {
    const response = await apiClient.post<{ data: Schedule }>(
      apiClient.getUrl('/scheduler/schedules'),
      schedule
    )
    return response.data
  }

  /**
   * Update existing schedule
   */
  async updateSchedule(id: string, schedule: UpdateScheduleRequest): Promise<Schedule> {
    const response = await apiClient.put<{ data: Schedule }>(
      apiClient.getUrl(`/scheduler/schedules/${id}`),
      schedule
    )
    return response.data
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    await apiClient.delete<void>(
      apiClient.getUrl(`/scheduler/schedules/${id}`)
    )
  }

  /**
   * Enable schedule
   */
  async enableSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.post<{ data: Schedule }>(
      apiClient.getUrl(`/scheduler/schedules/${id}/enable`)
    )
    return response.data
  }

  /**
   * Disable schedule
   */
  async disableSchedule(id: string): Promise<Schedule> {
    const response = await apiClient.post<{ data: Schedule }>(
      apiClient.getUrl(`/scheduler/schedules/${id}/disable`)
    )
    return response.data
  }

  /**
   * Enable multiple schedules
   */
  async enableSchedules(scheduleIds: string[]): Promise<BulkOperationResult> {
    const response = await apiClient.post<{ data: BulkOperationResult }>(
      apiClient.getUrl('/scheduler/schedules/bulk/enable'),
      { scheduleIds }
    )
    return response.data
  }

  /**
   * Disable multiple schedules
   */
  async disableSchedules(scheduleIds: string[]): Promise<BulkOperationResult> {
    const response = await apiClient.post<{ data: BulkOperationResult }>(
      apiClient.getUrl('/scheduler/schedules/bulk/disable'),
      { scheduleIds }
    )
    return response.data
  }

  /**
   * Get execution history
   */
  async getExecutions(params?: ExecutionQueryParams): Promise<ApiResponse<Execution[]>> {
    const response = await apiClient.get<{ data: ApiResponse<Execution[]> }>(
      apiClient.getUrl('/scheduler/executions'),
      params
    )
    return response.data
  }

  /**
   * Get execution details
   */
  async getExecution(id: string): Promise<ExecutionDetail> {
    const response = await apiClient.get<{ data: ExecutionDetail }>(
      apiClient.getUrl(`/scheduler/executions/${id}`)
    )
    return response.data
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(id: string, params?: ExecutionLogParams): Promise<ExecutionLog[]> {
    const response = await apiClient.get<{ data: ExecutionLog[] }>(
      apiClient.getUrl(`/scheduler/executions/${id}/logs`),
      params
    )
    return response.data
  }

  /**
   * Retry failed execution
   */
  async retryExecution(id: string): Promise<{ executionId: string; message: string }> {
    const response = await apiClient.post<{ data: { executionId: string; message: string } }>(
      apiClient.getUrl(`/scheduler/executions/${id}/retry`)
    )
    return response.data
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<JobStats> {
    const response = await apiClient.get<{ data: JobStats }>(
      apiClient.getUrl('/scheduler/jobs/stats')
    )
    return response.data
  }

  /**
   * Trigger manual execution of a flow
   */
  async executeFlow(flowId: string, metadata?: Record<string, any>): Promise<{ executionId: string }> {
    const response = await apiClient.post<{ data: { executionId: string } }>(
      apiClient.getUrl('/scheduler/executions'),
      { flowId, metadata }
    )
    return response.data
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(id: string): Promise<void> {
    await apiClient.post<void>(
      apiClient.getUrl(`/scheduler/executions/${id}/cancel`)
    )
  }

  /**
   * Get schedules for a specific flow
   */
  async getSchedulesForFlow(flowId: string): Promise<Schedule[]> {
    const response = await this.getSchedules({ flowId })
    return response.data
  }

  /**
   * Get recent executions for a schedule
   */
  async getRecentExecutions(scheduleId: string, limit = 10): Promise<Execution[]> {
    const response = await this.getExecutions({
      scheduleId,
      limit
    })
    return response.data
  }

  /**
   * Get failed executions
   */
  async getFailedExecutions(limit = 20): Promise<Execution[]> {
    const response = await this.getExecutions({
      status: 'failed',
      limit
    })
    return response.data
  }

  /**
   * Get running executions
   */
  async getRunningExecutions(): Promise<Execution[]> {
    const response = await this.getExecutions({
      status: 'running'
    })
    return response.data
  }

  /**
   * Validate cron expression
   */
  validateCronExpression(cronExpression: string): boolean {
    // Basic cron validation - in a real app you might use a library like cron-parser
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
    return cronRegex.test(cronExpression)
  }

  /**
   * Parse cron expression to human readable format
   */
  parseCronExpression(cronExpression: string): string {
    // This would typically use a library like cronstrue
    // For now, return a simple format
    const parts = cronExpression.split(' ')
    if (parts.length !== 5) return cronExpression

    const [minute, hour, day, month, dayOfWeek] = parts
    
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour}:00`
    }
    
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return `Weekly on ${days[parseInt(dayOfWeek)]} at ${hour}:00`
    }

    return cronExpression
  }
}

export const schedulerService = new SchedulerService()