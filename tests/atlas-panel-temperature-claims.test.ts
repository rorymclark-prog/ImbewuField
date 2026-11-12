// The Atlas panel must not state a climate type, a frost condition or a temperature that
// was read from the server's 20 °C display substitutes (independent review of 11 November
// 2026, Codex FDR-01), and it must not read frost from a monthly MEAN. Where the payload
// carries a validated gridded record low, the panel prints that number and no frost class.
//
// The cases follow Codex's bounded review of its own local proposal (revision 3, same day):
// incomplete, one month substituted, no receipt, untagged and missing-marker minima, a real
// zero, and Underberg's coldest mean of 7.37 °C beside a record low of -6.2 °C.
//
// This renders the real components/atlas/AtlasPanel.tsx to static markup. It is a source
// and render check, not a browser check: no layout, no theme, no live climate request.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

import { atlasRainPattern, atlasTemperaturesRecorded } from '../lib/atlas.ts';
import type { LocationData } from '../lib/types.ts';

const root = new URL('../', import.meta.url).href;
registerHooks({
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
const { default: AtlasPanel } = await import('../components/atlas/AtlasPanel.tsx');
const { Ctx } = await import('../lib/i18n-context.ts');

const RAIN = [127, 81, 73, 43, 16, 7, 3, 7, 16, 57, 89, 122];
// Johannesburg-like monthly means: the coldest month's mean is 10 °C, and it has frost.
const JOHANNESBURG_MEANS = [20, 20, 19, 16, 13, 10, 10, 13, 17, 18, 19, 20];

function place(climate: Partial<LocationData['climate']>): LocationData {
  return {
    lat: -26.2, lon: 28.05,
    climate: {
      meanTemp: 16, maxTemp: 20, minTemp: -4.8, monthlyTemp: JOHANNESBURG_MEANS, solarRadiation: 5,
      koppen: 'Cwb', koppenDesc: 'Subtropical highland, dry winter', windSpeed: 3, windFromSummer: 'N', windFromWinter: 'S',
      ...climate,
    },
    rainfall: { monthly: RAIN, annual: RAIN.reduce((a, b) => a + b, 0), pattern: 'summer', wetSeason: 'Oct to Mar', drySeason: 'May to Aug' },
    soil: { textureClass: 'Loam', ph: 6.2, organicCarbon: 1.1, sand: 40, silt: 35, clay: 25 },
    elevation: { elevation: 1745, slopeDeg: 2, slopePct: 3, aspectLabel: 'N', aspectDeg: 0 },
  } as unknown as LocationData;
}
const panel = (data: LocationData) => React.createElement(AtlasPanel, { data, now: new Date(2026, 10, 11) });
const render = (data: LocationData) => renderToStaticMarkup(panel(data));
const renderZulu = (data: LocationData) => renderToStaticMarkup(
  React.createElement(Ctx.Provider, { value: { lang: 'zu', setLang() {}, t: (key: string) => key, onboarded: true, completeOnboarding() {} } }, panel(data)));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const COMPLETE = { source: 'nasa-power', status: 'complete' } as const;
const INCOMPLETE = { source: 'nasa-power', status: 'incomplete' } as const;
const TAGGED = { monthlyTempCoverage: COMPLETE, minTempSource: 'nasa-power' as const };
const FROST_CLASS = /Frost-free|Frost expected|Light frost possible|Akunasithwathwa|Kulindeleke isithwathwa/;

test('the display rule admits only a complete, self-consistent temperature year', () => {
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: JOHANNESBURG_MEANS, monthlyTempCoverage: COMPLETE } }), true);
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: Array(12).fill(20), monthlyTempCoverage: INCOMPLETE } }), false);
  // No receipt: an outage default or an old payload. Not verifiable, so not printed.
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: JOHANNESBURG_MEANS } }), false);
  // A receipt its own values contradict.
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: JOHANNESBURG_MEANS.slice(0, 11), monthlyTempCoverage: COMPLETE } }), false);
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: [...JOHANNESBURG_MEANS.slice(0, 11), NaN], monthlyTempCoverage: COMPLETE } }), false);
  assert.equal(atlasTemperaturesRecorded({ climate: null }), false);
  // A real zero is a reading.
  assert.equal(atlasTemperaturesRecorded({ climate: { monthlyTemp: [5, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5], monthlyTempCoverage: COMPLETE } }), true);
});

