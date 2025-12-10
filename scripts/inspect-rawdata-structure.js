const { PrismaClient } = require('../shared/node_modules/.prisma/client');

const prisma = new PrismaClient();

async function inspectRawData() {
  try {
    const offer = await prisma.allegroOffer.findFirst({
      where: { allegroOfferId: '17765840250' },
      select: { rawData: true, description: true, images: true, deliveryOptions: true, paymentOptions: true },
    });

    if (!offer || !offer.rawData) {
      console.log('No offer found or no rawData');
      return;
    }

    const rd = offer.rawData;

    console.log('\n=== DESCRIPTION LOCATIONS ===');
    console.log('  - rd.description:', !!rd.description, typeof rd.description);
    if (rd.description) {
      console.log('    Type:', typeof rd.description);
      if (typeof rd.description === 'string') {
        console.log('    Length:', rd.description.length);
        console.log('    Preview:', rd.description.substring(0, 100));
      } else if (typeof rd.description === 'object') {
        console.log('    Keys:', Object.keys(rd.description));
      }
    }
    console.log('  - rd.description?.sections:', !!rd.description?.sections);
    console.log('  - rd.description?.items:', !!rd.description?.items);
    console.log('  - rd.sections:', !!rd.sections);
    console.log('  - Direct field description:', !!offer.description, offer.description?.substring(0, 50) || 'N/A');

    console.log('\n=== IMAGES LOCATIONS ===');
    console.log('  - rd.images:', !!rd.images, Array.isArray(rd.images) ? `Array(${rd.images.length})` : typeof rd.images);
    console.log('  - rd.primaryImage:', !!rd.primaryImage);
    if (rd.primaryImage) {
      console.log('    Type:', typeof rd.primaryImage);
      if (typeof rd.primaryImage === 'object') {
        console.log('    Keys:', Object.keys(rd.primaryImage));
        console.log('    URL:', rd.primaryImage.url || 'N/A');
        console.log('    Path:', rd.primaryImage.path || 'N/A');
      } else {
        console.log('    Value:', rd.primaryImage);
      }
    }
    console.log('  - Direct field images:', !!offer.images, Array.isArray(offer.images) ? `Array(${offer.images.length})` : typeof offer.images);

    console.log('\n=== DELIVERY LOCATIONS ===');
    console.log('  - rd.delivery:', !!rd.delivery, typeof rd.delivery);
    if (rd.delivery) {
      console.log('    Type:', typeof rd.delivery);
      if (typeof rd.delivery === 'object') {
        console.log('    Keys:', Object.keys(rd.delivery));
      }
    }
    console.log('  - rd.deliveryOptions:', !!rd.deliveryOptions);
    console.log('  - Direct field deliveryOptions:', !!offer.deliveryOptions);

    console.log('\n=== PAYMENT LOCATIONS ===');
    console.log('  - rd.payments:', !!rd.payments);
    if (rd.payments) {
      console.log('    Type:', typeof rd.payments);
      if (typeof rd.payments === 'object') {
        console.log('    Keys:', Object.keys(rd.payments));
      }
    }
    console.log('  - rd.paymentOptions:', !!rd.paymentOptions);
    console.log('  - rd.sellingMode?.payments:', !!rd.sellingMode?.payments);
    if (rd.sellingMode?.payments) {
      console.log('    Type:', typeof rd.sellingMode.payments);
      if (typeof rd.sellingMode.payments === 'object') {
        console.log('    Keys:', Object.keys(rd.sellingMode.payments));
      }
    }
    console.log('  - Direct field paymentOptions:', !!offer.paymentOptions);

    console.log('\n=== ALL RAWDATA KEYS ===');
    console.log(Object.keys(rd).join(', '));

  } catch (error) {
    console.error('Error inspecting raw data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectRawData().catch(console.error);

