import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@allegro/shared';
import { BulkPrepareCatalogSellActionDto, PrepareCatalogSellActionDto } from './catalog-sell-action.dto';
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

  @Post(':attemptId/confirm')
  async confirm(@Param('attemptId') attemptId: string, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const data = await this.catalogSellActionService.confirm(attemptId, userId);
    return { success: true, data };
  }

  @Get(':attemptId/status')
  async getStatus(@Param('attemptId') attemptId: string): Promise<{ success: boolean; data: any }> {
    const data = await this.catalogSellActionService.getStatus(attemptId);
    return { success: true, data };
  }
}
