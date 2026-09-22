'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

const RiveProgressSprout = dynamic(() => import('./RiveProgressSprout'), { ssr: false });

/** Growth follows the existing farm-plan checks, never a second score. */
export default function ProgressSprout({ completedSteps, totalSteps, progressPct, interactive = false }: {
  completedSteps: number;
  totalSteps?: number;
  progressPct?: number;
  interactive?: boolean;
}) {
  const stage = Math.max(0, Math.min(5, Math.floor(completedSteps)));
  const stemTop = [44, 40, 34, 28, 23, 18][stage];
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [riveReady, setRiveReady] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const handleRiveReady = useCallback(() => setRiveReady(true), []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => {
      setRiveReady(false);
      setMotionAllowed(!preference.matches && !connection?.saveData);
    };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [pinned]);

  const artwork = (
    <span className="imf-progress-sprout-art" aria-hidden="true">
      <svg
        className="imf-progress-sprout"
        data-stage={stage}
        viewBox="0 0 80 80"
        fill="none"
        style={{ position: 'absolute', inset: 0, opacity: riveReady && motionAllowed ? 0 : 1 }}
      >
        <circle cx="40" cy="39" r="37" fill="rgba(234,243,226,0.08)" />
        <circle cx="60" cy="18" r="4" fill="rgba(247,201,126,0.9)" />
        <path d="M17 62c12-4 34-4 46 0" stroke="#A5BD87" strokeWidth="2" strokeLinecap="round" />
        <path d="M31 66h18" stroke="#D9BC88" strokeWidth="3" strokeLinecap="round" />
        <g className="imf-progress-sprout__growth">
          <path d={`M40 58Q38 45 40 ${stemTop}`} stroke="#D4E4B2" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 51c-8 0-11-4-11-9 7 0 11 3 11 9Z" fill="#A9CE79" />
          <path d="M40 49c1-7 5-10 11-10-1 6-5 9-11 10Z" fill="#D4E4B2" />
          {stage >= 2 && <path d="M40 40C29 40 26 34 26 29c9 0 14 4 14 11Z" fill="#A9CE79" />}
          {stage >= 3 && <path d="M40 34c1-9 6-13 15-13-1 8-6 12-15 13Z" fill="#D4E4B2" />}
          {stage >= 4 && <path d="M40 28c-7 0-10-5-10-10 7 0 10 4 10 10Z" fill="#A9CE79" />}
          {stage >= 5 && <circle cx="40" cy="17" r="5" fill="#F7C97E" />}
        </g>
      </svg>
      {motionAllowed && <RiveProgressSprout stage={stage} onReady={handleRiveReady} />}
    </span>
  );

  return (
    <span ref={wrapperRef} data-stage={stage} data-open={pinned || undefined} className="imf-progress-sprout-wrap" style={{ position: 'relative', display: 'block', flex: 'none' }}>
      {interactive ? (
        <>
          <button
            type="button"
            className="imf-progress-sprout-hit"
            aria-label="About your farm plan sprout"
            aria-describedby={tipId}
            aria-expanded={pinned}
            aria-controls={tipId}
            onClick={() => setPinned((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setPinned(false);
                event.currentTarget.blur();
              }
            }}
          >
            {artwork}
            <span className="imf-progress-sprout-help" aria-hidden="true">?</span>
          </button>
          <span id={tipId} className="imf-progress-sprout-tip" role="tooltip">
            <strong>Your farm plan sprout</strong>
            <span>It grows as you find your land, trace its boundary, survey it, design it and plan crops.</span>
            {totalSteps != null && progressPct != null && (
              <span className="imf-progress-sprout-tip-status">
                {completedSteps} of {totalSteps} steps done · {progressPct}% complete
              </span>
            )}
          </span>
        </>
      ) : <span aria-hidden="true" className="imf-progress-sprout-static">{artwork}</span>}
    </span>
  );
}
