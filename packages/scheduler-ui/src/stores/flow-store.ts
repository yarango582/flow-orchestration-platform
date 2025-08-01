import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { flowService } from '@/services'
import { Flow, FlowSummary, CreateFlowRequest, UpdateFlowRequest, ValidationResult } from '@/types/api'

interface FlowStore {
  // State
  flows: FlowSummary[]
  currentFlow: Flow | null
  validationResults: ValidationResult | null
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentFlow: (flow: Flow | null) => void
  setValidationResults: (results: ValidationResult | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // API Operations
  loadFlows: (params?: any) => Promise<void>
  loadFlow: (id: string) => Promise<Flow>
  createFlow: (request: CreateFlowRequest) => Promise<Flow>
  updateFlow: (id: string, request: UpdateFlowRequest) => Promise<Flow>
  deleteFlow: (id: string) => Promise<void>
  validateFlow: (id: string) => Promise<ValidationResult>
  duplicateFlow: (id: string, newName: string) => Promise<Flow>
  exportFlow: (id: string) => Promise<Flow>
  importFlow: (flowData: CreateFlowRequest) => Promise<Flow>

  // Utility functions
  getFlowById: (id: string) => FlowSummary | undefined
  clearError: () => void
  reset: () => void
}

export const useFlowStore = create<FlowStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    flows: [],
    currentFlow: null,
    validationResults: null,
    isLoading: false,
    error: null,

    // Basic setters
    setCurrentFlow: (flow) => set({ currentFlow: flow }),
    setValidationResults: (results) => set({ validationResults: results }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // API Operations
    loadFlows: async (params) => {
      try {
        set({ isLoading: true, error: null })
        const response = await flowService.getFlows(params)
        set({ flows: response.data })
      } catch (error: any) {
        set({ error: error.message || 'Failed to load flows' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    loadFlow: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.getFlow(id)
        set({ currentFlow: flow })
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to load flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    createFlow: async (request: CreateFlowRequest) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.createFlow(request)
        set({ currentFlow: flow })
        
        // Refresh flows list
        await get().loadFlows()
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to create flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    updateFlow: async (id: string, request: UpdateFlowRequest) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.updateFlow(id, request)
        set({ currentFlow: flow })
        
        // Update flow in the list
        const flows = get().flows.map(f => 
          f.id === id ? { ...f, ...flow } : f
        )
        set({ flows })
        
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to update flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    deleteFlow: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        await flowService.deleteFlow(id)
        
        // Remove from flows list
        const flows = get().flows.filter(f => f.id !== id)
        set({ flows })
        
        // Clear current flow if it was deleted
        if (get().currentFlow?.id === id) {
          set({ currentFlow: null })
        }
      } catch (error: any) {
        set({ error: error.message || 'Failed to delete flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    validateFlow: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        const results = await flowService.validateFlow(id)
        set({ validationResults: results })
        return results
      } catch (error: any) {
        set({ error: error.message || 'Failed to validate flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    duplicateFlow: async (id: string, newName: string) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.duplicateFlow(id, newName)
        set({ currentFlow: flow })
        
        // Refresh flows list
        await get().loadFlows()
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to duplicate flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    exportFlow: async (id: string) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.exportFlow(id)
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to export flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    importFlow: async (flowData: CreateFlowRequest) => {
      try {
        set({ isLoading: true, error: null })
        const flow = await flowService.importFlow(flowData)
        set({ currentFlow: flow })
        
        // Refresh flows list
        await get().loadFlows()
        return flow
      } catch (error: any) {
        set({ error: error.message || 'Failed to import flow' })
        throw error
      } finally {
        set({ isLoading: false })
      }
    },

    // Utility functions
    getFlowById: (id: string) => {
      return get().flows.find(f => f.id === id)
    },

    clearError: () => set({ error: null }),

    reset: () => set({
      flows: [],
      currentFlow: null,
      validationResults: null,
      isLoading: false,
      error: null
    })
  }))
)