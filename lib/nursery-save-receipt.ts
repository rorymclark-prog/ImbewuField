'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { isSampleMode, SAMPLE_MODE_EVENT } from './sample-mode';
import { cropPlanWriteAdmissionMatches, cropPlanWriteCandidateIsLossless, cropPlanWriteToken,
  loadCropPlanWithWriteAdmission, saveCropPlanWithReceipt, type CropPlanState, type CropPlanWriteAdmission } from './crop-plan';
import type { NurserySettings } from './nursery-settings';

export interface NurserySaveAuthority { readonly kind: 'nursery-save-authority' }
export interface NurserySaveContext { readonly kind: 'nursery-save-context' }
export interface NurserySaveRequest { readonly kind: 'nursery-save-request' }
export type NurserySaveResult = { readonly status: 'confirmed'; readonly sample: boolean }
  | { readonly status: 'held' | 'performed-unconfirmed'; readonly reason: string };
export interface NurserySaveBase {
  readonly owner: string | null; readonly sample: boolean; readonly token: string | null;
  readonly planKey: string; readonly admission: CropPlanWriteAdmission;
}
interface ParentState { readonly book: CropPlanState; readonly base: NurserySaveBase }
interface Binding {
  readonly siteId: string; readonly scopeKey: string;
  readonly current: () => ParentState | null;
  readonly isCurrent: () => boolean;
}
interface AuthorityProof {
  readonly binding: Binding; readonly owner: string | null; readonly sample: boolean; readonly win: Window;
  revoked: boolean; uncertain: boolean; stop: () => void;
}
interface ContextProof { readonly authority: AuthorityProof; readonly base: NurserySaveBase; readonly sourceKey: string }
interface RequestProof {
  readonly context: ContextProof; readonly payload: NurserySettings; readonly payloadKey: string;
  phase: 'new' | 'started' | 'finished';
}
interface Confirmation { readonly book: CropPlanState; readonly token: string; readonly admission: CropPlanWriteAdmission }
interface ResultProof { readonly request: NurserySaveRequest; readonly authority: AuthorityProof; readonly confirmed: Confirmation; readonly key: string; used: boolean }
const authorities = new WeakMap<object, AuthorityProof>(), contexts = new WeakMap<object, ContextProof>();
const requests = new WeakMap<object, RequestProof>(), results = new WeakMap<object, ResultProof>();

