'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import type { LengthUnit } from './length-units';

const KEY = 'imbewu_length_unit_v1';
const SAMPLE_EVENT = 'imbewu-sample-mode-changed';
export interface LengthUnitPreferenceContext { readonly kind: 'length-unit-preference' }
type Result = { unit: LengthUnit; remembered: boolean; destination: 'device' | 'sample' | 'unavailable' };
interface Scope {
  epoch: number; users: number; sampleUnit: LengthUnit; observedUid: string | null; failed: boolean;
  proofs: Set<Proof>; stop: () => void;
}
interface Proof {
  win: Window; scope: Scope; epoch: number; owner: string | null; sample: boolean;
  storage: Storage | null; key: string; revoked: boolean; listeners: Set<() => void>;
}
const scopes = new WeakMap<Window, Scope>();
const proofs = new WeakMap<object, Proof>();
function sample(win: Window): boolean { return win.sessionStorage.getItem('imbewu_sample_mode') === '1'; }
function local(win: Window): Storage | null { try { return win.localStorage; } catch { return null; } }
function actorMatches(owner: string | null, inSample: boolean): boolean {
  if (inSample || !isBackendConfigured()) return true;
  const auth = getFirebase()?.auth;
  return !!auth && (auth.currentUser?.uid ?? null) === owner;
}
function changed(scope: Scope) {
  ++scope.epoch; scope.sampleUnit = 'm';
  for (const proof of scope.proofs) for (const listener of proof.listeners) listener();
}
function scopeFor(win: Window): Scope {
  const found = scopes.get(win); if (found) return found;
  const auth = isBackendConfigured() ? getFirebase()?.auth : null;
  const scope: Scope = { epoch: 0, users: 0, sampleUnit: 'm', observedUid: auth?.currentUser?.uid ?? null, failed: false, proofs: new Set(), stop: () => {} };
  const sampleChanged = () => changed(scope);
  win.addEventListener(SAMPLE_EVENT, sampleChanged);
  let stopAuth: (() => void) | undefined;
  try {
    if (auth) stopAuth = onAuthStateChanged(auth, user => {
      const uid = user?.uid ?? null;
      if (uid !== scope.observedUid) { scope.observedUid = uid; changed(scope); }
    }, () => { scope.failed = true; changed(scope); });
  } catch (error) { win.removeEventListener(SAMPLE_EVENT, sampleChanged); throw error; }
  scope.stop = () => { win.removeEventListener(SAMPLE_EVENT, sampleChanged); stopAuth?.(); scopes.delete(win); };
  scopes.set(win, scope); return scope;
}
export function captureLengthUnitPreferenceContext(): LengthUnitPreferenceContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const win = window, inSample = sample(win), owner = activeAccountUid();
    if (!actorMatches(owner, inSample)) return null;
    const scope = scopeFor(win), context: LengthUnitPreferenceContext = Object.freeze({ kind: 'length-unit-preference' });
    const proof: Proof = { win, scope, epoch: scope.epoch, owner, sample: inSample, storage: local(win),
      key: activeAccountLocalStorageKey(KEY), revoked: false, listeners: new Set() };
    ++scope.users; scope.proofs.add(proof); proofs.set(context, proof); return context;
  } catch { return null; }
}
export function lengthUnitPreferenceContextIsCurrent(context: LengthUnitPreferenceContext | null): boolean {
  const proof = context && proofs.get(context);
  try {
    const current = !!proof && !proof.revoked && !proof.scope.failed && proof.scope.epoch === proof.epoch && typeof window !== 'undefined' && window === proof.win
      && activeAccountUid() === proof.owner && sample(window) === proof.sample && local(window) === proof.storage
      && activeAccountLocalStorageKey(KEY) === proof.key && actorMatches(proof.owner, proof.sample);
    if (proof && !current) proof.revoked = true;
    return current;
  } catch { if (proof) proof.revoked = true; return false; }
}
export function subscribeLengthUnitPreferenceContext(context: LengthUnitPreferenceContext | null, listener: () => void): () => void {
  const proof = context && proofs.get(context);
  if (!proof) return () => {};
  proof.listeners.add(listener); return () => proof.listeners.delete(listener);
}
export function revokeLengthUnitPreferenceContext(context: LengthUnitPreferenceContext | null): void {
  const proof = context && proofs.get(context); if (!proof) return;
  proof.revoked = true; proof.listeners.clear(); proof.scope.proofs.delete(proof); proofs.delete(context!);
  if (--proof.scope.users === 0) proof.scope.stop();
}
export function readLengthUnitPreference(context: LengthUnitPreferenceContext | null): Result {
  try {
    if (!lengthUnitPreferenceContextIsCurrent(context)) return { unit: 'm', remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) return { unit: proof.scope.sampleUnit, remembered: false, destination: 'sample' };
    const raw = proof.storage?.getItem(proof.key);
    if (!lengthUnitPreferenceContextIsCurrent(context)) return { unit: 'm', remembered: false, destination: 'unavailable' };
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === 2 && (value as { version?: unknown }).version === 1
        && ['m', 'ft'].includes((value as { unit?: string }).unit ?? '')) {
        return { unit: (value as { unit: LengthUnit }).unit, remembered: true, destination: 'device' };
      }
    }
    return { unit: 'm', remembered: false, destination: proof.storage ? 'device' : 'unavailable' };
  } catch { return { unit: 'm', remembered: false, destination: 'unavailable' }; }
}
export function writeLengthUnitPreference(context: LengthUnitPreferenceContext | null, unit: LengthUnit): Omit<Result, 'unit'> {
  try {
    if (!['m', 'ft'].includes(unit) || !lengthUnitPreferenceContextIsCurrent(context)) return { remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) { proof.scope.sampleUnit = unit; return { remembered: false, destination: 'sample' }; }
    if (!proof.storage) return { remembered: false, destination: 'unavailable' };
    const raw = JSON.stringify({ version: 1, unit });
    proof.storage.setItem(proof.key, raw);
    return lengthUnitPreferenceContextIsCurrent(context) && proof.storage.getItem(proof.key) === raw
      ? { remembered: true, destination: 'device' } : { remembered: false, destination: 'unavailable' };
  } catch { return { remembered: false, destination: 'unavailable' }; }
}
