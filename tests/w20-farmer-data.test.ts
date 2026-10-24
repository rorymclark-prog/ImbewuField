import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w20-09 DataPanel completeness card uses the themed surface', () => {
  assert.match(read('components/DataPanel.tsx'), /<CompletionScore surface /);
});

test('w20-10 DataPanel tabs wrap, sans, no hidden scrollbar', () => {
  const s = read('components/DataPanel.tsx');
  const i = s.indexOf('Tabs (wrap so all are always visible)');
  const block = s.slice(i, i + 1800);
  assert.match(block, /flex flex-wrap/);
  assert.doesNotMatch(block, /scrollbarWidth/);
  assert.doesNotMatch(block, /var\(--font-display\)/);
});

test('w20-11 NextStepCoach uses theme tokens, no fixed greens', () => {
  const s = read('components/NextStepCoach.tsx');
  assert.doesNotMatch(s, /#1F4D2B|#C07A1E|#F7C97E/);
  assert.match(s, /var\(--on-forest-800\)/);
});

test('w20-12/15 records controls are sans, Invoice pill is secondary', () => {
  for (const f of ['components/MyRecords.tsx', 'components/CropSelect.tsx']) {
    assert.doesNotMatch(read(f), /(<input|<select|<button|dark-input)[^\n]*font-display/);
  }
  const r = read('app/records/page.tsx');
  assert.doesNotMatch(r, /rgba\(192,122,30,0\.12\)[^\n]*record-negative/);
});

test('w20-13/14 MyRecords card and sparklines follow the theme', () => {
  const s = read('components/MyRecords.tsx');
  assert.doesNotMatch(s, /var\(--color-surface\)', color: 'var\(--color-ink\)'/);
  assert.doesNotMatch(s, /<polyline[^\n]*(#1F4D2B|#C07A1E|rgba\(31,77,43|rgba\(192,122,30)/);
});

test('w20-26 Crèche spelling in demo data', () => {
  assert.match(read('lib/demo-farm.ts'), /Ubhejane Crèche/);
  assert.doesNotMatch(read('lib/demo-farm.ts'), /Ubhejane Creche'/);
});
