'use client';

import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';

// Old loaded JavaScript knows only v1. A new cache cannot intercept its direct
// localStorage writes. Linked observations need one separate canonical address;
// importing old bytes never normalizes away unknown evidence or malformed rows.
export const JOURNAL_LEGACY_KEY = 'imbewu_field_journal_v1';
export const JOURNAL_STORAGE_KEY = 'imbewu_field_journal_v2';
export const JOURNAL_CUTOVER_KEY = 'imbewu_field_journal_cutover_v2';
export const JOURNAL_STORAGE_EVENT = 'imbewu-journal-storage-changed';

export interface JournalStorageContext {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  legacyKey: string;
  canonicalKey: string;
  receiptKey: string;
  isCurrent: () => boolean;
  sample?: boolean;
}
export interface JournalStorageLocks {
  request<T>(name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => T | PromiseLike<T>): Promise<T>;
}
export interface JournalStorageStatus {
  status: 'ready' | 'held' | 'sample';
  reason?: string;
  writable: boolean;
  needsInitialisation: boolean;
  legacyDiverged: boolean;
}
interface LegacyAcknowledgement { legacyBytes: string | null; reviewedJournalRaw: string; acknowledgementId: string }
interface CanonicalEnvelope { storageVersion: 2; cutoverId: string; journalRaw: string; legacyAcknowledgement?: LegacyAcknowledgement }
interface CutoverEvidence {
  receiptVersion: 1;
  canonicalKey: string;
  cutoverId: string;
  legacyBytes: string | null;
  importedJournalRaw: string | null;
  sourceCapture?: { canonicalRaw: string | null; receiptRaw: string | null; legacyRaw: string | null };
}
interface Capture { canonical: string | null; receipt: string | null; legacy: string | null }
export interface JournalStorageRead extends JournalStorageStatus {
  /** Private raw evidence/token; never include these in a rendered status or log. */
  journalRaw: string | null;
  token: string | null;
}
interface Lease { context: JournalStorageContext; release: () => void; active: boolean; id: string; proof: object }
const leaseProofs = new WeakMap<object, Lease>();
const leases = new Map<string, Lease>();
const unconfirmedWrites = new Map<string, { context: JournalStorageContext; expected: Capture }>();
const transferHolds = new Map<string, { context: JournalStorageContext; reason: string }>();
const pending = new Map<string, { context: JournalStorageContext; promise: Promise<JournalStorageStatus> }>();
let leaseGeneration = 0;
let lifecycleWindow: Window | null = null;
const lifecycleChanged = () => releaseAllDocumentJournalLeases();
function observeLifecycle(): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || lifecycleWindow === window) return;
  stopLifecycle(); lifecycleWindow = window;
  window.addEventListener('pagehide', lifecycleChanged);
  window.addEventListener('imbewu-sample-mode-changed', lifecycleChanged);
}
function stopLifecycle(): void {
  lifecycleWindow?.removeEventListener('pagehide', lifecycleChanged);
  lifecycleWindow?.removeEventListener('imbewu-sample-mode-changed', lifecycleChanged);
  lifecycleWindow = null;
}
function sameContext(a: JournalStorageContext, b: JournalStorageContext): boolean {
  return a.storage === b.storage && a.canonicalKey === b.canonicalKey && a.legacyKey === b.legacyKey && a.receiptKey === b.receiptKey && !!a.sample === !!b.sample;
}
const held = (reason: string, journalRaw: string | null = null, legacyDiverged = false): JournalStorageRead =>
  ({ status: 'held', reason, writable: false, needsInitialisation: reason === 'upgrade-required', legacyDiverged, journalRaw, token: null });
