import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { REPORT_FOOTNOTE_ENGLISH_PENDING } from '@/lib/i18n-pending';

// Last audit leftovers (swarm/w10-audit-leftovers, task 1).
//
// The site-facts footnote's labels already went through tr() (see
// tests/report-footnote-simple.test.ts), but the VALUES it interpolated — d.climate.koppenDesc,
// d.rainfall.pattern, d.rainfall.wetSeason, d.rainfall.drySeason — were raw English data straight
// out of lib/koppen-global.ts / lib/nasa-power.ts, so an isiZulu (or any non-English) report still
// showed this jargon in English. Those values come from a small fixed set, so ReportView now
// looks each one up by key via translate() (lib/i18n), falling back to the raw value when a key
// is missing. d.bru.attribution is left untouched — it is a source-organisation name, not jargon.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const REPORT_VIEW = read('../components/ReportView.tsx');
const KOPPEN_GLOBAL = read('../lib/koppen-global.ts');

function footnoteBlock(): string {
  const start = REPORT_VIEW.indexOf('{/* Coords */}');
  const end = REPORT_VIEW.indexOf('{presentation !== \'print\' && <ReportVisualOverview');
  assert.ok(start >= 0 && end > start, 'could not locate the Coords/footnote block');
  return REPORT_VIEW.slice(start, end);
}

test('ReportView loads the report-language locale and reads translate() from lib/i18n', () => {
  assert.match(REPORT_VIEW, /import \{ loadLocale, translate \} from '@\/lib\/i18n';/);
  assert.match(REPORT_VIEW, /useEffect\(\(\) => \{ loadLocale\(language\); \}, \[language\]\);/,
    'the report\'s own language picker can pick a locale the app has never fetched');
});

test('the footnote no longer interpolates raw koppenDesc / rainfall pattern / season-range data', () => {
  const block = footnoteBlock();
  assert.doesNotMatch(block, /\{d\.climate\.koppenDesc\}/,
    'koppenDesc must be routed through a translation lookup, not interpolated raw');
  assert.doesNotMatch(block, /\{d\.rainfall\.pattern\}/,
    'the rainfall pattern word must be routed through a translation lookup, not interpolated raw');
  assert.doesNotMatch(block, /\{d\.rainfall\.wetSeason\}/);
  assert.doesNotMatch(block, /\{d\.rainfall\.drySeason\}/);
  assert.match(block, /koppenDescLabel\(d\.climate\.koppen, d\.climate\.koppenDesc\)/);
  assert.match(block, /rainfallPatternLabel\(d\.rainfall\.pattern\)/);
  assert.match(block, /seasonRangeLabel\(d\.rainfall\.wetSeason\)/);
  assert.match(block, /seasonRangeLabel\(d\.rainfall\.drySeason\)/);
  // The BRU line's source attribution is a named organisation, not translatable jargon — it must
  // stay exactly as the data gives it.
  assert.match(block, /\{d\.bru\.attribution\}/);
});

test('every Köppen code lib/koppen-global.ts can return has a reportKoppenDesc<code> pending key', () => {
  const descriptionBlockMatch = KOPPEN_GLOBAL.match(/const DESCRIPTIONS: Record<string, \[string, string\]> = \{([\s\S]*?)\n\};/);
  assert.ok(descriptionBlockMatch, 'could not find DESCRIPTIONS in lib/koppen-global.ts');
  const codes = Array.from(descriptionBlockMatch[1].matchAll(/^\s*(\w+):\s*\[/gm)).map((m) => m[1]);
  assert.ok(codes.length > 0, 'expected at least one Köppen code in DESCRIPTIONS');
  for (const code of codes) {
    assert.ok(`reportKoppenDesc${code}` in REPORT_FOOTNOTE_ENGLISH_PENDING,
      `lib/i18n-pending.ts's REPORT_FOOTNOTE_ENGLISH_PENDING is missing reportKoppenDesc${code}`);
  }
});

test('the rainfall-pattern words and the non-range season fallbacks are pending keys', () => {
  for (const key of ['reportRainfallPatternSummer', 'reportRainfallPatternWinter', 'reportRainfallPatternYearRound', 'reportSeasonYearRound', 'reportSeasonNone']) {
    assert.ok(key in REPORT_FOOTNOTE_ENGLISH_PENDING, `missing pending key ${key}`);
  }
});

test('REPORT_FOOTNOTE_ENGLISH_PENDING is spread into every locale file, same as the other *_ENGLISH_PENDING dictionaries', () => {
  for (const code of ['af', 'nr', 'nso', 'ss', 'st', 'tn', 'ts', 've', 'xh', 'zu']) {
    const locale = read(`../lib/locales/${code}.ts`);
    assert.match(locale, /REPORT_FOOTNOTE_ENGLISH_PENDING/,
      `lib/locales/${code}.ts must import and spread REPORT_FOOTNOTE_ENGLISH_PENDING`);
    assert.match(locale, /\.\.\.REPORT_FOOTNOTE_ENGLISH_PENDING,/,
      `lib/locales/${code}.ts must spread REPORT_FOOTNOTE_ENGLISH_PENDING into its dict`);
  }
});

test('wet/dry season ranges reuse the existing translated survey month keys, rather than a second translation list', () => {
  assert.match(REPORT_VIEW, /SEASON_MONTH_KEYS[\s\S]{0,400}surveyMonthJan[\s\S]{0,400}surveyMonthDec/,
    'the month-range translator must reuse surveyMonth* keys already translated for isiZulu, not duplicate month names');
});
