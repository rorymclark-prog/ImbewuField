import { cropByKey } from '@/lib/crop-catalog';
import { resolveHarvestTargetDateWindow, type CropPlanState, type PlanBed, type Planting } from '@/lib/crop-plan';
import { MONTH_NAMES } from '@/lib/crop-export-schedule';
import { buildGreenHorizonWeeklyPracticeDraft } from '@/lib/green-horizon-demo';
import { hasGrowerCycleMarker, normaliseGrowerCycleAttachment } from '@/lib/international/grower-cycle';
import { assessGrowerPlanning, type GrowerDateEstimate } from '@/lib/international/grower-planning';
import { weeklyAcceptedCycles, type WeeklyProductionCycle } from '@/lib/international/grower-weekly-production';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import type { BuyerFulfilmentSave } from './BuyerFulfilmentPanel';
import GrowerWeeklyProduction, { showQuantity } from './GrowerWeeklyProduction';

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

export default function GreenHorizonProductionPlan({ siteId, beds, plan, source, fulfilmentSave }: {
  siteId: string;
  beds: readonly PlanBed[];
  plan: CropPlanState | null;
  source: GrowerWorkflowSource | null;
  fulfilmentSave?: BuyerFulfilmentSave;
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
  const accepted = weeklyAcceptedCycles(siteId, plantings, source);
  const cycles = [...accepted, ...worked];

  return (
    <section lang="en" aria-labelledby="green-horizon-production-title"
      className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm">
      <h1 id="green-horizon-production-title" className="font-display text-xl font-semibold">Green Horizon production plan</h1>
      <p className="mt-1 text-[var(--text-secondary)]">Fictional example for the mapped beds. Dates and quantities are planning estimates.</p>
      {target && targetWindow && (
        <p className="mt-2"><strong>Buyer target</strong> · {target.weeklyKg !== undefined
          ? `${target.weeklyKg} kg`
          : `${target.weeklyQuantity} ${target.unit === 'each' ? 'items' : target.unit}`}/week of {cropByKey(target.cropKey)?.name ?? 'the selected crop'} from {formatDate(targetWindow.start)} to before {formatDate(targetWindow.endExclusive)}. {fulfilmentSave ? 'Review confirmed deliveries by week below.' : 'Delivery quantity is unknown.'}</p>
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
                const checked = accepted.find(cycle => cycle.plantingId === row.id);
                return <div key={row.id} className="mt-2">
                  <strong>{cropByKey(row.cropKey)?.name ?? 'Saved crop'}</strong>
                  {schedule ? <p>Saved plan as accepted · field entry {formatDate(schedule.fieldEntryDate)} · picking {pickingDates(schedule)}</p>
                    : dated ? <p>Saved cycle · open the Task Planner to check its dates.</p>
                    : <p>Saved sowing month · {MONTH_NAMES[row.sowMonth - 1] ?? 'Unknown'}. Picking dates and yield are unknown.</p>}
                  {checked && <p>Estimated {showQuantity(checked.wholeCycleKg, 'kg', true)} for the whole cycle.</p>}
                </div>;
              })}
              {example && <div className="mt-2">
                <strong>{cropByKey(example.cropKey)?.name ?? 'Practice crop'}</strong>
                <p>Worked example · field entry {formatDate(example.schedule.fieldEntryDate)} · pick {pickingDates(example.schedule)}</p>
                <p>Estimated {showQuantity(example.wholeCycleKg, 'kg', true)} for the cycle. Review before saving.</p>
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
      <GrowerWeeklyProduction siteId={siteId} beds={beds} targets={targets} plantings={plantings} cycles={cycles}
        practice availability={practice.available} fulfilmentSave={fulfilmentSave} />
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
