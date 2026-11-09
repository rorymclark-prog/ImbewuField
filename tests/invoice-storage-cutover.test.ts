import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../lib/invoice-storage.ts';
import type { InvoiceStorageContext, InvoiceStorageLocks, InvoiceStoragePayload } from '../lib/invoice-storage.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = []; removes: string[] = [];
  beforeSet: ((key: string) => void) | null = null; afterSet: ((key: string) => void) | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) { this.beforeSet?.(key); this.rows.set(key, raw); this.writes.push(key); this.afterSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); this.removes.push(key); }
}
class Locks implements InvoiceStorageLocks {
  held = new Set<string>(); pause: (() => Promise<void>) | null = null;
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await this.pause?.(); if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const modules = [store]; let moduleId = 0;
async function another() { const module: typeof store = await import(new URL(`../lib/invoice-storage.ts?document=${++moduleId}`, import.meta.url).href); modules.push(module); return module; }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function context(local = new MemoryStorage(), current = () => true): InvoiceStorageContext {
  return { storage: local, legacyKey: 'saved::a', legacyKeys: ['saved::a', 'pending::a', 'sequence::a'], canonicalKey: 'book::a', receiptKey: 'proof::a', isCurrent: current };
}
const authored = ' [null,{"id":"invoice-a","currencyCode":"CAD","future":{"keep":true}},{"id":"invoice-a"}] ';
const staged = ' [{"id":"pending-a","sourceSaleId":"sale-a","future":2}] ';
function payload(c: InvoiceStorageContext): InvoiceStoragePayload { const raw = store.readInvoiceStorage(c).bookRaw; assert.ok(raw); const result = store.parseInvoiceStoragePayload(raw); assert.ok(result); return result; }
function token(c: InvoiceStorageContext) { const value = store.readInvoiceStorage(c).token; assert.ok(value); return value; }
afterEach(async () => { for (const module of modules) module.releaseAllDocumentInvoiceLeases(); await tick(); });

test('one invoice cutover retains all three exact legacy strings, malformed rows and retired sources', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  local.rows.set(c.legacyKeys[0], authored); local.rows.set(c.legacyKeys[1], staged); local.rows.set(c.legacyKeys[2], '0047');
  assert.equal(store.readInvoiceStorage(c).reason, 'upgrade-required');
  assert.deepEqual(payload(c), { version: 1, invoicesRaw: authored, pendingLinksRaw: staged, sequenceRaw: '0047' });
  assert.equal((await store.initialiseInvoiceStorage(c, locks)).writable, true);
  assert.deepEqual(payload(c), { version: 1, invoicesRaw: authored, pendingLinksRaw: staged, sequenceRaw: '0047' });
  const receipt = JSON.parse(local.getItem(c.receiptKey)!);
  assert.equal(receipt.legacyBytes, JSON.stringify({ invoicesRaw: authored, pendingLinksRaw: staged, sequenceRaw: '0047' }));
  assert.equal(receipt.importedBookRaw, store.readInvoiceStorage(c).bookRaw);
  assert.deepEqual(local.writes, [c.receiptKey, c.canonicalKey]); assert.deepEqual(local.removes, []);
  assert.equal(local.getItem(c.legacyKeys[0]), authored); assert.equal(local.getItem(c.legacyKeys[1]), staged); assert.equal(local.getItem(c.legacyKeys[2]), '0047');
});

test('complete absence is distinct from explicit empty legacy stores and never claims unknown guest rows', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  local.rows.set(store.INVOICE_LEGACY_KEY, '[{"id":"unknown-owner"}]');
  await store.initialiseInvoiceStorage(c, locks);
  assert.deepEqual(payload(c), { version: 1, invoicesRaw: '[]', pendingLinksRaw: '[]', sequenceRaw: null });
  assert.equal(JSON.parse(local.getItem(c.receiptKey)!).legacyBytes, null);
  assert.equal(local.getItem(store.INVOICE_LEGACY_KEY), '[{"id":"unknown-owner"}]');
  assert.equal('transferInvoiceStoragePair' in store, false);
});

for (const index of [0, 1, 2] as const) test(`an old client changing legacy address ${index + 1} holds the whole book without overwriting canonical data`, async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await store.initialiseInvoiceStorage(c, locks);
  const before = local.getItem(c.canonicalKey), receipt = local.getItem(c.receiptKey), oldToken = token(c);
  local.rows.set(c.legacyKeys[index], index === 2 ? '45' : '[]');
  assert.equal(store.readInvoiceStorage(c).reason, 'legacy-diverged');
  assert.equal(store.captureInvoiceStorageLease(c), null);
  assert.equal(store.writeInvoiceStorageRaw(JSON.stringify({ version: 1, invoicesRaw: authored, pendingLinksRaw: '[]', sequenceRaw: '45' }), oldToken, c).status, 'held');
  assert.equal(local.getItem(c.canonicalKey), before); assert.equal(local.getItem(c.receiptKey), receipt);
});

