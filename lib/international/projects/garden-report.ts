import { reviewProjectIndicator, validProjectDate } from './evaluate';
import { PROJECT_TEMPLATES } from './templates';
import type { ProjectEvidence } from './types';
import type { GardenProgressReportHtmlInput } from './garden-report-html';

export interface GardenReportDates {
  periodStart: string;
  periodEnd: string;
  cutoffDate: string;
}

export interface GardenHarvestSource {
  recordId: string;
  observedOn: string;
  recordedOn: string | null;
  quantity: number;
  unit: string;
}

export interface GardenNoteSource {
  recordId: string;
  observedOn: string;
  recordedOn: string;
  text: string;
}

export interface GardenReportRecords {
  siteId: string;
  siteLabel: string;
  sample: boolean;
  harvest: readonly GardenHarvestSource[];
  notes: readonly GardenNoteSource[];
  incomplete: boolean;
}

export function validGardenReportDates({ periodStart, periodEnd, cutoffDate }: GardenReportDates): boolean {
  return validProjectDate(periodStart) && validProjectDate(periodEnd) && validProjectDate(cutoffDate)
    && periodStart <= periodEnd && periodEnd <= cutoffDate;
}

export function gardenRecordInPeriod(record: Pick<GardenNoteSource, 'observedOn' | 'recordedOn'>, dates: GardenReportDates): boolean {
  return validProjectDate(record.observedOn) && validProjectDate(record.recordedOn)
    && dates.periodStart <= record.observedOn && record.observedOn <= dates.periodEnd
    && record.recordedOn >= record.observedOn && record.recordedOn <= dates.cutoffDate;
}

const indicator = PROJECT_TEMPLATES.find(template => template.id === 'food-security')!
  .indicators.find(item => item.id === 'harvest-recorded')!;

/** Evaluator needs a review scope. This transient site draft grants no project membership. */
export function buildGardenReport(
  records: GardenReportRecords, dates: GardenReportDates, harvestIds: ReadonlySet<string>, noteIds: ReadonlySet<string>,
): GardenProgressReportHtmlInput | null {
  if (!validGardenReportDates(dates)) return null;
  const projectId = 'private-mapped-site-draft';
  const harvest = records.harvest.filter(row => harvestIds.has(row.recordId));
  const evidence: ProjectEvidence[] = harvest.map(row => ({
    reference: { authority: 'farm-records', id: row.recordId }, projectId, siteId: records.siteId,
    kind: 'harvest', level: 'output', basis: 'actual',
    provenance: records.sample ? 'fictional-demo' : 'source-record',
    periodStart: row.observedOn, periodEnd: row.observedOn, recordedOn: row.recordedOn ?? '',
    stage: 'current', quantity: row.quantity, unit: row.unit, consent: 'granted', published: false,
  }));
  const timeZone = 'UTC';
  const review = reviewProjectIndicator(indicator, evidence, {
    ...dates, projectId, siteId: records.siteId, timeZone, audience: 'grower-review', allowDemo: records.sample,
  });
  const accepted = new Set(review.accepted.map(item => item.id));
  const excluded = new Map(review.rejected.map(item => [item.reference.id, item.reasons]));
  const unavailable = harvestIds.size > new Set(harvest.map(row => row.recordId)).size;
  const gaps = [...review.gaps];
  if (records.incomplete || unavailable) gaps.push('Some linked harvest records could not be verified.');
  const state = gaps.length && review.state === 'reported' ? 'incomplete' : review.state;
  return {
    ...dates, timeZone, siteLabel: records.siteLabel, sample: records.sample,
    total: { state, value: state === 'reported' ? review.value : null, knownSubtotal: review.knownSubtotal, gaps },
    harvest: harvest.map(row => ({
      recordId: row.recordId, pickedOn: row.observedOn, recordedOn: row.recordedOn,
      quantity: row.quantity, unit: row.unit, includedInWeight: accepted.has(row.recordId),
      reasons: excluded.get(row.recordId) ?? [],
    })),
    notes: records.notes.filter(note => noteIds.has(note.recordId) && gardenRecordInPeriod(note, dates)),
  };
}
