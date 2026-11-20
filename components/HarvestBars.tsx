'use client';

// Shared bullet bar for "plan vs actual" (FinanceGraphs) and the harvest reconciliation card.
// Three layers, drawn in order: the crop-plan benchmark, then what was logged picked, then what
// was sold. Every width is the real kilogram figure against one shared scale; the animation only
// decides WHEN a layer arrives, never how long it is.
//
// Server render and first client render show the finished bars. After mount the group arms (all
// layers collapsed), then plays once when scrolled into view. A later change of data simply
// transitions the widths, because the layers carry a width transition of their own.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useInViewOnce } from '@/lib/use-in-view-once';
import styles from './HarvestBars.module.css';

/** Row stagger is capped so a long list still finishes its entrance in about 400 ms. */
const STAGGER_TOTAL_MS = 400;
const STAGGER_STEP_MS = 60;
/** Entrance finishes at roughly STAGGER_TOTAL_MS + 380 + 360 ms; after that, data changes transition without delay. */
const SETTLE_MS = 1400;

export function staggerMs(index: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(index * Math.min(STAGGER_STEP_MS, STAGGER_TOTAL_MS / (count - 1)));
}

/** Wrap every bar of one card. Owns the in-view trigger, so it must be mounted when the bars are. */
export function HarvestBarsGroup({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  // The rows are taller than 80% of a phone viewport once there are many crops.
  const { ref, phase } = useInViewOnce<HTMLDivElement>({ threshold: 0, rootMargin: '0px 0px -25% 0px' });
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (phase !== 'play') return;
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);
  const cls = [styles.group, phase === 'armed' ? styles.armed : '', phase === 'play' ? styles.play : '', settled ? styles.settled : '', className ?? ''].filter(Boolean).join(' ');
  return <div ref={ref} className={cls} style={style}>{children}</div>;
}

export interface HarvestBarColors { bench: string; picked: string; short: string; mark: string; sold: string }

export function HarvestBar({ max, benchmarkKg, harvestedKg, soldKg, soldExceedsHarvested, index, count, colors, height = 14, markKg = null, markTitle, children }: {
  max: number;
  /** null when this period has no defensible benchmark: no outline is drawn rather than a zero one. */
  benchmarkKg: number | null;
  harvestedKg: number;
  soldKg: number;
  soldExceedsHarvested: boolean;
  index: number;
  count: number;
  colors: HarvestBarColors;
  height?: number;
  /** The loss-allowance mark: a fixed tick that fades in with the benchmark. */
  markKg?: number | null;
  markTitle?: string;
  /** Marks that sit on the track and never animate (the loss-allowance tick, the cut mark). */
  children?: ReactNode;
}) {
  const scale = Math.max(max, 1);
  const pct = (kg: number) => `${Math.min(100, Math.max(0, kg / scale * 100))}%`;
  const inner = Math.round(height / 2);
  const innerTop = (height - inner) / 2;
  const core = 3;
  const soldWithin = Math.min(soldKg, harvestedKg);
  return (
    <div className={styles.track} style={{ height, ['--d' as string]: `${staggerMs(index, count)}ms` }}>
      {benchmarkKg !== null && benchmarkKg > 0 && <span className={styles.bench} style={{ width: pct(benchmarkKg), background: colors.bench }} />}
      <span className={styles.picked} style={{ top: innerTop, height: inner, width: pct(harvestedKg), background: colors.picked }} />
      {soldWithin > 0 && <span className={styles.sold} style={{ top: innerTop + (inner - core) / 2, height: core, width: pct(soldWithin), background: colors.sold }} />}
      {soldExceedsHarvested && soldKg > harvestedKg && (
        <span className={styles.over} style={{ top: innerTop, height: inner, left: pct(harvestedKg), width: `calc(${pct(soldKg)} - ${pct(harvestedKg)})`, borderColor: colors.short }} />
      )}
      {markKg !== null && <span className={styles.mark} title={markTitle} style={{ top: -1, height: height + 2, left: pct(markKg), background: colors.mark }} />}
      {children}
    </div>
  );
}

/** The "sold more than was logged picked" note. It is in the document from the start; it only fades in once, after the bars. */
export function HarvestFlag({ index, count, children, className, style }: { index: number; count: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={[styles.flag, className ?? ''].filter(Boolean).join(' ')} style={{ ...style, ['--d' as string]: `${staggerMs(index, count)}ms` }}>{children}</div>;
}
