// Shape sync protocol v2 — the pure, deterministic contract for farm-shape sync.
//
// WHY THIS EXISTS: v1 (lib/user-sync.ts pushShapes) blindly setDoc-wrote a device's whole drawn
// collection, so the last writer erased every shape another device had added or edited since the
// writer's last listener delivery (docs/SHAPE-SYNC-ANALYSIS-2026-08-10.md, tests/shape-sync-loss).
//
// v2 never ships a snapshot. A device ships OPERATIONS, each naming one shape by a stable id and
// stating what it saw (baseRev + deps). The single remote document holds the resulting state; every
// write is "read latest state → apply ops with this module → write", inside one Firestore
// transaction. Re-running that step after contention re-applies the OPS to the NEW state — it never
// re-asserts an old view, which is the difference from snapshot CAS + retry.
//
// Rules (each is tested in tests/shape-sync-v2-protocol.test.ts):
//  * Identity is the GeoJSON Feature.id (string). Never derived from geometry.
//  * Every field (geometry 'g', each property 'p:<key>', each foreign member 'x:<key>') carries
//    {rev, op}: the record revision and the op that last wrote it. An op conflicts only if a field it
//    touches was written after its baseRev by an op it did not build on (deps). Disjoint-field edits
//    from different devices merge; overlapping ones open a preserved CONFLICT BRANCH — never a silent
//    last-writer-wins. No wall clock participates in any merge decision.
//  * Deletes are tombstones (record.live=false, content kept). A delete against fields edited after
//    the deleter's view, and an edit against a tombstone, both open a branch for the farmer.
//  * "Delete all" is N explicit deletes with their own baseRevs, so shapes the deleter never saw
//    survive. There is no wildcard delete.
//  * Ops are idempotent by opId (state.applied). Duplicate delivery is a no-op.
//  * A non-create op whose target record is missing (never existed here, or a tombstone was pruned)
//    is HELD for the farmer, never silently dropped and never silently re-created.
//  * Legacy (v1) data enters only through 'legacy' ops (never deletes; see applyLegacy).
//
// This module has no I/O, no clock, no randomness and no imports beyond the shared validator.

import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { isValidFarmGeometry } from '../farm-geometry';

export const SHAPE_PROTOCOL = 2;
export const SHAPE_PROTOCOL_MINOR = 0;
/**
 * Pass 3: Firestore limits are in UTF-8 BYTES, not JavaScript string length (UTF-16 code units).
 * Official (https://firebase.google.com/docs/firestore/quotas): document ≤ 1,048,576 bytes; one
 * field value ≤ 1,048,487 bytes. Size rules (storage-size calculations): a string is its UTF-8 bytes
 * + 1; an integer or timestamp 8; a field name is a string; a document adds its name (each path
 * segment as a string + 16) and 32 bytes. Pass 1/2 compared `stateJson.length` with 900,000 code
 * units — 400,000 Han characters (≈1.2 MB) passed that check.
 */
export const FIRESTORE_MAX_DOC_BYTES = 1_048_576;
export const FIRESTORE_MAX_FIELD_BYTES = 1_048_487;
/** What shapeDocBytes() may reach: 16 KiB below the document limit (margin for anything the size
 *  rules or this estimate do not model). Exceeding it BLOCKS the flush ('too-large'); nothing is
 *  truncated or dropped, the queue and the recovery export keep every op. */
export const SHAPE_DOC_BYTE_BUDGET = FIRESTORE_MAX_DOC_BYTES - 16_384;
/** Document-name bound for user_map_data/{uid}/data/shapes_v2 with a Firebase Auth uid of ≤ 128
 *  characters counted at 4 bytes each: 14 + 513 + 5 + 10 + 16. */
export const SHAPE_DOC_NAME_BYTES_BOUND = 558;
export const LEGACY_KNOWN_HASHES = 6;
export const MAX_DEPS = 500;
/**
 * Pass 2: reaching this cap DEFERS the op (not recorded, stays in the author's durable journal,
 * exportable, retried after the farmer resolves branches). Pass 1 recorded it as 'rejected' and the
 * controller acked and dropped it — the branch's only copy was lost (negative control NC5).
 */
export const MAX_CONFLICTS_PER_SHAPE = 20;
// Pass 2: resolved-conflict history is no longer trimmed. Size is governed only by
// SHAPE_DOC_BYTE_BUDGET (pass 3: UTF-8 bytes), which BLOCKS the flush with an export rather than dropping anything.

// ── JSON + hashing ────────────────────────────────────────────────────────────────────────────

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

/** Key-order independent JSON. Used for equality and hashing only, never for storage. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * ~106-bit non-cryptographic digest (two independent 53-bit lanes). Used for legacy-content
 * equality bookkeeping and derived ids of id-less legacy features. Not a security primitive: the
 * document is already writable only by its owner (firestore.rules user_map_data).
 */
export function digest(text: string): string {
  return cyrb53(text, 1).toString(36).padStart(11, '0') + cyrb53(text, 2).toString(36).padStart(11, '0');
}

// ── Content ───────────────────────────────────────────────────────────────────────────────────

/**
 * Everything about a shape except its identity: geometry, properties and any GeoJSON foreign
 * members ("unknown JSON fields", e.g. bbox). properties:null is normalised to {} — every reader in
 * the app uses `f.properties?.x`, and Mapbox Draw itself emits {}.
 */
export interface ShapeContent {
  g: Geometry;
  p: JsonObject;
  x: JsonObject;
}

const RESERVED_FEATURE_KEYS = new Set(['type', 'id', 'geometry', 'properties']);

export type ContentResult =
  | { ok: true; content: ShapeContent }
  | { ok: false; reason: 'not-a-feature' | 'invalid-geometry' | 'invalid-properties' | 'not-json' };

export function contentFromFeature(feature: unknown): ContentResult {
  if (!isPlainObject(feature) || feature.type !== 'Feature') return { ok: false, reason: 'not-a-feature' };
  if (!isValidFarmGeometry(feature.geometry)) return { ok: false, reason: 'invalid-geometry' };
  const props = feature.properties;
  if (props !== null && props !== undefined && !isPlainObject(props)) return { ok: false, reason: 'invalid-properties' };
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(feature)) {
    if (!RESERVED_FEATURE_KEYS.has(key)) extra[key] = feature[key];
  }
  let content: ShapeContent;
  try {
    // Same JSON round-trip the v1 app already applied when persisting (JSON.stringify(draw.getAll())).
    content = JSON.parse(JSON.stringify({ g: feature.geometry, p: props ?? {}, x: extra })) as ShapeContent;
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isValidFarmGeometry(content.g)) return { ok: false, reason: 'invalid-geometry' };
  return { ok: true, content };
}

export function featureFromContent(id: string, content: ShapeContent): Feature {
  return {
    type: 'Feature',
    id,
    ...cloneJson(content.x),
    properties: cloneJson(content.p),
    geometry: cloneJson(content.g),
  } as Feature;
}

