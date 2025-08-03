import { INode } from '../interfaces/node.interface'
import { BaseNode, NodeMetadata } from './base-node'

export class NodeRegistry {
  private nodes: Map<string, any> = new Map()
  
  register<T extends INode>(nodeClass: new (...args: any[]) => T, type: string): void {
    this.nodes.set(type, nodeClass)
  }
  
  create<T extends INode>(type: string, config: any): T {
    const NodeClass = this.nodes.get(type)
    if (!NodeClass) {
      throw new Error(`Node type '${type}' not found`)
    }
    return new NodeClass(config)
  }
  
  getAvailableTypes(): string[] {
    return Array.from(this.nodes.keys())
  }

  getAllNodes(): Map<string, any> {
    return new Map(this.nodes)
  }

  existsByTypeAndVersion(type: string, version: string): boolean {
    // For now, check if the type exists - in a real implementation,
    // you might store version information separately
    return this.nodes.has(type)
  }

  getNodeMetadata(type: string): NodeMetadata | null {
    const NodeClass = this.nodes.get(type)
    if (!NodeClass) {
      return null
    }
    
    // Call static getMetadata method if it exists
    if (typeof NodeClass.getMetadata === 'function') {
      try {
        return NodeClass.getMetadata()
      } catch (error) {
        console.warn(`Failed to get metadata for node type '${type}':`, error)
        return null
      }
    }
    
    // Fallback: create temporary instance to get basic metadata
    try {
      const instance = new NodeClass()
      return {
        type: instance.type || type,
        name: instance.constructor.name.replace(/Node$/, ''),
        description: `Auto-generated metadata for ${type}`,
        version: instance.version || '1.0.0',
        category: instance.category || 'transformation',
        inputs: [],
        outputs: []
      }
    } catch (error) {
      console.warn(`Failed to create instance for metadata of node type '${type}':`, error)
      return null
    }
  }

  getAllNodesMetadata(): Map<string, NodeMetadata> {
    const metadata = new Map<string, NodeMetadata>()
    
    for (const [type] of this.nodes) {
      const nodeMetadata = this.getNodeMetadata(type)
      if (nodeMetadata) {
        metadata.set(type, nodeMetadata)
      }
    }
    
    return metadata
  }
}