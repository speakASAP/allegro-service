import { strict as assert } from 'assert';
        import { CatalogSellActionService } from './catalog-sell-action.service';

        function createHarness(overrides: Record<string, any> = {}) {
          const createdOffers: any[] = [];
          const existingDraft = overrides.existingDraft || null;
          const updatedOffers = new Map<string, any>();
          const accounts = overrides.accounts || [
            { id: '22222222-2222-2222-2222-222222222222', name: 'Primary', isActive: true, tokenExpiresAt: null },
          ];

          const prisma = {
            allegroAccount: {
              findMany: async () => accounts,
            },
            allegroOffer: {
              findFirst: async ({ where }: any) => {
                if (where.id && existingDraft && existingDraft.id === where.id) return existingDraft;
                if (existingDraft && where.catalogProductId === existingDraft.catalogProductId) return existingDraft;
                return null;
              },
              findUnique: async ({ where }: any) => updatedOffers.get(where.id) || (existingDraft && existingDraft.id === where.id ? existingDraft : null),
              update: async ({ where, data }: any) => {
                const base = updatedOffers.get(where.id) || existingDraft || { id: where.id };
                const next = { ...base, ...data };
                updatedOffers.set(where.id, next);
                return next;
              },
            },
          };

          const catalogClient = {
            getProductById: async (catalogProductId: string) => ({
              id: catalogProductId,
              sku: 'SKU-1',
              title: 'Synthetic catalog title',
              brand: 'Synthetic brand',
              ean: '1234567890123',
              categoryId: overrides.catalogCategoryId || 'cat-123',
              price: { gross: 109, currency: 'PLN' },
              quantity: 5,
              images: ['https://example.invalid/product.jpg'],
            }),
          };

          const offersService = {
            createOffer: async (dto: any) => {
              createdOffers.push(dto);
              return {
                id: '11111111-1111-1111-1111-111111111111',
                accountId: dto.accountId || null,
                catalogProductId: dto.catalogProductId,
                title: dto.title,
                categoryId: dto.categoryId,
                price: dto.price,
                currency: dto.currency,
                quantity: dto.quantity,
                publicationStatus: dto.publicationStatus,
                status: dto.status,
                updatedAt: '2026-06-19T00:00:00Z',
              };
            },
          };

          const publishLifecycleService = {
            prepare: async (dto: any) => ({
              id: 'attempt-1',
              status: overrides.prepareStatus || 'PREPARED',
              offerId: dto.offerId,
              accountId: dto.accountId,
              catalogProductId: dto.catalogProductId,
              blockedReasons: overrides.blockedReasons || [],
            }),
            confirm: async (attemptId: string) => ({
              id: attemptId,
              status: 'QUEUED',
              offerId: '11111111-1111-1111-1111-111111111111',
            }),
            getAttempt: async (attemptId: string) => ({
              id: attemptId,
              status: overrides.statusLookup || 'PREPARED',
              offerId: '11111111-1111-1111-1111-111111111111',
            }),
          };

          return {
            service: new CatalogSellActionService(
              prisma as any,
              { setContext() {}, log() {}, warn() {}, error() {} } as any,
              offersService as any,
              publishLifecycleService as any,
              catalogClient as any,
            ),
            createdOffers,
          };
        }

        async function testPrepareCreatesNewDraftAndReturnsConfirmAction() {
          const { service, createdOffers } = createHarness();
          const result = await service.prepare(
            { catalogProductId: '33333333-3333-3333-3333-333333333333' },
            'user-1',
          );

          assert.equal(createdOffers.length, 1);
          assert.equal(createdOffers[0].syncToAllegro, false);
          assert.equal(result.draftCreated, true);
          assert.equal(result.nextAction, 'confirm_publish');
          assert.equal(result.draft.accountId, '22222222-2222-2222-2222-222222222222');
        }

        async function testPrepareReusesExistingDraft() {
          const existingDraft = {
            id: 'existing-offer',
            accountId: '22222222-2222-2222-2222-222222222222',
            catalogProductId: '33333333-3333-3333-3333-333333333333',
            title: 'Existing draft',
            categoryId: 'cat-123',
            price: 109,
            currency: 'PLN',
            quantity: 5,
            publicationStatus: 'INACTIVE',
            status: 'DRAFT',
            updatedAt: '2026-06-19T00:00:00Z',
          };
          const { service, createdOffers } = createHarness({ existingDraft });
          const result = await service.prepare(
            { catalogProductId: '33333333-3333-3333-3333-333333333333' },
            'user-1',
          );

          assert.equal(createdOffers.length, 0);
          assert.equal(result.draftCreated, false);
          assert.equal(result.draft.id, 'existing-offer');
        }

        async function testBulkPrepareAssignsSequentialRateLimitSlots() {
          const { service } = createHarness();
          const result = await service.bulkPrepare(
            {
              items: [
                { catalogProductId: '33333333-3333-3333-3333-333333333333' },
                { catalogProductId: '44444444-4444-4444-4444-444444444444' },
              ],
            },
            'user-1',
          );

          assert.equal(result.results.length, 2);
          assert.equal(result.results[0].rateLimitSlot.slotOffsetSeconds, 0);
          assert.equal(result.results[1].rateLimitSlot.slotOffsetSeconds, 1);
        }

        async function testConfirmQueuesWithoutExecuting() {
          const { service } = createHarness();
          const result = await service.confirm('attempt-1', 'user-1');

          assert.equal(result.status, 'QUEUED');
          assert.equal(result.nextAction, 'monitor_publish_queue');
        }

        export async function runCatalogSellActionSpec(): Promise<void> {
          await testPrepareCreatesNewDraftAndReturnsConfirmAction();
          await testPrepareReusesExistingDraft();
          await testBulkPrepareAssignsSequentialRateLimitSlots();
          await testConfirmQueuesWithoutExecuting();
        }

        if (require.main === module) {
          runCatalogSellActionSpec()
            .then(() => process.stdout.write('catalog-sell-action.spec: PASS\n'))
            .catch((error) => {
              process.stderr.write(`catalog-sell-action.spec: FAIL\n${error.stack || error.message}\n`);
              process.exitCode = 1;
            });
        }
