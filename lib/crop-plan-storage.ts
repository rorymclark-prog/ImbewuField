'use client';

import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';

// Old loaded JavaScript knows only v1. A new cache cannot intercept its direct
// localStorage writes, so the new book must have one separate canonical address.
export const CROP_PLAN_LEGACY_KEY = 'imbewu_crop_plan_v1';
export const CROP_PLAN_STORAGE_KEY = 'imbewu_crop_plan_v2';
export const CROP_PLAN_CUTOVER_KEY = 'imbewu_crop_plan_cutover_v2';
export const CROP_PLAN_STORAGE_EVENT = 'imbewu-crop-plan-storage-changed';

export interface CropPlanStorageContext {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  legacyKey: string;
  canonicalKey: string;
  receiptKey: string;
  isCurrent: () => boolean;
  sample?: boolean;
}
export interface CropPlanStorageLocks {
  request<T>(name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => T | PromiseLike<T>): Promise<T>;
}
export interface CropPlanStorageStatus {
  status: 'ready' | 'held' | 'sample';
  reason?: string;
  writable: boolean;
  needsInitialisation: boolean;
  legacyDiverged: boolean;
}
interface LegacyAcknowledgement { legacyBytes: string | null; reviewedBookRaw: string; acknowledgementId: string }
interface CanonicalEnvelope { storageVersion: 2; cutoverId: string; bookRaw: string; legacyAcknowledgement?: LegacyAcknowledgement }
interface CutoverEvidence {
  receiptVersion: 1;
  canonicalKey: string;
  cutoverId: string;
  legacyBytes: string | null;
  importedBookRaw: string | null;
  sourceCapture?: { canonicalRaw: string | null; receiptRaw: string | null; legacyRaw: string | null };
}
interface Capture { canonical: string | null; receipt: string | null; legacy: string | null }
export interface CropPlanStorageRead extends CropPlanStorageStatus {
  /** Private raw evidence/token; never include these in a rendered status or log. */
  bookRaw: string | null;
  token: string | null;
}
interface Lease { context: CropPlanStorageContext; release: () => void; active: boolean; id: string; proof: object }
const leaseProofs = new WeakMap<object, Lease>();
const leases = new Map<string, Lease>();
const unconfirmedReviews = new Map<string, CropPlanStorageContext>();
const transferHolds = new Map<string, { context: CropPlanStorageContext; reason: string }>();
const pending = new Map<string, { context: CropPlanStorageContext; promise: Promise<CropPlanStorageStatus> }>();
let leaseGeneration = 0;
function sameContext(a: CropPlanStorageContext, b: CropPlanStorageContext): boolean {
  return a.storage === b.storage && a.canonicalKey === b.canonicalKey && a.legacyKey === b.legacyKey && a.receiptKey === b.receiptKey;
}
const held = (reason: string, bookRaw: string | null = null, legacyDiverged = false): CropPlanStorageRead =>
  ({ status: 'held', reason, writable: false, needsInitialisation: reason === 'upgrade-required', legacyDiverged, bookRaw, token: null });
