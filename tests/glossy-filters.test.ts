import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cartographicItemPaintRank,
  itemInFilter,
  lineInFilter,
  zonesInFilter,
  sheetForElement,
  sheetsForElement,
  groundRegister,
  layerContentCount,
  type GlossyLayerFilter,
} from '../lib/glossy-filters.ts';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID, biomeClimates, elementVisibleInPalette } from '../lib/design-elements.ts';
import type { DesignCanvasState, GroundFeatureKind, ZoneShape } from '../lib/design-canvas.ts';
import type { MapRefLayers } from '../lib/base-layers.ts';
import { waterRouteStyleFor } from '../lib/water-cartography.ts';

// glossy-filters.ts has said since it was extracted that it exists "so the pure layer-membership
// logic is unit-testable" — and there was no test. In that gap, itemInFilter(_, 'zones') returning
// false for every category reached production and produced a "ZONES PLAN" with no zones on it and a
// legend of invented tanks and veg beds. This file is that missing guard.

const LAYER_SHEETS: GlossyLayerFilter[] = ['water', 'planting', 'structures'];
const LINE_KINDS = ['swale', 'fence', 'path', 'pipe', 'drip', 'windbreak', 'greywater'] as const;

test('every catalog element has exactly one primary layer sheet', () => {
  const orphans: string[] = [];
  for (const def of ELEMENT_CATALOG) {
    if (!sheetForElement(def.category, def.id)) orphans.push(`${def.id} (${def.category})`);
  }
  assert.deepEqual(orphans, [], 'elements on NO sheet — a farmer places these and never sees them');
});

test('only explicit integrated systems are factual content on two layer sheets', () => {
  const shared = ELEMENT_CATALOG
    .map((def) => ({ id: def.id, sheets: LAYER_SHEETS.filter((f) => itemInFilter(def.category, f, def.id)) }))
    .filter(({ sheets }) => sheets.length > 1)
    .map(({ id, sheets }) => `${id}:${sheets.join('+')}`)
    .sort();
  assert.deepEqual(shared, [
    'banana_circle:water+planting',
    'tree_basin:water+planting',
  ]);
  for (const def of ELEMENT_CATALOG) {
    const sheets = sheetsForElement(def.category, def.id);
    assert.equal(sheets[0], sheetForElement(def.category, def.id), `${def.id} primary sheet must remain first`);
  }
});

test('every line kind appears on exactly one layer sheet', () => {
  for (const kind of LINE_KINDS) {
    const on = LAYER_SHEETS.filter((f) => lineInFilter(kind, f));
    assert.equal(on.length, 1, `${kind} is on ${on.length} sheets (${on.join('+') || 'none'})`);
  }
});

test('the whole-design sheet carries everything', () => {
  for (const def of ELEMENT_CATALOG) {
    assert.ok(itemInFilter(def.category, 'all', def.id), `${def.id} missing from the masterplan`);
  }
  for (const kind of LINE_KINDS) assert.ok(lineInFilter(kind, 'all'), `${kind} missing from the masterplan`);
  assert.ok(zonesInFilter('all'));
});

test('cartographic stacking paints tree basins below every circular tree canopy', () => {
  const basin = ELEMENT_CATALOG.find((def) => def.id === 'tree_basin')!;
  const trees = ELEMENT_CATALOG.filter((def) => def.category === 'growing' && def.shape === 'circle');
  assert.ok(trees.length > 0, 'guard: the catalog should contain tree canopies');
  for (const tree of trees) {
    assert.ok(
      cartographicItemPaintRank(basin) < cartographicItemPaintRank(tree),
      `${basin.name} must paint below ${tree.name}`,
    );
  }
});

test('cartographic stacking keeps all ground earthworks below planting', () => {
  const earthworks = ELEMENT_CATALOG.filter((def) => def.category === 'earthworks');
  const planting = ELEMENT_CATALOG.filter((def) => def.category === 'growing');
  for (const ground of earthworks) {
    for (const plant of planting) {
      assert.ok(
        cartographicItemPaintRank(ground) < cartographicItemPaintRank(plant),
        `${ground.name} must paint below ${plant.name}`,
      );
    }
  }
});

