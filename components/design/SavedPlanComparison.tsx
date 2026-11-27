'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './SavedPlanComparison.module.css';

import { ReviewImage, ReviewNotes, type ReviewActions, type PinDraft } from './IllustrationReview';
import type { DesignChange } from '@/lib/saved-design-changes';
import type { CorrectionPin } from '@/lib/map-correction-pins';

interface Pair { illustration: string; plan: string | null; oblique: boolean; changes:DesignChange[] | null }
type Side = 'plan' | 'illustration';

export default function SavedPlanComparison({ load, review, loadIllustration }: {
  loadIllustration: () => Promise<string | null>;
  review: ReviewActions;
  load: (active: () => boolean) => Promise<Pair | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panes = useRef<Partial<Record<Side, HTMLDivElement | null>>>({});
  const attempt = useRef(0);
  const [pair, setPair] = useState<Pair | null>(null);
  const [message, setMessage] = useState('');
  const [narrow, setNarrow] = useState(false);
  const [side, setSide] = useState<Side>('plan');
  const [zoom, setZoom] = useState(1);
  const [pins, setPins] = useState<CorrectionPin[]>([]);
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const [placing, setPlacing] = useState(false);
  const [pinsError, setPinsError] = useState('');
  const centres = useRef<Record<Side, [number, number]>>({ plan: [.5,.5], illustration: [.5,.5] });

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const changed = () => setNarrow(query.matches);
    changed();
    query.addEventListener('change', changed);
    return () => { attempt.current++; query.removeEventListener('change', changed); };
  }, []);
  const open = async () => {
    const ticket = ++attempt.current;
    const active = () => ticket === attempt.current && !!dialog.current?.open;
    dialog.current?.showModal();
    setMessage('Opening the plan saved with this illustration…');
    try {
      let result = await load(active);
      if (!result && active()) {
        const illustration = await loadIllustration();
        if (illustration) result = {illustration,plan:null,oblique:false,changes:null};
      }
      if (!active()) return;
      if (result) {
        try { const saved = await review.pins(); if (active()) setPins(saved); }
        catch { if (active()) setPinsError('Pins are unavailable on this device.'); }
      }
      if (!active()) return;
      setPair(result);
      if (result && !result.plan) setSide('illustration');
      setMessage(result?.plan ? '' : 'The original plan is unavailable for this saved illustration.');
    } catch {
      if (active()) setMessage('The saved plan could not be opened. Close and try again when connected.');
    }
  };

  const remember = (which: Side) => {
    const el = panes.current[which];
    if (!el?.clientWidth) return;
    centres.current[which] = [(el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
      (el.scrollTop + el.clientHeight / 2) / el.scrollHeight];
  };
  const position = (which: Side, centre: [number, number]) => {
    const el = panes.current[which];
    if (!el?.clientWidth) return;
    const x = centre[0] * el.scrollWidth - el.clientWidth / 2;
    const y = centre[1] * el.scrollHeight - el.clientHeight / 2;
    if (Math.abs(el.scrollLeft - x) > 1) el.scrollLeft = x;
    if (Math.abs(el.scrollTop - y) > 1) el.scrollTop = y;
  };
  useLayoutEffect(() => {
    for (const which of ['plan','illustration'] as const) position(which, centres.current[which]);
  }, [zoom, side, pair, narrow]);

  return <>
    <button type="button" ref={opener} className={styles.action} aria-haspopup="dialog" onClick={() => void open()}>Compare with saved plan</button>
    <dialog ref={dialog} className={styles.dialog} aria-label="Compare with saved plan" aria-modal="true"
      onKeyDown={e => { if (e.key === 'Escape') e.stopPropagation(); }}
      onClose={() => {
        attempt.current++;
        setPins([]); setDraft(null); setPlacing(false); setPinsError('');
        setPair(null); setMessage(''); setSide('plan'); setZoom(1);
        centres.current = {plan:[.5,.5], illustration:[.5,.5]};
        opener.current?.focus({preventScroll:true});
      }}>
      <header><h2>Compare with saved plan</h2><form method="dialog"><button autoFocus>Close</button></form></header>
      {message && <p role="status">{message}</p>}
      {pair && <>
        <div className={styles.toolbar}>
          {pair.plan && <div className={styles.tabs} aria-label="Map to inspect">
            {(['plan','illustration'] as const).map(which => <button key={which} type="button" aria-pressed={side === which}
              onClick={() => {
                remember(side);
                if (!pair.oblique) centres.current[which] = centres.current[side];
                setSide(which);
              }}>{which === 'plan' ? 'Saved plan' : 'AI illustration'}</button>)}
          </div>}
          <label>Zoom <select value={zoom} onChange={e => {
            remember('plan'); remember('illustration');
            setZoom(Number(e.target.value));
          }}><option value={1}>Fit</option><option value={1.5}>150%</option><option value={2}>200%</option><option value={3}>300%</option></select></label>
        </div>
        {pair.oblique && <p>Compare landmarks between the overhead plan and the oblique illustration. Each view can be panned separately.</p>}
        <div className={styles.panes} data-single={!pair.plan}>
          {(['plan','illustration'] as const).filter(which => (which !== 'plan' || pair.plan) && (!narrow || which === side)).map(which => <section key={which} data-selected={which === side}>
            <h3>{which === 'plan' ? 'Saved plan' : 'AI illustration'}</h3>
            <div className={styles.viewport} tabIndex={0} role="region" aria-label={which === 'plan' ? 'Saved plan detail' : 'AI illustration detail'}
              ref={el => { panes.current[which] = el; }}
              onScroll={() => {
                remember(which);
                const other = which === 'plan' ? 'illustration' : 'plan';
                if (!pair.oblique && panes.current[which]?.clientWidth) {
                  centres.current[other] = centres.current[which];
                  position(other, centres.current[which]);
                }
              }}>
              <div style={{width: zoom * 100 + '%', height: zoom * 100 + '%'}}>
                {which === 'plan' ? <img src={pair.plan ?? undefined} alt="Exact map from the original saved design" /> :
                  <ReviewImage image={pair.illustration} pins={pins} placing={placing} place={point => {
                    setDraft({next:{id:crypto.randomUUID(),...point,note:''}}); setPlacing(false);
                  }} edit={pin => { setPlacing(false); setDraft({previous:pin,next:{...pin}}); }} />}
              </div>
            </div>
          </section>)}
        </div>
        <details className={styles.changes}><summary>What changed since this render?</summary>
          {pair.changes === null ? <p>The original and current plans must both be available to show changes.</p> :
            pair.changes.length === 0 ? <p>No changes to the saved site layout or design settings.</p> : <>
              <p>Original saved plan compared with the current design for the whole site.</p>
              <ul>{pair.changes.map(row => <li key={row.action + ':' + row.name}><strong>{row.action}</strong> · {row.count > 1 ? row.count + ' × ' : ''}{row.name}</li>)}</ul>
            </>}
        </details>
        {pinsError ? <p role="status">{pinsError}</p> : <ReviewNotes actions={pair.plan ? review : {...review,render:undefined,renderLabel:'Original inputs are unavailable for this saved illustration.'}} pins={pins} setPins={setPins}
          draft={draft} setDraft={setDraft} placing={placing} illustration={pair.illustration}
          begin={() => { if (narrow && side !== 'illustration') {
            remember(side); if (!pair.oblique) centres.current.illustration = centres.current.plan;
          } setSide('illustration'); setPlacing(true); }}
          cancel={() => {setPlacing(false); setDraft(null);}} done={() => dialog.current?.close()} />}
      </>}
    </dialog>
  </>;
}
