/**
 * Clean Database Script
 * 
 * Removes all data from allegro-service database tables.
 * This script is used to reset the database before refactoring.
 * 
 * Usage:
 *   ts-node scripts/clean-database.ts
 */

import { PrismaClient } from '../shared/node_modules/.prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function cleanDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log('🧹 Starting database cleanup...\n');

    // Delete in order to respect foreign key constraints
    console.log('Deleting AllegroOrders...');
    const ordersDeleted = await prisma.allegroOrder.deleteMany();
    console.log(`  ✅ Deleted ${ordersDeleted.count} orders\n`);

    console.log('Deleting SyncJobs...');
    const syncJobsDeleted = await prisma.syncJob.deleteMany();
    console.log(`  ✅ Deleted ${syncJobsDeleted.count} sync jobs\n`);

    console.log('Deleting AllegroOffers...');
    const offersDeleted = await prisma.allegroOffer.deleteMany();
    console.log(`  ✅ Deleted ${offersDeleted.count} offers\n`);

    console.log('Deleting AllegroProductParameters...');
    const paramsDeleted = await prisma.allegroProductParameter.deleteMany();
    console.log(`  ✅ Deleted ${paramsDeleted.count} product parameters\n`);

    console.log('Deleting AllegroProducts...');
    const productsDeleted = await prisma.allegroProduct.deleteMany();
    console.log(`  ✅ Deleted ${productsDeleted.count} allegro products\n`);

    console.log('Deleting ImportJobs...');
    const importJobsDeleted = await prisma.importJob.deleteMany();
    console.log(`  ✅ Deleted ${importJobsDeleted.count} import jobs\n`);

    console.log('Deleting SupplierProducts...');
    const supplierProductsDeleted = await prisma.supplierProduct.deleteMany();
    console.log(`  ✅ Deleted ${supplierProductsDeleted.count} supplier products\n`);

    console.log('Deleting ResponsibleProducers...');
    const producersDeleted = await prisma.responsibleProducer.deleteMany();
    console.log(`  ✅ Deleted ${producersDeleted.count} responsible producers\n`);

    console.log('Deleting WebhookEvents...');
    const webhooksDeleted = await prisma.webhookEvent.deleteMany();
    console.log(`  ✅ Deleted ${webhooksDeleted.count} webhook events\n`);

    // Keep AllegroAccount and UserSettings as they contain configuration
    console.log('⚠️  Keeping AllegroAccount and UserSettings (configuration data)\n');

    console.log('✅ Database cleanup completed successfully!');
  } catch (error: any) {
    console.error('❌ Error cleaning database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cleanDatabase()
    .then(() => {
      console.log('\n✅ Cleanup script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanDatabase };

