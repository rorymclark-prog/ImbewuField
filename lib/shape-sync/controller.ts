// Shape sync v2 controller — one per (mounted account | sample | guest) namespace.
//
// PASS 2 (adversarial review) changed the durability model; see docs/shape-sync-v2/PASS2.md.
//
// Durable state lives in ONE KEY PER ITEM, never in a shared array that a writer rewrites:
//   <journal>:<opId>     a pending op (written once by its author; removed only after the server
//                        has recorded it). Several tabs of the same account share the namespace; a
//                        write by one tab can never erase another tab's op (pass 1 rewrote a single
//                        queue array from each tab's memory — negative control NC1).
//   <ack>:<opId>         "this op was durably removed from the journal" — reported to the server,
//                        which only then drops the op's idempotency entry (protocol pruneAcked).
//   <rejected>:<opId>    the full raw op the server refused. Kept until exported. Never trimmed.
//   <quarantine>:<id>    an unreadable feature/op, raw. Never trimmed (pass 1 kept the last 200).
//   <backup>:<digest>    a verbatim copy of a raw v1 cache, written BEFORE that cache may be
//                        overwritten; pruned only once every feature in it is recorded server-side.
//
// The v1 key (FARM_KEY) is a DERIVED cache of the view, marked in-band so a raw v1 write by an old
// tab is recognisable. Before every overwrite the controller checks it: raw content is backed up
// and folded into the journal first; if that cannot be made durable, the raw cache is LEFT IN
// PLACE (status.rawCacheHeld) and the map paints from the controller view instead.
//
// Transaction step: the batch is re-validated against durable storage INSIDE the step, so an op
// another tab has already flushed, acknowledged and had pruned is never applied a second time.
//
// It does no Firestore I/O itself. The transport is injected (lib/user-sync.ts
// createShapeSyncTransport), so user-sync.ts stays the single sync authority. Sample mode and
// signed-out sessions get transport=null: local-only, nothing can leave.

import type { Feature, FeatureCollection } from 'geojson';
import {
  shapeDocFits, DEFAULT_RETENTION,
  applyOps, assignLegacyIds, canonicalJson, cloneJson, compactState, contentDigest, contentFromFeature,
  decideIslandDrain, diffContent, digest, featureFromContent, genesisState, importShapeId, isPlainObject,
  isValidShapeId, legacyIslandOps, listConflicts, materializeLive, parseRemoteDoc, pruneAcked, sameContent,
  serializeState, touchDevice, validateOp, validateState,
  type ConflictView, type OpOutcome, type OpSource, type QuarantinedFeature, type RemoteShapeDoc,
  type ResolveChoice, type RetentionPolicy, type ShapeOp, type ShapeStoreState, type ShapeContent,
} from './protocol';

export const SHAPE_SYNC_BASE_KEYS = {
  journal: 'imbewu_shape_op_v2',
  ack: 'imbewu_shape_ack_v2',
  rejected: 'imbewu_shape_rejected_v2',
  quarantine: 'imbewu_shape_quarantine_v2',
  backup: 'imbewu_farm_shapes_v1_backup',
  state: 'imbewu_shape_state_v2',
  device: 'imbewu_shape_device_v2',
  /** The v1 key. A derived cache of the v2 view once v2 runs (marked with DERIVED_VIEW_MARK). */
  farmCache: 'imbewu_farm_shapes',
  /** Pass-1 single-array queue (never deployed). Imported into the journal, removed only after. */
  pass1Queue: 'imbewu_shape_ops_v2',
} as const;

type Family = 'journal' | 'ack' | 'rejected' | 'quarantine' | 'backup';
const FAMILIES: Family[] = ['journal', 'ack', 'rejected', 'quarantine', 'backup'];
const OWNER_SEPARATOR = '::imbewu-owner::'; // mirrors lib/account-local-storage.ts

export interface ShapeSyncKeys {
  state: string;
  device: string;
  farmCache: string;
  pass1Queue: string;
  /** Physical key of one item of a family. */
  item(family: Family, id: string): string;
  /** Parse a physical key back to (family, id) if it belongs to THIS namespace. */
  match(physical: string): { family: Family; id: string } | null;
}

/**
 * Resolve every key ONCE through the caller's account-scoping function (bind, don't sample).
 * The namespace suffix is derived by probing keyFor, so prefix-keyed items stay account-scoped
 * exactly like lib/account-local-storage.ts accountLocalStorageKey(base, uid).
 */
export function shapeSyncKeys(keyFor: (baseKey: string) => string): ShapeSyncKeys {
  const probe = '\u0001probe';
  const probed = keyFor(probe);
  const suffix = probed.startsWith(probe) ? probed.slice(probe.length) : null;
  const item = (family: Family, id: string) => keyFor(`${SHAPE_SYNC_BASE_KEYS[family]}:${id}`);
  return {
    state: keyFor(SHAPE_SYNC_BASE_KEYS.state),
    device: keyFor(SHAPE_SYNC_BASE_KEYS.device),
    farmCache: keyFor(SHAPE_SYNC_BASE_KEYS.farmCache),
    pass1Queue: keyFor(SHAPE_SYNC_BASE_KEYS.pass1Queue),
    item,
    match(physical) {
      if (suffix === null) return null;
      for (const family of FAMILIES) {
        const prefix = `${SHAPE_SYNC_BASE_KEYS[family]}:`;
        if (!physical.startsWith(prefix) || !physical.endsWith(suffix)) continue;
        const id = physical.slice(prefix.length, physical.length - suffix.length);
        // A bare (sample / backend-less) namespace must not claim another owner's rows.
        if (!id || id.includes(OWNER_SEPARATOR)) continue;
        if (keyFor(`${prefix}${id}`) !== physical) continue;
        return { family, id };
      }
      return null;
    },
  };
}

