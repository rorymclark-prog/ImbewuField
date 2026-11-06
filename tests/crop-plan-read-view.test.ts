import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { account, crop, samples, local, probe, events, reset, cleanup } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import * as storage from '../lib/crop-plan-storage.ts';
import type { RawCropPlanReadView } from '../lib/crop-plan-read-view.ts';
import type { CropPlanStorageContext, CropPlanStorageLocks } from '../lib/crop-plan-storage.ts';

// The fixture installs its real-actor boundary during evaluation. An eager
// runtime import would bind Firebase before that boundary exists.
const { readRawCropPlanReadView, rawCropPlanReadViewIsCurrent, releaseRawCropPlanReadView }
  = await import('../lib/crop-plan-read-view.ts');

class MemoryStorage {
  rows = new Map<string, string>(); reads = 0; writes = 0; removes = 0; fail = false;
  onRead: ((key: string) => void) | null = null;
  onSet: ((key: string) => void) | null = null;
  getItem(key: string) { if (this.fail) throw Error('synthetic unreadable source'); this.reads++; const value = this.rows.get(key) ?? null; this.onRead?.(key); return value; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, value); this.onSet?.(key); }
  removeItem(key: string) { this.removes++; this.rows.delete(key); }
}
class Locks implements CropPlanStorageLocks {
  held = new Set<string>(); requests = 0;
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    this.requests++; await Promise.resolve();
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
let contextIndex = 0, documentIndex = 0;
const modules: (typeof storage)[] = [storage];
const retained = new Set<RawCropPlanReadView>();
const empty = '{"version":1,"plantings":[],"productionRecords":[],"updatedAt":1}';
const book = (quantity = 3) => JSON.stringify({ version: 1, plantings: [], updatedAt: 1, productionRecords: [
  { id: 'read-source', siteId: 'site:0.00000,0.00000', sourceIconKey: 'crop:cabbage', label: 'Recorded fixture',
    date: { year: 2026, month: 1 }, quantity, unit: 'kg', status: 'actual', provenance: 'farm-record' },
] });
function context(memory = new MemoryStorage(), owner = `source-${++contextIndex}`, current = () => true): CropPlanStorageContext {
  return { storage: memory, canonicalKey: `canonical:${owner}`, receiptKey: `cutover:${owner}`, legacyKey: `legacy:${owner}`, isCurrent: current };
}
async function canonical(c: CropPlanStorageContext, locks = new Locks(), writer: typeof storage = storage) {
  (c.storage as MemoryStorage).rows.set(c.legacyKey, empty);
  assert.equal((await writer.initialiseCropPlanStorage(c, locks)).writable, true);
  return locks;
}
function read() { const view = readRawCropPlanReadView(); retained.add(view); return view; }
beforeEach(async () => {
  for (const view of retained) releaseRawCropPlanReadView(view); retained.clear();
  for (const module of modules) module.releaseAllDocumentCropPlanLeases();
  await reset(); replaceCanonicalCropPlanFixtureRaw(book()); crop.releaseAllDocumentCropPlanLeases();
});
after(() => {
  for (const view of retained) releaseRawCropPlanReadView(view);
  for (const module of modules) module.releaseAllDocumentCropPlanLeases();
  cleanup();
});

test('canonical storage can be read after releasing the editing lease without acquiring another or changing bytes', async () => {
  const memory = new MemoryStorage(), c = context(memory), locks = await canonical(c);
  storage.releaseAllDocumentCropPlanLeases();
  assert.equal(storage.readCropPlanStorage(c).reason, 'writer-not-acquired');
  const bytes = new Map(memory.rows), writes = memory.writes, requests = locks.requests;
  const view = storage.readCropPlanStorageView(c); assert.equal(view.status, 'ready');
  if (view.status !== 'ready') return;
  assert.equal(view.bookRaw, empty); assert.equal(Object.isFrozen(view.receipt), true);
  assert.deepEqual(Object.keys(view.receipt), []); assert.equal(JSON.stringify(view.receipt), '{}');
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(view.receipt, c), true);
  assert.equal(storage.readCropPlanStorage(c).writable, false);
  assert.equal(storage.captureCropPlanStorageLease(c), null);
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false);
  assert.deepEqual(memory.rows, bytes); assert.equal(memory.writes, writes); assert.equal(locks.requests, requests);
});

test('another actual document may own the writer while this document reads the proven source without initialization', async () => {
  const other: typeof storage = await import(new URL(`../lib/crop-plan-storage.ts?read-document=${++documentIndex}`, import.meta.url).href);
  modules.push(other);
  const memory = new MemoryStorage(), c = context(memory), locks = await canonical(c, new Locks(), other);
  const writes = memory.writes, requests = locks.requests, bytes = new Map(memory.rows);
  assert.equal(storage.readCropPlanStorage(c).reason, 'writer-not-acquired');
  assert.equal(other.readCropPlanStorage(c).writable, true);
  const view = storage.readCropPlanStorageView(c); assert.equal(view.status, 'ready');
  assert.equal(storage.readCropPlanStorage(c).writable, false);
  assert.equal(memory.writes, writes); assert.equal(locks.requests, requests); assert.deepEqual(memory.rows, bytes);
});

