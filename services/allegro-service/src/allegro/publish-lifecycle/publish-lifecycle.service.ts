import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { LoggerService, PrismaService } from '@allegro/shared';
import { OffersService } from '../offers/offers.service';
import { MarketplacePolicyEngineService, MarketplacePolicyGateResult } from '../policy/policy-engine.service';
import {
  PreparePublishAttemptDto,
  PublishAttemptQueryDto,
  PublishLifecycleAction,
  PublishLifecycleStatus,
} from './publish-lifecycle.dto';

const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];
const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
const PREVIEW_TOKEN_VERSION = 'v1';

@Injectable()
export class PublishLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly offersService: OffersService,
    private readonly policyEngine: MarketplacePolicyEngineService,
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
      return this.withPreviewToken(existing);
    }

    const policyEvaluation = await this.policyEngine.evaluate({
      action: dto.action,
      offer,
      accountId,
      catalogProductId,
      requestedByUserId,
    });
    const policyResults = policyEvaluation.results;
    const blocked = policyResults.some((result) => result.status === 'BLOCK');
    const status: PublishLifecycleStatus = blocked ? 'BLOCKED' : 'PREPARED';
    const blockedReasons = policyResults
      .filter((result) => result.status === 'BLOCK')
      .map((result) => ({ gate: result.gate, reason: result.reason || 'blocked' }));

    const commandPayload = this.redact(dto.commandPayload || {});
    const staleAt = this.addHours(now, 24);
    const previewToken = this.buildPreviewToken({
      action: dto.action,
      idempotencyKey,
      requestedByUserId,
      accountId,
      catalogProductId,
      offerId: offer?.id || null,
      commandPayload,
      staleAt,
    });

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
        commandPayload,
        policySnapshot: {
          ...policyEvaluation,
          previewTokenBinding: {
            version: PREVIEW_TOKEN_VERSION,
            requiredForConfirm: true,
            tokenHash: this.hashPreviewToken(previewToken),
            tokenReturnedIn: 'prepare_response_only',
            expiresAt: staleAt.toISOString(),
            bindingFields: [
              'action',
              'idempotencyKey',
              'requestedByUserId',
              'accountId',
              'catalogProductId',
              'offerId',
              'commandPayload',
              'staleAt',
            ],
          },
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
        staleAt,
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

    return this.withPreviewToken(attempt, previewToken);
  }

  async confirm(attemptId: string, requestedByUserId: string, previewToken?: string): Promise<any> {
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
    this.requirePreviewToken(attempt, previewToken);
    if (attempt.status === 'QUEUED') {
      return this.withDerivedStatus(attempt);
    }

    const now = new Date();
    const policySnapshot = this.withPreviewTokenConfirmation(attempt.policySnapshot, previewToken || '', now);
    const updated = await prismaAny.allegroPublishAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'QUEUED',
        confirmedAt: attempt.confirmedAt || now,
        queuedAt: attempt.queuedAt || now,
        policySnapshot,
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



  async prepareConfirmAndExecute(dto: PreparePublishAttemptDto, requestedByUserId: string, requestId?: string, previewToken?: string): Promise<any> {
    const attempt = await this.prepare(dto, requestedByUserId);
    if (attempt.status === 'BLOCKED') {
      return attempt;
    }

    const queued = await this.confirm(attempt.id, requestedByUserId, previewToken);
    return this.execute(queued.id, requestedByUserId, requestId);
  }

  async executeMany(dtoList: PreparePublishAttemptDto[], requestedByUserId: string, requestId?: string, previewTokensByIdempotencyKey: Record<string, string> = {}): Promise<any> {
    const results: any[] = [];
    let successful = 0;
    let failed = 0;
    let blocked = 0;

    for (const dto of dtoList) {
      const previewToken = dto.idempotencyKey ? previewTokensByIdempotencyKey[dto.idempotencyKey] : undefined;
      const attempt = await this.prepareConfirmAndExecute(dto, requestedByUserId, requestId, previewToken);
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



  private requirePreviewToken(attempt: any, previewToken?: string): void {
    if (!previewToken) {
      throw new HttpException(
        {
          code: 'PREVIEW_TOKEN_REQUIRED',
          message: 'Confirming an Allegro publish attempt requires the preview token returned by prepare.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const expected = this.expectedPreviewTokenHash(attempt);
    const received = this.hashPreviewToken(previewToken);
    if (expected !== received) {
      throw new HttpException(
        {
          code: 'PREVIEW_TOKEN_MISMATCH',
          message: 'Preview token does not match the prepared Allegro publish attempt.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  private withPreviewToken(attempt: any, previewToken?: string): any {
    const derived = this.withDerivedStatus(attempt);
    if ((TERMINAL_STATUSES as readonly string[]).includes(derived.status)) {
      return derived;
    }
    const token = previewToken || this.buildPreviewTokenFromAttempt(derived);
    return {
      ...derived,
      previewToken: token,
      previewTokenBinding: {
        version: PREVIEW_TOKEN_VERSION,
        requiredForConfirm: true,
        expiresAt: derived.staleAt || null,
        tokenReturnedIn: 'prepare_response_only',
      },
    };
  }

  private withPreviewTokenConfirmation(policySnapshot: any, previewToken: string, confirmedAt: Date): any {
    const previewTokenBinding = {
      ...(policySnapshot?.previewTokenBinding || {}),
      confirmedAt: confirmedAt.toISOString(),
      confirmationTokenHash: this.hashPreviewToken(previewToken),
      rawTokenStored: false,
    };
    return {
      ...(policySnapshot || {}),
      previewTokenBinding,
    };
  }

  private expectedPreviewTokenHash(attempt: any): string {
    const storedHash = attempt?.policySnapshot?.previewTokenBinding?.tokenHash;
    if (storedHash) return storedHash;
    return this.hashPreviewToken(this.buildPreviewTokenFromAttempt(attempt));
  }

  private buildPreviewTokenFromAttempt(attempt: any): string {
    return this.buildPreviewToken({
      action: attempt.action,
      idempotencyKey: attempt.idempotencyKey,
      requestedByUserId: attempt.requestedByUserId,
      accountId: attempt.accountId || null,
      catalogProductId: attempt.catalogProductId || null,
      offerId: attempt.offerId || null,
      commandPayload: attempt.commandPayload || {},
      staleAt: attempt.staleAt || null,
    });
  }

  private buildPreviewToken(input: Record<string, unknown>): string {
    const secret = process.env.ALLEGRO_PREVIEW_TOKEN_SECRET || process.env.ENCRYPTION_KEY || 'local-preview-token-secret';
    const canonical = this.stableStringify({ version: PREVIEW_TOKEN_VERSION, input, secret });
    return `alg-preview-${PREVIEW_TOKEN_VERSION}-${createHash('sha256').update(canonical).digest('hex').slice(0, 48)}`;
  }

  private hashPreviewToken(previewToken: string): string {
    return `sha256:${createHash('sha256').update(String(previewToken || '')).digest('hex')}`;
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortJson(value));
  }

  private sortJson(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.sortJson(item));
    if (!value || typeof value !== 'object') return value;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = this.sortJson(value[key]);
    }
    return sorted;
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
