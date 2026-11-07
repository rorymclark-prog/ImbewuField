import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { recordsDate, recordsMonthLong, recordsMonthShort, recordsMonthYear, recordsSeasonLabel, recordsBookDate, recordsBookMonthLong, recordsBookMonthShort, recordsBookMonthYear, recordsReportDate, recordsReportMonthShort, recordsReportSeasonLabel } from '@/lib/records-months';
import { registerInlineDrafts } from '@/lib/xh-inline';
import { AF_INLINE_SOURCE } from '@/lib/locales/af-inline/index';
import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';
import { buildFinanceSeries } from '@/lib/finance-series';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const LANGS = ['zu', 'st', 've', 'ts', 'xh'] as const;
const ENGLISH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

test('English and unlisted languages print exactly what toLocaleDateString(en-ZA) printed before', () => {
  for (const lang of ['en', 'fr', 'xx', '']) {
    for (let month = 0; month < 12; month++) {
      const d = new Date(2026, month, 5, 9, 0, 0);
      assert.equal(recordsDate(lang, d, false), d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), `${lang} ${month}`);
      assert.equal(recordsDate(lang, d, true), d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }), `${lang} ${month} year`);
      assert.equal(recordsMonthShort(lang, month + 1), ENGLISH_SHORT[month]);
      assert.equal(recordsMonthYear(lang, month + 1, 2026), `${ENGLISH_SHORT[month]} 2026`);
    }
  }
  // The chart readout and the "Your records start in" label were 'Sep 2025' style and still are.
  assert.equal(recordsMonthYear('en', 9, 2025), 'Sep 2025');
});

test('every listed language names all twelve months; names and short forms are distinct', () => {
  for (const lang of LANGS) {
    const long = Array.from({ length: 12 }, (_, i) => recordsMonthLong(lang, i + 1));
    const short = Array.from({ length: 12 }, (_, i) => recordsMonthShort(lang, i + 1));
    assert.equal(new Set(long).size, 12, `${lang} long names must be 12 different words`);
    assert.equal(new Set(short).size, 12, `${lang} short forms must be 12 different words`);
    for (let i = 0; i < 12; i++) {
      assert.ok(long[i].trim() !== '' && short[i].trim() !== '', `${lang} month ${i + 1} is blank`);
      assert.ok(short[i].length <= 4, `${lang} short form "${short[i]}" is too long for a chart axis`);
      assert.notEqual(long[i], ENGLISH_SHORT[i], `${lang} month ${i + 1} still shows the English word`);
    }
  }
});

test('isiZulu reuses the month names the app already carries; nothing is coined for it', () => {
  const source = read('components/ComingUpHarvests.tsx');
  const block = source.slice(source.indexOf('const MONTH_ZU'));
  const existing = [...block.slice(0, block.indexOf('};')).matchAll(/\d+: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(existing.length, 12);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => recordsMonthLong('zu', i + 1)), existing);
});

test('isiXhosa reuses the month names the app already carries for Home; nothing is coined for it', () => {
  const source = read('lib/locales/xh.ts');
  const keys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const existing = keys.map((k) => source.match(new RegExp(`homeMonth${k}: '([^']+)'`))?.[1]);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => recordsMonthLong('xh', i + 1)), existing);
});

