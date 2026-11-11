'use client';

import { inspectJournalGrowerLink, inspectJournalNurseryFieldPlanting, isJournalDate } from '@/lib/field-journal';

function observedDay(entry: unknown): string {
  try {
    if (!entry || typeof entry !== 'object') return 'Unknown';
    const field = Object.getOwnPropertyDescriptor(entry, 'date');
    return field && 'value' in field && isJournalDate(field.value) ? field.value : 'Unknown';
  } catch { return 'Unknown'; }
}

/** History retains the entered snapshot even after plans or batch labels change.
 * Neither a planned date nor this recorded count establishes survival or stock. */
export default function JournalNurseryFieldPlantingSummary({ entry }: { entry: unknown }) {
  const inspected = inspectJournalNurseryFieldPlanting(entry);
  if (inspected.status === 'legacy') return null;
  const link = inspectJournalGrowerLink(entry);
  if (inspected.status === 'held' || link.status !== 'linked' || link.link.eventKind !== 'field-entry') return <section lang="en" aria-label="Nursery field planting observation needs review" className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <p>Stored nursery field planting evidence needs review. Its count and reference labels are withheld; retained evidence has not been treated as an ordinary unlinked note.</p>
  </section>;
  const { observation } = inspected;
  return <section lang="en" aria-label="Recorded nursery field planting observation" className="mt-3 min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm [overflow-wrap:anywhere]">
    <h4 className="font-semibold">Recorded field planting</h4>
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      <div><dt>Plants planted during this recorded work</dt><dd>{observation.plantsPlanted}</dd></div>
      <div><dt>Observed day</dt><dd>{observedDay(entry)}</dd></div>
      <div><dt>Planned field entry (UTC calendar date)</dt><dd>{link.link.plannedDate}</dd></div>
      {([
        ['Variety / cultivar at observation', observation.references.variety], ['Seed-lot reference at observation', observation.references.seedLotReference],
        ['Raising-batch reference at observation', observation.references.raisingBatchReference],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}
    </dl>
    <p>Grower-entered observation for this work, not a stock balance, survival result or completed batch. Stored labels do not verify seed identity or identify a particular earlier sowing or count record.</p>
  </section>;
}
