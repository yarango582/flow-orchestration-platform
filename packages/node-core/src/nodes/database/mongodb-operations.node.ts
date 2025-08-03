import { BaseNode, NodeMetadata } from "../../base/base-node";
import { NodeResult } from "../../interfaces/node.interface";
import { MongoClient, Db, Collection, ObjectId, ClientSession } from "mongodb";

export type MongoOperation =
  | "find"
  | "findOne"
  | "insertOne"
  | "insertMany"
  | "updateOne"
  | "updateMany"
  | "deleteOne"
  | "deleteMany"
  | "aggregate";

export interface MongoDBInput {
  connectionString: string;
  database: string;
  collection: string;
  operation: MongoOperation;
  query?: Record<string, any>;
  document?: Record<string, any> | Record<string, any>[];
  update?: Record<string, any>;
  pipeline?: Record<string, any>[];
  options?: {
    timeout?: number;
    retries?: number;
    upsert?: boolean;
    sort?: Record<string, any>;
    limit?: number;
    skip?: number;
    projection?: Record<string, any>;
  };
}

export interface MongoDBOutput {
  result: any;
  matchedCount?: number;
  modifiedCount?: number;
  insertedCount?: number;
  deletedCount?: number;
  insertedIds?: Record<number, ObjectId>;
  operationType: MongoOperation;
}

export interface MongoDBConfig {
  connectionPool?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
  };
  defaultTimeout?: number;
  defaultRetries?: number;
}

export class MongoDBOperationsNode extends BaseNode<
  MongoDBInput,
  MongoDBOutput,
  MongoDBConfig
