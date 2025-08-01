import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';

export interface ExecutionMetrics {
  executionId: string;
  flowId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: string;
  nodeCount: number;
  completedNodes: number;
  failedNodes: number;
  recordsProcessed: number;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
  retryCount: number;
}

export interface SystemMetrics {
  timestamp: Date;
  activeExecutions: number;
  queuedJobs: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  systemMemoryUsage: NodeJS.MemoryUsage;
  systemCpuUsage: NodeJS.CpuUsage;
  uptime: number;
}

export interface NodeMetrics {
  nodeId: string;
  nodeType: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  totalRecordsProcessed: number;
  averageMemoryUsage: number;
  lastExecutionTime?: Date;
  errorRate: number;
}

export interface FlowMetrics {
  flowId: string;
  flowName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  totalRecordsProcessed: number;
  lastExecutionTime?: Date;
  successRate: number;
  averageNodeCount: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  
  // In-memory metrics storage (in production, use Redis or time-series DB)
  private executionMetrics = new Map<string, ExecutionMetrics>();
  private nodeMetrics = new Map<string, NodeMetrics>();
  private flowMetrics = new Map<string, FlowMetrics>();
  private systemMetricsHistory: SystemMetrics[] = [];
  
  // Aggregated counters
  private counters = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalRecordsProcessed: 0,
    totalExecutionTime: 0,
    nodeExecutions: new Map<string, number>(),
    nodeSuccesses: new Map<string, number>(),
    nodeFailures: new Map<string, number>(),
  };

  private startTime = Date.now();
  private cpuUsageStart = process.cpuUsage();

  // Event listeners for collecting metrics

  @OnEvent('execution.started')
  onExecutionStarted(data: {
    executionId: string;
    flowId: string;
    flowName?: string;
    nodeCount?: number;
    timestamp: Date;
  }) {
    this.logger.debug(`Recording execution start: ${data.executionId}`);

    const metrics: ExecutionMetrics = {
      executionId: data.executionId,
      flowId: data.flowId,
      startTime: data.timestamp,
      status: 'running',
      nodeCount: data.nodeCount || 0,
      completedNodes: 0,
      failedNodes: 0,
      recordsProcessed: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: 0,
      errorCount: 0,
      retryCount: 0,
    };

    this.executionMetrics.set(data.executionId, metrics);
    this.counters.totalExecutions++;
  }

  @OnEvent('execution.completed')
  onExecutionCompleted(data: {
    executionId: string;
    flowId: string;
    result: any;
    duration: number;
    metrics?: any;
  }) {
    this.logger.debug(`Recording execution completion: ${data.executionId}`);

    const metrics = this.executionMetrics.get(data.executionId);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.duration = data.duration;
      metrics.status = 'completed';
      metrics.recordsProcessed = data.result.recordsProcessed || 0;
      
      if (data.metrics) {
        metrics.memoryUsage = data.metrics.memoryUsed || 0;
        metrics.cpuUsage = data.metrics.cpuUsed || 0;
      }

      this.counters.successfulExecutions++;
      this.counters.totalRecordsProcessed += metrics.recordsProcessed;
      this.counters.totalExecutionTime += data.duration;

      // Update flow metrics
      this.updateFlowMetrics(data.flowId, metrics);
    }
  }

  @OnEvent('execution.failed')
  onExecutionFailed(data: {
    executionId: string;
    flowId: string;
    error: string;
    duration: number;
    metrics?: any;
  }) {
    this.logger.debug(`Recording execution failure: ${data.executionId}`);

    const metrics = this.executionMetrics.get(data.executionId);
    if (metrics) {
      metrics.endTime = new Date();
      metrics.duration = data.duration;
      metrics.status = 'failed';
      metrics.errorCount = 1;
      
      if (data.metrics) {
        metrics.memoryUsage = data.metrics.memoryUsed || 0;
        metrics.cpuUsage = data.metrics.cpuUsed || 0;
      }

      this.counters.failedExecutions++;
      this.counters.totalExecutionTime += data.duration;

      // Update flow metrics
      this.updateFlowMetrics(data.flowId, metrics);
    }
  }

  @OnEvent('execution.node.started')
  onNodeStarted(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
  }) {
    const currentCount = this.counters.nodeExecutions.get(data.nodeType) || 0;
    this.counters.nodeExecutions.set(data.nodeType, currentCount + 1);
  }

  @OnEvent('execution.node.completed')
  onNodeCompleted(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
    success: boolean;
    duration?: number;
    recordsProcessed?: number;
  }) {
    this.logger.debug(`Recording node completion: ${data.nodeId}`);

    // Update execution metrics
    const executionMetrics = this.executionMetrics.get(data.executionId);
    if (executionMetrics) {
      if (data.success) {
        executionMetrics.completedNodes++;
      } else {
        executionMetrics.failedNodes++;
        executionMetrics.errorCount++;
      }
      
      if (data.recordsProcessed) {
        executionMetrics.recordsProcessed += data.recordsProcessed;
      }
    }

    // Update node metrics
    this.updateNodeMetrics(data.nodeId, data.nodeType, data.success, data.duration, data.recordsProcessed);

    // Update counters
    if (data.success) {
      const currentCount = this.counters.nodeSuccesses.get(data.nodeType) || 0;
      this.counters.nodeSuccesses.set(data.nodeType, currentCount + 1);
    } else {
      const currentCount = this.counters.nodeFailures.get(data.nodeType) || 0;
      this.counters.nodeFailures.set(data.nodeType, currentCount + 1);
    }
  }

  @OnEvent('job.completed')
  onJobCompleted(data: {
    jobId: string;
    executionId: string;
    attempts: number;
  }) {
    const metrics = this.executionMetrics.get(data.executionId);
    if (metrics) {
      metrics.retryCount = data.attempts - 1; // First attempt is not a retry
    }
  }

  @OnEvent('job.failed')
  onJobFailed(data: {
    jobId: string;
    executionId: string;
    attempt: number;
    willRetry: boolean;
  }) {
    const metrics = this.executionMetrics.get(data.executionId);
    if (metrics && data.willRetry) {
      metrics.retryCount = data.attempt;
    }
  }

  // Scheduled metrics collection

  @Cron(CronExpression.EVERY_MINUTE)
  collectSystemMetrics() {
    const now = new Date();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.cpuUsageStart);

    const activeExecutions = Array.from(this.executionMetrics.values())
      .filter(m => m.status === 'running').length;

    const systemMetrics: SystemMetrics = {
      timestamp: now,
      activeExecutions,
      queuedJobs: 0, // Would be fetched from Bull queue
      completedExecutions: this.counters.successfulExecutions,
      failedExecutions: this.counters.failedExecutions,
      averageExecutionTime: this.counters.totalExecutions > 0 
        ? this.counters.totalExecutionTime / this.counters.totalExecutions 
        : 0,
      systemMemoryUsage: memoryUsage,
      systemCpuUsage: cpuUsage,
      uptime: Date.now() - this.startTime,
    };

    this.systemMetricsHistory.push(systemMetrics);

    // Keep only last 24 hours of system metrics (1440 minutes)
    if (this.systemMetricsHistory.length > 1440) {
      this.systemMetricsHistory = this.systemMetricsHistory.slice(-1440);
    }

    this.logger.debug('System metrics collected', {
      activeExecutions,
      memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      cpuUsage: cpuUsage.user + cpuUsage.system,
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  cleanupOldMetrics() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [executionId, metrics] of this.executionMetrics.entries()) {
      if (metrics.startTime < cutoffTime && metrics.status !== 'running') {
        this.executionMetrics.delete(executionId);
      }
    }

    this.logger.debug('Old metrics cleaned up', {
      remainingExecutions: this.executionMetrics.size,
    });
  }

  // Public API methods

  getExecutionMetrics(executionId: string): ExecutionMetrics | null {
    return this.executionMetrics.get(executionId) || null;
  }

  getSystemMetrics(): SystemMetrics {
    return this.systemMetricsHistory[this.systemMetricsHistory.length - 1] || {
      timestamp: new Date(),
      activeExecutions: 0,
      queuedJobs: 0,
      completedExecutions: this.counters.successfulExecutions,
      failedExecutions: this.counters.failedExecutions,
      averageExecutionTime: 0,
      systemMemoryUsage: process.memoryUsage(),
      systemCpuUsage: process.cpuUsage(),
      uptime: Date.now() - this.startTime,
    };
  }

  getSystemMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.systemMetricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  getFlowMetrics(flowId: string): FlowMetrics | null {
    return this.flowMetrics.get(flowId) || null;
  }

  getAllFlowMetrics(): FlowMetrics[] {
    return Array.from(this.flowMetrics.values());
  }

  getNodeMetrics(nodeType: string): NodeMetrics | null {
    return this.nodeMetrics.get(nodeType) || null;
  }

  getAllNodeMetrics(): NodeMetrics[] {
    return Array.from(this.nodeMetrics.values());
  }

  getOverallStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    totalRecordsProcessed: number;
    averageExecutionTime: number;
    topFailedNodeTypes: Array<{ nodeType: string; failureCount: number }>;
    topExecutedNodeTypes: Array<{ nodeType: string; executionCount: number }>;
  } {
    const successRate = this.counters.totalExecutions > 0 
      ? (this.counters.successfulExecutions / this.counters.totalExecutions) * 100 
      : 0;

    const averageExecutionTime = this.counters.totalExecutions > 0 
      ? this.counters.totalExecutionTime / this.counters.totalExecutions 
      : 0;

    // Top failed node types
    const topFailedNodeTypes = Array.from(this.counters.nodeFailures.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nodeType, failureCount]) => ({ nodeType, failureCount }));

    // Top executed node types
    const topExecutedNodeTypes = Array.from(this.counters.nodeExecutions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nodeType, executionCount]) => ({ nodeType, executionCount }));

    return {
      totalExecutions: this.counters.totalExecutions,
      successfulExecutions: this.counters.successfulExecutions,
      failedExecutions: this.counters.failedExecutions,
      successRate,
      totalRecordsProcessed: this.counters.totalRecordsProcessed,
      averageExecutionTime,
      topFailedNodeTypes,
      topExecutedNodeTypes,
    };
  }

  // Performance analysis methods

  getSlowExecutions(limit: number = 10): ExecutionMetrics[] {
    return Array.from(this.executionMetrics.values())
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit);
  }

  getHighMemoryExecutions(limit: number = 10): ExecutionMetrics[] {
    return Array.from(this.executionMetrics.values())
      .sort((a, b) => b.memoryUsage - a.memoryUsage)
      .slice(0, limit);
  }

  getExecutionsByTimeRange(startTime: Date, endTime: Date): ExecutionMetrics[] {
    return Array.from(this.executionMetrics.values())
      .filter(m => m.startTime >= startTime && m.startTime <= endTime);
  }

  // Private helper methods

  private updateFlowMetrics(flowId: string, executionMetrics: ExecutionMetrics): void {
    let flowMetrics = this.flowMetrics.get(flowId);
    
    if (!flowMetrics) {
      flowMetrics = {
        flowId,
        flowName: '', // Would be populated from flow service
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        totalRecordsProcessed: 0,
        successRate: 0,
        averageNodeCount: 0,
      };
      this.flowMetrics.set(flowId, flowMetrics);
    }

    flowMetrics.executionCount++;
    flowMetrics.lastExecutionTime = executionMetrics.endTime || new Date();
    flowMetrics.totalRecordsProcessed += executionMetrics.recordsProcessed;

    if (executionMetrics.status === 'completed') {
      flowMetrics.successCount++;
    } else if (executionMetrics.status === 'failed') {
      flowMetrics.failureCount++;
    }

    // Recalculate averages
    flowMetrics.successRate = (flowMetrics.successCount / flowMetrics.executionCount) * 100;
    
    if (executionMetrics.duration) {
      const totalTime = (flowMetrics.averageExecutionTime * (flowMetrics.executionCount - 1)) + executionMetrics.duration;
      flowMetrics.averageExecutionTime = totalTime / flowMetrics.executionCount;
    }

    const totalNodes = (flowMetrics.averageNodeCount * (flowMetrics.executionCount - 1)) + executionMetrics.nodeCount;
    flowMetrics.averageNodeCount = totalNodes / flowMetrics.executionCount;
  }

  private updateNodeMetrics(
    nodeId: string, 
    nodeType: string, 
    success: boolean, 
    duration?: number, 
    recordsProcessed?: number
  ): void {
    let nodeMetrics = this.nodeMetrics.get(nodeType);
    
    if (!nodeMetrics) {
      nodeMetrics = {
        nodeId,
        nodeType,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        totalRecordsProcessed: 0,
        averageMemoryUsage: 0,
        errorRate: 0,
      };
      this.nodeMetrics.set(nodeType, nodeMetrics);
    }

    nodeMetrics.executionCount++;
    nodeMetrics.lastExecutionTime = new Date();

    if (success) {
      nodeMetrics.successCount++;
    } else {
      nodeMetrics.failureCount++;
    }

    if (recordsProcessed) {
      nodeMetrics.totalRecordsProcessed += recordsProcessed;
    }

    // Recalculate averages
    nodeMetrics.errorRate = (nodeMetrics.failureCount / nodeMetrics.executionCount) * 100;

    if (duration) {
      const totalTime = (nodeMetrics.averageExecutionTime * (nodeMetrics.executionCount - 1)) + duration;
      nodeMetrics.averageExecutionTime = totalTime / nodeMetrics.executionCount;
    }
  }
}