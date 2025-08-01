import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog } from '@headlessui/react'
import {
  XMarkIcon,
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { schedulerService, flowService } from '@/services'
import {
  CreateScheduleRequest,
  UpdateScheduleRequest,
  Schedule,
  FlowSummary
} from '@/types/api'
import CronExpressionBuilder from '@/components/ui/CronExpressionBuilder'

const scheduleFormSchema = z.object({
  flowId: z.string().min(1, 'Flow is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  cronExpression: z.string().min(1, 'Schedule is required'),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1).default(300)
})

type ScheduleFormData = z.infer<typeof scheduleFormSchema>

interface ScheduleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (schedule: Schedule) => void
  existingSchedule?: Schedule
  preselectedFlowId?: string
}

const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingSchedule,
  preselectedFlowId
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loadingFlows, setLoadingFlows] = useState(false)
  const [showCronBuilder, setShowCronBuilder] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch,
    getValues
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      flowId: preselectedFlowId || existingSchedule?.flowId || '',
      name: existingSchedule?.name || '',
      description: existingSchedule?.description || '',
      cronExpression: existingSchedule?.cronExpression || '0 9 * * 1-5',
      timezone: existingSchedule?.timezone || 'UTC',
      enabled: existingSchedule?.enabled ?? true,
      maxRetries: existingSchedule?.maxRetries || 3,
      retryDelay: existingSchedule?.retryDelay || 300
    }
  })

  const watchedCronExpression = watch('cronExpression')

  useEffect(() => {
    if (isOpen) loadFlows()
  }, [isOpen])

  const loadFlows = async () => {
    try {
      setLoadingFlows(true)
      const response = await flowService.getFlows({ status: 'active', limit: 100 })
      setFlows(response.data)
    } catch (error: any) {
      toast.error('Failed to load flows: ' + error.message)
    } finally {
      setLoadingFlows(false)
    }
  }

  const validateCronExpression = (cronExpression: string): boolean => {
    return schedulerService.validateCronExpression(cronExpression)
  }

  const onSubmit = async (data: ScheduleFormData) => {
    if (!validateCronExpression(data.cronExpression)) {
      toast.error('Invalid cron expression')
      return
    }

    try {
      setIsLoading(true)
      let savedSchedule: Schedule

      if (existingSchedule) {
        const updateRequest: UpdateScheduleRequest = {
          name: data.name,
          description: data.description,
          cronExpression: data.cronExpression,
          timezone: data.timezone,
          enabled: data.enabled,
          maxRetries: data.maxRetries,
          retryDelay: data.retryDelay
        }
        savedSchedule = await schedulerService.updateSchedule(existingSchedule.id, updateRequest)
        toast.success('Schedule updated successfully')
      } else {
        const createRequest: CreateScheduleRequest = {
          flowId: data.flowId,
          name: data.name,
          description: data.description,
          cronExpression: data.cronExpression,
          timezone: data.timezone,
          enabled: data.enabled,
          maxRetries: data.maxRetries,
          retryDelay: data.retryDelay
        }
        savedSchedule = await schedulerService.createSchedule(createRequest)
        toast.success('Schedule created successfully')
      }

      onSave(savedSchedule)
      handleClose()
    } catch (error: any) {
      toast.error('Failed to save schedule: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    setShowCronBuilder(false)
    onClose()
  }

  const handleCronExpressionChange = (cronExpression: string) => {
    setValue('cronExpression', cronExpression)
    setShowCronBuilder(false)
  }

  const getCronDescription = (cronExpression: string): string => {
    if (!cronExpression) return ''
    return schedulerService.parseCronExpression(cronExpression)
  }

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Mexico_City',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney'
  ]

  return (
    <>
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/25" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-blue-600" />
                  {existingSchedule ? 'Edit Schedule' : 'Create Schedule'}
                </Dialog.Title>
                <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {!existingSchedule && (
                  <div>
                    <label htmlFor="flowId" className="block text-sm font-medium text-gray-700 mb-1">
                      Flow *
                    </label>
                    <select
                      {...register('flowId')}
                      id="flowId"
                      disabled={loadingFlows || !!preselectedFlowId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a flow...</option>
                      {flows.map(flow => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name} (v{flow.version})
                        </option>
                      ))}
                    </select>
                    {errors.flowId && <p className="mt-1 text-sm text-red-600">{errors.flowId.message}</p>}
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule Name *
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    id="name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter schedule name"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    id="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter schedule description (optional)"
                  />
                  {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
                </div>

                <div>
                  <label htmlFor="cronExpression" className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule (Cron Expression) *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      {...register('cronExpression')}
                      type="text"
                      id="cronExpression"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0 9 * * 1-5"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCronBuilder(true)}
                      className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md flex items-center"
                    >
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Builder
                    </button>
                  </div>
                  {watchedCronExpression && (
                    <p className="mt-1 text-sm text-gray-600">
                      {getCronDescription(watchedCronExpression)}
                    </p>
                  )}
                  {errors.cronExpression && (
                    <p className="mt-1 text-sm text-red-600">{errors.cronExpression.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    {...register('timezone')}
                    id="timezone"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="enabled" className="flex items-center">
                      <input
                        {...register('enabled')}
                        type="checkbox"
                        id="enabled"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Enabled</span>
                    </label>
                  </div>
                  <div>
                    <label htmlFor="maxRetries" className="block text-sm font-medium text-gray-700 mb-1">
                      Max Retries
                    </label>
                    <input
                      {...register('maxRetries', { valueAsNumber: true })}
                      type="number"
                      id="maxRetries"
                      min="0"
                      max="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.maxRetries && (
                      <p className="mt-1 text-sm text-red-600">{errors.maxRetries.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="retryDelay" className="block text-sm font-medium text-gray-700 mb-1">
                      Retry Delay (seconds)
                    </label>
                    <input
                      {...register('retryDelay', { valueAsNumber: true })}
                      type="number"
                      id="retryDelay"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.retryDelay && (
                      <p className="mt-1 text-sm text-red-600">{errors.retryDelay.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid || isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Saving...' : existingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>

      {showCronBuilder && (
        <CronExpressionBuilder
          isOpen={showCronBuilder}
          onClose={() => setShowCronBuilder(false)}
          initialValue={getValues('cronExpression')}
          onSave={handleCronExpressionChange}
        />
      )}
    </>
  )
}

export default ScheduleFormModal
