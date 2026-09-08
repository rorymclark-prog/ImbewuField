'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sprout, Map, BookOpen, ReceiptText, Users, Building2, BarChart3, FileText, MessageCircle, type LucideIcon } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useProductTour } from '@/components/ProductTourProvider';
import { PRODUCT_TOUR } from '@/lib/sample-tour';
import styles from '@/components/ProductTour.module.css';
import cards from './Tour.module.css';

const STOP_ICONS: Record<string, LucideIcon> = {
  garden: Sprout, planning: Map, learning: BookOpen, business: ReceiptText,
  mentor: Users, organisation: Building2, funder: BarChart3, report: FileText, next: MessageCircle,
};

export default function TourPage() {
  const tour = useProductTour();
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
      <div><span className={styles.eyebrow}>FARMERS · MENTORS · ORGANISATIONS · FUNDERS</span>
        <h1>See what ImbewuField can do.</h1>
        <p>Explore the app in about {minutes} minutes: plan a garden, learn a skill, follow a sale, support growers and see the programme evidence.</p>
        <p className={styles.hint}>A self-guided introduction, with real app screens to try. Stay longer wherever you like. No sign-in needed to start.</p>
        <div className={styles.controls}>{tour?.active ? <button className={styles.primary} onClick={tour.open}>Continue tour · stop {tour.current+1}</button> : <button className={styles.primary} onClick={tour?.start} disabled={!tour?.ready}>{!tour?.ready ? 'Getting the tour ready…' : tried ? 'Try the tour again' : 'Start the 15-minute tour'}</button>}
        <Link href="/samples/gardens">Browse the gardens</Link></div>
      </div>
      <figure><img src="/demo/harvest.webp" alt="Illustrated example of a garden harvest"/><figcaption>AI-generated illustration. Explore fictional records in the app.</figcaption></figure>
    </section>
    {tour?.error && <p role="alert">{tour.error}</p>}
    <p className={styles.notice}>This is a practice workspace. People and results are fictional; practice edits reset on reload. Your real project stays separate. Tour progress is kept in this tab. Signed-in accounts retain their existing role access.</p>
    {tried > 0 && !tour?.active && <section className={styles.complete}><h2>{tried === PRODUCT_TOUR.length ? 'You’ve explored the whole tour.' : 'Keep exploring at your own pace.'}</h2><p>{tried} of {PRODUCT_TOUR.length} stops marked as explored. These are your checklist choices, not a training certificate.</p><div className={styles.controls}><Link href="/samples">Explore another role</Link><Link href="/feedback">Request a feature or ask about customisation</Link></div></section>}
    <h2>Nine stops, one connected story.</h2>
    <p className={styles.hint}>Choose any stop below to open its screen and guide. Use the <strong>Tour</strong> button beside the menu to return to the tips or move to another stop.</p>
    {tour?.active && <><p aria-live="polite">{tried} of {PRODUCT_TOUR.length} stops explored</p><progress className={styles.progress} value={tried} max={PRODUCT_TOUR.length} aria-label="Tour progress"/></>}
    <div className={styles.grid}>{PRODUCT_TOUR.map((step,index) => {
      const Icon = STOP_ICONS[step.id] ?? Sprout;
      const allowed = !!tour?.ready && tour.allowed(index);
      const current = !!tour?.active && tour.current === index;
      return <article className={`${styles.card} ${cards.card}`} key={step.id} data-tone={index % 3} data-current={current}>
        <div className={cards.top}><span className={cards.icon} aria-hidden="true"><Icon size={26} strokeWidth={1.75}/></span><span className={styles.cardMeta}>{String(index+1).padStart(2,'0')} · {step.minutes} min{tour?.done.includes(step.id) ? ' · Explored' : ''}</span></div>
        <h2><button type="button" className={cards.open} data-tour-stop={step.id} aria-label={`Open stop ${index + 1}: ${step.title}`} aria-describedby={`tour-${step.id}-description`} aria-current={current ? 'step' : undefined} disabled={!allowed || pendingStop !== null} onClick={()=>openStop(index)}>{step.title}</button></h2>
        <p id={`tour-${step.id}-description`} className={cards.description}>{step.task}</p>
        <span className={cards.action} aria-hidden="true">{pendingStop === index ? 'Opening…' : !tour?.ready ? 'Getting ready…' : allowed ? 'Open stop' : 'Unavailable for this account'}{allowed && <ArrowUpRight size={18}/>}</span>
      </article>;
    })}</div>
    <div className={styles.controls}><Link href="/samples/farm">Full farm evidence pack</Link><Link href="/samples">All role workspaces</Link><Link href="/feedback">Feature requests &amp; programme customisation</Link></div>
  </div></main>;
}
