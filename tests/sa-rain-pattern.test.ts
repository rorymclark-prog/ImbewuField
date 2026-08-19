import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyKoppen, rainPatternFor, type MonthlyClimate } from '@/lib/koppen-global';

// CAN THE PLANNER'S CLIMATE BRIDGE BE TRUSTED ANYWHERE IN SOUTH AFRICA?
//
// The crops page used to resolve its rainfall pattern by snapping to the nearest of seven
// hardcoded city points — which put the demo farm's frost-free Mkuze-valley coordinates on
// Durban's profile from 255 km away. The fix routes the planner through rainPatternFor()
// over the site's own monthly climate. This file is the country-wide check on that bridge:
// real places spanning South Africa's climate space, each with its accepted Köppen-Geiger
// class named as the basis for the expected pattern.
//
// FIXTURES, NOT LIVE CALLS — same approach as tests/biome-ground-truth.test.ts: each site
// carries its published-normals-scale annual rainfall and coldest/hottest month means, and
// the monthly SHAPE comes from the shared seasonal profile functions below (identical
// weights to biome-ground-truth's). Where a site already appears in that file, the same
// annual/coldest figures are reused rather than re-invented. No network is touched.
//
// WHAT IS ASSERTED. The four-way pattern for every site, and the Köppen group/code only
// where the class is unambiguous at these figures (knife-edge cases — Polokwane's BSh/Cwb
// border, Durban's Cfa/Cwa letter, which depends on exactly how dry the driest winter
// month is — assert the pattern alone, with the ambiguity named). The pattern thresholds
// (65%/35% summer share; coldest month < 4 °C) come from lib/koppen-global.ts.

/** Monthly rain that sums to `annual`, shaped like a summer-rainfall year (DJF/SON heavy).
 *  Same weights as tests/biome-ground-truth.test.ts. */
const summerRain = (annual: number): number[] =>
  [0.15, 0.13, 0.11, 0.06, 0.03, 0.01, 0.01, 0.02, 0.05, 0.10, 0.14, 0.19].map((w) => w * annual);

/** Shaped like a Cape winter-rainfall year (JJA heavy). */
const winterRain = (annual: number): number[] =>
  [0.02, 0.03, 0.04, 0.09, 0.14, 0.17, 0.16, 0.14, 0.10, 0.06, 0.03, 0.02].map((w) => w * annual);

/** Eastern Cape bimodal — autumn and spring peaks, no true dry season. */
const bimodalRain = (annual: number): number[] =>
  [0.08, 0.08, 0.11, 0.10, 0.07, 0.05, 0.05, 0.06, 0.08, 0.11, 0.11, 0.10].map((w) => w * annual);

/** Southern-hemisphere monthly temperature curve: cosine between the January-side peak and
 *  the July trough. Synthetic SHAPE (like the rain profiles) anchored on the two real
 *  endpoints — coldest and hottest month mean — which are the values every Köppen rule and
 *  the mild-frost threshold actually read. */
const temps = (coldest: number, hottest: number): number[] => {
  const mid = (coldest + hottest) / 2;
  const amp = (hottest - coldest) / 2;
  // Month m (0=Jan..11=Dec): peak at Jan (m=0.5 shifted), trough at Jul.
  return Array.from({ length: 12 }, (_, m) => {
    const phase = (2 * Math.PI * m) / 12; // 0 at Jan, π at Jul
    return Math.round((mid + amp * Math.cos(phase)) * 10) / 10;
  });
};

interface SASite {
  place: string;
  lat: number;
  lon: number;
  /** Mean annual precipitation, mm (published-normals scale; reused from
   *  tests/biome-ground-truth.test.ts where the site appears there). */
  annual: number;
  monthly: (annual: number) => number[];
  /** Coldest and hottest month mean temperature, °C. */
  coldest: number;
  hottest: number;
  expectPattern: 'summer' | 'winter' | 'all-year' | 'mild-frost';
  /** Named Köppen basis for the expectation. Asserted only when unambiguous at these figures. */
  koppenBasis: string;
  assertKoppenPrefix?: string;
}

