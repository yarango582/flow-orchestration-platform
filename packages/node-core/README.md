# @piloto/node-core

Core library for implementing and managing nodes in the Piloto system. This TypeScript library provides a robust foundation for creating, validating, and connecting data processing nodes with strong type safety and comprehensive error handling.

## Features

- **Type-Safe Node Architecture**: Fully typed interfaces with TypeScript strict mode
- **Extensible Node System**: Base classes and interfaces for creating custom nodes
- **Compatibility Validation**: Automatic checking of node connections and data flow
- **Built-in Node Types**: PostgreSQL Query, Data Filter, and Field Mapper nodes
- **Performance Monitoring**: Execution metrics and performance tracking
- **Comprehensive Testing**: Full test coverage with Jest
- **Structured Logging**: Winston-based logging with metadata support

## Installation

```bash
npm install @piloto/node-core
```

## Quick Start

### Creating a Simple Node

```typescript
import { BaseNode, NodeConfiguration, NodeDataSchema } from '@piloto/node-core';

interface MyNodeInput {
  message: string;
  count: number;
}

interface MyNodeOutput {
  result: string[];
}

class MyCustomNode extends BaseNode<MyNodeInput, MyNodeOutput> {
  get inputSchema(): NodeDataSchema {
    return {
      message: { type: 'string', required: true, description: 'Input message' },
      count: { type: 'number', required: true, description: 'Repeat count' }
    };
  }

  get outputSchema(): NodeDataSchema {
    return {
      result: { type: 'array', required: true, description: 'Array of repeated messages' }
    };
  }

  protected async executeInternal(input: MyNodeInput): Promise<MyNodeOutput> {
    const result = Array.from({ length: input.count }, () => input.message);
    return { result };
  }
}
```

### Using Built-in Nodes

#### PostgreSQL Query Node

```typescript
import { 
  PostgreSQLQueryNode, 
  NodeConfiguration,
  createDevelopmentLogger 
} from '@piloto/node-core';

const config: NodeConfiguration = {
  id: 'my-pg-node',
  name: 'User Query Node',
  type: 'postgresql-query',
  version: '1.0.0',
  inputSchema: {},
  outputSchema: {}
};

const pgNode = new PostgreSQLQueryNode(config);

const input = {
  connectionString: 'postgresql://user:password@localhost:5432/database',
  query: 'SELECT * FROM users WHERE active = $1',
  parameters: [true]
};

const context = {
  nodeId: 'my-pg-node',
  executionId: 'exec-001',
  timestamp: new Date(),
  logger: createDevelopmentLogger('pg-node'),
  services: new Map(),
  sharedData: new Map()
};

const result = await pgNode.execute(input, context);
console.log('Query result:', result.data.result);
console.log('Row count:', result.data.rowCount);
```

#### Data Filter Node

```typescript
import { DataFilterNode, FilterCondition } from '@piloto/node-core';

const filterNode = new DataFilterNode(config);

const input = {
  data: [
    { id: 1, name: 'John', age: 25, department: 'IT' },
    { id: 2, name: 'Jane', age: 30, department: 'HR' },
    { id: 3, name: 'Bob', age: 35, department: 'IT' }
  ],
  conditions: [
    { field: 'age', operator: 'greater_than', value: 25 },
    { field: 'department', operator: 'equals', value: 'IT' }
  ],
  logicalOperator: 'AND'
};

const result = await filterNode.execute(input, context);
console.log('Filtered data:', result.data.filtered);
console.log('Match count:', result.data.filtered_count);
```

#### Field Mapper Node

```typescript
import { FieldMapperNode, FieldMapping } from '@piloto/node-core';

const mapperNode = new FieldMapperNode(config);

const input = {
  source: [
    { first_name: 'John', last_name: 'Doe', birth_year: 1990 },
    { first_name: 'Jane', last_name: 'Smith', birth_year: 1985 }
  ],
  mapping: [
    {
      sourceField: 'first_name',
      targetField: 'firstName',
      transformation: 'rename'
    },
    {
      sourceField: 'last_name',
      targetField: 'lastName',
      transformation: 'rename'
    },
    {
      sourceField: 'birth_year',
      targetField: 'age',
      transformation: 'function',
      parameters: {
        functionBody: 'return new Date().getFullYear() - value;'
      }
    }
  ]
};

const result = await mapperNode.execute(input, context);
console.log('Mapped data:', result.data.mapped);
```

### Node Registry and Factory Pattern

