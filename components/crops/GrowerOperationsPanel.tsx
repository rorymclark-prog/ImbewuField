'use client';

import { useEffect, useRef, useState } from 'react';
import type { CropPlanState } from '@/lib/crop-plan';
import type { GrowerCycleContext } from '@/lib/international/grower-cycle';
import { buildGrowerBoardTasks, downloadTaskIcs, loadCompletedTaskIds, setCompletedTaskState, type BoardTask } from '@/lib/task-board';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { isJournalDate, MAX_NOTES_LEN } from '@/lib/field-journal';
import type { GrowerFieldObservationInput, GrowerFieldObservationResult } from '@/lib/grower-field-observation';
export type { GrowerFieldObservationInput as GrowerObservationInput, GrowerFieldObservationResult as GrowerObservationResult } from '@/lib/grower-field-observation';

export interface GrowerOperationsPanelProps {
  state: { status: 'loading' | 'held' | 'ready'; book: CropPlanState | null;
    contexts: readonly GrowerCycleContext[]; heldSources: readonly unknown[] };
  refresh: () => Promise<void>;
  checkCurrent: () => Promise<boolean>;
  isCurrent: () => boolean;
  now?: Date;
  sample?: boolean;
  onRecordObservation?: (task: BoardTask, input: GrowerFieldObservationInput, formIsCurrent: () => boolean) => Promise<GrowerFieldObservationResult>;
}
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const field = 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';
type ObservationDraft = { epoch: number; state: GrowerOperationsPanelProps['state']; task: BoardTask;
  sample: boolean; propSample: boolean | undefined; observedDate: string; note: string; confirmed: boolean };
const linkedTask = (task: BoardTask) => task.kind === 'grower-cycle' && 'growerJournalLink' in task
  && !!task.growerJournalLink && typeof task.growerJournalLink === 'object';

/** Exact grower dates have their own section; month-only catalogue jobs keep
 * their existing precision. Completion is a checklist, not a harvest record. */
