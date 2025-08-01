/**
 * MongoDB Operations Node - Usage Examples
 * 
 * These examples demonstrate how to use the MongoDBOperationsNode
 * for various database operations including CRUD and aggregation pipelines.
 */

import { MongoDBOperationsNode, MongoDBInput, MongoDBConfig } from '../src/nodes/database/mongodb-operations.node'

// Configuration for MongoDB node
const config: MongoDBConfig = {
  connectionPool: {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000
  },
  defaultTimeout: 30000,
  defaultRetries: 3
}

// Initialize MongoDB node
const mongoNode = new MongoDBOperationsNode(config)

// Example 1: Find users with pagination and filtering
export async function findActiveUsers() {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'find',
    query: { 
      status: 'active',
      createdAt: { $gte: new Date('2024-01-01') }
    },
    options: {
      sort: { name: 1 },
      limit: 20,
      skip: 0,
      projection: { name: 1, email: 1, status: 1 }
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('Active users found:', result.data?.result.length)
    console.log('Execution time:', result.metrics?.executionTime, 'ms')
    return result.data?.result
  } else {
    console.error('Error finding users:', result.error)
    return null
  }
}

// Example 2: Insert new user document
export async function createUser(userData: any) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'insertOne',
    document: {
      ...userData,
      createdAt: new Date(),
      status: 'active'
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('User created with ID:', result.data?.result.insertedId)
    return result.data?.result.insertedId
  } else {
    console.error('Error creating user:', result.error)
    return null
  }
}

// Example 3: Bulk insert multiple users
export async function createMultipleUsers(usersData: any[]) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'insertMany',
    document: usersData.map(user => ({
      ...user,
      createdAt: new Date(),
      status: 'active'
    }))
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('Users created:', result.data?.insertedCount)
    console.log('Inserted IDs:', result.data?.insertedIds)
    return result.data?.insertedIds
  } else {
    console.error('Error creating users:', result.error)
    return null
  }
}

// Example 4: Update user information
export async function updateUserProfile(userId: string, updates: any) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'updateOne',
    query: { _id: userId },
    update: { 
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('User updated. Matched:', result.data?.matchedCount, 'Modified:', result.data?.modifiedCount)
    return result.data?.modifiedCount > 0
  } else {
    console.error('Error updating user:', result.error)
    return false
  }
}

// Example 5: Deactivate multiple users
export async function deactivateOldUsers(cutoffDate: Date) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'updateMany',
    query: { 
      lastLoginAt: { $lt: cutoffDate },
      status: 'active'
    },
    update: { 
      $set: {
        status: 'inactive',
        deactivatedAt: new Date()
      }
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('Users deactivated. Matched:', result.data?.matchedCount, 'Modified:', result.data?.modifiedCount)
    return result.data?.modifiedCount || 0
  } else {
    console.error('Error deactivating users:', result.error)
    return 0
  }
}

// Example 6: Delete inactive users
export async function cleanupInactiveUsers(daysInactive: number) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'deleteMany',
    query: { 
      status: 'inactive',
      deactivatedAt: { $lt: cutoffDate }
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('Inactive users deleted:', result.data?.deletedCount)
    return result.data?.deletedCount || 0
  } else {
    console.error('Error deleting users:', result.error)
    return 0
  }
}

// Example 7: User analytics with aggregation pipeline
export async function getUserAnalytics() {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'aggregate',
    pipeline: [
      // Group by status and count
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgAge: { $avg: '$age' },
          newestUser: { $max: '$createdAt' },
          oldestUser: { $min: '$createdAt' }
        }
      },
      // Sort by count descending
      { $sort: { count: -1 } },
      // Add additional computed fields
      {
        $addFields: {
          percentage: {
            $multiply: [
              { $divide: ['$count', { $sum: '$count' }] },
              100
            ]
          }
        }
      }
    ]
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('User analytics:', result.data?.result)
    return result.data?.result
  } else {
    console.error('Error getting analytics:', result.error)
    return null
  }
}

// Example 8: Complex aggregation for user activity report
export async function getUserActivityReport(startDate: Date, endDate: Date) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'aggregate',
    pipeline: [
      // Match users within date range
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      // Group by month and year
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          newUsers: { $sum: 1 },
          usersByStatus: {
            $push: {
              status: '$status',
              userId: '$_id'
            }
          }
        }
      },
      // Group status counts within each month
      {
        $addFields: {
          activeUsers: {
            $size: {
              $filter: {
                input: '$usersByStatus',
                cond: { $eq: ['$$this.status', 'active'] }
              }
            }
          },
          inactiveUsers: {
            $size: {
              $filter: {
                input: '$usersByStatus',
                cond: { $eq: ['$$this.status', 'inactive'] }
              }
            }
          }
        }
      },
      // Clean up output
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          newUsers: 1,
          activeUsers: 1,
          inactiveUsers: 1
        }
      },
      // Sort by year and month
      { $sort: { year: 1, month: 1 } }
    ]
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('User activity report:', result.data?.result)
    return result.data?.result
  } else {
    console.error('Error generating report:', result.error)
    return null
  }
}

// Example 9: Using MongoDB with retry logic and timeout
export async function robustUserSearch(searchTerm: string) {
  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'find',
    query: {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    },
    options: {
      timeout: 10000,    // 10 second timeout
      retries: 2,        // Retry twice on failure
      limit: 50,
      sort: { relevanceScore: -1 }
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    console.log('Search completed in:', result.metrics?.executionTime, 'ms')
    console.log('Found users:', result.data?.result.length)
    return result.data?.result
  } else {
    console.error('Search failed:', result.error)
    return []
  }
}

// Example 10: Working with ObjectIds
export async function findUserById(userId: string) {
  // Validate ObjectId before query
  if (!MongoDBOperationsNode.isValidObjectId(userId)) {
    console.error('Invalid ObjectId format:', userId)
    return null
  }

  const input: MongoDBInput = {
    connectionString: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'users',
    operation: 'findOne',
    query: { _id: userId }, // Will be automatically converted to ObjectId
    options: {
      projection: { password: 0 } // Exclude sensitive fields
    }
  }

  const result = await mongoNode.execute(input)
  
  if (result.success) {
    return result.data?.result
  } else {
    console.error('Error finding user:', result.error)
    return null
  }
}

// Example usage of all functions
export async function runExamples() {
  try {
    console.log('=== MongoDB Operations Node Examples ===')
    
    // 1. Find active users
    await findActiveUsers()
    
    // 2. Create a new user
    const newUserId = await createUser({
      name: 'John Doe',
      email: 'john.doe@example.com',
      age: 30
    })
    
    // 3. Update user profile
    if (newUserId) {
      await updateUserProfile(newUserId.toString(), {
        age: 31,
        lastLoginAt: new Date()
      })
    }
    
    // 4. Get user analytics
    await getUserAnalytics()
    
    // 5. Generate activity report
    const startDate = new Date('2024-01-01')
    const endDate = new Date()
    await getUserActivityReport(startDate, endDate)
    
    console.log('All examples completed successfully!')
    
  } catch (error) {
    console.error('Error running examples:', error)
  }
}

// Export the configured node instance for use in other modules
export { mongoNode as mongoDBNode }