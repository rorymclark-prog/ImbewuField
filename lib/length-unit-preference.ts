'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import type { LengthUnit } from './length-units';
import type { MassUnit } from './mass-units';

const KEY = 'imbewu_length_unit_v1';
const NURSERY_KEY = 'imbewu_nursery_unit_v1';
const HARVEST_KEY = 'imbewu_harvest_mass_unit_v1';
const GROWER_ESTIMATE_KEY = 'imbewu_grower_estimate_unit_v1';
// A namespace proof only: file delivery never reads or writes a preference row.
const FIELD_LAYOUT_CONTEXT_KEY = 'imbewu_field_layout_export_context_v1';
const FIELD_IMPORT_CONTEXT_KEY = 'imbewu_field_layout_import_context_v1';
const JOURNAL_OBSERVATION_CONTEXT_KEY = 'imbewu_journal_observation_context_v1';
export type GrowerEstimateUnitChoice = 'metric' | 'imperial';
export interface GrowerEstimateUnitPreferenceContext { readonly kind: 'grower-estimate-unit-preference' }
export interface HarvestMassUnitPreferenceContext { readonly kind: 'harvest-mass-unit-preference' }
export interface FieldLayoutExportContext { readonly kind: 'field-layout-export-context' }
export interface FieldLayoutImportContext { readonly kind: 'field-layout-import-context' }
export interface JournalObservationContext { readonly kind: 'journal-observation-context' }
export interface InvoiceDocumentContext { readonly kind: 'invoice-document-context' }
export interface WeatherReferenceContext { readonly kind: 'weather-reference-context' }
type Purpose = 'field' | 'nursery' | 'harvest-mass' | 'grower-estimate' | 'field-layout-export' | 'field-layout-import' | 'journal-observation' | 'invoice-document' | 'weather-reference';
const purposeKey = (purpose: Purpose) => purpose === 'field' ? KEY : purpose === 'nursery' ? NURSERY_KEY
  : purpose === 'harvest-mass' ? HARVEST_KEY : purpose === 'grower-estimate' ? GROWER_ESTIMATE_KEY
  : purpose === 'field-layout-import' ? FIELD_IMPORT_CONTEXT_KEY : purpose === 'journal-observation' ? JOURNAL_OBSERVATION_CONTEXT_KEY
  : purpose === 'invoice-document' ? 'imbewu_invoice_document_context_v1'
  : purpose === 'weather-reference' ? 'imbewu_weather_reference_context_v1' : FIELD_LAYOUT_CONTEXT_KEY;