> {
  readonly type = "mongodb-operations";
  readonly version = "1.0.0";
  readonly category = "database";

  private client: MongoClient | null = null;

  static getMetadata(): NodeMetadata {
    return {
      type: "mongodb-operations",
      name: "MongoDB Operations",
      description:
        "Performs CRUD operations on MongoDB collections with connection pooling and advanced querying",
      version: "1.0.0",
      category: "database",
      icon: "mongodb",
      inputs: [
        {
          name: "connectionString",
          type: "string",
          required: true,
          description:
            "MongoDB connection string (e.g., mongodb://host:port/database)",
          validation: {
            pattern: "^mongodb(\\+srv)?://.*",
          },
        },
        {
          name: "database",
          type: "string",
          required: true,
          description: "Target database name",
        },
        {
          name: "collection",
          type: "string",
          required: true,
          description: "Target collection name",
        },
        {
          name: "operation",
          type: "string",
          required: true,
          description: "MongoDB operation to perform",
          validation: {
            enum: [
              "find",
              "findOne",
              "insertOne",
              "insertMany",
              "updateOne",
              "updateMany",
              "deleteOne",
              "deleteMany",
              "aggregate",
            ],
          },
          defaultValue: "find",
        },
        {
          name: "query",
          type: "object",
          required: false,
          description: "Query filter for find/update/delete operations",
          defaultValue: {},
        },
        {
          name: "document",
          type: "object",
          required: false,
          description: "Document(s) to insert or data for operations",
        },
        {
          name: "update",
          type: "object",
          required: false,
          description: "Update operations for updateOne/updateMany",
        },
        {
          name: "pipeline",
          type: "array",
          required: false,
          description: "Aggregation pipeline for aggregate operations",
        },
      ],
      outputs: [
        {
          name: "result",
          type: "array",
          description: "Operation result data",
          schema: {
            type: "array",
            items: { type: "object" },
          },
        },
        {
          name: "matchedCount",
          type: "number",
          description: "Number of documents matched by the operation",
        },
        {
          name: "modifiedCount",
          type: "number",
          description: "Number of documents modified",
        },
        {
          name: "insertedCount",
          type: "number",
          description: "Number of documents inserted",
        },
        {
          name: "deletedCount",
          type: "number",
          description: "Number of documents deleted",
        },
      ],
      compatibilityMatrix: [
        {
          targetType: "data-filter",
          outputPin: "result",
          targetInputPin: "data",
          compatibility: "full",
        },
        {
          targetType: "field-mapper",
          outputPin: "result",
          targetInputPin: "source",
          compatibility: "full",
        },
      ],
      configuration: {
        timeout: 30000,
        retries: 3,
        concurrency: 1,
        batchSize: 1000,
      },
      tags: ["database", "mongodb", "nosql", "crud"],
      relatedNodes: ["data-filter", "field-mapper", "postgresql-query"],
    };
  }

  constructor(config: MongoDBConfig = {}) {
    super(config);
  }

  async execute(input: MongoDBInput): Promise<NodeResult<MongoDBOutput>> {
    const startTime = Date.now();
    const timeout =
      input.options?.timeout || this.config.defaultTimeout || 30000;
    const retries = input.options?.retries || this.config.defaultRetries || 3;

    try {
      // Connection with retry logic
      await this.connectWithRetry(input.connectionString, retries);

      const db = this.client!.db(input.database);
      const collection = db.collection(input.collection);

      // Execute operation with timeout
      const result = await Promise.race([
        this.executeOperation(collection, input),
        this.createTimeoutPromise(timeout),
      ]);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          ...result,
          operationType: input.operation,
        },
        metrics: {
          executionTime,
          recordsProcessed: this.getRecordsProcessed(result, input.operation),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown MongoDB error",
      };
    } finally {
      await this.disconnect();
    }
  }

  private async connectWithRetry(
    connectionString: string,
    retries: number
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.client = new MongoClient(connectionString, {
          maxPoolSize: this.config.connectionPool?.maxPoolSize || 10,
          minPoolSize: this.config.connectionPool?.minPoolSize || 1,
          maxIdleTimeMS: this.config.connectionPool?.maxIdleTimeMS || 30000,
          serverSelectionTimeoutMS:
            this.config.connectionPool?.serverSelectionTimeoutMS || 5000,
        });

        await this.client.connect();
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Connection failed");

        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to connect after ${retries} attempts: ${lastError?.message}`
    );
  }

  private async executeOperation(
    collection: Collection,
    input: MongoDBInput
  ): Promise<Omit<MongoDBOutput, "operationType">> {
    const {
      operation,
      query = {},
      document,
      update,
      pipeline,
      options = {},
    } = input;

    // Convert string IDs to ObjectId where appropriate
    const processedQuery = this.processObjectIds(query);
    const processedUpdate = update ? this.processObjectIds(update) : undefined;

    switch (operation) {
      case "find":
        const findOptions: any = {};
        if (options.sort) findOptions.sort = options.sort;
        if (options.limit) findOptions.limit = options.limit;
        if (options.skip) findOptions.skip = options.skip;
        if (options.projection) findOptions.projection = options.projection;

        const findResult = await collection
          .find(processedQuery, findOptions)
          .toArray();
        return {
          result: findResult,
          matchedCount: findResult.length,
        };

      case "findOne":
        const findOneOptions: any = {};
        if (options.projection) findOneOptions.projection = options.projection;

        const findOneResult = await collection.findOne(
          processedQuery,
          findOneOptions
        );
        return {
          result: findOneResult,
          matchedCount: findOneResult ? 1 : 0,
        };

      case "insertOne":
        if (!document || Array.isArray(document)) {
          throw new Error("insertOne requires a single document");
        }

        const insertOneResult = await collection.insertOne(document);
        return {
          result: { insertedId: insertOneResult.insertedId },
          insertedCount: 1,
          insertedIds: { 0: insertOneResult.insertedId },
        };

      case "insertMany":
        if (!Array.isArray(document)) {
          throw new Error("insertMany requires an array of documents");
        }

        const insertManyResult = await collection.insertMany(document);
        return {
          result: { insertedIds: insertManyResult.insertedIds },
          insertedCount: insertManyResult.insertedCount,
          insertedIds: insertManyResult.insertedIds,
        };

      case "updateOne":
        if (!processedUpdate) {
          throw new Error("updateOne requires an update document");
        }

        const updateOneResult = await collection.updateOne(
          processedQuery,
          processedUpdate,
          { upsert: options.upsert || false }
        );
        return {
          result: {
            matchedCount: updateOneResult.matchedCount,
            modifiedCount: updateOneResult.modifiedCount,
            upsertedId: updateOneResult.upsertedId,
          },
          matchedCount: updateOneResult.matchedCount,
          modifiedCount: updateOneResult.modifiedCount,
        };

      case "updateMany":
        if (!processedUpdate) {
          throw new Error("updateMany requires an update document");
        }

        const updateManyResult = await collection.updateMany(
          processedQuery,
          processedUpdate,
          { upsert: options.upsert || false }
        );
        return {
          result: {
            matchedCount: updateManyResult.matchedCount,
            modifiedCount: updateManyResult.modifiedCount,
            upsertedCount: updateManyResult.upsertedCount,
          },
          matchedCount: updateManyResult.matchedCount,
          modifiedCount: updateManyResult.modifiedCount,
        };

      case "deleteOne":
        const deleteOneResult = await collection.deleteOne(processedQuery);
        return {
          result: { deletedCount: deleteOneResult.deletedCount },
          deletedCount: deleteOneResult.deletedCount,
        };

      case "deleteMany":
        const deleteManyResult = await collection.deleteMany(processedQuery);
        return {
          result: { deletedCount: deleteManyResult.deletedCount },
          deletedCount: deleteManyResult.deletedCount,
        };

      case "aggregate":
        if (!pipeline) {
          throw new Error("aggregate requires a pipeline");
        }

        const aggregateResult = await collection.aggregate(pipeline).toArray();
        return {
          result: aggregateResult,
          matchedCount: aggregateResult.length,
        };

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private processObjectIds(obj: any): any {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processObjectIds(item));
    }

    const processed: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === "_id" || key.endsWith("Id")) {
        if (typeof value === "string" && ObjectId.isValid(value)) {
          processed[key] = new ObjectId(value);
        } else {
          processed[key] = value;
        }
      } else if (typeof value === "object" && value !== null) {
        processed[key] = this.processObjectIds(value);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  private getRecordsProcessed(result: any, operation: MongoOperation): number {
    switch (operation) {
      case "find":
      case "aggregate":
        return Array.isArray(result.result) ? result.result.length : 0;
      case "findOne":
        return result.result ? 1 : 0;
      case "insertOne":
        return result.insertedCount || 0;
      case "insertMany":
        return result.insertedCount || 0;
      case "updateOne":
      case "updateMany":
        return result.modifiedCount || 0;
      case "deleteOne":
      case "deleteMany":
        return result.deletedCount || 0;
      default:
        return 0;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        // Log error but don't throw - cleanup should be silent
        console.warn("Error closing MongoDB connection:", error);
      } finally {
        this.client = null;
      }
    }
  }

  validate(input: MongoDBInput): boolean {
    if (!super.validate(input)) return false;

    // Required fields validation
    if (
      !input.connectionString ||
      !input.database ||
      !input.collection ||
      !input.operation
    ) {
      return false;
    }

    // Operation-specific validation
    switch (input.operation) {
      case "insertOne":
        return !!input.document && !Array.isArray(input.document);

      case "insertMany":
        return (
          !!input.document &&
          Array.isArray(input.document) &&
          input.document.length > 0
        );

      case "updateOne":
      case "updateMany":
        return !!input.update;

      case "aggregate":
        return (
          !!input.pipeline &&
          Array.isArray(input.pipeline) &&
          input.pipeline.length > 0
        );

      case "find":
      case "findOne":
      case "deleteOne":
      case "deleteMany":
        return true; // Query is optional for these operations

      default:
        return false;
    }
  }

  // Utility method for creating ObjectId instances
  static createObjectId(id?: string): ObjectId {
    return id ? new ObjectId(id) : new ObjectId();
  }

  // Utility method for validating ObjectId strings
  static isValidObjectId(id: string): boolean {
    return ObjectId.isValid(id);
  }
}
