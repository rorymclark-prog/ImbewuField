'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import { useLanguage, translate } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { TIPS_GUIDES } from '@/lib/tips-guides';
import styles from '@/components/ProductTour.module.css';

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
  const shown = guides.filter(g => `${g.en.title} ${g.en.text} ${g.zu.title} ${g.zu.text}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={styles.page}><AppHeader title={t('tipsTitle')} /><div className={styles.scroll}><div className={styles.wrap}>
    {lang === 'zu' && <p role="note" style={{ margin: '16px 0 0', fontSize: 12 }}><span lang="zu">{translate('zu', 'designStudioZuluDraftBadge')}</span> — <span lang="en">Unreviewed isiZulu draft. Each guide keeps its exact English source below.</span></p>}
    <section className={styles.hero}><div><span className={styles.eyebrow}>{lang === 'zu' ? t('tipsEyebrowZuDraft') : t('tipsEyebrow')}</span><h1>{lang === 'zu' ? t('tipsTitleZuDraft') : t('tipsTitle')}</h1><p>{lang === 'zu' ? t('tipsIntroZuDraft') : t('tipsIntro')}</p><div className={styles.controls}><Link className={styles.primary} href="/tour">{t('navTour')}</Link><Link href="/samples">{lang === 'zu' ? t('tipsChoosePracticeViewZuDraft') : t('tipsChoosePracticeView')}</Link><Link href="/samples/gardens">{lang === 'zu' ? t('tipsBrowseGardensReportsZuDraft') : t('tipsBrowseGardensReports')}</Link></div></div><figure><img src="/demo/harvest.webp" alt="Illustrated garden harvest"/></figure></section>
    <label style={{ display: 'block', margin: '24px 0' }}>{lang === 'zu' ? t('tipsFindLabelZuDraft') : t('tipsFindLabel')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang === 'zu' ? t('tipsSearchPlaceholderZuDraft') : t('tipsSearchPlaceholder')} style={{ display:'block', width:'100%', minHeight:48, marginTop:8, padding:12, borderRadius:12, background:'var(--bg-1)', border:'1px solid var(--border)', color:'var(--text-primary)' }}/></label>
    <div style={{ display:'grid', gap:16 }}>{shown.map(g => {
      const copy = lang === 'zu' ? g.zu : g.en;
      return <article key={g.en.title} style={{ padding:24, borderRadius:18, background:'var(--bg-1)', border:'1px solid var(--border)' }}>
        <h2 lang={lang === 'zu' ? 'zu' : 'en'} style={{fontSize:22,fontWeight:700}}>{copy.title}</h2>
        <p lang={lang === 'zu' ? 'zu' : 'en'} style={{lineHeight:1.65,margin:'12px 0'}}>{copy.text}</p>
        {lang === 'zu' && <p lang="en" style={{fontSize:13,lineHeight:1.5,margin:'12px 0',color:'var(--text-muted)'}}>English source: {g.en.text}</p>}
        <Link href={g.href} lang={lang === 'zu' ? 'zu' : 'en'} style={{display:'inline-flex',alignItems:'center',minHeight:44,textDecoration:'underline'}}>{copy.action} →</Link>
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
