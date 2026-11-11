'use client';

import React from 'react';
import GrowerSeedSourcingForm, {
  type SeedSourcingBatchOption,
  type SeedSourcingGroupDraft,
  type SeedSourcingGroupPatch,
} from './GrowerSeedSourcingForm';
import GrowerSeedSourcingSummary from './GrowerSeedSourcingSummary';
import type { GrowerSeedSourcingReview } from '@/lib/international/grower-seed-sourcing';

export interface GrowerSeedSourcingPanelProps {
  readonly batches: readonly SeedSourcingBatchOption[];
  readonly groups: readonly SeedSourcingGroupDraft[];
  readonly review: GrowerSeedSourcingReview | null;
  readonly disabled: boolean;
  readonly reviewing: boolean;
  readonly onAddGroup: () => void;
  readonly onRemoveGroup: (groupId: string) => void;
  readonly onChangeGroup: (groupId: string, patch: SeedSourcingGroupPatch) => void;
  readonly onReview: () => void;
}

const actionButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50';

export default function GrowerSeedSourcingPanel({
  batches,
  groups,
  review,
  disabled,
  reviewing,
  onAddGroup,
  onRemoveGroup,
  onChangeGroup,
  onReview,
}: GrowerSeedSourcingPanelProps) {
  const blocked = disabled || reviewing;
  const isReviewDisabled = blocked || batches.length === 0 || groups.length === 0;

  const handleAddGroup = () => {
    if (blocked) return;
    onAddGroup();
  };

  const handleRemoveGroup = (groupId: string) => {
    if (blocked) return;
    onRemoveGroup(groupId);
  };

  const handleChangeGroup = (groupId: string, patch: SeedSourcingGroupPatch) => {
    if (blocked) return;
    onChangeGroup(groupId, patch);
  };

  const handleReview = () => {
    if (blocked || batches.length === 0 || groups.length === 0) return;
    onReview();
  };

  return (
    <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <GrowerSeedSourcingForm
        batches={batches}
        groups={groups}
        disabled={blocked}
        onAddGroup={handleAddGroup}
        onRemoveGroup={handleRemoveGroup}
        onChangeGroup={handleChangeGroup}
      />

      <div className="space-y-2">
        <div>
          <button
            type="button"
            className={actionButtonClass}
            disabled={isReviewDisabled}
            onClick={handleReview}
          >
            {reviewing ? 'Checking saved nursery context…' : 'Review seed requirements'}
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Review uses your saved nursery context and these planning inputs. It does not record seed
          stock or place an order.
        </p>
      </div>

      <GrowerSeedSourcingSummary review={blocked ? null : review} />
    </section>
  );
}
