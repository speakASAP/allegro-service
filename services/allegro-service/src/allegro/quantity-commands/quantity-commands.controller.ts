import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@allegro/shared';
import { ConfirmQuantityCommandDto, PrepareQuantityCommandDto, QuantityCommandQueryDto } from './quantity-commands.dto';
import { QuantityCommandsService } from './quantity-commands.service';

@Controller('allegro/quantity-commands')
@UseGuards(JwtAuthGuard)
export class QuantityCommandsController {
  constructor(private readonly quantityCommandsService: QuantityCommandsService) {}

  @Post('prepare')
  async prepare(@Body() dto: PrepareQuantityCommandDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.quantityCommandsService.prepare(dto, userId);
    return { success: true, data: attempt };
  }

  @Post(':attemptId/confirm')
  async confirm(@Param('attemptId') attemptId: string, @Body() dto: ConfirmQuantityCommandDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.quantityCommandsService.confirm(attemptId, userId, dto.previewToken);
    return { success: true, data: attempt };
  }

  @Post(':attemptId/execute')
  async execute(@Param('attemptId') attemptId: string, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.quantityCommandsService.execute(attemptId, userId);
    return { success: true, data: attempt };
  }

  @Post(':attemptId/confirm-and-execute')
  async confirmAndExecute(@Param('attemptId') attemptId: string, @Body() dto: ConfirmQuantityCommandDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.quantityCommandsService.confirmAndExecute(attemptId, userId, dto.previewToken);
    return { success: true, data: attempt };
  }

  @Post(':attemptId/poll')
  async poll(@Param('attemptId') attemptId: string, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.quantityCommandsService.poll(attemptId, userId);
    return { success: true, data: attempt };
  }

  @Get()
  async list(@Query() query: QuantityCommandQueryDto): Promise<{ success: boolean; data: any }> {
    const attempts = await this.quantityCommandsService.listAttempts(query);
    return { success: true, data: attempts };
  }

  @Get(':attemptId')
  async getAttempt(@Param('attemptId') attemptId: string): Promise<{ success: boolean; data: any }> {
    const attempt = await this.quantityCommandsService.getAttempt(attemptId);
    return { success: true, data: attempt };
  }
}
