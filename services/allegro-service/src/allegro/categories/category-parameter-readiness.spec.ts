import { strict as assert } from 'assert';
import { evaluateCategoryParameterReadiness } from './category-parameter-readiness';

function syntheticRequirements() {
  return {
    parameters: [
      { id: '248811', name: 'Brand', restrictions: { required: true } },
      { id: '224017', name: 'Manufacturer code', required: true },
      { id: '225693', name: 'EAN', required: false },
    ],
  };
}

async function testReadyWhenRequiredParametersArePresent() {
  const result = evaluateCategoryParameterReadiness({
    categoryId: 'category-1',
    categoryParametersPayload: syntheticRequirements(),
    draftParameters: [
      { id: '248811', values: ['Synthetic brand'] },
      { id: '224017', valuesIds: ['manufacturer-code-id'] },
    ],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.requiredCount, 2);
  assert.equal(result.providedRequiredCount, 2);
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.evidence.liveAllegroCallRequired, false);
}

async function testBlockedWhenRequiredParameterIsMissing() {
  const result = evaluateCategoryParameterReadiness({
    categoryId: 'category-1',
    categoryParametersPayload: syntheticRequirements(),
    draftParameters: [
      { id: '248811', values: ['Synthetic brand'] },
    ],
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.requiredCount, 2);
  assert.equal(result.providedRequiredCount, 1);
  assert.equal(result.missingRequired.length, 1);
  assert.equal(result.missingRequired[0].parameterId, '224017');
  assert.equal(result.missingRequired[0].reason, '[MISSING: required Allegro category parameter value]');
}

async function testBlockedWhenRequirementsAreUnavailable() {
  const result = evaluateCategoryParameterReadiness({
    categoryId: 'category-1',
    categoryParametersPayload: null,
    draftParameters: [],
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.warnings.includes('[MISSING: category parameter payload]'), true);
  assert.equal(result.warnings.includes('[MISSING: category parameter requirements]'), true);
}

export async function runCategoryParameterReadinessSpec(): Promise<void> {
  await testReadyWhenRequiredParametersArePresent();
  await testBlockedWhenRequiredParameterIsMissing();
  await testBlockedWhenRequirementsAreUnavailable();
}

if (require.main === module) {
  runCategoryParameterReadinessSpec()
    .then(() => {
      process.stdout.write('category-parameter-readiness.spec: PASS\n');
    })
    .catch((error) => {
      process.stderr.write(`category-parameter-readiness.spec: FAIL\n${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
