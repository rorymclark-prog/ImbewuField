import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const mel = read('components/MelDashboard.module.css');
const sample = read('components/SampleExperience.module.css');

test('w18-01: /samples header and tab bar sit outside the padded scroller', () => {
  const page = read('app/samples/page.tsx');
  assert.match(page, /<main className=\{styles\.shell\}><AppHeader/);
  assert.match(page, /styles\.root} \$\{styles\.scroller/);
  assert.doesNotMatch(page, /padding:20 \}/);
  assert.match(mel, /\.shell \{[^}]*height:100dvh/);
});

test('w18-02: file inputs never render natively on sample pages', () => {
  assert.match(sample, /input:not\(\[type=checkbox\]\):not\(\[type=file\]\)/);
  assert.match(sample, /\.page input\[type=file\] \{ display:none; \}/);
});

test('w18-03/04: primary actions are styled for links and use theme tokens', () => {
  assert.match(mel, /\.root :is\(button,a\)\.primary/);
  assert.match(mel, /\.hero \{ background:var\(--color-forest-800\); color:var\(--on-forest-800\)/);
  assert.match(mel, /\.sampleCard > svg \{ color:var\(--emerald\)/);
  assert.doesNotMatch(mel, /#245739|#214d35/);
});

test('w18-05: production page has one back control', () => {
  assert.match(read('lib/back-routes.ts'), /'\/samples\/production'/);
  assert.match(read('app/samples/production/ProductionExample.module.css'), /\.heroActions a \{ display:inline-flex/);
});

test('w18-06/07/08: sample pages, gardens grid and feedback', () => {
  assert.match(sample, /\.page p a,\.page a\.link \{ text-decoration:underline/);
  assert.match(sample, /\.grid > \.card \{ margin:0/);
  assert.match(sample, /html\.dark\) \.page \{ color-scheme:dark/);
  const fb = read('app/feedback/page.tsx');
  assert.match(fb, /useState\(''\)/);
  assert.match(fb, /path:path\.trim\(\)\|\|'\/'/);
  assert.ok(fb.indexOf('<AppHeader') < fb.indexOf('styles.wrap'));
  assert.match(read('app/samples/farm/page.tsx'), /aria-label=\{ui\('15-minute tour'/);
});

test('w18-09/10/11: MEL tiles, labels and one disclosure pattern', () => {
  assert.match(mel, /\.stat \{ font-family:var\(--font-display\)/);
  assert.match(mel, /\.root details > summary::after/);
  assert.doesNotMatch(mel, /\.guide > summary \{ color:var\(--emerald\)/);
  const o = read('components/MelOverview.tsx');
  assert.match(o, /Not opened yet/);
  assert.match(o, /draft: 'Draft'/);
  assert.match(o, /recordsMonthShort/);
});
