import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from '@allegro/shared';
import { AdminUsersService } from './admin-users.service';

@Controller('allegro/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('global:superadmin', 'app:allegro-service:admin')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async listUsers(@Req() req: any, @Query('limit') limitParam?: string, @Query('offset') offsetParam?: string) {
    const limit = Number.parseInt(limitParam || '100', 10);
    const offset = Number.parseInt(offsetParam || '0', 10);

    const data = await this.adminUsersService.listAllegroUsers({
      authorization: req.headers?.authorization,
      limit,
      offset,
    });

    return { success: true, data };
  }
}

@Controller('allegro/users')
export class AllegroUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post('register-access')
  @UseGuards(JwtAuthGuard)
  async registerAccess(@Req() req: any) {
    const data = await this.adminUsersService.registerWorkspaceAccess(req.user);
    return { success: true, data };
  }
}
