import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w19-38: short header titles and a title that outlasts the nav', () => {
  assert.match(read('app/ngo/page.tsx'), /title=\{tr\(lang, 'Organisation', 'Inhlangano'\)\}/);
  assert.match(read('app/funder/page.tsx'), /title=\{tr\(lang, 'Funder', 'Umxhasi'\)\}/);
  const h = read('components/layout/AppHeader.tsx');
  assert.match(h, /lg:shrink-0/);
  assert.match(h, /overflow-hidden whitespace-nowrap/);
});

test('w19-39: network stat strip, list column and status colours', () => {
  const n = read('app/network/page.tsx');
  assert.doesNotMatch(n, /padding: '9px 0'/);
  assert.match(n, /paddingBlock: 9/);
  assert.match(n, /thriving: 'var\(--emerald\)'/);
  assert.match(n, /var\(--color-forest-800\)' : 'transparent'/);
  assert.match(n, /flex flex-col min-w-0 flex-1/);
});

test('w19-40: login is honest', () => {
  const l = read('app/login/page.tsx');
  assert.doesNotMatch(l, /!backendReady && \(\s*<p role="status"/);
  assert.doesNotMatch(l, /placeholder=\{t\('login(FullName|EmailAddress|Password)'\)\}/);
  assert.match(read('lib/i18n.tsx'), /kept on this device\./);
});
