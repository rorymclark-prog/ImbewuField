// CP-113: DataPanel must not state frost, mildness or fixed-month planting advice that its
// data cannot support. A monthly MEAN cannot show frost (Johannesburg: coldest mean ~10 °C,
// record low -4.8 °C), and gridded minima are only a reading when tagged 'nasa-power'.
//
// WHAT RUNS: the REAL components/DataPanel.tsx is rendered whole with react-test-renderer
// (Overview by default; Climate through the real `forcedTab` prop, which the component's own
// effect applies). Only its heavy children are stubbed (every './X' and '@/components/*'
// import, next/dynamic, firebase init, css, app-level). Nothing is extracted or copied.
// There is also a source-level check that the removed identifiers and strings are gone.
// This is a render check, not a browser check: no layout, theme or live climate request.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const root = new URL('../', import.meta.url).href;
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/DataPanel.tsx')) {
      if (specifier === 'next/dynamic') return { shortCircuit: true, url: moduleUrl('export default function dynamic(){return function Stub(){return null;};}') };
      if (specifier === '@/lib/app-level') return { shortCircuit: true, url: moduleUrl("export const useAppLevel=()=> 'all';") };
      if (specifier === '@/components/AppConfirm') return { shortCircuit: true, url: moduleUrl('export const useAppConfirm=()=>async()=>false;') };
      if (specifier.startsWith('./') || specifier.startsWith('@/components/')) {
        return { shortCircuit: true, url: moduleUrl('const C=()=>null;export default C;export const Stub=C;') };
      }
    }
    if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return { shortCircuit: true, url: moduleUrl('export const getFirebase=()=>null;export const isBackendConfigured=()=>false;') };
    if (specifier.endsWith('.css')) return { shortCircuit: true, url: moduleUrl('export default {};') };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) {
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    }
    return next(url, context);
  },
});
(globalThis as any).window ??= Object.assign(new EventTarget(), { localStorage: undefined });
const { default: DataPanel } = await import('../components/DataPanel.tsx');
// The REAL dictionaries: the component reads `t` from useLanguage() (lib/i18n-context.ts `Ctx`), so each
// render is wrapped in Ctx.Provider with t = the real translate(lang, key) from lib/i18n.tsx.
const { Ctx } = await import('../lib/i18n-context.ts');
const { loadLocale, translate } = await import('../lib/i18n.tsx');
await loadLocale('zu');

const RAIN = [127, 81, 73, 43, 16, 7, 3, 7, 16, 57, 89, 122];
const JHB = [20, 20, 19, 16, 13, 10, 10, 13, 17, 18, 19, 20];
const UNDERBERG = [18.9, 18.6, 17.4, 14.6, 11.2, 8.1, 7.37, 9.9, 13.1, 14.9, 16.4, 18.1];
const NORTH = [-1, 1, 5, 10, 15, 18, 20, 20, 15, 10, 4, 0];
const COMPLETE = { source: 'nasa-power', status: 'complete' };
const INCOMPLETE = { source: 'nasa-power', status: 'incomplete' };
const TAG = { minTempSource: 'nasa-power' };

function place(climate: Record<string, unknown>, lat = -26.2): any {
  return {
    lat, lon: 28.05,
    climate: {
      meanTemp: 16, maxTemp: 20, minTemp: -4.8, monthlyTemp: JHB, solarRadiation: 5,
      windSource: 'nasa-power', koppen: 'Cwb', koppenDesc: 'Subtropical highland, dry winter', windSpeed: 3, windFromSummer: 'N', windFromWinter: 'S',
      monthlyTempCoverage: COMPLETE, ...TAG,
      ...climate,
    },
    rainfall: { monthly: RAIN, annual: RAIN.reduce((a, b) => a + b, 0), rainfallSource: 'nasa-power', pattern: 'summer', wetSeason: 'Oct to Mar', drySeason: 'May to Aug' },
    soil: { textureClass: 'Loam', ph: 6.2, organicCarbon: 1.1, sand: 40, silt: 35, clay: 25 },
    elevation: { elevation: 1745, slopeDeg: 2, slopePct: 3, aspectLabel: 'N', aspectDeg: 0 },
    biome: { code: 'grassland', name: 'Grassland', keySpecies: [], challenges: [], description: '' },
  };
}

