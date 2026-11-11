import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../lib/journal-storage.ts';
import type { JournalStorageContext, JournalStorageLocks } from '../lib/journal-storage.ts';
import { bindMountedAccountLocalStorageUid } from '../lib/account-local-storage.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = []; reads: string[] = [];
  onSet: ((key: string) => void) | null = null; onRemove: ((key: string) => void) | null = null;
  beforeSet: ((key: string) => void) | null = null; onGet: ((key: string) => void) | null = null; unavailable = false;
  getItem(key: string) { this.reads.push(key); if (this.unavailable) throw Error('Unavailable'); const value = this.rows.get(key) ?? null; this.onGet?.(key); return value; }
  setItem(key: string, value: string) { this.beforeSet?.(key); this.rows.set(key, value); this.writes.push(key); this.onSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); this.onRemove?.(key); }
}
class Locks implements JournalStorageLocks {
  held = new Set<string>(); pause: (() => Promise<void>) | null = null;
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await this.pause?.();
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const modules = [storage]; let documentIndex = 0;
async function anotherDocument(): Promise<typeof storage> {
  const module = await import(new URL(`../lib/journal-storage.ts?document=${++documentIndex}`, import.meta.url).href);
  modules.push(module); return module;
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const authored = '[ {"id":"entry-a","notes":"Exact authored observation","futureLink":{"scope":"private"}}, null, {"id":"entry-a"} ]';
function context(local = new MemoryStorage(), owner = 'owner', current = () => true): JournalStorageContext {
  return { storage: local, legacyKey: `v1::${owner}`, canonicalKey: `v2::${owner}`, receiptKey: `receipt::${owner}`, isCurrent: current };
}
function journal(local: MemoryStorage, c: JournalStorageContext) { return JSON.parse(local.getItem(c.canonicalKey)!).journalRaw as string; }
function token(c: JournalStorageContext) { const value = storage.readJournalStorage(c).token; assert.ok(value); return value; }
afterEach(async () => { for (const module of modules) module.releaseAllDocumentJournalLeases(); await tick(); });

test('cutover preserves exact journal bytes including unknown and malformed rows without normalizing or touching v1', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored);
  assert.equal(storage.readJournalStorage(c).reason, 'upgrade-required');
  assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, true);
  assert.equal(journal(local, c), authored); assert.equal(local.getItem(c.legacyKey), authored);
  assert.deepEqual(local.writes, [c.receiptKey, c.canonicalKey]);
  const before = [...local.rows]; await storage.initialiseJournalStorage(c, locks); assert.deepEqual([...local.rows], before);
  const receipt = JSON.parse(local.getItem(c.receiptKey)!);
  assert.equal(receipt.legacyBytes, authored); assert.equal(receipt.importedJournalRaw, authored);
});

test('absence creates an authoritative empty journal and a later old-tab write cannot resurrect stale entries', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, true); assert.equal(journal(local, c), '[]');
  const receipt = local.getItem(c.receiptKey), before = local.getItem(c.canonicalKey);
  local.rows.set(c.legacyKey, '[{"id":"old-copy"}]');
  assert.equal(storage.readJournalStorage(c).reason, 'legacy-diverged');
  assert.equal(storage.captureJournalStorageLease(c), null);
  assert.equal(storage.writeJournalStorageRaw('[]', null, c).status, 'held');
  assert.equal(local.getItem(c.canonicalKey), before); assert.equal(local.getItem(c.receiptKey), receipt);
});

test('invalid legacy envelopes remain visible evidence and cannot be silently replaced by an empty array', async () => {
  for (const raw of ['{broken', 'null', '{}', '"[]"', '{"entries":[]}']) {
    const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, raw);
    assert.equal((await storage.initialiseJournalStorage(c, locks)).reason, 'legacy-unreadable');
    assert.equal(local.getItem(c.legacyKey), raw); assert.deepEqual(local.writes, []);
  }
});

