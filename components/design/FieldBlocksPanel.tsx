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

interface Props {
  state: DesignCanvasState;
  frame: CanvasFrame;
  selectedId: string | null;
  onDraw: () => void;
  onSelect: (id: string) => void;
  onApply: (id: string, name: string, config: FieldBlockConfig) => void;
  applyError?: string | null;
}

type LengthKey = 'bedLengthM' | 'bedWidthM' | 'pathWidthM';
// Existing editor placeholders, not recommended crop dimensions.
const DEFAULTS: FieldBlockConfig = { mode: 'beds', bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5, angleDeg: 0 };
type Editor = { sourceKey: string; siteId: string; fieldId: string | null; name: string; mode: 'beds' | 'open';
  lengths: LengthDraft<LengthKey>; angle: string; originalAngle: number; angleEdited: boolean; dirty: boolean;
  context: LengthUnitPreferenceContext | null; unitError: string;
  unitSelection: { unit: LengthUnit; sourceKey: string; context: LengthUnitPreferenceContext | null } | null };
function selectedField(state: DesignCanvasState, selectedId: string | null): ZoneShape | undefined {
  return state.zones.find(zone => zone.feature === 'staple_garden' && (zone.id === selectedId
    || state.items.some(item => item.id === selectedId && item.fieldBlockId === zone.id)));
}
function sourceKey(state: DesignCanvasState, frame: CanvasFrame, selectedId: string | null): string {
  return fieldBlockSourceKey(state, selectedField(state, selectedId)?.id ?? null, frame);
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

export default function FieldBlocksPanel({ state, frame, selectedId, onDraw, onSelect, onApply, applyError }: Props) {
  const fields = state.zones.filter(zone => zone.feature === 'staple_garden');
  const selected = selectedField(state, selectedId), key = sourceKey(state, frame, selectedId);
  const [editor, setEditor] = useState(() => freshEditor(state, selected, key, 'm', null));
  const [error, setError] = useState(''), [preferenceNote, setPreferenceNote] = useState('');
  const [authorityChanged, setAuthorityChanged] = useState(false);
  const context = useRef<LengthUnitPreferenceContext | null>(null), stopPreference = useRef<() => void>(() => {});
  const active = useRef(false), interacted = useRef(false);
  const rememberedSelection = useRef<Editor['unitSelection']>(null);
  const live = useRef({ state, frame, selectedId, onApply, key, editor }); live.current = { state, frame, selectedId, onApply, key, editor };
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
    return () => { active.current = false; stopPreference.current(); revokeLengthUnitPreferenceContext(context.current); context.current = null; };
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
      <select aria-label="Field block" value={selected?.id ?? ''} onChange={event => onSelect(event.target.value)} style={input}>
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
        // The parent may reject its queued functional update after this callback
        // returns. Only an explicit reload may discard the entered draft.
        try { now.onApply(selected.id, editor.name, config); setError(''); }
        catch (failure) { setError((failure as Error).message); }
      }} style={{ ...input, background: '#245b40', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save field layout</button>
      {selected.fieldBlock && <p style={{ fontSize: 12 }}>Saved: {selected.fieldBlock.mode === 'open' ? 'open field' : `${state.items.filter(item => item.fieldBlockId === selected.id).length} beds`}. Saving again replaces this field’s generated layout.</p>}
    </>}
    {(error || editor.unitError || applyError) && <p role="alert" style={{ color: '#9b2525', fontSize: 12 }}>{error || editor.unitError || applyError}</p>}
    <Link href={`/facilitator/crops?canvasSite=${encodeURIComponent(state.siteId)}&auto=1`} style={{ display: 'block', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>Open automatic crop planner →</Link>
  </details>;
}
