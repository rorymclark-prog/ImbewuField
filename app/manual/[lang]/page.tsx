import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ManualHeader from '@/components/manual/ManualHeader';
import LanguageSwitch from '@/components/manual/LanguageSwitch';
import { MANUAL_CHAPTERS, MANUAL_LANGS, isManualLang, manualUi } from '@/lib/manual';
import { chapterIndex } from '@/lib/manual-content';

// Contents page for one language. Static: every language's list is built from the chapter files'
// own "# " titles at build time (lib/manual-content.ts).

export const dynamicParams = false;
export function generateStaticParams() {
  return MANUAL_LANGS.map((lang) => ({ lang }));
}

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  if (!isManualLang(params.lang)) return {};
  const ui = manualUi(params.lang);
  return { title: `${ui.title} · ImbewuField`, description: ui.subtitle };
}

export default function ManualContentsPage({ params }: { params: { lang: string } }) {
  if (!isManualLang(params.lang)) notFound();
  const lang = params.lang;
  const ui = manualUi(lang);
  const chapters = chapterIndex(lang);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-0)' }}>
      <ManualHeader fallback="/manual" label={ui.title} />
      <main lang={lang} style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
        <h1 className="font-display" style={{ fontSize: 'clamp(28px, 2.4vw + 18px, 40px)', lineHeight: 1.15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {ui.title}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 20px' }}>{ui.subtitle}</p>
        <LanguageSwitch current={lang} label={ui.language} hrefFor={(code) => `/manual/${code}`} />
        {lang !== 'en' && (
          <p role="note" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-primary)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', margin: '0 0 20px' }}>
            {ui.draftNotice}
          </p>
        )}
        <h2 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', margin: '8px 0 12px' }}>{ui.chapters}</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {chapters.map((chapter) => (
            <li key={chapter.slug}>
              <Link
                href={`/manual/${lang}/${chapter.slug}`}
                lang={chapter.translated ? lang : 'en'}
                style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '12px 14px', borderRadius: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <span className="font-display" aria-hidden style={{ fontSize: 22, fontWeight: 600, minWidth: 28, color: 'var(--text-secondary)' }}>{MANUAL_CHAPTERS.indexOf(chapter.slug)}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>{chapter.title}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {ui.minutes.replace('{n}', String(chapter.minutes))}{chapter.translated ? '' : ' · English'}
                  </span>
                </span>
                <ChevronRight size={20} aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', marginTop: 32 }}>{ui.credit}</p>
      </main>
    </div>
  );
}
