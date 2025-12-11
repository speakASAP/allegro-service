import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService, LoggerService } from '@allegro/shared';

interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
}

interface ProductPayload {
  allegroProductId?: string;
  name?: string;
  brand?: string;
  manufacturerCode?: string;
  ean?: string;
  publicationStatus?: string;
  isAiCoCreated?: boolean;
  marketedBeforeGPSR?: boolean | null;
  rawData?: any;
  parameters?: Array<{
    parameterId: string;
    name?: string;
    values?: any;
    valuesIds?: any;
    rangeValue?: any;
  }>;
}

@Injectable()
export class ProductsService {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('ProductsService');
  }

  async getProducts(query: ProductQuery) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { manufacturerCode: { contains: search, mode: 'insensitive' } },
        { ean: { contains: search, mode: 'insensitive' } },
        { allegroProductId: { contains: search, mode: 'insensitive' } },
      ];
    }

    this.logger.log('[getProducts] Fetching products', { page, limit, search });

    const [items, total] = await Promise.all([
      this.prisma.allegroProduct.findMany({
        where,
        skip,
        take: limit,
        include: { parameters: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.allegroProduct.count({ where }),
    ]);

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

  async getProduct(id: string) {
    const product = await this.prisma.allegroProduct.findUnique({
      where: { id },
      include: { parameters: true },
    });

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    return product;
  }

  async createProduct(payload: ProductPayload) {
    if (!payload.rawData) {
      throw new HttpException('rawData is required', HttpStatus.BAD_REQUEST);
    }

    const created = await this.prisma.allegroProduct.create({
      data: {
        allegroProductId: payload.allegroProductId || payload.rawData?.product?.id || payload.rawData?.id || undefined,
        name: payload.name ?? payload.rawData?.product?.name ?? null,
        brand: payload.brand ?? payload.rawData?.product?.brand ?? null,
        manufacturerCode: payload.manufacturerCode ?? payload.rawData?.product?.manufacturerCode ?? null,
        ean: payload.ean ?? payload.rawData?.product?.ean ?? null,
        publicationStatus: payload.publicationStatus ?? payload.rawData?.product?.publication?.status ?? null,
        isAiCoCreated: payload.isAiCoCreated ?? !!payload.rawData?.product?.isAiCoCreated,
        marketedBeforeGPSR: payload.marketedBeforeGPSR ?? payload.rawData?.marketedBeforeGPSRObligation ?? null,
        rawData: payload.rawData,
      } as any,
      include: { parameters: true },
    });

    if (payload.parameters?.length) {
      await this.replaceParameters(created.id, payload.parameters);
    } else if (Array.isArray(payload.rawData?.product?.parameters)) {
      await this.replaceParameters(created.id, payload.rawData.product.parameters);
    }

    return this.getProduct(created.id);
  }

  async updateProduct(id: string, payload: ProductPayload) {
    const existing = await this.prisma.allegroProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.allegroProduct.update({
      where: { id },
      data: {
        allegroProductId: payload.allegroProductId ?? existing.allegroProductId,
        name: payload.name ?? existing.name,
        brand: payload.brand ?? existing.brand,
        manufacturerCode: payload.manufacturerCode ?? existing.manufacturerCode,
        ean: payload.ean ?? existing.ean,
        publicationStatus: payload.publicationStatus ?? existing.publicationStatus,
        isAiCoCreated: payload.isAiCoCreated ?? existing.isAiCoCreated,
        marketedBeforeGPSR: payload.marketedBeforeGPSR ?? existing.marketedBeforeGPSR,
        rawData: payload.rawData ?? existing.rawData,
      } as any,
    });

    if (payload.parameters) {
      await this.replaceParameters(id, payload.parameters);
    }

    return this.getProduct(id);
  }

  async deleteProduct(id: string) {
    await this.prisma.allegroProduct.delete({ where: { id } });
    return { success: true };
  }

  private async replaceParameters(productId: string, parameters: any[]) {
    await this.prisma.allegroProductParameter.deleteMany({ where: { allegroProductId: productId } });
    if (parameters.length === 0) {
      return;
    }
    const data = parameters.map((param: any, index: number) => ({
      allegroProductId: productId,
      parameterId: param.parameterId || param.id || `param-${index}`,
      name: param.name || null,
      values: param.values || null,
      valuesIds: param.valuesIds || null,
      rangeValue: param.rangeValue || null,
    }));
    await this.prisma.allegroProductParameter.createMany({
      data: data as any,
      skipDuplicates: true,
    });
  }
}

