import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedLocalStorage, type ProtectedStorageContext, type ProtectedStorageLocks } from '../lib/protected-local-storage.ts';

type Path = 'current' | 'keep' | 'initialise' | 'recovery' | 'transfer';
type Boundary = { label: string; ordinal: number };
type Event = { kind: 'context'; label: string; ordinal: number; locksHeld: number }
  | { kind: 'set' | 'remove'; key: string; afterWithdrawal: boolean; locksHeld: number };

class ExclusiveLocks implements ProtectedStorageLocks {
  readonly held = new Set<string>();
  private readonly completions = new Set<Promise<void>>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return callback(null);
    let complete!: () => void;
    const finished = new Promise<void>(resolve => { complete = resolve; });
    this.completions.add(finished); this.held.add(name);
    // Private withdrawal resolves the retained callback; the exclusive lock is
    // released only after that asynchronous callback has actually completed.
    try { return await callback({ name }); }
    finally { this.held.delete(name); this.completions.delete(finished); complete(); }
  }
  async drain() { await Promise.all([...this.completions]); }
}

class MemoryStorage {
  readonly rows = new Map<string, string>();
  failCanonical: string | null = null;
  onEffect: (kind: 'set' | 'remove', key: string) => void = () => {};
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) {
    if (key === this.failCanonical) throw Error('Synthetic failure before canonical effect');
    this.rows.set(key, raw); this.onEffect('set', key);
  }
  removeItem(key: string) { this.rows.delete(key); this.onEffect('remove', key); }
}

interface Outcome {
  result: boolean | { status: string; reason?: string; writable?: boolean };
  events: Event[];
  withdrawn: boolean;
  locksHeldImmediately: number;
  original: ReadonlyMap<string, string>;
  final: ReadonlyMap<string, string>;
}
interface Fixture {
  store: ReturnType<typeof createProtectedLocalStorage>;
  storage: MemoryStorage;
  locks: ExclusiveLocks;
  source: ProtectedStorageContext;
  destination: ProtectedStorageContext;
  review: object | null;
  run(target?: Boundary, postEffect?: 'release' | 'throw'): Promise<Outcome>;
  close(): Promise<void>;
}
const fixtures = new Set<Fixture>();

