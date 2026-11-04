import type { JournalLegacyReview, readJournalLegacyCandidates } from '@/lib/field-journal';
import explore from './JournalExplore.module.css';

export type JournalLegacyCandidate = NonNullable<ReturnType<typeof readJournalLegacyCandidates>>[number];

export interface JournalLegacyReviewLabels {
  readonly heading: string;
  readonly description: string;
  readonly currentCount: string;
  readonly olderCount: string;
  readonly olderUnreadable: string;
  readonly download: string;
  readonly keepCurrent: string;
  readonly chooseNotes: string;
  readonly noCandidates: string;
  readonly recoverSelected: string;
}

export interface JournalLegacyReviewPanelProps {
  readonly review: JournalLegacyReview;
  readonly candidates: readonly JournalLegacyCandidate[];
  readonly selectedIds: readonly string[];
  readonly busy: boolean;
  readonly canKeep: boolean;
  readonly onToggleCandidate: (id: string) => void;
  readonly onRecoverSelected: () => void;
  readonly onDownload: () => void;
  readonly onKeepCurrent: () => void;
  readonly labels: JournalLegacyReviewLabels;
}

export function JournalLegacyReviewPanel({
  review,
  candidates,
  selectedIds,
  busy,
  canKeep,
  onToggleCandidate,
  onRecoverSelected,
  onDownload,
  onKeepCurrent,
  labels,
}: JournalLegacyReviewPanelProps) {
  const olderText = review.olderCount === null ? labels.olderUnreadable : labels.olderCount;
  const candidateIds = new Set(candidates.map(c => c.id));
  const hasSelectedCandidate = selectedIds.some(id => candidateIds.has(id));
  const canRecover = canKeep && hasSelectedCandidate && !busy;
  const selectedSet = new Set(selectedIds);

  return (
    <section aria-label={labels.heading} className={explore.exports}>
      <h3 style={{ margin: 0 }}>{labels.heading}</h3>
      <p className={explore.help} style={{ margin: 0 }}>{labels.description}</p>
      <div>
        <div>{labels.currentCount}</div>
        <div>{olderText}</div>
      </div>
      {candidates.length > 0 ? (
        <fieldset disabled={busy} style={{ margin: 0, padding: 0, border: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend style={{ padding: 0, fontWeight: 500 }}>{labels.chooseNotes}</legend>
          {candidates.map((candidate) => (
            <label key={candidate.id} className={explore.photoChoice} style={{ minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
              <input
                type="checkbox"
                checked={selectedSet.has(candidate.id)}
                disabled={busy}
                onChange={() => onToggleCandidate(candidate.id)}
              />
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <span>{candidate.date}{candidate.title ? ` · ${candidate.title}` : ''}</span>
                {candidate.notes ? (
                  <span className={explore.help} style={{ display: 'block', margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {candidate.notes}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className={explore.help} style={{ margin: 0 }}>{labels.noCandidates}</p>
      )}
      <div className={explore.exportButtons}>
        {candidates.length > 0 ? (
          <button
            type="button"
            onClick={onRecoverSelected}
            disabled={!canRecover}
            style={{ whiteSpace: 'normal' }}
          >
            {labels.recoverSelected}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          style={{ whiteSpace: 'normal' }}
        >
          {labels.download}
        </button>
        <button
          type="button"
          onClick={onKeepCurrent}
          disabled={busy || !canKeep}
          style={{ whiteSpace: 'normal' }}
        >
          {labels.keepCurrent}
        </button>
      </div>
    </section>
  );
}