function sampleActive(): boolean | null {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1'; } catch { return null; }
}
export function makeBrowserJournalStorageContext(): JournalStorageContext | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const sample = sampleActive(); if (sample === null) return null;
    const owner = activeAccountUid(), storage = window.localStorage;
    const canonicalKey = activeAccountLocalStorageKey(JOURNAL_STORAGE_KEY), legacyKey = activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY), receiptKey = activeAccountLocalStorageKey(JOURNAL_CUTOVER_KEY);
    return { storage, sample, canonicalKey, legacyKey, receiptKey,
      isCurrent: () => activeAccountUid() === owner && sampleActive() === sample && window.localStorage === storage
        && activeAccountLocalStorageKey(JOURNAL_STORAGE_KEY) === canonicalKey
        && activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY) === legacyKey && activeAccountLocalStorageKey(JOURNAL_CUTOVER_KEY) === receiptKey };
  } catch { return null; }
}
function emit(): void {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(JOURNAL_STORAGE_EVENT)); } catch { /* The receipt, not an optional UI event, proves a write. */ }
}
function capture(c: JournalStorageContext): Capture {
  if (!c.isCurrent()) throw Error('context-changed');
  if ([c.canonicalKey, c.receiptKey, c.legacyKey].some(key => typeof key !== 'string' || !key)
    || new Set([c.canonicalKey, c.receiptKey, c.legacyKey]).size !== 3) throw Error('invalid-storage-context');
  const snapshot = { canonical: c.storage.getItem(c.canonicalKey), receipt: c.storage.getItem(c.receiptKey), legacy: c.storage.getItem(c.legacyKey) };
  if (Object.values(snapshot).some(raw => raw !== null && typeof raw !== 'string')) throw Error('storage-unavailable');
  if (!c.isCurrent()) throw Error('context-changed');
  return snapshot;
}
function same(a: Capture, b: Capture): boolean { return a.canonical === b.canonical && a.receipt === b.receipt && a.legacy === b.legacy; }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function authoredArray(raw: string): boolean {
  try { if (typeof raw !== 'string') return false; const book: unknown = JSON.parse(raw); return Array.isArray(book); } catch { return false; }
}
function validAcknowledgement(value: unknown): value is LegacyAcknowledgement {
  return object(value) && Object.keys(value).length === 3 && (value.legacyBytes === null || typeof value.legacyBytes === 'string')
    && typeof value.reviewedJournalRaw === 'string' && authoredArray(value.reviewedJournalRaw)
    && typeof value.acknowledgementId === 'string' && !!value.acknowledgementId;
}
function canonical(raw: string | null): CanonicalEnvelope | null {
  try {
    const e: unknown = raw === null ? null : JSON.parse(raw);
    return object(e) && Object.keys(e).every(k => ['storageVersion', 'cutoverId', 'journalRaw', 'legacyAcknowledgement'].includes(k)) && e.storageVersion === 2 && typeof e.cutoverId === 'string' && !!e.cutoverId
      && typeof e.journalRaw === 'string' && authoredArray(e.journalRaw)
      && (e.legacyAcknowledgement === undefined || validAcknowledgement(e.legacyAcknowledgement)) ? e as unknown as CanonicalEnvelope : null;
  } catch { return null; }
}
function validSourceCapture(value: unknown): boolean {
  return object(value) && Object.keys(value).length === 3 && ['canonicalRaw', 'receiptRaw', 'legacyRaw'].every(key => value[key] === null || typeof value[key] === 'string');
}
function evidence(raw: string | null, key: string): CutoverEvidence | null {
  try {
    const e: unknown = raw === null ? null : JSON.parse(raw);
    const keys = ['receiptVersion', 'canonicalKey', 'cutoverId', 'legacyBytes', 'importedJournalRaw', 'sourceCapture'];
    return object(e) && Object.keys(e).every(k => keys.includes(k)) && e.receiptVersion === 1 && e.canonicalKey === key
      && typeof e.cutoverId === 'string' && !!e.cutoverId && (e.legacyBytes === null || typeof e.legacyBytes === 'string')
      && (e.importedJournalRaw === null || typeof e.importedJournalRaw === 'string' && authoredArray(e.importedJournalRaw))
      && (e.sourceCapture === undefined || validSourceCapture(e.sourceCapture)) ? e as unknown as CutoverEvidence : null;
  } catch { return null; }
}
function currentLease(c: JournalStorageContext): Lease | null {
  const lease = leases.get(c.canonicalKey);
  if (!lease?.active) return null;
  if (!lease.context.isCurrent()) { lease.release(); return null; }
  return c.isCurrent() && sameContext(lease.context, c) && lease.active && leases.get(c.canonicalKey) === lease ? lease : null;
}
function ownsLease(c: JournalStorageContext): boolean { return currentLease(c) !== null; }
/** Private provenance, not a live raw-journal equality check: safe same-lease
 * rebases still need their independently checked fresh raw admission. */
