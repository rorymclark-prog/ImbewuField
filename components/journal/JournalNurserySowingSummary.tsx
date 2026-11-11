'use client';

import { inspectJournalNurserySowing } from '@/lib/field-journal';

/** History uses the stored observation inspector, never today's crop plan or
 * editable labels. Unsafe or unlinked payloads remain visibly held. */
export default function JournalNurserySowingSummary({ entry }: { entry: unknown }) {
  const inspected = inspectJournalNurserySowing(entry);
  if (inspected.status === 'legacy') return null;
  if (inspected.status === 'held') return <section lang="en" aria-label="Nursery sowing observation needs review" className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <p>Stored nursery sowing evidence needs review. Its count and reference labels are withheld; this has not been treated as an ordinary unlinked note.</p>
  </section>;
  const { observation } = inspected;
  return <section lang="en" aria-label="Recorded nursery sowing observation" className="mt-3 min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm [overflow-wrap:anywhere]">
    <h4 className="font-semibold">Recorded nursery sowing</h4>
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      <div><dt>Physical trays used, including partly filled</dt><dd>{observation.traysUsed === null ? 'Unknown' : observation.traysUsed}</dd></div>
      {([
        ['Variety / cultivar at observation', observation.references.variety], ['Seed-lot reference at observation', observation.references.seedLotReference],
        ['Raising-batch reference at observation', observation.references.raisingBatchReference],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}
    </dl>
    <p>These stored labels do not verify seed identity. This observation does not record stock movement or replace planned quantities.</p>
  </section>;
}
