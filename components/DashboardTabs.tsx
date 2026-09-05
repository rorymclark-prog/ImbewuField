'use client';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/** Keep the arrows outside the scroller so the last tab stays reachable on phones. */
export default function DashboardTabs({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <nav aria-label="Dashboard sections" style={{ display: 'flex', flexShrink: 0, minWidth: 0, background: '#fffefa', borderBottom: '1px solid #E2D8C4' }}>
    <button aria-label="Scroll sections left" onClick={() => ref.current?.scrollBy({ left: -220 })} style={{ flexShrink: 0, width: 44 }}><ChevronLeft size={20} /></button>
    <div ref={ref} tabIndex={0} aria-label="Scrollable dashboard sections" style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>{children}</div>
    <button aria-label="Scroll sections right" onClick={() => ref.current?.scrollBy({ left: 220 })} style={{ flexShrink: 0, width: 44 }}><ChevronRight size={20} /></button>
  </nav>;
}