test('a performed invoice write has an exact receipt while stale raw tokens and wrong legacy-address lists cannot write', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await store.initialiseInvoiceStorage(c, locks);
  const before = token(c), next = JSON.stringify({ version: 1, invoicesRaw: authored, pendingLinksRaw: staged, sequenceRaw: '48' });
  const written = store.writeInvoiceStorageRaw(next, before, c); assert.equal(written.status, 'written');
  if (written.status !== 'written') throw Error('Expected write');
  assert.equal(written.token, token(c)); assert.equal(store.readInvoiceStorage(c).bookRaw, next);
  assert.equal(store.writeInvoiceStorageRaw(next, before, c).status, 'held');
  assert.equal(store.writeInvoiceStorageRaw(next, token(c), { ...c, legacyKeys: [c.legacyKey, 'other', c.legacyKeys[2]] }).status, 'held');
  assert.equal(store.writeInvoiceStorageRaw(next, token(c), c, () => false).status, 'held');
});

test('receipt-first quota recovery uses the frozen three-store import and cannot adopt a changed sequence', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored);
  local.beforeSet = key => { if (key === c.canonicalKey) throw Error('Quota'); };
  assert.equal((await store.initialiseInvoiceStorage(c, locks)).reason, 'cutover-recovery-required');
  const receipt = local.getItem(c.receiptKey); assert.ok(receipt); assert.equal(local.getItem(c.canonicalKey), null);
  local.beforeSet = null; local.rows.set(c.legacyKeys[2], '99'); await store.recoverInvoiceStorage(c, locks);
  assert.equal(local.getItem(c.canonicalKey), null);
  local.rows.delete(c.legacyKeys[2]); await store.recoverInvoiceStorage(c, locks);
  assert.equal(payload(c).invoicesRaw, authored); assert.equal(local.getItem(c.receiptKey), receipt);
});

test('unconfirmed effects release the lease and remain held until explicit exact recovery', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await store.initialiseInvoiceStorage(c, locks);
  const raw = JSON.stringify({ version: 1, invoicesRaw: authored, pendingLinksRaw: '[]', sequenceRaw: null });
  local.afterSet = key => { if (key === c.canonicalKey) throw Error('After effect'); };
  assert.equal(store.writeInvoiceStorageRaw(raw, token(c), c).status, 'unconfirmed');
  local.afterSet = null; assert.equal(store.readInvoiceStorage(c).reason, 'write-unconfirmed');
  assert.equal((await store.initialiseInvoiceStorage({ ...c }, locks)).reason, 'write-unconfirmed');
  await tick(); await store.recoverInvoiceStorage(c, locks); await store.initialiseInvoiceStorage(c, locks);
  assert.equal(store.readInvoiceStorage(c).writable, true); assert.equal(store.readInvoiceStorage(c).bookRaw, raw);
});

test('divergence review exports exact current, older and initial composite evidence and only explicit current-review keep acknowledges it', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored); await store.initialiseInvoiceStorage(c, locks);
  const current = store.readInvoiceStorage(c).bookRaw; local.rows.set(c.legacyKeys[2], '88');
  const review = store.readInvoiceLegacyReview(c); assert.ok(review);
  const exported = store.exportInvoiceLegacyReview(review.review, c); assert.ok(exported); assert.equal(exported.filename, 'invoice-copies.json');
  const evidence = JSON.parse(exported.json); assert.equal(evidence.canonicalInvoiceBookRaw, current); assert.equal(evidence.initialImportInvoiceBookRaw, current);
  assert.deepEqual(JSON.parse(evidence.olderInvoiceBookRaw), { invoicesRaw: authored, pendingLinksRaw: null, sequenceRaw: '88' });
  const before = local.getItem(c.canonicalKey);
  assert.equal((await store.keepCurrentInvoiceAfterLegacyReview(review.review, c, locks, () => false)).status, 'held');
  assert.equal(local.getItem(c.canonicalKey), before);
  assert.equal((await store.keepCurrentInvoiceAfterLegacyReview(review.review, c, locks, () => true)).status, 'kept');
  assert.equal(store.readInvoiceStorage(c).bookRaw, current); assert.equal(local.getItem(c.legacyKeys[2]), '88');
  assert.equal(store.invoiceLegacyReviewIsCurrent(review.review, c), false);
});

test('separate loaded adapters contend for one browser lock and cannot borrow each other’s token', async () => {
  const other = await another(), local = new MemoryStorage(), c = context(local), locks = new Locks(); await store.initialiseInvoiceStorage(c, locks);
  assert.equal((await other.initialiseInvoiceStorage(c, locks)).reason, 'another-writer');
  assert.equal(other.writeInvoiceStorageRaw(JSON.stringify(payload(c)), token(c), c).status, 'held');
  store.releaseAllDocumentInvoiceLeases(); await tick(); assert.equal((await other.initialiseInvoiceStorage(c, locks)).writable, true);
});

test('sample and withdrawn actor contexts never install canonical invoice data', async () => {
  const local = new MemoryStorage(), locks = new Locks(), c = context(local, () => false);
  assert.equal((await store.initialiseInvoiceStorage(c, locks)).writable, false);
  assert.equal((await store.initialiseInvoiceStorage({ ...c, isCurrent: () => true, sample: true }, locks)).status, 'sample');
  assert.deepEqual(local.writes, []);
});

test('a malformed saved or pending envelope is held instead of replaced with an empty imported list', async () => {
  for (const index of [0, 1] as const) for (const raw of ['{broken', 'null', '{}']) {
    const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKeys[index], raw);
    assert.equal((await store.initialiseInvoiceStorage(c, locks)).reason, 'legacy-unreadable');
    assert.deepEqual(local.writes, []); assert.equal(local.getItem(c.legacyKeys[index]), raw);
  }
});
