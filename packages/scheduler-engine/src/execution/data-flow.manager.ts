import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';
import { CatalogService } from '../catalog/catalog.service';
import { FlowDto } from '../flows/dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Import from node-core library
import {
  NodeResult,
  CompatibilityValidator,
} from '@flow-platform/node-core';

export interface DataTransformation {
  type: 'map' | 'filter' | 'reduce' | 'custom';
  config: any;
  script?: string;
}

export interface DataCompatibilityCheck {
  isCompatible: boolean;
  errors: string[];
  warnings: string[];
  suggestedTransformations?: DataTransformation[];
}

export interface DataFlowConnection {
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
  toInput: string;
  transformation?: DataTransformation;
}

@Injectable()
export class DataFlowManager {
  private readonly logger = new Logger(DataFlowManager.name);
  private compatibilityValidator: CompatibilityValidator;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly winstonLogger: WinstonLogger,
  ) {
    this.compatibilityValidator = new CompatibilityValidator();
  }

  async passDataBetweenNodes(
    fromNode: { id: string; type: string; result: NodeResult },
    toNode: { id: string; type: string },
    outputPin: string,
    inputPin: string,
    transformation?: DataTransformation
  ): Promise<any> {
    this.logger.debug(`Passing data from ${fromNode.id} to ${toNode.id}`, {
      outputPin,
      inputPin,
      hasTransformation: !!transformation,
    });

    try {
      // Extract output data
      const outputData = fromNode.result.data[outputPin];
      if (outputData === undefined) {
        throw new Error(`Output pin '${outputPin}' not found in node ${fromNode.id} result`);
      }

      // Apply transformation if specified
      let transformedData = outputData;
      if (transformation) {
        transformedData = await this.applyTransformation(outputData, transformation);
      }

      // Emit data flow event
      this.eventEmitter.emit('data.flow.passed', {
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        outputPin,
        inputPin,
        dataSize: this.calculateDataSize(transformedData),
        transformation: transformation?.type,
      });

      return transformedData;

    } catch (error) {
      this.logger.error(`Failed to pass data from ${fromNode.id} to ${toNode.id}`, {
        error: error.message,
        outputPin,
        inputPin,
      });

      // Emit error event
      this.eventEmitter.emit('data.flow.error', {
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        outputPin,
        inputPin,
        error: error.message,
      });

      throw error;
    }
  }

  async validateDataCompatibility(
    fromNodeType: string,
    fromOutputPin: string,
    toNodeType: string,
    toInputPin: string
  ): Promise<DataCompatibilityCheck> {
    this.logger.debug(`Validating data compatibility`, {
      fromNodeType,
      fromOutputPin,
      toNodeType,
      toInputPin,
    });

    try {
      // Get node definitions from catalog
      const [fromNodeDef, toNodeDef] = await Promise.all([
        this.catalogService.getNodeDefinitionByType(fromNodeType),
        this.catalogService.getNodeDefinitionByType(toNodeType),
      ]);

      if (!fromNodeDef || !toNodeDef) {
        return {
          isCompatible: false,
          errors: ['Node definitions not found in catalog'],
          warnings: [],
        };
      }

      // Find output and input definitions
      const outputDef = fromNodeDef.outputs?.find(o => o.name === fromOutputPin);
      const inputDef = toNodeDef.inputs?.find(i => i.name === toInputPin);

      if (!outputDef || !inputDef) {
        return {
          isCompatible: false,
          errors: ['Output or input pin not found in node definitions'],
          warnings: [],
        };
      }

      // Use compatibility validator from node-core
      const validationResult = await this.compatibilityValidator.validateCompatibilityInstance(
        { type: fromNodeType, pin: fromOutputPin, schema: (outputDef as any).schema },
        { type: toNodeType, pin: toInputPin, schema: (inputDef as any).schema }
      );

      // Convert validation result to our format
      const result: DataCompatibilityCheck = {
        isCompatible: validationResult.compatible,
        errors: validationResult.issues?.filter(i => i.severity === 'error')?.map(i => i.message) || [],
        warnings: validationResult.issues?.filter(i => i.severity === 'warning')?.map(i => i.message) || [],
      };

      // Add suggested transformations if incompatible
      if (!result.isCompatible) {
        result.suggestedTransformations = this.generateSuggestedTransformations(
          (outputDef as any).schema,
          (inputDef as any).schema
        );
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to validate data compatibility', error);
      return {
        isCompatible: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
      };
    }
  }

  async transformData(
    data: any,
    transformation: DataTransformation
  ): Promise<any> {
    this.logger.debug(`Applying data transformation`, {
      type: transformation.type,
      hasScript: !!transformation.script,
    });

    try {
      return await this.applyTransformation(data, transformation);
    } catch (error) {
      this.logger.error('Data transformation failed', error);
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  async validateFlowConnections(flow: FlowDto): Promise<void> {
    this.logger.debug(`Validating flow connections`, {
      flowId: flow.id,
      nodeCount: flow.nodes.length,
      connectionCount: flow.connections.length,
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const connection of flow.connections) {
      try {
        // Find source and target nodes
        const fromNode = flow.nodes.find(n => n.id === connection.fromNodeId);
        const toNode = flow.nodes.find(n => n.id === connection.toNodeId);

        if (!fromNode || !toNode) {
          errors.push(`Connection references non-existent nodes: ${connection.fromNodeId} -> ${connection.toNodeId}`);
          continue;
        }

        // Validate data compatibility
        const compatibility = await this.validateDataCompatibility(
          fromNode.type,
          connection.fromOutput,
          toNode.type,
          connection.toInput
        );

        if (!compatibility.isCompatible) {
          errors.push(`Incompatible connection ${fromNode.type}[${connection.fromOutput}] -> ${toNode.type}[${connection.toInput}]: ${compatibility.errors.join(', ')}`);
        }

        warnings.push(...compatibility.warnings);

      } catch (error) {
        errors.push(`Failed to validate connection ${connection.fromNodeId} -> ${connection.toNodeId}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Flow validation failed: ${errors.join('; ')}`);
    }

    if (warnings.length > 0) {
      this.logger.warn('Flow validation warnings', warnings);
    }
  }

  async collectNodeInputs(
    nodeId: string,
    graph: any, // ExecutionGraph from orchestrator
    nodeResults: Map<string, NodeResult>
  ): Promise<Map<string, any>> {
    const inputs = new Map<string, any>();
    const incomingEdges = graph.getIncomingEdges(nodeId);

    this.logger.debug(`Collecting inputs for node ${nodeId}`, {
      incomingEdgeCount: incomingEdges.length,
    });

    for (const edge of incomingEdges) {
      try {
        const sourceResult = nodeResults.get(edge.fromNodeId);
        if (!sourceResult || !sourceResult.success) {
          this.logger.warn(`Source node ${edge.fromNodeId} has no valid result for node ${nodeId}`);
          continue;
        }

        // Get output data
        const outputData = sourceResult.data[edge.outputPin];
        if (outputData === undefined) {
          this.logger.warn(`Output pin '${edge.outputPin}' not found in source node ${edge.fromNodeId}`);
          continue;
        }

        // Apply any transformations if needed
        let transformedData = outputData;
        if (edge.transformation) {
          transformedData = await this.applyTransformation(outputData, edge.transformation);
        }

        inputs.set(edge.inputPin, transformedData);

        // Emit data collection event
        this.eventEmitter.emit('data.collected', {
          targetNodeId: nodeId,
          sourceNodeId: edge.fromNodeId,
          outputPin: edge.outputPin,
          inputPin: edge.inputPin,
          dataSize: this.calculateDataSize(transformedData),
        });

      } catch (error) {
        this.logger.error(`Failed to collect input for node ${nodeId}`, {
          sourceNode: edge.fromNodeId,
          outputPin: edge.outputPin,
          inputPin: edge.inputPin,
          error: error.message,
        });

        // Emit error event
        this.eventEmitter.emit('data.collection.error', {
          targetNodeId: nodeId,
          sourceNodeId: edge.fromNodeId,
          error: error.message,
        });

        throw error;
      }
    }

    return inputs;
  }

  // Private methods

  private async applyTransformation(
    data: any,
    transformation: DataTransformation
  ): Promise<any> {
    switch (transformation.type) {
      case 'map':
        return this.applyMapTransformation(data, transformation.config);
      
      case 'filter':
        return this.applyFilterTransformation(data, transformation.config);
      
      case 'reduce':
        return this.applyReduceTransformation(data, transformation.config);
      
      case 'custom':
        return this.applyCustomTransformation(data, transformation);
      
      default:
        throw new Error(`Unknown transformation type: ${transformation.type}`);
    }
  }

  private applyMapTransformation(data: any, config: any): any {
    if (!Array.isArray(data)) {
      throw new Error('Map transformation requires array input');
    }

    const { fieldMappings } = config;
    if (!fieldMappings || typeof fieldMappings !== 'object') {
      throw new Error('Map transformation requires fieldMappings configuration');
    }

    return data.map(item => {
      const mappedItem: any = {};
      
      for (const [targetField, sourceField] of Object.entries(fieldMappings)) {
        if (typeof sourceField === 'string') {
          mappedItem[targetField] = this.getNestedValue(item, sourceField);
        } else if (typeof sourceField === 'object' && (sourceField as any).expression) {
          // Simple expression evaluation (could be extended)
          mappedItem[targetField] = this.evaluateExpression((sourceField as any).expression, item);
        }
      }
      
      return mappedItem;
    });
  }

  private applyFilterTransformation(data: any, config: any): any {
    if (!Array.isArray(data)) {
      throw new Error('Filter transformation requires array input');
    }

    const { conditions } = config;
    if (!conditions || !Array.isArray(conditions)) {
      throw new Error('Filter transformation requires conditions configuration');
    }

    return data.filter(item => {
      return conditions.every(condition => {
        const { field, operator, value } = condition;
        const itemValue = this.getNestedValue(item, field);
        
        switch (operator) {
          case 'equals':
            return itemValue === value;
          case 'not_equals':
            return itemValue !== value;
          case 'greater_than':
            return itemValue > value;
          case 'less_than':
            return itemValue < value;
          case 'contains':
            return String(itemValue).includes(String(value));
          case 'exists':
            return itemValue !== undefined && itemValue !== null;
          default:
            return true;
        }
      });
    });
  }

  private applyReduceTransformation(data: any, config: any): any {
    if (!Array.isArray(data)) {
      throw new Error('Reduce transformation requires array input');
    }

    const { operation, field, initialValue } = config;
    
    switch (operation) {
      case 'sum':
        return data.reduce((sum, item) => sum + (this.getNestedValue(item, field) || 0), initialValue || 0);
      
      case 'count':
        return data.length;
      
      case 'avg':
        const values = data.map(item => this.getNestedValue(item, field)).filter(v => typeof v === 'number');
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      
      case 'max':
        return Math.max(...data.map(item => this.getNestedValue(item, field)).filter(v => typeof v === 'number'));
      
      case 'min':
        return Math.min(...data.map(item => this.getNestedValue(item, field)).filter(v => typeof v === 'number'));
      
      case 'group_by':
        const groupField = config.groupBy;
        return data.reduce((groups, item) => {
          const key = this.getNestedValue(item, groupField);
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(item);
          return groups;
        }, {});
      
      default:
        throw new Error(`Unknown reduce operation: ${operation}`);
    }
  }

  private async applyCustomTransformation(
    data: any,
    transformation: DataTransformation
  ): Promise<any> {
    if (!transformation.script) {
      throw new Error('Custom transformation requires script');
    }

    try {
      // Simple and secure script execution using Function constructor
      // In production, consider using a more secure sandbox like vm2
      const transformFunction = new Function('data', 'config', `
        "use strict";
        ${transformation.script}
      `);

      return transformFunction(data, transformation.config);

    } catch (error) {
      throw new Error(`Custom transformation script error: ${error.message}`);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private evaluateExpression(expression: string, context: any): any {
    try {
      // Simple expression evaluation - replace with proper expression parser in production
      const func = new Function('item', `
        "use strict";
        with (item) {
          return ${expression};
        }
      `);
      return func(context);
    } catch (error) {
      this.logger.warn(`Expression evaluation failed: ${expression}`, error);
      return undefined;
    }
  }

  private generateSuggestedTransformations(
    outputSchema: any,
    inputSchema: any
  ): DataTransformation[] {
    const transformations: DataTransformation[] = [];

    // Simple heuristics for suggesting transformations
    if (outputSchema.type === 'array' && inputSchema.type === 'object') {
      transformations.push({
        type: 'reduce',
        config: {
          operation: 'first',
        },
      });
    }

    if (outputSchema.type === 'object' && inputSchema.type === 'array') {
      transformations.push({
        type: 'map',
        config: {
          fieldMappings: {},
        },
      });
    }

    // Field mapping suggestions
    if (outputSchema.properties && inputSchema.properties) {
      const mappings: Record<string, string> = {};
      
      for (const [inputField, inputProp] of Object.entries(inputSchema.properties)) {
        for (const [outputField, outputProp] of Object.entries(outputSchema.properties)) {
          if (inputField === outputField || 
              inputField.toLowerCase() === outputField.toLowerCase()) {
            mappings[inputField] = outputField;
            break;
          }
        }
      }

      if (Object.keys(mappings).length > 0) {
        transformations.push({
          type: 'map',
          config: {
            fieldMappings: mappings,
          },
        });
      }
    }

    return transformations;
  }

  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}