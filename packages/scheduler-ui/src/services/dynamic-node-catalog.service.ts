import { NodeDefinition } from '../types/catalog'

interface DynamicNodeDefinition extends NodeDefinition {
  dynamicSource?: boolean
}

class DynamicNodeCatalogService {
  private readonly API_BASE_URL = 'http://localhost:3001/api/v1'
  private cache: Map<string, DynamicNodeDefinition> = new Map()
  private lastCacheUpdate: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get all dynamic node definitions from the backend (node-core library)
   * This is the single source of truth for node metadata
   */
  async getDynamicNodeDefinitions(): Promise<DynamicNodeDefinition[]> {
    // Check cache first
    if (this.isCacheValid()) {
      return Array.from(this.cache.values())
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/catalog/metadata`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()

      // El backend devuelve un objeto con `data` que contiene el array
      const dynamicNodes: DynamicNodeDefinition[] =
        responseData.data || responseData

      // Verificar que es un array
      if (!Array.isArray(dynamicNodes)) {
        console.error('Backend response is not an array:', responseData)
        throw new Error('Invalid response format from backend')
      }

      // Update cache
      this.cache.clear()
      dynamicNodes.forEach(node => {
        this.cache.set(node.type, node)
      })
      this.lastCacheUpdate = Date.now()

      console.log(
        `✅ Loaded ${dynamicNodes.length} dynamic node definitions from node-core library`
      )

      return dynamicNodes
    } catch (error) {
      console.error('❌ Failed to fetch dynamic node definitions:', error)

      // Return empty array on error - frontend should handle gracefully
      return []
    }
  }

  /**
   * Get a specific dynamic node definition by type
   */
  async getDynamicNodeDefinition(
    type: string
  ): Promise<DynamicNodeDefinition | null> {
    if (this.isCacheValid() && this.cache.has(type)) {
      return this.cache.get(type) || null
    }

    // Refresh cache and try again
    const allNodes = await this.getDynamicNodeDefinitions()
    return allNodes.find(node => node.type === type) || null
  }

  /**
   * Get available node types from the dynamic source
   */
  async getAvailableTypes(): Promise<string[]> {
    const nodes = await this.getDynamicNodeDefinitions()
    return nodes.map(node => node.type)
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return (
      this.cache.size > 0 && Date.now() - this.lastCacheUpdate < this.CACHE_TTL
    )
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cache.clear()
    this.lastCacheUpdate = 0
  }

  /**
   * Get nodes by category from dynamic source
   */
  async getNodesByCategory(category: string): Promise<DynamicNodeDefinition[]> {
    const allNodes = await this.getDynamicNodeDefinitions()
    return allNodes.filter(node => node.category === category)
  }

  /**
   * Search nodes by name or description
   */
  async searchNodes(query: string): Promise<DynamicNodeDefinition[]> {
    const allNodes = await this.getDynamicNodeDefinitions()
    const lowerQuery = query.toLowerCase()

    return allNodes.filter(
      node =>
        node.name.toLowerCase().includes(lowerQuery) ||
        node.description?.toLowerCase().includes(lowerQuery) ||
        node.type.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Validate that a node type exists in the dynamic source
   */
  async validateNodeType(type: string): Promise<boolean> {
    const node = await this.getDynamicNodeDefinition(type)
    return node !== null
  }

  /**
   * Get compatibility matrix for a specific node
   */
  async getNodeCompatibility(type: string): Promise<any[]> {
    const node = await this.getDynamicNodeDefinition(type)
    return node?.compatibilityMatrix || []
  }

  /**
   * Get comprehensive documentation for a specific node type
   */
  async getNodeDocumentation(type: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/catalog/documentation/${type}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      return responseData.data || responseData
    } catch (error) {
      console.error(`❌ Failed to fetch documentation for node ${type}:`, error)
      
      // Fallback to basic node definition if documentation endpoint fails
      const node = await this.getDynamicNodeDefinition(type)
      return {
        name: node?.name || type,
        purpose: node?.description || 'No description available',
        inputs: node?.inputs || [],
        outputs: node?.outputs || [],
        usageExamples: [],
        requirements: [],
        limitations: [],
        troubleshooting: [],
        bestPractices: []
      }
    }
  }
}

// Export singleton instance
export const dynamicNodeCatalogService = new DynamicNodeCatalogService()
export type { DynamicNodeDefinition }
