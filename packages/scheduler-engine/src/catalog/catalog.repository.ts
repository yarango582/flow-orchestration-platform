import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, ILike } from 'typeorm';
import { NodeDefinition, NodeCategory } from '../database/entities/node-definition.entity';

export interface NodeQueryOptions {
  category?: NodeCategory;
  version?: string;
  search?: string;
}

@Injectable()
export class CatalogRepository {
  constructor(
    @InjectRepository(NodeDefinition)
    private readonly nodeRepository: Repository<NodeDefinition>,
  ) {}

  async create(nodeData: Partial<NodeDefinition>): Promise<NodeDefinition> {
    const node = this.nodeRepository.create(nodeData);
    return this.nodeRepository.save(node);
  }

  async findAll(options: NodeQueryOptions = {}): Promise<NodeDefinition[]> {
    const { category, version, search } = options;

    const queryOptions: FindManyOptions<NodeDefinition> = {
      order: { name: 'ASC' },
    };

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (version) {
      where.version = version;
    }

    if (search && search.length >= 2) {
      where.name = ILike(`%${search}%`);
    }

    if (Object.keys(where).length > 0) {
      queryOptions.where = where;
    }

    return this.nodeRepository.find(queryOptions);
  }

  async findByType(type: string, version?: string): Promise<NodeDefinition | null> {
    const where: any = { type };
    
    if (version) {
      where.version = version;
    }

    const nodes = await this.nodeRepository.find({
      where,
      order: { version: 'DESC' }, // Get latest version first
    });

    return nodes.length > 0 ? nodes[0] : null;
  }

  async findById(id: string): Promise<NodeDefinition | null> {
    return this.nodeRepository.findOne({ where: { id } });
  }

  async findByTypeAndVersion(type: string, version: string): Promise<NodeDefinition | null> {
    return this.nodeRepository.findOne({
      where: { type, version },
    });
  }

  async findVersionsByType(type: string): Promise<NodeDefinition[]> {
    return this.nodeRepository.find({
      where: { type },
      order: { version: 'DESC' },
    });
  }

  async existsByTypeAndVersion(type: string, version: string): Promise<boolean> {
    const count = await this.nodeRepository.count({
      where: { type, version },
    });
    return count > 0;
  }

  async update(id: string, updateData: Partial<NodeDefinition>): Promise<NodeDefinition | null> {
    await this.nodeRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.nodeRepository.delete(id);
    return result.affected > 0;
  }

  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    const categories = await this.nodeRepository
      .createQueryBuilder('node')
      .select('node.category', 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('node.category')
      .getRawMany();

    return categories.map(cat => ({
      name: cat.name,
      count: parseInt(cat.count),
    }));
  }

  async getNodeStats(): Promise<{
    total: number;
    byCategory: Record<NodeCategory, number>;
    latestNodes: NodeDefinition[];
  }> {
    const [total, byCategory, latestNodes] = await Promise.all([
      this.nodeRepository.count(),
      this.getNodeCountByCategory(),
      this.nodeRepository.find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      total,
      byCategory,
      latestNodes,
    };
  }

  private async getNodeCountByCategory(): Promise<Record<NodeCategory, number>> {
    const categories = await this.nodeRepository
      .createQueryBuilder('node')
      .select('node.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('node.category')
      .getRawMany();

    const result: Record<NodeCategory, number> = {
      [NodeCategory.DATABASE]: 0,
      [NodeCategory.TRANSFORMATION]: 0,
      [NodeCategory.EXTERNAL_API]: 0,
      [NodeCategory.NOTIFICATION]: 0,
      [NodeCategory.STORAGE]: 0,
      [NodeCategory.LOGIC]: 0,
      [NodeCategory.AI_ML]: 0,
    };

    categories.forEach(cat => {
      result[cat.category as NodeCategory] = parseInt(cat.count);
    });

    return result;
  }

  async findCompatibleNodes(
    nodeType: string, 
    outputPin: string,
  ): Promise<Array<{
    node: NodeDefinition;
    inputPin: string;
    compatibility: string;
  }>> {
    // This is a complex query that would need to search through compatibility matrices
    // For now, we'll implement a simplified version
    const allNodes = await this.nodeRepository.find();
    const sourceNode = await this.findByType(nodeType);
    
    if (!sourceNode) {
      return [];
    }

    const compatibleNodes: Array<{
      node: NodeDefinition;
      inputPin: string;
      compatibility: string;
    }> = [];

    // Check compatibility matrix of source node
    for (const rule of sourceNode.compatibilityMatrix) {
      if (rule.outputPin === outputPin) {
        const targetNode = allNodes.find(n => n.type === rule.targetType);
        if (targetNode) {
          compatibleNodes.push({
            node: targetNode,
            inputPin: rule.targetInputPin,
            compatibility: rule.compatibility,
          });
        }
      }
    }

    return compatibleNodes;
  }
}