import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import * as storage from '../lib/crop-plan-storage.ts';
import type { CropPlanStorageContext, CropPlanStorageLocks } from '../lib/crop-plan-storage.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  onSet: ((key: string) => void) | null = null;
  onRemove: ((key: string) => void) | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); this.writes.push(key); this.onSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); this.onRemove?.(key); }
}
class Locks implements CropPlanStorageLocks {
  held = new Set<string>(); pause: (() => Promise<void>) | null = null;
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, action: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await this.pause?.();
    if (this.held.has(name)) return action(null);
    this.held.add(name);
    try { return await action({ name }); } finally { this.held.delete(name); }
  }
}
const modules = [storage];
const moduleUrls = new WeakMap<object, string>();
let documentIndex = 0;
async function otherDocument(): Promise<typeof storage> {
  const url = new URL(`../lib/crop-plan-storage.ts?cutover-document=${++documentIndex}`, import.meta.url).href;
  const module = await import(url); moduleUrls.set(module, url);
  modules.push(module); return module;
}
const empty = '{"version":1,"plantings":[],"updatedAt":1}';
function context(local = new MemoryStorage(), owner = 'owner', current = () => true): CropPlanStorageContext {
  return { storage: local, canonicalKey: `v2::${owner}`, receiptKey: `cutover::${owner}`, legacyKey: `v1::${owner}`, isCurrent: current };
}
function raw(local: MemoryStorage, c: CropPlanStorageContext) { return JSON.parse(local.getItem(c.canonicalKey)!).bookRaw; }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
afterEach(async () => { for (const module of modules) module.releaseAllDocumentCropPlanLeases(); await tick(); });

test('first cutover preserves exact authored bytes, never writes v1 and is idempotent', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  const original = '{ "version":1, "plantings": [null], "unknownEvidence":1e400,"updatedAt":1 }';
  local.rows.set(c.legacyKey, original);
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'upgrade-required');
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, true);
  assert.equal(raw(local, c), original);
  assert.equal(local.getItem(c.legacyKey), original);
  assert.deepEqual(local.writes, [c.receiptKey, c.canonicalKey]);
  const before = [...local.rows];
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, true);
  assert.deepEqual([...local.rows], before);
});

test('absence creates one canonical empty book; a later empty canonical plan cannot resurrect old records', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false);
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, true);
  assert.deepEqual(JSON.parse(raw(local, c)).plantings, []);
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, true);
  local.rows.set(c.legacyKey, '{"version":1,"plantings":[{"id":"old-session"}],"updatedAt":2}');
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'legacy-diverged');
  assert.equal(raw(local, c), empty);
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false);
});

test('unparseable or wrong legacy envelopes are retained and cannot initialize a writable empty book', async () => {
  for (const malformed of ['{broken', 'null', '[]', '{"version":2,"plantings":[]}', '{"version":1,"plantings":null}']) {
    const local = new MemoryStorage(), c = context(local, malformed), locks = new Locks(); local.rows.set(c.legacyKey, malformed);
    const result = await storage.initialiseCropPlanStorage(c, locks);
    assert.equal(result.reason, 'legacy-unreadable'); assert.equal(result.writable, false);
    assert.equal(local.getItem(c.legacyKey), malformed); assert.deepEqual(local.writes, []);
  }
});

test('quota failure after immutable receipt needs explicit exact-source recovery, never automatic reimport', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, empty);
  local.onSet = key => { if (key === c.receiptKey) throw Error('quota before canonical write'); };
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).reason, 'cutover-recovery-required');
  const receipt = local.getItem(c.receiptKey); assert.ok(receipt); assert.equal(local.getItem(c.canonicalKey), null);
  local.onSet = null;
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).reason, 'cutover-recovery-required');
  assert.equal(local.getItem(c.canonicalKey), null);
  await storage.recoverCropPlanStorage(c, locks);
  assert.equal(raw(local, c), empty); assert.equal(local.getItem(c.receiptKey), receipt);
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, true);
  local.rows.delete(c.canonicalKey);
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'cutover-recovery-required');
});

test('changed legacy or corrupted/mismatched evidence prevents recovery and preserves both copies', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, empty);
  await storage.initialiseCropPlanStorage(c, locks); storage.releaseAllDocumentCropPlanLeases(); await tick();
  const canonical = local.getItem(c.canonicalKey); local.rows.delete(c.canonicalKey);
  local.rows.set(c.legacyKey, empty + ' ');
  assert.equal((await storage.recoverCropPlanStorage(c, locks)).writable, false);
  assert.equal(local.getItem(c.canonicalKey), null);
  local.rows.set(c.canonicalKey, canonical!); local.rows.set(c.receiptKey, '{"receiptVersion":1}');
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'cutover-recovery-required');
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, false);
  assert.equal(local.getItem(c.canonicalKey), canonical);
});

