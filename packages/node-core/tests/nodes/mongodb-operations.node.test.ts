import { MongoDBOperationsNode, MongoDBInput, MongoDBOutput, MongoDBConfig } from '../../src/nodes/database/mongodb-operations.node'
import { ObjectId } from 'mongodb'

// Mock MongoDB client
jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { _id: new ObjectId(), name: 'Test User 1', email: 'test1@example.com' },
            { _id: new ObjectId(), name: 'Test User 2', email: 'test2@example.com' }
          ])
        }),
        findOne: jest.fn().mockResolvedValue({
          _id: new ObjectId(),
          name: 'Test User',
          email: 'test@example.com'
        }),
        insertOne: jest.fn().mockResolvedValue({
          insertedId: new ObjectId()
        }),
        insertMany: jest.fn().mockResolvedValue({
          insertedCount: 2,
          insertedIds: { 0: new ObjectId(), 1: new ObjectId() }
        }),
        updateOne: jest.fn().mockResolvedValue({
          matchedCount: 1,
          modifiedCount: 1,
          upsertedId: null
        }),
        updateMany: jest.fn().mockResolvedValue({
          matchedCount: 2,
          modifiedCount: 2,
          upsertedCount: 0
        }),
        deleteOne: jest.fn().mockResolvedValue({
          deletedCount: 1
        }),
        deleteMany: jest.fn().mockResolvedValue({
          deletedCount: 3
        }),
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { _id: 'active', count: 10 },
            { _id: 'inactive', count: 5 }
          ])
        })
      })
    })
  })),
  ObjectId: jest.fn().mockImplementation((id?: string) => ({
    toString: () => id || '507f1f77bcf86cd799439011',
    toHexString: () => id || '507f1f77bcf86cd799439011'
  }))
}))