function sampleActive(): boolean | null {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1'; } catch { return null; }
}
export function makeBrowserCropPlanStorageContext(): CropPlanStorageContext | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const sample = sampleActive(); if (sample === null) return null;
    const owner = activeAccountUid(), storage = window.localStorage;
    const canonicalKey = activeAccountLocalStorageKey(CROP_PLAN_STORAGE_KEY), legacyKey = activeAccountLocalStorageKey(CROP_PLAN_LEGACY_KEY), receiptKey = activeAccountLocalStorageKey(CROP_PLAN_CUTOVER_KEY);
    return { storage, sample, canonicalKey, legacyKey, receiptKey,
      isCurrent: () => activeAccountUid() === owner && sampleActive() === sample && window.localStorage === storage
        && activeAccountLocalStorageKey(CROP_PLAN_STORAGE_KEY) === canonicalKey
        && activeAccountLocalStorageKey(CROP_PLAN_LEGACY_KEY) === legacyKey && activeAccountLocalStorageKey(CROP_PLAN_CUTOVER_KEY) === receiptKey };
  } catch { return null; }
}
function emit(): void {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CROP_PLAN_STORAGE_EVENT)); } catch { /* The receipt, not an optional UI event, proves a write. */ }
}
function capture(c: CropPlanStorageContext): Capture {
  if (!c.isCurrent()) throw Error('context-changed');
  const snapshot = { canonical: c.storage.getItem(c.canonicalKey), receipt: c.storage.getItem(c.receiptKey), legacy: c.storage.getItem(c.legacyKey) };
  if (!c.isCurrent()) throw Error('context-changed');
  return snapshot;
}
function same(a: Capture, b: Capture): boolean { return a.canonical === b.canonical && a.receipt === b.receipt && a.legacy === b.legacy; }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function authoredEnvelope(raw: string): boolean {
  try { const book: unknown = JSON.parse(raw); return object(book) && book.version === 1 && Array.isArray(book.plantings); } catch { return false; }
}
function validAcknowledgement(value: unknown): value is LegacyAcknowledgement {
  return object(value) && Object.keys(value).length === 3 && (value.legacyBytes === null || typeof value.legacyBytes === 'string')
    && typeof value.reviewedBookRaw === 'string' && authoredEnvelope(value.reviewedBookRaw)
    && typeof value.acknowledgementId === 'string' && !!value.acknowledgementId;
}
function canonical(raw: string | null): CanonicalEnvelope | null {
  try {
    const e: unknown = raw === null ? null : JSON.parse(raw);
    return object(e) && Object.keys(e).every(k => ['storageVersion', 'cutoverId', 'bookRaw', 'legacyAcknowledgement'].includes(k)) && e.storageVersion === 2 && typeof e.cutoverId === 'string' && !!e.cutoverId
      && typeof e.bookRaw === 'string' && authoredEnvelope(e.bookRaw)
      && (e.legacyAcknowledgement === undefined || validAcknowledgement(e.legacyAcknowledgement)) ? e as unknown as CanonicalEnvelope : null;
  } catch { return null; }
}
function validSourceCapture(value: unknown): boolean {
  return object(value) && Object.keys(value).length === 3 && ['canonicalRaw', 'receiptRaw', 'legacyRaw'].every(key => value[key] === null || typeof value[key] === 'string');
}
function evidence(raw: string | null, key: string): CutoverEvidence | null {
  try {
    const e: unknown = raw === null ? null : JSON.parse(raw);
    const keys = ['receiptVersion', 'canonicalKey', 'cutoverId', 'legacyBytes', 'importedBookRaw', 'sourceCapture'];
    return object(e) && Object.keys(e).every(k => keys.includes(k)) && e.receiptVersion === 1 && e.canonicalKey === key
      && typeof e.cutoverId === 'string' && !!e.cutoverId && (e.legacyBytes === null || typeof e.legacyBytes === 'string')
      && (e.importedBookRaw === null || typeof e.importedBookRaw === 'string' && authoredEnvelope(e.importedBookRaw))
      && (e.sourceCapture === undefined || validSourceCapture(e.sourceCapture)) ? e as unknown as CutoverEvidence : null;
  } catch { return null; }
}
function currentLease(c: CropPlanStorageContext): Lease | null {
  const lease = leases.get(c.canonicalKey);
  if (!lease?.active) return null;
  if (!lease.context.isCurrent()) { lease.release(); return null; }
  return c.isCurrent() && sameContext(lease.context, c) && lease.active && leases.get(c.canonicalKey) === lease ? lease : null;
}
function ownsLease(c: CropPlanStorageContext): boolean { return currentLease(c) !== null; }
/** Private provenance, not a live raw-book equality check: safe same-lease
 * rebases still need their independently checked fresh raw admission. */
