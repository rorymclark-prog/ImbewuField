/**
 * report-assemble.ts — puts the document together in the one order it can be right in.
 *
 * ORDER MATTERS AND IS NOT OBVIOUS, so it lives here rather than inline in the API route:
 *
 *   1. Concatenate cover → glance table → generated sections → back matter. Nothing is numbered
 *      yet, because a batch that failed contributes a placeholder and no heading, and numbering
 *      before you know what actually arrived produces a contents page that lists a section the
 *      document does not contain.
 *   2. Number the figures. Before the sections, because a figure caption is not a heading and
 *      must not be swept into the section counter.
 *   3. Number the sections. This is also where the heading list for the contents comes from —
 *      derived from the FINAL text, never from the list of sections that were requested.
 *   4. Insert Contents and Figures immediately after the cover. Last, because both are built
 *      from the numbering that step 3 produced.
 *
 * Pure and DOM-free: this can be checked without an API key, a model, or a browser.
 */

import {
  numberSections,
  buildContents,
  numberFigures,
  buildListOfFigures,
} from '@/lib/report-structure';

export interface AssembleInput {
  language?: string;
  /** Cover page + document control. Owns the document's only `# ` heading. */
  cover: string;
  /** The code-authored Site at a Glance table (no title — see ReportHeaderInput.omitTitle). */
  glance: string;
  /** Generated section batches, in order. */
  body: string[];
  /** Code-authored closing sections: BOQ, monitoring, risk, assurance. */
  backMatter: string[];
}

export interface AssembledReport {
  markdown: string;
  /** How many `##` sections the finished document actually carries. */
  sectionCount: number;
  figureCount: number;
}

function joinBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trimEnd())
    .filter((block) => block.length > 0)
    .join('\n\n');
}

export function assembleReportDocument(input: AssembleInput): AssembledReport {
  const bodyAndBack = joinBlocks([input.glance, ...input.body, ...input.backMatter]);

  // 2 — figures first, so a caption never lands in the section counter.
  const figured = numberFigures(bodyAndBack);
  // 3 — then sections, which also yields the heading list the contents needs.
  const numbered = numberSections(figured.markdown);

  const contents = buildContents(numbered.headings).replace('## Contents', input.language === 'zu' ? '## Okuqukethwe' : '## Contents');
  const figuresList = buildListOfFigures(figured.figures);

  // 4 — front matter goes in only now, and is itself never numbered (see UNNUMBERED_TITLES).
  const markdown = joinBlocks([input.cover, contents, figuresList, numbered.markdown]);

  return {
    markdown: `${markdown}\n`,
    sectionCount: numbered.headings.filter((h) => h.level === 2).length,
    figureCount: figured.figures.length,
  };
}
