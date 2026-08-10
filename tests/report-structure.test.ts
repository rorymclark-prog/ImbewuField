import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  numberSections,
  buildContents,
  numberFigures,
  buildListOfFigures,
} from '../lib/report-structure';
import { assembleReportDocument } from '../lib/report-assemble';

test('sections number 1, 2, 3 and subsections nest under them', () => {
  const { markdown, headings } = numberSections(
    ['## Water', '### Strategy', '### Calculations', '## Soil', '### Actions'].join('\n'),
  );
  assert.match(markdown, /^## 1\. Water$/m);
  assert.match(markdown, /^### 1\.1 Strategy$/m);
  assert.match(markdown, /^### 1\.2 Calculations$/m);
  assert.match(markdown, /^## 2\. Soil$/m);
  // The subsection counter restarts inside each section rather than running on.
  assert.match(markdown, /^### 2\.1 Actions$/m);
  assert.equal(headings.length, 5);
});

test('front matter takes no number', () => {
  const { markdown } = numberSections(['## Site at a Glance', '## Water'].join('\n'));
  assert.match(markdown, /^## Site at a Glance$/m);
  assert.match(markdown, /^## 1\. Water$/m);
});

test('appendices letter rather than continuing the section count', () => {
  const { markdown } = numberSections(['## Water', '## Appendix — Species list'].join('\n'));
  assert.match(markdown, /^## 1\. Water$/m);
  assert.match(markdown, /^## A\. Appendix — Species list$/m);
  assert.doesNotMatch(markdown, /## 2\. Appendix/);
});

test('a heading inside a fenced block is content, not a section', () => {
  const { markdown, headings } = numberSections(
    ['## Water', '```', '## not a heading', '```', '## Soil'].join('\n'),
  );
  assert.match(markdown, /^## not a heading$/m);
  assert.equal(headings.length, 2);
  assert.match(markdown, /^## 2\. Soil$/m);
});

test('numbering twice does not double-number', () => {
  const once = numberSections('## Water').markdown;
  const twice = numberSections(once).markdown;
  assert.equal(twice, '## 1. Water');
});

test('contents lists what the document contains, not what was requested', () => {
  const { headings } = numberSections(['## Water', '### Strategy'].join('\n'));
  const toc = buildContents(headings);
  assert.match(toc, /## Contents/);
  assert.match(toc, /\*\*1\. Water\*\*/);
  assert.match(toc, /1\.1 Strategy/);
  assert.equal(buildContents([]), '');
});

test('a standalone image becomes a numbered figure with a caption', () => {
  const { markdown, figures } = numberFigures('![The water plan](/a.png)\n\ntext');
  assert.equal(figures.length, 1);
  assert.equal(figures[0], 'Figure 1 — The water plan');
  assert.match(markdown, /_Figure 1 — The water plan_/);
});

test('an inline image inside a sentence is not captioned', () => {
  const { markdown, figures } = numberFigures('See ![x](/a.png) here.');
  assert.equal(figures.length, 0);
  assert.equal(markdown, 'See ![x](/a.png) here.');
});

test('list of figures is empty when the document has none', () => {
  assert.equal(buildListOfFigures([]), '');
  assert.match(buildListOfFigures(['Figure 1 — A']), /## Figures/);
});

test('assembly puts contents after the cover and numbers only the body', () => {
  const out = assembleReportDocument({
    cover: '# Report\n\n## Document control\n\n| a | b |',
    glance: '## Site at a Glance\n\ntable',
    body: ['## Water\n\nbody', '## Soil\n\nbody'],
    backMatter: ['## Risk Register\n\ntable'],
  });
  const lines = out.markdown.split('\n');
  assert.equal(lines[0], '# Report');
  // Cover furniture is never numbered.
  assert.match(out.markdown, /^## Document control$/m);
  assert.match(out.markdown, /^## Site at a Glance$/m);
  // Body and back matter share one continuous sequence.
  assert.match(out.markdown, /^## 1\. Water$/m);
  assert.match(out.markdown, /^## 2\. Soil$/m);
  assert.match(out.markdown, /^## 3\. Risk Register$/m);
  assert.equal(out.sectionCount, 3);
  // Contents sits above the first numbered section.
  assert.ok(out.markdown.indexOf('## Contents') < out.markdown.indexOf('## 1. Water'));
});

test('the document has exactly one h1', () => {
  const out = assembleReportDocument({
    cover: '# Report',
    glance: '## Site at a Glance',
    body: ['## Water'],
    backMatter: [],
  });
  assert.equal(out.markdown.split('\n').filter((l) => /^# /.test(l)).length, 1);
});

test('a heading the model numbered itself is renumbered, not left in place', () => {
  // Found by Codex's report-document audit, and worse than "missing from Contents". A pre-numbered
  // heading was emitted verbatim, contributed no NumberedHeading, and did not advance the counter,
  // so a response containing "## 3. Water Harvesting Design" produced sections running 1, 3, 2 —
  // with the middle one absent from Contents. A reader following a cross-reference to section 2
  // found it printed BELOW section 3.
  const md = ['## Executive Summary', 't', '## 3. Water Harvesting Design', 't', '## Soil Strategy', 't'].join('\n\n');
  const { markdown, headings } = numberSections(md);
  const h2 = markdown.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(h2, ['## 1. Executive Summary', '## 2. Water Harvesting Design', '## 3. Soil Strategy']);
  assert.deepEqual(headings.map((h) => h.number), ['1', '2', '3'], 'every printed section must reach Contents');
});

test('the model imitating the house subsection style is also renumbered', () => {
  // This file emits subsections as "3.1 Title" with NO dot after the number, so a model copying
  // the style writes "9.9 Deep Detail". A pattern that required the trailing dot printed that as
  // "### 3.1 9.9 Deep Detail".
  const md = ['## Soil Strategy', 't', '### 9.9 Deep Detail', 't'].join('\n\n');
  const { markdown } = numberSections(md);
  assert.ok(markdown.includes('### 1.1 Deep Detail'), markdown);
  assert.ok(!markdown.includes('9.9'), 'the model\'s own subsection number survived');
});

test('a title that merely begins with a number keeps its first word', () => {
  // The line this fix must not cross. "5 Year Vision" is a title, not numbering, and eating its
  // first word would be a worse defect than the one being fixed.
  const { markdown } = numberSections('## 5 Year Vision\n\ntext\n');
  assert.ok(markdown.includes('## 1. 5 Year Vision'), markdown);
});

test('Contents lists every numbered section in the document', () => {
  // The invariant behind all of the above: the printed numbering and the Contents page are built
  // from one count, so they cannot disagree.
  const md = ['## A', 't', '## 7. B', 't', '### 2.4 C', 't', '## Appendix: Sources', 't'].join('\n\n');
  const { markdown, headings } = numberSections(md);
  const printed = markdown.split('\n').filter((l) => /^#{2,3}\s/.test(l)).length;
  assert.equal(headings.length, printed, 'a heading was printed that Contents will not list');
});
