import { INode } from '../interfaces/node.interface'

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

  getNodeMetadata(type: string): any {
    const NodeClass = this.nodes.get(type)
    if (!NodeClass) {
      return null
    }
    
    // Create temporary instance to get metadata
    try {
      const instance = new NodeClass()
      return {
        type: instance.type || type,
        version: instance.version || '1.0.0',
        category: instance.category || 'transformation'
      }
    } catch {
      return {
        type,
        version: '1.0.0',
        category: 'transformation'
      }
    }
  }
}