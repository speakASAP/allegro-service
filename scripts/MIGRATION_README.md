# Product Migration Script

This script migrates all products from allegro-service database to catalog-microservice.

## What it does

1. **Migrates Product table** - All products from the deprecated `Product` table
2. **Migrates AllegroProduct table** - All products from the `AllegroProduct` table (if not already migrated)

## Features

- ✅ **Idempotent** - Can be run multiple times safely
- ✅ **Duplicate detection** - Checks if products already exist in catalog-microservice (by SKU or EAN)
- ✅ **Progress tracking** - Shows progress for each product
- ✅ **Error handling** - Continues on errors and reports them at the end
- ✅ **Statistics** - Provides detailed migration statistics

## Prerequisites

1. **Catalog-microservice must be running** and accessible
2. **Environment variables** must be set:
   - `DATABASE_URL` - PostgreSQL connection string for allegro-service
   - `CATALOG_SERVICE_URL` - URL of catalog-microservice (default: `http://catalog-microservice:3200`)

## Usage

### Step 1: Verify Prerequisites

Before running the migration, verify all prerequisites are met:

```bash
npm run verify:migration
```

This will check:
- ✅ Database connection
- ✅ Catalog-microservice availability
- ✅ Environment variables
- ✅ Product counts

### Step 2: Run Dry-Run (Recommended)

Test the migration without making any changes:

```bash
npm run migrate:products:dry-run
```

Or:

```bash
ts-node scripts/migrate-products-to-catalog.ts --dry-run
```

This will show you:
- What products would be migrated
- What would be created vs updated
- Any errors that would occur
- **No actual changes will be made**

### Step 3: Run Actual Migration

Once you've verified the dry-run looks good:

```bash
npm run migrate:products
```

Or:

```bash
ts-node scripts/migrate-products-to-catalog.ts
```

### Alternative: Direct execution

```bash
# Dry-run
ts-node scripts/migrate-products-to-catalog.ts --dry-run

# Live migration
ts-node scripts/migrate-products-to-catalog.ts
```

## Field Mapping

### Product table → Catalog-microservice

| Product Table | Catalog-microservice | Notes |
|---------------|----------------------|-------|
| `code` | `sku` | Primary identifier |
| `name` | `title` | Product name |
| `description` | `description` | Full description |
| `brand` | `brand` | Brand name |
| `manufacturer` | `manufacturer` | Manufacturer name |
| `ean` | `ean` | EAN code |
| `weight` | `weightKg` | Weight in kg |
| `height/width/depth/length` | `dimensionsCm` | Dimensions object |
| `seoTitle` | `seoData.metaTitle` | SEO metadata |
| `seoDescription` | `seoData.metaDescription` | SEO metadata |
| `seoKeywords` | `seoData.keywords` | SEO metadata (array) |
| `tags` | `tags` | Tags array |
| `active` | `isActive` | Active status |

### AllegroProduct table → Catalog-microservice

| AllegroProduct Table | Catalog-microservice | Notes |
|----------------------|----------------------|-------|
| `ean` or `allegroProductId` | `sku` | Uses EAN if available, otherwise generates SKU |
| `name` | `title` | Product name |
| `brand` | `brand` | Brand name |
| `manufacturerCode` | `manufacturer` | Manufacturer code |
| `ean` | `ean` | EAN code |

## Output

The script provides:

1. **Real-time progress** - Shows each product being processed
2. **Final statistics**:
   - Total products found
   - Products created
   - Products updated
   - Products skipped (already exist)
   - Errors encountered
3. **Error details** - List of all errors with product IDs and error messages

## Example Output

```
🚀 Starting product migration to catalog-microservice...

Catalog Service URL: http://catalog-microservice:3200

✅ Connected to catalog-microservice

📦 Migrating products from Product table...

Found 150 products to migrate

[1/150] Processing product: PROD-001
✅ Created product: PROD-001 (Product Name)
[2/150] Processing product: PROD-002
✅ Updated product: PROD-002 (Product Name)
...

📦 Migrating products from AllegroProduct table...

Found 50 AllegroProducts to migrate

[1/50] Processing AllegroProduct: ALLEGRO-123
✅ Created AllegroProduct: 1234567890123 (Allegro Product Name)
...

============================================================
📊 Migration Statistics
============================================================
Total Products (Product table): 150
Total AllegroProducts: 50
✅ Created: 180
🔄 Updated: 15
⏭️  Skipped: 5
❌ Errors: 0
============================================================

✅ Migration completed!
```

## Troubleshooting

### Error: "Could not connect to catalog-microservice"

- Check that catalog-microservice is running
- Verify `CATALOG_SERVICE_URL` environment variable
- Check network connectivity

### Error: "Product not found" or "Failed to create product"

- Check catalog-microservice logs
- Verify product data format
- Check for duplicate SKUs or EANs

### Products not appearing in catalog-microservice

- Check catalog-microservice logs for errors
- Verify API endpoint is correct
- Check authentication if required

## Notes

- The script processes products sequentially with a 100ms delay between requests to avoid overwhelming the API
- Products are matched by SKU first, then by EAN if SKU match fails
- If a product already exists, it will be updated with new data
- AllegroProduct entries are skipped if a matching product already exists in catalog-microservice

## Migration Workflow

### Recommended Workflow

1. **Verify prerequisites**:
   ```bash
   npm run verify:migration
   ```

2. **Run dry-run**:
   ```bash
   npm run migrate:products:dry-run
   ```
   Review the output to ensure everything looks correct.

3. **Run actual migration**:
   ```bash
   npm run migrate:products
   ```

4. **Verify results**:
   - Check catalog-microservice for migrated products
   - Verify product counts match
   - Test product fetching from catalog-microservice

## After Migration

After successful migration:

1. **Verify products** in catalog-microservice
2. **Update AllegroOffer.productId** references to point to catalog-microservice product IDs (if needed)
3. **Test product fetching** from catalog-microservice
4. **Monitor for issues** in production
5. **Consider removing** the deprecated Product table after verifying everything works

## Rollback

If issues occur:

1. Products in catalog-microservice can be deleted manually
2. Original products remain in allegro-service database
3. Re-run the migration script to re-migrate

