import type { JournalLegacyReview } from '@/lib/field-journal';
import explore from './JournalExplore.module.css';

export interface JournalLegacyReviewLabels {
  readonly heading: string;
  readonly description: string;
  readonly currentCount: string;
  readonly olderCount: string;
  readonly olderUnreadable: string;
  readonly download: string;
  readonly keepCurrent: string;
}

export interface JournalLegacyReviewPanelProps {
  readonly review: JournalLegacyReview;
  readonly busy: boolean;
  readonly canKeep: boolean;
  readonly onDownload: () => void;
  readonly onKeepCurrent: () => void;
  readonly labels: JournalLegacyReviewLabels;
}

export function JournalLegacyReviewPanel({
  review,
  busy,
  canKeep,
  onDownload,
  onKeepCurrent,
  labels,
}: JournalLegacyReviewPanelProps) {
  const olderText = review.olderCount === null ? labels.olderUnreadable : labels.olderCount;

  return (
    <section aria-label={labels.heading} className={explore.exports}>
      <h3 style={{ margin: 0 }}>{labels.heading}</h3>
      <p className={explore.help} style={{ margin: 0 }}>{labels.description}</p>
      <div>
        <div>{labels.currentCount}</div>
        <div>{olderText}</div>
      </div>
      <div className={explore.exportButtons}>
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
