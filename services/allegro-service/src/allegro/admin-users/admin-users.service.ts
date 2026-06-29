import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService, PrismaService, AuthUser } from '@allegro/shared';

type AuthAdminApplicationSummary = {
  id: string;
  name: string;
  displayName?: string | null;
  roles?: string[];
};

type AuthAdminUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  userType?: string;
  createdAt?: string;
  updatedAt?: string;
  applications?: AuthAdminApplicationSummary[];
  adminApplications?: AuthAdminApplicationSummary[];
};

type LocalUserActivity = {
  userId: string;
  sources: Set<string>;
  accountCount: number;
  settingsCount: number;
  publishAttemptCount: number;
  lastActivityAt?: string;
};

type UserListParams = {
  authorization?: string;
  limit?: number;
  offset?: number;
};

const ALLEGRO_APPLICATION_NAME = 'allegro-service';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const MAX_ADMIN_SCAN = 1000;

@Injectable()
export class AdminUsersService {
  private readonly authServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || this.throwConfigError('AUTH_SERVICE_URL');
    this.logger.setContext(AdminUsersService.name);
  }

  async listAllegroUsers(params: UserListParams) {
    const limit = this.clampLimit(params.limit);
    const offset = Math.max(Number(params.offset || 0), 0);
    const localUsers = await this.loadLocalUserActivity();
    const admins = await this.loadAllegroAdmins(params.authorization);
    const adminIds = new Set(admins.map((admin) => admin.id));

    const regularUsers = localUsers.filter((user) => !adminIds.has(user.userId));
    const pagedUsers = regularUsers.slice(offset, offset + limit);
    const profiles = await this.loadAuthProfiles(pagedUsers.map((user) => user.userId), params.authorization);

    const users = pagedUsers.map((activity) => {
      const profile = profiles.get(activity.userId);
      return {
        id: activity.userId,
        email: profile?.email || null,
        firstName: profile?.firstName || null,
        lastName: profile?.lastName || null,
        phone: profile?.phone || null,
        isActive: profile?.isActive ?? true,
        isVerified: profile?.isVerified ?? false,
        userType: profile?.userType || 'allegro_user',
        createdAt: profile?.createdAt || activity.lastActivityAt || null,
        updatedAt: profile?.updatedAt || activity.lastActivityAt || null,
        allegro: {
          sources: Array.from(activity.sources).sort(),
          accountCount: activity.accountCount,
          settingsCount: activity.settingsCount,
          publishAttemptCount: activity.publishAttemptCount,
          lastActivityAt: activity.lastActivityAt || null,
        },
      };
    });

    return {
      application: {
        name: ALLEGRO_APPLICATION_NAME,
        displayName: 'Allegro Service',
      },
      users: {
        items: users,
        count: regularUsers.length,
        limit,
        offset,
      },
      admins: {
        items: admins,
        count: admins.length,
      },
    };
  }

  async registerWorkspaceAccess(user: AuthUser) {
    const userId = this.normalizeUserId(user?.id);
    if (!userId) {
      throw new Error('Authenticated user ID is required');
    }

    const prismaAny = this.prisma as any;
    const existing = await prismaAny.userSettings.findUnique({ where: { userId } });
    const existingPreferences =
      existing?.preferences && typeof existing.preferences === 'object' && !Array.isArray(existing.preferences)
        ? existing.preferences
        : {};
    const now = new Date().toISOString();

    await prismaAny.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        preferences: {
          ...existingPreferences,
          allegroWorkspaceRegisteredAt: now,
          allegroWorkspaceLastSeenAt: now,
        },
      },
      update: {
        preferences: {
          ...existingPreferences,
          allegroWorkspaceRegisteredAt: existingPreferences.allegroWorkspaceRegisteredAt || now,
          allegroWorkspaceLastSeenAt: now,
        },
      },
    });

    return {
      registered: true,
      userId,
    };
  }

  private async loadLocalUserActivity(): Promise<LocalUserActivity[]> {
    const prismaAny = this.prisma as any;
    const [accounts, settings, publishAttempts] = await Promise.all([
      prismaAny.allegroAccount.groupBy({
        by: ['userId'],
        where: { userId: { notIn: ['', 'unknown', 'undefined', 'null'] } },
        _count: { _all: true },
        _max: { createdAt: true, updatedAt: true },
      }),
      prismaAny.userSettings.groupBy({
        by: ['userId'],
        where: { userId: { notIn: ['', 'unknown', 'undefined', 'null'] } },
        _count: { _all: true },
        _max: { createdAt: true, updatedAt: true },
      }),
      prismaAny.allegroPublishAttempt.groupBy({
        by: ['requestedByUserId'],
        where: { requestedByUserId: { notIn: ['', 'unknown', 'undefined', 'null'] } },
        _count: { _all: true },
        _max: { createdAt: true, updatedAt: true },
      }),
    ]);

    const users = new Map<string, LocalUserActivity>();

    for (const account of accounts) {
      this.addActivity(users, account.userId, 'allegro_account', account._count?._all || 0, this.latestDate(account._max?.updatedAt, account._max?.createdAt));
    }

    for (const setting of settings) {
      this.addActivity(users, setting.userId, 'workspace_access', setting._count?._all || 0, this.latestDate(setting._max?.updatedAt, setting._max?.createdAt));
    }

    for (const attempt of publishAttempts) {
      this.addActivity(users, attempt.requestedByUserId, 'publish_attempt', attempt._count?._all || 0, this.latestDate(attempt._max?.updatedAt, attempt._max?.createdAt));
    }

    return Array.from(users.values()).sort((a, b) => {
      const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
      const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
      return bTime - aTime || a.userId.localeCompare(b.userId);
    });
  }

  private addActivity(
    users: Map<string, LocalUserActivity>,
    rawUserId: string,
    source: string,
    count: number,
    lastActivityAt?: string,
  ): void {
    const userId = this.normalizeUserId(rawUserId);
    if (!userId) {
      return;
    }

    if (!users.has(userId)) {
      users.set(userId, {
        userId,
        sources: new Set<string>(),
        accountCount: 0,
        settingsCount: 0,
        publishAttemptCount: 0,
      });
    }

    const record = users.get(userId);
    record.sources.add(source);
    if (source === 'allegro_account') {
      record.accountCount += count;
    } else if (source === 'workspace_access') {
      record.settingsCount += count;
    } else if (source === 'publish_attempt') {
      record.publishAttemptCount += count;
    }

    record.lastActivityAt = this.maxIsoDate(record.lastActivityAt, lastActivityAt);
  }

  private async loadAuthProfiles(userIds: string[], authorization?: string): Promise<Map<string, AuthAdminUser>> {
    const profiles = new Map<string, AuthAdminUser>();
    if (!authorization || userIds.length === 0) {
      return profiles;
    }

    const requests = userIds.map(async (userId) => {
      try {
        const response = await firstValueFrom(
          this.httpService.get<{ success?: boolean; user?: AuthAdminUser }>(
            `${this.authServiceUrl}/auth/admin/users/${encodeURIComponent(userId)}`,
            {
              headers: { Authorization: authorization },
              timeout: this.authTimeout(),
            },
          ),
        );
        if (response.data?.user) {
          profiles.set(userId, response.data.user);
        }
      } catch (error: any) {
        this.logger.warn('Unable to load Auth user profile for Allegro admin list', {
          userId,
          status: error.response?.status,
          message: error.message,
        });
      }
    });

    await Promise.all(requests);
    return profiles;
  }

  private async loadAllegroAdmins(authorization?: string): Promise<any[]> {
    if (!authorization) {
      return [];
    }

    const admins: any[] = [];
    let offset = 0;
    let total = 0;

    do {
      const response = await firstValueFrom(
        this.httpService.get<{ users?: AuthAdminUser[]; count?: number; limit?: number; offset?: number }>(
          `${this.authServiceUrl}/auth/admin/users`,
          {
            headers: { Authorization: authorization },
            params: {
              adminOnly: 'yes',
              limit: DEFAULT_LIMIT,
              offset,
            },
            timeout: this.authTimeout(),
          },
        ),
      );

      const users = response.data?.users || [];
      total = response.data?.count || users.length;

      users
        .filter((user) => this.hasAllegroAdminApplication(user))
        .forEach((user) => {
          const allegroAdminApps = (user.adminApplications || []).filter((app) => app.name === ALLEGRO_APPLICATION_NAME);
          admins.push({
            id: user.id,
            email: user.email || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            phone: user.phone || null,
            isActive: user.isActive ?? true,
            isVerified: user.isVerified ?? false,
            userType: user.userType || 'admin',
            createdAt: user.createdAt || null,
            updatedAt: user.updatedAt || null,
            roles: Array.from(new Set(allegroAdminApps.flatMap((app) => app.roles || []))).sort(),
            applications: allegroAdminApps,
          });
        });

      offset += DEFAULT_LIMIT;
    } while (offset < total && offset < MAX_ADMIN_SCAN);

    return admins.sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id));
  }

  private hasAllegroAdminApplication(user: AuthAdminUser): boolean {
    return Boolean((user.adminApplications || []).some((app) => app.name === ALLEGRO_APPLICATION_NAME));
  }

  private latestDate(...values: Array<Date | string | null | undefined>): string | undefined {
    return values
      .map((value) => (value ? new Date(value).toISOString() : undefined))
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop();
  }

  private maxIsoDate(a?: string, b?: string): string | undefined {
    if (!a) return b;
    if (!b) return a;
    return Date.parse(b) > Date.parse(a) ? b : a;
  }

  private normalizeUserId(userId?: string | null): string {
    const normalized = String(userId || '').trim();
    if (!normalized || ['unknown', 'undefined', 'null'].includes(normalized.toLowerCase())) {
      return '';
    }
    return normalized;
  }

  private clampLimit(limit?: number): number {
    if (!Number.isFinite(limit || 0)) {
      return DEFAULT_LIMIT;
    }
    return Math.min(Math.max(Number(limit), 1), MAX_LIMIT);
  }

  private authTimeout(): number {
    return Number(this.configService.get<string>('AUTH_SERVICE_TIMEOUT') || this.configService.get<string>('HTTP_TIMEOUT') || '10000');
  }

  private throwConfigError(name: string): never {
    throw new Error(`${name} must be configured`);
  }
}
