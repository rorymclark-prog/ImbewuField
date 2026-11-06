import { readGrowerCycleIntent, readGrowerCycleIntentField, growerCycleIntentColumns, GROWER_INTENT_EXPORT_COLUMNS } from './international/grower-cycle-intent';
import type { jsPDF } from 'jspdf';
import { exactPdfTextWriter } from './pdf-exact-text';
import type { PlanBed } from './crop-plan';
import type { NurseryForecast, NurseryRange } from './crop-export-schedule';
import { csvCell } from './journal-export';
import { projectGrowerNurseryPreparation, type GrowerNurseryResult, type GrowerNurseryBatchReferenceView } from './international/grower-nursery';

/** Static delivery copy only; never include entered references in an error. */
export class NurseryReferenceExportError extends Error {
  readonly reason = 'unsupported-reference-glyph' as const;
  constructor() {
    super('A planned reference cannot be printed faithfully with the bundled PDF font. Download the CSV to retain its exact text.');
    this.name = 'NurseryReferenceExportError';
  }
}

type MemberReference = GrowerNurseryBatchReferenceView;

function exportReference(reference: MemberReference | undefined, source: GrowerNurseryResult['sourceStatus']): MemberReference {
  // Old constructed DTOs did not carry reference evidence. Only a proposal is
  // known to have no durable member; a saved DTO without evidence needs review.
  return reference ?? (source === 'proposed' ? { status: 'proposed' } : { status: 'held', reason: 'reference-unavailable' });
}
function referenceColumns(reference: MemberReference) {
  const missing = reference.status === 'proposed' ? 'No saved reference' : 'Needs review';
  return { reference_status: reference.status,
    variety: reference.status === 'ready' ? reference.fields.variety ?? 'Not recorded' : missing,
    seed_lot_reference: reference.status === 'ready' ? reference.fields.seedLotReference ?? 'Not recorded' : missing,
    raising_batch_reference: reference.status === 'ready' ? reference.fields.raisingBatchReference ?? 'Not recorded' : missing,
    reference_note: reference.status === 'ready' ? 'Grower-entered planned references; not verified seed identity, observed sowing or stock.'
      : reference.status === 'proposed' ? 'Proposed cycle: no saved planned reference.' : 'Saved planned references need review; do not infer their absence.' };
}


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
    'crop_name', 'growing_spaces', 'member_number', 'reference_status', 'variety', 'seed_lot_reference', 'raising_batch_reference', 'reference_note', 'start_date', 'end_date_exclusive', 'target_final_positions',
    'starts', 'seeds', 'trays', 'area_m2', 'nursery_model', 'resource_type', 'resource_name',
    'recorded_capacity', 'peak_known_min', 'peak_known_max', 'shortage_upper_end',
    'availability_quantity', 'availability_complete', 'incomplete', 'assumptions', 'issues', ...GROWER_INTENT_EXPORT_COLUMNS] as const;
  type OwnRow = Partial<Record<typeof columns[number], string | number>>;
  const rows: OwnRow[] = [];
  const preparation = projectGrowerNurseryPreparation(result);
  const references = new Map(preparation.groups.flatMap(group => group.members.map(member => [member.batchId, member.reference] as const)));
  const context: OwnRow = { site_name: options.siteName ?? 'Site name not recorded',
    plan_basis: options.sample ? 'DEMO — example own-input nursery review' : 'Own-input nursery estimates',
    source_status: result.sourceStatus ?? 'unavailable', review_status: result.status, headroom: result.headroom };
  rows.push({ ...context, record_type: 'guidance', incomplete: result.status === 'ready' ? 'no' : 'yes',
    assumptions: result.forecast.guidance, issues: result.issues.map(growerNurseryIssueText).join(' | ') });
  for (const [index, batch] of result.batches.entries()) rows.push({ ...context, record_type: 'dated_raising_batch',
    member_number: index + 1, ...growerCycleIntentColumns(readGrowerCycleIntentField(batch)), ...referenceColumns(exportReference(references.get(batch.id), batch.sourceStatus)),
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


/** Build printable A4 nursery batch cards, one card per represented preparation group.
 * These are planning cards for keeping/attaching with a batch, not verified tray labels. */
export async function buildGrowerNurseryBatchLabelsPdf(result: GrowerNurseryResult, options: NurseryPreparationPdfOptions = {}): Promise<Blob> {
  const projection = projectGrowerNurseryPreparation(result);
  if (projection.status !== 'available') throw Error('The preparation worksheet is unavailable for this nursery review.');
  if (projection.groups.some(group => !/^[\x20-\x7e]+$/.test(group.cropName))) throw Error('The crop identity cannot be printed faithfully with the current PDF font.');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const referenceWriter = await exactPdfTextWriter(doc, () => new NurseryReferenceExportError());
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 36, contentWidth = width - 2 * margin, bottom = height - 66;
  const ink: [number, number, number] = [43, 48, 39];
  let y = margin;

  const font = (size: number, weight: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', weight); doc.setFontSize(size); doc.setTextColor(...ink);
  };

  function page(continuationGroup = '') {
    doc.addPage(); y = margin;
    if (continuationGroup) {
      font(10, 'bold'); doc.text('PLANNED NURSERY BATCH (continued)', margin, y + 10); y += 18;
      font(10); const lines = doc.splitTextToSize(continuationGroup, contentWidth) as string[];
      doc.text(lines, margin, y + 10); y += lines.length * 13 + 6;
    }
  }

  function ensure(space: number, continuationGroup = '') {
    if (y + space > bottom) page(continuationGroup);
  }

  function paragraph(text: string, size = 10, weight: 'normal' | 'bold' | 'italic' = 'normal', gap = 5, continuationGroup = '') {
    font(size, weight);
    const lines = doc.splitTextToSize(preparationPdfCopy(text), contentWidth) as string[];
    for (const line of lines) {
      ensure(size * 1.3 + 2, continuationGroup);
      font(size, weight); doc.text(line, margin, y + size); y += size * 1.3;
    }
    y += gap;
  }

  if (!projection.groups.length) {
    const overallIncomplete = projection.projectionIncomplete || projection.reviewIncomplete;
    paragraph('PLANNED NURSERY BATCH', 16, 'bold', 6);
    paragraph(`Overall review status: ${overallIncomplete ? 'Incomplete review' : 'Reviewed inputs complete'}.`, 10, 'bold', 4);
    paragraph(`Source: ${projection.sourceStatus === 'saved-planned' ? 'Saved planned crop cycles' : 'Proposed crop cycles'}. Grower estimates; source not verified.`, 9, 'normal', 4);
    if (projection.horizon) {
      paragraph(`Review horizon: ${projection.horizon.start} to before ${projection.horizon.endExclusive} (UTC).`, 9, 'normal', 4);
    }
    paragraph('No transplant batches are represented in this review. This does not establish a zero requirement for the whole garden.', 10, 'normal', 6);
    for (const globalIssue of [...new Set(projection.issues.map(growerNurseryIssueText))]) {
      paragraph(`Review note: ${globalIssue}`, 9, 'normal', 4);
    }
    paragraph('Planning card only: Not verified tray labels, observed sowing, nursery stock or seedling readiness.', 9, 'italic');
  }

  for (const [index, group] of projection.groups.entries()) {
    if (index > 0) doc.addPage();
    y = margin;
    const cardTitle = `${group.cropName} - Preparation Group ${index + 1}`;

    doc.setDrawColor(180, 190, 175);
    doc.setLineDashPattern([4, 4], 0);
    doc.roundedRect(margin, y, contentWidth, height - 2 * margin - 14, 4, 4, 'S');
    doc.setLineDashPattern([], 0);

    y += 16;
    font(9, 'bold');
    doc.text('CUT / FOLD GUIDE - ATTACH OR KEEP WITH BATCH', width / 2, y + 4, { align: 'center' });
    y += 16;

    paragraph('PLANNED NURSERY BATCH', 16, 'bold', 6, cardTitle);
    paragraph(cardTitle, 13, 'bold', 6, cardTitle);
    const overallIncomplete = projection.projectionIncomplete || projection.reviewIncomplete;
    paragraph(`Overall review status: ${overallIncomplete ? 'Incomplete review' : 'Reviewed inputs complete'}.`, 10, 'bold', 4, cardTitle);
    paragraph(`Source: ${projection.sourceStatus === 'saved-planned' ? 'Saved planned crop cycles' : 'Proposed crop cycles'}. Grower estimates; source not verified.`, 9, 'normal', 4, cardTitle);
    if (projection.horizon) {
      paragraph(`Review horizon: ${projection.horizon.start} to before ${projection.horizon.endExclusive} (UTC).`, 9, 'normal', 4, cardTitle);
    }
    paragraph(`Batch group status: ${group.incomplete ? 'Incomplete' : 'Included counts complete'}. Represented transplant batches only.`, 10, 'normal', 6, cardTitle);

    paragraph(`Raising starts ${group.startDate} (UTC).`, 10, 'bold', 4, cardTitle);
    const fieldDates = [...new Set(group.members.map(member => member.endDateExclusive))].sort().join(', ');
    paragraph(`Raising ends before field entry: ${fieldDates} (exclusive UTC).`, 10, 'normal', 8, cardTitle);

    const metrics = [
      ['Final field positions', group.fieldPositions],
      ['Starts to raise', group.startsToRaise],
      ['Seeds to sow', group.seedsToSow],
    ] as const;
    const cellWidth = (contentWidth - 24) / 3;
    const cells = metrics.map(([label, metric]) => {
      font(10, 'bold'); const labels = doc.splitTextToSize(label, cellWidth - 14) as string[];
      font(10); const values = doc.splitTextToSize(preparationMetricText(metric), cellWidth - 14) as string[];
      return { labels, values };
    });
    const blockHeight = Math.max(...cells.map(cell => cell.labels.length + cell.values.length)) * 13 + 18;
    ensure(blockHeight + 10, cardTitle);
    for (const [col, cell] of cells.entries()) {
      const cx = margin + 12 + col * (cellWidth + 4);
      doc.setFillColor(244, 247, 240);
      doc.roundedRect(cx, y, cellWidth, blockHeight, 3, 3, 'F');
      let lineY = y + 14;
      font(10, 'bold'); for (const l of cell.labels) { doc.text(l, cx + 6, lineY); lineY += 13; }
      font(10); for (const v of cell.values) { doc.text(v, cx + 6, lineY); lineY += 13; }
    }
    y += blockHeight + 10;

    for (const [memberIndex, member] of group.members.entries()) {
      const reference = exportReference(member.reference, projection.sourceStatus), fields = referenceColumns(reference);
      const memberHeading = `Member ${memberIndex + 1}: raising ${group.startDate}; field entry ${member.endDateExclusive} (exclusive UTC).`;
      const intentLines = (member.intent ?? readGrowerCycleIntent(undefined)).lines;
      // Keep this bounded public intent together with its member identity. The
      // entered reference fields below retain their existing long-text paging.
      font(9, 'bold'); let intentHeight = doc.splitTextToSize(memberHeading, contentWidth).length * 11.7 + 4;
      font(9); for (const line of intentLines) intentHeight += doc.splitTextToSize(preparationPdfCopy(line), contentWidth).length * 11.7 + 4;
      ensure(intentHeight + 2, cardTitle);
      paragraph(memberHeading, 9, 'bold', 4, cardTitle);
      for (const line of intentLines) paragraph(line, 9, 'normal', 4, cardTitle);
      paragraph(fields.reference_note, 9, 'normal', 4, cardTitle);
      for (const [label, value] of [['Variety', fields.variety], ['Seed lot reference', fields.seed_lot_reference], ['Raising batch reference', fields.raising_batch_reference]]) {
        for (const line of referenceWriter.lines(`${label}: ${value}`, contentWidth)) {
          ensure(15, cardTitle); referenceWriter.select(line); doc.setTextColor(...ink);
          doc.text(line, margin, y + 10); y += 13;
        }
        y += 4;
      }
    }

    paragraph('Planning card only: Not verified tray labels, observed sowing, nursery stock or seedling readiness.', 9, 'normal', 4, cardTitle);
    paragraph('Loss estimates: Calculated counts already include supplied loss estimates; do not apply them again.', 9, 'normal', 4, cardTitle);
    paragraph('Crop identity: Matching crop names do not identify interchangeable varieties or seed lots. Unknown requirements are not zero.', 9, 'normal', 4, cardTitle);
    paragraph('This card does not establish resource availability, container packing or plant health.', 9, 'normal', 6, cardTitle);

    if (group.outsideReviewHorizon) {
      paragraph('Some raising dates extend beyond the review horizon.', 9, 'italic', 4, cardTitle);
    }
    for (const globalIssue of [...new Set(projection.issues.map(growerNurseryIssueText))]) {
      paragraph(`Review note: ${globalIssue}`, 9, 'normal', 4, cardTitle);
    }
    for (const issue of [...new Set(group.issues.map(growerNurseryIssueText))]) {
      paragraph(`Note: ${issue}`, 9, 'normal', 4, cardTitle);
    }

    ensure(95, cardTitle);
    y += 4;
    paragraph('Handwritten nursery notes (batch / seed lot / actual sowing - not saved by app):', 9, 'bold', 4, cardTitle);
    doc.setDrawColor(200, 208, 195);
    const writeFields = [
      'Actual sowing date:',
      'Seed lot / cultivar name:',
      'Containers sown & notes:',
    ];
    for (const wf of writeFields) {
      y += 14;
      font(8.5);
      doc.text(wf, margin + 12, y);
      doc.line(margin + 125, y, width - margin - 12, y);
    }
    y += 10;
  }

  const pages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pages; ++pageNumber) {
    doc.setPage(pageNumber);
    font(8);
    if (options.sample) {
      font(9, 'bold');
      doc.text('DEMO - EXAMPLE PLANNING DATA', width / 2, 21, { align: 'center' });
    }
    font(8);
    doc.text('PLANNED NURSERY BATCH - planning cards (not verified tray labels)', margin, height - 42);
    doc.text('Source not verified; not observed sowing or nursery stock', margin, height - 30);
    doc.text(`Page ${pageNumber} of ${pages}`, width - margin, height - 30, { align: 'right' });
  }

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

/** A shareable projection of the same nursery review, never another forecast.
 * Membership and source receipts remain private; the caller still checks current
 * source/book/actor and full result equality immediately before delivery. */
export interface NurseryPreparationPdfOptions { sample?: boolean }

/** Keep punctuation supported by the existing PDF font; crop identities are
 * printed separately and are never renamed to make a glyph fit. */
function preparationPdfCopy(text: string): string {
  return text.replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\u00a0/g, ' ');
}

function preparationMetricText(metric: import('./international/grower-nursery').GrowerNurseryPreparationMetric): string {
  if (metric.status === 'overflow') return 'Total unavailable; review input counts';
  if (metric.status === 'complete') return String(metric.total);
  return `Unknown total; known subtotal ${metric.knownSubtotal === null ? 'Unknown' : metric.knownSubtotal}`;
}

/** A printable view of the same projection, without delivery or live authority.
 * The caller still checks the original account/source and complete result. */
export async function buildGrowerNurseryPreparationPdf(result: GrowerNurseryResult, options: NurseryPreparationPdfOptions = {}): Promise<Blob> {
  const projection = projectGrowerNurseryPreparation(result);
  if (projection.status !== 'available') throw Error('The preparation worksheet is unavailable for this nursery review.');
  // The current canonical English names fit the existing standard font. If the
  // catalogue later changes, hold rather than silently deleting name glyphs.
  if (projection.groups.some(group => !/^[\x20-\x7e]+$/.test(group.cropName))) throw Error('The crop identity cannot be printed faithfully with the current PDF font.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const referenceWriter = await exactPdfTextWriter(doc, () => new NurseryReferenceExportError());
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const margin = 36, contentWidth = width - 2 * margin, bottom = height - 66;
  const ink: [number, number, number] = [43, 48, 39];
  let y = margin, activeGroup = '';
  const font = (size: number, weight: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', weight); doc.setFontSize(size); doc.setTextColor(...ink);
  };
  function page() {
    doc.addPage(); y = margin;
    font(10, 'bold'); doc.text('Planned transplant preparation (continued)', margin, y + 10); y += 18;
    if (activeGroup) {
      font(10); const lines = doc.splitTextToSize(activeGroup, contentWidth) as string[];
      doc.text(lines, margin, y + 10); y += lines.length * 13 + 6;
    }
  }
  function ensure(space: number) { if (y + space > bottom) page(); }
  function paragraph(text: string, size = 10, weight: 'normal' | 'bold' | 'italic' = 'normal', gap = 5) {
    font(size, weight);
    const lines = doc.splitTextToSize(preparationPdfCopy(text), contentWidth) as string[];
    // Dates and issues may run across several pages. Moving a whole oversized
    // block once would still draw its last lines outside the paper.
    for (const line of lines) {
      ensure(size * 1.3 + 2); font(size, weight); doc.text(line, margin, y + size); y += size * 1.3;
    }
    y += gap;
  }
  paragraph('Planned transplant preparation', 18, 'bold', 10);
  if (projection.horizon) paragraph(`Planning horizon: ${projection.horizon.start} to before ${projection.horizon.endExclusive} (UTC).`);
  paragraph(`Overall review status: ${projection.projectionIncomplete || projection.reviewIncomplete ? 'Incomplete review' : 'Reviewed inputs complete'}.`, 10, 'bold');
  paragraph(`Source: ${projection.sourceStatus === 'saved-planned' ? 'Saved planned crop cycles' : 'Proposed crop cycles'}. Grower estimates; source not verified.`);
  paragraph('Coverage: Represented transplant raising batches only. Direct sowing and omitted garden work need separate review.');
  paragraph('Estimates: These are planned estimates, not observed sowing, nursery stock or seedling readiness.');
  paragraph('This worksheet does not establish resource availability, tray packing or plant health. Review the dated nursery resource comparison separately.');
  paragraph('Loss estimates: Calculated counts already include supplied loss estimates; do not apply them again.');
  paragraph('Matching crop names do not identify interchangeable varieties or seed lots. Unknown requirements are not zero.');
  for (const issue of [...new Set(projection.issues.map(growerNurseryIssueText))]) paragraph(`Review input: ${issue}`);
  y += 5;
  if (!projection.groups.length) paragraph('No transplant batches are represented in this review. This does not establish a zero requirement for the whole garden.');
  for (const [index, group] of projection.groups.entries()) {
    // Between groups, a new page needs the document heading only. Repeating
    // the new group as a continuation immediately above its own title is noise.
    activeGroup = '';
    ensure(110);
    activeGroup = `${group.cropName} - preparation group ${index + 1}`;
    paragraph(activeGroup, 12, 'bold');
    paragraph(`Status: ${group.incomplete ? 'Incomplete' : 'Included counts complete'}.`);
    paragraph(`Raising starts ${group.startDate} (UTC). Raising ends before field entry: ${[...new Set(group.members.map(member => member.endDateExclusive))].sort().join(', ')} (exclusive UTC).`);
    const metrics = [
      ['Final field positions', group.fieldPositions], ['Starts to raise', group.startsToRaise], ['Seeds to sow', group.seedsToSow],
    ] as const;
    const cellWidth = contentWidth / 3;
    const cells = metrics.map(([label, metric]) => {
      font(10, 'bold'); const labels = doc.splitTextToSize(label, cellWidth - 18) as string[];
      font(10); const values = doc.splitTextToSize(preparationMetricText(metric), cellWidth - 18) as string[];
      return { labels, values };
    });
    const blockHeight = Math.max(...cells.map(cell => cell.labels.length + cell.values.length)) * 13 + 18;
    ensure(blockHeight + 5);
    for (const [column, cell] of cells.entries()) {
      const x = margin + column * cellWidth;
      doc.setFillColor(244, 247, 240); doc.roundedRect(x, y, cellWidth - 6, blockHeight, 4, 4, 'F');
      let lineY = y + 14;
      font(10, 'bold'); for (const line of cell.labels) { doc.text(line, x + 7, lineY); lineY += 13; }
      font(10); for (const line of cell.values) { doc.text(line, x + 7, lineY); lineY += 13; }
    }
    y += blockHeight + 7;
    paragraph(`${group.members.length} represented ${group.members.length === 1 ? 'batch' : 'batches'}.`, 10);
    for (const [memberIndex, member] of group.members.entries()) {
      const reference = exportReference(member.reference, projection.sourceStatus), fields = referenceColumns(reference);
      const memberHeading = `Member ${memberIndex + 1}: raising ${group.startDate}; field entry ${member.endDateExclusive} (exclusive UTC).`;
      const intentLines = (member.intent ?? readGrowerCycleIntent(undefined)).lines;
      font(9, 'bold'); let intentHeight = doc.splitTextToSize(memberHeading, contentWidth).length * 11.7 + 5;
      font(9); for (const line of intentLines) intentHeight += doc.splitTextToSize(preparationPdfCopy(line), contentWidth).length * 11.7 + 5;
      const referenceNoteHeight = doc.splitTextToSize(preparationPdfCopy(fields.reference_note), contentWidth).length * 11.7 + 5;
      const referenceRows = [['Variety', fields.variety], ['Seed lot reference', fields.seed_lot_reference], ['Raising batch reference', fields.raising_batch_reference]]
        .map(([label, value]) => referenceWriter.lines(`${label}: ${value}`, contentWidth));
      const memberHeight = intentHeight + referenceNoteHeight + referenceRows.reduce((sum, lines) => sum + lines.length * 13 + 4, 0);
      font(10); const freshPageRoom = bottom - margin - 18 - doc.splitTextToSize(activeGroup, contentWidth).length * 13 - 6;
      // Extra intent must not leave a short reference block without its member
      // identity. Oversized entered references retain existing per-line paging.
      ensure((memberHeight + 2 <= freshPageRoom ? memberHeight : intentHeight) + 2);
      paragraph(memberHeading, 9, 'bold');
      for (const line of intentLines) paragraph(line, 9);
      paragraph(fields.reference_note, 9);
      for (const lines of referenceRows) {
        for (const line of lines) {
          ensure(15); referenceWriter.select(line); doc.setTextColor(...ink);
          doc.text(line, margin, y + 10); y += 13;
        }
        y += 4;
      }
    }

    if (group.outsideReviewHorizon) paragraph('Some raising dates extend beyond the review horizon.');
    for (const issue of [...new Set(group.issues.map(growerNurseryIssueText))]) paragraph(`Note: ${issue}`);
    y += 8;
  }
  activeGroup = '';
  ensure(76); paragraph('Notes (written on sheet - not saved by app):', 10, 'bold');
  doc.setDrawColor(190, 198, 183);
  for (let line = 0; line < 3; ++line) { y += 14; doc.line(margin, y, width - margin, y); }
  const pages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pages; ++pageNumber) {
    doc.setPage(pageNumber); font(8);
    if (options.sample) { font(9, 'bold'); doc.text('DEMO - EXAMPLE PLANNING DATA', width / 2, 21, { align: 'center' }); }
    font(8); doc.text('Planned estimates - represented transplant batches only', margin, height - 42);
    doc.text('Source not verified; not observed sowing or nursery stock', margin, height - 30);
    doc.text(`Page ${pageNumber} of ${pages}`, width - margin, height - 30, { align: 'right' });
  }
  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

/** A shareable projection of the same nursery review, never another forecast.
 * Membership and source receipts remain private; the caller still checks current
 * source/book/actor and full result equality immediately before delivery. */
export function buildGrowerNurseryPreparationCsv(result: GrowerNurseryResult, options: Pick<NurseryCsvOptions, 'sample'> = {}): string {
  const projection = projectGrowerNurseryPreparation(result);
  const columns = ['record_type', 'plan_basis', 'source_status', 'source_verification', 'review_status', 'review_incomplete',
    'projection_status', 'projection_incomplete', 'coverage', 'horizon_start_utc', 'horizon_end_exclusive_utc', 'group_number', 'crop_name',
    'raising_start_date_utc', 'field_entry_dates_exclusive_utc', 'represented_batch_count', 'metric', 'metric_status',
    'known_subtotal', 'represented_batch_total', 'known_batch_count', 'unknown_batch_count', 'group_incomplete',
    'outside_review_horizon', 'member_number', 'reference_status', 'variety', 'seed_lot_reference', 'raising_batch_reference', 'reference_note', 'issues', 'guidance', ...GROWER_INTENT_EXPORT_COLUMNS] as const;
  type PreparationRow = Partial<Record<typeof columns[number], string | number>>;
  const labels = (issues: readonly string[]) => [...new Set(issues.map(growerNurseryIssueText))].join(' | ');
  const context: PreparationRow = {
    plan_basis: options.sample ? 'DEMO — planned grower-estimated transplant preparation' : 'Planned grower-estimated transplant preparation',
    source_status: projection.sourceStatus ?? 'unavailable', source_verification: projection.sourceVerification,
    review_status: projection.reviewStatus, review_incomplete: projection.reviewIncomplete ? 'yes' : 'no', projection_status: projection.status,
    projection_incomplete: projection.projectionIncomplete ? 'yes' : 'no',
    coverage: projection.coverage, horizon_start_utc: projection.horizon?.start ?? 'unknown',
    horizon_end_exclusive_utc: projection.horizon?.endExclusive ?? 'unknown',
  };
  const rows: PreparationRow[] = [{ ...context, record_type: 'guidance', represented_batch_count: projection.status === 'available' ? projection.representedBatchCount : 'unknown',
    issues: labels(projection.issues), guidance: projection.guidance }];
  for (const [index, group] of projection.groups.entries()) {
    for (const [memberIndex, member] of group.members.entries()) rows.push({ ...context, record_type: 'planned_batch_reference',
      group_number: index + 1, member_number: memberIndex + 1, crop_name: group.cropName, ...growerCycleIntentColumns(member.intent ?? readGrowerCycleIntent(undefined)),
      raising_start_date_utc: group.startDate, field_entry_dates_exclusive_utc: member.endDateExclusive,
      ...referenceColumns(exportReference(member.reference, projection.sourceStatus)), guidance: projection.guidance });
    for (const [name, metric] of [['field_positions', group.fieldPositions], ['starts_to_raise', group.startsToRaise], ['seeds_to_sow', group.seedsToSow]] as const) {
      rows.push({ ...context, record_type: 'preparation_group_metric', group_number: index + 1, crop_name: group.cropName,
        raising_start_date_utc: group.startDate, field_entry_dates_exclusive_utc: group.members.map(member => member.endDateExclusive).join(' | '),
        represented_batch_count: group.members.length, metric: name, metric_status: metric.status,
        known_subtotal: metric.knownSubtotal ?? 'unknown', represented_batch_total: metric.total ?? 'unknown',
        known_batch_count: metric.knownBatchCount, unknown_batch_count: metric.unknownBatchCount,
        group_incomplete: group.incomplete ? 'yes' : 'no', outside_review_horizon: group.outsideReviewHorizon ? 'yes' : 'no',
        issues: labels(group.issues), guidance: projection.guidance });
    }
  }
  return `\uFEFF${[columns, ...rows.map(row => columns.map(column => row[column] ?? ''))]
    .map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