test('two actual module instances contend for one writer lock; released tab must reacquire before saving', async () => {
  const second = await otherDocument(), local = new MemoryStorage(), c = context(local), locks = new Locks();
  const [one, two] = await Promise.all([storage.initialiseCropPlanStorage(c, locks), second.initialiseCropPlanStorage(c, locks)]);
  assert.equal(one.writable, true); assert.equal(two.reason, 'another-writer');
  assert.equal(second.writeCropPlanStorageRaw(empty, c).saved, false);
  storage.releaseAllDocumentCropPlanLeases(); await tick();
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false);
  assert.equal((await second.initialiseCropPlanStorage(c, locks)).writable, true);
  assert.equal(second.writeCropPlanStorageRaw(empty, c).saved, true);
  assert.equal(storage.readCropPlanStorage(c).bookRaw, empty);
});

test('pagehide revokes queued initialization and a stale completion cannot delete the fresh request', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); let resume!: () => void;
  locks.pause = () => new Promise<void>(done => { resume = done; });
  const old = storage.initialiseCropPlanStorage(c, locks);
  storage.releaseAllDocumentCropPlanLeases(); const resumeOld = resume;
  const fresh = storage.initialiseCropPlanStorage(c, locks); const resumeFresh = resume;
  resumeOld(); assert.equal((await old).writable, false); assert.deepEqual(local.writes, []);
  resumeFresh(); assert.equal((await fresh).writable, true);
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).writable, true);
});

test('queued actor change and same-key storage replacement cannot inherit another request authority', async () => {
  const first = new MemoryStorage(), second = new MemoryStorage(), locks = new Locks(); let current = true, resume!: () => void;
  const a = context(first, 'same', () => current), b = context(second, 'same');
  locks.pause = () => new Promise<void>(done => { resume = done; });
  const pending = storage.initialiseCropPlanStorage(a, locks), resumeOld = resume; current = false;
  const replacement = storage.initialiseCropPlanStorage(b, locks), resumeNew = resume;
  resumeOld(); assert.equal((await pending).writable, false); assert.deepEqual(first.writes, []);
  resumeNew(); assert.equal((await replacement).writable, true); assert.equal(second.writes.length, 2);
  assert.equal(storage.writeCropPlanStorageRaw(empty, a).saved, false);
});

test('all three physical keys and storage identity participate in lease authority', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseCropPlanStorage(c, locks);
  const proof = storage.captureCropPlanStorageLease(c); assert.ok(proof);
  for (const wrong of [{ ...c, legacyKey: 'other' }, { ...c, receiptKey: 'other' }, { ...c, storage: new MemoryStorage() }]) {
    assert.equal(storage.cropPlanStorageLeaseMatches(proof, wrong), false);
    assert.equal(storage.writeCropPlanStorageRaw(empty, wrong).saved, false);
  }
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, true);
});

test('a performed write returns its own receipt even if actor or old-copy changes immediately afterward', async () => {
  const local = new MemoryStorage(), locks = new Locks(); let actor = true; const c = context(local, 'actor', () => actor);
  await storage.initialiseCropPlanStorage(c, locks);
  local.onSet = key => { if (key === c.canonicalKey) { actor = false; local.rows.set(c.legacyKey, empty); } };
  const result = storage.writeCropPlanStorageRaw(empty, c);
  assert.equal(result.saved, true);
  if (result.saved) assert.equal(JSON.parse(result.token)[1], local.getItem(c.canonicalKey));
  assert.equal(storage.readCropPlanStorageStatus(c).writable, false);
});

test('no Web Locks means read-only evidence, never an imitation compare-and-swap', async () => {
  const local = new MemoryStorage(), c = context(local); local.rows.set(c.legacyKey, empty);
  assert.equal((await storage.initialiseCropPlanStorage(c, null)).writable, false);
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false); assert.deepEqual(local.writes, []);
});

test('sample contexts never create cutover records or acquire a persistent writer', async () => {
  const local = new MemoryStorage(), c = { ...context(local), sample: true }, locks = new Locks();
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).status, 'sample');
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false); assert.deepEqual(local.writes, []); assert.equal(locks.held.size, 0);
});

const neverEmpty = (raw: string | null) => raw === null;
test('guest canonical pair moves only after both rebound destination rows exist', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'), locks = new Locks();
  local.rows.set(from.legacyKey, empty); await storage.initialiseCropPlanStorage(from, locks);
  const authored = '{"version":1,"plantings":[],"growerPlanningProfiles":[{"authored":"keep"}],"updatedAt":2}';
  assert.equal(storage.writeCropPlanStorageRaw(authored, from).saved, true);
  storage.releaseAllDocumentCropPlanLeases(); await tick();
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'transferred');
  assert.equal(raw(local, to), authored); assert.equal(JSON.parse(local.getItem(to.receiptKey)!).canonicalKey, to.canonicalKey);
  assert.equal(local.getItem(from.canonicalKey), null); assert.equal(local.getItem(from.receiptKey), null); assert.equal(local.getItem(from.legacyKey), null);
  assert.equal((await storage.initialiseCropPlanStorage(to, locks)).writable, true);
});

