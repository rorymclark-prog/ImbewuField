'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const GrowthMomentCanvas = dynamic(() => import('./GrowthMomentCanvas'), { ssr: false });

export default function GrowthMomentCard() {
  const cardRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [play, setPlay] = useState(0);
  const handleReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => setMotionAllowed(!preference.matches && !connection?.saveData);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const animated = visible && motionAllowed;

  return (
    <section ref={cardRef} className="growth-moment-card" aria-labelledby="growth-moment-title">
      <style jsx>{`
        .growth-moment-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
          align-items: center;
          gap: 20px;
          overflow: hidden;
          border: 1px solid var(--color-border);
          border-radius: 20px;
          background: #f6f5eb;
          box-shadow: 0 8px 24px rgba(31, 77, 43, 0.06);
        }
        .copy { padding: 22px 0 22px 24px; }
        .art { position: relative; width: 100%; aspect-ratio: 2 / 1; background: #f6f5eb; }
        .art img, .art :global(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
        .art img { object-fit: contain; }
        .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; margin-top: 16px; }
        .replay { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 14px; border: 1px solid #b7c5a4; border-radius: 999px; background: #fffdf7; color: #1f4d2b; font-weight: 700; cursor: pointer; }
        .replay:hover { background: #e9f0df; }
        .replay:focus-visible, :global(.growth-moment-plan-link:focus-visible) { outline: 3px solid var(--color-harvest); outline-offset: 3px; }
        @media (max-width: 650px) {
          .growth-moment-card { grid-template-columns: 1fr; gap: 0; }
          .copy { padding: 20px 20px 4px; }
          .art { max-width: 360px; margin: 0 auto; }
        }
      `}</style>
      <div className="copy">
        <span className="font-sans uppercase tracking-widest" style={{ color: 'var(--color-harvest)', fontSize: 12 }}>A moment to grow</span>
        <h2 id="growth-moment-title" className="font-display font-bold" style={{ color: 'var(--color-ink)', fontSize: 23, marginTop: 5 }}>From seed to plant</h2>
        <p className="font-sans" style={{ color: 'var(--color-muted-strong)', fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>
          Watch a seed grow, then start a plan for your own land.
        </p>
        <div className="actions font-sans" style={{ fontSize: 13 }}>
          {motionAllowed && <button type="button" className="replay" onClick={() => { setReady(false); setPlay((count) => count + 1); }}>
            <RotateCcw size={15} aria-hidden="true" /> Watch again
          </button>}
          <Link
            className="growth-moment-plan-link"
            href="/farmer?guided=1"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 44, color: '#1f4d2b', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Start a farm plan <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="art" role="img" aria-label="An illustrated seed grows into a leafy plant">
        <img src={animated ? '/rive/growth-moment-start.png' : '/rive/growth-moment.png'} alt="" aria-hidden="true" />
        {animated && <div style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0 }} aria-hidden="true">
          <GrowthMomentCanvas key={play} onReady={handleReady} />
        </div>}
      </div>
    </section>
  );
}
