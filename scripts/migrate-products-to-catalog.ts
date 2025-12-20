/**
 * Migration Script: Migrate all products from allegro-service to catalog-microservice
 *
 * This script migrates products from:
 * 1. Product table (deprecated) -> catalog-microservice
 * 2. AllegroProduct table -> catalog-microservice (if not already migrated)
 *
 * Usage:
 *   npm run migrate:products
 *   or
 *   ts-node scripts/migrate-products-to-catalog.ts
 *
 * The script is idempotent - it can be run multiple times safely.
 * It checks if products already exist in catalog-microservice before creating.
 */

import { PrismaClient } from '../shared/node_modules/.prisma/client';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationStats {
  totalProducts: number;
  totalAllegroProducts: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ productId: string; sku: string; error: string }>;
}

class ProductMigrationService {
  private prisma: PrismaClient;
  private catalogClient: AxiosInstance;
  private stats: MigrationStats;
  private dryRun: boolean;

  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    const catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200';
    this.catalogClient = axios.create({
      baseURL: catalogUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.stats = {
      totalProducts: 0,
      totalAllegroProducts: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };
  }

  /**
   * Check if product exists in catalog-microservice by SKU or EAN
   */
  private async findProductInCatalog(sku: string, ean?: string | null): Promise<any | null> {
    try {
      // Try by SKU first
      const skuResponse = await this.catalogClient.get(`/api/products/sku/${sku}`);
      if (skuResponse.data?.success && skuResponse.data?.data) {
        return skuResponse.data.data;
      }
    } catch (error: any) {
      // Product not found by SKU, continue
    }

    // Try by EAN if provided
    if (ean) {
      try {
        const searchResponse = await this.catalogClient.get(`/api/products?search=${ean}&limit=100`);
        const items = searchResponse.data?.data || [];
        const found = items.find((p: any) => p.ean === ean);
        if (found) {
          return found;
        }
      } catch (error: any) {
        // Product not found by EAN, continue
      }
    }

    return null;
  }

  /**
   * Map Product table data to catalog-microservice format
   */
  private mapProductToCatalog(product: any): any {
    const catalogProduct: any = {
      sku: product.code || `ALLEGRO-${product.id}`,
      title: product.name || 'Product',
      description: product.description || product.shortDescription || null,
      brand: product.brand || null,
      manufacturer: product.manufacturer || null,
      ean: product.ean || null,
      isActive: product.active !== false,
    };

    // Map weight
    if (product.weight) {
      catalogProduct.weightKg = Number(product.weight);
    }

    // Map dimensions
    if (product.height || product.width || product.depth || product.length) {
      catalogProduct.dimensionsCm = {
        height: product.height ? Number(product.height) : undefined,
        width: product.width ? Number(product.width) : undefined,
        depth: product.depth ? Number(product.depth) : undefined,
        length: product.length ? Number(product.length) : undefined,
      };
    }

    // Map SEO data
    if (product.seoTitle || product.seoDescription || product.seoKeywords) {
      catalogProduct.seoData = {
        metaTitle: product.seoTitle || null,
        metaDescription: product.seoDescription || null,
        keywords: product.seoKeywords ? (typeof product.seoKeywords === 'string' ? product.seoKeywords.split(',') : product.seoKeywords) : [],
      };
    }

    // Map tags
    if (product.tags) {
      if (Array.isArray(product.tags)) {
        catalogProduct.tags = product.tags;
      } else if (typeof product.tags === 'string') {
        catalogProduct.tags = product.tags.split(',').map((t: string) => t.trim());
      }
    }

    return catalogProduct;
  }

  /**
   * Map AllegroProduct data to catalog-microservice format
   */
  private mapAllegroProductToCatalog(allegroProduct: any): any {
    const catalogProduct: any = {
      sku: allegroProduct.ean || `ALLEGRO-${allegroProduct.allegroProductId}`,
      title: allegroProduct.name || 'Product',
      brand: allegroProduct.brand || null,
      manufacturer: allegroProduct.manufacturerCode || null,
      ean: allegroProduct.ean || null,
      isActive: true,
    };

    return catalogProduct;
  }

  /**
   * Create or update product in catalog-microservice
   */
  private async createOrUpdateProduct(productData: any, existingProduct?: any): Promise<any> {
    if (this.dryRun) {
      // In dry-run mode, just return mock data
      return {
        id: existingProduct?.id || 'mock-id-' + Date.now(),
        ...productData,
      };
    }

    try {
      if (existingProduct) {
        // Update existing product
        const response = await this.catalogClient.put(`/api/products/${existingProduct.id}`, productData);
        return response.data?.data;
      } else {
        // Create new product
        const response = await this.catalogClient.post('/api/products', productData);
        return response.data?.data;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      throw new Error(errorMessage);
    }
  }

  /**
   * Migrate a single product from Product table
   */
  private async migrateProduct(product: any): Promise<void> {
    const sku = product.code || `ALLEGRO-${product.id}`;
    
    try {
      // Check if product already exists in catalog
      const existing = await this.findProductInCatalog(sku, product.ean);

      // Map product data
      const catalogData = this.mapProductToCatalog(product);

      // Create or update
      await this.createOrUpdateProduct(catalogData, existing);

      if (existing) {
        this.stats.updated++;
        const action = this.dryRun ? 'Would update' : 'Updated';
        console.log(`✅ ${action} product: ${sku} (${product.name})`);
      } else {
        this.stats.created++;
        const action = this.dryRun ? 'Would create' : 'Created';
        console.log(`✅ ${action} product: ${sku} (${product.name})`);
      }
    } catch (error: any) {
      this.stats.errors++;
      this.stats.errorDetails.push({
        productId: product.id,
        sku,
        error: error.message,
      });
      console.error(`❌ Error migrating product ${sku}: ${error.message}`);
    }
  }

  /**
   * Migrate a single AllegroProduct
   */
  private async migrateAllegroProduct(allegroProduct: any): Promise<void> {
    const sku = allegroProduct.ean || `ALLEGRO-${allegroProduct.allegroProductId}`;
    
    try {
      // Check if product already exists in catalog
      const existing = await this.findProductInCatalog(sku, allegroProduct.ean);

      // Map product data
      const catalogData = this.mapAllegroProductToCatalog(allegroProduct);

      // Create or update
      await this.createOrUpdateProduct(catalogData, existing);

      if (existing) {
        this.stats.updated++;
        const action = this.dryRun ? 'Would update' : 'Updated';
        console.log(`✅ ${action} AllegroProduct: ${sku} (${allegroProduct.name || allegroProduct.allegroProductId})`);
      } else {
        this.stats.created++;
        const action = this.dryRun ? 'Would create' : 'Created';
        console.log(`✅ ${action} AllegroProduct: ${sku} (${allegroProduct.name || allegroProduct.allegroProductId})`);
      }
    } catch (error: any) {
      this.stats.errors++;
      this.stats.errorDetails.push({
        productId: allegroProduct.id,
        sku,
        error: error.message,
      });
      console.error(`❌ Error migrating AllegroProduct ${sku}: ${error.message}`);
    }
  }

  /**
   * Migrate all products from Product table
   */
  private async migrateProductsTable(): Promise<void> {
    console.log('\n📦 Migrating products from Product table...\n');

    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
    });

    this.stats.totalProducts = products.length;
    console.log(`Found ${products.length} products to migrate\n`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`[${i + 1}/${products.length}] Processing product: ${product.code || product.id}`);
      await this.migrateProduct(product);
      
      // Small delay to avoid overwhelming the API
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Migrate all products from AllegroProduct table
   */
  private async migrateAllegroProductsTable(): Promise<void> {
    console.log('\n📦 Migrating products from AllegroProduct table...\n');

    const allegroProducts = await this.prisma.allegroProduct.findMany({
      orderBy: { createdAt: 'asc' },
    });

    this.stats.totalAllegroProducts = allegroProducts.length;
    console.log(`Found ${allegroProducts.length} AllegroProducts to migrate\n`);

    for (let i = 0; i < allegroProducts.length; i++) {
      const allegroProduct = allegroProducts[i];
      console.log(`[${i + 1}/${allegroProducts.length}] Processing AllegroProduct: ${allegroProduct.allegroProductId}`);
      
      // Skip if already migrated (check by EAN or SKU)
      const sku = allegroProduct.ean || `ALLEGRO-${allegroProduct.allegroProductId}`;
      const existing = await this.findProductInCatalog(sku, allegroProduct.ean);
      
      if (existing) {
        this.stats.skipped++;
        console.log(`⏭️  Skipped (already exists): ${sku}`);
        continue;
      }

      await this.migrateAllegroProduct(allegroProduct);
      
      // Small delay to avoid overwhelming the API
      if (i < allegroProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Print migration statistics
   */
  private printStats(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Statistics');
    console.log('='.repeat(60));
    console.log(`Total Products (Product table): ${this.stats.totalProducts}`);
    console.log(`Total AllegroProducts: ${this.stats.totalAllegroProducts}`);
    console.log(`✅ Created: ${this.stats.created}`);
    console.log(`🔄 Updated: ${this.stats.updated}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log('='.repeat(60));

    if (this.stats.errorDetails.length > 0) {
      console.log('\n❌ Error Details:');
      this.stats.errorDetails.forEach((error, index) => {
        console.log(`${index + 1}. Product ID: ${error.productId}, SKU: ${error.sku}`);
        console.log(`   Error: ${error.error}\n`);
      });
    }
  }

  /**
   * Run the migration
   */
  async run(): Promise<void> {
    try {
      const mode = this.dryRun ? '🔍 DRY-RUN MODE (no changes will be made)' : '🚀 LIVE MODE';
      console.log(`${mode} - Starting product migration to catalog-microservice...\n`);
      console.log(`Catalog Service URL: ${process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200'}\n`);
      
      if (this.dryRun) {
        console.log('⚠️  DRY-RUN MODE: No products will be created or updated in catalog-microservice\n');
      }

      // Test connection to catalog-microservice
      try {
        await this.catalogClient.get('/api/products?limit=1');
        console.log('✅ Connected to catalog-microservice\n');
      } catch (error: any) {
        console.warn('⚠️  Could not connect to catalog-microservice, continuing anyway...');
        console.warn(`   Error: ${error.message}\n`);
      }

      // Migrate Product table
      await this.migrateProductsTable();

      // Migrate AllegroProduct table
      await this.migrateAllegroProductsTable();

      // Print statistics
      this.printStats();

      console.log('\n✅ Migration completed!');
    } catch (error: any) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  if (dryRun) {
    console.log('🔍 Running in DRY-RUN mode - no changes will be made\n');
  }

  const migration = new ProductMigrationService(dryRun);
  migration.run()
    .then(() => {
      if (dryRun) {
        console.log('\n✅ Dry-run completed successfully - no changes were made');
        console.log('   Run without --dry-run to perform actual migration');
      } else {
        console.log('\n✅ Migration script finished successfully');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { ProductMigrationService };

