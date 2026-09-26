import type { Metadata } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import ManualBlocks from '@/components/manual/ManualBlocks';
import PrintButton from '@/components/manual/PrintButton';
import {
  MANUAL_CHAPTERS, MANUAL_LANGS, chapterTitle, figuresBySection, isManualLang, manualUi, parseManual,
  type ManualLang,
} from '@/lib/manual';
import { manualFigures, readChapter } from '@/lib/manual-content';

// The whole manual in one language as a printable book: cover, imprint, contents, then every
// chapter behind its own title page, laid out for A4. scripts/build-manual-pdfs.mjs prints this
// page to PDF with Playwright; anyone can also use the browser's Print → Save as PDF.
//
// Cover and chapter-page artwork is optional and swappable. Rory generates it in ChatGPT WITHOUT
// text (research/manual/COVER-PROMPTS.md) and drops it in public/manual/covers/ as
//   cover.jpg|png            — the book cover (same art for every language)
//   chapter-00.jpg … chapter-12.jpg|png — the chapter title pages
// The title is set over the image here, in each language, so the art never has misspelt words.
// Missing art falls back to a plain coloured page.

export const dynamicParams = false;
export function generateStaticParams() {
  return MANUAL_LANGS.map((lang) => ({ lang }));
}

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  if (!isManualLang(params.lang)) return {};
  return { title: `${manualUi(params.lang).title} · Book` };
}

const COVERS = path.join(process.cwd(), 'public', 'manual', 'covers');
function artwork(name: string): string | null {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    if (existsSync(path.join(COVERS, `${name}.${ext}`))) return `/manual/covers/${name}.${ext}`;
  }
  return null;
}

// Fixed print colours (not theme tokens): a printed page is always light, whatever theme the
// reader's phone is in.
const INK = '#20190F';
const PAPER = '#FFFEFA';
const FOREST = '#1F4D2B';

const BOOK_CSS = `
@page { size: A4; margin: 14mm; }
#manual-book { background: ${PAPER}; color: ${INK}; font-size: 11.5pt; line-height: 1.55; }
#manual-book, #manual-book * { --text-primary: ${INK}; --text-secondary: #4A3F30; --border: #E2D8C4; --bg-1: ${PAPER}; --bg-2: #F3EEE2; --gold: #C07A1E; }
#manual-book .sheet { break-after: page; page-break-after: always; }
#manual-book .chapter { break-before: page; page-break-before: always; }
#manual-book figure, #manual-book table, #manual-book aside { break-inside: avoid; page-break-inside: avoid; }
#manual-book h2, #manual-book h3 { break-after: avoid; page-break-after: avoid; }
@media screen { #manual-book .sheet, #manual-book .chapter { max-width: 210mm; margin: 0 auto 24px; box-shadow: 0 2px 12px rgba(0,0,0,.12); } #manual-book .chapter-body { max-width: 210mm; margin: 0 auto; padding: 16mm; background: ${PAPER}; } }
@media print {
  body * { visibility: hidden !important; }
  #manual-book, #manual-book * { visibility: visible !important; }
  #manual-book { position: absolute; top: 0; left: 0; width: 182mm; }
  #manual-book .chapter-body { padding: 8mm 0 0; }
  #manual-book .no-print { display: none !important; }
}
`;

function TitleSheet({ image, eyebrow, title, subtitle, full }: { image: string | null; eyebrow?: string; title: string; subtitle?: string; full?: boolean }) {
  return (
    <section
      className="sheet"
      style={{
        position: 'relative', height: full ? '268mm' : '240mm', overflow: 'hidden', borderRadius: full ? 0 : 4,
        background: image ? `${FOREST} url(${image}) center / cover no-repeat` : FOREST,
        color: image ? INK : '#FFFFFF',
      }}
    >
      <div style={{ position: 'absolute', inset: '0 0 auto 0', padding: full ? '22mm 18mm' : '18mm 16mm', background: image ? 'linear-gradient(to bottom, rgba(255,254,250,.92), rgba(255,254,250,.75) 70%, rgba(255,254,250,0))' : 'none' }}>
        {eyebrow && <p style={{ fontSize: '12pt', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 4mm', fontWeight: 700 }}>{eyebrow}</p>}
        <h2 className="font-display" style={{ fontSize: full ? '38pt' : '30pt', lineHeight: 1.1, margin: 0, fontWeight: 600 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '13pt', lineHeight: 1.45, margin: '6mm 0 0', maxWidth: '150mm' }}>{subtitle}</p>}
      </div>
    </section>
  );
}

export default function ManualBookPage({ params }: { params: { lang: string } }) {
  if (!isManualLang(params.lang)) notFound();
  const lang: ManualLang = params.lang;
  const ui = manualUi(lang);
  const figures = manualFigures();
  const chapters = MANUAL_CHAPTERS.map((slug, index) => {
    const own = readChapter(lang, slug);
    const markdown = own ?? readChapter('en', slug);
    return markdown ? { slug, index, markdown, contentLang: own ? lang : 'en' as ManualLang } : null;
  }).filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div id="manual-book" lang={lang}>
      <style>{BOOK_CSS}</style>
      <div className="no-print" style={{ maxWidth: '210mm', margin: '16px auto', padding: '0 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>{ui.title}</h1>
        <PrintButton label={ui.book} />
      </div>

      <TitleSheet full image={artwork('cover')} title={ui.title} subtitle={ui.subtitle} />

      <section className="sheet" style={{ padding: '20mm 16mm' }}>
        <p style={{ margin: '0 0 6mm' }}>{ui.credit}</p>
        {lang !== 'en' && <p style={{ margin: '0 0 6mm', fontStyle: 'italic' }}>{ui.draftNotice}</p>}
        <h2 className="font-display" style={{ fontSize: '20pt', margin: '10mm 0 4mm' }}>{ui.chapters}</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {chapters.map((c) => (
            <li key={c.slug} style={{ display: 'flex', gap: '4mm', padding: '2mm 0', borderBottom: '1px solid #E2D8C4' }}>
              <span style={{ minWidth: '8mm', fontWeight: 700 }}>{c.index}</span>
              <span lang={c.contentLang}>{chapterTitle(c.markdown)}</span>
            </li>
          ))}
        </ol>
      </section>

      {chapters.map((c) => {
        const blocks = parseManual(c.markdown);
        const titleBlock = blocks.find((b) => b.type === 'h1');
        const body = blocks.filter((b) => b !== titleBlock);
        const art = artwork(`chapter-${String(c.index).padStart(2, '0')}`);
        return (
          <div key={c.slug} className="chapter" lang={c.contentLang}>
            <TitleSheet image={art} eyebrow={`${ui.chapter} ${c.index}`} title={chapterTitle(c.markdown)} />
            <div className="chapter-body">
              <ManualBlocks blocks={body} figures={figuresBySection(figures, c.slug)} lang={c.contentLang} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