// Identity reads must not execute a getter or silently discard a hidden claim.
// This is a detached data copy, not a second nursery schema normalizer.
function copy(value: unknown, parents = new Set<object>(), objectProperty = false): unknown {
  if (value === undefined && objectProperty) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || parents.has(value)) throw Error('Unsafe nursery evidence');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('Unsafe nursery evidence');
  parents.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(descriptors).some(key => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))
        || Object.keys(descriptors).filter(key => key !== 'length').length !== value.length) throw Error('Unsafe nursery array');
      return Array.from({ length: value.length }, (_, index) => {
        const property = descriptors[index]; if (!property || !('value' in property)) throw Error('Unsafe nursery accessor');
        return copy(property.value, parents);
      });
    }
    const output: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(descriptors)) {
      const property = typeof key === 'string' ? descriptors[key] : null;
      if (typeof key !== 'string' || !property || !property.enumerable || !('value' in property)) throw Error('Unsafe nursery accessor');
      const detached = copy(property.value, parents, true);
      if (detached !== undefined) Object.defineProperty(output, key, { value: detached, enumerable: true, writable: true, configurable: true });
    }
    return output;
  } finally { parents.delete(value); }
}
function dataKey(value: unknown): string {
  return JSON.stringify(copy(value), (_key, node) => node && typeof node === 'object' && !Array.isArray(node)
    ? Object.fromEntries(Object.keys(node).sort().map(key => [key, node[key]])) : node);
}
export function nurserySettingsSourceKey(siteId: string, settings?: NurserySettings): string | null {
  try { return dataKey([siteId, settings === undefined ? { version: 1, spaces: [], containers: [], profiles: [] } : settings]); }
  catch { return null; }
}
function actorCurrent(proof: AuthorityProof): boolean {
  try {
    const auth = !proof.sample && isBackendConfigured() ? getFirebase()?.auth : null;
    const valid = !proof.revoked && !proof.uncertain && typeof window !== 'undefined' && window === proof.win
      && activeAccountUid() === proof.owner && isSampleMode() === proof.sample && proof.binding.isCurrent()
      && (proof.sample || !isBackendConfigured() || !!auth && (auth.currentUser?.uid ?? null) === proof.owner);
    if (!valid) proof.revoked = true;
    return valid;
  } catch { proof.revoked = true; return false; }
}
export function createNurserySaveAuthority(binding: Binding): NurserySaveAuthority | null {
  try {
    if (typeof window === 'undefined' || !binding.siteId || !binding.scopeKey) return null;
    const authority: NurserySaveAuthority = Object.freeze({ kind: 'nursery-save-authority' });
    const proof: AuthorityProof = { binding, owner: activeAccountUid(), sample: isSampleMode(), win: window, revoked: false, uncertain: false, stop: () => {} };
    if (!actorCurrent(proof)) return null;
    const revoke = () => { proof.revoked = true; };
    const auth = isBackendConfigured() ? getFirebase()?.auth : null;
    let observed = auth?.currentUser?.uid ?? null;
    const stopAuth = auth ? onAuthStateChanged(auth, user => { const uid = user?.uid ?? null; if (uid !== observed) { observed = uid; revoke(); } }, revoke) : () => {};
    window.addEventListener(SAMPLE_MODE_EVENT, revoke);
    proof.stop = () => { proof.win.removeEventListener(SAMPLE_MODE_EVENT, revoke); stopAuth(); };
    authorities.set(authority, proof); return authority;
  } catch { return null; }
}
export function revokeNurserySaveAuthority(authority: NurserySaveAuthority | null): void {
  const proof = authority && authorities.get(authority); if (!proof) return;
  proof.revoked = true; proof.stop(); authorities.delete(authority!);
}
export function createNurserySaveContext(authority: NurserySaveAuthority | null): NurserySaveContext | null {
  const proof = authority && authorities.get(authority);
  try {
    if (!proof || !actorCurrent(proof)) return null;
    const current = proof.binding.current(); if (!current) return null;
    const { base, book } = current;
    if (base.owner !== proof.owner || base.sample !== proof.sample || base.token === null
      || dataKey(book) !== dataKey(JSON.parse(base.planKey)) || !cropPlanWriteAdmissionMatches(base.admission, base.planKey, base.token)) return null;
    const sourceKey = nurserySettingsSourceKey(proof.binding.siteId, JSON.parse(base.planKey).nursery);
    if (!sourceKey) return null;
    const context: NurserySaveContext = Object.freeze({ kind: 'nursery-save-context' });
    contexts.set(context, { authority: proof, base, sourceKey }); return context;
  } catch { return null; }
}
function contextCurrent(proof: ContextProof): boolean {
  try {
    if (!actorCurrent(proof.authority)) return false;
    const current = proof.authority.binding.current();
    return !!current && current.base === proof.base && dataKey(current.book) === dataKey(JSON.parse(proof.base.planKey))
      && nurserySettingsSourceKey(proof.authority.binding.siteId, current.book.nursery) === proof.sourceKey
      && cropPlanWriteAdmissionMatches(proof.base.admission, proof.base.planKey, proof.base.token);
  } catch { return false; }
}
export function nurserySaveContextIsCurrent(context: NurserySaveContext | null | undefined): boolean {
  const proof = context && contexts.get(context); return !!proof && contextCurrent(proof);
}
export function createNurserySaveRequest(context: NurserySaveContext | null | undefined, next: NurserySettings): NurserySaveRequest | null {
  const proof = context && contexts.get(context);
  try {
    if (!proof || !contextCurrent(proof)) return null;
    const payload = copy(next) as NurserySettings, payloadKey = dataKey(payload);
    const request: NurserySaveRequest = Object.freeze({ kind: 'nursery-save-request' });
    requests.set(request, { context: proof, payload, payloadKey, phase: 'new' }); return request;
  } catch { return null; }
}
export function beginNurserySaveRequest(request: NurserySaveRequest | undefined, context: NurserySaveContext | null, supplied: NurserySettings): NurserySettings | null {
  const proof = request && requests.get(request);
  try {
    const suppliedContext = context && contexts.get(context);
    if (!proof || proof.phase !== 'new' || !suppliedContext || suppliedContext.authority !== proof.context.authority
      || suppliedContext.base !== proof.context.base || suppliedContext.sourceKey !== proof.context.sourceKey || !contextCurrent(suppliedContext)
      || !contextCurrent(proof.context) || dataKey(supplied) !== proof.payloadKey) return null;
    proof.phase = 'started'; return copy(proof.payload) as NurserySettings;
  } catch { return null; }
}
export function nurserySaveRequestIsCurrent(request: NurserySaveRequest): boolean {
  const proof = requests.get(request); return !!proof && proof.phase === 'started' && contextCurrent(proof.context);
}
function ownKey(siteId: string, settings: NurserySettings | undefined): string {
  const detached = copy(settings) as NurserySettings;
  return dataKey({ ...detached, spaces: detached.spaces.filter(row => row.siteId === siteId),
    containers: detached.containers.filter(row => row.siteId === siteId), profiles: detached.profiles.filter(row => row.siteId === siteId) });
}
/** The only success mint calls the real canonical writer and then reads its
 * actual admitted bytes. Caller booleans, display props and tokens cannot mint it. */
