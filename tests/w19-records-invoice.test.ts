import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('w19-10 records and invoice hide the TabBar at desktop', () => {
  assert.match(read('app/records/page.tsx'), /<TabBar hideAtDesktop \/>/);
  assert.match(read('app/invoice/page.tsx'), /<TabBar hideAtDesktop \/>/);
});

test('w19-11 Picked wrapper is a plain div, full width on desktop', () => {
  const s = read('app/records/page.tsx');
  assert.doesNotMatch(s, /lg:max-w-\[640px\]/);
  assert.doesNotMatch(s, /className=\{tab === 'sold' \? 'lg:hidden' : undefined\}\s*style=\{\{ background: 'var\(--color-surface\)'/);
});

test('w19-12 on-screen money uses a no-break space; the PDF formatter keeps a plain space', () => {
  const s = read('app/records/page.tsx');
  assert.match(s, /const fmtZAR = \(n: number\): string => formatInvoiceZar\(n\)\.replace\(\/ \/g, '\\u00A0'\)/);
  assert.match(s, /font-display font-bold text-sm leading-tight whitespace-nowrap/);
  assert.match(s, /break-words/);
  assert.ok(!/\u00a0/.test(read('lib/invoice-document.ts')));
});

test('w19-13 /invoice uses LimaBar in flow and the FAB is hidden there', () => {
  const w = read('components/ChatWidget.tsx');
  assert.equal(w.match(/pathname\.startsWith\('\/invoice'\) \|\|/g)?.length, 2);
  assert.match(read('app/invoice/page.tsx'), /<LimaBar \/>/);
});

test('w19-14 invoice controls are sans, not Newsreader', () => {
  const s = read('app/invoice/page.tsx');
  assert.match(s, /const FIELD = \{ fontFamily: 'var\(--font-sans\)'/);
  for (const line of s.split('\n')) {
    if (/outline-none|<button|min-h-11 py-3/.test(line)) assert.doesNotMatch(line, /font-display/, line.trim().slice(0, 80));
  }
});

test('w19-15 Share PDF and Print appear once, at the bottom', () => {
  const s = read('app/invoice/page.tsx');
  assert.equal(s.match(/onClick=\{shareInvoice\}/g)?.length, 1);
  assert.equal(s.match(/onClick=\{printInvoice\}/g)?.length, 1);
});
