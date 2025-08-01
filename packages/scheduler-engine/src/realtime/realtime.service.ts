import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  broadcastExecutionProgress(
    executionId: string,
    progress: {
      completedNodes: number;
      totalNodes: number;
      currentNodeId?: string;
    }
  ): void {
    this.logger.debug(`Broadcasting execution progress: ${executionId}`, progress);
    this.realtimeGateway.broadcastExecutionProgress(executionId, progress);
  }

  broadcastExecutionLogs(
    executionId: string,
    logs: Array<{
      timestamp: Date;
      level: string;
      message: string;
      nodeId?: string;
      metadata?: any;
    }>
  ): void {
    this.logger.debug(`Broadcasting execution logs: ${executionId}`, {
      logCount: logs.length,
    });
    this.realtimeGateway.broadcastExecutionLogs(executionId, logs);
  }

  getConnectionStats(): {
    connectedClients: number;
    activeSubscriptions: number;
  } {
    return {
      connectedClients: this.realtimeGateway.getConnectedClients(),
      activeSubscriptions: 0, // Would calculate from gateway
    };
  }

  disconnectClient(clientId: string): void {
    this.logger.log(`Disconnecting client: ${clientId}`);
    this.realtimeGateway.disconnectClient(clientId);
  }
}