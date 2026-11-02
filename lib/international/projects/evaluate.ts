import { decimalQuantitySum } from '@/lib/farm-records';
import type { IndicatorReview, ProjectEvidence, ProjectIndicator, ProjectReviewContext } from './types';

export function validProjectDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 240;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const currencyCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z]{3}$/.test(value);

/** This evaluates evidence completeness, never permissions, funding eligibility or causation.
 * Permission-filtered source records must be supplied by the existing services at integration. */
export function reviewProjectIndicator(
  indicator: ProjectIndicator, evidence: readonly ProjectEvidence[], context: ProjectReviewContext,
): IndicatorReview {
  const gaps: string[] = [];
  const unit = indicator.unit === 'method-defined' ? context.measurementUnit ?? 'Unit not specified' : indicator.unit;
  const result: IndicatorReview = { indicatorId: indicator.id, state: 'unavailable', value: null, knownSubtotal: null,
    unit: indicator.aggregation === 'ratio' ? '%' : unit, currency: indicator.unit === 'currency' ? context.currency ?? null : null,
    accepted: [], rejected: [], gaps, baseline: null, followUp: null, interpretation: indicator.limits };
  if (!nonempty(context.projectId) || !nonempty(context.siteId)) gaps.push('Choose the project and site explicitly.');
  if (!validProjectDate(context.periodStart) || !validProjectDate(context.periodEnd)
    || context.periodStart > context.periodEnd || !validProjectDate(context.cutoffDate)) gaps.push('Reporting dates are invalid.');
  try { new Intl.DateTimeFormat('en', { timeZone: context.timeZone }).format(0); }
  catch { gaps.push('Choose a valid reporting time zone.'); }
  if (!nonempty(context.timeZone)) gaps.push('Choose a valid reporting time zone.');
  if (!['grower-review', 'publication'].includes(context.audience)) gaps.push('Choose the review audience explicitly.');
  if (indicator.unit === 'currency' && !currencyCode(context.currency)) gaps.push('Choose the recorded currency explicitly.');
  if (indicator.unit === 'method-defined' && !nonempty(context.measurementUnit)) gaps.push('Specify the measurement method’s unit.');
  if (gaps.length) return result;
  if (context.periodEnd > context.cutoffDate) gaps.push('The reporting period extends beyond the evidence cutoff.');

  const relevant = evidence.filter(row => row.kind === indicator.kind);
  const counts = new Map<string, number>();
  const referenceKey = (row: ProjectEvidence) => JSON.stringify([row.reference.authority, row.reference.id]);
  for (const row of relevant) counts.set(referenceKey(row), (counts.get(referenceKey(row)) ?? 0) + 1);
  const accepted: ProjectEvidence[] = [];
  for (const row of relevant) {
    const reasons: string[] = [];
    if (!nonempty(row.reference.id) || !indicator.authorities.includes(row.reference.authority)) reasons.push('Source authority or reference is not valid for this indicator.');
    if ((counts.get(referenceKey(row)) ?? 0) > 1) reasons.push('Duplicate source reference; reconcile the source instead of counting either copy.');
    if (row.projectId !== context.projectId || row.siteId !== context.siteId) reasons.push('Evidence belongs to a different project or site.');
    if (row.basis !== 'actual') reasons.push('An estimate or planned activity is not an actual observation.');
    if (row.level !== indicator.level) reasons.push('Participation, output and outcome evidence cannot substitute for one another.');
    if (row.provenance !== 'source-record' && row.provenance !== 'fictional-demo') reasons.push('Evidence provenance is unknown.');
    if (row.provenance === 'fictional-demo' && (context.allowDemo !== true || context.audience === 'publication')) reasons.push('Fictional demonstrations cannot enter live or published results.');
    if (row.consent !== 'granted') reasons.push('Sharing/review consent is missing or withheld.');
    if (context.audience === 'publication' && row.published !== true) reasons.push('This source has not been approved for publication.');
    if (!validProjectDate(row.periodStart) || !validProjectDate(row.periodEnd) || row.periodStart > row.periodEnd
      || !validProjectDate(row.recordedOn)) reasons.push('Evidence dates are invalid.');
    else {
      // Baseline may precede the reporting window; follow-up/current totals may not.
      if (row.stage !== 'baseline' && (row.periodStart < context.periodStart || row.periodEnd > context.periodEnd)) reasons.push('Evidence falls outside the reporting period; do not prorate it.');
      if (row.stage === 'baseline' && row.periodEnd > context.periodStart) reasons.push('Baseline must end by the start of the reporting period.');
      if (row.periodEnd > context.cutoffDate || row.recordedOn > context.cutoffDate) reasons.push('Evidence is after the event or submission cutoff.');
      if (row.recordedOn < row.periodEnd) reasons.push('An observation cannot be recorded before its period has ended.');
    }
    if (!['baseline', 'follow-up', 'current'].includes(row.stage)) reasons.push('Evidence stage is unknown.');
    if (!nonnegative(row.quantity)) reasons.push('The observation is missing or not a finite non-negative quantity.');
    if ((['planting', 'survival', 'participation'].includes(indicator.kind) || ['trees', 'gardens', 'people', 'households'].includes(unit))
      && row.quantity !== null && !Number.isSafeInteger(row.quantity)) reasons.push('Counts need safe whole numbers.');
    if (row.unit !== unit) reasons.push('Units do not match; no pack, weight or measurement conversion is assumed.');
    if (indicator.unit === 'currency' && (!currencyCode(row.currency) || row.currency !== context.currency)) reasons.push('Recorded currencies differ or are missing; no exchange conversion is assumed.');
    if (indicator.requirements.denominator && (!nonnegative(row.denominator) || row.denominator === 0)) reasons.push('A positive observed denominator is required; missing is not zero.');
    if (indicator.requirements.denominator && nonnegative(row.quantity) && nonnegative(row.denominator) && row.quantity > row.denominator) reasons.push('The observed count exceeds its stated population.');
    if (indicator.requirements.method && !nonempty(row.method)) reasons.push('The observation method is missing.');
    if ((indicator.aggregation === 'ratio' || indicator.aggregation === 'change') && !nonempty(row.population)) reasons.push('Name the observed population or cohort before comparing measurements.');
    if (reasons.length) result.rejected.push({ reference: row.reference, reasons });
    else accepted.push(row);
  }
  result.accepted = accepted.map(row => row.reference);
  if (result.rejected.length) gaps.push('Some supplied evidence was excluded; review the reasons before reporting a result.');
  if (!accepted.length) gaps.push('No eligible actual observations are available.');

  const baseline = accepted.filter(row => row.stage === 'baseline');
  const followUp = accepted.filter(row => row.stage === 'follow-up');
  if (indicator.requirements.baseline && !baseline.length) gaps.push('A baseline observation is missing.');
  if (indicator.requirements.followUp && !followUp.length) gaps.push('A follow-up observation is missing.');
  const latest = (rows: ProjectEvidence[]): ProjectEvidence | undefined => {
    const sorted = [...rows].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    if (sorted.length > 1 && sorted[0].periodEnd === sorted[1].periodEnd) {
      gaps.push('Several observations share the latest date; choose a reconciled source.');
      return undefined;
    }
    return sorted[0];
  };
  let calculated: number | null = null;
  if (indicator.aggregation === 'sum') {
    const rows = accepted.filter(row => row.stage !== 'baseline');
    // A monthly summary and a harvest book may describe the very same produce;
    // an invoice and linked sale may describe one payment. Different IDs alone
    // cannot establish independent events across authorities.
    if (new Set(rows.map(row => row.reference.authority)).size > 1) gaps.push('Choose one reconciled source authority; cross-book records may describe the same events.');
    else calculated = rows.length ? decimalQuantitySum(rows.map(row => row.quantity!)) : null;
    result.knownSubtotal = calculated;
  } else if (indicator.aggregation === 'latest') {
    calculated = latest(accepted.filter(row => row.stage !== 'baseline'))?.quantity ?? null;
  } else {
    const before = latest(baseline), after = latest(followUp);
    result.baseline = before?.quantity ?? null;
    result.followUp = after?.quantity ?? null;
    if (before && after) {
      if (before.periodEnd >= after.periodStart) gaps.push('Baseline and follow-up periods overlap or occur in the wrong order.');
      if (before.population !== after.population || before.method !== after.method) gaps.push('The compared population or method changed.');
      if (indicator.aggregation === 'ratio' && after.denominator !== before.quantity) gaps.push('Follow-up denominator does not match the baseline cohort count.');
      calculated = indicator.aggregation === 'ratio' ? after.quantity! / after.denominator! * 100 : after.quantity! - before.quantity!;
    }
  }
  // Mixed currency is not even a meaningful partial subtotal.
  if (indicator.unit === 'currency' && relevant.some(row => row.currency !== context.currency)) result.knownSubtotal = null;
  if (calculated !== null && !Number.isFinite(calculated)) { calculated = null; gaps.push('The result exceeds a finite numeric range.'); }
  if (calculated === null && accepted.length && !gaps.length) gaps.push('There is no eligible reporting-period observation.');
  result.state = gaps.length ? (accepted.length ? 'incomplete' : 'unavailable') : 'reported';
  result.value = gaps.length ? null : calculated;
  return result;
}
