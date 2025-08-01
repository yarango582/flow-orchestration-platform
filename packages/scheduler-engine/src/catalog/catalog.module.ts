import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeDefinition } from '../database/entities/node-definition.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';

@Module({
  imports: [TypeOrmModule.forFeature([NodeDefinition])],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository],
  exports: [CatalogService, CatalogRepository],
})
export class CatalogModule {}