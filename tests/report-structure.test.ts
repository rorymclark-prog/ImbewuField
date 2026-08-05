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
