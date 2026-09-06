'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { enterSampleMode, isSampleMode } from '@/lib/sample-mode';
import { startRolePreview, useSampleRole } from '@/lib/use-role-navigation';
import { readSampleChooserAccountRole } from '@/lib/sample-choice-access';
import { prepareSampleFarm } from '@/lib/sample-farm-session';
import { PRODUCT_TOUR, cleanProductTourProgress, sampleChoicesForAccount } from '@/lib/sample-tour';
import type { UserRole } from '@/lib/db/types';
import { announceOverlay } from '@/lib/overlay-signal';
import styles from './ProductTour.module.css';

const KEY = 'imbewu-product-tour-v1';
type TourState = { active: boolean; current: number; done: string[] };
const empty: TourState = { active: false, current: 0, done: [] };
type TourContextValue = TourState & {
  ready: boolean; error: string; allowed: (index: number) => boolean;
  start: () => void; open: () => void; go: (index: number) => void;
};
const Context = createContext<TourContextValue | null>(null);
export function useProductTour() { return useContext(Context); }

export default function ProductTourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sample = useSampleRole();
  const { user, role, loading } = useAuth();
  const [verified, setVerified] = useState<{ uid: string | null; role: UserRole | null } | null>(null);
  const [state, setState] = useState<TourState>(empty);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ready = !loading && !!verified && verified.uid === (user?.uid ?? null);
  const roles = sampleChoicesForAccount(verified?.role ?? null, !!user, ready);
  const allowed = (index: number) => {
    const step = PRODUCT_TOUR[index];
    return !!step && ready && (!step.role || roles.includes(step.role));
  };

  // Account authority comes from the real profile, never from the selected demo role.
  useEffect(() => {
    let cancelled = false;
    setVerified(null);
    if (!loading) {
      if (!user) setVerified({ uid: null, role: null });
      else void readSampleChooserAccountRole(user.uid).then(value => {
        if (!cancelled) setVerified({ uid: user.uid, role: value });
      }).catch(() => { if (!cancelled) setVerified({ uid: user.uid, role: null }); });
    }
    return () => { cancelled = true; };
  }, [loading, user?.uid, role]);

  useEffect(() => {
    if (!sample) { setState(empty); setExpanded(false); return; }
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (raw && typeof raw.active === 'boolean') setState({ active: raw.active,
        current: Number.isInteger(raw.current) && raw.current >= 0 && raw.current < PRODUCT_TOUR.length ? raw.current : 0,
        done: cleanProductTourProgress(raw.done) });
    } catch { setState(empty); }
  }, [sample]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) { element.showModal(); announceOverlay(true); }
    if (!expanded && element.open) element.close();
    return () => { if (expanded) announceOverlay(false); };
  }, [expanded]);

  function save(next: TourState) {
    // No farm records are persisted here: only the visitor's checklist and current stop.
    if (!isSampleMode()) return false;
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); }
    catch { setError('Your browser could not save tour progress. You can still explore the sample views.'); return false; }
    setState(next); setError(''); return true;
  }
  function go(index: number) {
    if (!allowed(index) || !isSampleMode()) return;
    const step = PRODUCT_TOUR[index];
    // Farm stops remain available in the original sandbox. Reset its navigation too,
    // so leaving the funder view does not hide farm tools on the next screen.
    if (!startRolePreview(step.role ?? 'farmer')) { setError('The sample view could not open. Please try again.'); return; }
    if (save({ ...state, active: true, current: index })) { setExpanded(false); router.push(step.href); }
  }
  function start() {
    if (!ready) return;
    if (!isSampleMode() && !enterSampleMode()) { setError('Could not start the sample. Please allow session storage.'); return; }
    try { prepareSampleFarm(); }
    catch { setError('The example farm could not load. Please try again.'); return; }
    if (save({ ...empty, active: true })) setExpanded(true);
  }
  function next(mark: boolean) {
    if (!state.active || !ready || !isSampleMode()) return;
    const done = mark && allowed(state.current) ? cleanProductTourProgress([...state.done, PRODUCT_TOUR[state.current].id]) : state.done;
    const nextIndex = PRODUCT_TOUR.findIndex((_,i) => i > state.current && allowed(i));
    if (nextIndex < 0) {
      if (save({ ...state, active: false, done })) { setExpanded(false); router.push('/tour?finished=1'); }
      return;
    }
    const step = PRODUCT_TOUR[nextIndex];
    if (!startRolePreview(step.role ?? 'farmer')) { setError('The next sample view could not open.'); return; }
    if (save({ active: true, current: nextIndex, done })) { setExpanded(false); router.push(step.href); }
  }
  const step = PRODUCT_TOUR[state.current];
  const previous = PRODUCT_TOUR.map((_,i)=>i).filter(i=>i<state.current && allowed(i)).pop();
  return <Context.Provider value={{ ...state, ready, error, allowed, start, open:()=>{if(state.active && isSampleMode())setExpanded(true);}, go }}>
    {children}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="product-tour-title" onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)}>
      <div className={styles.dialogHead}><span>TOUR · {state.current + 1} OF {PRODUCT_TOUR.length}</span><button type="button" onClick={()=>setExpanded(false)} aria-label="Close tour guide">×</button></div>
      <h2 id="product-tour-title">{step.title}</h2>
      <p className={styles.time}>About {step.minutes} {step.minutes === 1 ? 'minute' : 'minutes'} · explore at your own pace</p>
      <p>{step.task}</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.controls}><button type="button" className={styles.primary} onClick={()=>go(state.current)} disabled={!allowed(state.current)}>Open this view</button>
      {step.secondaryHref && <Link href={step.secondaryHref} onClick={event=>{
        if (!state.active || !allowed(state.current) || !isSampleMode()) { event.preventDefault(); return; }
        // The optional crop, invoice, Lima and site-report actions are farm tools.
        if (!startRolePreview('farmer')) { event.preventDefault(); setError('The sample view could not open. Please try again.'); return; }
        setExpanded(false);
      }}>{step.secondaryLabel}</Link>}</div>
      <p className={styles.hint}>The small Tour button beside the menu brings these instructions back. Sample edits reset on reload; your tour checklist stays in this tab.</p>
      <div className={styles.controls}><button type="button" onClick={()=>next(true)} disabled={!ready}>I’ve explored this · Next</button><button type="button" onClick={()=>next(false)} disabled={!ready}>Skip this stop</button></div>
      <div className={styles.controls}>{previous !== undefined && <button type="button" onClick={()=>go(previous)}>Previous stop</button>}<Link href="/tour" onClick={()=>setExpanded(false)}>Tour overview</Link><button type="button" onClick={()=>{if(save({...state,active:false}))setExpanded(false);}}>End tour</button></div>
    </dialog>
  </Context.Provider>;
}

export function ProductTourButton() {
  const tour = useProductTour();
  if (!tour?.active) return null;
  return <button type="button" className={styles.badge} onClick={tour.open} aria-label={`Tour guide, stop ${tour.current+1} of ${PRODUCT_TOUR.length}`}><span>Tour</span><strong>{tour.current+1}/{PRODUCT_TOUR.length}</strong></button>;
}
