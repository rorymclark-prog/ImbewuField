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

test('w19-41: mentor metric numbers use the display font; due chip outlined; no lone icon', () => {
  const css = read('components/FieldWork.module.css');
  assert.match(css, /\.metric strong \{[^}]*font-family:var\(--font-display\)/);
  assert.match(css, /\.due \{[^}]*border:1px solid var\(--border\)/);
  assert.doesNotMatch(read('components/FieldTeams.tsx'), /<Users size=\{28\}/);
});

test('w19-42: public page polish', () => {
  assert.match(read('app/partners/page.tsx'), /\[text-wrap:balance\] font-display/);
  const c = read('app/contact/page.tsx');
  assert.match(c, /8%, var\(--bg-1\)\)/);
  assert.match(c, /1\.5px solid var\(--color-forest-800\)/);
  assert.doesNotMatch(c, /\+ \{ui\('Add a subject'/);
  assert.match(c, /<Plus size=\{14\}/);
  assert.doesNotMatch(c, /kept on this phone/);
  assert.match(read('app/updates/page.tsx'), /1\.5px solid var\(--color-forest-800\)/);
  const v = read('app/vision/page.tsx');
  assert.match(v, /w-fit mx-auto/);
  assert.match(v, /px-4 rounded-xl text-sm font-sans font-semibold/);
});
