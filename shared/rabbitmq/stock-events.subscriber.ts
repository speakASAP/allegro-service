import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { createDecipheriv, createHash } from 'crypto';
import { LoggerService, PrismaService } from '../index';

const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];

type StockEventType = 'stock.updated' | 'stock.low' | 'stock.out';

type WarehouseStockEvent = {
  type: StockEventType;
  productId?: string;
  available?: number;
  eventId?: string;
  id?: string;
  messageId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

type EventClaim = {
  eventId: string;
  skip: boolean;
};

@Injectable()
export class StockEventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = 'stock.events';
  private readonly queueName = 'stock.allegro-service';
  private readonly apiUrl = process.env.ALLEGRO_API_URL || 'https://api.allegro.pl';
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || '';
  private readonly rateLimitMs = Math.max(parseInt(process.env.ALLEGRO_STOCK_SYNC_RATE_LIMIT_MS || '1000', 10) || 1000, 0);
  private readonly pollAttempts = Math.max(parseInt(process.env.ALLEGRO_STOCK_SYNC_POLL_ATTEMPTS || '3', 10) || 3, 1);

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.subscribe();
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await (this.channel as any).close();
      if (this.connection) await this.connection.close();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error closing RabbitMQ connection: ${errorMessage}`, 'StockEventsSubscriber');
    }
  }

  private async connect() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      this.logger.log(`Connecting to RabbitMQ: ${url}`, 'StockEventsSubscriber');
      const conn = await amqp.connect(url);
      this.connection = conn;
      const ch = await this.connection.createChannel();
      this.channel = ch as unknown as amqp.Channel;
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      await this.channel.assertQueue(this.queueName, { durable: true });
      await this.channel.bindQueue(this.queueName, this.exchangeName, 'stock.#');
      this.logger.log('Connected to RabbitMQ and subscribed to stock events', 'StockEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }

  private async subscribe() {
    if (!this.channel) return;
    try {
      await this.channel.consume(
        this.queueName,
        async (msg) => {
          if (!msg) return;
          try {
            const event = JSON.parse(msg.content.toString());
            await this.handleStockEvent(event);
            this.channel?.ack(msg);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error processing stock event: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
            this.channel?.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
      this.logger.log('Subscribed to stock events queue', 'StockEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to subscribe to stock events: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }

  private async handleStockEvent(event: WarehouseStockEvent) {
    const { type, productId } = event;
    const claim = await this.claimEvent(event, type || 'unknown', productId);
    if (claim.skip) {
      this.logger.log(`Skipping duplicate Warehouse stock event ${claim.eventId}`, 'StockEventsSubscriber');
      return { status: 'duplicate', eventId: claim.eventId, type, productId };
    }

    try {
      let result: any = { status: 'ignored', eventId: claim.eventId, type, productId };
      if (!productId) {
        this.logger.warn(`Ignoring stock event without productId: ${JSON.stringify(this.redact(event))}`, 'StockEventsSubscriber');
        result = { ...result, reason: 'missing_product_id' };
      } else {
        this.logger.log(`Received stock event: ${type} for product ${productId}, available: ${event.available}`, 'StockEventsSubscriber');
        switch (type) {
          case 'stock.updated':
            result = await this.syncWarehouseQuantityToAllegro(event, this.requireAvailable(event));
            break;
          case 'stock.low':
            this.logger.warn(`Low stock alert for product ${productId}: ${event.available} available`, 'StockEventsSubscriber');
            result = { ...result, reason: 'stock_low_only' };
            break;
          case 'stock.out':
            result = await this.syncWarehouseQuantityToAllegro(event, 0);
            break;
          default:
            this.logger.warn(`Ignoring unsupported stock event type: ${type}`, 'StockEventsSubscriber');
            result = { ...result, reason: 'unsupported_stock_event_type' };
        }
      }
      await this.markEventProcessed(claim.eventId);
      return result;
    } catch (error: unknown) {
      await this.markEventFailed(claim.eventId, error);
      throw error;
    }
  }

  private async syncWarehouseQuantityToAllegro(event: WarehouseStockEvent, targetQuantity: number) {
    if (!Number.isInteger(targetQuantity) || targetQuantity < 0) {
      throw new Error(`Warehouse stock target must be a non-negative integer, got ${targetQuantity}`);
    }
    const productId = event.productId as string;
    const prismaAny = this.prisma as any;
    const offers = await prismaAny.allegroOffer.findMany({
      where: { catalogProductId: productId },
      include: { account: { select: { id: true, name: true, userId: true, isActive: true, accessToken: true } } },
    });
    if (offers.length === 0) {
      this.logger.log(`No Allegro offers found for Warehouse product ${productId}`, 'StockEventsSubscriber');
      return;
    }
    for (const offer of offers) {
      await prismaAny.allegroOffer.update({
        where: { id: offer.id },
        data: {
          ...(targetQuantity === 0 ? { status: 'INACTIVE', publicationStatus: 'INACTIVE' } : {}),
          stockQuantity: targetQuantity,
          quantity: targetQuantity,
          syncStatus: 'PENDING',
          syncSource: this.buildWarehouseSyncSource(event, targetQuantity),
          syncError: null,
        },
      });
      const attempt = await this.createWarehouseAttempt(offer, event, targetQuantity);
      if (attempt.status === 'BLOCKED') {
        this.logger.warn(`Warehouse stock sync blocked for Allegro offer ${offer.allegroOfferId}`, 'StockEventsSubscriber');
        continue;
      }
      await this.sleep(this.rateLimitMs);
      await this.executeWarehouseAttempt(attempt.id);
    }
    return { status: 'processed', productId, targetQuantity, offersProcessed: offers.length };
  }

  private buildWarehouseSyncSource(event: WarehouseStockEvent, targetQuantity: number): string {
    if (event.type === 'stock.out') return 'WAREHOUSE_STOCK_OUT';
    if (targetQuantity === 0) return 'WAREHOUSE_ZERO_AVAILABLE';
    return 'WAREHOUSE_STOCK_UPDATED';
  }

  private async createWarehouseAttempt(offer: any, event: WarehouseStockEvent, targetQuantity: number) {
    const prismaAny = this.prisma as any;
    const previousQuantity = Number(offer.stockQuantity ?? offer.quantity ?? 0);
    const commandPayload = {
      contractVersion: 'allegro.quantity-command.v1',
      allegroOfferId: offer.allegroOfferId,
      previousQuantity,
      targetQuantity,
      mutation: 'WAREHOUSE_STOCK_TO_ALLEGRO_QUANTITY_COMMAND',
      trigger: event.type,
      mutatesAllegro: true,
      mutatesWarehouse: false,
      mutatesCatalog: false,
      warehouseOwnershipPreserved: true,
      outOfStockRemovesFromSaleSurface: targetQuantity === 0,
    };
    const idempotencyKey = this.buildIdempotencyKey(offer, event, commandPayload);
    const existing = await prismaAny.allegroQuantityCommandAttempt.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    const blockedReasons = this.evaluateBlockedReasons(offer, targetQuantity);
    const now = new Date();
    return prismaAny.allegroQuantityCommandAttempt.create({
      data: {
        status: blockedReasons.length ? 'BLOCKED' : 'QUEUED',
        idempotencyKey,
        requestedByUserId: offer.account?.userId || 'warehouse-stock-orchestrator',
        accountId: offer.accountId,
        offerId: offer.id,
        allegroOfferId: offer.allegroOfferId,
        catalogProductId: offer.catalogProductId || null,
        previousQuantity,
        targetQuantity,
        commandPayload,
        policySnapshot: {
          contractVersion: 'allegro.warehouse-stock-orchestration.v1',
          sourceOfTruth: 'warehouse',
          triggers: ['stock.updated', 'stock.out'],
          triggerReceived: event.type,
          warehouseEventId: event.eventId || null,
          warehouseProductId: event.productId,
          approvalRequired: false,
          approvalMode: 'automatic_execute',
          automaticExecutionApproved: true,
          rateLimit: { scope: 'allegro-account', minIntervalMs: this.rateLimitMs, maxRequestsPerSecond: this.rateLimitMs >= 1000 ? 1 : null },
          zeroQuantityPolicy: 'set_local_offer_inactive_and_set_allegro_offer_quantity_to_0_so_offer_is_not_sellable',
          localProjectionDisabled: targetQuantity === 0,
          oversellPrevention: 'warehouse_decrement_event_fans_out_to_all_sales_channels',
        },
        blockedReasons,
        confirmedAt: blockedReasons.length ? null : now,
        queuedAt: blockedReasons.length ? null : now,
      },
    });
  }

  private async executeWarehouseAttempt(attemptId: string) {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroQuantityCommandAttempt.findUnique({
      where: { id: attemptId },
      include: { account: { select: { accessToken: true } } },
    });
    if (!attempt || attempt.status === 'BLOCKED' || (TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) return attempt;
    const commandId = attempt.commandId || this.buildCommandId(attempt);
    await prismaAny.allegroQuantityCommandAttempt.update({
      where: { id: attempt.id },
      data: { status: 'RUNNING', commandId, startedAt: new Date() },
    });
    try {
      const accessToken = this.decryptToken(attempt.account?.accessToken);
      const submitted = await this.submitQuantityCommand(accessToken, commandId, attempt.allegroOfferId, attempt.targetQuantity);
      await prismaAny.allegroQuantityCommandAttempt.update({
        where: { id: attempt.id },
        data: { commandResponse: this.redact({ submittedAt: new Date().toISOString(), submitted }) },
      });
      for (let index = 0; index < this.pollAttempts; index += 1) {
        await this.sleep(this.rateLimitMs);
        const summary = await this.fetchAllegro(accessToken, `/sale/offer-quantity-change-commands/${commandId}`);
        await this.sleep(this.rateLimitMs);
        const tasks = await this.fetchAllegro(accessToken, `/sale/offer-quantity-change-commands/${commandId}/tasks?limit=100&offset=0`);
        const terminal = this.deriveTerminalStatus(summary, tasks);
        if (terminal === 'RUNNING') {
          await prismaAny.allegroQuantityCommandAttempt.update({
            where: { id: attempt.id },
            data: { commandResponse: this.redact({ submitted, summary, tasks, polledAt: new Date().toISOString() }) },
          });
          continue;
        }
        const data: any = {
          status: terminal,
          completedAt: new Date(),
          commandResponse: this.redact({ submitted, summary, tasks, polledAt: new Date().toISOString() }),
        };
        if (terminal === 'FAILED') {
          data.failureContext = this.redact({ code: 'QUANTITY_COMMAND_FAILED', message: 'Allegro quantity command reported failed task status', details: { summary, tasks } });
          data.remediationContext = { nextAction: 'Review Allegro command task errors, account rate limits, and current Warehouse stock event before retry.' };
        }
        const updated = await prismaAny.allegroQuantityCommandAttempt.update({ where: { id: attempt.id }, data });
        if (terminal === 'SUCCEEDED') {
          await prismaAny.allegroOffer.update({
            where: { id: attempt.offerId },
            data: { stockQuantity: attempt.targetQuantity, quantity: attempt.targetQuantity, syncStatus: 'SYNCED', syncError: null, lastSyncedAt: new Date() },
          });
        }
        return updated;
      }
      return prismaAny.allegroQuantityCommandAttempt.findUnique({ where: { id: attempt.id } });
    } catch (error: any) {
      await prismaAny.allegroOffer.update({
        where: { id: attempt.offerId },
        data: { syncStatus: 'ERROR', syncError: error?.message || 'Warehouse stock sync failed' },
      });
      return prismaAny.allegroQuantityCommandAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          failureContext: this.redact({ code: error?.response?.status || error?.code || 'WAREHOUSE_STOCK_SYNC_FAILED', message: error?.message || 'Warehouse stock sync failed', details: error?.response?.data || null }),
          remediationContext: { nextAction: 'Review Warehouse event, OAuth token/account state, Allegro command status, and retry with Warehouse as source of truth.' },
        },
      });
    }
  }

  private async claimEvent(event: WarehouseStockEvent, eventType: string, productId?: string): Promise<EventClaim> {
    const eventId = this.buildLedgerEventId('WAREHOUSE', event, eventType, productId);
    const prismaAny = this.prisma as any;
    const existing = await prismaAny.webhookEvent.findUnique({ where: { eventId } });
    if (existing) return { eventId, skip: true };
    await prismaAny.webhookEvent.create({
      data: {
        eventId,
        eventType,
        source: 'WAREHOUSE',
        payload: this.redact(event),
        processed: false,
      },
    });
    return { eventId, skip: false };
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    await (this.prisma as any).webhookEvent.update({
      where: { eventId },
      data: { processed: true, processedAt: new Date(), processingError: null },
    });
  }

  private async markEventFailed(eventId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await (this.prisma as any).webhookEvent.update({
      where: { eventId },
      data: { processingError: message, retryCount: { increment: 1 } },
    });
  }

  private buildLedgerEventId(source: 'WAREHOUSE', event: WarehouseStockEvent, eventType: string, productId?: string): string {
    const rawEventId = event.eventId || event.messageId || event.metadata?.eventId || event.payload?.eventId || event.id || null;
    const candidate = rawEventId
      ? `${source}:${rawEventId}`
      : `${source}:derived:${createHash('sha256').update(this.stableStringify({ eventType, productId, event })).digest('hex').slice(0, 64)}`;
    if (candidate.length <= 255) return candidate;
    return `${source}:sha256:${createHash('sha256').update(candidate).digest('hex')}`;
  }

  private requireAvailable(event: WarehouseStockEvent): number {
    const value = Number(event.available);
    if (!Number.isInteger(value) || value < 0) throw new Error(`stock.updated requires non-negative integer available, got ${event.available}`);
    return value;
  }

  private evaluateBlockedReasons(offer: any, targetQuantity: number): any[] {
    const blocked: any[] = [];
    if (!offer.accountId || !offer.account) blocked.push({ gate: 'allegro-account', reason: 'Offer has no Allegro account for automatic Warehouse stock sync' });
    if (!offer.account?.isActive) blocked.push({ gate: 'active-account', reason: 'Offer account is not active' });
    if (!offer.account?.accessToken) blocked.push({ gate: 'oauth-token', reason: 'Offer account has no OAuth access token' });
    if (!offer.allegroOfferId) blocked.push({ gate: 'allegro-offer-id', reason: 'Offer has no Allegro offer id' });
    if (!Number.isInteger(targetQuantity) || targetQuantity < 0) blocked.push({ gate: 'target-quantity', reason: 'Target quantity must be non-negative integer' });
    return blocked;
  }

  private async submitQuantityCommand(accessToken: string, commandId: string, allegroOfferId: string, quantity: number): Promise<any> {
    return this.fetchAllegro(accessToken, `/sale/offer-quantity-change-commands/${commandId}`, {
      method: 'PUT',
      body: JSON.stringify({
        modification: { changeType: 'FIXED', value: quantity },
        offerCriteria: [{ offers: [{ id: allegroOfferId }] }],
      }),
    });
  }

  private async fetchAllegro(accessToken: string, endpoint: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.allegro.public.v1+json',
        'Content-Type': 'application/vnd.allegro.public.v1+json',
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error: any = new Error(`Allegro API request failed: ${response.status}`);
      error.response = { status: response.status, data: body };
      throw error;
    }
    return body || { accepted: true, status: response.status };
  }

  private deriveTerminalStatus(summary: any, tasks: any): 'RUNNING' | 'SUCCEEDED' | 'FAILED' {
    const taskItems = Array.isArray(tasks?.tasks) ? tasks.tasks : Array.isArray(tasks) ? tasks : [];
    const statusTexts = [summary?.status, summary?.taskCount?.failed ? 'FAILED' : undefined, ...taskItems.map((task: any) => task.status || task.result?.status)]
      .filter(Boolean)
      .map((value: any) => String(value).toUpperCase());
    if (statusTexts.some((status) => ['FAIL', 'FAILED', 'ERROR'].includes(status))) return 'FAILED';
    if (statusTexts.length > 0 && statusTexts.every((status) => ['SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(status))) return 'SUCCEEDED';
    return 'RUNNING';
  }

  private decryptToken(encryptedText: string | null | undefined): string {
    if (!encryptedText) throw new Error('OAuth access token is missing for automatic Warehouse stock sync');
    if (!this.encryptionKey || this.encryptionKey.length < 32) throw new Error('ENCRYPTION_KEY is not configured for OAuth token decrypt');
    const parts = String(encryptedText).split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted OAuth token format');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32), 'utf8'), Buffer.from(parts[0], 'hex'));
    return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
  }

  private buildIdempotencyKey(offer: any, event: WarehouseStockEvent, commandPayload: unknown): string {
    return `alg-qty-wh-${createHash('sha256').update(this.stableStringify({ eventId: event.eventId || event.occurredAt || null, productId: event.productId, offerId: offer.id, allegroOfferId: offer.allegroOfferId, commandPayload })).digest('hex').slice(0, 48)}`;
  }

  private buildCommandId(attempt: any): string {
    return `qty-${createHash('sha256').update(`${attempt.idempotencyKey}:${attempt.id}`).digest('hex').slice(0, 32)}`;
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortJson(value));
  }

  private sortJson(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.sortJson(item));
    if (!value || typeof value !== 'object') return value;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) sorted[key] = this.sortJson(value[key]);
    return sorted;
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        const lowerKey = key.toLowerCase();
        if (SECRET_KEYS.some((secretKey) => lowerKey.includes(secretKey.toLowerCase()))) return [key, '[REDACTED]'];
        return [key, this.redact(item)];
      }));
    }
    return value;
  }

  private sleep(ms: number): Promise<void> {
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }
}