function textOf(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  // Adjacent text nodes (JSX `a {b}° (c)`) join directly; element boundaries become a space.
  return (node.children ?? []).map((c: any) => (typeof c === 'string' ? c : ` ${textOf(c)} `)).join('');
}
function renderTab(data: any, tab?: string, lang = 'en'): string {
  const props: any = { data, loading: false, coords: { lat: data.lat, lon: data.lon }, forcedTab: tab, onTabChange() {}, onOpenReport() {}, onJumpTo() {}, surveyViewport: 'mobile' };
  let r: any;
  const value = { lang, setLang() {}, t: (key: string) => translate(lang, key), onboarded: true, completeOnboarding() {} };
  act(() => { r = create(React.createElement(Ctx.Provider, { value }, React.createElement(DataPanel as any, props))); });
  const out = textOf(r.toJSON() && { children: [].concat(r.toJSON()) }).replace(/\s+/g, ' ');
  act(() => r.unmount());
  return out;
}
const overview = (d: any, lang = 'en') => renderTab(d, undefined, lang);
const climate = (d: any, lang = 'en') => renderTab(d, 'Climate', lang);

const FROST_WORDS = /Frost-free|frost-free|Frost expected|Light frost|Frost likely|Likely|Occasional|Rare\b|frost-free season|mild winters|Mild winters|mild, dry winter/;
const DAY_WORDS = /≈ \d+ days|Plant tender|mid-Aug|\(Jun–Jul\)|Windiest Aug|Aug–Sep/;
const UNAVAILABLE = /Climate interpretation is unavailable for these monthly temperatures/;

const fixtures: Record<string, any> = {
  a: place({}),
  b: place({ monthlyTemp: UNDERBERG, minTemp: -6.2 }),
  c: place({ minTemp: 0 }),
  d: place({ minTemp: 8, minTempSource: undefined }),
  e: place({ minTemp: -999 }),
  f: place({ monthlyTemp: Array(12).fill(20), monthlyTempCoverage: INCOMPLETE }),
  g: place({ monthlyTempCoverage: undefined }),
  h: place({ monthlyTemp: JHB.slice(0, 11) }),
  i: place({ monthlyTemp: NORTH, koppen: 'Cfb', koppenDesc: 'Temperate oceanic', minTemp: -15 }, 48.2),
  j: place({ monthlyTemp: NORTH, koppen: 'Cfb', koppenDesc: 'Temperate oceanic', windSpeed: 4, windFromSummer: 'W', windFromWinter: 'SW', solarRadiation: 3.1 }, 48.2),
  k: place({ monthlyTemp: UNDERBERG, minTemp: -6.2, windSpeed: 3, windFromSummer: 'N', windFromWinter: 'S' }),
  l: place({ solarRadiation: 0, windSpeed: 0, windSource: undefined, windFromSummer: '—', windFromWinter: '—' }),
  m: place({ solarRadiation: -999, windSpeed: NaN, windFromSummer: '—', windFromWinter: 'S' }),
  n: place({ monthlyTemp: JHB, koppen: 'Cfb', koppenDesc: 'Temperate oceanic' }),
};
const WITHHELD = ['f', 'g', 'h']; // Climate interpretation withheld for these

for (const [name, data] of Object.entries(fixtures)) {
  test(`fixture ${name}: no frost class, mildness or fixed-month claim; rainfall kept`, () => {
    const o = overview(data);
    const c = climate(data);
    for (const [label, seen] of [['Overview', o], ['Climate', c]] as const) {
      assert.doesNotMatch(seen, FROST_WORDS, `${label} frost/mildness wording`);
      assert.doesNotMatch(seen, DAY_WORDS, `${label} day-count / fixed-month wording`);
    }
    assert.match(o, /641/, 'annual rainfall still shown on Overview');
    assert.match(o, /Modelled record low/, 'record-low row label');
  });
}

test('a and b: the validated record low is printed on Overview and Climate', () => {
  for (const [key, v] of [['a', '-4.8°C'], ['b', '-6.2°C']] as const) {
    assert.match(overview(fixtures[key]), new RegExp(`Modelled record low: ${v}`), `${key} insight bullet`);
    assert.match(climate(fixtures[key]), new RegExp(`Modelled record low: ${v}`), `${key} climate`);
  }
});

test('c: a real zero is a reading', () => {
  assert.match(overview(fixtures.c), /Modelled record low: 0°C/);
  assert.match(climate(fixtures.c), /Modelled record low: 0°C/);
});

