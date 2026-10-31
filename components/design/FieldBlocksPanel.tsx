'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import { bedsInsideField, fieldBlockExclusions, type FieldBlockConfig } from '@/lib/bed-block';

interface Props {
  state: DesignCanvasState;
  frame: CanvasFrame;
  selectedId: string | null;
  onDraw: () => void;
  onSelect: (id: string) => void;
  onApply: (id: string, name: string, config: FieldBlockConfig) => void;
}

export default function FieldBlocksPanel({ state, frame, selectedId, onDraw, onSelect, onApply }: Props) {
  const fields = state.zones.filter(z => z.feature === 'staple_garden');
  const selected = fields.find(z => z.id === selectedId || state.items.some(i => i.id === selectedId && i.fieldBlockId === z.id));
  const [mode, setMode] = useState<'beds' | 'open'>('beds');
  const [name, setName] = useState('');
  const [values, setValues] = useState({ bedLengthM: '3', bedWidthM: '1.2', pathWidthM: '0.5', angleDeg: '0' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selected) return;
    setName(selected.name ?? `Field ${fields.findIndex(f => f.id === selected.id) + 1}`);
    setMode(selected.fieldBlock?.mode ?? 'beds');
    if (selected.fieldBlock) {
      const c = selected.fieldBlock;
      setValues({ bedLengthM: String(c.bedLengthM), bedWidthM: String(c.bedWidthM), pathWidthM: String(c.pathWidthM), angleDeg: String(c.angleDeg) });
    }
    setError('');
  // Selecting a different field loads its own saved settings, without resetting an in-progress edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  const config = useMemo<FieldBlockConfig>(() => {
    const parsed = (key: keyof typeof values) => values[key].trim() ? Number(values[key].replace(',', '.')) : NaN;
    return mode === 'open'
      ? { mode, bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5, angleDeg: 0 }
      : { mode, bedLengthM: parsed('bedLengthM'), bedWidthM: parsed('bedWidthM'), pathWidthM: parsed('pathWidthM'), angleDeg: parsed('angleDeg') };
  }, [mode, values]);
  const preview = useMemo(() => {
    if (!selected || mode === 'open') return null;
    try { return { count: bedsInsideField(selected.points, config, frame, fieldBlockExclusions(state, selected.id, frame)).beds.length, error: '' }; }
    catch (e) { return { count: 0, error: (e as Error).message }; }
  }, [selected, mode, config, frame, state]);
  const input = { width: '100%', minHeight: 44, border: '1px solid #a8b5a8', borderRadius: 7, padding: '6px 8px', background: '#fffdf7', color: '#203d32' };
  return (
    <details style={{ padding: 10, border: '1px solid #a8b5a8', borderRadius: 10, background: '#f3f6ed', color: '#203d32' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, minHeight: 32 }}>Field blocks · {fields.length}</summary>
      <p style={{ fontSize: 12, margin: '5px 0 10px' }}>Draw a field, then fill it with beds or keep it as open growing ground.</p>
      <button type="button" onClick={onDraw} style={{ ...input, cursor: 'pointer', fontWeight: 700 }}>Draw field polygon</button>
      {!!fields.length && <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Field
        <select aria-label="Field block" value={selected?.id ?? ''} onChange={e => onSelect(e.target.value)} style={input}>
          <option value="" disabled>Select a field</option>
          {fields.map((f,i) => <option key={f.id} value={f.id}>{f.name ?? `Field ${i+1}`}</option>)}
        </select>
      </label>}
      {selected && <>
        <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Field name<input aria-label="Field name" value={name} onChange={e => setName(e.target.value)} style={input} /></label>
        <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Growing layout
          <select aria-label="Growing layout" value={mode} onChange={e => setMode(e.target.value as 'beds' | 'open')} style={input}>
            <option value="beds">Fill with beds</option><option value="open">Open field (no beds)</option>
          </select>
        </label>
        {mode === 'beds' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {([['bedLengthM','Bed length (m)'],['bedWidthM','Bed width (m)'],['pathWidthM','Path width (m)'],['angleDeg','Direction (degrees)']] as const).map(([key,label]) => <label key={key} style={{ fontSize: 12 }}>{label}
            <input aria-label={label} inputMode="decimal" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} style={input} />
          </label>)}
        </div>}
        <p style={{ fontSize: 12, margin: '8px 0' }}>{mode === 'open' ? 'The polygon becomes one field-sized crop-planning area.' : preview?.error || `${preview?.count ?? 0} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.`}</p>
        <button type="button" disabled={mode === 'beds' && (!preview?.count || !!preview.error)} onClick={() => {
          try { onApply(selected.id, name, config); setError(''); }
          catch (e) { setError((e as Error).message); }
        }} style={{ ...input, background: '#245b40', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save field layout</button>
        {selected.fieldBlock && <p style={{ fontSize: 12 }}>Saved: {selected.fieldBlock.mode === 'open' ? 'open field' : `${state.items.filter(i => i.fieldBlockId === selected.id).length} beds`}. Saving again replaces this field’s generated layout.</p>}
      </>}
      {error && <p role="alert" style={{ color: '#9b2525', fontSize: 12 }}>{error}</p>}
      <Link href={`/facilitator/crops?canvasSite=${encodeURIComponent(state.siteId)}&auto=1`} style={{ display: 'block', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>Open automatic crop planner →</Link>
    </details>
  );
}
