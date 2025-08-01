import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';

describe('Monitoring and Metrics E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Execute a few test flows to generate metrics
    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupTestData() {
    // Create test flows
    const testFlow1 = await request(app.getHttpServer())
      .post('/flows')
      .send({
        id: 'metrics-test-flow-1',
        name: 'Metrics Test Flow 1',
        description: 'Flow for metrics testing',
        nodes: [
          {
            id: 'test-node-1',
            type: 'postgres-query',
            version: '1.0.0',
            position: { x: 100, y: 100 },
            config: {
              connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
              query: 'SELECT 1 as test_value',
              outputFormat: 'json'
            }
          }
        ],
        connections: [],
        createdBy: 'metrics-test-user'
      });

    const testFlow2 = await request(app.getHttpServer())
      .post('/flows')
      .send({
        id: 'metrics-test-flow-2',
        name: 'Metrics Test Flow 2',
        description: 'Another flow for metrics testing',
        nodes: [
          {
            id: 'test-node-2',
            type: 'postgres-query',
            version: '1.0.0',
            position: { x: 100, y: 100 },
            config: {
              connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
              query: 'SELECT COUNT(*) as count FROM information_schema.tables',
              outputFormat: 'json'
            }
          }
        ],
        connections: [],
        createdBy: 'metrics-test-user'
      });

    // Create schedules
    const schedule1 = await request(app.getHttpServer())
      .post('/scheduler/schedules')
      .send({
        name: 'Metrics Test Schedule 1',
        flowId: testFlow1.body.id,
        cronExpression: '0 0 1 1 *',
        enabled: false,
        timezone: 'UTC'
      });

    const schedule2 = await request(app.getHttpServer())
      .post('/scheduler/schedules')
      .send({
        name: 'Metrics Test Schedule 2', 
        flowId: testFlow2.body.id,
        cronExpression: '0 0 1 1 *',
        enabled: false,
        timezone: 'UTC'
      });

    // Execute some flows to generate metrics
    const executions = await Promise.all([
      request(app.getHttpServer())
        .post(`/scheduler/schedules/${schedule1.body.id}/execute`),
      request(app.getHttpServer())
        .post(`/scheduler/schedules/${schedule2.body.id}/execute`),
      request(app.getHttpServer())
        .post(`/scheduler/schedules/${schedule1.body.id}/execute`),
    ]);

    // Wait for executions to complete
    for (const execution of executions) {
      const executionId = execution.body.executionId;
      let attempts = 0;
      let completed = false;
      
      while (!completed && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const status = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`);
        
        if (status.body.status !== 'running') {
          completed = true;
        }
        attempts++;
      }
    }

    // Wait a bit more for metrics to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  describe('System Metrics', () => {
    it('should provide current system metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/system')
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body.current).toHaveProperty('activeExecutions');
      expect(response.body.current).toHaveProperty('completedExecutions');
      expect(response.body.current).toHaveProperty('failedExecutions');
      expect(response.body.current).toHaveProperty('averageExecutionTime');
      expect(response.body.current).toHaveProperty('systemMemoryUsage');
      expect(response.body.current).toHaveProperty('systemCpuUsage');
      expect(response.body.current).toHaveProperty('uptime');

      expect(typeof response.body.current.activeExecutions).toBe('number');
      expect(typeof response.body.current.completedExecutions).toBe('number');
      expect(typeof response.body.current.uptime).toBe('number');
      expect(response.body.current.systemMemoryUsage).toHaveProperty('heapUsed');
      expect(response.body.current.systemCpuUsage).toHaveProperty('user');
    });

    it('should provide system metrics history', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/system/history?hours=1')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const metric = response.body[0];
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('activeExecutions');
        expect(metric).toHaveProperty('completedExecutions');
        expect(metric).toHaveProperty('systemMemoryUsage');
        expect(metric).toHaveProperty('uptime');
      }
    });

    it('should provide active jobs information', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/system')
        .expect(200);

      expect(response.body).toHaveProperty('activeJobs');
      expect(response.body).toHaveProperty('activeJobsList');
      expect(typeof response.body.activeJobs).toBe('number');
      expect(Array.isArray(response.body.activeJobsList)).toBe(true);
    });
  });

  describe('Flow Metrics', () => {
    it('should provide metrics for all flows', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/flows')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const flowMetric = response.body[0];
        expect(flowMetric).toHaveProperty('flowId');
        expect(flowMetric).toHaveProperty('flowName');
        expect(flowMetric).toHaveProperty('executionCount');
        expect(flowMetric).toHaveProperty('successCount');
        expect(flowMetric).toHaveProperty('failureCount');
        expect(flowMetric).toHaveProperty('averageExecutionTime');
        expect(flowMetric).toHaveProperty('totalRecordsProcessed');
        expect(flowMetric).toHaveProperty('successRate');
        expect(flowMetric).toHaveProperty('averageNodeCount');

        expect(typeof flowMetric.executionCount).toBe('number');
        expect(typeof flowMetric.successRate).toBe('number');
        expect(flowMetric.successRate).toBeGreaterThanOrEqual(0);
        expect(flowMetric.successRate).toBeLessThanOrEqual(100);
      }
    });

    it('should provide metrics for specific flow', async () => {
      // First get all flows to find a valid flow ID
      const flowsResponse = await request(app.getHttpServer())
        .get('/monitoring/flows')
        .expect(200);

      if (flowsResponse.body.length > 0) {
        const flowId = flowsResponse.body[0].flowId;
        
        const response = await request(app.getHttpServer())
          .get(`/monitoring/flows/${flowId}`)
          .expect(200);

        expect(response.body).toHaveProperty('flowId');
        expect(response.body.flowId).toBe(flowId);
        expect(response.body).toHaveProperty('executionCount');
        expect(response.body).toHaveProperty('successCount');
        expect(response.body).toHaveProperty('averageExecutionTime');
      }
    });

    it('should return error for non-existent flow', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/flows/non-existent-flow')
        .expect(200);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Flow metrics not found');
    });
  });

  describe('Node Metrics', () => {
    it('should provide metrics for all node types', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/nodes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const nodeMetric = response.body[0];
        expect(nodeMetric).toHaveProperty('nodeType');
        expect(nodeMetric).toHaveProperty('executionCount');
        expect(nodeMetric).toHaveProperty('successCount');
        expect(nodeMetric).toHaveProperty('failureCount');
        expect(nodeMetric).toHaveProperty('averageExecutionTime');
        expect(nodeMetric).toHaveProperty('totalRecordsProcessed');
        expect(nodeMetric).toHaveProperty('errorRate');

        expect(typeof nodeMetric.executionCount).toBe('number');
        expect(typeof nodeMetric.errorRate).toBe('number');
        expect(nodeMetric.errorRate).toBeGreaterThanOrEqual(0);
        expect(nodeMetric.errorRate).toBeLessThanOrEqual(100);
      }
    });

    it('should provide metrics for specific node type', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/nodes/postgres-query')
        .expect(200);

      if (!response.body.error) {
        expect(response.body).toHaveProperty('nodeType');
        expect(response.body.nodeType).toBe('postgres-query');
        expect(response.body).toHaveProperty('executionCount');
        expect(response.body).toHaveProperty('successCount');
        expect(response.body).toHaveProperty('averageExecutionTime');
      }
    });

    it('should return error for non-existent node type', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/nodes/non-existent-node')
        .expect(200);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Node metrics not found');
    });
  });

  describe('Overall Statistics', () => {
    it('should provide overall system statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalExecutions');
      expect(response.body).toHaveProperty('successfulExecutions');
      expect(response.body).toHaveProperty('failedExecutions');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('totalRecordsProcessed');
      expect(response.body).toHaveProperty('averageExecutionTime');
      expect(response.body).toHaveProperty('topFailedNodeTypes');
      expect(response.body).toHaveProperty('topExecutedNodeTypes');

      expect(typeof response.body.totalExecutions).toBe('number');
      expect(typeof response.body.successRate).toBe('number');
      expect(Array.isArray(response.body.topFailedNodeTypes)).toBe(true);
      expect(Array.isArray(response.body.topExecutedNodeTypes)).toBe(true);

      expect(response.body.successRate).toBeGreaterThanOrEqual(0);
      expect(response.body.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Analysis', () => {
    it('should provide slow execution analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/performance/slow-executions?limit=5')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const slowExecution = response.body[0];
        expect(slowExecution).toHaveProperty('executionId');
        expect(slowExecution).toHaveProperty('flowId');
        expect(slowExecution).toHaveProperty('duration');
        expect(slowExecution).toHaveProperty('status');

        expect(typeof slowExecution.duration).toBe('number');
        expect(slowExecution.duration).toBeGreaterThan(0);
      }
    });

    it('should provide high memory usage analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/performance/high-memory-executions?limit=5')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const highMemoryExecution = response.body[0];
        expect(highMemoryExecution).toHaveProperty('executionId');
        expect(highMemoryExecution).toHaveProperty('flowId');
        expect(highMemoryExecution).toHaveProperty('memoryUsage');
        expect(highMemoryExecution).toHaveProperty('status');

        expect(typeof highMemoryExecution.memoryUsage).toBe('number');
        expect(highMemoryExecution.memoryUsage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Health Check', () => {
    it('should provide comprehensive health check', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('healthScore');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('timestamp');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      expect(typeof response.body.healthScore).toBe('number');
      expect(response.body.healthScore).toBeGreaterThanOrEqual(0);
      expect(response.body.healthScore).toBeLessThanOrEqual(100);

      expect(response.body.checks).toHaveProperty('memoryUsage');
      expect(response.body.checks).toHaveProperty('successRate');
      expect(response.body.checks).toHaveProperty('activeExecutions');
      expect(response.body.checks).toHaveProperty('uptime');

      // Check individual health check items
      Object.values(response.body.checks).forEach((check: any) => {
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('value');
        expect(['ok', 'warning', 'error']).toContain(check.status);
      });
    });

    it('should indicate healthy status with good metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      // With our test setup, the system should be healthy
      expect(['healthy', 'degraded']).toContain(response.body.status);
      expect(response.body.healthScore).toBeGreaterThan(50);
    });
  });

  describe('Dashboard Data', () => {
    it('should provide comprehensive dashboard data', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('topNodes');
      expect(response.body).toHaveProperty('flows');

      // Current metrics
      expect(response.body.current).toHaveProperty('activeExecutions');
      expect(response.body.current).toHaveProperty('completedExecutions');
      expect(response.body.current).toHaveProperty('failedExecutions');
      expect(response.body.current).toHaveProperty('successRate');
      expect(response.body.current).toHaveProperty('averageExecutionTime');
      expect(response.body.current).toHaveProperty('totalRecordsProcessed');
      expect(response.body.current).toHaveProperty('memoryUsageMB');
      expect(response.body.current).toHaveProperty('uptime');

      // Trends
      expect(response.body.trends).toHaveProperty('executionHistory');
      expect(response.body.trends).toHaveProperty('memoryHistory');
      expect(Array.isArray(response.body.trends.executionHistory)).toBe(true);
      expect(Array.isArray(response.body.trends.memoryHistory)).toBe(true);

      // Top nodes
      expect(response.body.topNodes).toHaveProperty('mostExecuted');
      expect(response.body.topNodes).toHaveProperty('mostFailed');
      expect(Array.isArray(response.body.topNodes.mostExecuted)).toBe(true);
      expect(Array.isArray(response.body.topNodes.mostFailed)).toBe(true);

      // Flows
      expect(Array.isArray(response.body.flows)).toBe(true);
    });

    it('should provide trend data with timestamps', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/dashboard')
        .expect(200);

      if (response.body.trends.executionHistory.length > 0) {
        const historyItem = response.body.trends.executionHistory[0];
        expect(historyItem).toHaveProperty('timestamp');
        expect(historyItem).toHaveProperty('completed');
        expect(historyItem).toHaveProperty('failed');
        expect(historyItem).toHaveProperty('active');

        expect(new Date(historyItem.timestamp)).toBeInstanceOf(Date);
      }

      if (response.body.trends.memoryHistory.length > 0) {
        const memoryItem = response.body.trends.memoryHistory[0];
        expect(memoryItem).toHaveProperty('timestamp');
        expect(memoryItem).toHaveProperty('memoryMB');

        expect(new Date(memoryItem.timestamp)).toBeInstanceOf(Date);
        expect(typeof memoryItem.memoryMB).toBe('number');
      }
    });
  });

  describe('Job Metrics', () => {
    it('should provide job metrics for active jobs', async () => {
      // Start an execution to create active jobs
      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send({
          id: 'job-metrics-test-flow',
          name: 'Job Metrics Test Flow',
          description: 'Flow for testing job metrics',
          nodes: [
            {
              id: 'slow-node',
              type: 'postgres-query',
              version: '1.0.0',
              position: { x: 100, y: 100 },
              config: {
                connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
                query: 'SELECT pg_sleep(2), 1 as value', // 2 second delay
                outputFormat: 'json'
              }
            }
          ],
          connections: [],
          createdBy: 'job-metrics-test-user'
        });

      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'Job Metrics Test Schedule',
          flowId: flowResponse.body.id,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        });

      const executionResponse = await request(app.getHttpServer())
        .post(`/scheduler/schedules/${scheduleResponse.body.id}/execute`)
        .expect(201);

      // Check system metrics while job is running
      const systemResponse = await request(app.getHttpServer())
        .get('/monitoring/system')
        .expect(200);

      expect(systemResponse.body).toHaveProperty('activeJobs');
      expect(systemResponse.body).toHaveProperty('activeJobsList');

      // Wait for execution to complete
      const executionId = executionResponse.body.executionId;
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const status = await request(app.getHttpServer())
          .get(`/scheduler/executions/${executionId}`);
        
        if (status.body.status !== 'running') {
          break;
        }
        attempts++;
      }
    }, 30000);
  });

  describe('Metrics Data Validation', () => {
    it('should have consistent data across different endpoints', async () => {
      const [systemResponse, statsResponse, dashboardResponse] = await Promise.all([
        request(app.getHttpServer()).get('/monitoring/system'),
        request(app.getHttpServer()).get('/monitoring/stats'),
        request(app.getHttpServer()).get('/monitoring/dashboard')
      ]);

      // Verify consistency between system and stats
      expect(systemResponse.body.current.completedExecutions)
        .toBe(statsResponse.body.successfulExecutions);
      expect(systemResponse.body.current.failedExecutions)
        .toBe(statsResponse.body.failedExecutions);

      // Verify consistency between stats and dashboard
      expect(statsResponse.body.successRate)
        .toBe(dashboardResponse.body.current.successRate);
      expect(statsResponse.body.totalRecordsProcessed)
        .toBe(dashboardResponse.body.current.totalRecordsProcessed);
    });

    it('should have valid numeric ranges', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/stats')
        .expect(200);

      expect(response.body.successRate).toBeGreaterThanOrEqual(0);
      expect(response.body.successRate).toBeLessThanOrEqual(100);
      expect(response.body.totalExecutions).toBeGreaterThanOrEqual(0);
      expect(response.body.successfulExecutions).toBeGreaterThanOrEqual(0);
      expect(response.body.failedExecutions).toBeGreaterThanOrEqual(0);
      expect(response.body.totalRecordsProcessed).toBeGreaterThanOrEqual(0);
      expect(response.body.averageExecutionTime).toBeGreaterThanOrEqual(0);

      // Total executions should equal success + failures
      expect(response.body.totalExecutions)
        .toBe(response.body.successfulExecutions + response.body.failedExecutions);
    });

    it('should provide meaningful top node statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring/stats')
        .expect(200);

      if (response.body.topExecutedNodeTypes.length > 0) {
        const topNode = response.body.topExecutedNodeTypes[0];
        expect(topNode).toHaveProperty('nodeType');
        expect(topNode).toHaveProperty('executionCount');
        expect(typeof topNode.nodeType).toBe('string');
        expect(typeof topNode.executionCount).toBe('number');
        expect(topNode.executionCount).toBeGreaterThan(0);
      }

      // Most executed should be sorted in descending order
      for (let i = 1; i < response.body.topExecutedNodeTypes.length; i++) {
        expect(response.body.topExecutedNodeTypes[i - 1].executionCount)
          .toBeGreaterThanOrEqual(response.body.topExecutedNodeTypes[i].executionCount);
      }
    });
  });
});