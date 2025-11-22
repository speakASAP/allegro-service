/**
 * Health Controller
 */

import { Controller, Get } from '@nestjs/common';
import { HealthService } from '@allegro/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth('allegro-settings-service');
  }
}

