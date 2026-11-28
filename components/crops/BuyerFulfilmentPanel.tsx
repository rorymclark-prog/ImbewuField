'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  harvestTargetUnit, harvestTargetWeekWindows, sanitiseHarvestTargets, type HarvestTarget, type PlanBed,
} from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import type { BuyerSaleRead } from '@/lib/db/cycle-harvest';
import { addDecimalQuantity, decimalQuantityNumber, type DecimalQuantity } from '@/lib/farm-records';
import { projectBuyerFulfilment, type BuyerFulfilmentEntry, type CheckedFulfilmentSource, type FulfilmentLine } from '@/lib/international/buyer-fulfilment';
import type { GardenReportRead } from '@/lib/international/projects/garden-report-source';
import { addGrowerUtcDays } from '@/lib/international/grower-planning';
import { weeklyProductionOrders, type WeeklyProductionCycle } from '@/lib/international/grower-weekly-production';
import { buildBuyerWeekPrint } from '@/lib/international/buyer-week-print';
import { downloadFile } from '@/lib/crop-export-deliver';
import { formatExactUnitDecimal, parseExactUnitDecimal } from '@/lib/length-units';
import { createHarvestSaveRequest, harvestSaveContextIsCurrent, harvestSaveResultMatches,
  type HarvestSaveContext, type HarvestSaveRequest, type HarvestSaveResult } from '@/lib/nursery-save-receipt';
import type { useGrowerOperations } from './useGrowerOperations';

export interface BuyerFulfilmentSave {
  context: HarvestSaveContext | null;
  onSave: (targets: HarvestTarget[], request: HarvestSaveRequest) => HarvestSaveResult | false;
}

type SourceSnapshot = {
  readonly revision: number;
  readonly siteId: string;
  readonly harvest: GardenReportRead | null;
  readonly sales: BuyerSaleRead | null;
  readonly sources: readonly CheckedFulfilmentSource[];
  readonly current: () => boolean;
};

function entryKey(entry: BuyerFulfilmentEntry) {
  return JSON.stringify([entry.start, entry.kind, entry.sourceId]);
}

function checkedSubtotal(lines: readonly FulfilmentLine[], kind: BuyerFulfilmentEntry['kind']): number | null {
  const values = lines.filter(line => line.status === 'checked' && line.entry.kind === kind);
  return values.length ? decimalQuantityNumber(values.reduce<DecimalQuantity | undefined>(
    (total, line) => addDecimalQuantity(total, line.entry.quantity), undefined,
  )) : null;
}

const heldLabels = {
  'source-unavailable': 'Original record unavailable',
  'source-ambiguous': 'Duplicate record needs review',
  'source-changed': 'Original record changed',
  'invalid-evidence-date': 'Date needs review',
  'outside-quantity': 'Allocations exceed the recorded quantity',
  'source-needs-reconciliation': 'Another entry from this record needs review',
} as const;
const field = 'min-h-11 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-2';
const button = 'inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-3 disabled:opacity-50';

