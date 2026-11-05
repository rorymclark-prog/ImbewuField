'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { isJournalDate, MAX_NOTES_LEN } from '@/lib/field-journal';
import type { GrowerFieldObservationResult, GrowerNurserySowingInput } from '@/lib/grower-field-observation';
import type { GrowerSavedNurseryReview } from './useGrowerWorkflow';

export interface NurserySowingObservationFormProps {
  view: GrowerSavedNurseryReview;
  plantingId: string;
  contextRevision: number;
  sample?: boolean;
  onRecord: (input: GrowerNurserySowingInput, displayedIsCurrent: () => boolean) => Promise<GrowerFieldObservationResult>;
}
type Draft = { observedDate: string; note: string; trays: string; confirmed: boolean };
type Intent = { draft: Draft; isCurrent: () => boolean };
const blank = (): Draft => ({ observedDate: '', note: '', trays: '', confirmed: false });
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
function trayCount(text: string): number | null | undefined {
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return undefined;
  const count = Number(text);
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

export default function NurserySowingObservationForm(props: NurserySowingObservationFormProps) {
  const [draft, setDraft] = useState(blank), [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<GrowerFieldObservationResult | null>(null), [message, setMessage] = useState('');
  const id = useId(), active = useRef(true), generation = useRef(0), waiting = useRef(false), consumed = useRef(false);
  const live = useRef(props); live.current = props;
  const draftRef = useRef(draft); draftRef.current = draft;
  const intent = useRef<Intent | null>(null);
  const original = useRef({ view: props.view, plantingId: props.plantingId, revision: props.contextRevision, sample: props.sample });
  const row = props.view.references.find(value => value.plantingId === props.plantingId);
  const current = () => active.current && live.current.view === original.current.view && live.current.plantingId === original.current.plantingId
    && live.current.contextRevision === original.current.revision && live.current.sample === original.current.sample;
  function makeIntent(snapshot: Draft): Intent {
    const next: Intent = { draft: snapshot, isCurrent: () => current() && intent.current === next && draftRef.current === snapshot && !consumed.current };
    return next;
  }
  if (!intent.current) intent.current = makeIntent(draft);
  const eligible = row?.reference.status === 'ready';
  const count = trayCount(draft.trays);
  const valid = isJournalDate(draft.observedDate) && !!draft.note.trim() && draft.note.length <= MAX_NOTES_LEN && count !== undefined && draft.confirmed;
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  function change(patch: Partial<Draft>) {
    if (!current() || draftRef.current !== draft || waiting.current || consumed.current) return;
    generation.current++; const next = { ...draft, ...patch }; draftRef.current = next; intent.current = makeIntent(next); setDraft(next); setOutcome(null); setMessage('');
  }
  async function submit() {
    if (!current() || !eligible || !valid || draftRef.current !== draft || waiting.current || consumed.current || count === undefined) return;
    const turn = ++generation.current, displayedIsCurrent = intent.current!.isCurrent;
    waiting.current = true; setPending(true); setMessage('');
    try {
      const result = await props.onRecord({ observedDate: draft.observedDate, note: draft.note, traysUsed: count, confirmed: true }, displayedIsCurrent);
      if (generation.current !== turn || !displayedIsCurrent()) return;
      if (result.status === 'saved' || result.status === 'unconfirmed') consumed.current = true;
      setOutcome(result);
    } catch {
      if (displayedIsCurrent()) setMessage('The journal outcome could not be confirmed. Inspect the journal before recording this observation again.');
      // An exception may follow an attempted effect. It is never an automatic
      // retry or permission to spend this same form intent a second time.
      if (displayedIsCurrent()) consumed.current = true;
    } finally { if (active.current && generation.current === turn) { waiting.current = false; setPending(false); } }
  }
  function another() {
    if (!current() || draftRef.current !== draft || waiting.current || outcome?.status !== 'saved') return;
    generation.current++; consumed.current = false; const next = blank(); draftRef.current = next; intent.current = makeIntent(next); setDraft(next); setOutcome(null); setMessage('');
  }
  if (!current() || !eligible) return <p role="status">This observed-sowing form belongs to an earlier checked batch. Check saved nursery batches before opening a new observation.</p>;
  const locked = pending || consumed.current;
  return <section lang="en" aria-label="Record observed nursery sowing" className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-3 [overflow-wrap:anywhere]">
    <h6 className="font-semibold">Record actual nursery sowing</h6>
    <p>Enter what you observed, separately from the planned dates and quantities. This journal note does not change stock, tasks or nursery estimates.</p>
    {props.sample && <p className="font-semibold">DEMO — this observation stays in the sample session.</p>}
    {row.reference.status === 'ready' && <div>
      <p>Checked labels to snapshot with this observation; they do not verify seed identity:</p>
      <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">{([
        ['Variety / cultivar', row.reference.fields.variety], ['Seed-lot reference', row.reference.fields.seedLotReference], ['Raising-batch reference', row.reference.fields.raisingBatchReference],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl>
    </div>}
    <label htmlFor={`${id}-date`} className="block">Actual observed day<input id={`${id}-date`} type="date" className={field} value={draft.observedDate} disabled={locked} onChange={event => change({ observedDate: event.target.value })} /></label>
    <label htmlFor={`${id}-note`} className="block">What you observed<textarea id={`${id}-note`} className={field} rows={3} maxLength={MAX_NOTES_LEN} value={draft.note} disabled={locked} onChange={event => change({ note: event.target.value })} /></label>
    <label htmlFor={`${id}-trays`} className="block">Physical trays used (optional)<input id={`${id}-trays`} type="text" inputMode="numeric" className={field} value={draft.trays} disabled={locked} onChange={event => change({ trays: event.target.value })} /></label>
    <p>Count whole physical trays used, including partly filled trays. Leave blank for unknown or other containers. An entered 0 means zero trays.</p>
    <label htmlFor={`${id}-confirm`} className="flex min-h-11 items-center gap-2"><input id={`${id}-confirm`} type="checkbox" checked={draft.confirmed} disabled={locked} onChange={event => change({ confirmed: event.target.checked })} />I confirm this day, note and tray count describe what I observed.</label>
    <button type="button" className={button} disabled={!valid || locked} onClick={() => void submit()}>{pending ? 'Recording observed sowing…' : 'Save nursery sowing observation'}</button>
    <div role="status" aria-live="polite">
      {outcome && <p>{outcome.message}</p>}{message && <p>{message}</p>}
      {(outcome?.status === 'unconfirmed' || message && consumed.current) && <p>Inspect the journal before recording again. There is no automatic retry. After reviewing the journal and checking saved batches, start a new observation only if needed.</p>}
      {(outcome?.status === 'saved' || outcome?.status === 'unconfirmed' || message && consumed.current) && <Link className={`${button} inline-flex items-center underline`} href="/journal" prefetch={false}>Open journal</Link>}
      {outcome?.status === 'saved' && <button type="button" className={button} onClick={another}>Record another nursery sowing</button>}
    </div>
  </section>;
}
