import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalUnitDraft,
  editCanonicalUnitDraft,
  readCanonicalUnitDraft,
  switchCanonicalUnitDraft,
  formatCanonicalUnitValue,
  INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES,
} from '../lib/length-units.ts';
import { AVOIRDUPOIS_POUND_IN_KILOGRAMS } from '../lib/mass-units.ts';
import {
  GROWER_ESTIMATE_DENSITY_SPEC,
  growerEstimateDensityToCanonical,
  growerEstimateDensityFromCanonical,
  type GrowerEstimateDensityUnit,
  type GrowerEstimateDensityKind,
} from '../lib/grower-estimate-units.ts';

const sourceKey = 'synthetic-grower-estimate/test-source';

function createDraft<K extends string>(
  unit: GrowerEstimateDensityUnit,
  values: Readonly<Record<K, number | undefined>>,
  optionalFields: readonly K[] = []
) {
  return createCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, {
    sourceKey,
    unit,
    values,
    optionalFields,
  });
}

test('density conversion uses the shared factors while presentation rounding never claims an exact inverse', () => {
  // Plant density: 1 plant/ft2 = 1 / 0.09290304 plants/m2
  const plantCanonical = growerEstimateDensityToCanonical(1, 'plants/ft2');
  assert.equal(plantCanonical, 1 / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
  const plantDisplay = growerEstimateDensityFromCanonical(plantCanonical!, 'plants/ft2');
  assert.equal(plantDisplay, 1);

  // Yield density: 1 lb/ft2/cycle = (1 * 0.45359237 kg) / 0.09290304 m2
  const yieldCanonical = growerEstimateDensityToCanonical(1, 'lb/ft2/cycle');
  assert.equal(yieldCanonical, AVOIRDUPOIS_POUND_IN_KILOGRAMS / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
  // Canonical Number division need not have an exact inverse. The shared
  // formatter may round its display, but that text must not replace storage.
  assert.equal(formatCanonicalUnitValue(GROWER_ESTIMATE_DENSITY_SPEC, yieldCanonical!, 'lb/ft2/cycle'), '1');
  const yieldDraft = createDraft('lb/ft2/cycle', { yieldWeight: yieldCanonical! });
  const yieldRead = readCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, yieldDraft, sourceKey);
  assert.equal(yieldRead.status, 'ready');
  if (yieldRead.status === 'ready') assert.equal(yieldRead.values.yieldWeight, yieldCanonical);

  // Metric canonical paths are exact identity
  assert.equal(growerEstimateDensityToCanonical(4.25, 'plants/m2'), 4.25);
  assert.equal(growerEstimateDensityFromCanonical(4.25, 'plants/m2'), 4.25);
  assert.equal(growerEstimateDensityToCanonical(1.8, 'kg/m2/cycle'), 1.8);
  assert.equal(growerEstimateDensityFromCanonical(1.8, 'kg/m2/cycle'), 1.8);
});

test('explicit zero and blank optional fields remain preserved without fabricating values', () => {
  // Explicit zero converts to canonical 0 and formats as '0'
  assert.equal(growerEstimateDensityToCanonical(0, 'plants/ft2'), 0);
  assert.equal(growerEstimateDensityToCanonical(0, 'lb/ft2/cycle'), 0);
  assert.equal(growerEstimateDensityFromCanonical(0, 'plants/ft2'), 0);
  assert.equal(growerEstimateDensityFromCanonical(0, 'lb/ft2/cycle'), 0);

  // Draft with explicit 0 and optional undefined
  // Both keys belong to the fixture; only the second permits a missing value.
  const draft = createDraft<'density' | 'optionalDensity'>('plants/ft2', { density: 0, optionalDensity: undefined }, ['optionalDensity']);
  assert.equal(draft.fields.density.status, 'ready');
  assert.equal(draft.fields.density.text, '0');
  assert.equal(draft.fields.optionalDensity.status, 'ready');
  assert.equal(draft.fields.optionalDensity.text, '');

  // Pristine blank switches unit without fabricating values
  const switched = switchCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'plants/m2', sourceKey);
  assert.equal(switched.status, 'ready');
  if (switched.status === 'ready') {
    assert.equal(switched.draft.fields.optionalDensity.text, '');
    assert.equal(switched.draft.fields.optionalDensity.canonicalValue, undefined);
    assert.equal(switched.draft.fields.density.text, '0');
    assert.equal(switched.draft.fields.density.canonicalValue, 0);
  }
});

