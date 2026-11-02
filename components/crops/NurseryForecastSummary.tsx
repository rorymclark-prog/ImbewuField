'use client';

import { MONTHS_SHORT, cropByKey } from '@/lib/crop-catalog';
import { numberLabel } from '@/lib/format-figures';
import { sowingInstruction, type NurseryForecast, type NurseryRange, type NurseryResourceForecast } from '@/lib/crop-export-schedule';
import type { PlanBed } from '@/lib/crop-plan';

export interface NurseryForecastSummaryProps {
  forecast: NurseryForecast;
  title?: string;
  compact?: boolean;
  beds?: readonly PlanBed[];
}

const muted = 'text-xs text-[var(--text-secondary)]';
const numberRange = (range: NurseryRange, decimals = 0) => range === null ? 'Unknown'
  : range[0] === range[1] ? numberLabel(range[0], decimals)
    : `${numberLabel(range[0], decimals)}–${numberLabel(range[1], decimals)}`;
const monthLabel = (stamp: string | null) => stamp === null ? 'Date unknown' : `${MONTHS_SHORT[Number(stamp.slice(5, 7)) - 1]} ${stamp.slice(0, 4)}`;
const dateLabel = (stamp: string) => `${Number(stamp.slice(8, 10))} ${monthLabel(stamp.slice(0, 7))}`;
function periodLabel(start: string | null, endExclusive: string | null) {
  if (!start || !endExclusive) return 'Dates unknown';
  const end = new Date(`${endExclusive}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${dateLabel(start)} – ${dateLabel(end.toISOString().slice(0, 10))}`;
}

function budgetMessage(resource: NurseryResourceForecast, unit: string, forecastIncomplete: boolean) {
  if (resource.capacity === null) return 'Capacity unknown; availability is unverified.';
  if (resource.shortage === null) return 'Demand unknown; availability is unverified.';
  if (resource.shortage > 0) return `${resource.incomplete ? 'At least ' : 'Up to '}${numberLabel(resource.shortage, unit === 'm²' ? 2 : 0)} ${unit} beyond the allocated budget.${resource.incomplete ? ' Other demand is incomplete.' : ''}`;
  return resource.incomplete || forecastIncomplete ? 'Assigned known demand shows no shortage; whole nursery availability is unverified.' : 'Forecast peak is within this allocated budget.';
}

function ResourceBudget({ resources, surface, forecastIncomplete }: { resources: NurseryResourceForecast[]; surface: boolean; forecastIncomplete: boolean }) {
  const unit = surface ? 'm²' : 'containers';
  return <div className="space-y-3">
    {resources.length === 0 && <p className={muted}>{surface ? 'No nursery growing surface saved for this site.' : 'No container types saved for this site.'} Demand with no assigned resource remains unresolved.</p>}
    {resources.map((resource) => <article key={resource.id} className="rounded-lg border border-[var(--border)] p-3">
      <h5 className="text-sm font-semibold">{resource.name}</h5>
      <div className="mt-1 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <p><span className={`block ${muted}`}>{surface ? 'Net allocated growing surface' : 'Owned stock allocated to plan'}</span>{resource.capacity === null ? 'Unknown' : `${numberLabel(resource.capacity, surface ? 2 : 0)} ${unit}`}</p>
        <p><span className={`block ${muted}`}>Peak simultaneous demand{resource.incomplete ? ' · known part' : ''}</span>{numberRange(resource.peak, surface ? 2 : 0)} {resource.peak !== null && unit}</p>
      </div>
      <p className={`mt-2 text-xs ${forecastIncomplete || resource.incomplete || resource.capacity === null || resource.shortage === null || resource.shortage > 0 ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'}`}>{budgetMessage(resource, unit, forecastIncomplete)}</p>
      {resource.weeks.length > 0 && <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-xs">Weekly {surface ? 'bench surface' : 'container stock'} budget</summary>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <caption className="mb-2 text-left text-[var(--text-secondary)]">Peak demand within each week’s coarse reservation envelope.</caption>
          <thead><tr><th className="py-2 pr-3">Week envelope</th><th className="py-2 pr-3">Demand ({unit})</th><th className="py-2">Budget check</th></tr></thead>
          <tbody>{resource.weeks.map((week) => <tr key={week.startDate} className="border-t border-[var(--border)]">
            <td className="py-2 pr-3">{periodLabel(week.startDate, week.endDateExclusive)}</td>
            <td className="py-2 pr-3">{numberRange(week.demand, surface ? 2 : 0)}{week.incomplete ? ' · incomplete' : ''}</td>
            <td className="py-2">{resource.capacity === null || week.shortage === null ? 'Unverified' : week.shortage > 0 ? `${week.incomplete ? 'At least ' : ''}${numberLabel(week.shortage, surface ? 2 : 0)} ${unit} over` : week.incomplete || forecastIncomplete ? 'Whole nursery unverified' : 'Within budget'}</td>
          </tr>)}</tbody>
        </table></div>
      </details>}
    </article>)}
  </div>;
}

export default function NurseryForecastSummary({ forecast, title = 'Nursery planning forecast', compact = false, beds }: NurseryForecastSummaryProps) {
  return <section aria-label={title} className="space-y-3 rounded-xl border border-[var(--border)] p-3">
    <h3 className="font-display font-semibold">{title}</h3>
    <p className={muted}>A forecast from crop-plan allocations, not an observation of seedling or empty-tray stock. Months provide coarse envelopes; weekly rows do not imply exact sowing or transplanting dates.</p>
    {forecast.incomplete && <p role="status" className="text-sm text-[var(--gold)]">Incomplete forecast. Known quantities below are only part of the demand; unknown requirements cannot confirm spare space or stock.</p>}
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
      <p><span className={`block ${muted}`}>Peak simultaneous trays{forecast.incomplete ? ' · known part' : ''}</span><strong>{numberRange(forecast.peakTrays)}</strong></p>
      <p><span className={`block ${muted}`}>Peak simultaneous footprint{forecast.incomplete ? ' · known part' : ''}</span><strong>{numberRange(forecast.peakAreaM2, 2)}{forecast.peakAreaM2 !== null && ' m²'}</strong></p>
      <p><span className={`block ${muted}`}>Seasonal tray fills{forecast.incomplete ? ' · known part' : ''}</span><strong>{numberRange(forecast.cumulativeTrayUses)}</strong></p>
    </div>
    <p className={muted}>Seasonal fills count repeated uses. Owned containers are compared with the simultaneous peak, so a tray reused later is not counted as a second item of stock.</p>
    {forecast.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--gold)]">{forecast.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    {forecast.cohorts.length === 0 ? <p className="text-sm">No nursery cohorts in this forecast. Accepted dated transplant sowings and active nursery cohorts appear here; direct-sown crops do not need trays.</p> : <>
      <details open={!compact}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Dated nursery cohorts · {forecast.cohorts.length}</summary>
        <div className="space-y-3">
          {forecast.cohorts.map((cohort) => {
            const crop = cropByKey(cohort.cropKey);
            return <article key={cohort.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <div><h4 className="font-semibold">{cohort.cropName}{cohort.variety ? ` · ${cohort.variety}` : ''}</h4>
                <p className={muted}>{cohort.phase === 'in-nursery' ? 'Recorded in nursery · forecast requirements' : cohort.phase === 'confirmed-sowing' ? 'Confirmed sowing · forecast reservation' : 'Planned sowing'} · {monthLabel(cohort.sowMonth)} · {beds ? cohort.bedIds.map((id) => beds.find((bed) => bed.id === id)?.label ?? 'Growing area unavailable').join(', ') : `${cohort.bedIds.length} growing-area allocation${cohort.bedIds.length === 1 ? '' : 's'}`}</p></div>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div><dt className={muted}>Source field positions</dt><dd>{numberRange(cohort.positions)}</dd></div>
                <div><dt className={muted}>Usable starts needed</dt><dd>{numberRange(cohort.starts)}</dd></div>
                <div><dt className={muted}>{cohort.phase !== 'planned' ? 'Seed reference requirement' : 'Seeds to sow'}</dt><dd>{numberRange(cohort.seeds)}</dd></div>
                <div><dt className={muted}>{cohort.phase !== 'planned' ? 'Tray requirement' : 'Whole tray fills'}</dt><dd>{numberRange(cohort.trays)}</dd></div>
                <div><dt className={muted}>Tray footprint</dt><dd>{numberRange(cohort.areaM2, 2)}{cohort.areaM2 !== null && ' m²'}</dd></div>
              </dl>
              {crop && <p className={muted}>Field-position basis: mapped allocation and shared catalogue spacing. {sowingInstruction(crop)}.</p>}
              <p className="text-xs">Working field calendar: <strong>{monthLabel(cohort.fieldMonth)}</strong>. {cohort.readinessSource === 'grower' ? 'Your nursery-duration readiness envelope' : 'Published calendar readiness envelope'}: {periodLabel(cohort.readinessStartDate, cohort.readinessEndDateExclusive)}.</p>
              {cohort.readinessConflict && <p className="text-xs font-semibold text-[var(--gold)]">Readiness conflict: your estimate extends past the working field month. Change the planting explicitly after checking the seedlings; this forecast has kept its field schedule.</p>}
              <p className={muted}>Nursery reservation envelope: {periodLabel(cohort.startDate, cohort.endDateExclusive)}.</p>
              <details><summary className="min-h-11 cursor-pointer py-3 text-xs">Source and grower assumptions</summary>
                <ul className={`list-disc space-y-1 pl-5 ${muted}`}>{cohort.basis.map((basis, i) => <li key={i}>{basis}</li>)}</ul>
              </details>
              {cohort.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--gold)]">{cohort.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
            </article>;
          })}
        </div>
      </details>
      <details open={!compact}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Net growing-surface budgets</summary>
        <ResourceBudget resources={forecast.spaces} surface forecastIncomplete={forecast.incomplete} />
      </details>
      <details open={!compact}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Container stock budgets</summary>
        <ResourceBudget resources={forecast.containers} surface={false} forecastIncomplete={forecast.incomplete} />
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">All nursery demand by week</summary>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <caption className="mb-2 text-left text-[var(--text-secondary)]">Combined peaks. Check each named resource above; combined surface alone cannot establish that an assigned bench is available.</caption>
          <thead><tr><th className="py-2 pr-3">Week envelope</th><th className="py-2 pr-3">Simultaneous trays</th><th className="py-2 pr-3">Footprint (m²)</th><th className="py-2">Completeness</th></tr></thead>
          <tbody>{forecast.weeks.map((week) => <tr key={week.startDate} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{periodLabel(week.startDate, week.endDateExclusive)}</td><td className="py-2 pr-3">{numberRange(week.trays)}</td><td className="py-2 pr-3">{numberRange(week.areaM2, 2)}</td><td className="py-2">{week.incomplete ? 'Known part only' : 'Calculated'}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>}
    <p className={muted}>{forecast.guidance}</p>
  </section>;
}