export function captureCropPlanStorageLease(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): object | null {
  try { return context && !context.sample ? currentLease(context)?.proof ?? null : null; } catch { return null; }
}
export function cropPlanStorageLeaseMatches(proof: object | null | undefined, context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): boolean {
  try {
    const lease = proof && leaseProofs.get(proof);
    return !!lease && !!context && !context.sample && currentLease(context) === lease;
  } catch { return false; }
}
function writeToken(c: CropPlanStorageContext, s: Capture, lease: Lease): string {
  return JSON.stringify([c.canonicalKey, s.canonical, s.receipt, s.legacy, lease.id]);
}
function inspect(c: CropPlanStorageContext, s: Capture): CropPlanStorageRead {
  if (s.canonical === null && s.receipt === null) return s.legacy !== null && !authoredEnvelope(s.legacy)
    ? held('legacy-unreadable') : held('upgrade-required', s.legacy);
  const book = canonical(s.canonical), proof = evidence(s.receipt, c.canonicalKey);
  if (!book || !proof || book.cutoverId !== proof.cutoverId) return held('cutover-recovery-required', book?.bookRaw ?? null);
  const baseline = book.legacyAcknowledgement ? book.legacyAcknowledgement.legacyBytes : proof.legacyBytes;
  if (s.legacy !== baseline) return held('legacy-diverged', book.bookRaw, true);
  const lease = currentLease(c), writable = lease !== null;
  return { status: writable ? 'ready' : 'held', ...(writable ? {} : { reason: 'writer-not-acquired' }), writable,
    needsInitialisation: false, legacyDiverged: false, bookRaw: book.bookRaw,
    token: lease ? writeToken(c, s, lease) : null };
}
export function readCropPlanStorageTransferHold(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): string | null {
  if (!context || context.sample) return null;
  const hold = transferHolds.get(context.canonicalKey);
  if (!hold) return null;
  if (!hold.context.isCurrent()) { transferHolds.delete(context.canonicalKey); return null; }
  return context.isCurrent() && sameContext(hold.context, context) ? hold.reason : null;
}
export function readCropPlanStorage(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): CropPlanStorageRead {
  try {
    if (!context) return held('storage-unavailable');
    if (!context.isCurrent()) return held('context-changed');
    if (context.sample) return { status: 'sample', writable: false, needsInitialisation: false, legacyDiverged: false, bookRaw: null, token: null };
    const unconfirmed = unconfirmedReviews.get(context.canonicalKey);
    if (unconfirmed && !unconfirmed.isCurrent()) unconfirmedReviews.delete(context.canonicalKey);
    else if (unconfirmed && sameContext(unconfirmed, context)) return held('review-write-unconfirmed', canonical(capture(context).canonical)?.bookRaw ?? null);
    if (readCropPlanStorageTransferHold(context)) return held('guest-transfer-held');
    const s = capture(context), result = inspect(context, s);
    return same(s, capture(context)) ? result : held('book-changed', result.bookRaw);
  } catch { return held('storage-unavailable'); }
}

/** Opaque source evidence only. A read receipt never enters the writer-lease map. */
export interface CropPlanStorageReadReceipt { readonly kind: 'crop-plan-storage-read-receipt' }
export type CropPlanStorageView =
  | { readonly status: 'ready'; readonly bookRaw: string; readonly receipt: CropPlanStorageReadReceipt }
  | { readonly status: 'held'; readonly reason: string };
interface ReadProof {
  readonly context: CropPlanStorageContext;
  readonly snapshot: Capture;
  checking: boolean;
}
const readProofs = new WeakMap<object, ReadProof>();
const readable = (value: CropPlanStorageRead): value is CropPlanStorageRead & { bookRaw: string } =>
  value.bookRaw !== null && (value.status === 'ready' || value.reason === 'writer-not-acquired');

/** Freeze the original addresses and predicate, rather than letting a retained
 * receipt adopt a mutated context object or a later account's equal bytes. */
function bindReadContext(original: CropPlanStorageContext): CropPlanStorageContext {
  const { storage, legacyKey, canonicalKey, receiptKey, sample, isCurrent } = original;
  return Object.freeze({ storage, legacyKey, canonicalKey, receiptKey, sample,
    isCurrent: () => original.storage === storage && original.legacyKey === legacyKey
      && original.canonicalKey === canonicalKey && original.receiptKey === receiptKey
      && original.sample === sample && original.isCurrent === isCurrent && isCurrent.call(original) });
}

/** Read the proven canonical book without acquiring or initializing an editing
 * lease. Every other store hold remains authoritative, including legacy edits,
 * pending transfers and an unconfirmed review acknowledgement. */
