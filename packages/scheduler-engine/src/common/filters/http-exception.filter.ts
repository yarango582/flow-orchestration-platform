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

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const message = typeof exceptionResponse === 'string' 
      ? exceptionResponse 
      : (exceptionResponse as any).message || 'Internal server error';

    const errorResponse = {
      code: this.getErrorCode(status, exception),
      message,
      details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log the error
    this.logger.error('HTTP Exception', {
      status,
      message,
      path: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      stack: exception.stack,
    });

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number, exception: HttpException): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      default:
        return 'HTTP_ERROR';
    }
  }
}