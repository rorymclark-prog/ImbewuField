import { inspectJournalGrowerLink } from './field-journal';

/**
 * Returns a concise, plain English description of a journal entry's planning
 * reference without claiming that planned tasks prove observed field work,
 * confirming live crop plan alignment, or disclosing internal private identifiers.
 */
export function journalPlanningReferenceText(entry: unknown): string | null {
  const inspection = inspectJournalGrowerLink(entry);

  if (inspection.status === 'legacy') {
    return null;
  }

  if (inspection.status === 'held') {
    return 'This entry has a saved planting reference that requires review. The original reference has been kept, but no current planting is confirmed.';
  }

  if (inspection.status === 'linked') {
    const plannedDate = inspection.link.plannedDate;
    return `Referenced to planned task date ${plannedDate}. This note records its own observed date; this reference has not been rechecked against current saved plantings.`;
  }

  return null;
}
