-- Safe renames for allegro_products (only if old column exists and new does not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='allegro_product_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='allegroProductId') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='manufacturer_code')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='manufacturerCode') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "manufacturer_code" TO "manufacturerCode";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='publication_status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='publicationStatus') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "publication_status" TO "publicationStatus";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='is_ai_co_created')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='isAiCoCreated') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "is_ai_co_created" TO "isAiCoCreated";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='marketed_before_gpsr')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='marketedBeforeGPSR') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "marketed_before_gpsr" TO "marketedBeforeGPSR";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='raw_data')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='rawData') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "raw_data" TO "rawData";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='createdAt') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_products' AND column_name='updatedAt') THEN
    ALTER TABLE "allegro_products" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END $$;

-- Safe renames for allegro_product_parameters
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='allegro_product_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='allegroProductId') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='parameter_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='parameterId') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "parameter_id" TO "parameterId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='values_ids')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='valuesIds') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "values_ids" TO "valuesIds";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='range_value')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='rangeValue') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "range_value" TO "rangeValue";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='createdAt') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "created_at" TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_product_parameters' AND column_name='updatedAt') THEN
    ALTER TABLE "allegro_product_parameters" RENAME COLUMN "updated_at" TO "updatedAt";
  END IF;
END $$;

-- Update constraints/indexes for allegro_product_parameters
ALTER TABLE "allegro_product_parameters" DROP CONSTRAINT IF EXISTS "allegro_product_parameters_allegro_product_id_parameter_id_key";
ALTER TABLE "allegro_product_parameters" ADD CONSTRAINT "allegro_product_parameters_allegroProductId_parameterId_key" UNIQUE ("allegroProductId", "parameterId");
DROP INDEX IF EXISTS "allegro_product_parameters_parameter_id_idx";
CREATE INDEX IF NOT EXISTS "allegro_product_parameters_parameterId_idx" ON "allegro_product_parameters" ("parameterId");

-- Align column name in allegro_offers FK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_offers' AND column_name='allegro_product_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allegro_offers' AND column_name='allegroProductId') THEN
    ALTER TABLE "allegro_offers" RENAME COLUMN "allegro_product_id" TO "allegroProductId";
  END IF;
END $$;

DROP INDEX IF EXISTS "allegro_offers_allegro_product_id_idx";
CREATE INDEX IF NOT EXISTS "allegro_offers_allegroProductId_idx" ON "allegro_offers" ("allegroProductId");
ALTER TABLE "allegro_offers" DROP CONSTRAINT IF EXISTS "allegro_offers_allegro_product_id_fkey";
ALTER TABLE "allegro_offers" ADD CONSTRAINT "allegro_offers_allegroProductId_fkey" FOREIGN KEY ("allegroProductId") REFERENCES "allegro_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

