import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLANTING_LEGEND_SECTION_ORDER,
  PLANTING_ROUTE_STYLE,
  plantingFeaturePresentationScale,
  plantingFeaturePresentationDimensions,
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

test('presentation dimensions preserve aspect ratio with bounded print emphasis', () => {
  const basin = plantingFeaturePresentationDimensions('tree_basin', 7, 5, 1595);
  assert.equal(Math.round((basin.width / basin.height) * 1000), 1400);
  assert.ok(basin.height >= 18);
  assert.ok(basin.scale > 1);

  const longBed = plantingFeaturePresentationDimensions('veg_bed', 150, 20, 1595);
  assert.equal(Math.round((longBed.width / longBed.height) * 1000), 7500);
  assert.deepEqual(longBed, { width: 150, height: 20, scale: 1 });

  assert.deepEqual(
    plantingFeaturePresentationDimensions('jojo_5000', 9, 9, 1595),
    { width: 9, height: 9, scale: 1 },
  );
});

test('windbreak styling is explicit and does not create styles for unrelated routes', () => {
  assert.deepEqual(plantingRouteStyleFor('windbreak'), PLANTING_ROUTE_STYLE.windbreak);
  assert.equal(plantingRouteStyleFor('pipe'), undefined);
  assert.equal(PLANTING_ROUTE_STYLE.windbreak.label, 'Windbreak hedge');
  assert.deepEqual(PLANTING_ROUTE_STYLE.windbreak.dash, []);
});
