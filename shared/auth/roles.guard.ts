/**
 * Roles Guard - checks request.user.roles (set by JwtAuthGuard) against @Roles().
 * Use after JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('...')
 * Uses Reflect.getMetadata to avoid injecting Reflector (fixes DI when AuthModule is from shared package).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Use Reflect.getMetadata instead of Reflector to avoid DI resolution in shared package context
    const handlerMeta = Reflect.getMetadata(ROLES_KEY, context.getHandler()) as
      | { roles: string[]; requireAll?: boolean }
      | undefined;
    const classMeta = Reflect.getMetadata(ROLES_KEY, context.getClass()) as
      | { roles: string[]; requireAll?: boolean }
      | undefined;
    const rolesMetadata = handlerMeta ?? classMeta;

    if (!rolesMetadata?.roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];

    const requiredRoles = rolesMetadata.roles;
    const requireAll = rolesMetadata.requireAll ?? false;

    if (requireAll) {
      const hasAll = requiredRoles.every((r) => userRoles.includes(r));
      if (!hasAll) {
        throw new ForbiddenException('Insufficient permissions');
      }
    } else {
      const hasAny = requiredRoles.some((r) => userRoles.includes(r));
      if (!hasAny) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return true;
  }
}
