import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('Authentication failed: No token provided', {
        path: request.url,
        method: request.method,
        ip: request.ip,
      });
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // In a real implementation, you would validate the JWT token here
      // For now, we'll accept any token that starts with 'Bearer '
      const payload = this.verifyToken(token);
      request['user'] = payload;
      
      return true;
    } catch (error) {
      this.logger.warn('Authentication failed: Invalid token', {
        path: request.url,
        method: request.method,
        ip: request.ip,
        error: error.message,
      });
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private verifyToken(token: string): any {
    // Simplified token verification - in production, use proper JWT validation
    if (token.length < 10) {
      throw new Error('Token too short');
    }

    // Return mock user payload
    return {
      userId: 'user-123',
      email: 'user@example.com',
      roles: ['user'],
    };
  }
}