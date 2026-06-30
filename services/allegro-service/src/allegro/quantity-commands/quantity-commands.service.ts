import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'crypto';
import { LoggerService, PrismaService } from '@allegro/shared';
import { AllegroApiService } from '../allegro-api.service';
import { PrepareQuantityCommandDto, QuantityCommandQueryDto } from './quantity-commands.dto';

const PREVIEW_TOKEN_VERSION = 'v1';
const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
const SECRET_KEYS = ['authorization', 'token', 'accessToken', 'refreshToken', 'clientSecret', 'secret', 'apiKey', 'password'];

@Injectable()
export class QuantityCommandsService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
    private readonly allegroApi: AllegroApiService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || process.env.ENCRYPTION_KEY || '';
  }

  async prepare(dto: PrepareQuantityCommandDto, requestedByUserId: string): Promise<any> {
    if (!Number.isInteger(dto.targetQuantity) || dto.targetQuantity < 0) {
      throw new HttpException('targetQuantity must be a non-negative integer', HttpStatus.BAD_REQUEST);
    }

    const prismaAny = this.prisma as any;
    const offer = await prismaAny.allegroOffer.findUnique({
      where: { id: dto.offerId },
      include: { account: { select: { id: true, name: true, userId: true, isActive: true, accessToken: true, tokenExpiresAt: true } } },
    });
    if (!offer) throw new HttpException('Offer not found', HttpStatus.NOT_FOUND);
    if (!offer.accountId || !offer.account) throw new HttpException('Offer has no Allegro account for quantity command', HttpStatus.CONFLICT);
    if (offer.account.userId !== requestedByUserId) throw new HttpException('Offer belongs to another requester', HttpStatus.FORBIDDEN);
    if (!offer.allegroOfferId) throw new HttpException('Offer has no Allegro offer id', HttpStatus.CONFLICT);

    const commandPayload = {
      contractVersion: 'allegro.quantity-command.v1',
      allegroOfferId: offer.allegroOfferId,
      previousQuantity: Number(offer.stockQuantity ?? offer.quantity ?? 0),
      targetQuantity: dto.targetQuantity,
      mutation: 'ALLEGRO_STOCK_QUANTITY_COMMAND',
      mutatesAllegro: true,
      mutatesWarehouse: false,
      mutatesCatalog: false,
      warehouseOwnershipPreserved: true,
    };
    const idempotencyKey = dto.idempotencyKey || this.buildIdempotencyKey(requestedByUserId, offer.id, commandPayload);
    const existing = await prismaAny.allegroQuantityCommandAttempt.findUnique({ where: { idempotencyKey } });
    if (existing) return this.withPreviewToken(existing);

    const now = new Date();
    const staleAt = this.addHours(now, 24);
    const blockedReasons = this.evaluateBlockedReasons(offer, commandPayload);
    const status = blockedReasons.length ? 'BLOCKED' : 'PREPARED';
    const previewToken = this.buildPreviewToken({
      idempotencyKey,
      requestedByUserId,
      accountId: offer.accountId,
      offerId: offer.id,
      allegroOfferId: offer.allegroOfferId,
      targetQuantity: dto.targetQuantity,
      commandPayload,
      staleAt,
    });

    const attempt = await prismaAny.allegroQuantityCommandAttempt.create({
      data: {
        status,
        idempotencyKey,
        requestedByUserId,
        accountId: offer.accountId,
        offerId: offer.id,
        allegroOfferId: offer.allegroOfferId,
        catalogProductId: offer.catalogProductId || null,
        previousQuantity: commandPayload.previousQuantity,
        targetQuantity: dto.targetQuantity,
        commandPayload,
        policySnapshot: {
          contractVersion: 'allegro.quantity-command.v1',
          gates: [
            { gate: 'offer-account-owner', status: 'PASS' },
            { gate: 'warehouse-ownership-preserved', status: 'PASS' },
            { gate: 'non-negative-target-quantity', status: 'PASS' },
            { gate: 'preview-token-required', status: 'PASS' },
          ],
          previewTokenBinding: {
            version: PREVIEW_TOKEN_VERSION,
            requiredForConfirm: true,
            tokenHash: this.hashPreviewToken(previewToken),
            tokenReturnedIn: 'prepare_response_only',
            expiresAt: staleAt.toISOString(),
            bindingFields: ['idempotencyKey', 'requestedByUserId', 'accountId', 'offerId', 'allegroOfferId', 'targetQuantity', 'commandPayload', 'staleAt'],
          },
        },
        blockedReasons,
        preparedAt: now,
        staleAt,
      },
    });

    this.logger.log('Governed Allegro quantity command prepared', {
      attemptId: attempt.id,
      status: attempt.status,
      offerId: attempt.offerId,
      allegroOfferId: attempt.allegroOfferId,
      accountId: attempt.accountId,
      targetQuantity: attempt.targetQuantity,
      blockedReasonCount: blockedReasons.length,
    });

    return this.withPreviewToken(attempt, previewToken);
  }

  async confirm(attemptId: string, requestedByUserId: string, previewToken?: string): Promise<any> {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroQuantityCommandAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new HttpException('Quantity command attempt not found', HttpStatus.NOT_FOUND);
    if (attempt.requestedByUserId !== requestedByUserId) throw new HttpException('Quantity command attempt belongs to another requester', HttpStatus.FORBIDDEN);
    if (attempt.status === 'BLOCKED') throw new HttpException('Blocked quantity command attempts cannot be confirmed', HttpStatus.CONFLICT);
    if ((TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) return this.withDerivedStatus(attempt);
    if (!['PREPARED', 'QUEUED'].includes(attempt.status)) throw new HttpException(`Cannot confirm attempt in ${attempt.status} status`, HttpStatus.CONFLICT);
    this.requirePreviewToken(attempt, previewToken);
    if (attempt.status === 'QUEUED') return this.withDerivedStatus(attempt);

    const now = new Date();
    const updated = await prismaAny.allegroQuantityCommandAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'QUEUED',
        confirmedAt: attempt.confirmedAt || now,
        queuedAt: attempt.queuedAt || now,
        policySnapshot: this.withPreviewTokenConfirmation(attempt.policySnapshot, previewToken || '', now),
      },
    });
    return this.withDerivedStatus(updated);
  }

  async execute(attemptId: string, requestedByUserId: string): Promise<any> {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroQuantityCommandAttempt.findUnique({
      where: { id: attemptId },
      include: { account: { select: { accessToken: true, tokenExpiresAt: true } } },
    });
    if (!attempt) throw new HttpException('Quantity command attempt not found', HttpStatus.NOT_FOUND);
    if (attempt.requestedByUserId !== requestedByUserId) throw new HttpException('Quantity command attempt belongs to another requester', HttpStatus.FORBIDDEN);
    if (attempt.status === 'BLOCKED' || (TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) return this.withDerivedStatus(attempt);
    if (attempt.status !== 'QUEUED') throw new HttpException(`Cannot execute attempt in ${attempt.status} status`, HttpStatus.CONFLICT);

    const commandId = attempt.commandId || this.buildCommandId(attempt);
    await prismaAny.allegroQuantityCommandAttempt.update({
      where: { id: attempt.id },
      data: { status: 'RUNNING', startedAt: new Date(), commandId },
    });

    try {
      const accessToken = this.decryptToken(attempt.account?.accessToken);
      const response = await this.allegroApi.changeOfferQuantityWithOAuthToken(accessToken, commandId, [{ offerId: attempt.allegroOfferId, quantity: attempt.targetQuantity }]);
      const updated = await prismaAny.allegroQuantityCommandAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'RUNNING',
          commandId,
          commandResponse: this.redact({ submittedAt: new Date().toISOString(), response }),
        },
      });
      return this.withDerivedStatus(updated);
    } catch (error: any) {
      return this.withDerivedStatus(await this.markFailed(attempt.id, error?.response?.status || error?.code || 'QUANTITY_COMMAND_SUBMIT_FAILED', error?.message || 'Quantity command submission failed', error?.response?.data || null));
    }
  }

  async confirmAndExecute(attemptId: string, requestedByUserId: string, previewToken: string): Promise<any> {
    const queued = await this.confirm(attemptId, requestedByUserId, previewToken);
    return this.execute(queued.id, requestedByUserId);
  }

  async poll(attemptId: string, requestedByUserId: string): Promise<any> {
    const prismaAny = this.prisma as any;
    const attempt = await prismaAny.allegroQuantityCommandAttempt.findUnique({
      where: { id: attemptId },
      include: { account: { select: { accessToken: true } } },
    });
    if (!attempt) throw new HttpException('Quantity command attempt not found', HttpStatus.NOT_FOUND);
    if (attempt.requestedByUserId !== requestedByUserId) throw new HttpException('Quantity command attempt belongs to another requester', HttpStatus.FORBIDDEN);
    if (!attempt.commandId) return this.withDerivedStatus(attempt);
    if ((TERMINAL_STATUSES as readonly string[]).includes(attempt.status)) return this.withDerivedStatus(attempt);

    try {
      const accessToken = this.decryptToken(attempt.account?.accessToken);
      const [summary, tasks] = await Promise.all([
        this.allegroApi.getOfferQuantityCommandStatusWithOAuthToken(accessToken, attempt.commandId),
        this.allegroApi.getOfferQuantityCommandTasksWithOAuthToken(accessToken, attempt.commandId, { limit: 100, offset: 0 }),
      ]);
      const terminal = this.deriveTerminalStatus(summary, tasks);
      const data: any = { commandResponse: this.redact({ summary, tasks, polledAt: new Date().toISOString() }) };
      if (terminal === 'SUCCEEDED') {
        data.status = 'SUCCEEDED';
        data.completedAt = new Date();
        await prismaAny.allegroOffer.update({ where: { id: attempt.offerId }, data: { stockQuantity: attempt.targetQuantity, quantity: attempt.targetQuantity } });
      } else if (terminal === 'FAILED') {
        data.status = 'FAILED';
        data.completedAt = new Date();
        data.failureContext = this.redact({ code: 'QUANTITY_COMMAND_FAILED', message: 'Allegro quantity command reported failed task status', details: { summary, tasks } });
        data.remediationContext = { nextAction: 'Review Allegro command task errors, account rate limits, and current offer state before retry.' };
      }
      return this.withDerivedStatus(await prismaAny.allegroQuantityCommandAttempt.update({ where: { id: attempt.id }, data }));
    } catch (error: any) {
      return this.withDerivedStatus(await this.markFailed(attempt.id, error?.response?.status || error?.code || 'QUANTITY_COMMAND_POLL_FAILED', error?.message || 'Quantity command polling failed', error?.response?.data || null));
    }
  }

  async getAttempt(attemptId: string): Promise<any> {
    const attempt = await (this.prisma as any).allegroQuantityCommandAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new HttpException('Quantity command attempt not found', HttpStatus.NOT_FOUND);
    return this.withDerivedStatus(attempt);
  }

  async listAttempts(query: QuantityCommandQueryDto = {}): Promise<any> {
    const page = Math.max(parseInt(String(query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(query.limit || '25'), 10) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.offerId) where.offerId = query.offerId;
    if (query.accountId) where.accountId = query.accountId;
    if (query.status && query.status !== 'STALE') where.status = query.status;
    const prismaAny = this.prisma as any;
    const [items, total] = await Promise.all([
      prismaAny.allegroQuantityCommandAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prismaAny.allegroQuantityCommandAttempt.count({ where }),
    ]);
    const derivedItems = items.map((item: any) => this.withDerivedStatus(item));
    return { items: query.status === 'STALE' ? derivedItems.filter((item: any) => item.derivedStatus === 'STALE') : derivedItems, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private evaluateBlockedReasons(offer: any, commandPayload: any): any[] {
    const blocked: any[] = [];
    if (!offer.account?.isActive) blocked.push({ gate: 'active-account', reason: 'Offer account is not active' });
    if (!offer.account?.accessToken) blocked.push({ gate: 'oauth-token', reason: 'Offer account has no OAuth access token' });
    if (!offer.allegroOfferId) blocked.push({ gate: 'allegro-offer-id', reason: 'Offer has no Allegro offer id' });
    if (commandPayload.targetQuantity < 0) blocked.push({ gate: 'target-quantity', reason: 'Target quantity must be non-negative' });
    return blocked;
  }

  private deriveTerminalStatus(summary: any, tasks: any): 'RUNNING' | 'SUCCEEDED' | 'FAILED' {
    const taskItems = Array.isArray(tasks?.tasks) ? tasks.tasks : Array.isArray(tasks) ? tasks : [];
    const statusTexts = [summary?.status, summary?.taskCount?.failed ? 'FAILED' : undefined, ...taskItems.map((task: any) => task.status || task.result?.status)].filter(Boolean).map((value: any) => String(value).toUpperCase());
    if (statusTexts.some((status) => ['FAIL', 'FAILED', 'ERROR'].includes(status))) return 'FAILED';
    if (statusTexts.length > 0 && statusTexts.every((status) => ['SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(status))) return 'SUCCEEDED';
    return 'RUNNING';
  }

  private requirePreviewToken(attempt: any, previewToken?: string): void {
    if (!previewToken) throw new HttpException({ code: 'PREVIEW_TOKEN_REQUIRED', message: 'Confirming an Allegro quantity command requires the preview token returned by prepare.' }, HttpStatus.CONFLICT);
    const expected = attempt?.policySnapshot?.previewTokenBinding?.tokenHash || this.hashPreviewToken(this.buildPreviewTokenFromAttempt(attempt));
    const received = this.hashPreviewToken(previewToken);
    if (expected !== received) throw new HttpException({ code: 'PREVIEW_TOKEN_MISMATCH', message: 'Preview token does not match the prepared Allegro quantity command.' }, HttpStatus.CONFLICT);
  }

  private withPreviewToken(attempt: any, previewToken?: string): any {
    const derived = this.withDerivedStatus(attempt);
    if ((TERMINAL_STATUSES as readonly string[]).includes(derived.status)) return derived;
    return { ...derived, previewToken: previewToken || this.buildPreviewTokenFromAttempt(derived), previewTokenBinding: { version: PREVIEW_TOKEN_VERSION, requiredForConfirm: true, expiresAt: derived.staleAt || null, tokenReturnedIn: 'prepare_response_only' } };
  }

  private withPreviewTokenConfirmation(policySnapshot: any, previewToken: string, confirmedAt: Date): any {
    return { ...(policySnapshot || {}), previewTokenBinding: { ...(policySnapshot?.previewTokenBinding || {}), confirmedAt: confirmedAt.toISOString(), confirmationTokenHash: this.hashPreviewToken(previewToken), rawTokenStored: false } };
  }

  private buildPreviewTokenFromAttempt(attempt: any): string {
    return this.buildPreviewToken({ idempotencyKey: attempt.idempotencyKey, requestedByUserId: attempt.requestedByUserId, accountId: attempt.accountId, offerId: attempt.offerId, allegroOfferId: attempt.allegroOfferId, targetQuantity: attempt.targetQuantity, commandPayload: attempt.commandPayload || {}, staleAt: attempt.staleAt || null });
  }

  private buildPreviewToken(input: Record<string, unknown>): string {
    const secret = process.env.ALLEGRO_PREVIEW_TOKEN_SECRET || this.encryptionKey || 'local-preview-token-secret';
    return `alg-qty-preview-${PREVIEW_TOKEN_VERSION}-${createHash('sha256').update(this.stableStringify({ version: PREVIEW_TOKEN_VERSION, input, secret })).digest('hex').slice(0, 48)}`;
  }

  private hashPreviewToken(previewToken: string): string {
    return `sha256:${createHash('sha256').update(String(previewToken || '')).digest('hex')}`;
  }

  private buildIdempotencyKey(requestedByUserId: string, offerId: string, commandPayload: unknown): string {
    return `alg-qty-${createHash('sha256').update(this.stableStringify({ requestedByUserId, offerId, commandPayload })).digest('hex').slice(0, 48)}`;
  }

  private buildCommandId(attempt: any): string {
    return `qty-${createHash('sha256').update(`${attempt.idempotencyKey}:${attempt.id}`).digest('hex').slice(0, 32)}`;
  }

  private decryptToken(encryptedText: string | null | undefined): string {
    if (!encryptedText) throw new HttpException('OAuth access token is missing for quantity command account', HttpStatus.CONFLICT);
    if (!this.encryptionKey || this.encryptionKey.length < 32) throw new HttpException('ENCRYPTION_KEY is not configured for OAuth token decrypt', HttpStatus.INTERNAL_SERVER_ERROR);
    const parts = String(encryptedText).split(':');
    if (parts.length !== 2) throw new HttpException('Invalid encrypted OAuth token format', HttpStatus.INTERNAL_SERVER_ERROR);
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32), 'utf8'), Buffer.from(parts[0], 'hex'));
    return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
  }

  private async markFailed(attemptId: string, code: string | number, message: string, details: unknown): Promise<any> {
    return (this.prisma as any).allegroQuantityCommandAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        failureContext: this.redact({ code, message, details }),
        remediationContext: { nextAction: 'Review policy snapshot, OAuth/account state, Allegro command status, and Warehouse ownership before retry.' },
      },
    });
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private withDerivedStatus(attempt: any): any {
    const isStale = attempt.staleAt && new Date(attempt.staleAt) < new Date() && !(TERMINAL_STATUSES as readonly string[]).includes(attempt.status);
    return { ...attempt, derivedStatus: isStale ? 'STALE' : attempt.status };
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
}
