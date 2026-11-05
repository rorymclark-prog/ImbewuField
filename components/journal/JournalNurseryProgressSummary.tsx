'use client';

import { inspectJournalNurseryProgress } from '@/lib/field-journal';

/** Stored observations remain independent of today's plan and label edits. */
export default function JournalNurseryProgressSummary({ entry }: { entry: unknown }) {
  const inspected = inspectJournalNurseryProgress(entry);
  if (inspected.status === 'legacy') return null;
  if (inspected.status === 'held') return <section lang="en" aria-label="Nursery count observation needs review" className="mt-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <p>Stored nursery count evidence needs review. Its count, assessment, coverage and reference labels are withheld.</p>
  </section>;
  const { observation } = inspected;
  const stage = { emerged: 'Emerged', alive: 'Alive', ready: 'Ready — grower assessment' };
  const coverage = { 'whole-batch': 'Whole batch', 'checked-subset': 'Checked subset only' };
  return <section lang="en" aria-label="Recorded nursery count observation" className="mt-3 min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm [overflow-wrap:anywhere]">
    <h4 className="font-semibold">Recorded nursery plant count</h4>
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      <div><dt>Plants observed</dt><dd>{observation.plantsObserved}</dd></div>
      <div><dt>Grower assessment</dt><dd>{stage[observation.stage]}</dd></div>
      <div><dt>Count coverage</dt><dd>{coverage[observation.coverage]}</dd></div>
      {([
        ['Variety / cultivar at observation', observation.references.variety], ['Seed-lot reference at observation', observation.references.seedLotReference],
        ['Raising-batch reference at observation', observation.references.raisingBatchReference],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}
    </dl>
    <p>Ready is the grower’s assessment, not certification. A subset is not the whole batch; repeated counts are not summed into available stock. Stored labels do not verify seed identity.</p>
  </section>;
}
