import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { SOURCE_MESSAGES } from '@/lib/international/locales/source';
import { DRAFT_DICTIONARIES } from '@/lib/international/locales/dictionaries';
import { DRAFT_LANGUAGES, isolateText } from '@/lib/international/locales/metadata';
import { assessMessage, coverageReport, requiredPluralCategories, resolveMessage } from '@/lib/international/locales/coverage';
import { formattingContext, formatNumber, calendarDateParts, formatCalendarDate, formatRecordedMoney, totalRecordedMoney } from '@/lib/international/locales/formatting';
import { readCurrentEnglish } from '@/lib/international/locales/source-reader';
import type { DraftDictionary, DraftMessage } from '@/lib/international/locales/types';

const sourceText = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const current = readCurrentEnglish(sourceText, SOURCE_MESSAGES);
const message = SOURCE_MESSAGES.find((row) => row.key === 'completionScoreProgressAria')!;
const photo = SOURCE_MESSAGES.find((row) => row.key === 'reportPhotosCount')!;
const french = DRAFT_DICTIONARIES.fr;
function withDraft(patch: Partial<DraftMessage>, key = message.key): DraftDictionary {
  return { ...french, [key]: { ...french[key]!, ...patch } };
}
function reviewed(key = message.key): DraftMessage {
  const draft = french[key]!;
  return { ...draft, review: { status: 'human-reviewed', reviewer: 'Synthetic test reviewer', reviewedOn: '2026-11-01', sourceEnglish: draft.sourceEnglish, draftText: draft.text, ...(draft.pluralForms ? { pluralForms: { ...draft.pluralForms } } : {}) } };
}

test('all four bounded dictionaries bind actual current source keys while claiming zero human-reviewed coverage', () => {
  assert.equal(new Set(SOURCE_MESSAGES.map((row) => row.key)).size, SOURCE_MESSAGES.length);
  assert.ok(SOURCE_MESSAGES.length >= 24, 'this is a useful bounded review set, not one token example');
  for (const metadata of DRAFT_LANGUAGES) {
    assert.equal(Object.hasOwn(metadata, 'country'), false);
    assert.equal(Object.hasOwn(metadata, 'currency'), false);
    const report = coverageReport(SOURCE_MESSAGES, current, DRAFT_DICTIONARIES[metadata.language], metadata.language);
    assert.equal(report.counts.draft, SOURCE_MESSAGES.length, JSON.stringify(report.rows.filter((row) => row.state !== 'draft')));
    assert.equal(report.counts.reviewed, 0); assert.equal(report.reviewedPercent, 0); assert.deepEqual(report.extras, []);
    for (const row of report.rows) assert.equal(row.draft!.review.status, 'unreviewed');
  }
});

test('a changed or removed real English property invalidates reviewed coverage and falls back to the current English', () => {
  const dictionary = { ...french, [message.key]: reviewed() };
  assert.equal(assessMessage(message, current, dictionary, 'fr').state, 'reviewed');
  const changedSource = sourceText.replace(message.english, `${message.english} Changed.`);
  const changed = readCurrentEnglish(changedSource, SOURCE_MESSAGES);
  assert.equal(assessMessage(message, changed, dictionary, 'fr').state, 'stale');
  assert.equal(resolveMessage(message, changed, dictionary, 'fr', { previewDraft: true }).origin, 'source');
  const absent = { ...current }; delete absent[message.key];
  assert.equal(assessMessage(message, absent, dictionary, 'fr').state, 'source-missing');
  assert.equal(resolveMessage(message, absent, dictionary, 'fr').origin, 'key');
  assert.equal(coverageReport(SOURCE_MESSAGES, absent, dictionary, 'fr').counts.reviewed, 0);
});

