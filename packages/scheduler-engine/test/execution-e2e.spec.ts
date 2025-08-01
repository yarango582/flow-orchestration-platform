import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ExecutionOrchestrator } from '../src/execution/execution-orchestrator.service';
import { FlowsService } from '../src/flows/flows.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { MetricsService } from '../src/monitoring/metrics.service';
import { ExecutionStatus } from '../src/database/entities/execution.entity';

describe('Flow Execution E2E', () => {
  let app: INestApplication;
  let executionOrchestrator: ExecutionOrchestrator;
  let flowsService: FlowsService;
  let schedulerService: SchedulerService;
  let metricsService: MetricsService;

  // Test flow definitions
  const testFlows = {
    simplePostgreSQLFlow: {
      id: 'test-flow-1',
      name: 'Simple PostgreSQL Query Flow',
      description: 'Test flow with PostgreSQL query node',
      nodes: [
        {
          id: 'node-1',
          type: 'postgres-query',
          version: '1.0.0',
          position: { x: 100, y: 100 },
          config: {
            connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
            query: 'SELECT id, name, email FROM users LIMIT 10',
            outputFormat: 'json'
          }
        }
      ],
      connections: [],
      createdBy: 'test-user',
      metadata: {
        testFlow: true,
        category: 'database'
      }
    },

    mongoToPostgresFlow: {
      id: 'test-flow-2',
      name: 'MongoDB to PostgreSQL Flow',
      description: 'Test flow: MongoDB query -> Filter -> PostgreSQL insert',
      nodes: [
        {
          id: 'mongo-source',
          type: 'mongodb-operations',
          version: '1.0.0',
          position: { x: 100, y: 100 },
          config: {
            connectionString: 'mongodb://mongo_user:password@mongodb:27017/flow_platform?authSource=admin',
            operation: 'find',
            collection: 'users',
            query: { status: 'active' },
            options: { limit: 5 }
          }
        },
        {
          id: 'data-filter',
          type: 'data-filter',
          version: '1.0.0',
          position: { x: 300, y: 100 },
          config: {
            conditions: [
              {
                field: 'age',
                operator: 'greater_than',
                value: 25
              }
            ]
          }
        },
        {
          id: 'field-mapper',
          type: 'field-mapper',
          version: '1.0.0',
          position: { x: 500, y: 100 },
          config: {
            mappings: {
              user_id: '_id',
              full_name: 'name',
              email_address: 'email',
              user_age: 'age',
              account_status: 'status'
            }
          }
        }
      ],
      connections: [
        {
          fromNodeId: 'mongo-source',
          toNodeId: 'data-filter',
          fromOutput: 'data',
          toInput: 'data'
        },
        {
          fromNodeId: 'data-filter',
          toNodeId: 'field-mapper',
          fromOutput: 'filtered',
          toInput: 'data'
        }
      ],
      createdBy: 'test-user',
      metadata: {
        testFlow: true,
        category: 'integration'
      }
    },

    complexBranchingFlow: {
      id: 'test-flow-3',
      name: 'Complex Branching Flow',
      description: 'Test flow with branching: PostgreSQL -> Filter1 -> Mapper1, Filter2 -> Mapper2',
      nodes: [
        {
          id: 'postgres-source',
          type: 'postgres-query',
          version: '1.0.0',
          position: { x: 100, y: 200 },
          config: {
            connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
            query: 'SELECT * FROM flow_definitions',
            outputFormat: 'json'
          }
        },
        {
          id: 'filter-active',
          type: 'data-filter',
          version: '1.0.0',
          position: { x: 300, y: 100 },
          config: {
            conditions: [
              {
                field: 'status',
                operator: 'equals',
                value: 'active'
              }
            ]
          }
        },
        {
          id: 'filter-draft',
          type: 'data-filter',
          version: '1.0.0',
          position: { x: 300, y: 300 },
          config: {
            conditions: [
              {
                field: 'status',
                operator: 'equals',
                value: 'draft'
              }
            ]
          }
        },
        {
          id: 'mapper-active',
          type: 'field-mapper',
          version: '1.0.0',
          position: { x: 500, y: 100 },
          config: {
            mappings: {
              flow_id: 'id',
              flow_title: 'name',
              flow_desc: 'description',
              is_active: { value: true }
            }
          }
        },
        {
          id: 'mapper-draft',
          type: 'field-mapper',
          version: '1.0.0',
          position: { x: 500, y: 300 },
          config: {
            mappings: {
              flow_id: 'id',
              flow_title: 'name',
              flow_desc: 'description',
              is_active: { value: false }
            }
          }
        }
      ],
      connections: [
        {
          fromNodeId: 'postgres-source',
          toNodeId: 'filter-active',
          fromOutput: 'data',
          toInput: 'data'
        },
        {
          fromNodeId: 'postgres-source',
          toNodeId: 'filter-draft',
          fromOutput: 'data',
          toInput: 'data'
        },
        {
          fromNodeId: 'filter-active',
          toNodeId: 'mapper-active',
          fromOutput: 'filtered',
          toInput: 'data'
        },
        {
          fromNodeId: 'filter-draft',
          toNodeId: 'mapper-draft',
          fromOutput: 'filtered',
          toInput: 'data'
        }
      ],
      createdBy: 'test-user',
      metadata: {
        testFlow: true,
        category: 'branching'
      }
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    executionOrchestrator = app.get<ExecutionOrchestrator>(ExecutionOrchestrator);
    flowsService = app.get<FlowsService>(FlowsService);
    schedulerService = app.get<SchedulerService>(SchedulerService);
    metricsService = app.get<MetricsService>(MetricsService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Flow Creation and Validation', () => {
    it('should create a simple PostgreSQL flow', async () => {
      const response = await request(app.getHttpServer())
        .post('/flows')
        .send(testFlows.simplePostgreSQLFlow)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(testFlows.simplePostgreSQLFlow.name);
      expect(response.body.nodes).toHaveLength(1);
    });

    it('should create a MongoDB to PostgreSQL flow', async () => {
      const response = await request(app.getHttpServer())
        .post('/flows')
        .send(testFlows.mongoToPostgresFlow)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.nodes).toHaveLength(3);
      expect(response.body.connections).toHaveLength(2);
    });

    it('should create a complex branching flow', async () => {
      const response = await request(app.getHttpServer())
        .post('/flows')
        .send(testFlows.complexBranchingFlow)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.nodes).toHaveLength(5);
      expect(response.body.connections).toHaveLength(4);
    });

    it('should validate flow connections', async () => {
      const invalidFlow = {
        ...testFlows.simplePostgreSQLFlow,
        id: 'invalid-flow',
        connections: [
          {
            fromNodeId: 'non-existent-node',
            toNodeId: 'node-1',
            fromOutput: 'data',
            toInput: 'input'
          }
        ]
      };

      await request(app.getHttpServer())
        .post('/flows')
        .send(invalidFlow)
        .expect(400);
    });
  });

  describe('Flow Execution', () => {
    let flowId1: string;
    let flowId2: string;
    let flowId3: string;

    beforeAll(async () => {
      // Create flows first
      const flow1Response = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.simplePostgreSQLFlow, id: 'exec-test-1' });
      flowId1 = flow1Response.body.id;

      const flow2Response = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.mongoToPostgresFlow, id: 'exec-test-2' });
      flowId2 = flow2Response.body.id;

      const flow3Response = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.complexBranchingFlow, id: 'exec-test-3' });
      flowId3 = flow3Response.body.id;
    });

    it('should execute simple PostgreSQL flow successfully', async () => {
      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test PostgreSQL Execution',
          flowId: flowId1,
          cronExpression: '0 0 1 1 *', // Run once a year (manual trigger)
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      const scheduleId = scheduleResponse.body.id;

      // Trigger manual execution
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleId}/execute`)
        .expect(201);

      const executionId = executionResponse.body.executionId;

      // Wait for execution to complete (with timeout)
      let execution;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      do {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`)
          .expect(200);
        
        execution = executionStatus.body;
        attempts++;
      } while (
        execution.status === ExecutionStatus.RUNNING && 
        attempts < maxAttempts
      );

      expect(execution.status).toBe(ExecutionStatus.SUCCESS);
      expect(execution.recordsProcessed).toBeGreaterThan(0);
      expect(execution.duration).toBeGreaterThan(0);
    }, 60000); // 60 second timeout for this test

    it('should execute MongoDB to PostgreSQL flow successfully', async () => {
      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test MongoDB Integration',
          flowId: flowId2,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      const scheduleId = scheduleResponse.body.id;

      // Trigger manual execution
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleId}/execute`)
        .expect(201);

      const executionId = executionResponse.body.executionId;

      // Wait for execution to complete
      let execution;
      let attempts = 0;
      const maxAttempts = 45; // 45 seconds timeout for complex flow

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`)
          .expect(200);
        
        execution = executionStatus.body;
        attempts++;
      } while (
        execution.status === ExecutionStatus.RUNNING && 
        attempts < maxAttempts
      );

      expect(execution.status).toBe(ExecutionStatus.SUCCESS);
      expect(execution.nodeExecutions).toHaveLength(3); // 3 nodes executed
      expect(execution.nodeExecutions.every(ne => ne.status === ExecutionStatus.SUCCESS)).toBe(true);
    }, 90000); // 90 second timeout

    it('should execute complex branching flow successfully', async () => {
      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test Complex Branching',
          flowId: flowId3,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      const scheduleId = scheduleResponse.body.id;

      // Trigger manual execution
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleId}/execute`)
        .expect(201);

      const executionId = executionResponse.body.executionId;

      // Wait for execution to complete
      let execution;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds for complex flow

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`)
          .expect(200);
        
        execution = executionStatus.body;
        attempts++;
      } while (
        execution.status === ExecutionStatus.RUNNING && 
        attempts < maxAttempts
      );

      expect(execution.status).toBe(ExecutionStatus.SUCCESS);
      expect(execution.nodeExecutions).toHaveLength(5); // 5 nodes executed
      
      // Verify branching worked correctly
      const nodeTypes = execution.nodeExecutions.map(ne => ne.nodeType);
      expect(nodeTypes).toContain('postgres-query');
      expect(nodeTypes).toContain('data-filter');
      expect(nodeTypes).toContain('field-mapper');
    }, 120000); // 2 minutes timeout
  });

  describe('Flow Control Operations', () => {
    let flowId: string;
    let scheduleId: string;

    beforeAll(async () => {
      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.simplePostgreSQLFlow, id: 'control-test' });
      flowId = flowResponse.body.id;

      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test Flow Control',
          flowId,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        });
      scheduleId = scheduleResponse.body.id;
    });

    it('should pause and resume execution', async () => {
      // Start execution
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleId}/execute`)
        .expect(201);

      const executionId = executionResponse.body.executionId;

      // Wait a bit then pause
      await new Promise(resolve => setTimeout(resolve, 2000));

      await request(app.getHttpServer())
        .post(`/scheduler/executions/${executionId}/pause`)
        .expect(200);

      // Check status is paused
      const pausedStatus = await request(app.getHttpServer())
        .get(`/scheduler/executions/${executionId}`)
        .expect(200);

      expect(pausedStatus.body.status).toBe(ExecutionStatus.PAUSED);

      // Resume execution
      await request(app.getHttpServer())
        .post(`/scheduler/executions/${executionId}/resume`)
        .expect(200);

      // Wait for completion
      let execution;
      let attempts = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`)
          .expect(200);
        execution = executionStatus.body;
        attempts++;
      } while (execution.status === ExecutionStatus.RUNNING && attempts < 30);

      expect(execution.status).toBe(ExecutionStatus.SUCCESS);
    }, 60000);

    it('should cancel execution', async () => {
      // Start execution
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleId}/execute`)
        .expect(201);

      const executionId = executionResponse.body.executionId;

      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 1000));

      await request(app.getHttpServer())
        .post(`/scheduler/executions/${executionId}/cancel`)
        .expect(200);

      // Check status is cancelled
      const cancelledStatus = await request(app.getHttpServer())
        .get(`/scheduler/executions/${executionId}`)
        .expect(200);

      expect(cancelledStatus.body.status).toBe(ExecutionStatus.CANCELLED);
    }, 30000);
  });

  describe('Monitoring and Metrics', () => {
    it('should collect system metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/system')
        .expect(200);

      expect(response.body.current).toHaveProperty('activeExecutions');
      expect(response.body.current).toHaveProperty('completedExecutions');
      expect(response.body.current).toHaveProperty('systemMemoryUsage');
      expect(response.body).toHaveProperty('activeJobs');
    });

    it('should provide health check', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('healthScore');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('memoryUsage');
      expect(response.body.checks).toHaveProperty('successRate');
    });

    it('should provide dashboard data', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('topNodes');
      expect(response.body).toHaveProperty('flows');
    });

    it('should track flow metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/flows')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const flowMetrics = response.body[0];
        expect(flowMetrics).toHaveProperty('flowId');
        expect(flowMetrics).toHaveProperty('executionCount');
        expect(flowMetrics).toHaveProperty('successCount');
        expect(flowMetrics).toHaveProperty('successRate');
      }
    });

    it('should track node metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/nodes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const nodeMetrics = response.body[0];
        expect(nodeMetrics).toHaveProperty('nodeType');
        expect(nodeMetrics).toHaveProperty('executionCount');
        expect(nodeMetrics).toHaveProperty('successCount');
        expect(nodeMetrics).toHaveProperty('errorRate');
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid node configuration gracefully', async () => {
      const invalidFlow = {
        id: 'invalid-config-flow',
        name: 'Invalid Config Flow',
        description: 'Flow with invalid node configuration',
        nodes: [
          {
            id: 'invalid-node',
            type: 'postgres-query',
            version: '1.0.0',
            position: { x: 100, y: 100 },
            config: {
              connectionString: 'invalid-connection-string',
              query: 'INVALID SQL QUERY',
              outputFormat: 'json'
            }
          }
        ],
        connections: [],
        createdBy: 'test-user'
      };

      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send(invalidFlow)
        .expect(201);

      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test Invalid Config',
          flowId: flowResponse.body.id,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      // Execute the invalid flow
      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleResponse.body.id}/execute`)
        .expect(201);

      // Wait for execution to fail
      let execution;
      let attempts = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionResponse.body.executionId}`)
          .expect(200);
        execution = executionStatus.body;
        attempts++;
      } while (execution.status === ExecutionStatus.RUNNING && attempts < 30);

      expect(execution.status).toBe(ExecutionStatus.FAILED);
      expect(execution.errorMessage).toBeDefined();
    }, 60000);

    it('should handle network timeouts', async () => {
      const timeoutFlow = {
        id: 'timeout-flow',
        name: 'Timeout Test Flow',
        description: 'Flow that should timeout',
        nodes: [
          {
            id: 'timeout-node',
            type: 'postgres-query',
            version: '1.0.0',
            position: { x: 100, y: 100 },
            config: {
              connectionString: 'postgresql://nonexistent:5432/timeout',
              query: 'SELECT pg_sleep(60)', // Long running query
              outputFormat: 'json',
              timeout: 5000 // 5 second timeout
            }
          }
        ],
        connections: [],
        createdBy: 'test-user'
      };

      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send(timeoutFlow)
        .expect(201);

      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Test Timeout',
          flowId: flowResponse.body.id,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleResponse.body.id}/execute`)
        .expect(201);

      // Wait for execution to timeout/fail
      let execution;
      let attempts = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const executionStatus = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionResponse.body.executionId}`)
          .expect(200);
        execution = executionStatus.body;
        attempts++;
      } while (execution.status === ExecutionStatus.RUNNING && attempts < 20);

      expect(execution.status).toBe(ExecutionStatus.FAILED);
    }, 45000);
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent executions', async () => {
      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.simplePostgreSQLFlow, id: 'concurrent-test' })
        .expect(201);

      const scheduleResponses = await Promise.all([
        request(app.getHttpServer())
          .post('/scheduler/schedules')
          .send({
            name: 'Concurrent Test 1',
            flowId: flowResponse.body.id,
            cronExpression: '0 0 1 1 *',
            enabled: false,
            timezone: 'UTC'
          }),
        request(app.getHttpServer())
          .post('/scheduler/schedules')
          .send({
            name: 'Concurrent Test 2',
            flowId: flowResponse.body.id,
            cronExpression: '0 0 1 1 *',
            enabled: false,
            timezone: 'UTC'
          }),
        request(app.getHttpServer())
          .post('/scheduler/schedules')
          .send({
            name: 'Concurrent Test 3',
            flowId: flowResponse.body.id,
            cronExpression: '0 0 1 1 *',
            enabled: false,
            timezone: 'UTC'
          })
      ]);

      // Execute all schedules concurrently
      const executionPromises = scheduleResponses.map(response =>
        request(app.getHttpServer())
          .post(`/scheduler/schedules/${response.body.id}/execute`)
          .expect(201)
      );

      const executionResponses = await Promise.all(executionPromises);
      const executionIds = executionResponses.map(res => res.body.executionId);

      // Wait for all executions to complete
      const completionPromises = executionIds.map(async (executionId) => {
        let execution;
        let attempts = 0;
        do {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const executionStatus = await request(app.getHttpServer())
            .get(`/scheduler/executions/${executionId}`)
            .expect(200);
          execution = executionStatus.body;
          attempts++;
        } while (execution.status === ExecutionStatus.RUNNING && attempts < 30);
        return execution;
      });

      const completedExecutions = await Promise.all(completionPromises);

      // All executions should complete successfully
      completedExecutions.forEach(execution => {
        expect(execution.status).toBe(ExecutionStatus.SUCCESS);
      });
    }, 120000);

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Create and execute a simple flow multiple times
      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send({ ...testFlows.simplePostgreSQLFlow, id: 'performance-test' })
        .expect(201);

      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Performance Test',
          flowId: flowResponse.body.id,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        })
        .expect(201);

      const executions = [];
      for (let i = 0; i < 5; i++) {
        const executionResponse = await request(app.getHttpServer())
          .post(`/scheduler/schedules/${scheduleResponse.body.id}/execute`)
          .expect(201);
        executions.push(executionResponse.body.executionId);
        
        // Small delay between executions
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait for all to complete
      for (const executionId of executions) {
        let execution;
        let attempts = 0;
        do {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const executionStatus = await request(app.getHttpServer())
            .get(`/scheduler/executions/${executionId}`)
            .expect(200);
          execution = executionStatus.body;
          attempts++;
        } while (execution.status === ExecutionStatus.RUNNING && attempts < 30);
        
        expect(execution.status).toBe(ExecutionStatus.SUCCESS);
      }

      const totalTime = Date.now() - startTime;
      
      // Should complete 5 executions in reasonable time (less than 2 minutes)
      expect(totalTime).toBeLessThan(120000);
    }, 180000);
  });
});