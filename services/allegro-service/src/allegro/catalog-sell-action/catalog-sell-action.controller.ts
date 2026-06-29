import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@allegro/shared';
import { BulkPrepareCatalogSellActionDto, ConfirmCatalogSellActionDto, PrepareCatalogSellActionDto } from './catalog-sell-action.dto';
import { CatalogSellActionService } from './catalog-sell-action.service';

@Controller('allegro/catalog-sell')
@UseGuards(JwtAuthGuard)
export class CatalogSellActionController {
  constructor(private readonly catalogSellActionService: CatalogSellActionService) {}

  @Post('prepare')
  async prepare(@Body() dto: PrepareCatalogSellActionDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.prepare(dto, userId);
    return { success: true, data };
  }

  @Post('bulk-prepare')
  async bulkPrepare(@Body() dto: BulkPrepareCatalogSellActionDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.bulkPrepare(dto, userId);
    return { success: true, data };
  }

  @Get('products/:catalogProductId/status')
  async getProductStatus(
    @Param('catalogProductId') catalogProductId: string,
    @Request() req: any,
  ): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.getProductStatus(catalogProductId, userId);
    return { success: true, data };
  }

  @Put('products/:catalogProductId/draft')
  async updateProductDraft(
    @Param('catalogProductId') catalogProductId: string,
    @Body() dto: PrepareCatalogSellActionDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.updateProductDraft(catalogProductId, dto, userId);
    return { success: true, data };
  }

  @Post('products/:catalogProductId/confirm')
  async confirmProductPublish(
    @Param('catalogProductId') catalogProductId: string,
    @Body() dto: ConfirmCatalogSellActionDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.confirmProductPublish(catalogProductId, userId, dto.previewToken);
    return { success: true, data };
  }

  @Post(':attemptId/confirm')
  async confirm(
    @Param('attemptId') attemptId: string,
    @Body() dto: ConfirmCatalogSellActionDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.confirm(attemptId, userId, dto.previewToken);
    return { success: true, data };
  }

  @Get(':attemptId/status')
  async getStatus(@Param('attemptId') attemptId: string): Promise<{ success: boolean; data: any }> {
    const data = await this.catalogSellActionService.getStatus(attemptId);
    return { success: true, data };
  }
}