async function fixture(path: Path, releaseBeforeReview = false): Promise<Fixture> {
  assert.equal(typeof window, 'undefined', 'only explicit synthetic contexts may be used');
  const storage = new MemoryStorage(), locks = new ExclusiveLocks();
  let armed = false, ordinal = 0, withdrawn = false, target: Boundary | undefined;
  let postEffect: 'release' | 'throw' | undefined, events: Event[] = [];
  let store!: ReturnType<typeof createProtectedLocalStorage>;
  const withdraw = () => { if (!withdrawn) { withdrawn = true; store.releaseAllDocumentLeases(); } };
  const context = (label: string): ProtectedStorageContext => ({ storage,
    canonicalKey: `synthetic-${label}-canonical`, receiptKey: `synthetic-${label}-receipt`, legacyKey: `synthetic-${label}-legacy`,
    isCurrent() {
      if (armed) {
        const event: Event = { kind: 'context', label, ordinal: ++ordinal, locksHeld: locks.held.size };
        events.push(event);
        if (target?.label === label && target.ordinal === event.ordinal) withdraw();
      }
      // Withdrawal changes the factory generation, even when the original
      // caller still returns true and every original storage byte stays stable.
      return true;
    },
  });
  const source = context('source'), destination = context('destination');
  store = createProtectedLocalStorage({
    legacyBaseKeys: ['synthetic-old'], canonicalBaseKey: 'synthetic-new', receiptBaseKey: 'synthetic-proof',
    eventName: 'synthetic-generation', lockPrefix: 'synthetic-generation:', changedReason: 'synthetic-changed',
    payloadField: 'journalRaw', importedField: 'importedJournalRaw', reviewedField: 'reviewedJournalRaw', exportFilename: 'synthetic.json',
    exportFields: { current: 'current', older: 'older', initial: 'initial' },
    validatePayload(raw) { try { return Array.isArray(JSON.parse(raw)); } catch { return false; } },
    importLegacy(raw) { try { return raw === null ? '[]' : Array.isArray(JSON.parse(raw)) ? raw : null; } catch { return null; } },
    legacyIsEmpty: raw => raw === null || raw === '[]',
    countRows(raw) { try { return raw === null ? null : JSON.parse(raw).length; } catch { return null; } },
  });
  storage.rows.set(source.legacyKey, '[{"id":"synthetic-original","future":{"keep":[null,false]}}]');
  storage.onEffect = (kind, key) => {
    if (!armed) return;
    events.push({ kind, key, afterWithdrawal: withdrawn, locksHeld: locks.held.size });
    if (postEffect === 'release') withdraw();
    if (postEffect === 'throw') throw Error('Synthetic exception after the actual in-memory effect');
  };
  let review: object | null = null;
  if (path === 'current' || path === 'keep') {
    assert.equal((await store.initialiseStorage(source, locks)).writable, true);
    if (releaseBeforeReview) { store.releaseAllDocumentLeases(); await locks.drain(); }
    storage.rows.set(source.legacyKey, '[{"id":"synthetic-divergent","future":{"keep":[null,false]}}]');
    const actual = store.readLegacyReview(source); assert.ok(actual); review = actual.review;
    assert.equal(store.legacyReviewIsCurrent(review, source), true);
  } else if (path === 'recovery') {
    storage.failCanonical = source.canonicalKey;
    assert.equal((await store.initialiseStorage(source, locks)).status, 'held');
    store.releaseAllDocumentLeases(); await locks.drain(); storage.failCanonical = null;
    assert.equal(storage.rows.has(source.canonicalKey), false);
    assert.equal(storage.rows.has(source.receiptKey), true, 'recovery must start from a real partial cutover receipt');
  }
  const item: Fixture = { store, storage, locks, source, destination, review,
    async run(nextTarget, nextPostEffect) {
      target = nextTarget; postEffect = nextPostEffect; ordinal = 0; withdrawn = false; events = []; armed = true;
      const original = new Map(storage.rows);
      try {
        const pending = path === 'current' ? store.legacyReviewIsCurrent(review!, source)
          : path === 'keep' ? store.keepCurrentAfterLegacyReview(review!, source, locks, () => true)
          : path === 'initialise' ? store.initialiseStorage(source, locks)
          : path === 'recovery' ? store.recoverStorage(source, locks)
          : store.transferStoragePair(source, destination, { locks });
        const locksHeldImmediately = locks.held.size;
        const result = await pending;
        return { result, events: [...events], withdrawn, locksHeldImmediately, original, final: new Map(storage.rows) };
      } finally { armed = false; }
    },
    async close() {
      armed = false; store.releaseAllDocumentLeases(); await locks.drain();
      assert.equal(locks.held.size, 0, 'every retained fake lock callback must complete'); fixtures.delete(item);
    },
  };
  fixtures.add(item); return item;
}
afterEach(async () => { for (const item of [...fixtures]) await item.close(); });

const effects = (outcome: Outcome) => outcome.events.filter((event): event is Extract<Event, { kind: 'set' | 'remove' }> => event.kind !== 'context');
const preEffectContexts = (outcome: Outcome) => {
  const first = outcome.events.findIndex(event => event.kind !== 'context');
  return outcome.events.slice(0, first < 0 ? undefined : first)
    .filter((event): event is Extract<Event, { kind: 'context' }> => event.kind === 'context');
};
function unchanged(outcome: Outcome) {
  assert.equal(outcome.final.size, outcome.original.size, 'withdrawal must neither create nor remove any evidence row');
  for (const [key, raw] of outcome.original) assert.ok(outcome.final.get(key) === raw, 'all original canonical, receipt and legacy bytes must remain exact');
}
function status(outcome: Outcome) { assert.notEqual(typeof outcome.result, 'boolean'); return outcome.result as Exclude<Outcome['result'], boolean>; }
async function ordinary(path: Path) {
  const item = await fixture(path);
  try {
    const outcome = await item.run();
    if (path === 'current') { assert.equal(outcome.result, true); assert.equal(effects(outcome).length, 0); }
    else if (path === 'keep') { assert.equal(status(outcome).status, 'kept'); assert.equal(effects(outcome).length, 1); }
    else if (path === 'initialise') { assert.equal(status(outcome).writable, true); assert.equal(effects(outcome).length, 2); }
    else if (path === 'recovery') {
      assert.equal(status(outcome).reason, 'writer-not-acquired'); assert.equal(effects(outcome).length, 1);
      assert.equal((await item.store.initialiseStorage(item.source, item.locks)).writable, true, 'recovered evidence must remain acquirable by the ordinary lifecycle');
    } else { assert.equal(status(outcome).status, 'transferred'); assert.equal(effects(outcome).length, 3); }
    const destination = path === 'transfer' ? item.destination : item.source;
    if (path !== 'current') {
      const canonical = JSON.parse(item.storage.rows.get(destination.canonicalKey)!);
      assert.deepEqual(JSON.parse(canonical.journalRaw)[0].future, { keep: [null, false] });
    }
    return outcome;
  } finally { await item.close(); }
}