test('subtropical planting palette hides deprecated and wrong-climate fruit trees', () => {
  const climates = biomeClimates('Indian Ocean Coastal Belt');
  assert.deepEqual(climates, ['subtropical']);
  for (const id of ['tree_guava', 'tree_apple', 'tree_pear', 'tree_plum', 'tree_pomegranate', 'tree_olive']) {
    assert.equal(elementVisibleInPalette(ELEMENTS_BY_ID[id], climates), false, `${id} should not be offered on this subtropical site`);
  }
  for (const id of ['tree_mango', 'tree_avocado', 'tree_macadamia', 'tree_litchi', 'tree_natal_plum', 'tree_wild_plum', 'tree_waterberry', 'tree_other']) {
    assert.equal(elementVisibleInPalette(ELEMENTS_BY_ID[id], climates), true, `${id} should be available on this subtropical site`);
  }
});

// The regression Rory reported directly: "the farmer places a Banana Circle from the Planting step,
// then finds it on sheet 04 Water & Irrigation, not on 05 Planting & Agroforestry."
test('earth-shaped beds are planting, while integrated basins also belong on Water', () => {
  for (const id of ['banana_circle', 'tree_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'planting', `${id} should be on the Planting sheet`);
    assert.equal(itemInFilter(def!.category, 'water', id), true, `${id} is also factual Water content`);
    assert.equal(itemInFilter(def!.category, 'planting', id), true, `${id} must remain Planting content`);
  }
  for (const id of ['raised_bed', 'keyhole_bed', 'herb_spiral']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(sheetForElement(def.category, id), 'planting', `${id} should be on the Planting sheet`);
    assert.equal(itemInFilter(def.category, 'water', id), false, `${id} stays Water context, not content`);
  }
  for (const id of ['greywater_basin', 'infiltration_basin', 'half_moon', 'berm', 'terrace']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'water', `${id} shapes land for WATER and belongs on Water`);
  }
});

test('the zones sheet carries zones and no elements or lines', () => {
  assert.ok(zonesInFilter('zones'));
  for (const def of ELEMENT_CATALOG) {
    assert.equal(itemInFilter(def.category, 'zones', def.id), false, `${def.id} leaked onto the Zones sheet`);
  }
  for (const kind of LINE_KINDS) assert.equal(lineInFilter(kind, 'zones'), false, `${kind} leaked onto the Zones sheet`);
});

test('only the whole-design and zones sheets carry zone bands', () => {
  assert.deepEqual(
    (['all', 'water', 'zones', 'planting', 'structures'] as GlossyLayerFilter[]).filter(zonesInFilter),
    ['all', 'zones'],
  );
});

test('sheetForElement is total over the catalog — no element falls through to null', () => {
  const unmapped = ELEMENT_CATALOG.filter((d) => sheetForElement(d.category, d.id) === null);
  assert.deepEqual(unmapped.map((d) => `${d.id} (${d.category})`), []);
});

// ── Context elements: shown so a sheet reads, never counted as its content ────
// Rory on the Water sheet: "no driveway no beds no tree basins no veg bed drip irrigation!!!".
// The beds and basins moved to Planting (correctly — that is where a farmer counts them), but a
// water plan whose drip lines run to nothing is unreadable.
import { isContextElement } from '../lib/glossy-filters.ts';

test('the Water sheet SHOWS the beds and basins its irrigation feeds', () => {
  for (const id of ['raised_bed', 'keyhole_bed', 'herb_spiral']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.ok(isContextElement(def, 'water'), `${id} must be visible on the Water sheet`);
    // ...but is still not water CONTENT: it gets no water legend row, and Planting counts it.
    assert.equal(itemInFilter(def.category, 'water', def.id), false, `${id} must not be water content`);
    assert.equal(itemInFilter(def.category, 'planting', def.id), true, `${id} is Planting content`);
  }
});

