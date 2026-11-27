'use client';
import { useState } from 'react';
import { MAX_CORRECTION_NOTE, MAX_CORRECTION_PINS, type CorrectionPin } from '@/lib/map-correction-pins';
import styles from './SavedPlanComparison.module.css';

export interface ReviewActions {
  pins: () => Promise<CorrectionPin[]>;
  save: (change: { previous?: CorrectionPin; next?: CorrectionPin }) => Promise<CorrectionPin[]>;
  render?: (pins: CorrectionPin[], illustration: string) => Promise<void>;
  renderLabel: string;
}

export function ReviewImage({ image, pins, placing, place, edit }: {
  image: string; pins: CorrectionPin[]; placing: boolean;
  place: (point: {x:number; y:number}) => void; edit: (pin: CorrectionPin) => void;
}) {
  const [ratio, setRatio] = useState(1);
  return <div className={styles.imageBox}>
    <div className={styles.artwork} style={{width: `min(100cqw, ${ratio * 100}cqh)`, aspectRatio:ratio}}>
      <img src={image} alt="Saved AI illustration" onLoad={e => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
      {placing && <button type="button" className={styles.place} aria-label="Place correction pin on illustration"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          place(e.detail ? {x:Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width)), y:Math.min(1,Math.max(0,(e.clientY-rect.top)/rect.height))} : {x:.5,y:.5});
        }} />}
      {pins.map((pin,i) => <button type="button" key={pin.id} className={styles.pin} title={pin.note}
        style={{left:pin.x*100+'%',top:pin.y*100+'%'}} aria-label={`Edit pin ${i+1}: ${pin.note}`}
        onClick={() => edit(pin)}>{i+1}</button>)}
    </div>
  </div>;
}

export interface PinDraft { previous?: CorrectionPin; next: CorrectionPin }

export function ReviewNotes({ actions, pins, setPins, draft, setDraft, placing, begin, cancel, illustration, done }: {
  actions: ReviewActions; pins: CorrectionPin[]; setPins: (pins: CorrectionPin[]) => void;
  draft: PinDraft | null; setDraft: (draft: PinDraft | null) => void; placing: boolean;
  begin: () => void; cancel: () => void; illustration: string; done: () => void;
}) {
  const [selected, select] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const chosen = pins.filter(pin => selected.includes(pin.id));
  async function save(remove: boolean) {
    if (!draft || busy) return;
    setError(''); setBusy(true);
    try {
      const result = await actions.save({previous:draft.previous, next:remove ? undefined : {...draft.next,note:draft.next.note.trim()}});
      setPins(result); setDraft(null); setConfirm(false);
      if (remove) select(ids => ids.filter(id => id !== draft.next.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this change.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.notes} aria-label="Correction pins">
    <div className={styles.reviewHead}><h3>Correction pins{pins.length ? ' (' + pins.length + ')' : ''}</h3>
      {!placing && !draft && !confirm && <button type="button" disabled={busy || pins.length >= MAX_CORRECTION_PINS}
        onClick={() => {setError(''); begin();}}>Mark a correction</button>}</div>
    {placing && <p role="status">Tap a spot on the illustration. <button type="button" onClick={cancel}>Cancel</button></p>}
    {draft && <form className={styles.editor} onSubmit={e => {e.preventDefault(); void save(false);}}>
      <label>Correction note<textarea autoFocus maxLength={MAX_CORRECTION_NOTE} value={draft.next.note}
        onChange={e => setDraft({...draft,next:{...draft.next,note:e.target.value}})} /></label>
      <div><button disabled={busy || !draft.next.note.trim()}>Save pin</button>
        <button type="button" disabled={busy} onClick={cancel}>Cancel</button>
        {draft.previous && <button type="button" disabled={busy} onClick={() => void save(true)}>Delete pin</button>}</div>
    </form>}
    {!!pins.length && !draft && !placing && <>
      <p>Select the corrections to include in a new illustration.</p>
      <ol>{pins.map((pin,i) => <li key={pin.id}>
        <label><input type="checkbox" disabled={busy || confirm} checked={selected.includes(pin.id)}
          onChange={e => select(e.target.checked ? [...selected,pin.id] : selected.filter(id => id !== pin.id))} />
          <span>{i+1}. {pin.note}</span></label>
        {!confirm && <button type="button" disabled={busy} aria-label={`Edit correction ${i+1}`} onClick={() => setDraft({previous:pin,next:{...pin}})}>Edit</button>}
      </li>)}</ol>
      {actions.render ? chosen.length > 0 && (confirm ? <div className={styles.confirm}>
        <p>Create one paid illustration from the original saved design and {chosen.length} selected {chosen.length === 1 ? 'correction' : 'corrections'}? {actions.renderLabel}. Your existing illustration stays in Saved maps.</p>
        <button type="button" disabled={busy} onClick={async () => {
          if (!actions.render || busy) return;
          setBusy(true); setError('');
          try { await actions.render(chosen,illustration); done(); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not start the corrected render.'); }
          finally { setBusy(false); }
        }}>{busy ? 'Preparing illustration…' : 'Start one paid render'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
      </div> : <button type="button" onClick={() => setConfirm(true)}>Review selected corrections</button>) :
        <p>{actions.renderLabel}</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
