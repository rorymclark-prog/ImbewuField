import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedLocalStorage, type ProtectedStorageContext, type ProtectedStorageLocks,
  type ProtectedStorageWriteReceipt } from '../lib/protected-local-storage.ts';

type BoundaryKind = 'source' | 'context' | 'read';
interface Boundary { kind: BoundaryKind; ordinal: number; key?: string }
interface TraceEvent { kind: BoundaryKind | 'effect'; ordinal: number; beforeEffect: boolean; key?: string }
interface Operation {
  receipt: ProtectedStorageWriteReceipt;
  events: TraceEvent[];
  attempts: number;
  withdrew: boolean;
  effectWhileLockHeld: boolean[];
}

class MemoryStorage {
  readonly rows = new Map<string, string>();
  onRead: (key: string) => void = () => {};
  onAttempt: (key: string) => void = () => {};
  afterEffect: () => void = () => {};
  getItem(key: string) {
    const raw = this.rows.get(key) ?? null;
    this.onRead(key);
    return raw;
  }
  setItem(key: string, raw: string) {
    this.onAttempt(key);
    this.rows.set(key, raw);
    this.afterEffect();
  }
  removeItem(key: string) { this.rows.delete(key); }
}

class ExclusiveLocks implements ProtectedStorageLocks {
  readonly held = new Set<string>();
  private readonly completions = new Set<Promise<void>>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return callback(null);
    let complete!: () => void;
    const finished = new Promise<void>(resolve => { complete = resolve; });
    this.completions.add(finished); this.held.add(name);
    // Releasing a private lease resolves the retained callback. It does not
    // synchronously release the LockManager's exclusive lock inside that call.
    try { return await callback({ name }); }
    finally { this.held.delete(name); this.completions.delete(finished); complete(); }
  }
  async drain() { await Promise.all([...this.completions]); }
}

interface Fixture {
  store: ReturnType<typeof createProtectedLocalStorage>;
  context: ProtectedStorageContext;
  storage: MemoryStorage;
  locks: ExclusiveLocks;
  original: ReadonlyMap<string, string | null>;
  nextRaw: string;
  lease: object;
  perform(target?: Boundary, afterEffect?: 'release' | 'throw'): Operation;
  close(): Promise<void>;
}
const fixtures = new Set<Fixture>();

