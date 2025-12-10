const { PrismaClient } = require('../shared/node_modules/.prisma/client');
const prisma = new PrismaClient();

async function checkRawData() {
  const offer = await prisma.allegroOffer.findFirst({
    orderBy: { updatedAt: 'desc' }
  });

  if (!offer) {
    console.log('No offers found');
    await prisma.$disconnect();
    return;
  }

  console.log('=== OFFER ANALYSIS ===\n');
  console.log('Title:', offer.title);
  console.log('ID:', offer.allegroOfferId);
  console.log('\n=== DIRECT FIELDS ===');
  console.log('Description:', offer.description ? `YES (${offer.description.length} chars)` : 'NO');
  console.log('Images:', offer.images ? `YES (${JSON.stringify(offer.images).substring(0, 100)})` : 'NO');
  console.log('Delivery Options:', offer.deliveryOptions ? 'YES' : 'NO');
  console.log('Payment Options:', offer.paymentOptions ? 'YES' : 'NO');
  
  console.log('\n=== RAWDATA ANALYSIS ===');
  if (offer.rawData) {
    const raw = offer.rawData;
    console.log('Has rawData: YES');
    console.log('RawData description:', raw.description ? `YES (${String(raw.description).length} chars)` : 'NO');
    console.log('RawData images:', raw.images ? `YES (${Array.isArray(raw.images) ? raw.images.length : 'not array'})` : 'NO');
    if (raw.images && Array.isArray(raw.images)) {
      console.log('RawData images sample:', raw.images.slice(0, 2));
    }
    console.log('RawData delivery:', raw.delivery || raw.deliveryOptions ? 'YES' : 'NO');
    console.log('RawData payments:', raw.payments || raw.paymentOptions ? 'YES' : 'NO');
    
    console.log('\n=== RAWDATA KEYS ===');
    console.log(Object.keys(raw).join(', '));
  } else {
    console.log('Has rawData: NO');
  }

  await prisma.$disconnect();
}

checkRawData().catch(console.error);