test('d and e: an untagged minimum and the -999 marker are not a record low', () => {
  for (const key of ['d', 'e']) {
    for (const seen of [overview(fixtures[key]), climate(fixtures[key])]) {
      assert.match(seen, /not known/i);
      assert.doesNotMatch(seen, /8\s?°C|-999|8°C as/);
      assert.doesNotMatch(seen, /Modelled record low: /);
    }
  }
});

test('f, g, h: Climate withholds interpretation; Overview still shows rainfall and the validated record low', () => {
  for (const key of ['f', 'g', 'h']) {
    const c = climate(fixtures[key]);
    assert.match(c, UNAVAILABLE, key);
    assert.doesNotMatch(c, /Coldest month mean|Hottest month mean|Good for growing|Cwb|Subtropical|Modelled record low/i, `${key} no class, crops or footer`);
    const o = overview(fixtures[key]);
    assert.match(o, /641/, key);
    assert.match(o, /Modelled record low/, key);
    assert.match(o, /-4\.8°C/, `${key} record low validated separately from the means`);
  }
});

test('i: the northern footer names Jan as coldest and Jul or Aug as hottest, with no southern winter or August planting', () => {
  const c = climate(fixtures.i);
  assert.match(c, /Coldest month mean ≈ -1° \(Jan\)/);
  assert.match(c, /Hottest month mean ≈ 20° \((Jul|Aug)\)/);
  assert.doesNotMatch(c, /Jun–Jul|mid-Aug|Plant tender/);
  assert.match(c, /Modelled record low: -15°C/);
});

test('a: footer, wind advice and the frost-card body are neutral', () => {
  const c = climate(fixtures.a);
  assert.match(c, /Coldest month mean ≈ 10° \(Jun\)/);
  assert.match(c, /Hottest month mean ≈ 20° \(Jan\)/);
  // Changed for CP-117: the windbreak advice and "Prevailing" wording are removed; the card now states only the recorded Dec–Feb direction.
  assert.match(c, /December to February: from the N\./);
  assert.doesNotMatch(c, /Prevailing wind is from the N|site a windbreak/);
  assert.match(c, /Frost months are not shown\. Monthly averages cannot show frost/);
  assert.doesNotMatch(c, /bananas|sugar cane|tropical fruit/);
});

test('site summary: no frost sentence, whatever the record low', () => {
  // Until the CP-117 change this asserted "Protect against frost in winter." for a validated record
  // low below 2 °C and its absence otherwise. The sentence turned one modelled number into advice
  // and named a season the record does not carry, so it is removed for every case. The record low
  // itself is still on the Overview row and insight line, asserted in the fixture tests above.
  const lima = (seen: string) => seen.slice(seen.indexOf('Lima ·'));
  assert.match(overview(fixtures.a), /Lima/, 'the summary renders');
  for (const key of ['a', 'b', 'c', 'd', 'e', 'i']) {
    assert.doesNotMatch(lima(overview(fixtures[key])), /frost|winter/i, `${key}: no frost or season sentence in the summary`);
  }
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /siteSummaryFrostProtection/);
});

test('source: the removed identifiers and strings are gone from DataPanel.tsx', () => {
  // Comments may name what was removed; only code and strings count.
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*)/.test(l)).join('\n');
  for (const gone of ['frostLabel', 'frostChip', 'frostFreeDays', 'lightFrostMonths', 'insightFrostFree', 'insightFrostExpected', 'insightLightFrost',
    'climateFrostFree', 'plantTenderMidAug', 'winterLowPrefix', '(Jun–Jul)', 'frostFreePrefix', 'Windiest Aug', 'frost-free', 'Mild winters']) {
    assert.ok(!source.includes(gone), `${gone} must not appear`);
  }
  assert.ok(!/data\.climate\.minTemp\s*[<>]/.test(source), 'no frost comparison on the raw minTemp');
  assert.ok(!/\btMin\s*[<>]=?\s*\d/.test(source), 'no frost comparison on tMin');
});

test('the Overview calendar strip no longer marks "Frost" months from monthly means', () => {
  // The strip classed a month as "Frost" when its MEAN was below 3 °C, so a place with a
  // coldest mean of 10 °C and frosts on record showed no frost month at all. The class and
  // its legend entry are gone; a month that cold reads "Rest" like any other cool month.
  for (const name of ['a', 'b', 'i']) assert.doesNotMatch(overview(fixtures[name]), /\bFrost\b/, `fixture ${name}`);
  // Changed for CP-117: the whole strip (Grow/Dry/Rest) is removed, so "Rest" no longer appears at all.
  assert.doesNotMatch(overview(fixtures.i), /\bRest\b/);
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /calendarFrost|isFrost/);
});

