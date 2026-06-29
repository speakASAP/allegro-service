ALTER TABLE "allegro_orders"
  ALTER COLUMN "allegroOfferId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "lineItemsCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "marketplaceId" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "revision" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "invoiceRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rawData" JSONB;

CREATE TABLE IF NOT EXISTS "allegro_order_line_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "allegroLineItemId" VARCHAR(150) NOT NULL,
  "allegroOfferExternalId" VARCHAR(100),
  "allegroOfferId" UUID,
  "catalogProductId" UUID,
  "title" VARCHAR(500) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" DECIMAL(10,2) NOT NULL,
  "originalPrice" DECIMAL(10,2),
  "totalPrice" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'PLN',
  "tax" JSONB,
  "discounts" JSONB,
  "vouchers" JSONB,
  "selectedAdditionalServices" JSONB,
  "rawData" JSONB,
  "boughtAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "allegro_order_line_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "allegro_order_line_items_orderId_allegroLineItemId_key"
  ON "allegro_order_line_items"("orderId", "allegroLineItemId");
CREATE INDEX IF NOT EXISTS "allegro_order_line_items_allegroLineItemId_idx"
  ON "allegro_order_line_items"("allegroLineItemId");
CREATE INDEX IF NOT EXISTS "allegro_order_line_items_allegroOfferExternalId_idx"
  ON "allegro_order_line_items"("allegroOfferExternalId");
CREATE INDEX IF NOT EXISTS "allegro_order_line_items_allegroOfferId_idx"
  ON "allegro_order_line_items"("allegroOfferId");
CREATE INDEX IF NOT EXISTS "allegro_order_line_items_catalogProductId_idx"
  ON "allegro_order_line_items"("catalogProductId");
CREATE INDEX IF NOT EXISTS "allegro_order_line_items_boughtAt_idx"
  ON "allegro_order_line_items"("boughtAt");
CREATE INDEX IF NOT EXISTS "allegro_orders_marketplaceId_idx"
  ON "allegro_orders"("marketplaceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_order_line_items_orderId_fkey'
  ) THEN
    ALTER TABLE "allegro_order_line_items"
      ADD CONSTRAINT "allegro_order_line_items_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "allegro_orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allegro_order_line_items_allegroOfferId_fkey'
  ) THEN
    ALTER TABLE "allegro_order_line_items"
      ADD CONSTRAINT "allegro_order_line_items_allegroOfferId_fkey"
      FOREIGN KEY ("allegroOfferId") REFERENCES "allegro_offers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
