/**
 * JWT Auth Guard
 * Validates JWT tokens using auth-microservice
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const validation = await this.authService.validateToken(token);

      if (!validation.valid || !validation.user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user to request
      request.user = validation.user;
      return true;
    } catch (error: any) {
      // Ensure we always throw UnauthorizedException for auth failures
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // If any other error occurs (e.g., timeout, network error), throw UnauthorizedException
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

