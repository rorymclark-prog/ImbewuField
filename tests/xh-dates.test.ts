// isiXhosa date lines (lib/xh-dates.ts): browsers fall back to English for 'xh-ZA', so the app
// writes day-month-year from its own month names, and leaves every other language untouched.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/xh-dates.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { formatXhosaDate, localeDate } from '@/lib/xh-dates';
import { formatStaffDate, formatStaffDateRange } from '@/lib/format-figures';

const D = new Date(2026, 9, 24, 14, 5, 9);

test('formatXhosaDate writes day-month-year with isiXhosa month names', () => {
  assert.equal(formatXhosaDate(D, { day: true, month: 'short', year: true }), '24 Okt 2026');
  assert.equal(formatXhosaDate(D, { day: true, month: 'long', year: true }), '24 Okthobha 2026');
  assert.equal(formatXhosaDate(D, { day: true, month: 'short' }), '24 Okt');
  assert.equal(formatXhosaDate(D, { month: 'long', year: true }), 'Okthobha 2026');
  assert.equal(formatXhosaDate(D, { day: true, month: 'short', year: true, time: true }), '24 Okt 2026 14:05:09');
  assert.equal(formatXhosaDate(new Date(2026, 0, 3, 7, 8, 9), { day: true, month: 'short', year: true, time: true }), '3 Jan 2026 07:08:09');
  assert.equal(formatXhosaDate(new Date('nope'), { month: 'short' }), '');
});

test('every month has a long and a short isiXhosa name', () => {
  const long = ['Janyuwari', 'Februwari', 'Matshi', 'Epreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septemba', 'Okthobha', 'Novemba', 'Disemba'];
  const short = ['Jan', 'Feb', 'Mat', 'Epr', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'];
  for (let m = 0; m < 12; m++) {
    assert.equal(formatXhosaDate(new Date(2026, m, 5), { month: 'long' }), long[m]);
    assert.equal(formatXhosaDate(new Date(2026, m, 5), { month: 'short' }), short[m]);
  }
});

test('localeDate is byte-identical to toLocaleDateString for every language but xh', () => {
  const opts: Intl.DateTimeFormatOptions[] = [{ day: 'numeric', month: 'short' }, { day: 'numeric', month: 'long', year: 'numeric' }, {}];
  for (const o of opts) {
    assert.equal(localeDate('en', D, o, 'en-ZA'), D.toLocaleDateString('en-ZA', o));
    assert.equal(localeDate('zu', D, o, 'zu-ZA'), D.toLocaleDateString('zu-ZA', o));
  }
  assert.equal(localeDate('xh', D, { day: 'numeric', month: 'short' }, 'en-ZA'), '24 Okt');
  assert.equal(localeDate('xh', D, { day: 'numeric', month: 'long', year: 'numeric' }, 'en-ZA'), '24 Okthobha 2026');
  // No month asked for: the numeric en-ZA date stays (numbers are fine for isiXhosa).
  assert.equal(localeDate('xh', D, {}, 'en-ZA'), D.toLocaleDateString('en-ZA', {}));
});

test('formatStaffDate and formatStaffDateRange speak isiXhosa and leave other languages alone', () => {
  assert.equal(formatStaffDate('2026-10-24', 'xh'), '24 Okt 2026');
  assert.equal(formatStaffDateRange('2026-08-15', '2026-09-05', 'xh'), '15 Aga – 5 Sep 2026');
  assert.equal(formatStaffDateRange('2025-12-15', '2026-01-05', 'xh'), '15 Dis 2025 – 5 Jan 2026');
  const d = new Date('2026-10-24T00:00:00');
  assert.equal(formatStaffDate('2026-10-24', 'en'), d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
  assert.equal(formatStaffDate('2026-10-24', 'zu'), d.toLocaleDateString('zu-ZA', { day: 'numeric', month: 'short', year: 'numeric' }));
  assert.equal(formatStaffDate(null, 'xh'), '');
  assert.equal(formatStaffDate('not-a-date', 'xh'), 'not-a-date');
});

test('the screens route their date lines through the isiXhosa helper', () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['app/community/page.tsx', 'app/community/messages/[threadId]/page.tsx', 'components/ContactInbox.tsx', 'app/reports/page.tsx', 'components/report/SavedReportsList.tsx', 'components/ReportView.tsx']) {
    assert.match(read(p), /@\/lib\/xh-dates/, `${p} does not use lib/xh-dates`);
  }
  assert.match(read('app/mentor/page.tsx'), /formatXhosaDate/, 'the mentor due-date line has no isiXhosa branch');
});
