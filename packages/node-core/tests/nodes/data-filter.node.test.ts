import { DataFilterNode, DataFilterNodeFactory } from '../../src/nodes/transformation/data-filter.node';
import { NodeConfiguration } from '../../src/interfaces/node.interface';
import { createDevelopmentLogger } from '../../src/utils/logger';

describe('DataFilterNode', () => {
  let node: DataFilterNode;
  let mockContext: any;

  beforeEach(() => {
    const configuration: NodeConfiguration = {
      id: 'test-filter-node',
      name: 'Test Filter Node',
      type: 'data-filter',
      version: '1.0.0',
      inputSchema: {},
      outputSchema: {}
    };

    node = new DataFilterNode(configuration);

    mockContext = {
      nodeId: 'test-filter-node',
      executionId: 'test-execution',
      timestamp: new Date(),
      logger: createDevelopmentLogger('test'),
      services: new Map(),
      sharedData: new Map()
    };
  });

  describe('Schema Validation', () => {
    it('should have correct input schema', () => {
      const schema = node.inputSchema;
      
      expect(schema.data).toBeDefined();
      expect(schema.data.type).toBe('array');
      expect(schema.data.required).toBe(true);
      
      expect(schema.conditions).toBeDefined();
      expect(schema.conditions.type).toBe('array');
      expect(schema.conditions.required).toBe(true);
    });

    it('should have correct output schema', () => {
      const schema = node.outputSchema;
      
      expect(schema.filtered).toBeDefined();
      expect(schema.filtered.type).toBe('array');
      expect(schema.filtered.required).toBe(true);
      
      expect(schema.filtered_count).toBeDefined();
      expect(schema.filtered_count.type).toBe('number');
      expect(schema.filtered_count.required).toBe(true);
    });
  });

  describe('Basic Filtering', () => {
    it('should filter data with equals condition', async () => {
      const input = {
        data: [
          { id: 1, name: 'John', age: 25 },
          { id: 2, name: 'Jane', age: 30 },
          { id: 3, name: 'Bob', age: 25 }
        ],
        conditions: [
          { field: 'age', operator: 'equals' as const, value: 25 }
        ]
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(2);
      expect(result.data.filtered_count).toBe(2);
      expect(result.data.total_count).toBe(3);
      
      // Should contain John and Bob
      expect(result.data.filtered).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'John', age: 25 }),
          expect.objectContaining({ name: 'Bob', age: 25 })
        ])
      );
    });

    it('should filter data with contains condition', async () => {
      const input = {
        data: [
          { id: 1, name: 'John Doe', category: 'developer' },
          { id: 2, name: 'Jane Smith', category: 'designer' },
          { id: 3, name: 'Bob Johnson', category: 'developer' }
        ],
        conditions: [
          { field: 'name', operator: 'contains' as const, value: 'John' }
        ]
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(2);
      expect(result.data.filtered.every((item: any) => item.name.includes('John'))).toBe(true);
    });

    it('should filter data with greater_than condition', async () => {
      const input = {
        data: [
          { id: 1, score: 85 },
          { id: 2, score: 92 },
          { id: 3, score: 78 },
          { id: 4, score: 95 }
        ],
        conditions: [
          { field: 'score', operator: 'greater_than' as const, value: 90 }
        ]
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(2);
      expect(result.data.filtered.every((item: any) => item.score > 90)).toBe(true);
    });
  });

  describe('Complex Filtering', () => {
    it('should filter with multiple conditions using AND operator', async () => {
      const input = {
        data: [
          { id: 1, name: 'John', age: 25, department: 'IT' },
          { id: 2, name: 'Jane', age: 30, department: 'IT' },
          { id: 3, name: 'Bob', age: 25, department: 'HR' },
          { id: 4, name: 'Alice', age: 35, department: 'IT' }
        ],
        conditions: [
          { field: 'age', operator: 'greater_than' as const, value: 24 },
          { field: 'department', operator: 'equals' as const, value: 'IT' }
        ],
        logicalOperator: 'AND' as const
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(3);
      expect(result.data.filtered.every((item: any) => 
        item.age > 24 && item.department === 'IT'
      )).toBe(true);
    });

    it('should filter with multiple conditions using OR operator', async () => {
      const input = {
        data: [
          { id: 1, name: 'John', age: 25, status: 'active' },
          { id: 2, name: 'Jane', age: 30, status: 'inactive' },
          { id: 3, name: 'Bob', age: 35, status: 'active' },
          { id: 4, name: 'Alice', age: 20, status: 'inactive' }
        ],
        conditions: [
          { field: 'age', operator: 'less_than' as const, value: 25 },
          { field: 'status', operator: 'equals' as const, value: 'active' }
        ],
        logicalOperator: 'OR' as const
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(3);
    });
  });

  describe('Pagination', () => {
    it('should apply limit to results', async () => {
      const input = {
        data: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: i * 10 })),
        conditions: [
          { field: 'value', operator: 'greater_than_or_equal' as const, value: 0 }
        ],
        limit: 5
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(5);
      expect(result.data.filtered_count).toBe(5);
    });

    it('should apply offset and limit to results', async () => {
      const input = {
        data: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: i * 10 })),
        conditions: [
          { field: 'value', operator: 'greater_than_or_equal' as const, value: 0 }
        ],
        offset: 3,
        limit: 4
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(4);
      expect(result.data.filtered[0]).toEqual({ id: 4, value: 30 });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input data', async () => {
      const input = {
        data: 'invalid-data' as any,
        conditions: []
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty conditions array', async () => {
      const input = {
        data: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ],
        conditions: []
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toHaveLength(2);
      expect(result.data.filtered_count).toBe(2);
    });
  });

  describe('Performance Metadata', () => {
    it('should include execution metadata', async () => {
      const input = {
        data: [
          { id: 1, name: 'John', age: 25 },
          { id: 2, name: 'Jane', age: 30 }
        ],
        conditions: [
          { field: 'age', operator: 'greater_than' as const, value: 20 }
        ]
      };

      const result = await node.execute(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.execution_metadata).toBeDefined();
      expect(result.data.execution_metadata.conditions_applied).toBe(1);
      expect(result.data.execution_metadata.performance_metrics).toBeDefined();
      expect(result.data.execution_metadata.performance_metrics.rows_processed).toBe(2);
      expect(result.data.execution_metadata.performance_metrics.rows_matched).toBe(2);
    });
  });
});

