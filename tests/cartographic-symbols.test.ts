import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  canonicalCartographicWaterId,
  supportsCartographicWaterSymbol,
} from '@/lib/cartographic-water-symbols';
import {
  cartographicStructureKind,
  supportsCartographicStructureSymbol,
} from '@/lib/cartographic-structure-symbols';

test('real catalog water IDs resolve to illustrated symbols', () => {
  for (const id of [
    'jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel',
    'pond_small', 'dam', 'borehole', 'tap_point', 'water_trough', 'first_flush',
    'pump_filter', 'banana_circle', 'tree_basin', 'greywater_basin',
    'greywater_outlet', 'greywater_diverter', 'infiltration_basin', 'mulch_bank',
    'half_moon', 'berm', 'terrace', 'duck_pond', 'other_water',
  ]) {
    assert.equal(supportsCartographicWaterSymbol(id), true, id);
  }
  assert.equal(canonicalCartographicWaterId('mulch_bank'), 'vetiver-bank');
  assert.equal(canonicalCartographicWaterId('duck_pond'), 'small-pond');
  assert.equal(canonicalCartographicWaterId('other_water'), 'unknown-water');
  assert.equal(supportsCartographicWaterSymbol('invented_water_feature'), false);
});

test('benchmark structure catalog IDs resolve to illustrated symbols', () => {
  for (const id of [
    'chicken_coop', 'chicken_tractor', 'compost_bay', 'nursery_table', 'beehive',
    'rabbit_hutch', 'shade_house', 'greenhouse_tunnel', 'shed', 'kraal',
    'worm_farm', 'market_stall', 'goat_pen', 'pig_pen', 'biodigester',
    'shade_sail', 'gate', 'bench', 'sign', 'solar_panel_ground', 'washline',
    'other_structure',
  ]) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} exists in the catalog`);
    assert.equal(supportsCartographicStructureSymbol(ELEMENTS_BY_ID[id]), true, id);
  }
  assert.equal(supportsCartographicStructureSymbol('unknown_structure'), false);
});

test('every infrastructure catalog element has a deterministic symbol path', () => {
  for (const def of Object.values(ELEMENTS_BY_ID)) {
    if (!['water', 'structure', 'animal', 'access'].includes(def.category)) continue;
    const supported = supportsCartographicWaterSymbol(def.id) || supportsCartographicStructureSymbol(def);
    assert.equal(supported, true, `${def.id} has no deterministic cartographic symbol`);
  }
});

test('ponds and livestock pens cannot collapse to the same generic mark', () => {
  assert.equal(canonicalCartographicWaterId('duck_pond'), 'small-pond');
  assert.equal(cartographicStructureKind(ELEMENTS_BY_ID.goat_pen), 'goat-pen');
  assert.equal(cartographicStructureKind(ELEMENTS_BY_ID.pig_pen), 'pig-pen');
  assert.notEqual(cartographicStructureKind(ELEMENTS_BY_ID.goat_pen), cartographicStructureKind(ELEMENTS_BY_ID.pig_pen));
});

test('distinct real-world systems never use the generic structure fallback', () => {
  for (const id of [
    'worm_farm', 'market_stall', 'biodigester', 'shade_sail', 'gate', 'bench',
    'sign', 'solar_panel_ground', 'washline',
  ]) {
    const kind = cartographicStructureKind(ELEMENTS_BY_ID[id]);
    assert.ok(kind && !kind.startsWith('generic-'), `${id} resolved to ${kind}`);
  }
});
