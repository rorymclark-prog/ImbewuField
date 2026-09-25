'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sprout, Map, BookOpen, ReceiptText, Users, Building2, BarChart3, FileText, MessageCircle, type LucideIcon } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useProductTour } from '@/components/ProductTourProvider';
import { PRODUCT_TOUR } from '@/lib/sample-tour';
import { productTourError, productTourStepCopy, productTourUi } from '@/lib/sample-tour-localization';
import { useLanguage } from '@/lib/i18n-context';
import styles from '@/components/ProductTour.module.css';
import cards from './Tour.module.css';

const STOP_ICONS: Record<string, LucideIcon> = {
  garden: Sprout, planning: Map, learning: BookOpen, business: ReceiptText,
  mentor: Users, organisation: Building2, funder: BarChart3, report: FileText, next: MessageCircle,
};

export default function TourPage() {
  const { lang } = useLanguage();
  const ui = (english: string, zulu: string) => lang === 'zu' ? zulu : english;
  const tour = useProductTour();
  const tourUi = (key: Parameters<typeof productTourUi>[0], fallback: string, values: Record<string, string | number> = {}) =>
    productTourUi(key, lang, values) ?? fallback;
  const [pendingStop, setPendingStop] = useState<number | null>(null);
  // Starting prepares the isolated workspace before go() is allowed to navigate. Wait for
  // that success instead of sending a fresh visitor to a screen without its tour guidance.
  useEffect(() => {
    if (pendingStop === null || !tour) return;
    if (tour.error) { setPendingStop(null); return; }
    if (!tour.active) return;
    setPendingStop(null);
    tour.go(pendingStop);
  }, [pendingStop, tour]);
  function openStop(index: number) {
    if (!tour?.ready || !tour.allowed(index)) return;
    if (tour.active) { tour.go(index); return; }
    setPendingStop(index);
    tour.start();
  }
  const minutes = PRODUCT_TOUR.reduce((sum, step) => sum + step.minutes, 0);
  const tried = tour?.done.length ?? 0;
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/home"/><SettingsButton/></header>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>{ui('FARMERS · MENTORS · ORGANISATIONS · FUNDERS', 'ABALIMI · ABELULEKI · IZINHLANGANO · ABAXHASI')}</span>
        <h1>{ui('See what ImbewuField can do.', 'Bona okungenziwa yi-ImbewuField.')}</h1>
        <p>{ui(`Explore the app in about ${minutes} minutes: plan a garden, learn a skill, follow a sale, support growers and see the programme evidence.`, `Hlola uhlelo cishe ngemizuzu engu-${minutes}: hlela ingadi, funda ikhono, landela ukuthengisa, sekela abalimi futhi ubone ubufakazi bohlelo.`)}</p>
        <p className={styles.hint}>{ui('Explore at your own pace. No sign-in needed.', 'Hlola ngejubane lakho. Akudingeki ungene ngemvume.')}</p>
        <div className={styles.controls}>{tour?.active ? <button className={styles.primary} onClick={tour.open}>{tourUi('continue', `Continue tour · stop ${tour.current+1}`, { current: tour.current + 1 })}</button> : <button className={styles.primary} onClick={tour?.start} disabled={!tour?.ready}>{!tour?.ready ? tourUi('loading', 'Getting the tour ready…') : tried ? tourUi('tryAgain', 'Try the tour again') : tourUi('start', 'Start the 15-minute tour')}</button>}
        <Link href="/samples/gardens">{tourUi('browseGardens', 'Browse the gardens')}</Link></div>
      </div>
      <figure><img src="/demo/harvest.webp" alt={ui('Illustrated example of a garden harvest', 'Umdwebo wesibonelo sesivuno sengadi')}/><figcaption>{ui('Garden harvest · AI-generated illustration', 'Isivuno sengadi · umdwebo owenziwe nge-AI')}</figcaption></figure>
    </section>
    {tour?.error && <p role="alert">{productTourError(tour.error, lang)}</p>}
    <p className={styles.notice}>{ui('Try the app with prepared records. Your own project stays unchanged.', 'Zama uhlelo ngamarekhodi alungisiwe. Iphrojekthi yakho ayishintshi.')}</p>
    {lang === 'zu' && <p className={styles.notice} role="note">{tourUi('draftDisclosure', '')}</p>}
    {tried > 0 && !tour?.active && <section className={styles.complete}><h2>{tried === PRODUCT_TOUR.length ? ui('You’ve explored the whole tour.', 'Usuhlole lonke uhambo.') : ui('Keep exploring at your own pace.', 'Qhubeka uhlole ngejubane lakho.')}</h2><p>{ui(`${tried} of ${PRODUCT_TOUR.length} stops marked as explored. These are your checklist choices, not a training certificate.`, `Izindawo ezingu-${tried} kwezingu-${PRODUCT_TOUR.length} zimakwe njengezihloliwe. Lokhu kuwuhlu lokuzihlola kwakho, akusona isitifiketi sokuqeqeshwa.`)}</p><div className={styles.controls}><Link href="/samples">{ui('Explore another role', 'Hlola enye indima')}</Link><Link href="/feedback">{ui('Request a feature or ask about customisation', 'Cela isici noma ubuze ngokwenza uhlelo lufanele wena')}</Link></div></section>}
    <h2>{ui('Nine stops, one connected story.', 'Izindawo eziyisishiyagalolunye, indaba eyodwa exhunyiwe.')}</h2>
    <p className={styles.hint}>{ui('Choose any stop below to open its screen and guide. Use the Tour button beside the menu to return to the tips or move to another stop.', 'Khetha noma iyiphi indawo ngezansi ukuze uvule isikrini nomhlahlandlela wayo. Sebenzisa inkinobho ethi Tour eduze kwemenyu ukuze ubuyele emacebisweni noma uye kwenye indawo.')}</p>
    {tour?.active && <><p aria-live="polite">{ui(`${tried} of ${PRODUCT_TOUR.length} stops explored`, `Kuhlolwe izindawo ezingu-${tried} kwezingu-${PRODUCT_TOUR.length}`)}</p><progress className={styles.progress} value={tried} max={PRODUCT_TOUR.length} aria-label={ui('Tour progress', 'Inqubekela phambili yohambo')}/></>}
    <div className={styles.grid}>{PRODUCT_TOUR.map((step,index) => {
      const copy = productTourStepCopy(step, lang);
      const duration = lang === 'zu' ? (step.minutes === 1 ? 'umzuzu' : `imizuzu engu-${step.minutes}`) : `${step.minutes} min`;
      const Icon = STOP_ICONS[step.id] ?? Sprout;
      const allowed = !!tour?.ready && tour.allowed(index);
      const current = !!tour?.active && tour.current === index;
      return <article className={`${styles.card} ${cards.card}`} key={step.id} data-tone={index % 3} data-current={current}>
        <div className={cards.top}><span className={cards.icon} aria-hidden="true"><Icon size={26} strokeWidth={1.75}/></span><span className={styles.cardMeta}>{String(index+1).padStart(2,'0')} · {duration}{tour?.done.includes(step.id) ? ui(' · Explored', ' · Kuhloliwe') : ''}</span></div>
        <h2><button type="button" className={cards.open} data-tour-stop={step.id} aria-label={tourUi('stopAria', `Open stop ${index + 1}: ${step.title}`, { current: index + 1, title: copy.title })} aria-describedby={`tour-${step.id}-description`} aria-current={current ? 'step' : undefined} disabled={!allowed || pendingStop !== null} onClick={()=>openStop(index)}>{copy.title}</button></h2>
        <p id={`tour-${step.id}-description`} className={cards.description}>{copy.task}</p>
        <span className={cards.action} aria-hidden="true">{pendingStop === index ? tourUi('opening', 'Opening…') : !tour?.ready ? tourUi('gettingReady', 'Getting ready…') : allowed ? ui('Open stop', 'Vula indawo') : tourUi('unavailable', 'Unavailable for this account')}{allowed && <ArrowUpRight size={18}/>}</span>
      </article>;
    })}</div>
    <div className={styles.controls}><Link href="/samples/farm">{ui('Full farm evidence pack', 'Iphakethe eligcwele lobufakazi bepulazi')}</Link><Link href="/samples">{ui('All role workspaces', 'Zonke izindawo zokusebenza')}</Link><Link href="/feedback">{ui('Feature requests & programme customisation', 'Izicelo zezici nokwenza uhlelo lufaneleke')}</Link></div>
  </div></main>;
}
