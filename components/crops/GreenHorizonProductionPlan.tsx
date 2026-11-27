import { cropByKey } from '@/lib/crop-catalog';
import { resolveHarvestTargetDateWindow, type CropPlanState, type PlanBed, type Planting } from '@/lib/crop-plan';
import { MONTH_NAMES } from '@/lib/crop-export-schedule';
import { buildGreenHorizonWeeklyAllocations, buildGreenHorizonWeeklyPracticeDraft } from '@/lib/green-horizon-demo';
import { hasGrowerCycleMarker, normaliseGrowerCycleAttachment } from '@/lib/international/grower-cycle';
import { projectGrowerCycles } from '@/lib/international/grower-cycle-projection';
import { addGrowerUtcDays, assessGrowerPlanning, type GrowerDateEstimate } from '@/lib/international/grower-planning';
import { weeklyProductionOrders, type WeeklyProductionCycle, type WeeklyProductionWindow } from '@/lib/international/grower-weekly-production';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import Link from 'next/link';

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatDate = (date: string) => day.format(new Date(date));

function pickingDates(schedule: GrowerDateEstimate): string {
  const last = new Date(schedule.harvestEndExclusiveDate);
  last.setUTCDate(last.getUTCDate() - 1);
  const first = formatDate(schedule.firstHarvestDate);
  const end = day.format(last);
  return first === end ? first : `${first} – ${end}`;
}

function savedSchedule(row: Planting, siteId: string) {
  const attachment = normaliseGrowerCycleAttachment(row.growerCycle);
  if (!attachment || attachment.plantingId !== row.id || attachment.bedId !== row.bedId) return null;
  const snapshot = attachment.assessmentSnapshot;
  if (snapshot.scope.kind !== 'mapped-site' || snapshot.scope.siteId !== siteId || snapshot.profile.cropKey !== row.cropKey) return null;
  const assessment = assessGrowerPlanning({ ...snapshot, provisionalContext: snapshot.provisionalReview?.context });
  return assessment.status === 'ready' ? assessment.schedule : null;
}

function periodLabel(period: WeeklyProductionWindow): string {
  const last = addGrowerUtcDays(period.endExclusive, -1) ?? period.start;
  return period.start === last ? formatDate(last) : `${formatDate(period.start)} – ${formatDate(last)}`;
}

function showQuantity(quantity: number, unit: string): string {
  return `${quantity.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${unit === 'each' ? 'items' : unit}`;
}