test('legacy-only guest work transfers exact bytes; existing empty canonical and partial targets are protected', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'), locks = new Locks(); local.rows.set(from.legacyKey, empty);
  await storage.initialiseCropPlanStorage(to, locks); storage.releaseAllDocumentCropPlanLeases(); await tick();
  const before = [...local.rows];
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'preserved');
  assert.deepEqual([...local.rows], before);
  local.rows.delete(to.canonicalKey);
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'preserved');
  local.rows.delete(to.receiptKey);
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'transferred');
  assert.equal(raw(local, to), empty);
});

test('late source changes during cleanup are retained rather than deleted by the transfer', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'), locks = new Locks(); local.rows.set(from.legacyKey, empty);
  await storage.initialiseCropPlanStorage(from, locks); storage.releaseAllDocumentCropPlanLeases(); await tick();
  local.onRemove = key => { if (key === from.canonicalKey) local.rows.set(from.legacyKey, empty + ' '); };
  const result = await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty });
  assert.equal(result.status, 'held'); assert.equal(local.getItem(from.legacyKey), empty + ' '); assert.ok(local.getItem(from.receiptKey)); assert.equal(raw(local, to), empty);
});

const releasedloadCropPlan = "export function loadCropPlan(): CropPlanState {\n  const settleNow = new Date();\n  const settle = (plantings: Planting[]): Planting[] =>\n    settleOnceRows(plantings, settleNow.getFullYear(), settleNow.getMonth() + 1);\n  if (isSampleMode()) {\n    const sandbox = getSandboxCropPlan();\n    return { ...sandbox, plantings: settle(sandbox.plantings) };\n  }\n  if (typeof window === 'undefined' || !window.localStorage) {\n    return emptyPlan();\n  }\n  try {\n    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(STORAGE_KEY));\n    if (!raw) return emptyPlan();\n    const parsed = JSON.parse(raw) as Partial<CropPlanState> | null;\n    if (!parsed || !Array.isArray(parsed.plantings)) return emptyPlan();\n    const planNotes = sanitisePlanNotes(parsed.planNotes);\n    return {\n      version: 1,\n      plantings: settle(parsed.plantings),\n      ...(Array.isArray(parsed.harvestTargets) ? { harvestTargets: sanitiseHarvestTargets(parsed.harvestTargets) } : {}),\n      ...(parsed.nursery !== undefined ? { nursery: sanitiseNurserySettings(parsed.nursery) } : {}),\n      ...(isRainPattern(parsed.rainPattern) ? { rainPattern: parsed.rainPattern } : {}),\n      ...(Array.isArray(parsed.productionRecords) ? { productionRecords: sanitiseProductionRecords(parsed.productionRecords) } : {}),\n      ...(Array.isArray(parsed.preservedProducts) ? { preservedProducts: sanitisePreservedFoodRecords(parsed.preservedProducts) } : {}),\n      // The timestamp travels ONLY with notes. A stored date on its own labels\n      // nothing, and notes without a date would have to be shown undated —\n      // which is the dishonesty this pair exists to prevent.\n      ...(planNotes.length && isPlanNotesAt(parsed.planNotesAt)\n        ? { planNotes, planNotesAt: parsed.planNotesAt }\n        : {}),\n      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),\n    };\n  } catch {\n    return emptyPlan();\n  }\n}";
const releasedloadCropPlanSha = "c5fdf23d89f18e23475a520a683eec7bbc0d82f5bdbf26e66eace538443b5a16";

const releasedsaveCropPlan = "export function saveCropPlan(s: CropPlanState): boolean {\n  if (isSampleMode()) {\n    setSandboxCropPlan(s);\n    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CROP_PLAN_CHANGED_EVENT));\n    return true; // the sandbox IS the demo's real store, so this genuinely did persist\n  }\n  if (typeof window === 'undefined' || !window.localStorage) return false;\n  try {\n    window.localStorage.setItem(activeAccountLocalStorageKey(STORAGE_KEY), JSON.stringify(s));\n    window.dispatchEvent(new CustomEvent(CROP_PLAN_CHANGED_EVENT));\n    return true;\n  } catch {\n    // Quota exceeded or storage unavailable. The CALLER must surface this — returning false is\n    // the entire point of this signature. See the planner's saveFailed banner.\n    return false;\n  }\n}";
const releasedsaveCropPlanSha = "1007e3a2d5512a26a302e1100b61adc0553f7ba5082f0976dc751f8e5194635f";

