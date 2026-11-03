import type { PlanBed } from './crop-plan';
import type { NurseryForecast, NurseryRange } from './crop-export-schedule';
import { csvCell } from './journal-export';
import type { GrowerNurseryResult } from './international/grower-nursery';

export interface NurseryCsvOptions {
  siteName?: string;
  sample?: boolean;
}

const COLUMNS = [
  'record_type', 'site_name', 'plan_basis', 'resource_type', 'resource_id', 'resource_name',
  'crop_key', 'crop_name', 'variety', 'phase', 'sow_month', 'working_field_month',
  'bed_ids', 'bed_labels', 'planting_ids', 'start_date', 'end_date_exclusive',
  'readiness_start_date', 'readiness_end_date_exclusive', 'readiness_source', 'readiness_conflict', 'nursery_model',
  'field_positions_min', 'field_positions_max', 'starts_min', 'starts_max', 'seeds_min', 'seeds_max',
  'trays_min', 'trays_max', 'area_m2_min', 'area_m2_max', 'tray_footprint_m2',
  'container_id', 'container_name', 'space_id', 'space_name', 'capacity', 'shortage_upper_end',
  'incomplete', 'assumptions', 'issues',
] as const;
type Column = typeof COLUMNS[number];
type CsvRow = Partial<Record<Column, string | number>>;
const range = (name: 'field_positions' | 'starts' | 'seeds' | 'trays' | 'area_m2', value: NurseryRange): CsvRow => ({
  [`${name}_min`]: value?.[0] ?? 'unknown', [`${name}_max`]: value?.[1] ?? 'unknown',
});

/** Export the reviewed forecast verbatim. This layer formats ranges and scope;
 * it never computes a second germination, tray, readiness or capacity answer. */
