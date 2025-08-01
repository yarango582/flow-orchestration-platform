import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { ExecutionStatus } from '../database/entities/execution.entity';

export interface ExecutionUpdateEvent {
  executionId: string;
  flowId: string;
  status: ExecutionStatus;
  progress?: {
    completedNodes: number;
    totalNodes: number;
    currentNodeId?: string;
    percentage: number;
  };
  nodeUpdate?: {
    nodeId: string;
    nodeType: string;
    status: 'started' | 'completed' | 'failed';
    duration?: number;
    recordsProcessed?: number;
    error?: string;
  };
  logs?: Array<{
    timestamp: Date;
    level: string;
    message: string;
    nodeId?: string;
    metadata?: any;
  }>;
  metrics?: {
    duration: number;
    recordsProcessed: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface ClientSubscription {
  executionIds: Set<string>;
  flowIds: Set<string>;
  userId?: string;
  rooms: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/executions',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private clientSubscriptions = new Map<string, ClientSubscription>();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    const clientId = client.id;
    
    this.logger.log(`Client connected: ${clientId}`, {
      address: client.handshake.address,
      userAgent: client.handshake.headers['user-agent'],
    });

    // Initialize client subscription
    this.clientSubscriptions.set(clientId, {
      executionIds: new Set(),
      flowIds: new Set(),
      rooms: new Set(),
    });

    // Send welcome message
    client.emit('connected', {
      clientId,
      timestamp: new Date(),
      message: 'Connected to Flow Platform real-time updates',
    });
  }

  handleDisconnect(client: Socket) {
    const clientId = client.id;
    
    this.logger.log(`Client disconnected: ${clientId}`);

    // Clean up subscriptions
    this.clientSubscriptions.delete(clientId);
  }

  @SubscribeMessage('subscribe-execution')
  handleSubscribeExecution(
    @MessageBody() data: { executionId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { executionId, userId } = data;
    const clientId = client.id;

    this.logger.debug(`Client ${clientId} subscribing to execution ${executionId}`);

    // Add to client subscriptions
    const subscription = this.clientSubscriptions.get(clientId);
    if (subscription) {
      subscription.executionIds.add(executionId);
      subscription.userId = userId;
    }

    // Join execution room
    const room = `execution:${executionId}`;
    client.join(room);

    if (subscription) {
      subscription.rooms.add(room);
    }

    client.emit('subscription-confirmed', {
      type: 'execution',
      id: executionId,
      timestamp: new Date(),
    });

    return { success: true, executionId };
  }

  @SubscribeMessage('unsubscribe-execution')
  handleUnsubscribeExecution(
    @MessageBody() data: { executionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { executionId } = data;
    const clientId = client.id;

    this.logger.debug(`Client ${clientId} unsubscribing from execution ${executionId}`);

    // Remove from client subscriptions
    const subscription = this.clientSubscriptions.get(clientId);
    if (subscription) {
      subscription.executionIds.delete(executionId);
    }

    // Leave execution room
    const room = `execution:${executionId}`;
    client.leave(room);

    if (subscription) {
      subscription.rooms.delete(room);
    }

    client.emit('subscription-removed', {
      type: 'execution',
      id: executionId,
      timestamp: new Date(),
    });

    return { success: true, executionId };
  }

  @SubscribeMessage('subscribe-flow')
  handleSubscribeFlow(
    @MessageBody() data: { flowId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { flowId, userId } = data;
    const clientId = client.id;

    this.logger.debug(`Client ${clientId} subscribing to flow ${flowId}`);

    // Add to client subscriptions
    const subscription = this.clientSubscriptions.get(clientId);
    if (subscription) {
      subscription.flowIds.add(flowId);
      subscription.userId = userId;
    }

    // Join flow room
    const room = `flow:${flowId}`;
    client.join(room);

    if (subscription) {
      subscription.rooms.add(room);
    }

    client.emit('subscription-confirmed', {
      type: 'flow',
      id: flowId,
      timestamp: new Date(),
    });

    return { success: true, flowId };
  }

  @SubscribeMessage('subscribe-user-executions')
  handleSubscribeUserExecutions(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId } = data;
    const clientId = client.id;

    this.logger.debug(`Client ${clientId} subscribing to user executions ${userId}`);

    // Update client subscription
    const subscription = this.clientSubscriptions.get(clientId);
    if (subscription) {
      subscription.userId = userId;
    }

    // Join user room
    const room = `user:${userId}`;
    client.join(room);

    if (subscription) {
      subscription.rooms.add(room);
    }

    client.emit('subscription-confirmed', {
      type: 'user-executions',
      id: userId,
      timestamp: new Date(),
    });

    return { success: true, userId };
  }

  @SubscribeMessage('get-execution-status')
  handleGetExecutionStatus(
    @MessageBody() data: { executionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // This would typically fetch current status from database
    // For now, emit a placeholder response
    client.emit('execution-status', {
      executionId: data.executionId,
      status: 'running',
      timestamp: new Date(),
    });

    return { success: true };
  }

  // Event listeners for execution events

  @OnEvent('execution.started')
  handleExecutionStarted(data: {
    executionId: string;
    flowId: string;
    userId?: string;
    timestamp: Date;
  }) {
    this.logger.debug(`Broadcasting execution started: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: data.flowId,
      status: ExecutionStatus.RUNNING,
    };

    // Broadcast to relevant rooms
    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
    this.server.to(`flow:${data.flowId}`).emit('execution-update', updateEvent);
    
    if (data.userId) {
      this.server.to(`user:${data.userId}`).emit('execution-update', updateEvent);
    }
  }

  @OnEvent('execution.completed')
  handleExecutionCompleted(data: {
    executionId: string;
    flowId: string;
    result: any;
    duration: number;
    userId?: string;
  }) {
    this.logger.debug(`Broadcasting execution completed: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: data.flowId,
      status: ExecutionStatus.SUCCESS,
      metrics: {
        duration: data.duration,
        recordsProcessed: data.result.recordsProcessed || 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
      },
    };

    // Broadcast to relevant rooms
    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
    this.server.to(`flow:${data.flowId}`).emit('execution-update', updateEvent);
    
    if (data.userId) {
      this.server.to(`user:${data.userId}`).emit('execution-update', updateEvent);
    }
  }

  @OnEvent('execution.failed')
  handleExecutionFailed(data: {
    executionId: string;
    flowId: string;
    error: string;
    duration: number;
    userId?: string;
  }) {
    this.logger.debug(`Broadcasting execution failed: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: data.flowId,
      status: ExecutionStatus.FAILED,
      logs: [{
        timestamp: new Date(),
        level: 'error',
        message: `Execution failed: ${data.error}`,
      }],
      metrics: {
        duration: data.duration,
        recordsProcessed: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
      },
    };

    // Broadcast to relevant rooms
    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
    this.server.to(`flow:${data.flowId}`).emit('execution-update', updateEvent);
    
    if (data.userId) {
      this.server.to(`user:${data.userId}`).emit('execution-update', updateEvent);
    }
  }

  @OnEvent('execution.cancelled')
  handleExecutionCancelled(data: {
    executionId: string;
    cancelledAt: Date;
  }) {
    this.logger.debug(`Broadcasting execution cancelled: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.CANCELLED,
      logs: [{
        timestamp: data.cancelledAt,
        level: 'info',
        message: 'Execution cancelled by user',
      }],
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  @OnEvent('execution.paused')
  handleExecutionPaused(data: {
    executionId: string;
    pausedAt: Date;
    currentNodeId?: string;
  }) {
    this.logger.debug(`Broadcasting execution paused: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.PAUSED,
      progress: data.currentNodeId ? {
        completedNodes: 0, // Would be calculated
        totalNodes: 0, // Would be calculated
        currentNodeId: data.currentNodeId,
        percentage: 0, // Would be calculated
      } : undefined,
      logs: [{
        timestamp: data.pausedAt,
        level: 'info',
        message: 'Execution paused',
        nodeId: data.currentNodeId,
      }],
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  @OnEvent('execution.resumed')
  handleExecutionResumed(data: {
    executionId: string;
    resumedAt: Date;
    currentNodeId?: string;
  }) {
    this.logger.debug(`Broadcasting execution resumed: ${data.executionId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      logs: [{
        timestamp: data.resumedAt,
        level: 'info',
        message: 'Execution resumed',
        nodeId: data.currentNodeId,
      }],
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  // Node-level events

  @OnEvent('execution.node.started')
  handleNodeStarted(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
  }) {
    this.logger.debug(`Broadcasting node started: ${data.nodeId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      nodeUpdate: {
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        status: 'started',
      },
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  @OnEvent('execution.node.completed')
  handleNodeCompleted(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
    success: boolean;
    error?: string;
    recordsProcessed?: number;
  }) {
    this.logger.debug(`Broadcasting node completed: ${data.nodeId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      nodeUpdate: {
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        status: data.success ? 'completed' : 'failed',
        recordsProcessed: data.recordsProcessed,
        error: data.error,
      },
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  @OnEvent('execution.node.failed')
  handleNodeFailed(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
    error: string;
  }) {
    this.logger.debug(`Broadcasting node failed: ${data.nodeId}`);

    const updateEvent: ExecutionUpdateEvent = {
      executionId: data.executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      nodeUpdate: {
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        status: 'failed',
        error: data.error,
      },
      logs: [{
        timestamp: new Date(),
        level: 'error',
        message: `Node ${data.nodeId} failed: ${data.error}`,
        nodeId: data.nodeId,
      }],
    };

    this.server.to(`execution:${data.executionId}`).emit('execution-update', updateEvent);
  }

  // Data flow events

  @OnEvent('data.flow.passed')
  handleDataFlowPassed(data: {
    fromNodeId: string;
    toNodeId: string;
    outputPin: string;
    inputPin: string;
    dataSize: number;
    transformation?: string;
  }) {
    // Broadcast data flow information for debugging/monitoring
    this.server.emit('data-flow-update', {
      type: 'data-passed',
      fromNode: data.fromNodeId,
      toNode: data.toNodeId,
      outputPin: data.outputPin,
      inputPin: data.inputPin,
      dataSize: data.dataSize,
      transformation: data.transformation,
      timestamp: new Date(),
    });
  }

  @OnEvent('data.flow.error')
  handleDataFlowError(data: {
    fromNodeId: string;
    toNodeId: string;
    outputPin: string;
    inputPin: string;
    error: string;
  }) {
    // Broadcast data flow errors
    this.server.emit('data-flow-update', {
      type: 'data-flow-error',
      fromNode: data.fromNodeId,
      toNode: data.toNodeId,
      outputPin: data.outputPin,
      inputPin: data.inputPin,
      error: data.error,
      timestamp: new Date(),
    });
  }

  // Public methods for broadcasting custom events

  broadcastExecutionProgress(
    executionId: string,
    progress: {
      completedNodes: number;
      totalNodes: number;
      currentNodeId?: string;
    }
  ): void {
    const updateEvent: ExecutionUpdateEvent = {
      executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      progress: {
        ...progress,
        percentage: Math.round((progress.completedNodes / progress.totalNodes) * 100),
      },
    };

    this.server.to(`execution:${executionId}`).emit('execution-update', updateEvent);
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
    const updateEvent: ExecutionUpdateEvent = {
      executionId,
      flowId: '', // Will be filled by client context
      status: ExecutionStatus.RUNNING,
      logs,
    };

    this.server.to(`execution:${executionId}`).emit('execution-update', updateEvent);
  }

  // Utility methods

  getConnectedClients(): number {
    return this.server.sockets.sockets.size;
  }

  getClientSubscriptions(clientId: string): ClientSubscription | undefined {
    return this.clientSubscriptions.get(clientId);
  }

  disconnectClient(clientId: string): void {
    const socket = this.server.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
    }
  }
}