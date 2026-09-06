'use client';

import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useProductTour } from '@/components/ProductTourProvider';
import { PRODUCT_TOUR } from '@/lib/sample-tour';
import styles from '@/components/ProductTour.module.css';

export default function TourPage() {
  const tour = useProductTour();
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
    <p className={styles.notice}>This is a practice workspace. People and results are fictional; sample edits reset on reload. Your real project stays separate. Tour progress is kept in this tab. Signed-in accounts retain their existing role access.</p>
    {tried > 0 && !tour?.active && <section className={styles.complete}><h2>{tried === PRODUCT_TOUR.length ? 'You’ve explored the whole tour.' : 'Keep exploring at your own pace.'}</h2><p>{tried} of {PRODUCT_TOUR.length} stops marked as explored. These are your checklist choices, not a training certificate.</p><div className={styles.controls}><Link href="/samples">Explore another role</Link><Link href="/feedback">Request a feature or ask about customisation</Link></div></section>}
    <h2>Nine stops, one connected story.</h2>
    <p className={styles.hint}>On each screen, use the <strong>Tour</strong> button beside the menu for instructions and the next stop. Mark a stop when you have explored it, or skip ahead.</p>
    {tour?.active && <><p aria-live="polite">{tried} of {PRODUCT_TOUR.length} stops explored</p><progress className={styles.progress} value={tried} max={PRODUCT_TOUR.length} aria-label="Tour progress"/></>}
    <div className={styles.grid}>{PRODUCT_TOUR.map((step,index) => <article className={styles.card} key={step.id}>
      <span className={styles.cardMeta}>{String(index+1).padStart(2,'0')} · about {step.minutes} {step.minutes === 1 ? 'minute' : 'minutes'}{tour?.done.includes(step.id) ? ' · Explored' : ''}</span>
      <h2>{step.title}</h2><p>{step.task}</p>
      {tour?.active && <button className={styles.primary} disabled={!tour.allowed(index)} onClick={()=>tour.go(index)}>{tour.allowed(index) ? 'Open this stop' : 'Unavailable for this account'}</button>}
    </article>)}</div>
    <div className={styles.controls}><Link href="/samples/farm">Full farm evidence pack</Link><Link href="/samples">All role workspaces</Link><Link href="/feedback">Feature requests &amp; programme customisation</Link></div>
  </div></main>;
}
