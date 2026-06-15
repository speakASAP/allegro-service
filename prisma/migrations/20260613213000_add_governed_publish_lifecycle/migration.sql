CREATE TABLE "allegro_publish_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "requestedByUserId" VARCHAR(255) NOT NULL,
  "accountId" UUID,
  "catalogProductId" UUID,
  "offerId" UUID,
  "allegroOfferId" VARCHAR(100),
  "commandId" VARCHAR(255),
  "commandPayload" JSONB,
  "policySnapshot" JSONB NOT NULL,
  "blockedReasons" JSONB,
  "failureContext" JSONB,
  "remediationContext" JSONB,
  "preparedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(6),
  "queuedAt" TIMESTAMP(6),
  "startedAt" TIMESTAMP(6),
  "completedAt" TIMESTAMP(6),
  "staleAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "allegro_publish_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allegro_publish_attempts_idempotencyKey_key" ON "allegro_publish_attempts"("idempotencyKey");
CREATE INDEX "allegro_publish_attempts_action_idx" ON "allegro_publish_attempts"("action");
CREATE INDEX "allegro_publish_attempts_status_idx" ON "allegro_publish_attempts"("status");
CREATE INDEX "allegro_publish_attempts_accountId_idx" ON "allegro_publish_attempts"("accountId");
CREATE INDEX "allegro_publish_attempts_catalogProductId_idx" ON "allegro_publish_attempts"("catalogProductId");
CREATE INDEX "allegro_publish_attempts_offerId_idx" ON "allegro_publish_attempts"("offerId");
CREATE INDEX "allegro_publish_attempts_allegroOfferId_idx" ON "allegro_publish_attempts"("allegroOfferId");
CREATE INDEX "allegro_publish_attempts_commandId_idx" ON "allegro_publish_attempts"("commandId");
CREATE INDEX "allegro_publish_attempts_createdAt_idx" ON "allegro_publish_attempts"("createdAt");
CREATE INDEX "allegro_publish_attempts_staleAt_idx" ON "allegro_publish_attempts"("staleAt");

ALTER TABLE "allegro_publish_attempts"
  ADD CONSTRAINT "allegro_publish_attempts_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "allegro_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "allegro_publish_attempts"
  ADD CONSTRAINT "allegro_publish_attempts_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
