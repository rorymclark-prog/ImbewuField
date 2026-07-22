import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STRUCTURES_LEGEND_SECTION_ORDER,
  structuresFeaturePresentationScale,
  structuresFeatureSymbolFor,
  structuresFeatureVisualFor,
  structuresLegendSectionForFeature,
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

test('unknown and absent hand-wash IDs remain unmapped', () => {
  assert.equal(structuresLegendSectionForFeature('hand_wash_point'), null);
  assert.equal(structuresFeatureVisualFor('hand_wash_point'), null);
  assert.equal(structuresFeatureSymbolFor('invented_beehive'), null);
});