async function fixture(): Promise<Fixture> {
  assert.equal(typeof window, 'undefined', 'this regression uses only explicit non-browser contexts');
  const storage = new MemoryStorage(), locks = new ExclusiveLocks();
  const legacyRaw = ' [ {"id":"synthetic-retained","future":{"keep":[null,"unchanged"]}} ] ';
  const nextRaw = JSON.stringify([...JSON.parse(legacyRaw), { id: 'synthetic-appended' }]);
  let active = false, effectSeen = false, withdrew = false, attempts = 0;
  let target: Boundary | undefined, postEffect: 'release' | 'throw' | undefined;
  let ordinals: Record<BoundaryKind, number> = { source: 0, context: 0, read: 0 };
  let events: TraceEvent[] = [], effectWhileLockHeld: boolean[] = [];
  let store!: ReturnType<typeof createProtectedLocalStorage>;
  const withdraw = () => { if (!withdrew) { withdrew = true; store.releaseAllDocumentLeases(); } };
  const boundary = (kind: BoundaryKind, key?: string) => {
    if (!active) return;
    const ordinal = ++ordinals[kind];
    events.push({ kind, ordinal, beforeEffect: !effectSeen, ...(key === undefined ? {} : { key }) });
    if (!withdrew && target?.kind === kind && target.ordinal === ordinal
      && (target.key === undefined || target.key === key)) withdraw();
  };
  const context: ProtectedStorageContext = {
    storage, legacyKey: 'synthetic-journal-old', canonicalKey: 'synthetic-journal-new', receiptKey: 'synthetic-journal-proof',
    isCurrent: () => { boundary('context'); return true; },
  };
  storage.rows.set(context.legacyKey, legacyRaw);
  store = createProtectedLocalStorage({
    legacyBaseKeys: ['old'], canonicalBaseKey: 'new', receiptBaseKey: 'proof',
    eventName: 'synthetic-final-lease', lockPrefix: 'synthetic-final-lease:', changedReason: 'journal-changed',
    payloadField: 'journalRaw', importedField: 'importedJournalRaw', reviewedField: 'reviewedJournalRaw', exportFilename: 'synthetic-copies.json',
    exportFields: { current: 'current', older: 'older', initial: 'initial' },
    validatePayload(raw) { try { return Array.isArray(JSON.parse(raw)); } catch { return false; } },
    importLegacy(raw) { try { return raw === null ? '[]' : Array.isArray(JSON.parse(raw)) ? raw : null; } catch { return null; } },
    legacyIsEmpty: raw => raw === null || raw === '[]', countRows: raw => raw === null ? null : JSON.parse(raw).length,
  });
  storage.onRead = key => boundary('read', key);
  storage.onAttempt = key => {
    if (!active) return;
    attempts++; effectSeen = true;
    events.push({ kind: 'effect', ordinal: attempts, beforeEffect: false, key });
    effectWhileLockHeld.push(locks.held.size === 1);
  };
  storage.afterEffect = () => {
    if (!active) return;
    if (postEffect === 'release') withdraw();
    if (postEffect === 'throw') throw Error('Synthetic exception after the in-memory setItem effect');
  };
  const status = await store.initialiseStorage(context, locks);
  assert.equal(status.writable, true);
  const before = store.readStorage(context), lease = store.captureStorageLease(context);
  assert.equal(before.writable, true); assert.ok(before.token); assert.ok(lease);
  const token = before.token;
  const original = new Map([context.canonicalKey, context.receiptKey, context.legacyKey].map(key => [key, storage.rows.get(key) ?? null]));
  const result: Fixture = {
    store, context, storage, locks, original, nextRaw, lease,
    perform(nextTarget, afterEffect) {
      target = nextTarget; postEffect = afterEffect; active = true; effectSeen = false; withdrew = false; attempts = 0;
      ordinals = { source: 0, context: 0, read: 0 }; events = []; effectWhileLockHeld = [];
      try {
        const receipt = store.writeStorageRaw(nextRaw, token, context, () => { boundary('source'); return true; });
        return { receipt, attempts, withdrew, events: [...events], effectWhileLockHeld: [...effectWhileLockHeld] };
      } finally { active = false; }
    },
    async close() {
      active = false; store.releaseAllDocumentLeases(); await locks.drain();
      assert.equal(locks.held.size, 0, 'the fixture must release its real retained lock callback'); fixtures.delete(result);
    },
  };
  fixtures.add(result); return result;
}

afterEach(async () => { for (const item of [...fixtures]) await item.close(); });

async function ordinaryPreEffectBoundaries(): Promise<Boundary[]> {
  const item = await fixture();
  try {
    const operation = item.perform();
    assert.equal(operation.receipt.status, 'written'); assert.equal(operation.attempts, 1);
    return operation.events.filter((event): event is TraceEvent & { kind: BoundaryKind } => event.beforeEffect && event.kind !== 'effect')
      .map(({ kind, ordinal, key }) => ({ kind, ordinal, ...(key === undefined ? {} : { key }) }));
  } finally { await item.close(); }
}

function unchangedCopies(item: Fixture) {
  for (const [key, original] of item.original) {
    assert.ok((item.storage.rows.get(key) ?? null) === original, 'a held append must preserve the original canonical, receipt and older evidence bytes');
  }
}

