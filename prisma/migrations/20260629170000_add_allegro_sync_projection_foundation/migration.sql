CREATE TABLE IF NOT EXISTS "allegro_sync_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "domain" VARCHAR(80) NOT NULL,
  "direction" VARCHAR(30) NOT NULL,
  "mode" VARCHAR(30) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "idempotencyKey" VARCHAR(160),
  "startedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(6),
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "unchangedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "cursorBefore" JSONB,
  "cursorAfter" JSONB,
  "configSnapshot" JSONB,
  "errorSummary" JSONB,
  "createdByUserId" VARCHAR(255),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "allegro_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "allegro_sync_cursors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "domain" VARCHAR(80) NOT NULL,
  "endpoint" VARCHAR(500) NOT NULL,
  "cursorType" VARCHAR(80) NOT NULL,
  "cursorValue" TEXT,
  "watermarkAt" TIMESTAMP(6),
  "lastRunId" UUID,
  "lockedUntil" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "allegro_sync_cursors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "allegro_raw_payloads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "syncRunId" UUID,
  "accountId" UUID NOT NULL,
  "domain" VARCHAR(80) NOT NULL,
  "endpoint" VARCHAR(500) NOT NULL,
  "externalId" VARCHAR(255) NOT NULL,
  "revision" VARCHAR(255),
  "payloadHash" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL,
  "piiClass" VARCHAR(50) NOT NULL,
  "redactionVersion" VARCHAR(50) NOT NULL,
  "receivedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allegro_raw_payloads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "allegro_projection_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "syncRunId" UUID,
  "accountId" UUID NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" UUID,
  "externalId" VARCHAR(255),
  "action" VARCHAR(50) NOT NULL,
  "beforeHash" VARCHAR(128),
  "afterHash" VARCHAR(128),
  "diffSummary" JSONB,
  "redactedContext" JSONB,
  "idempotencyKey" VARCHAR(160),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allegro_projection_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "allegro_offer_stock_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "syncRunId" UUID,
  "accountId" UUID NOT NULL,
  "offerId" UUID,
  "allegroOfferId" VARCHAR(100) NOT NULL,
  "catalogProductId" UUID,
  "sourceEndpoint" VARCHAR(500) NOT NULL,
  "sourceFetchedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadHash" VARCHAR(128) NOT NULL,
  "availableQuantity" INTEGER,
  "authorityClass" VARCHAR(80) NOT NULL,
  "rawPayloadId" UUID,
  "comparisonSummary" JSONB,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allegro_offer_stock_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "allegro_sync_runs_accountId_idx" ON "allegro_sync_runs"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_domain_idx" ON "allegro_sync_runs"("domain");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_direction_idx" ON "allegro_sync_runs"("direction");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_mode_idx" ON "allegro_sync_runs"("mode");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_status_idx" ON "allegro_sync_runs"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "allegro_sync_runs_idempotencyKey_key" ON "allegro_sync_runs"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_startedAt_idx" ON "allegro_sync_runs"("startedAt");