export function contentDigest(content: ShapeContent): string {
  return digest(canonicalJson(content));
}

export function sameContent(a: ShapeContent | null | undefined, b: ShapeContent | null | undefined): boolean {
  if (!a || !b) return a === b;
  return canonicalJson(a) === canonicalJson(b);
}

// ── Fields + patches ─────────────────────────────────────────────────────────────────────────

export type FieldKey = string; // 'g' | `p:${string}` | `x:${string}`
export type FieldChange = { set: Json } | { unset: true };
export type ShapePatch = Record<FieldKey, FieldChange>;

function isFieldKey(key: string): boolean {
  if (key === 'g') return true;
  if (key.startsWith('p:')) return key.length > 2;
  if (key.startsWith('x:')) return key.length > 2 && !RESERVED_FEATURE_KEYS.has(key.slice(2));
  return false;
}

export function contentFields(content: ShapeContent): FieldKey[] {
  return ['g', ...Object.keys(content.p).map((k) => `p:${k}`), ...Object.keys(content.x).map((k) => `x:${k}`)];
}

/** Field-wise difference: applying the result to `before` yields `after` exactly. */
export function diffContent(before: ShapeContent, after: ShapeContent): ShapePatch {
  const patch: ShapePatch = {};
  if (canonicalJson(before.g) !== canonicalJson(after.g)) patch.g = { set: cloneJson(after.g) as unknown as Json };
  for (const [bag, prefix] of [['p', 'p:'], ['x', 'x:']] as const) {
    const keys = new Set([...Object.keys(before[bag]), ...Object.keys(after[bag])]);
    for (const key of keys) {
      const hasAfter = Object.prototype.hasOwnProperty.call(after[bag], key);
      if (!hasAfter) { patch[prefix + key] = { unset: true }; continue; }
      const hasBefore = Object.prototype.hasOwnProperty.call(before[bag], key);
      if (!hasBefore || canonicalJson(before[bag][key]) !== canonicalJson(after[bag][key])) {
        patch[prefix + key] = { set: cloneJson(after[bag][key]) };
      }
    }
  }
  return patch;
}

export function applyPatch(content: ShapeContent, patch: ShapePatch): ShapeContent {
  const out = cloneJson(content);
  for (const [field, change] of Object.entries(patch)) {
    if (field === 'g') {
      if ('set' in change) out.g = cloneJson(change.set) as unknown as Geometry;
      continue;
    }
    const bag = field.startsWith('p:') ? out.p : out.x;
    const key = field.slice(2);
    if ('unset' in change) delete bag[key];
    else bag[key] = cloneJson(change.set);
  }
  return out;
}

/** Later changes override earlier ones field by field (patches carry absolute values). */
export function mergePatches(first: ShapePatch, second: ShapePatch): ShapePatch {
  return { ...cloneJson(first), ...cloneJson(second) };
}

// ── State ─────────────────────────────────────────────────────────────────────────────────────

export type OpSource =
  | 'draw-create' | 'reticle-create' | 'reticle-done' | 'native-edit' | 'native-undo' | 'rename'
  | 'delete' | 'keyboard-delete' | 'clear-type' | 'share-import' | 'legacy-local' | 'legacy-island'
  | 'resolve';

export type ConflictKind =
  | 'concurrent-edit'    // two devices changed the same field from the same base
  | 'delete-vs-edit'     // a delete arrived for a shape edited after the deleter's view
  | 'edit-after-delete'  // an edit (often offline) arrived for a deleted shape
  | 'missing-target'     // an edit arrived for a shape this store has no record of
  | 'legacy-divergence'  // an old-app copy differs from v2 in a way that cannot be ordered
  | 'id-collision';      // a create named an id already in use by a different shape

export interface ShapeConflict {
  id: string;            // the opId that opened the branch
  kind: ConflictKind;
  ops: string[];         // every op folded into this branch, in order
  device: string;
  source: OpSource;
  baseRev: number;
  fields: FieldKey[];    // the fields that clashed (empty for missing-target / legacy)
  patch: ShapePatch | null;      // null = the branch wants the shape deleted
  proposed: ShapeContent | null; // the branch author's full content (null for a delete branch)
  atSeq: number;
}

export interface FieldStamp { rev: number; op: string }

export interface ShapeRecord {
  id: string;
  rev: number;
  live: boolean;
  /** Tombstones keep the last live content for restore/export; it may be slimmed to null. */
  content: ShapeContent | null;
  fields: Record<FieldKey, FieldStamp>;
  createdBy: string;
  createdSeq: number;
  deletedBy?: string;
  deletedSeq?: number;
  origin: 'v2' | 'legacy' | 'import';
  conflicts: ShapeConflict[];
  resolved?: Array<{ conflict: ShapeConflict; choice: ResolveChoice; atSeq: number }>;
  [unknown: string]: unknown;
}

export type AppliedOutcome = 'applied' | 'conflict' | 'noop' | 'rejected';
export interface AppliedEntry { seq: number; device: string; outcome: AppliedOutcome; conflict?: string; reason?: string }

/** ackSeq is no longer used for pruning (pass 2: explicit per-op acks, see compactState). */
export interface DeviceEntry { seenSeq: number; ackSeq?: number; lastSeenMs: number }

/** Per legacy (v1) feature id: what has already been ingested, so stale copies cannot re-assert. */
export interface LegacyEntry {
  shapeId: string;
  known: string[];          // digests of every legacy content already ingested (bounded)
  island: number;           // server commit time (ms) of the newest island write ingested, 0 = none
  islandDigest: string | null;
  rev: number;              // record rev right after the last applied legacy ingest (the island's base)
}

export interface ShapeStoreState {
  protocol: number;
  minor: number;
  storeId: string;
  seq: number;
  /** Tombstones with deletedSeq below this may have been pruned. Informational for holds. */
  prunedBelowSeq: number;
  records: Record<string, ShapeRecord>;
  applied: Record<string, AppliedEntry>;
  devices: Record<string, DeviceEntry>;
  legacy: Record<string, LegacyEntry>;
  /** Pass 3: compact deletion identity of share-import shapes whose tombstone was pruned:
   *  shapeId → deletedSeq. Never pruned (re-opening a share link stays a no-op forever); counted in
   *  the document size, so growth BLOCKS with an export instead of being forgotten. */
  deletedImports?: Record<string, number>;
  [unknown: string]: unknown; // forward-compatible minor additions are carried through unchanged
}

export function genesisState(storeId: string): ShapeStoreState {
  return {
    protocol: SHAPE_PROTOCOL, minor: SHAPE_PROTOCOL_MINOR, storeId, seq: 0, prunedBelowSeq: 0,
    records: {}, applied: {}, devices: {}, legacy: {},
  };
}

// ── Remote envelope (the Firestore document data) ────────────────────────────────────────────

/** Firestore document `user_map_data/{uid}/data/shapes_v2`. Nested geometry lives inside the
 *  JSON string, exactly like v1's shapesJson / designJson, because Firestore rejects nested arrays. */
