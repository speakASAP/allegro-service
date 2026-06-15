import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CatalogClientService, LoggerService, PrismaService } from '@allegro/shared';
import { OffersService } from '../offers/offers.service';
import {
  PreparePublishAttemptDto,
  PublishAttemptQueryDto,
  PublishLifecycleAction,
  PublishLifecycleStatus,
} from './publish-lifecycle.dto';

type PolicyResult = {
  gate: string;
  status: 'PASS' | 'BLOCK' | 'WARN';
  reason?: string;
  evidence?: Record<string, unknown>;
};

const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];
const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;

@Injectable()
export class PublishLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly catalogClient: CatalogClientService,
    private readonly offersService: OffersService,
  ) {}

  async prepare(dto: PreparePublishAttemptDto, requestedByUserId: string): Promise<any> {
    if (!dto.offerId && !dto.catalogProductId) {
      throw new HttpException('offerId or catalogProductId is required', HttpStatus.BAD_REQUEST);
    }

    const prismaAny = this.prisma as any;
    const now = new Date();
    const offer = dto.offerId
      ? await prismaAny.allegroOffer.findUnique({
          where: { id: dto.offerId },
          include: { account: { select: { id: true, name: true, userId: true, isActive: true, tokenExpiresAt: true } } },
        })
      : null;

    if (dto.offerId && !offer) {
      throw new HttpException('Offer not found', HttpStatus.NOT_FOUND);
    }

    const activeAccount = await prismaAny.allegroAccount.findFirst({
      where: { userId: requestedByUserId, isActive: true },
      select: { id: true },
    });
    const accountId = dto.accountId || offer?.accountId || activeAccount?.id || null;
    const catalogProductId = dto.catalogProductId || offer?.catalogProductId || null;
    const idempotencyKey =
      dto.idempotencyKey ||
      this.buildIdempotencyKey(dto.action, requestedByUserId, {
        offerId: dto.offerId || null,
        catalogProductId,
        accountId,
      });

    const existing = await prismaAny.allegroPublishAttempt.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return this.withDerivedStatus(existing);
    }

    const policyResults = await this.evaluatePolicy({
      action: dto.action,
      offer,
      accountId,
      catalogProductId,
      requestedByUserId,
    });
    const blocked = policyResults.some((result) => result.status === 'BLOCK');
    const status: PublishLifecycleStatus = blocked ? 'BLOCKED' : 'PREPARED';
    const blockedReasons = policyResults
      .filter((result) => result.status === 'BLOCK')
      .map((result) => ({ gate: result.gate, reason: result.reason || 'blocked' }));

    const attempt = await prismaAny.allegroPublishAttempt.create({
      data: {
        action: dto.action,
        status,
        idempotencyKey,
        requestedByUserId,
        accountId,
        catalogProductId,
        allegroOfferId: offer?.allegroOfferId || null,
        offerId: offer?.id || null,
        commandPayload: this.redact(dto.commandPayload || {}),
        policySnapshot: {
          version: 'TASK-002.v1',
          evaluatedAt: now.toISOString(),
          results: policyResults,
          lifecycleStates: ['PREPARED', 'BLOCKED', 'CONFIRMED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'],
          legacyDirectPaths: [
            'POST /allegro/offers/publish-all',
            'POST /allegro/offers/:id/sync-to-allegro',
            'POST /allegro/offers',
            'PUT /allegro/offers/:id',
          ],
        },
        blockedReasons,
        preparedAt: now,
        staleAt: this.addHours(now, 24),
      },
    });

    this.logger.log('Governed Allegro publish attempt prepared', {
      attemptId: attempt.id,
      action: attempt.action,
      status: attempt.status,
      offerId: attempt.offerId,
      accountId: attempt.accountId,
      catalogProductId: attempt.catalogProductId,
      blockedReasonCount: blockedReasons.length,
    });

    return this.withDerivedStatus(attempt);
  }

  async confirm(attemptId: string, requestedByUserId: string): Promise<any> {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroPublishAttempt.findUnique({ where: { id: attemptId } });

    if (!attempt) {
      throw new HttpException('Publish attempt not found', HttpStatus.NOT_FOUND);
    }
    if (attempt.requestedByUserId !== requestedByUserId) {
      throw new HttpException('Publish attempt belongs to another requester', HttpStatus.FORBIDDEN);
    }
    if (attempt.status === 'BLOCKED') {
      throw new HttpException('Blocked publish attempts cannot be confirmed', HttpStatus.CONFLICT);
    }
    if ((TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) {
      return this.withDerivedStatus(attempt);
    }
    if (!['PREPARED', 'CONFIRMED', 'QUEUED'].includes(attempt.status)) {
      throw new HttpException(`Cannot confirm attempt in ${attempt.status} status`, HttpStatus.CONFLICT);
    }
    if (attempt.status === 'QUEUED') {
      return this.withDerivedStatus(attempt);
    }

    const now = new Date();
    const updated = await prismaAny.allegroPublishAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'QUEUED',
        confirmedAt: attempt.confirmedAt || now,
        queuedAt: attempt.queuedAt || now,
      },
    });

    this.logger.log('Governed Allegro publish attempt confirmed and queued', {
      attemptId: updated.id,
      action: updated.action,
      offerId: updated.offerId,
      accountId: updated.accountId,
      catalogProductId: updated.catalogProductId,
    });

    return this.withDerivedStatus(updated);
  }



  async prepareConfirmAndExecute(dto: PreparePublishAttemptDto, requestedByUserId: string, requestId?: string): Promise<any> {
    const attempt = await this.prepare(dto, requestedByUserId);
    if (attempt.status === 'BLOCKED') {
      return attempt;
    }

    const queued = await this.confirm(attempt.id, requestedByUserId);
    return this.execute(queued.id, requestedByUserId, requestId);
  }

  async executeMany(dtoList: PreparePublishAttemptDto[], requestedByUserId: string, requestId?: string): Promise<any> {
    const results: any[] = [];
    let successful = 0;
    let failed = 0;
    let blocked = 0;

    for (const dto of dtoList) {
      const attempt = await this.prepareConfirmAndExecute(dto, requestedByUserId, requestId);
      results.push({
        attemptId: attempt.id,
        offerId: attempt.offerId,
        allegroOfferId: attempt.allegroOfferId,
        status: attempt.status,
        derivedStatus: attempt.derivedStatus,
        failureContext: attempt.failureContext,
        blockedReasons: attempt.blockedReasons,
      });

      if (attempt.status === 'SUCCEEDED') successful += 1;
      else if (attempt.status === 'BLOCKED') blocked += 1;
      else if (attempt.status === 'FAILED') failed += 1;
    }

    return {
      requestId,
      status: failed === 0 && blocked === 0 ? 'completed' : 'completed_with_issues',
      total: dtoList.length,
      successful,
      failed,
      blocked,
      results,
    };
  }

  async execute(attemptId: string, requestedByUserId: string, requestId?: string): Promise<any> {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroPublishAttempt.findUnique({ where: { id: attemptId } });

    if (!attempt) {
      throw new HttpException('Publish attempt not found', HttpStatus.NOT_FOUND);
    }
    if (attempt.requestedByUserId !== requestedByUserId) {
      throw new HttpException('Publish attempt belongs to another requester', HttpStatus.FORBIDDEN);
    }
    if (attempt.status === 'BLOCKED' || (TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) {
      return this.withDerivedStatus(attempt);
    }
    if (attempt.status !== 'QUEUED') {
      throw new HttpException(`Cannot execute attempt in ${attempt.status} status`, HttpStatus.CONFLICT);
    }
    if (!attempt.offerId) {
      const failed = await this.markFailed(attempt.id, 'MISSING_OFFER_ID', 'Queued attempt has no local offer id', null);
      return this.withDerivedStatus(failed);
    }

    await prismaAny.allegroPublishAttempt.update({
      where: { id: attempt.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      let result: any;
      const executionRequestId = requestId || `publish-attempt-${attempt.id}`;
      if (attempt.action === 'PUBLISH') {
        result = await this.offersService.publishOffersToAllegro(requestedByUserId, [attempt.offerId], executionRequestId);
        if (result?.failed > 0 || result?.successful === 0) {
          throw new HttpException(
            {
              code: 'ALLEGRO_PUBLISH_FAILED',
              message: 'Allegro publish command failed for the governed attempt',
              result,
            },
            HttpStatus.BAD_GATEWAY,
          );
        }
      } else if (attempt.action === 'UPDATE') {
        const commandPayload = attempt.commandPayload && typeof attempt.commandPayload === 'object'
          ? { ...(attempt.commandPayload as Record<string, unknown>) }
          : {};
        delete (commandPayload as any).syncToAllegro;

        if (Object.keys(commandPayload).length > 0) {
          await this.offersService.updateOffer(attempt.offerId, { ...commandPayload, syncToAllegro: false }, requestedByUserId);
        }

        result = await this.offersService.syncOfferUpdateToAllegroTerminal(
          requestedByUserId,
          attempt.offerId,
          executionRequestId,
        );

        if (result.status !== 'SUCCEEDED') {
          throw new HttpException(
            {
              code: result.error?.code || 'ALLEGRO_UPDATE_SYNC_FAILED',
              message: result.error?.message || 'Allegro update sync failed for the governed attempt',
              result,
            },
            HttpStatus.BAD_GATEWAY,
          );
        }
      } else {
        throw new HttpException(`Execution for ${attempt.action} is not implemented`, HttpStatus.NOT_IMPLEMENTED);
      }

      const completed = await prismaAny.allegroPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          commandId: result?.publishCommand?.commandId || attempt.commandId || null,
          failureContext: null,
          remediationContext: null,
        },
      });
      return this.withDerivedStatus(completed);
    } catch (error: any) {
      const errorResponse = typeof error?.getResponse === 'function'
        ? error.getResponse()
        : error?.response?.data || error?.response || null;
      const failed = await this.markFailed(
        attempt.id,
        error?.code || errorResponse?.code || error?.response?.status || 'EXECUTION_FAILED',
        errorResponse?.message || error?.message || 'Publish lifecycle execution failed',
        errorResponse?.result || errorResponse?.details || error?.response?.data || null,
      );
      return this.withDerivedStatus(failed);
    }
  }

  async getAttempt(attemptId: string): Promise<any> {
    const attempt = await (this.prisma as any).allegroPublishAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      throw new HttpException('Publish attempt not found', HttpStatus.NOT_FOUND);
    }
    return this.withDerivedStatus(attempt);
  }

  async listAttempts(query: PublishAttemptQueryDto): Promise<{ items: any[]; pagination: any }> {
    const page = Math.max(parseInt(String(query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(query.limit || '25'), 10) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.offerId) where.offerId = query.offerId;
    if (query.catalogProductId) where.catalogProductId = query.catalogProductId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.status && query.status !== 'STALE') where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const prismaAny = this.prisma as any;
    const [items, total] = await Promise.all([
      prismaAny.allegroPublishAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prismaAny.allegroPublishAttempt.count({ where }),
    ]);

    const derivedItems = items.map((item: any) => this.withDerivedStatus(item));
    return {
      items: query.status === 'STALE' ? derivedItems.filter((item: any) => item.derivedStatus === 'STALE') : derivedItems,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async monitoringSummary(): Promise<any> {
    const prismaAny = this.prisma as any;
    const now = new Date();
    const [blocked, queued, running, failed, stale] = await Promise.all([
      prismaAny.allegroPublishAttempt.count({ where: { status: 'BLOCKED' } }),
      prismaAny.allegroPublishAttempt.count({ where: { status: 'QUEUED' } }),
      prismaAny.allegroPublishAttempt.count({ where: { status: 'RUNNING' } }),
      prismaAny.allegroPublishAttempt.count({ where: { status: 'FAILED' } }),
      prismaAny.allegroPublishAttempt.count({
        where: { status: { in: ['PREPARED', 'CONFIRMED', 'QUEUED', 'RUNNING'] }, staleAt: { lt: now } },
      }),
    ]);

    const recentBlocked = await prismaAny.allegroPublishAttempt.findMany({
      where: { status: 'BLOCKED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, offerId: true, accountId: true, catalogProductId: true, blockedReasons: true, createdAt: true },
    });

    return { blocked, queued, running, failed, stale, recentBlocked };
  }



  private async markFailed(attemptId: string, code: string, message: string, details: unknown): Promise<any> {
    return (this.prisma as any).allegroPublishAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        failureContext: this.redact({ code, message, details }),
        remediationContext: {
          nextAction: 'Review policy snapshot, local offer readiness, OAuth/account state, and Allegro error code before retry.',
        },
      },
    });
  }

  private async evaluatePolicy(input: {
    action: PublishLifecycleAction;
    offer: any;
    accountId: string | null;
    catalogProductId: string | null;
    requestedByUserId: string;
  }): Promise<PolicyResult[]> {
    const results: PolicyResult[] = [];
    const now = new Date();

    if (!input.catalogProductId) {
      results.push({ gate: 'catalog-validation', status: 'BLOCK', reason: 'catalogProductId is required before Allegro offer mutation' });
    } else {
      try {
        const product = await this.catalogClient.getProductById(input.catalogProductId);
        results.push({
          gate: 'catalog-validation',
          status: product ? 'PASS' : 'BLOCK',
          reason: product ? undefined : 'catalog product was not returned',
          evidence: { catalogProductId: input.catalogProductId, productFound: !!product },
        });
      } catch (error: any) {
        results.push({
          gate: 'catalog-validation',
          status: 'BLOCK',
          reason: `catalog validation unavailable: ${error.message}`,
          evidence: { catalogProductId: input.catalogProductId, errorCode: error.status || error.response?.status || 'CATALOG_UNAVAILABLE' },
        });
      }
    }

    if (!input.accountId) {
      results.push({ gate: 'account-readiness', status: 'BLOCK', reason: 'accountId is required before Allegro offer mutation' });
    } else {
      const account = await (this.prisma as any).allegroAccount.findFirst({
        where: { id: input.accountId, userId: input.requestedByUserId },
        select: { id: true, isActive: true, tokenExpiresAt: true },
      });
      const tokenExpiresAt = account?.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
      const tokenPresent = account
        ? (await (this.prisma as any).allegroAccount.count({ where: { id: account.id, accessToken: { not: null } } })) > 0
        : false;
      const hasUsableToken = tokenPresent && (!tokenExpiresAt || tokenExpiresAt > now);
      results.push({
        gate: 'account-readiness',
        status: account && hasUsableToken ? 'PASS' : 'BLOCK',
        reason: account ? (hasUsableToken ? undefined : 'OAuth token missing or expired') : 'account not found for requester',
        evidence: { accountId: input.accountId, accountFound: !!account, tokenState: hasUsableToken ? 'present' : 'missing_or_expired' },
      });
    }

    results.push({
      gate: 'rate-limit-readiness',
      status: 'PASS',
      evidence: { policy: 'Allegro account max 1 request per second; confirmed attempts enter queue before execution' },
    });

    if (input.action === 'UPDATE') {
      results.push({
        gate: 'update-terminal-contract',
        status: 'PASS',
        reason: 'Remote offer updates execute through a synchronous terminal lifecycle result contract',
        evidence: { terminalStatuses: ['SUCCEEDED', 'FAILED'] },
      });
    }

    if (input.offer) {
      const readiness = this.evaluateOfferReadiness(input.offer);
      results.push({
        gate: 'offer-readiness',
        status: readiness.blockers.length > 0 ? 'BLOCK' : readiness.warnings.length > 0 ? 'WARN' : 'PASS',
        reason: readiness.blockers.length > 0 ? readiness.blockers.join('; ') : undefined,
        evidence: { blockers: readiness.blockers, warnings: readiness.warnings },
      });
    }

    results.push({
      gate: 'legacy-direct-path-review',
      status: 'WARN',
      reason: 'Legacy direct offer mutation endpoints remain present and must be wrapped in a follow-up execution step',
    });

    return results;
  }

  private evaluateOfferReadiness(offer: any): { blockers: string[]; warnings: string[] } {
    const blockers: string[] = [];
    const warnings: string[] = [];
    if (!offer.title || !String(offer.title).trim()) blockers.push('missing title');
    if (!offer.categoryId || !String(offer.categoryId).trim()) blockers.push('missing category');
    if (!offer.price || Number(offer.price) <= 0) blockers.push('invalid price');
    if (offer.stockQuantity === undefined || offer.stockQuantity === null || Number(offer.stockQuantity) < 0) blockers.push('invalid stock');
    if (!offer.images || !Array.isArray(offer.images) || offer.images.length === 0) warnings.push('missing local image evidence');
    if (!offer.deliveryOptions && !offer.rawData?.delivery) warnings.push('missing delivery evidence');
    if (!offer.paymentOptions && !offer.rawData?.payments) warnings.push('missing payment evidence');
    return { blockers, warnings };
  }

  private buildIdempotencyKey(action: string, requestedByUserId: string, target: Record<string, unknown>): string {
    const canonical = JSON.stringify({ action, requestedByUserId, target });
    return `alg-publish-${createHash('sha256').update(canonical).digest('hex').slice(0, 48)}`;
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private withDerivedStatus(attempt: any): any {
    const isStale = attempt.staleAt && new Date(attempt.staleAt) < new Date() && !TERMINAL_STATUSES.includes(attempt.status);
    return { ...attempt, derivedStatus: isStale ? 'STALE' : attempt.status };
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => {
          const lowerKey = key.toLowerCase();
          if (SECRET_KEYS.some((secretKey) => lowerKey.includes(secretKey.toLowerCase()))) {
            return [key, '[REDACTED]'];
          }
          return [key, this.redact(item)];
        }),
      );
    }
    return value;
  }
}
