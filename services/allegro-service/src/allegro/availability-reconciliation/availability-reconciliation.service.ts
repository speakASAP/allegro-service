import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CatalogClientService, LoggerService, PrismaService, WarehouseClientService } from '@allegro/shared';

export type AvailabilityReconciliationMode = 'dry-run' | 'apply';

export type AvailabilityDisableReason =
  | 'CATALOG_MISSING'
  | 'CATALOG_ARCHIVED'
  | 'CATALOG_DELETED'
  | 'CATALOG_INACTIVE'
  | 'CATALOG_NOT_SELLABLE'
  | 'WAREHOUSE_ZERO_AVAILABLE';

export type AvailabilityReconciliationOptions = {
  mode?: AvailabilityReconciliationMode;
  catalogProductIds?: string[];
  limit?: number;
};

type AuthorityDecision = {
  catalogProductId: string;
  catalogStatus: 'found' | 'missing' | 'unavailable';
  warehouseAvailable: number | null;
  disableReason: AvailabilityDisableReason | null;
  evidence: Record<string, unknown>;
};

const SELLABLE_STATUS_VALUES = ['ACTIVE', 'ACTIVATING', 'PUBLISHED', 'SELLABLE', 'READY'];
const INACTIVE_STATUS_VALUES = ['INACTIVE', 'DISABLED', 'DRAFT', 'BLOCKED', 'SUSPENDED'];
const ARCHIVED_STATUS_VALUES = ['ARCHIVED'];
const DELETED_STATUS_VALUES = ['DELETED', 'REMOVED'];
const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];

