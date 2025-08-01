import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { AuthGuard } from './guards/auth.guard';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

const authGuardProvider = process.env.NODE_ENV === 'production' ? [
  {
    provide: APP_GUARD,
    useClass: AuthGuard,
  },
] : [];

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    ...authGuardProvider,
  ],
  exports: [HealthService],
})
export class CommonModule {}
