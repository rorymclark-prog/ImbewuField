import { activeAccountUid } from './account-local-storage';
import { cropPlanWriteToken, readRawCropPlanReceipt } from './crop-plan';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { isSampleMode } from './sample-mode';
import { designBaseMode, type CanvasFrame, type DesignCanvasState } from './design-canvas';

export interface FieldBlockEditActor { readonly owner: string | null; readonly sample: boolean; readonly loading: boolean }
export interface FieldBlockAllocationRead {
  readonly status: 'known' | 'unknown' | 'denied';
  readonly allocatedIds: readonly string[];
}
interface Binding { actor: FieldBlockEditActor; token: string | null; receiptState: string }
const bindings = new WeakMap<object, Binding>();
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function actorIsCurrent(actor: FieldBlockEditActor): boolean {
  try {
    if (actor.loading || activeAccountUid() !== actor.owner || isSampleMode() !== actor.sample) return false;
    if (actor.sample || !isBackendConfigured()) return true;
    const auth = getFirebase()?.auth;
    return !!auth && (auth.currentUser?.uid ?? null) === actor.owner;
  } catch { return false; }
}
function receiptState(receipt: ReturnType<typeof readRawCropPlanReceipt>): string {
  return receipt.status === 'ready' ? 'ready' : JSON.stringify(receipt.reasons);
}

/** Bed references, not a crop normalizer. A damaged neighbouring row cannot
 * erase an intact allocation, and an unreadable reference is never an empty book. */
export function readFieldBlockAllocations(expected: FieldBlockEditActor): FieldBlockAllocationRead {
  const denied = (): FieldBlockAllocationRead => Object.freeze({ status: 'denied', allocatedIds: Object.freeze([]) });
  if (!actorIsCurrent(expected)) return denied();
  try {
    const actor = Object.freeze({ ...expected }), receipt = readRawCropPlanReceipt(), token = cropPlanWriteToken();
    if (!actorIsCurrent(actor) || receipt.status === 'ready' && token !== receipt.token) return denied();
    const ids = new Set<string>();
    let unknown = receipt.status !== 'ready';
    if (receipt.status === 'ready') {
      const raw = receipt.raw;
      if (!record(raw) || raw.version !== 1 || !Array.isArray(raw.plantings)) unknown = true;
      else for (const row of raw.plantings as unknown[]) {
        // The raw receipt already rejects unsafe descriptors. Keep this check
        // local too so this authority never gains a getter-based reference path.
        const bed = record(row) ? Object.getOwnPropertyDescriptor(row, 'bedId') : undefined;
        if (!bed || !('value' in bed) || typeof bed.value !== 'string' || !bed.value.trim()) unknown = true;
        else {
          ids.add(bed.value);
          if (bed.value !== bed.value.trim() || /[\u0000-\u001f\u007f]/.test(bed.value)) unknown = true;
        }
      }
    }
    const result: FieldBlockAllocationRead = Object.freeze({ status: unknown ? 'unknown' : 'known', allocatedIds: Object.freeze([...ids]) });
    bindings.set(result, { actor, token, receiptState: receiptState(receipt) });
    return fieldBlockAllocationsAreCurrent(result) ? result : denied();
  } catch { return denied(); }
}

export function fieldBlockAllocationsAreCurrent(read: FieldBlockAllocationRead): boolean {
  const binding = bindings.get(read);
  if (!binding || !actorIsCurrent(binding.actor)) return false;
  try {
    const receipt = readRawCropPlanReceipt(), token = cropPlanWriteToken();
    return actorIsCurrent(binding.actor) && token === binding.token && receiptState(receipt) === binding.receiptState
      && (receipt.status !== 'ready' || receipt.token === token);
  } catch { return false; }
}
export function assertFieldBlockAllocationsCurrent(read: FieldBlockAllocationRead): void {
  if (!fieldBlockAllocationsAreCurrent(read)) throw Error('The crop records or account changed. Check them before editing this field.');
}
export function assertFieldBlockLayoutReadable(read: FieldBlockAllocationRead): void {
  assertFieldBlockAllocationsCurrent(read);
  if (read.status !== 'known') throw Error('Check the unresolved crop records before changing a field layout.');
}

/** Unknown books protect existing field ground while leaving an unrelated house,
 * label or other non-field edit possible. Explicit regeneration stays held. */
export function fieldBlockAllocatedIds(read: FieldBlockAllocationRead, state: DesignCanvasState): ReadonlySet<string> {
  assertFieldBlockAllocationsCurrent(read);
  const ids = new Set(read.allocatedIds);
  if (read.status === 'unknown') {
    for (const zone of state.zones) if (zone.feature === 'staple_garden' || zone.fieldBlock) ids.add(zone.id);
    for (const item of state.items) if (item.fieldBlockId) { ids.add(item.id); ids.add(item.fieldBlockId); }
  }
  return ids;
}

/** One source identity for the panel and the queued parent updater. Revisions,
 * timestamps and imagery do not change these dimensions or exclusion footprints. */
export function fieldBlockSourceKey(state: DesignCanvasState, selectedId: string | null, frame: CanvasFrame): string {
  const selected = state.zones.find(zone => zone.feature === 'staple_garden' && (zone.id === selectedId
    || state.items.some(item => item.id === selectedId && item.fieldBlockId === zone.id)));
  const source = [state.siteId,
    selected ? { id: selected.id, name: selected.name, points: selected.points, fieldBlock: selected.fieldBlock } : null,
    { centerLat: frame.centerLat, centerLng: frame.centerLng, zoom: frame.zoom, imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx },
    // Saved calibration can change before React's live frame catches up. Bind
    // its existing metadata as well; do not invent a second scale calculation.
    { baseMode: designBaseMode(state), scaleFactor: state.scaleFactor, blankMPerPx: state.blankMPerPx,
      savedFrame: { centerLat: state.frame.centerLat, centerLng: state.frame.centerLng, zoom: state.frame.zoom,
        imgW: state.frame.imgW, imgH: state.frame.imgH, mPerPx: state.frame.mPerPx },
      customBase: state.customBase ? { mPerPx: state.customBase.mPerPx, scale: state.customBase.scale } : null },
    state.items.map(item => ({ id: item.id, defId: item.defId, fieldBlockId: item.fieldBlockId,
      x: item.x, y: item.y, wM: item.wM, hM: item.hM, rot: item.rot })),
    state.zones.filter(zone => zone.id !== selected?.id && (zone.feature === 'staple_garden'
      || ['house', 'patio', 'driveway'].includes(zone.feature ?? '')))
      .map(zone => ({ id: zone.id, feature: zone.feature, points: zone.points })),
  ];
  return JSON.stringify(source, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