export default function BuyerFulfilmentPanel({ siteId, targetSiteId, targets, operations, harvest, save, practice, beds, cycles }: {
  siteId: string;
  targetSiteId: string;
  targets: readonly HarvestTarget[];
  operations: ReturnType<typeof useGrowerOperations>;
  harvest: GardenReportRead | null;
  save: BuyerFulfilmentSave;
  practice: boolean;
  beds: readonly PlanBed[];
  cycles: readonly WeeklyProductionCycle[];
}) {
  const [snapshot, setSnapshot] = useState<SourceSnapshot | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [kind, setKind] = useState<BuyerFulfilmentEntry['kind']>('delivery');
  const [sourceId, setSourceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [on, setOn] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draftBinding, setDraftBinding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (operations.status !== 'ready') return;
    let active = true;
    const current = () => active && operations.isCurrent();
    void Promise.all([operations.readBuyerSales(current), harvest?.readLinkedHarvestSources() ?? null]).then(([sales, linked]) => {
      if (current()) setSnapshot({ revision: operations.gardenRevision, siteId, harvest, sales,
        sources: [...(sales?.sources ?? []), ...(linked ?? [])], current });
    }).catch(() => {
      if (current()) setSnapshot(null);
    });
    return () => { active = false; };
  }, [operations, siteId, harvest, refresh]);

  const current = snapshot?.revision === operations.gardenRevision && snapshot.siteId === siteId
    && snapshot.harvest === harvest && snapshot.current() ? snapshot : null;
  const sources = current?.sources.filter(source => source.kind === 'sale'
    ? current.sales?.isCurrent() : current.harvest?.isCurrent()) ?? [];
  const allTargets = operations.status === 'ready' ? sanitiseHarvestTargets(operations.book.harvestTargets ?? []) : [];
  const target = targets.find(row => row.id === selectedTarget) ?? targets[0];
  const periods = target ? harvestTargetWeekWindows(target) : [];
  const period = periods.find(row => row.start === selectedPeriod) ?? periods[0];
  const binding = JSON.stringify([targetSiteId, operations.gardenRevision, target?.id, period?.start]);
  useEffect(() => {
    if (draftBinding !== null && draftBinding !== binding) {
      setDraftBinding(null); setEditing(null); setSourceId(''); setQuantity(''); setOn('');
    }
  }, [binding, draftBinding]);

  const checkedOn = new Date().toISOString().slice(0, 10);
  const mapped = (rows: readonly HarvestTarget[]) => rows.map(row => row.siteId === targetSiteId ? { ...row, mappedSiteId: siteId } : row);
  const lines = target && period ? projectBuyerFulfilment(mapped(allTargets), sources, checkedOn)
    .filter(line => line.targetId === target.id && line.entry.start === period.start) : [];
  const unit = target ? harvestTargetUnit(target) : 'kg';
  const available = target ? sources.filter(source => source.cropKey === target.cropKey && source.unit === unit
    && (source.kind === 'sale' ? kind === 'delivery' : kind === 'harvest-allocation')) : [];
  const selectedSource = available.find(source => source.id === sourceId);

  function clearDraft() { setDraftBinding(null); setEditing(null); setSourceId(''); setQuantity(''); setOn(''); }
  function chooseEntry(entry: BuyerFulfilmentEntry) {
    setDraftBinding(binding); setEditing(entryKey(entry)); setKind(entry.kind); setSourceId(entry.sourceId);
    setQuantity(formatExactUnitDecimal(entry.quantity)); setOn(entry.on); setMessage('');
  }

  async function persist(entry: BuyerFulfilmentEntry | null, removeKey: string | null) {
    if (pending.current || !target || !current || !operations.isCurrent() || !save.context || !harvestSaveContextIsCurrent(save.context)) {
      setMessage('Reopen the current buyer records before saving.'); return;
    }
    const savedTarget = allTargets.find(row => row.id === target.id && row.siteId === targetSiteId);
    if (!savedTarget || !period || operations.status !== 'ready'
      || allTargets.length !== (operations.book.harvestTargets ?? []).length) {
      setMessage('The saved buyer orders need review.'); return;
    }
    const existing = savedTarget.fulfilment ?? [];
    if (removeKey && !existing.some(row => entryKey(row) === removeKey)) {
      setMessage('This entry changed. Check the current buyer records.'); return;
    }
    const retained = existing.filter(row => entryKey(row) !== removeKey);
    if (entry && retained.some(row => entryKey(row) === entryKey(entry))) {
      setMessage('This record already has an entry in the selected week. Edit the existing entry.'); return;
    }
    const next = allTargets.map(row => row.id === savedTarget.id ? {
      ...row, fulfilment: entry ? [...retained, entry] : retained,
    } : row);
    if (sanitiseHarvestTargets(next).length !== allTargets.length) {
      setMessage('Check the date, quantity and unit for this week.'); return;
    }
    if (entry) {
      const proposed = projectBuyerFulfilment(mapped(next), sources, checkedOn).find(line => line.entry === entry);
      if (!proposed || proposed.status === 'held') {
        setMessage(proposed?.status === 'held' ? heldLabels[proposed.reason] : 'Check the selected saved record.');
        return;
      }
    }
    const request = createHarvestSaveRequest(save.context, next);
    if (!request) { setMessage('The saved buyer orders changed. Reopen this plan.'); return; }
    pending.current = true; setBusy(true);
    try {
      const confirmed = entry?.kind === 'delivery' ? await current.sales?.checkCurrent()
        : entry?.kind === 'harvest-allocation' ? await current.harvest?.checkCurrent() : true;
      if (!confirmed || !current.current() || !harvestSaveContextIsCurrent(save.context)) {
        setMessage('The selected record or workspace changed. Check the records again.');
        setRefresh(value => value + 1); return;
      }
      const result = save.onSave(next, request);
      if (!harvestSaveResultMatches(result, request)) {
        setMessage('Save was not confirmed. Reopen this plan before retrying.'); return;
      }
      clearDraft();
      setMessage(entry ? 'Buyer entry saved. The original record is retained.' : 'Buyer entry removed.');
    } catch {
      setMessage('Buyer entry could not be saved. Check the current records and try again.');
    } finally { pending.current = false; setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draftBinding !== binding) {
      clearDraft(); setMessage('This buyer draft belongs to an earlier plan. Enter the current details again.'); return;
    }
    const parsed = parseExactUnitDecimal(quantity);
    if (!period || !selectedSource || parsed.status !== 'ready' || parsed.value < 0 || !on) {
      setMessage('Choose a checked record and enter a date and quantity. Enter 0 to record zero.'); return;
    }
    void persist({ start: period.start, endExclusive: period.endExclusive, kind, on, unit, quantity: parsed.value,
      sourceId: selectedSource.id, sourceFingerprint: selectedSource.fingerprint,
    }, editing);
  }

  if (!target || !period) return null;
  const allocated = checkedSubtotal(lines, 'harvest-allocation'), delivered = checkedSubtotal(lines, 'delivery');
  const show = (value: number | null) => value === null ? 'Unknown' : `${formatExactUnitDecimal(value)} ${unit === 'each' ? 'items' : unit}`;
  const quantities = weeklyProductionOrders(target, []).find(row => row.start === period.start);
  const linked = sources.filter(source => source.kind === 'harvest' && source.cropKey === target.cropKey && source.unit === unit
    && source.sourceOn >= period.start && source.sourceOn < period.endExclusive);
  const counts = new Map<string, number>();
  for (const source of linked) counts.set(source.id, (counts.get(source.id) ?? 0) + 1);
  const uniquelyLinked = linked.filter(source => counts.get(source.id) === 1);
  const harvested = uniquelyLinked.length ? decimalQuantityNumber(uniquelyLinked.reduce<DecimalQuantity | undefined>(
    (sum, source) => addDecimalQuantity(sum, source.quantity), undefined,
  )) : null;
  const totals = [
    { label: 'Ordered', value: show(quantities?.requested ?? null) },
    { label: 'Planned', value: show(quantities?.planned ?? null) },
    { label: 'Harvested in this garden', value: show(harvested) },
    { label: 'Allocated to this order', value: show(allocated) },
    { label: 'Recorded delivery', value: show(delivered) },
  ];

  async function printWeek() {
    if (pending.current || !current || !period || !target) return;
    pending.current = true; setBusy(true);
    const stillCurrent = () => current.current() && operations.isCurrent()
      && (current.sales?.isCurrent() ?? true) && (current.harvest?.isCurrent() ?? true);
    const check = async () => stillCurrent()
      && await operations.checkCurrent()
      && (await current.sales?.checkCurrent() ?? true)
      && (await current.harvest?.checkCurrent() ?? true)
      && stillCurrent();
    try {
      if (!await check()) {
        setMessage('The records changed. Check the current records before printing.');
        setRefresh(value => value + 1); return;
      }
      const work = cycles.flatMap(cycle => {
        const bed = beds.find(row => row.id === cycle.bedId)?.label ?? 'Mapped bed';
        const crop = cropByKey(cycle.cropKey)?.name ?? cycle.cropKey;
        const basis = cycle.basis === 'accepted' ? 'Saved plan' : 'Worked example';
        const schedule = cycle.schedule;
        const entries = [
          ...(schedule.nurseryStartDate ? [{ date: schedule.nurseryStartDate, task: `Sow ${crop} in nursery` }] : []),
          { date: schedule.fieldEntryDate, task: schedule.nurseryStartDate ? `Plant ${crop}` : `Direct sow ${crop}` },
          { date: schedule.firstHarvestDate, task: `First pick · ${crop}` },
        ];
        return entries.filter(row => row.date >= period.start && row.date < period.endExclusive)
          .map(row => ({ ...row, bed, basis }));
      }).sort((a, b) => a.date.localeCompare(b.date));
      const html = buildBuyerWeekPrint({
        site: current.harvest?.records.siteLabel ?? (practice ? 'Green Horizon' : 'Selected mapped garden'),
        buyer: target.outlet ?? 'Buyer target', crop: cropByKey(target.cropKey)?.name ?? target.cropKey,
        start: period.start, through: addGrowerUtcDays(period.endExclusive, -1) ?? period.start, practice, totals, work,
        entries: lines.map(line => ({
          date: line.entry.on, kind: line.entry.kind === 'delivery' ? 'Delivery' : 'Harvest allocation',
          quantity: show(line.entry.quantity), status: line.status === 'checked' ? 'Checked' : heldLabels[line.reason],
        })),
      });
      const outcome = await downloadFile(new Blob([html], { type: 'text/html;charset=utf-8' }),
        `${practice ? 'DEMO-' : ''}weekly-work-and-buyers.html`, check, stillCurrent);
      setMessage(outcome === 'downloaded' ? 'Weekly summary downloaded. Open the file to print it.' : 'Weekly summary was not downloaded.');
    } catch {
      setMessage('The weekly summary could not be prepared.');
    } finally { pending.current = false; setBusy(false); }
  }

  return <section aria-label="Buyer fulfilment" className="mt-3 min-w-0 space-y-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <h3 className="font-semibold">Buyer fulfilment</h3>
    {practice && <p>Fictional delivery and allocation records for practice.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid">Buyer order<select className={field} disabled={busy} value={target.id} onChange={event => {
        setSelectedTarget(event.target.value); setSelectedPeriod(''); clearDraft();
      }}>{targets.map(row => <option key={row.id} value={row.id}>{row.outlet ?? 'Buyer target'} · {cropByKey(row.cropKey)?.name ?? row.cropKey}</option>)}</select></label>
      <label className="grid">Order week<select className={field} disabled={busy} value={period.start} onChange={event => {
        setSelectedPeriod(event.target.value); clearDraft();
      }}>{periods.map(row => <option key={row.start} value={row.start}>{row.start}</option>)}</select></label>
    </div>
    <dl className="grid gap-2 sm:grid-cols-2">{totals.map(row => <div key={row.label}>
      <dt>{row.label}</dt><dd className="font-semibold">{row.value}</dd>
    </div>)}</dl>
    {(current?.sales?.incomplete || current?.harvest?.records.incomplete) && <p>Some source records need review.</p>}
    <p>Delivery completeness is unknown. Sale dates and picking dates are shown with their original records.</p>
    {lines.length > 0 && <ul className="space-y-2">{lines.map(line => <li key={entryKey(line.entry)}>
      <p>{line.entry.kind === 'delivery' ? 'Delivery' : 'Harvest allocation'} · {line.entry.on} · {show(line.entry.quantity)}
        {line.status === 'held' ? ` · ${heldLabels[line.reason]}` : ' · Checked'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => chooseEntry(line.entry)}>Edit buyer entry</button>
        <button type="button" className={button} disabled={busy} onClick={() => void persist(null, entryKey(line.entry))}>Remove buyer entry</button>
      </div>
    </li>)}</ul>}
    <button type="button" className={button} disabled={busy} onClick={() => { setSnapshot(null); setRefresh(value => value + 1); }}>Check harvest and sales</button>
    <form onSubmit={submit} onChange={() => setDraftBinding(binding)} className="grid gap-2" aria-label="Buyer entry">
      <label className="grid">Entry type<select className={field} value={kind} disabled={busy} onChange={event => {
        setKind(event.target.value as BuyerFulfilmentEntry['kind']); setSourceId('');
      }}><option value="delivery">Delivery against a recorded sale</option><option value="harvest-allocation">Allocate linked harvest</option></select></label>
      <label className="grid">Checked record<select className={field} value={sourceId} disabled={busy} onChange={event => setSourceId(event.target.value)}>
        <option value="">Choose a checked record</option>{available.map(source => (
          <option key={source.id} value={source.id}>{source.sourceOn} · {show(source.quantity)} · {source.id.slice(-12)}</option>
        ))}
      </select></label>
      <label className="grid">{kind === 'delivery' ? 'Actual handover date' : 'Allocation date'}<input className={field} type="date" value={on} disabled={busy} onChange={event => setOn(event.target.value)} /></label>
      <label className="grid">Entry quantity<input className={field} inputMode="decimal" value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label>
      <button type="submit" className={button} disabled={busy || !current || !save.context}>
        {editing ? 'Save buyer correction' : 'Save buyer entry'}
      </button>
      {editing && <button type="button" className={button} onClick={clearDraft} disabled={busy}>Cancel buyer correction</button>}
    </form>
    <button type="button" className={button} disabled={busy || !current} onClick={() => void printWeek()}>
      Download weekly work and buyer summary
    </button>
    {message && <p role="status">{message}</p>}
  </section>;
}