export function readCropPlanStorageView(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): CropPlanStorageView {
  let receipt: CropPlanStorageReadReceipt | null = null;
  try {
    if (!context || context.sample) return { status: 'held', reason: context?.sample ? 'sample-source-required' : 'storage-unavailable' };
    const bound = bindReadContext(context), before = capture(bound), captured = inspect(bound, before), source = readCropPlanStorage(bound);
    if (!readable(source)) return { status: 'held', reason: source.reason ?? 'source-unavailable' };
    if (!readable(captured)) return { status: 'held', reason: captured.reason ?? 'source-unavailable' };
    if (captured.bookRaw !== source.bookRaw || !same(before, capture(bound))) return { status: 'held', reason: 'book-changed' };
    receipt = Object.freeze({}) as CropPlanStorageReadReceipt;
    readProofs.set(receipt, { context: bound, snapshot: before, checking: false });
    if (!cropPlanStorageReadReceiptIsCurrent(receipt)) return { status: 'held', reason: 'book-changed' };
    return Object.freeze({ status: 'ready', bookRaw: captured.bookRaw, receipt });
  } catch {
    releaseCropPlanStorageReadReceipt(receipt);
    return { status: 'held', reason: 'storage-unavailable' };
  }
}

/** Any observed source/context failure permanently retires this receipt, even
 * if another writer later restores the same strings. No fallback reads legacy. */
