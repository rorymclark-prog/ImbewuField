import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { produceLabel } from '../lib/produce-label.ts';
import { pricedCropList } from '../components/prices/CropPriceGuide.format.ts';

// ux-18 (wave 14): the same crop read 'Sweet Potato' on /calendar, 'Sweet potato' on /home and
// /prices, and all-lowercase 'carrots'/'swiss chard' in Records' recent-harvest rows — three
// different casings for one crop across the app. produceLabel() (lib/produce-label.ts) is now
// the one place every screen gets a crop's display name from.

test('produceLabel is sentence case for English and never regresses to Title Case or all-lowercase', () => {
  assert.equal(produceLabel('sweet-potato', 'en'), 'Sweet potato');
  assert.equal(produceLabel('swiss-chard', 'en'), 'Swiss chard (spinach)');
  assert.equal(produceLabel('carrots', 'en'), 'Carrots');
  assert.notEqual(produceLabel('sweet-potato', 'en'), 'Sweet Potato', 'must not be Title Case');
  assert.notEqual(produceLabel('carrots', 'en'), 'carrots', 'must not be all-lowercase');
});

test('the price guide (pricedCropList) names crops through produceLabel, in the active language', () => {
  const en = pricedCropList({}, 'en').find((c) => c.key === 'sweet-potato');
  const zu = pricedCropList({}, 'zu').find((c) => c.key === 'sweet-potato');
  assert.equal(en?.name, 'Sweet potato');
  assert.equal(zu?.name, 'Ubhatata');
});

test('pricedCropList defaults to English when lang is omitted, unchanged from before this wave', () => {
  const noLang = pricedCropList({}).find((c) => c.key === 'sweet-potato');
  assert.equal(noLang?.name, 'Sweet potato');
});

// zu-11: source-text guards for the parts that are not pure functions (JSX components).
const myRecords = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');
const calendarPage = readFileSync(new URL('../app/calendar/page.tsx', import.meta.url), 'utf8');
const pricesPage = readFileSync(new URL('../app/prices/page.tsx', import.meta.url), 'utf8');

test('MyRecords resolves free-text crop entries (including lib/demo-farm.ts\'s deliberately lowercase demo rows) through produceLabel', () => {
  assert.match(myRecords, /function harvestCropLabel\(crop: string, lang: string\): string \{/);
  assert.match(myRecords, /\{harvestCropLabel\(item\.crop, lang\)\}/, 'recent-harvest and recent-sale rows must render through the shared helper');
  assert.doesNotMatch(myRecords, /\n\s*\{item\.crop\}\n/, 'a row must not fall back to the raw, unresolved item.crop string');
});

test('MyRecords\' lender summary reads isiZulu first, and the orchard chip/export button use theme tokens that survive dark mode', () => {
  assert.match(myRecords, /function recordsUiZuFirst\(lang: string, english: string, isiZulu: string\): string \{/);
  assert.match(myRecords, /return `\$\{isiZulu\} — \$\{english\}`;/);
  assert.match(myRecords, /recordsUiZuFirst\(lang, 'A summary of your logged harvests/);
  // The old fixed-colour, theme-blind pattern must not come back.
  assert.doesNotMatch(myRecords, /color-mix\(in srgb, var\(--color-forest-800\)/, 'the orchard chip must not reintroduce a fixed-opacity mix of a token that itself changes per theme');
  assert.doesNotMatch(myRecords, /background: loading \? 'rgba\(46,107,58/, 'the export button must not reintroduce its fixed rgba(46,107,58,…) background');
});

test('app/calendar/page.tsx derives its grid crop names from produceLabel, not a hardcoded Title Case literal', () => {
  assert.doesNotMatch(calendarPage, /name: 'Sweet Potato'/, 'the Title Case literal the audit flagged must not come back');
  assert.match(calendarPage, /name: produceLabel\(crop\.catalogKey, lang\)/);
  assert.match(calendarPage, /function cropsForPattern\(pattern: RainPattern, lang: string\): CropRow\[\]/);
});

test('/prices threads the active language into pricedCropList', () => {
  assert.match(pricesPage, /pricedCropList\(overrides, lang\)/);
});
