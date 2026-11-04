'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { CanvasFrame, DesignCanvasState, ZoneShape } from '@/lib/design-canvas';
import { bedsInsideField, fieldBlockExclusions, type FieldBlockConfig } from '@/lib/bed-block';
import { fieldBlockSourceKey } from '@/lib/field-block-allocations';
import { createLengthDraft, editLengthDraft, readLengthDraft, switchLengthDraftUnit, type LengthDraft, type LengthUnit } from '@/lib/length-units';
import { captureLengthUnitPreferenceContext, lengthUnitPreferenceContextIsCurrent, readLengthUnitPreference,
  writeLengthUnitPreference, revokeLengthUnitPreferenceContext, subscribeLengthUnitPreferenceContext,
  type LengthUnitPreferenceContext } from '@/lib/length-unit-preference';

export interface FieldLayoutExportRequest {
  readonly fieldId: string | null;
  readonly allFields: boolean;
  readonly includeLabels: boolean;
}
export interface FieldLayoutExportResult {
  readonly status: 'downloaded' | 'shared' | 'cancelled' | 'held';
  readonly message: string;
}

export type FieldBlockApplyAcknowledgement = (appliedSourceKey: string) => void;

interface Props {
  state: DesignCanvasState;
  frame: CanvasFrame;
  selectedId: string | null;
  onDraw: () => void;
  onSelect: (id: string) => void;
  onApply: (id: string, name: string, config: FieldBlockConfig, acknowledge?: FieldBlockApplyAcknowledgement) => void;
  applyError?: string | null;
  onExport?: (request: FieldLayoutExportRequest, contextCurrent: () => boolean) => Promise<FieldLayoutExportResult>;
}

type LengthKey = 'bedLengthM' | 'bedWidthM' | 'pathWidthM';
// Existing editor placeholders, not recommended crop dimensions.
const DEFAULTS: FieldBlockConfig = { mode: 'beds', bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5, angleDeg: 0 };
type Editor = { sourceKey: string; siteId: string; fieldId: string | null; name: string; mode: 'beds' | 'open';
  lengths: LengthDraft<LengthKey>; angle: string; originalAngle: number; angleEdited: boolean; dirty: boolean;
  context: LengthUnitPreferenceContext | null; unitError: string;
  unitSelection: { unit: LengthUnit; sourceKey: string; context: LengthUnitPreferenceContext | null } | null };
type FieldApplyAttempt = { editor: Editor; state: DesignCanvasState; selectedId: string | null; fieldId: string;
  fromKey: string; acknowledgedKey: string | null; errorAtStart: string | null | undefined; revoked: boolean };
function selectedField(state: DesignCanvasState, selectedId: string | null): ZoneShape | undefined {
  return state.zones.find(zone => zone.feature === 'staple_garden' && (zone.id === selectedId
    || state.items.some(item => item.id === selectedId && item.fieldBlockId === zone.id)));
}
function sourceKey(state: DesignCanvasState, frame: CanvasFrame, selectedId: string | null): string {
  return fieldBlockSourceKey(state, selectedField(state, selectedId)?.id ?? null, frame);
}
// Export withdrawal includes saved labels and paths that do not affect the
// existing dimension editor. The parent still owns file/source authorization.
function exportSourceKey(state: DesignCanvasState, frame: CanvasFrame, selectedId: string | null): string | null {
  try {
    return JSON.stringify([fieldBlockSourceKey(state, selectedId, frame), selectedId, state.rev, state.updatedAt,
      state.zones.filter(zone => zone.feature === 'staple_garden').map(zone => ({ id: zone.id, name: zone.name, points: zone.points, fieldBlock: zone.fieldBlock })),
      state.items.filter(item => item.fieldBlockId).map(item => ({ id: item.id, fieldBlockId: item.fieldBlockId, label: item.label })),
      state.lines.map(line => ({ id: line.id, fieldBlockId: line.fieldBlockId, kind: line.kind, name: line.name, points: line.points, widthM: line.widthM })),
    ]);
  } catch { return null; }
}
function freshEditor(state: DesignCanvasState, selected: ZoneShape | undefined, key: string, unit: LengthUnit,
  context: LengthUnitPreferenceContext | null): Editor {
  const config = selected?.fieldBlock ?? DEFAULTS;
  return { sourceKey: key, siteId: state.siteId, fieldId: selected?.id ?? null,
    name: selected?.name ?? `Field ${state.zones.filter(zone => zone.feature === 'staple_garden').findIndex(zone => zone.id === selected?.id) + 1}`,
    mode: config.mode, lengths: createLengthDraft({ sourceKey: key, unit,
      metres: { bedLengthM: config.bedLengthM, bedWidthM: config.bedWidthM, pathWidthM: config.pathWidthM } }),
    angle: String(config.angleDeg), originalAngle: config.angleDeg, angleEdited: false, dirty: false, context, unitError: '', unitSelection: null };
}