// ---- CP-117: no fabricated monthly sun/wind, no Grow/Dry/Rest strip, no class-code crop promises ----
const BANNED = /Sunniest|windbreak|hedge row|highest-return|mist belt|Mist belt|Year-round|year-round production|thrive|Good for growing|\bGrow\b|\bRest\b|Planting calendar|Prevailing|in winter\b|Light\b|Calm|≈ \d+(\.\d+)? h\b|h avg/;
const TWELVE_RUN = /(-?\d+(\.\d)?°? [JFMASOND] ){12}/g;
const CFB = ['i', 'j', 'n'];

for (const [name, data] of Object.entries(fixtures)) {
  test(`CP-117 fixture ${name}: nothing fabricated on Overview or Climate`, () => {
    const o = overview(data);
    const c = climate(data);
    assert.doesNotMatch(o, BANNED, 'Overview');
    assert.doesNotMatch(c, BANNED, 'Climate');
    assert.doesNotMatch(o, /NaN|-999/, 'Overview');
    assert.doesNotMatch(c, /NaN|-999/, 'Climate');
    assert.doesNotMatch(o, /Modelled wind estimate: ≈ 0 km/, 'Overview never prints 0 km/h');
    const runs = (c.match(TWELVE_RUN) ?? []).length;
    if (WITHHELD.includes(name)) {
      assert.equal(runs, 0, 'withheld Climate has no monthly runs');
      return;
    }
    assert.equal(runs, 2, 'only rainfall and temperature have twelve-month runs');
    assert.match(c, /Monthly sunshine is not shown/);
    assert.match(c, /Monthly wind is not shown/);
    assert.match(c, CFB.includes(name) ? /Temperate oceanic/ : /Subtropical highland, dry winter/);
    assert.match(c, /No crops are suggested from the climate type alone/);
    assert.doesNotMatch(c, /0 km\/h/);
    assert.match(c, /641/, 'rainfall kept');
  });
}

test('j: northern wind lines use calendar months, not seasons', () => {
  const c = climate(fixtures.j);
  assert.match(c, /December to February: from the W\./);
  assert.match(c, /June to August: from the SW\./);
  assert.match(c, /Modelled wind estimate: ≈ 14 km\/h\./);
  assert.match(c, /N E S W/, 'rose drawn for a known Dec–Feb direction');
  assert.doesNotMatch(c, /(summer|winter)[^.]{0,40}from the|from the (W|SW)\b[^.]*(summer|winter)/i);
  assert.match(overview(fixtures.j), /Modelled wind estimate: ≈ 14 km\/h\./, 'Overview wind bullet');
});

test('k: southern Cwb keeps the tagged record low, conventional name and local-conditions limit', () => {
  const c = climate(fixtures.k);
  assert.match(c, /Modelled record low: -6\.2°C/);
  assert.match(c, /Subtropical highland, dry winter/);
  // Shared notes contain agricultural claims for other codes; the panel uses one local-conditions limit.
  assert.match(c, /A climate type does not know your water, frost or soil/);
  assert.match(c, /December to February: from the N\./);
  assert.match(c, /June to August: from the S\./);
  assert.match(c, /Modelled wind estimate: ≈ 11 km\/h\./);
});

test('l: zero wind and unknown directions are not printed as facts and draw no rose', () => {
  const c = climate(fixtures.l);
  assert.match(c, /Wind estimate: not available\./);
  assert.match(c, /Wind direction: not available\./);
  assert.doesNotMatch(c, /0 km\/h|December to February|June to August/);
  assert.doesNotMatch(c, /N E S W/, 'no compass rose');
  assert.doesNotMatch(overview(fixtures.l), /annual mean wind/i, 'no annual wind claim on Overview');
});

test('m: NaN speed and -999 sunshine print nothing; only the known June to August direction shows', () => {
  const c = climate(fixtures.m);
  assert.match(c, /Wind estimate: not available\./);
  assert.match(c, /June to August: from the S\./);
  assert.doesNotMatch(c, /December to February|Wind direction: not available/);
  assert.doesNotMatch(c, /N E S W/, 'no compass rose without a Dec–Feb direction');
  assert.doesNotMatch(overview(fixtures.m), /annual mean wind/i);
});

