/**
 * Shared Module Exports
 */

export * from './database/prisma.module';
export * from './database/prisma.service';
export * from './logger/logger.module';
export * from './logger/logger.service';
export * from './auth/auth.module';
export * from './auth/auth.service';
export * from './auth/auth.interface';
export * from './auth/jwt-auth.guard';
export * from './auth/roles.guard';
export * from './auth/roles.decorator';
export * from './notifications/notification.module';
export * from './notifications/notification.service';
export * from './notifications/notification.interface';
export * from './resilience/resilience.module';
export * from './resilience/circuit-breaker.service';
export * from './resilience/retry.service';
export * from './resilience/fallback.service';
export * from './resilience/resilience.monitor';
export * from './health/health.module';
export * from './health/health.service';
export * from './metrics/metrics.module';
export * from './metrics/metrics.service';
export * from './utils/supplier-placeholder.service';
export * from './clients/clients.module';
export * from './clients/catalog-client.service';
export * from './clients/warehouse-client.service';
export * from './clients/order-client.service';
export * from './rabbitmq/rabbitmq.module';
export * from './rabbitmq/stock-events.subscriber';