export function commitNurserySaveRequest(request: NurserySaveRequest, candidate: CropPlanState, expectedToken: string): NurserySaveResult {
  const proof = requests.get(request);
  const held = (reason: string): NurserySaveResult => {
    if (proof?.phase === 'started') proof.phase = 'finished';
    return { status: 'held', reason };
  };
  if (!proof || !nurserySaveRequestIsCurrent(request)) return held('original-context-changed');
  let attempted = false;
  try {
    const authority = proof.context.authority;
    const loaded = loadCropPlanWithWriteAdmission();
    if (loaded.token !== expectedToken || !cropPlanWriteAdmissionMatches(loaded.admission, JSON.stringify(loaded.book), expectedToken)
      || !cropPlanWriteCandidateIsLossless(candidate) || ownKey(authority.binding.siteId, candidate.nursery) !== ownKey(authority.binding.siteId, proof.payload)
      || !nurserySaveRequestIsCurrent(request) || cropPlanWriteToken() !== expectedToken) return held('saved-source-changed');
    // Mark before calling: false or an exception is not proof of atomic rollback.
    attempted = true; proof.phase = 'finished';
    const receipt = saveCropPlanWithReceipt(candidate);
    if (!receipt.saved) { authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'write-not-confirmed' }; }
    const confirmed = loadCropPlanWithWriteAdmission(), key = JSON.stringify(confirmed.book);
    if (!actorCurrent(authority) || confirmed.token !== receipt.token || cropPlanWriteToken() !== receipt.token
      || !cropPlanWriteAdmissionMatches(confirmed.admission, key, receipt.token)
      || !cropPlanWriteCandidateIsLossless(candidate, confirmed.book) || dataKey(candidate) !== dataKey(confirmed.book)
      || ownKey(authority.binding.siteId, confirmed.book.nursery) !== ownKey(authority.binding.siteId, proof.payload)) {
      authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'readback-not-confirmed' };
    }
    const result: NurserySaveResult = Object.freeze({ status: 'confirmed', sample: authority.sample });
    results.set(result, { request, authority, confirmed: { book: confirmed.book, token: receipt.token, admission: confirmed.admission }, key, used: false });
    return result;
  } catch {
    if (attempted) { proof.context.authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'save-check-failed' }; }
    return held('save-check-failed');
  }
}
function confirmationCurrent(proof: ResultProof): boolean {
  try { return actorCurrent(proof.authority) && cropPlanWriteToken() === proof.confirmed.token
    && cropPlanWriteAdmissionMatches(proof.confirmed.admission, proof.key, proof.confirmed.token)
    && dataKey(loadCropPlanWithWriteAdmission().book) === dataKey(proof.confirmed.book); }
  catch { return false; }
}
export function readNurserySaveConfirmation(result: NurserySaveResult, request: NurserySaveRequest): Confirmation | null {
  const proof = results.get(result);
  return proof && proof.request === request && !proof.used && confirmationCurrent(proof) ? proof.confirmed : null;
}
/** A legitimate namespace rebase can retain newer foreign rows absent from the
 * submitted prop. Continue only from this receipt's actual readback identity. */
export function nurserySaveResultSourceKey(result: unknown, request: NurserySaveRequest): string | null {
  const proof = result && typeof result === 'object' ? results.get(result) : undefined;
  return proof && proof.request === request && confirmationCurrent(proof)
    ? nurserySettingsSourceKey(proof.authority.binding.siteId, proof.confirmed.book.nursery) : null;
}
/** Consume exactly once after the parent installs this actual admitted result.
 * The original prewrite base is spent; its actor/site/intent remain bound. */
export function nurserySaveResultMatches(result: unknown, request: NurserySaveRequest): 'device' | 'sample' | null {
  const proof = result && typeof result === 'object' ? results.get(result) : undefined;
  try {
    if (!proof || proof.request !== request || proof.used || !confirmationCurrent(proof)) return null;
    const current = proof.authority.binding.current();
    if (!current || current.base.token !== proof.confirmed.token || current.base.planKey !== proof.key
      || !cropPlanWriteAdmissionMatches(current.base.admission, current.base.planKey, current.base.token)
      || dataKey(current.book) !== dataKey(proof.confirmed.book)) return null;
    proof.used = true; return proof.authority.sample ? 'sample' : 'device';
  } catch { return null; }
}
