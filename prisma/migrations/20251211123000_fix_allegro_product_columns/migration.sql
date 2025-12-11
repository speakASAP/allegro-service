-- Align column names with Prisma default camelCase for allegro_products
ALTER TABLE "allegro_products" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
ALTER TABLE "allegro_products" RENAME COLUMN "manufacturer_code" TO "manufacturerCode";
ALTER TABLE "allegro_products" RENAME COLUMN "publication_status" TO "publicationStatus";
ALTER TABLE "allegro_products" RENAME COLUMN "is_ai_co_created" TO "isAiCoCreated";
ALTER TABLE "allegro_products" RENAME COLUMN "marketed_before_gpsr" TO "marketedBeforeGPSR";
ALTER TABLE "allegro_products" RENAME COLUMN "raw_data" TO "rawData";
ALTER TABLE "allegro_products" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "allegro_products" RENAME COLUMN "updated_at" TO "updatedAt";

-- Align column names for allegro_product_parameters
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "parameter_id" TO "parameterId";
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "values_ids" TO "valuesIds";
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "range_value" TO "rangeValue";
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "allegro_product_parameters" RENAME COLUMN "updated_at" TO "updatedAt";

-- Update constraint names to match new columns
ALTER TABLE "allegro_product_parameters" DROP CONSTRAINT IF EXISTS "allegro_product_parameters_allegro_product_id_parameter_id_key";
ALTER TABLE "allegro_product_parameters" ADD CONSTRAINT "allegro_product_parameters_allegroProductId_parameterId_key" UNIQUE ("allegroProductId", "parameterId");
DROP INDEX IF EXISTS "allegro_product_parameters_parameter_id_idx";
CREATE INDEX IF NOT EXISTS "allegro_product_parameters_parameterId_idx" ON "allegro_product_parameters" ("parameterId");

-- Align column name in allegro_offers FK
ALTER TABLE "allegro_offers" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
DROP INDEX IF EXISTS "allegro_offers_allegro_product_id_idx";
CREATE INDEX IF NOT EXISTS "allegro_offers_allegroProductId_idx" ON "allegro_offers" ("allegroProductId");
ALTER TABLE "allegro_offers" DROP CONSTRAINT IF EXISTS "allegro_offers_allegro_product_id_fkey";
ALTER TABLE "allegro_offers" ADD CONSTRAINT "allegro_offers_allegroProductId_fkey" FOREIGN KEY ("allegroProductId") REFERENCES "allegro_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