/** localStorage is enumerable (length/key); a minimal fake may not be — then only own keys are seen. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

export interface TransactStep<R> { write: RemoteShapeDoc | null; result: R; deleteIsland?: boolean }

/** The v1 island document as read INSIDE a transaction (only when requested). */
export interface IslandRead { exists: boolean; shapesJson: unknown; version: number }

export interface ShapeTransport {
  /**
   * Optimistic read-modify-write of the shapes_v2 document. `step` receives the current document
   * data (or null if absent) — and, when opts.island is set, the v1 island read in the SAME
   * transaction — and may be invoked more than once under contention, so it must be pure apart from
   * synchronous storage reads. Resolves with the committed attempt's result; rejects when
   * offline/denied. `deleteIsland` deletes the island in that same transaction.
   */
  transact<R>(step: (current: unknown, island?: IslandRead) => TransactStep<R>, opts?: { island?: boolean }): Promise<R>;
}

export type BlockReason = 'remote-corrupt' | 'protocol-newer' | 'remote-missing' | 'store-replaced' | 'too-large';

export interface ShapeSyncStatus {
  /** 'volatile' = at least one op could not be written to this device; keep the page open. */
  durability: 'durable' | 'volatile';
  /** Pass 3: how many volatile ops are held in the FARM_KEY fallback carry (survive a reload). Still
   *  'volatile': no journal row, so this is never reported as a normal durable save. */
  fallbackHeld: number;
  /** Ops with no journal row (memory, and possibly the carry). */
  volatileOps: number;
  pending: number;
  transport: 'available' | 'none';
  blocked: BlockReason | null;
  lastError: string | null;
  /** Durable count of refused ops kept raw in storage (survives reload). */
  rejected: number;
  /** A refused op whose raw copy could NOT be stored is kept in the journal instead. */
  rejectedRetentionFailures: number;
  deferred: Array<{ opId: string; shapeId: string; reason: string }>;
  conflicts: number;
  /** Journal rows that failed to parse. Left in place, exported, never deleted automatically. */
  invalidJournal: number;
  /** A raw v1 cache could not be backed up / journaled, so it was not overwritten. */
  rawCacheHeld: boolean;
  quarantineWriteFailures: number;
  /** seq of the last state this controller saw COMMITTED by its own flush, or null. */
  lastCommittedSeq: number | null;
  flushing: boolean;
  islandDrain: string | null;
}

export type ViewReason = 'local' | 'remote' | 'reset';

export interface ControllerOptions {
  keys: ShapeSyncKeys;
  storage: StorageLike;
  transport: ShapeTransport | null;
  isCurrent: () => boolean;
  now: () => number;
  randomId: () => string;
  onView?: (reason: ViewReason) => void;
  onConflicts?: (conflicts: ConflictView[]) => void;
  onStatus?: (status: ShapeSyncStatus) => void;
  flushDelayMs?: number;
  schedule?: (fn: () => void, ms: number) => () => void;
  retention?: RetentionPolicy;
  /** Delete the v1 island after an atomic, complete ingest (decideIslandDrain). Default OFF (G13). */
  drainLegacyIsland?: boolean;
}

export interface EditBasis {
  shapeId: string;
  baseRev: number;
  baseSeq: number;
  deps: string[];
  base: ShapeContent;
  current: ShapeContent;
}

export type RecordResult =
  | { ok: true; opIds: string[]; durable: boolean; noop?: boolean }
  | { ok: false; reason: 'account-changed' | 'invalid-feature' | 'invalid-id' | 'id-in-use' | 'not-live' | 'disposed'; detail?: string };

export type FlushReport =
  | { kind: 'committed'; outcomes: OpOutcome[]; islandDrained?: boolean }
  | { kind: 'idle' | 'skipped' | 'account-changed' | 'queued-again' }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'error'; message: string };

type StepResult =
  | { kind: 'committed'; state: ShapeStoreState; outcomes: OpOutcome[]; acked: string[]; drained: boolean; drainReason: string | null; islandRetry: boolean }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'account-changed' };

/** lc = Lamport counter: 1 + the highest lc this writer had LOADED when it recorded the op. Any op a
 *  tab saw (its view, hence its edit basis and deps) therefore sorts before every op it records after. */
interface JournalEntry {
  v: 2; op: ShapeOp; writer: string; wseq: number; lc: number;
  /** Pass 3: this op was once volatile and may have been copied into other tabs' memory via the
   *  FARM_KEY carry, so its server dedupe entry is never ack-pruned (no ack row is ever written). */
  fb?: 1;
}
interface Pending { key: string | null; entry: JournalEntry; volatile: boolean }

/** In-band marker on the derived FARM_KEY cache. Ignored by every reader (normaliseFarmShapeCollection
 *  rebuilds {type, features}; Map.tsx paints `{type, features}` only). Absent ⇒ raw v1 content. */
export const DERIVED_VIEW_MARK = 'imbewuShapeSyncView';

