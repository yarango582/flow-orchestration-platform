import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { ExecutionRepository } from '../scheduler/execution.repository';
import { CatalogService } from '../catalog/catalog.service';
import { FlowDto } from '../flows/dto';
import { ExecutionStatus, ExecutionLog, NodeExecution } from '../database/entities/execution.entity';
import { NodeExecutionManager } from './node-execution.manager';
import { DataFlowManager } from './data-flow.manager';
import { ExecutionContextManager } from './execution-context.manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Import from node-core library
import { 
  NodeResult,
} from '@flow-platform/node-core';

// Import ExecutionContext from local
import { ExecutionContext } from './node-execution.manager';

export interface ExecutionResult {
  success: boolean;
  duration: number;
  recordsProcessed: number;
  nodeResults: Map<string, NodeResult>;
  logs: ExecutionLog[];
  error?: string;
  status: ExecutionStatus;
}

export interface ExecutionState {
  id: string;
  status: ExecutionStatus;
  currentNodeId?: string;
  completedNodes: Set<string>;
  failedNodes: Set<string>;
  pausedAt?: Date;
  context: ExecutionContext;
  nodeResults: Map<string, NodeResult>;
  rollbackStack: RollbackOperation[];
}

export interface RollbackOperation {
  nodeId: string;
  operation: 'rollback' | 'compensate';
  data: any;
  timestamp: Date;
}

@Injectable()
export class ExecutionOrchestrator {
  private readonly logger = new Logger(ExecutionOrchestrator.name);
  private activeExecutions = new Map<string, ExecutionState>();

  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly catalogService: CatalogService,
    private readonly nodeExecutionManager: NodeExecutionManager,
    private readonly dataFlowManager: DataFlowManager,
    private readonly contextManager: ExecutionContextManager,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {}