export default function GreenHorizonProductionPlan({ siteId, beds, plan, source }: {
  siteId: string;
  beds: readonly PlanBed[];
  plan: CropPlanState | null;
  source: GrowerWorkflowSource | null;
}) {
  const practice = buildGreenHorizonWeeklyPracticeDraft();
  const [reference] = practice.targetProfiles;
  const targets = plan?.harvestTargets?.filter(row => row.siteId === siteId) ?? [];
  const target = targets.find(row => row.id === reference.targetId);
  const targetWindow = resolveHarvestTargetDateWindow(target);
  const plantings = plan?.plantings ?? [];
  const scope = { kind: 'mapped-site' as const, siteId };
  const provenance = { kind: 'grower-estimate' as const, recordedAt: '2026-11-02T08:00:00.000Z', note: 'Fictional plan example.' };
  const worked = practice.available.flatMap((availability, index): WeeklyProductionCycle[] => {
    const reference = practice.targetProfiles[index];
    const order = targets.find(row => row.id === reference.targetId);
    const profile = plan?.growerPlanningProfiles?.find(row => row.profileId === reference.profileId && row.cropKey === order?.cropKey);
    const bed = beds.find(row => row.id === availability.bedId);
    // Fictional draft only. Don't fill over an existing crop, even if its
    // saved dates are currently held by the planner.
    if (!profile || !bed || plantings.some(row => row.bedId === bed.id)) return [];
    const estimate = assessGrowerPlanning({ profile, scope, countAreaBinding: { bedId: bed.id },
      measuredAreaM2: { state: 'provided', value: bed.areaM2, unit: 'm2', provenance },
      fieldEntryDate: { state: 'provided', value: availability.start, unit: 'utc-date', provenance } });
    if (estimate.status !== 'ready' || estimate.schedule.nextFieldEntryDate > availability.endExclusive) return [];
    return [{ siteId, plantingId: null, targetId: reference.targetId, bedId: bed.id, cropKey: profile.cropKey, basis: 'worked-example',
      schedule: estimate.schedule, wholeCycleKg: estimate.capacity.estimatedYieldKg }];
  });
  const accepted = source ? projectGrowerCycles(plantings, source).ownCycles.map((cycle): WeeklyProductionCycle => ({
    siteId, plantingId: cycle.plantingId, bedId: cycle.bedId, cropKey: cycle.cropKey, basis: 'accepted', schedule: cycle.assessment.schedule,
    targetId: cycle.origin?.status === 'recorded' && cycle.origin.origin.kind === 'buyer-target'
      ? cycle.origin.origin.harvestTargetId : null,
    wholeCycleKg: cycle.totalCycleKg,
  })) : [];
  const cycles = [...accepted, ...worked];
  const allocations = buildGreenHorizonWeeklyAllocations();

  return (
    <section lang="en" aria-labelledby="green-horizon-production-title"
      className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm">
      <h1 id="green-horizon-production-title" className="font-display text-xl font-semibold">Green Horizon production plan</h1>
      <p className="mt-1 text-[var(--text-secondary)]">Fictional example for the mapped beds. Dates and quantities are planning estimates.</p>
      {target && targetWindow && (
        <p className="mt-2"><strong>Buyer target</strong> · {target.weeklyKg !== undefined
          ? `${target.weeklyKg} kg`
          : `${target.weeklyQuantity} ${target.unit === 'each' ? 'items' : target.unit}`}/week of {cropByKey(target.cropKey)?.name ?? 'the selected crop'} from {formatDate(targetWindow.start)} to before {formatDate(targetWindow.endExclusive)}. Delivery quantity is unknown.</p>
      )}
      <ul className="my-3 grid gap-2 md:grid-cols-3">
        {beds.map(bed => {
          const rows = plantings.filter(row => row.bedId === bed.id);
          const example = worked.find(row => row.bedId === bed.id);
          return (
            <li key={bed.id} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3">
              <h2 className="font-display font-semibold">{bed.label}</h2>
              <p className="text-[var(--text-secondary)]">{bed.areaM2.toFixed(1)} m²</p>
              {rows.map(row => {
                const dated = hasGrowerCycleMarker(row);
                const schedule = dated ? savedSchedule(row, siteId) : null;
                return <div key={row.id} className="mt-2">
                  <strong>{cropByKey(row.cropKey)?.name ?? 'Saved crop'}</strong>
                  {schedule ? <p>Saved plan as accepted · field entry {formatDate(schedule.fieldEntryDate)} · picking {pickingDates(schedule)}</p>
                    : dated ? <p>Saved cycle · open the Task Planner to check its dates.</p>
                    : <p>Saved sowing month · {MONTH_NAMES[row.sowMonth - 1] ?? 'Unknown'}. Picking dates and yield are unknown.</p>}
                </div>;
              })}
              {example && <div className="mt-2">
                <strong>{cropByKey(example.cropKey)?.name ?? 'Practice crop'}</strong>
                <p>Worked example · field entry {formatDate(example.schedule.fieldEntryDate)} · pick {pickingDates(example.schedule)}</p>
                <p>Estimated {showQuantity(example.wholeCycleKg, 'kg')} for the cycle. Review before saving.</p>
                {example.targetId === target?.id && targetWindow && (example.schedule.firstHarvestDate > targetWindow.start
                  || example.schedule.harvestEndExclusiveDate < targetWindow.endExclusive)
                  && <p>Some requested dates fall outside this picking window.</p>}
              </div>}
              {rows.length === 0 && !example && <p className="mt-2">No crop planned for this bed yet.</p>}
            </li>
          );
        })}
      </ul>
      {beds.length === 0 && <p className="mb-3">No mapped beds are available for this example.</p>}
      <section aria-labelledby="green-horizon-weekly-title" className="my-4 space-y-3">
        <h2 id="green-horizon-weekly-title" className="font-display text-lg font-semibold">Weekly production and buyer orders</h2>
        <p>Practice quantities are entered per period. Crop-cycle estimates stay in the bed plan above.</p>
        {targets.map(order => {
          const periods = weeklyProductionOrders(order, cycles, allocations);
          return <details key={order.id} open className="rounded-lg border border-[var(--border)] p-3">
            <summary className="min-h-11 cursor-pointer font-semibold">
              {order.outlet ?? 'Buyer target'} · {cropByKey(order.cropKey)?.name ?? order.cropKey}
            </summary>
            <ul className="grid gap-3 lg:grid-cols-3">
              {periods.map(period => <li key={period.start} className="min-w-0 rounded-lg bg-[var(--bg-0)] p-3">
                <h3 className="font-semibold">{periodLabel(period)}</h3>
                <p>Requested {period.requested === null ? 'quantity unknown for this shorter period' : showQuantity(period.requested, period.unit)}</p>
                <p>Planned {period.planned === null ? 'quantity unknown' : `${showQuantity(period.planned, period.unit)} (practice entry)`}</p>
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
                    const declared = practice.available.some(interval => interval.bedId === bed.id
                      && interval.start <= period.start && period.endExclusive <= interval.endExclusive);
                    const unknown = plantings.some(row => row.bedId === bed.id && !accepted.some(cycle => cycle.plantingId === row.id));
                    return <div key={bed.id} className="flex flex-wrap gap-x-2">
                      <dt>{bed.label}</dt>
                      <dd>{occupied ? (occupied.basis === 'accepted' ? 'Occupied in saved plan' : 'Occupied in worked plan')
                        : declared && !unknown ? 'Available in example' : 'Availability unknown'}</dd>
                    </div>;
                  })}
                </dl>
              </li>)}
            </ul>
          </details>;
        })}
        {targets.length === 0 && <p>No buyer targets are saved for these beds.</p>}
        <Link className="inline-flex min-h-11 items-center underline" href="/cropplan" prefetch={false}>See sowing and picking tasks</Link>
      </section>
      <button type="button" className="inline-flex min-h-11 items-center underline" onClick={() => {
        const panel = document.querySelector<HTMLDetailsElement>('details#practice-crop-cycle');
        if (!panel) return;
        panel.open = true;
        panel.querySelector('summary')?.focus({ preventScroll: true });
        panel.scrollIntoView({ block: 'start' });
      }}>Review the practice crop cycle</button>
    </section>
  );
}
