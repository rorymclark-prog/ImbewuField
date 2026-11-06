'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cropByKey } from '@/lib/crop-catalog';
import { isJournalDate } from '@/lib/field-journal';
import type { NurserySettings } from '@/lib/nursery-settings';
import type { GrowerFieldObservationResult, GrowerNurserySowingInput, GrowerNurseryProgressInput, GrowerNurseryFieldPlantingInput } from '@/lib/grower-field-observation';
import type { GrowerNurseryBatchReferenceChange, GrowerNurseryReferenceFields } from '@/lib/international/grower-nursery';
import type {
  GrowerSavedNurseryReview, GrowerSavedNurseryReadResult, GrowerNurseryBatchReferenceSaveResult,
  GrowerNurseryReferenceAcknowledgement,
} from './useGrowerWorkflow';
import GrowerNurseryReviewPanel from './GrowerNurseryReviewPanel';
import NurserySowingObservationForm from './NurserySowingObservationForm';
import NurseryProgressObservationForm from './NurseryProgressObservationForm';
import NurseryFieldPlantingObservationForm from './NurseryFieldPlantingObservationForm';

export interface SavedGrowerNurseryReviewPanelProps {
  review: GrowerSavedNurseryReview | null;
  checking: boolean;
  settings?: NurserySettings;
  contextRevision: number;
  sample?: boolean;
  onRefresh: (acknowledgement?: GrowerNurseryReferenceAcknowledgement) => Promise<GrowerSavedNurseryReadResult>;
  onCheckCurrent: (view: GrowerSavedNurseryReview) => Promise<boolean>;
  onSaveReferences: (view: GrowerSavedNurseryReview, changes: readonly GrowerNurseryBatchReferenceChange[], displayedIsCurrent: () => boolean) => Promise<GrowerNurseryBatchReferenceSaveResult>;
  onRecordSowing?: (view: GrowerSavedNurseryReview, plantingId: string, input: GrowerNurserySowingInput, displayedIsCurrent: () => boolean) => Promise<GrowerFieldObservationResult>;
  onRecordProgress?: (view: GrowerSavedNurseryReview, plantingId: string, input: GrowerNurseryProgressInput, displayedIsCurrent: () => boolean) => Promise<GrowerFieldObservationResult>;
  onRecordFieldPlanting?: (view: GrowerSavedNurseryReview, plantingId: string, input: GrowerNurseryFieldPlantingInput, displayedIsCurrent: () => boolean) => Promise<GrowerFieldObservationResult>;
}
type TextFields = { [K in keyof GrowerNurseryReferenceFields]: string };
type Editor = { view: GrowerSavedNurseryReview | null; revision: number; sample: boolean | undefined; touched: ReadonlyMap<string, TextFields> };
type Phase = 'idle' | 'checking' | 'saving' | 'waiting-commit' | 'refreshing' | 'verifying';
type RefreshAfterWrite = { view: GrowerSavedNurseryReview; revision: number; acknowledgement: GrowerNurseryReferenceAcknowledgement;
  turn: number; started: boolean; refresh: SavedGrowerNurseryReviewPanelProps['onRefresh'] };
