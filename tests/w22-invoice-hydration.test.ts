import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// w22-02: /invoice is prerendered, so a clock read during render bakes the build day into the HTML
// and throws React #425 on every later day (or where the server's UTC day is not the farmer's).
const source = readFileSync('app/invoice/page.tsx', 'utf8');

test('invoice issue date and today start empty and are set after mount', () => {
  assert.match(source, /const \[issuedISO, setIssuedISO\] = useState\(''\);/);
  assert.match(source, /const \[today, setToday\] = useState\(''\);/);
  assert.match(source, /useEffect\(\(\) => \{\s*const now = new Date\(\)\.toISOString\(\);\s*setToday\(now\);\s*setIssuedISO\(prev => prev \|\| now\);\s*\}, \[\]\);/);
});

test('no clock is read during render for state or the date inputs\' max', () => {
  assert.doesNotMatch(source, /useState\(\(\) => new Date\(/);
  assert.doesNotMatch(source, /max=\{invoiceDateInput\(new Date\(/);
  assert.equal((source.match(/max=\{today \? invoiceDateInput\(today\) : undefined\}/g) ?? []).length, 2);
});

test('the date message and save stay off until today is known', () => {
  assert.match(source, /const entryError = today \? invoiceEntryError\(/);
  assert.match(source, /const valid = !saving && today !== ''/);
});
