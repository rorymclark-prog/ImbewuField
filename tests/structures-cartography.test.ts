import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENT_CATALOG } from '@/lib/design-elements';
import { sheetForElement } from '@/lib/glossy-filters';
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

// Previously a documented gap (docs/CATALOG-MATRIX-2026-07-27.md, "Minor — Gap 4"):
// structuresLegendSectionForFeature only named a section for 8 curated "special visual treatment"
// ids, so these 17 real structure/animal/access elements got a legend row with no heading. Fixed —
// table-driven so every one of the 17 is proven individually, not just "some section came back".
const PREVIOUSLY_UNGROUPED_IDS: Record<string, string> = {
  greenhouse_tunnel: 'PROTECTED GROWING',
  chicken_coop: 'LIVESTOCK & APIARY',
  kraal: 'LIVESTOCK & APIARY',
  worm_farm: 'COMPOST & NURSERY',
  market_stall: 'SITE ACCESS & SERVICE',
  other_structure: 'SITE ACCESS & SERVICE',
  goat_pen: 'LIVESTOCK & APIARY',
  pig_pen: 'LIVESTOCK & APIARY',
  duck_pond: 'LIVESTOCK & APIARY',
  rabbit_hutch: 'LIVESTOCK & APIARY',
  water_trough2: 'LIVESTOCK & APIARY',
  biodigester: 'SITE ACCESS & SERVICE',
  shade_sail: 'SITE ACCESS & SERVICE',
  bench: 'SITE ACCESS & SERVICE',
  sign: 'SITE ACCESS & SERVICE',
  solar_panel_ground: 'SITE ACCESS & SERVICE',
  shed: 'SITE ACCESS & SERVICE',
};

test('the 17 previously-ungrouped Structures elements now each get their named section', () => {
  assert.equal(Object.keys(PREVIOUSLY_UNGROUPED_IDS).length, 17);
  for (const [id, expectedSection] of Object.entries(PREVIOUSLY_UNGROUPED_IDS)) {
    assert.equal(
      structuresLegendSectionForFeature(id),
      expectedSection,
      `${id} should be grouped under ${expectedSection}`,
    );
  }
});

// Table-driven coverage over the REAL catalog, not a hand-copied list — this is what makes the
// test fail if a future catalog addition (a new 'structure'/'animal'/'access' element) is left
// unsectioned, per the fix's requirement, rather than only re-checking today's known 24 ids.
test('every catalog element that reaches the Structures output sheet gets a non-empty legend section', () => {
  const unsectioned: string[] = [];
  let structuresSheetCount = 0;
  for (const def of ELEMENT_CATALOG) {
    if (sheetForElement(def.category, def.id) !== 'structures') continue;
    structuresSheetCount += 1;
    if (structuresLegendSectionForFeature(def.id) === null) unsectioned.push(def.id);
  }
  // Sanity check the fixture itself still exercises real coverage — guards against this test
  // silently passing because sheetForElement stopped returning 'structures' for anything.
  assert.ok(structuresSheetCount >= 24, `expected at least 24 Structures-sheet elements, found ${structuresSheetCount}`);
  assert.deepEqual(unsectioned, [], 'every Structures-sheet element must have a named legend section');
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
  assert.equal(structuresFeatureSymbolFor('chicken_coop'), null);
  assert.equal(structuresFeatureSymbolFor('greenhouse_tunnel'), null);
  assert.equal(structuresFeatureVisualFor('chicken_coop'), null);
  assert.equal(structuresFeatureVisualFor('greenhouse_tunnel'), null);
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
