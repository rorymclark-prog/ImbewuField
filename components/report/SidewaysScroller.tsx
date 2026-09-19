'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './SidewaysScroller.module.css';

/** A drawn figure keeps its lettering readable on a phone by staying wider than the screen and
 * scrolling sideways. Nothing on the page said so: the reader saw a picture cut off at the right
 * edge. This says it, in words, only while it is true — the figure is wider than its card. The
 * words sit above the figure, never on it, and stay put after the first slide so nothing jumps
 * under the reader's finger. */
export default function SidewaysScroller({ className, label, hint = 'Slide to see more', children }: { className?: string; label: string; hint?: string; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [cue, setCue] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setCue(el.scrollWidth - el.clientWidth > 24);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);
  return <div className={styles.wrap}>
    {cue && <p className={styles.cue} aria-hidden="true"><span>{hint} <span className={styles.arrow}>→</span></span></p>}
    <div ref={scroller} className={className} tabIndex={0} aria-label={label}>{children}</div>
  </div>;
}