test('missing, migration, mismatched-cutover and legacy-diverged sources stay held rather than falling back to legacy data', async () => {
  const memory = new MemoryStorage(), c = context(memory);
  assert.deepEqual(storage.readCropPlanStorageView(c), { status: 'held', reason: 'upgrade-required' });
  memory.rows.set(c.legacyKey, empty);
  assert.deepEqual(storage.readCropPlanStorageView(c), { status: 'held', reason: 'upgrade-required' });
  assert.equal(memory.writes, 0);
  await canonical(c); storage.releaseAllDocumentCropPlanLeases();
  const receipt = memory.rows.get(c.receiptKey)!;
  memory.rows.set(c.receiptKey, '{}');
  assert.deepEqual(storage.readCropPlanStorageView(c), { status: 'held', reason: 'cutover-recovery-required' });
  memory.rows.set(c.receiptKey, receipt); memory.rows.set(c.legacyKey, empty + ' ');
  assert.deepEqual(storage.readCropPlanStorageView(c), { status: 'held', reason: 'legacy-diverged' });
});

test('pending guest transfer and a performed but unconfirmed review remain authoritative holds for readers', async () => {
  const memory = new MemoryStorage(), from = context(memory), to = context(memory);
  memory.rows.set(from.legacyKey, empty);
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks: null,
    sourceLegacyIsEmpty: () => false, targetLegacyIsEmpty: () => true })).status, 'held');
  assert.deepEqual(storage.readCropPlanStorageView(to), { status: 'held', reason: 'guest-transfer-held' });

  const current = context(), owned = current.storage as MemoryStorage, locks = await canonical(current);
  owned.rows.set(current.legacyKey, empty + ' ');
  const review = storage.readCropPlanLegacyReview(current); assert.ok(review);
  owned.onSet = key => { if (key === current.canonicalKey) owned.rows.set(current.legacyKey, empty + '  '); };
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(review.review, current, locks)).status, 'superseded');
  owned.onSet = null; owned.rows.set(current.legacyKey, empty + ' ');
  assert.equal(storage.readCropPlanStorage(current).reason, 'review-write-unconfirmed');
  assert.deepEqual(storage.readCropPlanStorageView(current), { status: 'held', reason: 'review-write-unconfirmed' });
});

test('observed changes to each provenance address permanently retire the original read receipt', async () => {
  for (const address of ['canonicalKey', 'receiptKey', 'legacyKey'] as const) {
    const memory = new MemoryStorage(), c = context(memory); await canonical(c); storage.releaseAllDocumentCropPlanLeases();
    const view = storage.readCropPlanStorageView(c); assert.equal(view.status, 'ready'); if (view.status !== 'ready') continue;
    const bytes = memory.rows.get(c[address])!; memory.rows.set(c[address], 'changed');
    assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(view.receipt, c), false);
    memory.rows.set(c[address], bytes);
    assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(view.receipt, c), false);
  }
});

test('forged, copied, released and wrong-context receipts cannot read or adopt another source', async () => {
  const memory = new MemoryStorage(), c = context(memory); await canonical(c); storage.releaseAllDocumentCropPlanLeases();
  const view = storage.readCropPlanStorageView(c); assert.equal(view.status, 'ready'); if (view.status !== 'ready') return;
  const reads = memory.reads;
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent({}), false);
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent({ ...view.receipt }), false);
  assert.equal(memory.reads, reads);
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(view.receipt, { ...c, canonicalKey: 'another-empty-source' }), false);
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(view.receipt, c), false);
  const next = storage.readCropPlanStorageView(c); assert.equal(next.status, 'ready'); if (next.status !== 'ready') return;
  storage.releaseCropPlanStorageReadReceipt(next.receipt);
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(next.receipt), false);
});

test('changed context, source races and release during validation cannot finish by reviving the receipt', async () => {
  const memory = new MemoryStorage(); let current = true;
  const c = context(memory, undefined, () => current); await canonical(c); storage.releaseAllDocumentCropPlanLeases();
  const first = storage.readCropPlanStorageView(c); assert.equal(first.status, 'ready'); if (first.status !== 'ready') return;
  current = false; assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(first.receipt), false);
  current = true; assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(first.receipt), false);
  const next = storage.readCropPlanStorageView(c); assert.equal(next.status, 'ready'); if (next.status !== 'ready') return;
  memory.onRead = () => storage.releaseCropPlanStorageReadReceipt(next.receipt);
  assert.equal(storage.cropPlanStorageReadReceiptIsCurrent(next.receipt), false);
  memory.onRead = key => { if (key === c.canonicalKey) { memory.onRead = null; memory.rows.set(key, 'raced source'); } };
  assert.equal(storage.readCropPlanStorageView(c).status, 'held');
  memory.onRead = null; memory.fail = true;
  assert.equal(storage.readCropPlanStorageView(c).status, 'held');
});

