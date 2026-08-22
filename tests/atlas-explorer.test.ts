// Atlas pure logic (lib/atlas.ts): the LocationData -> MonthlyClimate adapter,
// the climate -> catalog-rain-pattern bridge, the northern-hemisphere calendar
// shift, and the sowable-this-month catalog filter.
//
// Real-catalog assertions are deliberately PROPERTY-shaped (every returned
// crop really does list the queried month under the queried pattern) rather
// than pinned to specific crops: lib/crop-catalog.ts's windows are actively
// curated, and this suite must not fail because an agronomy pass moved a
// maize month. Exact-shape behaviour is covered by synthetic fixtures.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  monthlyClimateFrom, koppenFrom, atlasRainPattern, catalogMonthFor, sowableInMonth,
} from '@/lib/atlas';
import { CROPS, type CropDef } from '@/lib/crop-catalog';

/* ── fixtures ──────────────────────────────────────────────────────────── */

function input(lat: number, tempC: number[], precipMm: number[]) {
  return { lat, climate: { monthlyTemp: tempC }, rainfall: { monthly: precipMm } };
}

// Pretoria-ish: summer-rainfall Highveld, mild winters (coldest month ~12°C).
const PRETORIA = input(-25.7,
  [23, 22, 21, 18, 15, 12, 12, 15, 19, 21, 22, 23],
  [136, 75, 82, 51, 13, 7, 3, 6, 22, 71, 98, 110]);

// Cape Town-ish: Mediterranean, winter rainfall.
const CAPE_TOWN = input(-33.9,
  [21, 21, 20, 17, 15, 13, 12, 13, 14, 16, 18, 20],
  [15, 15, 20, 40, 80, 90, 85, 75, 45, 30, 20, 15]);

// Vienna-ish: real winters — frost is the binding constraint, not rain.
const VIENNA = input(48.2,
  [-1, 1, 5, 10, 15, 18, 20, 20, 15, 10, 4, 0],
  [40, 40, 45, 50, 60, 70, 70, 65, 55, 40, 50, 45]);

// Singapore-ish: hot and wet in every month.
const SINGAPORE = input(1.35,
  Array(12).fill(27),
  [200, 150, 180, 180, 170, 160, 150, 170, 170, 190, 250, 230]);

function makeCrop(partial: Partial<CropDef> & Pick<CropDef, 'key' | 'sowMonths' | 'yieldKgPerM2'>): CropDef {
  return {
    name: partial.key, icon: '🌱', daysToHarvest: 60, spacingCm: 30, note: '',
    ...partial,
  } as CropDef;
}

/* ── adapter ───────────────────────────────────────────────────────────── */

test('monthlyClimateFrom maps LocationData fields straight through, Jan-first', () => {
  const mc = monthlyClimateFrom(PRETORIA);
  assert.equal(mc.lat, -25.7);
  assert.deepEqual(mc.tempC, PRETORIA.climate.monthlyTemp);
  assert.deepEqual(mc.precipMm, PRETORIA.rainfall.monthly);
});

test('koppenFrom is the same classifier the server runs — sane codes for known climates', () => {
  // Not asserting full codes everywhere (that is koppen-global.test.ts\'s job) —
  // just that the bridge feeds it correctly oriented data.
  assert.equal(koppenFrom(CAPE_TOWN).code.startsWith('Cs'), true, 'Cape Town must read Mediterranean (Cs*)');
  assert.equal(koppenFrom(SINGAPORE).group, 'A', 'Singapore must read tropical');
});

/* ── pattern bridge ────────────────────────────────────────────────────── */

test('summer-rainfall subtropical climate maps to the summer pattern', () => {
  assert.equal(atlasRainPattern(PRETORIA), 'summer');
});

test('Mediterranean winter-rainfall climate maps to the winter pattern', () => {
  assert.equal(atlasRainPattern(CAPE_TOWN), 'winter');
});

test('a climate with real frost maps to mild-frost regardless of rain seasonality', () => {
  assert.equal(atlasRainPattern(VIENNA), 'mild-frost');
});

test('hot, evenly wet climate maps to all-year', () => {
  assert.equal(atlasRainPattern(SINGAPORE), 'all-year');
});

