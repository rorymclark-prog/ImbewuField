'use client';

import { useState } from 'react';
import type { MonthlyProductionPreview } from '@/lib/international/projects/monthly-production-preview';

interface Props {
  readPreview: () => MonthlyProductionPreview;
}

export default function ProjectMonthlyProductionPreview({ readPreview }: Props) {
  const [preview, setPreview] = useState<MonthlyProductionPreview | null>(null);

  function handleOpen() {
    setPreview(readPreview());
  }

  function handleClose() {
    setPreview(null);
  }

  if (!preview) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm font-semibold text-[var(--color-forest-800)] hover:bg-[var(--bg-2)]"
      >
        Preview saved monthly records
      </button>
    );
  }

  return (
    <section
      aria-label="Private monthly production preview"
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-sm text-[var(--text-primary)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Saved monthly records</h3>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-2)]"
        >
          Close preview
        </button>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        This is a private preview of this site&apos;s saved summaries. Missing months have no entry, and nothing is shared here.
      </p>

      {preview.status === 'held' && (
        <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">
          Monthly records could not be verified from the saved plan.
        </p>
      )}

      {preview.status === 'ready' && preview.rows.length === 0 && (
        <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">
          No monthly records are available for this site’s private preview.
        </p>
      )}

      {preview.status === 'ready' && preview.rows.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-1)]">
          {preview.rows.map((row, index) => (
            <li
              key={`${row.month}-${row.label}-${row.status}-${index}`}
              className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <div className="font-semibold text-[var(--text-primary)]">{row.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{row.month}</div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-right">
                <span className="font-medium text-[var(--text-primary)]">
                  {row.quantity} {row.unit}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    row.status === 'actual'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  }`}
                >
                  {row.status === 'actual' ? 'Actual record' : 'Estimate'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