test('actual frozen released loader/saver loses new metadata only in v1; canonical survives that write and rollback', async () => {
  for (const [source, sha] of [[releasedloadCropPlan, releasedloadCropPlanSha], [releasedsaveCropPlan, releasedsaveCropPlanSha]]) {
    assert.equal(createHash('sha256').update(source).digest('hex'), sha);
  }
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  const original = '{"version":1,"plantings":[],"growerPlanningProfiles":[{"authored":"keep"}],"updatedAt":1}';
  local.rows.set(c.legacyKey, original); await storage.initialiseCropPlanStorage(c, locks);
  const before = local.getItem(c.canonicalKey);
  // These two exact released function bodies are frozen from 8a12b3e. Only
  // browser/sample/account boundaries and unused empty-row agronomy are stubbed.
  // The metadata-dropping whitelist and actual old setItem execute unchanged.
  const sandbox = vm.createContext({ exports: {}, window: { localStorage: local, dispatchEvent() {} },
    isSampleMode: () => false, activeAccountLocalStorageKey: () => c.legacyKey,
    STORAGE_KEY: storage.CROP_PLAN_LEGACY_KEY, CROP_PLAN_CHANGED_EVENT: 'unused-event', CustomEvent: class {}, Date,
    settleOnceRows: (rows: unknown[]) => rows, sanitisePlanNotes: () => [], isRainPattern: () => false });
  const js = ts.transpileModule(releasedloadCropPlan + '\n' + releasedsaveCropPlan, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new vm.Script(js).runInContext(sandbox);
  const released = sandbox.exports as { loadCropPlan(): Record<string, unknown>; saveCropPlan(book: Record<string, unknown>): boolean };
  const oldLoaded = released.loadCropPlan(); assert.equal(oldLoaded.growerPlanningProfiles, undefined);
  assert.equal(released.saveCropPlan({ ...oldLoaded, rainPattern: 'winter', updatedAt: 2 }), true);
  assert.equal(JSON.parse(local.getItem(c.legacyKey)!).growerPlanningProfiles, undefined);
  assert.equal(local.getItem(c.canonicalKey), before);
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'legacy-diverged');
  storage.releaseAllDocumentCropPlanLeases(); await tick();
  const restored = await otherDocument();
  assert.equal((await restored.initialiseCropPlanStorage(c, locks)).reason, 'legacy-diverged');
  assert.equal(restored.readCropPlanStorage(c).bookRaw, original);
  assert.equal(local.getItem(c.canonicalKey), before);
});

test('download and explicit keep-current preserve exact copies and initial evidence; a further old write revokes again', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); local.rows.set(c.legacyKey, empty);
  await storage.initialiseCropPlanStorage(c, locks); const receipt = local.getItem(c.receiptKey);
  const older = empty.replace('"updatedAt":1', '"updatedAt":2'); local.rows.set(c.legacyKey, older);
  const review = storage.readCropPlanLegacyReview(c); assert.ok(review);
  assert.equal(review.currentSavedRows, 0); assert.equal(review.olderSavedRows, 0);
  const packet = storage.exportCropPlanLegacyReview(review.review, c); assert.ok(packet);
  const exported = JSON.parse(packet.json);
  assert.equal(exported.canonicalBookRaw, empty); assert.equal(exported.olderBookRaw, older);
  assert.equal(packet.json.includes(c.canonicalKey), false);
  assert.deepEqual(await storage.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks), { status: 'kept' });
  assert.equal(raw(local, c), empty); assert.equal(local.getItem(c.receiptKey), receipt); assert.equal(local.getItem(c.legacyKey), older);
  assert.equal(storage.readCropPlanStorageStatus(c).writable, true);
  assert.equal(storage.exportCropPlanLegacyReview(review.review, c), null);
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks)).status, 'superseded');
  assert.equal(storage.writeCropPlanStorageRaw(empty + ' ', c).saved, true);
  assert.equal(JSON.parse(local.getItem(c.canonicalKey)!).legacyAcknowledgement.legacyBytes, older);
  local.rows.set(c.legacyKey, older + ' ');
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'legacy-diverged');
});

test('changed canonical, actor or old copy invalidates opaque review before export or acknowledgement', async () => {
  const local = new MemoryStorage(), locks = new Locks(); let current = true; const c = context(local, 'owner', () => current);
  await storage.initialiseCropPlanStorage(c, locks); local.rows.set(c.legacyKey, empty);
  const review = storage.readCropPlanLegacyReview(c); assert.ok(review);
  const before = local.getItem(c.canonicalKey); local.rows.set(c.legacyKey, empty + ' ');
  assert.equal(storage.exportCropPlanLegacyReview(review.review, c), null);
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks)).status, 'superseded');
  assert.equal(local.getItem(c.canonicalKey), before);
  const currentReview = storage.readCropPlanLegacyReview(c); assert.ok(currentReview); current = false;
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(currentReview.review, c, locks)).status, 'superseded');
  assert.equal(local.getItem(c.canonicalKey), before);
});

