import { activeAccountUid } from './account-local-storage';
import { readCanvasSourceReceipt, DESIGN_CANVAS_CHANGED_EVENT, type CanvasFrame, type DesignCanvasState } from './design-canvas';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { isSampleMode } from './sample-mode';
import { deliverFile } from './file-delivery';
import { buildFieldLayoutKml } from './field-layout-export';
import { captureFieldLayoutExportContext, fieldLayoutExportContextIsCurrent, revokeFieldLayoutExportContext } from './length-unit-preference';

export interface FieldLayoutDeliveryActor { readonly owner: string | null; readonly sample: boolean; readonly loading: boolean }
export interface FieldLayoutDeliveryResult {
  readonly status: 'downloaded' | 'shared' | 'cancelled' | 'held';
  readonly message: string;
}
export interface FieldLayoutDeliveryOptions {
  readonly state: DesignCanvasState;
  readonly frame: CanvasFrame;
  readonly actor: FieldLayoutDeliveryActor;
  readonly selection: { readonly kind: 'all' } | { readonly kind: 'selected'; readonly fieldId: string };
  readonly includeLabels: boolean;
  /** Both the mounted parent and the requesting form can withdraw this action. */
  readonly isCurrent: () => boolean;
}

const changed = (): FieldLayoutDeliveryResult => ({ status: 'held',
  message: 'The field layout, account or export choices changed. Check the current layout before exporting again.' });
const sourceUnavailable = (): FieldLayoutDeliveryResult => ({ status: 'held',
  message: 'The current field layout is not available in this account’s saved design. Save the layout before exporting.' });
function actorCurrent(actor: FieldLayoutDeliveryActor): boolean {
  try {
    return !actor.loading && activeAccountUid() === actor.owner && isSampleMode() === actor.sample
      && (actor.sample || !isBackendConfigured() || (getFirebase()?.auth.currentUser?.uid ?? null) === actor.owner);
  } catch { return false; }
}

/** A file is prepared from the same saved source the user can currently see.
 * The geometry kernel does not grant an arbitrary imported DTO file authority.
 * No record, crop allocation, rendered measurement or source byte is written. */
export async function deliverFieldLayoutExport(options: FieldLayoutDeliveryOptions): Promise<FieldLayoutDeliveryResult> {
  const context = captureFieldLayoutExportContext();
  let sourceChanged = false, win: Window | null = null;
  const withdraw = () => { sourceChanged = true; };
  const currentActor = () => {
    try {
      return !sourceChanged && fieldLayoutExportContextIsCurrent(context) && actorCurrent(options.actor) && options.isCurrent();
    } catch { return false; }
  };
  try {
    if (!currentActor()) return changed();
    win = window;
    win.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, withdraw);
    const expected = buildFieldLayoutKml({ rawState: options.state, effectiveFrame: options.frame,
      selection: options.selection, includeLabels: options.includeLabels, sample: options.actor.sample });
    if (!currentActor()) return changed();
    if (expected.status !== 'ready') return { status: 'held', message: fieldLayoutHoldText(expected.reasons) };

    const receipt = readCanvasSourceReceipt(options.state.siteId);
    if (!currentActor()) return changed();
    if (receipt.status !== 'ready' || receipt.ownerUid !== options.actor.owner || receipt.sample !== options.actor.sample) return sourceUnavailable();
    const saved = buildFieldLayoutKml({ rawState: receipt.raw, effectiveFrame: options.frame,
      selection: options.selection, includeLabels: options.includeLabels, sample: options.actor.sample });
    if (!currentActor()) return changed();
    if (saved.status !== 'ready' || saved.sourceKey !== expected.sourceKey) return sourceUnavailable();

    const revision = receipt.revision;
    const current = () => {
      if (!currentActor()) return false;
      const fresh = readCanvasSourceReceipt(options.state.siteId);
      return currentActor() && fresh.status === 'ready' && fresh.ownerUid === options.actor.owner
        && fresh.sample === options.actor.sample && fresh.revision === revision;
    };
    if (!current()) return changed();
    const blob = new Blob([saved.kml], { type: saved.mimeType });
    const name = `ImbewuField${options.actor.sample ? '-DEMO' : ''}-field-layout.kml`;
    const result = await deliverFile(blob, name, options.actor.sample ? 'DEMO field layout' : 'Field layout', current);
    // A successful share is already in the user's chosen destination. The form
    // suppresses a late message when withdrawn; it cannot undo that user action.
    if (result === 'cancelled') return { status: 'cancelled', message: 'Field-layout export cancelled.' };
    return { status: result, message: result === 'shared'
      ? 'Field-layout KML shared. It contains map-reference locations, not surveyed boundaries.'
      : 'Field-layout KML downloaded. It contains map-reference locations, not surveyed boundaries.' };
  } catch {
    return { status: 'held', message: 'The field layout could not be exported. Check the current saved layout and try again.' };
  } finally {
    try { win?.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, withdraw); } catch { /* Release the epoch proof even if an optional observer fails. */ }
    revokeFieldLayoutExportContext(context);
  }
}

export function fieldLayoutHoldText(reasons: readonly string[]): string {
  const reason = reasons.join(' ');
  if (/work-limit/.test(reason)) return 'This saved layout exceeds the current KML export limit.';
  if (/photo|blank|base/.test(reason)) return 'Photo and blank layouts need a verified map reference before Google Earth export.';
  if (/antimeridian|longitude/.test(reason)) return 'This layout crosses the map’s date-line reference, which this export does not yet support.';
  if (/frame|calibr|scale/.test(reason)) return 'The saved map reference and current measurements do not match. Check and save the current layout before exporting.';
  if (/selected|selection|field-missing|no-fields/.test(reason)) return 'Select a saved field, or choose all saved fields, before exporting.';
  return 'A saved field, bed or path is incomplete or ambiguous. Check the layout before exporting.';
}
