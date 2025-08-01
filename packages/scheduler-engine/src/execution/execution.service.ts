import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ExecutionRepository } from '../scheduler/execution.repository';
import { CatalogService } from '../catalog/catalog.service';
import { FlowDto } from '../flows/dto';
import { ExecutionStatus, ExecutionLog, NodeExecution } from '../database/entities/execution.entity';

// Import from node-core library
import { 
  NodeRegistry, 
  INode, 
  NodeResult,
} from '@flow-platform/node-core';

// Import ExecutionContext from local
import { ExecutionContext } from './node-execution.manager';

export interface FlowExecutionResult {
  success: boolean;
  duration: number;
  recordsProcessed: number;
  nodeResults: Map<string, NodeResult>;
  logs: ExecutionLog[];
  error?: string;
}

@Injectable()
export class ExecutionService {
  private nodeRegistry: NodeRegistry;

  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly catalogService: CatalogService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.nodeRegistry = new NodeRegistry();
  }

  async executeFlow(executionId: string, flow: FlowDto): Promise<FlowExecutionResult> {
    const startTime = Date.now();
    
    this.logger.info('Starting flow execution', {
      executionId,
      flowId: flow.id,
      // flowName: flow.name,
      nodeCount: flow.nodes.length,
    });

    try {
      // Create execution context
      const executionContext = this.createExecutionContext(executionId, flow);

      // Build execution graph
      const executionGraph = await this.buildExecutionGraph(flow);

      // Execute nodes in topological order
      const result = await this.executeNodes(executionContext, executionGraph);

      const duration = Date.now() - startTime;

      this.logger.info('Flow execution completed', {
        executionId,
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
      
      this.logger.error('Flow execution failed', {
        executionId,
        flowId: flow.id,
        duration,
        error: error.message,
        stack: error.stack,
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
      };
    }
  }

  async executeNode(
    nodeId: string,
    nodeType: string,
    config: any,
    inputs: Map<string, any>,
    context: ExecutionContext,
  ): Promise<NodeResult> {
    this.logger.debug('Executing node', {
      nodeId,
      nodeType,
      executionId: context.executionId,
    });

    const startTime = Date.now();

    try {
      // Create node instance from registry
      const nodeInstance: INode = this.nodeRegistry.create(nodeType, config);

      // Configure the node if it supports configuration
      if ((nodeInstance as any).configure) {
        await (nodeInstance as any).configure(config);
      }

      // Prepare inputs
      const inputData: Record<string, any> = {};
      inputs.forEach((value, key) => {
        inputData[key] = value;
      });

      // Execute the node
      const result = await nodeInstance.execute(inputData, context);

      const duration = Date.now() - startTime;

      this.logger.debug('Node execution completed', {
        nodeId,
        nodeType,
        duration,
        success: result.success,
      });

      // Log execution details
      await this.logNodeExecution(context.executionId, {
        nodeId,
        nodeType,
        status: result.success ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        recordsProcessed: result.recordsProcessed || 0,
        errorMessage: result.error,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Node execution failed', {
        nodeId,
        nodeType,
        duration,
        error: error.message,
      });

      // Log failed execution
      await this.logNodeExecution(context.executionId, {
        nodeId,
        nodeType,
        status: ExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        errorMessage: error.message,
      });

      return {
        success: false,
        data: {},
        error: error.message,
        recordsProcessed: 0,
      };
    }
  }

  // Private methods

  private createExecutionContext(executionId: string, flow: FlowDto): ExecutionContext {
    return {
      executionId,
      flowId: flow.id,
      // flowName: flow.name,
      userId: flow.createdBy,
      timestamp: new Date(),
      logger: this.logger,
      metadata: flow.metadata || {},
    };
  }

  private async buildExecutionGraph(flow: FlowDto): Promise<ExecutionGraph> {
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

  private async executeNodes(
    context: ExecutionContext,
    graph: ExecutionGraph,
  ): Promise<FlowExecutionResult> {
    const nodeResults = new Map<string, NodeResult>();
    const logs: ExecutionLog[] = [];
    let totalRecordsProcessed = 0;

    // Get execution order (topological sort)
    const executionOrder = graph.getTopologicalOrder();

    for (const nodeId of executionOrder) {
      const nodeInfo = graph.getNode(nodeId);
      if (!nodeInfo) {
        throw new Error(`Node ${nodeId} not found in graph`);
      }

      try {
        // Collect inputs from predecessor nodes
        const inputs = this.collectNodeInputs(nodeId, graph, nodeResults);

        // Execute the node
        const result = await this.executeNode(
          nodeId,
          nodeInfo.type,
          nodeInfo.config,
          inputs,
          context,
        );

        nodeResults.set(nodeId, result);

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

        // If node failed and is critical, stop execution
        if (!result.success && this.isNodeCritical(nodeInfo)) {
          throw new Error(`Critical node ${nodeId} failed: ${result.error}`);
        }

      } catch (error) {
        logs.push({
          timestamp: new Date(),
          level: 'error',
          message: `Node ${nodeId} execution error: ${error.message}`,
          nodeId,
          metadata: { error: error.stack },
        });

        throw error;
      }
    }

    return {
      success: true,
      duration: 0, // Will be set by caller
      recordsProcessed: totalRecordsProcessed,
      nodeResults,
      logs,
    };
  }

  private collectNodeInputs(
    nodeId: string,
    graph: ExecutionGraph,
    nodeResults: Map<string, NodeResult>,
  ): Map<string, any> {
    const inputs = new Map<string, any>();
    const incomingEdges = graph.getIncomingEdges(nodeId);

    for (const edge of incomingEdges) {
      const sourceResult = nodeResults.get(edge.fromNodeId);
      if (sourceResult && sourceResult.success) {
        const outputValue = sourceResult.data[edge.outputPin];
        inputs.set(edge.inputPin, outputValue);
      }
    }

    return inputs;
  }

  private isNodeCritical(nodeInfo: any): boolean {
    // Determine if a node is critical (execution should stop if it fails)
    // This could be determined by node metadata or configuration
    return nodeInfo.config?.critical !== false;
  }

  private async logNodeExecution(
    executionId: string,
    nodeExecution: NodeExecution,
  ): Promise<void> {
    try {
      const execution = await this.executionRepository.findById(executionId);
      if (execution) {
        const nodeExecutions = execution.nodeExecutions || [];
        nodeExecutions.push(nodeExecution);
        
        await this.executionRepository.update(executionId, {
          nodeExecutions,
        });
      }
    } catch (error) {
      this.logger.error('Failed to log node execution', {
        executionId,
        nodeId: nodeExecution.nodeId,
        error: error.message,
      });
    }
  }
}

// Execution Graph helper class
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