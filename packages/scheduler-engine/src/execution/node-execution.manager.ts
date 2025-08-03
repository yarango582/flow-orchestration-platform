import {
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { CatalogService } from '../catalog/catalog.service';
import { ExecutionRepository } from '../scheduler/execution.repository';
import { ExecutionStatus, NodeExecution } from '../database/entities/execution.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Import from node-core library
import {
  NodeRegistry,
  INode,
  NodeResult,
} from '@flow-platform/node-core';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExecutionContext {
  executionId: string;
  flowId: string;
  userId?: string;
  timestamp: Date;
  logger: any;
  metadata: Record<string, any>;
}

export interface NodeExecutionOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  validateInputs?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

@Injectable()
export class NodeExecutionManager {
  private readonly logger = new Logger(NodeExecutionManager.name);
  private nodeRegistry: NodeRegistry;
  private activeNodeExecutions = new Map<string, {
    executionId: string;
    nodeId: string;
    controller: AbortController;
    startTime: number;
  }>();

  // Circuit breaker state per node type
  private circuitBreakerState = new Map<string, {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  constructor(
    private readonly catalogService: CatalogService,
    private readonly executionRepository: ExecutionRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {
    // Use the same NodeRegistry instance from CatalogService
    this.nodeRegistry = this.catalogService.getNodeRegistry();
  }

  async executeNode(
    nodeId: string,
    nodeType: string,
    config: any,
    inputs: Map<string, any>,
    context: ExecutionContext,
    options: NodeExecutionOptions = {}
  ): Promise<NodeResult> {
    const startTime = Date.now();
    const executionKey = `${context.executionId}:${nodeId}`;

    this.logger.debug(`Starting node execution: ${nodeId}`, {
      nodeType,
      executionId: context.executionId,
      inputKeys: Array.from(inputs.keys()),
    });

    // Create abort controller for cancellation support
    const controller = new AbortController();
    this.activeNodeExecutions.set(executionKey, {
      executionId: context.executionId,
      nodeId,
      controller,
      startTime,
    });

    try {
      // Check circuit breaker
      await this.checkCircuitBreaker(nodeType);

      // Validate inputs if required
      if (options.validateInputs !== false) {
        await this.validateNodeInputs(nodeType, inputs, config);
      }

      // Create node instance from registry
      const nodeInstance: INode = this.nodeRegistry.create(nodeType, config);

      // Prepare inputs
      const inputData: Record<string, any> = {};
      inputs.forEach((value, key) => {
        inputData[key] = value;
      });

      // For nodes with no input connections (source nodes), 
      // merge config values into inputData
      if (inputs.size === 0 && config) {
        Object.assign(inputData, config);
        this.logger.debug(`Merged config into inputData for source node ${nodeType}`, {
          nodeId,
          configKeys: Object.keys(config),
          inputData
        });
      }

      // Execute with retry logic
      const result = await this.executeWithRetry(
        nodeInstance,
        inputData,
        context,
        controller.signal,
        options
      );

      const duration = Date.now() - startTime;

      // Update circuit breaker on success
      this.updateCircuitBreakerSuccess(nodeType);

      // Log successful execution
      await this.logNodeExecution(context.executionId, {
        nodeId,
        nodeType,
        status: ExecutionStatus.SUCCESS,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        recordsProcessed: result.recordsProcessed || 0,
      } as NodeExecution);

      // Emit success event
      this.eventEmitter.emit('node.execution.success', {
        executionId: context.executionId,
        nodeId,
        nodeType,
        duration,
        recordsProcessed: result.recordsProcessed,
      });

      this.logger.debug(`Node execution completed: ${nodeId}`, {
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

      // Update circuit breaker on failure
      this.updateCircuitBreakerFailure(nodeType);

      // Log failed execution
      await this.logNodeExecution(context.executionId, {
        nodeId,
        nodeType,
        status: ExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        errorMessage: error.message,
      } as NodeExecution);

      // Emit failure event
      this.eventEmitter.emit('node.execution.failure', {
        executionId: context.executionId,
        nodeId,
        nodeType,
        duration,
        error: error.message,
      });

      this.logger.error(`Node execution failed: ${nodeId}`, {
        nodeType,
        duration,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        data: {},
        error: error.message,
        recordsProcessed: 0,
        duration,
      };

    } finally {
      this.activeNodeExecutions.delete(executionKey);
    }
  }

  async validateNodeInput(
    nodeType: string,
    input: any,
    config: any
  ): Promise<ValidationResult> {
    try {
      // Get node definition from catalog
      const nodeDefinition = await this.catalogService.getNodeDefinitionByType(nodeType);
      if (!nodeDefinition) {
        return {
          valid: false,
          errors: [`Node type '${nodeType}' not found in catalog`],
          warnings: [],
        };
      }

      // Get node class from registry
      const nodeInstance: INode = this.nodeRegistry.create(nodeType, {});

      // Create temporary node instance for validation
      // const nodeInstance: INode = new NodeClass();

      // Configure the node
      if ((nodeInstance as any).configure) {
        await (nodeInstance as any).configure(config);
      }

      // Validate using node's validation method if available
      if ((nodeInstance as any).validateInputs) {
        return await (nodeInstance as any).validateInputs(input);
      }

      // Basic validation against node definition
      return this.performBasicValidation(input, nodeDefinition);

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
      };
    }
  }

  async retryNodeExecution(
    nodeId: string,
    nodeType: string,
    config: any,
    inputs: Map<string, any>,
    context: ExecutionContext,
    attempt: number,
    options: NodeExecutionOptions = {}
  ): Promise<NodeResult> {
    const retryPolicy: RetryPolicy = {
      maxAttempts: options.retryCount || 3,
      backoffStrategy: 'exponential',
      baseDelay: options.retryDelay || 1000,
      maxDelay: 30000,
      jitter: true,
    };

    if (attempt > retryPolicy.maxAttempts) {
      throw new Error(`Maximum retry attempts (${retryPolicy.maxAttempts}) exceeded for node ${nodeId}`);
    }

    if (attempt > 1) {
      const delay = this.calculateRetryDelay(attempt, retryPolicy);
      this.logger.debug(`Retrying node execution in ${delay}ms`, {
        nodeId,
        attempt,
        maxAttempts: retryPolicy.maxAttempts,
      });

      await this.sleep(delay);
    }

    try {
      return await this.executeNode(nodeId, nodeType, config, inputs, context, options);
    } catch (error) {
      if (attempt < retryPolicy.maxAttempts) {
        this.logger.warn(`Node execution failed, retrying...`, {
          nodeId,
          attempt,
          error: error.message,
        });
        return this.retryNodeExecution(
          nodeId,
          nodeType,
          config,
          inputs,
          context,
          attempt + 1,
          options
        );
      }
      throw error;
    }
  }

  async cancelNodeExecution(
    nodeId: string,
    context: ExecutionContext
  ): Promise<void> {
    const executionKey = `${context.executionId}:${nodeId}`;
    const activeExecution = this.activeNodeExecutions.get(executionKey);

    if (activeExecution) {
      this.logger.debug(`Cancelling node execution: ${nodeId}`);
      activeExecution.controller.abort();
      
      // Emit cancellation event
      this.eventEmitter.emit('node.execution.cancelled', {
        executionId: context.executionId,
        nodeId,
        cancelledAt: new Date(),
      });
    }
  }

  async pauseNodeExecution(
    nodeId: string,
    context: ExecutionContext
  ): Promise<void> {
    // Implementation would depend on node capabilities
    // For now, just emit pause event
    this.eventEmitter.emit('node.execution.paused', {
      executionId: context.executionId,
      nodeId,
      pausedAt: new Date(),
    });
  }

  async resumeNodeExecution(
    nodeId: string,
    context: ExecutionContext
  ): Promise<void> {
    // Implementation would depend on node capabilities
    // For now, just emit resume event
    this.eventEmitter.emit('node.execution.resumed', {
      executionId: context.executionId,
      nodeId,
      resumedAt: new Date(),
    });
  }

  async rollbackNodeExecution(
    nodeId: string,
    rollbackData: any,
    context: ExecutionContext
  ): Promise<void> {
    this.logger.debug(`Rolling back node execution: ${nodeId}`);

    try {
      // Get node class and attempt rollback
      const nodeType = rollbackData.nodeType;
      const nodeInstance: INode = this.nodeRegistry.create(nodeType, {});
      
      if (nodeInstance && (nodeInstance as any).rollback) {
        await (nodeInstance as any).rollback(rollbackData, context);
      }

      this.eventEmitter.emit('node.execution.rolledback', {
        executionId: context.executionId,
        nodeId,
        rolledbackAt: new Date(),
      });

    } catch (error) {
      this.logger.error(`Rollback failed for node: ${nodeId}`, error);
      throw error;
    }
  }

  // Private methods

  private async executeWithRetry(
    nodeInstance: INode,
    inputData: Record<string, any>,
    context: ExecutionContext,
    signal: AbortSignal,
    options: NodeExecutionOptions
  ): Promise<NodeResult> {
    const timeout = options.timeout || 300000; // 5 minutes default

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Node execution timeout after ${timeout}ms`));
      }, timeout);

      // Clear timeout if signal is aborted
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Node execution cancelled'));
      });
    });

    // Execute node with timeout and cancellation support
    const executionPromise = nodeInstance.execute(inputData, {
      ...context,
      signal, // Pass abort signal to node
    });

    return Promise.race([executionPromise, timeoutPromise]);
  }

  private async validateNodeInputs(
    nodeType: string,
    inputs: Map<string, any>,
    config: any
  ): Promise<void> {
    const inputData: Record<string, any> = {};
    inputs.forEach((value, key) => {
      inputData[key] = value;
    });

    // For nodes with no input connections (source nodes), 
    // merge config values into inputData for validation
    if (inputs.size === 0 && config) {
      Object.assign(inputData, config);
      this.logger.debug(`Merged config into inputData for validation of source node ${nodeType}`, {
        configKeys: Object.keys(config),
        inputData
      });
    }

    const validation = await this.validateNodeInput(nodeType, inputData, config);
    
    if (!validation.valid) {
      throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      this.logger.warn(`Input validation warnings for ${nodeType}:`, validation.warnings);
    }
  }

  private performBasicValidation(
    input: any,
    nodeDefinition: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required inputs
    if (nodeDefinition.inputs) {
      for (const inputDef of nodeDefinition.inputs) {
        if (inputDef.required && !(inputDef.name in input)) {
          errors.push(`Required input '${inputDef.name}' is missing`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async checkCircuitBreaker(nodeType: string): Promise<void> {
    const state = this.circuitBreakerState.get(nodeType);
    if (!state) {
      this.circuitBreakerState.set(nodeType, {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed',
      });
      return;
    }

    if (state.state === 'open') {
      const now = Date.now();
      const timeSinceLastFailure = now - state.lastFailureTime;
      const cooldownPeriod = 60000; // 1 minute

      if (timeSinceLastFailure > cooldownPeriod) {
        state.state = 'half-open';
        this.logger.debug(`Circuit breaker transitioning to half-open for ${nodeType}`);
      } else {
        throw new Error(`Circuit breaker is open for node type '${nodeType}'`);
      }
    }
  }

  private updateCircuitBreakerSuccess(nodeType: string): void {
    const state = this.circuitBreakerState.get(nodeType);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
    }
  }

  private updateCircuitBreakerFailure(nodeType: string): void {
    const state = this.circuitBreakerState.get(nodeType);
    if (state) {
      state.failures++;
      state.lastFailureTime = Date.now();

      const threshold = 5; // Open circuit after 5 failures
      if (state.failures >= threshold) {
        state.state = 'open';
        this.logger.warn(`Circuit breaker opened for node type '${nodeType}' after ${state.failures} failures`);
      }
    }
  }

  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    let delay: number;

    switch (policy.backoffStrategy) {
      case 'fixed':
        delay = policy.baseDelay;
        break;
      case 'linear':
        delay = policy.baseDelay * attempt;
        break;
      case 'exponential':
      default:
        delay = policy.baseDelay * Math.pow(2, attempt - 1);
        break;
    }

    // Apply max delay limit
    delay = Math.min(delay, policy.maxDelay);

    // Apply jitter if enabled
    if (policy.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.max(delay, 0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logNodeExecution(
    executionId: string,
    nodeExecution: NodeExecution
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