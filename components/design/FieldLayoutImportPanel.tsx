'use client';

import { useEffect, useRef, useState } from 'react';

export interface FieldImportPanelReview {
  readonly status: 'review';
  readonly candidates: readonly {
    readonly id: string;
    readonly name: string;
    readonly status: 'ready' | 'held';
    readonly points?: readonly (readonly [number, number])[];
    readonly reasons?: readonly string[];
    readonly conflictingCandidateIds?: readonly string[];
  }[];
  readonly excludedPlacemarkCount: number;
}
export type FieldImportPanelResult = FieldImportPanelReview | { readonly status: 'held'; readonly message: string };
export interface FieldLayoutImportPanelProps {
  readonly contextKey: string | null;
  readonly sample: boolean;
  readonly onRead: (file: File, formIsCurrent: () => boolean) => Promise<FieldImportPanelResult>;
  readonly onAppend: (review: FieldImportPanelReview, ids: readonly string[], formIsCurrent: () => boolean) => Promise<{
    readonly status: 'applied' | 'held'; readonly message: string;
  }>;
  readonly onDiscard?: (review: FieldImportPanelReview) => void;
}

const control = { minHeight: 44, maxWidth: '100%', border: '1px solid #a8b5a8', borderRadius: 7,
  padding: '6px 8px', background: '#fffdf7', color: '#203d32', whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const };
