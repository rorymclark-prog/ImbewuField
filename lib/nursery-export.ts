import type { PlanBed } from './crop-plan';
import type { NurseryForecast, NurseryRange } from './crop-export-schedule';
import { csvCell } from './journal-export';

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
