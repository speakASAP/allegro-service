import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export const PUBLISH_LIFECYCLE_ACTIONS = ['PUBLISH', 'UPDATE', 'END'] as const;
export type PublishLifecycleAction = (typeof PUBLISH_LIFECYCLE_ACTIONS)[number];

export const PUBLISH_LIFECYCLE_STATUSES = [
  'PREPARED',
  'BLOCKED',
  'CONFIRMED',
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'STALE',
] as const;
export type PublishLifecycleStatus = (typeof PUBLISH_LIFECYCLE_STATUSES)[number];

export class PreparePublishAttemptDto {
  @IsIn(PUBLISH_LIFECYCLE_ACTIONS)
  action!: PublishLifecycleAction;

  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsOptional()
  @IsUUID()
  catalogProductId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  commandPayload?: Record<string, unknown>;
}

export class ConfirmPublishAttemptDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}

export class PublishAttemptQueryDto {
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsOptional()
  @IsUUID()
  catalogProductId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsIn(PUBLISH_LIFECYCLE_STATUSES)
  status?: PublishLifecycleStatus;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
