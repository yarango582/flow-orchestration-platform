/**
 * Flow Management Service
 * Handles all operations related to flow CRUD, validation, and versioning
 */

import { apiClient } from './api-client'
import {
  Flow,
  FlowSummary,
  CreateFlowRequest,
  UpdateFlowRequest,
  ValidationResult,
  FlowVersion,
  FlowQueryParams,
  ApiResponse
} from '@/types/api'

export class FlowService {
  /**
   * Get paginated list of flows
   */
  async getFlows(params?: FlowQueryParams): Promise<ApiResponse<FlowSummary[]>> {
    const response = await apiClient.get<{ data: ApiResponse<FlowSummary[]> }>(
      apiClient.getUrl('/flows'),
      params
    )
    return response.data
  }

  /**
   * Get flow by ID
   */
  async getFlow(id: string): Promise<Flow> {
    const response = await apiClient.get<{ data: Flow }>(
      apiClient.getUrl(`/flows/${id}`)
    )
    return response.data
  }

  /**
   * Create new flow
   */
  async createFlow(flow: CreateFlowRequest): Promise<Flow> {
    const response = await apiClient.post<{ data: Flow }>(
      apiClient.getUrl('/flows'),
      flow
    )
    return response.data
  }

  /**
   * Update existing flow
   */
  async updateFlow(id: string, flow: UpdateFlowRequest): Promise<Flow> {
    const response = await apiClient.put<{ data: Flow }>(
      apiClient.getUrl(`/flows/${id}`),
      flow
    )
    return response.data
  }

  /**
   * Delete flow
   */
  async deleteFlow(id: string): Promise<void> {
    await apiClient.delete<void>(
      apiClient.getUrl(`/flows/${id}`)
    )
  }

  /**
   * Validate flow compatibility
   */
  async validateFlow(id: string): Promise<ValidationResult> {
    return apiClient.post<ValidationResult>(
      apiClient.getUrl(`/flows/${id}/validate`)
    )
  }

  /**
   * Get flow version history
   */
  async getFlowVersions(id: string): Promise<FlowVersion[]> {
    return apiClient.get<FlowVersion[]>(
      apiClient.getUrl(`/flows/${id}/versions`)
    )
  }

  /**
   * Rollback flow to previous version
   */
  async rollbackFlow(id: string, version: number): Promise<Flow> {
    return apiClient.post<Flow>(
      apiClient.getUrl(`/flows/${id}/versions/${version}/rollback`)
    )
  }

  /**
   * Export flow as JSON
   */
  async exportFlow(id: string): Promise<Flow> {
    const flow = await this.getFlow(id)
    return flow
  }

  /**
   * Import flow from JSON
   */
  async importFlow(flowData: CreateFlowRequest): Promise<Flow> {
    return this.createFlow(flowData)
  }

  /**
   * Duplicate flow
   */
  async duplicateFlow(id: string, newName: string): Promise<Flow> {
    const originalFlow = await this.getFlow(id)
    const duplicateRequest: CreateFlowRequest = {
      name: newName,
      description: `Copy of ${originalFlow.name}`,
      nodes: originalFlow.nodes,
      connections: originalFlow.connections,
      metadata: originalFlow.metadata
    }
    return this.createFlow(duplicateRequest)
  }

  /**
   * Search flows by name or description
   */
  async searchFlows(query: string, limit = 10): Promise<FlowSummary[]> {
    const response = await this.getFlows({
      search: query,
      limit
    })
    return response.data
  }

  /**
   * Get flows by status
   */
  async getFlowsByStatus(status: 'draft' | 'active' | 'inactive' | 'archived'): Promise<FlowSummary[]> {
    const response = await this.getFlows({ status })
    return response.data
  }
}

export const flowService = new FlowService()