  async executeFlow(
    executionId: string, 
    flow: FlowDto, 
    options: {
      resumeFromNode?: string;
      context?: Record<string, any>;
    } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    this.logger.log(`Starting flow execution: ${executionId}`, {
      flowId: flow.id,
      flowName: flow.name,
      nodeCount: flow.nodes.length,
      resumeFromNode: options.resumeFromNode,
    });

    try {
      // Create or restore execution state
      const executionState = await this.createExecutionState(
        executionId, 
        flow, 
        options
      );

      // Validate flow before execution
      await this.validateFlow(flow);

      // Build execution graph
      const executionGraph = this.buildExecutionGraph(flow);

      // Execute nodes in topological order
      const result = await this.executeNodesWithOrchestration(
        executionState,
        executionGraph,
        options.resumeFromNode
      );

      const duration = Date.now() - startTime;

      // Clean up execution state
      this.activeExecutions.delete(executionId);

      // Emit completion event
      this.eventEmitter.emit('execution.completed', {
        executionId,
        flowId: flow.id,
        result,
        duration,
      });

      this.logger.log(`Flow execution completed: ${executionId}`, {
        duration,
        success: result.success,
        recordsProcessed: result.recordsProcessed,
      });

      return {
        ...result,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Flow execution failed: ${executionId}`, {
        flowId: flow.id,
        duration,
        error: error.message,
        stack: error.stack,
      });

      // Clean up execution state
      this.activeExecutions.delete(executionId);

      // Emit failure event
      this.eventEmitter.emit('execution.failed', {
        executionId,
        flowId: flow.id,
        error: error.message,
        duration,
      });

      return {
        success: false,
        duration,
        recordsProcessed: 0,
        nodeResults: new Map(),
        logs: [{
          timestamp: new Date(),
          level: 'error',
          message: `Flow execution failed: ${error.message}`,
          metadata: { error: error.stack },
        }],
        error: error.message,
        status: ExecutionStatus.FAILED,
      };
    }
  }

  async cancelExecution(executionId: string): Promise<void> {
    const executionState = this.activeExecutions.get(executionId);
    if (!executionState) {
      throw new NotFoundException(`Execution ${executionId} not found or not active`);
    }

    this.logger.log(`Cancelling execution: ${executionId}`);

    try {
      // Update execution status
      executionState.status = ExecutionStatus.CANCELLED;
      
      // Cancel current node execution if any
      if (executionState.currentNodeId) {
        await this.nodeExecutionManager.cancelNodeExecution(
          executionState.currentNodeId,
          executionState.context
        );
      }

      // Perform rollback if needed
      await this.performRollback(executionState);

      // Update database
      await this.executionRepository.updateStatus(
        executionId,
        ExecutionStatus.CANCELLED,
        new Date(),
        'Execution cancelled by user'
      );

      // Clean up
      this.activeExecutions.delete(executionId);

      // Emit cancellation event
      this.eventEmitter.emit('execution.cancelled', {
        executionId,
        cancelledAt: new Date(),
      });

      this.logger.log(`Execution cancelled: ${executionId}`);

    } catch (error) {
      this.logger.error(`Failed to cancel execution: ${executionId}`, error);
      throw error;
    }
  }

  async pauseExecution(executionId: string): Promise<void> {
    const executionState = this.activeExecutions.get(executionId);
    if (!executionState) {
      throw new NotFoundException(`Execution ${executionId} not found or not active`);
    }

    if (executionState.status !== ExecutionStatus.RUNNING) {
      throw new BadRequestException(`Cannot pause execution in status: ${executionState.status}`);
    }

    this.logger.log(`Pausing execution: ${executionId}`);

    try {
      // Update execution status
      executionState.status = ExecutionStatus.PAUSED;
      executionState.pausedAt = new Date();

      // Pause current node execution if any
      if (executionState.currentNodeId) {
        await this.nodeExecutionManager.pauseNodeExecution(
          executionState.currentNodeId,
          executionState.context
        );
      }

      // Update database
      await this.executionRepository.updateStatus(
        executionId,
        ExecutionStatus.PAUSED,
        undefined,
        'Execution paused by user'
      );

      // Emit pause event
      this.eventEmitter.emit('execution.paused', {
        executionId,
        pausedAt: executionState.pausedAt,
        currentNodeId: executionState.currentNodeId,
      });

      this.logger.log(`Execution paused: ${executionId}`);

    } catch (error) {
      this.logger.error(`Failed to pause execution: ${executionId}`, error);
      throw error;
    }
  }

  async resumeExecution(executionId: string): Promise<void> {
    const executionState = this.activeExecutions.get(executionId);
    if (!executionState) {
      throw new NotFoundException(`Execution ${executionId} not found or not active`);
    }

    if (executionState.status !== ExecutionStatus.PAUSED) {
      throw new BadRequestException(`Cannot resume execution in status: ${executionState.status}`);
    }

    this.logger.log(`Resuming execution: ${executionId}`);

    try {
      // Update execution status
      executionState.status = ExecutionStatus.RUNNING;
      executionState.pausedAt = undefined;

      // Resume current node execution if any
      if (executionState.currentNodeId) {
        await this.nodeExecutionManager.resumeNodeExecution(
          executionState.currentNodeId,
          executionState.context
        );
      }

      // Update database
      await this.executionRepository.updateStatus(
        executionId,
        ExecutionStatus.RUNNING,
        undefined,
        'Execution resumed by user'
      );

      // Emit resume event
      this.eventEmitter.emit('execution.resumed', {
        executionId,
        resumedAt: new Date(),
        currentNodeId: executionState.currentNodeId,
      });

      this.logger.log(`Execution resumed: ${executionId}`);

    } catch (error) {
      this.logger.error(`Failed to resume execution: ${executionId}`, error);
      throw error;
    }
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionState | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  // Private methods

  private async createExecutionState(
    executionId: string,
    flow: FlowDto,
    options: { resumeFromNode?: string; context?: Record<string, any> }
  ): Promise<ExecutionState> {
    // Create execution context
    const context = await this.contextManager.createExecutionContext(
      executionId,
      flow,
      options.context || {}
    );

    const executionState: ExecutionState = {
      id: executionId,
      status: ExecutionStatus.RUNNING,
      completedNodes: new Set<string>(),
      failedNodes: new Set<string>(),
      context,
      nodeResults: new Map<string, NodeResult>(),
      rollbackStack: [],
    };

    // If resuming, load previous state
    if (options.resumeFromNode) {
      await this.loadPreviousExecutionState(executionState, options.resumeFromNode);
    }

    this.activeExecutions.set(executionId, executionState);
    return executionState;
  }

  private async loadPreviousExecutionState(
    executionState: ExecutionState,
    resumeFromNode: string
  ): Promise<void> {
    // Load completed nodes and results from database
    const execution = await this.executionRepository.findById(executionState.id);
    if (execution && execution.nodeExecutions) {
      for (const nodeExecution of execution.nodeExecutions) {
        if (nodeExecution.status === ExecutionStatus.SUCCESS) {
          executionState.completedNodes.add(nodeExecution.nodeId);
          // Reconstruct node results if possible
          // This would require storing node results in the database
        } else if (nodeExecution.status === ExecutionStatus.FAILED) {
          executionState.failedNodes.add(nodeExecution.nodeId);
        }
      }
    }
  }

  private async validateFlow(flow: FlowDto): Promise<void> {
    // Validate flow structure
    if (!flow.nodes || flow.nodes.length === 0) {
      throw new BadRequestException('Flow must contain at least one node');
    }

    // Validate node types exist in catalog
    for (const node of flow.nodes) {
      const nodeDefinition = await this.catalogService.getNodeDefinitionByType(node.type);
      if (!nodeDefinition) {
        throw new BadRequestException(`Node type '${node.type}' version '${node.version}' not found in catalog`);
      }
    }

    // Validate connections
    await this.dataFlowManager.validateFlowConnections(flow);
  }

  private buildExecutionGraph(flow: FlowDto): ExecutionGraph {
    const graph = new ExecutionGraph();

    // Add all nodes to the graph
    for (const node of flow.nodes) {
      graph.addNode(node.id, {
        type: node.type,
        version: node.version,
        config: node.config,
        position: node.position,
      });
    }

    // Add connections (edges)
    for (const connection of flow.connections) {
      graph.addEdge(
        connection.fromNodeId,
        connection.toNodeId,
        connection.fromOutput,
        connection.toInput,
      );
    }

    // Validate the graph
    this.validateExecutionGraph(graph);

    return graph;
  }

  private validateExecutionGraph(graph: ExecutionGraph): void {
    // Check for cycles
    if (graph.hasCycles()) {
      throw new BadRequestException('Flow contains circular dependencies');
    }

    // Check for orphaned nodes
    const orphanedNodes = graph.getOrphanedNodes();
    if (orphanedNodes.length > 0) {
      this.logger.warn('Flow contains orphaned nodes', {
        orphanedNodes,
      });
    }
  }

  private async executeNodesWithOrchestration(
    executionState: ExecutionState,
    graph: ExecutionGraph,
    resumeFromNode?: string
  ): Promise<ExecutionResult> {
    const logs: ExecutionLog[] = [];
    let totalRecordsProcessed = 0;

    // Get execution order (topological sort)
    const executionOrder = graph.getTopologicalOrder();
    
    // Find resume index if resuming
    let startIndex = 0;
    if (resumeFromNode) {
      startIndex = executionOrder.findIndex(nodeId => nodeId === resumeFromNode);
      if (startIndex === -1) {
        throw new BadRequestException(`Resume node '${resumeFromNode}' not found in execution order`);
      }
    }

    for (let i = startIndex; i < executionOrder.length; i++) {
      const nodeId = executionOrder[i];
      
      // Check if execution was cancelled or paused
      if (executionState.status === ExecutionStatus.CANCELLED) {
        break;
      }
      
      if (executionState.status === ExecutionStatus.PAUSED) {
        // Wait for resume
        await this.waitForResume(executionState.id);
      }

      // Skip if node already completed (in case of resume)
      if (executionState.completedNodes.has(nodeId)) {
        continue;
      }

      const nodeInfo = graph.getNode(nodeId);
      if (!nodeInfo) {
        throw new Error(`Node ${nodeId} not found in graph`);
      }

      executionState.currentNodeId = nodeId;

      try {
        // Emit node start event
        this.eventEmitter.emit('execution.node.started', {
          executionId: executionState.id,
          nodeId,
          nodeType: nodeInfo.type,
        });

        // Collect inputs from predecessor nodes
        const inputs = await this.dataFlowManager.collectNodeInputs(
          nodeId,
          graph,
          executionState.nodeResults
        );

        // Execute the node
        const result = await this.nodeExecutionManager.executeNode(
          nodeId,
          nodeInfo.type,
          nodeInfo.config,
          inputs,
          executionState.context,
        );

        executionState.nodeResults.set(nodeId, result);

        if (result.success) {
          executionState.completedNodes.add(nodeId);
          
          // Add rollback operation if node supports it
          if (result.rollbackData) {
            executionState.rollbackStack.push({
              nodeId,
              operation: 'rollback',
              data: result.rollbackData,
              timestamp: new Date(),
            });
          }
        } else {
          executionState.failedNodes.add(nodeId);
        }

        if (result.recordsProcessed) {
          totalRecordsProcessed += result.recordsProcessed;
        }

        // Add execution log
        logs.push({
          timestamp: new Date(),
          level: result.success ? 'info' : 'error',
          message: result.success 
            ? `Node ${nodeId} executed successfully`
            : `Node ${nodeId} failed: ${result.error}`,
          nodeId,
          metadata: {
            duration: result.duration,
            recordsProcessed: result.recordsProcessed,
          },
        });

        // Emit node completion event
        this.eventEmitter.emit('execution.node.completed', {
          executionId: executionState.id,
          nodeId,
          nodeType: nodeInfo.type,
          success: result.success,
          error: result.error,
          recordsProcessed: result.recordsProcessed,
        });

        // If node failed and is critical, stop execution
        if (!result.success && this.isNodeCritical(nodeInfo)) {
          throw new Error(`Critical node ${nodeId} failed: ${result.error}`);
        }

      } catch (error) {
        executionState.failedNodes.add(nodeId);
        
        logs.push({
          timestamp: new Date(),
          level: 'error',
          message: `Node ${nodeId} execution error: ${error.message}`,
          nodeId,
          metadata: { error: error.stack },
        });

        // Emit node failure event
        this.eventEmitter.emit('execution.node.failed', {
          executionId: executionState.id,
          nodeId,
          nodeType: nodeInfo.type,
          error: error.message,
        });

        throw error;
      } finally {
        executionState.currentNodeId = undefined;
      }
    }

    return {
      success: executionState.status !== ExecutionStatus.CANCELLED && 
               executionState.status !== ExecutionStatus.FAILED,
      duration: 0, // Will be set by caller
      recordsProcessed: totalRecordsProcessed,
      nodeResults: executionState.nodeResults,
      logs,
      status: executionState.status,
    };
  }

  private async waitForResume(executionId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkStatus = () => {
        const state = this.activeExecutions.get(executionId);
        if (state && state.status === ExecutionStatus.RUNNING) {
          resolve();
        } else {
          setTimeout(checkStatus, 1000); // Check every second
        }
      };
      checkStatus();
    });
  }

  private async performRollback(executionState: ExecutionState): Promise<void> {
    this.logger.log(`Performing rollback for execution: ${executionState.id}`);

    // Execute rollback operations in reverse order
    const rollbackOperations = [...executionState.rollbackStack].reverse();

    for (const operation of rollbackOperations) {
      try {
        await this.nodeExecutionManager.rollbackNodeExecution(
          operation.nodeId,
          operation.data,
          executionState.context
        );

        this.logger.log(`Rollback completed for node: ${operation.nodeId}`);
      } catch (error) {
        this.logger.error(`Rollback failed for node: ${operation.nodeId}`, error);
        // Continue with other rollback operations
      }
    }
  }

  private isNodeCritical(nodeInfo: any): boolean {
    // Determine if a node is critical (execution should stop if it fails)
    return nodeInfo.config?.critical !== false;
  }
}

// Execution Graph helper class (moved from execution.service.ts)
class ExecutionGraph {
  private nodes = new Map<string, any>();
  private edges = new Map<string, Array<{
    toNodeId: string;
    outputPin: string;
    inputPin: string;
  }>>();
  private incomingEdges = new Map<string, Array<{
    fromNodeId: string;
    outputPin: string;
    inputPin: string;
  }>>();

  addNode(nodeId: string, nodeInfo: any): void {
    this.nodes.set(nodeId, nodeInfo);
    if (!this.edges.has(nodeId)) {
      this.edges.set(nodeId, []);
    }
    if (!this.incomingEdges.has(nodeId)) {
      this.incomingEdges.set(nodeId, []);
    }
  }

  addEdge(fromNodeId: string, toNodeId: string, outputPin: string, inputPin: string): void {
    // Add outgoing edge
    const outgoing = this.edges.get(fromNodeId) || [];
    outgoing.push({ toNodeId, outputPin, inputPin });
    this.edges.set(fromNodeId, outgoing);

    // Add incoming edge
    const incoming = this.incomingEdges.get(toNodeId) || [];
    incoming.push({ fromNodeId, outputPin, inputPin });
    this.incomingEdges.set(toNodeId, incoming);
  }

  getNode(nodeId: string): any {
    return this.nodes.get(nodeId);
  }

  getIncomingEdges(nodeId: string): Array<{
    fromNodeId: string;
    outputPin: string;
    inputPin: string;
  }> {
    return this.incomingEdges.get(nodeId) || [];
  }

  hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const edges = this.edges.get(nodeId) || [];
      for (const edge of edges) {
        if (!visited.has(edge.toNodeId)) {
          if (hasCycleDFS(edge.toNodeId)) {
            return true;
          }
        } else if (recursionStack.has(edge.toNodeId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  getOrphanedNodes(): string[] {
    const orphaned: string[] = [];
    
    for (const nodeId of this.nodes.keys()) {
      const hasIncoming = (this.incomingEdges.get(nodeId) || []).length > 0;
      const hasOutgoing = (this.edges.get(nodeId) || []).length > 0;
      
      if (!hasIncoming && !hasOutgoing) {
        orphaned.push(nodeId);
      }
    }

    return orphaned;
  }

  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const topologicalSortDFS = (nodeId: string): void => {
      visited.add(nodeId);

      const edges = this.edges.get(nodeId) || [];
      for (const edge of edges) {
        if (!visited.has(edge.toNodeId)) {
          topologicalSortDFS(edge.toNodeId);
        }
      }

      stack.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        topologicalSortDFS(nodeId);
      }
    }

    return stack.reverse();
  }
}