export default function GrowerOperationsPanel(props: GrowerOperationsPanelProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [clientSample, setClientSample] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const generation = useRef(0), live = useRef(props); live.current = props;
  const state = props.state;
  const observationEpoch = useRef(0), observationActive = useRef(true), observationPending = useRef<object | null>(null);
  const observationContext = useRef({ state, sample: props.sample });
  const [observation, setObservation] = useState<ObservationDraft | null>(null);
  const observationLive = useRef<ObservationDraft | null>(null);
  const [observationSaving, setObservationSaving] = useState(false);
  const [observationBlocked, setObservationBlocked] = useState(false);
  const blockedLive = useRef(false);
  const [observationMessage, setObservationMessage] = useState<{ epoch: number; status: 'saved' | 'held' | 'unconfirmed'; text: string } | null>(null);
  if (observationContext.current.state !== state || observationContext.current.sample !== props.sample) {
    observationContext.current = { state, sample: props.sample }; observationEpoch.current++;
    observationLive.current = null;
  }
  useEffect(() => {
    generation.current++; setBusy(false); setMessage(''); setCompleted(loadCompletedTaskIds()); setClientSample(isSampleMode());
  }, [state]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    observationActive.current = true;
    const sampleChanged = () => { withdrawObservation(); setClientSample(isSampleMode()); };
    window.addEventListener(SAMPLE_MODE_EVENT, sampleChanged);
    return () => {
      observationActive.current = false; observationEpoch.current++; observationLive.current = null;
      window.removeEventListener(SAMPLE_MODE_EVENT, sampleChanged);
    };
  }, []);
  const result = state.status === 'ready' && state.book
    ? buildGrowerBoardTasks(state.book.plantings, state.contexts, props.now ?? new Date(), completed)
    : { tasks: [], heldPlantings: 0 };
  // Sample mode is device state. Reading it during the first render inserted
  // a DEMO paragraph absent from server HTML and broke real tour hydration.
  const sample = props.sample === true || clientSample;
  const noSavedPlan = state.status === 'held' && state.heldSources.some(source =>
    !!source && typeof source === 'object' && 'reason' in source && source.reason === 'no-saved-plan');
  const currentObservation = observation?.epoch === observationEpoch.current && observationLive.current === observation ? observation : null;
  const actionBusy = busy || observationSaving;
  function sourceIsCurrent(): boolean {
    try { return live.current.isCurrent(); } catch { return false; }
  }
  function withdrawObservation() {
    observationEpoch.current++; observationLive.current = null; setObservation(null); setObservationMessage(null);
  }
  function openObservation(task: BoardTask) {
    if (observationPending.current || blockedLive.current || busy || state !== live.current.state
      || state.status !== 'ready' || !linkedTask(task) || !live.current.onRecordObservation) return;
    if (!sourceIsCurrent()) {
      setObservationMessage({ epoch: observationEpoch.current, status: 'held', text: 'The saved plan or design changed. Check its current records before recording an observation.' }); return;
    }
    const next: ObservationDraft = { epoch: ++observationEpoch.current, state, task, sample: isSampleMode(),
      propSample: props.sample, observedDate: '', note: '', confirmed: false };
    observationLive.current = next; setObservation(next); setObservationMessage(null);
  }
  function draftCurrent(draft: ObservationDraft): boolean {
    return observationActive.current && observationEpoch.current === draft.epoch && observationLive.current === draft
      && live.current.state === draft.state && live.current.sample === draft.propSample
      && isSampleMode() === draft.sample && observationEpoch.current === draft.epoch;
  }
  function editObservation(draft: ObservationDraft, change: Partial<Pick<ObservationDraft, 'observedDate' | 'note' | 'confirmed'>>) {
    if (observationPending.current || blockedLive.current || !draftCurrent(draft)) return;
    const next = { ...draft, ...change, ...('confirmed' in change ? {} : { confirmed: false }) };
    observationLive.current = next; setObservation(next); setObservationMessage(null);
  }
  async function saveObservation(draft: ObservationDraft) {
    if (observationPending.current || blockedLive.current || !draftCurrent(draft) || !linkedTask(draft.task)) return;
    if (!isJournalDate(draft.observedDate) || !draft.note.trim() || draft.note.length > MAX_NOTES_LEN || !draft.confirmed) {
      setObservationMessage({ epoch: draft.epoch, status: 'held', text: 'Enter the date you observed this, write a note, and confirm it is your own observation.' }); return;
    }
    const recorder = live.current.onRecordObservation; if (!recorder) return;
    const token = {}; observationPending.current = token; setObservationSaving(true); setObservationMessage(null);
    const current = () => observationPending.current === token && draftCurrent(draft) && !!live.current.onRecordObservation
      && sourceIsCurrent() && draftCurrent(draft);
    let attempted = false;
    try {
      const checked = await live.current.checkCurrent();
      if (!current()) return;
      if (!checked || !live.current.isCurrent() || !current()) {
        setObservationMessage({ epoch: draft.epoch, status: 'held', text: 'The saved plan or design changed. Check its current records before recording an observation.' }); return;
      }
      const input: GrowerFieldObservationInput = Object.freeze({ observedDate: draft.observedDate, note: draft.note, confirmed: true });
      attempted = true;
      const outcome = await recorder(draft.task, input, current);
      if (!current()) return;
      if (outcome.status === 'saved') {
        withdrawObservation();
        setObservationMessage({ epoch: observationEpoch.current, status: 'saved', text: outcome.message });
      } else {
        if (outcome.status === 'unconfirmed') { blockedLive.current = true; setObservationBlocked(true); }
        setObservationMessage({ epoch: draft.epoch, status: outcome.status, text: outcome.message });
      }
    } catch {
      if (current()) {
        if (attempted) { blockedLive.current = true; setObservationBlocked(true); }
        setObservationMessage({ epoch: draft.epoch, status: attempted ? 'unconfirmed' : 'held', text: attempted
          ? 'Could not confirm this journal save. Check the field journal before recording this observation again.'
          : 'Could not check the saved records. Check them again before recording an observation.' });
      }
    } finally {
      if (observationPending.current === token) { observationPending.current = null; if (observationActive.current) setObservationSaving(false); }
    }
  }
  async function actOnTask(task: BoardTask, action: 'complete' | 'calendar') {
    if (observationPending.current) return;
    const turn = ++generation.current, expected = state;
    setBusy(true); setMessage('');
    try {
      const checked = await props.checkCurrent();
      if (turn !== generation.current || live.current.state !== expected) return;
      // The async source check is not write authority. Check the live actor and
      // local receipts again immediately before the synchronous side effect.
      if (!checked || !live.current.isCurrent()) {
        setMessage('The saved plan or design changed. Check its current records before continuing.'); return;
      }
      if (action === 'calendar') {
        setMessage(downloadTaskIcs(task) ? 'Calendar file prepared from this checked planned date.' : 'The calendar file could not be prepared.');
      } else {
        const next = setCompletedTaskState(task.id, !task.completed);
        setCompleted(next);
        setMessage(next.has(task.id) === !task.completed ? 'Checklist updated. Production and stock records have not changed.'
          : 'The checklist could not be saved.');
      }
    } catch {
      if (turn === generation.current) setMessage('Could not check the current saved records. Try checking them again.');
    } finally { if (turn === generation.current) setBusy(false); }
  }
  return <section lang="en" aria-label="Dated work from your estimates"
    className="mb-5 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm text-[var(--text-primary)]">
    <h2 className="font-display text-lg font-semibold">Dated work from your estimates</h2>
    <p>These planned dates come from saved grower cycles and checked design measurements. They are your estimates, not observed work or local farming approval.</p>
    {sample && <p className="font-semibold">DEMO — example planning data</p>}
    <button type="button" className={button} disabled={state.status === 'loading' || actionBusy} onClick={() => {
      withdrawObservation();
      generation.current++; setBusy(false); setMessage('');
      void props.refresh().catch(() => setMessage('Could not check the current saved records.'));
    }}>{state.status === 'loading' ? 'Checking saved cycles…' : 'Check saved cycles and designs'}</button>
    {noSavedPlan ? <p>No saved dated plan yet. Save a reviewed crop plan before using its work dates.</p>
      : state.status === 'held' && <p role="status">Current saved records could not be checked. No dates have been substituted.</p>}
    {state.status === 'ready' && <>
      {(result.heldPlantings > 0 || state.heldSources.length > 0) && <p role="status">Some saved cycles or design measurements need review. Their work remains withheld; the saved records are retained.</p>}
      {!result.tasks.length && <p>No saved dated cycles can supply work here. Unaccepted proposals stay in review.</p>}
      <ul className="space-y-3">{result.tasks.map(task => <li key={task.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
        <p className="font-semibold">{task.title}</p>
        <p><time dateTime={task.dueDate}>{task.dueDate}</time> (UTC date)</p>
        <p>{task.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={actionBusy} aria-pressed={task.completed}
            onClick={() => void actOnTask(task, 'complete')}>{task.completed ? 'Reopen checklist item' : 'Mark checklist item done'}</button>
          <button type="button" className={button} disabled={actionBusy} onClick={() => void actOnTask(task, 'calendar')}>Download planned-date calendar</button>
          {props.onRecordObservation && linkedTask(task) && <button type="button" className={button} disabled={actionBusy || observationBlocked}
            onClick={() => openObservation(task)}>Record what happened</button>}
        </div>
        {currentObservation?.task.id === task.id && <form aria-label="Field observation" className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-0)] p-3"
          onSubmit={event => { event.preventDefault(); void saveObservation(currentObservation); }}>
          <h3 className="font-semibold">Record what happened</h3>
          <p>Planned reference: {task.title} · {task.dueDate} (UTC date). Enter when you actually observed something; the planned date is not copied.</p>
          {(task.growerEventKind === 'picking-end' || task.growerEventKind === 'field-clear') && <p>This is a planned interval boundary. It does not prove that picking ended or the bed was cleared.</p>}
          {task.growerEventKind === 'next-entry' && <p>This is an availability boundary, not another planting or proof that the bed is free.</p>}
          {sample && <p className="font-semibold">DEMO observation — sample journal only.</p>}
          <label className="block space-y-1">Date you observed this<input type="date" className={field} aria-label="Date you observed this"
            value={currentObservation.observedDate} disabled={observationSaving || observationBlocked}
            onChange={event => editObservation(currentObservation, { observedDate: event.target.value })} /></label>
          <label className="block space-y-1">What happened<textarea className={field} aria-label="What happened" rows={3} maxLength={MAX_NOTES_LEN}
            value={currentObservation.note} disabled={observationSaving || observationBlocked}
            onChange={event => editObservation(currentObservation, { note: event.target.value })} /></label>
          <p>Write what you saw or did. This note does not mark the checklist done or record harvest quantities, stock or sales.</p>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Confirm own observation"
            checked={currentObservation.confirmed} disabled={observationSaving || observationBlocked}
            onChange={event => editObservation(currentObservation, { confirmed: event.target.checked })} />I am recording my own observation, not copying a planned date.</label>
          <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={observationSaving || observationBlocked}>Save observation in journal</button>
            <button type="button" className={button} onClick={() => { if (draftCurrent(currentObservation)) withdrawObservation(); }}>Cancel observation</button></div>
        </form>}
      </li>)}</ul>
      <p>Checklist ticks do not record sowing, harvest, stock or sales. End boundaries and next-entry dates describe the planned interval; they do not start another planting.</p>
    </>}
    {message && <p role="status">{message}</p>}
    {observationSaving && <p role="status">Checking and saving your observation…</p>}
    {observationMessage?.epoch === observationEpoch.current && <div role={observationMessage.status === 'held' ? 'alert' : 'status'} className="min-w-0 space-y-2 break-words">
      <p>{observationMessage.text}</p>
      {(observationMessage.status === 'saved' || observationMessage.status === 'unconfirmed') && <a className="inline-flex min-h-11 items-center underline" href="/journal">Open field journal</a>}
    </div>}
    {observationBlocked && <p role="alert">A note may already be saved. Check the field journal before recording it again. Another save is unavailable in this view.</p>}
  </section>;
}
