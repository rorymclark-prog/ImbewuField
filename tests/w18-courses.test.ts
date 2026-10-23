import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Wave 18 (courses track): source-text guards for w18-19 … w18-26.
const read = (p: string) => readFileSync(p, 'utf8');
const fin = read('components/studies/FinanceCourse.module.css');

test('w18-19: English-source line follows the theme and inherits inside filled buttons', () => {
  assert.doesNotMatch(read('components/studies/DesignDraftCopy.module.css'), /#536257/);
  assert.match(read('components/studies/DesignDraftCopy.module.css'), /color:\s*var\(--text-muted\)/);
  assert.match(fin, /\.actions \.primary small \{[^}]*color: inherit/);
});

test('w18-20: diagrams follow the theme on screen and drop the case id from the title', () => {
  const worked = read('components/studies/DesignWorkedDiagram.tsx');
  assert.doesNotMatch(worked, /caseId\} ·/);
  const workedCss = read('components/studies/DesignWorkedDiagram.module.css');
  const scaleCss = read('components/studies/DesignScalePractice.module.css');
  for (const css of [workedCss, scaleCss]) {
    assert.match(css, /font-family: var\(--font-sans\)/);
    assert.match(css, /html\.dark\) \.diagram/);
    assert.doesNotMatch(css, /background: #F/i);
  }
  assert.match(worked, /plan\.height \+ 86/);
});

test('w18-21..24: course stylesheet link, list, rhythm and header rules', () => {
  assert.match(fin, /\.actions a, \.actions button \{ text-decoration: none/);
  assert.match(fin, /\.card ol \{ list-style: decimal/);
  assert.match(fin, /\.card a \{ display: inline-flex/);
  assert.match(fin, /\.page p \+ p \{ margin-top: 12px/);
  assert.match(fin, /max-width: 72ch/);
  assert.match(fin, /\.actions \+ p \{ margin-top: 10px/);
  assert.match(fin, /\.header \{[^}]*justify-content: flex-start/);
  assert.match(fin, /\.header > :last-child \{ margin-left: auto/);
});

test('w18-25: one preview-card surface', () => {
  const css = read('app/student/Studies.module.css');
  assert.match(css, /\.coursePreviewLink \{[^}]*background: var\(--bg-1\)/);
  assert.match(css, /\.coursePreviewLink:last-child:nth-child\(odd\)/);
});

test('w18-26: no raw record id in the source table; disclosure uses a rotating chevron', () => {
  const tsx = read('components/studies/DesignScalePractice.tsx');
  assert.doesNotMatch(tsx, /<small>\{bed\.reference\}/);
  assert.match(tsx, /ChevronDown/);
  assert.match(read('components/studies/DesignScalePractice.module.css'), /details\[open\] > \.disclosure \.chevron/);
});
