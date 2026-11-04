'use client';

import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';


export interface ProtectedStorageContext {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  legacyKey: string;
  canonicalKey: string;
  receiptKey: string;
  isCurrent: () => boolean;
  sample?: boolean;
  /** All physical legacy addresses participate in one private source receipt. */
  legacyKeys?: readonly string[];
}
export interface ProtectedStorageLocks {
  request<T>(name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: unknown | null) => T | PromiseLike<T>): Promise<T>;
}
export interface ProtectedStorageStatus {
  status: 'ready' | 'held' | 'sample';
  reason?: string;
  writable: boolean;
  needsInitialisation: boolean;
  legacyDiverged: boolean;
}
interface LegacyAcknowledgement { legacyBytes: string | null; reviewedPayloadRaw: string; acknowledgementId: string }
interface CanonicalEnvelope { storageVersion: 2; cutoverId: string; payloadRaw: string; legacyAcknowledgement?: LegacyAcknowledgement }
interface CutoverEvidence {
  receiptVersion: 1;
  canonicalKey: string;
  cutoverId: string;
  legacyBytes: string | null;
  importedPayloadRaw: string | null;
  sourceCapture?: { canonicalRaw: string | null; receiptRaw: string | null; legacyRaw: string | null };
}
interface Capture { canonical: string | null; receipt: string | null; legacy: string | null }
export interface ProtectedStorageRead extends ProtectedStorageStatus {
  /** Private raw evidence/token; never include these in a rendered status or log. */
  payloadRaw: string | null;
  token: string | null;
}
export type ProtectedStorageWriteReceipt = { status: 'written'; token: string }
  | { status: 'held'; reason: string } | { status: 'unconfirmed'; reason: string };

export interface ProtectedStorageTransferOptions {
  locks?: ProtectedStorageLocks | null;
}
export interface ProtectedLegacyReview {
  readonly status: 'available';
  /** Raw saved-entry counts include held rows; equality does not prove equal
   * dates, observations, links or other authored metadata. */
  readonly currentSavedRows: number | null;
  readonly olderSavedRows: number | null;
  readonly review: object;
}
export interface ProtectedStorageConfig {
  readonly legacyBaseKeys: readonly [string, ...string[]];
  readonly canonicalBaseKey: string; readonly receiptBaseKey: string;
  readonly eventName: string; readonly lockPrefix: string; readonly changedReason: string;
  readonly payloadField: string; readonly importedField: string; readonly reviewedField: string;
  readonly exportFilename: string;
  readonly exportFields: { readonly current: string; readonly older: string; readonly initial: string };
  readonly validatePayload: (raw: string) => boolean;
  /** Return exact payload bytes or null for unreadable legacy evidence. */
  readonly importLegacy: (raw: string | null) => string | null;
  readonly legacyIsEmpty: (raw: string | null) => boolean;
  readonly countRows: (raw: string | null) => number | null;
  readonly countLegacyRows?: (raw: string | null) => number | null;
  readonly captureLegacy?: (context: ProtectedStorageContext) => string | null;
}

/** Each adapter owns its private proofs, while actual browser locks arbitrate
 * separate documents. The protocol, uncertain effects and recovery have one authority. */
