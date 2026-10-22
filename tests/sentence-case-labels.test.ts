// copy-07 (wave 15): English UI labels are sentence case ('Farm tools', 'Planting calendar'),
// not Title Case. This guard fails when a nav*/tab*/home*/student* English label in the T_en
// block of lib/i18n.tsx (or the pending English in lib/i18n-pending.ts) is Title Case again,
// and when a NavDrawer ui() label is. Proper nouns are allow-listed explicitly.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/sentence-case-labels.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PROPER = new Set([
  'Lima', 'Vision', 'ImbewuField', 'Imbewu', 'Google', 'AI', 'GPS', 'PDF', 'SEF', 'ACT', 'POPIA', 'BRU',
  'Karoo', 'Succulent', 'Albany', 'Thicket', 'Indian', 'Ocean', 'Coastal', 'Belt', 'Afromontane',
  'Generate', 'Farmer', 'Mentor', 'Student', 'Funder', 'Organisation', 'Sesotho', 'South', 'African', 'Africa', 'English', 'isiZulu', 'Zulu',
]);
// Keys whose exact English string is paired with reviewed or drafted translations (the Study and
// survey packets embed it as the visible source), so a case change would orphan those pairings.
const PAIRED_WITH_TRANSLATIONS = new Set([
  'studentMyStudies', 'studentOpenDesignStudio',
  'surveyStepHouseholdInfo', 'surveyStepLandLocation', 'surveyStepCurrentProduction',
  'surveyStepLivestockPoultry', 'surveyStepIncomeSales', 'surveyStepResourcesInputs',
]);
const KEY_PREFIX = /^(nav|tab|home|student|survey|stat|step|allSection|report|myRecords|offlinePage)/;

function titleCaseLabels(file: string, upToLine = Infinity) {
  const bad: string[] = [];
  readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
    if (i >= upToLine) return;
    const m = line.match(/^\s+([A-Za-z0-9_]+): '((?:[^'\\]|\\.)*)',?\s*$/);
    if (!m) return;
    const [, key, value] = m;
    if (!KEY_PREFIX.test(key) || PAIRED_WITH_TRANSLATIONS.has(key)) return;
    // Labels only: sentences (full stops, commas, placeholders) are out of scope.
    if (/[.,{]/.test(value) || value.split(' ').length > 6) return;
    const words = value.split(' ').slice(1).map((w) => w.replace(/[^A-Za-z]/g, ''));
    const title = words.filter((w) => w.length > 1 && /^[A-Z][a-z]+$/.test(w) && !PROPER.has(w));
    if (title.length) bad.push(`${file}:${i + 1} ${key}: '${value}'`);
  });
  return bad;
}

test('English labels in lib/i18n.tsx are sentence case', () => {
  const src = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const enEnd = src.split('\n').findIndex((l) => /^const T_zu\b|^const T_[a-z]{2}\b(?!.*T_en)/.test(l) && !/T_en/.test(l));
  const bad = titleCaseLabels('lib/i18n.tsx', enEnd > 0 ? enEnd : 2300);
  assert.deepEqual(bad, [], 'Title Case English labels (use sentence case, or allow-list a proper noun)');
});

test('pending English labels are sentence case', () => {
  assert.deepEqual(titleCaseLabels('lib/i18n-pending.ts'), []);
});

test('NavDrawer English ui() labels are sentence case', () => {
  const src = readFileSync(new URL('../components/NavDrawer.tsx', import.meta.url), 'utf8');
  const bad = [...src.matchAll(/ui\('([^']+)'/g)]
    .map((m) => m[1])
    .filter((v) => !/[.,]/.test(v))
    .filter((v) => v.split(' ').slice(1).some((w) => /^[A-Z][a-z]+$/.test(w) && !PROPER.has(w)));
  assert.deepEqual(bad, []);
});

test('one name per feature across tile, nav, offline list and journal h1', () => {
  const src = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const val = (k: string) => src.match(new RegExp(`^\\s+${k}: '([^']*)'`, 'm'))?.[1];
  assert.equal(val('homeQuickJournal'), val('navFieldJournal'));
  assert.equal(val('navFieldJournal'), val('offlinePageJournal'));
  assert.equal(val('navGardenSurvey'), val('surveySectionLabel'));
  assert.equal(val('navDesignStudio'), val('offlinePageDesign'));
  assert.equal(val('navTipsHelp'), val('tipsTitle'));
  const journal = readFileSync(new URL('../app/journal/page.tsx', import.meta.url), 'utf8');
  assert.match(journal, /t\('navFieldJournal'\)/);
});
