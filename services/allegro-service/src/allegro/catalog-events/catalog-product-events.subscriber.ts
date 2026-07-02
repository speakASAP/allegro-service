import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { createHash } from 'crypto';
import { LoggerService, PrismaService } from '@allegro/shared';

type CatalogProductEvent = {
  type?: string;
  eventType?: string;
  eventId?: string;
  id?: string;
  messageId?: string;
  catalogProductId?: string;
  productId?: string;
  occurredAt?: string;
  afterSellable?: boolean;
  beforeSellable?: boolean;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  product?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  data?: Record<string, any>;
  [key: string]: unknown;
};

type EventClaim = {
  eventId: string;
  skip: boolean;
};

type DisableReason = 'CATALOG_ARCHIVED' | 'CATALOG_DELETED' | 'CATALOG_NOT_SELLABLE';

const CATALOG_AVAILABILITY_EVENT_TYPES = [
  'catalog.product.archived.v1',
  'catalog.product.deleted.v1',
  'catalog.product.sellability_changed.v1',
] as const;

const CATALOG_REFRESH_EVENT_TYPES = [
  'catalog.product.upserted.v1',
  'catalog.product.updated.v1',
  'catalog.product.category_changed.v1',
] as const;

const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];

@Injectable()
export class CatalogProductEventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = process.env.CATALOG_EVENTS_EXCHANGE || 'catalog.events';
  private readonly queueName = process.env.CATALOG_EVENTS_QUEUE || 'catalog.allegro-service';
  private readonly routingKeys = this.parseRoutingKeys(process.env.CATALOG_EVENTS_ROUTING_KEYS);
  private readonly missingDeactivatePolicy = '[MISSING: Allegro live offer deactivate endpoint/policy confirmation]';
  private readonly missingRefreshPolicy = '[MISSING: Allegro safe catalog-event refresh policy]';

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
      this.logger.warn(`Error closing Catalog RabbitMQ connection: ${errorMessage}`, 'CatalogProductEventsSubscriber');
    }
  }

  private async connect() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@statex_rabbitmq:5672';
      this.logger.log(`Connecting to RabbitMQ catalog events: ${url}`, 'CatalogProductEventsSubscriber');
      const conn = await amqp.connect(url);
      this.connection = conn;
      const ch = await this.connection.createChannel();
      this.channel = ch as unknown as amqp.Channel;
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      await this.channel.assertQueue(this.queueName, { durable: true });
      for (const routingKey of this.routingKeys) {
        await this.channel.bindQueue(this.queueName, this.exchangeName, routingKey);
      }
      this.logger.log('Connected to RabbitMQ and subscribed to Catalog product availability events', {
        exchangeName: this.exchangeName,
        queueName: this.queueName,
        routingKeys: this.routingKeys,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to connect to Catalog RabbitMQ events: ${errorMessage}`, errorStack, 'CatalogProductEventsSubscriber');
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
            await this.handleCatalogProductEvent(event, msg.fields.routingKey);
            this.channel?.ack(msg);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error processing Catalog product event: ${errorMessage}`, errorStack, 'CatalogProductEventsSubscriber');
            this.channel?.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
      this.logger.log('Subscribed to Catalog product events queue', 'CatalogProductEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to subscribe to Catalog product events: ${errorMessage}`, errorStack, 'CatalogProductEventsSubscriber');
    }
  }

  async handleCatalogProductEvent(event: CatalogProductEvent, routingKey?: string): Promise<any> {
    const eventType = this.extractEventType(event, routingKey);
    const catalogProductId = this.extractCatalogProductId(event);
    const claim = await this.claimEvent(event, eventType, catalogProductId);

    if (claim.skip) {
      this.logger.log('Skipping duplicate Catalog product event', { eventId: claim.eventId, eventType, catalogProductId });
      return { status: 'duplicate', eventId: claim.eventId, eventType, catalogProductId };
    }

    try {
      let result: any;
      if (!catalogProductId) {
        this.logger.warn(`Ignoring Catalog product event without product id: ${JSON.stringify(this.redact(event))}`, 'CatalogProductEventsSubscriber');
        result = { status: 'ignored', reason: 'missing_catalog_product_id', eventId: claim.eventId, eventType };
      } else if (eventType === 'catalog.product.sellability_changed.v1' && this.extractAfterSellable(event) !== false) {
        result = { status: 'ignored', reason: 'sellability_after_state_is_not_false', eventId: claim.eventId, eventType, catalogProductId };
      } else if ((CATALOG_AVAILABILITY_EVENT_TYPES as readonly string[]).includes(eventType)) {
        result = await this.disableOffersForCatalogEvent(catalogProductId, eventType, claim.eventId, event);
      } else if ((CATALOG_REFRESH_EVENT_TYPES as readonly string[]).includes(eventType)) {
        this.logger.warn(`${this.missingRefreshPolicy}; ignoring refresh event ${eventType}`, 'CatalogProductEventsSubscriber');
        result = { status: 'ignored', reason: this.missingRefreshPolicy, eventId: claim.eventId, eventType, catalogProductId };
      } else {
        result = { status: 'ignored', reason: 'unsupported_catalog_event_type', eventId: claim.eventId, eventType, catalogProductId };
      }

      await this.markEventProcessed(claim.eventId);
      return result;
    } catch (error: unknown) {
      await this.markEventFailed(claim.eventId, error);
      throw error;
    }
  }

  private async disableOffersForCatalogEvent(
    catalogProductId: string,
    eventType: string,
    eventId: string,
    event: CatalogProductEvent,
  ): Promise<any> {
    const prismaAny = this.prisma as any;
    const offers = await prismaAny.allegroOffer.findMany({
      where: { catalogProductId },
      include: { account: { select: { id: true, userId: true, isActive: true } } },
    });

    if (offers.length === 0) {
      this.logger.log(`No Allegro offers found for Catalog product ${catalogProductId}`, 'CatalogProductEventsSubscriber');
      return { status: 'no_matching_offers', eventId, eventType, catalogProductId, disabledOffers: 0, blockedEndAttempts: 0 };
    }

    const reason = this.toDisableReason(eventType);
    let disabledOffers = 0;
    let blockedEndAttempts = 0;
    let auditLogs = 0;
    const updatedOfferIds: string[] = [];

    for (const offer of offers) {
      const beforeHash = this.hashProjection(offer);
      const updated = await prismaAny.allegroOffer.update({
        where: { id: offer.id },
        data: {
          status: 'INACTIVE',
          publicationStatus: 'INACTIVE',
          stockQuantity: 0,
          quantity: 0,
          syncStatus: 'PENDING',
          syncSource: reason,
          syncError: this.missingDeactivatePolicy,
          lastSyncedAt: new Date(),
        },
      });
      disabledOffers += 1;
      updatedOfferIds.push(offer.id);

      if (offer.accountId) {
        await prismaAny.allegroProjectionAuditLog.create({
          data: {
            accountId: offer.accountId,
            entityType: 'ALLEGRO_OFFER',
            entityId: offer.id,
            externalId: offer.allegroOfferId || null,
            action: reason,
            beforeHash,
            afterHash: this.hashProjection(updated),
            diffSummary: {
              catalogProductId,
              eventType,
              eventId,
              localProjection: {
                status: 'INACTIVE',
                publicationStatus: 'INACTIVE',
                stockQuantity: 0,
                quantity: 0,
              },
            },
            redactedContext: this.redact({
              source: 'CATALOG',
              event,
              missingDeactivatePolicy: this.missingDeactivatePolicy,
            }),
            idempotencyKey: this.buildAuditIdempotencyKey(eventId, offer.id, reason),
          },
        });
        auditLogs += 1;
      }

      const attempt = await this.createBlockedEndAttempt(offer, catalogProductId, eventType, eventId, reason);
      if (attempt?.created) blockedEndAttempts += 1;
    }

    this.logger.warn('Catalog product availability event disabled local Allegro offers', {
      eventId,
      eventType,
      catalogProductId,
      disabledOffers,
      blockedEndAttempts,
      auditLogs,
      missingDeactivatePolicy: this.missingDeactivatePolicy,
    });

    return {
      status: 'processed',
      eventId,
      eventType,
      catalogProductId,
      disabledOffers,
      blockedEndAttempts,
      auditLogs,
      updatedOfferIds,
      missingDeactivatePolicy: this.missingDeactivatePolicy,
    };
  }

  private async createBlockedEndAttempt(
    offer: any,
    catalogProductId: string,
    eventType: string,
    eventId: string,
    reason: DisableReason,
  ): Promise<{ created: boolean; attempt: any }> {
    const prismaAny = this.prisma as any;
    const idempotencyKey = this.buildEndAttemptIdempotencyKey(eventId, offer.id, reason);
    const existing = await prismaAny.allegroPublishAttempt.findUnique({ where: { idempotencyKey } });
    if (existing) return { created: false, attempt: existing };

    const now = new Date();
    const blockedReasons = [
      { gate: 'allegro-live-deactivate-policy', reason: this.missingDeactivatePolicy },
      { gate: 'safe-dry-run', reason: 'No safe dry-run END/deactivate abstraction is wired for Catalog availability events.' },
    ];

    const attempt = await prismaAny.allegroPublishAttempt.create({
      data: {
        action: 'END',
        status: 'BLOCKED',
        idempotencyKey,
        requestedByUserId: 'catalog-product-events-subscriber',
        accountId: offer.accountId || null,
        catalogProductId,
        offerId: offer.id,
        allegroOfferId: offer.allegroOfferId || null,
        commandPayload: {
          contractVersion: 'allegro.catalog-availability-event.v1',
          trigger: eventType,
          eventId,
          reason,
          requestedExternalAction: 'END_OR_DEACTIVATE_OFFER',
          localProjectionDisabled: true,
          mutatesAllegro: false,
          mutatesCatalog: false,
          mutatesWarehouse: false,
        },
        policySnapshot: {
          contractVersion: 'allegro.catalog-availability-event-policy.v1',
          sourceOfTruth: 'catalog',
          trigger: eventType,
          eventId,
          catalogProductId,
          localProjectionAction: 'mark_offer_inactive_quantity_zero',
          externalActionPolicy: this.missingDeactivatePolicy,
          blockers: blockedReasons,
        },
        blockedReasons,
        preparedAt: now,
        staleAt: this.addHours(now, 24),
      },
    });

    return { created: true, attempt };
  }

  private async claimEvent(event: CatalogProductEvent, eventType: string, catalogProductId?: string): Promise<EventClaim> {
    const eventId = this.buildLedgerEventId('CATALOG', event, eventType, catalogProductId);
    const prismaAny = this.prisma as any;
    const existing = await prismaAny.webhookEvent.findUnique({ where: { eventId } });
    if (existing) return { eventId, skip: true };

    await prismaAny.webhookEvent.create({
      data: {
        eventId,
        eventType,
        source: 'CATALOG',
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

  private extractEventType(event: CatalogProductEvent, routingKey?: string): string {
    return String(event.type || event.eventType || event.payload?.type || event.payload?.eventType || routingKey || 'unknown');
  }

  private extractCatalogProductId(event: CatalogProductEvent): string | undefined {
    const payload = event.payload || {};
    const product = event.product || {};
    const before = event.before || {};
    const after = event.after || {};
    const data = event.data || {};
    const dataProduct = data.product || {};
    const candidates = [
      event.catalogProductId,
      event.productId,
      payload.catalogProductId,
      payload.productId,
      product.id,
      after.id,
      before.id,
      data.catalogProductId,
      data.productId,
      dataProduct.id,
    ];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.length > 0);
    return value ? String(value) : undefined;
  }

  private extractAfterSellable(event: CatalogProductEvent): boolean | undefined {
    const payload = event.payload || {};
    const after = event.after || {};
    const product = event.product || {};
    const data = event.data || {};
    const dataChange = data.change || {};
    const dataProduct = data.product || {};
    const candidates = [
      event.afterSellable,
      payload.afterSellable,
      after.sellable,
      after.isSellable,
      product.sellable,
      product.isSellable,
      data.afterSellable,
      dataChange.afterSellable,
      dataProduct.sellable,
      dataProduct.isSellable,
      typeof dataProduct.isActive === 'boolean' ? dataProduct.isActive : undefined,
    ];
    const value = candidates.find((candidate) => typeof candidate === 'boolean');
    return typeof value === 'boolean' ? value : undefined;
  }

  private toDisableReason(eventType: string): DisableReason {
    if (eventType === 'catalog.product.archived.v1') return 'CATALOG_ARCHIVED';
    if (eventType === 'catalog.product.deleted.v1') return 'CATALOG_DELETED';
    return 'CATALOG_NOT_SELLABLE';
  }

  private buildLedgerEventId(source: 'CATALOG', event: CatalogProductEvent, eventType: string, catalogProductId?: string): string {
    const rawEventId =
      event.eventId ||
      event.messageId ||
      event.metadata?.eventId ||
      event.payload?.eventId ||
      event.id ||
      null;
    const candidate = rawEventId
      ? `${source}:${rawEventId}`
      : `${source}:derived:${createHash('sha256').update(this.stableStringify({ eventType, catalogProductId, event })).digest('hex').slice(0, 64)}`;
    if (candidate.length <= 255) return candidate;
    return `${source}:sha256:${createHash('sha256').update(candidate).digest('hex')}`;
  }

  private buildEndAttemptIdempotencyKey(eventId: string, offerId: string, reason: DisableReason): string {
    return `alg-cat-end-${createHash('sha256').update(this.stableStringify({ eventId, offerId, reason })).digest('hex').slice(0, 48)}`;
  }

  private buildAuditIdempotencyKey(eventId: string, offerId: string, reason: DisableReason): string {
    return `alg-cat-audit-${createHash('sha256').update(this.stableStringify({ eventId, offerId, reason })).digest('hex').slice(0, 48)}`;
  }

  private hashProjection(value: unknown): string {
    return `sha256:${createHash('sha256').update(this.stableStringify(value)).digest('hex')}`;
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

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private parseRoutingKeys(value?: string): string[] {
    const parsed = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : [...CATALOG_AVAILABILITY_EVENT_TYPES];
  }
}
