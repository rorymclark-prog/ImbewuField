'use client';

import { cropByKey } from '@/lib/crop-catalog';
import type { HarvestTarget, PlanBed, Planting } from '@/lib/crop-plan';
import { addGrowerUtcDays } from '@/lib/international/grower-planning';
import { weeklyAcceptedCycles, weeklyProductionOrders, type WeeklyProductionCycle, type WeeklyProductionWindow } from '@/lib/international/grower-weekly-production';
import Link from 'next/link';
import type { BuyerFulfilmentSave } from './BuyerFulfilmentPanel';
import GrowerWeeklyRecords from './GrowerWeeklyRecords';
import { useGrowerOperations } from './useGrowerOperations';

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDate = (date: string) => day.format(new Date(date));

function periodLabel(period: WeeklyProductionWindow): string {
  const last = addGrowerUtcDays(period.endExclusive, -1) ?? period.start;
  return period.start === last ? formatDate(last) : `${formatDate(period.start)} – ${formatDate(last)}`;
}

export function showQuantity(quantity: number, unit: string, estimated = false): string {
  const format = estimated ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 15 };
  return `${quantity.toLocaleString('en-GB', format)} ${unit === 'each' ? 'items' : unit}`;
}

export default function GrowerWeeklyProduction({ siteId, targetSiteId = siteId, beds, targets, plantings, cycles: proposed,
  practice = false, availability = [], fulfilmentSave }: {
  siteId: string;
  targetSiteId?: string;
  beds: readonly PlanBed[];
  targets: readonly HarvestTarget[];
  plantings: readonly Planting[];
  cycles: readonly WeeklyProductionCycle[];
  practice?: boolean;
  fulfilmentSave?: BuyerFulfilmentSave;
  availability?: readonly (WeeklyProductionWindow & { bedId: string })[];
}) {
  const operations = useGrowerOperations();
  const ready = targetSiteId === siteId && operations.status === 'ready' && operations.isCurrent();
  const contexts = ready ? operations.contexts.filter(context => context.scope?.kind === 'mapped-site'
    && context.scope.siteId === siteId) : [];
  const cycles = ready ? [
    ...proposed.filter(cycle => cycle.basis === 'worked-example'),
    ...weeklyAcceptedCycles(siteId, operations.book.plantings, contexts.length === 1 ? contexts[0] : null),
  ] : proposed;
  return (
  <section aria-labelledby="weekly-production-title" className="my-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm" lang="en">
    <h2 id="weekly-production-title" className="font-display text-lg font-semibold">Weekly production and buyer orders</h2>
    <p>Planned quantities come from saved entries for each period. Picking dates and whole-cycle estimates remain separate.</p>
      {cycles.length > 0 && <details className="rounded-lg border border-[var(--border)] p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">Sowing and first-pick dates</summary>
        <ul className="space-y-2">
          {[...cycles].sort((a, b) => (a.schedule.nurseryStartDate ?? a.schedule.fieldEntryDate)
            .localeCompare(b.schedule.nurseryStartDate ?? b.schedule.fieldEntryDate)).map(cycle => <li key={cycle.plantingId ?? cycle.bedId}>
            <strong>{beds.find(bed => bed.id === cycle.bedId)?.label ?? 'Mapped bed'} · {cropByKey(cycle.cropKey)?.name ?? cycle.cropKey}</strong>
            <p>{cycle.schedule.nurseryStartDate ? `Nursery sowing ${formatDate(cycle.schedule.nurseryStartDate)} · field entry ${formatDate(cycle.schedule.fieldEntryDate)}`
              : `Direct sowing ${formatDate(cycle.schedule.fieldEntryDate)}`} · first pick {formatDate(cycle.schedule.firstHarvestDate)}</p>
            <p>{showQuantity(cycle.wholeCycleKg, 'kg', true)} estimated for the whole cycle · {cycle.basis === 'accepted' ? 'accepted plan' : 'worked example'}</p>
          </li>)}
        </ul>
      </details>}
    {targets.map(order => {
      const periods = weeklyProductionOrders(order, cycles);
        return <details key={order.id} open={practice || undefined} className="rounded-lg border border-[var(--border)] p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">
          {order.outlet ?? 'Buyer target'} · {cropByKey(order.cropKey)?.name ?? order.cropKey}
        </summary>
        <ul className="grid gap-3 lg:grid-cols-3">
          {periods.map(period => <li key={period.start} className="min-w-0 rounded-lg bg-[var(--bg-0)] p-3">
            <h3 className="font-semibold">{periodLabel(period)}</h3>
            <p>Requested {period.requested === null ? 'quantity unknown for this shorter period' : showQuantity(period.requested, period.unit)}</p>
            <p>Planned {period.planned === null ? 'quantity unknown' : `${showQuantity(period.planned, period.unit)}${practice ? " (practice entry)" : ""}`}</p>
            <p>{period.planningGap === null ? 'Quantity gap unknown' : period.planningGap === 0 ? 'No gap in the entered plan'
              : `Planning gap of ${showQuantity(period.planningGap, period.unit)}`}</p>
            <p>{period.picking.length === 0 ? 'No picking dates established' : period.daysWithoutPicking > 0
              ? `${period.daysWithoutPicking} days outside the dated picking windows` : 'Dated picking spans this period'}</p>
            {period.picking.length > 0 && <ul className="mt-2">
              {period.picking.map((picking, index) => <li key={`${picking.bedId}:${picking.start}:${index}`}>
                {beds.find(bed => bed.id === picking.bedId)?.label ?? 'Mapped bed'} · {periodLabel(picking)}
                {picking.basis === 'accepted' ? ' · accepted plan' : ' · worked example'}
              </li>)}
            </ul>}
            <dl className="mt-2 border-t border-[var(--border)] pt-2">
              {beds.map(bed => {
                const occupied = cycles.find(cycle => cycle.bedId === bed.id
                  && cycle.schedule.fieldEntryDate < period.endExclusive && period.start < cycle.schedule.nextFieldEntryDate);
                const declared = availability.some(interval => interval.bedId === bed.id
                  && interval.start <= period.start && period.endExclusive <= interval.endExclusive);
                const unknown = plantings.some(row => row.bedId === bed.id && !cycles.some(cycle => cycle.basis === 'accepted' && cycle.plantingId === row.id));
                return <div key={bed.id} className="flex flex-wrap gap-x-2">
                  <dt>{bed.label}</dt>
                  <dd>{occupied ? (occupied.basis === 'accepted' ? 'Occupied in saved plan' : 'Occupied in worked plan')
                        : declared && !unknown ? (practice ? 'Available in example' : 'Available in checked review') : 'Availability unknown'}</dd>
                </div>;
              })}
            </dl>
          </li>)}
        </ul>
      </details>;
    })}
    {targets.length === 0 && <p>No buyer targets are saved for these beds.</p>}
    <Link className="inline-flex min-h-11 items-center underline" href="/cropplan" prefetch={false}>See sowing and picking tasks</Link>
      <GrowerWeeklyRecords siteId={siteId} operations={operations}
        fulfilment={fulfilmentSave ? { targetSiteId, targets, save: fulfilmentSave, beds, cycles } : undefined} />
  </section>
  );
}
