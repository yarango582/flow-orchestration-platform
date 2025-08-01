import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers, body, params, query } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = request.ip;

    const startTime = Date.now();

    this.logger.info('Incoming Request', {
      method,
      url,
      userAgent,
      ip,
      params,
      query,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const duration = Date.now() - startTime;
          this.logger.info('Outgoing Response', {
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            responseSize: JSON.stringify(responseBody).length,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error('Request Error', {
            method,
            url,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}