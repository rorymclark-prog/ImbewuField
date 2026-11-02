'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import { bedsInsideField, fieldBlockExclusions, type FieldBlockConfig } from '@/lib/bed-block';
import { useLanguage } from '@/lib/i18n';
import { inlineTemplate, inlineText, isInlineDraftLang } from '@/lib/xh-inline';

interface Props {
  state: DesignCanvasState;
  frame: CanvasFrame;
  selectedId: string | null;
  onDraw: () => void;
  onSelect: (id: string) => void;
  onApply: (id: string, name: string, config: FieldBlockConfig) => void;
}

export default function FieldBlocksPanel({ state, frame, selectedId, onDraw, onSelect, onApply }: Props) {
  // English and the regional languages show the English wording below unchanged; a draft language
  // (lib/xh-inline.ts) reads the same English through its drafts.
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const fieldN = (n: number) => inlineTemplate(lang, 'Field {n}', null, { n });
  const fields = state.zones.filter(z => z.feature === 'staple_garden');
  const selected = fields.find(z => z.id === selectedId || state.items.some(i => i.id === selectedId && i.fieldBlockId === z.id));
  const [mode, setMode] = useState<'beds' | 'open'>('beds');
  const [name, setName] = useState('');
  const [values, setValues] = useState({ bedLengthM: '3', bedWidthM: '1.2', pathWidthM: '0.5', angleDeg: '0' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selected) return;
    setName(selected.name ?? fieldN(fields.findIndex(f => f.id === selected.id) + 1));
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
    catch (e) { return { count: 0, error: ui((e as Error).message) }; }
  }, [selected, mode, config, frame, state]);
  const input = { width: '100%', minHeight: 44, border: '1px solid #a8b5a8', borderRadius: 7, padding: '6px 8px', background: '#fffdf7', color: '#203d32' };
  return (
    <details style={{ padding: 10, border: '1px solid #a8b5a8', borderRadius: 10, background: '#f3f6ed', color: '#203d32' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, minHeight: 32 }}>{inlineTemplate(lang, 'Field blocks · {n}', null, { n: fields.length })}</summary>
      <p style={{ fontSize: 12, margin: '5px 0 10px' }}>{ui('Draw a field, then fill it with beds or keep it as open growing ground.')}</p>
      <button type="button" onClick={onDraw} style={{ ...input, cursor: 'pointer', fontWeight: 700 }}>{ui('Draw field polygon')}</button>
      {!!fields.length && <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>{isInlineDraftLang(lang) ? ui('Field block') : 'Field'}
        <select aria-label={ui('Field block')} value={selected?.id ?? ''} onChange={e => onSelect(e.target.value)} style={input}>
          <option value="" disabled>{ui('Select a field')}</option>
          {fields.map((f,i) => <option key={f.id} value={f.id}>{f.name ?? fieldN(i + 1)}</option>)}
        </select>
      </label>}
      {selected && <>
        <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>{ui('Field name')}<input aria-label={ui('Field name')} value={name} onChange={e => setName(e.target.value)} style={input} /></label>
        <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>{ui('Growing layout')}
          <select aria-label={ui('Growing layout')} value={mode} onChange={e => setMode(e.target.value as 'beds' | 'open')} style={input}>
            <option value="beds">{ui('Fill with beds')}</option><option value="open">{ui('Open field (no beds)')}</option>
          </select>
        </label>
        {mode === 'beds' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {([['bedLengthM','Bed length (m)'],['bedWidthM','Bed width (m)'],['pathWidthM','Path width (m)'],['angleDeg','Direction (degrees)']] as const).map(([key,label]) => <label key={key} style={{ fontSize: 12 }}>{ui(label)}
            <input aria-label={ui(label)} inputMode="decimal" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} style={input} />
          </label>)}
        </div>}
        <p style={{ fontSize: 12, margin: '8px 0' }}>{mode === 'open' ? ui('The polygon becomes one field-sized crop-planning area.') : preview?.error || inlineTemplate(lang, '{n} full-size beds fit. Paths separate rows and bed ends; unused edges stay unplanted. 0° runs east–west on the map.', null, { n: preview?.count ?? 0 })}</p>
        <button type="button" disabled={mode === 'beds' && (!preview?.count || !!preview.error)} onClick={() => {
          try { onApply(selected.id, name, config); setError(''); }
          catch (e) { setError(ui((e as Error).message)); }
        }} style={{ ...input, background: '#245b40', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{ui('Save field layout')}</button>
        {selected.fieldBlock && <p style={{ fontSize: 12 }}>{selected.fieldBlock.mode === 'open'
          ? ui('Saved: open field. Saving again replaces this field’s generated layout.')
          : inlineTemplate(lang, 'Saved: {n} beds. Saving again replaces this field’s generated layout.', null, { n: state.items.filter(i => i.fieldBlockId === selected.id).length })}</p>}
      </>}
      {error && <p role="alert" style={{ color: '#9b2525', fontSize: 12 }}>{error}</p>}
      <Link href={`/facilitator/crops?canvasSite=${encodeURIComponent(state.siteId)}&auto=1`} style={{ display: 'block', paddingTop: 10, fontWeight: 700, fontSize: 13 }}>{ui('Open automatic crop planner →')}</Link>
    </details>
  );
}
