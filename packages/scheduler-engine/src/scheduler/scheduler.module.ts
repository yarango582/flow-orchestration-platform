import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Schedule } from '../database/entities/schedule.entity';
import { Execution } from '../database/entities/execution.entity';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { ScheduleRepository } from './schedule.repository';
import { ExecutionRepository } from './execution.repository';
import { FlowExecutionProcessor } from './flow-execution.processor';
import { FlowsModule } from '../flows/flows.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Execution]),
    BullModule.registerQueue({
      name: 'flow-execution',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }),
    FlowsModule,
    forwardRef(() => ExecutionModule),
  ],
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ScheduleRepository,
    ExecutionRepository,
    FlowExecutionProcessor,
  ],
  exports: [
    SchedulerService,
    ScheduleRepository,
    ExecutionRepository,
    FlowExecutionProcessor, // Agregamos esta exportación
  ],
})
export class SchedulerModule {}
