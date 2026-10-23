import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w16-09: /home task row icons grow a >=44px hit area without moving', () => {
  const s = read('app/home/page.tsx');
  assert.match(s, /before:-inset-3 before:content-\[''\]/);
  assert.match(s, /before:-inset-\[13px\] before:content-\[''\]/);
  assert.match(s, /textDecoration: 'none', minHeight: 44/);
});

test('w16-09: /invoice remove-item, /contact add-subject, /pitch overview link, tour links, login links', () => {
  assert.match(read('app/invoice/page.tsx'), /before:-inset-3\.5 before:content-\[''\]/);
  assert.match(read('app/contact/page.tsx'), /padding: 0, minHeight: 44/);
  assert.match(read('app/pitch/page.tsx'), /inline-flex', alignItems: 'center', minHeight: 44/);
  for (const f of ['app/funder/page.tsx', 'app/ngo/page.tsx']) {
    assert.match(read(f), /href="\/tour" className="[^"]*min-h-\[44px\]/);
  }
  const login = read('app/login/page.tsx');
  assert.ok((login.match(/minHeight: 44/g) ?? []).length >= 4);
});

test('w16-08: /login notice uses gold-dim and no :root-only faint ink', () => {
  const s = read('app/login/page.tsx');
  assert.doesNotMatch(s, /color-ink-faint/);
  assert.doesNotMatch(s, /color: 'var\(--color-ochre\)'/);
});