CREATE INDEX IF NOT EXISTS "allegro_sync_runs_completedAt_idx" ON "allegro_sync_runs"("completedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "allegro_sync_cursors_accountId_domain_endpoint_cursorType_key"
  ON "allegro_sync_cursors"("accountId", "domain", "endpoint", "cursorType");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_accountId_idx" ON "allegro_sync_cursors"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_domain_idx" ON "allegro_sync_cursors"("domain");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_endpoint_idx" ON "allegro_sync_cursors"("endpoint");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_lastRunId_idx" ON "allegro_sync_cursors"("lastRunId");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_lockedUntil_idx" ON "allegro_sync_cursors"("lockedUntil");
CREATE INDEX IF NOT EXISTS "allegro_sync_cursors_updatedAt_idx" ON "allegro_sync_cursors"("updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "allegro_raw_payloads_accountId_domain_externalId_payloadHash_key"
  ON "allegro_raw_payloads"("accountId", "domain", "externalId", "payloadHash");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_syncRunId_idx" ON "allegro_raw_payloads"("syncRunId");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_accountId_idx" ON "allegro_raw_payloads"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_domain_idx" ON "allegro_raw_payloads"("domain");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_endpoint_idx" ON "allegro_raw_payloads"("endpoint");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_externalId_idx" ON "allegro_raw_payloads"("externalId");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_payloadHash_idx" ON "allegro_raw_payloads"("payloadHash");
CREATE INDEX IF NOT EXISTS "allegro_raw_payloads_receivedAt_idx" ON "allegro_raw_payloads"("receivedAt");

CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_syncRunId_idx" ON "allegro_projection_audit_logs"("syncRunId");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_accountId_idx" ON "allegro_projection_audit_logs"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_entityType_idx" ON "allegro_projection_audit_logs"("entityType");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_entityId_idx" ON "allegro_projection_audit_logs"("entityId");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_externalId_idx" ON "allegro_projection_audit_logs"("externalId");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_action_idx" ON "allegro_projection_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_idempotencyKey_idx" ON "allegro_projection_audit_logs"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "allegro_projection_audit_logs_createdAt_idx" ON "allegro_projection_audit_logs"("createdAt");

CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_syncRunId_idx" ON "allegro_offer_stock_snapshots"("syncRunId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_accountId_idx" ON "allegro_offer_stock_snapshots"("accountId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_offerId_idx" ON "allegro_offer_stock_snapshots"("offerId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_allegroOfferId_idx" ON "allegro_offer_stock_snapshots"("allegroOfferId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_catalogProductId_idx" ON "allegro_offer_stock_snapshots"("catalogProductId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_rawPayloadId_idx" ON "allegro_offer_stock_snapshots"("rawPayloadId");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_sourceFetchedAt_idx" ON "allegro_offer_stock_snapshots"("sourceFetchedAt");
CREATE INDEX IF NOT EXISTS "allegro_offer_stock_snapshots_authorityClass_idx" ON "allegro_offer_stock_snapshots"("authorityClass");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_sync_runs_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_sync_runs"
      ADD CONSTRAINT "allegro_sync_runs_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_sync_cursors_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_sync_cursors"
      ADD CONSTRAINT "allegro_sync_cursors_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_sync_cursors_lastRunId_fkey'
  ) THEN
    ALTER TABLE "allegro_sync_cursors"
      ADD CONSTRAINT "allegro_sync_cursors_lastRunId_fkey"
      FOREIGN KEY ("lastRunId") REFERENCES "allegro_sync_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_raw_payloads_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_raw_payloads"
      ADD CONSTRAINT "allegro_raw_payloads_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_raw_payloads_syncRunId_fkey'
  ) THEN
    ALTER TABLE "allegro_raw_payloads"
      ADD CONSTRAINT "allegro_raw_payloads_syncRunId_fkey"
      FOREIGN KEY ("syncRunId") REFERENCES "allegro_sync_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_projection_audit_logs_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_projection_audit_logs"
      ADD CONSTRAINT "allegro_projection_audit_logs_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_projection_audit_logs_syncRunId_fkey'
  ) THEN
    ALTER TABLE "allegro_projection_audit_logs"
      ADD CONSTRAINT "allegro_projection_audit_logs_syncRunId_fkey"
      FOREIGN KEY ("syncRunId") REFERENCES "allegro_sync_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_offer_stock_snapshots_accountId_fkey'
  ) THEN
    ALTER TABLE "allegro_offer_stock_snapshots"
      ADD CONSTRAINT "allegro_offer_stock_snapshots_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "allegro_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_offer_stock_snapshots_syncRunId_fkey'
  ) THEN
    ALTER TABLE "allegro_offer_stock_snapshots"
      ADD CONSTRAINT "allegro_offer_stock_snapshots_syncRunId_fkey"
      FOREIGN KEY ("syncRunId") REFERENCES "allegro_sync_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_offer_stock_snapshots_offerId_fkey'
  ) THEN
    ALTER TABLE "allegro_offer_stock_snapshots"
      ADD CONSTRAINT "allegro_offer_stock_snapshots_offerId_fkey"
      FOREIGN KEY ("offerId") REFERENCES "allegro_offers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_offer_stock_snapshots_rawPayloadId_fkey'
  ) THEN
    ALTER TABLE "allegro_offer_stock_snapshots"
      ADD CONSTRAINT "allegro_offer_stock_snapshots_rawPayloadId_fkey"
      FOREIGN KEY ("rawPayloadId") REFERENCES "allegro_raw_payloads"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
