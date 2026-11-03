'use client';

import { useEffect, useRef, useState } from 'react';
import type { CropPlanState } from '@/lib/crop-plan';
import type { GrowerCycleContext } from '@/lib/international/grower-cycle';
import { buildGrowerBoardTasks, downloadTaskIcs, getGrowerTaskJournalLink, loadCompletedTaskIds, setCompletedTaskState, type BoardTask } from '@/lib/task-board';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import type { JournalEntryInput } from '@/lib/field-journal';
import { canOpenGrowerFieldNote, closeGrowerFieldNote, openGrowerFieldNote, saveGrowerFieldNote,
  type GrowerFieldNoteDraft } from '@/lib/international/grower-field-note-action';
import JournalEntrySheet from '@/components/journal/JournalEntrySheet';

export interface GrowerOperationsPanelProps {
  state: { status: 'loading' | 'held' | 'ready'; book: CropPlanState | null;
    contexts: readonly GrowerCycleContext[]; heldSources: readonly unknown[] };
  refresh: () => Promise<void>;
  checkCurrent: () => Promise<boolean>;
  isCurrent: () => boolean;
  now?: Date;
  sample?: boolean;
}
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';

/** Exact grower dates have their own section; month-only catalogue jobs keep
 * their existing precision. Completion is a checklist, not a harvest record. */
export default function GrowerOperationsPanel(props: GrowerOperationsPanelProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [clientSample, setClientSample] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [notesEnabled, setNotesEnabled] = useState(false);
  const [note, setNote] = useState<GrowerFieldNoteDraft | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const activeNote = useRef<GrowerFieldNoteDraft | null>(null);
  const notePending = useRef(false);
  const noteEpoch = useRef(0);
  const generation = useRef(0), live = useRef(props); live.current = props;
  const state = props.state;
  useEffect(() => {
    generation.current++; setBusy(false); setMessage(''); setCompleted(loadCompletedTaskIds()); setClientSample(isSampleMode());
  }, [state]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    const update = () => {
      const enabled = canOpenGrowerFieldNote();
      setNotesEnabled(enabled);
      if (!enabled) {
        noteEpoch.current++;
        if (activeNote.current) closeGrowerFieldNote(activeNote.current);
        activeNote.current = null;
        setNote(null);
      }
    };
    update();
    window.addEventListener(SAMPLE_MODE_EVENT, update);
    return () => {
      noteEpoch.current++;
      if (activeNote.current) closeGrowerFieldNote(activeNote.current);
      window.removeEventListener(SAMPLE_MODE_EVENT, update);
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
  async function actOnTask(task: BoardTask, action: 'complete' | 'calendar') {
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
  async function openNote(task: BoardTask) {
    if (notePending.current || activeNote.current || !state.book) return;
    const epoch = noteEpoch.current;
    notePending.current = true;
    setNoteBusy(true);
    setNoteError(null);
    setMessage('');
    try {
      const draft = await openGrowerFieldNote(task, {
        book: state.book, contexts: state.contexts,
        checkCurrent: props.checkCurrent,
        isCurrent: () => noteEpoch.current === epoch && live.current.state === state && live.current.isCurrent(),
      });
      if (noteEpoch.current !== epoch) {
        if (draft) closeGrowerFieldNote(draft);
        return;
      }
      if (!draft) { setMessage('The current plan or journal could not be checked. Open the journal or refresh the saved cycles.'); return; }
      activeNote.current = draft;
      setNote(draft);
    } finally { notePending.current = false; setNoteBusy(false); }
  }

  function closeNote() {
    if (notePending.current || !activeNote.current) return;
    closeGrowerFieldNote(activeNote.current);
    activeNote.current = null;
    setNote(null);
  }

  async function saveNote(input: JournalEntryInput) {
    const draft = activeNote.current;
    if (!draft || notePending.current) return;
    notePending.current = true;
    setNoteBusy(true);
    setNoteError(null);
    try {
      const result = await saveGrowerFieldNote(draft, input);
      if (activeNote.current !== draft) return;
      if (result.status === 'saved') {
        activeNote.current = null;
        setNote(null);
        setMessage('Field note saved to the journal.');
      } else {
        setNoteError(result.status === 'unconfirmed'
          ? 'The save could not be confirmed. Check the journal before trying again.'
          : result.reason === 'invalid-note' ? 'Enter the date and what you observed.'
            : result.reason === 'journal-full' ? 'The journal is full. Your draft is still here.'
              : 'The plan or journal changed, or storage is busy. Your draft is still here.');
      }
    } finally { notePending.current = false; setNoteBusy(false); }
  }
  return <section lang="en" aria-label="Dated work from your estimates"
    className="mb-5 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm text-[var(--text-primary)]">
    <h2 className="font-display text-lg font-semibold">Dated work from your estimates</h2>
    <p>These planned dates come from saved grower cycles and checked design measurements. They are your estimates, not observed work or local farming approval.</p>
    {sample && <p className="font-semibold">DEMO — example planning data</p>}
    <button type="button" className={button} disabled={state.status === 'loading' || busy} onClick={() => {
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
          <button type="button" className={button} disabled={busy} aria-pressed={task.completed}
            onClick={() => void actOnTask(task, 'complete')}>{task.completed ? 'Reopen checklist item' : 'Mark checklist item done'}</button>
          <button type="button" className={button} disabled={busy} onClick={() => void actOnTask(task, 'calendar')}>Download planned-date calendar</button>
          {notesEnabled && !sample && getGrowerTaskJournalLink(task) && <button type="button" className={button}
            disabled={busy || noteBusy} onClick={() => void openNote(task)}>Write field note</button>}
        </div>
      </li>)}</ul>
      <p>Checklist ticks do not record sowing, harvest, stock or sales. End boundaries and next-entry dates describe the planned interval; they do not start another planting.</p>
    </>}
    {message && <p role="status">{message}</p>}
    {note && <JournalEntrySheet entry={null} beds={[]} crops={[]} requireObservationDate
      initialDraft={{ category: 'other' }} linkedBedLabel={note.bedLabel ?? 'Checked plan bed'}
      saving={noteBusy} error={noteError} onClose={closeNote} onSave={input => { void saveNote(input); }} />}
  </section>;
}