export function cropPlanStorageReadReceiptIsCurrent(
  receipt: unknown, context?: CropPlanStorageContext | null,
): receipt is CropPlanStorageReadReceipt {
  const proof = receipt && typeof receipt === 'object' ? readProofs.get(receipt) : null;
  if (!proof) return false;
  if (proof.checking) { readProofs.delete(receipt as object); return false; }
  let current = false;
  proof.checking = true;
  try {
    const c = proof.context;
    if ((context === undefined || !!context && context.isCurrent() && sameContext(c, context) && context.sample === c.sample)
      && c.isCurrent() && same(proof.snapshot, capture(c))) {
      const captured = inspect(c, proof.snapshot), source = readCropPlanStorage(c);
      current = readable(captured) && readable(source) && captured.bookRaw === source.bookRaw
        && same(proof.snapshot, capture(c)) && c.isCurrent()
        && readProofs.get(receipt as object) === proof;
    }
  } catch { /* Unreadable source evidence cannot retain a read receipt. */ }
  finally { proof.checking = false; }
  if (!current) readProofs.delete(receipt as object);
  return current;
}
export function releaseCropPlanStorageReadReceipt(receipt: unknown): void {
  if (receipt && typeof receipt === 'object') readProofs.delete(receipt);
}
export function readCropPlanStorageStatus(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): CropPlanStorageStatus {
  const { status, reason, writable, needsInitialisation, legacyDiverged } = readCropPlanStorage(context);
  return { status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged };
}
export function releaseAllDocumentCropPlanLeases(): void {
  leaseGeneration++; pending.clear();
  for (const lease of [...leases.values()]) lease.release();
}
function browserLocks(): CropPlanStorageLocks | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks;
}
function lockName(c: CropPlanStorageContext): string { return `imbewu-crop-plan:${c.canonicalKey}`; }
function newId(): string { return crypto.randomUUID(); }
function emptyRaw(): string { return JSON.stringify({ version: 1, plantings: [], updatedAt: Date.now() }); }
function pair(c: CropPlanStorageContext, legacyBytes: string | null, bookRaw: string, sourceCapture?: Capture): { canonical: string; receipt: string } {
  const cutoverId = newId();
  return { canonical: JSON.stringify({ storageVersion: 2, cutoverId, bookRaw } satisfies CanonicalEnvelope),
    receipt: JSON.stringify({ receiptVersion: 1, canonicalKey: c.canonicalKey, cutoverId, legacyBytes, importedBookRaw: bookRaw,
      ...(sourceCapture === undefined ? {} : { sourceCapture: { canonicalRaw: sourceCapture.canonical, receiptRaw: sourceCapture.receipt, legacyRaw: sourceCapture.legacy } }) } satisfies CutoverEvidence) };
}
function install(c: CropPlanStorageContext, before: Capture, next: { canonical: string; receipt: string }): void {
  if (!same(before, capture(c))) throw Error('book-changed');
  // Evidence first makes a failed second write distinguishable from a fresh
  // installation. Retrying must never silently replace that frozen import.
  c.storage.setItem(c.receiptKey, next.receipt);
  if (!same({ ...before, receipt: next.receipt }, capture(c))) throw Error('book-changed');
  c.storage.setItem(c.canonicalKey, next.canonical);
  if (!same({ ...before, receipt: next.receipt, canonical: next.canonical }, capture(c))) throw Error('book-changed');
}
export function initialiseCropPlanStorage(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext(), locks: CropPlanStorageLocks | null | undefined = browserLocks()): Promise<CropPlanStorageStatus> {
  if (!context || context.sample) return Promise.resolve(readCropPlanStorageStatus(context));
  if (!context.isCurrent()) return Promise.resolve(held('context-changed'));
  if (readCropPlanStorage(context).reason === 'review-write-unconfirmed') return Promise.resolve(held('review-write-unconfirmed'));
  if (readCropPlanStorageTransferHold(context)) return Promise.resolve(held('guest-transfer-held'));
  if (ownsLease(context)) return Promise.resolve(readCropPlanStorageStatus(context));
  const queued = pending.get(context.canonicalKey);
  if (queued && sameContext(queued.context, context) && queued.context.isCurrent()) {
    return queued.promise.then(() => readCropPlanStorageStatus(context));
  }
  if (!locks) return Promise.resolve(held('web-locks-unavailable'));
  let resolve!: (status: CropPlanStorageStatus) => void;
  const result = new Promise<CropPlanStorageStatus>(done => { resolve = value => {
    const { status, reason, writable, needsInitialisation, legacyDiverged } = value;
    done({ status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged });
  }; });
  pending.set(context.canonicalKey, { context, promise: result });
  const generation = leaseGeneration, requestedContext = context;
  const guarded: CropPlanStorageContext = { ...context, isCurrent: () => generation === leaseGeneration && requestedContext.isCurrent() };
  void locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) { resolve(held('another-writer')); return; }
    let lease: Lease | undefined;
    const context = guarded;
    try {
      if (!context.isCurrent()) { resolve(held('context-changed')); return; }
      if (readCropPlanStorageTransferHold(context)) { resolve(held('guest-transfer-held')); return; }
      const before = capture(context), state = inspect(context, before);
      if (state.reason === 'upgrade-required') install(context, before, pair(context, before.legacy, before.legacy ?? emptyRaw()));
      else if (state.reason !== 'writer-not-acquired') { resolve(state); return; }
      let release!: () => void;
      const released = new Promise<void>(done => { release = done; });
      lease = { context, active: true, id: newId(), proof: Object.freeze({}), release: () => {
        if (!lease?.active) return; lease.active = false;
        if (leases.get(context.canonicalKey) === lease) leases.delete(context.canonicalKey);
        release(); emit();
      } };
      leases.set(context.canonicalKey, lease); leaseProofs.set(lease.proof, lease);
      resolve(readCropPlanStorageStatus(context)); emit();
      // A held Web Lock is the actual exclusion mechanism. Check/set alone is
      // never called compare-and-swap, and old v1 clients do not participate.
      await released;
    } catch { lease?.release(); resolve(readCropPlanStorageStatus(context)); }
  }).catch(() => resolve(held('lock-unavailable'))).finally(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
  void result.then(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
  return result;
}

/** Explicit recovery resumes only the exact immutable receipt. It never rereads
 * legacy bytes as a replacement import or overwrites an existing canonical row. */
export async function recoverCropPlanStorage(context: CropPlanStorageContext, locks: CropPlanStorageLocks | null | undefined = browserLocks()): Promise<CropPlanStorageStatus> {
  if (!locks || context.sample || ownsLease(context)) return held('recovery-unavailable');
  try {
    return await locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) return held('another-writer');
      const s = capture(context), proof = evidence(s.receipt, context.canonicalKey);
      if (s.canonical !== null || !proof || proof.legacyBytes !== s.legacy || proof.importedBookRaw === null) return held('cutover-recovery-required');
      const raw = JSON.stringify({ storageVersion: 2, cutoverId: proof.cutoverId, bookRaw: proof.importedBookRaw } satisfies CanonicalEnvelope);
      if (!same(s, capture(context))) return held('book-changed');
      context.storage.setItem(context.canonicalKey, raw);
      return readCropPlanStorageStatus(context);
    });
  } catch { return held('cutover-recovery-required'); }
}
export function writeCropPlanStorageRaw(bookRaw: string, context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): { saved: true; token: string } | { saved: false; token: null } {
  const fail = { saved: false, token: null } as const;
  try {
    if (!context || context.sample || readCropPlanStorage(context).reason === 'review-write-unconfirmed' || readCropPlanStorageTransferHold(context) || !ownsLease(context) || !authoredEnvelope(bookRaw)) return fail;
    const before = capture(context), state = inspect(context, before), book = canonical(before.canonical);
    const lease = currentLease(context);
    if (!state.writable || !book || !same(before, capture(context)) || !lease || currentLease(context) !== lease) return fail;
    const raw = JSON.stringify({ ...book, bookRaw });
    context.storage.setItem(context.canonicalKey, raw);
    // The receipt names our exact write, not a later read from another writer.
    return { saved: true, token: writeToken(context, { ...before, canonical: raw }, lease) };
  } catch { return fail; }
}