export interface RemoteShapeDoc {
  protocol: number;
  minor: number;
  storeId: string;
  seq: number;
  stateJson: string;
}

export type ParsedRemote =
  | { kind: 'absent' }
  | { kind: 'ok'; state: ShapeStoreState }
  | { kind: 'corrupt'; reason: string }
  | { kind: 'newer'; protocol: number };

function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isContent(value: unknown): value is ShapeContent {
  return isPlainObject(value) && isValidFarmGeometry(value.g) && isPlainObject(value.p) && isPlainObject(value.x);
}

function recordProblem(id: string, rec: unknown): string | null {
  if (!isPlainObject(rec)) return 'record not an object';
  if (rec.id !== id) return 'record id mismatch';
  if (!isNonNegInt(rec.rev) || rec.rev < 1) return 'record rev';
  if (typeof rec.live !== 'boolean') return 'record live';
  if (rec.live ? !isContent(rec.content) : !(rec.content === null || isContent(rec.content))) return 'record content';
  if (!isPlainObject(rec.fields)) return 'record fields';
  if (!Array.isArray(rec.conflicts)) return 'record conflicts';
  return null;
}

export function validateState(value: unknown): { ok: true; state: ShapeStoreState } | { ok: false; reason: string } {
  if (!isPlainObject(value)) return { ok: false, reason: 'state not an object' };
  if (value.protocol !== SHAPE_PROTOCOL) return { ok: false, reason: 'state protocol' };
  if (typeof value.storeId !== 'string' || !value.storeId) return { ok: false, reason: 'storeId' };
  if (!isNonNegInt(value.seq) || !isNonNegInt(value.prunedBelowSeq)) return { ok: false, reason: 'seq' };
  for (const bag of ['records', 'applied', 'devices', 'legacy'] as const) {
    if (!isPlainObject(value[bag])) return { ok: false, reason: bag };
  }
  for (const [id, rec] of Object.entries(value.records as Record<string, unknown>)) {
    const problem = recordProblem(id, rec);
    if (problem) return { ok: false, reason: `${problem}: ${id}` };
  }
  if (value.deletedImports !== undefined) {
    if (!isPlainObject(value.deletedImports)) return { ok: false, reason: 'deletedImports' };
    for (const [id, seq] of Object.entries(value.deletedImports)) if (!isNonNegInt(seq)) return { ok: false, reason: `deletedImports: ${id}` };
  }
  return { ok: true, state: value as unknown as ShapeStoreState };
}

/** Fail-closed parse. A corrupt or newer-protocol document is NEVER replaced by this client. */
export function parseRemoteDoc(raw: unknown): ParsedRemote {
  if (raw === null || raw === undefined) return { kind: 'absent' };
  if (!isPlainObject(raw)) return { kind: 'corrupt', reason: 'document not an object' };
  if (typeof raw.protocol === 'number' && raw.protocol > SHAPE_PROTOCOL) return { kind: 'newer', protocol: raw.protocol };
  if (raw.protocol !== SHAPE_PROTOCOL) return { kind: 'corrupt', reason: 'document protocol' };
  if (typeof raw.stateJson !== 'string') return { kind: 'corrupt', reason: 'stateJson missing' };
  let parsed: unknown;
  try { parsed = JSON.parse(raw.stateJson); } catch { return { kind: 'corrupt', reason: 'stateJson not JSON' }; }
  const checked = validateState(parsed);
  if (!checked.ok) return { kind: 'corrupt', reason: checked.reason };
  if (checked.state.storeId !== raw.storeId || checked.state.seq !== raw.seq) return { kind: 'corrupt', reason: 'envelope mismatch' };
  return { kind: 'ok', state: checked.state };
}

/** UTF-8 byte length without allocating. A lone surrogate counts 3 (encoded as U+FFFD). */
export function utf8ByteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { n += 4; i += 1; } else n += 3;
    } else n += 3;
  }
  return n;
}

/**
 * Conservative Firestore storage size of the shapes_v2 document as the transport writes it
 * (lib/user-sync.ts createShapeSyncTransport adds `updatedAt`, a timestamp). If the transport ever
 * writes another field, add it here.
 */
export function shapeDocBytes(doc: RemoteShapeDoc): number {
  const str = (v: string) => utf8ByteLength(v) + 1;
  const fields: Array<[string, number]> = [
    ['protocol', 8], ['minor', 8], ['storeId', str(doc.storeId)], ['seq', 8],
    ['stateJson', str(doc.stateJson)], ['updatedAt', 8],
  ];
  return SHAPE_DOC_NAME_BYTES_BOUND + fields.reduce((sum, [name, value]) => sum + str(name) + value, 0) + 32;
}

export function shapeDocFits(doc: RemoteShapeDoc): { fits: boolean; bytes: number; budget: number } {
  const bytes = shapeDocBytes(doc);
  return { fits: bytes <= SHAPE_DOC_BYTE_BUDGET && utf8ByteLength(doc.stateJson) + 1 <= FIRESTORE_MAX_FIELD_BYTES, bytes, budget: SHAPE_DOC_BYTE_BUDGET };
}

export function serializeState(state: ShapeStoreState): RemoteShapeDoc {
  return {
    protocol: SHAPE_PROTOCOL,
    minor: typeof state.minor === 'number' ? state.minor : SHAPE_PROTOCOL_MINOR,
    storeId: state.storeId,
    seq: state.seq,
    stateJson: JSON.stringify(state),
  };
}

// ── Operations ───────────────────────────────────────────────────────────────────────────────

export type ResolveChoice = 'keep-current' | 'use-branch' | 'keep-both';

interface OpBase {
  opId: string;
  device: string;
  shapeId: string;
  /** state.seq of the server state the author had confirmed when the op was made. */
  baseSeq: number;
  /** The author's own earlier ops on this shape that this op builds on. */
  deps: string[];
  source: OpSource;
}

export type ShapeOp =
  | (OpBase & { kind: 'create'; content: ShapeContent })
  | (OpBase & { kind: 'update'; baseRev: number; patch: ShapePatch; proposed: ShapeContent })
  | (OpBase & { kind: 'delete'; baseRev: number })
  | (OpBase & { kind: 'resolve'; conflictId: string; choice: ResolveChoice; newShapeId?: string })
  /** A v1 feature. island = server commit ms of the island write it came from; 0 = this device's
   *  unversioned v1 cache (lib/map-sync FARM_KEY). Never deletes. */
  | (OpBase & { kind: 'legacy'; content: ShapeContent; island: number })
  /** A shared-site feature imported under a deterministic id. Never resurrects, never deletes. */
  | (OpBase & { kind: 'import'; content: ShapeContent });

