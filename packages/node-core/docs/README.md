# Node-Core Library Documentation

## Overview

The Node-Core library provides a robust, extensible framework for building data processing nodes in the Flow Orchestration Platform. Each node represents a discrete operation that can be chained together to create complex workflows.

## Available Nodes

### Database Nodes
- [**PostgreSQL Query Node**](./nodes/postgresql-query/README.md) - Execute SQL queries against PostgreSQL databases
- [**MongoDB Operations Node**](./nodes/mongodb-operations/README.md) - Perform CRUD operations on MongoDB collections

### Transformation Nodes  
- [**Data Filter Node**](./nodes/data-filter/README.md) - Filter datasets based on conditions
- [**Field Mapper Node**](./nodes/field-mapper/README.md) - Transform and map data fields

## Quick Start

```typescript
import { NodeRegistry, PostgreSQLQueryNode, DataFilterNode } from '@flow-platform/node-core'

// Create node registry
const registry = new NodeRegistry()

// Register nodes
registry.register(PostgreSQLQueryNode, 'postgresql-query')
registry.register(DataFilterNode, 'data-filter')

// Create and execute nodes
const pgNode = registry.create('postgresql-query', {
  connectionString: 'postgresql://user:pass@localhost:5432/db',
  query: 'SELECT * FROM users WHERE active = $1',
  parameters: [true]
})

const result = await pgNode.execute({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
  query: 'SELECT * FROM users WHERE active = $1', 
  parameters: [true]
})
```

## Core Concepts

### Node Interface
All nodes implement the `INode<TInput, TOutput, TConfig>` interface:

```typescript
interface INode<TInput, TOutput, TConfig> {
  readonly type: string
  readonly version: string
  readonly category: string
  
  execute(input: TInput, context?: any): Promise<NodeResult<TOutput>>
  validate(input: TInput): boolean
  getConfig(): TConfig
}
```

### Node Result
Nodes return standardized results:

```typescript
interface NodeResult<T> {
  success: boolean
  data?: T
  error?: string
  metrics?: {
    executionTime: number
    recordsProcessed: number
  }
}
```

### Compatibility System
Nodes use a compatibility matrix to determine valid connections:

```typescript
const compatibility = CompatibilityValidator.check('postgresql-query', 'data-filter')
// { level: 'full', valid: true }
```

## Architecture

```mermaid
graph TB
    A[Node Registry] --> B[PostgreSQL Node]
    A --> C[MongoDB Node] 
    A --> D[Data Filter Node]
    A --> E[Field Mapper Node]
    
    B --> F[Compatibility Validator]
    C --> F
    D --> F
    E --> F
    
    F --> G[Flow Execution Engine]
```

## Guides

- [Compatibility Matrix](./compatibility-matrix.md) - Complete compatibility rules
- [Integration Guide](./guides/integration-guide.md) - Using nodes in flows
- [Performance Benchmarks](./guides/performance-benchmarks.md) - Performance metrics
- [Creating Custom Nodes](./guides/creating-custom-nodes.md) - Build your own nodes

## CLI Tools

Use the Node-Core CLI to scaffold new nodes:

```bash
npx @flow-platform/node-core create-node --name my-custom-node --category transformation
```

## Installation

```bash
npm install @flow-platform/node-core
```

## Requirements

- Node.js 20+
- TypeScript 5.0+
- PostgreSQL (for PostgreSQL nodes)
- MongoDB (for MongoDB nodes)

## License

Internal use only.