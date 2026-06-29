import { Injectable } from '@nestjs/common';
import { LoggerService, PrismaService } from '@allegro/shared';

type PageQuery = {
  page?: string | number;
  limit?: string | number;
  accountId?: string;
  domain?: string;
  status?: string;
  mode?: string;
  direction?: string;
  entityType?: string;
  action?: string;
  authorityClass?: string;
  allegroOfferId?: string;
};

type PageParams = {
  page: number;
  limit: number;
  skip: number;
};

function nonEmpty(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : undefined;
}

function pageParams(query: PageQuery): PageParams {
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '25'), 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated(items: any[], total: number, page: number, limit: number): any {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function accountSelect(): any {
  return { select: { id: true, name: true, isActive: true } };
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getSummary(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const accountId = nonEmpty(query.accountId);
    const accountFilter = accountId ? { accountId } : {};
    const now = new Date();

    const [
      syncRuns,
      cursors,
      rawPayloads,
      projectionAuditLogs,
      stockSnapshots,
      latestSyncRuns,
      latestStockSnapshots,
      latestCursors,
    ] = await Promise.all([
      prisma.allegroSyncRun.count({ where: accountFilter }),
      prisma.allegroSyncCursor.count({ where: accountFilter }),
      prisma.allegroRawPayload.count({ where: accountFilter }),
      prisma.allegroProjectionAuditLog.count({ where: accountFilter }),
      prisma.allegroOfferStockSnapshot.count({ where: accountFilter }),
      prisma.allegroSyncRun.findMany({
        where: accountFilter,
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: this.syncRunSelect(),
      }),
      prisma.allegroOfferStockSnapshot.findMany({
        where: accountFilter,
        orderBy: { sourceFetchedAt: 'desc' },
        take: 10,
        select: this.stockSnapshotSelect(),
      }),
      prisma.allegroSyncCursor.findMany({
        where: accountFilter,
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: this.cursorSelect(),
      }),
    ]);

    this.logger.log('Read Allegro operations summary', {
      accountId: accountId || null,
      syncRuns,
      rawPayloads,
      projectionAuditLogs,
      stockSnapshots,
    });

    return {
      generatedAt: now.toISOString(),
      accountId: accountId || null,
      safety: {
        readOnly: true,
        mutatesLocalProjection: false,
        mutatesCatalog: false,
        mutatesWarehouse: false,
        mutatesOrders: false,
        mutatesAllegro: false,
        returnsRawPayload: false,
      },
      counts: {
        syncRuns,
        cursors,
        rawPayloads,
        projectionAuditLogs,
        stockSnapshots,
      },
      latest: {
        syncRuns: latestSyncRuns,
        stockSnapshots: latestStockSnapshots,
        cursors: latestCursors,
      },
    };
  }

  async listSyncRuns(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const { page, limit, skip } = pageParams(query);
    const where: any = {
      ...(nonEmpty(query.accountId) ? { accountId: nonEmpty(query.accountId) } : {}),
      ...(nonEmpty(query.domain) ? { domain: nonEmpty(query.domain) } : {}),
      ...(nonEmpty(query.status) ? { status: nonEmpty(query.status) } : {}),
      ...(nonEmpty(query.mode) ? { mode: nonEmpty(query.mode) } : {}),
      ...(nonEmpty(query.direction) ? { direction: nonEmpty(query.direction) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.allegroSyncRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        select: this.syncRunSelect(),
      }),
      prisma.allegroSyncRun.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async getSyncRun(id: string): Promise<any> {
    const prisma = this.prisma as any;
    return prisma.allegroSyncRun.findUnique({
      where: { id },
      select: {
        ...this.syncRunSelect(),
        cursorBefore: true,
        cursorAfter: true,
        configSnapshot: true,
        errorSummary: true,
        rawPayloads: {
          orderBy: { receivedAt: 'desc' },
          take: 50,
          select: this.rawPayloadSelect(),
        },
        projectionAuditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: this.projectionAuditSelect(),
        },
        stockSnapshots: {
          orderBy: { sourceFetchedAt: 'desc' },
          take: 50,
          select: this.stockSnapshotSelect(),
        },
      },
    });
  }

  async listCursors(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const { page, limit, skip } = pageParams(query);
    const where: any = {
      ...(nonEmpty(query.accountId) ? { accountId: nonEmpty(query.accountId) } : {}),
      ...(nonEmpty(query.domain) ? { domain: nonEmpty(query.domain) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.allegroSyncCursor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: this.cursorSelect(),
      }),
      prisma.allegroSyncCursor.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async listRawPayloads(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const { page, limit, skip } = pageParams(query);
    const where: any = {
      ...(nonEmpty(query.accountId) ? { accountId: nonEmpty(query.accountId) } : {}),
      ...(nonEmpty(query.domain) ? { domain: nonEmpty(query.domain) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.allegroRawPayload.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        select: this.rawPayloadSelect(),
      }),
      prisma.allegroRawPayload.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async listProjectionAuditLogs(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const { page, limit, skip } = pageParams(query);
    const where: any = {
      ...(nonEmpty(query.accountId) ? { accountId: nonEmpty(query.accountId) } : {}),
      ...(nonEmpty(query.entityType) ? { entityType: nonEmpty(query.entityType) } : {}),
      ...(nonEmpty(query.action) ? { action: nonEmpty(query.action) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.allegroProjectionAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: this.projectionAuditSelect(),
      }),
      prisma.allegroProjectionAuditLog.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async listStockSnapshots(query: PageQuery = {}): Promise<any> {
    const prisma = this.prisma as any;
    const { page, limit, skip } = pageParams(query);
    const where: any = {
      ...(nonEmpty(query.accountId) ? { accountId: nonEmpty(query.accountId) } : {}),
      ...(nonEmpty(query.authorityClass) ? { authorityClass: nonEmpty(query.authorityClass) } : {}),
      ...(nonEmpty(query.allegroOfferId) ? { allegroOfferId: nonEmpty(query.allegroOfferId) } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.allegroOfferStockSnapshot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sourceFetchedAt: 'desc' },
        select: this.stockSnapshotSelect(),
      }),
      prisma.allegroOfferStockSnapshot.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private syncRunSelect(): any {
    return {
      id: true,
      accountId: true,
      domain: true,
      direction: true,
      mode: true,
      status: true,
      idempotencyKey: true,
      startedAt: true,
      completedAt: true,
      scannedCount: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      skippedCount: true,
      failedCount: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      account: accountSelect(),
    };
  }

  private cursorSelect(): any {
    return {
      id: true,
      accountId: true,
      domain: true,
      endpoint: true,
      cursorType: true,
      cursorValue: true,
      watermarkAt: true,
      lastRunId: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
      account: accountSelect(),
    };
  }

  private rawPayloadSelect(): any {
    return {
      id: true,
      syncRunId: true,
      accountId: true,
      domain: true,
      endpoint: true,
      externalId: true,
      revision: true,
      payloadHash: true,
      piiClass: true,
      redactionVersion: true,
      receivedAt: true,
      createdAt: true,
      account: accountSelect(),
    };
  }

  private projectionAuditSelect(): any {
    return {
      id: true,
      syncRunId: true,
      accountId: true,
      entityType: true,
      entityId: true,
      externalId: true,
      action: true,
      beforeHash: true,
      afterHash: true,
      diffSummary: true,
      redactedContext: true,
      idempotencyKey: true,
      createdAt: true,
      account: accountSelect(),
    };
  }

  private stockSnapshotSelect(): any {
    return {
      id: true,
      syncRunId: true,
      accountId: true,
      offerId: true,
      allegroOfferId: true,
      catalogProductId: true,
      sourceEndpoint: true,
      sourceFetchedAt: true,
      payloadHash: true,
      availableQuantity: true,
      authorityClass: true,
      rawPayloadId: true,
      comparisonSummary: true,
      createdAt: true,
      account: accountSelect(),
    };
  }
}