test('raw personal views read exact unnormalized records without a lease and never become write admission', () => {
  const bytes = new Map(local.rows), writes = local.writes;
  assert.equal(storage.readCropPlanStorage().reason, 'writer-not-acquired');
  const view = read(); assert.equal(view.status, 'ready', view.status === 'held' ? view.reasons.join(', ') : undefined); if (view.status !== 'ready') return;
  assert.equal(view.sample, false); assert.deepEqual(view.raw, JSON.parse(book()));
  assert.equal(Object.isFrozen(view), true); assert.equal(Object.isFrozen(view.raw), true);
  assert.equal(rawCropPlanReadViewIsCurrent(view), true);
  assert.equal(crop.cropPlanWriteToken(), null);
  assert.equal(crop.saveCropPlanWithReceipt({ version: 1, updatedAt: 1, plantings: [] }).saved, false);
  assert.equal(rawCropPlanReadViewIsCurrent({ ...view }), false);
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
});

test('malformed and non-lossless raw books remain stored and held instead of receiving JSON normalization', () => {
  for (const raw of ['{broken', '{"version":1,"plantings":[],"productionRecords":[],"productionRecords":[]}',
    '{"version":1,"plantings":[],"quantity":9007199254740993}', '{"version":1,"plantings":[],"unknown":1e400}',
    '{"version":1,"plantings":[],"unknown":-0}']) {
    replaceCanonicalCropPlanFixtureRaw(raw); const bytes = new Map(local.rows), writes = local.writes;
    assert.equal(read().status, 'held'); assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
  }
});

test('raw personal views require both the mounted owner and actual signed-in Firebase actor before any source read', () => {
  let reads = 0; local.onRead = () => reads++;
  probe.actor = 'owner-b'; assert.equal(read().status, 'held'); assert.equal(reads, 0);
  probe.actor = null; account.bindMountedAccountLocalStorageUid(null);
  assert.equal(read().status, 'held'); assert.equal(reads, 0);
  probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a'); probe.configured = false;
  assert.equal(read().status, 'held'); assert.equal(reads, 0);
});

test('shared actor epochs, explicit release and source events withdraw raw views permanently', () => {
  const view = read(); assert.equal(view.status, 'ready', view.status === 'held' ? view.reasons.join(', ') : undefined);
  for (const next of ['owner-b', 'owner-a']) {
    probe.actor = next; for (const notify of [...probe.auth]) notify({ uid: next });
  }
  assert.equal(rawCropPlanReadViewIsCurrent(view), false);
  const fresh = read(); assert.equal(fresh.status, 'ready', fresh.status === 'held' ? fresh.reasons.join(', ') : undefined);
  releaseRawCropPlanReadView(fresh); assert.equal(rawCropPlanReadViewIsCurrent(fresh), false);
  const eventView = read(); assert.equal(eventView.status, 'ready', eventView.status === 'held' ? eventView.reasons.join(', ') : undefined);
  events.dispatchEvent(new Event(crop.CROP_PLAN_CHANGED_EVENT));
  assert.equal(rawCropPlanReadViewIsCurrent(eventView), false);
});

test('raw view release removes its actor observer and a copied view cannot spend the private receipt', () => {
  const before = probe.auth.size, bytes = new Map(local.rows), writes = local.writes;
  const view = read(); assert.equal(view.status, 'ready', view.status === 'held' ? view.reasons.join(', ') : undefined);
  assert.ok(probe.auth.size > before);
  let reads = 0; local.onRead = () => reads++;
  assert.equal(rawCropPlanReadViewIsCurrent({ ...view }), false); assert.equal(reads, 0);
  releaseRawCropPlanReadView(view);
  assert.equal(rawCropPlanReadViewIsCurrent(view), false); assert.equal(reads, 0);
  assert.equal(probe.auth.size, before); assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
});

test('DEMO delegates its actual sample authority and never exposes the personal canonical source', () => {
  const personal = new Map(local.rows); assert.equal(samples.enterSampleMode(), true);
  samples.setSandboxCropPlan({ version: 1, updatedAt: 1, plantings: [], productionRecords: [] });
  const original = samples.getSandboxCropPlan(), originallyFrozen = Object.isFrozen(original);
  const originalBytes = JSON.stringify(original), view = read(); assert.equal(view.status, 'ready');
  if (view.status !== 'ready') return;
  assert.equal(view.sample, true); assert.deepEqual(view.raw, { version: 1, updatedAt: 1, plantings: [], productionRecords: [] });
  assert.notEqual(view.raw, original);
  assert.equal(Object.isFrozen(original), originallyFrozen, 'only the reader copy may be frozen');
  assert.equal(JSON.stringify(original), originalBytes);
  samples.setSandboxCropPlan({ version: 1, updatedAt: 2, plantings: [], productionRecords: [] });
  assert.equal(rawCropPlanReadViewIsCurrent(view), false);
  samples.exitSampleMode(); assert.equal(rawCropPlanReadViewIsCurrent(view), false);
  assert.deepEqual(local.rows, personal);
});
