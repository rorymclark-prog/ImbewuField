'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { enterSampleMode, isSampleMode } from '@/lib/sample-mode';
import { startRolePreview, useSampleRole } from '@/lib/use-role-navigation';
import { readSampleChooserAccountRole } from '@/lib/sample-choice-access';
import { prepareSampleFarm } from '@/lib/sample-farm-session';
import { PRODUCT_TOUR, PRODUCT_TOUR_FEATURES, cleanProductTourProgress, sampleChoicesForAccount } from '@/lib/sample-tour';
import { productTourError, productTourFeatureCopy, productTourStepCopy, productTourUi } from '@/lib/sample-tour-localization';
import type { UserRole } from '@/lib/db/types';
import { useLanguage } from '@/lib/i18n-context';
import { announceOverlay } from '@/lib/overlay-signal';
import styles from './ProductTour.module.css';
import TourDiscoveryProvider from './TourDiscovery';

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
  const { lang } = useLanguage();
  const tourUi = (key: Parameters<typeof productTourUi>[0], fallback: string, values: Record<string, string | number> = {}) =>
    productTourUi(key, lang, values) ?? fallback;
  const router = useRouter();
  const pathname = usePathname();
  const sample = useSampleRole();
  const { user, role, loading } = useAuth();
  const [verified, setVerified] = useState<{ uid: string | null; role: UserRole | null } | null>(null);
  const [state, setState] = useState<TourState>(empty);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [featureIndex, setFeatureIndex] = useState(0);
  const shownArrival = useRef('');
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
    if (!state.active || !ready || !sample) { shownArrival.current = ''; return; }
    const destination = PRODUCT_TOUR[state.current].href.split(/[?#]/)[0];
    if (pathname !== destination) return;
    const arrival = `${state.current}:${pathname}`;
    if (shownArrival.current === arrival) return;
    shownArrival.current = arrival;
    setFeatureIndex(0);
    setExpanded(true);
  }, [pathname, state.active, state.current, ready, sample]);

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
    catch { setError("Your browser could not save tour progress. You can still explore the views."); return false; }
    setState(next); setError(''); return true;
  }
  function go(index: number) {
    if (!allowed(index) || !isSampleMode()) return;
    const step = PRODUCT_TOUR[index];
    // Farm stops remain available in the original sandbox. Reset its navigation too,
    // so leaving the funder view does not hide farm tools on the next screen.
    if (!startRolePreview(step.role ?? 'farmer')) { setError("The view could not open. Please try again."); return; }
    if (save({ ...state, active: true, current: index })) {
      setFeatureIndex(0);
      setExpanded(pathname === step.href.split(/[?#]/)[0]);
      router.push(step.href);
    }
  }
  function start() {
    if (!ready) return;
    if (!isSampleMode() && !enterSampleMode()) { setError("Could not start the tour. Please allow session storage."); return; }
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
    if (!startRolePreview(step.role ?? 'farmer')) { setError("The next view could not open."); return; }
    if (save({ active: true, current: nextIndex, done })) { setExpanded(false); router.push(step.href); }
  }
  const step = PRODUCT_TOUR[state.current];
  const features = PRODUCT_TOUR_FEATURES[step.id] ?? [];
  const feature = productTourFeatureCopy(step.id, Math.min(featureIndex, features.length - 1), lang, features[Math.min(featureIndex, features.length - 1)]);
  const stepCopy = productTourStepCopy(step, lang);
  const inView = pathname === step.href.split(/[?#]/)[0];
  const previous = PRODUCT_TOUR.map((_,i)=>i).filter(i=>i<state.current && allowed(i)).pop();
  return <TourDiscoveryProvider><Context.Provider value={{ ...state, ready, error, allowed, start, open:()=>{if(state.active && isSampleMode())setExpanded(true);}, go }}>
    {children}
    <dialog ref={dialog} className={styles.dialog} lang={lang} aria-labelledby="product-tour-title" onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)}>
      <div className={styles.dialogHead}><span>{tourUi('tour', 'TOUR')} · {state.current + 1} / {PRODUCT_TOUR.length}</span><button type="button" onClick={()=>setExpanded(false)} aria-label={tourUi('close', 'Close tour guide')}>×</button></div>
      <h2 id="product-tour-title">{inView && feature ? feature.title : stepCopy.title}</h2>
      <p className={styles.time}>{stepCopy.title}{inView && features.length > 1 ? ` · ${tourUi('tip', 'Tip')} ${featureIndex + 1} / ${features.length}` : ` · ${tourUi('aboutMinutes', `About ${step.minutes} min`, { duration: step.minutes === 1 ? 'umzuzu' : `imizuzu engu-${step.minutes}` })}`}</p>
      <p>{inView && feature ? feature.text : stepCopy.task}</p>
      {inView && features.length > 1 && <div className={styles.featureProgress} aria-label={tourUi('tipAria', `Tip ${featureIndex + 1} of ${features.length}: ${feature?.title ?? stepCopy.title}`, { current: featureIndex + 1, total: features.length, title: feature?.title ?? stepCopy.title })}>
        {features.map((tip, i) => {
          const translatedTip = productTourFeatureCopy(step.id, i, lang, tip)!;
          return <button key={tip.title} type="button" aria-label={tourUi('tipAria', `Tip ${i + 1}: ${tip.title}`, { current: i + 1, total: features.length, title: translatedTip.title })} aria-current={i === featureIndex ? 'step' : undefined} onClick={() => setFeatureIndex(i)} />;
        })}
      </div>}
      {error && <p role="alert">{productTourError(error, lang)}</p>}
      <div className={styles.controls}>
      {inView && featureIndex < features.length - 1 && <button type="button" className={styles.primary} onClick={() => setFeatureIndex(i => i + 1)}>{tourUi('nextTip', 'Next tip')}</button>}
      <button type="button" className={inView && featureIndex < features.length - 1 ? undefined : styles.primary} onClick={()=>inView ? setExpanded(false) : go(state.current)} disabled={!allowed(state.current)}>{inView ? tourUi('tryNow', 'Try it now') : tourUi('openView', 'Open this view')}</button>
      {step.secondaryHref && <Link href={step.secondaryHref} onClick={event=>{
        if (!state.active || !allowed(state.current) || !isSampleMode()) { event.preventDefault(); return; }
        // The optional crop, invoice, Lima and site-report actions are farm tools.
        if (!startRolePreview('farmer')) { event.preventDefault(); setError("The view could not open. Please try again."); return; }
        setExpanded(false);
        }}>{stepCopy.secondaryLabel}</Link>}</div>
      <p className={styles.hint}>{tourUi('hint', 'Tap Tour beside the menu whenever you want these tips back.')}</p>
      <div className={styles.controls}><button type="button" onClick={()=>next(true)} disabled={!ready}>{tourUi('exploredNext', 'I’ve explored this · Next')}</button><button type="button" onClick={()=>next(false)} disabled={!ready}>{tourUi('skip', 'Skip this stop')}</button></div>
      <div className={styles.controls}>{previous !== undefined && <button type="button" onClick={()=>go(previous)}>{tourUi('previous', 'Previous stop')}</button>}<Link href="/tour" onClick={()=>setExpanded(false)}>{tourUi('overview', 'Tour overview')}</Link><button type="button" onClick={()=>{if(save({...state,active:false}))setExpanded(false);}}>{tourUi('end', 'End tour')}</button></div>
    </dialog>
  </Context.Provider></TourDiscoveryProvider>;
}

export function ProductTourButton() {
  const tour = useProductTour();
  const { lang } = useLanguage();
  if (!tour?.active) return null;
  return <button type="button" className={styles.badge} data-lang={lang} onClick={tour.open} aria-label={productTourUi('buttonAria', lang, { current: tour.current + 1, total: PRODUCT_TOUR.length }) ?? `Tour guide, stop ${tour.current+1} of ${PRODUCT_TOUR.length}`}><span>{productTourUi('tour', lang) ?? 'Tour'}</span><strong>{tour.current+1}/{PRODUCT_TOUR.length}</strong></button>;
}
