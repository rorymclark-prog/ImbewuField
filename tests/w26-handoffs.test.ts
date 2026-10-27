import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w26-01 (w23-02): cohort money totals come from the unrounded months, so they match the card', () => {
  const s = read('lib/cohort-series.ts');
  assert.match(s, /const exactIncomeZar = exactTotal\(\(m\) => m\.incomeZar\);/);
  assert.match(s, /totalIncomeZar: exactIncomeZar,/);
  assert.match(s, /totalExpensesZar: exactExpensesZar,/);
  // computed before the per-month whole-rand rounding loop
  assert.ok(s.indexOf('const exactIncomeZar') < s.indexOf('bucket.incomeZar = Math.round(bucket.incomeZar)'));
});

test('w26-02 (w23-06): farm report counts agree with their nouns', () => {
  const s = read('lib/farm-report.ts');
  assert.match(s, /const countOf = \(n: number, one: string, many: string\): string => `\$\{n\} \$\{n === 1 \? one : many\}`;/);
  assert.doesNotMatch(s, /\$\{unpaid\.length\} local invoices/);
  assert.doesNotMatch(s, /\$\{expenses\.length\} expense entries/);
  assert.doesNotMatch(s, /\$\{missingDates\} available records have/);
});

test('w26-03: programme report figures use a decimal comma like the money beside them', () => {
  assert.match(read('lib/programme-report.ts'), /numberLabel\(n,2\)\.replace\('\.', ','\)/);
});
