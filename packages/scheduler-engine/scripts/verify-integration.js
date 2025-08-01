#!/usr/bin/env node

/**
 * Script para verificar la integración completa del Flow Platform
 * Este script valida que todos los componentes estén funcionando correctamente
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3001';
const WEBSOCKET_URL = 'http://localhost:3001/executions';

class IntegrationVerifier {
  constructor() {
    this.testResults = [];
    this.errors = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runTest(name, testFn) {
    this.log(`Running test: ${name}`);
    try {
      await testFn();
      this.log(`Test passed: ${name}`, 'success');
      this.testResults.push({ name, status: 'passed' });
    } catch (error) {
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
      this.testResults.push({ name, status: 'failed', error: error.message });
      this.errors.push(error);
    }
  }

  async checkHealth() {
    const response = await axios.get(`${BASE_URL}/monitoring/health`);
    if (response.data.status !== 'healthy' && response.data.status !== 'degraded') {
      throw new Error(`Health check failed: ${response.data.status}`);
    }
  }

  async checkCatalog() {
    const response = await axios.get(`${BASE_URL}/catalog/nodes`);
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('No nodes found in catalog');
    }
  }

  async testFlowCreation() {
    const testFlow = {
      id: 'integration-test-flow',
      name: 'Integration Test Flow',
      description: 'Flow for integration testing',
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
      createdBy: 'integration-test'
    };

    const response = await axios.post(`${BASE_URL}/flows`, testFlow);
    if (!response.data.id) {
      throw new Error('Flow creation failed - no ID returned');
    }
    
    // Clean up
    try {
      await axios.delete(`${BASE_URL}/flows/${response.data.id}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  async testScheduleCreation() {
    // First create a flow
    const testFlow = {
      id: 'schedule-test-flow',
      name: 'Schedule Test Flow',
      description: 'Flow for schedule testing',
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
      createdBy: 'integration-test'
    };

    const flowResponse = await axios.post(`${BASE_URL}/flows`, testFlow);
    const flowId = flowResponse.data.id;

    // Create schedule
    const testSchedule = {
      name: 'Integration Test Schedule',
      flowId,
      cronExpression: '0 0 1 1 *', // Once a year
      enabled: false,
      timezone: 'UTC'
    };

    const scheduleResponse = await axios.post(`${BASE_URL}/scheduler/schedules`, testSchedule);
    if (!scheduleResponse.data.id) {
      throw new Error('Schedule creation failed - no ID returned');
    }

    // Clean up
    try {
      await axios.delete(`${BASE_URL}/scheduler/schedules/${scheduleResponse.data.id}`);
      await axios.delete(`${BASE_URL}/flows/${flowId}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  async testFlowExecution() {
    // Create a simple flow
    const testFlow = {
      id: 'execution-test-flow',
      name: 'Execution Test Flow',
      description: 'Flow for execution testing',
      nodes: [
        {
          id: 'test-node-1',
          type: 'postgres-query',
          version: '1.0.0',
          position: { x: 100, y: 100 },
          config: {
            connectionString: 'postgresql://flow_user:password@postgres:5432/flow_platform',
            query: 'SELECT COUNT(*) as table_count FROM information_schema.tables',
            outputFormat: 'json'
          }
        }
      ],
      connections: [],
      createdBy: 'integration-test'
    };

    const flowResponse = await axios.post(`${BASE_URL}/flows`, testFlow);
    const flowId = flowResponse.data.id;

    // Create schedule
    const testSchedule = {
      name: 'Execution Test Schedule',
      flowId,
      cronExpression: '0 0 1 1 *',
      enabled: false,
      timezone: 'UTC'
    };

    const scheduleResponse = await axios.post(`${BASE_URL}/scheduler/schedules`, testSchedule);
    const scheduleId = scheduleResponse.data.id;

    // Execute the flow
    const executionResponse = await axios.post(`${BASE_URL}/scheduler/schedules/${scheduleId}/execute`);
    const executionId = executionResponse.data.executionId;

    // Wait for execution to complete (with timeout)
    let execution;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await axios.get(`${BASE_URL}/scheduler/executions/${executionId}`);
      execution = statusResponse.data;
      attempts++;
    } while (execution.status === 'running' && attempts < maxAttempts);

    if (execution.status !== 'completed') {
      throw new Error(`Execution failed with status: ${execution.status}`);
    }

    // Clean up
    try {
      await axios.delete(`${BASE_URL}/scheduler/schedules/${scheduleId}`);
      await axios.delete(`${BASE_URL}/flows/${flowId}`);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const socket = io(WEBSOCKET_URL, {
        transports: ['websocket'],
        timeout: 5000,
      });

      let connected = false;

      socket.on('connect', () => {
        connected = true;
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });

      socket.on('disconnect', () => {
        if (!connected) {
          reject(new Error('WebSocket disconnected before connecting'));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!connected) {
          socket.disconnect();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  async testMonitoring() {
    // Test system metrics
    const systemResponse = await axios.get(`${BASE_URL}/monitoring/system`);
    if (!systemResponse.data.current) {
      throw new Error('System metrics not available');
    }

    // Test dashboard
    const dashboardResponse = await axios.get(`${BASE_URL}/monitoring/dashboard`);
    if (!dashboardResponse.data.current) {
      throw new Error('Dashboard data not available');
    }

    // Test stats
    const statsResponse = await axios.get(`${BASE_URL}/monitoring/stats`);
    if (typeof statsResponse.data.totalExecutions !== 'number') {
      throw new Error('Stats data not available');
    }
  }

  async testNodeCoreIntegration() {
    // Check if node-core nodes are registered in catalog
    const catalogResponse = await axios.get(`${BASE_URL}/catalog/nodes`);
    const nodes = catalogResponse.data;

    const requiredNodeTypes = ['postgres-query', 'mongodb-operations', 'data-filter', 'field-mapper'];
    const availableNodeTypes = nodes.map(node => node.type);

    for (const requiredType of requiredNodeTypes) {
      if (!availableNodeTypes.includes(requiredType)) {
        throw new Error(`Required node type '${requiredType}' not found in catalog`);
      }
    }
  }

  async runAllTests() {
    this.log('Starting Flow Platform Integration Verification');
    this.log('================================================');

    // Wait for services to be ready
    this.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Run tests
    await this.runTest('Health Check', () => this.checkHealth());
    await this.runTest('Catalog Service', () => this.checkCatalog());
    await this.runTest('Node-Core Integration', () => this.testNodeCoreIntegration());
    await this.runTest('Flow Creation', () => this.testFlowCreation());
    await this.runTest('Schedule Creation', () => this.testScheduleCreation());
    await this.runTest('Flow Execution', () => this.testFlowExecution());
    await this.runTest('WebSocket Connection', () => this.testWebSocketConnection());
    await this.runTest('Monitoring System', () => this.testMonitoring());

    // Print results
    this.log('');
    this.log('Test Results:');
    this.log('=============');
    
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const totalTests = this.testResults.length;

    this.testResults.forEach(result => {
      const status = result.status === 'passed' ? '✅ PASSED' : '❌ FAILED';
      this.log(`${result.name}: ${status}`);
      if (result.error) {
        this.log(`  Error: ${result.error}`);
      }
    });

    this.log('');
    this.log(`Summary: ${passedTests}/${totalTests} tests passed`);

    if (this.errors.length === 0) {
      this.log('🎉 All integration tests passed! The Flow Platform is ready to use.', 'success');
      process.exit(0);
    } else {
      this.log(`❌ ${this.errors.length} test(s) failed. Please check the errors above.`, 'error');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const verifier = new IntegrationVerifier();
  
  try {
    await verifier.runAllTests();
  } catch (error) {
    console.error('❌ Integration verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = IntegrationVerifier;