export function captureJournalStorageLease(context: JournalStorageContext | null = makeBrowserJournalStorageContext()): object | null {
  try { return context && !context.sample && readJournalStorage(context).writable ? currentLease(context)?.proof ?? null : null; } catch { return null; }
}
export function journalStorageLeaseMatches(proof: object | null | undefined, context: JournalStorageContext | null = makeBrowserJournalStorageContext()): boolean {
  try {
    const lease = proof && leaseProofs.get(proof);
    return !!lease && !!context && !context.sample && readJournalStorage(context).writable && currentLease(context) === lease;
  } catch { return false; }
}
function writeToken(c: JournalStorageContext, s: Capture, lease: Lease): string {
  return JSON.stringify([c.canonicalKey, s.canonical, s.receipt, s.legacy, lease.id]);
}
function inspect(c: JournalStorageContext, s: Capture): JournalStorageRead {
  if (s.canonical === null && s.receipt === null) return s.legacy !== null && !authoredArray(s.legacy)
    ? held('legacy-unreadable') : held('upgrade-required', s.legacy);
  const book = canonical(s.canonical), proof = evidence(s.receipt, c.canonicalKey);
  if (!book || !proof || book.cutoverId !== proof.cutoverId) return held('cutover-recovery-required', book?.journalRaw ?? null);
  const baseline = book.legacyAcknowledgement ? book.legacyAcknowledgement.legacyBytes : proof.legacyBytes;
  if (s.legacy !== baseline) return held('legacy-diverged', book.journalRaw, true);
  const lease = currentLease(c), writable = lease !== null;
  return { status: writable ? 'ready' : 'held', ...(writable ? {} : { reason: 'writer-not-acquired' }), writable,
    needsInitialisation: false, legacyDiverged: false, journalRaw: book.journalRaw,
    token: lease ? writeToken(c, s, lease) : null };
}
export function readJournalStorageTransferHold(context: JournalStorageContext | null = makeBrowserJournalStorageContext()): string | null {
  if (!context || context.sample) return null;
  const hold = transferHolds.get(context.canonicalKey);
  if (!hold) return null;
  if (!hold.context.isCurrent()) { transferHolds.delete(context.canonicalKey); return null; }
  return context.isCurrent() && sameContext(hold.context, context) ? hold.reason : null;
}
export function readJournalStorage(context: JournalStorageContext | null = makeBrowserJournalStorageContext()): JournalStorageRead {
  try {
    if (!context) return held('storage-unavailable');
    if (!context.isCurrent()) return held('context-changed');
    if (context.sample) return { status: 'sample', writable: false, needsInitialisation: false, legacyDiverged: false, journalRaw: null, token: null };
    const write = unconfirmedWrites.get(context.canonicalKey);
    if (write && !write.context.isCurrent()) unconfirmedWrites.delete(context.canonicalKey);
    else if (write && sameContext(write.context, context)) return held('write-unconfirmed', canonical(capture(context).canonical)?.journalRaw ?? null);
    if (readJournalStorageTransferHold(context)) return held('guest-transfer-held');
    const s = capture(context), result = inspect(context, s);
    return same(s, capture(context)) ? result : held('journal-changed', result.journalRaw);
  } catch { return held('storage-unavailable'); }
}
export function readJournalStorageStatus(context: JournalStorageContext | null = makeBrowserJournalStorageContext()): JournalStorageStatus {
  const { status, reason, writable, needsInitialisation, legacyDiverged } = readJournalStorage(context);
  return { status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged };
}
export function releaseAllDocumentJournalLeases(): void {
  leaseGeneration++; pending.clear(); stopLifecycle();
  for (const lease of [...leases.values()]) lease.release();
}
function browserLocks(): JournalStorageLocks | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks;
}
function lockName(c: JournalStorageContext): string { return `imbewu-journal:${c.canonicalKey}`; }
function newId(): string { return crypto.randomUUID(); }
function emptyRaw(): string { return '[]'; }
function pair(c: JournalStorageContext, legacyBytes: string | null, journalRaw: string, sourceCapture?: Capture): { canonical: string; receipt: string } {
  const cutoverId = newId();
  return { canonical: JSON.stringify({ storageVersion: 2, cutoverId, journalRaw } satisfies CanonicalEnvelope),
    receipt: JSON.stringify({ receiptVersion: 1, canonicalKey: c.canonicalKey, cutoverId, legacyBytes, importedJournalRaw: journalRaw,
      ...(sourceCapture === undefined ? {} : { sourceCapture: { canonicalRaw: sourceCapture.canonical, receiptRaw: sourceCapture.receipt, legacyRaw: sourceCapture.legacy } }) } satisfies CutoverEvidence) };
}
function install(c: JournalStorageContext, before: Capture, next: { canonical: string; receipt: string }): void {
  if (!same(before, capture(c))) throw Error('journal-changed');
  // Evidence first makes a failed second write distinguishable from a fresh
  // installation. Retrying must never silently replace that frozen import.
  c.storage.setItem(c.receiptKey, next.receipt);
  if (!same({ ...before, receipt: next.receipt }, capture(c))) throw Error('journal-changed');
  c.storage.setItem(c.canonicalKey, next.canonical);
  if (!same({ ...before, receipt: next.receipt, canonical: next.canonical }, capture(c))) throw Error('journal-changed');
}
export function initialiseJournalStorage(context: JournalStorageContext | null = makeBrowserJournalStorageContext(), locks: JournalStorageLocks | null | undefined = browserLocks()): Promise<JournalStorageStatus> {
  if (!context || context.sample) return Promise.resolve(readJournalStorageStatus(context));
  if (!context.isCurrent()) return Promise.resolve(held('context-changed'));
  if (readJournalStorage(context).reason === 'write-unconfirmed') return Promise.resolve(held('write-unconfirmed'));
  if (readJournalStorageTransferHold(context)) return Promise.resolve(held('guest-transfer-held'));
  if (ownsLease(context)) return Promise.resolve(readJournalStorageStatus(context));
  const queued = pending.get(context.canonicalKey);
  if (queued && sameContext(queued.context, context) && queued.context.isCurrent()) {
    return queued.promise.then(() => readJournalStorageStatus(context));
  }
  if (!locks) return Promise.resolve(held('web-locks-unavailable'));
  observeLifecycle();
  let resolve!: (status: JournalStorageStatus) => void;
  const result = new Promise<JournalStorageStatus>(done => { resolve = value => {
    const { status, reason, writable, needsInitialisation, legacyDiverged } = value;
    done({ status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged });
  }; });
  pending.set(context.canonicalKey, { context, promise: result });
  const generation = leaseGeneration, requestedContext = context;
  const guarded: JournalStorageContext = { ...context, isCurrent: () => generation === leaseGeneration && requestedContext.isCurrent() };
  void locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) { resolve(held('another-writer')); return; }
    let lease: Lease | undefined;
    const context = guarded;
    try {
      if (!context.isCurrent()) { resolve(held('context-changed')); return; }
      if (readJournalStorageTransferHold(context)) { resolve(held('guest-transfer-held')); return; }
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
      resolve(readJournalStorageStatus(context)); emit();
      // A held Web Lock is the actual exclusion mechanism. Check/set alone is
      // never called compare-and-swap, and old v1 clients do not participate.
      await released;
    } catch { lease?.release(); resolve(readJournalStorageStatus(context)); }
  }).catch(() => resolve(held('lock-unavailable'))).finally(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
  void result.then(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
  return result;
}

/** Explicit recovery resumes only the exact immutable receipt. It never rereads
 * legacy bytes as a replacement import or overwrites an existing canonical row. */
export async function recoverJournalStorage(context: JournalStorageContext, locks: JournalStorageLocks | null | undefined = browserLocks()): Promise<JournalStorageStatus> {
  if (!locks || context.sample || ownsLease(context)) return held('recovery-unavailable');
  observeLifecycle();
  const generation = leaseGeneration, original = context;
  context = { ...context, isCurrent: () => generation === leaseGeneration && original.isCurrent() };
  try {
    return await locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) return held('another-writer');
      const s = capture(context), proof = evidence(s.receipt, context.canonicalKey);
      const unconfirmed = unconfirmedWrites.get(context.canonicalKey);
      if (unconfirmed && sameContext(unconfirmed.context, context)) {
        if (!same(unconfirmed.expected, s) || !same(s, capture(context)) || inspect(context, s).reason !== 'writer-not-acquired') return held('write-unconfirmed');
        unconfirmedWrites.delete(context.canonicalKey); emit(); return readJournalStorageStatus(context);
      }
      if (s.canonical !== null || !proof || proof.legacyBytes !== s.legacy || proof.importedJournalRaw === null) return held('cutover-recovery-required');
      const raw = JSON.stringify({ storageVersion: 2, cutoverId: proof.cutoverId, journalRaw: proof.importedJournalRaw } satisfies CanonicalEnvelope);
      if (!same(s, capture(context))) return held('journal-changed');
      context.storage.setItem(context.canonicalKey, raw);
      if (!same({ ...s, canonical: raw }, capture(context))) return held('cutover-recovery-required');
      return readJournalStorageStatus(context);
    });
  } catch { return held('cutover-recovery-required'); }
}
export type JournalStorageWriteReceipt = { status: 'written'; token: string }
  | { status: 'held'; reason: string } | { status: 'unconfirmed'; reason: string };