describe('MongoDBOperationsNode', () => {
  let node: MongoDBOperationsNode
  let config: MongoDBConfig

  beforeEach(() => {
    config = {
      defaultTimeout: 5000,
      defaultRetries: 2,
      connectionPool: {
        maxPoolSize: 5,
        minPoolSize: 1
      }
    }
    node = new MongoDBOperationsNode(config)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Node Properties', () => {
    it('should have correct node properties', () => {
      expect(node.type).toBe('mongodb-operations')
      expect(node.version).toBe('1.0.0')
      expect(node.category).toBe('database')
    })
  })

  describe('Validation', () => {
    it('should validate required fields', () => {
      const validInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'find'
      }

      expect(node.validate(validInput)).toBe(true)
    })

    it('should reject input missing required fields', () => {
      const invalidInputs = [
        { database: 'testdb', collection: 'users', operation: 'find' }, // missing connectionString
        { connectionString: 'mongodb://localhost:27017', collection: 'users', operation: 'find' }, // missing database
        { connectionString: 'mongodb://localhost:27017', database: 'testdb', operation: 'find' }, // missing collection
        { connectionString: 'mongodb://localhost:27017', database: 'testdb', collection: 'users' } // missing operation
      ]

      invalidInputs.forEach(input => {
        expect(node.validate(input as MongoDBInput)).toBe(false)
      })
    })

    it('should validate insertOne operation', () => {
      const validInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'insertOne',
        document: { name: 'Test User', email: 'test@example.com' }
      }

      expect(node.validate(validInput)).toBe(true)
    })

    it('should reject insertOne with array document', () => {
      const invalidInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'insertOne',
        document: [{ name: 'Test User' }]
      }

      expect(node.validate(invalidInput)).toBe(false)
    })

    it('should validate insertMany operation', () => {
      const validInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'insertMany',
        document: [
          { name: 'User 1', email: 'user1@example.com' },
          { name: 'User 2', email: 'user2@example.com' }
        ]
      }

      expect(node.validate(validInput)).toBe(true)
    })

    it('should validate update operations', () => {
      const validInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'updateOne',
        query: { _id: new ObjectId() },
        update: { $set: { name: 'Updated User' } }
      }

      expect(node.validate(validInput)).toBe(true)
    })

    it('should validate aggregate operation', () => {
      const validInput: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'aggregate',
        pipeline: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]
      }

      expect(node.validate(validInput)).toBe(true)
    })
  })

  describe('Execute Operations', () => {
    const baseInput = {
      connectionString: 'mongodb://localhost:27017',
      database: 'testdb',
      collection: 'users'
    }

    it('should execute find operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'find',
        query: { status: 'active' },
        options: { limit: 10, sort: { name: 1 } }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('find')
      expect(result.data?.result).toHaveLength(2)
      expect(result.metrics?.recordsProcessed).toBe(2)
    })

    it('should execute findOne operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'findOne',
        query: { _id: new ObjectId() }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('findOne')
      expect(result.data?.result).toBeDefined()
      expect(result.data?.matchedCount).toBe(1)
    })

    it('should execute insertOne operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'insertOne',
        document: { name: 'New User', email: 'new@example.com' }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('insertOne')
      expect(result.data?.insertedCount).toBe(1)
      expect(result.data?.result.insertedId).toBeDefined()
    })

    it('should execute insertMany operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'insertMany',
        document: [
          { name: 'User 1', email: 'user1@example.com' },
          { name: 'User 2', email: 'user2@example.com' }
        ]
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('insertMany')
      expect(result.data?.insertedCount).toBe(2)
      expect(result.data?.insertedIds).toBeDefined()
    })

    it('should execute updateOne operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'updateOne',
        query: { _id: new ObjectId() },
        update: { $set: { name: 'Updated User' } }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('updateOne')
      expect(result.data?.matchedCount).toBe(1)
      expect(result.data?.modifiedCount).toBe(1)
    })

    it('should execute updateMany operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'updateMany',
        query: { status: 'inactive' },
        update: { $set: { status: 'active' } }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('updateMany')
      expect(result.data?.matchedCount).toBe(2)
      expect(result.data?.modifiedCount).toBe(2)
    })

    it('should execute deleteOne operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'deleteOne',
        query: { _id: new ObjectId() }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('deleteOne')
      expect(result.data?.deletedCount).toBe(1)
    })

    it('should execute deleteMany operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'deleteMany',
        query: { status: 'inactive' }
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('deleteMany')
      expect(result.data?.deletedCount).toBe(3)
    })

    it('should execute aggregate operation successfully', async () => {
      const input: MongoDBInput = {
        ...baseInput,
        operation: 'aggregate',
        pipeline: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      }

      const result = await node.execute(input)

      expect(result.success).toBe(true)
      expect(result.data?.operationType).toBe('aggregate')
      expect(result.data?.result).toHaveLength(2)
      expect(result.metrics?.recordsProcessed).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      // Mock connection failure
      const { MongoClient } = require('mongodb')
      MongoClient.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        close: jest.fn().mockResolvedValue(undefined)
      }))

      const input: MongoDBInput = {
        connectionString: 'mongodb://invalid:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'find'
      }

      const result = await node.execute(input)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Connection failed')
    })

    it('should handle operation errors', async () => {
      const input: MongoDBInput = {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
        collection: 'users',
        operation: 'insertOne'
        // Missing required document
      }

      const result = await node.execute(input)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Utility Methods', () => {
    it('should create ObjectId correctly', () => {
      const objectId = MongoDBOperationsNode.createObjectId()
      expect(objectId).toBeDefined()
    })

    it('should create ObjectId from string', () => {
      const id = '507f1f77bcf86cd799439011'
      const objectId = MongoDBOperationsNode.createObjectId(id)
      expect(objectId.toString()).toBe(id)
    })

    it('should validate ObjectId strings', () => {
      expect(MongoDBOperationsNode.isValidObjectId('507f1f77bcf86cd799439011')).toBe(true)
      expect(MongoDBOperationsNode.isValidObjectId('invalid-id')).toBe(false)
    })
  })
})