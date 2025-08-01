import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ExecutionService } from './execution.service';
import { ExecutionOrchestrator } from './execution-orchestrator.service';
import { NodeExecutionManager } from './node-execution.manager';
import { DataFlowManager } from './data-flow.manager';
import { ExecutionContextManager } from './execution-context.manager';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    EventEmitterModule,
    forwardRef(() => SchedulerModule), // For ExecutionRepository
    CatalogModule,  // For CatalogService
  ],
  providers: [
    ExecutionService,
    ExecutionOrchestrator,
    NodeExecutionManager,
    DataFlowManager,
    ExecutionContextManager,
  ],
  exports: [
    ExecutionService,
    ExecutionOrchestrator,
    NodeExecutionManager,
    DataFlowManager,
    ExecutionContextManager,
  ],
})
export class ExecutionModule {}