test('the pure calendar helper keeps its narrower refusal, so its other callers are unaffected', () => {
  const rain = { monthly: RAIN };
  assert.notEqual(atlasRainPattern({ lat: -26.2, rainfall: rain, climate: { monthlyTemp: JOHANNESBURG_MEANS } }), null);
  assert.equal(atlasRainPattern({ lat: -26.2, rainfall: rain, climate: { monthlyTemp: JOHANNESBURG_MEANS, monthlyTempCoverage: INCOMPLETE } }), null);
});

test('a year of 20 °C substitutes shows no climate type, no frost claim and no temperature (Codex FDR-01)', () => {
  // The adapter contract: missing monthly means are filled with 20, coverage is 'incomplete',
  // and the server still sends a non-empty Köppen label computed from those fills.
  const data = place({ monthlyTemp: Array(12).fill(20), meanTemp: 20, maxTemp: 20, minTemp: 20, monthlyTempCoverage: INCOMPLETE, koppen: 'Cwa', koppenDesc: 'Humid subtropical, dry winter', koppenNote: 'Warm all year.' });
  const html = render(data);
  const seen = text(html);
  assert.equal((html.match(/data-atlas-temperature="incomplete"/g) ?? []).length, 2, 'the climate card and the temperature card each say so');
  assert.match(seen, /Temperature records for this point are incomplete or could not be checked, so no climate type or sowing calendar is shown\./);
  assert.match(seen, /Not shown\. The temperature records for this point are incomplete or could not be checked\./);
  assert.doesNotMatch(seen, /Cwa|Humid subtropical|Warm all year/, 'no climate type from substituted months');
  assert.doesNotMatch(seen, /frost/i, 'no frost statement of any kind');
  assert.doesNotMatch(seen, /Sowing calendar:|What could grow here/, 'no calendar and no crop list');
  assert.doesNotMatch(seen, /20\s*°C|Coldest month|Hottest month|record low/i, 'no substituted temperature is printed');
  // Rainfall is a separate series and stays useful.
  assert.match(seen, /≈ 641 mm\/yr/);
  assert.match(seen, /Rainfall/);
  assert.match(seen, /Oct to Mar/);
});

test('one substituted month is enough: the real-looking months are withheld too', () => {
  const oneMissing = [...JOHANNESBURG_MEANS]; oneMissing[5] = 20;
  const seen = text(render(place({ monthlyTemp: oneMissing, monthlyTempCoverage: INCOMPLETE, minTempSource: 'nasa-power' })));
  assert.doesNotMatch(seen, /Cwb|Subtropical highland|Coldest month|°C|Sowing calendar:|What could grow here/);
  assert.match(seen, /≈ 641 mm\/yr/);
});

test('a payload with no coverage receipt is withheld like an incomplete one', () => {
  // My first guard (commit 911aa31e, not pushed) let this through "as before". Codex's
  // proposal admitted only 'complete', and that is the better rule for a screen that prints
  // the numbers: the route's fresh answers always carry a receipt, so a payload without one
  // is an outage default or an old shape, and neither is a reading.
  const html = render(place({}));
  const seen = text(html);
  assert.equal((html.match(/data-atlas-temperature="incomplete"/g) ?? []).length, 2);
  assert.doesNotMatch(seen, /Cwb|Coldest month|°C|Sowing calendar:|What could grow here/);
  assert.match(seen, /≈ 641 mm\/yr/);
});

