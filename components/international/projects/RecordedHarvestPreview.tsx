'use client';

import React, { useId } from 'react';
import type {
  PreviewRecordedHarvestResult,
  EligibleRecordedHarvestRow,
  ExcludedRecordedHarvestRow,
} from '@/lib/international/projects/sources';
import { estimateNumberLabel } from '@/lib/format-figures';

export interface RecordedHarvestSiteOption {
  readonly id: string;
  readonly label: string;
}

export interface RecordedHarvestPreviewProps {
  readonly sites: readonly RecordedHarvestSiteOption[];
  readonly siteId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly review: PreviewRecordedHarvestResult | null;
  readonly busy: boolean;
  readonly canLoad: boolean;
  readonly sourceNotice: string;
  readonly onSiteChange: (siteId: string) => void;
  readonly onPeriodStartChange: (date: string) => void;
  readonly onPeriodEndChange: (date: string) => void;
  readonly onLoad: () => void;
}

const fieldClass = 'w-full min-h-[44px] rounded-lg border px-3 py-2 text-base';
const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-0, #ffffff)',
  color: 'var(--text-primary, #111827)',
  borderColor: 'var(--border, #d1d5db)',
};
const panelStyle: React.CSSProperties = {
  background: 'var(--bg-1, #f9fafb)',
  borderColor: 'var(--border, #d1d5db)',
};

const REASON_MESSAGES: Record<string, string> = {
  'invalid-request': 'Request details are invalid.',
  'invalid-site-id': 'Select a saved site.',
  'invalid-period-date': 'Reporting dates are invalid.',
  'reversed-period': 'Period start must come before or on period end.',
  'unsafe-source-data': 'Records are unavailable or malformed.',
  'non-array-records': 'Harvest records are unavailable.',
  'duplicate-scoped-id-in-source': 'Duplicate records found for this site; review the source entries.',
  'duplicate-normalization-identity-in-source': 'Duplicate monthly records need review.',
  'malformed-row': 'Row is malformed or unreadable.',
  'missing-or-invalid-id': 'Record identifier is missing or invalid.',
  'missing-provenance': 'Record origin is missing or unknown.',
  'fictional-example': 'Example demonstration records cannot enter project reviews.',
  'unsupported-provenance': 'Record origin is not supported.',
  'unassigned-site': 'Record is not assigned to a site.',
  'different-site': 'Record belongs to another site.',
  'not-actual-harvest': 'Planned or estimated harvest is not an actual observation.',
  'unit-not-kg': 'Harvest unit is not kilograms (kg); no unit conversion is assumed.',
  'invalid-quantity': 'Quantity is missing or invalid.',
  'invalid-date': 'Date is missing or invalid.',
  'month-outside-period': 'Entire calendar month must fit within the reporting period; records are not prorated.',
  'normalization-rejected': 'Record could not be reconciled with saved farm rules.',
  'normalization-id-loss': 'Record identifier would be modified.',
  'normalization-label-loss': 'Record description would be modified.',
  'normalization-source-key-loss': 'Crop identifier would be modified.',
  'normalization-site-loss': 'Site link would be modified.',
  'normalization-quantity-loss': 'Quantity precision would be modified.',
  'normalization-unit-loss': 'Unit would be modified.',
  'normalization-status-loss': 'Harvest status would be modified.',
  'decimal-sum-overflow': 'Total quantity exceeds arithmetic limits.',
};

function humanReason(code: string): string {
  return REASON_MESSAGES[code] ?? 'Source needs review.';
}

function formatKg(value: number): string {
  if (value === 0) return '0 kg';
  const formatted = estimateNumberLabel(value);
  return `${formatted} kg`;
}