export interface CropPlanStorageTransferOptions {
  locks?: CropPlanStorageLocks | null;
  sourceLegacyIsEmpty: (raw: string | null) => boolean;
  targetLegacyIsEmpty: (raw: string | null) => boolean;
}
async function performCropPlanStorageTransfer(source: CropPlanStorageContext, target: CropPlanStorageContext, options: CropPlanStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
  const locks = options.locks === undefined ? browserLocks() : options.locks;
  if (!locks || source.sample || target.sample || source.storage !== target.storage || source.canonicalKey === target.canonicalKey) return { status: 'held', reason: 'transfer-unavailable' };
  const ordered = [source, target].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  if (ordered.some(c => ownsLease(c))) return { status: 'held', reason: 'document-lease-active' };
  try {
    return await locks.request(lockName(ordered[0]), { mode: 'exclusive', ifAvailable: true }, async first => {
      if (!first) return { status: 'held', reason: 'another-writer' };
      return locks.request(lockName(ordered[1]), { mode: 'exclusive', ifAvailable: true }, second => {
        if (!second) return { status: 'held', reason: 'another-writer' };
        const from = capture(source), to = capture(target);
        if (to.canonical !== null || to.receipt !== null) return { status: 'preserved', reason: 'destination-present' };
        if (!options.targetLegacyIsEmpty(to.legacy)) return { status: 'preserved', reason: 'destination-present' };
        let bookRaw: string;
        if (from.canonical === null && from.receipt === null) {
          if (options.sourceLegacyIsEmpty(from.legacy)) return { status: 'preserved', reason: 'no-guest-work' };
          if (from.legacy === null || !authoredEnvelope(from.legacy)) return { status: 'held', reason: 'legacy-unreadable' };
          bookRaw = from.legacy;
        } else {
          const state = inspect(source, from);
          if (state.reason !== 'writer-not-acquired' || state.bookRaw === null) return { status: 'held', reason: state.reason ?? 'source-unavailable' };
          bookRaw = state.bookRaw;
        }
        if (!same(from, capture(source)) || !same(to, capture(target))) return { status: 'held', reason: 'context-changed' };
        const next = pair(target, to.legacy, bookRaw, from);
        install(target, to, next);
        if (!same(from, capture(source)) || !same({ ...to, ...next }, capture(target))) return { status: 'held', reason: 'guest-source-changed' };
        // Both current destination rows now prove the copy. Cleanup never
        // consumes a changed guest row or assigns a bare unknown owner.
        let remaining = from;
        for (const [field, key] of [['canonical', source.canonicalKey], ['receipt', source.receiptKey], ['legacy', source.legacyKey]] as const) {
          if (!same(remaining, capture(source)) || !same({ ...to, ...next }, capture(target))) return { status: 'held', reason: 'guest-source-changed' };
          if (remaining[field] !== null) source.storage.removeItem(key);
          remaining = { ...remaining, [field]: null };
          if (!same(remaining, capture(source))) return { status: 'held', reason: 'guest-source-changed' };
        }
        if (!source.isCurrent() || !target.isCurrent()) return { status: 'held', reason: 'context-changed' };
        return { status: 'transferred' };
      });
    });
  } catch { return { status: 'held', reason: 'transfer-recovery-required' }; }
}