test('missing drafts, inherited keys and English fallback never count as translated or reviewed', () => {
  const missing = { ...french }; delete missing[message.key];
  assert.equal(assessMessage(message, current, missing, 'fr').state, 'missing');
  assert.equal(resolveMessage(message, current, missing, 'fr', { previewDraft: true }).origin, 'source');
  assert.equal(assessMessage(message, Object.create({ [message.key]: message.english }), french, 'fr').state, 'source-missing');
  assert.equal(assessMessage(message, current, Object.create({ [message.key]: french[message.key] }), 'fr').state, 'missing');
  assert.equal(resolveMessage(message, current, french, 'fr').origin, 'source');
  assert.equal(resolveMessage(message, current, french, 'fr', { previewDraft: true }).origin, 'draft');
});

test('deleted, duplicated, additional or malformed interpolation tokens reject a draft before display', () => {
  for (const text of ['{percent}% {done}', '{percent}% {done} {total} {total}', '{percent}% {done} {total} {extra}', '{percent}% {done} {total} {broken']) {
    assert.equal(assessMessage(message, current, withDraft({ text }), 'fr').state, 'invalid');
  }
  const result = resolveMessage(message, current, french, 'fr', { previewDraft: true, values: { percent: 50, done: 2 } });
  assert.match(result.issues[0], /total/);
  assert.match(result.text, /\{total\}/, 'unknown interpolation remains visible instead of becoming zero');
  const inheritedToken = { ...message, key: 'synthetic', english: '{constructor}' };
  const unresolved = resolveMessage(inheritedToken, { synthetic: '{constructor}' }, {}, 'fr');
  assert.match(unresolved.issues[0], /constructor/);
  assert.equal(unresolved.text, '{constructor}', 'object prototype properties are not supplied interpolation values');
});

test('a plural category gap cannot pass against ICU requirements and singular/plural rendering uses the whole template', () => {
  for (const language of DRAFT_LANGUAGES) {
    const categories = requiredPluralCategories(language.language)!;
    assert.ok(categories.includes('other'));
    for (const category of categories) {
      const draft = DRAFT_DICTIONARIES[language.language][photo.key]!;
      const forms = { ...draft.pluralForms }; delete forms[category];
      const dictionary = { ...DRAFT_DICTIONARIES[language.language], [photo.key]: { ...draft, pluralForms: forms } };
      assert.equal(assessMessage(photo, current, dictionary, language.language).state, 'invalid');
    }
  }
  assert.match(resolveMessage(photo, current, french, 'fr', { previewDraft: true, count: 1 }).text, /photo$/);
  assert.match(resolveMessage(photo, current, french, 'fr', { previewDraft: true, count: 2 }).text, /photos$/);
  assert.equal(resolveMessage(photo, current, french, 'fr', { previewDraft: true, count: NaN }).origin, 'source');
  assert.equal(assessMessage(photo, current, withDraft({ pluralForms: { ...french[photo.key]!.pluralForms, other: '{n} photos {broken' } }, photo.key), 'fr').state, 'invalid');
});

test('changed draft text or plural wording invalidates a prior human-review record too', () => {
  const approved = reviewed();
  assert.equal(assessMessage(message, current, { [message.key]: approved }, 'fr').state, 'reviewed');
  assert.equal(assessMessage(message, current, { [message.key]: { ...approved, text: `${approved.text} Changed.` } }, 'fr').state, 'invalid');
  const plural = reviewed(photo.key);
  assert.equal(assessMessage(photo, current, { [photo.key]: { ...plural, pluralForms: { ...plural.pluralForms, other: 'Photos : {n}' } } }, 'fr').state, 'invalid');
  assert.equal(assessMessage(message, current, { [message.key]: { ...approved, review: { ...approved.review, status: 'human-reviewed', reviewedOn: '2026-02-30' } } } as DraftDictionary, 'fr').state, 'invalid');
});

