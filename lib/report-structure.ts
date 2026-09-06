/**
 * report-structure.ts — turns a pile of markdown sections into a DOCUMENT.
 *
 * The report already had good content and no architecture: no cover, no contents, no section
 * numbers, no figure captions. That is the difference between a long answer and a report someone
 * can cite a page of in a meeting ("see 4.2").
 *
 * Everything here is a PURE STRING TRANSFORM applied once, server-side, after every generated
 * batch has landed and before the document is streamed. It never asks a model for a heading
 * number, because numbering is arithmetic and a model doing arithmetic across seven independent
 * batches — none of which can see the others — cannot be right by construction.
 *
 * Fenced code blocks are skipped throughout: a `## ` inside a fence is content, not a heading.
 */

/** Headings that are front matter and take no number. Compared case-insensitively. */
const UNNUMBERED_TITLES = new Set([
  'contents',
  'document control',
  'site at a glance',
  'indawo kafushane',
  'okuqukethwe',
]);

function isFenceToggle(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

function headingLevel(line: string): 0 | 1 | 2 | 3 {
  const m = /^(#{1,3})\s+/.exec(line);
  if (!m) return 0;
  return m[1].length as 1 | 2 | 3;
}

function headingText(line: string): string {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

/**
 * Drop a leading "3. ", "1.2. " or "A. " that a model put on a heading.
 *
 * This used to be `alreadyNumbered`, a predicate that caused such a heading to be passed through
 * untouched — which was how a section ended up out of sequence and missing from Contents. Removing
 * the number instead lets the normal pass below assign the right one, so the printed numbering and
 * the Contents page are always built from the same count.
 */
export function stripLeadingNumber(text: string): string {
  // A trailing dot is optional ONLY for a multi-part number, because this file's own subsection
  // format is "3.1 Title" with no dot after it — so a model imitating the house style writes
  // "9.9 Deep Detail" and the stricter pattern left it to be printed as "3.1 9.9 Deep Detail".
  //
  // A bare "5 " is deliberately NOT stripped. "5 Year Vision" and "2026 Planting Plan" are titles,
  // not numbering, and quietly eating their first word would be a worse defect than the one this
  // is fixing.
  return text.replace(/^(?:\d+(?:\.\d+)+\.?|\d+\.|[A-Z]\.)\s+/, '').trim();
}

function isAppendix(text: string): boolean {
  return /^appendix\b/i.test(text);
}

function isUnnumbered(text: string): boolean {
  return UNNUMBERED_TITLES.has(text.toLowerCase().replace(/[—–-].*$/, '').trim())
    || UNNUMBERED_TITLES.has(text.toLowerCase());
}

export interface NumberedHeading {
  /** "4", "4.2", "A" — the printed label, or '' for an unnumbered front-matter heading. */
  number: string;
  /** The heading text WITHOUT its number. */
  title: string;
  level: 2 | 3;
}

export interface NumberingResult {
  markdown: string;
  headings: NumberedHeading[];
}

/**
 * Number every `##` as 1, 2, 3… and every `###` beneath it as 1.1, 1.2…
 *
 * Appendices number as A, B, C and restart no counter — an appendix is not section 12.
 */
export function numberSections(markdown: string): NumberingResult {
  const lines = markdown.split('\n');
  const out: string[] = [];
  const headings: NumberedHeading[] = [];
  let inFence = false;
  let section = 0;
  let sub = 0;
  let appendix = 0;

  for (const line of lines) {
    if (isFenceToggle(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    const level = inFence ? 0 : headingLevel(line);
    if (level !== 2 && level !== 3) {
      out.push(line);
      continue;
    }

    // Model-supplied numbering is DISCARDED, not honoured. Leaving it in place emitted the
    // heading verbatim, pushed no NumberedHeading, and skipped the counter — so a response
    // containing "## 3. Water Harvesting Design" produced a document whose sections ran 1, 3, 2,
    // with the middle one absent from Contents entirely. A reader following a cross-reference to
    // section 2 found it printed below section 3.
    //
    // The model cannot know a section's final position: batches are generated in parallel, any of
    // them can fail and ship a placeholder instead of a heading, and the requested set varies by
    // report length. Only this pass knows the order, so only this pass numbers.
    const title = stripLeadingNumber(headingText(line));
    if (isUnnumbered(title)) {
      out.push(`${'#'.repeat(level)} ${title}`);
      continue;
    }

    if (level === 2) {
      if (isAppendix(title)) {
        const label = String.fromCharCode(65 + appendix);
        appendix += 1;
        sub = 0;
        out.push(`## ${label}. ${title}`);
        headings.push({ number: label, title, level: 2 });
        continue;
      }
      section += 1;
      sub = 0;
      out.push(`## ${section}. ${title}`);
      headings.push({ number: String(section), title, level: 2 });
      continue;
    }

    // level 3 — a subsection before any section is left unnumbered rather than
    // invented as "0.1".
    if (section === 0 && appendix === 0) {
      out.push(line);
      continue;
    }
    sub += 1;
    const parent = appendix > 0 && section === 0
      ? String.fromCharCode(64 + appendix)
      : String(section);
    const label = `${parent}.${sub}`;
    out.push(`### ${label} ${title}`);
    headings.push({ number: label, title, level: 3 });
  }

  return { markdown: out.join('\n'), headings };
}

/**
 * A contents block from already-numbered headings.
 *
 * Built from the FINAL document rather than from the list of sections that were requested,
 * because those are not the same thing: a batch that fails ships a placeholder instead of its
 * heading, and a contents page listing a section the document does not contain is worse than
 * no contents page at all.
 */
export function buildContents(headings: NumberedHeading[]): string {
  if (!headings.length) return '';
  const out: string[] = ['## Contents', ''];
  for (const h of headings) {
    if (h.level === 2) out.push(`**${h.number}. ${h.title}**  `);
    else out.push(`  ${h.number} ${h.title}  `);
  }
  out.push('');
  return out.join('\n');
}

export interface FigureResult {
  markdown: string;
  /** Captions in document order, for the list of figures. */
  figures: string[];
}

/**
 * Caption every image as "Figure N — <alt text>" and return the captions.
 *
 * A map printed without a number cannot be referred to from the text, which is the whole reason
 * a report has figures rather than pictures. Images whose alt text is empty are still numbered —
 * an uncaptioned figure is a defect worth seeing, not one worth hiding.
 */
export function numberFigures(markdown: string): FigureResult {
  const lines = markdown.split('\n');
  const out: string[] = [];
  const figures: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (isFenceToggle(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    // Only a line that is ONLY an image becomes a captioned figure. An inline image inside a
    // sentence is decoration and captioning it mid-paragraph would break the sentence.
    const m = inFence ? null : /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
    if (!m) {
      out.push(line);
      continue;
    }
    const n = figures.length + 1;
    const alt = m[1].trim();
    const caption = alt || 'Figure not captioned';
    figures.push(`Figure ${n} — ${caption}`);
    out.push(line);
    out.push('');
    out.push(`_Figure ${n} — ${caption}_`);
  }

  return { markdown: out.join('\n'), figures };
}

/** The list of figures, or '' when the document has none. */
export function buildListOfFigures(figures: string[]): string {
  if (!figures.length) return '';
  return ['## Figures', '', ...figures.map((f) => `${f}  `), ''].join('\n');
}

/**
 * Give a flat report the document architecture it is missing, without disturbing one that has it.
 *
 * assembleReportDocument builds the cover, contents and numbering for every report the API
 * generates — but a report is a SAVED ARTEFACT. Rory exported a report on 11 August whose markdown
 * had been generated before that assembler existed, and the PDF came out with no contents page and
 * no section numbers: "does it have the new layout yet?" It did not, and never would have, because
 * the architecture was applied once at generation and the saved text kept its original shape
 * forever.
 *
 * So the export applies it too, idempotently. A document that already has a Contents page is
 * returned byte-for-byte — running the numberer twice would renumber already-numbered headings,
 * which is the exact defect stripLeadingNumber exists to undo.
 *
 * The cover is NOT synthesised here. A cover carries claims (farm name, coordinates, date, who
 * checked it) that must come from data, never from re-reading prose — inventing one at export time
 * is how a document ends up asserting something nobody entered.
 */
export function ensureDocumentArchitecture(markdown: string): string {
  const text = markdown ?? '';
  if (!text.trim()) return text;
  // Already a structured document — leave it exactly as generated.
  if (/^##\s+(?:Contents|Okuqukethwe)\s*$/im.test(text)) return text;

  const figured = numberFigures(text);
  const numbered = numberSections(figured.markdown);
  if (!numbered.headings.length) return text; // nothing to build a contents page out of

  const contents = buildContents(numbered.headings);
  const figuresList = buildListOfFigures(figured.figures);
  const frontMatter = [contents, figuresList].filter((block) => block.length > 0).join('\n\n');
  if (!frontMatter) return numbered.markdown;

  // The front matter goes AFTER the document's title block, not above it: a contents page that
  // precedes the report's own `# ` heading reads as a contents page for nothing.
  const lines = numbered.markdown.split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s+\S/.test(line));
  if (titleIndex === -1) return `${frontMatter}\n\n${numbered.markdown}`;
  // Keep any lead paragraph that belongs to the title (subtitle, place, date) with the title.
  let insertAt = titleIndex + 1;
  while (insertAt < lines.length && !/^##\s+\S/.test(lines[insertAt])) insertAt += 1;
  const head = lines.slice(0, insertAt).join('\n').trimEnd();
  const rest = lines.slice(insertAt).join('\n');
  return `${head}\n\n${frontMatter}\n\n${rest}`;
}
