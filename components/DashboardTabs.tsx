'use client';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './DashboardTabs.module.css';

/** Keep the arrows outside the scroller so the last tab stays reachable on phones. */
export default function DashboardTabs({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <nav aria-label="Dashboard sections" className={styles.nav} style={{ display: 'flex', flexShrink: 0, minWidth: 0, background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
    <button aria-label="Scroll sections left" className={styles.arrow} onClick={() => ref.current?.scrollBy({ left: -220 })} style={{ flexShrink: 0, width: 44, minHeight: 44, color: 'var(--text-primary)' }}><ChevronLeft size={20} /></button>
    <div className={styles.scroller} ref={ref} tabIndex={0} aria-label="Scrollable dashboard sections" style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>{children}</div>
    <button aria-label="Scroll sections right" className={styles.arrow} onClick={() => ref.current?.scrollBy({ left: 220 })} style={{ flexShrink: 0, width: 44, minHeight: 44, color: 'var(--text-primary)' }}><ChevronRight size={20} /></button>
  </nav>;
}
