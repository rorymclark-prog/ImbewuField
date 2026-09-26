// Build-time reader for content/manual/<lang>/<slug>.md. Server-only: it uses `fs`, and is called
// from the statically generated /manual pages (generateStaticParams + dynamicParams = false), so
// the files are read once at build and never on a farmer's request.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MANUAL_CHAPTERS, chapterTitle, readingMinutes, type ManualChapter, type ManualFigure, type ManualLang,
} from '@/lib/manual';

const ROOT = path.join(process.cwd(), 'content', 'manual');

export function manualFile(lang: ManualLang, slug: ManualChapter): string {
  return path.join(ROOT, lang, `${slug}.md`);
}

/** The chapter's Markdown, or null while that language's file has not been written yet. */
export function readChapter(lang: ManualLang, slug: ManualChapter): string | null {
  const file = manualFile(lang, slug);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

export interface ChapterEntry {
  slug: ManualChapter;
  title: string;
  minutes: number;
  /** False when this language has no file yet and the English chapter is shown in its place. */
  translated: boolean;
}

export function chapterIndex(lang: ManualLang): ChapterEntry[] {
  const out: ChapterEntry[] = [];
  for (const slug of MANUAL_CHAPTERS) {
    const own = readChapter(lang, slug);
    const md = own ?? readChapter('en', slug);
    if (!md) continue;
    out.push({ slug, title: chapterTitle(md), minutes: readingMinutes(md), translated: own !== null });
  }
  return out;
}

/** content/manual/figures.json, minus any entry whose image file is not in public/ yet. */
export function manualFigures(): ManualFigure[] {
  const file = path.join(ROOT, 'figures.json');
  if (!existsSync(file)) return [];
  const all = JSON.parse(readFileSync(file, 'utf8')) as ManualFigure[];
  return all.filter((f) => existsSync(path.join(process.cwd(), 'public', f.src.replace(/^\//, ''))));
}
