'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { isSampleMode, SAMPLE_MODE_EVENT } from './sample-mode';
import { cropPlanWriteAdmissionMatches, cropPlanWriteCandidateIsLossless, cropPlanWriteToken,
  loadCropPlanWithWriteAdmission, saveCropPlanWithReceipt, type CropPlanState, type CropPlanWriteAdmission, type HarvestTarget } from './crop-plan';
import type { NurserySettings } from './nursery-settings';

export interface NurserySaveAuthority { readonly kind: 'nursery-save-authority' }
export interface NurserySaveContext { readonly kind: 'nursery-save-context' }
export interface NurserySaveRequest { readonly kind: 'nursery-save-request' }
export interface HarvestSaveContext { readonly kind: 'harvest-save-context' }
export interface HarvestSaveRequest { readonly kind: 'harvest-save-request' }
export type NurserySaveResult = { readonly status: 'confirmed'; readonly sample: boolean }
  | { readonly status: 'held' | 'performed-unconfirmed'; readonly reason: string };
// Public status wording stays compatible; the closed field and exact request
// are bound privately, so even an identical-looking result cannot cross fields.
export type HarvestSaveResult = NurserySaveResult;
type Purpose = 'nursery' | 'harvestTargets';
type Payload = NurserySettings | HarvestTarget[];
type SaveContext = NurserySaveContext | HarvestSaveContext;
type SaveRequest = NurserySaveRequest | HarvestSaveRequest;
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
interface ContextProof { readonly purpose: Purpose; readonly authority: AuthorityProof; readonly base: NurserySaveBase; readonly sourceKey: string }
interface RequestProof {
  readonly context: ContextProof; readonly payload: Payload; readonly payloadKey: string;
  phase: 'new' | 'started' | 'finished';
}
interface Confirmation { readonly book: CropPlanState; readonly token: string; readonly admission: CropPlanWriteAdmission }
interface ResultProof { readonly purpose: Purpose; readonly request: SaveRequest; readonly authority: AuthorityProof; readonly confirmed: Confirmation; readonly key: string; used: boolean }
// The legacy module/API name is retained for existing nursery consumers. Both
// closed purposes share these exact proofs, lifecycle and real writer.
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
export function harvestTargetsSourceKey(siteId: string, targets?: readonly HarvestTarget[]): string | null {
  try { return dataKey([siteId, targets === undefined ? [] : targets]); }
  catch { return null; }
}
function sourceKey(purpose: Purpose, siteId: string, book: CropPlanState): string | null {
  return purpose === 'nursery' ? nurserySettingsSourceKey(siteId, book.nursery) : harvestTargetsSourceKey(siteId, book.harvestTargets);
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
function createContext(authority: NurserySaveAuthority | null, purpose: Purpose): SaveContext | null {
  const proof = authority && authorities.get(authority);
  try {
    if (!proof || !actorCurrent(proof)) return null;
    const current = proof.binding.current(); if (!current) return null;
    const { base, book } = current;
    if (base.owner !== proof.owner || base.sample !== proof.sample || base.token === null
      || dataKey(book) !== dataKey(JSON.parse(base.planKey)) || !cropPlanWriteAdmissionMatches(base.admission, base.planKey, base.token)) return null;
    const originalKey = sourceKey(purpose, proof.binding.siteId, JSON.parse(base.planKey));
    if (!originalKey) return null;
    const context: SaveContext = purpose === 'nursery' ? Object.freeze({ kind: 'nursery-save-context' }) : Object.freeze({ kind: 'harvest-save-context' });
    contexts.set(context, { purpose, authority: proof, base, sourceKey: originalKey }); return context;
  } catch { return null; }
}
export function createNurserySaveContext(authority: NurserySaveAuthority | null): NurserySaveContext | null {
  return createContext(authority, 'nursery') as NurserySaveContext | null;
}
export function createHarvestSaveContext(authority: NurserySaveAuthority | null): HarvestSaveContext | null {
  return createContext(authority, 'harvestTargets') as HarvestSaveContext | null;
}
function contextCurrent(proof: ContextProof): boolean {
  try {
    if (!actorCurrent(proof.authority)) return false;
    const current = proof.authority.binding.current();
    return !!current && current.base === proof.base && dataKey(current.book) === dataKey(JSON.parse(proof.base.planKey))
      && sourceKey(proof.purpose, proof.authority.binding.siteId, current.book) === proof.sourceKey
      && cropPlanWriteAdmissionMatches(proof.base.admission, proof.base.planKey, proof.base.token);
  } catch { return false; }
}
function isContextCurrent(context: SaveContext | null | undefined, purpose: Purpose): boolean {
  const proof = context && contexts.get(context); return !!proof && proof.purpose === purpose && contextCurrent(proof);
}
export function nurserySaveContextIsCurrent(context: NurserySaveContext | null | undefined): boolean { return isContextCurrent(context, 'nursery'); }
export function harvestSaveContextIsCurrent(context: HarvestSaveContext | null | undefined): boolean { return isContextCurrent(context, 'harvestTargets'); }
function createRequest(context: SaveContext | null | undefined, next: Payload, purpose: Purpose): SaveRequest | null {
  const proof = context && contexts.get(context);
  try {
    if (!proof || proof.purpose !== purpose || !contextCurrent(proof) || (purpose === 'harvestTargets') !== Array.isArray(next)) return null;
    const payload = copy(next) as Payload, payloadKey = dataKey(payload);
    const request: SaveRequest = purpose === 'nursery' ? Object.freeze({ kind: 'nursery-save-request' }) : Object.freeze({ kind: 'harvest-save-request' });
    requests.set(request, { context: proof, payload, payloadKey, phase: 'new' }); return request;
  } catch { return null; }
}
export function createNurserySaveRequest(context: NurserySaveContext | null | undefined, next: NurserySettings): NurserySaveRequest | null {
  return createRequest(context, next, 'nursery') as NurserySaveRequest | null;
}
export function createHarvestSaveRequest(context: HarvestSaveContext | null | undefined, next: HarvestTarget[]): HarvestSaveRequest | null {
  return createRequest(context, next, 'harvestTargets') as HarvestSaveRequest | null;
}
function beginRequest(request: SaveRequest | undefined, context: SaveContext | null, supplied: Payload, purpose: Purpose): Payload | null {
  const proof = request && requests.get(request);
  try {
    const suppliedContext = context && contexts.get(context);
    if (!proof || proof.phase !== 'new' || proof.context.purpose !== purpose || !suppliedContext || suppliedContext.purpose !== purpose
      || suppliedContext.authority !== proof.context.authority || suppliedContext.base !== proof.context.base
      || suppliedContext.sourceKey !== proof.context.sourceKey || !contextCurrent(suppliedContext)
      || !contextCurrent(proof.context) || dataKey(supplied) !== proof.payloadKey) return null;
    proof.phase = 'started'; return copy(proof.payload) as Payload;
  } catch { return null; }
}
export function beginNurserySaveRequest(request: NurserySaveRequest | undefined, context: NurserySaveContext | null, supplied: NurserySettings): NurserySettings | null {
  return beginRequest(request, context, supplied, 'nursery') as NurserySettings | null;
}
export function beginHarvestSaveRequest(request: HarvestSaveRequest | undefined, context: HarvestSaveContext | null, supplied: HarvestTarget[]): HarvestTarget[] | null {
  return beginRequest(request, context, supplied, 'harvestTargets') as HarvestTarget[] | null;
}
function requestCurrent(request: SaveRequest, purpose: Purpose): boolean {
  const proof = requests.get(request); return !!proof && proof.context.purpose === purpose && proof.phase === 'started' && contextCurrent(proof.context);
}
export function nurserySaveRequestIsCurrent(request: NurserySaveRequest): boolean { return requestCurrent(request, 'nursery'); }
export function harvestSaveRequestIsCurrent(request: HarvestSaveRequest): boolean { return requestCurrent(request, 'harvestTargets'); }
function ownKey(purpose: Purpose, siteId: string, value: Payload | undefined): string {
  const detached = copy(value) as Payload;
  if (purpose === 'harvestTargets') return dataKey((detached as HarvestTarget[]).filter(row => row.siteId === siteId));
  const settings = detached as NurserySettings;
  return dataKey({ ...settings, spaces: settings.spaces.filter(row => row.siteId === siteId),
    containers: settings.containers.filter(row => row.siteId === siteId), profiles: settings.profiles.filter(row => row.siteId === siteId) });
}
function outsidePurposeKey(book: CropPlanState, purpose: Purpose): string {
  const detached = copy(book) as Record<string, unknown>;
  delete detached[purpose]; delete detached.updatedAt;
  return dataKey(detached);
}
function foreignKey(purpose: Purpose, siteId: string, value: Payload | undefined): string {
  const detached = copy(value === undefined ? purpose === 'harvestTargets' ? [] : { version: 1, spaces: [], containers: [], profiles: [] } : value) as Payload;
  if (purpose === 'harvestTargets') return dataKey((detached as HarvestTarget[]).filter(row => row.siteId !== siteId));
  const settings = detached as NurserySettings;
  return dataKey({ ...settings, spaces: settings.spaces.filter(row => row.siteId !== siteId),
    containers: settings.containers.filter(row => row.siteId !== siteId), profiles: settings.profiles.filter(row => row.siteId !== siteId) });
}
/** The only success mint calls the real canonical writer and then reads its
 * actual admitted bytes. Caller booleans, display props and tokens cannot mint it. */
function commitRequest(request: SaveRequest, candidate: CropPlanState, expectedToken: string, purpose: Purpose): NurserySaveResult {
  const proof = requests.get(request);
  const held = (reason: string): NurserySaveResult => {
    if (proof?.context.purpose === purpose && proof.phase === 'started') proof.phase = 'finished';
    return { status: 'held', reason };
  };
  if (!proof || !requestCurrent(request, purpose)) return held('original-context-changed');
  let attempted = false;
  try {
    const authority = proof.context.authority;
    const loaded = loadCropPlanWithWriteAdmission();
    if (loaded.token !== expectedToken || !cropPlanWriteAdmissionMatches(loaded.admission, JSON.stringify(loaded.book), expectedToken)
      || !cropPlanWriteCandidateIsLossless(candidate)
      // Preparation still belongs to the parent's existing namespace merge.
      // This receipt cannot confirm collateral changes outside its own intent.
      || outsidePurposeKey(candidate, purpose) !== outsidePurposeKey(loaded.book, purpose)
      || foreignKey(purpose, authority.binding.siteId, candidate[purpose]) !== foreignKey(purpose, authority.binding.siteId, loaded.book[purpose])
      || ownKey(purpose, authority.binding.siteId, candidate[purpose]) !== ownKey(purpose, authority.binding.siteId, proof.payload)
      || !requestCurrent(request, purpose) || cropPlanWriteToken() !== expectedToken) return held('saved-source-changed');
    // Mark before calling: false or an exception is not proof of atomic rollback.
    attempted = true; proof.phase = 'finished';
    const receipt = saveCropPlanWithReceipt(candidate);
    if (!receipt.saved) { authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'write-not-confirmed' }; }
    const confirmed = loadCropPlanWithWriteAdmission(), key = JSON.stringify(confirmed.book);
    if (!actorCurrent(authority) || confirmed.token !== receipt.token || cropPlanWriteToken() !== receipt.token
      || !cropPlanWriteAdmissionMatches(confirmed.admission, key, receipt.token)
      || !cropPlanWriteCandidateIsLossless(candidate, confirmed.book) || dataKey(candidate) !== dataKey(confirmed.book)
      || ownKey(purpose, authority.binding.siteId, confirmed.book[purpose]) !== ownKey(purpose, authority.binding.siteId, proof.payload)) {
      authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'readback-not-confirmed' };
    }
    const result: NurserySaveResult = Object.freeze({ status: 'confirmed', sample: authority.sample });
    results.set(result, { purpose, request, authority, confirmed: { book: confirmed.book, token: receipt.token, admission: confirmed.admission }, key, used: false });
    return result;
  } catch {
    if (attempted) { proof.context.authority.uncertain = true; return { status: 'performed-unconfirmed', reason: 'save-check-failed' }; }
    return held('save-check-failed');
  }
}
export function commitNurserySaveRequest(request: NurserySaveRequest, candidate: CropPlanState, expectedToken: string): NurserySaveResult {
  return commitRequest(request, candidate, expectedToken, 'nursery');
}
export function commitHarvestSaveRequest(request: HarvestSaveRequest, candidate: CropPlanState, expectedToken: string): HarvestSaveResult {
  return commitRequest(request, candidate, expectedToken, 'harvestTargets');
}
function confirmationCurrent(proof: ResultProof): boolean {
  try { return actorCurrent(proof.authority) && cropPlanWriteToken() === proof.confirmed.token
    && cropPlanWriteAdmissionMatches(proof.confirmed.admission, proof.key, proof.confirmed.token)
    && dataKey(loadCropPlanWithWriteAdmission().book) === dataKey(proof.confirmed.book); }
  catch { return false; }
}
function readConfirmation(result: unknown, request: SaveRequest, purpose: Purpose): Confirmation | null {
  const proof = result && typeof result === 'object' ? results.get(result) : undefined;
  return proof && proof.purpose === purpose && requests.get(request)?.context.purpose === purpose
    && proof.request === request && !proof.used && confirmationCurrent(proof) ? proof.confirmed : null;
}
export function readNurserySaveConfirmation(result: NurserySaveResult, request: NurserySaveRequest): Confirmation | null { return readConfirmation(result, request, 'nursery'); }
export function readHarvestSaveConfirmation(result: HarvestSaveResult, request: HarvestSaveRequest): Confirmation | null { return readConfirmation(result, request, 'harvestTargets'); }
/** A legitimate namespace rebase can retain newer foreign rows absent from the
 * submitted prop. Continue only from this receipt's actual readback identity. */
