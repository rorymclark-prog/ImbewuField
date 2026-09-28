import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { GROWING_ZONE_IDS, growingZoneLabel, growingZonesForClimate, type GrowingZoneId } from '@/lib/growing-zones';

// WHICH GROWING ZONE DOES A SITE'S OWN CLIMATE POINT TO?
//
// Same fixture approach as tests/sa-rain-pattern.test.ts: published-normals-scale annual rain
// and coldest/hottest month means per place, with the monthly SHAPE from the shared seasonal
// profiles (identical weights). The expectations are the zones research/crop-sources/_zones.json
// files each place under, and where that file says two zones cannot be told apart from monthly
// data, BOTH are expected — the classifier must not pick one and print it as fact.

const summerRain = (annual: number): number[] =>
  [0.15, 0.13, 0.11, 0.06, 0.03, 0.01, 0.01, 0.02, 0.05, 0.10, 0.14, 0.19].map((w) => w * annual);
const winterRain = (annual: number): number[] =>
  [0.02, 0.03, 0.04, 0.09, 0.14, 0.17, 0.16, 0.14, 0.10, 0.06, 0.03, 0.02].map((w) => w * annual);
const bimodalRain = (annual: number): number[] =>
  [0.08, 0.08, 0.11, 0.10, 0.07, 0.05, 0.05, 0.06, 0.08, 0.11, 0.11, 0.10].map((w) => w * annual);
const temps = (coldest: number, hottest: number): number[] => {
  const mid = (coldest + hottest) / 2;
  const amp = (hottest - coldest) / 2;
  return Array.from({ length: 12 }, (_, m) => Math.round((mid + amp * Math.cos((2 * Math.PI * m) / 12)) * 10) / 10);
};

interface Site {
  place: string;
  lat: number;
  rain: number[];
  coldest: number;
  hottest: number;
  expect: GrowingZoneId[];
  why: string;
}

const SITES: Site[] = [
  { place: 'Johannesburg', lat: -26.2, rain: summerRain(713), coldest: 11, hottest: 20, expect: ['highveld', 'midlands-mistbelt'],
    why: 'Cwb summer rain with frost: _zones.json cannot split Highveld from Midlands on monthly data' },
  { place: 'Mbombela (Nelspruit)', lat: -25.47, rain: summerRain(800), coldest: 14, hottest: 25, expect: ['lowveld-bushveld', 'subtropical-coast'],
    why: 'Cwa, warm summer rain: rain share cannot split Lowveld from the coast; dry-winter w orders Lowveld first' },
  { place: 'Mkuze valley (demo farm)', lat: -27.73, rain: summerRain(750), coldest: 16, hottest: 25, expect: ['lowveld-bushveld', 'subtropical-coast'],
    why: 'frost-free summer-rain lowland, _zones.json names Mkuze as Lowveld' },
  { place: 'Cape Town', lat: -33.93, rain: winterRain(515), coldest: 12, hottest: 21, expect: ['western-cape'],
    why: 'Csb winter rain' },
  { place: 'East London', lat: -33.02, rain: bimodalRain(750), coldest: 14, hottest: 22, expect: ['subtropical-coast'],
    why: 'Cfa, rain spread through the year, frost-free' },
  { place: 'Upington', lat: -28.45, rain: summerRain(190), coldest: 13, hottest: 29, expect: ['karoo-arid'],
    why: 'BWh desert: arid wins before any other rule' },
  { place: 'Sutherland', lat: -32.4, rain: bimodalRain(250), coldest: 4.5, hottest: 20, expect: ['karoo-arid'],
    why: 'BSk without summer-dominant rain' },
  { place: 'Bloemfontein', lat: -29.12, rain: summerRain(550), coldest: 8, hottest: 23, expect: ['highveld', 'karoo-arid'],
    why: '_zones.json lists BSk under both Highveld (Free State fringe) and Karoo' },
  { place: 'Lesotho-border highlands', lat: -29.6, rain: summerRain(900), coldest: 3.5, hottest: 16, expect: ['high-mountain', 'highveld'],
    why: 'coldest month under the 7 °C hard-frost line; no elevation field to confirm alpine' },
];

test('each reference place gets the zone(s) _zones.json files it under', () => {
  const wrong: string[] = [];
  for (const s of SITES) {
    const got = growingZonesForClimate(temps(s.coldest, s.hottest), s.rain, s.lat);
    if (JSON.stringify(got) !== JSON.stringify(s.expect)) wrong.push(`${s.place}: got ${JSON.stringify(got)}, expected ${JSON.stringify(s.expect)} (${s.why})`);
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

test('unusable climate claims no zone', () => {
  assert.deepEqual(growingZonesForClimate([], [], -26), []);
  assert.deepEqual(growingZonesForClimate(Array(12).fill(Number.NaN), summerRain(700), -26), []);
});

test('the eight zone ids are exactly the ones the research was filed under', () => {
  const zones = JSON.parse(readFileSync('research/crop-sources/_zones.json', 'utf8')).zones.map((z: { key: string }) => z.key);
  assert.deepEqual([...GROWING_ZONE_IDS].sort(), [...zones].sort());
});

test('two candidate zones read as "A or B"', () => {
  assert.equal(growingZoneLabel(['highveld', 'midlands-mistbelt']), 'Highveld or Midlands / Mistbelt');
  assert.equal(growingZoneLabel(['western-cape']), 'Western Cape');
});