test('writes require the current raw token and lease and return a receipt for exactly their own bytes', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  const before = token(c), lease = storage.captureJournalStorageLease(c); assert.ok(lease);
  assert.equal(storage.journalStorageLeaseMatches(lease, c), true);
  const result = storage.writeJournalStorageRaw(authored, before, c); assert.equal(result.status, 'written');
  if (result.status !== 'written') throw Error('Write held');
  assert.equal(result.token, token(c)); assert.equal(journal(local, c), authored);
  assert.equal(storage.writeJournalStorageRaw('[]', before, c).status, 'held');
  assert.equal(storage.writeJournalStorageRaw('[]', token(c), c, () => false).status, 'held');
  assert.equal(journal(local, c), authored);
});

test('unsafe raw values are rejected without coercion and alternate key or storage contexts cannot inherit a lease', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  const originalToken = token(c), proof = storage.captureJournalStorageLease(c); let calls = 0;
  const hostile = { toString() { calls++; throw Error('Do not coerce'); } };
  assert.equal(storage.writeJournalStorageRaw(hostile as never, originalToken, c).status, 'held'); assert.equal(calls, 0);
  for (const other of [{ ...c, legacyKey: 'different-v1' }, { ...c, receiptKey: 'different-receipt' }, { ...c, storage: new MemoryStorage() }]) {
    assert.equal(storage.journalStorageLeaseMatches(proof, other), false);
    assert.equal(storage.writeJournalStorageRaw('[]', originalToken, other).status, 'held');
  }
});

test('quota before a write is held while a performed-but-unconfirmed write is never falsely called retryable failure', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  const original = token(c); local.beforeSet = () => { throw Error('Quota'); };
  assert.equal(storage.writeJournalStorageRaw(authored, original, c).status, 'held'); assert.equal(journal(local, c), '[]');
  local.beforeSet = null; local.onSet = key => { if (key === c.canonicalKey) throw Error('Confirmation interrupted after write'); };
  assert.equal(storage.writeJournalStorageRaw(authored, original, c).status, 'unconfirmed');
  assert.equal(journal(local, c), authored); assert.equal(storage.readJournalStorage(c).reason, 'write-unconfirmed');
  local.onSet = null; assert.equal((await storage.initialiseJournalStorage(c, locks)).reason, 'write-unconfirmed');
  await tick(); await storage.recoverJournalStorage(c, locks);
  assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, true);
});

test('a source guard withdrawn by the actual write produces an unconfirmed hold without rolling back authored bytes', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  let current = true; local.onSet = () => { current = false; };
  const result = storage.writeJournalStorageRaw(authored, token(c), c, () => current);
  assert.equal(result.status, 'unconfirmed'); assert.equal(journal(local, c), authored);
  assert.equal(storage.readJournalStorage(c).writable, false);
});

test('the source guard is rechecked after storage readback rather than only before the write', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  let current = true; local.onSet = () => { local.onGet = () => { current = false; }; };
  assert.equal(storage.writeJournalStorageRaw(authored, token(c), c, () => current).status, 'unconfirmed');
  local.onGet = null; assert.equal(journal(local, c), authored);
});

test('receipt-first quota interruption resumes only the same immutable import and never changed v1 bytes', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored);
  local.beforeSet = key => { if (key === c.canonicalKey) throw Error('Quota'); };
  assert.equal((await storage.initialiseJournalStorage(c, locks)).reason, 'cutover-recovery-required');
  const receipt = local.getItem(c.receiptKey); assert.ok(receipt); assert.equal(local.getItem(c.canonicalKey), null);
  local.beforeSet = null; assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, false);
  local.rows.set(c.legacyKey, authored + ' '); await storage.recoverJournalStorage(c, locks);
  assert.equal(local.getItem(c.canonicalKey), null);
  local.rows.set(c.legacyKey, authored); await storage.recoverJournalStorage(c, locks);
  assert.equal(journal(local, c), authored); assert.equal(local.getItem(c.receiptKey), receipt);
});

test('a recovery queued before document release cannot install its frozen import after that authority was revoked', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored);
  local.beforeSet = key => { if (key === c.canonicalKey) throw Error('Quota'); };
  await storage.initialiseJournalStorage(c, locks); local.beforeSet = null;
  let resume!: () => void; locks.pause = () => new Promise<void>(done => { resume = done; });
  const pending = storage.recoverJournalStorage(c, locks);
  storage.releaseAllDocumentJournalLeases(); resume();
  assert.equal((await pending).writable, false); assert.equal(local.getItem(c.canonicalKey), null);
});