test('guest quota failure before the first marker blocks global empty initialization until guarded retry', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'), locks = new Locks(); local.rows.set(from.legacyKey, empty);
  const originalSet = local.setItem.bind(local); local.setItem = () => { throw Error('quota before marker'); };
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'held');
  assert.equal(storage.readCropPlanStorageStatus(to).reason, 'guest-transfer-held');
  assert.equal((await storage.initialiseCropPlanStorage(to, locks)).writable, false);
  assert.equal(local.getItem(to.canonicalKey), null); assert.equal(local.getItem(to.receiptKey), null);
  storage.releaseAllDocumentCropPlanLeases();
  assert.equal(storage.readCropPlanStorageStatus(to).reason, 'guest-transfer-held');
  local.setItem = originalSet;
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'transferred');
  assert.equal(storage.readCropPlanStorageTransferHold(to), null); assert.equal((await storage.initialiseCropPlanStorage(to, locks)).writable, true);
});

test('unavailable guest locks cannot let a subsequent initializer hide retained guest work behind empty canonical', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'); local.rows.set(from.legacyKey, empty);
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks: null, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'held');
  assert.equal((await storage.initialiseCropPlanStorage(to, new Locks())).reason, 'guest-transfer-held');
  assert.equal(local.getItem(to.canonicalKey), null); assert.equal(local.getItem(from.legacyKey), empty);
});

test('performed keep-current acknowledgement with changed confirmation blocks all other writes until fresh setup', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(); await storage.initialiseCropPlanStorage(c, locks);
  local.rows.set(c.legacyKey, empty); const review = storage.readCropPlanLegacyReview(c); assert.ok(review);
  local.onSet = key => { if (key === c.canonicalKey) local.rows.set(c.legacyKey, empty + ' '); };
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks)).status, 'superseded');
  assert.ok(JSON.parse(local.getItem(c.canonicalKey)!).legacyAcknowledgement);
  assert.equal(storage.readCropPlanStorageStatus(c).reason, 'review-write-unconfirmed');
  assert.equal(storage.writeCropPlanStorageRaw(empty, c).saved, false);
  assert.equal((await storage.initialiseCropPlanStorage(c, locks)).reason, 'review-write-unconfirmed');
});

test('guest sign-in retains acknowledged old-copy and reviewed-current evidence after source cleanup and later edits', async () => {
  const local = new MemoryStorage(), from = context(local, 'guest'), to = context(local, 'uid'), locks = new Locks();
  local.rows.set(from.legacyKey, empty); await storage.initialiseCropPlanStorage(from, locks);
  const oldChange = empty + ' '; local.rows.set(from.legacyKey, oldChange);
  const reviewed = storage.readCropPlanLegacyReview(from); assert.ok(reviewed);
  assert.equal((await storage.keepCurrentCropPlanAfterLegacyReview(reviewed.review, from, locks)).status, 'kept');
  const laterCurrent = empty.replace('"updatedAt":1', '"updatedAt":3'); assert.equal(storage.writeCropPlanStorageRaw(laterCurrent, from).saved, true);
  const sourceCanonical = local.getItem(from.canonicalKey), sourceReceipt = local.getItem(from.receiptKey);
  storage.releaseAllDocumentCropPlanLeases(); await tick();
  assert.equal((await storage.transferCropPlanStoragePair(from, to, { locks, sourceLegacyIsEmpty: neverEmpty, targetLegacyIsEmpty: neverEmpty })).status, 'transferred');
  const provenance = JSON.parse(local.getItem(to.receiptKey)!).sourceCapture;
  assert.equal(provenance.canonicalRaw, sourceCanonical); assert.equal(provenance.receiptRaw, sourceReceipt); assert.equal(provenance.legacyRaw, oldChange);
  assert.equal(local.getItem(from.canonicalKey), null);
  await storage.initialiseCropPlanStorage(to, locks); local.rows.set(to.legacyKey, empty);
  const review = storage.readCropPlanLegacyReview(to); assert.ok(review);
  const exported = JSON.parse(storage.exportCropPlanLegacyReview(review.review, to)!.json).transferredCopies;
  assert.equal(exported.canonicalBookRaw, laterCurrent);
  assert.equal(exported.previouslyReviewedCopies.canonicalBookRaw, empty); assert.equal(exported.previouslyReviewedCopies.olderBookRaw, oldChange);
  assert.equal(exported.olderBookRaw, oldChange);
});

