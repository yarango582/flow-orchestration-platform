import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    ScheduleModule,
    SchedulerModule, // For FlowExecutionProcessor
  ],
  providers: [MetricsService],
  controllers: [MonitoringController],
  exports: [MetricsService],
})
export class MonitoringModule {}