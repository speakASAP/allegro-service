/**
 * JWT Auth Guard
 * Validates JWT tokens locally (fast, no HTTP calls to auth-microservice)
 * Falls back to auth-microservice for token refresh operations
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService, // Keep for potential fallback
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || this.throwConfigError('JWT_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const path = request.url || request.path || 'unknown';
    
    try {
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Validate JWT token locally (fast, no HTTP calls)
      const validationStartTime = Date.now();
      let decoded: any;
      
      try {
        // Verify token signature and expiration locally
        decoded = jwt.verify(token, this.jwtSecret);
        
        // Check if token is expired (jwt.verify already does this, but double-check)
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          throw new UnauthorizedException('Token expired');
        }

        const validationDuration = Date.now() - validationStartTime;

        // Transform decoded token to AuthUser format
        const user: AuthUser = {
          id: decoded.id || decoded.sub || decoded.userId,
          email: decoded.email,
          firstName: decoded.firstName,
          lastName: decoded.lastName,
          phone: decoded.phone,
          isActive: decoded.isActive !== false, // Default to true if not specified
          isVerified: decoded.isVerified !== false, // Default to true if not specified
          createdAt: decoded.createdAt,
          updatedAt: decoded.updatedAt,
        };

        // Validate that we have at least an ID and email
        if (!user.id || !user.email) {
          throw new UnauthorizedException('Invalid token payload');
        }

        // Attach user to request
        request.user = user;

        // Log successful validation (only in debug mode to avoid log spam)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[JwtAuthGuard] Token validated locally for ${path}`, {
            userId: user.id,
            email: user.email,
            validationDuration: `${validationDuration}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
          });
        }

        return true;
      } catch (jwtError: any) {
        // JWT verification failed (invalid signature, expired, malformed, etc.)
        const validationDuration = Date.now() - validationStartTime;
        
        if (process.env.NODE_ENV === 'development') {
          console.error(`[JwtAuthGuard] Local token validation failed for ${path}`, {
            error: jwtError.message,
            errorType: jwtError.name,
            validationDuration: `${validationDuration}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
          });
        }

        // Throw UnauthorizedException for any JWT verification errors
        if (jwtError.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Token expired');
        } else if (jwtError.name === 'JsonWebTokenError') {
          throw new UnauthorizedException('Invalid token');
        } else {
          throw new UnauthorizedException('Token validation failed');
        }
      }
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      
      // Only log errors in development or if it's not a standard auth failure
      if (process.env.NODE_ENV === 'development' || !(error instanceof UnauthorizedException)) {
        console.error(`[JwtAuthGuard] Authentication failed for ${path}`, {
          error: error.message,
          errorType: error.constructor?.name,
          totalDuration: `${totalDuration}ms`,
          timestamp: new Date().toISOString(),
        });
      }

      // Ensure we always throw UnauthorizedException for auth failures
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // If any other error occurs, throw UnauthorizedException
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private throwConfigError(key: string): never {
    throw new Error(`Missing required environment variable: ${key}. Please set JWT_SECRET in your .env file (must match auth-microservice JWT_SECRET).`);
  }
}

