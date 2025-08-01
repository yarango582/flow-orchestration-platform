import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// Import modules
import { FlowsModule } from './flows/flows.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CatalogModule } from './catalog/catalog.module';
import { ExecutionModule } from './execution/execution.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CommonModule } from './common/common.module';

// Import configuration
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Winston Logger
    WinstonModule.forRootAsync({
      useFactory: () => ({
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ],
      }),
    }),

    // TypeORM Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('database.synchronize', false),
        logging: configService.get('database.logging', false),
      }),
      inject: [ConfigService],
    }),

    // BullMQ Redis Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          db: configService.get('redis.db', 0),
        },
      }),
      inject: [ConfigService],
    }),

    // NestJS Schedule
    ScheduleModule.forRoot(),

    // Event Emitter for real-time updates
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Application modules
    CommonModule,
    FlowsModule,
    SchedulerModule,
    CatalogModule,
    ExecutionModule,
    RealtimeModule,
    MonitoringModule,
  ],
})
export class AppModule {}