export async function transferCropPlanStoragePair(source: CropPlanStorageContext, target: CropPlanStorageContext, options: CropPlanStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
  let result: { status: 'transferred' | 'preserved' | 'held'; reason?: string };
  try {
    const to = capture(target);
    if (to.canonical !== null || to.receipt !== null || !options.targetLegacyIsEmpty(to.legacy)) result = { status: 'preserved', reason: 'destination-present' };
    else {
      const from = capture(source);
      if (from.canonical === null && from.receipt === null && options.sourceLegacyIsEmpty(from.legacy)) result = { status: 'preserved', reason: 'no-guest-work' };
      else result = await performCropPlanStorageTransfer(source, target, options);
    }
    if (source.isCurrent() && target.isCurrent()) {
      if (result.status === 'held') {
        const now = capture(target);
        if (now.canonical === null && now.receipt === null) transferHolds.set(target.canonicalKey, { context: target, reason: result.reason ?? 'transfer-unavailable' });
      } else if (sameContext(transferHolds.get(target.canonicalKey)?.context ?? target, target)) transferHolds.delete(target.canonicalKey);
    }
    return result;
  } catch {
    if (target.isCurrent()) {
      try { const to = capture(target); if (to.canonical === null && to.receipt === null) transferHolds.set(target.canonicalKey, { context: target, reason: 'transfer-recovery-required' }); } catch { /* Unreadable storage already holds; never manufacture an empty replacement. */ }
    }
    return { status: 'held', reason: 'transfer-recovery-required' };
  }
}

