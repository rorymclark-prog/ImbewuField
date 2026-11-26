import { inlineText, type Block } from '@/lib/manual';

export interface ManualHeading {
  blockIndex: number;
  anchor: string;
  title: string;
  level: 2 | 3;
}

/** The chapter editions share a heading hierarchy. Number headings inside that
 * hierarchy so a translated title or a new paragraph does not break a link. */
export function manualOutline(body: Block[]): ManualHeading[] {
  const headings: ManualHeading[] = [];
  let section = 0;
  let subsection = 0;
  body.forEach((block, blockIndex) => {
    if (block.type !== 'h1' && block.type !== 'h2' && block.type !== 'h3') return;
    const level = block.type === 'h3' ? 3 : 2;
    if (level === 2) {
      section += 1;
      subsection = 0;
    } else {
      subsection += 1;
    }
    const anchor = level === 2 ? `section-${section}` : `section-${section}-${subsection}`;
    headings.push({ blockIndex, anchor, title: inlineText(block.content), level });
  });
  return headings;
}

/** The glossary keeps its first-column technical terms in English in every edition. */
export function manualGlossaryAnchor(term: string): string {
  const slug = term.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `term-${slug}`;
}