test('locale validation and unavailable ICU data report explicit English fallback rather than a false supported state', () => {
  for (const tag of ['', 'fr_FR', 'not a locale']) assert.equal(formattingContext(tag).status, 'invalid');
  const unavailable = formattingContext('sw', () => false);
  assert.equal(unavailable.status, 'fallback'); assert.equal(unavailable.numberLocale, 'en'); assert.match(unavailable.reason!, /unavailable/);
  assert.equal(formattingContext('zz-ZZ').status, 'fallback');
  assert.equal(requiredPluralCategories('fr_FR'), null);
  assert.equal(assessMessage(message, current, french, 'zz-ZZ').state, 'invalid');
});

test('deterministic numbers expose decimal/grouping conventions and calendar dates preserve day identity and date order', () => {
  const frenchContext = formattingContext('fr'); const spanishContext = formattingContext('es');
  assert.equal(frenchContext.status, 'supported'); assert.equal(spanishContext.status, 'supported');
  assert.equal(formatNumber(12345.67, frenchContext), '12\u202f345,67');
  assert.equal(formatNumber(12345.67, spanishContext), '12.345,67');
  const order = (locale: string) => calendarDateParts('2026-11-03', formattingContext(locale))!.filter((part) => part.type !== 'literal').map((part) => part.type);
  assert.deepEqual(order('fr'), ['day', 'month', 'year']);
  assert.deepEqual(order('en-US'), ['month', 'day', 'year']);
  assert.equal(formatCalendarDate('2026-02-30', frenchContext), null);
  assert.equal(formatCalendarDate('2024-02-29', frenchContext), '29/02/2024');
  assert.equal(formatNumber(NaN, frenchContext), null); assert.equal(formatNumber(0, frenchContext), '0');
});

test('language changes preserve recorded denominations and mixed-currency totals remain separate', () => {
  const transaction = { amount: 1234.5, currency: 'ZAR' };
  for (const language of DRAFT_LANGUAGES) {
    const result = formatRecordedMoney(transaction, formattingContext(language.language))!;
    assert.equal(result.currency, 'ZAR'); assert.match(result.text, /ZAR/);
  }
  assert.deepEqual(transaction, { amount: 1234.5, currency: 'ZAR' });
  const mixed = totalRecordedMoney([{ amount: 10, currency: 'ZAR' }, { amount: 20, currency: 'USD' }]);
  assert.equal(mixed.status, 'mixed-currencies'); assert.equal(Object.hasOwn(mixed, 'total'), false);
  assert.deepEqual(totalRecordedMoney([{ amount: 0, currency: 'ZAR' }]), { status: 'single-currency', total: { amount: 0, currency: 'ZAR' } });
  assert.equal(totalRecordedMoney([{ amount: NaN, currency: 'ZAR' }]).status, 'invalid');
  assert.equal(totalRecordedMoney([]).status, 'empty');
});

test('RTL fixtures isolate mixed-direction values and prevent embedded controls escaping the value', () => {
  assert.equal(isolateText('ZAR 12', 'ltr'), '\u2066ZAR 12\u2069');
  assert.equal(isolateText('مثال', 'rtl'), '\u2067مثال\u2069');
  assert.equal(isolateText('A\u2069\u202EB'), '\u2068AB\u2069');
  assert.equal(DRAFT_LANGUAGES.some((language) => language.direction === 'rtl'), false);
});

test('the executable report audits the shipped source and an optional reviewed-only gate fails on drafts', () => {
  const args = ['--import', './tests/register-alias.mjs', 'lib/international/locales/coverage-cli.mjs', '--json'];
  const reports = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.equal(reports.length, 4); assert.ok(reports.every((report: { counts: { reviewed: number }; problems: unknown[] }) => report.counts.reviewed === 0 && report.problems.length === 0));
  const gate = spawnSync(process.execPath, [...args, '--require-reviewed'], { encoding: 'utf8' });
  assert.equal(gate.status, 1, 'drafts are structurally valid but cannot satisfy a reviewed-language release gate');
});
