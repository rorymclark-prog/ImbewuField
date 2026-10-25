import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Wave 20 Study track (w20-27 … w20-36): source-text guards.
const read = (p: string) => readFileSync(p, 'utf8');
const css = read('components/studies/FinanceCourse.module.css');

test('w20-27: phone main padding keeps the Lima FAB clearance', () => {
  assert.doesNotMatch(css, /\.main \{ padding: 16px 12px 80px/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*\.main \{ padding: 16px 12px var\(--lima-fab-clearance, 100px\)/);
});

test('w20-28: course disclosures use the shared Summary chevron, not the browser triangle', () => {
  const files = ['app/student/design/[lesson]/page.tsx', 'app/student/finance/[lesson]/page.tsx', 'components/studies/CourseSyllabus.tsx', 'components/studies/DesignPortfolio.tsx', 'components/studies/DesignWorkedExample.tsx'];
  for (const f of files) assert.doesNotMatch(read(f), /<summary[ >]/, f);
  const summary = read('components/studies/Summary.tsx');
  assert.match(summary, /ChevronDown/);
  assert.match(read('components/studies/Summary.module.css'), /::-webkit-details-marker \{ display: none/);
});

test('w20-29: action rows are forest and centred', () => {
  const line = css.split('\n').find(l => l.startsWith('.actions a, .actions button { text-decoration'))!;
  assert.match(line, /color: var\(--color-forest-800\)/);
  assert.match(line, /text-align: center/);
});

test('w20-30: design, finance and teach-the-teachers use the shared header', () => {
  for (const f of ['app/student/design/page.tsx', 'app/student/finance/page.tsx', 'app/student/teach-the-teachers/page.tsx']) {
    const src = read(f);
    assert.match(src, /<StudyHeader /, f);
    assert.doesNotMatch(src, /<header className/, f);
  }
  assert.match(read('components/studies/StudyHeader.tsx'), /<AppHeader /);
});

test('w20-31/32: /student and refresher CSS use theme tokens and shared widths', () => {
  const studies = read('app/student/Studies.module.css');
  assert.match(studies, /\.offline \{[^}]*background: var\(--bg-1\)/);
  assert.match(studies, /\.coursePreviewLink strong \{[^}]*font-weight: 400/);
  const r = read('app/student/teach-the-teachers/Refresher.module.css');
  assert.match(r, /\.main \{ width: min\(100%, 1120px\)[^}]*padding: 20px 20px/);
  assert.doesNotMatch(r, /linear-gradient/);
  assert.match(r, /\.eyebrow \{[^}]*color: var\(--text-secondary\)/);
  assert.match(r, /\.panel \.moduleList \{[^}]*padding-left: 2\.25em/);
});

test('w20-33: tips title and Farm Finance link have isiZulu drafts', () => {
  assert.match(read('app/tips/page.tsx'), /<AppHeader title=\{lang === 'zu' \? t\('tipsTitleZuDraft'\)/);
  assert.match(read('app/student/design/page.tsx'), /en="Connect the plan to Farm Finance →" zu=/);
});

test('w20-34/35: diagram toggle is styled with Lucide icons and hidden on phone; checklist is a card with progress', () => {
  assert.match(read('components/studies/DesignWorkedDiagram.tsx'), /Maximize2/);
  assert.match(read('components/studies/DesignWorkedDiagram.module.css'), /@media \(max-width: 760px\) \{ \.controls \{ display: none; \} \}/);
  assert.match(read('components/studies/FinanceReadingChecklist.tsx'), /role="progressbar"/);
  assert.match(css, /\.checklistCard \{[^}]*border-radius: 16px/);
});

test('w20-36: manual headings 400 forest, tour uses ArrowRight 16, typed up-arrow is a Lucide icon', () => {
  const manual = read('app/manual/[lang]/page.tsx');
  assert.doesNotMatch(manual, /fontWeight: 600, color: 'var\(--text-primary\)', margin: '(0 0 8px|8px 0 12px)'/);
  assert.match(manual, /fontWeight: 400, color: 'var\(--color-forest-800\)'/);
  const tour = read('app/tour/page.tsx');
  assert.doesNotMatch(tour, /ArrowUpRight/);
  assert.match(tour, /<ArrowRight size=\{16\}/);
  assert.match(read('components/studies/ArrowLabel.tsx'), /ArrowUp\b/);
});
