import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedLocalStorage, type ProtectedStorageContext, type ProtectedStorageLocks } from '../lib/protected-local-storage.ts';
import * as journal from '../lib/journal-storage.ts';
import { detachJsonData, rawJsonIsLossless } from '../lib/lossless-json.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) { this.writes.push(key); this.rows.set(key, raw); }
  removeItem(key: string) { this.rows.delete(key); }
}
class Locks implements ProtectedStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
function context(storage = new MemoryStorage()): ProtectedStorageContext {
  return { storage, legacyKey: 'old', canonicalKey: 'new', receiptKey: 'proof', isCurrent: () => true };
}
function factory() {
  return createProtectedLocalStorage({ legacyBaseKeys: ['old'], canonicalBaseKey: 'new', receiptBaseKey: 'proof',
    eventName: 'test-protected-store', lockPrefix: 'test-protected:', changedReason: 'source-changed',
    payloadField: 'authoredRaw', importedField: 'importedRaw', reviewedField: 'reviewedRaw', exportFilename: 'copies.json',
    exportFields: { current: 'current', older: 'older', initial: 'initial' },
    validatePayload: raw => { try { return Array.isArray(JSON.parse(raw)); } catch { return false; } },
    importLegacy: raw => raw ?? '[]', legacyIsEmpty: raw => raw === null || raw === '[]',
    countRows: raw => raw === null ? null : JSON.parse(raw).length });
}
const stores: ReturnType<typeof factory>[] = [];
afterEach(async () => { for (const store of stores.splice(0)) store.releaseAllDocumentLeases(); journal.releaseAllDocumentJournalLeases(); await Promise.resolve(); });
const make = () => { const store = factory(); stores.push(store); return store; };

test('the shared protocol adapts physical field names without creating a second active copy', async () => {
  const store = make(), local = new MemoryStorage(), c = context(local), locks = new Locks();
  const raw = ' [null, {"id":"old","future":{"keep":true}}] '; local.rows.set('old', raw);
  assert.equal((await store.initialiseStorage(c, locks)).writable, true);
  const envelope = JSON.parse(local.getItem('new')!), receipt = JSON.parse(local.getItem('proof')!);
  assert.deepEqual(Object.keys(envelope), ['storageVersion', 'cutoverId', 'authoredRaw']);
  assert.deepEqual(Object.keys(receipt), ['receiptVersion', 'canonicalKey', 'cutoverId', 'legacyBytes', 'importedRaw']);
  assert.equal(envelope.authoredRaw, raw); assert.equal(receipt.importedRaw, raw); assert.equal(receipt.legacyBytes, raw);
  assert.deepEqual(local.writes, ['proof', 'new']); assert.equal(local.getItem('old'), raw);
  const before = store.readStorage(c), result = store.writeStorageRaw('[{"id":"new"}]', before.token, c);
  assert.equal(result.status, 'written'); assert.equal(local.getItem('old'), raw);
  assert.equal(store.writeStorageRaw('[]', before.token, c).status, 'held');
});

test('factory instances have separate private proofs but contend through the actual supplied exclusive lock', async () => {
  const a = make(), b = make(), local = new MemoryStorage(), c = context(local), locks = new Locks();
  await a.initialiseStorage(c, locks);
  assert.equal((await b.initialiseStorage(c, locks)).reason, 'another-writer');
  const proof = a.captureStorageLease(c); assert.ok(proof);
  assert.equal(b.storageLeaseMatches(proof, c), false);
  assert.equal(b.writeStorageRaw('[]', a.readStorage(c).token, c).status, 'held');
  // Releasing resolves the callback's retained-lock promise. The supplied
  // LockManager drops its own lock only after that callback has returned.
  a.releaseAllDocumentLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal((await b.initialiseStorage(c, locks)).writable, true);
});

test('journal adaptation retains existing envelope, receipt and acknowledgement bytes and export names', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(), raw = ' [ {"id":"note","link":{"future":1}} ] ';
  local.rows.set(c.legacyKey, raw); await journal.initialiseJournalStorage(c, locks);
  const envelope = JSON.parse(local.getItem(c.canonicalKey)!), receipt = JSON.parse(local.getItem(c.receiptKey)!);
  assert.equal(local.getItem(c.canonicalKey), JSON.stringify({ storageVersion: 2, cutoverId: envelope.cutoverId, journalRaw: raw }));
  assert.equal(local.getItem(c.receiptKey), JSON.stringify({ receiptVersion: 1, canonicalKey: c.canonicalKey, cutoverId: envelope.cutoverId, legacyBytes: raw, importedJournalRaw: raw }));
  assert.deepEqual(journal.readJournalStorage(c).journalRaw, raw);
  local.rows.set(c.legacyKey, raw + ' ');
  const review = journal.readJournalLegacyReview(c); assert.ok(review);
  const exported = journal.exportJournalLegacyReview(review.review, c); assert.ok(exported);
  assert.equal(exported.filename, 'journal-copies.json');
  assert.deepEqual(JSON.parse(exported.json), { exportVersion: 1, canonicalJournalRaw: raw, olderJournalRaw: raw + ' ', initialImportJournalRaw: raw });
  assert.equal((await journal.keepCurrentJournalAfterLegacyReview(review.review, c, locks)).status, 'kept');
  const kept = JSON.parse(local.getItem(c.canonicalKey)!);
  assert.equal(local.getItem(c.canonicalKey), JSON.stringify({ ...envelope, legacyAcknowledgement: {
    legacyBytes: raw + ' ', reviewedJournalRaw: raw, acknowledgementId: kept.legacyAcknowledgement.acknowledgementId } }));
  assert.equal(local.getItem(c.receiptKey), JSON.stringify(receipt));
});

test('descriptor detachment preserves JSON data and rejects executable or ambiguous caller values without getter calls', () => {
  let calls = 0;
  const getter = Object.defineProperty({}, 'note', { enumerable: true, get() { calls++; return 'hidden'; } });
  for (const value of [getter, { toJSON() { calls++; return {}; } }, [undefined], [, 1], new Date(), { value: Infinity }]) {
    assert.throws(() => detachJsonData(value));
  }
  assert.equal(calls, 0);
  const input = JSON.parse('{"__proto__":{"retained":1},"nested":[null,"é",0]}');
  const cloned = detachJsonData(input); assert.deepEqual(cloned, input); assert.notEqual(cloned, input);
  assert.deepEqual(detachJsonData({ missing: undefined, keep: 1 }, { allowUndefinedObjectFields: true }), { keep: 1 });
  assert.throws(() => detachJsonData({ missing: undefined }));
});

test('raw JSON admission rejects duplicate keys and rounded numeric evidence instead of blessing parse-normalized values', () => {
  for (const raw of ['{"id":"a","id":"b"}', '{"a":1,"\\u0061":2}', '[9007199254740993]', '[-0]', '[1e999]', '[0.10000000000000001]']) {
    assert.equal(rawJsonIsLossless(raw), false, raw);
  }
  for (const raw of [' [null,{"notes":"a,b:{}"}] ', '[0.1,1.200,1e3]', '{"a":{"a":1},"b":{"a":2}}']) assert.equal(rawJsonIsLossless(raw), true, raw);
});
