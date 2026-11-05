import type { JournalStorageStatus } from './journal-storage';

/**
 * Returns a concise, plain English status message explaining the current
 * journal storage condition to the grower without claiming saved status,
 * granting authorization, or inventing recovery steps.
 */
export function journalStorageMessage(status: JournalStorageStatus): string {
  if (status.status === 'sample') {
    return 'DEMO: this journal belongs to the sample. Your personal journal is unchanged.';
  }

  const reason = status.reason;

  if (status.legacyDiverged || reason === 'legacy-diverged') {
    return 'An older app session changed a separate copy of this journal. Your protected journal has been kept. Review both copies before editing; do not clear browser data.';
  }

  if (reason === 'another-writer' || reason === 'writer-not-acquired') {
    return 'Another browser tab or window may currently hold this journal. This view is read-only. Close other open editors, then check again.';
  }

  if (reason === 'web-locks-unavailable' || reason === 'lock-unavailable') {
    return 'Protected editing cannot be safely coordinated in this browser. This view is read-only.';
  }

  if (reason === 'guest-transfer-pending' || reason === 'guest-transfer-held') {
    return 'A signed-out journal transfer requires review before opening a different account journal. Existing entries have not been overwritten.';
  }

  if (reason === 'cutover-recovery-required') {
    return 'Protected storage setup is incomplete or retained copies could not be verified. Review retained copies before proceeding; do not clear browser data.';
  }

  if (reason === 'legacy-unreadable') {
    return 'A previous journal copy cannot be safely read. It has not been replaced with an empty journal.';
  }

  if (status.needsInitialisation || reason === 'upgrade-required') {
    return 'Protected storage setup is required before this journal can be edited.';
  }

  if (reason === 'context-changed' || reason === 'journal-changed') {
    return 'The active account or journal selection changed while checking storage. Check the current records before editing.';
  }

  if (reason === 'write-unconfirmed' || reason === 'review-write-unconfirmed') {
    return 'A previous save may have occurred but could not be confirmed. Check your retained records before attempting another save.';
  }

  if (status.status === 'ready' && status.writable) {
    return 'Protected journal is ready for editing.';
  }

  return 'Editing is unavailable because saved storage could not be verified.';
}
