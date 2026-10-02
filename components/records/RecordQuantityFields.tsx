'use client';

import { useId } from 'react';
import { RECORD_UNITS, type RecordUnit } from '@/lib/farm-records';

/** Unit choice is explicit: a produce name cannot tell us an egg count or a jar's weight. */
export default function RecordQuantityFields({ idPrefix, quantity, unit, onQuantityChange, onUnitChange, label = 'Quantity' }: {
  idPrefix: string;
  quantity: string;
  unit: RecordUnit;
  onQuantityChange: (quantity: string) => void;
  onUnitChange: (unit: RecordUnit) => void;
  label?: string;
}) {
  const instanceId = useId();
  const quantityId = `${idPrefix}-${instanceId}-quantity`;
  const unitId = `${idPrefix}-${instanceId}-unit`;
  const controlStyle = { minHeight: 44, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  return <div className="grid grid-cols-2 gap-2" data-record-quantity-fields>
    <div>
      <label htmlFor={quantityId} className="block text-xs font-sans font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-strong)' }}>{label}</label>
      <input id={quantityId} type="text" inputMode={unit === 'eggs' || unit === 'each' ? 'numeric' : 'decimal'} value={quantity} placeholder={unit === 'kg' ? '0.0' : '0'} onChange={(event) => onQuantityChange(event.target.value)} className="dark-input w-full rounded-lg px-3 py-2 text-sm font-sans outline-none" style={controlStyle} />
    </div>
    <div>
      <label htmlFor={unitId} className="block text-xs font-sans font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-strong)' }}>Unit</label>
      <select id={unitId} value={unit} onChange={(event) => onUnitChange(event.target.value as RecordUnit)} className="dark-input w-full rounded-lg px-3 py-2 text-sm font-sans outline-none" style={controlStyle}>
        {RECORD_UNITS.map((value) => <option key={value} value={value}>{value === 'each' ? 'items' : value}</option>)}
      </select>
    </div>
  </div>;
}
