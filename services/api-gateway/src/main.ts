/**
 * API Gateway Main Entry Point
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load .env file before any other imports
config({ path: join(process.cwd(), '../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Add global exception filter to catch all exceptions
  app.useGlobalFilters(new HttpExceptionFilter());
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  
  if (corsOrigin) {
    // In development, allow both production and localhost origins
    // Port configured in allegro/.env: ALLEGRO_FRONTEND_SERVICE_PORT (default: 3410)
    const frontendPort = process.env.ALLEGRO_FRONTEND_SERVICE_PORT || '3410';
    const allowedOrigins = nodeEnv === 'development' 
      ? [corsOrigin, `http://localhost:${frontendPort}`, `http://127.0.0.1:${frontendPort}`]
      : corsOrigin;
    
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else {
    // If no CORS_ORIGIN is set, enable CORS for all origins in development
    if (nodeEnv === 'development') {
      app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
    }
  }

  // Port configured in allegro/.env: API_GATEWAY_PORT (default: 3411)
  const port = configService.get<string>('API_GATEWAY_PORT') || configService.get<string>('PORT') || '3411';
  await app.listen(parseInt(port));
  console.log(`API Gateway is running on: http://localhost:${port}`);
}

bootstrap();

