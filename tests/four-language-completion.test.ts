import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { coverageOf, translationGaps } from '../lib/lang-coverage.ts';
import { englishDictionary, visibleLiteralCandidates } from './translation-inventory.ts';
import { beforeNavigationDictionary, beforeNavigationTranslations } from './navigation-translation-preservation.ts';
import zu from '../lib/locales/zu.ts';
import st from '../lib/locales/st.ts';
import ts from '../lib/locales/ts.ts';
import ve from '../lib/locales/ve.ts';

const locales = { zu, st, ts, ve };
const english = englishDictionary();
const packet = JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/navigation-account-drafts.json', import.meta.url), 'utf8')) as {
  status: string;
  entries: Array<{ key: string; english: string; st: string; ts: string; ve: string }>;
  notices: Record<'st' | 'ts' | 've', Record<string, string>>;
};

test('translation audits expose fallback English, blank labels and lost or duplicated placeholders', () => {
  const source = { missing: 'Save', blank: 'Cancel', pending: 'Close', broken: '{done}/{total}', duplicate: '{count} beds', good: 'Open {site}' };
  const translated = { blank: '  ', pending: 'Close', broken: '{done}', duplicate: '{count} {count} dibethe', good: 'Bula {site}' };
  assert.deepEqual(translationGaps(source, translated), [
    { key: 'missing', reason: 'missing' }, { key: 'blank', reason: 'empty' },
    { key: 'pending', reason: 'english' }, { key: 'broken', reason: 'placeholders' },
    { key: 'duplicate', reason: 'placeholders' },
  ]);
  assert.equal(coverageOf({ a: 'Save' }, { a: ' ' }).complete, false, 'blank labels cannot improve coverage');
});

test('navigation and account controls use source-paired drafts and keep every substituted value in all four languages', () => {
  assert.match(packet.status, /Unreviewed AI drafts/);
  assert.ok(packet.entries.length > 0, 'the source-pair review packet cannot be empty');
  for (const entry of packet.entries) {
    assert.equal(english[entry.key], entry.english, `${entry.key}: update its translation if the source changes`);
    for (const code of ['st', 'ts', 've'] as const) {
      assert.equal(locales[code][entry.key], entry[code], `${code}/${entry.key}: the displayed draft must match its review packet`);
    }
    for (const [code, dict] of Object.entries(locales)) {
      assert.deepEqual(translationGaps({ [entry.key]: entry.english }, dict), [], `${code}/${entry.key}: a button reverted to English or lost a substituted value`);
      assert.deepEqual(dict[entry.key].match(/\d+/g) ?? [], entry.english.match(/\d+/g) ?? [], `${code}/${entry.key}: preserve source figures`);
    }
  }
});

test('draft languages show their own notice and changing language does not inherit another dismissal', () => {
  for (const [code, notice] of Object.entries(packet.notices)) {
    for (const [key, value] of Object.entries(notice)) assert.equal(locales[code as keyof typeof locales][key], value);
  }
  const source = readFileSync(new URL('../components/LanguageDraftNote.tsx', import.meta.url), 'utf8');
  assert.match(source, /\['zu', 'st', 'ts', 've'\]\.includes\(lang\)/);
  assert.match(source, /<p lang=\{lang\}/);
  assert.match(source, /\$\{scope\}_\$\{lang\}/);
  assert.match(source, /dismissedKey === storageKey/);
  assert.match(source, /translate\('en', 'languageDraftNoticeEnglishText'\)\.replace\('isiZulu'/);
});

test('visible text inventory notices English outside dictionaries, including conditional copy and accessibility labels', () => {
  const rows = visibleLiteralCandidates('Probe.tsx', `<><button title="Save now" aria-label={'Close panel'}>Save changes</button><p>{lang === 'zu' ? 'Sawubona' : 'Hello farmer'}</p><p>{t('translated')}</p></>`);
  assert.deepEqual(rows.map((row) => row.text), ['Save now', 'Close panel', 'Save changes', 'Sawubona', 'Hello farmer']);
  assert.ok(rows.every((row) => row.line === 1));
});

test('historical study protection permits the declared new app controls and still rejects changed or overridden learning content', () => {
  const source = readFileSync(new URL('../lib/locales/ve.ts', import.meta.url), 'utf8');
  const before = beforeNavigationTranslations(source, 've');
  assert.ok(!before.includes('  completionScoreAria:'));
  assert.throws(() => beforeNavigationTranslations(source.replace('  loginSignIn: "Dzhenani",', '  loginSignIn: "Sign in",'), 've'));
  assert.throws(() => beforeNavigationTranslations(source.replace('const dict: Dict = {', 'const dict: Dict = {\n  loginSignIn: "Override",'), 've'));
  const withChangedLesson = source.replace('studentKeyPoints:', 'studentKeyPointsChanged:');
  assert.notEqual(beforeNavigationTranslations(withChangedLesson, 've'), before, 'a learning-content edit must still reach and fail the original snapshot check');
});

test('historical dictionary views reverse only an exact app UI layer and keep changed callers exposed', async () => {
  const { assertStudyRemainingControlsLocale } = await import('./study-remaining-controls-next-history-checks.ts');
  const before = beforeNavigationDictionary(ve, 've') as Record<string, string>;
  assert.ok(!Object.hasOwn(before, 'completionScoreAria'));
  assert.equal(before.homeQuickJournalDesc, 'Notes & photos', 'restore a pending English value instead of deleting its key');
  assertStudyRemainingControlsLocale(ve);
  const changedAppControl = { ...ve, loginSignIn: ve.loginSignIn + ' Changed.' };
  assert.equal(beforeNavigationDictionary(changedAppControl, 've'), changedAppControl, 'a changed caller must not be projected as the accepted layer');
  assert.throws(() => assertStudyRemainingControlsLocale(changedAppControl), /unlisted or altered locale value/);
  assert.throws(() => assertStudyRemainingControlsLocale({ ...ve, studentContinue: ve.studentContinue + ' Changed.' }), /unlisted or altered locale value/);
});
