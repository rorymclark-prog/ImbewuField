'use client';

import { createProtectedLocalStorage, type ProtectedStorageContext, type ProtectedStorageLocks,
  type ProtectedStorageStatus, type ProtectedStorageRead, type ProtectedStorageWriteReceipt,
  type ProtectedLegacyReview } from './protected-local-storage';
import { rawJsonIsLossless } from './lossless-json';

export const INVOICE_LEGACY_KEY = 'imbewu_invoices';
export const INVOICE_PENDING_LEGACY_KEY = 'imbewu_invoice_pending_links';
export const INVOICE_SEQUENCE_LEGACY_KEY = 'imbewu_invoice_seq';
export const INVOICE_STORAGE_KEY = 'imbewu_invoice_book_v2';
export const INVOICE_CUTOVER_KEY = 'imbewu_invoice_cutover_v2';
export const INVOICE_STORAGE_EVENT = 'imbewu-invoice-storage-changed';
export interface InvoiceStorageContext extends ProtectedStorageContext { legacyKeys: readonly [string, string, string] }
export type InvoiceStorageLocks = ProtectedStorageLocks;
export type InvoiceStorageStatus = ProtectedStorageStatus;
export type InvoiceStorageWriteReceipt = ProtectedStorageWriteReceipt;
export type InvoiceLegacyReview = ProtectedLegacyReview;
export interface InvoiceStorageRead extends Omit<ProtectedStorageRead, 'payloadRaw'> { bookRaw: string | null }
export interface InvoiceStoragePayload {
  version: 1;
  invoicesRaw: string;
  pendingLinksRaw: string;
  sequenceRaw: string | null;
}
interface LegacyCopies { invoicesRaw: string | null; pendingLinksRaw: string | null; sequenceRaw: string | null }
const payloadKeys = ['version', 'invoicesRaw', 'pendingLinksRaw', 'sequenceRaw'];
function array(raw: string): boolean { try { return typeof raw === 'string' && Array.isArray(JSON.parse(raw)); } catch { return false; } }
export function parseInvoiceStoragePayload(raw: string): InvoiceStoragePayload | null {
  try {
    if (!rawJsonIsLossless(raw)) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (Object.keys(row).length !== 4 || Object.keys(row).some(key => !payloadKeys.includes(key)) || row.version !== 1
      || typeof row.invoicesRaw !== 'string' || !array(row.invoicesRaw)
      || typeof row.pendingLinksRaw !== 'string' || !array(row.pendingLinksRaw)
      || row.sequenceRaw !== null && typeof row.sequenceRaw !== 'string') return null;
    return row as unknown as InvoiceStoragePayload;
  } catch { return null; }
}
function legacyCopies(raw: string | null): LegacyCopies | null {
  if (raw === null) return { invoicesRaw: null, pendingLinksRaw: null, sequenceRaw: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>, keys = ['invoicesRaw', 'pendingLinksRaw', 'sequenceRaw'];
    if (Object.keys(row).length !== 3 || keys.some(key => !Object.hasOwn(row, key) || row[key] !== null && typeof row[key] !== 'string')) return null;
    return row as unknown as LegacyCopies;
  } catch { return null; }
}
function importLegacy(raw: string | null): string | null {
  const copies = legacyCopies(raw);
  if (!copies || copies.invoicesRaw !== null && !array(copies.invoicesRaw) || copies.pendingLinksRaw !== null && !array(copies.pendingLinksRaw)) return null;
  return JSON.stringify({ version: 1, invoicesRaw: copies.invoicesRaw ?? '[]', pendingLinksRaw: copies.pendingLinksRaw ?? '[]', sequenceRaw: copies.sequenceRaw } satisfies InvoiceStoragePayload);
}
function rowCount(raw: string | null): number | null {
  try {
    const book = raw === null ? null : parseInvoiceStoragePayload(raw);
    return book ? JSON.parse(book.invoicesRaw).length + JSON.parse(book.pendingLinksRaw).length : null;
  } catch { return null; }
}
const store = createProtectedLocalStorage({
  legacyBaseKeys: [INVOICE_LEGACY_KEY, INVOICE_PENDING_LEGACY_KEY, INVOICE_SEQUENCE_LEGACY_KEY],
  canonicalBaseKey: INVOICE_STORAGE_KEY, receiptBaseKey: INVOICE_CUTOVER_KEY,
  eventName: INVOICE_STORAGE_EVENT, lockPrefix: 'imbewu-invoice-book:', changedReason: 'invoice-book-changed',
  payloadField: 'bookRaw', importedField: 'importedBookRaw', reviewedField: 'reviewedBookRaw',
  exportFilename: 'invoice-copies.json',
  exportFields: { current: 'canonicalInvoiceBookRaw', older: 'olderInvoiceBookRaw', initial: 'initialImportInvoiceBookRaw' },
  validatePayload: raw => parseInvoiceStoragePayload(raw) !== null, importLegacy,
  legacyIsEmpty: raw => { const imported = importLegacy(raw); return imported !== null && rowCount(imported) === 0; },
  countRows: rowCount, countLegacyRows: raw => { const imported = importLegacy(raw); return imported === null ? null : rowCount(imported); },
  captureLegacy(context) {
    const keys = context.legacyKeys; if (!keys || keys.length !== 3) throw Error('invalid-storage-context');
    const values = keys.map(key => context.storage.getItem(key));
    if (values.some(value => value !== null && typeof value !== 'string')) throw Error('storage-unavailable');
    if (values.every(value => value === null)) return null;
    return JSON.stringify({ invoicesRaw: values[0], pendingLinksRaw: values[1], sequenceRaw: values[2] } satisfies LegacyCopies);
  },
});
export function makeBrowserInvoiceStorageContext(): InvoiceStorageContext | null {
  return store.makeBrowserStorageContext() as InvoiceStorageContext | null;
}
export function readInvoiceStorage(context?: InvoiceStorageContext | null): InvoiceStorageRead {
  const { payloadRaw, ...status } = store.readStorage(context); return { ...status, bookRaw: payloadRaw };
}
export const readInvoiceStorageStatus = store.readStorageStatus;
export const initialiseInvoiceStorage = store.initialiseStorage;
export const recoverInvoiceStorage = store.recoverStorage;
export const captureInvoiceStorageLease = store.captureStorageLease;
export const invoiceStorageLeaseMatches = store.storageLeaseMatches;
export const releaseAllDocumentInvoiceLeases = store.releaseAllDocumentLeases;
export const writeInvoiceStorageRaw = store.writeStorageRaw;
export const readInvoiceLegacyReview = store.readLegacyReview;
export const invoiceLegacyReviewIsCurrent = store.legacyReviewIsCurrent;
export function exportInvoiceLegacyReview(review: object, context?: InvoiceStorageContext | null): { filename: 'invoice-copies.json'; json: string } | null {
  const exported = store.exportLegacyReview(review, context); return exported && { ...exported, filename: 'invoice-copies.json' };
}
export const keepCurrentInvoiceAfterLegacyReview = store.keepCurrentAfterLegacyReview;