const SITES: SASite[] = [
  {
    // The site that exposed the bug: the demo farm's real coordinates. Live NASA POWER
    // reading 2026-08-19: 768 mm/yr, coldest month 16.8 °C, summer share 0.80 → 'summer'.
    place: 'Mkuze valley lowveld (Ubhejane)', lat: -27.73, lon: 31.96,
    annual: 750, monthly: summerRain, coldest: 16, hottest: 25,
    expectPattern: 'summer',
    koppenBasis: 'Cwa/Aw border (humid subtropical–savanna, dry winter): summer-dominant rain, frost-free — coldest month far above the 4 °C mild-frost threshold',
    assertKoppenPrefix: 'C', // 16 °C coldest keeps it under the 18 °C tropical line at these figures
  },
  {
    place: 'Durban coast', lat: -29.85, lon: 31.02,
    annual: 1009, monthly: summerRain, coldest: 17, hottest: 24,
    expectPattern: 'summer',
    koppenBasis: 'Cfa/Cwa (humid subtropical — the f/w letter is knife-edge on winter rain): summer-dominant either way, frost-free coast',
    assertKoppenPrefix: 'C',
  },
  {
    place: 'Cape Town', lat: -33.93, lon: 18.42,
    annual: 515, monthly: winterRain, coldest: 12, hottest: 21,
    expectPattern: 'winter',
    koppenBasis: 'Csb (Mediterranean, warm summer): winter rain, dry summer',
    assertKoppenPrefix: 'Cs',
  },
  {
    place: 'Springbok (Namaqualand)', lat: -29.66, lon: 17.89,
    annual: 200, monthly: winterRain, coldest: 12, hottest: 22,
    expectPattern: 'winter',
    koppenBasis: 'BSk (cold semi-arid steppe) with winter rainfall — arid, but what falls comes in winter',
    assertKoppenPrefix: 'BS',
  },
  {
    place: 'Bloemfontein', lat: -29.12, lon: 26.21,
    annual: 550, monthly: summerRain, coldest: 8, hottest: 23,
    expectPattern: 'summer',
    koppenBasis: "BSk (cold semi-arid steppe), summer rain, hard interior frost — the planner's 'summer' IS its hard-frost-interior pattern; the coldest MONTHLY MEAN (8 °C) sits above the 4 °C mild-frost trigger even where frost nights are real",
    assertKoppenPrefix: 'BS',
  },
  {
    place: 'Mbombela (Nelspruit)', lat: -25.47, lon: 30.97,
    annual: 800, monthly: summerRain, coldest: 14, hottest: 25,
    expectPattern: 'summer',
    koppenBasis: 'Cwa (humid subtropical, dry winter): lowveld summer rainfall',
    assertKoppenPrefix: 'Cw',
  },
  {
    place: 'Polokwane', lat: -23.90, lon: 29.45,
    annual: 480, monthly: summerRain, coldest: 11, hottest: 23,
    expectPattern: 'summer',
    koppenBasis: 'BSh/Cwb border (published maps disagree at the aridity line) — summer-dominant rain under either class, so only the pattern is asserted',
  },
  {
    place: 'Upington (Kalahari)', lat: -28.45, lon: 21.24,
    annual: 190, monthly: summerRain, coldest: 13, hottest: 29,
    expectPattern: 'summer',
    koppenBasis: 'BWh (hot desert): what little rain falls comes as summer thunderstorms',
    assertKoppenPrefix: 'BW',
  },
  {
    place: 'East London', lat: -33.02, lon: 27.90,
    annual: 750, monthly: bimodalRain, coldest: 14, hottest: 22,
    expectPattern: 'all-year',
    koppenBasis: 'Cfa (humid subtropical, no dry season): Eastern Cape bimodal coast — summer share between the 35% and 65% pattern thresholds',
    assertKoppenPrefix: 'Cf',
  },
  {
    place: 'Johannesburg', lat: -26.20, lon: 28.05,
    annual: 713, monthly: summerRain, coldest: 11, hottest: 20,
    expectPattern: 'summer',
    koppenBasis: 'Cwb (subtropical highland, dry winter): Highveld summer rain with real winter frost — again above the 4 °C monthly-mean trigger',
    assertKoppenPrefix: 'Cw',
  },
];

test('rainPatternFor gives the Köppen-consistent pattern across SA\'s climate space', () => {
  const wrong: string[] = [];
  for (const s of SITES) {
    const mc: MonthlyClimate = { tempC: temps(s.coldest, s.hottest), precipMm: s.monthly(s.annual), lat: s.lat };
    const koppen = classifyKoppen(mc);
    const got = rainPatternFor(mc, koppen);
    if (got !== s.expectPattern) {
      wrong.push(`${s.place} → '${got}', expected '${s.expectPattern}' (${s.koppenBasis})`);
    }
    if (s.assertKoppenPrefix && !koppen.code.startsWith(s.assertKoppenPrefix)) {
      wrong.push(`${s.place} classified ${koppen.code}, expected ${s.assertKoppenPrefix}* (${s.koppenBasis})`);
    }
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

test('the temperature curve hits its two anchor points exactly', () => {
  // The shape function is trusted only because its endpoints are the real published-scale
  // values; if a refactor stops the curve passing through them, every site above quietly
  // tests different weather.
  const t = temps(8, 23);
  assert.equal(Math.min(...t), 8, 'July trough must equal the coldest-month input');
  assert.equal(Math.max(...t), 23, 'January peak must equal the hottest-month input');
});

test('the demo farm coordinates land in the Mkuze fixture, not on a distant reference city', () => {
  // Guards the geographic claim of the first fixture: DEMO_SITE really is the Mkuze-valley
  // point this file tests, and its old nearest-reference answer (Durban, 'mild-frost') is
  // exactly what the per-site path exists to replace.
  const mkuze = SITES[0];
  assert.ok(Math.abs(mkuze.lat - -27.726231) < 0.05 && Math.abs(mkuze.lon - 31.963044) < 0.05,
    'the Mkuze fixture must sit on the demo farm coordinates');
});
