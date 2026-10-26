import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w24-05: the wholesale card text flips with its forest fill', () => {
  const src = read('components/prices/CropPriceGuide.tsx');
  assert.match(src, /fontSize: 54, color: 'var\(--on-forest-800\)'/);
  assert.doesNotMatch(src, /rgba\(247,242,233/);
  assert.equal((src.match(/color-mix\(in srgb, var\(--on-forest-800\) 88%, transparent\)/g) ?? []).length, 2);
});

test('w24-06: the practice note uses theme tokens and message meta is secondary text', () => {
  const src = read('components/ContactInbox.tsx');
  assert.doesNotMatch(src, /var\(--info\)|var\(--info-soft\)/);
  assert.match(src, /color-mix\(in srgb, var\(--blue\) 12%, var\(--bg-1\)\)', color: 'var\(--text-primary\)'/);
  assert.match(src, /fontSize: 12, color: 'var\(--text-secondary\)' \}\}>\s*\{formatDate/);
  assert.match(src, /color: 'var\(--text-secondary\)' \}\}>\s*\{msg\.subject/);
});

test('w24-07: the Lima panel tag is ink, not emerald, on its tint', () => {
  assert.match(read('components/SampleLimaConversation.tsx'), /styles\.tag\} style=\{\{color:'var\(--text-primary\)'\}\}/);
});

test('w24-08: the demo sample chip text is --gold-dim', () => {
  const src = read('components/NgoDashboard.tsx');
  assert.match(src, /color: 'var\(--gold-dim\)', border: '1px solid rgba\(158,92,8,0\.3\)'/);
});
