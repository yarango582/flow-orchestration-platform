import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flow } from '../database/entities/flow.entity';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';
import { FlowsRepository } from './flows.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Flow])],
  controllers: [FlowsController],
  providers: [FlowsService, FlowsRepository],
  exports: [FlowsService, FlowsRepository],
})
export class FlowsModule {}