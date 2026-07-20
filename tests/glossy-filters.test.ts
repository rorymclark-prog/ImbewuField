import test from 'node:test';
import assert from 'node:assert/strict';

import { itemInFilter, lineInFilter, zonesInFilter, sheetForElement, type GlossyLayerFilter } from '../lib/glossy-filters.ts';
import { ELEMENT_CATALOG } from '../lib/design-elements.ts';

// glossy-filters.ts has said since it was extracted that it exists "so the pure layer-membership
// logic is unit-testable" — and there was no test. In that gap, itemInFilter(_, 'zones') returning
// false for every category reached production and produced a "ZONES PLAN" with no zones on it and a
// legend of invented tanks and veg beds. This file is that missing guard.

const LAYER_SHEETS: GlossyLayerFilter[] = ['water', 'planting', 'structures'];
const LINE_KINDS = ['swale', 'fence', 'path', 'pipe', 'drip', 'windbreak'] as const;

test('every catalog element appears on exactly one layer sheet', () => {
  const orphans: string[] = [];
  const duplicated: string[] = [];
  for (const def of ELEMENT_CATALOG) {
    const on = LAYER_SHEETS.filter((f) => itemInFilter(def.category, f, def.id));
    if (on.length === 0) orphans.push(`${def.id} (${def.category})`);
    if (on.length > 1) duplicated.push(`${def.id} → ${on.join('+')}`);
  }
  assert.deepEqual(orphans, [], 'elements on NO sheet — a farmer places these and never sees them');
  assert.deepEqual(duplicated, [], 'elements on MORE THAN ONE sheet — the plan set contradicts itself');
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

// The regression Rory reported directly: "the farmer places a Banana Circle from the Planting step,
// then finds it on sheet 04 Water & Irrigation, not on 05 Planting & Agroforestry."
test('earth-shaped BEDS are planting, earth-shaped WATER works are water', () => {
  for (const id of ['banana_circle', 'tree_basin', 'raised_bed', 'keyhole_bed', 'herb_spiral']) {
    const def = ELEMENT_CATALOG.find((d) => d.id === id);
    assert.ok(def, `${id} vanished from the catalog`);
    assert.equal(sheetForElement(def!.category, id), 'planting', `${id} should be on the Planting sheet`);
    assert.equal(itemInFilter(def!.category, 'water', id), false, `${id} must not appear on the Water sheet`);
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