@Injectable()
export class AvailabilityReconciliationService {
  private readonly missingDeactivatePolicy = '[MISSING: Allegro live offer deactivate endpoint/policy confirmation]';

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogClient: CatalogClientService,
    private readonly warehouseClient: WarehouseClientService,
    private readonly logger: LoggerService,
  ) {}

  async reconcile(options: AvailabilityReconciliationOptions = {}): Promise<any> {
    const mode = options.mode || 'dry-run';
    const limit = this.normalizeLimit(options.limit);
    const catalogProductIds = this.uniqueIds(options.catalogProductIds || []);
    const offers = await this.findCandidateOffers(catalogProductIds, limit);
    const grouped = this.groupByCatalogProductId(offers);

    const result = {
      status: 'ok',
      mode,
      scannedOffers: offers.length,
      scannedCatalogProducts: grouped.size,
      disabledOffers: 0,
      wouldDisableOffers: 0,
      unchangedOffers: 0,
      auditLogsCreated: 0,
      blockedEndAttemptsCreated: 0,
      skippedOffers: 0,
      missingDeactivatePolicy: this.missingDeactivatePolicy,
      catalogProductIds: Array.from(grouped.keys()),
      decisions: [] as any[],
    };

    for (const [catalogProductId, productOffers] of grouped.entries()) {
      const authority = await this.resolveAuthority(catalogProductId);
      const decision: any = {
        catalogProductId,
        authority,
        offers: [],
      };

      for (const offer of productOffers) {
        if (!this.isInternallySellableOffer(offer)) {
          result.skippedOffers += 1;
          decision.offers.push(this.offerDecision(offer, 'skipped_not_internally_sellable', authority));
          continue;
        }

        if (!authority.disableReason) {
          result.unchangedOffers += 1;
          decision.offers.push(this.offerDecision(offer, 'unchanged_authority_sellable', authority));
          continue;
        }

        if (mode === 'dry-run') {
          result.wouldDisableOffers += 1;
          decision.offers.push(this.offerDecision(offer, 'would_disable_local_projection', authority));
          continue;
        }

        const applied = await this.disableLocalOffer(offer, authority);
        result.disabledOffers += applied.disabled ? 1 : 0;
        result.auditLogsCreated += applied.auditCreated ? 1 : 0;
        result.blockedEndAttemptsCreated += applied.blockedEndAttemptCreated ? 1 : 0;
        decision.offers.push({
          ...this.offerDecision(offer, applied.disabled ? 'disabled_local_projection' : 'already_disabled', authority),
          auditCreated: applied.auditCreated,
          blockedEndAttemptCreated: applied.blockedEndAttemptCreated,
        });
      }

      result.decisions.push(decision);
    }

    if (mode === 'apply' && result.disabledOffers > 0) {
      this.logger.warn('Availability reconciliation fail-closed local Allegro offers', {
        disabledOffers: result.disabledOffers,
        scannedCatalogProducts: result.scannedCatalogProducts,
        blockedEndAttemptsCreated: result.blockedEndAttemptsCreated,
        missingDeactivatePolicy: this.missingDeactivatePolicy,
      });
    }

    return result;
  }

  private async findCandidateOffers(catalogProductIds: string[], limit: number): Promise<any[]> {
    const where: any = {
      catalogProductId: catalogProductIds.length ? { in: catalogProductIds } : { not: null },
      OR: [
        { status: { in: SELLABLE_STATUS_VALUES } },
        { publicationStatus: { in: SELLABLE_STATUS_VALUES } },
        { quantity: { gt: 0 } },
        { stockQuantity: { gt: 0 } },
      ],
    };

    return (this.prisma as any).allegroOffer.findMany({
      where,
      include: { account: { select: { id: true, userId: true, isActive: true } } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }

  private async resolveAuthority(catalogProductId: string): Promise<AuthorityDecision> {
    const catalog = await this.resolveCatalogAuthority(catalogProductId);
    if (catalog.disableReason || catalog.catalogStatus !== 'found') {
      return {
        catalogProductId,
        catalogStatus: catalog.catalogStatus,
        warehouseAvailable: null,
        disableReason: catalog.disableReason,
        evidence: catalog.evidence,
      };
    }

    const warehouseAvailable = await this.warehouseClient.getTotalAvailable(catalogProductId);
    const disableReason = warehouseAvailable <= 0 ? 'WAREHOUSE_ZERO_AVAILABLE' : null;
    return {
      catalogProductId,
      catalogStatus: 'found',
      warehouseAvailable,
      disableReason,
      evidence: {
        ...catalog.evidence,
        warehouse: {
          available: warehouseAvailable,
          authority: 'warehouse-microservice',
          staleWhen: 'available <= 0',
        },
      },
    };
  }

  private async resolveCatalogAuthority(catalogProductId: string): Promise<AuthorityDecision> {
    try {
      const product = this.unwrapData(await this.catalogClient.getProductById(catalogProductId));
      if (!product) {
        return this.catalogDecision(catalogProductId, 'missing', 'CATALOG_MISSING', { productFound: false });
      }

      const disabledByState = this.catalogDisableReason(product);
      return this.catalogDecision(catalogProductId, 'found', disabledByState, {
        productFound: true,
        productState: this.redact({
          id: product.id || catalogProductId,
          status: product.status || product.lifecycleStatus || product.state || null,
          publicationStatus: product.publicationStatus || null,
          isActive: product.isActive,
          active: product.active,
          sellable: product.sellable,
          isSellable: product.isSellable,
          availableForSale: product.availableForSale,
          archivedAt: product.archivedAt || null,
          deletedAt: product.deletedAt || null,
        }),
      });
    } catch (error: any) {
      const status = error?.getStatus?.() || error?.status || error?.response?.status || null;
      if (status === 503) {
        return this.catalogDecision(catalogProductId, 'unavailable', null, {
          productFound: false,
          authorityUnavailable: true,
          message: 'Catalog authority unavailable; reconciliation skipped for this product.',
        });
      }
      return this.catalogDecision(catalogProductId, 'missing', 'CATALOG_MISSING', {
        productFound: false,
        message: error?.message || 'Catalog product lookup failed.',
        httpStatus: status,
      });
    }
  }

  private catalogDecision(
    catalogProductId: string,
    catalogStatus: 'found' | 'missing' | 'unavailable',
    disableReason: AvailabilityDisableReason | null,
    evidence: Record<string, unknown>,
  ): AuthorityDecision {
    return {
      catalogProductId,
      catalogStatus,
      warehouseAvailable: null,
      disableReason,
      evidence: {
        catalog: {
          ...evidence,
          authority: 'catalog-microservice',
          staleWhen: 'missing, inactive, archived, deleted, or non-sellable',
        },
      },
    };
  }

  private catalogDisableReason(product: any): AvailabilityDisableReason | null {
    const status = this.upper(product.status || product.lifecycleStatus || product.state || product.publicationStatus);
    if (Boolean(product.deletedAt || product.isDeleted || product.deleted) || DELETED_STATUS_VALUES.includes(status)) return 'CATALOG_DELETED';
    if (Boolean(product.archivedAt || product.isArchived || product.archived) || ARCHIVED_STATUS_VALUES.includes(status)) return 'CATALOG_ARCHIVED';
    if (this.firstBoolean(product.isActive, product.active, product.enabled) === false || INACTIVE_STATUS_VALUES.includes(status)) return 'CATALOG_INACTIVE';
    if (this.firstBoolean(product.sellable, product.isSellable, product.availableForSale, product.canSell, product.marketplaceSellable) === false) return 'CATALOG_NOT_SELLABLE';
    return null;
  }

  private async disableLocalOffer(offer: any, authority: AuthorityDecision): Promise<{ disabled: boolean; auditCreated: boolean; blockedEndAttemptCreated: boolean }> {
    if (!this.isInternallySellableOffer(offer)) return { disabled: false, auditCreated: false, blockedEndAttemptCreated: false };
    const reason = authority.disableReason;
    if (!reason) return { disabled: false, auditCreated: false, blockedEndAttemptCreated: false };

    const prismaAny = this.prisma as any;
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

    const auditCreated = offer.accountId ? await this.createAuditLogIfNeeded(offer, updated, authority, beforeHash) : false;
    const blockedEndAttemptCreated = await this.createBlockedEndAttemptIfNeeded(offer, authority);
    return { disabled: true, auditCreated, blockedEndAttemptCreated };
  }

  private async createAuditLogIfNeeded(offer: any, updated: any, authority: AuthorityDecision, beforeHash: string): Promise<boolean> {
    const reason = authority.disableReason as AvailabilityDisableReason;
    const prismaAny = this.prisma as any;
    const idempotencyKey = this.buildAuditIdempotencyKey(offer.id, authority.catalogProductId, reason);
    const existing = await prismaAny.allegroProjectionAuditLog.findFirst({ where: { idempotencyKey } });
    if (existing) return false;

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
          catalogProductId: authority.catalogProductId,
          reconciliation: 'availability-safety-net',
          authority: authority.evidence,
          localProjection: {
            status: 'INACTIVE',
            publicationStatus: 'INACTIVE',
            stockQuantity: 0,
            quantity: 0,
          },
        },
        redactedContext: this.redact({
          source: 'ALLEGRO_AVAILABILITY_RECONCILIATION',
          reason,
          missingDeactivatePolicy: this.missingDeactivatePolicy,
        }),
        idempotencyKey,
      },
    });
    return true;
  }

  private async createBlockedEndAttemptIfNeeded(offer: any, authority: AuthorityDecision): Promise<boolean> {
    const reason = authority.disableReason as AvailabilityDisableReason;
    const prismaAny = this.prisma as any;
    const idempotencyKey = this.buildEndAttemptIdempotencyKey(offer.id, authority.catalogProductId, reason);
    const existing = await prismaAny.allegroPublishAttempt.findUnique({ where: { idempotencyKey } });
    if (existing) return false;

    const now = new Date();
    const blockedReasons = [
      { gate: 'allegro-live-deactivate-policy', reason: this.missingDeactivatePolicy },
      { gate: 'safe-local-only-reconciliation', reason: 'Availability reconciliation may fail-close local projection but must not mutate live Allegro offers in this lane.' },
    ];

    await prismaAny.allegroPublishAttempt.create({
      data: {
        action: 'END',
        status: 'BLOCKED',
        idempotencyKey,
        requestedByUserId: 'availability-reconciliation-safety-net',
        accountId: offer.accountId || null,
        catalogProductId: authority.catalogProductId,
        offerId: offer.id,
        allegroOfferId: offer.allegroOfferId || null,
        commandPayload: {
          contractVersion: 'allegro.availability-reconciliation.v1',
          trigger: 'manual_or_periodic_reconciliation',
          reason,
          requestedExternalAction: 'END_OR_DEACTIVATE_OFFER',
          localProjectionDisabled: true,
          mutatesAllegro: false,
          mutatesCatalog: false,
          mutatesWarehouse: false,
          authority: authority.evidence,
        },
        policySnapshot: {
          contractVersion: 'allegro.availability-reconciliation-policy.v1',
          sourceOfTruth: ['catalog', 'warehouse'],
          catalogProductId: authority.catalogProductId,
          localProjectionAction: 'mark_offer_inactive_quantity_zero',
          externalActionPolicy: this.missingDeactivatePolicy,
          blockers: blockedReasons,
        },
        blockedReasons,
        preparedAt: now,
        staleAt: this.addHours(now, 24),
      },
    });
    return true;
  }

  private offerDecision(offer: any, action: string, authority: AuthorityDecision): Record<string, unknown> {
    return {
      offerId: offer.id,
      allegroOfferId: offer.allegroOfferId || null,
      accountId: offer.accountId || null,
      action,
      disableReason: authority.disableReason,
      before: {
        status: offer.status,
        publicationStatus: offer.publicationStatus,
        quantity: offer.quantity,
        stockQuantity: offer.stockQuantity,
        syncStatus: offer.syncStatus,
      },
    };
  }

  private isInternallySellableOffer(offer: any): boolean {
    const status = this.upper(offer.status);
    const publicationStatus = this.upper(offer.publicationStatus);
    return SELLABLE_STATUS_VALUES.includes(status)
      || SELLABLE_STATUS_VALUES.includes(publicationStatus)
      || Number(offer.quantity || 0) > 0
      || Number(offer.stockQuantity || 0) > 0;
  }

  private groupByCatalogProductId(offers: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    for (const offer of offers) {
      const catalogProductId = String(offer.catalogProductId || '').trim();
      if (!catalogProductId) continue;
      const bucket = grouped.get(catalogProductId) || [];
      bucket.push(offer);
      grouped.set(catalogProductId, bucket);
    }
    return grouped;
  }

  private uniqueIds(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  }

  private normalizeLimit(value?: number): number {
    const envLimit = Number(process.env.ALLEGRO_AVAILABILITY_RECONCILIATION_LIMIT || 500);
    const parsed = Number(value || envLimit || 500);
    return Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 500, 5000));
  }

  private unwrapData(value: any): any {
    if (value?.data?.id || value?.data?.status || value?.data?.isActive !== undefined) return value.data;
    return value;
  }

  private firstBoolean(...values: unknown[]): boolean | undefined {
    const value = values.find((candidate) => typeof candidate === 'boolean');
    return typeof value === 'boolean' ? value : undefined;
  }

  private upper(value: unknown): string {
    return String(value || '').trim().toUpperCase();
  }

  private buildEndAttemptIdempotencyKey(offerId: string, catalogProductId: string, reason: AvailabilityDisableReason): string {
    return `alg-recon-end-${createHash('sha256').update(this.stableStringify({ offerId, catalogProductId, reason })).digest('hex').slice(0, 48)}`;
  }

  private buildAuditIdempotencyKey(offerId: string, catalogProductId: string, reason: AvailabilityDisableReason): string {
    return `alg-recon-audit-${createHash('sha256').update(this.stableStringify({ offerId, catalogProductId, reason })).digest('hex').slice(0, 48)}`;
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
}
