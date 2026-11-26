import type { ManualChapter, ManualLang } from '@/lib/manual';

export interface ManualSearchSection {
  slug: ManualChapter;
  chapter: string;
  title: string;
  anchor: string;
  lang: ManualLang;
  titleLang?: ManualLang;
  kind?: 'film';
  passages: string[];
}

const separators = new RegExp('[^\\p{L}\\p{N}]+', 'gu');

function normalise(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(separators, ' ').trim();
}

// Prefer the word itself, then a word beginning with it. Longer fragments can
// also find a stem inside a word, including words with a noun-class prefix.
function termWeight(text: string, term: string): number {
  if (text.includes(` ${term} `)) return 3;
  if (term.length > 1 && text.includes(` ${term}`)) return 2;
  if (term.length >= 4 && term.endsWith('s') && text.includes(` ${term.slice(0, -1)} `)) return 2;
  return term.length >= 4 && text.includes(term) ? 1 : 0;
}

function excerpt(text: string, terms: string[]): string {
  const maxLength = 190;
  if (text.length <= maxLength) return text;
  // Find the offset in the *original* text so accents and punctuation survive.
  const searchable = ` ${normalise(text)} `;
  const focus = terms.find(term => termWeight(searchable, term) > 0);
  const match = focus && Array.from(text.matchAll(/\S+/g)).find(word => termWeight(` ${normalise(word[0])} `, focus));
  const offset = match ? match.index ?? 0 : 0;
  const from = Math.max(0, Math.min(offset - 56, text.length - maxLength));
  const nextSpace = text.indexOf(' ', from);
  const start = from > 0 && nextSpace >= from && nextSpace < offset ? nextSpace + 1 : from;
  const end = Math.min(start + maxLength, text.length);
  const boundary = text.lastIndexOf(' ', end);
  const stop = end < text.length && boundary > start ? boundary : end;
  return (start ? '…' : '') + text.slice(start, stop) + (stop < text.length ? '…' : '');
}

/** Fold each passage once when its edition arrives, so typing only scans the prepared text. */
export function prepareManualSearch(sections: ManualSearchSection[]) {
  const padded = (text: string) => ` ${normalise(text)} `;
  return sections.map(section => ({
    section, title: padded(section.title), chapter: padded(section.chapter),
    passages: section.passages.map(padded),
  }));
}

export function searchManual(index: ReturnType<typeof prepareManualSearch>, query: string): { section: ManualSearchSection; excerpt: string }[] {
  const phrase = normalise(query);
  if (!phrase) return [];
  const terms = [...new Set(phrase.split(' '))].sort((a, b) => b.length - a.length);
  const compound = terms.length > 1 ? phrase.replace(/ /g, '-') : '';
  const matches = [];
  for (const { section, title, chapter, passages } of index) {
    const headingWeights = terms.map(term => termWeight(title, term));
    const found = headingWeights.map(weight => weight > 0);
    let bestPassage = section.passages[0] ?? '';
    let bestScore = 0;
    for (let i = 0; i < passages.length; i++) {
      const text = passages[i];
      const passage = section.passages[i];
      let score = text.includes(` ${phrase} `) ? 6 : 0;
      // “A-frame” names a tool. A passage about “a frame of timber” is a
      // useful fallback, but should follow the manual's actual compound.
      if (compound && passage.toLowerCase().includes(compound)) score += 6;
      terms.forEach((term, i) => {
        const weight = termWeight(text, term);
        if (weight) found[i] = true;
        score += weight;
      });
      if (score > bestScore) {
        bestScore = score;
        bestPassage = passage;
      }
    }
    // A chapter name can supply context to a query, but should not return every
    // section of that chapter when only its name matches.
    if (!found.some(Boolean) || !found.every((hit, i) => hit || termWeight(chapter, terms[i]))) continue;
    const exactTitle = title.trim() === phrase;
    const titlePhrase = title.includes(` ${phrase} `);
    const score = headingWeights.reduce((sum, weight) => sum + 4 * weight, 0) + bestScore;
    matches.push({ section, bestPassage, exactTitle, titlePhrase, score });
  }
  return matches.sort((a, b) => Number(b.exactTitle) - Number(a.exactTitle) ||
    Number(b.titlePhrase) - Number(a.titlePhrase) || b.score - a.score)
    .map(({ section, bestPassage }) => ({ section, excerpt: excerpt(bestPassage, terms) }));
}
