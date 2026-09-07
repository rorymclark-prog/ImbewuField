'use client';

import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';

// Keep the camera original in IndexedDB: a resized thumbnail can make a till total
// unreadable, and base64 photographs quickly exhaust localStorage on a shared phone.
export const EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const EXPENSE_RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp';
export const EXPENSE_RECEIPT_CHANGED = 'imbewu-expense-receipt-changed';
const DATABASE = 'imbewu-expense-receipts';
const STORE = 'receipts';

export interface ExpenseReceipt {
  original: Blob;
  name: string;
  savedAt: string;
  revision: string;
}

interface ReceiptRecord {
  committed?: ExpenseReceipt;
  committedSequence: number;
  nextSequence: number;
  pending: Record<string, { receipt: ExpenseReceipt; sequence: number }>;
}

function receiptRecord(value: unknown): ReceiptRecord {
  if (value && typeof value === 'object' && 'pending' in value) return value as ReceiptRecord;
  const original = value as ExpenseReceipt | undefined;
  return { committed: original?.original instanceof Blob ? original : undefined, committedSequence: 0, nextSequence: 1, pending: {} };
}

function visibleReceipt(record: ReceiptRecord): ExpenseReceipt | undefined {
  const latest = Object.values(record.pending).sort((a, b) => b.sequence - a.sequence)[0];
  return latest && latest.sequence > record.committedSequence ? latest.receipt : record.committed;
}

const sampleReceipts = new Map<string, ReceiptRecord>();
let sampleSession = 0;
let observedWindow: Window | undefined;

/** Capture before reading a file or awaiting a save, never after it finishes. */
export function expenseReceiptScope(): string | null {
  if (typeof window === 'undefined') return null;
  if (observedWindow !== window && typeof window.addEventListener === 'function') {
    observedWindow = window;
    window.addEventListener('imbewu-sample-mode-changed', () => {
      sampleReceipts.clear();
      sampleSession += 1;
    });
  }
  try {
    if (window.sessionStorage.getItem('imbewu_sample_mode') === '1') return `sample:${sampleSession}`;
    // A real receipt must not land in an owner-unknown guest namespace.
    if (!activeAccountUid()) return null;
    return activeAccountLocalStorageKey(DATABASE);
  } catch { return null; }
}

export function receiptScopeIsCurrent(scope: string | null): scope is string {
  return scope !== null && expenseReceiptScope() === scope;
}

function requireCurrentScope(scope: string | null): asserts scope is string {
  if (!receiptScopeIsCurrent(scope)) throw new Error('Your account or workspace changed. Reopen this cost before saving its receipt.');
}

function receiptKey(scope: string, expenseId: string): string {
  if (!expenseId) throw new Error('Save the receipt with an expense.');
  return `${scope}::expense::${encodeURIComponent(expenseId)}`;
}

export async function validateExpenseReceipt(file: Blob): Promise<void> {
  if (!file.size || file.size > EXPENSE_RECEIPT_MAX_BYTES || !EXPENSE_RECEIPT_ACCEPT.split(',').includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP photo up to 10 MB. Keep the original readable.');
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const header = String.fromCharCode(...bytes);
  const valid = file.type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png' ? bytes[0] === 0x89 && header.slice(1, 8) === 'PNG\r\n\x1a\n'
    : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
  if (!valid) throw new Error('This file is not a readable JPG, PNG or WebP photo. Choose another image.');
}

function storageError(): Error {
  return new Error('The receipt could not be saved on this device. Storage may be full or unavailable. Keep the original photo and try again.');
}

async function receiptStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let opening: IDBOpenDBRequest;
    let settled = false;
    const fail = () => { settled = true; reject(storageError()); };
    try { opening = indexedDB.open(DATABASE, 1); } catch { fail(); return; }
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = fail;
    opening.onblocked = fail;
    opening.onsuccess = () => {
      const db = opening.result;
      if (settled) { db.close(); return; }
      try {
        const transaction = db.transaction(STORE, mode);
        let value: T;
        transaction.oncomplete = () => { db.close(); resolve(value); };
        transaction.onerror = transaction.onabort = () => { db.close(); fail(); };
        run(transaction.objectStore(STORE), result => { value = result; });
      } catch { db.close(); fail(); }
    };
  });
}

function announceChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EXPENSE_RECEIPT_CHANGED));
}

export async function loadExpenseReceipt(scope: string | null, expenseId: string): Promise<ExpenseReceipt | null> {
  if (!receiptScopeIsCurrent(scope)) return null;
  const key = receiptKey(scope, expenseId);
  const stored: unknown = scope.startsWith('sample:') ? sampleReceipts.get(key)
    : await receiptStore('readonly', (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => result(request.result);
    });
  if (!receiptScopeIsCurrent(scope)) return null;
  const receipt = visibleReceipt(receiptRecord(stored));
  return receipt?.original instanceof Blob ? receipt : null;
}

interface ReceiptChange { scope: string; key: string; revision: string }

async function stageReceipt(scope: string, expenseId: string, file: File): Promise<ReceiptChange> {
  await validateExpenseReceipt(file);
  requireCurrentScope(scope);
  const key = receiptKey(scope, expenseId);
  const receipt: ExpenseReceipt = { original: file, name: file.name, savedAt: new Date().toISOString(), revision: crypto.randomUUID() };
  const stage = (value: unknown): ReceiptRecord => {
    const record = receiptRecord(value);
    record.pending[receipt.revision] = { receipt, sequence: record.nextSequence++ };
    return record;
  };
  if (scope.startsWith('sample:')) sampleReceipts.set(key, stage(sampleReceipts.get(key)));
  else await receiptStore<void>('readwrite', (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => {
        store.put(stage(request.result), key);
        result();
      };
    });
  return { scope, key, revision: receipt.revision };
}

async function settleReceipt(change: ReceiptChange, saved: boolean): Promise<void> {
  // Keep the committed original separate from in-flight edits. With one "previous"
  // snapshot, two failed edits restore the first failed photo instead of the original.
  // Each atomic transaction settles only its own revision, including across tabs.
  const settle = (value: unknown): ReceiptRecord | null => {
    const record = receiptRecord(value);
    const pending = record.pending[change.revision];
    if (pending && saved && pending.sequence > record.committedSequence) {
      record.committed = pending.receipt;
      record.committedSequence = pending.sequence;
    }
    delete record.pending[change.revision];
    return record.committed || Object.keys(record.pending).length ? record : null;
  };
  if (change.scope.startsWith('sample:')) {
    const record = settle(sampleReceipts.get(change.key));
    if (record) sampleReceipts.set(change.key, record);
    else sampleReceipts.delete(change.key);
  } else {
    await receiptStore<void>('readwrite', (store, result) => {
      const request = store.get(change.key);
      request.onsuccess = () => {
        const record = settle(request.result);
        if (record) store.put(record, change.key);
        else store.delete(change.key);
        result();
      };
    });
  }
}

/**
 * Attach first so storage failure cannot silently save a cost without its photo.
 * A queued Firestore write still owns its receipt; a rejected write rolls it back.
 * Selecting or cancelling a photograph never calls this function and writes nothing.
 */
export async function saveExpenseWithReceipt(options: {
  scope: string | null;
  expenseId: string;
  photo: File | null;
  saveExpense: () => Promise<void>;
  isQueuedWrite: (error: unknown) => boolean;
}): Promise<void> {
  requireCurrentScope(options.scope);
  const change = options.photo ? await stageReceipt(options.scope, options.expenseId, options.photo) : null;
  try {
    requireCurrentScope(options.scope);
    await options.saveExpense();
  } catch (error) {
    if (change) {
      await settleReceipt(change, options.isQueuedWrite(error));
      announceChange();
    }
    throw error;
  }
  if (change) {
    try { await settleReceipt(change, true); }
    catch { throw new Error('The cost was saved, but its receipt could not be confirmed on this device. Keep the photo and retry this cost.'); }
    announceChange();
  }
}

export async function removeExpenseReceipt(scope: string | null, expenseId: string): Promise<void> {
  requireCurrentScope(scope);
  const key = receiptKey(scope, expenseId);
  if (scope.startsWith('sample:')) sampleReceipts.delete(key);
  else await receiptStore<void>('readwrite', (store, result) => {
    const request = store.delete(key);
    request.onsuccess = () => result();
  });
  announceChange();
}