```typescript
import { 
  globalNodeRegistry, 
  PostgreSQLQueryNodeFactory,
  DataFilterNodeFactory,
  FieldMapperNodeFactory 
} from '@piloto/node-core';

// Register node factories
globalNodeRegistry.registerFactory('postgresql-query', new PostgreSQLQueryNodeFactory());
globalNodeRegistry.registerFactory('data-filter', new DataFilterNodeFactory());
globalNodeRegistry.registerFactory('field-mapper', new FieldMapperNodeFactory());

// Create nodes through registry
const nodeConfig: NodeConfiguration = {
  id: 'filter-001',
  name: 'User Filter',
  type: 'data-filter',
  version: '1.0.0',
  inputSchema: {},
  outputSchema: {}
};

const filterNode = await globalNodeRegistry.createNode(nodeConfig);
```

### Compatibility Validation

```typescript
import { CompatibilityValidator } from '@piloto/node-core';

const validator = new CompatibilityValidator();

// Check if two nodes can be connected
const compatibility = await validator.checkNodeCompatibility('source-node-id', 'target-node-id');

if (compatibility.compatible) {
  console.log('Nodes are compatible!');
  console.log('Compatibility level:', compatibility.outputToInputCompatibility.level);
} else {
  console.log('Nodes are not compatible');
  console.log('Issues:', compatibility.outputToInputCompatibility.issues);
}

// Get transformation suggestions
const suggestions = await validator.suggestTransformations('source-node-id', 'target-node-id');
console.log('Transformation suggestions:', suggestions);
```

### Advanced Logging

```typescript
import { createProductionLogger, createDevelopmentLogger } from '@piloto/node-core';

// Development logging with colors and debug level
const devLogger = createDevelopmentLogger('my-app');

// Production logging with structured JSON format
const prodLogger = createProductionLogger('/var/log/app.log', 'my-app');

// Use in nodes
const context = {
  nodeId: 'my-node',
  executionId: 'exec-001',
  timestamp: new Date(),
  logger: prodLogger,
  services: new Map(),
  sharedData: new Map()
};
```

## Node Compatibility Matrix

The library includes a comprehensive compatibility system that validates node connections:

| Source → Target | PostgreSQL Query | Data Filter | Field Mapper |
|----------------|------------------|-------------|--------------|
| **PostgreSQL Query** | N/A | ✅ Full (result → data) | ✅ Full (result → source) |
| **Data Filter** | ❌ Incompatible | ✅ Full | ✅ Full (filtered → source) |
| **Field Mapper** | ❌ Incompatible | ✅ Partial | ✅ Full |

## Built-in Filter Operators

The Data Filter Node supports these operators:

- `equals`, `not_equals`
- `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`
- `contains`, `not_contains`, `starts_with`, `ends_with`
- `in`, `not_in`
- `is_null`, `is_not_null`
- `regex_match`

## Field Transformation Types

The Field Mapper Node supports these transformations:

- `direct` - Direct field copy
- `rename` - Rename field
- `cast` - Type casting (string, number, boolean, date, array, object)
- `function` - Custom JavaScript function
- `template` - Template-based transformation with `{{field}}` syntax
- `lookup` - Lookup table transformation
- `aggregate` - Aggregate multiple fields (sum, avg, count, concat, min, max)
- `conditional` - Conditional transformation based on field values

## API Reference

### Core Interfaces

- `INode<TInput, TOutput, TConfig>` - Base node interface
- `NodeConfiguration` - Node configuration schema
- `NodeExecutionContext` - Execution context with logging and services
- `NodeExecutionResult<TOutput>` - Execution result with metadata

### Base Classes

- `BaseNode<TInput, TOutput, TConfig>` - Abstract base class for all nodes
- `NodeRegistry` - Registry for managing node instances and factories

### Validators

- `CompatibilityValidator` - Validates node compatibility and suggests transformations
- `ValidationUtils` - Utility functions for data validation

### Utilities

- `Logger` - Structured logging with Winston
- `ValidationUtils` - Data validation utilities

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Building

Build the library:

```bash
npm run build
```

## Development

```bash
# Install dependencies
npm install

# Run tests in watch mode
npm run test:watch

# Build and watch for changes
npm run build:watch

# Lint code
npm run lint
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ PostgreSQL Node │───▶│ Data Filter     │───▶│ Field Mapper    │
│                 │    │ Node            │    │ Node            │
│ Output: result  │    │ Input: data     │    │ Input: source   │
│         count   │    │ Output: filtered│    │ Output: mapped  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Compatibility Validator                      │
│  • Schema validation     • Type checking     • Transformation   │
│  • Connection validation • Performance hints • Error reporting  │
└─────────────────────────────────────────────────────────────────┘
```

The library is designed with extensibility and type safety as core principles, making it easy to create new node types while maintaining compatibility and performance.