import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-48: contact send button, icon tile and notice follow the theme', () => {
  const src = read('app/contact/page.tsx');
  assert.ok(!src.includes('rgba(32,25,15'), 'fixed ink rgba left');
  assert.match(src, /font-sans font-semibold rounded-xl \$\{motion\.send\}/);
  assert.match(src, /body\.trim\(\) \? 'var\(--color-forest-800\)' : 'var\(--bg-2\)'/);
  assert.match(src, /'1px solid var\(--border\)'/);
  assert.match(src, /borderLeft: '3px solid var\(--border-strong, var\(--border\)\)'/);
});

test('w18-49: login inputs are full opacity and a Connecting line shows', () => {
  const src = read('app/login/page.tsx');
  assert.ok(!src.includes('opacity: backendReady'));
  assert.match(src, /!backendReady && \(\s*<p role="status"[^>]*>\{t\('loginConnecting'\)\}/);
  assert.match(read('components/SampleModeBanner.tsx'), /pathname\.startsWith\('\/login'\)/);
});

test('w18-50: design/lite clears the Tour pill and says device', () => {
  const src = read('app/design/lite/page.tsx');
  assert.match(src, /env\(safe-area-inset-top, 0px\) \+ 56px/);
  assert.ok(!/on this phone|closing on this phone/.test(src.replace(/^\/\/.*$/gm, '')));
});

test('w18-51: pitch deck fits above the control band', () => {
  const src = read('app/pitch/page.tsx');
  assert.match(src, /innerHeight - 24 - 96\) \/ DECK_H/);
  assert.match(src, /padding-bottom: 96px;/);
});

test('w18-52: vision is one centred column until a result exists, no hardcoded green', () => {
  const src = read('app/vision/page.tsx');
  assert.match(src, /className=\{result && !loading \? workspace\.twoColumns : undefined\}/);
  assert.match(src, /maxWidth: 720, marginInline: 'auto'/);
  assert.ok(!src.includes("background: on ? '#1F4D2B'"));
  assert.ok(src.includes("background: on ? 'var(--color-forest-800)'"));
});