function resultSourceKey(result: unknown, request: SaveRequest, purpose: Purpose): string | null {
  const proof = result && typeof result === 'object' ? results.get(result) : undefined;
  return proof && proof.purpose === purpose && requests.get(request)?.context.purpose === purpose && proof.request === request && confirmationCurrent(proof)
    ? sourceKey(purpose, proof.authority.binding.siteId, proof.confirmed.book) : null;
}
export function nurserySaveResultSourceKey(result: unknown, request: NurserySaveRequest): string | null { return resultSourceKey(result, request, 'nursery'); }
export function harvestSaveResultSourceKey(result: unknown, request: HarvestSaveRequest): string | null { return resultSourceKey(result, request, 'harvestTargets'); }
/** Consume exactly once after the parent installs this actual admitted result.
 * The original prewrite base is spent; its actor/site/intent remain bound. */
function resultMatches(result: unknown, request: SaveRequest, purpose: Purpose): 'device' | 'sample' | null {
  const proof = result && typeof result === 'object' ? results.get(result) : undefined;
  try {
    if (!proof || proof.purpose !== purpose || requests.get(request)?.context.purpose !== purpose
      || proof.request !== request || proof.used || !confirmationCurrent(proof)) return null;
    const current = proof.authority.binding.current();
    if (!current || current.base.token !== proof.confirmed.token || current.base.planKey !== proof.key
      || !cropPlanWriteAdmissionMatches(current.base.admission, current.base.planKey, current.base.token)
      || dataKey(current.book) !== dataKey(proof.confirmed.book)) return null;
    proof.used = true; return proof.authority.sample ? 'sample' : 'device';
  } catch { return null; }
}
export function nurserySaveResultMatches(result: unknown, request: NurserySaveRequest): 'device' | 'sample' | null { return resultMatches(result, request, 'nursery'); }
export function harvestSaveResultMatches(result: unknown, request: HarvestSaveRequest): 'device' | 'sample' | null { return resultMatches(result, request, 'harvestTargets'); }
