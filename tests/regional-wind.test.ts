import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRegion } from '../lib/regional-wind.ts';

// Outer West Durban — the reference site for this whole rewrite.
const DURBAN_LAT = -29.783;
const DURBAN_LON = 30.98;

test('resolveRegion fires kzn-coastal for the reference Durban site, summer rainfall → fire ships', () => {
  const r = resolveRegion(DURBAN_LAT, DURBAN_LON, 'Indian Ocean Coastal Belt', 'summer');
  assert.equal(r.regionKey, 'kzn-coastal');
  const ids = r.namedWind.map((w) => w.id);
  assert.deepEqual(ids, ['summer_cooling', 'cold_front', 'berg']);
  // Every named sector is a regional-assumption, never computed.
  for (const w of r.namedWind) assert.equal(w.provenance, 'regional-assumption');
  // Fire ships, and its bearing is EXACTLY the berg bearing — never derived from winter wind.
  const berg = r.namedWind.find((w) => w.id === 'berg')!;
  assert.ok(r.fire);
  assert.equal(r.fire!.bearingDeg, berg.bearingDeg);
  assert.equal(r.fire!.fromLabel, 'NW');
});

test('resolveRegion withholds fire when the site is not summer-rainfall, even inside the gate', () => {
  const r = resolveRegion(DURBAN_LAT, DURBAN_LON, 'Indian Ocean Coastal Belt', 'winter');
  assert.equal(r.regionKey, 'kzn-coastal');
  assert.equal(r.fire, null);
});

test('resolveRegion returns null (no regional table) outside the KZN-coastal box — e.g. Stellenbosch', () => {
  const r = resolveRegion(-33.93, 18.86, 'Fynbos', 'winter');
  assert.equal(r.regionKey, null);
  assert.deepEqual(r.namedWind, []);
  assert.equal(r.fire, null);
});

test('resolveRegion returns null (no regional table) for a KZN Midlands / escarpment site — the gate is coastal only', () => {
  // Midlands, well west of the coastal box (< 30.0°E) — should not get the coastal wind rule.
  const r = resolveRegion(-29.6, 29.6, 'Grassland', 'summer');
  assert.equal(r.regionKey, null);
});

test('resolveRegion degrades to null when longitude is unavailable', () => {
  const r = resolveRegion(DURBAN_LAT, undefined, 'Indian Ocean Coastal Belt', 'summer');
  assert.equal(r.regionKey, null);
  assert.deepEqual(r.namedWind, []);
});