const outlinePoints = (points: FieldImportPanelReview['candidates'][number]['points']): string | null =>
  points && points.length >= 3 && points.every(point => point.length === 2 && point.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
    ? points.map(point => `${point[0] * 100},${point[1] * 100}`).join(' ') : null;

/** Preview data stays in this form. Only the parent's explicit append action
 * can turn a reviewed outline into a saved field. */
export default function FieldLayoutImportPanel(props: FieldLayoutImportPanelProps) {
  const live = useRef(props); live.current = props;
  const active = useRef(true), mountedEpoch = useRef<object>({});
  const generation = useRef<object>({});
  const priorContext = useRef({ key: props.contextKey, sample: props.sample });
  if (priorContext.current.key !== props.contextKey || priorContext.current.sample !== props.sample) {
    priorContext.current = { key: props.contextKey, sample: props.sample };
    generation.current = {};
  }
  const renderedGeneration = generation.current;
  const pending = useRef<object | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<'read' | 'append' | null>(null);
  const [file, setFile] = useState<{ generation: object; value: File } | null>(null);
  const [preview, setPreview] = useState<{ generation: object; value: FieldImportPanelReview } | null>(null);
  const reviewLive = useRef<FieldImportPanelReview | null>(null);
  const reviewEpoch = useRef<object | null>(null);
  const discarders = useRef(new WeakMap<FieldImportPanelReview, FieldLayoutImportPanelProps['onDiscard']>());
  const discarded = useRef(new WeakSet<FieldImportPanelReview>());
  const appliedDiscards = useRef<FieldImportPanelReview[]>([]);
  const effectContext = useRef({ key: props.contextKey, sample: props.sample });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const selectedLive = useRef(selected);
  const [confirmed, setConfirmed] = useState(false);
  const confirmedLive = useRef(false);
  const [feedback, setFeedback] = useState<{ generation: object; held: boolean; message: string } | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false; mountedEpoch.current = {};
      discard(reviewLive.current); reviewLive.current = null;
      for (const value of appliedDiscards.current) discard(value);
      appliedDiscards.current = [];
    };
  }, []);
  useEffect(() => {
    if (effectContext.current.key === props.contextKey && effectContext.current.sample === props.sample) return;
    effectContext.current = { key: props.contextKey, sample: props.sample };
    if (reviewEpoch.current !== generation.current) { discard(reviewLive.current); reviewLive.current = null; }
    for (const value of appliedDiscards.current) discard(value);
    appliedDiscards.current = [];
  }, [props.contextKey, props.sample]);

  const contextCurrent = (epoch: object) => active.current && generation.current === epoch
    && props.contextKey !== null && props.contextKey === live.current.contextKey && props.sample === live.current.sample;
  const shownFile = file?.generation === renderedGeneration ? file.value : null;
  const review = preview?.generation === renderedGeneration ? preview.value : null;
  const selections = review ? selected : [];
  const duplicateIds = !!review && new Set(review.candidates.map(candidate => candidate.id)).size !== review.candidates.length;
  const selectable = (candidate: FieldImportPanelReview['candidates'][number]) => candidate.status === 'ready'
    && candidate.id.trim() !== '' && !duplicateIds && outlinePoints(candidate.points) !== null;
  const conflicts = !!review && review.candidates.some(candidate => selections.includes(candidate.id)
    && candidate.conflictingCandidateIds?.some(id => selections.includes(id)));

  function discard(value: FieldImportPanelReview | null) {
    if (!value || discarded.current.has(value)) return;
    discarded.current.add(value);
    try { discarders.current.get(value)?.(value); } catch { /* Withdrawing a form must still hide its stale preview. */ }
  }
  function withdraw(nextFile: File | null = null, applied = false) {
    const epoch = {}; generation.current = epoch;
    if (applied && reviewLive.current) appliedDiscards.current.push(reviewLive.current);
    else discard(reviewLive.current);
    reviewLive.current = null; selectedLive.current = []; confirmedLive.current = false;
    setPreview(null); setSelected([]); setConfirmed(false); setFeedback(null);
    setFile(nextFile ? { generation: epoch, value: nextFile } : null);
    return epoch;
  }
  function chooseFile(next: File | null) {
    if (!active.current || generation.current !== renderedGeneration) return;
    withdraw(next);
  }
  function cancel() {
    if (!active.current || generation.current !== renderedGeneration) return;
    withdraw(); if (fileInput.current) fileInput.current.value = '';
  }
  async function read() {
    if (!contextCurrent(renderedGeneration) || pending.current || !shownFile) return;
    const epoch = withdraw(shownFile), mount = mountedEpoch.current, token = {};
    // The read's form proof remains usable for this displayed review. Finishing
    // its promise must not withdraw the parent's later explicit append check.
    const current = () => contextCurrent(epoch) && mountedEpoch.current === mount;
    const onDiscard = live.current.onDiscard;
    pending.current = token; setBusy('read');
    try {
      // Reading the file belongs to the same parent that checks its saved map.
      const result = await live.current.onRead(shownFile, current);
      if (result.status === 'review') discarders.current.set(result, onDiscard);
      if (!current()) { if (result.status === 'review') discard(result); return; }
      if (result.status === 'held') setFeedback({ generation: epoch, held: true, message: result.message });
      else { reviewLive.current = result; reviewEpoch.current = epoch; setPreview({ generation: epoch, value: result }); }
    } catch {
      if (current()) setFeedback({ generation: epoch, held: true, message: 'Could not read this KML file. Check the file and try again.' });
    } finally {
      if (pending.current === token) { pending.current = null; if (active.current) setBusy(null); }
    }
  }
  function select(id: string, checked: boolean) {
    if (!contextCurrent(renderedGeneration) || pending.current || reviewLive.current !== review || !review) return;
    const candidate = review.candidates.find(row => row.id === id);
    if (!candidate || !selectable(candidate)) return;
    const next = checked ? [...new Set([...selectedLive.current, id])] : selectedLive.current.filter(value => value !== id);
    selectedLive.current = next; confirmedLive.current = false;
    setSelected(next); setConfirmed(false); setFeedback(null);
  }
  function confirm(value: boolean) {
    if (!contextCurrent(renderedGeneration) || pending.current || !review || reviewLive.current !== review) return;
    confirmedLive.current = value; setConfirmed(value);
  }
  async function append() {
    if (!contextCurrent(renderedGeneration) || pending.current || !review || reviewLive.current !== review
      || selectedLive.current !== selected || confirmedLive.current !== confirmed
      || !confirmedLive.current || !selections.length || conflicts || duplicateIds
      || selections.some(id => !review.candidates.some(candidate => candidate.id === id && selectable(candidate)))) return;
    const ids = selectedLive.current, epoch = renderedGeneration, mount = mountedEpoch.current, token = {};
    const current = () => contextCurrent(epoch) && mountedEpoch.current === mount && pending.current === token
      && reviewLive.current === review && selectedLive.current === ids && confirmedLive.current;
    pending.current = token; setBusy('append'); setFeedback(null);
    try {
      const result = await live.current.onAppend(review, Object.freeze([...ids]), current);
      if (!current()) return;
      if (result.status === 'applied') {
        // The parent may still replay its queued saved-state updater. Release
        // that proof when its resulting context arrives, not before the replay.
        const next = withdraw(null, true); if (fileInput.current) fileInput.current.value = '';
        setFeedback({ generation: next, held: false, message: result.message });
      } else setFeedback({ generation: epoch, held: true, message: result.message });
    } catch {
      if (current()) setFeedback({ generation: epoch, held: true, message: 'Could not add these outlines. Check the current saved layout before trying again.' });
    } finally {
      if (pending.current === token) { pending.current = null; if (active.current) setBusy(null); }
    }
  }

  return <details lang="en" style={{ padding: 10, border: '1px solid #a8b5a8', borderRadius: 10, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', background: '#f3f6ed', color: '#203d32' }}>
    <summary style={{ minHeight: 44, cursor: 'pointer', fontWeight: 700 }}>Import field outlines from Google Earth{props.sample ? ' · DEMO' : ''}</summary>
    <section aria-label="Import field outlines" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <p style={{ fontSize: 12 }}>Choose a local KML file, review its outlines, then choose which to add. Nothing is saved during preview. Map-reference locations are not surveyed boundaries.</p>
      <p style={{ fontSize: 12 }}>Import adds outlines only. Afterwards, choose open field or configure beds and paths in the field settings.</p>
      {props.sample && <p role="note">DEMO: these outlines belong to the sample, not your personal layout.</p>}
      {props.contextKey === null && <p role="alert">Open a current saved satellite layout before importing outlines.</p>}
      <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>Local KML file
        <input ref={fileInput} type="file" accept=".kml,application/vnd.google-earth.kml+xml" aria-label="Local KML file"
          disabled={props.contextKey === null} onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          style={{ ...control, width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
      </label>
      {shownFile && <p style={{ fontSize: 12, margin: 0 }}>Selected file: {shownFile.name}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" style={control} disabled={!!busy || !shownFile || props.contextKey === null} onClick={read}>Preview outlines</button>
        <button type="button" style={control} onClick={cancel}>Cancel import</button>
      </div>
      {busy && <p role="status">{busy === 'read' ? 'Reading outlines…' : 'Adding selected outlines…'}</p>}
      {review && <>
        <p style={{ fontSize: 12 }}>No outlines are selected automatically. Choose only the fields you intend to add. Nested or overlapping outlines may be beds inside a larger field; do not add both.</p>
        <p style={{ fontSize: 12 }}>Excluded placemarks: {review.excludedPlacemarkCount}.</p>
        {review.candidates.length === 0 && <p role="note">No supported outlines are available to add.</p>}
        {duplicateIds && <p role="alert">These outlines could not be identified separately. Choose another file.</p>}
        <svg viewBox="0 0 100 100" role="img" aria-label="Temporary outline preview" style={{ width: '100%', maxHeight: 260, aspectRatio: '1', border: '1px solid #a8b5a8', background: '#f3f6ef' }}>
          {review.candidates.map((candidate, index) => {
            const points = outlinePoints(candidate.points); if (!points) return null;
            const chosen = selections.includes(candidate.id);
            return <polygon key={`${candidate.id}:${index}`} points={points} fill={chosen ? '#38734655' : '#84938322'}
              stroke={candidate.status === 'held' ? '#956036' : chosen ? '#20582d' : '#647264'} strokeWidth={chosen ? 1 : 0.5}>
              <title>{candidate.name || `Outline ${index + 1}`}{candidate.status === 'held' ? ' — held' : chosen ? ' — selected' : ''}</title>
            </polygon>;
          })}
        </svg>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8, minWidth: 0 }}>
          {review.candidates.map((candidate, index) => <li key={`${candidate.id}:${index}`} style={{ border: '1px solid #a8b5a8', borderRadius: 7, padding: 8, minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
              <input type="checkbox" aria-label={`Select outline ${index + 1}`} checked={selections.includes(candidate.id)}
                disabled={!!busy || !selectable(candidate)} onChange={event => select(candidate.id, event.target.checked)} />
              <span style={{ minWidth: 0 }}>{candidate.name || `Outline ${index + 1}`}{!selectable(candidate) ? ' · held' : ''}</span>
            </label>
            {candidate.reasons?.map((reason, reasonIndex) => <p key={reasonIndex} style={{ fontSize: 12, margin: '4px 0' }}>{reason}</p>)}
            {candidate.status === 'ready' && !outlinePoints(candidate.points) && <p style={{ fontSize: 12 }}>This outline cannot be shown for review. Choose another file.</p>}
          </li>)}
        </ul>
        {conflicts && <p role="alert">Selected outlines overlap or contain one another. Choose a non-overlapping set before adding fields.</p>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <input type="checkbox" aria-label="Confirm selected outlines" checked={confirmed} disabled={!!busy || !selections.length || conflicts}
            onChange={event => confirm(event.target.checked)} />I reviewed the selected outlines and want to add them as new fields.
        </label>
        <button type="button" style={control} disabled={!!busy || !selections.length || !confirmed || conflicts || duplicateIds} onClick={append}>Add selected outlines</button>
      </>}
      {feedback?.generation === renderedGeneration && <p role={feedback.held ? 'alert' : 'status'}>{feedback.message}</p>}
    </section>
  </details>;
}
