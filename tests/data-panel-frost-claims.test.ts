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
      koppen: 'Cwb', koppenDesc: 'Subtropical highland, dry winter', windSpeed: 3, windFromSummer: 'N', windFromWinter: 'S',
      monthlyTempCoverage: COMPLETE, ...TAG,
      ...climate,
    },
    rainfall: { monthly: RAIN, annual: RAIN.reduce((a, b) => a + b, 0), pattern: 'summer', wetSeason: 'Oct to Mar', drySeason: 'May to Aug' },
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
function renderTab(data: any, tab?: string): string {
  const props: any = { data, loading: false, coords: { lat: data.lat, lon: data.lon }, forcedTab: tab, onTabChange() {}, onOpenReport() {}, onJumpTo() {}, surveyViewport: 'mobile' };
  let r: any;
  act(() => { r = create(React.createElement(DataPanel as any, props)); });
  const out = textOf(r.toJSON() && { children: [].concat(r.toJSON()) }).replace(/\s+/g, ' ');
  act(() => r.unmount());
  return out;
}
const overview = (d: any) => renderTab(d);
const climate = (d: any) => renderTab(d, 'Climate');

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
};

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
  assert.match(c, /Prevailing wind is from the N — site a windbreak along that edge\./);
  assert.match(c, /Frost months are not shown\. Monthly averages cannot show frost/);
  assert.doesNotMatch(c, /bananas|sugar cane|tropical fruit/);
});

test('site summary: the frost-protection sentence needs a validated record low below 2 °C', () => {
  // The Lima site-summary paragraph is the only place the sentence appears; take its text.
  const frostSentence = /frost/i;
  assert.match(overview(fixtures.a), /Lima/, 'the summary renders');
  const withSentence = overview(fixtures.a);
  const lima = (seen: string) => seen.slice(seen.indexOf('Lima ·')).split('plantingCalendarHeader')[0];
  assert.match(lima(withSentence), frostSentence, 'a (-4.8 tagged): site summary has the frost-protection sentence');
  for (const key of ['d', 'e', 'c']) {
    // c is a real 0 (< 2) so it DOES get the sentence; d (untagged 8) and e (-999) must not.
    const seen = lima(overview(fixtures[key]));
    if (key === 'c') assert.match(seen, frostSentence); else assert.doesNotMatch(seen, frostSentence, `${key}: no frost-protection sentence`);
  }
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
  assert.match(overview(fixtures.i), /Rest/);
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /calendarFrost|isFrost/);
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
}