test('a legacy review withdrawn by its final true context callback is immediately stale without changing evidence', async () => {
  const boundary = preEffectContexts(await ordinary('current')).at(-1); assert.ok(boundary);
  const item = await fixture('current'), outcome = await item.run(boundary);
  assert.equal(outcome.withdrawn, true); assert.equal(outcome.result, false);
  assert.equal(effects(outcome).length, 0); unchanged(outcome);
  assert.equal(item.store.legacyReviewIsCurrent(item.review!, item.source), false);
  assert.equal(outcome.locksHeldImmediately, 1, 'private withdrawal must not pretend the asynchronous lock callback completed synchronously');
});

test('a keep acknowledgement withdrawn during its final review capture is superseded before any setItem', async () => {
  const boundary = preEffectContexts(await ordinary('keep')).at(-1); assert.ok(boundary);
  const item = await fixture('keep'), outcome = await item.run(boundary);
  assert.equal(outcome.withdrawn, true); assert.equal(status(outcome).status, 'superseded');
  assert.equal(status(outcome).reason, 'review-changed'); assert.equal(effects(outcome).length, 0); unchanged(outcome);
  assert.equal(outcome.locksHeldImmediately, 1);
});

test('withdrawal in the final post-effect keep context callback cannot confirm an acknowledgement as kept', async () => {
  const baseline = await ordinary('keep');
  const firstEffect = baseline.events.findIndex(event => event.kind !== 'context'); assert.ok(firstEffect >= 0);
  const boundary = baseline.events.slice(firstEffect + 1)
    .filter((event): event is Extract<Event, { kind: 'context' }> => event.kind === 'context').at(-1);
  assert.ok(boundary, 'the ordinary confirmation must expose its actual final post-effect callback');
  const item = await fixture('keep'), outcome = await item.run(boundary);
  assert.equal(outcome.withdrawn, true); assert.equal(status(outcome).status, 'superseded');
  assert.equal(status(outcome).reason, 'written-review-changed'); assert.equal(effects(outcome).length, 1);
  assert.equal(effects(outcome)[0].afterWithdrawal, false, 'the acknowledgement preceded withdrawal; it must remain an uncertain effect');
  assert.equal(effects(outcome)[0].locksHeld, 1);
  assert.ok(outcome.final.get(item.source.canonicalKey) !== outcome.original.get(item.source.canonicalKey));
  for (const key of [item.source.receiptKey, item.source.legacyKey]) assert.ok(outcome.final.get(key) === outcome.original.get(key));
  assert.ok(JSON.parse(item.storage.rows.get(item.source.canonicalKey)!).legacyAcknowledgement);
  assert.equal(item.store.readStorage(item.source).reason, 'write-unconfirmed');
});

