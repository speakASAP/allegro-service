import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@allegro/shared';
import { OperationsService } from './operations.service';

@Controller('allegro/operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get()
  async summary(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const summary = await this.operationsService.getSummary(query);
    return { success: true, data: summary };
  }

  @Get('sync-runs')
  async syncRuns(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listSyncRuns(query);
    return { success: true, data: result };
  }

  @Get('sync-runs/:id')
  async syncRun(@Param('id') id: string): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.getSyncRun(id);
    return { success: true, data: result };
  }

  @Get('cursors')
  async cursors(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listCursors(query);
    return { success: true, data: result };
  }

  @Get('raw-payloads')
  async rawPayloads(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listRawPayloads(query);
    return { success: true, data: result };
  }

  @Get('projection-audit')
  async projectionAudit(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listProjectionAuditLogs(query);
    return { success: true, data: result };
  }

  @Get('order-forwarding-attempts')
  async orderForwardingAttempts(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listOrderForwardingAttempts(query);
    return { success: true, data: result };
  }

  @Get('quantity-command-attempts')
  async quantityCommandAttempts(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listQuantityCommandAttempts(query);
    return { success: true, data: result };
  }

  @Get('stock-snapshots')
  async stockSnapshots(@Query() query: any): Promise<{ success: boolean; data: any }> {
    const result = await this.operationsService.listStockSnapshots(query);
    return { success: true, data: result };
  }
}
