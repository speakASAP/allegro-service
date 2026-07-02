import { strict as assert } from 'assert';
import { OffersService } from './offers.service';

function createHarness(overrides: Record<string, any> = {}) {
  const createdOffers: any[] = [];
  const prisma = {
    allegroOffer: {
      create: async ({ data }: any) => {
        createdOffers.push(data);
        return { id: 'local-offer-1', ...data };
      },
    },
  };
  const logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  const catalogClient = {
    getProductQualityPreflight: async (catalogProductId: string) => {
      if (overrides.catalogQualityThrows) throw Object.assign(new Error('Synthetic Catalog quality outage'), { status: 503 });
      return overrides.catalogQualityPreflight || {
        policyId: 'catalog.product_quality.v1',
        productId: catalogProductId,
        canActivate: true,
        canPublish: true,
        blockingIssues: [],
        blockingMissingFields: [],
        optionalOpportunities: [],
        nextAction: 'ready_for_allegro_publish',
        sourceEndpoint: 'GET /api/products/:id/readiness',
        reviewContractEndpoint: 'GET /api/products/review/quality',
      };
    },
  };
  const configService = {
    get: (key: string) => key === 'ENCRYPTION_KEY' ? '12345678901234567890123456789012' : undefined,
  };

  return {
    service: new OffersService(
      prisma as any,
      logger as any,
      {} as any,
      configService as any,
      {} as any,
      catalogClient as any,
      {} as any,
      {} as any,
    ),
    createdOffers,
  };
}

async function testLocalCatalogDraftRequiresPassingCatalogQuality() {
  const { service, createdOffers } = createHarness();

  const offer = await service.createOffer({
    catalogProductId: '33333333-3333-3333-3333-333333333333',
    title: 'Ready local draft',
    syncToAllegro: false,
  });

  assert.equal(offer.id, 'local-offer-1');
  assert.equal(createdOffers.length, 1);
  assert.equal(createdOffers[0].catalogProductId, '33333333-3333-3333-3333-333333333333');
}

async function testLocalCatalogDraftBlocksMandatoryCatalogQualityIssue() {
  const { service, createdOffers } = createHarness({
    catalogQualityPreflight: {
      policyId: 'catalog.product_quality.v1',
      productId: '33333333-3333-3333-3333-333333333333',
      canActivate: false,
      canPublish: false,
      blockingIssues: [{ code: 'missing_image', field: 'image', severity: 'blocking', message: 'Image is required.' }],
      blockingMissingFields: ['image'],
      optionalOpportunities: [],
      nextAction: 'resolve_catalog_quality_blockers:image',
      sourceEndpoint: 'GET /api/products/:id/readiness',
      reviewContractEndpoint: 'GET /api/products/review/quality',
    },
  });

  await assert.rejects(
    () => service.createOffer({
      catalogProductId: '33333333-3333-3333-3333-333333333333',
      title: 'Blocked local draft',
      syncToAllegro: false,
    }),
    (error: any) => error.getStatus?.() === 409 && error.getResponse?.().code === 'CATALOG_QUALITY_BLOCKED',
  );
  assert.equal(createdOffers.length, 0);
}

async function testLocalCatalogDraftFailsClosedWhenQualityUnavailable() {
  const { service, createdOffers } = createHarness({ catalogQualityThrows: true });

  await assert.rejects(
    () => service.createOffer({
      catalogProductId: '33333333-3333-3333-3333-333333333333',
      title: 'Unavailable local draft',
      syncToAllegro: false,
    }),
    (error: any) => error.getStatus?.() === 503 && error.getResponse?.().code === 'CATALOG_QUALITY_PREFLIGHT_UNAVAILABLE',
  );
  assert.equal(createdOffers.length, 0);
}

export async function runOffersCatalogQualitySpec(): Promise<void> {
  await testLocalCatalogDraftRequiresPassingCatalogQuality();
  await testLocalCatalogDraftBlocksMandatoryCatalogQualityIssue();
  await testLocalCatalogDraftFailsClosedWhenQualityUnavailable();
}

if (require.main === module) {
  runOffersCatalogQualitySpec()
    .then(() => process.stdout.write('offers.catalog-quality.spec: PASS\n'))
    .catch((error) => {
      process.stderr.write(`offers.catalog-quality.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