export function buildNurseryCsv(forecast: NurseryForecast, beds: PlanBed[], options: NurseryCsvOptions = {}): string {
  const rows: CsvRow[] = [];
  const context: CsvRow = { site_name: options.siteName ?? 'Site name not recorded',
    plan_basis: options.sample ? 'DEMO — example nursery plan' : 'Grower-entered nursery plan' };
  const containerName = (id: string | undefined) => id ? forecast.containers.find((row) => row.id === id)?.name ?? 'unknown' : 'unknown';
  const spaceName = (id: string | undefined) => id ? forecast.spaces.find((row) => row.id === id)?.name ?? 'unknown' : 'unknown';
  rows.push({ ...context, record_type: 'guidance', assumptions: forecast.guidance,
    incomplete: forecast.incomplete ? 'yes' : 'no', issues: forecast.issues.join(' | ') });
  rows.push({ ...context, record_type: 'overall_simultaneous_peak', ...range('trays', forecast.peakTrays),
    ...range('area_m2', forecast.peakAreaM2), incomplete: forecast.incomplete ? 'yes' : 'no',
    assumptions: 'Known simultaneous peak. Incomplete demand is a lower bound and cannot certify spare capacity.' });
  rows.push({ ...context, record_type: 'cumulative_tray_uses', ...range('trays', forecast.cumulativeTrayUses),
    incomplete: forecast.incomplete ? 'yes' : 'no', assumptions: 'Seasonal uses are not simultaneous owned-stock demand.' });
  for (const cohort of forecast.cohorts) rows.push({ ...context, record_type: 'cohort', crop_key: cohort.cropKey,
    crop_name: cohort.cropName, variety: cohort.variety ?? 'not recorded', phase: cohort.phase,
    sow_month: cohort.sowMonth ?? 'unknown', working_field_month: cohort.fieldMonth ?? 'unknown',
    bed_ids: cohort.bedIds.join(' | '), bed_labels: cohort.bedIds.map((id) => beds.find((bed) => bed.id === id)?.label ?? 'unknown').join(' | '),
    planting_ids: cohort.plantingIds.join(' | '), start_date: cohort.startDate ?? 'unknown',
    end_date_exclusive: cohort.endDateExclusive ?? 'unknown', readiness_start_date: cohort.readinessStartDate ?? 'unknown',
    readiness_end_date_exclusive: cohort.readinessEndDateExclusive ?? 'unknown', readiness_source: cohort.readinessSource,
    readiness_conflict: cohort.readinessConflict ? 'yes' : 'no', nursery_model: cohort.model ?? 'unknown',
    ...range('field_positions', cohort.positions), ...range('starts', cohort.starts), ...range('seeds', cohort.seeds),
    ...range('trays', cohort.trays), ...range('area_m2', cohort.areaM2), tray_footprint_m2: cohort.trayFootprintM2 ?? 'unknown',
    container_id: cohort.containerId ?? 'unknown', container_name: containerName(cohort.containerId),
    space_id: cohort.spaceId ?? 'unknown', space_name: spaceName(cohort.spaceId),
    incomplete: cohort.incomplete ? 'yes' : 'no', assumptions: cohort.basis.join(' | '), issues: cohort.issues.join(' | '),
  });
  for (const [resourceType, resources] of [['container_stock_trays', forecast.containers], ['net_usable_space_m2', forecast.spaces]] as const) {
    for (const resource of resources) {
      const shared: CsvRow = { ...context, resource_type: resourceType, resource_id: resource.id, resource_name: resource.name,
        capacity: resource.capacity ?? 'unknown', assumptions: 'Assigned known demand only. Incomplete shortages are lower bounds; no spare-capacity claim.' };
      const quantity = resourceType === 'container_stock_trays' ? 'trays' : 'area_m2';
      rows.push({ ...shared, record_type: 'resource_simultaneous_peak', ...range(quantity, resource.peak),
        shortage_upper_end: resource.shortage ?? 'unknown', incomplete: resource.incomplete ? 'yes' : 'no' });
      for (const week of resource.weeks) rows.push({ ...shared, record_type: 'resource_week', start_date: week.startDate,
        end_date_exclusive: week.endDateExclusive, ...range(quantity, week.demand),
        shortage_upper_end: week.shortage ?? 'unknown', incomplete: week.incomplete ? 'yes' : 'no' });
    }
  }
  for (const week of forecast.weeks) rows.push({ ...context, record_type: 'overall_week', start_date: week.startDate,
    end_date_exclusive: week.endDateExclusive, ...range('trays', week.trays), ...range('area_m2', week.areaM2),
    incomplete: week.incomplete ? 'yes' : 'no' });
  return `\uFEFF${[COLUMNS, ...rows.map((row) => COLUMNS.map((column) => row[column] ?? ''))]
    .map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const issueLabels: Record<string, string> = {
  'nursery-settings-review-missing': 'Confirm that you have reviewed the saved nursery equipment and recipes.',
  'nursery-settings-review-stale': 'The saved nursery settings changed; review them again.',
  'nursery-availability-missing': 'Nursery resource availability has not been confirmed.',
  'other-nursery-reservations-missing': 'Other nursery uses have not been accounted for.',
  'existing-field-reservations-not-accounted-for': 'Account for nursery resources used by the existing field occupations.',
  'field-survival-missing': 'Your field survival estimate is missing.',
  'field-survival-zero': 'A zero field survival rate cannot size a positive raising requirement.',
  'nursery-recipe-missing': 'A nursery recipe for this crop identity is missing.',
  'nursery-container-missing': 'The assigned propagation container is missing.',
  'nursery-space-missing': 'The assigned nursery surface is missing.',
  'container-cell-count-missing-or-zero': 'Enter a usable cell count for the seed-cell model.',
  'germination-or-nursery-survival-missing': 'Your germination or nursery survival estimate is missing.',
  'germination-or-nursery-survival-zero': 'A zero success rate cannot size a positive seed-cell requirement.',
  'measured-tray-output-missing': 'Your measured usable output per tray is missing.',
  'measured-tray-output-zero': 'A measured zero output cannot supply positive demand.',
  'container-footprint-missing': 'Both outer container dimensions are needed for surface requirements.',
  'resource-availability-incomplete': 'Dated availability is incomplete for a nursery resource.',
  'tray-footprint-missing': 'Both outer container dimensions are needed for surface requirements.',
  'recipe-duration-conflicts-with-cycle': 'The saved recipe duration conflicts with the reviewed crop-cycle dates.',
  'nursery-cycle-outside-review-horizon': 'A nursery cycle lies outside the reviewed planning period.',
  'nursery-settings-invalid-or-ambiguous': 'Saved nursery settings are invalid or ambiguous; no capacity is certified.',
  'resource-reservation-identity-or-capacity': 'Check the selected resources, quantities and recorded allocations.',
  'overlapping-resource-availability': 'Availability intervals for one resource overlap; enter disjoint intervals.',
  'proposal-capacity-gaps': 'The crop proposal still has unmet demand; this nursery review is incomplete.',
  'current-cycle-source-unavailable-or-stale': 'The crop proposal changed or is unavailable. Review the crop plan again.',
  'resource-source-context-mismatch': 'The current nursery resource context does not match this crop plan.',
  'nursery-inputs-invalid': 'Check all resource quantities and complete positive date intervals.',
};
export const growerNurseryIssueText = (code: string) => issueLabels[code.split(':')[0]] ?? 'Some required nursery inputs or source checks remain unresolved.';

/** Format the already reviewed own-input snapshot. Private record identities and
 * source fingerprints never belong in a shareable nursery worksheet. */
export function buildGrowerNurseryCsv(result: GrowerNurseryResult, beds: readonly PlanBed[], options: NurseryCsvOptions = {}): string {
  const columns = ['record_type', 'site_name', 'plan_basis', 'source_status', 'review_status', 'headroom',
    'crop_name', 'growing_spaces', 'start_date', 'end_date_exclusive', 'target_final_positions',
    'starts', 'seeds', 'trays', 'area_m2', 'nursery_model', 'resource_type', 'resource_name',
    'recorded_capacity', 'peak_known_min', 'peak_known_max', 'shortage_upper_end',
    'availability_quantity', 'availability_complete', 'incomplete', 'assumptions', 'issues'] as const;
  type OwnRow = Partial<Record<typeof columns[number], string | number>>;
  const rows: OwnRow[] = [];
  const context: OwnRow = { site_name: options.siteName ?? 'Site name not recorded',
    plan_basis: options.sample ? 'DEMO — example own-input nursery review' : 'Own-input nursery estimates',
    source_status: result.sourceStatus ?? 'unavailable', review_status: result.status, headroom: result.headroom };
  rows.push({ ...context, record_type: 'guidance', incomplete: result.status === 'ready' ? 'no' : 'yes',
    assumptions: result.forecast.guidance, issues: result.issues.map(growerNurseryIssueText).join(' | ') });
  for (const batch of result.batches) rows.push({ ...context, record_type: 'dated_raising_batch',
    source_status: batch.sourceStatus, crop_name: batch.cropName,
    growing_spaces: batch.bedIds.map(id => beds.find(bed => bed.id === id)?.label ?? 'Growing space not available').join(' | '),
    start_date: batch.startDate, end_date_exclusive: batch.endDateExclusive, target_final_positions: batch.targetPositions,
    starts: batch.starts ?? 'unknown', seeds: batch.seeds ?? 'unknown', trays: batch.trays ?? 'unknown',
    area_m2: batch.areaM2 ?? 'unknown', nursery_model: batch.model ?? 'unknown', incomplete: batch.incomplete ? 'yes' : 'no',
    assumptions: batch.basis.join(' | '), issues: batch.issues.map(growerNurseryIssueText).join(' | ') });
  for (const resource of result.resources) {
    const shared: OwnRow = { ...context, resource_type: resource.resourceKind, resource_name: resource.name,
      recorded_capacity: resource.capacity ?? 'unknown', headroom: resource.headroom,
      availability_complete: resource.availabilityComplete ? 'yes' : 'no', incomplete: resource.incomplete ? 'yes' : 'no' };
    rows.push({ ...shared, record_type: 'resource_simultaneous_peak', peak_known_min: resource.peak?.[0] ?? 'unknown',
      peak_known_max: resource.peak?.[1] ?? 'unknown', shortage_upper_end: resource.shortage ?? 'unknown',
      assumptions: 'Known assigned simultaneous demand. Incomplete quantities are lower bounds, not spare capacity.' });
    for (const available of resource.availability) rows.push({ ...shared, record_type: 'grower_asserted_availability',
      start_date: available.window.start, end_date_exclusive: available.window.endExclusive, availability_quantity: available.quantity });
  }
  return `\uFEFF${[columns, ...rows.map(row => columns.map(column => row[column] ?? ''))]
    .map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
