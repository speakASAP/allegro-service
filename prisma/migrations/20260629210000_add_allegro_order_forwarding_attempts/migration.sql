CREATE TABLE IF NOT EXISTS "allegro_order_forwarding_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "localOrderId" UUID NOT NULL,
  "accountId" UUID,
  "allegroOrderId" VARCHAR(100) NOT NULL,
  "channel" VARCHAR(50) NOT NULL DEFAULT 'allegro',
  "channelAccountId" VARCHAR(100) NOT NULL DEFAULT 'default',
  "externalOrderId" VARCHAR(100) NOT NULL,
  "contractVersion" VARCHAR(50) NOT NULL DEFAULT 'orders.create.v1',
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "payloadHash" VARCHAR(128),
  "payloadEqualityStatus" VARCHAR(50) NOT NULL DEFAULT 'NOT_APPLICABLE',
  "previousAttemptId" UUID,
  "status" VARCHAR(50) NOT NULL,
  "blockedReasons" JSONB,
  "missingOfferIds" JSONB,
  "missingCatalogOfferIds" JSONB,
  "requestSummary" JSONB,
  "responseSummary" JSONB,
  "errorSummary" JSONB,
  "attemptedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "allegro_order_forwarding_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_idempotencyKey_key"
  ON "allegro_order_forwarding_attempts"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_localOrderId_idx"
  ON "allegro_order_forwarding_attempts"("localOrderId");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_accountId_idx"
  ON "allegro_order_forwarding_attempts"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_allegroOrderId_idx"
  ON "allegro_order_forwarding_attempts"("allegroOrderId");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_channel_channelAccountId_externalOrderId_idx"
  ON "allegro_order_forwarding_attempts"("channel", "channelAccountId", "externalOrderId");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_payloadHash_idx"
  ON "allegro_order_forwarding_attempts"("payloadHash");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_payloadEqualityStatus_idx"
  ON "allegro_order_forwarding_attempts"("payloadEqualityStatus");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_status_idx"
  ON "allegro_order_forwarding_attempts"("status");
CREATE INDEX IF NOT EXISTS "allegro_order_forwarding_attempts_attemptedAt_idx"
  ON "allegro_order_forwarding_attempts"("attemptedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_order_forwarding_attempts_localOrderId_fkey'
  ) THEN
    ALTER TABLE "allegro_order_forwarding_attempts"
      ADD CONSTRAINT "allegro_order_forwarding_attempts_localOrderId_fkey"
      FOREIGN KEY ("localOrderId") REFERENCES "allegro_orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_order_forwarding_attempts_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_order_forwarding_attempts"
      ADD CONSTRAINT "allegro_order_forwarding_attempts_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