test('actual module instances contend for one lock and a cold document may read but never write another document’s journal', async () => {
  const other = await anotherDocument(), local = new MemoryStorage(), c = context(local), locks = new Locks();
  local.rows.set(c.legacyKey, authored); await storage.initialiseJournalStorage(c, locks);
  assert.equal((await other.initialiseJournalStorage(c, locks)).reason, 'another-writer');
  const cold = other.readJournalStorage(c); assert.equal(cold.journalRaw, authored); assert.equal(cold.token, null);
  assert.equal(other.writeJournalStorageRaw('[]', token(c), c).status, 'held');
  storage.releaseAllDocumentJournalLeases(); await tick();
  assert.equal((await other.initialiseJournalStorage(c, locks)).writable, true);
});

test('release cancels queued initialization and an obsolete actor cannot inherit a replacement request', async () => {
  const local = new MemoryStorage(), locks = new Locks(); let current = true, resume!: () => void;
  const c = context(local, 'same', () => current); locks.pause = () => new Promise<void>(done => { resume = done; });
  const pending = storage.initialiseJournalStorage(c, locks), oldResume = resume;
  current = false; storage.releaseAllDocumentJournalLeases();
  const replacement = context(local, 'same'); const fresh = storage.initialiseJournalStorage(replacement, locks), freshResume = resume;
  oldResume(); assert.equal((await pending).writable, false); assert.deepEqual(local.writes, []);
  freshResume(); assert.equal((await fresh).writable, true);
});

test('sample and unavailable locks never create canonical data or pretend to provide exclusion', async () => {
  const local = new MemoryStorage(), c = context(local); local.rows.set(c.legacyKey, authored);
  assert.equal((await storage.initialiseJournalStorage({ ...c, sample: true }, new Locks())).status, 'sample');
  assert.equal((await storage.initialiseJournalStorage(c, null)).reason, 'web-locks-unavailable');
  assert.equal(storage.writeJournalStorageRaw(authored, null, { ...c, sample: true }).status, 'held');
  assert.deepEqual(local.writes, []);
});

test('real pagehide and observed sample ABA revoke queued and retained browser writer authority', async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const local = new MemoryStorage(), session = new MemoryStorage();
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  bindMountedAccountLocalStorageUid('journal-browser-owner');
  try {
    const c = storage.makeBrowserJournalStorageContext(); assert.ok(c);
    const locks = new Locks(); let resume!: () => void;
    locks.pause = () => new Promise<void>(done => { resume = done; });
    const pending = storage.initialiseJournalStorage(c, locks);
    session.setItem('imbewu_sample_mode', '1'); win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
    session.removeItem('imbewu_sample_mode'); win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
    resume(); assert.equal((await pending).writable, false); assert.deepEqual(local.writes, []);
    locks.pause = null;
    assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, true);
    const before = token(c); win.dispatchEvent(new Event('pagehide'));
    assert.equal(storage.writeJournalStorageRaw(authored, before, c).status, 'held');
    session.setItem('imbewu_sample_mode', '1'); const writes = [...local.writes];
    assert.equal((await storage.initialiseJournalStorage(storage.makeBrowserJournalStorageContext(), locks)).status, 'sample');
    assert.deepEqual(local.writes, writes);
    session.unavailable = true; const reads = local.reads.length;
    assert.equal(storage.makeBrowserJournalStorageContext(), null); assert.equal(local.reads.length, reads);
  } finally {
    storage.releaseAllDocumentJournalLeases(); bindMountedAccountLocalStorageUid(null);
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('guest transfer rebinds destination provenance and clears source only after the exact target pair exists', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'account'), locks = new Locks();
  local.rows.set(from.legacyKey, authored); await storage.initialiseJournalStorage(from, locks);
  const source = { canonicalRaw: local.getItem(from.canonicalKey), receiptRaw: local.getItem(from.receiptKey), legacyRaw: local.getItem(from.legacyKey) };
  storage.releaseAllDocumentJournalLeases(); await tick();
  local.onRemove = () => { assert.equal(journal(local, to), authored); assert.ok(local.getItem(to.receiptKey)); };
  assert.equal((await storage.transferJournalStoragePair(from, to, { locks })).status, 'transferred');
  assert.equal(journal(local, to), authored);
  const receipt = JSON.parse(local.getItem(to.receiptKey)!); assert.equal(receipt.canonicalKey, to.canonicalKey); assert.deepEqual(receipt.sourceCapture, source);
  assert.equal(local.getItem(from.legacyKey), null); assert.equal(local.getItem(from.canonicalKey), null); assert.equal(local.getItem(from.receiptKey), null);
});

