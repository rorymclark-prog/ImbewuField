import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-35 closed ThemePanel has no shadow and is hidden', () => {
  const s = read('components/ThemePanel.tsx');
  assert.match(s, /boxShadow: open \? '-8px 0 32px rgba\(0,0,0,0\.2\)' : 'none'/);
  assert.match(s, /visibility: open \? 'visible' : 'hidden'/);
});

test('w18-36 records inputs follow the theme tokens without !important', () => {
  const s = read('app/records/Records.module.css');
  const line = s.split('\n').find(l => l.includes(':global(input), .page :global(select)')) ?? '';
  assert.match(line, /background: var\(--bg-1\)/);
  assert.match(line, /color: var\(--text-primary\)/);
  assert.doesNotMatch(line, /!important|#fffdf7|#302c24/);
  assert.match(s, /::placeholder[^}]*var\(--text-muted\)/);
});

test('w18-37 lender figures never break mid-number; both buttons are sans', () => {
  const s = read('components/MyRecords.tsx');
  assert.match(s, /grid grid-cols-1 min-\[420px\]:grid-cols-3 gap-2 my-3/);
  assert.match(s, /font-display text-lg mt-1 whitespace-nowrap tabular-nums/);
  assert.match(s, /py-2 rounded-xl text-xs font-sans font-semibold flex items-center justify-center gap-2 transition-all/);
});

test('w18-38 Picked keeps the summary cards on desktop and caps the form', () => {
  const s = read('app/records/page.tsx');
  assert.match(s, /className=\{tab === 'picked' \? undefined : 'lg:hidden'\}/);
  assert.match(s, /tab === 'picked' \? ' lg:max-w-\[640px\]'/);
});

test('w18-39 kg quantities use the shared kg formatter', () => {
  const s = read('lib/records-regional-drafts.ts');
  assert.match(s, /unit === 'kg'\) return kgPreciseLabel\(quantity\)/);
});