test('a fresh legacy review after document lease release can keep under the supplied exclusive lock', async () => {
  const item = await fixture('keep', true);
  assert.equal(item.locks.held.size, 0, 'the original document lease and its retained callback must already be released');
  assert.equal(item.store.captureStorageLease(item.source), null);
  assert.equal(item.store.legacyReviewIsCurrent(item.review!, item.source), true);
  const outcome = await item.run();
  assert.equal(status(outcome).status, 'kept'); assert.equal(outcome.withdrawn, false);
  assert.equal(effects(outcome).length, 1); assert.equal(effects(outcome)[0].locksHeld, 1);
  for (const key of [item.source.receiptKey, item.source.legacyKey]) assert.ok(outcome.final.get(key) === outcome.original.get(key));
  const canonical = JSON.parse(item.storage.rows.get(item.source.canonicalKey)!);
  assert.ok(canonical.legacyAcknowledgement);
  assert.deepEqual(JSON.parse(canonical.journalRaw)[0].future, { keep: [null, false] });
  assert.equal(item.locks.held.size, 0, 'the supplied one-operation exclusive callback completes after the keep');
  assert.equal(item.store.readStorage(item.source).reason, 'writer-not-acquired');
});

for (const postEffect of ['release', 'throw'] as const) {
  test(`keep ${postEffect} after its acknowledgement effect remains one unconfirmed write rather than a zero-effect hold`, async () => {
    const item = await fixture('keep'), outcome = await item.run(undefined, postEffect);
    assert.equal(status(outcome).status, 'superseded'); assert.equal(status(outcome).reason, 'written-review-changed');
    assert.equal(effects(outcome).length, 1); assert.equal(effects(outcome)[0].locksHeld, 1);
    assert.ok(outcome.final.get(item.source.canonicalKey) !== outcome.original.get(item.source.canonicalKey));
    for (const key of [item.source.receiptKey, item.source.legacyKey]) assert.ok(outcome.final.get(key) === outcome.original.get(key));
    assert.ok(JSON.parse(item.storage.rows.get(item.source.canonicalKey)!).legacyAcknowledgement);
    assert.equal(item.store.readStorage(item.source).reason, 'write-unconfirmed');
  });
}

for (const path of ['initialise', 'recovery', 'transfer'] as const) {
  test(`${path} withdrawal in its final generation-wrapped true callback holds with zero effects and exact original evidence`, async () => {
    const baseline = await ordinary(path), boundary = preEffectContexts(baseline).at(-1); assert.ok(boundary);
    assert.ok(boundary.locksHeld > 0, 'discover the final callback under the operation locks, after generation capture');
    const item = await fixture(path), outcome = await item.run(boundary);
    assert.equal(outcome.withdrawn, true); assert.equal(status(outcome).status, 'held');
    assert.equal(effects(outcome).length, 0); unchanged(outcome);
  });
  test(`${path} withdrawal after the first actual effect retains partial recovery evidence without silently continuing`, async () => {
    const item = await fixture(path), outcome = await item.run(undefined, 'release');
    assert.equal(outcome.withdrawn, true); assert.equal(status(outcome).status, 'held');
    const actual = effects(outcome); assert.equal(actual.length, 1); assert.equal(actual[0].kind, 'set');
    assert.ok(actual[0].locksHeld > 0); assert.ok(outcome.final.has(actual[0].key));
    assert.ok(outcome.final.get(item.source.legacyKey) === outcome.original.get(item.source.legacyKey));
    for (const [key, raw] of outcome.original) if (key !== actual[0].key) assert.ok(outcome.final.get(key) === raw);
    if (path === 'recovery') assert.equal(outcome.final.has(item.source.canonicalKey), true);
    else {
      const destination = path === 'transfer' ? item.destination : item.source;
      assert.equal(outcome.final.has(destination.receiptKey), true); assert.equal(outcome.final.has(destination.canonicalKey), false);
    }
  });
}

for (const path of ['initialise', 'transfer'] as const) {
  test(`${path} withdrawal before generation capture may start a new ordinary operation without erasing evidence`, async () => {
    const baseline = await ordinary(path), boundary = preEffectContexts(baseline).find(event => event.locksHeld === 0); assert.ok(boundary);
    const item = await fixture(path), outcome = await item.run(boundary);
    assert.equal(outcome.withdrawn, true);
    if (path === 'initialise') assert.equal(status(outcome).writable, true);
    else assert.equal(status(outcome).status, 'transferred');
    assert.equal(effects(outcome).length, effects(baseline).length);
    const destination = path === 'transfer' ? item.destination : item.source;
    const canonical = JSON.parse(item.storage.rows.get(destination.canonicalKey)!);
    assert.deepEqual(JSON.parse(canonical.journalRaw)[0].future, { keep: [null, false] });
  });
}