test('complete temperatures: climate type, calendar, temperatures and the record low; no frost class', () => {
  const data = place(TAGGED);
  const html = render(data);
  const seen = text(html);
  assert.match(seen, /Cwb/);
  assert.match(seen, /Sowing calendar: Winter frost/);
  assert.match(seen, /Coldest month/);
  assert.match(seen, /10°C/);
  // The chip used to read "Frost-free" here, from a coldest-month mean of 10 °C, beside
  // "Sowing calendar: Winter frost".
  assert.match(seen, /Modelled record low: -4\.8°C/);
  assert.match(html, /data-atlas-record-low="known"/);
  // CP-114: the class note beside that record low no longer calls the year mild.
  assert.match(seen, /Summer rain, dry winters and summers that stay warm rather than hot\. This climate type alone does not tell you whether there is frost\./);
  assert.doesNotMatch(seen, /mild all year|from altitude/);
  assert.doesNotMatch(seen, FROST_CLASS);
  assert.doesNotMatch(html, /data-atlas-temperature/);
});

test('Underberg: a coldest mean of 7.37 °C no longer reads "Frost-free" beside a record low of -6.2 °C', () => {
  const means = [18.9, 18.6, 17.4, 14.6, 11.2, 8.1, 7.37, 9.9, 13.1, 14.9, 16.4, 18.1];
  const seen = text(render(place({ ...TAGGED, monthlyTemp: means, minTemp: -6.2, koppen: 'Cwb' })));
  assert.match(seen, /Modelled record low: -6\.2°C/);
  assert.doesNotMatch(seen, FROST_CLASS);
});

test('the record low is printed only when it is a validated, source-tagged reading', () => {
  // Untagged: an outage default arrives as a plain number.
  const untagged = render(place({ monthlyTempCoverage: COMPLETE, minTemp: 8 }));
  assert.match(text(untagged), /Record low: not known/);
  assert.match(untagged, /data-atlas-record-low="unknown"/);
  assert.doesNotMatch(text(untagged), /Modelled record low|8°C/);
  // Tagged, but the provider's missing-value marker.
  const marker = text(render(place({ ...TAGGED, minTemp: -999 })));
  assert.match(marker, /Record low: not known/);
  assert.doesNotMatch(marker, /-999/);
  // A real zero and a real positive low are readings, printed as they are.
  assert.match(text(render(place({ ...TAGGED, minTemp: 0 }))), /Modelled record low: 0°C/);
  assert.match(text(render(place({ ...TAGGED, minTemp: 3.4 }))), /Modelled record low: 3\.4°C/);
  // No frost class in any of them.
  for (const minTemp of [8, -999, 0, 3.4]) assert.doesNotMatch(text(render(place({ ...TAGGED, minTemp }))), FROST_CLASS);
});

test('isiZulu mode: the record-low chip stays in English and is marked translation pending', () => {
  const seen = text(renderZulu(place(TAGGED)));
  assert.match(seen, /Modelled record low: -4\.8°C\s+isiZulu translation pending/);
  assert.match(seen, /Ikhalenda lokutshala:/);
  assert.doesNotMatch(seen, FROST_CLASS);
  const withheld = text(renderZulu(place({ monthlyTempCoverage: INCOMPLETE })));
  assert.doesNotMatch(withheld, /Cwb|°C|Ikhalenda lokutshala:|isithwathwa/);
  assert.match(withheld, /≈ 641 mm\/yr/);
});

test('an outage keeps its own placeholder warning and prints no temperature', () => {
  // The route's outage answer: climate label '?', no receipt, placeholder rainfall.
  const seen = text(render(place({ koppen: '?', koppenDesc: '' })));
  assert.match(seen, /Climate data could not be fetched for this point — the figures below are placeholders, not readings\./);
  assert.doesNotMatch(seen, /Coldest month|°C|Sowing calendar:/);
});

