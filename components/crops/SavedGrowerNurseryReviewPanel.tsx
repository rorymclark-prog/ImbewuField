'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cropByKey } from '@/lib/crop-catalog';
import type { NurserySettings } from '@/lib/nursery-settings';
import type { GrowerNurseryBatchReferenceChange, GrowerNurseryReferenceFields } from '@/lib/international/grower-nursery';
import type {
  GrowerSavedNurseryReview, GrowerSavedNurseryReadResult, GrowerNurseryBatchReferenceSaveResult,
  GrowerNurseryReferenceAcknowledgement,
} from './useGrowerWorkflow';
import GrowerNurseryReviewPanel from './GrowerNurseryReviewPanel';

export interface SavedGrowerNurseryReviewPanelProps {
  review: GrowerSavedNurseryReview | null;
  checking: boolean;
  settings?: NurserySettings;
  contextRevision: number;
  sample?: boolean;
  onRefresh: (acknowledgement?: GrowerNurseryReferenceAcknowledgement) => Promise<GrowerSavedNurseryReadResult>;
  onCheckCurrent: (view: GrowerSavedNurseryReview) => Promise<boolean>;
  onSaveReferences: (view: GrowerSavedNurseryReview, changes: readonly GrowerNurseryBatchReferenceChange[], displayedIsCurrent: () => boolean) => Promise<GrowerNurseryBatchReferenceSaveResult>;
}
type TextFields = { [K in keyof GrowerNurseryReferenceFields]: string };
type Editor = { view: GrowerSavedNurseryReview | null; revision: number; sample: boolean | undefined; touched: ReadonlyMap<string, TextFields> };
type Phase = 'idle' | 'checking' | 'saving' | 'waiting-commit' | 'refreshing' | 'verifying';
type RefreshAfterWrite = { view: GrowerSavedNurseryReview; revision: number; acknowledgement: GrowerNurseryReferenceAcknowledgement;
  turn: number; started: boolean; refresh: SavedGrowerNurseryReviewPanelProps['onRefresh'] };
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const textFields = (value: GrowerNurseryReferenceFields): TextFields => ({ variety: value.variety ?? '', seedLotReference: value.seedLotReference ?? '', raisingBatchReference: value.raisingBatchReference ?? '' });

/** Per-planned-batch labels use the parent's real saved-book authority. They
 * never attach to a crop-wide recipe or claim observed nursery inventory. */