test('unusable climate data yields null, never a guessed pattern', () => {
  const broken = input(10, Array(12).fill(NaN), Array(12).fill(50));
  assert.equal(atlasRainPattern(broken), null);
});

/* ── hemisphere calendar shift ─────────────────────────────────────────── */

test('southern-hemisphere months pass through unshifted', () => {
  for (let m = 1; m <= 12; m++) assert.equal(catalogMonthFor(m, -26), m);
});

test('northern-hemisphere months shift six months into the SA calendar', () => {
  assert.equal(catalogMonthFor(10, 39.9), 4, 'a Beijing October is the season of an SA April');
  assert.equal(catalogMonthFor(1, 48.2), 7);
  assert.equal(catalogMonthFor(12, 40), 6);
  assert.equal(catalogMonthFor(6, 51.5), 12);
});

test('catalogMonthFor rejects out-of-range months', () => {
  assert.throws(() => catalogMonthFor(0, 10), RangeError);
  assert.throws(() => catalogMonthFor(13, 10), RangeError);
});

/* ── sowable filter ────────────────────────────────────────────────────── */

test('sowableInMonth returns crops whose window includes the month, for that pattern only', () => {
  const crops = [
    makeCrop({ key: 'in-window', yieldKgPerM2: 2, sowMonths: { 'summer': [10, 11], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
    makeCrop({ key: 'other-month', yieldKgPerM2: 2, sowMonths: { 'summer': [3], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
    makeCrop({ key: 'other-pattern', yieldKgPerM2: 2, sowMonths: { 'summer': [], 'winter': [10], 'all-year': [], 'mild-frost': [] } }),
  ];
  assert.deepEqual(sowableInMonth('summer', 10, crops).map((c) => c.key), ['in-window']);
});

test('the descriptive crop readout keeps yield-null food crops but excludes zero-food and timing-unverified entries', () => {
  const crops = [
    makeCrop({ key: 'yielding', yieldKgPerM2: 1.5, sowMonths: { 'summer': [10], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
    makeCrop({ key: 'unverified-yield', yieldKgPerM2: null, sowMonths: { 'summer': [10], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
    makeCrop({ key: 'zero-yield', yieldKgPerM2: 0, sowMonths: { 'summer': [10], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
    makeCrop({ key: 'legacy-timing', yieldKgPerM2: null, timingVerified: false, sowMonths: { 'summer': [10], 'winter': [], 'all-year': [], 'mild-frost': [] } }),
  ];
  assert.deepEqual(sowableInMonth('summer', 10, crops).map((c) => c.key), ['yielding', 'unverified-yield']);
});

test('coriander and kale stay visible in their sourced windows even with unverified kilograms', () => {
  // Kale's June listing flipped on 2026-08-23 when its duration was sourced;
  // both crops still carry yieldKgPerM2: null, which must never hide a crop
  // whose timing is verified.
  const open = sowableInMonth('mild-frost', 6);
  assert.ok(open.some((crop) => crop.key === 'coriander' && crop.yieldKgPerM2 === null));
  assert.ok(open.some((crop) => crop.key === 'kale' && crop.yieldKgPerM2 === null));
  assert.ok(open.every((crop) => crop.timingVerified !== false));
});

test('against the real catalog: every returned crop honestly lists the month, and some month is never empty', () => {
  for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as const) {
    let anyMonthNonEmpty = false;
    for (let m = 1; m <= 12; m++) {
      const out = sowableInMonth(pattern, m);
      if (out.length > 0) anyMonthNonEmpty = true;
      for (const c of out) {
        assert.ok(c.sowMonths[pattern].includes(m), `${c.key} returned for ${pattern}/${m} without listing it`);
        assert.notEqual(c.yieldKgPerM2, 0, `${c.key} is a zero-food entry but was returned`);
        assert.notEqual(c.timingVerified, false, `${c.key} has an unverified legacy timing window but was returned`);
      }
    }
    assert.ok(anyMonthNonEmpty, `pattern ${pattern} never yields a single sowable crop in any month — filter is broken`);
  }
  // The default crop list really is the shared catalog, not a copy.
  const viaDefault = sowableInMonth('summer', 10);
  const viaExplicit = sowableInMonth('summer', 10, CROPS);
  assert.deepEqual(viaDefault.map((c) => c.key), viaExplicit.map((c) => c.key));
});