test('a current leased append writes once and retains older evidence and unknown existing fields', async () => {
  const item = await fixture();
  assert.equal(item.store.storageLeaseMatches(item.lease, item.context), true);
  const operation = item.perform();
  assert.equal(operation.receipt.status, 'written'); assert.equal(operation.attempts, 1); assert.equal(operation.withdrew, false);
  assert.deepEqual(operation.effectWhileLockHeld, [true]);
  const canonical = JSON.parse(item.storage.rows.get(item.context.canonicalKey)!);
  assert.ok(canonical.journalRaw === item.nextRaw);
  assert.deepEqual(JSON.parse(canonical.journalRaw)[0].future, { keep: [null, 'unchanged'] });
  for (const key of [item.context.receiptKey, item.context.legacyKey]) assert.ok(item.storage.rows.get(key) === item.original.get(key));
  assert.equal(item.store.storageLeaseMatches(item.lease, item.context), true);
  assert.equal(item.locks.held.size, 1);
});

test('withdrawal from each discovered pre-effect source guard holds without attempting an append even when the guard returns true', async () => {
  const boundaries = (await ordinaryPreEffectBoundaries()).filter(boundary => boundary.kind === 'source');
  assert.ok(boundaries.length > 0, 'an ordinary append must expose its actual source-guard boundaries');
  for (const target of boundaries) {
    const item = await fixture();
    try {
      const operation = item.perform(target);
      assert.equal(operation.withdrew, true, `source guard opportunity ${target.ordinal} must be reached`);
      assert.equal(operation.receipt.status, 'held', `source guard opportunity ${target.ordinal} withdrew before any effect`);
      assert.equal(operation.attempts, 0); unchangedCopies(item);
      assert.equal(item.store.storageLeaseMatches(item.lease, item.context), false);
      assert.equal(item.locks.held.size, 1, 'private withdrawal is immediate; LockManager completion is asynchronous');
    } finally { await item.close(); }
  }
});

test('withdrawal from the last discovered pre-effect getItem preserves stable read bytes without spending the withdrawn lease', async () => {
  const reads = (await ordinaryPreEffectBoundaries()).filter(boundary => boundary.kind === 'read');
  const target = reads[reads.length - 1]; assert.ok(target);
  const item = await fixture(), operation = item.perform(target);
  assert.equal(operation.withdrew, true); assert.equal(operation.receipt.status, 'held'); assert.equal(operation.attempts, 0);
  unchangedCopies(item); assert.equal(item.store.storageLeaseMatches(item.lease, item.context), false);
  assert.equal(item.locks.held.size, 1);
});

test('withdrawal from the last discovered pre-effect context callback holds even though context identity and bytes stay unchanged', async () => {
  const contexts = (await ordinaryPreEffectBoundaries()).filter(boundary => boundary.kind === 'context');
  const target = contexts[contexts.length - 1]; assert.ok(target);
  const item = await fixture(), operation = item.perform(target);
  assert.equal(operation.withdrew, true); assert.equal(operation.receipt.status, 'held'); assert.equal(operation.attempts, 0);
  unchangedCopies(item); assert.equal(item.context.isCurrent(), true);
  assert.equal(item.store.storageLeaseMatches(item.lease, item.context), false); assert.equal(item.locks.held.size, 1);
});

for (const afterEffect of ['release', 'throw'] as const) {
  test(`${afterEffect} after the actual in-memory setItem remains one uncertain effect rather than a retryable held append`, async () => {
    const item = await fixture(), operation = item.perform(undefined, afterEffect);
    assert.equal(operation.receipt.status, 'unconfirmed'); assert.equal(operation.attempts, 1);
    assert.deepEqual(operation.effectWhileLockHeld, [true]);
    const canonical = JSON.parse(item.storage.rows.get(item.context.canonicalKey)!);
    assert.ok(canonical.journalRaw === item.nextRaw);
    assert.deepEqual(JSON.parse(canonical.journalRaw)[0].future, { keep: [null, 'unchanged'] });
    for (const key of [item.context.receiptKey, item.context.legacyKey]) assert.ok(item.storage.rows.get(key) === item.original.get(key));
    assert.equal(item.store.readStorage(item.context).reason, 'write-unconfirmed');
    assert.equal(item.store.storageLeaseMatches(item.lease, item.context), false);
    assert.equal(item.locks.held.size, 1, 'the retained lock callback has not synchronously completed');
    assert.equal(operation.events.filter(event => event.kind === 'effect').length, 1);
  });
}
