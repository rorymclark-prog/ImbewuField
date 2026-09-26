import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import ManualHeader from '@/components/manual/ManualHeader';
import ManualBlocks from '@/components/manual/ManualBlocks';
import LanguageSwitch from '@/components/manual/LanguageSwitch';
import {
  MANUAL_CHAPTERS, MANUAL_LANGS, chapterTitle, figuresBySection, isManualChapter, isManualLang, manualUi, parseManual, readingMinutes,
} from '@/lib/manual';
import { manualFigures, readChapter } from '@/lib/manual-content';

// One chapter in one language, generated at build time. A language whose chapter file does not
// exist yet shows the English chapter (marked lang="en") rather than a 404, so the contents list
// and the language switch never lead nowhere.

export const dynamicParams = false;
export function generateStaticParams() {
  return MANUAL_LANGS.flatMap((lang) => MANUAL_CHAPTERS.map((slug) => ({ lang, slug })));
}

function load(params: { lang: string; slug: string }) {
  if (!isManualLang(params.lang) || !isManualChapter(params.slug)) return null;
  const own = readChapter(params.lang, params.slug);
  const markdown = own ?? readChapter('en', params.slug);
  if (!markdown) return null;
  return { lang: params.lang, slug: params.slug, markdown, translated: own !== null };
}

export function generateMetadata({ params }: { params: { lang: string; slug: string } }): Metadata {
  const chapter = load(params);
  if (!chapter) return {};
  return { title: `${chapterTitle(chapter.markdown)} · ${manualUi(chapter.lang).title}` };
}

const navLink = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 48, padding: '10px 14px',
  borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-1)',
  color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, maxWidth: '100%',
} as const;

export default function ManualChapterPage({ params }: { params: { lang: string; slug: string } }) {
  const chapter = load(params);
  if (!chapter) notFound();
  const { lang, slug, markdown, translated } = chapter;
  const ui = manualUi(lang);
  const blocks = parseManual(markdown);
  const titleBlock = blocks.find((b) => b.type === 'h1');
  const body = blocks.filter((b) => b !== titleBlock);
  const index = MANUAL_CHAPTERS.indexOf(slug);
  const prev = index > 0 ? MANUAL_CHAPTERS[index - 1] : null;
  const next = index < MANUAL_CHAPTERS.length - 1 ? MANUAL_CHAPTERS[index + 1] : null;
  const contentLang = translated ? lang : 'en';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-0)' }}>
      <ManualHeader fallback={`/manual/${lang}`} label={ui.title} />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 64px' }}>
        <LanguageSwitch current={lang} label={ui.language} hrefFor={(code) => `/manual/${code}/${slug}`} />
        <article lang={contentLang}>
          <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.3, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
            {ui.chapter} {index} · {ui.minutes.replace('{n}', String(readingMinutes(markdown)))}
          </p>
          <h1 className="font-display" style={{ fontSize: 'clamp(28px, 2.4vw + 18px, 40px)', lineHeight: 1.15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 20px' }}>
            {chapterTitle(markdown)}
          </h1>
          {lang !== 'en' && (
            <p role="note" lang={lang} style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', margin: '0 0 24px' }}>
              {ui.draftNotice}{' '}
              <Link href={`/manual/en/${slug}`} lang="en" style={{ textDecoration: 'underline', fontWeight: 600 }}>{manualUi('en').readInEnglish}</Link>
            </p>
          )}
          <ManualBlocks blocks={body} figures={figuresBySection(manualFigures(), slug)} lang={contentLang} />
        </article>
        <nav aria-label={ui.chapters} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 40 }}>
          {prev ? <Link href={`/manual/${lang}/${prev}`} style={navLink}><ChevronLeft size={18} aria-hidden />{ui.previous}</Link> : <span />}
          <Link href={`/manual/${lang}`} style={navLink}><List size={18} aria-hidden />{ui.backToContents}</Link>
          {next ? <Link href={`/manual/${lang}/${next}`} style={navLink}>{ui.next}<ChevronRight size={18} aria-hidden /></Link> : <span />}
        </nav>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', marginTop: 32 }}>{ui.credit}</p>
      </main>
    </div>
  );
}
