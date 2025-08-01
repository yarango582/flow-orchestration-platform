import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as ioClient from 'socket.io-client';
import * as request from 'supertest';

describe('WebSocket Real-time Communication E2E', () => {
  let app: INestApplication;
  let clientSocket: any;
  let clientSocket2: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0); // Use random port for testing
    
    const server = app.getHttpServer();
    const { port } = server.address();
    
    // Create WebSocket clients
    clientSocket = ioClient(`http://localhost:${port}/executions`, {
      transports: ['websocket'],
      forceNew: true,
    });

    clientSocket2 = ioClient(`http://localhost:${port}/executions`, {
      transports: ['websocket'],
      forceNew: true,
    });

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      }),
      new Promise<void>((resolve) => {
        clientSocket2.on('connect', resolve);
      }),
    ]);
  });

  afterAll(async () => {
    clientSocket.disconnect();
    clientSocket2.disconnect();
    await app.close();
  });

  describe('Connection and Subscription', () => {
    it('should connect and receive welcome message', (done) => {
      const newSocket = ioClient(`http://localhost:${app.getHttpServer().address().port}/executions`, {
        transports: ['websocket'],
        forceNew: true,
      });

      newSocket.on('connected', (data) => {
        expect(data).toHaveProperty('clientId');
        expect(data).toHaveProperty('timestamp');
        expect(data.message).toContain('Connected to Flow Platform');
        newSocket.disconnect();
        done();
      });
    });

    it('should subscribe to execution updates', (done) => {
      const executionId = 'test-execution-123';

      clientSocket.emit('subscribe-execution', {
        executionId,
        userId: 'test-user'
      }, (response) => {
        expect(response.success).toBe(true);
        expect(response.executionId).toBe(executionId);
      });

      clientSocket.on('subscription-confirmed', (data) => {
        expect(data.type).toBe('execution');
        expect(data.id).toBe(executionId);
        done();
      });
    });

    it('should subscribe to flow updates', (done) => {
      const flowId = 'test-flow-456';

      clientSocket.emit('subscribe-flow', {
        flowId,
        userId: 'test-user'
      }, (response) => {
        expect(response.success).toBe(true);
        expect(response.flowId).toBe(flowId);
      });

      clientSocket.on('subscription-confirmed', (data) => {
        expect(data.type).toBe('flow');
        expect(data.id).toBe(flowId);
        done();
      });
    });

    it('should subscribe to user executions', (done) => {
      const userId = 'test-user-789';

      clientSocket.emit('subscribe-user-executions', {
        userId
      }, (response) => {
        expect(response.success).toBe(true);
        expect(response.userId).toBe(userId);
      });

      clientSocket.on('subscription-confirmed', (data) => {
        expect(data.type).toBe('user-executions');
        expect(data.id).toBe(userId);
        done();
      });
    });

    it('should unsubscribe from execution updates', (done) => {
      const executionId = 'test-execution-unsubscribe';

      // First subscribe
      clientSocket.emit('subscribe-execution', { executionId }, (response) => {
        expect(response.success).toBe(true);
        
        // Then unsubscribe
        clientSocket.emit('unsubscribe-execution', { executionId }, (unsubResponse) => {
          expect(unsubResponse.success).toBe(true);
          expect(unsubResponse.executionId).toBe(executionId);
        });
      });

      clientSocket.on('subscription-removed', (data) => {
        expect(data.type).toBe('execution');
        expect(data.id).toBe(executionId);
        done();
      });
    });
  });

  describe('Real-time Execution Updates', () => {
    let testFlowId: string;
    let testScheduleId: string;

    beforeAll(async () => {
      // Create a test flow
      const flowResponse = await request(app.getHttpServer())
        .post('/flows')
        .send({
          id: 'websocket-test-flow',
          name: 'WebSocket Test Flow',
          description: 'Flow for testing WebSocket updates',
          nodes: [
            {
              id: 'test-node',
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
          createdBy: 'websocket-test-user'
        });

      testFlowId = flowResponse.body.id;

      // Create a test schedule
      const scheduleResponse = await request(app.getHttpServer())
        .post('/scheduler/schedules')
        .send({
          name: 'WebSocket Test Schedule',
          flowId: testFlowId,
          cronExpression: '0 0 1 1 *',
          enabled: false,
          timezone: 'UTC'
        });

      testScheduleId = scheduleResponse.body.id;
    });

    it('should receive execution started event', (done) => {
      const executionPromise = request(app.getHttpServer())
        .post(`/scheduler/schedules/${testScheduleId}/execute`);

      clientSocket.on('execution-update', (data) => {
        if (data.status === 'running') {
          expect(data).toHaveProperty('executionId');
          expect(data).toHaveProperty('flowId');
          expect(data.status).toBe('running');
          done();
        }
      });

      // Subscribe to flow updates before executing
      clientSocket.emit('subscribe-flow', { flowId: testFlowId });
      
      // Execute after a short delay to ensure subscription is active
      setTimeout(() => {
        executionPromise.then(response => {
          expect(response.status).toBe(201);
        });
      }, 100);
    }, 30000);

    it('should receive node execution events', (done) => {
      let nodeStartedReceived = false;
      let nodeCompletedReceived = false;

      clientSocket.on('execution-update', (data) => {
        if (data.nodeUpdate) {
          if (data.nodeUpdate.status === 'started') {
            expect(data.nodeUpdate).toHaveProperty('nodeId');
            expect(data.nodeUpdate).toHaveProperty('nodeType');
            nodeStartedReceived = true;
          }
          
          if (data.nodeUpdate.status === 'completed') {
            expect(data.nodeUpdate).toHaveProperty('nodeId');
            expect(data.nodeUpdate).toHaveProperty('nodeType');
            expect(data.nodeUpdate).toHaveProperty('recordsProcessed');
            nodeCompletedReceived = true;
          }

          if (nodeStartedReceived && nodeCompletedReceived) {
            done();
          }
        }
      });

      // Execute flow
      request(app.getHttpServer())
        .post(`/scheduler/schedules/${testScheduleId}/execute`)
        .expect(201);
    }, 30000);

    it('should receive execution completed event', (done) => {
      clientSocket.on('execution-update', (data) => {
        if (data.status === 'completed') {
          expect(data).toHaveProperty('executionId');
          expect(data).toHaveProperty('flowId');
          expect(data.status).toBe('completed');
          expect(data).toHaveProperty('metrics');
          expect(data.metrics).toHaveProperty('duration');
          expect(data.metrics).toHaveProperty('recordsProcessed');
          done();
        }
      });

      // Execute flow
      request(app.getHttpServer())
        .post(`/scheduler/schedules/${testScheduleId}/execute`)
        .expect(201);
    }, 30000);

    it('should receive execution failed event for invalid flow', (done) => {
      // Create an invalid flow
      request(app.getHttpServer())
        .post('/flows')
        .send({
          id: 'invalid-websocket-flow',
          name: 'Invalid WebSocket Flow',
          description: 'Flow that will fail',
          nodes: [
            {
              id: 'invalid-node',
              type: 'postgres-query',
              version: '1.0.0',
              position: { x: 100, y: 100 },
              config: {
                connectionString: 'invalid-connection',
                query: 'INVALID SQL',
                outputFormat: 'json'
              }
            }
          ],
          connections: [],
          createdBy: 'websocket-test-user'
        })
        .then(flowResponse => {
          const invalidFlowId = flowResponse.body.id;

          // Subscribe to flow updates
          clientSocket.emit('subscribe-flow', { flowId: invalidFlowId });

          // Create schedule
          return request(app.getHttpServer())
            .post('/scheduler/schedules')
            .send({
              name: 'Invalid WebSocket Schedule',
              flowId: invalidFlowId,
              cronExpression: '0 0 1 1 *',
              enabled: false,
              timezone: 'UTC'
            });
        })
        .then(scheduleResponse => {
          const invalidScheduleId = scheduleResponse.body.id;

          clientSocket.on('execution-update', (data) => {
            if (data.status === 'failed') {
              expect(data).toHaveProperty('executionId');
              expect(data.status).toBe('failed');
              expect(data).toHaveProperty('logs');
              expect(data.logs[0].level).toBe('error');
              done();
            }
          });

          // Execute invalid flow
          request(app.getHttpServer())
            .post(`/scheduler/schedules/${invalidScheduleId}/execute`)
            .expect(201);
        });
    }, 45000);
  });

  describe('Multi-client Broadcasting', () => {
    it('should broadcast execution updates to multiple subscribed clients', (done) => {
      const executionId = 'multi-client-test';
      let client1Received = false;
      let client2Received = false;

      // Subscribe both clients to the same execution
      clientSocket.emit('subscribe-execution', { executionId });
      clientSocket2.emit('subscribe-execution', { executionId });

      const checkCompletion = () => {
        if (client1Received && client2Received) {
          done();
        }
      };

      clientSocket.on('execution-update', (data) => {
        if (data.executionId === executionId) {
          client1Received = true;
          checkCompletion();
        }
      });

      clientSocket2.on('execution-update', (data) => {
        if (data.executionId === executionId) {
          client2Received = true;
          checkCompletion();
        }
      });

      // Simulate execution update by emitting through the app
      setTimeout(() => {
        // This would normally be triggered by the ExecutionOrchestrator
        const eventEmitter = app.get('EventEmitter2');
        eventEmitter.emit('execution.started', {
          executionId,
          flowId: 'test-flow',
          timestamp: new Date(),
        });
      }, 100);
    });

    it('should broadcast to flow subscribers when execution starts', (done) => {
      const flowId = 'broadcast-test-flow';
      const executionId = 'broadcast-test-execution';
      let client1Received = false;
      let client2Received = false;

      // Subscribe both clients to the same flow
      clientSocket.emit('subscribe-flow', { flowId });
      clientSocket2.emit('subscribe-flow', { flowId });

      const checkCompletion = () => {
        if (client1Received && client2Received) {
          done();
        }
      };

      clientSocket.on('execution-update', (data) => {
        if (data.executionId === executionId && data.flowId === flowId) {
          client1Received = true;
          checkCompletion();
        }
      });

      clientSocket2.on('execution-update', (data) => {
        if (data.executionId === executionId && data.flowId === flowId) {
          client2Received = true;
          checkCompletion();
        }
      });

      // Simulate execution update
      setTimeout(() => {
        const eventEmitter = app.get('EventEmitter2');
        eventEmitter.emit('execution.started', {
          executionId,
          flowId,
          timestamp: new Date(),
        });
      }, 100);
    });
  });

  describe('Data Flow Events', () => {
    it('should receive data flow events', (done) => {
      const dataFlowReceived = [];

      clientSocket.on('data-flow-update', (data) => {
        dataFlowReceived.push(data);
        
        if (data.type === 'data-passed') {
          expect(data).toHaveProperty('fromNode');
          expect(data).toHaveProperty('toNode');
          expect(data).toHaveProperty('outputPin');
          expect(data).toHaveProperty('inputPin');
          expect(data).toHaveProperty('dataSize');
          expect(data).toHaveProperty('timestamp');
        }
        
        if (dataFlowReceived.length >= 1) {
          done();
        }
      });

      // Simulate data flow event
      setTimeout(() => {
        const eventEmitter = app.get('EventEmitter2');
        eventEmitter.emit('data.flow.passed', {
          fromNodeId: 'node-1',
          toNodeId: 'node-2',
          outputPin: 'data',
          inputPin: 'input',
          dataSize: 1024,
          transformation: 'map',
        });
      }, 100);
    });

    it('should receive data flow error events', (done) => {
      clientSocket.on('data-flow-update', (data) => {
        if (data.type === 'data-flow-error') {
          expect(data).toHaveProperty('fromNode');
          expect(data).toHaveProperty('toNode');
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('timestamp');
          done();
        }
      });

      // Simulate data flow error
      setTimeout(() => {
        const eventEmitter = app.get('EventEmitter2');
        eventEmitter.emit('data.flow.error', {
          fromNodeId: 'node-1',
          toNodeId: 'node-2',
          outputPin: 'data',
          inputPin: 'input',
          error: 'Connection timeout',
        });
      }, 100);
    });
  });

  describe('Execution Control via WebSocket', () => {
    it('should get execution status via WebSocket', (done) => {
      const executionId = 'status-test-execution';

      clientSocket.emit('get-execution-status', { executionId }, (response) => {
        expect(response.success).toBe(true);
      });

      clientSocket.on('execution-status', (data) => {
        expect(data).toHaveProperty('executionId');
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnection gracefully', async () => {
      const tempSocket = ioClient(`http://localhost:${app.getHttpServer().address().port}/executions`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => {
        tempSocket.on('connect', resolve);
      });

      // Subscribe to something
      tempSocket.emit('subscribe-execution', { executionId: 'disconnect-test' });

      // Disconnect abruptly
      tempSocket.disconnect();

      // The server should handle this gracefully without crashing
      // We can't directly test the cleanup, but we verify the server is still responsive
      const response = await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
    });

    it('should maintain subscription state correctly', (done) => {
      const executionId = 'state-test-execution';
      let subscriptionConfirmed = false;

      clientSocket.emit('subscribe-execution', { executionId });

      clientSocket.on('subscription-confirmed', (data) => {
        if (data.id === executionId) {
          subscriptionConfirmed = true;
        }
      });

      // Send an update after subscription
      setTimeout(() => {
        if (subscriptionConfirmed) {
          const eventEmitter = app.get('EventEmitter2');
          eventEmitter.emit('execution.started', {
            executionId,
            flowId: 'test-flow',
            timestamp: new Date(),
          });
        }
      }, 200);

      clientSocket.on('execution-update', (data) => {
        if (data.executionId === executionId) {
          expect(subscriptionConfirmed).toBe(true);
          done();
        }
      });
    });
  });
});