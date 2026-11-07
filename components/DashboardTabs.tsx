'use client';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './DashboardTabs.module.css';
import { useLanguage } from '@/lib/i18n-context';
import { inlineText } from '@/lib/xh-inline';

/** Keep the arrows outside the scroller so the last tab stays reachable on phones. */
export default function DashboardTabs({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();
  return <nav aria-label={inlineText(lang, 'Dashboard sections')} className={styles.nav} style={{ display: 'flex', flexShrink: 0, minWidth: 0, background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
    <button aria-label={inlineText(lang, 'Scroll sections left')} className={styles.arrow} onClick={() => ref.current?.scrollBy({ left: -220 })} style={{ flexShrink: 0, width: 44, minHeight: 44, color: 'var(--text-primary)' }}><ChevronLeft size={20} /></button>
    <div className={styles.scroller} ref={ref} tabIndex={0} aria-label={inlineText(lang, 'Scrollable dashboard sections')} style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>{children}</div>
    <button aria-label={inlineText(lang, 'Scroll sections right')} className={styles.arrow} onClick={() => ref.current?.scrollBy({ left: 220 })} style={{ flexShrink: 0, width: 44, minHeight: 44, color: 'var(--text-primary)' }}><ChevronRight size={20} /></button>
  </nav>;
}