export type NurseryUnitChoice = 'metric' | 'imperial';
export interface NurseryUnitPreferenceContext { readonly kind: 'nursery-unit-preference' }
type PreferenceContext = LengthUnitPreferenceContext | NurseryUnitPreferenceContext | HarvestMassUnitPreferenceContext | GrowerEstimateUnitPreferenceContext | FieldLayoutExportContext | FieldLayoutImportContext | JournalObservationContext | InvoiceDocumentContext | WeatherReferenceContext;
const SAMPLE_EVENT = 'imbewu-sample-mode-changed';
export interface LengthUnitPreferenceContext { readonly kind: 'length-unit-preference' }
type Result = { unit: LengthUnit; remembered: boolean; destination: 'device' | 'sample' | 'unavailable' };
interface Scope {
  epoch: number; users: number; sampleUnit: LengthUnit; sampleNurseryUnit: NurseryUnitChoice; sampleMassUnit: MassUnit; sampleGrowerEstimateUnit: GrowerEstimateUnitChoice; observedUid: string | null; failed: boolean;
  proofs: Set<Proof>; stop: () => void;
}
interface Proof {
  purpose: Purpose; win: Window; scope: Scope; epoch: number; owner: string | null; sample: boolean;
  storage: Storage | null; key: string; revoked: boolean; listeners: Set<() => void>;
  nurseryValueListeners?: Set<(unit: NurseryUnitChoice) => void>;
  growerEstimateValueListeners?: Set<(unit: GrowerEstimateUnitChoice) => void>;
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
  ++scope.epoch; scope.sampleUnit = 'm'; scope.sampleNurseryUnit = 'metric'; scope.sampleMassUnit = 'kg'; scope.sampleGrowerEstimateUnit = 'metric';
  // A view can replace its receipt during notification while another purpose
  // keeps this scope alive. New receipts/listeners belong to the next change.
  const notifications = [...scope.proofs].map(proof => ({ proof, listeners: [...proof.listeners] }));
  for (const { proof, listeners } of notifications) for (const listener of listeners) {
    if (scope.proofs.has(proof) && proof.listeners.has(listener)) listener();
  }
}
function scopeFor(win: Window): Scope {
  const found = scopes.get(win); if (found) return found;
  const auth = isBackendConfigured() ? getFirebase()?.auth : null;
  const scope: Scope = { epoch: 0, users: 0, sampleUnit: 'm', sampleNurseryUnit: 'metric', sampleMassUnit: 'kg', sampleGrowerEstimateUnit: 'metric', observedUid: auth?.currentUser?.uid ?? null, failed: false, proofs: new Set(), stop: () => {} };
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
function capturePreferenceContext(purpose: Purpose): PreferenceContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const win = window, inSample = sample(win), owner = activeAccountUid();
    if (!actorMatches(owner, inSample)) return null;
    const scope = scopeFor(win), context: PreferenceContext = Object.freeze({ kind: purpose === 'field' ? 'length-unit-preference' : purpose === 'nursery' ? 'nursery-unit-preference' : purpose === 'harvest-mass' ? 'harvest-mass-unit-preference' : purpose === 'grower-estimate' ? 'grower-estimate-unit-preference' : purpose === 'field-layout-import' ? 'field-layout-import-context' : purpose === 'journal-observation' ? 'journal-observation-context' : purpose === 'invoice-document' ? 'invoice-document-context' : purpose === 'weather-reference' ? 'weather-reference-context' : 'field-layout-export-context' });
    const proof: Proof = { purpose, win, scope, epoch: scope.epoch, owner, sample: inSample, storage: local(win),
      key: activeAccountLocalStorageKey(purposeKey(purpose)), revoked: false, listeners: new Set(),
      ...(purpose === 'nursery' ? { nurseryValueListeners: new Set() } : {}),
      ...(purpose === 'grower-estimate' ? { growerEstimateValueListeners: new Set() } : {}) };
    ++scope.users; scope.proofs.add(proof); proofs.set(context, proof); return context;
  } catch { return null; }
}
function proofIsCurrent(proof: Proof | null | undefined): boolean {
  try {
    const current = !!proof && !proof.revoked && !proof.scope.failed && proof.scope.epoch === proof.epoch && typeof window !== 'undefined' && window === proof.win
      && activeAccountUid() === proof.owner && sample(window) === proof.sample && local(window) === proof.storage
      && activeAccountLocalStorageKey(purposeKey(proof.purpose)) === proof.key && actorMatches(proof.owner, proof.sample);
    if (proof && !current) proof.revoked = true;
    return current;
  } catch { if (proof) proof.revoked = true; return false; }
}
function contextIsCurrent(context: PreferenceContext | null): boolean {
  return proofIsCurrent(context && proofs.get(context));
}
function subscribeContext(context: PreferenceContext | null, listener: () => void): () => void {
  const proof = context && proofs.get(context);
  if (!proof) return () => {};
  proof.listeners.add(listener); return () => proof.listeners.delete(listener);
}
function revokeContext(context: PreferenceContext | null): void {
  const proof = context && proofs.get(context); if (!proof) return;
  proof.revoked = true; proof.listeners.clear(); proof.nurseryValueListeners?.clear(); proof.growerEstimateValueListeners?.clear(); proof.scope.proofs.delete(proof); proofs.delete(context!);
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

// All closed purposes share the same private actor/sample epoch authority, but
// nursery choice never reads or overwrites the field editor's remembered unit.
export function captureLengthUnitPreferenceContext(): LengthUnitPreferenceContext | null {
  return capturePreferenceContext('field') as LengthUnitPreferenceContext | null;
}
export function lengthUnitPreferenceContextIsCurrent(context: LengthUnitPreferenceContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'field' && contextIsCurrent(context);
}
export const subscribeLengthUnitPreferenceContext = (context: LengthUnitPreferenceContext | null, listener: () => void) => subscribeContext(context, listener);
export const revokeLengthUnitPreferenceContext = (context: LengthUnitPreferenceContext | null) => revokeContext(context);

// Reuse the existing account/window/sample epoch authority without giving a
// geospatial export access to any of the four remembered unit preferences.
export function captureFieldLayoutExportContext(): FieldLayoutExportContext | null {
  return capturePreferenceContext('field-layout-export') as FieldLayoutExportContext | null;
}
export function fieldLayoutExportContextIsCurrent(context: FieldLayoutExportContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'field-layout-export' && contextIsCurrent(context);
}
export const subscribeFieldLayoutExportContext = (context: FieldLayoutExportContext | null, listener: () => void) => subscribeContext(context, listener);
export const revokeFieldLayoutExportContext = (context: FieldLayoutExportContext | null) => revokeContext(context);
// Import carries an ephemeral actor/sample epoch, never a persisted preference.
export function captureFieldLayoutImportContext(): FieldLayoutImportContext | null {
  return capturePreferenceContext('field-layout-import') as FieldLayoutImportContext | null;
}
export function fieldLayoutImportContextIsCurrent(context: FieldLayoutImportContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'field-layout-import' && contextIsCurrent(context);
}
export const revokeFieldLayoutImportContext = (context: FieldLayoutImportContext | null) => revokeContext(context);
// A note form shares the same observed actor/sample epoch as file delivery.
// Its namespace is only a proof: it never creates a preference or journal row.
export function captureJournalObservationContext(): JournalObservationContext | null {
  return capturePreferenceContext('journal-observation') as JournalObservationContext | null;
}
export function journalObservationContextIsCurrent(context: JournalObservationContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'journal-observation' && contextIsCurrent(context);
}
export const revokeJournalObservationContext = (context: JournalObservationContext | null) => revokeContext(context);

// Invoice write provenance observes the same actor/sample epochs, without
// gaining permission to alter any remembered unit preference.
export function captureInvoiceDocumentContext(): InvoiceDocumentContext | null {
  return capturePreferenceContext('invoice-document') as InvoiceDocumentContext | null;
}
export function invoiceDocumentContextIsCurrent(context: InvoiceDocumentContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'invoice-document' && contextIsCurrent(context);
}
export const revokeInvoiceDocumentContext = (context: InvoiceDocumentContext | null) => revokeContext(context);
export const subscribeInvoiceDocumentContext = (context: InvoiceDocumentContext | null, listener: () => void) => subscribeContext(context, listener);

export function captureNurseryUnitPreferenceContext(): NurseryUnitPreferenceContext | null {
  return capturePreferenceContext('nursery') as NurseryUnitPreferenceContext | null;
}
export function nurseryUnitPreferenceContextIsCurrent(context: NurseryUnitPreferenceContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'nursery' && contextIsCurrent(context);
}
export const subscribeNurseryUnitPreferenceContext = (context: NurseryUnitPreferenceContext | null, listener: () => void) => subscribeContext(context, listener);
export function subscribeNurseryUnitPreferenceValue(context: NurseryUnitPreferenceContext | null, listener: (unit: NurseryUnitChoice) => void): () => void {
  const proof = context && proofs.get(context);
  if (!proof || proof.purpose !== 'nursery' || !proof.nurseryValueListeners) return () => {};
  proof.nurseryValueListeners.add(listener);
  return () => proof.nurseryValueListeners?.delete(listener);
}
export const revokeNurseryUnitPreferenceContext = (context: NurseryUnitPreferenceContext | null) => revokeContext(context);
export function readNurseryUnitPreference(context: NurseryUnitPreferenceContext | null): { unit: NurseryUnitChoice; remembered: boolean; destination: 'device' | 'sample' | 'unavailable' } {
  try {
    if (!nurseryUnitPreferenceContextIsCurrent(context)) return { unit: 'metric', remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) return { unit: proof.scope.sampleNurseryUnit, remembered: false, destination: 'sample' };
    const raw = proof.storage?.getItem(proof.key), value = raw ? JSON.parse(raw) : null;
    if (!nurseryUnitPreferenceContextIsCurrent(context)) return { unit: 'metric', remembered: false, destination: 'unavailable' };
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && value.version === 1 && ['metric', 'imperial'].includes(value.unit)
      ? { unit: value.unit, remembered: true, destination: 'device' }
      : { unit: 'metric', remembered: false, destination: proof.storage ? 'device' : 'unavailable' };
  } catch { return { unit: 'metric', remembered: false, destination: 'unavailable' }; }
}
function notifyNurseryValue(origin: Proof, unit: NurseryUnitChoice) {
  for (const p of origin.scope.proofs) {
    if (p.purpose === 'nursery' && p.nurseryValueListeners) {
      for (const listener of [...p.nurseryValueListeners]) {
        try {
          if (
            proofIsCurrent(p) &&
            p.owner === origin.owner &&
            p.sample === origin.sample &&
            p.key === origin.key &&
            p.storage === origin.storage
          ) {
            listener(unit);
          }
        } catch {
          // Prevent broken listener from aborting write outcome or suppressing other listeners
        }
      }
    }
  }
}

export function writeNurseryUnitPreference(context: NurseryUnitPreferenceContext | null, unit: NurseryUnitChoice): { remembered: boolean; destination: 'device' | 'sample' | 'unavailable' } {
  try {
    if (!['metric', 'imperial'].includes(unit) || !nurseryUnitPreferenceContextIsCurrent(context)) return { remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) {
      proof.scope.sampleNurseryUnit = unit;
      notifyNurseryValue(proof, unit);
      return { remembered: false, destination: 'sample' };
    }
    if (!proof.storage) return { remembered: false, destination: 'unavailable' };
    const raw = JSON.stringify({ version: 1, unit }); proof.storage.setItem(proof.key, raw);
    const success = nurseryUnitPreferenceContextIsCurrent(context) && proof.storage.getItem(proof.key) === raw;
    if (success) notifyNurseryValue(proof, unit);
    return success ? { remembered: true, destination: 'device' } : { remembered: false, destination: 'unavailable' };
  } catch { return { remembered: false, destination: 'unavailable' }; }
}

export function captureHarvestMassUnitPreferenceContext(): HarvestMassUnitPreferenceContext | null {
  return capturePreferenceContext('harvest-mass') as HarvestMassUnitPreferenceContext | null;
}
export function harvestMassUnitPreferenceContextIsCurrent(context: HarvestMassUnitPreferenceContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'harvest-mass' && contextIsCurrent(context);
}
export const subscribeHarvestMassUnitPreferenceContext = (context: HarvestMassUnitPreferenceContext | null, listener: () => void) => subscribeContext(context, listener);
export const revokeHarvestMassUnitPreferenceContext = (context: HarvestMassUnitPreferenceContext | null) => revokeContext(context);
export function readHarvestMassUnitPreference(context: HarvestMassUnitPreferenceContext | null): { unit: MassUnit; remembered: boolean; destination: 'device' | 'sample' | 'unavailable' } {
  try {
    if (!harvestMassUnitPreferenceContextIsCurrent(context)) return { unit: 'kg', remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) return { unit: proof.scope.sampleMassUnit, remembered: false, destination: 'sample' };
    const raw = proof.storage?.getItem(proof.key), value = raw ? JSON.parse(raw) : null;
    if (!harvestMassUnitPreferenceContextIsCurrent(context)) return { unit: 'kg', remembered: false, destination: 'unavailable' };
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && value.version === 1 && ['kg', 'lb'].includes(value.unit)
      ? { unit: value.unit, remembered: true, destination: 'device' }
      : { unit: 'kg', remembered: false, destination: proof.storage ? 'device' : 'unavailable' };
  } catch { return { unit: 'kg', remembered: false, destination: 'unavailable' }; }
}
export function writeHarvestMassUnitPreference(context: HarvestMassUnitPreferenceContext | null, unit: MassUnit): { remembered: boolean; destination: 'device' | 'sample' | 'unavailable' } {
  try {
    if (!['kg', 'lb'].includes(unit) || !harvestMassUnitPreferenceContextIsCurrent(context)) return { remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) { proof.scope.sampleMassUnit = unit; return { remembered: false, destination: 'sample' }; }
    if (!proof.storage) return { remembered: false, destination: 'unavailable' };
    const raw = JSON.stringify({ version: 1, unit }); proof.storage.setItem(proof.key, raw);
    return harvestMassUnitPreferenceContextIsCurrent(context) && proof.storage.getItem(proof.key) === raw
      ? { remembered: true, destination: 'device' } : { remembered: false, destination: 'unavailable' };
  } catch { return { remembered: false, destination: 'unavailable' }; }
}


export function captureGrowerEstimateUnitPreferenceContext(): GrowerEstimateUnitPreferenceContext | null {
  return capturePreferenceContext('grower-estimate') as GrowerEstimateUnitPreferenceContext | null;
}
export function growerEstimateUnitPreferenceContextIsCurrent(context: GrowerEstimateUnitPreferenceContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'grower-estimate' && contextIsCurrent(context);
}
export const subscribeGrowerEstimateUnitPreferenceContext = (context: GrowerEstimateUnitPreferenceContext | null, listener: () => void) => subscribeContext(context, listener);
export const revokeGrowerEstimateUnitPreferenceContext = (context: GrowerEstimateUnitPreferenceContext | null) => revokeContext(context);
export function subscribeGrowerEstimateUnitPreferenceValue(context: GrowerEstimateUnitPreferenceContext | null, listener: (unit: GrowerEstimateUnitChoice) => void): () => void {
  const proof = context && proofs.get(context);
  if (!proof || proof.purpose !== 'grower-estimate' || !proof.growerEstimateValueListeners) return () => {};
  proof.growerEstimateValueListeners.add(listener);
  return () => proof.growerEstimateValueListeners?.delete(listener);
}
type GrowerEstimatePreferenceRead = { unit: GrowerEstimateUnitChoice; remembered: boolean; destination: 'device' | 'sample' | 'unavailable' };
export function readGrowerEstimateUnitPreference(context: GrowerEstimateUnitPreferenceContext | null): GrowerEstimatePreferenceRead {
  try {
    if (!growerEstimateUnitPreferenceContextIsCurrent(context)) return { unit: 'metric', remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) return { unit: proof.scope.sampleGrowerEstimateUnit, remembered: false, destination: 'sample' };
    const raw = proof.storage?.getItem(proof.key), value = raw ? JSON.parse(raw) : null;
    if (!growerEstimateUnitPreferenceContextIsCurrent(context)) return { unit: 'metric', remembered: false, destination: 'unavailable' };
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2
      && value.version === 1 && ['metric', 'imperial'].includes(value.unit)
      ? { unit: value.unit, remembered: true, destination: 'device' }
      : { unit: 'metric', remembered: false, destination: proof.storage ? 'device' : 'unavailable' };
  } catch { return { unit: 'metric', remembered: false, destination: 'unavailable' }; }
}
function growerEstimateValueMatches(proof: Proof, unit: GrowerEstimateUnitChoice): boolean {
  try {
    if (!proofIsCurrent(proof)) return false;
    if (proof.sample) return proof.scope.sampleGrowerEstimateUnit === unit;
    const raw = proof.storage?.getItem(proof.key);
    return proofIsCurrent(proof) && raw === JSON.stringify({ version: 1, unit });
  } catch { return false; }
}
function notifyGrowerEstimateValue(origin: Proof, unit: GrowerEstimateUnitChoice) {
  for (const proof of origin.scope.proofs) {
    if (proof.purpose !== 'grower-estimate' || !proof.growerEstimateValueListeners) continue;
    for (const listener of [...proof.growerEstimateValueListeners]) {
      // A listener can synchronously write another unit or change actor/sample.
      // Never deliver the outer write's obsolete value to the next subscriber.
      if (!growerEstimateValueMatches(origin, unit)) return;
      if (!proofIsCurrent(proof) || proof.owner !== origin.owner || proof.sample !== origin.sample
        || proof.key !== origin.key || proof.storage !== origin.storage) continue;
      try { listener(unit); } catch { /* One broken view does not suppress other current views. */ }
    }
  }
}
export function writeGrowerEstimateUnitPreference(context: GrowerEstimateUnitPreferenceContext | null, unit: GrowerEstimateUnitChoice): Omit<GrowerEstimatePreferenceRead, 'unit'> {
  try {
    if (!['metric', 'imperial'].includes(unit) || !growerEstimateUnitPreferenceContextIsCurrent(context)) return { remembered: false, destination: 'unavailable' };
    const proof = proofs.get(context!)!;
    if (proof.sample) proof.scope.sampleGrowerEstimateUnit = unit;
    else {
      if (!proof.storage) return { remembered: false, destination: 'unavailable' };
      proof.storage.setItem(proof.key, JSON.stringify({ version: 1, unit }));
    }
    if (!growerEstimateValueMatches(proof, unit)) return { remembered: false, destination: 'unavailable' };
    notifyGrowerEstimateValue(proof, unit);
    return growerEstimateValueMatches(proof, unit)
      ? { remembered: !proof.sample, destination: proof.sample ? 'sample' : 'device' }
      : { remembered: false, destination: 'unavailable' };
  } catch { return { remembered: false, destination: 'unavailable' }; }
}

// Weather delivery shares the observed actor/sample epoch; this purpose has no
// preference reader or writer and never creates a stored weather ledger.
export function captureWeatherReferenceContext(): WeatherReferenceContext | null {
  return capturePreferenceContext('weather-reference') as WeatherReferenceContext | null;
}
export function weatherReferenceContextIsCurrent(context: WeatherReferenceContext | null): boolean {
  return !!context && proofs.get(context)?.purpose === 'weather-reference' && contextIsCurrent(context);
}
export function subscribeWeatherReferenceContext(context: WeatherReferenceContext | null, listener: () => void): () => void {
  return context && proofs.get(context)?.purpose === 'weather-reference' ? subscribeContext(context, listener) : () => {};
}
export function revokeWeatherReferenceContext(context: WeatherReferenceContext | null): void {
  if (context && proofs.get(context)?.purpose === 'weather-reference') revokeContext(context);
}