export function createProtectedLocalStorage(config: ProtectedStorageConfig) {
  interface Lease { context: ProtectedStorageContext; release: () => void; active: boolean; id: string; proof: object }
  const leaseProofs = new WeakMap<object, Lease>();
  const readReceipts = new WeakMap<object, { context: ProtectedStorageContext; original: ProtectedStorageContext; snapshot: Capture }>();
  const leases = new Map<string, Lease>();
  const unconfirmedWrites = new Map<string, { context: ProtectedStorageContext; expected: Capture }>();
  const transferHolds = new Map<string, { context: ProtectedStorageContext; reason: string }>();
  const pending = new Map<string, { context: ProtectedStorageContext; promise: Promise<ProtectedStorageStatus> }>();
  let leaseGeneration = 0;
  let lifecycleWindow: Window | null = null;
  const lifecycleChanged = () => releaseAllDocumentLeases();
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
  function sameContext(a: ProtectedStorageContext, b: ProtectedStorageContext): boolean {
    return a.storage === b.storage && a.canonicalKey === b.canonicalKey && a.legacyKey === b.legacyKey && a.receiptKey === b.receiptKey && !!a.sample === !!b.sample
      && JSON.stringify(a.legacyKeys ?? [a.legacyKey]) === JSON.stringify(b.legacyKeys ?? [b.legacyKey]);
  }
  const held = (reason: string, payloadRaw: string | null = null, legacyDiverged = false): ProtectedStorageRead =>
    ({ status: 'held', reason, writable: false, needsInitialisation: reason === 'upgrade-required', legacyDiverged, payloadRaw, token: null });
  function sampleActive(): boolean | null {
    try { return typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1'; } catch { return null; }
  }
  function makeBrowserStorageContext(): ProtectedStorageContext | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const sample = sampleActive(); if (sample === null) return null;
      const owner = activeAccountUid(), storage = window.localStorage;
      const canonicalKey = activeAccountLocalStorageKey(config.canonicalBaseKey), legacyKey = activeAccountLocalStorageKey(config.legacyBaseKeys[0]), receiptKey = activeAccountLocalStorageKey(config.receiptBaseKey);
      const legacyKeys = config.legacyBaseKeys.map(activeAccountLocalStorageKey);
      return { storage, sample, canonicalKey, legacyKey, receiptKey,
        ...(legacyKeys.length === 1 ? {} : { legacyKeys: Object.freeze(legacyKeys) }),
        isCurrent: () => activeAccountUid() === owner && sampleActive() === sample && window.localStorage === storage
          && activeAccountLocalStorageKey(config.canonicalBaseKey) === canonicalKey
          && config.legacyBaseKeys.every((base, i) => activeAccountLocalStorageKey(base) === legacyKeys[i])
          && activeAccountLocalStorageKey(config.receiptBaseKey) === receiptKey };
    } catch { return null; }
  }
  function emit(): void {
    try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(config.eventName)); } catch { /* The receipt, not an optional UI event, proves a write. */ }
  }
  function capture(c: ProtectedStorageContext): Capture {
    if (!c.isCurrent()) throw Error('context-changed');
    const legacyKeys = c.legacyKeys ?? [c.legacyKey], allKeys = [c.canonicalKey, c.receiptKey, ...legacyKeys];
    if (legacyKeys.length !== config.legacyBaseKeys.length || legacyKeys[0] !== c.legacyKey
      || allKeys.some(key => typeof key !== 'string' || !key) || new Set(allKeys).size !== allKeys.length) throw Error('invalid-storage-context');
    const snapshot = { canonical: c.storage.getItem(c.canonicalKey), receipt: c.storage.getItem(c.receiptKey),
      legacy: config.captureLegacy ? config.captureLegacy(c) : c.storage.getItem(c.legacyKey) };
    if (Object.values(snapshot).some(raw => raw !== null && typeof raw !== 'string')) throw Error('storage-unavailable');
    if (!c.isCurrent()) throw Error('context-changed');
    return snapshot;
  }
  function same(a: Capture, b: Capture): boolean { return a.canonical === b.canonical && a.receipt === b.receipt && a.legacy === b.legacy; }
  /** Byte provenance only: a read receipt neither validates a payload nor grants
   * a writer lease. Each model still owns readability and actor authorization. */
  function captureStorageReadReceipt(context: ProtectedStorageContext | null = makeBrowserStorageContext()): object | null {
    try {
      if (!context || context.sample || !context.isCurrent()) return null;
      const captured: ProtectedStorageContext = { storage: context.storage, legacyKey: context.legacyKey,
        canonicalKey: context.canonicalKey, receiptKey: context.receiptKey, sample: context.sample,
        ...(context.legacyKeys ? { legacyKeys: Object.freeze([...context.legacyKeys]) } : {}),
        isCurrent: context.isCurrent.bind(context) };
      const snapshot = capture(captured);
      if (!same(snapshot, capture(captured)) || !sameContext(context, captured)) return null;
      const receipt = Object.freeze({}); readReceipts.set(receipt, { context: captured, original: context, snapshot }); return receipt;
    } catch { return null; }
  }
  function storageReadReceiptMatches(receipt: object | null | undefined, context?: ProtectedStorageContext | null): boolean {
    const proof = receipt && readReceipts.get(receipt);
    if (!proof) return false;
    const requested = context === undefined ? proof.context : context;
    try {
      if (requested && !requested.sample && proof.context.isCurrent() && requested.isCurrent()
        && sameContext(proof.context, proof.original) && sameContext(proof.context, requested)
        && same(proof.snapshot, capture(requested)) && same(proof.snapshot, capture(requested))
        && sameContext(proof.context, proof.original) && proof.context.isCurrent() && requested.isCurrent()
        && readReceipts.get(receipt!) === proof) return true;
    } catch { /* Failed evidence never becomes valid again after bytes are restored. */ }
    readReceipts.delete(receipt!); return false;
  }
  function releaseStorageReadReceipt(receipt: object | null | undefined): void { if (receipt) readReceipts.delete(receipt); }
  function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function authoredArray(raw: string): boolean {
    try { return typeof raw === 'string' && config.validatePayload(raw); } catch { return false; }
  }
  function acknowledgement(value: unknown): LegacyAcknowledgement | null {
    if (!object(value) || Object.keys(value).length !== 3 || !(value.legacyBytes === null || typeof value.legacyBytes === 'string')
      || typeof value[config.reviewedField] !== 'string' || !authoredArray(value[config.reviewedField] as string)
      || typeof value.acknowledgementId !== 'string' || !value.acknowledgementId) return null;
    return { legacyBytes: value.legacyBytes, reviewedPayloadRaw: value[config.reviewedField] as string, acknowledgementId: value.acknowledgementId };
  }
  function canonical(raw: string | null): CanonicalEnvelope | null {
    try {
      const e: unknown = raw === null ? null : JSON.parse(raw);
      if (!object(e) || !Object.keys(e).every(k => ['storageVersion', 'cutoverId', config.payloadField, 'legacyAcknowledgement'].includes(k))
        || e.storageVersion !== 2 || typeof e.cutoverId !== 'string' || !e.cutoverId
        || typeof e[config.payloadField] !== 'string' || !authoredArray(e[config.payloadField] as string)) return null;
      const reviewed = e.legacyAcknowledgement === undefined ? undefined : acknowledgement(e.legacyAcknowledgement);
      if (reviewed === null) return null;
      return { storageVersion: 2, cutoverId: e.cutoverId, payloadRaw: e[config.payloadField] as string,
        ...(reviewed ? { legacyAcknowledgement: reviewed } : {}) };
    } catch { return null; }
  }
  function encodeCanonical(book: CanonicalEnvelope): string {
    return JSON.stringify({ storageVersion: 2, cutoverId: book.cutoverId, [config.payloadField]: book.payloadRaw,
      ...(book.legacyAcknowledgement ? { legacyAcknowledgement: { legacyBytes: book.legacyAcknowledgement.legacyBytes,
        [config.reviewedField]: book.legacyAcknowledgement.reviewedPayloadRaw, acknowledgementId: book.legacyAcknowledgement.acknowledgementId } } : {}) });
  }
  function validSourceCapture(value: unknown): boolean {
    return object(value) && Object.keys(value).length === 3 && ['canonicalRaw', 'receiptRaw', 'legacyRaw'].every(key => value[key] === null || typeof value[key] === 'string');
  }
  function evidence(raw: string | null, key: string): CutoverEvidence | null {
    try {
      const e: unknown = raw === null ? null : JSON.parse(raw);
      const keys = ['receiptVersion', 'canonicalKey', 'cutoverId', 'legacyBytes', config.importedField, 'sourceCapture'];
      if (!(object(e) && Object.keys(e).every(k => keys.includes(k)) && e.receiptVersion === 1 && e.canonicalKey === key
        && typeof e.cutoverId === 'string' && !!e.cutoverId && (e.legacyBytes === null || typeof e.legacyBytes === 'string')
        && (e[config.importedField] === null || typeof e[config.importedField] === 'string' && authoredArray(e[config.importedField] as string))
        && (e.sourceCapture === undefined || validSourceCapture(e.sourceCapture)))) return null;
      return { receiptVersion: 1, canonicalKey: key, cutoverId: e.cutoverId as string, legacyBytes: e.legacyBytes as string | null,
        importedPayloadRaw: e[config.importedField] as string | null,
        ...(e.sourceCapture === undefined ? {} : { sourceCapture: e.sourceCapture as CutoverEvidence['sourceCapture'] }) };
    } catch { return null; }
  }
  function currentLease(c: ProtectedStorageContext): Lease | null {
    const lease = leases.get(c.canonicalKey);
    if (!lease?.active) return null;
    if (!lease.context.isCurrent()) { lease.release(); return null; }
    return c.isCurrent() && sameContext(lease.context, c) && lease.active && leases.get(c.canonicalKey) === lease ? lease : null;
  }
  function ownsLease(c: ProtectedStorageContext): boolean { return currentLease(c) !== null; }
  /** Private provenance, not a live raw-journal equality check: safe same-lease
   * rebases still need their independently checked fresh raw admission. */
  function captureStorageLease(context: ProtectedStorageContext | null = makeBrowserStorageContext()): object | null {
    try { return context && !context.sample && readStorage(context).writable ? currentLease(context)?.proof ?? null : null; } catch { return null; }
  }
  function storageLeaseMatches(proof: object | null | undefined, context: ProtectedStorageContext | null = makeBrowserStorageContext()): boolean {
    try {
      const lease = proof && leaseProofs.get(proof);
      return !!lease && !!context && !context.sample && readStorage(context).writable && currentLease(context) === lease;
    } catch { return false; }
  }
  function writeToken(c: ProtectedStorageContext, s: Capture, lease: Lease): string {
    return JSON.stringify([c.canonicalKey, s.canonical, s.receipt, s.legacy, lease.id]);
  }
  function inspect(c: ProtectedStorageContext, s: Capture): ProtectedStorageRead {
    if (s.canonical === null && s.receipt === null) return s.legacy !== null && config.importLegacy(s.legacy) === null
      ? held('legacy-unreadable') : held('upgrade-required', s.legacy === null ? null : config.importLegacy(s.legacy));
    const book = canonical(s.canonical), proof = evidence(s.receipt, c.canonicalKey);
    if (!book || !proof || book.cutoverId !== proof.cutoverId) return held('cutover-recovery-required', book?.payloadRaw ?? null);
    const baseline = book.legacyAcknowledgement ? book.legacyAcknowledgement.legacyBytes : proof.legacyBytes;
    if (s.legacy !== baseline) return held('legacy-diverged', book.payloadRaw, true);
    const lease = currentLease(c), writable = lease !== null;
    return { status: writable ? 'ready' : 'held', ...(writable ? {} : { reason: 'writer-not-acquired' }), writable,
      needsInitialisation: false, legacyDiverged: false, payloadRaw: book.payloadRaw,
      token: lease ? writeToken(c, s, lease) : null };
  }
  function readStorageTransferHold(context: ProtectedStorageContext | null = makeBrowserStorageContext()): string | null {
    if (!context || context.sample) return null;
    const hold = transferHolds.get(context.canonicalKey);
    if (!hold) return null;
    if (!hold.context.isCurrent()) { transferHolds.delete(context.canonicalKey); return null; }
    return context.isCurrent() && sameContext(hold.context, context) ? hold.reason : null;
  }
  function readStorage(context: ProtectedStorageContext | null = makeBrowserStorageContext()): ProtectedStorageRead {
    try {
      if (!context) return held('storage-unavailable');
      if (!context.isCurrent()) return held('context-changed');
      if (context.sample) return { status: 'sample', writable: false, needsInitialisation: false, legacyDiverged: false, payloadRaw: null, token: null };
      const write = unconfirmedWrites.get(context.canonicalKey);
      if (write && !write.context.isCurrent()) unconfirmedWrites.delete(context.canonicalKey);
      else if (write && sameContext(write.context, context)) return held('write-unconfirmed', canonical(capture(context).canonical)?.payloadRaw ?? null);
      if (readStorageTransferHold(context)) return held('guest-transfer-held');
      const s = capture(context), result = inspect(context, s);
      return same(s, capture(context)) ? result : held(config.changedReason, result.payloadRaw);
    } catch { return held('storage-unavailable'); }
  }
  function readStorageStatus(context: ProtectedStorageContext | null = makeBrowserStorageContext()): ProtectedStorageStatus {
    const { status, reason, writable, needsInitialisation, legacyDiverged } = readStorage(context);
    return { status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged };
  }
  function releaseAllDocumentLeases(): void {
    leaseGeneration++; pending.clear(); stopLifecycle();
    for (const lease of [...leases.values()]) lease.release();
  }
  function browserLocks(): ProtectedStorageLocks | undefined {
    return typeof navigator === 'undefined' ? undefined : navigator.locks;
  }
  function lockName(c: ProtectedStorageContext): string { return `${config.lockPrefix}${c.canonicalKey}`; }
  function newId(): string { return crypto.randomUUID(); }
  function importedRaw(legacy: string | null): string {
    const raw = config.importLegacy(legacy); if (raw === null || !authoredArray(raw)) throw Error('legacy-unreadable'); return raw;
  }
  function pair(c: ProtectedStorageContext, legacyBytes: string | null, payloadRaw: string, sourceCapture?: Capture): { canonical: string; receipt: string } {
    const cutoverId = newId();
    return { canonical: encodeCanonical({ storageVersion: 2, cutoverId, payloadRaw }),
      receipt: JSON.stringify({ receiptVersion: 1, canonicalKey: c.canonicalKey, cutoverId, legacyBytes, [config.importedField]: payloadRaw,
        ...(sourceCapture === undefined ? {} : { sourceCapture: { canonicalRaw: sourceCapture.canonical, receiptRaw: sourceCapture.receipt, legacyRaw: sourceCapture.legacy } }) }) };
  }
  function install(c: ProtectedStorageContext, before: Capture, next: { canonical: string; receipt: string }): void {
    if (!same(before, capture(c))) throw Error(config.changedReason);
    // Evidence first makes a failed second write distinguishable from a fresh
    // installation. Retrying must never silently replace that frozen import.
    c.storage.setItem(c.receiptKey, next.receipt);
    if (!same({ ...before, receipt: next.receipt }, capture(c))) throw Error(config.changedReason);
    c.storage.setItem(c.canonicalKey, next.canonical);
    if (!same({ ...before, receipt: next.receipt, canonical: next.canonical }, capture(c))) throw Error(config.changedReason);
  }
  function initialiseStorage(context: ProtectedStorageContext | null = makeBrowserStorageContext(), locks: ProtectedStorageLocks | null | undefined = browserLocks()): Promise<ProtectedStorageStatus> {
    if (!context || context.sample) return Promise.resolve(readStorageStatus(context));
    if (!context.isCurrent()) return Promise.resolve(held('context-changed'));
    if (readStorage(context).reason === 'write-unconfirmed') return Promise.resolve(held('write-unconfirmed'));
    if (readStorageTransferHold(context)) return Promise.resolve(held('guest-transfer-held'));
    if (ownsLease(context)) return Promise.resolve(readStorageStatus(context));
    const queued = pending.get(context.canonicalKey);
    if (queued && sameContext(queued.context, context) && queued.context.isCurrent()) {
      return queued.promise.then(() => readStorageStatus(context));
    }
    if (!locks) return Promise.resolve(held('web-locks-unavailable'));
    observeLifecycle();
    let resolve!: (status: ProtectedStorageStatus) => void;
    const result = new Promise<ProtectedStorageStatus>(done => { resolve = value => {
      const { status, reason, writable, needsInitialisation, legacyDiverged } = value;
      done({ status, ...(reason ? { reason } : {}), writable, needsInitialisation, legacyDiverged });
    }; });
    pending.set(context.canonicalKey, { context, promise: result });
    const generation = leaseGeneration, requestedContext = context;
    const guarded: ProtectedStorageContext = { ...context, isCurrent: () => generation === leaseGeneration && requestedContext.isCurrent() };
    void locks.request(lockName(context), { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) { resolve(held('another-writer')); return; }
      let lease: Lease | undefined;
      const context = guarded;
      try {
        if (!context.isCurrent()) { resolve(held('context-changed')); return; }
        if (readStorageTransferHold(context)) { resolve(held('guest-transfer-held')); return; }
        const before = capture(context), state = inspect(context, before);
        if (state.reason === 'upgrade-required') install(context, before, pair(context, before.legacy, importedRaw(before.legacy)));
        else if (state.reason !== 'writer-not-acquired') { resolve(state); return; }
        let release!: () => void;
        const released = new Promise<void>(done => { release = done; });
        lease = { context, active: true, id: newId(), proof: Object.freeze({}), release: () => {
          if (!lease?.active) return; lease.active = false;
          if (leases.get(context.canonicalKey) === lease) leases.delete(context.canonicalKey);
          release(); emit();
        } };
        leases.set(context.canonicalKey, lease); leaseProofs.set(lease.proof, lease);
        resolve(readStorageStatus(context)); emit();
        // A held Web Lock is the actual exclusion mechanism. Check/set alone is
        // never called compare-and-swap, and old v1 clients do not participate.
        await released;
      } catch { lease?.release(); resolve(readStorageStatus(context)); }
    }).catch(() => resolve(held('lock-unavailable'))).finally(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
    void result.then(() => { if (pending.get(context.canonicalKey)?.promise === result) pending.delete(context.canonicalKey); });
    return result;
  }

  /** Explicit recovery resumes only the exact immutable receipt. It never rereads
   * legacy bytes as a replacement import or overwrites an existing canonical row. */
  async function recoverStorage(context: ProtectedStorageContext, locks: ProtectedStorageLocks | null | undefined = browserLocks()): Promise<ProtectedStorageStatus> {
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
          unconfirmedWrites.delete(context.canonicalKey); emit(); return readStorageStatus(context);
        }
        if (s.canonical !== null || !proof || proof.legacyBytes !== s.legacy || proof.importedPayloadRaw === null) return held('cutover-recovery-required');
        const raw = encodeCanonical({ storageVersion: 2, cutoverId: proof.cutoverId, payloadRaw: proof.importedPayloadRaw });
        if (!same(s, capture(context))) return held(config.changedReason);
        context.storage.setItem(context.canonicalKey, raw);
        if (!same({ ...s, canonical: raw }, capture(context))) return held('cutover-recovery-required');
        return readStorageStatus(context);
      });
    } catch { return held('cutover-recovery-required'); }
  }
  function writeStorageRaw(payloadRaw: string, expectedToken: string | null,
    context: ProtectedStorageContext | null = makeBrowserStorageContext(), sourceIsCurrent: () => boolean = () => true): ProtectedStorageWriteReceipt {
    let attempted = false, performed = false, expected: Capture | null = null, before: Capture | null = null;
    const unconfirmed = (): ProtectedStorageWriteReceipt => {
      if (context && expected) {
        unconfirmedWrites.set(context.canonicalKey, { context, expected });
        const lease = leases.get(context.canonicalKey); if (lease && sameContext(lease.context, context)) lease.release();
      }
      emit(); return { status: 'unconfirmed', reason: 'write-unconfirmed' };
    };
    try {
      if (!context || context.sample || !sourceIsCurrent() || !authoredArray(payloadRaw)) return { status: 'held', reason: 'write-unavailable' };
      const read = readStorage(context);
      if (!read.writable || typeof expectedToken !== 'string' || read.token !== expectedToken) return { status: 'held', reason: read.reason ?? config.changedReason };
      before = capture(context); const state = inspect(context, before), book = canonical(before.canonical);
      const lease = currentLease(context);
      if (!state.writable || state.token !== expectedToken || !book || !same(before, capture(context)) || !lease || currentLease(context) !== lease
        || !sourceIsCurrent() || !context.isCurrent()) return { status: 'held', reason: config.changedReason };
      const raw = encodeCanonical({ ...book, payloadRaw });
      if (!same(before, capture(context)) || !sourceIsCurrent() || !context.isCurrent()) return { status: 'held', reason: config.changedReason };
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


  function emptyLegacy(raw: string | null): boolean {
    try { return config.legacyIsEmpty(raw); } catch { return false; }
  }
  async function performStorageTransfer(source: ProtectedStorageContext, target: ProtectedStorageContext, options: ProtectedStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
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
          let payloadRaw: string;
          if (from.canonical === null && from.receipt === null) {
            if (emptyLegacy(from.legacy)) return { status: 'preserved', reason: 'no-guest-work' };
            if (from.legacy === null || config.importLegacy(from.legacy) === null) return { status: 'held', reason: 'legacy-unreadable' };
            payloadRaw = importedRaw(from.legacy);
          } else {
            const state = inspect(source, from);
            if (state.reason !== 'writer-not-acquired' || state.payloadRaw === null) return { status: 'held', reason: state.reason ?? 'source-unavailable' };
            payloadRaw = state.payloadRaw;
          }
          if (!same(from, capture(source)) || !same(to, capture(target))) return { status: 'held', reason: 'context-changed' };
          const next = pair(target, to.legacy, payloadRaw, from);
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

  async function transferStoragePair(source: ProtectedStorageContext, target: ProtectedStorageContext, options: ProtectedStorageTransferOptions): Promise<{ status: 'transferred' | 'preserved' | 'held'; reason?: string }> {
    let result: { status: 'transferred' | 'preserved' | 'held'; reason?: string };
    try {
      const to = capture(target);
      if (to.canonical !== null || to.receipt !== null || !emptyLegacy(to.legacy)) result = { status: 'preserved', reason: 'destination-present' };
      else {
        const from = capture(source);
        if (from.canonical === null && from.receipt === null && emptyLegacy(from.legacy)) result = { status: 'preserved', reason: 'no-guest-work' };
        else result = await performStorageTransfer(source, target, options);
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


  interface LegacyReviewProof { context: ProtectedStorageContext; snapshot: Capture; consumed: boolean; generation: number }
  const legacyReviews = new WeakMap<object, LegacyReviewProof>();
  function savedRows(raw: string | null): number | null {
    try { return config.countRows(raw); } catch { return null; }
  }
  function readLegacyReview(context: ProtectedStorageContext | null = makeBrowserStorageContext()): ProtectedLegacyReview | null {
    try {
      if (!context || context.sample || readStorage(context).reason === 'write-unconfirmed' || readStorageTransferHold(context)) return null;
      const snapshot = capture(context), state = inspect(context, snapshot), book = canonical(snapshot.canonical);
      if (state.reason !== 'legacy-diverged' || !book || !same(snapshot, capture(context))) return null;
      observeLifecycle();
      const review = Object.freeze({});
      legacyReviews.set(review, { context, snapshot: Object.freeze({ ...snapshot }), consumed: false, generation: leaseGeneration });
      return Object.freeze({ status: 'available', currentSavedRows: savedRows(book.payloadRaw),
        olderSavedRows: config.countLegacyRows ? config.countLegacyRows(snapshot.legacy) : savedRows(snapshot.legacy), review });
    } catch { return null; }
  }
  function currentReview(review: object, context: ProtectedStorageContext | null): LegacyReviewProof | null {
    const proof = legacyReviews.get(review);
    if (!proof || proof.consumed || proof.generation !== leaseGeneration || !context || context.sample || readStorage(context).reason === 'write-unconfirmed' || readStorageTransferHold(context) || !sameContext(proof.context, context)
      || !proof.context.isCurrent() || !context.isCurrent() || !same(proof.snapshot, capture(context))) return null;
    return proof;
  }
  function legacyReviewIsCurrent(review: object, context: ProtectedStorageContext | null = makeBrowserStorageContext()): boolean {
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
    return { [config.exportFields.current]: book?.payloadRaw ?? null, [config.exportFields.older]: source.legacyRaw,
      [config.exportFields.initial]: typeof receipt?.[config.importedField] === 'string' ? receipt[config.importedField] : null,
      ...(book?.legacyAcknowledgement ? { previouslyReviewedCopies: { [config.exportFields.current]: book.legacyAcknowledgement.reviewedPayloadRaw, [config.exportFields.older]: book.legacyAcknowledgement.legacyBytes } } : {}),
      ...(nested && validSourceCapture(nested) ? { transferredCopies: exportedTransferCopies(nested as NonNullable<CutoverEvidence['sourceCapture']>, seen) } : {}) };
  }
  function exportLegacyReview(review: object, context: ProtectedStorageContext | null = makeBrowserStorageContext()): { filename: string; json: string } | null {
    try {
      const proof = currentReview(review, context); if (!proof || !context) return null;
      const book = canonical(proof.snapshot.canonical), receipt = evidence(proof.snapshot.receipt, context.canonicalKey);
      if (!book || !receipt) return null;
      return { filename: config.exportFilename, json: JSON.stringify({ exportVersion: 1,
        [config.exportFields.current]: book.payloadRaw, [config.exportFields.older]: proof.snapshot.legacy, [config.exportFields.initial]: receipt.importedPayloadRaw,
        ...(receipt.sourceCapture ? { transferredCopies: exportedTransferCopies(receipt.sourceCapture) } : {}),
        ...(book.legacyAcknowledgement ? { previouslyReviewedCopies: { [config.exportFields.current]: book.legacyAcknowledgement.reviewedPayloadRaw,
          [config.exportFields.older]: book.legacyAcknowledgement.legacyBytes } } : {}) }, null, 2) + '\n' };
    } catch { return null; }
  }
  async function keepCurrentAfterLegacyReview(review: object, context: ProtectedStorageContext | null = makeBrowserStorageContext(), locks: ProtectedStorageLocks | null | undefined = browserLocks(), sourceIsCurrent: () => boolean = () => true): Promise<{ status: 'kept' | 'held' | 'superseded'; reason?: string }> {
    try {
      if (!sourceIsCurrent()) return { status: 'held', reason: 'review-withdrawn' };
      if (!context || !currentReview(review, context)) return { status: 'superseded', reason: 'review-changed' };
      const keep = (): { status: 'kept' | 'held' | 'superseded'; reason?: string } => {
        if (!sourceIsCurrent()) return { status: 'held', reason: 'review-withdrawn' };
        const proof = currentReview(review, context);
        if (!proof) return { status: 'superseded', reason: 'review-changed' };
        const book = canonical(proof.snapshot.canonical);
        if (!book || inspect(context, proof.snapshot).reason !== 'legacy-diverged') return { status: 'superseded', reason: 'review-changed' };
        const raw = encodeCanonical({ ...book, legacyAcknowledgement: { legacyBytes: proof.snapshot.legacy,
          reviewedPayloadRaw: book.payloadRaw, acknowledgementId: newId() } satisfies LegacyAcknowledgement });
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

return { makeBrowserStorageContext, readStorage, readStorageStatus, initialiseStorage, recoverStorage, captureStorageLease, storageLeaseMatches, releaseAllDocumentLeases, writeStorageRaw, readStorageTransferHold, transferStoragePair, readLegacyReview, legacyReviewIsCurrent, exportLegacyReview, keepCurrentAfterLegacyReview,
  captureStorageReadReceipt, storageReadReceiptMatches, releaseStorageReadReceipt };
}
