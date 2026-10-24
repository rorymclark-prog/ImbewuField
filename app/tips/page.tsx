'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import { useLanguage, translate } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { inlineText } from '@/lib/xh-inline';
import { TIPS_GUIDES } from '@/lib/tips-guides';
import { ArrowRight } from 'lucide-react';
import styles from '@/components/ProductTour.module.css';
import tour from '@/app/tour/Tour.module.css';

// ux-19: lib/tips-guides.ts is owned by another file's data (not this track), so filtering
// happens here on what each guide already is — not by adding a level/role field to it. Mentor
// dictation and invoice-field tips are staff/office tools, not something a Simple-mode farmer
// opened Tips looking for; records and the practice-view tips stay relevant to everyone.
const SIMPLE_RELEVANT_PREFIXES = ['/records', '/samples'];

export default function TipsPage() {
  const { t, lang } = useLanguage();
  const simple = useAppLevel() === 'simple';
  const [search, setSearch] = useState('');
  const guides = simple ? TIPS_GUIDES.filter(g => SIMPLE_RELEVANT_PREFIXES.some(p => g.href.startsWith(p))) : TIPS_GUIDES;
  // isiXhosa guide drafts are keyed by the exact English of each card (lib/locales/xh-inline/), so
  // searching in isiXhosa matches the same words the card shows.
  const xhCopy = (g: (typeof TIPS_GUIDES)[number]) => ({ title: inlineText('xh', g.en.title), text: inlineText('xh', g.en.text), action: inlineText('xh', g.en.action) });
  const shown = guides.filter(g => `${g.en.title} ${g.en.text} ${g.zu.title} ${g.zu.text}${lang === 'xh' ? ` ${xhCopy(g).title} ${xhCopy(g).text}` : ''}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={styles.page}><AppHeader title={lang === 'zu' ? t('tipsTitleZuDraft') : t('tipsTitle')} /><div className={styles.scroll}><div className={styles.wrap}>
    {lang === 'zu' && <p role="note" style={{ margin: '16px 0 0', fontSize: 12 }}><span lang="zu">{translate('zu', 'designStudioZuluDraftBadge')}</span> — <span lang="en">Unreviewed isiZulu draft. Each guide keeps its exact English source below.</span></p>}
    {lang === 'xh' && <p role="note" lang="xh" style={{ margin: '16px 0 0', fontSize: 12 }}>{inlineText(lang, 'Unreviewed isiXhosa draft. Each guide keeps its exact English source below.')}</p>}
    <section className={styles.hero}><div><span className={styles.eyebrow}>{lang === 'zu' ? t('tipsEyebrowZuDraft') : t('tipsEyebrow')}</span><h1>{lang === 'zu' ? t('tipsTitleZuDraft') : t('tipsTitle')}</h1><p>{lang === 'zu' ? t('tipsIntroZuDraft') : t('tipsIntro')}</p><div className={styles.controls}><Link className={styles.primary} href="/tour">{t('navTour')}</Link><Link href="/samples">{lang === 'zu' ? t('tipsChoosePracticeViewZuDraft') : t('tipsChoosePracticeView')}</Link><Link href="/samples/gardens">{lang === 'zu' ? t('tipsBrowseGardensReportsZuDraft') : t('tipsBrowseGardensReports')}</Link></div></div><figure><img src="/demo/harvest.webp" alt="Illustrated garden harvest"/></figure></section>
    <label style={{ display: 'block', margin: '24px 0' }}>{lang === 'zu' ? t('tipsFindLabelZuDraft') : t('tipsFindLabel')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang === 'zu' ? t('tipsSearchPlaceholderZuDraft') : t('tipsSearchPlaceholder')} style={{ display:'block', width:'100%', minHeight:48, marginTop:8, padding:12, borderRadius:12, background:'var(--bg-1)', border:'1px solid var(--border)', color:'var(--text-primary)' }}/></label>
    <div className={styles.grid}>{shown.map(g => {
      const draftLang = lang === 'zu' || lang === 'xh';
      const copy = lang === 'zu' ? g.zu : lang === 'xh' ? xhCopy(g) : g.en;
      return <article key={g.en.title} className={`${styles.card} ${styles.tipCard}`}>
        <h2 lang={draftLang ? lang : 'en'}>{copy.title}</h2>
        <p lang={draftLang ? lang : 'en'}>{copy.text}</p>
        {draftLang && <p lang="en" style={{fontSize:13,lineHeight:1.5,margin:'12px 0',color:'var(--text-muted)'}}>English source: {g.en.text}</p>}
        <Link href={g.href} lang={draftLang ? lang : 'en'} className={tour.action}>{copy.action}<ArrowRight size={16} aria-hidden="true" /></Link>
      </article>;
    })}{!shown.length&&<p>{lang === 'zu' ? t('tipsNoMatchZuDraft') : t('tipsNoMatch')} <Link href="/feedback">{lang === 'zu' ? t('tipsAskForHelpZuDraft') : t('tipsAskForHelp')}</Link>.</p>}</div>
    {/* ux-19: the "Video guides" section was a placeholder ending in "will be added here when
        published" with only a generic YouTube search link — removed until there is at least
        one real video. */}
  </div></div>
  {/* nav-03: without this, /tips was one of the secondary pages that lost the farmer's way home. */}
  <div className="no-print"><TabBar hideAtDesktop/></div>
  </main>;
}
