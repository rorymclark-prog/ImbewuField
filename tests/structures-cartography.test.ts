import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STRUCTURES_LEGEND_SECTION_ORDER,
  structuresFeaturePresentationDimensions,
  structuresFeaturePresentationScale,
  structuresFeatureSymbolFor,
  structuresFeatureVisualFor,
  structuresLegendSectionForFeature,
  structuresRouteVisualFor,
} from '@/lib/structures-cartography';

test('Structures legend is grouped in a stable editorial order', () => {
  assert.deepEqual(STRUCTURES_LEGEND_SECTION_ORDER, [
    'SITE ACCESS & SERVICE',
    'COMPOST & NURSERY',
    'LIVESTOCK & APIARY',
    'PROTECTED GROWING',
  ]);
  assert.equal(structuresLegendSectionForFeature('gate'), 'SITE ACCESS & SERVICE');
  assert.equal(structuresLegendSectionForFeature('tap_point'), 'SITE ACCESS & SERVICE');
  assert.equal(structuresLegendSectionForFeature('compost_bay'), 'COMPOST & NURSERY');
  assert.equal(structuresLegendSectionForFeature('nursery_table'), 'COMPOST & NURSERY');
  assert.equal(structuresLegendSectionForFeature('beehive'), 'LIVESTOCK & APIARY');
  assert.equal(structuresLegendSectionForFeature('chicken_tractor'), 'LIVESTOCK & APIARY');
  assert.equal(structuresLegendSectionForFeature('shade_house'), 'PROTECTED GROWING');
});

test('visual treatments use the real catalog IDs and preserve literal feature identity', () => {
  assert.equal(structuresFeatureSymbolFor('compost_bay'), 'compost');
  assert.equal(structuresFeatureSymbolFor('beehive'), 'beehive');
  assert.equal(structuresFeatureSymbolFor('chicken_tractor'), 'chicken-tractor');
  assert.equal(structuresFeatureSymbolFor('nursery_table'), 'nursery');
  assert.equal(structuresFeatureSymbolFor('gate'), 'gate');
  assert.equal(structuresFeatureSymbolFor('tap_point'), 'tap');
  assert.equal(structuresFeatureSymbolFor('washline'), 'washline');
  assert.deepEqual(structuresFeatureVisualFor('chicken_tractor'), {
    section: 'LIVESTOCK & APIARY',
    symbol: 'chicken-tractor',
    presentationScale: 1.25,
  });
});

test('presentation emphasis is deterministic and does not rewrite geometry', () => {
  assert.equal(structuresFeaturePresentationScale('beehive'), 1.45);
  assert.equal(structuresFeaturePresentationScale('tap_point'), 1.35);
  assert.equal(structuresFeaturePresentationScale('unknown_structure'), 1);
  assert.equal(structuresFeaturePresentationScale('chicken_tractor'), structuresFeaturePresentationScale('chicken_tractor'));
});

test('tiny painted structures remain readable without changing centre or aspect ratio', () => {
  const hive = structuresFeaturePresentationDimensions('beehive', 5, 5, 2500);
  assert.equal(hive.width, hive.height);
  assert.ok(hive.width >= 33.75);

  const gate = structuresFeaturePresentationDimensions('gate', 15, 3, 2500);
  assert.ok(Math.abs(gate.width / gate.height - 5) < 1e-9);
  assert.ok(gate.width <= 125 + 1e-9);

  assert.deepEqual(
    structuresFeaturePresentationDimensions('unknown', 7, 4, 2500),
    { width: 7, height: 4, scale: 1 },
  );
});

test('walking paths are dashed while fences stay solid', () => {
  assert.deepEqual(structuresRouteVisualFor('path'), { dash: [12, 8], width: 3.2 });
  assert.deepEqual(structuresRouteVisualFor('fence'), { dash: [], width: 3.5 });
  assert.equal(structuresRouteVisualFor('windbreak'), null);
});

test('unknown and absent hand-wash IDs remain unmapped', () => {
  assert.equal(structuresLegendSectionForFeature('hand_wash_point'), null);
  assert.equal(structuresFeatureVisualFor('hand_wash_point'), null);
  assert.equal(structuresFeatureSymbolFor('invented_beehive'), null);
});