export interface CropPlanLegacyReview {
  readonly status: 'available';
  /** Raw saved-row counts include held rows; equality does not prove equal dates,
   * quantities, nursery evidence or other metadata. */
  readonly currentSavedRows: number | null;
  readonly olderSavedRows: number | null;
  readonly review: object;
}
interface LegacyReviewProof { context: CropPlanStorageContext; snapshot: Capture; consumed: boolean }
const legacyReviews = new WeakMap<object, LegacyReviewProof>();
function savedRows(raw: string | null): number | null {
  try { const value: unknown = raw === null ? null : JSON.parse(raw); return object(value) && Array.isArray(value.plantings) ? value.plantings.length : null; } catch { return null; }
}
export function readCropPlanLegacyReview(context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): CropPlanLegacyReview | null {
  try {
    if (!context || context.sample || readCropPlanStorage(context).reason === 'review-write-unconfirmed' || readCropPlanStorageTransferHold(context)) return null;
    const snapshot = capture(context), state = inspect(context, snapshot), book = canonical(snapshot.canonical);
    if (state.reason !== 'legacy-diverged' || !book || !same(snapshot, capture(context))) return null;
    const review = Object.freeze({});
    legacyReviews.set(review, { context, snapshot: Object.freeze({ ...snapshot }), consumed: false });
    return Object.freeze({ status: 'available', currentSavedRows: savedRows(book.bookRaw), olderSavedRows: savedRows(snapshot.legacy), review });
  } catch { return null; }
}
function currentReview(review: object, context: CropPlanStorageContext | null): LegacyReviewProof | null {
  const proof = legacyReviews.get(review);
  if (!proof || proof.consumed || !context || context.sample || readCropPlanStorage(context).reason === 'review-write-unconfirmed' || readCropPlanStorageTransferHold(context) || !sameContext(proof.context, context)
    || !proof.context.isCurrent() || !context.isCurrent() || !same(proof.snapshot, capture(context))) return null;
  return proof;
}
export function cropPlanLegacyReviewIsCurrent(review: object, context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): boolean {
  try { return !!currentReview(review, context); } catch { return false; }
}
function exportedTransferCopies(source: NonNullable<CutoverEvidence['sourceCapture']>, seen = new Set<string>()): unknown {
  const book = canonical(source.canonicalRaw);
  let receipt: Record<string, unknown> | null = null;
  try { const parsed: unknown = source.receiptRaw === null ? null : JSON.parse(source.receiptRaw); if (object(parsed)) receipt = parsed; } catch { /* Preserve the authored copies even if nested provenance is unreadable. */ }
  const nested = receipt?.sourceCapture;
  if (source.receiptRaw !== null) {
    if (seen.has(source.receiptRaw)) throw Error('Cyclic transfer provenance');
    seen.add(source.receiptRaw);
  }
  return { canonicalBookRaw: book?.bookRaw ?? null, olderBookRaw: source.legacyRaw,
    initialImportBookRaw: typeof receipt?.importedBookRaw === 'string' ? receipt.importedBookRaw : null,
    ...(book?.legacyAcknowledgement ? { previouslyReviewedCopies: { canonicalBookRaw: book.legacyAcknowledgement.reviewedBookRaw, olderBookRaw: book.legacyAcknowledgement.legacyBytes } } : {}),
    ...(nested && validSourceCapture(nested) ? { transferredCopies: exportedTransferCopies(nested as NonNullable<CutoverEvidence['sourceCapture']>, seen) } : {}) };
}
export function exportCropPlanLegacyReview(review: object, context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext()): { filename: 'crop-plan-copies.json'; json: string } | null {
  try {
    const proof = currentReview(review, context); if (!proof || !context) return null;
    const book = canonical(proof.snapshot.canonical), receipt = evidence(proof.snapshot.receipt, context.canonicalKey);
    if (!book || !receipt) return null;
    return { filename: 'crop-plan-copies.json', json: JSON.stringify({ exportVersion: 1,
      canonicalBookRaw: book.bookRaw, olderBookRaw: proof.snapshot.legacy, initialImportBookRaw: receipt.importedBookRaw,
      ...(receipt.sourceCapture ? { transferredCopies: exportedTransferCopies(receipt.sourceCapture) } : {}),
      ...(book.legacyAcknowledgement ? { previouslyReviewedCopies: { canonicalBookRaw: book.legacyAcknowledgement.reviewedBookRaw,
        olderBookRaw: book.legacyAcknowledgement.legacyBytes } } : {}) }, null, 2) + '\n' };
  } catch { return null; }
}
export async function keepCurrentCropPlanAfterLegacyReview(review: object, context: CropPlanStorageContext | null = makeBrowserCropPlanStorageContext(), locks: CropPlanStorageLocks | null | undefined = browserLocks()): Promise<{ status: 'kept' | 'held' | 'superseded'; reason?: string }> {
  try {
    if (!context || !currentReview(review, context)) return { status: 'superseded', reason: 'review-changed' };
    const keep = (): { status: 'kept' | 'held' | 'superseded'; reason?: string } => {
      const proof = currentReview(review, context);
      if (!proof) return { status: 'superseded', reason: 'review-changed' };
      const book = canonical(proof.snapshot.canonical);
      if (!book || inspect(context, proof.snapshot).reason !== 'legacy-diverged') return { status: 'superseded', reason: 'review-changed' };
      const raw = JSON.stringify({ ...book, legacyAcknowledgement: { legacyBytes: proof.snapshot.legacy,
        reviewedBookRaw: book.bookRaw, acknowledgementId: newId() } satisfies LegacyAcknowledgement });
      if (!currentReview(review, context)) return { status: 'superseded', reason: 'review-changed' };
      context.storage.setItem(context.canonicalKey, raw); proof.consumed = true;
      // A completed acknowledgement is never described as a failed write with
      // an automatic retry. Its receipt can become superseded independently.
      let confirmed = false;
      try { confirmed = same({ ...proof.snapshot, canonical: raw }, capture(context)); } catch { /* The write completed; only its confirmation failed. */ }
      if (!confirmed) {
        unconfirmedReviews.set(context.canonicalKey, context);
        const lease = leases.get(context.canonicalKey); if (lease && sameContext(lease.context, context)) lease.release();
      }
      emit(); return confirmed ? { status: 'kept' } : { status: 'superseded', reason: 'written-review-changed' };
    };
    if (ownsLease(context)) return keep();
    if (!locks) return { status: 'held', reason: 'web-locks-unavailable' };
    return await locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, lock =>
      lock ? keep() : { status: 'held', reason: 'another-writer' });
  } catch { return { status: 'held', reason: 'review-write-failed' }; }
}