export default function FieldBlocksPanel({ state, frame, selectedId, onDraw, onSelect, onApply, applyError, onExport }: Props) {
  const fields = state.zones.filter(zone => zone.feature === 'staple_garden');
  const selected = selectedField(state, selectedId), key = sourceKey(state, frame, selectedId);
  const [editor, setEditor] = useState(() => freshEditor(state, selected, key, 'm', null));
  const [error, setError] = useState(''), [preferenceNote, setPreferenceNote] = useState('');
  const [authorityChanged, setAuthorityChanged] = useState(false);
  const [exportOptions, setExportOptions] = useState({ allFields: false, includeLabels: false });
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ generation: object; result: FieldLayoutExportResult } | null>(null);
  const pendingExport = useRef<object | null>(null);
  const exportSource = onExport ? exportSourceKey(state, frame, selectedId) : null;
  const exportInputs = JSON.stringify([!!onExport, exportSource, exportOptions]);
  const previousExportInputs = useRef(exportInputs), exportGeneration = useRef<object>({});
  if (previousExportInputs.current !== exportInputs) {
    previousExportInputs.current = exportInputs; exportGeneration.current = {};
  }
  const renderedExportGeneration = exportGeneration.current;
  const exportLive = useRef({ state, frame, selectedId, onExport, source: exportSource, options: exportOptions });
  exportLive.current = { state, frame, selectedId, onExport, source: exportSource, options: exportOptions };
  const context = useRef<LengthUnitPreferenceContext | null>(null), stopPreference = useRef<() => void>(() => {});
  const active = useRef(false), interacted = useRef(false);
  const rememberedSelection = useRef<Editor['unitSelection']>(null);
  const pendingApply = useRef<FieldApplyAttempt | null>(null);
  const live = useRef({ state, frame, selectedId, onApply, key, editor, applyError }); live.current = { state, frame, selectedId, onApply, key, editor, applyError };
  const attempt = pendingApply.current;
  if (attempt && (applyError && applyError !== attempt.errorAtStart || authorityChanged || editor !== attempt.editor || selectedId !== attempt.selectedId
    || selected?.id !== attempt.fieldId || state.siteId !== attempt.state.siteId
    || key !== attempt.fromKey && key !== attempt.acknowledgedKey)) attempt.revoked = true;
  function bindPreference() {
    stopPreference.current(); revokeLengthUnitPreferenceContext(context.current);
    const captured = captureLengthUnitPreferenceContext(); context.current = captured;
    stopPreference.current = subscribeLengthUnitPreferenceContext(captured, () => {
      if (active.current) { setAuthorityChanged(true); setError('The account or sample session changed. Reload the field settings before continuing.'); }
    });
    return captured;
  }
  useEffect(() => {
    active.current = true;
    const captured = bindPreference();
    if (!captured) setAuthorityChanged(true);
    setEditor(previous => ({ ...previous, context: captured }));
    return () => { active.current = false; pendingApply.current = null; stopPreference.current(); revokeLengthUnitPreferenceContext(context.current); context.current = null; };
  }, []);
  useEffect(() => {
    const captured = editor.context;
    if (!active.current || !lengthUnitPreferenceContextIsCurrent(captured)) return;
    const preference = readLengthUnitPreference(captured);
    setEditor(previous => {
      if (previous.context !== captured || !lengthUnitPreferenceContextIsCurrent(captured)) return previous;
      const switched = !interacted.current && preference.destination !== 'unavailable'
        ? switchLengthDraftUnit(previous.lengths, preference.unit, previous.sourceKey) : null;
      return { ...previous, context: captured, ...(switched?.status === 'ready' ? { lengths: switched.draft } : {}) };
    });
    if (preference.remembered) setPreferenceNote(interacted.current
      ? 'Your current entries keep their original unit. Choose a unit explicitly to change it.' : 'Unit choice remembered on this device.');
  }, [editor.context]);
  useEffect(() => {
    const applied = pendingApply.current;
    if (!applied) return;
    if (applied.revoked || !active.current || authorityChanged || context.current !== applied.editor.context
      || !lengthUnitPreferenceContextIsCurrent(applied.editor.context)) { pendingApply.current = null; return; }
    if (applyError) return;
    // The parent's queued updater may be abandoned. Its callback only stages a
    // receipt; the committed props must actually contain that exact result.
    if (!applied.acknowledgedKey || state === applied.state || key !== applied.acknowledgedKey) return;
    pendingApply.current = null;
    setEditor(previous => previous === applied.editor
      ? freshEditor(state, selected, key, previous.lengths.unit, previous.context) : previous);
    setError('');
  });
  useEffect(() => {
    setEditor(previous => {
      if (previous.sourceKey === key) return previous;
      // Changing fields loads that field's own values, including unsaved defaults.
      // An external change to this same dirty field is held for explicit reload.
      if (previous.fieldId === (selected?.id ?? null) && previous.siteId === state.siteId && previous.dirty) return previous;
      return freshEditor(state, selected, key, previous.lengths.unit, context.current);
    });
    setError('');
  // Value identity, rather than a new object reference, owns draft invalidation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const contextCurrent = lengthUnitPreferenceContextIsCurrent(editor.context);
  const current = editor.sourceKey === key && !authorityChanged && contextCurrent;
  const dimensions = useMemo(() => readLengthDraft(editor.lengths, key), [editor.lengths, key]);
  useEffect(() => {
    const choice = editor.unitSelection;
    if (!choice || rememberedSelection.current === choice) return;
    rememberedSelection.current = choice;
    const now = live.current;
    if (!active.current) return;
    if (authorityChanged || editor.context !== choice.context || !lengthUnitPreferenceContextIsCurrent(choice.context)
      || sourceKey(now.state, now.frame, now.selectedId) !== choice.sourceKey) {
      setPreferenceNote('Unit choice was not remembered because its editing context changed.'); return;
    }
    const saved = writeLengthUnitPreference(choice.context, choice.unit);
    setPreferenceNote(saved.remembered ? 'Unit choice remembered on this device.' : saved.destination === 'sample'
      ? 'Unit choice applies only to this sample session.' : 'Unit choice works here, but could not be remembered on this device.');
  }, [editor.unitSelection, editor.context, authorityChanged]);
  const config = useMemo<FieldBlockConfig | null>(() => {
    if (editor.sourceKey !== key) return null;
    const metres = dimensions.status === 'ready' ? dimensions.metres : editor.mode === 'open' ? editor.lengths.originalMetres : null;
    if (!metres) return null;
    const angleDeg = editor.angleEdited ? (editor.angle.trim() ? Number(editor.angle.replace(',', '.')) : NaN) : editor.originalAngle;
    return { mode: editor.mode, ...metres, angleDeg: editor.mode === 'open' && !Number.isFinite(angleDeg) ? editor.originalAngle : angleDeg };
  }, [editor, key, dimensions]);
  const preview = useMemo(() => {
    if (!selected || !config || editor.mode === 'open') return null;
    try { return { count: bedsInsideField(selected.points, config, frame, fieldBlockExclusions(state, selected.id, frame)).beds.length, error: '' }; }
    catch (failure) { return { count: 0, error: (failure as Error).message }; }
  }, [selected, config, frame, state, editor.mode]);
  function canEdit(previous: Editor, unit?: LengthUnit): boolean {
    const now = live.current;
    return active.current && !authorityChanged && lengthUnitPreferenceContextIsCurrent(editor.context)
      && previous.context === editor.context && previous.sourceKey === editor.sourceKey && previous.fieldId === editor.fieldId
      && sourceKey(now.state, now.frame, now.selectedId) === editor.sourceKey
      && (unit === undefined || previous.lengths.unit === unit);
  }
  function mutate(change: (previous: Editor) => Editor, unit?: LengthUnit) {
    if (!canEdit(live.current.editor, unit)) return;
    interacted.current = true; setError('');
    setEditor(previous => canEdit(previous, unit) ? change(previous) : previous);
  }
  function changeUnit(next: LengthUnit) {
    mutate(previous => {
      const switched = switchLengthDraftUnit(previous.lengths, next, previous.sourceKey);
      return switched.status !== 'ready'
        ? { ...previous, unitError: 'Complete valid decimal dimensions before changing units. Your entries and their current unit have been kept.' }
        : { ...previous, lengths: switched.draft, unitError: '', unitSelection: { unit: next, sourceKey: previous.sourceKey, context: previous.context } };
    });
  }
  function reload() {
    if (!active.current || authorityChanged || !lengthUnitPreferenceContextIsCurrent(editor.context)) return;
    const captured = bindPreference(); setAuthorityChanged(false); setError('');
    const now = live.current;
    setEditor(freshEditor(now.state, selectedField(now.state, now.selectedId), sourceKey(now.state, now.frame, now.selectedId), editor.lengths.unit, captured));
  }
  function exportActorSourceCurrent(): boolean {
    const now = exportLive.current;
    if (!active.current || authorityChanged || !exportSource || !now.onExport
      || exportGeneration.current !== renderedExportGeneration || now.source !== exportSource || now.options !== exportOptions
      || context.current !== editor.context || !lengthUnitPreferenceContextIsCurrent(editor.context)
      || exportSourceKey(now.state, now.frame, now.selectedId) !== exportSource) return false;
    return true;
  }
  function exportContextCurrent(): boolean {
    if (!exportActorSourceCurrent()) return false;
    const now = exportLive.current;
    return exportOptions.allFields ? now.state.zones.some(zone => zone.feature === 'staple_garden')
      : !!selectedField(now.state, now.selectedId);
  }
  function changeExportOptions(change: Partial<typeof exportOptions>) {
    if (!exportActorSourceCurrent()) return;
    const previous = exportLive.current.options, next = { ...previous, ...change };
    if (next.allFields === previous.allFields && next.includeLabels === previous.includeLabels) return;
    // Withdraw before React commits so a reentrant share fallback cannot deliver
    // the old private-file options between this event and the next render.
    exportGeneration.current = {}; exportLive.current = { ...exportLive.current, options: next };
    setExportOptions(next); setExportFeedback(null);
  }
  async function exportLayout() {
    if (pendingExport.current || !exportContextCurrent()) return;
    const now = exportLive.current, callback = now.onExport; if (!callback) return;
    const request: FieldLayoutExportRequest = Object.freeze({ fieldId: exportOptions.allFields ? null : selectedField(now.state, now.selectedId)?.id ?? null,
      allFields: exportOptions.allFields, includeLabels: exportOptions.includeLabels });
    const token = {}; pendingExport.current = token; setExporting(true); setExportFeedback(null);
    try {
      // This guard is also passed to the parent's download/share delivery path.
      // Withdrawing options must stop a fallback file, not only its status copy.
      if (!exportContextCurrent()) return;
      const result = await callback(request, exportContextCurrent);
      if (exportContextCurrent()) setExportFeedback({ generation: renderedExportGeneration, result });
    } catch {
      if (exportContextCurrent()) setExportFeedback({ generation: renderedExportGeneration,
        result: { status: 'held', message: 'Could not export the field layout. Your field settings have been kept. Try again.' } });
    } finally {
      if (pendingExport.current === token) { pendingExport.current = null; if (active.current) setExporting(false); }
    }
  }
  const input = { width: '100%', minHeight: 44, border: '1px solid #a8b5a8', borderRadius: 7, padding: '6px 8px', background: '#fffdf7', color: '#203d32' };
  if (!editor.context || authorityChanged || !contextCurrent) return <details lang="en" style={{ padding: 10, border: '1px solid #a8b5a8', borderRadius: 10 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 800, minHeight: 32 }}>Field blocks</summary>
    <p role="status" style={{ fontSize: 12 }}>{authorityChanged || editor.context
      ? 'The account or sample context changed. Reopen the design to load its field settings.' : 'Checking the account or sample context before showing field settings.'}</p>
  </details>;
  return <details lang="en" style={{ padding: 10, border: '1px solid #a8b5a8', borderRadius: 10, background: '#f3f6ed', color: '#203d32' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 800, minHeight: 32 }}>Field blocks · {fields.length}</summary>
    <p style={{ fontSize: 12, margin: '5px 0 10px' }}>Draw a field, then fill it with beds or keep it as open growing ground.</p>
    <button type="button" onClick={onDraw} style={{ ...input, cursor: 'pointer', fontWeight: 700 }}>Draw field polygon</button>
    {!!fields.length && <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Field
      <select aria-label="Field block" value={selected?.id ?? ''} onChange={event => { if (onExport && event.target.value !== selected?.id) exportGeneration.current = {}; onSelect(event.target.value); }} style={input}>
        <option value="" disabled>Select a field</option>
        {fields.map((field, index) => <option key={field.id} value={field.id}>{field.name ?? `Field ${index + 1}`}</option>)}
      </select>
    </label>}
    {selected && <>
      <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Field name<input aria-label="Field name" value={editor.name}
        onChange={event => { const name = event.target.value; mutate(previous => ({ ...previous, name, dirty: true })); }} style={input} /></label>
      <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Growing layout
        <select aria-label="Growing layout" value={editor.mode} onChange={event => { const mode = event.target.value as 'beds' | 'open'; mutate(previous => ({ ...previous, mode, dirty: true })); }} style={input}>
          <option value="beds">Fill with beds</option><option value="open">Open field (no beds)</option>
        </select>
      </label>
      <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Length unit
        <select aria-label="Length unit" value={editor.lengths.unit} onChange={event => changeUnit(event.target.value as LengthUnit)} style={input}>
          <option value="m">Metres (m)</option><option value="ft">Feet (ft)</option>
        </select>
      </label>
      <p style={{ fontSize: 12, margin: '6px 0' }}>Use decimal numbers with a dot or comma; either is a decimal separator. No digit grouping, fractions or unit suffixes. Direction stays in degrees. Switching units changes entry and display only; saved dimensions remain in metres.</p>
      {preferenceNote && <p role="status" style={{ fontSize: 12 }}>{preferenceNote}</p>}
      {editor.mode === 'beds' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
        {([['bedLengthM', 'Bed length'], ['bedWidthM', 'Bed width'], ['pathWidthM', 'Path width']] as const).map(([field, label]) => <label key={field} style={{ fontSize: 12 }}>{label} ({editor.lengths.unit})
          <input aria-label={`${label} (${editor.lengths.unit})`} inputMode="decimal" value={editor.lengths.fields[field].text} onChange={event => {
            const text = event.target.value; mutate(previous => ({ ...previous, lengths: editLengthDraft(previous.lengths, field, text), dirty: true, unitError: '' }), editor.lengths.unit);
          }} style={input} />
        </label>)}
        <label style={{ fontSize: 12 }}>Direction (degrees)<input aria-label="Direction (degrees)" inputMode="decimal" value={editor.angle}
          onChange={event => { const angle = event.target.value; mutate(previous => ({ ...previous, angle, angleEdited: true, dirty: true })); }} style={input} /></label>
      </div>}
      {editor.sourceKey !== key || authorityChanged ? <p role="alert" style={{ fontSize: 12 }}>The saved field, map scale or account context changed. Your draft has been kept. Reload the field settings before applying.</p>
        : dimensions.status !== 'ready' && editor.mode === 'beds' ? <p role="alert" style={{ fontSize: 12 }}>Complete valid decimal bed and path dimensions before applying.</p> : null}
      <button type="button" onClick={reload} style={{ ...input, marginTop: 8, cursor: 'pointer' }}>Reload field settings</button>
      <p style={{ fontSize: 12, margin: '8px 0' }}>{editor.mode === 'open' ? 'The polygon becomes one field-sized crop-planning area; no beds are generated.'
        : preview?.error || `${preview?.count ?? 0} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.`}</p>
      <button type="button" disabled={!current || !config || editor.mode === 'beds' && (!preview?.count || !!preview.error)} onClick={() => {
        if (!active.current) return;
        const now = live.current;
        if (now.editor !== editor || editor.sourceKey !== sourceKey(now.state, now.frame, now.selectedId)
          || !lengthUnitPreferenceContextIsCurrent(editor.context) || authorityChanged || !config) {
          setError('The field or account context changed. Reload the field settings before applying.'); return;
        }
        const applied: FieldApplyAttempt = { editor, state: now.state, selectedId: now.selectedId, fieldId: selected.id,
          fromKey: editor.sourceKey, acknowledgedKey: null, errorAtStart: now.applyError, revoked: false };
        pendingApply.current = applied;
        const acknowledge: FieldBlockApplyAcknowledgement = appliedSourceKey => {
          const latest = live.current;
          if (pendingApply.current !== applied || applied.revoked || !active.current || latest.editor !== editor
            || latest.selectedId !== applied.selectedId || context.current !== editor.context
            || !lengthUnitPreferenceContextIsCurrent(editor.context)
            || sourceKey(latest.state, latest.frame, latest.selectedId) !== applied.fromKey) return;
          if (!appliedSourceKey || applied.acknowledgedKey !== null && applied.acknowledgedKey !== appliedSourceKey) { applied.revoked = true; return; }
          applied.acknowledgedKey = appliedSourceKey;
        };
        // A void callback still cannot discard the draft. Only its receipt plus
        // the matching committed layout can acknowledge this exact edit.
        try { now.onApply(selected.id, editor.name, config, acknowledge); setError(''); }
        catch (failure) { if (pendingApply.current === applied) pendingApply.current = null; setError((failure as Error).message); }
      }} style={{ ...input, background: '#245b40', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save field layout</button>
      {selected.fieldBlock && <p style={{ fontSize: 12 }}>Saved: {selected.fieldBlock.mode === 'open' ? 'open field' : `${state.items.filter(item => item.fieldBlockId === selected.id).length} beds`}. Saving again replaces this field’s generated layout.</p>}
    </>}
    {(error || editor.unitError || applyError) && <p role="alert" style={{ color: '#9b2525', fontSize: 12 }}>{error || editor.unitError || applyError}</p>}
    {onExport && <section aria-label="Field layout export" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #a8b5a8', minWidth: 0 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Google Earth field layout</h3>
      <p style={{ fontSize: 12 }}>This file contains map-reference locations and optional field labels from your saved layout. These locations have not been surveyed. Apply layout changes before exporting.</p>
      <label style={{ display: 'block', fontSize: 12 }}>Export fields<select aria-label="Export fields" value={exportOptions.allFields ? 'all' : 'selected'}
        onChange={event => changeExportOptions({ allFields: event.target.value === 'all' })} style={input}>
        <option value="selected">Selected field</option><option value="all">All fields</option>
      </select></label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 12 }}><input type="checkbox" aria-label="Include saved field labels" checked={exportOptions.includeLabels}
        onChange={event => changeExportOptions({ includeLabels: event.target.checked })} />Include saved field labels</label>
      <p style={{ fontSize: 12 }}>With labels off, the file uses generic numbered labels.</p>
      <button type="button" disabled={exporting || !exportSource || !fields.length || !exportOptions.allFields && !selected}
        onClick={exportLayout} style={{ ...input, cursor: 'pointer', fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Export field layout for Google Earth</button>
      {exporting && <p role="status" style={{ fontSize: 12 }}>Preparing field layout export…</p>}
      {exportFeedback?.generation === renderedExportGeneration && <p role={exportFeedback.result.status === 'held' ? 'alert' : 'status'} style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{exportFeedback.result.message}</p>}
    </section>}
    <Link href={`/facilitator/crops?canvasSite=${encodeURIComponent(state.siteId)}&auto=1`} style={{ display: 'block', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>Open automatic crop planner →</Link>
  </details>;
}
