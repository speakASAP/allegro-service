/**
 * Check the last updated offer and its sync status
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Load .env if available
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function checkLastUpdate() {
  try {
    const offer = await prisma.allegroOffer.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        allegroOfferId: true,
        syncStatus: true,
        syncError: true,
        lastSyncedAt: true,
        updatedAt: true,
        syncSource: true,
        status: true,
        publicationStatus: true,
      },
    });

    if (!offer) {
      console.log('No offers found in database');
      return;
    }

    console.log('Last Updated Offer:');
    console.log(JSON.stringify(offer, null, 2));
    console.log('\nTime since update:', Math.round((Date.now() - new Date(offer.updatedAt).getTime()) / 1000), 'seconds ago');
    
    if (offer.syncStatus === 'PENDING') {
      console.log('\n⚠️  WARNING: Sync status is PENDING - async sync may not have completed');
    } else if (offer.syncStatus === 'ERROR') {
      console.log('\n❌ ERROR: Sync failed:', offer.syncError);
    } else if (offer.syncStatus === 'SYNCED') {
      console.log('\n✅ Sync completed successfully');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLastUpdate();

