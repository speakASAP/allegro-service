-- Create Allegro products table
CREATE TABLE IF NOT EXISTS "allegro_products" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "allegro_product_id" VARCHAR(100) NOT NULL UNIQUE,
    "name" VARCHAR(500),
    "brand" VARCHAR(255),
    "manufacturer_code" VARCHAR(255),
    "ean" VARCHAR(50),
    "publication_status" VARCHAR(50),
    "is_ai_co_created" BOOLEAN NOT NULL DEFAULT FALSE,
    "marketed_before_gpsr" BOOLEAN,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Allegro product parameters table
CREATE TABLE IF NOT EXISTS "allegro_product_parameters" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "allegro_product_id" UUID NOT NULL REFERENCES "allegro_products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "parameter_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255),
    "values" JSONB,
    "values_ids" JSONB,
    "range_value" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "allegro_product_parameters_allegro_product_id_parameter_id_key" UNIQUE ("allegro_product_id", "parameter_id")
);

-- Add index for parameter_id
CREATE INDEX IF NOT EXISTS "allegro_product_parameters_parameter_id_idx" ON "allegro_product_parameters" ("parameter_id");

-- Alter allegro_offers to link allegro_products
ALTER TABLE "allegro_offers" ADD COLUMN IF NOT EXISTS "allegro_product_id" UUID;
ALTER TABLE "allegro_offers" ADD CONSTRAINT "allegro_offers_allegro_product_id_fkey"
  FOREIGN KEY ("allegro_product_id") REFERENCES "allegro_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for allegro_product_id on allegro_offers
CREATE INDEX IF NOT EXISTS "allegro_offers_allegro_product_id_idx" ON "allegro_offers" ("allegro_product_id");