test("zu render of k: the new sentences are English by design and nothing throws", () => {
  const c = climate(fixtures.k, 'zu');
  for (const sentence of [
    'Monthly sunshine is not shown. This record holds no monthly sunshine hours for this site.',
    'Monthly wind is not shown. This record holds no monthly wind figures for this site.',
    'Modelled wind estimate: ≈ 11 km/h.',
    'December to February: from the N.',
    'June to August: from the S.',
    'No crops are suggested from the climate type alone. A climate type does not know your water, frost or soil. Use the crop plan for sowing months checked against this site.',
    'Modelled record low: -6.2°C',
  ]) assert.ok(c.includes(sentence), sentence);
  assert.doesNotMatch(c, BANNED);
  assert.doesNotThrow(() => overview(fixtures.k));
});

test('source: CP-117 identifiers and strings are gone from DataPanel.tsx outside comments', () => {
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
  for (const gone of ['SUN_MULT', 'WIND_MULT', 'sunHours', 'monthlyWind', 'Sunniest', 'windbreak', 'Windbreak', 'ZONE_LABELS', 'MistBelt', 'CROPS[', 'cropSegs',
    'goodForGrowing', 'Year-round', 'thrive', 'calendarGrow', 'calendarDry', 'calendarRest', 'plantingCalendarHeader', 'insightHighWind',
    'insightModerateWind', 'prevailingWind', 'inWinter']) {
    assert.ok(!source.includes(gone), `${gone} must not appear`);
  }
});

// Evidence only: with DATAPANEL_RENDER_DUMP set to a directory, the text of each real render
// above is written there, so a reviewer can read what the component printed. Not an assertion.
if (process.env.DATAPANEL_RENDER_DUMP) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(process.env.DATAPANEL_RENDER_DUMP, { recursive: true });
  for (const [name, data] of Object.entries(fixtures)) {
    writeFileSync(`${process.env.DATAPANEL_RENDER_DUMP}/datapanel-${name}-overview.txt`, overview(data) + '\n');
    writeFileSync(`${process.env.DATAPANEL_RENDER_DUMP}/datapanel-${name}-climate.txt`, climate(data) + '\n');
  }
  writeFileSync(`${process.env.DATAPANEL_RENDER_DUMP}/datapanel-k-zu-climate.txt`, climate(fixtures.k, 'zu') + '\n');
}

/* ── CP-118: the rest of the panel's unsourced verdicts ───────────────────── */

// Each line below was a verdict or advice from an unsourced cut-off, or fixed months shown as this
// site's: the "Good fit / Fair site / Challenging" badge (500 mm, 300 mm, 15°, 25°); the rainfall
// bands at 400 and 700 mm and "before planning year-round crops"; the soil-carbon band at 1.5 %;
// "Wet · Oct–Mar / Dry · May–Aug" and the storm-water advice. They are removed; the figures stay.
const CP118_BANNED = /Good fit|Fair site|Challenging|water harvesting is essential|Check dry-season supply|year-round crops|Semi-arid site|moderate rainfall|strong rainfall|Mulch and swales|Water harvesting must come|Reported soil carbon|Reasonable soil carbon|Wet ·|Dry ·|Store storm-water|Most rain falls|dry spell/;

const lowRain = place({}); lowRain.rainfall = { ...lowRain.rainfall, monthly: lowRain.rainfall.monthly.map((r: number) => Math.round(r / 3)), annual: 213 };
const wetSteep = place({}); wetSteep.rainfall = { ...wetSteep.rainfall, monthly: wetSteep.rainfall.monthly.map((r: number) => r * 2), annual: 1282 }; wetSteep.elevation = { ...wetSteep.elevation, slopeDeg: 30, slopePct: 58 };
const CP118_FIXTURES: Record<string, any> = { a: fixtures.a, i: fixtures.i, lowRain, wetSteep };

