/**
 * Gateway Module
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '@allegro/shared';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import * as http from 'http';
import * as https from 'https';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Create HTTP and HTTPS agents with aggressive keep-alive settings
        // These settings ensure connections are maintained and reused immediately
        // maxFreeSockets: Keep more idle connections ready for instant reuse
        // keepAliveMsecs: How long to keep connections alive (1 second)
        // timeout: Socket timeout (60 seconds)
        // Get timeout from config, but ensure agent timeout is reasonable
        const httpTimeout = parseInt(configService.get<string>('HTTP_TIMEOUT') || '30000');
        const agentTimeout = Math.max(httpTimeout + 5000, 30000); // At least 30s, or HTTP_TIMEOUT + 5s
        
        // HTTP Agent configuration with bounded limits to prevent resource exhaustion
        // maxSockets: 200 - Bounded limit to prevent memory/CPU issues if service becomes unresponsive
        // maxFreeSockets: 50 - Reasonable pool of idle connections without excessive memory usage
        // keepAliveMsecs: 5000 - Keep connections alive longer to improve reuse
        // If maxSockets is reached, new requests will queue (bounded by Axios timeout)
        const httpAgent = new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 5000, // Increased from 1000ms to 5000ms to keep connections alive longer
          maxSockets: 200, // Bounded limit: prevents unbounded connection growth if service is unresponsive
          maxFreeSockets: 50, // Reasonable pool of idle connections ready for reuse
          timeout: agentTimeout, // Use calculated timeout instead of hardcoded 60000
          // Scheduling: 'fifo' ensures oldest connections are reused first
          scheduling: 'fifo',
        });
        
        const httpsAgent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 5000, // Increased from 1000ms to 5000ms to keep connections alive longer
          maxSockets: 200, // Bounded limit: prevents unbounded connection growth if service is unresponsive
          maxFreeSockets: 50, // Reasonable pool of idle connections ready for reuse
          timeout: agentTimeout, // Use calculated timeout instead of hardcoded 60000
          scheduling: 'fifo',
        });

        const timeout = configService.get<string>('HTTP_TIMEOUT') || '30000';
        const gatewayTimeout = configService.get<string>('GATEWAY_TIMEOUT') || timeout;
        
        return {
          timeout: parseInt(gatewayTimeout), // Use GATEWAY_TIMEOUT if available, otherwise HTTP_TIMEOUT
          maxRedirects: 5,
          httpAgent,
          httpsAgent,
          // Set default headers for keep-alive
          headers: {
            'Connection': 'keep-alive',
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule,
    AuthModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}