test('the panel source no longer derives a frost statement from a monthly mean', () => {
  const source = readFileSync(new URL('../components/atlas/AtlasPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /frostChip/);
  assert.doesNotMatch(source, /tMin\s*[<>]=?\s*\d/);
  assert.doesNotMatch(source, /recordLowC\s*[<>]=?\s*-?\d/, 'the record low is printed, never compared with a number');
});

test('the climate card paints its code, note and chips with theme tokens (CP-115)', () => {
  // In dark mode the code (#1F4D2B) and the note (#4A4030) were dark ink on a dark card, and
  // the chips kept fixed light fills. Tokens that are declared per theme move with it.
  const source = readFileSync(new URL('../components/atlas/AtlasPanel.tsx', import.meta.url), 'utf8');
  const card = source.slice(source.indexOf('{/* 1 — Climate headline'), source.indexOf('{/* 2 — Rainfall */}'));
  assert.ok(card.length > 500);
  assert.doesNotMatch(card, /color: '#[0-9A-Fa-f]{3,8}'/, 'no fixed text colour in the climate card');
  assert.doesNotMatch(card, /chip\('#/, 'no fixed chip fill');
  assert.match(card, /color: 'var\(--color-forest-800\)'/);
  assert.equal((card.match(/chip\(CHIP_(WATER|NEUTRAL)\)/g) ?? []).length, 4);
  assert.match(source, /const CHIP_WATER = \{ bg: 'color-mix\(in srgb, var\(--blue\) 14%, transparent\)', color: 'var\(--blue\)' \}/);
  assert.match(source, /const CHIP_NEUTRAL = \{ bg: 'var\(--bg-2\)', color: 'var\(--text-secondary\)' \}/);
  // Each token used is declared in both columns of both themes, so it moves in dark.
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  for (const token of ['--color-forest-800', '--text-secondary', '--text-primary', '--bg-2', '--blue', '--border']) {
    assert.ok((css.match(new RegExp(`^\\s*${token}:`, 'gm')) ?? []).length >= 4, `${token} is not declared per theme`);
  }
  // The chip's hairline is drawn inside the chip, so its size is what it was.
  assert.match(source, /boxShadow: 'inset 0 0 0 1px var\(--border\)'/);
  assert.doesNotMatch(source.slice(source.indexOf('function chip('), source.indexOf('function MiniStat(')), /border:/);
});

test('outside the data bars the panel paints no fixed text colour or surface (CP-116)', () => {
  // The soil "Silt" figure (#1F4D2B), the labels, the provenance caution, the draft note and the
  // crop tiles kept fixed colours, so in dark mode they were dark ink on a dark card.
  const source = readFileSync(new URL('../components/atlas/AtlasPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /color: '#[0-9A-Fa-f]{3,8}'/, 'no fixed text colour anywhere in the panel');
  // Two translucent tints stay, once each, as the fill of the "modelled" and "unknown" soil
  // caution boxes: a 5% tint sits on a light or a dark card alike, and keeping them leaves
  // those two recorded snapshots (tests/fixtures/report-assurance-translation) untouched
  // apart from the paragraph ink. Everything else on the list is gone.
  assert.equal(source.split("'rgba(31,77,43,0.05)'").length - 1, 1);
  assert.equal(source.split("'rgba(32,25,15,0.05)'").length - 1, 1);
  assert.equal((source.match(/rgba\(31,77,43|rgba\(32,25,15/g) ?? []).length, 2);
  for (const old of ['#B07A1E', '#766A50', '#AC9E82', '#3A2E22', '#FFF8E8', "#7A4408'", "'#1F4D2B'", '"#1F4D2B"', '"#C07A1E"', 'rgba(226,216,196']) {
    assert.ok(!source.includes(old), `${old} is gone`);
  }
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  // --font-sans (already in the file) is a typeface, declared once on :root, so the check is
  // restricted to the colour tokens the panel uses.
  const tokens = [...new Set([...source.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((t) => t !== '--font-sans');
  assert.ok(tokens.length > 5);
  const missing = tokens.filter((t) => (css.match(new RegExp(`^\\s*${t}:`, 'gm')) ?? []).length < 4);
  assert.deepEqual(missing, [], `declared fewer than four times in globals.css: ${missing.join(', ')}`);
});
