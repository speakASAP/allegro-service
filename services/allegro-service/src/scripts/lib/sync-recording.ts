import * as crypto from 'crypto';

export const SYNC_RECORDING_CONFIRMATION = 'ALLEGRO_SYNC_RECORDING_LOCAL_ONLY';

type SyncRecordingMode = 'audit' | 'dry-run' | 'apply';

type SyncRecordingSummary = {
  enabled: boolean;
  confirmed: boolean;
  mutatesLocalSyncEvidence: boolean;
  confirmation: {
    flag: string;
    expected: string;
    satisfied: boolean;
  };
  runIds: string[];
  rawPayloads: number;
  auditLogs: number;
  stockSnapshots: number;
};

type CheckoutFormSyncRecordingInput = {
  account: any;
  forms: any[];
  plan: any;
  attempts: any[];
  mode: SyncRecordingMode;
  applyStats?: any;
  argsSnapshot: Record<string, unknown>;
  startedAt?: Date;
};

type StockAuditSyncRecordingInput = {
  reports: any[];
  detailPayloads: any[];
  argsSnapshot: Record<string, unknown>;
  startedAt?: Date;
};

export function disabledSyncRecordingSummary(): SyncRecordingSummary {
  return {
    enabled: false,
    confirmed: false,
    mutatesLocalSyncEvidence: false,
    confirmation: {
      flag: '--confirm-sync-recording',
      expected: SYNC_RECORDING_CONFIRMATION,
      satisfied: false,
    },
    runIds: [],
    rawPayloads: 0,
    auditLogs: 0,
    stockSnapshots: 0,
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function hashJson(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export async function recordCheckoutFormSyncEvidence(prisma: any, input: CheckoutFormSyncRecordingInput): Promise<SyncRecordingSummary> {
  const completedAt = new Date();
  const startedAt = input.startedAt || completedAt;
  const detailAttempts = input.attempts.filter((attempt) => attempt.source === 'order.checkout-forms.detail');
  const failedDetails = detailAttempts.filter((attempt) => !attempt.ok);
  const existingOrderIds = input.plan.existingOrderIds || new Set<string>();
  const orderIds = input.forms.map((form) => String(form?.id || '')).filter(Boolean);
  const runKey = hashJson({
    accountId: input.account.id,
    domain: 'order.checkout-forms',
    mode: input.mode,
    orderIds,
    args: input.argsSnapshot,
    completedAt: completedAt.toISOString(),
  });

  return prisma.$transaction(async (tx: any) => {
    const run = await tx.allegroSyncRun.create({
      data: {
        accountId: input.account.id,
        domain: 'order.checkout-forms',
        direction: 'import',
        mode: input.mode,
        status: 'succeeded',
        idempotencyKey: `orders:${input.account.id}:${runKey.slice(0, 96)}`,
        startedAt,
        completedAt,
        scannedCount: input.forms.length,
        createdCount: input.mode === 'apply' ? Number(input.applyStats?.ordersCreated || 0) : 0,
        updatedCount: input.mode === 'apply' ? Number(input.applyStats?.ordersUpdated || 0) : 0,
        unchangedCount: input.mode === 'apply' ? 0 : Number(existingOrderIds.size || 0),
        skippedCount: Array.isArray(input.plan.missingOfferIds) ? input.plan.missingOfferIds.length : 0,
        failedCount: failedDetails.length,
        cursorBefore: await readCursor(tx, input.account.id, 'order.checkout-forms', '/order/checkout-forms', 'manual_scan_order_ids'),
        cursorAfter: {
          scannedOrderIds: orderIds,
          orderCount: orderIds.length,
          lastOrderId: orderIds[orderIds.length - 1] || null,
        },
        configSnapshot: {
          script: 'import-checkout-forms-local',
          taskId: 'TASK-010',
          args: input.argsSnapshot,
          detailAttempts: detailAttempts.length,
          detailFailures: failedDetails.length,
          lineItems: input.plan.lineItems?.length || 0,
          uniqueOfferIds: input.plan.lineOfferIds?.length || 0,
          missingOfferIds: input.plan.missingOfferIds || [],
        },
        createdByUserId: input.account.userId || null,
      },
    });
    await upsertCursor(tx, {
      accountId: input.account.id,
      domain: 'order.checkout-forms',
      endpoint: '/order/checkout-forms',
      cursorType: 'manual_scan_order_ids',
      cursorValue: orderIds[orderIds.length - 1] || null,
      watermarkAt: completedAt,
      lastRunId: run.id,
    });

    let rawPayloads = 0;
    let auditLogs = 0;

    for (const form of input.forms) {
      const externalId = String(form?.id || '').trim();
      if (!externalId) continue;
      const payloadHash = hashJson(form);
      const rawPayload = await findOrCreateRawPayload(tx, {
        syncRunId: run.id,
        accountId: input.account.id,
        domain: 'order.checkout-forms',
        endpoint: '/order/checkout-forms/{id}',
        externalId,
        revision: form?.revision ? String(form.revision) : null,
        payloadHash,
        payload: form,
        piiClass: 'sensitive_order_payload',
        redactionVersion: 'v1',
      });
      rawPayloads += 1;

      const lineItems = getLineItems(form);
      const order = await tx.allegroOrder.findUnique({
        where: { allegroOrderId: externalId },
        select: { id: true },
      });
      await tx.allegroProjectionAuditLog.create({
        data: {
          syncRunId: run.id,
          accountId: input.account.id,
          entityType: 'allegro_order',
          entityId: order?.id || null,
          externalId,
          action: input.mode === 'dry-run'
            ? 'dry_run_scanned'
            : existingOrderIds.has(externalId)
              ? 'local_projection_updated'
              : 'local_projection_created',
          beforeHash: null,
          afterHash: payloadHash,
          diffSummary: {
            rawPayloadId: rawPayload.id,
            mode: input.mode,
            existingBeforeRun: existingOrderIds.has(externalId),
            lineItems: lineItems.length,
            aggregateQuantity: lineItems.reduce((sum: number, line: any) => sum + Number(line?.quantity || 0), 0),
            missingOfferMappings: countMissingLineOfferMappings(lineItems, input.plan.missingOfferIds || []),
          },
          redactedContext: {
            status: form?.status || null,
            fulfillmentStatus: form?.fulfillment?.status || null,
            paymentStatus: getPaymentStatus(form),
            marketplaceId: form?.marketplace?.id || null,
            invoiceRequired: Boolean(form?.invoice?.required),
            offerIds: getLineOfferIds(lineItems),
          },
          idempotencyKey: `order-audit:${run.id}:${externalId}`,
        },
      });
      auditLogs += 1;
    }

    return {
      enabled: true,
      confirmed: true,
      mutatesLocalSyncEvidence: true,
      confirmation: {
        flag: '--confirm-sync-recording',
        expected: SYNC_RECORDING_CONFIRMATION,
        satisfied: true,
      },
      runIds: [run.id],
      rawPayloads,
      auditLogs,
      stockSnapshots: 0,
    };
  });
}

export async function recordStockAuditSyncEvidence(prisma: any, input: StockAuditSyncRecordingInput): Promise<SyncRecordingSummary> {
  const completedAt = new Date();
  const startedAt = input.startedAt || completedAt;
  const detailPayloadsByAccount = groupBy(input.detailPayloads, (payload) => payload.accountId);

  return prisma.$transaction(async (tx: any) => {
    const summary: SyncRecordingSummary = {
      enabled: true,
      confirmed: true,
      mutatesLocalSyncEvidence: true,
      confirmation: {
        flag: '--confirm-sync-recording',
        expected: SYNC_RECORDING_CONFIRMATION,
        satisfied: true,
      },
      runIds: [],
      rawPayloads: 0,
      auditLogs: 0,
      stockSnapshots: 0,
    };

    for (const report of input.reports) {
      const accountDetailPayloads = detailPayloadsByAccount.get(report.accountId) || [];
      const scannedOfferIds = accountDetailPayloads.map((payload: any) => payload.offerId).filter(Boolean);
      const runKey = hashJson({
        accountId: report.accountId,
        domain: 'sale.product-offers.stock',
        mode: 'audit',
        offerIds: scannedOfferIds,
        args: input.argsSnapshot,
        completedAt: completedAt.toISOString(),
      });
      const run = await tx.allegroSyncRun.create({
        data: {
          accountId: report.accountId,
          domain: 'sale.product-offers.stock',
          direction: 'import',
          mode: 'audit',
          status: report.errors?.length ? 'succeeded_with_errors' : 'succeeded',
          idempotencyKey: `stock:${report.accountId}:${runKey.slice(0, 97)}`,
          startedAt,
          completedAt,
          scannedCount: Number(report.detailChecked || 0),
          createdCount: 0,
          updatedCount: 0,
          unchangedCount: 0,
          skippedCount: Math.max(0, Number(report.listedOffers || 0) - Number(report.detailChecked || 0)),
          failedCount: Number(report.detailErrors || 0),
          cursorBefore: await readCursor(tx, report.accountId, 'sale.product-offers.stock', '/sale/product-offers/{offerId}', 'manual_scan_offer_ids'),
          cursorAfter: {
            listedOffers: report.listedOffers,
            detailChecked: report.detailChecked,
            scannedOfferIds,
            lastOfferId: scannedOfferIds[scannedOfferIds.length - 1] || null,
          },
          configSnapshot: {
            script: 'audit-current-stock-source',
            taskId: 'TASK-010',
            args: input.argsSnapshot,
            publicationStatuses: report.listedByStatus || {},
            stockAuthoritativeOffers: report.stockAuthoritativeOffers || 0,
            stockAuthoritativeTotal: report.stockAuthoritativeTotal || 0,
          },
          errorSummary: report.errors?.length ? { count: report.errors.length, errors: report.errors.slice(0, 20) } : null,
          createdByUserId: report.userId || null,
        },
      });
      summary.runIds.push(run.id);
      await upsertCursor(tx, {
        accountId: report.accountId,
        domain: 'sale.product-offers.stock',
        endpoint: '/sale/product-offers/{offerId}',
        cursorType: 'manual_scan_offer_ids',
        cursorValue: scannedOfferIds[scannedOfferIds.length - 1] || null,
        watermarkAt: completedAt,
        lastRunId: run.id,
      });

      for (const detailPayload of accountDetailPayloads) {
        const externalId = String(detailPayload?.offerId || '').trim();
        if (!externalId) continue;
        const offer = await tx.allegroOffer.findFirst({
          where: { accountId: report.accountId, allegroOfferId: externalId },
          select: { id: true, catalogProductId: true, stockQuantity: true },
        });
        const payloadHash = hashJson(detailPayload.data);
        const rawPayload = await findOrCreateRawPayload(tx, {
          syncRunId: run.id,
          accountId: report.accountId,
          domain: 'sale.product-offers.stock',
          endpoint: '/sale/product-offers/{offerId}',
          externalId,
          revision: detailPayload.data?.revision ? String(detailPayload.data.revision) : null,
          payloadHash,
          payload: detailPayload.data,
          piiClass: 'offer_stock_payload',
          redactionVersion: 'v1',
        });
        summary.rawPayloads += 1;
        const availableQuantity = extractStockQuantity(detailPayload.data);
        await tx.allegroOfferStockSnapshot.create({
          data: {
            syncRunId: run.id,
            accountId: report.accountId,
            offerId: offer?.id || null,
            allegroOfferId: externalId,
            catalogProductId: offer?.catalogProductId || null,
            sourceEndpoint: '/sale/product-offers/{offerId}',
            sourceFetchedAt: completedAt,
            payloadHash,
            availableQuantity,
            authorityClass: availableQuantity === null || availableQuantity === undefined
              ? 'sample_without_current_stock'
              : 'product_offers_current_stock',
            rawPayloadId: rawPayload.id,
            comparisonSummary: {
              listedStock: detailPayload.listedStock ?? null,
              currentStock: availableQuantity,
              localOfferStockQuantity: offer?.stockQuantity ?? null,
              detailStatus: detailPayload.status ?? null,
              hasCatalogProduct: Boolean(offer?.catalogProductId || detailPayload.hasCatalogProduct),
            },
          },
        });
        summary.stockSnapshots += 1;

        await tx.allegroProjectionAuditLog.create({
          data: {
            syncRunId: run.id,
            accountId: report.accountId,
            entityType: 'allegro_offer_stock',
            entityId: offer?.id || null,
            externalId,
            action: 'stock_audit_sampled',
            beforeHash: null,
            afterHash: payloadHash,
            diffSummary: {
              sourceEndpoint: '/sale/product-offers/{offerId}',
              rawPayloadId: rawPayload.id,
              authorityClass: availableQuantity === null || availableQuantity === undefined
                ? 'sample_without_current_stock'
                : 'product_offers_current_stock',
            },
            redactedContext: {
              publicationStatus: detailPayload.data?.publication?.status || detailPayload.listedPublicationStatus || null,
              detailStatus: detailPayload.status ?? null,
              listedStock: detailPayload.listedStock ?? null,
              currentStock: availableQuantity,
              hasCatalogProduct: Boolean(offer?.catalogProductId || detailPayload.hasCatalogProduct),
            },
            idempotencyKey: `stock-audit:${run.id}:${externalId}`,
          },
        });
        summary.auditLogs += 1;
      }
    }

    return summary;
  });
}

async function findOrCreateRawPayload(tx: any, data: any): Promise<any> {
  const existing = await tx.allegroRawPayload.findFirst({
    where: {
      accountId: data.accountId,
      domain: data.domain,
      externalId: data.externalId,
      payloadHash: data.payloadHash,
    },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.allegroRawPayload.create({ data });
}

async function readCursor(tx: any, accountId: string, domain: string, endpoint: string, cursorType: string): Promise<any> {
  const cursor = await tx.allegroSyncCursor.findUnique({
    where: {
      accountId_domain_endpoint_cursorType: {
        accountId,
        domain,
        endpoint,
        cursorType,
      },
    },
  });
  if (!cursor) return null;
  return {
    cursorValue: cursor.cursorValue,
    watermarkAt: cursor.watermarkAt,
    lastRunId: cursor.lastRunId,
    updatedAt: cursor.updatedAt,
  };
}

async function upsertCursor(tx: any, input: any): Promise<void> {
  await tx.allegroSyncCursor.upsert({
    where: {
      accountId_domain_endpoint_cursorType: {
        accountId: input.accountId,
        domain: input.domain,
        endpoint: input.endpoint,
        cursorType: input.cursorType,
      },
    },
    update: {
      cursorValue: input.cursorValue,
      watermarkAt: input.watermarkAt,
      lastRunId: input.lastRunId,
      lockedUntil: null,
    },
    create: {
      accountId: input.accountId,
      domain: input.domain,
      endpoint: input.endpoint,
      cursorType: input.cursorType,
      cursorValue: input.cursorValue,
      watermarkAt: input.watermarkAt,
      lastRunId: input.lastRunId,
      lockedUntil: null,
    },
  });
}

function sortJson(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sortJson(item));
  if (!value || typeof value !== 'object') return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortJson(value[key]);
  }
  return sorted;
}

function getLineItems(form: any): any[] {
  return Array.isArray(form?.lineItems) ? form.lineItems : [];
}

function getLineOfferIds(lineItems: any[]): string[] {
  return Array.from(new Set(lineItems.map((line) => String(line?.offer?.id || '').trim()).filter(Boolean)));
}

function countMissingLineOfferMappings(lineItems: any[], missingOfferIds: string[]): number {
  const missing = new Set(missingOfferIds);
  return getLineOfferIds(lineItems).filter((offerId) => missing.has(offerId)).length;
}

function getPaymentStatus(form: any): string | null {
  return form?.payment?.finishedAt ? 'PAID' : form?.payment?.type || null;
}

function extractStockQuantity(payload: any): number | null {
  const value = payload?.stock?.available;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function groupBy<T>(items: T[], picker: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = picker(item);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  return grouped;
}
