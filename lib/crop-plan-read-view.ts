'use client';

import { activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { CROP_PLAN_CHANGED_EVENT, cropPlanWriteToken, readRawCropPlanReceipt } from './crop-plan';
import { CROP_PLAN_STORAGE_EVENT, makeBrowserCropPlanStorageContext, readCropPlanStorageView,
  cropPlanStorageReadReceiptIsCurrent, releaseCropPlanStorageReadReceipt,
  type CropPlanStorageReadReceipt } from './crop-plan-storage';
import { isSampleMode } from './sample-mode';
import { rawJsonIsLossless } from './lossless-json';
import { captureProjectHarvestReadContext, projectHarvestReadContextIsCurrent, revokeProjectHarvestReadContext,
  subscribeProjectHarvestReadContext, type ProjectHarvestReadContext } from './length-unit-preference';

export type RawCropPlanReadView =
  | { readonly status: 'ready'; readonly raw: unknown; readonly sample: boolean }
  | { readonly status: 'held'; readonly reasons: readonly string[] };
type ReadyView = Extract<RawCropPlanReadView, { status: 'ready' }>;
interface Proof {
  readonly context: ProjectHarvestReadContext;
  readonly owner: string | null;
  readonly sample: boolean;
  readonly storageReceipt: CropPlanStorageReadReceipt | null;
  readonly sampleToken: string | null;
  stop: () => void;
  checking: boolean;
}
const proofs = new WeakMap<object, Proof>();
const heldView = (reason: string): RawCropPlanReadView => Object.freeze({ status: 'held', reasons: Object.freeze([reason]) });
function actorCurrent(proof: Pick<Proof, 'owner' | 'sample' | 'context'>): boolean {
  try {
    if (!projectHarvestReadContextIsCurrent(proof.context) || isSampleMode() !== proof.sample
      || activeAccountUid() !== proof.owner) return false;
    return proof.sample || !!proof.owner && isBackendConfigured() && getFirebase()?.auth.currentUser?.uid === proof.owner;
  } catch { return false; }
}
function freezeRaw(value: unknown): unknown {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeRaw(child); Object.freeze(value); }
  return value;
}

/** Read-only raw evidence, never display normalization, writer admission or a
 * permission to share. Parsed copies are frozen; the source book is untouched. */
export function readRawCropPlanReadView(): RawCropPlanReadView {
  let context: ProjectHarvestReadContext | null = null, receipt: CropPlanStorageReadReceipt | null = null, view: ReadyView | null = null;
  try {
    const sample = isSampleMode(), owner = activeAccountUid();
    if (!sample && (!owner || !isBackendConfigured() || getFirebase()?.auth.currentUser?.uid !== owner)) return heldView('actor-unavailable');
    context = captureProjectHarvestReadContext();
    if (!context || !actorCurrent({ context, owner, sample })) { revokeProjectHarvestReadContext(context); return heldView('actor-changed'); }
    let raw: unknown, sampleToken: string | null = null;
    const storageContext = makeBrowserCropPlanStorageContext();
    if (!storageContext) { revokeProjectHarvestReadContext(context); return heldView('storage-unavailable'); }
    if (sample) {
      // The sample authority preserves its own marker and optional-field rules.
      // This wrapper must not invent a second sample book or token format.
      const source = readRawCropPlanReceipt();
      if (source.status !== 'ready') { revokeProjectHarvestReadContext(context); return heldView('sample-source-unavailable'); }
      raw = source.raw; sampleToken = source.token;
      if (cropPlanWriteToken() !== sampleToken) { revokeProjectHarvestReadContext(context); return heldView('source-changed'); }
    } else {
      const source = readCropPlanStorageView(storageContext);
      if (source.status !== 'ready') { revokeProjectHarvestReadContext(context); return heldView(source.reason); }
      receipt = source.receipt;
      if (!rawJsonIsLossless(source.bookRaw)) {
        releaseCropPlanStorageReadReceipt(receipt); revokeProjectHarvestReadContext(context); return heldView('book-not-lossless');
      }
      raw = JSON.parse(source.bookRaw);
    }
    if (!actorCurrent({ context, owner, sample })) {
      releaseCropPlanStorageReadReceipt(receipt); revokeProjectHarvestReadContext(context); return heldView('actor-changed');
    }
    view = Object.freeze({ status: 'ready', raw: freezeRaw(raw), sample });
    const proof: Proof = { context, owner, sample, storageReceipt: receipt, sampleToken, stop: () => {}, checking: false };
    proofs.set(view, proof);
    const win = window, withdraw = () => releaseRawCropPlanReadView(view);
    const stopActor = subscribeProjectHarvestReadContext(context, withdraw);
    const storageChanged = (event: StorageEvent) => {
      if (!event.key || [storageContext.canonicalKey, storageContext.receiptKey, storageContext.legacyKey].includes(event.key)) withdraw();
    };
    proof.stop = () => {
      stopActor();
      win.removeEventListener(CROP_PLAN_CHANGED_EVENT, withdraw);
      win.removeEventListener(CROP_PLAN_STORAGE_EVENT, withdraw);
      win.removeEventListener('storage', storageChanged);
      win.removeEventListener('pagehide', withdraw);
    };
    win.addEventListener(CROP_PLAN_CHANGED_EVENT, withdraw);
    win.addEventListener(CROP_PLAN_STORAGE_EVENT, withdraw);
    win.addEventListener('storage', storageChanged);
    win.addEventListener('pagehide', withdraw);
    if (!rawCropPlanReadViewIsCurrent(view)) return heldView('source-changed');
    return view;
  } catch {
    if (view) releaseRawCropPlanReadView(view);
    else { releaseCropPlanStorageReadReceipt(receipt); revokeProjectHarvestReadContext(context); }
    return heldView('book-unreadable');
  }
}

/** A cloned object cannot adopt another view's private actor or source proof. */
export function rawCropPlanReadViewIsCurrent(view: unknown): view is ReadyView {
  const proof = view && typeof view === 'object' ? proofs.get(view) : null;
  if (!proof) return false;
  if (proof.checking) { releaseRawCropPlanReadView(view); return false; }
  let current = false;
  proof.checking = true;
  try {
    current = actorCurrent(proof) && (proof.sample ? cropPlanWriteToken() === proof.sampleToken
      : cropPlanStorageReadReceiptIsCurrent(proof.storageReceipt)) && actorCurrent(proof)
      && proofs.get(view as object) === proof;
  } catch { /* Unreadable source evidence withdraws permanently. */ }
  finally { proof.checking = false; }
  if (!current) releaseRawCropPlanReadView(view);
  return current;
}
export function releaseRawCropPlanReadView(view: unknown): void {
  const proof = view && typeof view === 'object' ? proofs.get(view) : null;
  if (!proof) return;
  proofs.delete(view as object); proof.stop();
  releaseCropPlanStorageReadReceipt(proof.storageReceipt); revokeProjectHarvestReadContext(proof.context);
}