test('Afrikaans names the twelve months for the money book, and dates keep their shape', () => {
  const long = Array.from({ length: 12 }, (_, i) => recordsBookMonthLong('af', i + 1));
  const short = Array.from({ length: 12 }, (_, i) => recordsBookMonthShort('af', i + 1));
  assert.deepEqual(long, ['Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie', 'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember']);
  assert.deepEqual(short, ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']);
  assert.equal(new Set(long).size, 12);
  assert.equal(new Set(short).size, 12);
  const d = new Date(2026, 2, 5, 9, 0, 0);
  assert.equal(recordsBookDate('af', d, true), '05 Mrt 2026');
  assert.equal(recordsBookDate('af', d, false), '05 Mrt');
  assert.equal(recordsBookMonthYear('af', 10, 2026), 'Oktober 2026');
  assert.equal(recordsBookDate('af', new Date('nope'), true), 'Invalid Date');
  assert.equal(recordsBookMonthLong('af', 13), '');
  assert.equal(recordsBookMonthShort('af', 0), '');
  // Every other language is exactly the plain function: English, isiZulu, isiXhosa and the regional drafts do not move.
  for (const lang of ['en', 'zu', 'xh', 'st', 've', 'ts', 'fr', '']) {
    for (let month = 1; month <= 12; month++) {
      assert.equal(recordsBookMonthShort(lang, month), recordsMonthShort(lang, month));
      assert.equal(recordsBookMonthLong(lang, month), recordsMonthLong(lang, month));
      assert.equal(recordsBookMonthYear(lang, month, 2026), recordsMonthYear(lang, month, 2026));
      const day = new Date(2026, month - 1, 5, 9, 0, 0);
      assert.equal(recordsBookDate(lang, day, true), recordsDate(lang, day, true));
      assert.equal(recordsBookDate(lang, day, false), recordsDate(lang, day, false));
    }
  }
  // The shared tables (which every report builder reads) have no Afrikaans; the site report opts in through recordsReport*, below.
  assert.equal(recordsMonthShort('af', 3), 'Mar');
  assert.equal(recordsMonthLong('af', 5), 'May');
  assert.equal(recordsSeasonLabel('af', 'Nov–Mar'), 'Nov–Mar');
  assert.equal(recordsSeasonLabel('af', 'year-round'), 'year-round');
});

test('regional months keep the order of the calendar (blind reviewers mapped each name back to its month)', () => {
  assert.deepEqual([1, 6, 12].map((m) => recordsMonthLong('st', m)), ['Pherekgong', 'Phupjane', 'Tshitwe']);
  assert.deepEqual([1, 6, 12].map((m) => recordsMonthLong('ve', m)), ['Phando', 'Fulwi', 'Nyendavhusiku']);
  assert.deepEqual([1, 6, 12].map((m) => recordsMonthLong('ts', m)), ['Sunguti', 'Khotavuxika', "N'wendzamhala"]);
  // The two look-alike pairs a reader could swap.
  assert.equal(recordsMonthLong('ve', 6), 'Fulwi');
  assert.equal(recordsMonthLong('ve', 7), 'Fulwana');
});

test('dates keep their shape: day, month word, year; only the word moves', () => {
  const d = new Date(2026, 6, 5, 9, 0, 0);
  assert.equal(recordsDate('st', d, true), '05 Phu 2026');
  assert.equal(recordsDate('st', d, false), '05 Phu');
  assert.equal(recordsDate('ve', d, false), '05 Fwan');
  assert.equal(recordsMonthYear('ts', 7, 2026), 'Mawuwani 2026');
  // An unreadable date is not dressed up as a real month.
  assert.equal(recordsDate('st', new Date('nope'), true), 'Invalid Date');
  assert.equal(recordsMonthLong('st', 13), '');
  assert.equal(recordsMonthShort('st', 0), '');
});

test('the finance series still labels months in English and also exposes the first month as numbers', () => {
  const rows = [{ id: 's1', profile_id: 'p', garden_id: null, crop: 'Swiss chard', kg: 2, amount: 20, buyer: null, sold_at: '2026-03-04T09:00:00', created_at: '2026-03-04T09:00:00' }];
  const s = buildFinanceSeries([], rows as never, [], [], new Date('2026-08-15T09:00:00'), 12);
  assert.equal(s.firstRecordLabel, 'Mar 2026');
  assert.equal(s.firstRecordMonth, 3);
  assert.equal(s.firstRecordYear, 2026);
  assert.equal(s.months[0].label.length, 3);
});

test('wiring: the money book, charts, harvest list and saved-invoice list use the month helper; printed output does not', () => {
  assert.match(read('app/records/page.tsx'), /recordsBookDate\(lang, d, false\)/);
  assert.match(read('components/MyRecords.tsx'), /recordsBookDate\(lang, d, true\)/);
  // Afrikaans months are not in the shared tables (reports pin English), so the money charts read the recordsBook* functions.
  assert.match(read('components/CashflowChart.tsx'), /records(?:Book)?MonthShort\(lang, m\.month\)/);
  assert.match(read('components/CashflowChart.tsx'), /records(?:Book)?MonthYear\(lang, month\.month, month\.year\)/);
  assert.match(read('components/CashflowChart.tsx'), /recordsBookMonthShort\(lang, m\.month\)/);
  assert.match(read('components/CashflowChart.tsx'), /recordsBookMonthYear\(lang, month\.month, month\.year\)/);
  assert.match(read('components/CashflowChart.tsx'), /recordsBookMonthYear\(lang, series\.firstRecordMonth, series\.firstRecordYear\)/);
  assert.doesNotMatch(read('components/CashflowChart.tsx'), /(?<!Book)records(?:MonthShort|MonthYear)\(/, 'the cash-flow chart must not read the plain month tables');
  assert.match(read('components/FinanceGraphs.tsx'), /recordsBookMonthShort\(lang, m\.month\)/);
  assert.match(read('components/FinanceGraphs.tsx'), /recordsBookMonthYear\(lang, selected\.month, selected\.year\)/);
  assert.match(read('components/ComingUpHarvests.tsx'), /records(?:Book)?MonthLong\(lang, h\.endMonth\)/);
  assert.match(read('components/ComingUpHarvests.tsx'), /recordsBookMonthLong\(lang, h\.endMonth\)/);
  assert.match(read('components/ComingUpHarvests.tsx'), /recordsBookMonthYear\(lang, month\.month, month\.year\)/);
  assert.match(read('app/invoice/page.tsx'), /records(?:Book)?Date\(lang, new Date\(inv\.dateISO\), true\)/);
  assert.match(read('app/invoice/page.tsx'), /isRecordsRegionalLang\(lang\) \|\| lang === 'af'\s*\? recordsBookDate\(lang, new Date\(inv\.dateISO\), true\)/);
  // The CSV export stays on its own English dates. w18-41: the invoice document now builds its
  // isiZulu dates from the month table (the platform zu-ZA locale fell back to US-order English).
  for (const printed of ['lib/invoice-entry.ts']) {
    assert.doesNotMatch(read(printed), /records-months/, `${printed} must not use regional month names`);
  }
  assert.match(read('app/records/page.tsx'), /const csvLang = \(lang: string\) => \(lang === 'zu' \? 'zu' : lang === 'xh' \? 'xh' : lang === 'af' \? 'af' : 'en'\);/);
});

test('the site report reads Afrikaans months only once the Afrikaans drafts are loaded, and every other language is the plain function', () => {
  registerInlineDrafts('af', {});
  const d = new Date(2026, 2, 5, 9, 0, 0);
  // Before the drafts load (the server, first paint) an Afrikaans report is English throughout, so no Afrikaans month word sits inside English text.
  for (let month = 1; month <= 12; month++) assert.equal(recordsReportMonthShort('af', month), recordsMonthShort('af', month));
  assert.equal(recordsReportDate('af', d, true), recordsDate('af', d, true));
  assert.equal(recordsReportSeasonLabel('af', 'Nov–Mar'), 'Nov–Mar');
  assert.equal(recordsReportSeasonLabel('af', 'year-round'), 'year-round');
  registerInlineDrafts('af', AF_INLINE_SOURCE);
  try {
    assert.deepEqual(Array.from({ length: 12 }, (_, i) => recordsReportMonthShort('af', i + 1)), ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']);
    assert.equal(recordsReportMonthShort('af', 13), '');
    assert.equal(recordsReportDate('af', d, true), '05 Mrt 2026');
    assert.equal(recordsReportDate('af', d, false), '05 Mrt');
    assert.equal(recordsReportDate('af', new Date('nope'), true), 'Invalid Date');
    assert.equal(recordsReportSeasonLabel('af', 'Nov–Mar'), 'Nov–Mar'.replace('Mar', 'Mrt'));
    assert.equal(recordsReportSeasonLabel('af', 'year-round'), 'heeljaar');
    assert.equal(recordsReportSeasonLabel('af', 'none'), 'geen');
    assert.equal(recordsReportSeasonLabel('af', 'Whenever it rains'), 'Whenever it rains');
    // The drafts being loaded changes nothing for any other language, and the shared tables still have no Afrikaans.
    for (const lang of ['en', 'zu', 'xh', 'st', 've', 'ts', 'fr', '']) {
      for (let month = 1; month <= 12; month++) {
        assert.equal(recordsReportMonthShort(lang, month), recordsMonthShort(lang, month));
        const day = new Date(2026, month - 1, 5, 9, 0, 0);
        assert.equal(recordsReportDate(lang, day, true), recordsDate(lang, day, true));
        assert.equal(recordsReportDate(lang, day, false), recordsDate(lang, day, false));
      }
      // isiXhosa season labels name isiXhosa months only once the isiXhosa drafts are loaded (checked below); every other language is the plain function.
      if (lang !== 'xh') for (const value of ['Nov–Mar', 'Jan–Dec', 'year-round', 'none', 'Whenever it rains']) assert.equal(recordsReportSeasonLabel(lang, value), recordsSeasonLabel(lang, value));
    }
    // isiXhosa: the English until its own drafts load (the Afrikaans drafts being loaded changes nothing), the plain function after.
    registerInlineDrafts('xh', {});
    for (const value of ['Nov–Mar', 'Jan–Dec', 'year-round', 'none', 'Whenever it rains']) assert.equal(recordsReportSeasonLabel('xh', value), value);
    registerInlineDrafts('xh', XH_INLINE_SOURCE);
    for (const value of ['Nov–Mar', 'Jan–Dec', 'year-round', 'none', 'Whenever it rains']) assert.equal(recordsReportSeasonLabel('xh', value), recordsSeasonLabel('xh', value));
    registerInlineDrafts('xh', {});
    assert.equal(recordsMonthShort('af', 3), 'Mar');
    assert.equal(recordsSeasonLabel('af', 'Nov–Mar'), 'Nov–Mar');
  } finally {
    registerInlineDrafts('af', AF_INLINE_SOURCE);
  }
});
