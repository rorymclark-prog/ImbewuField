'use client';

import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { createMassDraft, readMassQuantityEntry, switchMassDraftUnit,
  type MassQuantityEntry, type MassUnit } from '@/lib/mass-units';

interface Props {
  readonly name: string;
  readonly entry: MassQuantityEntry;
  readonly fieldClass: string;
  readonly isCurrent: () => boolean;
  /** False means a retained callback no longer owns the parent editor. */
  readonly onEdit: (entry: MassQuantityEntry) => boolean;
}

function display(entry: MassQuantityEntry, unit: MassUnit) {
  const key = JSON.stringify(entry), read = readMassQuantityEntry(entry);
  if (read.status === 'held') return { key, unit: entry.unit, text: entry.text, held: true };
  // This draft paints conversions only. It never replaces authored unit/text,
  // and repeated toggles always start from the strict original entry.
  const draft = createMassDraft({ sourceKey: key, unit: entry.unit,
    kilograms: { weight: read.status === 'provided' ? read.kilograms : undefined }, optionalFields: ['weight'] });
  const switched = switchMassDraftUnit(draft, unit, key);
  if (switched.status !== 'ready') return { key, unit: entry.unit, text: entry.text, held: true };
  return { key, unit, text: unit === entry.unit ? entry.text : switched.draft.fields.weight.text, held: false };
}

/** Unit viewing is independent of country/language. Only an actual text edit
 * authors a new entry; rounding a converted display cannot edit a request. */
export default function GrowerEnteredMassField(props: Props) {
  const [unit, setUnit] = useState<MassUnit>(props.entry.unit);
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const entryKey = JSON.stringify(props.entry);
  const paint = useMemo(() => display(props.entry, unit), [entryKey, unit]);
  const live = useRef(props); live.current = props;
  const paintRef = useRef<typeof paint | null>(paint); paintRef.current = paint;
  const current = () => mounted.current && live.current === props && paintRef.current === paint && props.isCurrent();
  const changeUnit = (next: string) => {
    if (!current() || next !== 'kg' && next !== 'lb' || next === paint.unit) return;
    const nextPaint = display(props.entry, next);
    if (nextPaint.held || nextPaint.unit !== next) {
      setMessage('Complete or correct this weight before switching units. Your text is kept.'); return;
    }
    paintRef.current = null; setMessage(''); setUnit(next);
  };
  const edit = (text: string) => {
    if (!current() || text === paint.text) return;
    // The parent withdraws its review synchronously and removes the other
    // weight branch. A stale local field cannot manufacture new authorship.
    if (!props.onEdit({ unit: paint.unit, text })) return;
    paintRef.current = null; setMessage('');
  };
  return createElement('div', { className: 'space-y-2' },
    createElement('label', { className: 'block' }, `Weight display unit — ${props.name}`,
      createElement('select', { className: props.fieldClass, value: paint.unit,
        onChange: (event: { target: { value: string } }) => changeUnit(event.target.value) },
      createElement('option', { value: 'kg' }, 'Kilograms (kg)'), createElement('option', { value: 'lb' }, 'Pounds (lb)'))),
    createElement('label', { className: 'block' }, `Gross harvest weight for the whole window, ${paint.unit} — ${props.name}`,
      createElement('input', { type: 'text', inputMode: 'decimal', autoComplete: 'off', className: props.fieldClass,
        value: paint.text, onChange: (event: { target: { value: string } }) => edit(event.target.value) })),
    createElement('p', { className: 'text-xs' }, 'Use a dot or comma for the decimal point, without thousands separators.'),
    paint.unit !== props.entry.unit && createElement('p', { className: 'text-xs' },
      '≈ Converted display only; it may be rounded. Switching units keeps the original entered weight until you edit the number.'),
    (message || paint.held) && createElement('p', { role: 'status' }, message || 'Complete or correct this weight before switching units. Your text is kept.'));
}
