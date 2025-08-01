import { Process, Processor, OnQueueCompleted, OnQueueFailed, OnQueueProgress } from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExecutionRepository } from './execution.repository';
import { FlowsService } from '../flows/flows.service';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionOrchestrator } from '../execution/execution-orchestrator.service';
import { ExecutionStatus } from '../database/entities/execution.entity';
import { FlowExecutionJobData } from './scheduler.service';

@Processor('flow-execution')
@Injectable()
export class FlowExecutionProcessor {
  private activeJobs = new Map<string, {
    jobId: string;
    executionId: string;
    startTime: number;
    metrics: {
      memoryStart: number;
      cpuStart: NodeJS.CpuUsage;
      attempts: number;
    };
  }>();

  constructor(
    private readonly executionRepository: ExecutionRepository,
    private readonly flowsService: FlowsService,
    private readonly executionService: ExecutionService,
    private readonly executionOrchestrator: ExecutionOrchestrator,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Process('execute-flow')
  async handleFlowExecution(job: Job<FlowExecutionJobData>): Promise<void> {
    const { scheduleId, flowId, executionId, retryCount = 0 } = job.data;
    const jobId = String(job.id);
    const startTime = Date.now();

    // Initialize job tracking
    const jobMetrics = {
      jobId,
      executionId: executionId || `exec_${jobId}`,
      startTime,
      metrics: {
        memoryStart: process.memoryUsage().heapUsed,
        cpuStart: process.cpuUsage(),
        attempts: job.attemptsMade,
      },
    };

    this.activeJobs.set(jobId, jobMetrics);

    this.logger.info('Processing flow execution job', {
      jobId,
      scheduleId,
      flowId,
      executionId: jobMetrics.executionId,
      retryCount,
      attempt: job.attemptsMade,
      maxAttempts: job.data.maxRetries || 3,
    });

    // Set initial progress
    await job.progress(0);

    let execution;

    try {
      // Get or create execution record
      if (executionId) {
        execution = await this.executionRepository.findById(executionId);
      }

      if (!execution) {
        execution = await this.executionRepository.create({
          flowId,
          scheduleId,
          status: ExecutionStatus.PENDING,
          startTime: new Date(),
          retryCount,
        });
        jobMetrics.executionId = execution.id;
      }

      // Update job progress
      await job.progress(10);

      // Update execution status to running
      await this.executionRepository.updateStatus(
        execution.id,
        ExecutionStatus.RUNNING,
      );

      // Emit execution started event
      this.eventEmitter.emit('execution.started', {
        executionId: execution.id,
        flowId,
        scheduleId,
        jobId,
        timestamp: new Date(),
      });

      // Get flow definition
      const flow = await this.flowsService.getFlowById(flowId);
      if (!flow) {
        throw new Error(`Flow with ID '${flowId}' not found`);
      }

      this.logger.info('Starting flow execution', {
        executionId: execution.id,
        flowName: flow.name,
        nodeCount: flow.nodes.length,
        jobId,
      });

      // Update job progress
      await job.progress(20);

      // Execute the flow using the orchestrator with enhanced features
      const result = await this.executionOrchestrator.executeFlow(execution.id, flow, {
        context: {
          jobId,
          scheduleId,
          queueMetrics: {
            memoryStart: jobMetrics.metrics.memoryStart,
            cpuStart: jobMetrics.metrics.cpuStart,
            attempts: job.attemptsMade,
          },
        },
      });

      // Calculate final metrics
      const endTime = Date.now();
      const duration = endTime - startTime;
      const memoryEnd = process.memoryUsage().heapUsed;
      const cpuEnd = process.cpuUsage(jobMetrics.metrics.cpuStart);

      // Update job progress
      await job.progress(100);

      // Update execution with success status
      await this.executionRepository.updateStatus(
        execution.id,
        result.success ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED,
        new Date(),
        result.error,
      );

      // Update records processed if available
      if (result.recordsProcessed) {
        await this.executionRepository.update(execution.id, {
          recordsProcessed: result.recordsProcessed,
        });
      }

      // Emit completion event
      if (result.success) {
        this.eventEmitter.emit('execution.completed', {
          executionId: execution.id,
          flowId,
          result,
          duration,
          jobId,
          metrics: {
            memoryUsed: memoryEnd - jobMetrics.metrics.memoryStart,
            cpuUsed: cpuEnd.user + cpuEnd.system,
            attempts: job.attemptsMade,
          },
        });
      }

      this.logger.info('Flow execution completed successfully', {
        executionId: execution.id,
        jobId,
        duration: result.duration,
        recordsProcessed: result.recordsProcessed,
        memoryUsed: memoryEnd - jobMetrics.metrics.memoryStart,
        cpuUsed: cpuEnd.user + cpuEnd.system,
        attempts: job.attemptsMade,
      });

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const memoryEnd = process.memoryUsage().heapUsed;
      const cpuEnd = process.cpuUsage(jobMetrics.metrics.cpuStart);

      this.logger.error('Flow execution failed', {
        executionId: execution?.id,
        jobId,
        scheduleId,
        flowId,
        attempt: job.attemptsMade,
        maxAttempts: job.data.maxRetries || 3,
        duration,
        error: error.message,
        stack: error.stack,
      });

      if (execution) {
        await this.executionRepository.updateStatus(
          execution.id,
          ExecutionStatus.FAILED,
          new Date(),
          error.message,
        );

        // Emit failure event
        this.eventEmitter.emit('execution.failed', {
          executionId: execution.id,
          flowId,
          error: error.message,
          duration,
          jobId,
          attempt: job.attemptsMade,
          metrics: {
            memoryUsed: memoryEnd - jobMetrics.metrics.memoryStart,
            cpuUsed: cpuEnd.user + cpuEnd.system,
            attempts: job.attemptsMade,
          },
        });
      }

      // Determine if we should retry
      const shouldRetry = this.shouldRetryJob(error, job);
      
      if (shouldRetry) {
        this.logger.warn('Job will be retried', {
          jobId,
          executionId: execution?.id,
          attempt: job.attemptsMade,
          maxAttempts: job.data.maxRetries || 3,
        });
      }

      // Re-throw the error to trigger Bull's retry mechanism if applicable
      throw error;
      
    } finally {
      // Clean up job tracking
      this.activeJobs.delete(jobId);
    }
  }

  @Process('cleanup-old-jobs')
  async handleJobCleanup(job: Job): Promise<void> {
    this.logger.info('Starting job cleanup process');

    try {
      // Clean up completed jobs older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // This is a simplified cleanup - in production you might want more sophisticated logic
      await job.queue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
      await job.queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

      this.logger.info('Job cleanup completed');
    } catch (error) {
      this.logger.error('Job cleanup failed', error);
      throw error;
    }
  }

  // Queue event handlers

  @OnQueueCompleted()
  onJobCompleted(job: Job, result: any) {
    const jobId = String(job.id);
    const jobMetrics = this.activeJobs.get(jobId);

    this.logger.info('Job completed successfully', {
      jobId,
      executionId: jobMetrics?.executionId,
      duration: jobMetrics ? Date.now() - jobMetrics.startTime : undefined,
      attempts: job.attemptsMade,
    });

    // Emit job completion event
    this.eventEmitter.emit('job.completed', {
      jobId,
      executionId: jobMetrics?.executionId,
      result,
      completedAt: new Date(),
      attempts: job.attemptsMade,
    });
  }

  @OnQueueFailed()
  onJobFailed(job: Job, error: Error) {
    const jobId = String(job.id);
    const jobMetrics = this.activeJobs.get(jobId);

    this.logger.error('Job failed', {
      jobId,
      executionId: jobMetrics?.executionId,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      error: error.message,
      willRetry: job.attemptsMade < (job.opts.attempts || 3),
    });

    // Emit job failure event
    this.eventEmitter.emit('job.failed', {
      jobId,
      executionId: jobMetrics?.executionId,
      error: error.message,
      failedAt: new Date(),
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      willRetry: job.attemptsMade < (job.opts.attempts || 3),
    });

    // Clean up if max attempts reached
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      this.activeJobs.delete(jobId);
    }
  }