export default function SavedGrowerNurseryReviewPanel(props: SavedGrowerNurseryReviewPanelProps) {
  const [editor, setEditor] = useState<Editor>(() => ({ view: props.review, revision: props.contextRevision, sample: props.sample, touched: new Map() }));
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [blockedBudgetView, setBlockedBudgetView] = useState<GrowerSavedNurseryReview | null>(null);
  const [checkedWrite, setCheckedWrite] = useState<{ view: GrowerSavedNurseryReview; turn: number } | null>(null);
  const id = useId(), mounted = useRef(true), generation = useRef(0), pending = useRef(false);
  const refreshAfterWrite = useRef<RefreshAfterWrite | null>(null);
  const savingAttempt = useRef<object | null>(null);
  const seenContext = useRef({ view: props.review, revision: props.contextRevision, sample: props.sample });
  const live = useRef(props); live.current = props;
  const editorRef = useRef(editor); editorRef.current = editor;
  const editorMatchesSource = editor.view === props.review && editor.revision === props.contextRevision && editor.sample === props.sample;
  const activeEditor: Editor = editorMatchesSource ? editor : { view: props.review, revision: props.contextRevision, sample: props.sample, touched: new Map() };
  const dirty = activeEditor.touched.size > 0;
  const busy = props.checking || phase === 'checking' || phase === 'saving' || phase === 'waiting-commit' || phase === 'refreshing' || phase === 'verifying';
  const sourceCurrent = () => mounted.current && live.current.review === props.review && live.current.contextRevision === props.contextRevision && live.current.sample === props.sample;
  const editorCurrent = () => sourceCurrent() && editorRef.current === editor;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; pending.current = false; refreshAfterWrite.current = null; savingAttempt.current = null; };
  }, []);
  useEffect(() => {
    if (refreshAfterWrite.current || savingAttempt.current
      || seenContext.current.view === props.review && seenContext.current.revision === props.contextRevision && seenContext.current.sample === props.sample) return;
    seenContext.current = { view: props.review, revision: props.contextRevision, sample: props.sample };
    generation.current++; pending.current = false;
    if (editorRef.current.touched.size) {
      setPhase('idle'); setCheckedWrite(null);
      setMessage('The checked source changed. Earlier entries are retained separately and have not been applied to current saved batches.'); return;
    }
    const next = { view: props.review, revision: props.contextRevision, sample: props.sample, touched: new Map<string, TextFields>() };
    editorRef.current = next; setEditor(next); setPhase('idle'); setMessage(''); setCheckedWrite(null);
  }, [props.review, props.contextRevision, props.sample, phase]);

  // Only a confirmed opaque readback acknowledgement may cross the parent's
  // own commit rerender. A revision change on its own proves no save outcome.
  useEffect(() => {
    const request = refreshAfterWrite.current;
    if (!request || request.started || !mounted.current || generation.current !== request.turn
      || props.review === request.view && props.contextRevision === request.revision) return;
    request.started = true; setPhase('refreshing');
    void request.refresh(request.acknowledgement).then(result => {
      if (!mounted.current || refreshAfterWrite.current !== request || generation.current !== request.turn) return;
      if (result.status !== 'ready') {
        seenContext.current = { view: live.current.review, revision: live.current.contextRevision, sample: live.current.sample };
        refreshAfterWrite.current = null; pending.current = false; setPhase('idle'); setBlockedBudgetView(live.current.review);
        setMessage('The write was reported, but current saved batches could not be confirmed. Check saved records before continuing.'); return;
      }
      setCheckedWrite({ view: result.view, turn: request.turn }); setPhase('verifying');
    }).catch(() => {
      if (!mounted.current || refreshAfterWrite.current !== request || generation.current !== request.turn) return;
      seenContext.current = { view: live.current.review, revision: live.current.contextRevision, sample: live.current.sample };
      refreshAfterWrite.current = null; pending.current = false; setPhase('idle'); setBlockedBudgetView(live.current.review);
      setMessage('The write was reported, but its saved records could not be checked. Check saved records before continuing.');
    });
  }, [props.review, props.contextRevision, phase]);

  useEffect(() => {
    if (!checkedWrite || props.review !== checkedWrite.view || !mounted.current || generation.current !== checkedWrite.turn) return;
    seenContext.current = { view: props.review, revision: props.contextRevision, sample: props.sample };
    let cancelled = false;
    void props.onCheckCurrent(checkedWrite.view).then(current => {
      if (cancelled || !mounted.current || generation.current !== checkedWrite.turn || live.current.review !== checkedWrite.view) return;
      refreshAfterWrite.current = null; pending.current = false; setPhase('idle'); setCheckedWrite(null);
      if (!current) { setBlockedBudgetView(checkedWrite.view); setMessage('Current saved records could not be confirmed. Check saved nursery batches before continuing.'); return; }
      seenContext.current = { view: checkedWrite.view, revision: live.current.contextRevision, sample: live.current.sample };
      const next = { view: checkedWrite.view, revision: live.current.contextRevision, sample: live.current.sample, touched: new Map<string, TextFields>() };
      editorRef.current = next; setEditor(next);
      setBlockedBudgetView(null);
      setMessage('References saved and current saved batches checked. These remain planned batches, not observed stock.');
    }).catch(() => {
      if (cancelled || !mounted.current || generation.current !== checkedWrite.turn) return;
      refreshAfterWrite.current = null; pending.current = false; setPhase('idle'); setCheckedWrite(null);
      setBlockedBudgetView(live.current.review);
      setMessage('Current saved records could not be confirmed. Check saved nursery batches before continuing.');
    });
    return () => { cancelled = true; };
  }, [checkedWrite, props.review, props.onCheckCurrent]);

  function edit(plantingId: string, key: keyof TextFields, text: string) {
    if (!editorCurrent() || busy || pending.current || !props.review) return;
    const row = props.review.references.find(value => value.plantingId === plantingId);
    if (row?.reference.status !== 'ready') return;
    generation.current++; setMessage(''); setCheckedWrite(null);
    const touched = new Map(activeEditor.touched), previous = touched.get(plantingId) ?? textFields(row.reference.fields);
    touched.set(plantingId, { ...previous, [key]: text });
    const next = { view: props.review, revision: props.contextRevision, sample: props.sample, touched }; editorRef.current = next; setEditor(next);
  }
  async function refresh() {
    if (!sourceCurrent() || pending.current && phase !== 'verifying') return;
    const turn = ++generation.current; pending.current = true; refreshAfterWrite.current = null; setCheckedWrite(null); setPhase('checking'); setMessage('');
    try {
      const result = await props.onRefresh();
      if (!mounted.current || generation.current !== turn) return;
      if (result.status === 'held') { setBlockedBudgetView(live.current.review); setMessage('Saved nursery batches could not be checked. Existing entries have not been treated as a confirmed save.'); }
      else if (live.current.review === result.view) setBlockedBudgetView(null);
    } catch { if (mounted.current && generation.current === turn) setMessage('Saved nursery batches could not be checked. Please check the current records.'); }
    finally { if (mounted.current && generation.current === turn) { pending.current = false; setPhase('idle'); } }
  }
  async function save() {
    if (!editorCurrent() || !props.review || !dirty || busy || pending.current) return;
    const view = props.review, originalEditor = editor, revision = props.contextRevision, turn = ++generation.current;
    const attempt = {}; savingAttempt.current = attempt;
    pending.current = true; setPhase('saving'); setMessage('');
    const displayedIsCurrent = () => mounted.current && generation.current === turn && live.current.review === view
      && live.current.contextRevision === revision && live.current.sample === props.sample && editorRef.current === originalEditor;
    const changes = [...activeEditor.touched].map(([plantingId, fields]) => ({ plantingId,
      variety: fields.variety === '' ? null : fields.variety, seedLotReference: fields.seedLotReference === '' ? null : fields.seedLotReference,
      raisingBatchReference: fields.raisingBatchReference === '' ? null : fields.raisingBatchReference }));
    try {
      const result = await props.onSaveReferences(view, changes, displayedIsCurrent);
      if (!mounted.current || generation.current !== turn) return;
      savingAttempt.current = null;
      if (result.status === 'confirmed') {
        refreshAfterWrite.current = { view, revision, acknowledgement: result.acknowledgement, turn, started: false, refresh: props.onRefresh };
        setPhase('waiting-commit'); setMessage('Checking the confirmed write against current saved batches…'); return;
      }
      if (!displayedIsCurrent()) { pending.current = false; setPhase('idle'); setMessage('The checked source changed. Earlier entries have not been applied to current saved batches.'); return; }
      if (result.status === 'unchanged') {
        const next = { view, revision, sample: props.sample, touched: new Map<string, TextFields>() }; editorRef.current = next; setEditor(next);
        setMessage('Reference values are unchanged. No write was needed.');
      } else setMessage(result.status === 'failed'
        ? 'The save outcome is not confirmed. Your entries are retained. Check saved records before trying again.'
        : 'The references could not be saved in this context. Your entries are retained; check current saved records before trying again.');
      pending.current = false; setPhase('idle');
    } catch {
      if (savingAttempt.current !== attempt) return;
      savingAttempt.current = null;
      if (!displayedIsCurrent()) { if (mounted.current && generation.current === turn) { pending.current = false; setPhase('idle'); } return; }
      pending.current = false; setPhase('idle'); setMessage('The save outcome is not confirmed. Your entries are retained. Check saved records before trying again.');
    }
  }
  const hasHeld = props.review?.references.some(row => row.reference.status !== 'ready') ?? false;
  const withdrawnDraft = !editorMatchesSource && editor.touched.size > 0;
  const canReviewBudget = props.review && props.review !== blockedBudgetView && !dirty && !busy && !checkedWrite && !refreshAfterWrite.current;
  return <section lang="en" aria-label="Saved planned nursery batches" className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-3 text-sm [overflow-wrap:anywhere]">
    <h4 className="font-semibold">Saved planned nursery batches</h4>
    <p>Check saved batches, enter your own optional references for individual batches, then review nursery resources. References do not record actual sowing, available seeds or live nursery stock.</p>
    {props.sample && <p className="font-semibold">DEMO — references stay in this sample session.</p>}
    <button type="button" className={button} disabled={props.checking || pending.current && phase !== 'verifying'} onClick={() => void refresh()}>
      {phase === 'checking' || props.checking ? 'Checking saved nursery batches…' : 'Check saved nursery batches'}
    </button>
    {!props.review && <p>Check the current saved plan to load eligible planned nursery batches.</p>}
    {withdrawnDraft && <details className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <summary className="min-h-11 cursor-pointer">Earlier checked-batch entries · unsaved and held separately</summary>
      {[...editor.touched].map(([plantingId, fields], index) => <div key={plantingId} className="space-y-1">
        <p>Earlier batch {index + 1}</p>
        <p>Variety / cultivar: {fields.variety || 'Not entered'}</p><p>Seed-lot reference: {fields.seedLotReference || 'Not entered'}</p><p>Raising-batch reference: {fields.raisingBatchReference || 'Not entered'}</p>
      </div>)}
      <p>These entries do not belong to a current save source. Check saved records and enter any changes explicitly against the current batch.</p>
    </details>}
    {props.review && <>
      {!props.review.references.length && <p>No eligible saved transplant raising batch is represented. This does not establish zero nursery demand.</p>}
      {hasHeld && <p>Some saved batch references need review. Their retained evidence remains separate from the planned count and resource calculations.</p>}
      {props.review.references.map((row, index) => {
        const fields = row.reference.status === 'ready' ? activeEditor.touched.get(row.plantingId) ?? textFields(row.reference.fields) : null;
        return <article key={row.plantingId} className="min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3">
          <h5 className="font-semibold">Saved planned batch {index + 1} · {cropByKey(row.cropKey)?.name ?? 'Crop identity unavailable'}</h5>
          <p>{props.review!.source.beds.find(bed => bed.id === row.bedId)?.label ?? 'Saved growing space'} · {row.startDate} to before {row.endDateExclusive} (UTC).</p>
          {fields ? <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">{([
            ['variety', 'Your variety / cultivar (optional)'], ['seedLotReference', 'Your seed-lot reference (optional)'], ['raisingBatchReference', 'Your raising-batch reference (optional)'],
          ] as const).map(([key, label]) => <label key={key} htmlFor={`${id}-${index}-${key}`}>{label}
            <input id={`${id}-${index}-${key}`} aria-label={`${label} — saved batch ${index + 1}`} className={field} value={fields[key]} disabled={busy}
              onChange={event => edit(row.plantingId, key, event.target.value)} />
          </label>)}</div> : <p role="status">Saved reference metadata needs review. Retained evidence has not been replaced with blank fields.</p>}
        </article>;
      })}
      <button type="button" className={button} disabled={!dirty || busy} onClick={() => void save()}>{phase === 'saving' ? 'Saving touched batch references…' : 'Save all touched references'}</button>
      {dirty && <p>Unsaved reference changes: save or explicitly check saved batches again before reviewing resources or exporting.</p>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
    {canReviewBudget && <GrowerNurseryReviewPanel savedReview={props.review!} source={props.review!.source} settings={props.settings}
      contextRevision={props.contextRevision} sample={props.sample} onCheckSavedCurrent={props.onCheckCurrent} />}
  </section>;
}
