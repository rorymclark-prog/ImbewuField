import type { ProgrammeObservationCutoff } from '@/lib/programme-evidence';

export interface ProgrammeObservationCutoffPanelProps {
  cutoff: string;
  review: ProgrammeObservationCutoff | null;
  sample: boolean;
}

export default function ProgrammeObservationCutoffPanel({
  cutoff,
  review,
  sample,
}: ProgrammeObservationCutoffPanelProps) {
  return (
    <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-xs font-sans">
      <summary className="min-h-11 cursor-pointer py-3 font-medium text-[var(--text-primary)] select-none">
        Check observation dates {sample && <span className="ml-1 text-[10px] font-semibold tracking-wider text-[var(--orange)]">DEMO</span>}
      </summary>

      <div className="mt-3 space-y-3 text-[var(--text-secondary)]">
        <p>
          This checks dates of currently saved observations, using the chosen day inclusive and UTC for recorded time. Replaced observations cannot be reconstructed here. This is an internal check and does not change or publish the report.
        </p>

        {review && <p>Through <time dateTime={cutoff}>{cutoff}</time>, using UTC for recorded time.</p>}
        {review ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2">
              <dt className="text-[var(--text-secondary)]">Observed and recorded by cutoff</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{review.byCutoff}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2">
              <dt className="text-[var(--text-secondary)]">Recorded after cutoff</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{review.recordedLater}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2">
              <dt className="text-[var(--text-secondary)]">Observed after cutoff</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{review.observedLater}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2">
              <dt className="text-[var(--text-secondary)]">Missing or unreadable date</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{review.unknownDate}</dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-muted-strong)]">
            The cutoff cannot be checked.
          </p>
        )}
      </div>
    </details>
  );
}