test('integrated Water and Planting content is never demoted to Water context', () => {
  for (const id of ['banana_circle', 'tree_basin']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(itemInFilter(def.category, 'water', def.id), true, `${id} should be Water content`);
    assert.equal(itemInFilter(def.category, 'planting', def.id), true, `${id} should be Planting content`);
    assert.equal(isContextElement(def, 'water'), false, `${id} must not be drawn twice as context and content`);
  }
});

test('Vetiver Bank belongs to Planting and Whole, not the Water sheet', () => {
  const def = ELEMENT_CATALOG.find((d) => d.id === 'mulch_bank')!;
  assert.equal(itemInFilter(def.category, 'water', def.id), false);
  assert.equal(isContextElement(def, 'water'), false);
  assert.equal(itemInFilter(def.category, 'planting', def.id), true);
  assert.equal(itemInFilter(def.category, 'all', def.id), true);
});

test('context is a Water-sheet concept only, and never applies to a sheet own content', () => {
  const bed = ELEMENT_CATALOG.find((d) => d.id === 'raised_bed')!;
  for (const f of ['all', 'zones', 'planting', 'structures'] as const) {
    assert.equal(isContextElement(bed, f), false, `${f} must not borrow context elements`);
  }
  // A tank is water CONTENT — it must never be demoted to context on its own sheet.
  const tank = ELEMENT_CATALOG.find((d) => d.category === 'water')!;
  assert.equal(isContextElement(tank, 'water'), false);
});

// Only planting beds that help a route read stay as quiet Water context. Integrated sinks and
// banks are exact, named Water content and must never pass through the context path as well.
test('Water context contains only non-Water planting fixtures', () => {
  const contextIds = ELEMENT_CATALOG.filter((d) => isContextElement(d, 'water')).map((d) => d.id);
  assert.ok(contextIds.includes('raised_bed'), 'guard: Water still needs a served-bed context fixture');
  for (const id of contextIds) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    assert.equal(itemInFilter(def.category, 'water', def.id), false, `${id} cannot be content and context`);
    assert.equal(sheetForElement(def.category, def.id), 'planting', `${id} context must come from Planting`);
  }
  for (const id of ['banana_circle', 'tree_basin']) {
    assert.equal(contextIds.includes(id), false, `${id} is named Water content, not quiet context`);
  }
  assert.equal(contextIds.includes('mulch_bank'), false, 'Vetiver Bank is absent from Water, not borrowed context');
});

// ── Greywater ────────────────────────────────────────────────────────────────
// Rory: "also no greywater?" It was not a render bug — LineShape.kind had no 'greywater' member, so
// a farmer had no tool to draw the run at all, while the water prompt described a violet greywater
// line in detail. The only way the model could satisfy that was to invent one.
test('a greywater run is a real line kind, and it belongs to the water sheet', () => {
  assert.equal(lineInFilter('greywater', 'water'), true);
  for (const f of ['planting', 'structures', 'zones'] as const) {
    assert.equal(lineInFilter('greywater', f), false, `greywater must not appear on ${f}`);
  }
  assert.equal(lineInFilter('greywater', 'all'), true, 'the masterplan carries everything');
});

test('every Water-sheet line has deterministic cartography and no non-Water line does', () => {
  for (const kind of LINE_KINDS) {
    assert.equal(Boolean(waterRouteStyleFor(kind)), lineInFilter(kind, 'water'), kind);
  }
});

test('every line kind still lands on exactly one layer sheet', () => {
  // Re-stated for the widened union: adding a kind must not silently orphan or double-file it.
  const KINDS = ['swale', 'fence', 'path', 'pipe', 'drip', 'windbreak', 'greywater'] as const;
  for (const kind of KINDS) {
    const on = (['water', 'planting', 'structures'] as const).filter((f) => lineInFilter(kind, f));
    assert.equal(on.length, 1, `${kind} is on ${on.length} sheets (${on.join('+') || 'none'})`);
  }
});