test('legacy guest arrays transfer exactly but empty canonical, partial or corrupt destinations never invite resurrection', async () => {
  for (const target of ['empty-canonical', 'partial', 'legacy-content', 'legacy-corrupt'] as const) {
    const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, target), locks = new Locks();
    local.rows.set(from.legacyKey, authored);
    if (target === 'empty-canonical') { await storage.initialiseJournalStorage(to, locks); storage.releaseAllDocumentJournalLeases(); await tick(); }
    if (target === 'partial') local.rows.set(to.receiptKey, '{broken');
    if (target === 'legacy-content') local.rows.set(to.legacyKey, '[{"id":"account-work"}]');
    if (target === 'legacy-corrupt') local.rows.set(to.legacyKey, '{broken');
    const before = new Map(local.rows);
    assert.equal((await storage.transferJournalStoragePair(from, to, { locks })).status, 'preserved');
    assert.deepEqual(local.rows, before);
  }
});

test('failed guest locking blocks subsequent empty initialization until a guarded transfer retry', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'account'), locks = new Locks();
  local.rows.set(from.legacyKey, authored);
  assert.equal((await storage.transferJournalStoragePair(from, to, { locks: null })).status, 'held');
  assert.ok(storage.readJournalStorageTransferHold(to)); assert.equal((await storage.initialiseJournalStorage(to, locks)).reason, 'guest-transfer-held');
  assert.equal(local.getItem(to.canonicalKey), null); assert.equal(local.getItem(from.legacyKey), authored);
  assert.equal((await storage.transferJournalStoragePair(from, to, { locks })).status, 'transferred');
  assert.equal(storage.readJournalStorageTransferHold(to), null);
});

test('guest cleanup cannot delete a concurrent changed source or a different target', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'account'), locks = new Locks();
  local.rows.set(from.legacyKey, authored);
  local.onSet = key => { if (key === to.canonicalKey) local.rows.set(from.legacyKey, '[{"id":"new-guest-work"}]'); };
  assert.equal((await storage.transferJournalStoragePair(from, to, { locks })).status, 'held');
  assert.equal(local.getItem(from.legacyKey), '[{"id":"new-guest-work"}]'); assert.equal(journal(local, to), authored);
});

test('opaque legacy review exports both exact histories and keeps only explicit current data without rewriting provenance', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, authored);
  await storage.initialiseJournalStorage(c, locks); const receipt = local.getItem(c.receiptKey);
  const linked = '[{"id":"entry-a","link":{"plantingId":"persistent-row"}}]';
  assert.equal(storage.writeJournalStorageRaw(linked, token(c), c).status, 'written');
  const old = '[{"id":"entry-a","notes":"old client stripped link"}]'; local.rows.set(c.legacyKey, old);
  const review = storage.readJournalLegacyReview(c); assert.ok(review);
  assert.equal(storage.journalLegacyReviewIsCurrent({}, c), false); assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), true);
  const exported = storage.exportJournalLegacyReview(review.review, c); assert.ok(exported);
  const copies = JSON.parse(exported.json); assert.equal(copies.canonicalJournalRaw, linked); assert.equal(copies.olderJournalRaw, old);
  assert.equal(copies.initialImportJournalRaw, authored);
  assert.equal((await storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks)).status, 'kept');
  assert.equal(journal(local, c), linked); assert.equal(local.getItem(c.legacyKey), old); assert.equal(local.getItem(c.receiptKey), receipt);
  assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), false);
  local.rows.set(c.legacyKey, old + ' '); assert.equal(storage.readJournalStorage(c).reason, 'legacy-diverged');
});

