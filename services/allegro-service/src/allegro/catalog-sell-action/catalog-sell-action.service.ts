import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CatalogClientService, LoggerService, PrismaService } from '@allegro/shared';
import { OffersService } from '../offers/offers.service';
import { PublishLifecycleService } from '../publish-lifecycle/publish-lifecycle.service';
import { BulkPrepareCatalogSellActionDto, PrepareCatalogSellActionDto } from './catalog-sell-action.dto';

@Injectable()
export class CatalogSellActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly offersService: OffersService,
    private readonly publishLifecycleService: PublishLifecycleService,
    private readonly catalogClient: CatalogClientService,
  ) {
    this.logger.setContext('CatalogSellActionService');
  }

  async prepare(dto: PrepareCatalogSellActionDto, requestedByUserId: string): Promise<any> {
    const catalogProduct = await this.loadCatalogProduct(dto.catalogProductId);
    const accountChoices = await this.listAccountChoices(requestedByUserId);
    const selectedAccountId = dto.accountId || accountChoices[0]?.id || null;

    let draft = dto.forceNewDraft
      ? null
      : await this.findReusableDraft(dto, requestedByUserId, selectedAccountId);
    const draftCreated = !draft;

    if (!draft) {
      draft = await this.createDraftFromCatalog(dto, catalogProduct, selectedAccountId, requestedByUserId);
    }

    const attempt = await this.publishLifecycleService.prepare(
      {
        action: 'PUBLISH',
        offerId: draft.id,
        accountId: selectedAccountId || draft.accountId || null,
        catalogProductId: dto.catalogProductId,
        idempotencyKey: dto.idempotencyKey,
        commandPayload: {
          source: 'catalog-sell-action',
          catalogProductId: dto.catalogProductId,
          localDraftOfferId: draft.id,
        },
      },
      requestedByUserId,
    );

    return {
      status: attempt.status,
      nextAction: this.deriveNextAction(attempt),
      draftCreated,
      draft: this.toDraftSummary(draft),
      attempt,
      accountChoices,
      categoryChoice: this.buildCategoryChoice(dto, draft, catalogProduct),
      catalogProduct: this.toCatalogSummary(catalogProduct),
    };
  }

  async bulkPrepare(dto: BulkPrepareCatalogSellActionDto, requestedByUserId: string): Promise<any> {
    const results = [] as any[];
    const perAccountCount = new Map<string, number>();

    for (const item of dto.items) {
      const prepared = await this.prepare(item, requestedByUserId);
      const accountKey = prepared.attempt.accountId || 'no-account';
      const slotOffsetSeconds = perAccountCount.get(accountKey) || 0;
      perAccountCount.set(accountKey, slotOffsetSeconds + 1);
      results.push({
        ...prepared,
        rateLimitSlot: {
          accountId: prepared.attempt.accountId || null,
          slotOffsetSeconds,
        },
      });
    }

    return {
      total: results.length,
      results,
      accountRateLimitPlan: Array.from(perAccountCount.entries()).map(([accountId, count]) => ({
        accountId: accountId == 'no-account' ? null : accountId,
        maxOneRequestPerSecond: true,
        reservedSlots: count,
      })),
    };
  }

  async confirm(attemptId: string, requestedByUserId: string): Promise<any> {
    const attempt = await this.publishLifecycleService.confirm(attemptId, requestedByUserId);
    const draft = attempt.offerId ? await (this.prisma as any).allegroOffer.findUnique({ where: { id: attempt.offerId } }) : null;

    return {
      status: attempt.status,
      nextAction: this.deriveNextAction(attempt),
      attempt,
      draft: this.toDraftSummary(draft),
    };
  }

  async getStatus(attemptId: string): Promise<any> {
    const attempt = await this.publishLifecycleService.getAttempt(attemptId);
    const draft = attempt.offerId ? await (this.prisma as any).allegroOffer.findUnique({ where: { id: attempt.offerId } }) : null;

    return {
      status: attempt.status,
      nextAction: this.deriveNextAction(attempt),
      attempt,
      draft: this.toDraftSummary(draft),
    };
  }

  async getProductStatus(catalogProductId: string, requestedByUserId: string): Promise<any> {
    const accountChoices = await this.listAccountChoices(requestedByUserId);
    const accountIds = accountChoices.map((account) => account.id).filter(Boolean);
    const prismaAny = this.prisma as any;
    const catalogProduct = await this.loadCatalogProduct(catalogProductId).catch((error) => {
      this.logger.warn('Failed to load catalog product while reading Allegro sell-action status', {
        catalogProductId,
        error: error.message,
      });
      return null;
    });
    const draft = await prismaAny.allegroOffer.findFirst({
      where: {
        catalogProductId,
        ...(accountIds.length ? { accountId: { in: accountIds } } : { accountId: null }),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const attempt = await prismaAny.allegroPublishAttempt.findFirst({
      where: {
        catalogProductId,
        requestedByUserId,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      status: attempt?.status || draft?.publicationStatus || null,
      nextAction: attempt ? this.deriveNextAction(attempt) : draft ? 'confirm_publish' : 'prepare_draft',
      draft: this.toDraftSummary(draft),
      attempt: attempt || null,
      accountChoices,
      categoryChoice: this.buildCategoryChoice({ catalogProductId } as any, draft, catalogProduct),
      catalogProduct: this.toCatalogSummary(catalogProduct),
      listingUrl: this.toListingUrl(draft),
      canEditDraft: Boolean(draft && !['ACTIVE'].includes(String(draft.publicationStatus || '').toUpperCase())),
      canConfirmPublish: Boolean(attempt && attempt.status === 'PREPARED'),
    };
  }

  async updateProductDraft(catalogProductId: string, dto: PrepareCatalogSellActionDto, requestedByUserId: string): Promise<any> {
    const current = await this.getProductStatus(catalogProductId, requestedByUserId);
    const draftId = dto.offerId || current.draft?.id;
    if (!draftId) {
      throw new HttpException('Prepare an Allegro draft before editing the product presentation', HttpStatus.CONFLICT);
    }

    const updatePayload = this.toDraftUpdatePayload(dto);
    if (Object.keys(updatePayload).length > 0) {
      await this.offersService.updateOffer(draftId, { ...updatePayload, syncToAllegro: false }, requestedByUserId);
    }

    const draft = await (this.prisma as any).allegroOffer.findUnique({ where: { id: draftId } });
    return {
      status: current.attempt?.status || draft?.publicationStatus || null,
      nextAction: current.attempt ? this.deriveNextAction(current.attempt) : 'confirm_publish',
      draft: this.toDraftSummary(draft),
      attempt: current.attempt || null,
      listingUrl: this.toListingUrl(draft),
      canEditDraft: Boolean(draft && !['ACTIVE'].includes(String(draft.publicationStatus || '').toUpperCase())),
      canConfirmPublish: Boolean(current.attempt && current.attempt.status === 'PREPARED'),
    };
  }

  async confirmProductPublish(catalogProductId: string, requestedByUserId: string): Promise<any> {
    const current = await this.getProductStatus(catalogProductId, requestedByUserId);
    if (!current.attempt?.id) {
      throw new HttpException('Prepare an Allegro publish attempt before confirmation', HttpStatus.CONFLICT);
    }
    return this.confirm(current.attempt.id, requestedByUserId);
  }

  private async loadCatalogProduct(catalogProductId: string): Promise<any> {
    try {
      const catalogProduct = await this.catalogClient.getProductById(catalogProductId);
      return await this.enrichCatalogProductForAllegro(catalogProduct);
    } catch (error: any) {
      throw new HttpException(
        `Failed to load catalog product ${catalogProductId}: ${error.message}`,
        error.status || error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async enrichCatalogProductForAllegro(catalogProduct: any): Promise<any> {
    let marketplaceFields: any = null;
    let currentPricing: any = null;

    try {
      marketplaceFields = await this.catalogClient.getProductMarketplaceFields(catalogProduct.id, 'allegro');
    } catch (error: any) {
      this.logger.warn('Failed to load Allegro marketplace fields for catalog sell-action', {
        catalogProductId: catalogProduct.id,
        error: error.message,
      });
    }

    try {
      currentPricing = await this.catalogClient.getProductPricing(catalogProduct.id);
    } catch (error: any) {
      this.logger.warn('Failed to load Catalog pricing for catalog sell-action', {
        catalogProductId: catalogProduct.id,
        error: error.message,
      });
    }

    const profile = marketplaceFields?.profile || null;
    const overrides = profile?.overrides || {};
    const overridePrice = overrides.price !== undefined && overrides.price !== null ? Number(overrides.price) : null;
    const priceAmount = Number.isFinite(overridePrice) && overridePrice > 0
      ? overridePrice
      : this.toNonNegativeNumber(currentPricing?.salePrice, currentPricing?.basePrice, catalogProduct?.price?.gross, catalogProduct?.price);
    const overrideQuantity = overrides.quantity !== undefined && overrides.quantity !== null ? Number(overrides.quantity) : undefined;

    return {
      ...catalogProduct,
      allegroCategoryId: overrides.categoryId || catalogProduct?.allegroCategoryId || null,
      price: priceAmount > 0 ? {
        gross: priceAmount,
        currency: String(overrides.currency || currentPricing?.currency || catalogProduct?.currency || 'CZK').toUpperCase(),
      } : catalogProduct?.price,
      currency: String(overrides.currency || currentPricing?.currency || catalogProduct?.currency || 'CZK').toUpperCase(),
      quantity: Number.isFinite(overrideQuantity) ? overrideQuantity : catalogProduct?.quantity,
      stockQuantity: Number.isFinite(overrideQuantity) ? overrideQuantity : catalogProduct?.stockQuantity,
      images: Array.isArray(overrides.images) && overrides.images.length > 0 ? overrides.images : catalogProduct?.images,
      marketplaceProfiles: {
        ...(catalogProduct?.marketplaceProfiles || {}),
        allegro: profile,
      },
    };
  }

  private async listAccountChoices(requestedByUserId: string): Promise<any[]> {
    const prismaAny = this.prisma as any;
    const accounts = await prismaAny.allegroAccount.findMany({
      where: { userId: requestedByUserId, isActive: true },
      select: {
        id: true,
        name: true,
        isActive: true,
        tokenExpiresAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });

    return accounts.map((account: any) => ({
      id: account.id,
      name: account.name,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
    }));
  }

  private async findReusableDraft(
    dto: PrepareCatalogSellActionDto,
    requestedByUserId: string,
    selectedAccountId: string | null,
  ): Promise<any | null> {
    const prismaAny = this.prisma as any;
    if (dto.offerId) {
      return prismaAny.allegroOffer.findFirst({
        where: {
          id: dto.offerId,
          account: dto.accountId || selectedAccountId ? { id: dto.accountId || selectedAccountId, userId: requestedByUserId } : undefined,
        },
      });
    }

    return prismaAny.allegroOffer.findFirst({
      where: {
        catalogProductId: dto.catalogProductId,
        accountId: selectedAccountId || undefined,
        publicationStatus: { in: ['INACTIVE', 'ENDED'] },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  private async createDraftFromCatalog(
    dto: PrepareCatalogSellActionDto,
    catalogProduct: any,
    accountId: string | null,
    requestedByUserId: string,
  ): Promise<any> {
    const mapped = this.mapCatalogProductToLocalDraft(dto, catalogProduct, accountId, requestedByUserId);
    const draft = await this.offersService.createOffer(mapped, requestedByUserId);
    if (accountId && draft.accountId !== accountId) {
      return (this.prisma as any).allegroOffer.update({
        where: { id: draft.id },
        data: { accountId },
      });
    }
    return draft;
  }

  private mapCatalogProductToLocalDraft(
    dto: PrepareCatalogSellActionDto,
    catalogProduct: any,
    accountId: string | null,
    requestedByUserId: string,
  ): Record<string, unknown> {
    const images = this.extractImageUrls(catalogProduct);
    const allegroOverrides = catalogProduct?.marketplaceProfiles?.allegro?.overrides || {};
    const title = dto.title || catalogProduct?.title || catalogProduct?.name || `Catalog product ${dto.catalogProductId}`;
    const description = dto.description || catalogProduct?.description || catalogProduct?.shortDescription || null;
    const categoryId = dto.categoryId || allegroOverrides.categoryId || catalogProduct?.allegroCategoryId || catalogProduct?.categoryId || 'UNASSIGNED';
    const quantity = this.toNonNegativeNumber(dto.quantity, allegroOverrides.quantity, catalogProduct?.stockQuantity, catalogProduct?.quantity, catalogProduct?.stock, 0);
    const price = this.toNonNegativeNumber(dto.price, allegroOverrides.price, catalogProduct?.price?.gross, catalogProduct?.price, catalogProduct?.salePrice, 0);
    const currency = allegroOverrides.currency || catalogProduct?.price?.currency || catalogProduct?.currency || 'PLN';

    return {
      title,
      description,
      categoryId,
      price,
      quantity,
      stockQuantity: quantity,
      currency,
      images,
      status: 'DRAFT',
      publicationStatus: 'INACTIVE',
      catalogProductId: dto.catalogProductId,
      accountId,
      syncToAllegro: false,
      rawData: {
        source: 'catalog-sell-action',
        createdBy: 'TASK-004',
        requestedByUserId,
        catalogSnapshot: {
          id: catalogProduct?.id || dto.catalogProductId,
          sku: catalogProduct?.sku || null,
          title,
          brand: catalogProduct?.brand || null,
          ean: catalogProduct?.ean || null,
          price,
          currency,
          quantity,
          imageCount: images.length,
          selectedCategoryId: categoryId,
        },
      },
    };
  }

  private extractImageUrls(catalogProduct: any): string[] {
    const candidates = [
      ...(Array.isArray(catalogProduct?.marketplaceProfiles?.allegro?.overrides?.images) ? catalogProduct.marketplaceProfiles.allegro.overrides.images : []),
      ...(Array.isArray(catalogProduct?.images) ? catalogProduct.images : []),
      ...(Array.isArray(catalogProduct?.media) ? catalogProduct.media : []),
    ];

    return candidates
      .map((entry: any) => {
        if (typeof entry === 'string') return entry;
        if (typeof entry?.url === 'string') return entry.url;
        if (typeof entry?.src === 'string') return entry.src;
        return null;
      })
      .filter((value: string | null): value is string => !!value)
      .slice(0, 16);
  }

  private toNonNegativeNumber(...values: unknown[]): number {
    for (const value of values) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric;
      }
    }
    return 0;
  }

  private buildCategoryChoice(dto: PrepareCatalogSellActionDto, draft: any, catalogProduct: any): any {
    const profileCategoryId = catalogProduct?.marketplaceProfiles?.allegro?.overrides?.categoryId;
    const selectedCategoryId = dto.categoryId || draft?.categoryId || profileCategoryId || catalogProduct?.allegroCategoryId || catalogProduct?.categoryId || null;
    return {
      selectedCategoryId,
      source: dto.categoryId
        ? 'request'
        : draft?.categoryId && draft.categoryId != 'UNASSIGNED'
          ? 'existing-draft'
          : profileCategoryId
            ? 'catalog-allegro-marketplace-profile'
            : catalogProduct?.allegroCategoryId || catalogProduct?.categoryId
            ? 'catalog'
            : '[MISSING: catalog category mapping contract]',
    };
  }

  private toDraftSummary(draft: any): any {
    if (!draft) return null;
    return {
      id: draft.id,
      accountId: draft.accountId || null,
      catalogProductId: draft.catalogProductId || null,
      allegroOfferId: draft.allegroOfferId || null,
      title: draft.title,
      description: draft.description || null,
      categoryId: draft.categoryId,
      price: draft.price,
      currency: draft.currency,
      quantity: draft.quantity,
      stockQuantity: draft.stockQuantity,
      publicationStatus: draft.publicationStatus,
      status: draft.status,
      updatedAt: draft.updatedAt,
    };
  }

  private toDraftUpdatePayload(dto: PrepareCatalogSellActionDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of ['title', 'description', 'categoryId', 'price', 'quantity'] as const) {
      if (dto[field] !== undefined) {
        payload[field] = dto[field];
      }
    }
    if (dto.quantity !== undefined) {
      payload.stockQuantity = dto.quantity;
    }
    return payload;
  }

  private toListingUrl(draft: any): string | null {
    const offerId = draft?.allegroOfferId || draft?.allegroListingId;
    if (!offerId) return null;
    return `https://allegro.cz/nabidka/${offerId}`;
  }

  private toCatalogSummary(catalogProduct: any): any {
    if (!catalogProduct) return null;
    return {
      id: catalogProduct.id || null,
      sku: catalogProduct.sku || null,
      title: catalogProduct.title || catalogProduct.name || null,
      brand: catalogProduct.brand || null,
      ean: catalogProduct.ean || null,
    };
  }

  private deriveNextAction(attempt: any): string {
    if (attempt.status === 'BLOCKED') return 'resolve_blockers';
    if (attempt.status === 'PREPARED') return 'confirm_publish';
    if (attempt.status === 'QUEUED' || attempt.status === 'RUNNING') return 'monitor_publish_queue';
    if (attempt.status === 'SUCCEEDED') return 'completed';
    if (attempt.status === 'FAILED') return 'review_failure';
    return 'inspect_status';
  }
}
