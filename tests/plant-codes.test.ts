import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { plantingLegendSectionForFeature } from '@/lib/planting-cartography';
import {
  PLANT_CODES,
  codedLegendText,
  plantCodesForSheet,
  plantTakesCode,
} from '@/lib/plant-codes';

test('no two plants in the catalog share a code', () => {
  // A code is a lookup key into the legend. Two plants sharing one makes the legend ambiguous,
  // which is a worse sheet than no codes at all — the farmer reads "MG" and cannot tell whether
  // they are standing at the mango or the macadamia.
  const seen = new Map<string, string>();
  for (const [id, code] of Object.entries(PLANT_CODES)) {
    assert.ok(!seen.has(code), `${id} and ${seen.get(code)} both use ${code}`);
    seen.set(code, id);
  }
});

test('every coded id is a real catalog plant, and carries a planting legend row', () => {
  // The code has to be explained by a row on the same sheet. An id with a code but no planting
  // legend section would be a mark on the map with nothing to look it up in — the invariant this
  // whole feature is built around, read backwards.
  for (const id of Object.keys(PLANT_CODES)) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} has a code but is not in the catalog`);
    assert.ok(plantTakesCode(id), `${id} has a code but gets no planting legend row`);
  }
});

test('the catalog covers every plant that gets a planting legend row', () => {
  // A plant with a legend row and no code falls back to a DERIVED code, which is correct but is
  // never as readable as a chosen one. This test is the nudge to add it to the table when a new
  // plant joins the catalog, not a hard architectural requirement.
  const uncoded = Object.keys(ELEMENTS_BY_ID)
    .filter((id) => plantTakesCode(id) && !PLANT_CODES[id]);
  assert.deepEqual(uncoded, [], `add a code for: ${uncoded.join(', ')}`);
});

test('a sheet never assigns one code to two plants', () => {
  const ids = Object.keys(ELEMENTS_BY_ID).filter(plantTakesCode);
  const codes = plantCodesForSheet(ids);
  assert.equal(new Set(codes.values()).size, codes.size, 'a code was issued twice on one sheet');
  assert.equal(codes.size, ids.length, 'a plant on the sheet went uncoded');
});

test('only planting takes a code — a tank or a gate is not a plant', () => {
  assert.equal(plantTakesCode('tree_mango'), true);
  assert.equal(plantTakesCode('veg_bed'), true);
  assert.equal(plantTakesCode('jojo_5000'), false);
  assert.equal(plantTakesCode('gate'), false);
  assert.equal(plantTakesCode('not_a_real_element'), false);
  // And the two answers come from ONE rule, so they cannot drift.
  for (const id of Object.keys(ELEMENTS_BY_ID)) {
    assert.equal(plantTakesCode(id), plantingLegendSectionForFeature(id) !== null, id);
  }
});

test('an unknown plant still gets a usable, unique, stable code', () => {
  // A farmer's own plant is not in the catalog, and must not therefore be the one thing on the
  // sheet you cannot identify.
  const codes = plantCodesForSheet(['tree_mango', 'tree_macadamia', 'veg_bed']);
  assert.equal(codes.get('tree_mango'), 'MG');
  assert.equal(codes.get('tree_macadamia'), 'MC');
  // Same set, same codes, every render — a code that moved between renders would make every
  // export look like a change and would invalidate a printed sheet.
  const again = plantCodesForSheet(['veg_bed', 'tree_macadamia', 'tree_mango']);
  assert.deepEqual([...codes].sort(), [...again].sort(), 'input order changed the codes');
  // Nothing that is not a plant sneaks in.
  assert.equal(plantCodesForSheet(['jojo_5000', 'gate']).size, 0);
});

test('a legend row wears its code, and a row without one is left alone', () => {
  assert.equal(codedLegendText('MG', 'Mango Tree ×4'), 'MG · Mango Tree ×4');
  // Lines, ground and anything uncoded must pass through untouched — the separator would otherwise
  // appear with nothing in front of it.
  assert.equal(codedLegendText(undefined, 'Property boundary'), 'Property boundary');
  assert.equal(codedLegendText('', 'Property boundary'), 'Property boundary');
});