test('changed canonical, legacy or actor revokes an exact legacy review rather than blessing a similar-count copy', async () => {
  for (const change of ['canonical', 'legacy', 'actor'] as const) {
    const local = new MemoryStorage(); let current = true; const c = context(local, change, () => current), locks = new Locks();
    await storage.initialiseJournalStorage(c, locks); local.rows.set(c.legacyKey, '[{"id":"older"}]');
    const review = storage.readJournalLegacyReview(c); assert.ok(review);
    if (change === 'canonical') { const envelope = JSON.parse(local.getItem(c.canonicalKey)!); local.rows.set(c.canonicalKey, JSON.stringify({ ...envelope, journalRaw: '[{"id":"changed"}]' })); }
    if (change === 'legacy') local.rows.set(c.legacyKey, '[{"id":"different"}]');
    if (change === 'actor') current = false;
    assert.equal(storage.exportJournalLegacyReview(review.review, c), null);
    assert.equal((await storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks)).status, 'superseded');
    storage.releaseAllDocumentJournalLeases(); await tick();
  }
});

test('a performed legacy acknowledgement with interrupted confirmation consumes its proof and holds rather than offering automatic retry', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  local.rows.set(c.legacyKey, '[{"id":"older"}]'); const review = storage.readJournalLegacyReview(c); assert.ok(review);
  local.onSet = () => { throw Error('Interrupted after actual acknowledgement'); };
  const result = await storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks);
  assert.equal(result.status, 'superseded'); assert.equal(result.reason, 'written-review-changed');
  assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), false);
  assert.equal(storage.readJournalStorage(c).reason, 'write-unconfirmed');
  assert.equal(storage.writeJournalStorageRaw(authored, null, c).status, 'held');
  local.onSet = null; await tick(); await storage.recoverJournalStorage(c, locks);
  assert.equal((await storage.initialiseJournalStorage(c, locks)).writable, true);
});

test('withdrawn confirmation before lock completion cannot acknowledge or consume an exact journal review', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  storage.releaseAllDocumentJournalLeases(); await tick(); local.rows.set(c.legacyKey, '[{"id":"older"}]');
  const review = storage.readJournalLegacyReview(c); assert.ok(review); const before = new Map(local.rows);
  let approved = false;
  assert.deepEqual(await storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks, () => approved), { status: 'held', reason: 'review-withdrawn' });
  assert.deepEqual(local.rows, before); assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), true);
  approved = true; let resume!: () => void; locks.pause = () => new Promise<void>(resolve => { resume = resolve; });
  const pending = storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks, () => approved);
  approved = false; resume(); assert.deepEqual(await pending, { status: 'held', reason: 'review-withdrawn' });
  assert.deepEqual(local.rows, before); assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), true);
});

test('confirmation withdrawn by actual acknowledgement readback retains an unconfirmed hold under stable actor identity', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseJournalStorage(c, locks);
  local.rows.set(c.legacyKey, '[{"id":"older"}]'); const review = storage.readJournalLegacyReview(c); assert.ok(review);
  let approved = true; local.onSet = () => { local.onGet = () => { approved = false; }; };
  const result = await storage.keepCurrentJournalAfterLegacyReview(review.review, c, locks, () => approved);
  local.onSet = null; local.onGet = null;
  assert.deepEqual(result, { status: 'superseded', reason: 'written-review-changed' });
  assert.equal(storage.journalLegacyReviewIsCurrent(review.review, c), false);
  assert.equal(storage.readJournalStorage(c).reason, 'write-unconfirmed');
  assert.equal((await storage.initialiseJournalStorage(c, locks)).reason, 'write-unconfirmed');
  assert.equal(c.isCurrent(), true, 'only ephemeral approval ended; storage identity still owns the retained uncertainty');
});