export function writeJournalStorageRaw(journalRaw: string, expectedToken: string | null,
  context: JournalStorageContext | null = makeBrowserJournalStorageContext(), sourceIsCurrent: () => boolean = () => true): JournalStorageWriteReceipt {
  let attempted = false, performed = false, expected: Capture | null = null, before: Capture | null = null;
  const unconfirmed = (): JournalStorageWriteReceipt => {
    if (context && expected) {
      unconfirmedWrites.set(context.canonicalKey, { context, expected });
      const lease = leases.get(context.canonicalKey); if (lease && sameContext(lease.context, context)) lease.release();
    }
    emit(); return { status: 'unconfirmed', reason: 'write-unconfirmed' };
  };
  try {
    if (!context || context.sample || !sourceIsCurrent() || !authoredArray(journalRaw)) return { status: 'held', reason: 'write-unavailable' };
    const read = readJournalStorage(context);
    if (!read.writable || typeof expectedToken !== 'string' || read.token !== expectedToken) return { status: 'held', reason: read.reason ?? 'journal-changed' };
    before = capture(context); const state = inspect(context, before), book = canonical(before.canonical);
    const lease = currentLease(context);
    if (!state.writable || state.token !== expectedToken || !book || !same(before, capture(context)) || !lease || currentLease(context) !== lease
      || !sourceIsCurrent() || !context.isCurrent()) return { status: 'held', reason: 'journal-changed' };
    const raw = JSON.stringify({ ...book, journalRaw });
    if (!same(before, capture(context)) || !sourceIsCurrent() || !context.isCurrent()) return { status: 'held', reason: 'journal-changed' };
    expected = { ...before, canonical: raw }; attempted = true;
    context.storage.setItem(context.canonicalKey, raw);
    performed = true;
    if (!context.isCurrent() || !sourceIsCurrent() || currentLease(context) !== lease || !same(expected, capture(context))) return unconfirmed();
    if (!sourceIsCurrent() || !context.isCurrent() || currentLease(context) !== lease) return unconfirmed();
    const token = writeToken(context, expected, lease); emit(); return { status: 'written', token };
  } catch {
    if (performed) return unconfirmed();
    if (attempted && context && before) {
      try { if (!same(before, capture(context))) return unconfirmed(); } catch { return unconfirmed(); }
    }
    return { status: 'held', reason: 'write-failed' };
  }
}

