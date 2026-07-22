import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLANTING_LEGEND_SECTION_ORDER,
  PLANTING_ROUTE_STYLE,
  plantingFeaturePresentationScale,
  plantingLegendSectionForFeature,
  plantingRouteStyleFor,
} from '@/lib/planting-cartography';

test('Planting legend follows the Reference Blueprint reading order', () => {
  assert.deepEqual(PLANTING_LEGEND_SECTION_ORDER, [
    'PRODUCTION PLANTING',
    'PERENNIAL GUILDS',
    'GREYWATER-READY BASINS',
    'OTHER PLANTING',
  ]);
  assert.equal(plantingLegendSectionForFeature('veg_bed'), 'PRODUCTION PLANTING');
  assert.equal(plantingLegendSectionForFeature('tree_mango'), 'PERENNIAL GUILDS');
  assert.equal(plantingLegendSectionForFeature('raised_bed'), 'PRODUCTION PLANTING');
  assert.equal(plantingLegendSectionForFeature('banana_circle'), 'GREYWATER-READY BASINS');
  assert.equal(plantingLegendSectionForFeature('other_planting'), 'OTHER PLANTING');
});

test('classification is factual and does not invent unknown features', () => {
  assert.equal(plantingLegendSectionForFeature('jojo_5000'), null);
  assert.equal(plantingLegendSectionForFeature('made_up_tree'), null);
  assert.equal(plantingLegendSectionForFeature('Tree Mango'), null);
});

test('presentation scale is deterministic and leaves centres and saved geometry to the caller', () => {
  assert.equal(plantingFeaturePresentationScale('tree_mango'), 1.3);
  assert.equal(plantingFeaturePresentationScale('veg_bed'), 1.28);
  assert.equal(plantingFeaturePresentationScale('banana_circle'), 1.2);
  assert.equal(plantingFeaturePresentationScale('jojo_5000'), 1);
  assert.equal(plantingFeaturePresentationScale('tree_mango'), plantingFeaturePresentationScale('tree_mango'));
});

test('windbreak styling is explicit and does not create styles for unrelated routes', () => {
  assert.deepEqual(plantingRouteStyleFor('windbreak'), PLANTING_ROUTE_STYLE.windbreak);
  assert.equal(plantingRouteStyleFor('pipe'), undefined);
  assert.equal(PLANTING_ROUTE_STYLE.windbreak.label, 'Windbreak hedge');
  assert.deepEqual(PLANTING_ROUTE_STYLE.windbreak.dash, []);
});
