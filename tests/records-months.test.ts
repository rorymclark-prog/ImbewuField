import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { recordsDate, recordsMonthLong, recordsMonthShort, recordsMonthYear } from '@/lib/records-months';
import { buildFinanceSeries } from '@/lib/finance-series';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const LANGS = ['zu', 'st', 've', 'ts'] as const;
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
  assert.match(read('app/records/page.tsx'), /recordsDate\(lang, d, false\)/);
  assert.match(read('components/MyRecords.tsx'), /recordsDate\(lang, d, true\)/);
  assert.match(read('components/CashflowChart.tsx'), /recordsMonthShort\(lang, m\.month\)/);
  assert.match(read('components/CashflowChart.tsx'), /recordsMonthYear\(lang, month\.month, month\.year\)/);
  assert.match(read('components/FinanceGraphs.tsx'), /recordsMonthShort\(lang, m\.month\)/);
  assert.match(read('components/FinanceGraphs.tsx'), /recordsMonthYear\(lang, selected\.month, selected\.year\)/);
  assert.match(read('components/ComingUpHarvests.tsx'), /recordsMonthLong\(lang, h\.endMonth\)/);
  assert.match(read('app/invoice/page.tsx'), /recordsDate\(lang, new Date\(inv\.dateISO\), true\)/);
  // The invoice a buyer receives, the PDF and the CSV export stay on their own English dates.
  for (const printed of ['lib/invoice-document.ts', 'lib/invoice-entry.ts']) {
    assert.doesNotMatch(read(printed), /records-months/, `${printed} must not use regional month names`);
  }
  assert.match(read('app/records/page.tsx'), /const csvLang = \(lang: string\) => \(lang === 'zu' \? 'zu' : 'en'\);/);
});
