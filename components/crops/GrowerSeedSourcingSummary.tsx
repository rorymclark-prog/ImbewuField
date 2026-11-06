import React from 'react';
import type {
  GrowerSeedSourcingReview,
  GrowerSeedSourcingGroupReview,
} from '@/lib/international/grower-seed-sourcing';

const ISSUE_EXPLANATIONS: Record<string, string> = {
  'interchangeability-not-confirmed': 'Confirm these batches can use the same seed supply',
  'batch-membership-overlap': 'A batch is selected in more than one supply group',
  'group-id-duplicate': 'Review duplicate supply groups',
  'batch-membership-duplicate': 'A batch is repeated within this group',
  'batch-not-in-current-review': 'A selected batch is unavailable in this nursery review',
  'batch-reference-held': 'A selected batch reference needs review',
  'group-input-invalid': "Review this supply group's entries",
  'allocation-or-pack-count-invalid': 'Review the entered allocation or pack count',
  'seed-requirement-overflow': 'The seed requirement cannot be safely totalled',
  'seed-requirement-unknown': 'Some selected batch seed requirements are unknown',
  'allocation-or-pack-count-unknown': 'The allocation or pack count is not recorded',
  'pack-count-product-overflow': 'The planned pack total cannot be safely displayed',
};

function humanIssue(token: string): string {
  if (Object.hasOwn(ISSUE_EXPLANATIONS, token)) {
    return ISSUE_EXPLANATIONS[token];
  }
  return 'This group needs further review';
}

function groupStatusLabel(status: GrowerSeedSourcingGroupReview['status']): string {
  switch (status) {
    case 'complete':
      return 'Planning counts complete';
    case 'unknown':
      return 'Some counts unknown';
    case 'held':
      return 'Review needed';
    case 'overflow':
      return 'Count exceeds safe display';
    default:
      return 'Review needed';
  }
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'Unknown';
  }
  return value.toLocaleString('en-US');
}

export default function GrowerSeedSourcingSummary({
  review,
}: {
  review: GrowerSeedSourcingReview | null;
}) {
  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-[var(--text-primary)] [overflow-wrap:anywhere]"
      aria-labelledby="seed-sourcing-summary-heading"
    >
      <h2 id="seed-sourcing-summary-heading" className="text-xl font-semibold">
        Seed sourcing planning review
      </h2>

      {review === null || review.status === 'unavailable' ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No current saved seed sourcing review is available.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <p>
              Status: <span className="font-medium capitalize">{review.status}</span>
            </p>
            <p>
              Batches represented:{' '}
              <span className="font-medium">{formatNumber(review.representedBatchCount)}</span> ·
              Assigned:{' '}
              <span className="font-medium">{formatNumber(review.assignedBatchCount)}</span> ·
              Unassigned:{' '}
              <span className="font-medium">{formatNumber(review.unassignedBatchIds.length)}</span>
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3 text-xs text-[var(--text-secondary)] space-y-2">
            <p>
              Notice: Direct sowings, omitted transplant batches, and whole-farm seed requirements
              are not included in this review. Allocations are grower-entered planning figures, not
              observed inventory or seed purchase orders.
            </p>
            {review.guidance && <p>{review.guidance}</p>}
          </div>

          {review.groups.length > 0 && (
            <div className="space-y-3">
              {review.groups.map((group, idx) => {
                const uniqueIssues = [...new Set(group.issues.map(humanIssue))];
                return (
                  <article
                    key={idx}
                    className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3 text-sm"
                    aria-label={`Supply group ${idx + 1}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
                      <h3 className="font-medium">Supply group {idx + 1}</h3>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {groupStatusLabel(group.status)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p>
                        Entered label:{' '}
                        {group.identification?.labelStatus === 'provided' ? (
                          <span className="font-medium whitespace-pre-wrap">
                            {group.identification.enteredLabel}
                          </span>
                        ) : group.identification?.labelStatus === 'invalid' ? (
                          <span className="font-medium text-red-600">
                            Invalid label format
                          </span>
                        ) : group.identification?.enteredLabel !== null && group.identification?.enteredLabel !== undefined ? (
                          <span className="font-medium whitespace-pre-wrap">
                            Not recorded (blank: &quot;{group.identification.enteredLabel}&quot;)
                          </span>
                        ) : (
                          <span className="font-medium text-[var(--text-secondary)]">
                            Not recorded
                          </span>
                        )}
                      </p>
                      <p>
                        Public crop identities:{' '}
                        <span className="font-medium">
                          {group.identification?.cropNames.length
                            ? group.identification.cropNames.join(', ')
                            : 'None identified'}
                        </span>
                      </p>
                      {group.identification?.description && (
                        <p className="text-[var(--text-secondary)]">
                          {group.identification.description}
                        </p>
                      )}
                    </div>

                    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[var(--text-secondary)]">
                          Known seed subtotal
                        </dt>
                        <dd className="font-medium">
                          {formatNumber(group.knownRequiredSeedsSubtotal)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-secondary)]">Required seeds</dt>
                        <dd className="font-medium">{formatNumber(group.requiredSeeds)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-secondary)]">
                          Additional seeds needed
                        </dt>
                        <dd className="font-medium">
                          {formatNumber(group.counts?.neededSeeds)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-secondary)]">Planned packs</dt>
                        <dd className="font-medium">
                          {formatNumber(group.counts?.packsNeeded)}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-[var(--text-secondary)]">
                          Seeds in planned packs
                        </dt>
                        <dd className="font-medium">
                          {formatNumber(group.counts?.plannedPackSeeds)}
                        </dd>
                      </div>
                    </dl>

                    {uniqueIssues.length > 0 && (
                      <ul
                        className="list-disc space-y-1 pl-4 text-xs text-red-600"
                        aria-label={`Issues for supply group ${idx + 1}`}
                      >
                        {uniqueIssues.map((msg, iIdx) => (
                          <li key={iIdx}>{msg}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