for (const [name, data] of Object.entries(CP118_FIXTURES)) {
  test(`CP-118 ${name}: no suitability verdict, rainfall or carbon band, or fixed wet and dry months`, () => {
    for (const lang of ['en', 'zu']) {
      const o = overview(data, lang);
      const c = climate(data, lang);
      assert.doesNotMatch(o, CP118_BANNED, `${lang} Overview`);
      assert.doesNotMatch(c, CP118_BANNED, `${lang} Climate`);
    }
    const o = overview(data);
    // The figures themselves are still there.
    assert.match(o, new RegExp(`Modelled annual rainfall: about ${data.rainfall.annual} mm\\.`), 'site summary states the rainfall figure');
    // These fixtures carry no soil source, so the existing "not measured" line shows and no band.
    assert.match(o, /Soil carbon is not measured here\./);
    assert.match(o, /General points for this biome, not findings for this site\./);
    // Twelve monthly rainfall bars, all one colour.
    const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /isWet|rainAvg \* 0\.9/);
  });
}

test('CP-118: soil carbon is reported with its source and no band, for a test and for the global model', () => {
  const lab = place({}); lab.soil = { ...lab.soil, soilSource: 'lab', organicCarbon: 2.4 };
  assert.match(overview(lab), /Soil organic carbon: 2\.4% \(from your soil test\)\./);
  const grid = place({}); grid.soil = { ...grid.soil, soilSource: 'soilgrids', organicCarbon: 0.9 };
  const o = overview(grid);
  assert.match(o, /Soil organic carbon: 0\.9% \(from the SoilGrids global model, not a test of your soil\)\./);
  assert.doesNotMatch(o, /Reported soil carbon|Reasonable soil carbon|yield gains/);
});

