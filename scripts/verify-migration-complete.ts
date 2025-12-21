/**
 * Verification Script: Verify all products migrated from allegro-service to catalog-microservice
 *
 * This script compares product counts and SKUs between:
 * - allegro-service database (Product and AllegroProduct tables)
 * - catalog-microservice database (products table)
 *
 * Usage:
 *   ts-node scripts/verify-migration-complete.ts
 */

import { PrismaClient } from '../shared/node_modules/.prisma/client';
import { Client } from 'pg';
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface ProductInfo {
  id: string;
  sku: string;
  ean?: string | null;
  name: string;
  source: 'Product' | 'AllegroProduct';
}

interface VerificationResult {
  allegroProducts: ProductInfo[];
  catalogProducts: Array<{ id: string; sku: string; ean?: string | null }>;
  missingProducts: ProductInfo[];
  migratedCount: number;
  totalCount: number;
  isComplete: boolean;
}

class MigrationVerification {
  private prisma: PrismaClient;
  private catalogDb: Client | null = null;
  private catalogApi: AxiosInstance;
  private useApi: boolean = false;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL environment variable is required.\n' +
        'Please set it in your .env file or export it before running the script.\n' +
        'Example: export DATABASE_URL="postgresql://user:password@host:port/database"'
      );
    }

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    const catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200';
    this.catalogApi = axios.create({
      baseURL: catalogUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Try to connect to catalog-microservice database directly
   */
  async connectToCatalogDatabase(): Promise<boolean> {
    try {
      // Try to get catalog database connection from environment
      // Catalog microservice uses: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
      const dbConfig = {
        host: process.env.CATALOG_DB_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.CATALOG_DB_PORT || process.env.DB_PORT || '5432', 10),
        user: process.env.CATALOG_DB_USER || process.env.DB_USER || 'dbadmin',
        password: process.env.CATALOG_DB_PASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.CATALOG_DB_NAME || process.env.DB_NAME || 'catalog_db',
      };

      this.catalogDb = new Client(dbConfig);
      await this.catalogDb.connect();
      console.log('✅ Connected to catalog-microservice database directly');
      return true;
    } catch (error: any) {
      console.log('⚠️  Could not connect to catalog database directly, will use API');
      console.log(`   Error: ${error.message}`);
      this.useApi = true;
      return false;
    }
  }

  /**
   * Get all products from allegro-service database
   */
  async getAllegroProducts(): Promise<ProductInfo[]> {
    const products: ProductInfo[] = [];

    try {
      // Get products from Product table
      const productTable = await this.prisma.product.findMany({
        select: {
          id: true,
          code: true,
          ean: true,
          name: true,
        },
      });

      for (const product of productTable) {
        products.push({
          id: product.id,
          sku: product.code || `ALLEGRO-${product.id}`,
          ean: product.ean,
          name: product.name,
          source: 'Product',
        });
      }

      // Get products from AllegroProduct table
      const allegroProducts = await this.prisma.allegroProduct.findMany({
        select: {
          id: true,
          allegroProductId: true,
          ean: true,
          name: true,
        },
      });

      for (const allegroProduct of allegroProducts) {
        products.push({
          id: allegroProduct.id,
          sku: allegroProduct.ean || `ALLEGRO-${allegroProduct.allegroProductId}`,
          ean: allegroProduct.ean,
          name: allegroProduct.name || allegroProduct.allegroProductId,
          source: 'AllegroProduct',
        });
      }

      return products;
    } catch (error: any) {
      throw new Error(`Failed to get allegro products: ${error.message}`);
    }
  }

  /**
   * Get all products from catalog-microservice via database
   */
  async getCatalogProductsFromDb(): Promise<Array<{ id: string; sku: string; ean?: string | null }>> {
    if (!this.catalogDb) {
      throw new Error('Database connection not established');
    }

    try {
      const result = await this.catalogDb.query(
        'SELECT id, sku, ean FROM products ORDER BY created_at'
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        sku: row.sku,
        ean: row.ean || null,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get catalog products from database: ${error.message}`);
    }
  }

  /**
   * Get all products from catalog-microservice via API
   */
  async getCatalogProductsFromApi(): Promise<Array<{ id: string; sku: string; ean?: string | null }>> {
    const products: Array<{ id: string; sku: string; ean?: string | null }> = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await this.catalogApi.get(`/api/products?page=${page}&limit=${limit}`);
        const data = response.data?.data || [];
        const pagination = response.data?.pagination;

        for (const product of data) {
          products.push({
            id: product.id,
            sku: product.sku,
            ean: product.ean || null,
          });
        }

        if (pagination && pagination.totalPages && page < pagination.totalPages) {
          page++;
        } else {
          hasMore = false;
        }
      }

      return products;
    } catch (error: any) {
      throw new Error(`Failed to get catalog products from API: ${error.message}`);
    }
  }

  /**
   * Get all products from catalog-microservice
   */
  async getCatalogProducts(): Promise<Array<{ id: string; sku: string; ean?: string | null }>> {
    if (this.useApi || !this.catalogDb) {
      return await this.getCatalogProductsFromApi();
    } else {
      return await this.getCatalogProductsFromDb();
    }
  }

  /**
   * Find missing products by comparing SKUs and EANs
   */
  findMissingProducts(
    allegroProducts: ProductInfo[],
    catalogProducts: Array<{ id: string; sku: string; ean?: string | null }>
  ): ProductInfo[] {
    const catalogSkus = new Set(catalogProducts.map((p) => p.sku));
    const catalogEans = new Set(
      catalogProducts.filter((p) => p.ean).map((p) => p.ean as string)
    );

    const missing: ProductInfo[] = [];

    for (const product of allegroProducts) {
      const foundBySku = catalogSkus.has(product.sku);
      const foundByEan = product.ean ? catalogEans.has(product.ean) : false;

      if (!foundBySku && !foundByEan) {
        missing.push(product);
      }
    }

    return missing;
  }

  /**
   * Run verification
   */
  async verify(): Promise<VerificationResult> {
    console.log('🔍 Verifying product migration from allegro-service to catalog-microservice...\n');
    console.log('='.repeat(70));

    // Try to connect to catalog database
    await this.connectToCatalogDatabase();

    // Get products from both sources
    console.log('\n📦 Fetching products from allegro-service...');
    const allegroProducts = await this.getAllegroProducts();
    console.log(`   Found ${allegroProducts.length} products in allegro-service`);

    console.log('\n📦 Fetching products from catalog-microservice...');
    const catalogProducts = await this.getCatalogProducts();
    console.log(`   Found ${catalogProducts.length} products in catalog-microservice`);

    // Find missing products
    console.log('\n🔍 Comparing products...');
    const missingProducts = this.findMissingProducts(allegroProducts, catalogProducts);

    const migratedCount = allegroProducts.length - missingProducts.length;
    const totalCount = allegroProducts.length;
    const isComplete = missingProducts.length === 0;

    return {
      allegroProducts,
      catalogProducts,
      missingProducts,
      migratedCount,
      totalCount,
      isComplete,
    };
  }

  /**
   * Print verification report
   */
  printReport(result: VerificationResult): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Verification Report');
    console.log('='.repeat(70));

    console.log(`\n📦 Product Counts:`);
    console.log(`   Allegro-service (Product table): ${result.allegroProducts.filter((p) => p.source === 'Product').length}`);
    console.log(`   Allegro-service (AllegroProduct table): ${result.allegroProducts.filter((p) => p.source === 'AllegroProduct').length}`);
    console.log(`   Total in allegro-service: ${result.totalCount}`);
    console.log(`   Total in catalog-microservice: ${result.catalogProducts.length}`);
    console.log(`   ✅ Migrated: ${result.migratedCount}`);
    console.log(`   ❌ Missing: ${result.missingProducts.length}`);

    if (result.isComplete) {
      console.log('\n✅ MIGRATION COMPLETE: All products have been migrated!');
    } else {
      console.log('\n❌ MIGRATION INCOMPLETE: Some products are missing!');
      console.log(`\n📋 Missing Products (${result.missingProducts.length}):`);
      console.log('='.repeat(70));

      // Group by source
      const missingFromProduct = result.missingProducts.filter((p) => p.source === 'Product');
      const missingFromAllegroProduct = result.missingProducts.filter(
        (p) => p.source === 'AllegroProduct'
      );

      if (missingFromProduct.length > 0) {
        console.log(`\nFrom Product table (${missingFromProduct.length}):`);
        missingFromProduct.forEach((product, index) => {
          console.log(`  ${index + 1}. SKU: ${product.sku}, EAN: ${product.ean || 'N/A'}, Name: ${product.name}`);
        });
      }

      if (missingFromAllegroProduct.length > 0) {
        console.log(`\nFrom AllegroProduct table (${missingFromAllegroProduct.length}):`);
        missingFromAllegroProduct.forEach((product, index) => {
          console.log(`  ${index + 1}. SKU: ${product.sku}, EAN: ${product.ean || 'N/A'}, Name: ${product.name}`);
        });
      }

      console.log('\n💡 To migrate missing products, run:');
      console.log('   npm run migrate:products');
    }

    console.log('\n' + '='.repeat(70));
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    if (this.catalogDb) {
      await this.catalogDb.end();
    }
  }
}

// Run verification if executed directly
if (require.main === module) {
  const verification = new MigrationVerification();
  let verificationResult: VerificationResult | null = null;

  verification
    .verify()
    .then((result) => {
      verificationResult = result;
      verification.printReport(result);
      return verification.cleanup();
    })
    .then(() => {
      process.exit(verificationResult?.isComplete ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      verification.cleanup().finally(() => {
        process.exit(1);
      });
    });
}

export { MigrationVerification };

