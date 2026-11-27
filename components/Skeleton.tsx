import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

/**
 * The one loading placeholder. Every "still fetching" block in the app was its own hand-rolled
 * `animate-pulse` div with its own colour and its own timing; this gives them one rhythm.
 *
 * It is a plain presentational block: no hooks, so it renders identically on the server and the
 * client. The pulse is opacity only, and it is switched off under prefers-reduced-motion in
 * Skeleton.module.css, leaving a still grey block. Pass `index` for a stack of blocks so they
 * ripple down the list rather than all breathing together (80 ms apart, same as before).
 */
export type SkeletonRadius = 'sm' | 'md' | 'lg' | 'full';
export type SkeletonTone = 'default' | 'inset';

export default function Skeleton({
  width, height, radius = 'md', tone = 'default', index = 0, className, style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: SkeletonRadius;
  tone?: SkeletonTone;
  /** Position in a stack; offsets the pulse so a list ripples. */
  index?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const cls = [styles.block, styles[radius], tone === 'inset' ? styles.inset : '', className ?? ''].filter(Boolean).join(' ');
  return <div aria-hidden="true" className={cls} style={{ width, height, ['--i' as string]: index, ...style }} />;
}
