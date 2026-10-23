import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');
const mel = read('components/MelDashboard.module.css');
const sample = read('components/SampleExperience.module.css');
const prod = read('app/samples/production/ProductionExample.module.css');
const programme = read('components/SampleProgramme.tsx');

test('w20-16: dark hero rule only applies on desktop so the phone reset wins', () => {
  assert.match(mel, /@media\(min-width:651px\) \{ :global\(html\.dark\) \.hero \{/);
});

test('w20-17: sample page buttons are scoped to .content, pill, 600, MEL-style notice', () => {
  assert.doesNotMatch(sample, /\.page button/);
  assert.match(sample, /\.content button,\.button \{[^}]*border-radius:999px[^}]*font-weight:600/);
  assert.match(sample, /\.notice::before/);
});

test('w20-18: production page uses forest-800 tokens and gold, 120px phone labels', () => {
  assert.doesNotMatch(prod, /var\(--brand|#426a38|#cfa44a|var\(--on-forest\)/);
  assert.match(prod, /inset 0 -4px var\(--gold\)/);
  assert.match(prod, /thead th:first-child \{ width:120px/);
  assert.match(prod, /\.productLabel img \{ width:24px; height:24px; \}/);
});

test('w20-19: toggle above metrics, one accordion style, compact card', () => {
  assert.ok(programme.indexOf('Organisation view') < programme.indexOf('<MelMetrics metrics={analyseAssessment'));
  assert.match(mel, /\.about \{[^}]*border-radius:16px/);
  assert.match(mel, /\.compact \{[^}]*border-radius:16px/);
  assert.match(mel, /@media\(max-width:480px\) \{ \.compact \{ flex-direction:column/);
});

test('w20-20: zero-answer metrics show an empty state', () => {
  assert.match(read('components/MelDashboard.tsx'), /m\.n === 0 \?[^]*No answers yet/);
});

test('w20-21: reports drops the 720px cap and the repeated heading', () => {
  const reports = read('app/reports/page.tsx');
  assert.doesNotMatch(reports, /maxWidth: 720/);
  assert.doesNotMatch(reports, /<h2>\{t\('reportsSavedSites'\)\}<\/h2>/);
});

test('w20-22: filled selected tab, chip row gaps', () => {
  assert.doesNotMatch(mel, /button\[aria-pressed=true\] \{ box-shadow/);
  assert.match(mel, /\.root button\[aria-pressed=true\] \{ background:var\(--badge-bg\)/);
  assert.match(mel, /\.row \{[^}]*row-gap:6px/);
  assert.match(mel, /\.row p \{ margin:8px 0; \}/);
});

test('w20-23/24: design picker uses AppHeader + ArrowRight; Learn uses the chip tone', () => {
  const design = read('app/design/page.tsx');
  assert.doesNotMatch(design, /'Klama →'|'Design →'/);
  assert.match(design, /<AppHeader title=\{isZulu \? 'Isitudiyo Sokuklama'/);
  assert.match(read('app/surveys/page.tsx'), /tone="chip"/);
  assert.match(read('app/assessments/page.tsx'), /tone="chip"/);
});

test('w20-25: feedback is a 640px/65ch form and MEL buttons share the pill radius', () => {
  assert.match(sample, /\.narrow \{ max-width:640px; \}/);
  assert.match(sample, /\.narrow p \{ max-width:65ch; \}/);
  assert.match(read('app/feedback/page.tsx'), /styles\.narrow/);
  assert.match(mel, /\.root button,\.root :is\(button,a\)\.primary,\.root :is\(button,a\)\.secondary \{ border-radius:999px; \}/);
});
