'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/use-in-view-once';
import styles from './SavedTick.module.css';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** What the save actually achieved, so the mark never claims more than the message does.
 *  saved:  written and confirmed. A calm green draw-in check.
 *  linked: written and joined to a sale that already existed, so it is counted once. Same check
 *          plus a small "1" chip, which is the only thing that tells it apart from a plain save.
 *  device: kept on this device only (offline, sample, or the shared book has not confirmed).
 *          A quiet grey check with no pop and no colour: never a celebration. */
export type SavedTickKind = 'saved' | 'linked' | 'device';

/**
 * A short draw-in check with the real outcome sentence beside it. Mount it only when a save has
 * just finished (give it a new `key` per save so it replays); the sentence sits in a polite live
 * region so a screen reader announces it. Server render and the first client render show the
 * finished mark; after mount it plays once. Under reduced motion it stays on the finished mark.
 */
export default function SavedTick({ kind, message, className }: { kind: SavedTickKind; message: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  useIsoLayoutEffect(() => {
    if (!prefersReducedMotion()) setPlaying(true);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      data-saved-kind={kind}
      className={`${styles.line} ${styles[kind]} ${playing ? styles.play : ''} ${className ?? ''}`}
    >
      <svg className={styles.mark} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <circle className={styles.ring} cx="12" cy="12" r="10.5" />
        <path className={styles.tick} d="M7 12.6l3.4 3.4L17 9.2" pathLength={1} />
      </svg>
      <span className={styles.text}>{message}</span>
      {kind === 'linked' && <span className={styles.once} aria-hidden="true">1</span>}
    </div>
  );
}
