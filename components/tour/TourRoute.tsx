'use client';

import { useEffect, useRef, useState } from 'react';
import { PRODUCT_TOUR } from '@/lib/sample-tour';
import { productTourDuration, productTourStepCopy, sampleWorkspaceText } from '@/lib/sample-tour-localization';
import { useLanguage } from '@/lib/i18n-context';
import styles from './TourRoute.module.css';

const STEP_MS = 700;
// Desktop geometry, in a 1000 x 300 viewBox: dots alternate high (label above) and low (label below).
const VB_W = 1000;
const VB_H = 300;
const Y_HIGH = 105;
const Y_LOW = 195;

type Phase = 'final' | 'armed' | 'go';

/** One-shot in-view trigger: server and first render show the final state; after mount it arms
 *  (collapsed) and flips to 'go' the first time the node is scrolled into view. Skipped under
 *  prefers-reduced-motion, which keeps the final state. */
function useRevealOnce<T extends HTMLElement>(): [React.RefObject<T>, Phase] {
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<Phase>('final');
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setPhase('armed');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setPhase('go'); io.disconnect(); }
    }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, phase];
}

const pointX = (i: number) => ((i + 0.5) / PRODUCT_TOUR.length) * VB_W;
const pointY = (i: number) => (i % 2 === 0 ? Y_HIGH : Y_LOW);

/**
 * The nine stops of PRODUCT_TOUR as a route. The line draws in stop by stop; each stop's title and
 * duration appear as it arrives and a running total of minutes steps up by that stop's minutes.
 * The total is derived from the number of stops shown, so it only ever takes the values of the
 * real cumulative sums and finishes on the real total.
 */
export default function TourRoute({ onOpen, canOpen }: { onOpen: (index: number) => void; canOpen: (index: number) => boolean }) {
  const { lang } = useLanguage();
  const [ref, phase] = useRevealOnce<HTMLElement>();
  const n = PRODUCT_TOUR.length;
  const [shown, setShown] = useState(n);

  useEffect(() => {
    if (phase === 'armed') setShown(0);
    if (phase !== 'go') return;
    setShown(1);
    const id = window.setInterval(() => {
      setShown((s) => {
        if (s + 1 >= n) window.clearInterval(id);
        return Math.min(s + 1, n);
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [phase, n]);

  const count = phase === 'final' ? n : shown;
  const total = PRODUCT_TOUR.slice(0, count).reduce((sum, step) => sum + step.minutes, 0);
  const fullTotal = PRODUCT_TOUR.reduce((sum, step) => sum + step.minutes, 0);
  const label = sampleWorkspaceText(lang, 'Total so far', 'Isamba kuze kube manje');
  const summary = PRODUCT_TOUR.map((step, i) => `${i + 1}. ${productTourStepCopy(step, lang).title}, ${productTourDuration(step.minutes, lang)}`).join('; ');

  return (
    <section ref={ref} className={styles.route} data-phase={phase} aria-label={`${summary}. ${productTourDuration(fullTotal, lang)}`}>
      <p className={styles.total} aria-hidden>
        <span className={styles.totalLabel}>{label}</span>
        <span className={styles.totalValue}>{productTourDuration(total, lang)}</span>
      </p>
      <div className={styles.stage}>
        <svg className={styles.path} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden focusable="false">
          {PRODUCT_TOUR.slice(1).map((step, k) => {
            const i = k + 1;
            const x0 = pointX(i - 1); const y0 = pointY(i - 1);
            const x1 = pointX(i); const y1 = pointY(i);
            const xm = (x0 + x1) / 2;
            return <path key={step.id} className={styles.seg} pathLength={1} data-on={count > i} d={`M ${x0} ${y0} C ${xm} ${y0} ${xm} ${y1} ${x1} ${y1}`} />;
          })}
        </svg>
        <ol className={styles.stops}>
          {PRODUCT_TOUR.map((step, i) => {
            const copy = productTourStepCopy(step, lang);
            return (
              <li
                key={step.id}
                className={styles.stop}
                data-side={i % 2 === 0 ? 'up' : 'down'}
                data-on={count > i}
                data-linked={count > i + 1}
                style={{ ['--x' as string]: `${(pointX(i) / VB_W) * 100}%`, ['--y' as string]: `${(pointY(i) / VB_H) * 100}%` }}
              >
                <span className={styles.dot} aria-hidden />
                <button type="button" className={styles.label} disabled={!canOpen(i)} onClick={() => onOpen(i)}>
                  <span className={styles.title}>{copy.title}</span>
                  <span className={styles.min}>{productTourDuration(step.minutes, lang)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
