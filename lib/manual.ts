// The Permaculture Manual — a fact-checked edition of The Permaculture Gardening Handbook that
// Rory compiled for the RVCC permaculture project (UNDP / Government of Lesotho, 2020–21), read
// in-app one chapter at a time. How the edition was made, and the rules every language follows,
// are in research/manual/STYLE.md; each English chapter's corrections are logged in
// research/manual/factcheck/<slug>.md.
//
// Chapter text lives in content/manual/<lang>/<slug>.md and is read at BUILD time by
// lib/manual-content.ts, so every chapter page is static HTML: nothing to fetch on a slow
// connection, and none of it in the JS bundle. This module stays free of `fs` so the client-side
// language picker can import the chapter list and UI strings.
//
// The Markdown is a deliberately small subset (STYLE.md, "Markdown format"): headings, paragraphs,
// one-level lists, "> " callouts, simple tables, **bold** and *italic*. parseManual() below is the
// whole renderer's grammar — no HTML passes through, so a translation can never inject markup.

import uiEn from '../content/manual/en/ui.json' with { type: 'json' };
import uiZu from '../content/manual/zu/ui.json' with { type: 'json' };
import uiSt from '../content/manual/st/ui.json' with { type: 'json' };
import uiVe from '../content/manual/ve/ui.json' with { type: 'json' };
import uiTs from '../content/manual/ts/ui.json' with { type: 'json' };

export const MANUAL_LANGS = ['en', 'zu', 'st', 've', 'ts'] as const;
export type ManualLang = (typeof MANUAL_LANGS)[number];

export const MANUAL_LANG_NAMES: Record<ManualLang, string> = {
  en: 'English',
  zu: 'isiZulu',
  st: 'Sesotho',
  ve: 'Tshivenḓa',
  ts: 'Xitsonga',
};

export function isManualLang(code: string): code is ManualLang {
  return (MANUAL_LANGS as readonly string[]).includes(code);
}

/** Fixed order and file names — every language uses the same slugs. */
export const MANUAL_CHAPTERS = [
  '00-introduction',
  '01-what-is-permaculture',
  '02-planning-your-farm',
  '03-sector-planning',
  '04-vegetable-and-staple-crops',
  '05-animal-systems',
  '06-tree-systems',
  '07-earthworks-and-water',
  '08-soil',
  '09-balanced-ecology',
  '10-natural-pest-control',
  '11-home-and-appropriate-technology',
  '12-glossary',
] as const;
export type ManualChapter = (typeof MANUAL_CHAPTERS)[number];

export function isManualChapter(slug: string): slug is ManualChapter {
  return (MANUAL_CHAPTERS as readonly string[]).includes(slug);
}

export interface ManualUi {
  title: string;
  subtitle: string;
  chapters: string;
  chapter: string;
  previous: string;
  next: string;
  backToContents: string;
  language: string;
  readInEnglish: string;
  /** Shown on every page that is not English: these are machine drafts until a fluent reviewer signs off. */
  draftNotice: string;
  credit: string;
  minutes: string;
  /** Link to /manual/<lang>/book, the printable whole-book page. */
  book: string;
}

const UI: Record<ManualLang, ManualUi> = { en: uiEn, zu: uiZu, st: uiSt, ve: uiVe, ts: uiTs };

/** Per-key fallback to English, so a half-translated ui.json never shows a blank button. */
export function manualUi(lang: ManualLang): ManualUi {
  const own = UI[lang] as Partial<ManualUi>;
  const out = { ...UI.en };
  for (const key of Object.keys(out) as (keyof ManualUi)[]) {
    const value = own[key];
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

// ── Markdown subset ────────────────────────────────────────────────────────────────────────────

export type Inline = { text: string; bold?: boolean; italic?: boolean };

export type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p'; content: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }
  | { type: 'callout'; paragraphs: Inline[][] }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] };

