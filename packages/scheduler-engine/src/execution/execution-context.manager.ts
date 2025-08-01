import {
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { FlowDto } from '../flows/dto';
import * as crypto from 'crypto';

// Import ExecutionContext from node-execution.manager instead
import { ExecutionContext } from './node-execution.manager';

export interface SecretConfig {
  type: 'environment' | 'vault' | 'aws_secrets';
  key: string;
  region?: string; // For AWS Secrets Manager
  vaultPath?: string; // For Vault
}

export interface VariableConfig {
  name: string;
  type: 'static' | 'dynamic' | 'secret';
  value?: any;
  expression?: string;
  secretConfig?: SecretConfig;
}

export interface ExtendedExecutionContext extends ExecutionContext {
  flowName?: string;
  variables: Map<string, any>;
  secrets: Map<string, any>;
  environment: string;
  correlationId: string;
  traceId: string;
  parentExecutionId?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
}

@Injectable()
export class ExecutionContextManager {
  private readonly logger = new Logger(ExecutionContextManager.name);
  private readonly contexts = new Map<string, ExtendedExecutionContext>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {}

  async createExecutionContext(
    executionId: string,
    flow: FlowDto,
    userContext: Record<string, any> = {}
  ): Promise<ExtendedExecutionContext> {
    this.logger.debug(`Creating execution context for ${executionId}`, {
      flowId: flow.id,
      flowName: flow.name,
    });

    try {
      // Generate correlation and trace IDs
      const correlationId = this.generateCorrelationId();
      const traceId = this.generateTraceId();

      // Create base context
      const context: ExtendedExecutionContext = {
        executionId,
        flowId: flow.id,
        flowName: flow.name,
        userId: flow.createdBy,
        timestamp: new Date(),
        logger: this.winstonLogger,
        metadata: {
          ...flow.metadata,
          ...userContext,
        },
        variables: new Map<string, any>(),
        secrets: new Map<string, any>(),
        environment: this.configService.get('NODE_ENV', 'development'),
        correlationId,
        traceId,
        retryCount: 0,
        maxRetries: this.configService.get('MAX_EXECUTION_RETRIES', 3),
        timeoutMs: this.configService.get('EXECUTION_TIMEOUT_MS', 300000), // 5 minutes
      };

      // Load flow variables
      await this.loadFlowVariables(context, flow);

      // Load secrets
      await this.loadSecrets(context, flow);

      // Load environment variables
      await this.loadEnvironmentVariables(context);

      // Store context for later use
      this.contexts.set(executionId, context);

      this.logger.debug(`Execution context created`, {
        executionId,
        correlationId,
        traceId,
        variableCount: context.variables.size,
        secretCount: context.secrets.size,
      });

      return context;

    } catch (error) {
      this.logger.error(`Failed to create execution context for ${executionId}`, error);
      throw error;
    }
  }

  async updateContext(
    executionId: string,
    updates: Partial<ExtendedExecutionContext>
  ): Promise<void> {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }

    // Update context properties
    Object.assign(context, updates);

    this.logger.debug(`Execution context updated`, {
      executionId,
      updatedFields: Object.keys(updates),
    });
  }

  async setVariable(
    executionId: string,
    name: string,
    value: any
  ): Promise<void> {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }

    context.variables.set(name, value);

    this.logger.debug(`Variable set in execution context`, {
      executionId,
      variableName: name,
      valueType: typeof value,
    });
  }

  async getVariable(
    executionId: string,
    name: string
  ): Promise<any> {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }

    return context.variables.get(name);
  }

  async interpolateVariables(
    executionId: string,
    template: string
  ): Promise<string> {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }

    let result = template;

    // Replace variables with ${variable_name} syntax
    const variableRegex = /\$\{([^}]+)\}/g;
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1];
      const variableValue = await this.resolveVariable(context, variableName);
      
      if (variableValue !== undefined) {
        result = result.replace(match[0], String(variableValue));
      }
    }

    return result;
  }

  async getContext(executionId: string): Promise<ExtendedExecutionContext | null> {
    return this.contexts.get(executionId) || null;
  }

  async cleanupContext(executionId: string): Promise<void> {
    const context = this.contexts.get(executionId);
    if (context) {
      // Clear sensitive data
      context.secrets.clear();
      
      // Remove from memory
      this.contexts.delete(executionId);

      this.logger.debug(`Execution context cleaned up`, { executionId });
    }
  }

  async createChildContext(
    parentExecutionId: string,
    childExecutionId: string,
    overrides: Partial<ExtendedExecutionContext> = {}
  ): Promise<ExtendedExecutionContext> {
    const parentContext = this.contexts.get(parentExecutionId);
    if (!parentContext) {
      throw new Error(`Parent execution context not found: ${parentExecutionId}`);
    }

    // Create child context inheriting from parent
    const childContext: ExtendedExecutionContext = {
      ...parentContext,
      executionId: childExecutionId,
      parentExecutionId,
      correlationId: this.generateCorrelationId(),
      traceId: parentContext.traceId, // Keep same trace ID
      variables: new Map(parentContext.variables), // Copy variables
      secrets: new Map(parentContext.secrets), // Copy secrets
      retryCount: 0, // Reset retry count
      ...overrides,
    };

    this.contexts.set(childExecutionId, childContext);

    this.logger.debug(`Child execution context created`, {
      parentExecutionId,
      childExecutionId,
      correlationId: childContext.correlationId,
    });

    return childContext;
  }

  // Private methods

  private async loadFlowVariables(
    context: ExtendedExecutionContext,
    flow: FlowDto
  ): Promise<void> {
    const variables = flow.variables || [];

    for (const variable of variables) {
      try {
        let value: any;

        const variableConfig = variable as any as VariableConfig;
        
        switch (variableConfig.type) {
          case 'static':
            value = variableConfig.value;
            break;

          case 'dynamic':
            value = await this.evaluateDynamicVariable(variableConfig, context);
            break;

          case 'secret':
            if (variableConfig.secretConfig) {
              value = await this.loadSecret(variableConfig.secretConfig);
              // Store in secrets map instead of variables
              context.secrets.set(variable.name, value);
              continue;
            }
            break;

          default:
            this.logger.warn(`Unknown variable type: ${variable.type}`, {
              variableName: variable.name,
            });
            continue;
        }

        context.variables.set(variable.name, value);

      } catch (error) {
        this.logger.error(`Failed to load variable: ${variable.name}`, error);
        // Continue loading other variables
      }
    }
  }

  private async loadSecrets(
    context: ExtendedExecutionContext,
    flow: FlowDto
  ): Promise<void> {
    const secrets = flow.secrets || [];

    for (const secret of secrets) {
      try {
        // Handle simple key-value secrets from FlowDto
        context.secrets.set(secret.name, secret.value);

        this.logger.debug(`Secret loaded`, {
          executionId: context.executionId,
          secretKey: secret.name,
        });

      } catch (error) {
        this.logger.error(`Failed to load secret: ${secret.name}`, error);
        // Continue loading other secrets
      }
    }
  }

  private async loadEnvironmentVariables(
    context: ExtendedExecutionContext
  ): Promise<void> {
    // Load common environment variables
    const envVars = [
      'NODE_ENV',
      'DB_HOST',
      'DB_PORT',
      'REDIS_HOST',
      'REDIS_PORT',
      'APP_VERSION',
      'BUILD_ID',
    ];

    for (const envVar of envVars) {
      const value = this.configService.get(envVar);
      if (value !== undefined) {
        context.variables.set(`env.${envVar}`, value);
      }
    }

    // Add execution-specific environment variables
    context.variables.set('env.EXECUTION_ID', context.executionId);
    context.variables.set('env.FLOW_ID', context.flowId);
    context.variables.set('env.CORRELATION_ID', context.correlationId);
    context.variables.set('env.TRACE_ID', context.traceId);
    context.variables.set('env.TIMESTAMP', context.timestamp.toISOString());
  }

  private async evaluateDynamicVariable(
    variable: VariableConfig,
    context: ExtendedExecutionContext
  ): Promise<any> {
    if (!variable.expression) {
      return undefined;
    }

    try {
      // Create evaluation context
      const evalContext = {
        execution: {
          id: context.executionId,
          flowId: context.flowId,
          timestamp: context.timestamp,
          environment: context.environment,
        },
        env: Object.fromEntries(
          Array.from(context.variables.entries())
            .filter(([key]) => key.startsWith('env.'))
            .map(([key, value]) => [key.substring(4), value])
        ),
        // Add common functions
        now: () => new Date(),
        uuid: () => crypto.randomUUID(),
        random: (min: number = 0, max: number = 1) => Math.random() * (max - min) + min,
      };

      // Simple expression evaluation using Function constructor
      // In production, consider using a more secure expression evaluator
      const func = new Function('context', `
        "use strict";
        with (context) {
          return ${variable.expression};
        }
      `);

      return func(evalContext);

    } catch (error) {
      this.logger.error(`Failed to evaluate dynamic variable: ${variable.name}`, error);
      return undefined;
    }
  }

  private async loadSecret(secretConfig: SecretConfig): Promise<any> {
    switch (secretConfig.type) {
      case 'environment':
        return this.configService.get(secretConfig.key);

      case 'vault':
        return this.loadVaultSecret(secretConfig);

      case 'aws_secrets':
        return this.loadAWSSecret(secretConfig);

      default:
        throw new Error(`Unknown secret type: ${secretConfig.type}`);
    }
  }

  private async loadVaultSecret(secretConfig: SecretConfig): Promise<any> {
    // Placeholder for Vault integration
    // In production, implement proper Vault client
    this.logger.warn('Vault integration not implemented yet', {
      path: secretConfig.vaultPath,
      key: secretConfig.key,
    });
    
    // Fallback to environment variable
    return this.configService.get(`VAULT_${secretConfig.key.toUpperCase()}`);
  }

  private async loadAWSSecret(secretConfig: SecretConfig): Promise<any> {
    // Placeholder for AWS Secrets Manager integration
    // In production, implement proper AWS SDK integration
    this.logger.warn('AWS Secrets Manager integration not implemented yet', {
      key: secretConfig.key,
      region: secretConfig.region,
    });
    
    // Fallback to environment variable
    return this.configService.get(`AWS_SECRET_${secretConfig.key.toUpperCase()}`);
  }

  private async resolveVariable(
    context: ExtendedExecutionContext,
    variableName: string
  ): Promise<any> {
    // Try variables first
    if (context.variables.has(variableName)) {
      return context.variables.get(variableName);
    }

    // Try secrets (but don't expose them in logs)
    if (context.secrets.has(variableName)) {
      return context.secrets.get(variableName);
    }

    // Try nested variable access (e.g., env.NODE_ENV)
    if (variableName.includes('.')) {
      const [prefix, ...rest] = variableName.split('.');
      const fullKey = variableName;
      
      if (context.variables.has(fullKey)) {
        return context.variables.get(fullKey);
      }
    }

    // Try metadata
    if (variableName.startsWith('metadata.')) {
      const metadataKey = variableName.substring(9);
      return context.metadata[metadataKey];
    }

    // Try execution info
    if (variableName.startsWith('execution.')) {
      const execKey = variableName.substring(10);
      switch (execKey) {
        case 'id':
          return context.executionId;
        case 'flowId':
          return context.flowId;
        case 'flowName':
          return context.flowName;
        case 'userId':
          return context.userId;
        case 'timestamp':
          return context.timestamp;
        case 'correlationId':
          return context.correlationId;
        case 'traceId':
          return context.traceId;
        case 'environment':
          return context.environment;
        default:
          return undefined;
      }
    }

    return undefined;
  }

  private generateCorrelationId(): string {
    return `corr_${crypto.randomUUID()}`;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}