export interface OpOutcome {
  opId: string;
  shapeId: string;
  /** 'deferred' = NOT recorded: the op stays pending (cap reached, or an earlier op for the same
   *  shape in this batch was deferred — per-shape order is never inverted). */
  outcome: AppliedOutcome | 'duplicate' | 'deferred';
  /** For 'duplicate': what the first application recorded. */
  recorded?: AppliedOutcome;
  conflict?: string;
  reason?: string;
  seq: number;
}

const SHAPE_ID_RE = /^[A-Za-z0-9_:.~-]{1,160}$/;
export function isValidShapeId(id: unknown): id is string {
  return typeof id === 'string' && SHAPE_ID_RE.test(id);
}

function patchProblem(patch: unknown): string | null {
  if (!isPlainObject(patch)) return 'patch';
  for (const [field, change] of Object.entries(patch)) {
    if (!isFieldKey(field)) return `patch field ${field}`;
    if (!isPlainObject(change)) return `patch change ${field}`;
    if (field === 'g') {
      if (!('set' in change) || !isValidFarmGeometry(change.set)) return 'patch geometry';
    } else if (!('set' in change) && change.unset !== true) return `patch change ${field}`;
  }
  return null;
}

export function validateOp(op: unknown): string | null {
  if (!isPlainObject(op)) return 'op not an object';
  if (typeof op.opId !== 'string' || !op.opId || op.opId.length > 200) return 'opId';
  if (typeof op.device !== 'string' || !op.device) return 'device';
  if (!isValidShapeId(op.shapeId)) return 'shapeId';
  if (!isNonNegInt(op.baseSeq)) return 'baseSeq';
  if (!Array.isArray(op.deps) || op.deps.length > MAX_DEPS || !op.deps.every((d) => typeof d === 'string')) return 'deps';
  switch (op.kind) {
    case 'create': case 'legacy': case 'import':
      if (!isContent(op.content)) return 'content';
      if (op.kind === 'legacy' && !isNonNegInt(op.island)) return 'island';
      return null;
    case 'update':
      if (!isNonNegInt(op.baseRev)) return 'baseRev';
      if (!isContent(op.proposed)) return 'proposed';
      return patchProblem(op.patch);
    case 'delete':
      return isNonNegInt(op.baseRev) ? null : 'baseRev';
    case 'resolve':
      if (typeof op.conflictId !== 'string' || !op.conflictId) return 'conflictId';
      if (op.choice !== 'keep-current' && op.choice !== 'use-branch' && op.choice !== 'keep-both') return 'choice';
      if (op.choice === 'keep-both' && !isValidShapeId(op.newShapeId)) return 'newShapeId';
      return null;
    default:
      return 'kind';
  }
}

// ── Application ──────────────────────────────────────────────────────────────────────────────

function stampAll(content: ShapeContent, rev: number, op: string): Record<FieldKey, FieldStamp> {
  const out: Record<FieldKey, FieldStamp> = {};
  for (const field of contentFields(content)) out[field] = { rev, op };
  return out;
}

/** Fields the op touches that someone else wrote after the op's base. The heart of the merge. */
function concurrentFields(rec: ShapeRecord, touched: FieldKey[], baseRev: number, deps: ReadonlySet<string>): FieldKey[] {
  return touched.filter((field) => {
    const stamp = rec.fields[field];
    return !!stamp && stamp.rev > baseRev && !deps.has(stamp.op);
  });
}

function branchOfDeps(state: ShapeStoreState, rec: ShapeRecord, deps: readonly string[]): ShapeConflict | null {
  for (let i = deps.length - 1; i >= 0; i--) {
    const entry = state.applied[deps[i]];
    if (!entry?.conflict) continue;
    const branch = rec.conflicts.find((c) => c.id === entry.conflict);
    if (branch) return branch;
  }
  return null;
}

function openConflict(rec: ShapeRecord, conflict: ShapeConflict): boolean {
  if (rec.conflicts.length >= MAX_CONFLICTS_PER_SHAPE) return false; // caller DEFERS, never records
  rec.conflicts.push(conflict);
  return true;
}

export interface ApplyContext {
  /** Optional: overrides nothing; reserved so callers can thread diagnostics without changing semantics. */
  label?: string;
}

/** Apply ops in order to a COPY of state. Deterministic: same state + same ops → same result. */
export function applyOps(state: ShapeStoreState, ops: readonly ShapeOp[], _ctx: ApplyContext = {}): { state: ShapeStoreState; outcomes: OpOutcome[] } {
  const next = cloneJson(state);
  const deferredShapes = new Set<string>();
  const outcomes = ops.map((op) => {
    // Once an op for a shape is deferred, every later op for that shape in this batch waits too:
    // applying a later patch first and the earlier one afterwards would invert the author's order.
    if (op && deferredShapes.has(op.shapeId) && !next.applied[op.opId]) {
      return { opId: op.opId, shapeId: op.shapeId, outcome: 'deferred' as const, reason: 'an earlier change to this shape is waiting', seq: next.seq };
    }
    const outcome = applyOne(next, op);
    if (outcome.outcome === 'deferred') deferredShapes.add(op.shapeId);
    return outcome;
  });
  return { state: next, outcomes };
}