export interface JournalStorageTransferOptions {
  locks?: JournalStorageLocks | null;
}
function emptyLegacy(raw: string | null): boolean {
  if (raw === null) return true;
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) && value.length === 0; } catch { return false; }
}
async function performJournalStorageTransfer(source: JournalStorageContext, target: JournalStorageContext, options: JournalStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
  const locks = options.locks === undefined ? browserLocks() : options.locks;
  if (!locks || source.sample || target.sample || source.storage !== target.storage || source.canonicalKey === target.canonicalKey) return { status: 'held', reason: 'transfer-unavailable' };
  observeLifecycle();
  const generation = leaseGeneration, originalSource = source, originalTarget = target;
  source = { ...source, isCurrent: () => generation === leaseGeneration && originalSource.isCurrent() };
  target = { ...target, isCurrent: () => generation === leaseGeneration && originalTarget.isCurrent() };
  const ordered = [source, target].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  if (ordered.some(c => ownsLease(c))) return { status: 'held', reason: 'document-lease-active' };
  try {
    return await locks.request(lockName(ordered[0]), { mode: 'exclusive', ifAvailable: true }, async first => {
      if (!first) return { status: 'held', reason: 'another-writer' };
      return locks.request(lockName(ordered[1]), { mode: 'exclusive', ifAvailable: true }, second => {
        if (!second) return { status: 'held', reason: 'another-writer' };
        const from = capture(source), to = capture(target);
        if (to.canonical !== null || to.receipt !== null) return { status: 'preserved', reason: 'destination-present' };
        if (!emptyLegacy(to.legacy)) return { status: 'preserved', reason: 'destination-present' };
        let journalRaw: string;
        if (from.canonical === null && from.receipt === null) {
          if (emptyLegacy(from.legacy)) return { status: 'preserved', reason: 'no-guest-work' };
          if (from.legacy === null || !authoredArray(from.legacy)) return { status: 'held', reason: 'legacy-unreadable' };
          journalRaw = from.legacy;
        } else {
          const state = inspect(source, from);
          if (state.reason !== 'writer-not-acquired' || state.journalRaw === null) return { status: 'held', reason: state.reason ?? 'source-unavailable' };
          journalRaw = state.journalRaw;
        }
        if (!same(from, capture(source)) || !same(to, capture(target))) return { status: 'held', reason: 'context-changed' };
        const next = pair(target, to.legacy, journalRaw, from);
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

export async function transferJournalStoragePair(source: JournalStorageContext, target: JournalStorageContext, options: JournalStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
  let result: { status: 'transferred' | 'preserved' | 'held'; reason?: string };
  try {
    const to = capture(target);
    if (to.canonical !== null || to.receipt !== null || !emptyLegacy(to.legacy)) result = { status: 'preserved', reason: 'destination-present' };
    else {
      const from = capture(source);
      if (from.canonical === null && from.receipt === null && emptyLegacy(from.legacy)) result = { status: 'preserved', reason: 'no-guest-work' };
      else result = await performJournalStorageTransfer(source, target, options);
    }
    if (source.isCurrent() && target.isCurrent()) {
      if (result.status === 'held') {
        const now = capture(target);
        if (now.canonical === null && now.receipt === null) transferHolds.set(target.canonicalKey, { context: target, reason: result.reason ?? 'transfer-unavailable' });
      } else if (sameContext(transferHolds.get(target.canonicalKey)?.context ?? target, target)) transferHolds.delete(target.canonicalKey);
      emit();
    }
    return result;
  } catch {
    if (target.isCurrent()) {
      try { const to = capture(target); if (to.canonical === null && to.receipt === null) transferHolds.set(target.canonicalKey, { context: target, reason: 'transfer-recovery-required' }); } catch { /* Unreadable storage already holds; never manufacture an empty replacement. */ }
      emit();
    }
    return { status: 'held', reason: 'transfer-recovery-required' };
  }
}

export interface JournalLegacyReview {
  readonly status: 'available';
  /** Raw saved-entry counts include held rows; equality does not prove equal
   * dates, observations, links or other authored metadata. */
  readonly currentSavedRows: number | null;
  readonly olderSavedRows: number | null;
  readonly review: object;
}
interface LegacyReviewProof { context: JournalStorageContext; snapshot: Capture; consumed: boolean; generation: number }
const legacyReviews = new WeakMap<object, LegacyReviewProof>();
function savedRows(raw: string | null): number | null {
  try { const value: unknown = raw === null ? null : JSON.parse(raw); return Array.isArray(value) ? value.length : null; } catch { return null; }
}
export function readJournalLegacyReview(context: JournalStorageContext | null = makeBrowserJournalStorageContext()): JournalLegacyReview | null {
  try {
    if (!context || context.sample || readJournalStorage(context).reason === 'write-unconfirmed' || readJournalStorageTransferHold(context)) return null;
    const snapshot = capture(context), state = inspect(context, snapshot), book = canonical(snapshot.canonical);
    if (state.reason !== 'legacy-diverged' || !book || !same(snapshot, capture(context))) return null;
    observeLifecycle();
    const review = Object.freeze({});
    legacyReviews.set(review, { context, snapshot: Object.freeze({ ...snapshot }), consumed: false, generation: leaseGeneration });
    return Object.freeze({ status: 'available', currentSavedRows: savedRows(book.journalRaw), olderSavedRows: savedRows(snapshot.legacy), review });
  } catch { return null; }
}
function currentReview(review: object, context: JournalStorageContext | null): LegacyReviewProof | null {
  const proof = legacyReviews.get(review);
  if (!proof || proof.consumed || proof.generation !== leaseGeneration || !context || context.sample || readJournalStorage(context).reason === 'write-unconfirmed' || readJournalStorageTransferHold(context) || !sameContext(proof.context, context)
    || !proof.context.isCurrent() || !context.isCurrent() || !same(proof.snapshot, capture(context))) return null;
  return proof;
}
export function journalLegacyReviewIsCurrent(review: object, context: JournalStorageContext | null = makeBrowserJournalStorageContext()): boolean {
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
  return { canonicalJournalRaw: book?.journalRaw ?? null, olderJournalRaw: source.legacyRaw,
    initialImportJournalRaw: typeof receipt?.importedJournalRaw === 'string' ? receipt.importedJournalRaw : null,
    ...(book?.legacyAcknowledgement ? { previouslyReviewedCopies: { canonicalJournalRaw: book.legacyAcknowledgement.reviewedJournalRaw, olderJournalRaw: book.legacyAcknowledgement.legacyBytes } } : {}),
    ...(nested && validSourceCapture(nested) ? { transferredCopies: exportedTransferCopies(nested as NonNullable<CutoverEvidence['sourceCapture']>, seen) } : {}) };
}
export function exportJournalLegacyReview(review: object, context: JournalStorageContext | null = makeBrowserJournalStorageContext()): { filename: 'journal-copies.json'; json: string } | null {
  try {
    const proof = currentReview(review, context); if (!proof || !context) return null;
    const book = canonical(proof.snapshot.canonical), receipt = evidence(proof.snapshot.receipt, context.canonicalKey);
    if (!book || !receipt) return null;
    return { filename: 'journal-copies.json', json: JSON.stringify({ exportVersion: 1,
      canonicalJournalRaw: book.journalRaw, olderJournalRaw: proof.snapshot.legacy, initialImportJournalRaw: receipt.importedJournalRaw,
      ...(receipt.sourceCapture ? { transferredCopies: exportedTransferCopies(receipt.sourceCapture) } : {}),
      ...(book.legacyAcknowledgement ? { previouslyReviewedCopies: { canonicalJournalRaw: book.legacyAcknowledgement.reviewedJournalRaw,
        olderJournalRaw: book.legacyAcknowledgement.legacyBytes } } : {}) }, null, 2) + '\n' };
  } catch { return null; }
}
export async function keepCurrentJournalAfterLegacyReview(review: object, context: JournalStorageContext | null = makeBrowserJournalStorageContext(), locks: JournalStorageLocks | null | undefined = browserLocks(), sourceIsCurrent: () => boolean = () => true): Promise<{ status: 'kept' | 'held' | 'superseded'; reason?: string }> {
  try {
    if (!sourceIsCurrent()) return { status: 'held', reason: 'review-withdrawn' };
    if (!context || !currentReview(review, context)) return { status: 'superseded', reason: 'review-changed' };
    const keep = (): { status: 'kept' | 'held' | 'superseded'; reason?: string } => {
      if (!sourceIsCurrent()) return { status: 'held', reason: 'review-withdrawn' };
      const proof = currentReview(review, context);
      if (!proof) return { status: 'superseded', reason: 'review-changed' };
      const book = canonical(proof.snapshot.canonical);
      if (!book || inspect(context, proof.snapshot).reason !== 'legacy-diverged') return { status: 'superseded', reason: 'review-changed' };
      const raw = JSON.stringify({ ...book, legacyAcknowledgement: { legacyBytes: proof.snapshot.legacy,
        reviewedJournalRaw: book.journalRaw, acknowledgementId: newId() } satisfies LegacyAcknowledgement });
      if (!sourceIsCurrent()) return { status: 'held', reason: 'review-withdrawn' };
      if (!currentReview(review, context)) return { status: 'superseded', reason: 'review-changed' };
      const expected = { ...proof.snapshot, canonical: raw };
      const unconfirmed = (): { status: 'superseded'; reason: string } => {
        proof.consumed = true;
        unconfirmedWrites.set(context.canonicalKey, { context, expected });
        const lease = leases.get(context.canonicalKey); if (lease && sameContext(lease.context, context)) lease.release();
        emit(); return { status: 'superseded', reason: 'written-review-changed' };
      };
      try { context.storage.setItem(context.canonicalKey, raw); }
      catch {
        try { if (same(proof.snapshot, capture(context))) return { status: 'held', reason: 'review-write-failed' }; } catch { /* The effect cannot be disproved. */ }
        return unconfirmed();
      }
      proof.consumed = true;
      // A completed acknowledgement is never described as a failed write with
      // an automatic retry. Its receipt can become superseded independently.
      let confirmed = false;
      try { confirmed = proof.generation === leaseGeneration && same(expected, capture(context))
        && sourceIsCurrent() && context.isCurrent(); } catch { /* The write completed; only its confirmation failed. */ }
      if (!confirmed) return unconfirmed();
      emit(); return { status: 'kept' };
    };
    if (ownsLease(context)) return keep();
    if (!locks) return { status: 'held', reason: 'web-locks-unavailable' };
    return await locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, lock =>
      lock ? keep() : { status: 'held', reason: 'another-writer' });
  } catch { return { status: 'held', reason: 'review-write-failed' }; }
}
