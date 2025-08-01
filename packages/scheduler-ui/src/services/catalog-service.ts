/**
 * Node Catalog Service
 * Handles all operations related to node definitions, compatibility checking, and categories
 */

import { apiClient } from './api-client'
import {
  NodeDefinition,
  NodeVersion,
  NodeCategory,
  CreateNodeRequest,
  CompatibilityCheck,
  CompatibilityRule,
  NodeQueryParams
} from '@/types/api'

export class CatalogService {
  /**
   * Get all available nodes with optional filtering
   */
  async getNodes(params?: NodeQueryParams): Promise<NodeDefinition[]> {
    const response = await apiClient.get<{ data: NodeDefinition[] }>(
      apiClient.getUrl('/catalog/nodes'),
      params
    )
    return response.data
  }

  /**
   * Get node definition by type
   */
  async getNode(type: string, version?: string): Promise<NodeDefinition> {
    const response = await apiClient.get<{ data: NodeDefinition }>(
      apiClient.getUrl(`/catalog/nodes/${type}`),
      { version }
    )
    return response.data
  }

  /**
   * Register new node type
   */
  async createNode(node: CreateNodeRequest): Promise<NodeDefinition> {
    const response = await apiClient.post<{ data: NodeDefinition }>(
      apiClient.getUrl('/catalog/nodes'),
      node
    )
    return response.data
  }

  /**
   * Get all versions of a node type
   */
  async getNodeVersions(type: string): Promise<NodeVersion[]> {
    return apiClient.get<NodeVersion[]>(
      apiClient.getUrl(`/catalog/nodes/${type}/versions`)
    )
  }

  /**
   * Get compatibility matrix for a node
   */
  async getNodeCompatibility(type: string, version?: string): Promise<CompatibilityRule[]> {
    return apiClient.get<CompatibilityRule[]>(
      apiClient.getUrl(`/catalog/nodes/${type}/compatibility`),
      { version }
    )
  }

  /**
   * Check compatibility between two nodes
   */
  async checkCompatibility(
    sourceNode: { type: string; version: string },
    targetNode: { type: string; version: string },
    connection: { outputPin: string; inputPin: string }
  ): Promise<CompatibilityCheck> {
    return apiClient.post<CompatibilityCheck>(
      apiClient.getUrl('/catalog/compatibility/check'),
      {
        sourceNode,
        targetNode,
        connection
      }
    )
  }

  /**
   * Get global compatibility matrix
   */
  async getCompatibilityMatrix(): Promise<Record<string, CompatibilityRule[]>> {
    return apiClient.get<Record<string, CompatibilityRule[]>>(
      apiClient.getUrl('/catalog/compatibility/matrix')
    )
  }

  /**
   * Get all node categories
   */
  async getCategories(): Promise<NodeCategory[]> {
    return apiClient.get<NodeCategory[]>(
      apiClient.getUrl('/catalog/categories')
    )
  }

  /**
   * Get nodes by category
   */
  async getNodesByCategory(category: string): Promise<NodeDefinition[]> {
    return this.getNodes({ category: category as any })
  }

  /**
   * Search nodes by name or description
   */
  async searchNodes(query: string): Promise<NodeDefinition[]> {
    return this.getNodes({ search: query })
  }

  /**
   * Get recommended nodes based on current flow structure
   */
  async getRecommendedNodes(
    currentNodes: Array<{ type: string; version: string }>,
    lastNodeType?: string
  ): Promise<NodeDefinition[]> {
    // This is a client-side recommendation based on compatibility
    const allNodes = await this.getNodes()
    
    if (!lastNodeType) return allNodes

    const compatibleNodes: NodeDefinition[] = []
    
    for (const node of allNodes) {
      if (node.type === lastNodeType) continue
      
      try {
        // Check if this node can connect to the last node
        const compatibility = await this.checkCompatibility(
          { type: lastNodeType, version: '1.0.0' }, // Default version
          { type: node.type, version: node.version },
          { outputPin: 'output', inputPin: 'input' } // Default pins
        )
        
        if (compatibility.compatible) {
          compatibleNodes.push(node)
        }
      } catch (error) {
        // Skip nodes that can't be checked
        continue
      }
    }
    
    return compatibleNodes
  }

  /**
   * Get node documentation/help
   */
  async getNodeDocumentation(type: string, version?: string): Promise<{
    description: string
    examples: any[]
    configuration: Record<string, any>
  }> {
    // This would typically be a separate endpoint
    // For now, extract from node definition
    const node = await this.getNode(type, version)
    
    return {
      description: node.description || '',
      examples: node.metadata?.examples || [],
      configuration: node.configuration || {}
    }
  }

  /**
   * Validate node configuration
   */
  validateNodeConfig(node: NodeDefinition, config: Record<string, any>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    // Check required inputs
    node.inputs.forEach(input => {
      if (input.required && !(input.name in config)) {
        errors.push(`Required input '${input.name}' is missing`)
      }
      
      // Basic type checking
      if (input.name in config) {
        const value = config[input.name]
        const expectedType = input.type
        
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Input '${input.name}' should be a string`)
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Input '${input.name}' should be a number`)
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Input '${input.name}' should be a boolean`)
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Input '${input.name}' should be an array`)
        }
      }
      
      // Validation rules
      if (input.validation && input.name in config) {
        const value = config[input.name]
        const validation = input.validation
        
        if (typeof value === 'string') {
          if (validation.minLength && value.length < validation.minLength) {
            errors.push(`Input '${input.name}' must be at least ${validation.minLength} characters`)
          }
          if (validation.maxLength && value.length > validation.maxLength) {
            errors.push(`Input '${input.name}' must be at most ${validation.maxLength} characters`)
          }
          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            errors.push(`Input '${input.name}' does not match required pattern`)
          }
        }
        
        if (typeof value === 'number') {
          if (validation.minimum && value < validation.minimum) {
            errors.push(`Input '${input.name}' must be at least ${validation.minimum}`)
          }
          if (validation.maximum && value > validation.maximum) {
            errors.push(`Input '${input.name}' must be at most ${validation.maximum}`)
          }
        }
        
        if (validation.enum && !validation.enum.includes(value)) {
          errors.push(`Input '${input.name}' must be one of: ${validation.enum.join(', ')}`)
        }
      }
    })
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get node icon URL
   */
  getNodeIconUrl(node: NodeDefinition): string {
    if (node.icon) return node.icon
    
    // Default icons by category
    const categoryIcons: Record<string, string> = {
      database: '/icons/database.svg',
      transformation: '/icons/transform.svg',
      'external-api': '/icons/api.svg',
      notification: '/icons/notification.svg',
      storage: '/icons/storage.svg',
      logic: '/icons/logic.svg',
      'ai-ml': '/icons/brain.svg'
    }
    
    return categoryIcons[node.category] || '/icons/default-node.svg'
  }
}

export const catalogService = new CatalogService()