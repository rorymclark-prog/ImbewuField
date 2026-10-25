import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');
const prod = read('app/samples/production/ProductionExample.module.css');
const mel = read('components/MelDashboard.module.css');
const sample = read('components/SampleExperience.module.css');

test('w19-16/17: production nav has no leftover MenuButton padding, themed CTA, plain copy', () => {
  assert.doesNotMatch(prod, /padding:22px 0 22px 56px/);
  assert.doesNotMatch(prod, /padding-left:78px/);
  assert.match(prod, /\.printLabel \{ display:none; \}/);
  assert.match(prod, /\.primary \{[^}]*background:var\(--color-forest-800\); color:var\(--on-forest-800\)/);
  const page = read('app/samples/production/page.tsx');
  assert.match(page, /aria-label="Print this plan"/);
  assert.match(page, /This example plan runs from November 2026\./);
  assert.doesNotMatch(page, /screen, paper and tests/);
});

test('w19-18: mini plate reads CSS variables and the report preview sets them', () => {
  assert.match(read('components/MiniPlanPlate.tsx'), /var\(--mini-plate-bg, #F6F1E6\)/);
  assert.match(read('components/report/SiteCropPlanPreview.module.css'), /--mini-plate-bg:var\(--bg-1\)/);
  assert.match(read('app/reports/page.tsx'), /place\.lat\)\.toFixed\(2\)/);
});

test('w19-19: MEL hero is not a lime slab in dark; notice is neutral with blue rule', () => {
  assert.match(mel, /:global\(html\.dark\) \.hero \{ background:var\(--bg-2\); color:var\(--text-primary\); border:1px solid var\(--border\)/);
  assert.match(mel, /\.notice \{[^}]*border-left:3px solid var\(--blue\)/);
  assert.match(mel, /\.notice::before/);
});

test('w19-20/21/22: one Tour control, one radius, Lucide arrows, even gaps', () => {
  assert.doesNotMatch(read('app/samples/farm/page.tsx'), /right=\{<Link href="\/tour"/);
  assert.doesNotMatch(read('app/samples/farm/page.tsx'), /styles\.button\} \$\{styles\.primary\}/);
  // w20-17 deliberately moved the page buttons to the shared 999px pill, scoped to .content.
  assert.match(sample, /\.content button,\.button \{[^}]*border-radius:999px/);
  assert.doesNotMatch(read('app/samples/page.tsx'), /→/);
  assert.doesNotMatch(read('app/samples/gardens/page.tsx'), /→/);
  assert.match(sample, /\.grid > label \{ margin:0; \}/);
  assert.match(sample, /text-wrap:balance/);
  assert.match(sample, /\.page \.filter select/);
});

test('w19-23/24: Atlas title, sans body text, farmer-facing feedback label', () => {
  assert.match(read('app/atlas/page.tsx'), /<AppHeader title="Atlas" \/>/);
  assert.doesNotMatch(read('app/example/page.tsx'), /rounded-full font-display/);
  const fb = read('app/feedback/page.tsx');
  assert.match(fb, /Which screen\? \(optional\)/);
  assert.doesNotMatch(fb, /placeholder="\/mentor"/);
  assert.doesNotMatch(read('app/surveys/page.tsx'), /localUi\('Sample data', 'Idatha yesibonelo', lang\)/);
});

test('w19-25/26: MEL headings weight 600, display figure, lite page tokens', () => {
  assert.match(mel, /\.root h2 \{[^}]*font-weight:600/);
  assert.match(mel, /\.coverageValue > strong \{ font-family:var\(--font-display\)/);
  const lite = read('app/design/lite/page.tsx');
  assert.doesNotMatch(lite, /linear-gradient\(135deg, #1F4D2B/);
  assert.match(lite, /var\(--color-forest-800\)/);
  assert.doesNotMatch(lite, /phone with more free memory/);
});