export interface ShapeSyncController {
  readonly device: string;
  start(): void;
  /** Re-read durable state written by other tabs (wire to the window 'storage' event). */
  refresh(): void;
  view(): FeatureCollection;
  feature(shapeId: string): Feature | null;
  captureBasis(shapeId: string): EditBasis | null;
  create(feature: Feature, source: OpSource): RecordResult;
  update(basis: EditBasis, after: Feature, source: OpSource): RecordResult;
  remove(shapeIds: readonly string[], source: OpSource, bases?: ReadonlyMap<string, EditBasis>): RecordResult;
  resolve(shapeId: string, conflictId: string, choice: ResolveChoice): RecordResult;
  importShared(fc: unknown, code: string): { result: RecordResult; imported: number; skipped: number; quarantined: number };
  ingestLegacyIsland(shapesJson: unknown, islandVersion: number): RecordResult;
  receiveRemote(raw: unknown): void;
  flush(): Promise<FlushReport>;
  nudge(): void;
  conflicts(): ConflictView[];
  status(): ShapeSyncStatus;
  exportRecovery(): string;
  dispose(): void;
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function createShapeSyncController(opts: ControllerOptions): ShapeSyncController {
  const { keys, storage } = opts;
  const retention = opts.retention ?? DEFAULT_RETENTION;
  const schedule = opts.schedule ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); });
  const flushDelayMs = opts.flushDelayMs ?? 400;

  let device = '';
  const writer = `wr-${opts.randomId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  let wseq = 0;
  let lamport = 0;
  let server: ShapeStoreState | null = null;
  /** Journal entries this instance wrote or saw (needed when storage is not enumerable). */
  const known = new Map<string, JournalEntry>();
  /** Ops that could not be written as journal rows. Pass 3: each is ALSO carried inside the derived
   *  FARM_KEY value (same setItem as the view), and re-read from there on start/refresh. */
  const volatile = new Map<string, JournalEntry>();
  /** Volatile op ids the last successful FARM_KEY write (or read) carries. */
  let carriedIds = new Set<string>();
  /** Rejected-op records this instance wrote (counted even if storage cannot be enumerated). */
  const rejectedIds = new Set<string>();
  let pending: Pending[] = [];
  let invalidJournal = 0;
  let blocked: BlockReason | null = null;
  let lastError: string | null = null;
  let deferred: ShapeSyncStatus['deferred'] = [];
  let rejectedRetentionFailures = 0;
  let quarantineWriteFailures = 0;
  let rawCacheHeld = false;
  let lastCommittedSeq: number | null = null;
  let islandDrain: string | null = null;
  let islandDirty = false;
  let viewState: ShapeStoreState = genesisState('local-view');
  let viewOutcomes = new Map<string, OpOutcome>();
  let lastConflictsJson = '[]';
  let started = false;
  let disposed = false;
  let inflight: Promise<FlushReport> | null = null;
  let flushAgain = false;
  let cancelTimer: (() => void) | null = null;
  let backoffMs = 2000;

  const current = () => !disposed && opts.isCurrent();
  const newOpId = () => `op-${opts.randomId()}`;

  function safeSet(key: string, value: string): boolean {
    if (!current()) return false;
    try { storage.setItem(key, value); return true; } catch { return false; }
  }
  function safeGet(key: string): string | null {
    try { return storage.getItem(key); } catch { return null; }
  }
  function safeRemove(key: string): boolean {
    if (!current()) return false;
    try { storage.removeItem(key); } catch { return false; }
    return safeGet(key) === null;
  }
  /** Every physical key of a family in this namespace (empty if storage is not enumerable). */
  function scan(family: Family): Array<{ key: string; id: string }> {
    const out: Array<{ key: string; id: string }> = [];
    try {
      const len = typeof storage.length === 'number' ? storage.length : 0;
      if (typeof storage.key !== 'function') return out;
      for (let i = 0; i < len; i++) {
        const k = storage.key(i);
        if (!k) continue;
        const m = keys.match(k);
        if (m && m.family === family) out.push({ key: k, id: m.id });
      }
    } catch { /* not enumerable here */ }
    return out;
  }
  function familyIds(family: Family, extra: Iterable<string> = []): Map<string, string> {
    const found = new Map<string, string>();
    for (const { key, id } of scan(family)) found.set(id, key);
    for (const id of extra) { const key = keys.item(family, id); if (!found.has(id) && safeGet(key) !== null) found.set(id, key); }
    return found;
  }

  // ── Journal ──

  function parseEntry(raw: string | null): JournalEntry | null {
    if (raw === null) return null;
    try {
      const e = JSON.parse(raw) as JournalEntry;
      if (e && e.v === 2 && typeof e.writer === 'string' && Number.isInteger(e.wseq) && Number.isInteger(e.lc) && validateOp(e.op) === null) return e;
    } catch { /* invalid */ }
    return null;
  }
  function loadPending(): Pending[] {
    const rows = familyIds('journal', known.keys());
    const validRows = new Set<string>();
    let invalid = 0;
    const out: Pending[] = [];
    for (const [id, key] of rows) {
      const entry = parseEntry(safeGet(key));
      if (!entry || entry.op.opId !== id) { if (safeGet(key) !== null) invalid += 1; known.delete(id); continue; }
      known.set(id, entry);
      out.push({ key, entry, volatile: false });
      validRows.add(id);
    }
    // Pass 3: typed ops carried in the derived FARM_KEY (written when their journal row could not be).
    // Ingested as volatile unless a journal row now holds them or the confirmed state recorded them.
    for (const entry of readCarry()) {
      const id = entry.op.opId;
      if (validRows.has(id) || volatile.has(id) || server?.applied[id]) continue;
      volatile.set(id, { ...entry, fb: 1 });
    }
    for (const id of [...volatile.keys()]) if (validRows.has(id)) volatile.delete(id); // another tab (or a retry) gave it a row
    for (const entry of volatile.values()) out.push({ key: null, entry, volatile: true });
    invalidJournal = invalid;
    // Causal order without a clock: lc (Lamport) first — an op recorded after its tab loaded another
    // writer's op (another tab, or this tab before a reload) always sorts after it, so an edit never
    // precedes the create/edit it was based on. Ties are concurrent; (writer, wseq) breaks them.
    for (const p of out) if (p.entry.lc > lamport) lamport = p.entry.lc;
    out.sort((a, b) => a.entry.lc - b.entry.lc
      || (a.entry.writer < b.entry.writer ? -1 : a.entry.writer > b.entry.writer ? 1 : a.entry.wseq - b.entry.wseq));
    return out;
  }
  /** Write ops one key each. Returns true only if every op is durably stored. */
  function journalWrite(ops: ShapeOp[]): boolean {
    let allDurable = true;
    for (const op of ops) {
      const entry: JournalEntry = { v: 2, op, writer, wseq: ++wseq, lc: ++lamport };
      const key = keys.item('journal', op.opId);
      if (safeSet(key, JSON.stringify(entry))) { known.set(op.opId, entry); volatile.delete(op.opId); }
      else { volatile.set(op.opId, { ...entry, fb: 1 }); allDurable = false; }
    }
    return allDurable;
  }

  /**
   * The server recorded these ops. Order of durable effects: (1) raw copy of a refusal, (2) remove
   * the journal row, (3) ack record. A failure at (1) keeps the row; at (2) the row replays later as
   * a harmless duplicate; at (3) the server simply keeps the dedupe entry longer. Never the reverse.
   */
  function ackRecorded(state: ShapeStoreState): void {
    for (const p of pending) {
      const applied = state.applied[p.entry.op.opId];
      if (!applied) continue;
      const opId = p.entry.op.opId;
      if (applied.outcome === 'rejected') {
        const rec = { op: p.entry.op, reason: applied.reason ?? 'rejected', seq: applied.seq, writer: p.entry.writer };
        if (!safeSet(keys.item('rejected', opId), JSON.stringify(rec))) { rejectedRetentionFailures += 1; continue; }
        rejectedIds.add(opId);
      }
      // A once-volatile op (fb) may still sit in another tab's memory: never report an ack for it, so
      // its dedupe entry stays and any late replay is a harmless duplicate.
      if (p.volatile) { volatile.delete(opId); continue; }
      if (p.key && safeRemove(p.key)) {
        known.delete(opId);
        if (!p.entry.fb && !safeSet(keys.item('ack', opId), '1')) { /* no prune report: the dedupe entry just lives on */ }
      }
    }
  }

  // ── Cached confirmed state ──

  function persistServer(): void {
    if (server) safeSet(keys.state, JSON.stringify({ v: 1, server }));
  }
  function quarantine(items: QuarantinedFeature[], origin: string, extra: Record<string, unknown> = {}): void {
    for (const q of items) {
      const id = digest(`${origin}|${q.index}|${q.raw}`);
      const key = keys.item('quarantine', id);
      if (safeGet(key) !== null) continue;
      if (!safeSet(key, JSON.stringify({ ...q, origin, at: opts.now(), ...extra }))) quarantineWriteFailures += 1;
    }
  }

  // ── View + derived v1 cache ──

  function recomputeView(): void {
    pending = loadPending();
    const base = server ?? genesisState('local-view');
    const { state, outcomes } = applyOps(base, pending.map((p) => p.entry.op));
    viewState = state;
    viewOutcomes = new Map(outcomes.map((o) => [o.opId, o]));
  }
  function isDerived(raw: string): boolean {
    try { const v: unknown = JSON.parse(raw); return isPlainObject(v) && isPlainObject(v[DERIVED_VIEW_MARK]) && (v[DERIVED_VIEW_MARK] as Record<string, unknown>).v === 2; } catch { return false; }
  }

  /**
   * Make a raw (unmarked) v1 cache safe to overwrite. Order: (1) journal every readable feature as a
   * 'legacy' op — so the view, and the map painted from it, keeps showing them whatever fails next;
   * (2) quarantine unreadable ones; (3) a verbatim content-addressed backup. True only if (1) and
   * (3) are durable; otherwise the caller leaves the raw cache untouched.
   */
  function absorbRaw(raw: string): boolean {
    const rawDigest = digest(raw);
    const backupKey = keys.item('backup', rawDigest);
    let features: unknown = [];
    let wholeUnreadable = false;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPlainObject(parsed) && Array.isArray(parsed.features)) features = parsed.features;
      else wholeUnreadable = true;
    } catch { wholeUnreadable = true; }
    // Scope = the raw content: two tabs reading the same raw cache derive the same ids/op ids; two
    // DIFFERENT caches never merge an id-less feature by digest.
    const { items, quarantined } = assignLegacyIds(features, `local:${rawDigest}`);
    const pendingIds = new Set(pending.map((p) => p.entry.op.opId));
    const fresh: ShapeOp[] = [];
    for (const item of items) {
      const rec = viewState.records[item.shapeId];
      if (rec?.live && sameContent(rec.content, item.content)) continue; // already exactly what v2 shows
      const opId = `ll-${digest(`${rawDigest}|${item.shapeId}|${contentDigest(item.content)}`)}`;
      if (pendingIds.has(opId) || server?.applied[opId]) continue;
      fresh.push({ kind: 'legacy', opId, device, shapeId: item.shapeId, baseSeq: server?.seq ?? 0, deps: [], source: 'legacy-local', content: item.content, island: 0 });
    }
    const opsDurable = journalWrite(fresh);
    if (fresh.length) recomputeView();
    if (wholeUnreadable) quarantine([{ index: -1, reason: 'v1 cache not a readable FeatureCollection', raw }], 'legacy-local', { backupKey });
    quarantine(quarantined, 'legacy-local', { backupKey });
    const backedUp = safeGet(backupKey) === raw || (safeSet(backupKey, raw) && safeGet(backupKey) === raw);
    return opsDurable && backedUp;
  }

  function writeFarmCache(): void {
    if (!current()) return;
    const raw = safeGet(keys.farmCache);
    if (raw !== null && !isDerived(raw) && !absorbRaw(raw)) {
      rawCacheHeld = true; // the raw cache may be the only copy: never overwrite it unsafely
      return;
    }
    rawCacheHeld = false;
    // Pass 3 invariant: the derived view is written in ONE setItem together with every typed op it
    // shows that has no journal row (the carry). If that write fails, the previous value — itself
    // consistent with its own carry — stays. A view without its intent is never written.
    const carry = [...volatile.values()].sort((a, b) => a.lc - b.lc || (a.writer < b.writer ? -1 : a.writer > b.writer ? 1 : a.wseq - b.wseq));
    const mark: Record<string, unknown> = { v: 2 };
    if (carry.length) mark.carry = carry;
    if (safeSet(keys.farmCache, JSON.stringify({ ...materializeLive(viewState), [DERIVED_VIEW_MARK]: mark }))) {
      carriedIds = new Set(carry.map((e) => e.op.opId));
    }
  }

  /** Typed ops carried in the derived FARM_KEY value (pass 3). Invalid entries are ignored here and
   *  stay in the value (exported verbatim as v1CacheNow); they are never deleted on their own. */
  function readCarry(): JournalEntry[] {
    const raw = safeGet(keys.farmCache);
    if (raw === null || !raw.includes('"carry"')) { carriedIds = new Set(); return []; }
    try {
      const v: unknown = JSON.parse(raw);
      if (!isPlainObject(v) || !isPlainObject(v[DERIVED_VIEW_MARK])) { carriedIds = new Set(); return []; }
      const carry = (v[DERIVED_VIEW_MARK] as Record<string, unknown>).carry;
      if (!Array.isArray(carry)) { carriedIds = new Set(); return []; }
      const out: JournalEntry[] = [];
      for (const item of carry) {
        const e = parseEntry(JSON.stringify(item));
        if (e) out.push(e);
      }
      carriedIds = new Set(out.map((e) => e.op.opId));
      return out;
    } catch { return []; }
  }

  /** Try again to give every volatile op its own journal row (storage may have recovered). */
  function retryVolatile(): boolean {
    let moved = false;
    for (const [id, entry] of [...volatile]) {
      const row = { ...entry, fb: 1 as const };
      if (safeSet(keys.item('journal', id), JSON.stringify(row))) { known.set(id, row); volatile.delete(id); moved = true; }
    }
    return moved;
  }

  /** Drop a backup once every feature in it is recorded server-side (and none was unreadable). */
  function pruneBackups(): void {
    if (!server) return;
    for (const { key } of scan('backup')) {
      const raw = safeGet(key);
      if (raw === null) continue;
      let features: unknown = null;
      try { const v: unknown = JSON.parse(raw); if (isPlainObject(v) && Array.isArray(v.features)) features = v.features; } catch { continue; }
      if (!features) continue;
      const { items, quarantined } = assignLegacyIds(features, `local:${digest(raw)}`);
      if (quarantined.length) continue;
      const covered = items.every((item) => {
        const rec = server?.records[item.shapeId];
        return !!rec && (sameContent(rec.content, item.content) || !!server?.legacy[item.shapeId]?.known.includes(contentDigest(item.content)));
      });
      if (covered && raw !== safeGet(keys.farmCache)) safeRemove(key);
    }
  }

  function status(): ShapeSyncStatus {
    return {
      durability: volatile.size === 0 ? 'durable' : 'volatile',
      volatileOps: volatile.size,
      fallbackHeld: [...volatile.keys()].filter((id) => carriedIds.has(id)).length,
      pending: pending.length,
      transport: opts.transport ? 'available' : 'none',
      blocked, lastError,
      rejected: familyIds('rejected', rejectedIds).size,
      rejectedRetentionFailures,
      deferred: [...deferred],
      conflicts: listConflicts(viewState).length,
      invalidJournal,
      rawCacheHeld,
      quarantineWriteFailures,
      lastCommittedSeq,
      flushing: !!inflight,
      islandDrain,
    };
  }
  const emitStatus = () => { if (current()) opts.onStatus?.(status()); };

  function publish(reason: ViewReason): void {
    writeFarmCache();
    if (!current()) return;
    opts.onView?.(reason);
    const conflicts = listConflicts(viewState);
    const json = canonicalJson(conflicts);
    if (json !== lastConflictsJson) { lastConflictsJson = json; opts.onConflicts?.(conflicts); }
    emitStatus();
  }
  function liveCanonical(): string { return canonicalJson(materializeLive(viewState)); }

  function scheduleFlush(delay = flushDelayMs): void {
    if (disposed || !opts.transport) return;
    cancelTimer?.();
    cancelTimer = schedule(() => { cancelTimer = null; void flush(); }, delay);
  }

  function enqueue(newOps: ShapeOp[]): RecordResult {
    if (disposed) return { ok: false, reason: 'disposed' };
    if (!current()) return { ok: false, reason: 'account-changed' };
    if (newOps.length === 0) return { ok: true, opIds: [], durable: volatile.size === 0, noop: true };
    if (volatile.size) retryVolatile();
    // Pass 3: a new local op may shrink the state (e.g. clearing an oversized note): re-evaluate.
    if (blocked === 'too-large') blocked = null;
    const durable = journalWrite(newOps);
    recomputeView();
    publish('local');
    scheduleFlush();
    return { ok: true, opIds: newOps.map((o) => o.opId), durable };
  }

  function adopt(state: ShapeStoreState): void {
    const before = liveCanonical();
    server = state;
    pending = loadPending();
    ackRecorded(state);
    persistServer();
    recomputeView();
    pruneBackups();
    publish(liveCanonical() === before ? 'local' : 'remote');
  }

  // ── Lifecycle ──

  function start(): void {
    if (started || disposed) return;
    started = true;
    const storedDevice = safeGet(keys.device);
    device = storedDevice && /^dev-[A-Za-z0-9_-]{4,80}$/.test(storedDevice) ? storedDevice : `dev-${opts.randomId().replace(/[^A-Za-z0-9_-]/g, '')}`;
    if (device !== storedDevice) safeSet(keys.device, device);
    try {
      const parsed = JSON.parse(safeGet(keys.state) ?? 'null') as { v?: number; server?: unknown } | null;
      const checked = parsed?.v === 1 ? validateState(parsed.server) : null;
      server = checked?.ok ? checked.state : null;
    } catch { server = null; }
    importPass1Queue();
    recomputeView();                       // also ingests any ops carried in the derived FARM_KEY
    if (retryVolatile()) recomputeView();  // storage recovered: carried ops get their own rows again
    publish('reset'); // absorbs a raw v1 cache before the first derived write
    scheduleFlush(0);
  }

  /** The pass-1 single-array queue: copy every op to its own journal key; remove the array only
   *  if every op was valid and durably copied (otherwise it stays, untouched, for export). */
  function importPass1Queue(): void {
    const raw = safeGet(keys.pass1Queue);
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw) as { v?: number; ops?: unknown[] };
      if (parsed?.v !== 1 || !Array.isArray(parsed.ops)) return;
      const valid = parsed.ops.filter((op) => validateOp(op) === null) as ShapeOp[];
      const fresh = valid.filter((op) => safeGet(keys.item('journal', op.opId)) === null);
      const durable = journalWrite(fresh);
      if (durable && valid.length === parsed.ops.length) safeRemove(keys.pass1Queue);
    } catch { /* leave it */ }
  }

  function refresh(): void {
    if (!started || !current()) return;
    const before = liveCanonical();
    try {
      const parsed = JSON.parse(safeGet(keys.state) ?? 'null') as { v?: number; server?: unknown } | null;
      const checked = parsed?.v === 1 ? validateState(parsed.server) : null;
      if (checked?.ok && (!server || (checked.state.storeId === server.storeId && checked.state.seq > server.seq))) server = checked.state;
    } catch { /* keep ours */ }
    recomputeView();
    if (retryVolatile()) recomputeView();
    publish(liveCanonical() === before ? 'local' : 'remote');
    if (pending.length) scheduleFlush();
  }

  // ── Recording ──

  function captureBasis(shapeId: string): EditBasis | null {
    const rec = viewState.records[shapeId];
    if (!rec || !rec.live || !rec.content) return null;
    const deps = pending
      .filter((p) => p.entry.op.shapeId === shapeId && viewOutcomes.get(p.entry.op.opId)?.outcome === 'applied')
      .map((p) => p.entry.op.opId);
    return { shapeId, baseRev: server?.records[shapeId]?.rev ?? 0, baseSeq: server?.seq ?? 0, deps, base: cloneJson(rec.content), current: cloneJson(rec.content) };
  }

  function create(feature: Feature, source: OpSource): RecordResult {
    const id = feature?.id;
    if (!isValidShapeId(id)) return { ok: false, reason: 'invalid-id', detail: String(id) };
    if (viewState.records[id]) return { ok: false, reason: 'id-in-use', detail: id };
    const content = contentFromFeature(feature);
    if (!content.ok) { quarantine([{ index: -1, reason: content.reason, raw: JSON.stringify(feature) }], source); return { ok: false, reason: 'invalid-feature', detail: content.reason }; }
    return enqueue([{ kind: 'create', opId: newOpId(), device, shapeId: id, baseSeq: server?.seq ?? 0, deps: [], source, content: content.content }]);
  }

  function update(basis: EditBasis, after: Feature, source: OpSource): RecordResult {
    const content = contentFromFeature(after);
    if (!content.ok) { quarantine([{ index: -1, reason: content.reason, raw: JSON.stringify(after) }], source); return { ok: false, reason: 'invalid-feature', detail: content.reason }; }
    const patch = diffContent(basis.current, content.content);
    if (Object.keys(patch).length === 0) return { ok: true, opIds: [], durable: volatile.size === 0, noop: true };
    const op: ShapeOp = { kind: 'update', opId: newOpId(), device, shapeId: basis.shapeId, baseSeq: basis.baseSeq, deps: [...basis.deps], source, baseRev: basis.baseRev, patch, proposed: content.content };
    const result = enqueue([op]);
    if (result.ok) { basis.deps.push(op.opId); basis.current = cloneJson(content.content); }
    return result;
  }

  function remove(shapeIds: readonly string[], source: OpSource, bases?: ReadonlyMap<string, EditBasis>): RecordResult {
    const batch: ShapeOp[] = [];
    for (const shapeId of shapeIds) {
      const basis = bases?.get(shapeId) ?? captureBasis(shapeId);
      if (!basis) continue;
      batch.push({ kind: 'delete', opId: newOpId(), device, shapeId, baseSeq: basis.baseSeq, deps: [...basis.deps], source, baseRev: basis.baseRev });
    }
    if (batch.length === 0) return { ok: false, reason: 'not-live' };
    return enqueue(batch);
  }

  function resolve(shapeId: string, conflictId: string, choice: ResolveChoice): RecordResult {
    const newShapeId = choice === 'keep-both' ? `shp-${opts.randomId()}` : undefined;
    return enqueue([{ kind: 'resolve', opId: newOpId(), device, shapeId, baseSeq: server?.seq ?? 0, deps: [], source: 'resolve', conflictId, choice, ...(newShapeId ? { newShapeId } : {}) }]);
  }

  function importShared(fc: unknown, code: string) {
    const features = isPlainObject(fc) && Array.isArray(fc.features) ? fc.features : [];
    const batch: ShapeOp[] = [];
    const bad: QuarantinedFeature[] = [];
    let skipped = 0;
    features.forEach((feature: unknown, index: number) => {
      const content = contentFromFeature(feature);
      if (!content.ok) { bad.push({ index, reason: content.reason, raw: JSON.stringify(feature) ?? '' }); return; }
      const shapeId = importShapeId(code, isPlainObject(feature) ? feature.id : undefined, index);
      if (viewState.records[shapeId] || viewState.deletedImports?.[shapeId] !== undefined) { skipped += 1; return; }
      batch.push({ kind: 'import', opId: `im-${digest(`${shapeId}|${contentDigest(content.content)}`)}`, device, shapeId, baseSeq: server?.seq ?? 0, deps: [], source: 'share-import', content: content.content });
    });
    quarantine(bad, 'share-import', { code });
    return { result: enqueue(batch), imported: batch.length, skipped, quarantined: bad.length };
  }

  function ingestLegacyIsland(shapesJson: unknown, islandVersion: number): RecordResult {
    if (opts.drainLegacyIsland) {
      // Drain mode reads the island INSIDE the flush transaction; nothing is journaled here.
      islandDirty = true;
      scheduleFlush(0);
      return { ok: true, opIds: [], durable: volatile.size === 0, noop: true };
    }
    const island = legacyIslandOps(shapesJson, islandVersion, device, server?.seq ?? 0);
    quarantine(island.quarantined, 'legacy-island');
    const pendingIds = new Set(pending.map((p) => p.entry.op.opId));
    const batch = island.ops.filter((op) => {
      if (op.kind !== 'legacy') return false;
      if (server?.legacy[op.shapeId]?.known.includes(contentDigest(op.content))) return false;
      return !pendingIds.has(op.opId) && !server?.applied[op.opId];
    });
    return enqueue(batch);
  }

  // ── Remote ──

  function receiveRemote(raw: unknown): void {
    if (!current()) return;
    const parsed = parseRemoteDoc(raw);
    if (parsed.kind === 'absent') { if (server && server.seq > 0) { blocked = 'remote-missing'; emitStatus(); } return; }
    if (parsed.kind === 'corrupt') { blocked = 'remote-corrupt'; lastError = parsed.reason; emitStatus(); return; }
    if (parsed.kind === 'newer') { blocked = 'protocol-newer'; emitStatus(); return; }
    if (server && parsed.state.storeId !== server.storeId) { blocked = 'store-replaced'; emitStatus(); return; }
    if (blocked && blocked !== 'store-replaced' && blocked !== 'too-large') blocked = null;
    if (server && parsed.state.seq <= server.seq) return;
    adopt(parsed.state);
  }

  async function flush(): Promise<FlushReport> {
    if (disposed || !opts.transport || !started) return { kind: 'skipped' };
    if (inflight) { flushAgain = true; return { kind: 'queued-again' }; }
    if (!current()) return { kind: 'account-changed' };
    if (blocked) return { kind: 'blocked', reason: blocked };
    if (volatile.size) retryVolatile();
    pending = loadPending();
    const snapshot = pending.slice();
    const ackIds = [...familyIds('ack').keys()];
    const drain = !!opts.drainLegacyIsland && islandDirty;
    if (snapshot.length === 0 && ackIds.length === 0 && !drain) return { kind: 'idle' };
    const nowMs = opts.now();
    const knownStore = server?.storeId ?? null;
    const knownSeq = server?.seq ?? 0;
    const transport = opts.transport;

    const run = async (): Promise<FlushReport> => {
      let result: StepResult;
      try {
        result = await transport.transact<StepResult>((currentDoc, island) => {
          if (!current()) return { write: null, result: { kind: 'account-changed' } };
          // Re-validate INSIDE the step (synchronous storage read): another tab may have flushed this
          // op, removed its journal row and had its dedupe entry pruned since our snapshot.
          const batch = snapshot.filter((p) => p.volatile ? volatile.has(p.entry.op.opId) : (p.key !== null && safeGet(p.key) !== null)).map((p) => p.entry.op);
          const parsed = parseRemoteDoc(currentDoc);
          let base: ShapeStoreState;
          if (parsed.kind === 'absent') {
            if (knownStore && knownSeq > 0) return { write: null, result: { kind: 'blocked', reason: 'remote-missing' } };
            base = genesisState(`st-${opts.randomId()}`);
          } else if (parsed.kind === 'corrupt') {
            return { write: null, result: { kind: 'blocked', reason: 'remote-corrupt' } };
          } else if (parsed.kind === 'newer') {
            return { write: null, result: { kind: 'blocked', reason: 'protocol-newer' } };
          } else {
            if (knownStore && parsed.state.storeId !== knownStore) return { write: null, result: { kind: 'blocked', reason: 'store-replaced' } };
            base = parsed.state;
          }
          // Only ids whose journal rows are gone AND are not in this batch may lose their dedupe entry.
          const inBatch = new Set(batch.map((op) => op.opId));
          const acked = ackIds.filter((id) => !inBatch.has(id) && safeGet(keys.item('journal', id)) === null);
          const applied = applyOps(pruneAcked(base, acked), batch);
          let next = applied.state;
          const outcomes = applied.outcomes;
          let drained = false;
          let drainReason: string | null = null;
          let islandRetry = false;
          if (island?.exists) {
            const islandOps = legacyIslandOps(island.shapesJson, island.version, device, next.seq);
            const ingest = applyOps(next, islandOps.ops);
            const decision = decideIslandDrain(islandOps, ingest.outcomes);
            // The additive ingest ALWAYS commits (it never infers a delete — same as the journaled
            // path). Only the DELETE is gated: a kept island still holds whatever was not ingested.
            next = ingest.state;
            drained = decision.drain;
            drainReason = decision.reason;
            islandRetry = !drained && ingest.outcomes.some((o) => o.outcome === 'deferred');
          }
          touchDevice(next, device, { nowMs });
          const compacted = compactState(next, nowMs, retention);
          const doc = serializeState(compacted);
          // Pass 3: UTF-8 byte bound of the whole document (was stateJson.length in UTF-16 units). Block,
          // never truncate: the journal and exportRecovery() keep every op of the refused batch.
          if (!shapeDocFits(doc).fits) return { write: null, result: { kind: 'blocked', reason: 'too-large' } };
          return { write: doc, deleteIsland: drained, result: { kind: 'committed', state: compacted, outcomes, acked, drained, drainReason, islandRetry } };
        }, drain ? { island: true } : undefined);
      } catch (error) {
        if (!current()) return { kind: 'account-changed' };
        lastError = error instanceof Error ? error.message : String(error);
        emitStatus();
        scheduleFlush(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60_000);
        return { kind: 'error', message: lastError };
      }
      if (!current()) return { kind: 'account-changed' };
      if (result.kind === 'account-changed') return { kind: 'account-changed' };
      if (result.kind === 'blocked') { blocked = result.reason; emitStatus(); return { kind: 'blocked', reason: result.reason }; }
      backoffMs = 2000;
      lastError = null;
      lastCommittedSeq = result.state.seq;
      // A deferred island ingest (conflict cap) is re-read on the next flush; anything else waits for
      // the next island snapshot.
      if (drain) { islandDirty = result.islandRetry; islandDrain = result.drainReason; }
      deferred = result.outcomes.filter((o) => o.outcome === 'deferred').map((o) => ({ opId: o.opId, shapeId: o.shapeId, reason: o.reason ?? 'deferred' }));
      // The server has processed these ack reports: their records can go.
      for (const id of result.acked) safeRemove(keys.item('ack', id));
      if (!server || result.state.seq > server.seq) adopt(result.state);
      else { pending = loadPending(); ackRecorded(result.state); recomputeView(); publish('local'); }
      return { kind: 'committed', outcomes: result.outcomes, islandDrained: result.drained };
    };

    inflight = run();
    try {
      return await inflight;
    } finally {
      inflight = null;
      if (flushAgain && !disposed) { flushAgain = false; scheduleFlush(0); }
    }
  }

  function exportRecovery(): string {
    const dump = (family: Family) => [...familyIds(family, family === 'journal' ? known.keys() : family === 'rejected' ? rejectedIds : [])].map(([id, key]) => ({ id, key, value: safeGet(key) }));
    return JSON.stringify({
      kind: 'imbewu-shape-sync-recovery', version: 2, exportedAtMs: opts.now(), device, writer,
      server, status: status(),
      journal: dump('journal'), volatile: [...volatile.values()], rejected: dump('rejected'),
      quarantine: dump('quarantine'), backups: dump('backup'), acks: dump('ack'),
      v1CacheNow: safeGet(keys.farmCache), pass1Queue: safeGet(keys.pass1Queue),
      view: materializeLive(viewState),
    });
  }

  return {
    get device() { return device; },
    start, refresh,
    view: () => (started ? materializeLive(viewState) : cloneJson(EMPTY_FC)),
    feature: (shapeId) => { const rec = viewState.records[shapeId]; return rec?.live && rec.content ? featureFromContent(shapeId, rec.content) : null; },
    captureBasis, create, update, remove, resolve, importShared, ingestLegacyIsland,
    receiveRemote, flush,
    nudge: () => { backoffMs = 2000; scheduleFlush(0); },
    conflicts: () => listConflicts(viewState),
    status,
    exportRecovery,
    dispose: () => { disposed = true; cancelTimer?.(); cancelTimer = null; },
  };
}

// ── Farmer-facing notice (pure) ──────────────────────────────────────────────────────────────

export interface ShapeSyncNotice { level: 'ok' | 'info' | 'warn' | 'error'; text: string; offerBackup: boolean }

/**
 * The ONLY wording the map shows about shape saving. It may say "synced" only when nothing is
 * pending, deferred, volatile, held, rejected-unretained or blocked AND this controller saw its own
 * flush commit. Every failure state maps to a non-ok notice (tests/shape-sync-v2-pass2.test.ts).
 */
export function shapeSyncNotice(s: ShapeSyncStatus | null): ShapeSyncNotice | null {
  if (!s) return null;
  if (s.blocked) return { level: 'error', text: `Map sync is paused (${s.blocked}). Your drawings are kept on this device.`, offerBackup: true };
  if (s.durability === 'volatile') {
    // Never a success: only the fallback copy survives a reload; the normal journal write failed.
    return s.volatileOps > 0 && s.fallbackHeld === s.volatileOps
      ? { level: 'error', text: 'Storage on this device is full: your last change is only in a fallback copy. Download a backup and keep this page open until it syncs.', offerBackup: true }
      : { level: 'error', text: 'Your last change is not saved on this device yet. Keep this page open until it syncs.', offerBackup: true };
  }
  if (s.rawCacheHeld) return { level: 'warn', text: 'Older map data on this device could not be backed up, so it was left untouched.', offerBackup: true };
  if (s.rejectedRetentionFailures > 0 || s.quarantineWriteFailures > 0) return { level: 'warn', text: 'Some map data could not be stored on this device. Download a backup.', offerBackup: true };
  if (s.invalidJournal > 0 || s.rejected > 0) return { level: 'warn', text: 'Some changes could not be applied. They are kept on this device.', offerBackup: true };
  if (s.deferred.length > 0) return { level: 'warn', text: 'Some changes are waiting until you decide the open shape conflicts.', offerBackup: false };
  if (s.transport === 'none') return { level: 'info', text: 'Saved on this device only.', offerBackup: false };
  if (s.pending > 0 || s.flushing || s.lastError) return { level: 'info', text: s.lastError ? `${s.pending} change(s) waiting to sync (offline?).` : `${s.pending} change(s) syncing…`, offerBackup: false };
  if (s.lastCommittedSeq === null) return null; // nothing to claim either way
  return { level: 'ok', text: 'All map changes synced.', offerBackup: false };
}
