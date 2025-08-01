import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    const errorResponse = {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error with full context
    this.logger.error('Unhandled Exception', {
      status,
      message,
      path: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      stack: exception instanceof Error ? exception.stack : String(exception),
      body: request.body,
      params: request.params,
      query: request.query,
    });

    response.status(status).json(errorResponse);
  }
}