test('CP-118 source: the removed verdicts are gone outside comments', () => {
  const lines = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8').split('\n')
    .filter((line) => !/^\s*(\/\/|\{\/\*|\*)/.test(line));
  for (const gone of ['suitability.label', 'suitability.bg', 'suitabilityGoodFit', 'suitabilityFairSite', 'suitabilityChallenging', 'insightSemiArid', 'insightModerateRain', 'insightStrongRain',
    'insightLowSoilCarbon', 'insightGoodSoilCarbon', 'siteSummaryRainEssential', 'siteSummaryRainEstimate', 'climateRainfallInsight', 'climateWetLabel', 'climateDryLabel',
    'wetSeason', 'drySeason']) {
    assert.equal(lines.filter((line) => line.includes(gone)).length, 0, gone);
  }
});

// A partial wind record can produce a positive value: it cannot establish a full-year mean.
// The class table also still contains agronomic notes for Cfa, despite its conventional name.
test('positive wind retains its value without a full-year claim, and class notes do not promise a growing season', () => {
  const d = place({ koppen: 'Cfa', koppenNote: 'Year-round crops thrive', windSpeed: 4 });
  const panel = climate(d);
  assert.match(panel, /Modelled wind estimate: ≈ 14 km\/h/);
  assert.match(panel, /Time coverage is not recorded/);
  assert.doesNotMatch(panel, /annual mean wind|long season|rot and fungus|Year-round crops thrive/i);
  assert.match(panel, /Humid subtropical/);
  assert.match(panel, /No crops are suggested from the climate type alone/);
  assert.match(overview(d), /Modelled wind estimate: ≈ 14 km\/h/);
  assert.doesNotMatch(overview(d), /annual mean wind/i);
});

// Each reading has its own provenance. Losing a temperature year must not erase valid wind/rain.
test('partial weather stays useful, while legacy defaults and untagged rainfall stay unknown', () => {
  const partial = place({ monthlyTempCoverage: INCOMPLETE, monthlyTemp: [18], windSpeed: 4 });
  assert.match(overview(partial), /Modelled wind estimate: ≈ 14 km\/h\. Time coverage is not recorded/);
  assert.match(overview(partial), /Modelled annual rainfall: about 641 mm/);
  assert.match(climate(partial), UNAVAILABLE);
  const legacy = place({ windSource: undefined });
  legacy.rainfall.rainfallSource = undefined;
  assert.match(overview(legacy), /Annual rainfall is not known/);
  assert.match(overview(legacy), /Wind estimate: not available/);
  assert.doesNotMatch(overview(legacy), /Modelled annual rainfall|Modelled wind estimate|641/);
  assert.match(climate(legacy), /Rainfall: not known/);
  assert.doesNotMatch(climate(legacy), /641|Summer rainfall/);
  const rainOnly = place({ windSource: undefined, monthlyTempCoverage: undefined });
  rainOnly.rainfall.rainfallSource = 'open-meteo';
  assert.match(overview(rainOnly), /Modelled annual rainfall: about 641 mm/);
  assert.match(overview(rainOnly), /Wind estimate: not available/);
  const calm = place({ windSpeed: 0 });
  assert.match(overview(calm), /Modelled wind estimate: ≈ 0 km\/h/);
  assert.match(climate(calm), /Modelled wind estimate: ≈ 0 km\/h/);
});

test('the actual location-route outage defaults never become modelled facts in Overview', async () => {
  registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/app/api/location-data/route.ts')) {
      const stubs: Record<string, string> = {
        'next/server': 'export class NextRequest extends Request{};export const NextResponse={json:(body,init)=>Response.json(body,init)};',
        '@/lib/api-auth': 'export const guardPaidApiRequest=async()=>({});',
        '@/lib/nasa-power': 'export const fetchNasaPower=async()=>{throw new Error("offline fixture")};',
        '@/lib/isric-soil': 'export const fetchSoilData=async()=>({textureClass:"Loam",ph:6.2,organicCarbon:1.9,sand:40,silt:35,clay:25,bulkDensity:1.2});',
        '@/lib/elevation': 'export const fetchElevation=async()=>({elevation:1745,slopeDeg:2,slopePct:3,aspectLabel:"N",aspectDeg:0});',
        '@/lib/sanbi': 'export const fetchVegetation=async()=>null;',
      };
      if (stubs[specifier]) return {shortCircuit:true,url:moduleUrl(stubs[specifier])};
    }
    return next(specifier, context);
  }});
  const { GET } = await import('../app/api/location-data/route.ts');
  const response = await GET(new Request('http://fixture.invalid/api/location-data?lat=48.2&lon=16.3') as any);
  assert.equal(response.status, 200);
  const fallback = await response.json();
  // Assert this exercises the real producer's fallback, not a hand-built unknown-weather record.
  assert.equal(fallback.climate.windSpeed, 3);
  assert.equal(fallback.rainfall.annual, 600);
  assert.equal(fallback.climate.windSource, undefined);
  assert.equal(fallback.rainfall.rainfallSource, undefined);
  const shown = overview(fallback);
  assert.doesNotMatch(shown, /Modelled wind estimate|Modelled annual rainfall|600|11 km\/h/);
  assert.match(shown, /Annual rainfall is not known/);
  assert.match(shown, /Wind estimate: not available/);
  assert.match(shown, /1745/);
  assert.match(shown, /Soil organic carbon: 1\.9%/);
  assert.match(climate(fallback), UNAVAILABLE);
  // Carry the actual outage producer through the saved-place codec and report consumers.
  const { savedRainfallFields, normalisePlaces } = await import('../lib/saved-places.ts');
  const saved = normalisePlaces(JSON.parse(JSON.stringify([{ id: 'fixture', name: 'Fixture', lat: fallback.lat, lon: fallback.lon, biome: fallback.biome.name, elevation: fallback.elevation.elevation, savedAt: '', ...savedRainfallFields(fallback.rainfall) }])));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].rainfall, undefined);
  const { reportClimateEvidence, annualRainfallMm } = await import('../lib/climate-temperature.ts');
  assert.doesNotMatch(reportClimateEvidence(fallback), /600 mm|3 m\/s|28 °C|5.5 kWh/);
});


test('soil raw source figures remain visible without a universal score, adequacy band or compaction diagnosis', () => {
  for (const soilSource of ['lab','soilgrids']) {
    const data=place({ monthlyTemp: JHB, monthlyTempCoverage: COMPLETE });
    data.soil={...data.soil,soilSource,ph:5.1,organicCarbon:0.8,bulkDensity:1.6};
    const text=renderTab(data,'Soil');
    assert.match(text,/5.1/); assert.match(text,/0.8/);
    assert.doesNotMatch(text,/Soil health score<|\/10|Degraded|Priority improvements|likely compacted/i);
    assert.match(text,/do not establish a soil health score/);
  }
});


test('the soil tab cannot present outage placeholders as measured soil', () => {
 const data=place({monthlyTemp:JHB,monthlyTempCoverage:COMPLETE});
 data.soil={...data.soil,soilSource:'estimate',ph:6.5,organicCarbon:1.2};
 const text=renderTab(data,'Soil');
 assert.match(text,/Soil measurements are not known/);
 assert.doesNotMatch(text,/6.5|1.2%|SoilGrids global model; an estimate/);
});