// ── groundRegister: the single authority for content/context/absent, EARTHWORKS-CONTEXT-PLAN
// Phase 2. Before this there were three hand-rolled copies (producer-prompt.ts's fabricIsContent,
// drawBlueprintGround's alpha choice, groundRows' legend gate) and none of them was in charge —
// table-driven over the full GroundFeatureKind × GlossyLayerFilter matrix so a kind or a sheet
// added later cannot silently fall through un-tested, the exact gap that let
// itemInFilter(_, 'zones') ship broken (see this file's header comment).
const GROUND_KINDS: GroundFeatureKind[] = ['house', 'patio', 'driveway', 'lawn', 'veg_garden', 'orchard', 'cleared', 'boundary'];
const ALL_SHEETS: GlossyLayerFilter[] = ['all', 'water', 'zones', 'planting', 'structures'];

test('groundRegister: the boundary is ABSENT everywhere — it is a drawn line, never a ground wash', () => {
  for (const filter of ALL_SHEETS) {
    assert.equal(groundRegister('boundary', filter), 'absent', `boundary must be absent on ${filter}`);
  }
});

test('groundRegister: every other ground kind is CONTENT on the whole-design, Planting and Structures sheets', () => {
  for (const kind of GROUND_KINDS) {
    if (kind === 'boundary') continue;
    for (const filter of ['all', 'planting', 'structures'] as const) {
      assert.equal(groundRegister(kind, filter), 'content', `${kind} should be content on ${filter}`);
    }
  }
});

test('groundRegister: every other ground kind is CONTEXT (orientation only) on Water and Zones', () => {
  for (const kind of GROUND_KINDS) {
    if (kind === 'boundary') continue;
    for (const filter of ['water', 'zones'] as const) {
      assert.equal(groundRegister(kind, filter), 'context', `${kind} should be context on ${filter}`);
    }
  }
});

test('groundRegister: full table has no gaps — every kind × sheet combination resolves', () => {
  for (const kind of GROUND_KINDS) {
    for (const filter of ALL_SHEETS) {
      const register = groundRegister(kind, filter);
      assert.ok(
        register === 'content' || register === 'context' || register === 'absent',
        `${kind} on ${filter} produced an unrecognised register: ${register}`,
      );
    }
  }
});

// ── layerContentCount: the CRITICAL visible consequence of the register — a design that is only
// traced ground (no trees, no beds placed yet) must count as real content on a sheet where ground
// is CONTENT (Planting), and must NOT manufacture a Water or Zones sheet out of context-only
// ground the farmer never actually designed for water or zones.
function fixtureState(feature: GroundFeatureKind): DesignCanvasState {
  const ring: ZoneShape = { id: 'g1', zone: 0, points: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4]], feature };
  return {
    siteId: 'test-site',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 640, imgH: 640, mPerPx: 0.1 },
    items: [],
    zones: [ring],
    lines: [],
    step: 'review',
    updatedAt: new Date().toISOString(),
  };
}
const EMPTY_REF: MapRefLayers = { boundary: [], house: [], driveway: [] };

test('layerContentCount: a traced orchard with nothing else placed IS content on Planting', () => {
  const state = fixtureState('orchard');
  assert.equal(layerContentCount(state, EMPTY_REF, 'planting'), 1);
});

test('layerContentCount: the same traced orchard is NOT content on Water or Zones — context never inflates the gate', () => {
  const state = fixtureState('orchard');
  assert.equal(layerContentCount(state, EMPTY_REF, 'water'), 0);
  assert.equal(layerContentCount(state, EMPTY_REF, 'zones'), 0);
});

test('layerContentCount: a traced boundary ring never counts as ground content on any sheet', () => {
  // EMPTY_REF.boundary is deliberately empty too, so the separate main-map boundary bonus on
  // 'all' (layerContentCount's own `+1`) cannot mask a leak from the ZoneShape boundary ring.
  const state = fixtureState('boundary');
  for (const filter of ALL_SHEETS) {
    assert.equal(layerContentCount(state, EMPTY_REF, filter), 0, `boundary ring leaked into ${filter}'s count`);
  }
});
