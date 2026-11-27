'use client';

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import styles from './template.module.css';

// A template remounts on every navigation (a layout does not). The first mount in a tab is the
// hard page load, which must not flash, so only later mounts fade.
let hasMountedOnce = false;

type Phase = 'final' | 'armed' | 'play';

export default function Template({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('final');

  useLayoutEffect(() => {
    if (!hasMountedOnce) {
      hasMountedOnce = true;
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setPhase('armed');
  }, []);

  useEffect(() => {
    if (phase !== 'armed') return;
    const id = requestAnimationFrame(() => setPhase('play'));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const cls = phase === 'armed' ? styles.armed : phase === 'play' ? styles.play : '';
  return <div className={`${styles.frame} ${cls}`.trim()}>{children}</div>;
}
