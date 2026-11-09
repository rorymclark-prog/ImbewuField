import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedLocalStorage, type ProtectedStorageContext } from '../lib/protected-local-storage';
import * as invoices from '../lib/invoice-storage';

class MemoryStorage {
  rows = new Map<string, string>(); reads = 0; writes = 0; removes = 0;
  onRead: ((key: string) => void) | null = null;
  getItem(key: string) { this.reads++; const raw = this.rows.get(key) ?? null; this.onRead?.(key); return raw; }
  setItem(key: string, raw: string) { this.writes++; this.rows.set(key, raw); }
  removeItem(key: string) { this.removes++; this.rows.delete(key); }
}
const adapter = () => createProtectedLocalStorage({ legacyBaseKeys: ['old'], canonicalBaseKey: 'new', receiptBaseKey: 'proof',
  eventName: 'read-receipt-test', lockPrefix: 'read-receipt-test:', changedReason: 'changed', payloadField: 'rowsRaw',
  importedField: 'importedRowsRaw', reviewedField: 'reviewedRowsRaw', exportFilename: 'copies.json',
  exportFields: { current: 'current', older: 'older', initial: 'initial' },
  validatePayload(raw) { try { return Array.isArray(JSON.parse(raw)); } catch { return false; } },
  importLegacy(raw) { try { return raw !== null && Array.isArray(JSON.parse(raw)) ? raw : null; } catch { return null; } },
  legacyIsEmpty: raw => raw === null || raw === '[]', countRows: () => null });
function context(storage = new MemoryStorage(), isCurrent = () => true): ProtectedStorageContext {
  return { storage, legacyKey: 'old::owner', canonicalKey: 'new::owner', receiptKey: 'proof::owner', isCurrent };
}

test('an opaque repeated read receipt uses the original context without a browser, write lease or initialization', () => {
  const store = adapter(), local = new MemoryStorage(), c = context(local);
  local.rows.set(c.legacyKey, ' [] ');
  const receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
  assert.equal(Object.isFrozen(receipt), true); assert.deepEqual(Object.keys(receipt), []);
  assert.equal(JSON.stringify(receipt), '{}');
  assert.equal(store.storageReadReceiptMatches(receipt), true);
  assert.equal(store.storageReadReceiptMatches(receipt, c), true);
  assert.equal(local.writes, 0); assert.equal(local.removes, 0);
  assert.equal(local.rows.has(c.canonicalKey), false); assert.equal(local.rows.has(c.receiptKey), false);
});

test('each protected byte address permanently withdraws an old receipt even when its bytes are restored', () => {
  for (const address of ['legacyKey', 'canonicalKey', 'receiptKey'] as const) {
    const store = adapter(), c = context(), local = c.storage as MemoryStorage;
    local.rows.set(c.legacyKey, '[]');
    const receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
    const before = local.rows.get(c[address]); local.rows.set(c[address], 'changed bytes');
    assert.equal(store.storageReadReceiptMatches(receipt, c), false);
    if (before === undefined) local.rows.delete(c[address]); else local.rows.set(c[address], before);
    assert.equal(store.storageReadReceiptMatches(receipt, c), false);
    assert.equal(local.writes, 0); assert.equal(local.removes, 0);
  }
});

test('forged handles and released receipts cannot acquire evidence or trigger storage access', () => {
  const store = adapter(), c = context(), local = c.storage as MemoryStorage;
  const receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
  const reads = local.reads;
  assert.equal(store.storageReadReceiptMatches({}), false);
  assert.equal(store.storageReadReceiptMatches({ ...receipt }, c), false);
  assert.equal(local.reads, reads);
  store.releaseStorageReadReceipt(receipt);
  assert.equal(store.storageReadReceiptMatches(receipt), false); assert.equal(local.reads, reads);
});

test('a wrong source context or mutation of its captured addresses cannot rebind identical raw bytes', () => {
  for (const kind of ['other-storage', 'other-key', 'mutated-original'] as const) {
    const store = adapter(), c = context(), receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
    const next = kind === 'other-storage' ? context() : { ...c, canonicalKey: 'other-empty-key' };
    if (kind === 'mutated-original') c.canonicalKey = next.canonicalKey;
    assert.equal(store.storageReadReceiptMatches(receipt, kind === 'mutated-original' ? undefined : next), false);
    assert.equal(store.storageReadReceiptMatches(receipt, c), false);
  }
});

test('the captured current predicate and capture-time changes fail closed without adopting a replacement context', () => {
  const store = adapter(), local = new MemoryStorage(); let current = true;
  const c = context(local, () => current), receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
  current = false;
  assert.equal(store.storageReadReceiptMatches(receipt), false);
  current = true; assert.equal(store.storageReadReceiptMatches(receipt), false);
  let first = true;
  local.onRead = key => { if (first && key === c.canonicalKey) { first = false; local.rows.set(c.canonicalKey, 'changed during capture'); } };
  assert.equal(store.captureStorageReadReceipt(c), null);
  assert.equal(local.writes, 0); assert.equal(local.removes, 0);
});

test('a byte receipt is not a readability or mutation grant for corrupt data', () => {
  const store = adapter(), c = context(), local = c.storage as MemoryStorage;
  local.rows.set(c.legacyKey, 'not JSON');
  const receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
  assert.equal(store.storageReadReceiptMatches(receipt, c), true);
  assert.equal(store.readStorage(c).reason, 'legacy-unreadable');
  assert.equal(store.writeStorageRaw('[]', receipt as unknown as string, c).status, 'held');
  assert.equal(local.writes, 0); assert.equal(local.removes, 0);
});

test('release during an actual source read cannot finish by revalidating the released receipt', () => {
  const store = adapter(), c = context(), local = c.storage as MemoryStorage;
  const receipt = store.captureStorageReadReceipt(c); assert.ok(receipt);
  local.onRead = () => store.releaseStorageReadReceipt(receipt);
  assert.equal(store.storageReadReceiptMatches(receipt, c), false);
  local.onRead = null; assert.equal(store.storageReadReceiptMatches(receipt, c), false);
});

test('the actual invoice adapter binds all three legacy addresses plus canonical and receipt bytes', () => {
  for (const address of ['saved', 'pending', 'sequence', 'canonical', 'receipt']) {
    const local = new MemoryStorage();
    const c: invoices.InvoiceStorageContext = { storage: local, legacyKey: 'saved', legacyKeys: ['saved', 'pending', 'sequence'],
      canonicalKey: 'canonical', receiptKey: 'receipt', isCurrent: () => true };
    local.rows.set('saved', ' [] '); local.rows.set('pending', '[]'); local.rows.set('sequence', '0044');
    const receipt = invoices.captureInvoiceReadReceipt(c); assert.ok(receipt);
    assert.equal(invoices.invoiceReadReceiptMatches(receipt), true);
    local.rows.set(address, address === 'sequence' ? '0045' : 'different exact bytes');
    assert.equal(invoices.invoiceReadReceiptMatches(receipt, c), false);
    assert.equal(local.writes, 0); assert.equal(local.removes, 0);
  }
});
