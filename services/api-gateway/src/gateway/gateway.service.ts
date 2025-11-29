/**
 * Gateway Service
 * Routes requests to appropriate microservices
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly serviceUrls: Record<string, string>;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isDevelopment = nodeEnv === 'development';
    
    // Helper to convert Docker hostnames to localhost in development
    const getServiceUrl = (envVar: string, defaultPort: string, serviceName?: string): string => {
      const url = this.configService.get<string>(envVar);
      if (url && isDevelopment && url.includes('-service')) {
        // Replace Docker service hostname with localhost in development
        const port = url.match(/:(\d+)/)?.[1] || defaultPort;
        return `http://localhost:${port}`;
      }
      return url || (serviceName ? this.throwConfigError(envVar) : `http://localhost:${defaultPort}`);
    };

    this.serviceUrls = {
      products: getServiceUrl('PRODUCT_SERVICE_URL', '3402'),
      allegro: getServiceUrl('ALLEGRO_SERVICE_URL', '3403'),
      sync: getServiceUrl('SYNC_SERVICE_URL', '3404'),
      webhooks: this.configService.get<string>('WEBHOOK_SERVICE_URL') || this.throwConfigError('WEBHOOK_SERVICE_URL'),
      import: getServiceUrl('IMPORT_SERVICE_URL', '3406'),
      scheduler: this.configService.get<string>('SCHEDULER_SERVICE_URL') || this.throwConfigError('SCHEDULER_SERVICE_URL'),
      settings: getServiceUrl('SETTINGS_SERVICE_URL', '3408'),
      auth: this.configService.get<string>('AUTH_SERVICE_URL') || this.throwConfigError('AUTH_SERVICE_URL'),
    };
  }

  /**
   * Forward request to service
   */
  async forwardRequest(
    serviceName: string,
    path: string,
    method: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const baseUrl = this.serviceUrls[serviceName];
    if (!baseUrl) {
      throw new Error(`Service ${serviceName} not configured`);
    }

    const url = `${baseUrl}${path}`;
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: parseInt(this.configService.get<string>('GATEWAY_TIMEOUT') || this.configService.get<string>('HTTP_TIMEOUT') || '30000'),
    };

    this.logger.debug(`Forwarding ${method} ${url}`);

    try {
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, config));
          break;
        case 'POST':
          response = await firstValueFrom(this.httpService.post(url, body, config));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, body, config));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, config));
          break;
        case 'PATCH':
          response = await firstValueFrom(this.httpService.patch(url, body, config));
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      return response.data;
    } catch (error: any) {
      this.logger.error(`Error forwarding request to ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  private throwConfigError(key: string): never {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file.`);
  }
}