  @OnQueueProgress()
  onJobProgress(job: Job, progress: number) {
    const jobId = String(job.id);
    const jobMetrics = this.activeJobs.get(jobId);

    // Emit progress update
    this.eventEmitter.emit('job.progress', {
      jobId,
      executionId: jobMetrics?.executionId,
      progress,
      timestamp: new Date(),
    });
  }

  // Private helper methods

  private shouldRetryJob(error: Error, job: Job): boolean {
    const maxAttempts = job.data.maxRetries || 3;
    
    // Don't retry if max attempts reached
    if (job.attemptsMade >= maxAttempts) {
      return false;
    }

    // Don't retry for certain error types
    const nonRetryableErrors = [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'BadRequestError',
    ];

    if (nonRetryableErrors.some(errorType => error.name === errorType || error.message.includes(errorType))) {
      return false;
    }

    // Don't retry for permanent failures
    if (error.message.includes('PERMANENT_FAILURE')) {
      return false;
    }

    return true;
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  // Public methods for monitoring

  getActiveJobsCount(): number {
    return this.activeJobs.size;
  }

  getActiveJobs(): Array<{
    jobId: string;
    executionId: string;
    startTime: number;
    duration: number;
    attempts: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeJobs.values()).map(job => ({
      jobId: job.jobId,
      executionId: job.executionId,
      startTime: job.startTime,
      duration: now - job.startTime,
      attempts: job.metrics.attempts,
    }));
  }

  getJobMetrics(jobId: string): {
    executionId: string;
    startTime: number;
    duration: number;
    memoryUsage: number;
    attempts: number;
  } | null {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return null;
    }

    const now = Date.now();
    const currentMemory = process.memoryUsage().heapUsed;

    return {
      executionId: job.executionId,
      startTime: job.startTime,
      duration: now - job.startTime,
      memoryUsage: currentMemory - job.metrics.memoryStart,
      attempts: job.metrics.attempts,
    };
  }
}