test('actual global load/save preserves canonical raw evidence, rejects lossy display writes and never executes candidate getters', async () => {
  const originals = new Map(['window', 'localStorage', 'sessionStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new MemoryStorage(), session = new MemoryStorage(), locks = new Locks();
  const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  const account = await import('../lib/account-local-storage.ts'), crop = await import('../lib/crop-plan.ts');
  account.bindMountedAccountLocalStorageUid('synthetic-owner');
  try {
    let getters = 0;
    const canonicalContext = storage.makeBrowserCropPlanStorageContext(); assert.ok(canonicalContext);
    await storage.initialiseCropPlanStorage(canonicalContext, locks);
    const plan = { version: 1 as const, plantings: [], updatedAt: 1 };
    assert.equal(crop.saveCropPlan(plan), true); assert.equal(crop.loadCropPlan().updatedAt, 1);
    const admitted = crop.loadCropPlanWithWriteAdmission(), base = JSON.stringify(admitted.book);
    assert.equal(admitted.admission.status, 'ready');
    assert.equal(crop.cropPlanWriteAdmissionMatches(admitted.admission, base, admitted.token), true);
    const canonicalBefore = local.getItem(canonicalContext.canonicalKey);
    const receiptBefore = local.getItem(canonicalContext.receiptKey);
    const leaseProof = storage.captureCropPlanStorageLease(canonicalContext); assert.ok(leaseProof);
    assert.equal(storage.cropPlanStorageLeaseMatches({}, canonicalContext), false);
    assert.equal(storage.writeCropPlanStorageRaw(JSON.stringify({ ...plan, rainPattern: 'winter' }), canonicalContext).saved, true);
    const freshRebase = crop.loadCropPlanWithWriteAdmission();
    assert.equal(freshRebase.admission.status, 'ready');
    assert.notEqual(freshRebase.token, admitted.token);
    // Original provenance is intentionally not a live raw-equality check.
    // Callers still need their independent fresh-admission/final-token guards.
    assert.equal(crop.cropPlanWriteAdmissionMatches(admitted.admission, base, admitted.token), true);
    assert.equal(storage.cropPlanStorageLeaseMatches(leaseProof, canonicalContext), true);
    local.rows.set(canonicalContext.canonicalKey, canonicalBefore!);
    storage.releaseAllDocumentCropPlanLeases();
    assert.equal(crop.cropPlanWriteToken(), null);
    assert.equal(crop.cropPlanWriteAdmissionMatches(admitted.admission, base, admitted.token), false);
    assert.equal(storage.cropPlanStorageLeaseMatches(leaseProof, canonicalContext), false);
    await tick(); await storage.initialiseCropPlanStorage(canonicalContext, locks);
    assert.equal(local.getItem(canonicalContext.canonicalKey), canonicalBefore);
    assert.equal(local.getItem(canonicalContext.receiptKey), receiptBefore);
    assert.notEqual(crop.cropPlanWriteToken(), admitted.token);
    assert.equal(crop.cropPlanWriteAdmissionMatches(admitted.admission, base, admitted.token), false);
    const resumed = crop.loadCropPlanWithWriteAdmission();
    assert.equal(crop.cropPlanWriteAdmissionMatches(resumed.admission, JSON.stringify(resumed.book), resumed.token), true);
    const unsafe = { ...plan, get rainPattern() { getters++; return undefined; } };
    assert.equal(crop.saveCropPlan(unsafe), false); assert.equal(getters, 0);
    const envelope = JSON.parse(local.getItem(canonicalContext.canonicalKey)!);
    const malformed = '{"version":1,"plantings":[null],"privateEvidence":{"keep":true},"updatedAt":1}';
    local.rows.set(canonicalContext.canonicalKey, JSON.stringify({ ...envelope, bookRaw: malformed }));
    assert.equal(crop.loadCropPlanWithWriteAdmission().admission.status, 'held');
    assert.equal(crop.saveCropPlan(plan), false); assert.equal(raw(local, canonicalContext), malformed);
    assert.equal(local.getItem(canonicalContext.legacyKey), null);
    const persistent = [...local.rows];
    session.rows.set('imbewu_sample_mode', '1');
    const sample = await import('../lib/sample-mode.ts');
    sample.setSandboxCropPlan(plan);
    assert.equal(crop.loadCropPlanWithWriteAdmission().admission.status, 'ready');
    assert.equal(crop.saveCropPlan({ ...plan, updatedAt: 2 }), true);
    assert.equal(sample.getSandboxCropPlan().updatedAt, 2);
    assert.deepEqual([...local.rows], persistent);
    const unsafeSample = { ...plan, get retainedEvidence() { getters++; return undefined; } };
    sample.setSandboxCropPlan(unsafeSample);
    assert.equal(crop.saveCropPlan(plan), false); assert.equal(getters, 0);
    assert.equal(sample.getSandboxCropPlan(), unsafeSample);
    assert.deepEqual([...local.rows], persistent);
  } finally {
    storage.releaseAllDocumentCropPlanLeases(); account.bindMountedAccountLocalStorageUid(null);
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('unknown sample authority holds browser initialization without persistent reads or writes', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window'), local = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { value: { localStorage: local, get sessionStorage() { throw Error('unknown sample authority'); } }, configurable: true });
  try { assert.equal(storage.makeBrowserCropPlanStorageContext(), null); assert.equal((await storage.initialiseCropPlanStorage()).writable, false); assert.deepEqual(local.writes, []); }
  finally { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); }
});

test('opaque comparison notices same-count canonical changes and cannot acknowledge while another document edits', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks(), second = await otherDocument();
  await storage.initialiseCropPlanStorage(c, locks); local.rows.set(c.legacyKey, empty);
  const review = second.readCropPlanLegacyReview(c); assert.ok(review);
  assert.equal((await second.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks)).reason, 'another-writer');
  const envelope = JSON.parse(local.getItem(c.canonicalKey)!);
  local.rows.set(c.canonicalKey, JSON.stringify({ ...envelope, bookRaw: empty.replace('"updatedAt":1', '"updatedAt":4') }));
  assert.equal(second.cropPlanLegacyReviewIsCurrent(review.review, c), false);
  assert.equal(second.exportCropPlanLegacyReview(review.review, c), null);
  assert.equal((await second.keepCurrentCropPlanAfterLegacyReview(review.review, c, locks)).status, 'superseded');
});

test('a second same-key initialization requester rechecks its own revoked context after sharing an in-flight lock', async () => {
  const local = new MemoryStorage(), first = context(local), locks = new Locks(); let valid = true, resume!: () => void;
  const second = { ...first, isCurrent: () => valid };
  locks.pause = () => new Promise<void>(done => { resume = done; });
  const one = storage.initialiseCropPlanStorage(first, locks), two = storage.initialiseCropPlanStorage(second, locks);
  valid = false; resume();
  assert.equal((await one).writable, true); assert.equal((await two).writable, false);
});


test('a performed receipt names the exact writing lease even when release happens during that write', async () => {
  const local = new MemoryStorage(), c = context(local), locks = new Locks();
  await storage.initialiseCropPlanStorage(c, locks);
  const originalToken = storage.readCropPlanStorage(c).token; assert.ok(originalToken);
  const originalLeaseId = JSON.parse(originalToken)[4]; assert.equal(typeof originalLeaseId, 'string');
  local.onSet = key => { if (key === c.canonicalKey) storage.releaseAllDocumentCropPlanLeases(); };
  const receipt = storage.writeCropPlanStorageRaw(empty, c); assert.equal(receipt.saved, true);
  if (!receipt.saved) throw Error('missing performed receipt');
  assert.equal(JSON.parse(receipt.token)[4], originalLeaseId);
  assert.equal(JSON.parse(receipt.token)[1], local.getItem(c.canonicalKey));
  assert.equal(storage.readCropPlanStorage(c).token, null);
  const persisted = [...local.rows]; local.onSet = null; await tick();
  await storage.initialiseCropPlanStorage(c, locks);
  assert.deepEqual([...local.rows], persisted);
  const resumed = storage.readCropPlanStorage(c).token; assert.ok(resumed);
  assert.notEqual(JSON.parse(resumed)[4], originalLeaseId); assert.notEqual(resumed, receipt.token);
  assert.equal(local.getItem(c.canonicalKey)!.includes(originalLeaseId), false);
});


test('cold second document displays actual saved rows and profiles while its held admission cannot save', async () => {
  const originals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new MemoryStorage(), session = new MemoryStorage(), locks = new Locks();
  Object.defineProperty(globalThis, 'window', { value: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  const account = await import('../lib/account-local-storage.ts'), crop = await import('../lib/crop-plan.ts');
  const { CROPS } = await import('../lib/crop-catalog.ts');
  const { normaliseGrowerPlanningProfile } = await import('../lib/international/grower-planning.ts');
  account.bindMountedAccountLocalStorageUid('synthetic-readonly-owner');
  const second = await otherDocument(), lightUrl = moduleUrls.get(second)!;
  const heavyUrl = new URL(`../lib/crop-plan.ts?readonly-heavy-document=${documentIndex}`, import.meta.url).href;
  // This is the actual second heavy module. Only its light storage dependency
  // is resolved to the independently leased second document's actual module.
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === heavyUrl && specifier === './crop-plan-storage') return { shortCircuit: true, url: lightUrl };
    return next(specifier, context);
  } });
  try {
    const cold = await import(heavyUrl) as typeof crop;
    const inputs = Object.fromEntries(['plantsPerM2', 'yieldKgPerM2', 'establishment', 'nurseryDays', 'fieldEntryToFirstHarvestDays', 'pickingDays', 'fieldOccupancyDays', 'turnaroundDays', 'allowedEntryMonths'].map(key => [key, { state: 'missing', reason: 'not-entered' }]));
    const profile = normaliseGrowerPlanningProfile({ version: 1, profileId: 'saved-profile', cropKey: CROPS[0].key,
      scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' }, inputs }); assert.ok(profile);
    const plan = { version: 1 as const, plantings: [{ id: 'saved-row', bedId: 'virtual-bed', cropKey: CROPS[0].key, sowMonth: 1 }], growerPlanningProfiles: [profile], updatedAt: 1 };
    const context = storage.makeBrowserCropPlanStorageContext(); assert.ok(context);
    await storage.initialiseCropPlanStorage(context, locks); assert.equal(crop.saveCropPlan(plan), true);
    assert.equal((await second.initialiseCropPlanStorage(context, locks)).reason, 'another-writer');
    const before = [...local.rows], admitted = cold.loadCropPlanWithWriteAdmission();
    assert.equal(admitted.admission.status, 'held'); assert.equal(admitted.token, null);
    assert.deepEqual(admitted.book.plantings, plan.plantings); assert.deepEqual(admitted.book.growerPlanningProfiles, [profile]);
    assert.deepEqual(cold.loadCropPlan().plantings, plan.plantings);
    assert.equal(cold.cropPlanWriteAdmissionMatches(admitted.admission, JSON.stringify(admitted.book), admitted.token), false);
    assert.equal(cold.saveCropPlan({ ...admitted.book, updatedAt: 2 }), false); assert.deepEqual([...local.rows], before);
    const envelope = JSON.parse(local.getItem(context.canonicalKey)!);
    local.rows.set(context.canonicalKey, JSON.stringify({ ...envelope, bookRaw: '{broken' }));
    const corrupted = cold.loadCropPlanWithWriteAdmission(); assert.equal(corrupted.admission.status, 'held'); assert.equal(corrupted.token, null);
    assert.equal(cold.saveCropPlan(plan), false); assert.equal(JSON.parse(local.getItem(context.canonicalKey)!).bookRaw, '{broken');
    local.rows.set(context.canonicalKey, before.find(([key]) => key === context.canonicalKey)![1]);
    // A populated later actor makes this check fail if a held load simply
    // borrows loadCropPlan() from whatever account became current meanwhile.
    const laterKey = account.accountLocalStorageKey(storage.CROP_PLAN_STORAGE_KEY, 'different-owner');
    const laterReceipt = account.accountLocalStorageKey(storage.CROP_PLAN_CUTOVER_KEY, 'different-owner');
    const laterBook = JSON.stringify({ ...plan, plantings: [{ ...plan.plantings[0], id: 'not-the-captured-actor' }] });
    local.rows.set(laterKey, JSON.stringify({ ...envelope, bookRaw: laterBook }));
    local.rows.set(laterReceipt, JSON.stringify({ ...JSON.parse(local.getItem(context.receiptKey)!), canonicalKey: laterKey }));
    const get = local.getItem.bind(local); let switched = false;
    local.getItem = key => { if (!switched && key === context.canonicalKey) { switched = true; account.bindMountedAccountLocalStorageUid('different-owner'); } return get(key); };
    const switchedLoad = cold.loadCropPlanWithWriteAdmission();
    assert.equal(switchedLoad.admission.status, 'held'); assert.equal(switchedLoad.token, null); assert.deepEqual(switchedLoad.book.plantings, []);
    assert.equal(switchedLoad.book.growerPlanningProfiles, undefined);
    account.bindMountedAccountLocalStorageUid('synthetic-readonly-owner'); local.getItem = get;
    const replacement = new MemoryStorage(); for (const [key, value] of local.rows) replacement.rows.set(key, value);
    replacement.rows.set(context.canonicalKey, JSON.stringify({ ...envelope, bookRaw: laterBook }));
    const browser = window as unknown as { localStorage: MemoryStorage };
    let replaced = false; local.getItem = key => { if (!replaced && key === context.canonicalKey) { replaced = true; browser.localStorage = replacement; } return get(key); };
    const replacedLoad = cold.loadCropPlanWithWriteAdmission();
    assert.equal(replacedLoad.admission.status, 'held'); assert.equal(replacedLoad.token, null); assert.deepEqual(replacedLoad.book.plantings, []);
    assert.deepEqual(replacement.writes, []);
  } finally {
    hooks.deregister(); storage.releaseAllDocumentCropPlanLeases(); second.releaseAllDocumentCropPlanLeases(); account.bindMountedAccountLocalStorageUid(null);
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