test('dot and comma decimal inputs parse correctly and incomplete drafts hold unit switch', () => {
  let draft = createDraft('lb/ft2/cycle', { yieldWeight: undefined }, ['yieldWeight']);

  // Edit with comma decimal
  draft = editCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'yieldWeight', '2,5');
  assert.equal(draft.fields.yieldWeight.status, 'ready');
  assert.ok(typeof draft.fields.yieldWeight.canonicalValue === 'number');

  // A trailing separator is a complete decimal in the shared parser. A lone
  // separator remains unfinished and must hold reads and switches.
  draft = editCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'yieldWeight', '2.');
  assert.equal(draft.fields.yieldWeight.status, 'ready');
  draft = editCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'yieldWeight', '.');
  assert.equal(draft.fields.yieldWeight.status, 'incomplete');

  // Incomplete draft holds unit switch atomically
  const heldSwitch = switchCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'kg/m2/cycle', sourceKey);
  assert.equal(heldSwitch.status, 'held');
  assert.equal(heldSwitch.reason, 'unfinished-dimensions');

  // Read also holds on incomplete
  const heldRead = readCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, sourceKey);
  assert.equal(heldRead.status, 'held');
  assert.equal(heldRead.reason, 'unfinished-dimensions');
});

test('spec prevents switching across mismatched kinds (plant-density vs yield-density)', () => {
  const plantDraft = createDraft('plants/ft2', { density: 10 });
  const switchAttempt = switchCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, plantDraft, 'kg/m2/cycle' as unknown as GrowerEstimateDensityUnit, sourceKey);
  assert.equal(switchAttempt.status, 'held');
  assert.equal(switchAttempt.reason, 'mixed-dimensions');
});

test('rejects negative numbers, nonfinite/overflow, and unsupported units safely', () => {
  // Negative rejection
  assert.equal(growerEstimateDensityToCanonical(-1, 'plants/m2'), null);
  assert.equal(growerEstimateDensityToCanonical(-1, 'plants/ft2'), null);
  assert.equal(growerEstimateDensityToCanonical(-1, 'kg/m2/cycle'), null);
  assert.equal(growerEstimateDensityToCanonical(-1, 'lb/ft2/cycle'), null);
  assert.equal(growerEstimateDensityFromCanonical(-1, 'plants/m2'), null);

  // Nonfinite rejection
  assert.equal(growerEstimateDensityToCanonical(Infinity, 'plants/ft2'), null);
  assert.equal(growerEstimateDensityToCanonical(NaN, 'plants/ft2'), null);

  // Unsupported unit
  assert.equal(growerEstimateDensityToCanonical(10, 'unsupported-unit' as unknown as GrowerEstimateDensityUnit), null);
  assert.equal(growerEstimateDensityFromCanonical(10, 'unsupported-unit' as unknown as GrowerEstimateDensityUnit), null);
});

test('stale source key holds read and unit switch', () => {
  const draft = createDraft('plants/m2', { density: 5 });
  const staleRead = readCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'different-source-key');
  assert.equal(staleRead.status, 'held');
  assert.equal(staleRead.reason, 'source-changed');

  const staleSwitch = switchCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, 'plants/ft2', 'different-source-key');
  assert.equal(staleSwitch.status, 'held');
  assert.equal(staleSwitch.reason, 'source-changed');
});

test('repeated toggles preserve pristine canonical numbers without iterative drift', () => {
  // Awkward high-precision canonical density value
  const canonicalValue = 4.123456789012345;
  let draft = createDraft('plants/m2', { density: canonicalValue });

  // Toggle back and forth between plants/m2 and plants/ft2 100 times
  for (let i = 0; i < 100; i++) {
    const nextUnit: GrowerEstimateDensityUnit = i % 2 === 0 ? 'plants/ft2' : 'plants/m2';
    const res = switchCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, nextUnit, sourceKey);
    assert.equal(res.status, 'ready');
    if (res.status === 'ready') draft = res.draft;
  }

  // Reading canonical value after 100 toggles must retain exact original number
  const read = readCanonicalUnitDraft(GROWER_ESTIMATE_DENSITY_SPEC, draft, sourceKey);
  assert.equal(read.status, 'ready');
  if (read.status === 'ready') {
    assert.equal(read.values.density, canonicalValue);
  }
});
