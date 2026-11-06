import { sanitiseProductionRecords, type DatedProductionRecord } from '@/lib/production-records';
import type { BoardTask } from '@/lib/task-board';
import type { JournalEntry } from '@/lib/field-journal';
import type { SavedInvoice } from '@/lib/invoices';
import type { ProgrammeMilestone } from '@/lib/programme-evidence';
import type { MelAssessment } from '@/lib/mel';
import type { EvidenceAuthority, EvidenceReference, ProjectEvidence } from './types';
import { validProjectDate } from './evaluate';
import { detachJsonData } from '@/lib/lossless-json';
import { decimalQuantitySum } from '@/lib/farm-records';

export const PROJECT_SOURCE_BOUNDARIES: readonly { authority: EvidenceAuthority; module: string; integration: string }[] = [
  { authority: 'production-records', module: 'lib/production-records.ts', integration: 'Preserve actual/expected, original unit, site and complete monthly period. This lane supplies a pure adapter.' },
  { authority: 'farm-records', module: 'lib/farm-records.ts', integration: 'Keep the existing quantity/unit contract and source sale/harvest reconciliation. Never infer pack weights.' },
  { authority: 'task-board', module: 'lib/task-board.ts', integration: 'Reference planned/completed work; completion does not establish a harvest or outcome.' },
  { authority: 'field-journal', module: 'lib/field-journal.ts', integration: 'Keep dated observations and photos in the existing journal; free text is not automatically a numeric outcome.' },
  { authority: 'invoices', module: 'lib/invoices.ts', integration: 'Existing invoices are rand-based; paid status needs payment-date evidence. No new currency or receipt adapter is inferred here.' },
  { authority: 'programme-evidence', module: 'lib/programme-evidence.ts', integration: 'Use existing milestone observations, publication projections and stable IDs. Targets are separate from observations.' },
  { authority: 'mel', module: 'lib/mel.ts', integration: 'Reuse consent, matched stages, version compatibility and suppression. Participation is not demonstrated outcome or causality.' },
];

type ExistingSources = {
  'production-records': Pick<DatedProductionRecord, 'id'>;
  'task-board': Pick<BoardTask, 'id'>;
  'field-journal': Pick<JournalEntry, 'id'>;
  invoices: Pick<SavedInvoice, 'id'>;
  'programme-evidence': Pick<ProgrammeMilestone, 'id'>;
  mel: Pick<MelAssessment, 'id'>;
};
/** A reference carries no private payload and does not grant access to its source. */
export function existingProjectReference<A extends keyof ExistingSources>(authority: A, row: ExistingSources[A]): EvidenceReference {
  if (typeof row.id !== 'string' || !row.id.trim() || row.id.length > 240) throw new Error('A stable source ID is required.');
  return { authority, id: row.id };
}

export interface ProductionReviewEnvelope {
  projectId: string;
  recordedOn: string;
  consent: ProjectEvidence['consent'];
  published: boolean;
}

/** Existing monthly records have no recording timestamp or publication grant.
 * Those must come from the authorised caller's source envelope, never this adapter's clock. */
