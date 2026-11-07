import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Wave 19 (study track): source-text guards for w19-27 … w19-37.
const read = (p: string) => readFileSync(p, 'utf8');
const fin = read('components/studies/FinanceCourse.module.css');
const ref = read('app/student/teach-the-teachers/Refresher.module.css');
const diagramCss = read('components/studies/DesignWorkedDiagram.module.css');
const diagram = read('components/studies/DesignWorkedDiagram.tsx');
const studies = read('app/student/Studies.module.css');

test('w19-27/28: diagram keeps its size on phones, no blanket invert, 22px legend rows', () => {
  assert.match(diagramCss, /@media \(max-width: 760px\) \{\s*\.diagram \{ min-width: 720px; \}/);
  assert.doesNotMatch(diagramCss, /invert\(/);
  assert.match(diagramCss, /html\.dark\) \.diagram \.plan \{ fill: var\(--bg-2\)/);
  assert.match(diagramCss, /html\.dark\) \.diagram \.legendPanel/);
  for (const y of [36, 58, 80, 102, 124, 146, 168]) assert.match(diagram, new RegExp(`(<rect|<circle)[^>]* (y|cy)="(${y}|${y + 7})"`));
});

test('w19-29: course notice summaries carry a rotating Lucide chevron', () => {
  for (const p of ['app/student/design/page.tsx', 'app/student/finance/page.tsx', 'app/student/teach-the-teachers/page.tsx']) {
    assert.match(read(p), /<summary>(?:More|<(?:T|Tx) en="More" \/>|\{[^}]*'More'[^}]*\})<ChevronDown className=\{styles\.chevron\}/, p);
  }
  assert.match(fin, /\.notice details\[open\] > summary \.chevron \{ transform: rotate\(180deg\)/);
  assert.match(ref, /\.notice details\[open\] > summary \.chevron \{ transform: rotate\(180deg\)/);
});

test('w19-30: finance header labels are header-secondary', () => {
  // w20-30 moved the overview onto the shared AppHeader, whose title span is the header label.
  assert.match(read('app/student/finance/page.tsx'), /<StudyHeader title="Farm Finance"/);
  assert.match(read('app/student/finance/[lesson]/page.tsx'), /<span data-header-secondary>\{lesson\.code\}/);
});

test('w19-31: refresher lists, header and weights', () => {
  assert.match(ref, /\.panel ol \{ list-style: decimal; padding-left: 1\.5em; margin: 12px 0 16px; \}/);
  assert.match(ref, /\.moduleList \{ margin-top: 12px;/);
  // w20-30: the refresher's own .header bar gave way to the shared StudyHeader.
  assert.match(read('app/student/teach-the-teachers/page.tsx'), /<StudyHeader title="Facilitator refresher"/);
  assert.match(ref, /font: 400 clamp\(32px/);
  assert.match(ref, /font: 400 clamp\(25px/);
});

test('w19-32: every course card uses the same surface', () => {
  assert.doesNotMatch(studies, /\.(intro|primaryCourse|courseDisclosure)[^{]*\{[^}]*color-mix\(in srgb, var\(--color-forest-800\) 6%/);
  assert.match(studies, /\.coursePreviewLink\[href\$="teach-the-teachers"\]::before/);
});

test('w19-33: tips use the shared grid, card and Tour action link', () => {
  const tips = read('app/tips/page.tsx');
  assert.match(tips, /className=\{styles\.grid\}/);
  assert.match(tips, /styles\.card/);
  assert.match(tips, /className=\{tour\.action\}/);
  assert.match(tips, /<ArrowRight/);
  assert.doesNotMatch(tips, /\{copy\.action\} →/);
});

test('w19-34: manual header is the shared AppHeader', () => {
  assert.match(read('components/manual/ManualHeader.tsx'), /<AppHeader title=\{label\}/);
});

test('w19-35: balanced headings, one action size and weight', () => {
  assert.match(fin, /\.page h1, \.page h2, \.page h3, \.page h4 \{[^}]*text-wrap: balance/);
  assert.match(read('components/ProductTour.module.css'), /\.page h1\{[^}]*text-wrap:balance\}/);
  assert.match(fin, /\.actions a, \.actions button \{[^}]*font-size: 16px; font-weight: 600/);
  assert.doesNotMatch(fin, /\.actions \.primary \{[^}]*font-size/);
});

test('w19-36: list indent, even rhythm, 72ch captions', () => {
  assert.match(fin, /\.card ol \{ list-style: decimal; padding-left: 2\.25em/);
  assert.match(fin, /\.card li \{ padding: 0; \}/);
  assert.match(fin, /\.answerField > span \{ max-width: 72ch/);
  assert.match(diagramCss, /\.caption \{\s*max-width: 72ch/);
});

test('w19-37: English notice is hidden in isiZulu; source line is sans 400', () => {
  // The strong text may sit inside <Tx en="…" /> (isiXhosa draft lookup); the English is unchanged.
  assert.match(read('app/student/design/page.tsx'), /<EnglishOnly><aside[^>]*><p><strong>(?:<Tx en=")?English teaching preview/);
  assert.match(read('components/studies/DesignDraftCopy.module.css'), /\.source \{[^}]*font-family:var\(--font-sans\)[^}]*font-weight:400/);
});