/** **bold** and *italic* only. An unmatched marker is left as literal text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else out.push({ text: m[2], italic: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

const tableCells = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const isTableSeparator = (line: string): boolean => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

export function parseManual(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ type: `h${level}`, content: parseInline(heading[2].trim()) });
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const paragraphs: Inline[][] = [];
      let current: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const text = lines[i].trim().replace(/^>\s?/, '');
        // "> - item" inside a Safety box reads as its own line, not run into the sentence before.
        if (/^([-*]|\d+[.)])\s+/.test(text.trim())) {
          if (current.length) { paragraphs.push(parseInline(current.join(' '))); current = []; }
          current.push(text.trim().replace(/^[-*]\s+/, '• '));
        } else if (text.trim()) current.push(text.trim());
        else if (current.length) { paragraphs.push(parseInline(current.join(' '))); current = []; }
        i++;
      }
      if (current.length) paragraphs.push(parseInline(current.join(' ')));
      blocks.push({ type: 'callout', paragraphs });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const marker = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const items: Inline[][] = [];
      while (i < lines.length && marker.test(lines[i].trim())) {
        let text = lines[i].trim().replace(marker, '');
        i++;
        // A wrapped continuation line (indented, not a new item or block) joins its item.
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !marker.test(lines[i].trim())) {
          text += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(parseInline(text));
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = tableCells(trimmed).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(tableCells(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || /^#{1,3}\s/.test(t) || t.startsWith('>') || /^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) break;
      if (t.startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) break;
      para.push(t);
      i++;
    }
    blocks.push({ type: 'p', content: parseInline(para.join(' ')) });
  }
  return blocks;
}

export const inlineText = (content: Inline[]): string => content.map((part) => part.text).join('');

/** The chapter's own `# Title`, which is also what its contents-list entry reads. */
export function chapterTitle(markdown: string): string {
  const first = parseManual(markdown).find((b) => b.type === 'h1');
  return first && 'content' in first ? inlineText(first.content) : '';
}

/** Rough reading time at a slow, careful 150 words a minute — second-language readers on a phone. */
export function readingMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 150));
}

/** A structural fingerprint used by tests to prove a translation kept the English chapter's shape. */
export function blockShape(blocks: Block[]): string[] {
  return blocks.map((b) => {
    if (b.type === 'ul' || b.type === 'ol') return `${b.type}:${b.items.length}`;
    if (b.type === 'table') return `table:${b.rows.length}x${b.head.length}`;
    return b.type;
  });
}

// ── Figures ────────────────────────────────────────────────────────────────────────────────────
//
// Pictures are NOT written into the chapter Markdown: content/manual/figures.json lists each one
// with the chapter it belongs to and the section (the Nth "## " heading, counted from 0) it
// follows. Every language shares one structure, so a figure lands in the same place in all five
// languages without anyone editing five chapter files — and replacing a picture (Rory is making
// new ones in ChatGPT over time) is just overwriting public/manual/figures/<id>.<ext>.

export interface ManualFigure {
  /** Stable slot name, also the image file name: public/manual/figures/<id>.<ext>. */
  id: string;
  chapter: ManualChapter;
  /** Index of the "## " section the figure follows (0 = first section); -1 = before the first section. */
  section: number;
  /** Public path of the image, e.g. /manual/figures/07-swale.jpg. */
  src: string;
  width: number;
  height: number;
  /** Caption per language; English is required and is the fallback. */
  caption: Partial<Record<ManualLang, string>> & { en: string };
  /** Shown under the caption, e.g. "Photo: Imbewu" or "Reproduced with permission: …". */
  credit?: string;
}

export function figureCaption(figure: ManualFigure, lang: ManualLang): { text: string; lang: ManualLang } {
  const own = figure.caption[lang];
  return own && own.trim() ? { text: own, lang } : { text: figure.caption.en, lang: 'en' };
}

/** Figures for one chapter, grouped by the section they follow. */
export function figuresBySection(figures: ManualFigure[], chapter: ManualChapter): Map<number, ManualFigure[]> {
  const out = new Map<number, ManualFigure[]>();
  for (const figure of figures) {
    if (figure.chapter !== chapter) continue;
    const list = out.get(figure.section) ?? [];
    list.push(figure);
    out.set(figure.section, list);
  }
  return out;
}
