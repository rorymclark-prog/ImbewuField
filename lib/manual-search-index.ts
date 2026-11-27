import {
  MANUAL_CHAPTERS, chapterTitle, manualFilmPlacements, inlineText, parseManual, type Block, type ManualLang,
} from '@/lib/manual';
import { fieldFilmTitle, filmEdition, type FieldFilm } from '@/lib/field-films';
import { readChapter } from '@/lib/manual-content';
import { manualGlossaryAnchor, manualOutline } from '@/lib/manual-outline';
import type { ManualSearchSection } from '@/lib/manual-search';

function blockPassages(block: Block): string[] {
  switch (block.type) {
    case 'p': return [inlineText(block.content)];
    case 'ul':
    case 'ol': return block.items.map(inlineText);
    case 'callout': return block.paragraphs.map(inlineText);
    case 'table': return [block.head, ...block.rows].map(row => row.map(inlineText).join(' · '));
    default: return [];
  }
}

/** Build only the requested edition from the same blocks and anchors used by the chapter reader. */
export function manualSearchIndex(lang: ManualLang): ManualSearchSection[] {
  const sections: ManualSearchSection[] = [];
  for (const slug of MANUAL_CHAPTERS) {
    const own = readChapter(lang, slug);
    const markdown = own ?? readChapter('en', slug);
    if (!markdown) continue;
    const blocks = parseManual(markdown);
    const titleBlock = blocks.find(block => block.type === 'h1');
    const body = blocks.filter(block => block !== titleBlock);
    const chapter = chapterTitle(markdown);
    const sourceLang: ManualLang = own === null ? 'en' : lang;
    const source = { slug, chapter, lang: sourceLang };
    const glossaryTable = slug === '12-glossary' ? body.find(block => block.type === 'table') : undefined;
    const headings = new Map(manualOutline(body).map(heading => [heading.blockIndex, heading]));
    let current: ManualSearchSection = { ...source, title: chapter, anchor: 'chapter-start', passages: [] };
    sections.push(current);
    body.forEach((block, i) => {
      const heading = headings.get(i);
      if (heading) {
        current = { ...source, title: heading.title, anchor: heading.anchor, passages: [] };
        sections.push(current);
      } else if (block === glossaryTable && block.type === 'table') {
        for (const [term, ...definition] of block.rows) {
          const title = inlineText(term);
          sections.push({ ...source, title, titleLang: 'en', anchor: manualGlossaryAnchor(title), passages: definition.map(inlineText) });
        }
      } else {
        current.passages.push(...blockPassages(block));
      }
    });
    const indexed = new Set<FieldFilm>();
    for (const slot of manualFilmPlacements(slug, body)) {
      if (indexed.has(slot.film)) continue;
      indexed.add(slot.film);
      const passages = blockPassages(body[slot.blockIndex]);
      const passage = passages[(slot.afterStep ?? passages.length) - 1];
      const titleLang = filmEdition(slot.film, lang).lang;
      sections.push({
        ...source, kind: 'film', title: fieldFilmTitle(slot.film, titleLang),
        titleLang, anchor: slot.anchor, passages: passage ? [passage] : [],
      });
    }
  }
  return sections;
}
