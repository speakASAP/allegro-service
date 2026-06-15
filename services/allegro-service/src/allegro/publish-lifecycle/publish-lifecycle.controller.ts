import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@allegro/shared';
import { ConfirmPublishAttemptDto, PreparePublishAttemptDto, PublishAttemptQueryDto } from './publish-lifecycle.dto';
import { PublishLifecycleService } from './publish-lifecycle.service';

@Controller('allegro/publish-lifecycle')
@UseGuards(JwtAuthGuard)
export class PublishLifecycleController {
  constructor(private readonly publishLifecycleService: PublishLifecycleService) {}

  @Post('prepare')
  async prepare(@Body() dto: PreparePublishAttemptDto, @Request() req: any): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.publishLifecycleService.prepare(dto, userId);
    return { success: true, data: attempt };
  }

  @Post(':attemptId/confirm')
  async confirm(
    @Param('attemptId') attemptId: string,
    @Body() _dto: ConfirmPublishAttemptDto,
    @Request() req: any,
  ): Promise<{ success: boolean; data: any }> {
    const userId = String(req.user?.id || req.user?.sub || 'unknown');
    const attempt = await this.publishLifecycleService.confirm(attemptId, userId);
    return { success: true, data: attempt };
  }

  @Get('monitoring')
  async monitoring(): Promise<{ success: boolean; data: any }> {
    const summary = await this.publishLifecycleService.monitoringSummary();
    return { success: true, data: summary };
  }

  @Get()
  async list(@Query() query: PublishAttemptQueryDto): Promise<{ success: boolean; data: any }> {
    const attempts = await this.publishLifecycleService.listAttempts(query);
    return { success: true, data: attempts };
  }

  @Get(':attemptId')
  async getAttempt(@Param('attemptId') attemptId: string): Promise<{ success: boolean; data: any }> {
    const attempt = await this.publishLifecycleService.getAttempt(attemptId);
    return { success: true, data: attempt };
  }
}