export default function RecordedHarvestPreview({
  sites,
  siteId,
  periodStart,
  periodEnd,
  review,
  busy,
  canLoad,
  sourceNotice,
  onSiteChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onLoad,
}: RecordedHarvestPreviewProps) {
  const headingId = useId();
  const siteSelectId = useId();
  const startInputId = useId();
  const endInputId = useId();

  return (
    <section className="space-y-6" aria-labelledby={headingId}>
      <header className="space-y-2">
        <h2 id={headingId} className="text-2xl font-semibold">
          Recorded harvest preview
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary, #4b5563)' }}>
          Read-only view of selected source records. A known subtotal is not a complete harvest total,
          project result, food sufficiency assessment, or permission to share.
        </p>
      </header>

      {sourceNotice && (
        <div className="rounded-xl border p-4 text-sm break-words" style={panelStyle} role="status">
          {sourceNotice}
        </div>
      )}

      <form
        className="rounded-xl border p-4 sm:p-6 space-y-4"
        style={panelStyle}
        onSubmit={(e) => {
          e.preventDefault();
          if (canLoad && !busy) onLoad();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor={siteSelectId} className="block text-sm font-medium">
              Saved site
            </label>
            <select
              id={siteSelectId}
              className={fieldClass}
              style={fieldStyle}
              value={siteId}
              disabled={busy}
              onChange={(e) => onSiteChange(e.target.value)}
            >
              <option value="">Choose a saved site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={startInputId} className="block text-sm font-medium">
              Period start (inclusive)
            </label>
            <input
              type="date"
              id={startInputId}
              className={fieldClass}
              style={fieldStyle}
              value={periodStart}
              disabled={busy}
              onChange={(e) => onPeriodStartChange(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={endInputId} className="block text-sm font-medium">
              Period end (inclusive)
            </label>
            <input
              type="date"
              id={endInputId}
              className={fieldClass}
              style={fieldStyle}
              value={periodEnd}
              disabled={busy}
              onChange={(e) => onPeriodEndChange(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 font-medium border text-base disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--primary, #2563eb)',
              color: 'var(--primary-contrast, #ffffff)',
              borderColor: 'transparent',
            }}
            disabled={busy || !canLoad}
          >
            {busy ? 'Checking records…' : 'Review recorded harvest'}
          </button>
        </div>
      </form>

      <div className="space-y-4" aria-live="polite">
        {review === null && (
          <div className="rounded-xl border p-4 text-sm" style={panelStyle}>
            No source review yet. Choose a saved site and reporting period to inspect eligible records.
          </div>
        )}

        {review !== null && review.status === 'held' && (
          <div className="rounded-xl border p-4 sm:p-6 space-y-3" style={panelStyle}>
            <h3 className="text-lg font-semibold text-red-700">Source unavailable</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary, #4b5563)' }}>
              The source records cannot be reviewed due to unresolved issues:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm break-words">
              {review.reasons.map((r, i) => (
                <li key={i}>{humanReason(r)}</li>
              ))}
            </ul>
          </div>
        )}

        {review !== null && review.status === 'ready' && (
          <div className="space-y-6">
            <div className="rounded-xl border p-4 sm:p-6 space-y-3" style={panelStyle}>
              <h3 className="text-lg font-semibold">Review summary</h3>
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <span className="text-sm block" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                    Known subtotal
                  </span>
                  <span className="text-2xl font-bold">
                    {review.knownSubtotalKg === null ? (
                      <span className="text-base font-normal italic" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                        {review.rows.length === 0
                          ? 'Not known (no eligible recorded weights)'
                          : 'Unavailable (arithmetic limits exceeded)'}
                      </span>
                    ) : (
                      formatKg(review.knownSubtotalKg)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-sm block" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                    Eligible records
                  </span>
                  <span className="text-xl font-semibold">{review.rows.length}</span>
                </div>
                {review.excluded.length > 0 && (
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                      Excluded records
                    </span>
                    <span className="text-xl font-semibold">{review.excluded.length}</span>
                  </div>
                )}
              </div>

              {review.reasons.length > 0 && (
                <div className="pt-2 text-sm text-red-700 space-y-1">
                  <span className="font-medium block">Summary notes:</span>
                  <ul className="list-disc pl-5 space-y-0.5 break-words">
                    {review.reasons.map((r, i) => (
                      <li key={i}>{humanReason(r)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                Project reports remain unavailable because project membership, recording dates, and sharing approval are not established by this preview.
              </p>
            </div>

            {review.rows.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-md font-semibold">Eligible recorded observations</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {review.rows.map((row: EligibleRecordedHarvestRow) => (
                    <div
                      key={row.sourceRowIndex}
                      className="rounded-lg border p-3 space-y-1 break-words"
                      style={panelStyle}
                    >
                      <div className="flex justify-between items-start text-sm">
                        <span className="font-medium">Row #{row.sourceRowIndex + 1}</span>
                        <span className="font-semibold">{formatKg(row.quantityKg)}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary, #4b5563)' }}>
                        Month: {row.periodStart} to {row.periodEnd}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {review.excluded.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-md font-semibold">Excluded observations</h4>
                <div className="space-y-2">
                  {review.excluded.map((ex: ExcludedRecordedHarvestRow, i: number) => (
                    <div
                      key={i}
                      className="rounded-lg border p-3 text-sm space-y-1 break-words"
                      style={panelStyle}
                    >
                      <div className="text-xs font-medium">
                        Row #{ex.sourceRowIndex + 1}
                      </div>
                      <ul className="list-disc pl-4 text-xs space-y-0.5 text-red-600">
                        {ex.reasons.map((r, ri) => (
                          <li key={ri}>{humanReason(r)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
