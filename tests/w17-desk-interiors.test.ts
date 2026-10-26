import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('components/MelDashboard.module.css', 'utf8');
const journal = readFileSync('components/journal/FieldJournal.tsx', 'utf8');

test('w17-06 MEL: lg+ assessment cards auto-fit and bar tracks are capped', () => {
  const m = css.match(/@media\(min-width:1024px\) \{([^}]*\{[^}]*\}[^}]*)\}/);
  assert.ok(m, 'lg+ block present');
  assert.match(m![1], /\.assessmentCards \{ grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,20rem\),1fr\)\)/);
  assert.match(m![1], /\.coverageTrack, \.assessmentText \.bar \{ max-width:480px/);
});

test('w17-06 MEL: phone rules still collapse cards to one column', () => {
  assert.match(css, /\.overviewPanels,\.assessmentCards \{ grid-template-columns:1fr; \}/);
});

test('w17-06 journal: filters and categories live in the sidebar aside', () => {
  const aside = journal.slice(journal.indexOf('<aside'), journal.indexOf('</aside>'));
  assert.match(aside, /Categories/);
  assert.match(aside, /setFilter\('all'\)/);
});
