// lib/lang-coverage.ts generalises the "this language isn't finished" notice that used to be a
// hand-typed Xitsonga-only special case in components/ThemePanel.tsx (`lang === 'ts'`). The bar
// (owner decision): a language counts as complete once it renders at least ~95% of the English
// UI dictionary in its own words; anything below that shows a "partly in English" notice — under
// its own button in the language grid, and as a role="note" line when it's the active language.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/lang-coverage.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { coverageOf, LANG_COVERAGE_COMPLETE_THRESHOLD } from '@/lib/lang-coverage';
import { DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING } from '@/lib/i18n-pending';
import { LEARNER_UI_ENGLISH } from '@/lib/learner-ui-english';

test('coverageOf counts a key as translated only when the locale gives it a different value', () => {
  const english = { a: 'Apple', b: 'Banana', c: 'Carrot', d: 'Date' };

  const untouched = coverageOf(english, {});
  assert.deepEqual(untouched, { translated: 0, total: 4, ratio: 0, complete: false });

  // Spreading the same pending English text into a locale (the *_ENGLISH_PENDING pattern) must
  // not count as "translated" — that would make every partial language look complete.
  const pendingOnly = coverageOf(english, { a: 'Apple', b: 'Banana' });
  assert.deepEqual(pendingOnly, { translated: 0, total: 4, ratio: 0, complete: false });

  const fullyTranslated = coverageOf(english, { a: 'Appel', b: 'Piesang', c: 'Wortel', d: 'Datum' });
  assert.deepEqual(fullyTranslated, { translated: 4, total: 4, ratio: 1, complete: true });

  const justUnderBar = coverageOf(english, { a: 'Appel', b: 'Piesang', c: 'Wortel' });
  assert.equal(justUnderBar.ratio, 0.75);
  assert.equal(justUnderBar.complete, false, 'ratio below the threshold must not read as complete');
});

test('a locale at or above the ~95% bar is complete; just under it is not', () => {
  const english: Record<string, string> = {};
  for (let i = 0; i < 100; i++) english[`k${i}`] = `English ${i}`;

  const at95: Record<string, string> = { ...english };
  for (let i = 0; i < 95; i++) at95[`k${i}`] = `Translated ${i}`;
  assert.equal(coverageOf(english, at95).ratio, 0.95);
  assert.equal(coverageOf(english, at95).complete, true);

  const at94: Record<string, string> = { ...english };
  for (let i = 0; i < 94; i++) at94[`k${i}`] = `Translated ${i}`;
  assert.equal(coverageOf(english, at94).complete, false);
});

test('an empty English dictionary is vacuously complete (nothing to translate)', () => {
  assert.deepEqual(coverageOf({}, {}), { translated: 0, total: 0, ratio: 1, complete: true });
});

test('LANG_COVERAGE_COMPLETE_THRESHOLD is the owner-set ~95% bar', () => {
  assert.equal(LANG_COVERAGE_COMPLETE_THRESHOLD, 0.95);
});

// Rebuilds T_en from lib/i18n.tsx's own source text. The file can't be imported directly under
// `node --test` (LanguageProvider returns JSX, which Node's TS type-stripping doesn't parse) —
// every other i18n test in this repo works around that the same way, by reading the file as text.
// T_en's declaration is a plain object literal (spreads of already-importable pending blocks plus
// string literals), so evaluating that literal text is exact, not an approximation of it.
function realEnglishDict(): Record<string, string> {
  const src = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const start = src.indexOf('export const T_en: Dict = {');
  assert.ok(start >= 0, 'lib/i18n.tsx must export T_en');
  const end = src.indexOf('\n};', start);
  const literal = src.slice(start, end + 3).replace('export const T_en: Dict = ', 'return ');
  const build = new Function(
    'DESIGN_STUDIO_ENGLISH_PENDING', 'JOURNAL_ENGLISH_PENDING', 'LIMA_ENGLISH_PENDING', 'LEARNER_UI_ENGLISH',
    literal,
  ) as (...args: unknown[]) => Record<string, string>;
  return build(DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING, LEARNER_UI_ENGLISH);
}

test('a dictionary compared against itself reads as untranslated, not complete', () => {
  // coverageOf() counts a key as translated only when its value differs from English — a locale
  // byte-identical to English (nothing rendered in its own words) must not read as "complete".
  // This is why ThemePanel never calls coverageOf(T_en, T_en) for English itself: English is
  // complete by definition (it *is* the source), not because it "translates" itself.
  const english = realEnglishDict();
  assert.ok(Object.keys(english).length > 100, 'sanity check: T_en must have parsed to a real dictionary');
  const selfCoverage = coverageOf(english, english);
  assert.equal(selfCoverage.ratio, 0);
  assert.equal(selfCoverage.complete, false);
});

test('computed against the real dictionaries: Xitsonga is still below the completeness bar', async () => {
  // This is the locale ThemePanel already special-cased as a draft before this change — it is
  // not close to 95% translated, so the generalised computation must keep flagging it (the
  // Xitsonga-specific note text in ThemePanel is a separate, deliberately preserved branch).
  const english = realEnglishDict();
  const { default: ts } = (await import('@/lib/locales/ts')) as { default: Record<string, string> };
  const coverage = coverageOf(english, ts);
  assert.equal(coverage.complete, false, 'Xitsonga is a known-partial locale; this must not silently start reading as complete');
});

test('ThemePanel wires the generic partial-language notice through lib/lang-coverage, and keeps the Xitsonga branch intact', () => {
  const src = readFileSync(new URL('../components/ThemePanel.tsx', import.meta.url), 'utf8');

  assert.match(src, /from '@\/lib\/lang-coverage'/, 'ThemePanel must compute coverage via lib/lang-coverage, not a hand-typed list');
  assert.match(src, /coverageOf\(T_en, getLoadedDict\(l\.code\)\)/);
  assert.doesNotMatch(src, /coverageOf\(T_en, T_en\)/, 'English must not be run through coverageOf against itself — that reads as 0% translated, not complete');

  // Regression guard: the original Xitsonga-only branch must survive unchanged.
  assert.match(src, /lang === 'ts'/);
  assert.match(src, /<span lang="ts">\{t\('xitsongaUiDraftNotice'\)\}<\/span>/);

  // The per-button "partly in English" second line.
  assert.match(src, /\{translate\(l\.code, 'langPartialTag'\)\}/);

  // The below-grid note for a partial active language other than Xitsonga.
  assert.match(src, /lang !== 'ts' && isPartialLang\(lang\)/);
  assert.match(src, /translate\(lang, 'langPartialActiveNote'\)/);

  // Buttons must stay at least 46px tall regardless of the added caption line.
  assert.match(src, /minHeight: 46, padding: '10px 12px', borderRadius: 8,/);
});

test('the new notice keys exist in English only — no un-reviewed translations were coined', () => {
  const i18nSrc = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  assert.match(i18nSrc, /^\s*langPartialTag: '[^']+',$/m);
  assert.match(i18nSrc, /^\s*langPartialActiveNote: '[^']*\{lang\}[^']*',$/m, 'the active-language note must keep its {lang} placeholder');

  const locales = ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr'];
  for (const code of locales) {
    const block = readFileSync(new URL(`../lib/locales/${code}.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      block,
      /^\s*langPartial(Tag|ActiveNote):/m,
      `${code} must not define langPartialTag/langPartialActiveNote until a first-language reviewer writes one — they should fall back to English`,
    );
  }
});
