import { sanitiseProductionRecords, type DatedProductionRecord } from '@/lib/production-records';
import type { BoardTask } from '@/lib/task-board';
import type { JournalEntry } from '@/lib/field-journal';
import type { SavedInvoice } from '@/lib/invoices';
import type { ProgrammeMilestone } from '@/lib/programme-evidence';
import type { MelAssessment } from '@/lib/mel';
import type { EvidenceAuthority, EvidenceReference, ProjectEvidence } from './types';
import { validProjectDate } from './evaluate';

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
