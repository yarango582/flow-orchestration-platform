import { Controller, Get, Query, Param } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { FlowExecutionProcessor } from '../scheduler/flow-execution.processor';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly flowExecutionProcessor: FlowExecutionProcessor,
  ) {}

  @Get('system')
  getSystemMetrics() {
    return {
      current: this.metricsService.getSystemMetrics(),
      activeJobs: this.flowExecutionProcessor.getActiveJobsCount(),
      activeJobsList: this.flowExecutionProcessor.getActiveJobs(),
    };
  }

  @Get('system/history')
  getSystemMetricsHistory(@Query('hours') hours?: string) {
    const hoursNumber = hours ? parseInt(hours, 10) : 24;
    return this.metricsService.getSystemMetricsHistory(hoursNumber);
  }

  @Get('execution/:executionId')
  getExecutionMetrics(@Param('executionId') executionId: string) {
    const metrics = this.metricsService.getExecutionMetrics(executionId);
    if (!metrics) {
      return { error: 'Execution not found' };
    }
    return metrics;
  }

  @Get('flows')
  getAllFlowMetrics() {
    return this.metricsService.getAllFlowMetrics();
  }

  @Get('flows/:flowId')
  getFlowMetrics(@Param('flowId') flowId: string) {
    const metrics = this.metricsService.getFlowMetrics(flowId);
    if (!metrics) {
      return { error: 'Flow metrics not found' };
    }
    return metrics;
  }

  @Get('nodes')
  getAllNodeMetrics() {
    return this.metricsService.getAllNodeMetrics();
  }

  @Get('nodes/:nodeType')
  getNodeMetrics(@Param('nodeType') nodeType: string) {
    const metrics = this.metricsService.getNodeMetrics(nodeType);
    if (!metrics) {
      return { error: 'Node metrics not found' };
    }
    return metrics;
  }

  @Get('stats')
  getOverallStats() {
    return this.metricsService.getOverallStats();
  }

  @Get('performance/slow-executions')
  getSlowExecutions(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.metricsService.getSlowExecutions(limitNumber);
  }

  @Get('performance/high-memory-executions')
  getHighMemoryExecutions(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.metricsService.getHighMemoryExecutions(limitNumber);
  }

  @Get('jobs/:jobId')
  getJobMetrics(@Param('jobId') jobId: string) {
    const metrics = this.flowExecutionProcessor.getJobMetrics(jobId);
    if (!metrics) {
      return { error: 'Job not found or not active' };
    }
    return metrics;
  }

  @Get('health')
  getHealthCheck() {
    const systemMetrics = this.metricsService.getSystemMetrics();
    const stats = this.metricsService.getOverallStats();
    
    // Simple health scoring based on system metrics
    let healthScore = 100;
    
    // Deduct points for high memory usage (>80% of 1GB)
    const memoryUsageMB = systemMetrics.systemMemoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 800) {
      healthScore -= 20;
    } else if (memoryUsageMB > 600) {
      healthScore -= 10;
    }
    
    // Deduct points for low success rate
    if (stats.successRate < 90) {
      healthScore -= 15;
    } else if (stats.successRate < 95) {
      healthScore -= 5;
    }
    
    // Deduct points for too many active executions
    if (systemMetrics.activeExecutions > 50) {
      healthScore -= 10;
    } else if (systemMetrics.activeExecutions > 30) {
      healthScore -= 5;
    }

    let status = 'healthy';
    if (healthScore < 70) {
      status = 'unhealthy';
    } else if (healthScore < 85) {
      status = 'degraded';
    }

    return {
      status,
      healthScore,
      checks: {
        memoryUsage: {
          status: memoryUsageMB < 800 ? 'ok' : 'warning',
          value: `${Math.round(memoryUsageMB)}MB`,
        },
        successRate: {
          status: stats.successRate >= 95 ? 'ok' : stats.successRate >= 90 ? 'warning' : 'error',
          value: `${stats.successRate.toFixed(1)}%`,
        },
        activeExecutions: {
          status: systemMetrics.activeExecutions < 30 ? 'ok' : systemMetrics.activeExecutions < 50 ? 'warning' : 'error',
          value: systemMetrics.activeExecutions,
        },
        uptime: {
          status: 'ok',
          value: `${Math.round(systemMetrics.uptime / 1000 / 60)}min`,
        },
      },
      timestamp: new Date(),
    };
  }

  @Get('dashboard')
  getDashboardData() {
    const systemMetrics = this.metricsService.getSystemMetrics();
    const stats = this.metricsService.getOverallStats();
    const recentHistory = this.metricsService.getSystemMetricsHistory(1); // Last hour
    
    return {
      current: {
        activeExecutions: systemMetrics.activeExecutions,
        completedExecutions: systemMetrics.completedExecutions,
        failedExecutions: systemMetrics.failedExecutions,
        successRate: stats.successRate,
        averageExecutionTime: stats.averageExecutionTime,
        totalRecordsProcessed: stats.totalRecordsProcessed,
        memoryUsageMB: Math.round(systemMetrics.systemMemoryUsage.heapUsed / 1024 / 1024),
        uptime: systemMetrics.uptime,
      },
      trends: {
        executionHistory: recentHistory.map(h => ({
          timestamp: h.timestamp,
          completed: h.completedExecutions,
          failed: h.failedExecutions,
          active: h.activeExecutions,
        })),
        memoryHistory: recentHistory.map(h => ({
          timestamp: h.timestamp,
          memoryMB: Math.round(h.systemMemoryUsage.heapUsed / 1024 / 1024),
        })),
      },
      topNodes: {
        mostExecuted: stats.topExecutedNodeTypes,
        mostFailed: stats.topFailedNodeTypes,
      },
      flows: this.metricsService.getAllFlowMetrics().slice(0, 10),
    };
  }
}