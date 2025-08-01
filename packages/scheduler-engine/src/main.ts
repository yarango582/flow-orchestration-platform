import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';

async function bootstrap() {
  // Configure Winston logger
  const logger = WinstonModule.createLogger({
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
  });

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Flow Platform Scheduler Engine')
    .setDescription('API for Flow Management, Scheduling, and Node Catalog services')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('flows', 'Flow Management operations')
    .addTag('schedules', 'Schedule Management operations')
    .addTag('executions', 'Execution Management operations')
    .addTag('catalog', 'Node Catalog operations')
    .addTag('health', 'Health Check operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server on different ports for different services
  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Flow Platform Scheduler Engine started on port ${port}`);
  logger.log(`📚 Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});