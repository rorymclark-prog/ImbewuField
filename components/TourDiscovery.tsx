'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSampleRole } from '@/lib/use-role-navigation';
import { dismissTourMenuTip, recordTourOpening, TOUR_INVITATION_LIMIT, type TourDiscovery } from '@/lib/tour-discovery';
import { announceOverlay } from '@/lib/overlay-signal';
import { useLanguage } from '@/lib/i18n';

const Context = createContext(false);
export const useTourInvitation = () => useContext(Context);
export default function TourDiscoveryProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const sample = useSampleRole();
  const pathname = usePathname();
  const { t } = useLanguage();
  const key = `imbewu-tour-discovery:${encodeURIComponent(user?.uid ?? 'guest')}`;
  const [record, setRecord] = useState<{ key: string; value: TourDiscovery } | null>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const state = record?.key === key ? record.value : null;
  const showTip = !sample && pathname === '/home' && !!state && state.openings >= TOUR_INVITATION_LIMIT && !state.menuTipDismissed;
  useEffect(() => {
    if (loading || sample) return;
    try { setRecord({ key, value: recordTourOpening(localStorage, key) }); } catch { /* Private browsing may deny access entirely. */ }
  }, [key, loading, sample]);
  useEffect(() => {
    if (!showTip) return;
    const element = dialog.current;
    const menu = document.querySelector<HTMLElement>('[data-app-menu]');
    if (!element || !menu) return;
    const measure = () => { const r = menu.getBoundingClientRect(); setMenuRect({ top: r.top, left: r.left, width: r.width, height: r.height }); };
    measure(); element.showModal(); announceOverlay(true);
    window.addEventListener('resize', measure);
    return () => { element.close(); announceOverlay(false); window.removeEventListener('resize', measure); };
  }, [showTip]);
  function dismiss(openMenu = false) {
    if (!state) return;
    let next = { ...state, menuTipDismissed: true };
    try { next = dismissTourMenuTip(localStorage, key, state); } catch { /* Dismiss even when storage is denied. */ }
    setRecord({ key, value: next });
    dialog.current?.close();
    if (openMenu) document.querySelector<HTMLButtonElement>('[data-app-menu]')?.click();
  }
  // The farm photo is now a permanent Home feature; the opening count only times the menu tip.
  return <Context.Provider value={!sample}>
    {children}
    {showTip && <dialog ref={dialog} onCancel={event => { event.preventDefault(); dismiss(); }} aria-labelledby="tour-menu-tip-title" style={{ position: 'fixed', inset: 0, width: '100vw', maxWidth: 'none', height: '100dvh', maxHeight: 'none', margin: 0, padding: 24, border: 0, background: 'rgba(0,0,0,.82)', color: 'var(--text-primary)' }}>
      {menuRect && <button type="button" aria-label={t('tourMenuTipOpenMenuAria')} onClick={() => dismiss(true)} style={{ position: 'fixed', ...menuRect, borderRadius: 99, background: 'var(--bg-1)', color: 'var(--text-primary)', border: '3px solid var(--color-harvest)', boxShadow: '0 0 0 8px rgba(192,122,30,.25)', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Menu size={24} aria-hidden /></button>}
      <div style={{ maxWidth: 440, margin: 'max(110px, 20vh) auto 0', padding: 28, borderRadius: 22, background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <h2 id="tour-menu-tip-title" style={{ fontSize: 25, fontWeight: 700 }}>{t('tourMenuTipTitle')}</h2>
        <p style={{ margin: '16px 0', lineHeight: 1.6 }}>{t('tourMenuTipBodyBefore')}<strong>{t('navTour')}</strong>{t('tourMenuTipBodyAfter')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {/* A real fill under fixed white type — not var(--color-harvest) (the text-only
              dim-ochre token) under var(--text-primary), which measured ~2.1:1 in light and
              ~1.7:1 in dark. #9A6018 is CLAUDE.md's ochre fill for white type. */}
          <button autoFocus type="button" onClick={() => dismiss(true)} style={{ minHeight: 44, padding: '10px 18px', borderRadius: 99, background: '#9A6018', color: '#fff', fontWeight: 700 }}>{t('tourMenuTipShowMenu')}</button>
          <button type="button" onClick={() => dismiss()} style={{ minHeight: 44, padding: '10px 18px' }}>{t('guideGotItButton')}</button>
        </div>
      </div>
    </dialog>}
  </Context.Provider>;
}
