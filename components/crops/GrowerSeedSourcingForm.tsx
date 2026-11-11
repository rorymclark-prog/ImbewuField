'use client';

import React from 'react';

export interface SeedSourcingBatchOption {
  readonly id: string;
  readonly label: string;
}

export interface SeedSourcingGroupDraft {
  readonly id: string;
  readonly label: string;
  readonly batchIds: readonly string[];
  readonly interchangeabilityConfirmed: boolean;
  readonly allocatedToPlanSeedsText: string;
  readonly seedsPerPackText: string;
}

export type SeedSourcingGroupPatch = Partial<
  Pick<
    SeedSourcingGroupDraft,
    | 'label'
    | 'batchIds'
    | 'interchangeabilityConfirmed'
    | 'allocatedToPlanSeedsText'
    | 'seedsPerPackText'
  >
>;

export interface GrowerSeedSourcingFormProps {
  readonly batches: readonly SeedSourcingBatchOption[];
  readonly groups: readonly SeedSourcingGroupDraft[];
  readonly disabled: boolean;
  readonly onAddGroup: () => void;
  readonly onRemoveGroup: (groupId: string) => void;
  readonly onChangeGroup: (groupId: string, patch: SeedSourcingGroupPatch) => void;
}

const inputClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50';
const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50';

export default function GrowerSeedSourcingForm({
  batches,
  groups,
  disabled,
  onAddGroup,
  onRemoveGroup,
  onChangeGroup,
}: GrowerSeedSourcingFormProps) {
  const isAddDisabled = disabled || batches.length === 0;

  const handleAddGroup = () => {
    if (disabled || batches.length === 0) return;
    onAddGroup();
  };

  const handleRemoveGroup = (groupId: string) => {
    if (disabled) return;
    onRemoveGroup(groupId);
  };

  const handleChangeGroup = (groupId: string, patch: SeedSourcingGroupPatch) => {
    if (disabled) return;
    onChangeGroup(groupId, patch);
  };

  const handleBatchToggle = (
    groupId: string,
    currentBatchIds: readonly string[],
    batchId: string,
    checked: boolean
  ) => {
    if (disabled) return;
    let nextBatchIds: string[];
    if (checked) {
      nextBatchIds = currentBatchIds.includes(batchId)
        ? [...currentBatchIds]
        : [...currentBatchIds, batchId];
    } else {
      nextBatchIds = currentBatchIds.filter((id) => id !== batchId);
    }
    onChangeGroup(groupId, { batchIds: nextBatchIds });
  };

  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-[var(--text-primary)] [overflow-wrap:anywhere]"
      aria-labelledby="seed-sourcing-inputs-heading"
    >
      <h2 id="seed-sourcing-inputs-heading" className="text-xl font-semibold">
        Seed sourcing planning inputs
      </h2>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3 text-xs text-[var(--text-secondary)]">
        <p>
          Planning inputs only. This form does not record seed stock, place an order or save a
          nursery plan.
        </p>
      </div>

      {batches.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          No saved nursery batches are available for this review.
        </p>
      )}

      <fieldset disabled={disabled} className="space-y-4 border-0 p-0 m-0 min-w-0">
        {groups.map((group, groupIdx) => (
          <fieldset
            key={group.id}
            disabled={disabled}
            className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-4 text-sm min-w-0"
            aria-label={`Supply group ${groupIdx + 1}`}
          >
            <legend className="text-base font-medium px-1">Supply group {groupIdx + 1}</legend>

            <div className="flex flex-wrap items-baseline justify-end gap-2 border-b border-[var(--border)] pb-2">
              <button
                type="button"
                className={buttonClass}
                disabled={disabled}
                onClick={() => handleRemoveGroup(group.id)}
              >
                Remove supply group from this review
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Your supply group label (optional)
                <input
                  type="text"
                  className={inputClass}
                  value={group.label}
                  disabled={disabled}
                  onChange={(e) => handleChangeGroup(group.id, { label: e.target.value })}
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-[var(--text-secondary)]">
                Select batches for this supply group
              </span>
              {batches.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] italic">
                  No batches available for selection.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {batches.map((batch) => {
                    const isChecked = group.batchIds.includes(batch.id);
                    return (
                      <label
                        key={batch.id}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-1)] p-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border)] text-[var(--text-primary)]"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={(e) =>
                            handleBatchToggle(group.id, group.batchIds, batch.id, e.target.checked)
                          }
                        />
                        <span className="min-w-0 select-none">{batch.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-1)] p-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--text-primary)] shrink-0"
                  checked={group.interchangeabilityConfirmed}
                  disabled={disabled}
                  onChange={(e) =>
                    handleChangeGroup(group.id, {
                      interchangeabilityConfirmed: e.target.checked,
                    })
                  }
                />
                <span className="min-w-0 text-[var(--text-secondary)]">
                  I confirm these selected batches can use the same seed supply. (This is a
                  planning assertion and does not verify variety or seed-lot identity.)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Allocated to plan seeds
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    value={group.allocatedToPlanSeedsText}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChangeGroup(group.id, {
                        allocatedToPlanSeedsText: e.target.value,
                      })
                    }
                  />
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Enter whole seed counts without separators. Leave blank if unknown.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Seeds per pack (optional)
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    value={group.seedsPerPackText}
                    disabled={disabled}
                    onChange={(e) =>
                      handleChangeGroup(group.id, {
                        seedsPerPackText: e.target.value,
                      })
                    }
                  />
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Enter whole seed counts without separators. Leave blank if unknown.
                </p>
              </div>
            </div>
          </fieldset>
        ))}

        <div>
          <button
            type="button"
            className={buttonClass}
            disabled={isAddDisabled}
            onClick={handleAddGroup}
          >
            Add supply group
          </button>
        </div>
      </fieldset>
    </section>
  );
}
