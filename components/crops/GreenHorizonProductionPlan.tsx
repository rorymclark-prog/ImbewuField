import { cropByKey } from '@/lib/crop-catalog';
import type { CropPlanState, PlanBed, Planting } from '@/lib/crop-plan';
import { MONTH_NAMES } from '@/lib/crop-export-schedule';
import { buildGreenHorizonPlanningDraft } from '@/lib/green-horizon-demo';
import { hasGrowerCycleMarker, normaliseGrowerCycleAttachment } from '@/lib/international/grower-cycle';
import { assessGrowerPlanning, type GrowerDateEstimate } from '@/lib/international/grower-planning';

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

export default function GreenHorizonProductionPlan({ siteId, beds, plan }: {
  siteId: string;
  beds: readonly PlanBed[];
  plan: CropPlanState | null;
}) {
  const practice = buildGreenHorizonPlanningDraft();
  const [reference] = practice.targetProfiles;
  const [availability] = practice.available;
  const target = plan?.harvestTargets?.find(row => row.id === reference.targetId && row.siteId === siteId);
  const profile = plan?.growerPlanningProfiles?.find(row => row.profileId === reference.profileId && row.cropKey === target?.cropKey);
  const practiceBed = beds.find(bed => bed.id === availability.bedId);
  const plantings = plan?.plantings ?? [];
  const scope = { kind: 'mapped-site' as const, siteId };
  const provenance = { kind: 'grower-estimate' as const, recordedAt: '2026-11-02T08:00:00.000Z', note: 'Fictional plan example.' };
  // The worked row uses the same arithmetic as the planner. Opening this view
  // does not check the design, confirm availability or save a cycle.
  const worked = profile && practiceBed && !plantings.some(row => row.bedId === practiceBed.id)
    ? assessGrowerPlanning({ profile, scope, countAreaBinding: { bedId: practiceBed.id },
      measuredAreaM2: { state: 'provided', value: practiceBed.areaM2, unit: 'm2', provenance },
      fieldEntryDate: { state: 'provided', value: availability.start, unit: 'utc-date', provenance } })
    : null;

  return (
    <section lang="en" aria-labelledby="green-horizon-production-title"
      className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm">
      <h1 id="green-horizon-production-title" className="font-display text-xl font-semibold">Green Horizon production plan</h1>
      <p className="mt-1 text-[var(--text-secondary)]">Fictional example for the mapped beds. Dates and quantities are planning estimates.</p>
      {target?.timing === 'date-window' && (
        <p className="mt-2"><strong>Buyer target</strong> · {target.weeklyKg} kg of {cropByKey(target.cropKey)?.name ?? 'the selected crop'} from {formatDate(target.window.start)} to before {formatDate(target.window.endExclusive)}. Delivery quantity is unknown.</p>
      )}
      <ul className="my-3 grid gap-2 md:grid-cols-3">
        {beds.map(bed => {
          const rows = plantings.filter(row => row.bedId === bed.id);
          const example = bed.id === practiceBed?.id && worked?.status === 'ready' ? worked : null;
          return (
            <li key={bed.id} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3">
              <h2 className="font-display font-semibold">{bed.label}</h2>
              <p className="text-[var(--text-secondary)]">{bed.areaM2.toFixed(1)} m²</p>
              {rows.map(row => {
                const dated = hasGrowerCycleMarker(row);
                const schedule = dated ? savedSchedule(row, siteId) : null;
                return <div key={row.id} className="mt-2">
                  <strong>{cropByKey(row.cropKey)?.name ?? 'Saved crop'}</strong>
                  {schedule ? <p>Saved plan · field entry {formatDate(schedule.fieldEntryDate)} · picking {pickingDates(schedule)}</p>
                    : dated ? <p>Saved cycle · open the Task Planner to check its dates.</p>
                    : <p>Saved sowing month · {MONTH_NAMES[row.sowMonth - 1] ?? 'Unknown'}. Picking dates and yield are unknown.</p>}
                </div>;
              })}
              {example && <div className="mt-2">
                <strong>{cropByKey(profile?.cropKey ?? '')?.name ?? 'Practice crop'}</strong>
                <p>Worked example · sow {formatDate(example.schedule.fieldEntryDate)} · pick {pickingDates(example.schedule)}</p>
                <p>Estimated {example.capacity.estimatedYieldKg.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg for the cycle. Review before saving.</p>
              </div>}
              {rows.length === 0 && !example && <p className="mt-2">No crop planned for this bed yet.</p>}
            </li>
          );
        })}
      </ul>
      {beds.length === 0 && <p className="mb-3">No mapped beds are available for this example.</p>}
      <a className="inline-flex min-h-11 items-center underline" href="#practice-crop-cycle">Review the practice crop cycle</a>
    </section>
  );
}
