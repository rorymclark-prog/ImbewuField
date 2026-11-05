'use client';

import { createProtectedLocalStorage, type ProtectedStorageContext, type ProtectedStorageLocks,
  type ProtectedStorageStatus, type ProtectedStorageRead, type ProtectedStorageWriteReceipt,
  type ProtectedStorageTransferOptions, type ProtectedLegacyReview } from './protected-local-storage';

export const JOURNAL_LEGACY_KEY = 'imbewu_field_journal_v1';
export const JOURNAL_STORAGE_KEY = 'imbewu_field_journal_v2';
export const JOURNAL_CUTOVER_KEY = 'imbewu_field_journal_cutover_v2';
export const JOURNAL_STORAGE_EVENT = 'imbewu-journal-storage-changed';
export type JournalStorageContext = ProtectedStorageContext;
export type JournalStorageLocks = ProtectedStorageLocks;
export type JournalStorageStatus = ProtectedStorageStatus;
export type JournalStorageWriteReceipt = ProtectedStorageWriteReceipt;
export type JournalStorageTransferOptions = ProtectedStorageTransferOptions;
export type JournalLegacyReview = ProtectedLegacyReview;
export interface JournalStorageRead extends Omit<ProtectedStorageRead, 'payloadRaw'> { journalRaw: string | null }

function array(raw: string): boolean { try { return Array.isArray(JSON.parse(raw)); } catch { return false; } }
function count(raw: string | null): number | null {
  try { const value: unknown = raw === null ? null : JSON.parse(raw); return Array.isArray(value) ? value.length : null; } catch { return null; }
}
// The public journal wire format is retained. The factory owns the protocol;
// this adapter names its payload, physical keys and existing export fields only.
const store = createProtectedLocalStorage({
  legacyBaseKeys: [JOURNAL_LEGACY_KEY], canonicalBaseKey: JOURNAL_STORAGE_KEY, receiptBaseKey: JOURNAL_CUTOVER_KEY,
  eventName: JOURNAL_STORAGE_EVENT, lockPrefix: 'imbewu-journal:', changedReason: 'journal-changed',
  payloadField: 'journalRaw', importedField: 'importedJournalRaw', reviewedField: 'reviewedJournalRaw',
  exportFilename: 'journal-copies.json',
  exportFields: { current: 'canonicalJournalRaw', older: 'olderJournalRaw', initial: 'initialImportJournalRaw' },
  validatePayload: array, importLegacy: raw => raw === null ? '[]' : array(raw) ? raw : null,
  legacyIsEmpty: raw => raw === null || count(raw) === 0, countRows: count,
});
export const makeBrowserJournalStorageContext = store.makeBrowserStorageContext;
export function readJournalStorage(context?: JournalStorageContext | null): JournalStorageRead {
  const { payloadRaw, ...status } = store.readStorage(context); return { ...status, journalRaw: payloadRaw };
}
export const readJournalStorageStatus = store.readStorageStatus;
export const initialiseJournalStorage = store.initialiseStorage;
export const recoverJournalStorage = store.recoverStorage;
export const captureJournalStorageLease = store.captureStorageLease;
export const journalStorageLeaseMatches = store.storageLeaseMatches;
export const releaseAllDocumentJournalLeases = store.releaseAllDocumentLeases;
export const writeJournalStorageRaw = store.writeStorageRaw;
export const readJournalStorageTransferHold = store.readStorageTransferHold;
export const transferJournalStoragePair = store.transferStoragePair;
export const readJournalLegacyReview = store.readLegacyReview;
export const journalLegacyReviewIsCurrent = store.legacyReviewIsCurrent;
export function exportJournalLegacyReview(review: object, context?: JournalStorageContext | null): { filename: 'journal-copies.json'; json: string } | null {
  const exported = store.exportLegacyReview(review, context); return exported && { ...exported, filename: 'journal-copies.json' };
}
export const keepCurrentJournalAfterLegacyReview = store.keepCurrentAfterLegacyReview;