describe('DataFilterNodeFactory', () => {
  let factory: DataFilterNodeFactory;

  beforeEach(() => {
    factory = new DataFilterNodeFactory();
  });

  it('should support correct node types', () => {
    const supportedTypes = factory.getSupportedTypes();
    
    expect(supportedTypes).toContain('data-filter');
    expect(supportedTypes).toContain('filter');
    expect(supportedTypes).toContain('array-filter');
  });

  it('should validate node types correctly', () => {
    expect(factory.validateNodeType('data-filter')).toBe(true);
    expect(factory.validateNodeType('filter')).toBe(true);
    expect(factory.validateNodeType('invalid-type')).toBe(false);
  });

  it('should create node instances', async () => {
    const configuration: NodeConfiguration = {
      id: 'test-node',
      name: 'Test Node',
      type: 'data-filter',
      version: '1.0.0',
      inputSchema: {},
      outputSchema: {}
    };

    const node = await factory.createNode('data-filter', configuration);
    
    expect(node).toBeInstanceOf(DataFilterNode);
    expect(node.configuration).toEqual(configuration);
  });

  it('should throw error for unsupported node type', async () => {
    const configuration: NodeConfiguration = {
      id: 'test-node',
      name: 'Test Node',
      type: 'unsupported-type',
      version: '1.0.0',
      inputSchema: {},
      outputSchema: {}
    };

    await expect(factory.createNode('unsupported-type', configuration))
      .rejects.toThrow('Unsupported node type: unsupported-type');
  });
});