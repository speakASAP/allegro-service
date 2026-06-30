CREATE TABLE IF NOT EXISTS "allegro_quantity_command_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" VARCHAR(50) NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "requestedByUserId" VARCHAR(255) NOT NULL,
  "accountId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "allegroOfferId" VARCHAR(100) NOT NULL,
  "catalogProductId" UUID,
  "commandId" VARCHAR(255),
  "previousQuantity" INTEGER,
  "targetQuantity" INTEGER NOT NULL,
  "commandPayload" JSONB NOT NULL,
  "policySnapshot" JSONB NOT NULL,
  "blockedReasons" JSONB,
  "commandResponse" JSONB,
  "failureContext" JSONB,
  "remediationContext" JSONB,
  "preparedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(6),
  "queuedAt" TIMESTAMP(6),
  "startedAt" TIMESTAMP(6),
  "completedAt" TIMESTAMP(6),
  "staleAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allegro_quantity_command_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_idempotencyKey_key" ON "allegro_quantity_command_attempts"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_status_idx" ON "allegro_quantity_command_attempts"("status");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_accountId_idx" ON "allegro_quantity_command_attempts"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_offerId_idx" ON "allegro_quantity_command_attempts"("offerId");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_allegroOfferId_idx" ON "allegro_quantity_command_attempts"("allegroOfferId");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_catalogProductId_idx" ON "allegro_quantity_command_attempts"("catalogProductId");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_commandId_idx" ON "allegro_quantity_command_attempts"("commandId");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_createdAt_idx" ON "allegro_quantity_command_attempts"("createdAt");
CREATE INDEX IF NOT EXISTS "allegro_quantity_command_attempts_staleAt_idx" ON "allegro_quantity_command_attempts"("staleAt");

DO $$ BEGIN
  ALTER TABLE "allegro_quantity_command_attempts"
    ADD CONSTRAINT "allegro_quantity_command_attempts_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "allegro_quantity_command_attempts"
    ADD CONSTRAINT "allegro_quantity_command_attempts_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "allegro_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
