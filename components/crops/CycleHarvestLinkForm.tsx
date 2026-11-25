'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { recordQuantityLabel, type RecordUnit } from '@/lib/farm-records';
import { isJournalDate } from '@/lib/field-journal';

type HarvestLink = { recordId: string; observedOn: string };

export interface CycleHarvestLinkFormProps {
  options: readonly {
    recordId: string;
    crop: string;
    quantity: number;
    unit: RecordUnit;
    enteredAt: string | null;
  }[];
  linked?: readonly HarvestLink[];
  status: 'loading' | 'ready' | 'held';
  disabled?: boolean;
  maxObservedOn?: string;
  onSave(input: HarvestLink): void;
  onRemove?(input: HarvestLink): void;
  onClose(): void;
}

const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const field = 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';

function describeRecord({ crop, quantity, unit, enteredAt }: CycleHarvestLinkFormProps['options'][number]): string {
  const enteredDay = enteredAt?.slice(0, 10);
  const amount = recordQuantityLabel({ quantity, unit, kg: unit === 'kg' ? quantity : null });
  return `${crop} · ${amount} · ${isJournalDate(enteredDay) ? `entered ${enteredDay} (UTC)` : 'entry date unavailable'}`;
}

export default function CycleHarvestLinkForm({ options, linked, status, disabled, maxObservedOn, onSave, onRemove, onClose }: CycleHarvestLinkFormProps) {
  const id = useId();
  const [recordId, setRecordId] = useState('');
  const [observedOn, setObservedOn] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [removal, setRemoval] = useState<HarvestLink | null>(null);
  const selectedRecord = options.find(option => option.recordId === recordId);
  const canSave = status === 'ready' && !disabled && !!selectedRecord && isJournalDate(observedOn)
    && (!maxObservedOn || observedOn <= maxObservedOn) && confirmed;
  const labels = options.map(describeRecord);
  const seen = new Set<string>(), duplicates = new Set<string>();
  for (const label of labels) {
    if (seen.has(label)) duplicates.add(label);
    seen.add(label);
  }

  return (
    <form aria-label="Link harvest to crop cycle" className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-0)] p-3"
      onSubmit={event => { event.preventDefault(); if (canSave) onSave({ recordId, observedOn }); }}>
      <h3 className="font-semibold">Link an existing harvest</h3>
      <p>Choose the record for this crop cycle and enter the day you picked it. Each option shows when the record was entered.</p>
      <p>The link is private to your account. Your crop progress report can include the harvest date and recorded quantity.</p>
      {status === 'loading' && <p role="status">Checking your harvest records…</p>}
      {status === 'held' && <p role="status">Your harvest records could not be checked. Close this form and open it again to try once more.</p>}
      {status === 'ready' && !!linked?.length && (
        <section aria-label="Linked to this cycle" className="space-y-2">
          <h4 className="font-semibold">Linked to this cycle</h4>
          <ul className="space-y-2">
            {linked.map((link, index) => {
              const record = options.find(option => option.recordId === link.recordId);
              const descriptionId = `${id}-linked-${index}`;
              const confirming = removal?.recordId === link.recordId && removal.observedOn === link.observedOn;
              return <li key={link.recordId} className="space-y-2 break-words rounded-lg border border-[var(--border)] p-2">
                <p id={descriptionId}>
                  <time dateTime={link.observedOn}>{link.observedOn}</time> · {record ? describeRecord(record) : 'Harvest record unavailable'}
                  {' · ref '}{link.recordId.slice(-8)}
                </p>
                {onRemove && (confirming ? <>
                  <p id={`${descriptionId}-notice`}>Removing the link leaves Harvest Records unchanged. You can link an available harvest again with the correct picking date.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={button} disabled={disabled} aria-describedby={`${descriptionId} ${descriptionId}-notice`}
                      onClick={() => { if (!disabled) { setRemoval(null); onRemove(link); } }}>Confirm remove harvest link</button>
                    <button type="button" className={button} disabled={disabled} onClick={() => setRemoval(null)}>Cancel removal</button>
                  </div>
                </> : <button type="button" className={button} disabled={disabled} aria-describedby={descriptionId}
                  onClick={() => { if (!disabled) setRemoval(link); }}>Remove harvest link</button>)}
              </li>;
            })}
          </ul>
        </section>
      )}
      {status === 'ready' && options.length === 0 && (
        <div className="space-y-2">
          <p role="status">There are no harvest records available to link.</p>
          <Link href="/records?tab=picked#log-harvest" prefetch={false}
            className="inline-flex min-h-11 items-center underline">Open Harvest Records</Link>
        </div>
      )}
      {status === 'ready' && options.length > 0 && <>
        <label htmlFor={`${id}-record`} className="block space-y-1">
          Harvest record
          <select id={`${id}-record`} aria-label="Harvest record" className={field} required disabled={disabled}
            value={selectedRecord ? recordId : ''}
            onChange={event => { setRecordId(event.target.value); setConfirmed(false); }}>
            <option value="">Choose a harvest record</option>
            {options.map((option, index) => (
              <option key={option.recordId} value={option.recordId}>
                {labels[index]}{duplicates.has(labels[index]) ? ` · ref ${option.recordId.slice(-8)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-date`} className="block space-y-1">
          Actual harvest date
          <input id={`${id}-date`} aria-label="Actual harvest date" type="date" className={field} max={maxObservedOn} required disabled={disabled}
            value={observedOn} onChange={event => { setObservedOn(event.target.value); setConfirmed(false); }} />
        </label>
        <label htmlFor={`${id}-confirm`} className="flex min-h-11 items-center gap-2">
          <input id={`${id}-confirm`} aria-label="Confirm harvest belongs to this crop cycle" type="checkbox" checked={confirmed}
            required disabled={disabled} onChange={event => setConfirmed(event.target.checked)} />
          I confirm this record and picking date belong to this crop cycle.
        </label>
      </>}
      <div className="flex flex-wrap gap-2">
        {status === 'ready' && options.length > 0 && <button type="submit" className={button} disabled={!canSave}>Link harvest record</button>}
        <button type="button" className={button} disabled={disabled} onClick={onClose}>Cancel harvest link</button>
      </div>
    </form>
  );
}
