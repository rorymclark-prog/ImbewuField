'use client';
import { useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useLanguage } from '@/lib/i18n';
import styles from '@/components/ProductTour.module.css';

const guides = [
  { title: 'Dictate a mentor visit and attach photos', text: 'In Mentor → Field team, choose the farmer and date. Tap the notes box and use the microphone on your phone keyboard. Record what you saw, what you did, and the next action with its owner and date. Add photos and captions, then save. AI cleanup is optional and can be switched off in Settings.', href: '/mentor', action: 'Open Mentor' },
  { title: 'Save a sale and its invoice', text: 'Open My Records, choose Sold and enter the crop, weight and amount received. Save sale & invoice opens the linked paid invoice. For several products or payment later, use Create an invoice.', href: '/records?tab=sold', action: 'Open My Records' },
  { title: 'Record fruit and nuts', text: 'Choose your orchard product when recording a harvest or sale. In Charts, use Orchard in to include fruit and nuts, or turn it off to compare annual crops.', href: '/records?tab=charts', action: 'Open harvest charts' },
  { title: 'Read your cash balance', text: 'Cash surplus is money received minus recorded spending for the selected period. Cash shortfall means spending was higher. Add missing costs before judging how the garden is doing.', href: '/records?tab=charts', action: 'Open money charts' },
  { title: 'Put your identity on invoices', text: 'Add your farm name and logo in Account. In Invoice, complete your contact and banking details, then save, share the PDF or print.', href: '/invoice', action: 'Open Invoice' },
  { title: 'Practise without changing your work', text: 'Take the tour or choose a practice view. Use the menu to switch views or leave the practice workspace and return to your own records.', href: '/samples', action: 'Choose a practice view' },
];
export default function TipsPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const shown = guides.filter(g => `${g.title} ${g.text}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/home"/><SettingsButton/></header>
    <section className={styles.hero}><div><span className={styles.eyebrow}>{t('tipsEyebrow')}</span><h1>{t('tipsTitle')}</h1><p>{t('tipsIntro')}</p><div className={styles.controls}><Link className={styles.primary} href="/tour">{t('navTour')}</Link><Link href="/samples">{t('tipsChoosePracticeView')}</Link><Link href="/samples/gardens">{t('tipsBrowseGardensReports')}</Link></div></div><figure><img src="/demo/harvest.webp" alt="Illustrated garden harvest"/></figure></section>
    <label style={{ display: 'block', margin: '24px 0' }}>{t('tipsFindLabel')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('tipsSearchPlaceholder')} style={{ display:'block', width:'100%', minHeight:48, marginTop:8, padding:12, borderRadius:12, background:'var(--bg-1)', border:'1px solid var(--border)', color:'var(--text-primary)' }}/></label>
    <div style={{ display:'grid', gap:16 }}>{shown.map(g=><article key={g.title} style={{ padding:24, borderRadius:18, background:'var(--bg-1)', border:'1px solid var(--border)' }}><h2 style={{fontSize:22,fontWeight:700}}>{g.title}</h2><p style={{lineHeight:1.65,margin:'12px 0'}}>{g.text}</p><Link href={g.href} style={{display:'inline-flex',alignItems:'center',minHeight:44,textDecoration:'underline'}}>{g.action} →</Link></article>)}{!shown.length&&<p>{t('tipsNoMatch')} <Link href="/feedback">{t('tipsAskForHelp')}</Link>.</p>}</div>
    <section style={{marginTop:24,padding:24,borderRadius:18,border:'1px solid var(--border)'}}><h2 style={{fontSize:22,fontWeight:700}}>{t('tipsVideoGuidesTitle')}</h2><p style={{margin:'12px 0',lineHeight:1.65}}>{t('tipsVideoGuidesBody')}</p><a href="https://www.youtube.com/results?search_query=permaculture+vegetable+garden+South+Africa" target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',minHeight:44,textDecoration:'underline'}}>{t('tipsYoutubeLink')}</a><p style={{fontSize:13,marginTop:8}}>{t('tipsYoutubeNote')}</p></section>
  </div></main>;
}