export function productionProjectEvidence(records: readonly DatedProductionRecord[], envelope: ProductionReviewEnvelope): ProjectEvidence[] {
  if (!envelope.projectId.trim() || !validProjectDate(envelope.recordedOn)) return [];
  return sanitiseProductionRecords(records).flatMap(row => {
    if (!row.siteId) return [];
    const month = `${String(row.date.year).padStart(4, '0')}-${String(row.date.month).padStart(2, '0')}`;
    const last = new Date(`${month}-01T00:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    return [{ reference: existingProjectReference('production-records', row), projectId: envelope.projectId,
      siteId: row.siteId, kind: 'harvest' as const, level: 'output' as const,
      basis: row.status === 'actual' ? 'actual' as const : 'estimate' as const,
      provenance: row.provenance === 'fictional-example' ? 'fictional-demo' as const : 'source-record' as const,
      periodStart: `${month}-01`, periodEnd: last.toISOString().slice(0, 10), recordedOn: envelope.recordedOn,
      stage: 'current' as const, quantity: row.quantity, unit: row.unit,
      consent: envelope.consent, published: envelope.published }];
  });
}

export interface PreviewRecordedHarvestRequest {
  records: unknown;
  siteId: string;
  periodStart: string;
  periodEnd: string;
}

export interface EligibleRecordedHarvestRow {
  reference: EvidenceReference;
  sourceRowIndex: number;
  date: { year: number; month: number };
  periodStart: string;
  periodEnd: string;
  quantityKg: number;
}

export interface ExcludedRecordedHarvestRow {
  sourceRowIndex: number;
  reference: EvidenceReference | null;
  reasons: string[];
}

export interface PreviewRecordedHarvestHeld {
  status: 'held';
  reasons: string[];
  rows: [];
  excluded: [];
  knownSubtotalKg: null;
  projectReportAvailable: false;
}

export interface PreviewRecordedHarvestReady {
  status: 'ready';
  reasons: string[];
  rows: EligibleRecordedHarvestRow[];
  excluded: ExcludedRecordedHarvestRow[];
  knownSubtotalKg: number | null;
  projectReportAvailable: false;
}

export type PreviewRecordedHarvestResult = PreviewRecordedHarvestHeld | PreviewRecordedHarvestReady;

function monthPeriodFromProductionDate(date: { year: number; month: number }): { periodStart: string; periodEnd: string } {
  const month = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`;
  const last = new Date(`${month}-01T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { periodStart: `${month}-01`, periodEnd: last.toISOString().slice(0, 10) };
}

export function previewRecordedHarvest(request: unknown): PreviewRecordedHarvestResult {
  const held = (...reasons: string[]): PreviewRecordedHarvestHeld => ({
    status: 'held',
    reasons: [...new Set(reasons)],
    rows: [],
    excluded: [],
    knownSubtotalKg: null,
    projectReportAvailable: false,
  });

  let detachedRequest: unknown;
  try {
    detachedRequest = detachJsonData(request, { allowUndefinedObjectFields: true });
  } catch {
    return held('unsafe-source-data');
  }

  if (!detachedRequest || typeof detachedRequest !== 'object' || Array.isArray(detachedRequest)) {
    return held('invalid-request');
  }

  const reqObj = detachedRequest as Record<string, unknown>;
  const siteId = typeof reqObj.siteId === 'string' && reqObj.siteId.trim().length > 0 && reqObj.siteId.trim().length <= 240
    ? reqObj.siteId.trim()
    : undefined;

  if (!siteId || typeof reqObj.siteId !== 'string' || reqObj.siteId !== siteId) {
    return held('invalid-site-id');
  }

  if (!validProjectDate(reqObj.periodStart) || !validProjectDate(reqObj.periodEnd)) {
    return held('invalid-period-date');
  }

  const periodStart = reqObj.periodStart as string;
  const periodEnd = reqObj.periodEnd as string;
  if (periodStart > periodEnd) {
    return held('reversed-period');
  }

  const detachedRecords = reqObj.records;
  if (!Array.isArray(detachedRecords)) {
    return held('non-array-records');
  }

  if (detachedRecords.length === 0) {
    return {
      status: 'ready',
      reasons: [],
      rows: [],
      excluded: [],
      knownSubtotalKg: null,
      projectReportAvailable: false,
    };
  }

  // Prepass to detect duplicate scoped ID or duplicate normalization identity in source
  // without reimplementing sanitizer validation rules: call sanitiseProductionRecords on singleton rows.
  const seenScopedIds = new Set<string>();
  const seenIdentities = new Set<string>();
  for (const item of detachedRecords) {
    const single = sanitiseProductionRecords([item]);
    if (single.length === 1) {
      const s = single[0];
      const scopedIdKey = JSON.stringify([s.siteId ?? null, s.id]);
      if (seenScopedIds.has(scopedIdKey)) return held('duplicate-scoped-id-in-source');
      seenScopedIds.add(scopedIdKey);

      const identityKey = JSON.stringify([s.siteId ?? null, s.sourceIconKey, s.date.year, s.date.month, s.status]);
      if (seenIdentities.has(identityKey)) return held('duplicate-normalization-identity-in-source');
      seenIdentities.add(identityKey);
    }
  }

  const eligibleRows: EligibleRecordedHarvestRow[] = [];
  const excludedRows: ExcludedRecordedHarvestRow[] = [];
  const generalReasons: string[] = [];

  for (let index = 0; index < detachedRecords.length; ++index) {
    const rawItem = detachedRecords[index];
    const reasons: string[] = [];

    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      excludedRows.push({ sourceRowIndex: index, reference: null, reasons: ['malformed-row'] });
      continue;
    }

    const row = rawItem as Record<string, unknown>;

    // Individual sanitization inspection using canonical sanitizer authority
    const sanitisedResult = sanitiseProductionRecords([row]);
    const sanitisedRow = sanitisedResult.length === 1 ? sanitisedResult[0] : null;

    // Check exact untruncated ID
    const validRawId = typeof row.id === 'string' && row.id.trim().length > 0 && row.id.trim().length <= 200 && row.id === row.id.trim();
    const ref: EvidenceReference | null = validRawId && sanitisedRow && sanitisedRow.id === row.id
      ? { authority: 'production-records', id: row.id }
      : null;

    if (!validRawId) {
      reasons.push('missing-or-invalid-id');
    }

    if (row.provenance === undefined) {
      reasons.push('missing-provenance');
    } else if (row.provenance === 'fictional-example') {
      reasons.push('fictional-example');
    } else if (row.provenance !== 'farm-record') {
      reasons.push('unsupported-provenance');
    }

    if (row.siteId === undefined) {
      reasons.push('unassigned-site');
    } else if (row.siteId !== siteId) {
      reasons.push('different-site');
    }

    if (row.status !== 'actual') {
      reasons.push('not-actual-harvest');
    }

    if (row.unit !== 'kg') {
      reasons.push('unit-not-kg');
    }

    if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity < 0) {
      reasons.push('invalid-quantity');
    }

    if (!sanitisedRow) {
      reasons.push('normalization-rejected');
    } else {
      // Core fidelity comparison against canonical normalization
      if (sanitisedRow.id !== row.id) reasons.push('normalization-id-loss');
      if (sanitisedRow.label !== row.label) reasons.push('normalization-label-loss');
      if (sanitisedRow.sourceIconKey !== row.sourceIconKey) reasons.push('normalization-source-key-loss');
      if (sanitisedRow.siteId !== row.siteId) reasons.push('normalization-site-loss');
      if (sanitisedRow.quantity !== row.quantity) reasons.push('normalization-quantity-loss');
      if (sanitisedRow.unit !== row.unit) reasons.push('normalization-unit-loss');
      if (sanitisedRow.status !== row.status) reasons.push('normalization-status-loss');

      // Month period boundary checking
      const { periodStart: rowStart, periodEnd: rowEnd } = monthPeriodFromProductionDate(sanitisedRow.date);
      if (rowStart < periodStart || rowEnd > periodEnd) {
        reasons.push('month-outside-period');
      }
    }

    if (reasons.length > 0) {
      excludedRows.push({ sourceRowIndex: index, reference: ref, reasons: [...new Set(reasons)] });
    } else {
      const { periodStart: rowStart, periodEnd: rowEnd } = monthPeriodFromProductionDate(sanitisedRow!.date);
      eligibleRows.push({
        reference: ref!,
        sourceRowIndex: index,
        date: { year: sanitisedRow!.date.year, month: sanitisedRow!.date.month },
        periodStart: rowStart,
        periodEnd: rowEnd,
        quantityKg: sanitisedRow!.quantity,
      });
    }
  }

  let knownSubtotalKg: number | null = null;
  if (eligibleRows.length > 0) {
    const quantities = eligibleRows.map(r => r.quantityKg);
    knownSubtotalKg = decimalQuantitySum(quantities);
    if (knownSubtotalKg === null) {
      generalReasons.push('decimal-sum-overflow');
    }
  }

  return {
    status: 'ready',
    reasons: generalReasons,
    rows: eligibleRows,
    excluded: excludedRows,
    knownSubtotalKg,
    projectReportAvailable: false,
  };
}