type ObservationForm = { view: GrowerSavedNurseryReview; plantingId: string; revision: number; sample: boolean | undefined; editor: Editor };
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
  const [sowing, setSowing] = useState<ObservationForm | null>(null);
  const [progress, setProgress] = useState<ObservationForm | null>(null);
  const [fieldPlanting, setFieldPlanting] = useState<ObservationForm | null>(null);
  const fieldPlantingRef = useRef<ObservationForm | null>(null);
  const fieldPlantingProofs = useRef(new WeakMap<() => boolean, () => boolean>());
  const progressRef = useRef<ObservationForm | null>(null);
  const progressProofs = useRef(new WeakMap<() => boolean, () => boolean>());
  const sowingRef = useRef<ObservationForm | null>(null);
  const sowingProofs = useRef(new WeakMap<() => boolean, () => boolean>());
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
  const observationCurrent = (form: ObservationForm, active: ObservationForm | null) => mounted.current && active === form && live.current.review === form.view
    && live.current.contextRevision === form.revision && live.current.sample === form.sample && editorRef.current === form.editor
    && !pending.current && !form.editor.touched.size;
  const sowingCurrent = (form: ObservationForm) => observationCurrent(form, sowingRef.current);
  const progressCurrent = (form: ObservationForm) => observationCurrent(form, progressRef.current);
  const fieldPlantingCurrent = (form: ObservationForm) => observationCurrent(form, fieldPlantingRef.current);

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
  function openSowing(plantingId: string) {
    if (!editorCurrent() || !editorMatchesSource || !props.review || !props.onRecordSowing || dirty || busy || pending.current
      || props.review.references.find(row => row.plantingId === plantingId)?.reference.status !== 'ready') return;
    const next = { view: props.review, plantingId, revision: props.contextRevision, sample: props.sample, editor };
    fieldPlantingRef.current = null; setFieldPlanting(null); progressRef.current = null; setProgress(null); sowingRef.current = next; setSowing(next);
  }
  async function recordSowing(form: ObservationForm, input: GrowerNurserySowingInput, formIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    let isCurrent = sowingProofs.current.get(formIsCurrent);
    if (!isCurrent) {
      isCurrent = () => formIsCurrent() && sowingCurrent(form);
      sowingProofs.current.set(formIsCurrent, isCurrent);
    }
    if (!isCurrent() || !props.onRecordSowing) return { status: 'held', message: 'Check the current saved nursery batch before recording this observation.' };
    return props.onRecordSowing(form.view, form.plantingId, input, isCurrent);
  }
  function openProgress(plantingId: string) {
    if (!editorCurrent() || !editorMatchesSource || !props.review || !props.onRecordProgress || dirty || busy || pending.current
      || props.review.references.find(row => row.plantingId === plantingId)?.reference.status !== 'ready') return;
    const next = { view: props.review, plantingId, revision: props.contextRevision, sample: props.sample, editor };
    fieldPlantingRef.current = null; setFieldPlanting(null); sowingRef.current = null; setSowing(null); progressRef.current = next; setProgress(next);
  }
  async function recordProgress(form: ObservationForm, input: GrowerNurseryProgressInput, formIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    let isCurrent = progressProofs.current.get(formIsCurrent);
    if (!isCurrent) {
      isCurrent = () => formIsCurrent() && progressCurrent(form);
      progressProofs.current.set(formIsCurrent, isCurrent);
    }
    if (!isCurrent() || !props.onRecordProgress) return { status: 'held', message: 'Check the current saved nursery batch before recording this observation.' };
    return props.onRecordProgress(form.view, form.plantingId, input, isCurrent);
  }
  function openFieldPlanting(plantingId: string) {
    if (!editorCurrent() || !editorMatchesSource || !props.review || !props.onRecordFieldPlanting || dirty || busy || pending.current) return;
    const row = props.review.references.find(value => value.plantingId === plantingId);
    if (row?.reference.status !== 'ready' || !isJournalDate(row.plannedFieldEntryDate)) return;
    const next = { view: props.review, plantingId, revision: props.contextRevision, sample: props.sample, editor };
    sowingRef.current = null; setSowing(null); progressRef.current = null; setProgress(null); fieldPlantingRef.current = next; setFieldPlanting(next);
  }
  async function recordFieldPlanting(form: ObservationForm, input: GrowerNurseryFieldPlantingInput, formIsCurrent: () => boolean): Promise<GrowerFieldObservationResult> {
    let isCurrent = fieldPlantingProofs.current.get(formIsCurrent);
    if (!isCurrent) {
      isCurrent = () => formIsCurrent() && fieldPlantingCurrent(form);
      fieldPlantingProofs.current.set(formIsCurrent, isCurrent);
    }
    if (!isCurrent() || !props.onRecordFieldPlanting) return { status: 'held', message: 'Check the current saved nursery batch before recording this observation.' };
    return props.onRecordFieldPlanting(form.view, form.plantingId, input, isCurrent);
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
    <p>Check the saved plan to review nursery batches or open the separate field seed worksheet for accepted cycles without nursery raising. Field seed sourcing does not require a nursery batch, nursery equipment or a nursery review horizon. References do not record actual sowing, available seeds or live nursery stock.</p>
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
          {props.onRecordSowing && fields && !dirty && !busy && editorMatchesSource && <>
            {sowing && sowing.plantingId === row.plantingId && sowingCurrent(sowing)
              ? <NurserySowingObservationForm view={sowing.view} plantingId={sowing.plantingId} contextRevision={sowing.revision} sample={sowing.sample}
                onRecord={(input, isCurrent) => recordSowing(sowing, input, isCurrent)} />
              : <button type="button" className={button} onClick={() => openSowing(row.plantingId)}>Record nursery sowing</button>}
          </>}
          {props.onRecordProgress && fields && !dirty && !busy && editorMatchesSource && <>
            {progress && progress.plantingId === row.plantingId && progressCurrent(progress)
              ? <NurseryProgressObservationForm view={progress.view} plantingId={progress.plantingId} contextRevision={progress.revision} sample={progress.sample}
                onRecord={(input, isCurrent) => recordProgress(progress, input, isCurrent)} />
              : <button type="button" className={button} onClick={() => openProgress(row.plantingId)}>Record nursery plant count</button>}
          </>}
          {props.onRecordFieldPlanting && fields && isJournalDate(row.plannedFieldEntryDate) && !dirty && !busy && editorMatchesSource && <>
            {fieldPlanting && fieldPlanting.plantingId === row.plantingId && fieldPlantingCurrent(fieldPlanting)
              ? <NurseryFieldPlantingObservationForm view={fieldPlanting.view} plantingId={fieldPlanting.plantingId} contextRevision={fieldPlanting.revision} sample={fieldPlanting.sample}
                onRecord={(input, isCurrent) => recordFieldPlanting(fieldPlanting, input, isCurrent)} />
              : <button type="button" className={button} onClick={() => openFieldPlanting(row.plantingId)}>Record field planting</button>}
          </>}
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