function applyOne(state: ShapeStoreState, op: ShapeOp): OpOutcome {
  const prior = typeof op?.opId === 'string' ? state.applied[op.opId] : undefined;
  if (prior) {
    return { opId: op.opId, shapeId: op.shapeId, outcome: 'duplicate', recorded: prior.outcome, conflict: prior.conflict, reason: prior.reason, seq: prior.seq };
  }
  const seq = state.seq + 1;
  const finish = (outcome: AppliedOutcome, conflict?: string, reason?: string): OpOutcome => {
    state.seq = seq;
    const entry: AppliedEntry = { seq, device: op.device, outcome };
    if (conflict) entry.conflict = conflict;
    if (reason) entry.reason = reason;
    state.applied[op.opId] = entry;
    return { opId: op.opId, shapeId: op.shapeId, outcome, conflict, reason, seq };
  };
  // Not recorded and no state change: the op remains in its author's durable journal.
  const defer = (reason: string): OpOutcome => ({ opId: op.opId, shapeId: op.shapeId, outcome: 'deferred', reason, seq: state.seq });
  const problem = validateOp(op);
  if (problem) {
    // Recorded so a malformed op is idempotently rejected rather than re-evaluated forever; it is
    // only recordable when it has a usable opId/device, otherwise it is rejected without a record.
    if (typeof op?.opId === 'string' && op.opId && typeof op?.device === 'string' && op.device) return finish('rejected', undefined, problem);
    return { opId: String(op?.opId ?? ''), shapeId: String(op?.shapeId ?? ''), outcome: 'rejected', reason: problem, seq: state.seq };
  }
  const deps = new Set(op.deps);
  const rec = state.records[op.shapeId];
  const branch = (kind: ConflictKind, extra: Partial<ShapeConflict>): ShapeConflict => ({
    id: op.opId, kind, ops: [op.opId], device: op.device, source: op.source,
    baseRev: 'baseRev' in op ? op.baseRev : 0, fields: [], patch: null, proposed: null, atSeq: seq, ...extra,
  });

  switch (op.kind) {
    case 'create': {
      if (!rec) {
        state.records[op.shapeId] = {
          id: op.shapeId, rev: 1, live: true, content: cloneJson(op.content),
          fields: stampAll(op.content, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'v2', conflicts: [],
        };
        return finish('applied');
      }
      const c = branch('id-collision', { proposed: cloneJson(op.content), patch: rec.content ? diffContent(rec.content, op.content) : null });
      return openConflict(rec, c) ? finish('conflict', c.id) : defer('conflict limit: resolve this shape\'s open decisions first');
    }

    case 'import': {
      // Deterministic id per (share code, source feature). Any record — live, tombstone or held —
      // means this feature was already imported: re-opening the link must not duplicate it, and
      // must not resurrect it if the farmer deleted the imported copy.
      if (rec) return finish('noop', undefined, 'already imported');
      // Pass 3: …nor after that tombstone was compacted away (deletion identity outlives it).
      if (state.deletedImports?.[op.shapeId] !== undefined) return finish('noop', undefined, 'imported earlier and deleted');
      state.records[op.shapeId] = {
        id: op.shapeId, rev: 1, live: true, content: cloneJson(op.content),
        fields: stampAll(op.content, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'import', conflicts: [],
      };
      return finish('applied');
    }

    case 'update': {
      if (!rec) {
        // No record: never existed here, or its tombstone was pruned. Hold the author's full
        // version for the farmer; re-creating silently could resurrect a deletion.
        state.records[op.shapeId] = {
          id: op.shapeId, rev: 1, live: false, content: cloneJson(op.proposed),
          fields: stampAll(op.proposed, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'v2',
          conflicts: [branch('missing-target', { patch: cloneJson(op.patch), proposed: cloneJson(op.proposed) })],
        };
        return finish('conflict', op.opId, op.baseSeq < state.prunedBelowSeq ? 'target pruned' : 'target unknown');
      }
      const folded = branchOfDeps(state, rec, op.deps);
      if (folded) {
        folded.patch = mergePatches(folded.patch ?? {}, op.patch);
        folded.proposed = cloneJson(op.proposed);
        folded.ops.push(op.opId);
        return finish('conflict', folded.id);
      }
      if (!rec.live) {
        const c = branch('edit-after-delete', { patch: cloneJson(op.patch), proposed: cloneJson(op.proposed) });
        return openConflict(rec, c) ? finish('conflict', c.id) : defer('conflict limit: resolve this shape\'s open decisions first');
      }
      const touched = Object.keys(op.patch);
      if (touched.length === 0) return finish('noop', undefined, 'empty patch');
      const clash = concurrentFields(rec, touched, op.baseRev, deps);
      if (clash.length === 0) {
        rec.content = applyPatch(rec.content as ShapeContent, op.patch);
        rec.rev += 1;
        for (const field of touched) rec.fields[field] = { rev: rec.rev, op: op.opId };
        return finish('applied');
      }
      const c = branch('concurrent-edit', { fields: clash, patch: cloneJson(op.patch), proposed: cloneJson(op.proposed) });
      return openConflict(rec, c) ? finish('conflict', c.id) : defer('conflict limit: resolve this shape\'s open decisions first');
    }

    case 'delete': {
      if (!rec) return finish('noop', undefined, 'nothing to delete');
      const folded = branchOfDeps(state, rec, op.deps);
      if (folded) {
        if (!rec.live && folded.kind === 'edit-after-delete') {
          // "I edited it offline, then deleted it" meets "it was deleted": both sides agree.
          rec.conflicts = rec.conflicts.filter((c) => c !== folded);
          return finish('applied', undefined, 'branch agreed with deletion');
        }
        folded.patch = null;
        folded.proposed = null;
        folded.kind = rec.live ? 'delete-vs-edit' : folded.kind;
        folded.ops.push(op.opId);
        return finish('conflict', folded.id);
      }
      if (!rec.live) return finish('noop', undefined, 'already deleted');
      const clash = concurrentFields(rec, Object.keys(rec.fields), op.baseRev, deps);
      if (clash.length === 0) {
        rec.live = false;
        rec.rev += 1;
        rec.deletedBy = op.opId;
        rec.deletedSeq = seq;
        return finish('applied');
      }
      const c = branch('delete-vs-edit', { fields: clash });
      return openConflict(rec, c) ? finish('conflict', c.id) : defer('conflict limit: resolve this shape\'s open decisions first');
    }

    case 'resolve': {
      const target = rec?.conflicts.find((c) => c.id === op.conflictId);
      if (!rec || !target) return finish('noop', undefined, 'conflict already resolved');
      rec.conflicts = rec.conflicts.filter((c) => c !== target);
      rec.resolved = [...(rec.resolved ?? []), { conflict: target, choice: op.choice, atSeq: seq }];
      rec.rev += 1;
      const restore = (content: ShapeContent) => {
        rec.live = true;
        rec.content = cloneJson(content);
        rec.fields = stampAll(content, rec.rev, op.opId);
        delete rec.deletedBy;
        delete rec.deletedSeq;
      };
      const markDeleted = () => {
        rec.live = false;
        rec.deletedBy = op.opId;
        rec.deletedSeq = seq;
      };
      if (op.choice === 'keep-current') {
        // A held record that the farmer declines to restore becomes an ordinary tombstone.
        if (!rec.live && rec.deletedSeq === undefined) markDeleted();
        return finish('applied');
      }
      if (op.choice === 'keep-both') {
        const source = target.proposed;
        if (!source) return finish('applied', undefined, 'delete branch has no content to keep; kept current');
        if (state.records[op.newShapeId as string]) return finish('noop', undefined, 'newShapeId in use');
        state.records[op.newShapeId as string] = {
          id: op.newShapeId as string, rev: 1, live: true, content: cloneJson(source),
          fields: stampAll(source, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'v2', conflicts: [],
        };
        if (!rec.live && rec.deletedSeq === undefined) markDeleted();
        return finish('applied');
      }
      // use-branch
      if (target.patch === null) { markDeleted(); return finish('applied'); }
      if (rec.live && rec.content && target.kind !== 'id-collision') {
        rec.content = applyPatch(rec.content, target.patch);
        for (const field of Object.keys(target.patch)) rec.fields[field] = { rev: rec.rev, op: op.opId };
      } else {
        restore(target.proposed ?? applyPatch(rec.content as ShapeContent, target.patch));
      }
      return finish('applied');
    }

    case 'legacy':
      return applyLegacy(state, op, seq, finish, defer);
  }
}

/**
 * The v1 bridge. Old clients keep writing whole collections to `data/shapes` (the "island"); v2
 * only READS that document and this device's v1 cache, turning each feature into a 'legacy' op.
 *
 *  * Never deletes: a feature missing from a v1 snapshot is indistinguishable from a stale snapshot
 *    — the exact v1 bug — so omission means nothing. (Cost: an old-app deletion does not propagate,
 *    and an old-app reticle edit, which re-ids the shape, shows up as an extra shape. Duplicates are
 *    recoverable; silent loss is not. The rules fence in GATES removes this cost.)
 *  * Content already ingested (digest in `known`) is a no-op, so stale copies cannot re-assert.
 *  * The island is one Firestore document, so its writes have a linear order: the server commit
 *    time old clients stamp with serverTimestamp(). A NEWER island write is the old app's edit on
 *    top of what we last ingested from the island and merges by the normal field rule with that
 *    ingest as its base. An OLDER island observation is superseded by the island itself → no-op.
 *  * Unversioned content (this device's v1 cache, or an island with no timestamp) cannot be ordered
 *    against anything, so a difference becomes a 'legacy-divergence' branch for the farmer.
 */
function applyLegacy(
  state: ShapeStoreState,
  op: Extract<ShapeOp, { kind: 'legacy' }>,
  seq: number,
  finish: (outcome: AppliedOutcome, conflict?: string, reason?: string) => OpOutcome,
  defer: (reason: string) => OpOutcome,
): OpOutcome {
  const d = contentDigest(op.content);
  const rec = state.records[op.shapeId];
  const entry = state.legacy[op.shapeId];
  const remember = (rev: number) => {
    const e = state.legacy[op.shapeId] ?? { shapeId: op.shapeId, known: [], island: 0, islandDigest: null, rev };
    if (!e.known.includes(d)) e.known = [...e.known, d].slice(-LEGACY_KNOWN_HASHES);
    if (op.island > e.island) { e.island = op.island; e.islandDigest = d; }
    state.legacy[op.shapeId] = e;
  };
  const divergence = (target: ShapeRecord, reason: string): OpOutcome => {
    const c: ShapeConflict = {
      id: op.opId, kind: target.live ? 'legacy-divergence' : 'edit-after-delete', ops: [op.opId], device: op.device,
      source: op.source, baseRev: entry?.rev ?? 0, fields: [],
      patch: target.content ? diffContent(target.content, op.content) : null, proposed: cloneJson(op.content), atSeq: seq,
    };
    // Open the branch BEFORE recording the digest as ingested: a deferred ingest must stay un-ingested.
    if (!openConflict(target, c)) return defer('conflict limit: resolve this shape\'s open decisions first');
    remember(entry?.rev ?? target.rev);
    return finish('conflict', c.id, reason);
  };

  if (!entry) {
    if (rec) {
      if (rec.live && sameContent(rec.content, op.content)) { remember(rec.rev); return finish('noop', undefined, 'identical'); }
      return divergence(rec, 'id already used by a v2 shape');
    }
    state.records[op.shapeId] = {
      id: op.shapeId, rev: 1, live: true, content: cloneJson(op.content),
      fields: stampAll(op.content, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'legacy', conflicts: [],
    };
    remember(1);
    return finish('applied');
  }

  if (entry.known.includes(d)) { remember(entry.rev); return finish('noop', undefined, 'already ingested'); }
  if (op.island > 0 && op.island <= entry.island) return finish('noop', undefined, 'superseded island observation');
  if (!rec) {
    // Legacy-derived tombstones are never pruned while ingest is enabled; reaching here means the
    // store was edited by hand. Hold rather than resurrect.
    state.records[op.shapeId] = {
      id: op.shapeId, rev: 1, live: false, content: cloneJson(op.content),
      fields: stampAll(op.content, 1, op.opId), createdBy: op.opId, createdSeq: seq, origin: 'legacy',
      conflicts: [{ id: op.opId, kind: 'missing-target', ops: [op.opId], device: op.device, source: op.source, baseRev: 0, fields: [], patch: null, proposed: cloneJson(op.content), atSeq: seq }],
    };
    remember(1);
    return finish('conflict', op.opId, 'legacy target missing');
  }
  if (op.island > 0 && entry.islandDigest !== null) {
    if (!rec.live) return divergence(rec, 'old app edited a deleted shape');
    const patch = diffContent(rec.content as ShapeContent, op.content);
    const touched = Object.keys(patch);
    if (touched.length === 0) { remember(rec.rev); return finish('noop', undefined, 'identical'); }
    const clash = concurrentFields(rec, touched, entry.rev, new Set());
    if (clash.length === 0) {
      rec.content = applyPatch(rec.content as ShapeContent, patch);
      rec.rev += 1;
      for (const field of touched) rec.fields[field] = { rev: rec.rev, op: op.opId };
      entry.rev = rec.rev;
      remember(rec.rev);
      return finish('applied', undefined, 'newer island write');
    }
    return divergence(rec, 'old app and v2 both changed this shape');
  }
  if (rec.live && sameContent(rec.content, op.content)) { remember(entry.rev); return finish('noop', undefined, 'identical'); }
  return divergence(rec, op.island > 0 ? 'first island version after local-only ingest' : 'unversioned local copy differs');
}

// ── Legacy id assignment ─────────────────────────────────────────────────────────────────────

export interface LegacyItem { shapeId: string; content: ShapeContent }
export interface QuarantinedFeature { index: number; reason: string; raw: string }

/**
 * Give every v1 feature a deterministic shape id without ever merging two distinct features:
 *  * a valid, unique string id is kept as-is (Mapbox Draw ids — continuity for the draw store);
 *  * a finite numeric id becomes `lgn-<n>`;
 *  * a missing/invalid id becomes `lgx-<scope>-<contentDigest>-<occurrence>`; the occurrence counter
 *    keeps two coincident id-less features distinct, and `scope` (island vs. this device) keeps two
 *    devices' id-less copies from being merged on a digest match;
 *  * an id that appears more than once in one collection is ambiguous, so EVERY occurrence becomes
 *    `<id>~<contentDigest>~<occurrence>` — never "first one wins".
 * Features that fail validation are quarantined (kept verbatim for export), not dropped silently.
 */
export function assignLegacyIds(features: unknown, scope: string): { items: LegacyItem[]; quarantined: QuarantinedFeature[] } {
  const items: LegacyItem[] = [];
  const quarantined: QuarantinedFeature[] = [];
  if (!Array.isArray(features)) return { items, quarantined };
  const parsed: Array<{ index: number; rawId: unknown; content: ShapeContent }> = [];
  features.forEach((feature, index) => {
    const result = contentFromFeature(feature);
    if (!result.ok) {
      let raw = '';
      try { raw = JSON.stringify(feature) ?? ''; } catch { raw = '[unserialisable]'; }
      quarantined.push({ index, reason: result.reason, raw });
      return;
    }
    parsed.push({ index, rawId: isPlainObject(feature) ? feature.id : undefined, content: result.content });
  });
  const idCount = new Map<string, number>();
  for (const p of parsed) {
    if (isValidShapeId(p.rawId)) idCount.set(p.rawId, (idCount.get(p.rawId) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  const nextOccurrence = (key: string) => { const n = occurrences.get(key) ?? 0; occurrences.set(key, n + 1); return n; };
  const scopeTag = digest(scope).slice(0, 10);
  for (const p of parsed) {
    const d = contentDigest(p.content);
    let shapeId: string;
    if (isValidShapeId(p.rawId) && idCount.get(p.rawId) === 1) shapeId = p.rawId;
    else if (isValidShapeId(p.rawId)) shapeId = `${p.rawId}~${d}~${nextOccurrence(`${p.rawId}|${d}`)}`;
    else if (typeof p.rawId === 'number' && Number.isFinite(p.rawId) && Number.isInteger(p.rawId)) shapeId = `lgn-${p.rawId}`;
    else shapeId = `lgx-${scopeTag}-${d}-${nextOccurrence(d)}`;
    items.push({ shapeId, content: p.content });
  }
  // Two numeric ids can still collide with each other only if they are the same number, which the
  // duplicate rule did not see (numbers are not valid string ids). Disambiguate the same way.
  const seen = new Map<string, number>();
  for (const item of items) seen.set(item.shapeId, (seen.get(item.shapeId) ?? 0) + 1);
  for (const item of items) {
    if ((seen.get(item.shapeId) ?? 0) > 1) item.shapeId = `${item.shapeId}~${contentDigest(item.content)}~${nextOccurrence(`dup|${item.shapeId}`)}`;
  }
  return { items, quarantined };
}

/** Deterministic id for an imported shared-site feature. */
export function importShapeId(code: string, sourceId: unknown, index: number): string {
  const codePart = digest(`share:${code}`).slice(0, 12);
  const srcPart = isValidShapeId(sourceId) ? digest(`id:${sourceId}`).slice(0, 12) : `i${index}`;
  return `imp-${codePart}-${srcPart}`;
}

// ── Views ────────────────────────────────────────────────────────────────────────────────────

/** The live shapes, in a stable order. This is what the draw store and FARM_KEY cache show. */
export function materializeLive(state: ShapeStoreState): FeatureCollection {
  const live = Object.values(state.records)
    .filter((rec) => rec.live && rec.content)
    .sort((a, b) => (a.createdSeq - b.createdSeq) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { type: 'FeatureCollection', features: live.map((rec) => featureFromContent(rec.id, rec.content as ShapeContent)) };
}

export interface ConflictView {
  shapeId: string;
  conflictId: string;
  kind: ConflictKind;
  /** Whether the shape is currently on the map. */
  live: boolean;
  current: Feature | null;
  /** The preserved other version; null means "the other side wants it deleted". */
  other: Feature | null;
  fields: FieldKey[];
  device: string;
  source: OpSource;
}

export function listConflicts(state: ShapeStoreState): ConflictView[] {
  const out: ConflictView[] = [];
  for (const rec of Object.values(state.records)) {
    for (const c of rec.conflicts) {
      const current = rec.live && rec.content ? featureFromContent(rec.id, rec.content) : null;
      let otherContent: ShapeContent | null = c.proposed;
      if (!otherContent && c.patch && rec.content) otherContent = applyPatch(rec.content, c.patch);
      out.push({
        shapeId: rec.id, conflictId: c.id, kind: c.kind, live: rec.live, current,
        other: otherContent ? featureFromContent(rec.id, otherContent) : null,
        fields: [...c.fields], device: c.device, source: c.source,
      });
    }
  }
  return out.sort((a, b) => (a.shapeId < b.shapeId ? -1 : a.shapeId > b.shapeId ? 1 : 0) || (a.conflictId < b.conflictId ? -1 : 1));
}

// ── Device bookkeeping + compaction ──────────────────────────────────────────────────────────

export function touchDevice(state: ShapeStoreState, device: string, info: { nowMs: number; ackSeq?: number }): void {
  const prev = state.devices[device];
  state.devices[device] = {
    seenSeq: state.seq,
    lastSeenMs: Math.max(prev?.lastSeenMs ?? 0, Number.isFinite(info.nowMs) ? info.nowMs : 0),
  };
}

/**
 * Pass 2: an idempotency entry is removed ONLY when its op id is reported as durably removed from
 * the author's journal (controller ack records). Pass 1 pruned by a per-device ackSeq watermark,
 * which is unsound when several tabs share one device id: one tab's watermark could prune another
 * tab's committed-but-unacknowledged op, and its replay would then apply twice.
 */
export function pruneAcked(state: ShapeStoreState, ackedOpIds: readonly string[]): ShapeStoreState {
  if (ackedOpIds.length === 0) return state;
  const next = cloneJson(state);
  for (const opId of ackedOpIds) delete next.applied[opId];
  return next;
}

export interface RetentionPolicy {
  /** A device unseen for longer stops holding back tombstone pruning. Liveness only — see below. */
  activeDeviceWindowMs: number;
  /** A device unseen for longer, with nothing un-acked, is dropped from the registry. */
  forgetDeviceMs: number;
  /** Legacy- and import-derived tombstones are only prunable once the v1 bridge is retired. */
  legacyBridgeRetired: boolean;
}

/**
 * Retention is NOT a correctness bound, unlike v1's 90-day local tombstone TTL:
 *  * applied-op entries (idempotency) are removed only by pruneAcked — an explicit report that the op
 *    was durably removed from its author's journal — never by age or watermark, so nothing that can
 *    still be replayed ever loses its dedupe entry;
 *  * a v2 tombstone is pruned only once every device seen within `activeDeviceWindowMs` has observed
 *    it. A device that comes back after longer than that is still safe: its edits/deletes against a
 *    pruned shape are HELD as 'missing-target' for the farmer, not resurrected or dropped;
 *  * legacy/import tombstones are kept while the v1 bridge can still re-assert those ids;
 *  * pass 3: once an IMPORT tombstone is pruned its shapeId stays in `deletedImports` for good — the
 *    share link is re-openable whatever the bridge state, so its deletion identity is never forgotten.
 */
export const DEFAULT_RETENTION: RetentionPolicy = {
  activeDeviceWindowMs: 400 * 24 * 60 * 60 * 1000,
  forgetDeviceMs: 800 * 24 * 60 * 60 * 1000,
  legacyBridgeRetired: false,
};

export function compactState(state: ShapeStoreState, nowMs: number, policy: RetentionPolicy = DEFAULT_RETENTION): ShapeStoreState {
  const next = cloneJson(state);
  // applied entries are pruned only by pruneAcked (explicit per-op acks), never here.
  const active = Object.values(next.devices).filter((d) => nowMs - d.lastSeenMs <= policy.activeDeviceWindowMs);
  const legacyTargets = new Set(Object.values(next.legacy).map((e) => e.shapeId));
  for (const [id, rec] of Object.entries(next.records)) {
    if (rec.live || rec.conflicts.length > 0 || rec.deletedSeq === undefined) continue;
    const bridged = rec.origin !== 'v2' || legacyTargets.has(id);
    if (bridged && !policy.legacyBridgeRetired) continue;
    if (active.length === 0 || !active.every((d) => d.seenSeq >= (rec.deletedSeq as number))) continue;
    // Pass 3: an import tombstone leaves its compact identity behind, so the same deterministic
    // share-import id can never be re-created by re-opening the link.
    if (rec.origin === 'import') next.deletedImports = { ...(next.deletedImports ?? {}), [id]: rec.deletedSeq as number };
    delete next.records[id];
    next.prunedBelowSeq = Math.max(next.prunedBelowSeq, (rec.deletedSeq as number) + 1);
  }
  const owners = new Set(Object.values(next.applied).map((e) => e.device));
  for (const [device, entry] of Object.entries(next.devices)) {
    if (nowMs - entry.lastSeenMs > policy.forgetDeviceMs && !owners.has(device)) delete next.devices[device];
  }
  return next;
}

/**
 * Rollback aid (reviewed admin action only, see docs): what the v1 `data/shapes` document should
 * contain to hand the map back to v1 clients without losing anything — every live v2 shape plus
 * every island feature v2 has never ingested (an old client's unseen addition). Pure; never deletes.
 * Pass 2: prefer planLegacyRollback, which refuses while anything v1 cannot represent is open.
 */
export function materializeForLegacyRollback(state: ShapeStoreState, islandFeatures: unknown): { fc: FeatureCollection; unseenIslandFeatures: number } {
  const fc = materializeLive(state);
  const { items } = assignLegacyIds(islandFeatures, 'island');
  let unseen = 0;
  for (const item of items) {
    if (state.records[item.shapeId] || state.legacy[item.shapeId] || state.deletedImports?.[item.shapeId] !== undefined) continue;
    fc.features.push(featureFromContent(item.shapeId, item.content));
    unseen += 1;
  }
  return { fc, unseenIslandFeatures: unseen };
}

export interface LegacyRollbackPlan {
  /** True only when writing `fc` to v1 loses nothing v2 holds server-side. */
  safe: boolean;
  fc: FeatureCollection;
  unseenIslandFeatures: number;
  /** Everything v1 cannot represent. Each must be resolved, or exported and accepted, first. */
  blockers: {
    conflicts: ConflictView[];          // open branches (full other-version geometry included)
    heldRecords: string[];              // off-map records awaiting a decision (missing-target etc.)
    unparseableIslandFeatures: QuarantinedFeature[];
  };
  /** Never visible server-side: pending device journals. Rollback requires every v2 device to be
   *  drained (flushed) or exported first — the plan cannot prove this, so it always says so. */
  requiresDeviceDrain: true;
}

/**
 * Pass 2 rollback contract. v1 has no tombstones, branches, holds or queues, so a v1 snapshot can
 * only carry the live heads. This plan therefore:
 *  * never resurrects a v2 deletion (tombstoned ids from the island are excluded, as before);
 *  * never silently drops an open conflict branch or held record — it lists them and marks unsafe;
 *  * never claims device journals are empty (requiresDeviceDrain is always true).
 */
export function planLegacyRollback(state: ShapeStoreState, islandFeatures: unknown): LegacyRollbackPlan {
  const { fc, unseenIslandFeatures } = materializeForLegacyRollback(state, islandFeatures);
  const conflicts = listConflicts(state);
  const heldRecords = Object.values(state.records)
    .filter((rec) => !rec.live && rec.deletedSeq === undefined)
    .map((rec) => rec.id).sort();
  const { quarantined } = assignLegacyIds(islandFeatures, 'island');
  return {
    safe: conflicts.length === 0 && heldRecords.length === 0 && quarantined.length === 0,
    fc, unseenIslandFeatures,
    blockers: { conflicts, heldRecords, unparseableIslandFeatures: quarantined },
    requiresDeviceDrain: true,
  };
}

// ── v1 island: shared op derivation + drain decision (pass 2) ───────────────────────────────

export interface IslandOps {
  /** 'empty' = no content at all (absent shapesJson / null / a collection with zero features). */
  kind: 'content' | 'empty' | 'unparseable';
  ops: ShapeOp[];
  quarantined: QuarantinedFeature[];
}

/** One deterministic op per island feature. Identical on every device for the same island write. */
export function legacyIslandOps(shapesJson: unknown, islandVersion: number, device: string, baseSeq: number): IslandOps {
  if (shapesJson === undefined || shapesJson === null) return { kind: 'empty', ops: [], quarantined: [] };
  if (typeof shapesJson !== 'string') return { kind: 'unparseable', ops: [], quarantined: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(shapesJson); } catch { return { kind: 'unparseable', ops: [], quarantined: [] }; }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.features)) return { kind: 'unparseable', ops: [], quarantined: [] };
  const version = Number.isFinite(islandVersion) && islandVersion > 0 ? Math.floor(islandVersion) : 0;
  const { items, quarantined } = assignLegacyIds(parsed.features, 'island');
  const ops: ShapeOp[] = items.map((item) => ({
    kind: 'legacy', opId: `li-${digest(`${version}|${item.shapeId}|${contentDigest(item.content)}`)}`, device,
    shapeId: item.shapeId, baseSeq, deps: [], source: 'legacy-island', content: item.content, island: version,
  }));
  return { kind: parsed.features.length === 0 ? 'empty' : 'content', ops, quarantined };
}

/**
 * May the v1 island document be DELETED in the same transaction that ingested it?
 *
 * Why delete at all: the frozen v1 reconcile (base user-sync.ts 401–416) OVERWRITES an old client's
 * local cache whenever the island exists (shapesJson:null → an EMPTY collection), but bootstraps
 * from the local cache when the island is absent. A drained island therefore turns an old client's
 * reopen from "lose unsynced local shapes" into "upload them" (tests/shape-sync-v2-old-client.test.ts).
 *
 * Only when nothing can be lost: the island read in THIS transaction (so it cannot have changed
 * unseen), every feature parsed (no quarantine — the island is the only copy of an unreadable
 * feature), and every op recorded (none deferred/rejected — a deferred ingest has no copy in v2 yet).
 * An unparseable island is never deleted. Default OFF in the controller: product gate G13.
 */
export function decideIslandDrain(island: IslandOps, outcomes: readonly OpOutcome[]): { drain: boolean; reason: string } {
  if (island.kind === 'unparseable') return { drain: false, reason: 'island unparseable: kept as the only copy' };
  if (island.quarantined.length > 0) return { drain: false, reason: 'island has unreadable features: kept as the only copy' };
  const bad = outcomes.find((o) => o.outcome === 'deferred' || o.outcome === 'rejected' || (o.outcome === 'duplicate' && o.recorded === 'rejected'));
  if (bad) return { drain: false, reason: `island feature not ingested (${bad.outcome}): kept` };
  if (outcomes.length !== island.ops.length) return { drain: false, reason: 'outcome count mismatch' };
  return { drain: true, reason: island.kind === 'empty' ? 'island holds no shapes' : 'every island shape is recorded in v2' };
}
