/**
 * Verification Script: Check prerequisites before running migration
 *
 * This script verifies that all prerequisites are met before running the migration:
 * - Database connection
 * - Catalog-microservice availability
 * - Environment variables
 * - Product counts
 *
 * Usage:
 *   npm run verify:migration
 *   or
 *   ts-node scripts/verify-migration-prerequisites.ts
 */

import { PrismaClient } from '../shared/node_modules/.prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface VerificationResult {
  passed: boolean;
  message: string;
}

class MigrationVerification {
  private prisma: PrismaClient;
  private catalogUrl: string;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    this.catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200';
  }

  async verifyDatabaseConnection(): Promise<VerificationResult> {
    try {
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      return { passed: true, message: '✅ Database connection successful' };
    } catch (error: any) {
      return { passed: false, message: `❌ Database connection failed: ${error.message}` };
    }
  }

  async verifyCatalogService(): Promise<VerificationResult> {
    try {
      const response = await axios.get(`${this.catalogUrl}/api/products?limit=1`, {
        timeout: 5000,
      });
      return { passed: true, message: '✅ Catalog-microservice is accessible' };
    } catch (error: any) {
      return {
        passed: false,
        message: `❌ Catalog-microservice not accessible: ${error.message}\n   URL: ${this.catalogUrl}`,
      };
    }
  }

  async verifyEnvironmentVariables(): Promise<VerificationResult> {
    const required = ['DATABASE_URL'];
    const missing: string[] = [];

    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        message: `❌ Missing environment variables: ${missing.join(', ')}`,
      };
    }

    const catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200';
    return {
      passed: true,
      message: `✅ Environment variables OK\n   DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}\n   CATALOG_SERVICE_URL: ${catalogUrl}`,
    };
  }

  async getProductCounts(): Promise<{ products: number; allegroProducts: number }> {
    try {
      const [products, allegroProducts] = await Promise.all([
        this.prisma.product.count(),
        this.prisma.allegroProduct.count(),
      ]);
      return { products, allegroProducts };
    } catch (error: any) {
      throw new Error(`Failed to count products: ${error.message}`);
    }
  }

  async verifyProductData(): Promise<VerificationResult> {
    try {
      const counts = await this.getProductCounts();
      return {
        passed: true,
        message: `✅ Product data found:\n   Products (Product table): ${counts.products}\n   AllegroProducts: ${counts.allegroProducts}\n   Total to migrate: ${counts.products + counts.allegroProducts}`,
      };
    } catch (error: any) {
      return { passed: false, message: `❌ Failed to count products: ${error.message}` };
    }
  }

  async run(): Promise<void> {
    console.log('🔍 Verifying migration prerequisites...\n');
    console.log('='.repeat(60));

    const checks: Array<{ name: string; check: () => Promise<VerificationResult> }> = [
      { name: 'Environment Variables', check: () => this.verifyEnvironmentVariables() },
      { name: 'Database Connection', check: () => this.verifyDatabaseConnection() },
      { name: 'Catalog-microservice', check: () => this.verifyCatalogService() },
      { name: 'Product Data', check: () => this.verifyProductData() },
    ];

    let allPassed = true;

    for (const { name, check } of checks) {
      console.log(`\n📋 ${name}:`);
      const result = await check();
      console.log(result.message);
      if (!result.passed) {
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(60));

    if (allPassed) {
      console.log('\n✅ All prerequisites verified! Ready to run migration.');
      console.log('\nNext steps:');
      console.log('  1. Run dry-run: npm run migrate:products:dry-run');
      console.log('  2. Review the dry-run results');
      console.log('  3. Run migration: npm run migrate:products');
    } else {
      console.log('\n❌ Some prerequisites failed. Please fix the issues above before running migration.');
      process.exit(1);
    }
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Run verification if executed directly
if (require.main === module) {
  const verification = new MigrationVerification();
  verification
    .run()
    .then(() => {
      return verification.cleanup();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      verification.cleanup().finally(() => {
        process.exit(1);
      });
    });
}

export { MigrationVerification };

