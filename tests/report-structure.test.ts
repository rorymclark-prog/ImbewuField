import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import {
  numberSections,
  buildContents,
  numberFigures,
  buildListOfFigures,
  ensureDocumentArchitecture,
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

// ── Old saved reports get the architecture at export time ────────────────────
//
// Rory, of a PDF exported on 11 August: "does it have the new layout yet?" It did not — 28 pages,
// no contents page, no section numbers. Nothing was broken in the assembler; his report markdown
// had simply been generated before the assembler existed, and a saved report keeps its original
// text forever. So the export applies the architecture too.

test('a flat saved report gains contents and numbering when exported', () => {
  const flat = [
    '# Permaculture Site Report',
    'Zululand Lowveld · Nongoma',
    '',
    '## Executive Summary',
    'This 0.39 ha site sits on a south-facing slope.',
    '',
    '## Water Harvesting',
    'Install gutters on the 67 m² roof.',
    '',
    '### Calculations',
    'Roof catchment yield: 67 m² x 768 mm.',
  ].join('\n');
  const out = ensureDocumentArchitecture(flat);
  assert.match(out, /^##\s+Contents$/m, 'no contents page was built');
  assert.match(out, /##\s+1\.\s+Executive Summary/, 'sections are still unnumbered');
  assert.match(out, /##\s+2\.\s+Water Harvesting/);
  assert.match(out, /###\s+2\.1\s+Calculations/, 'subsections are still unnumbered');
  // Contents lists what the body actually carries, in order.
  const contents = out.slice(out.indexOf('## Contents'), out.indexOf('## 1.'));
  assert.ok(contents.includes('Executive Summary') && contents.includes('Water Harvesting'));
  // Front matter sits AFTER the title block — a contents page above the title reads as a contents
  // page for nothing.
  assert.ok(out.indexOf('# Permaculture Site Report') < out.indexOf('## Contents'));
  assert.ok(out.indexOf('Zululand Lowveld · Nongoma') < out.indexOf('## Contents'),
    'the title\'s own subtitle line was separated from it');
});

test('a report that already has the architecture is returned untouched', () => {
  // Running the numberer twice would renumber already-numbered headings — the exact defect
  // stripLeadingNumber exists to undo. Byte-for-byte, not merely "looks similar".
  const structured = [
    '# Permaculture Site Report',
    '',
    '## Contents',
    '',
    '**1. Executive Summary**  ',
    '',
    '## 1. Executive Summary',
    'Body.',
  ].join('\n');
  assert.equal(ensureDocumentArchitecture(structured), structured);
});

test('the architecture is applied by the PDF export itself, not only at generation', () => {
  const pdf = readFileSync(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8');
  assert.match(pdf, /ensureDocumentArchitecture\(rawMarkdown\)/,
    'the PDF exports whatever markdown it is handed again — old saved reports lose the layout');
  // It must run BEFORE parsing, or the blocks are built from the unstructured text.
  assert.ok(pdf.indexOf('ensureDocumentArchitecture(rawMarkdown)') < pdf.indexOf('parseReportMarkdown(markdown)'),
    'the architecture is applied after the markdown has already been parsed');
});

test('empty and heading-less reports are left alone rather than half-built', () => {
  assert.equal(ensureDocumentArchitecture(''), '');
  assert.equal(ensureDocumentArchitecture('   '), '   ');
  const prose = 'Just a paragraph with no headings at all.';
  assert.equal(ensureDocumentArchitecture(prose), prose, 'a contents page of nothing is worse than none');
});
