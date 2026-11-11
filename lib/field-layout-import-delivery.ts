import { activeAccountUid } from './account-local-storage';
import { getFirebase, isBackendConfigured } from './firebase/init';
import { isSampleMode } from './sample-mode';
import { readCanvasSourceReceipt, DESIGN_CANVAS_CHANGED_EVENT, type DesignCanvasState, type CanvasFrame } from './design-canvas';
import { readFieldBlockAllocations, assertFieldBlockLayoutReadable, assertFieldBlockAllocationsCurrent } from './field-block-allocations';
import { captureFieldLayoutImportContext, fieldLayoutImportContextIsCurrent, revokeFieldLayoutImportContext } from './length-unit-preference';
import { inspectFieldLayoutMapSource } from './field-layout-export';
import { parseFieldLayoutKml, KML_PARSER_LIMITS } from './field-layout-kml-parser';
import { inspectFieldLayoutImport, appendFieldLayoutImport } from './field-layout-import';
import type { FieldImportPanelResult, FieldImportPanelReview } from '../components/design/FieldLayoutImportPanel';

export interface FieldImportActor { readonly owner: string | null; readonly sample: boolean; readonly loading: boolean }
export interface FieldImportReadOptions {
  readonly state: DesignCanvasState; readonly frame: CanvasFrame; readonly actor: FieldImportActor;
  readonly file: Pick<File, 'size' | 'text'>;
  /** Captured before reading local bytes; a late file cannot adopt a new account. */
  readonly isCurrent: () => boolean;
  readonly formIsCurrent: () => boolean;
}
export interface FieldImportAppendAction {
  apply: (state: DesignCanvasState, frame: CanvasFrame) => DesignCanvasState;
  written: (state: DesignCanvasState) => void;
  failed: () => void;
}
const bindings = new WeakMap<FieldImportPanelReview, { release: () => void;
  begin: (ids: readonly string[], createId: () => string, formCurrent: () => boolean) => FieldImportAppendAction }>();
const changed = () => Error('The saved design, crop records or account changed. Read the KML again before adding fields.');
const held = (message: string): FieldImportPanelResult => ({ status: 'held', message });
function readableParseHold(reason: string): string {
  if (/DOCTYPE|entity|CDATA|comment|construct|processing instruction/i.test(reason))
    return 'This file includes embedded content that the importer does not support. Export a plain polygon KML file.';
  if (/namespace|root element/i.test(reason)) return 'Choose a KML 2.2 file containing field polygons.';
  if (/limit|length|count|depth/i.test(reason)) return 'This file is too large or complex for the current importer. Export fewer, simpler field outlines.';
  if (/No supported polygon/i.test(reason)) return 'No simple field outlines could be read. Export closed polygons without holes.';
  return 'This file could not be read as a field-polygon KML. Check it in your map editor and export it again.';
}
function readableGeometryHold(reason: string): string {
  if (reason === 'existing-ground-overlap') return 'This outline overlaps a saved field or placed element.';
  if (reason === 'outside-canvas') return 'This outline is outside the current map. Open the matching map before importing.';
  if (/antimeridian|mercator|latitude/.test(reason)) return 'This outline crosses a map-projection boundary that the importer does not yet support.';
  return 'This outline needs checking in the map editor before it can be added.';
}
function actorCurrent(actor: FieldImportActor): boolean {
  try { return !actor.loading && activeAccountUid() === actor.owner && isSampleMode() === actor.sample
    && (actor.sample || !isBackendConfigured() || (getFirebase()?.auth.currentUser?.uid ?? null) === actor.owner); }
  catch { return false; }
}

/** A proposal holds the original actor, raw source and book through the file await.
 * No parsed node is inserted into the DOM; this function never saves a record. */
export async function readFieldLayoutImportFile(options: FieldImportReadOptions): Promise<FieldImportPanelResult> {
  const context = captureFieldLayoutImportContext();
  let released = false, withdrawn = false, writing = false, retained = false;
  let win: Window | null = null;
  const sourceEvent = () => { if (!writing) withdrawn = true; };
  const release = () => {
    if (released) return;
    released = true; win?.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, sourceEvent); revokeFieldLayoutImportContext(context);
  };
  const currentActor = () => {
    try { return !released && !withdrawn && fieldLayoutImportContextIsCurrent(context) && actorCurrent(options.actor) && options.isCurrent(); }
    catch { return false; }
  };
  try {
    if (!currentActor() || !options.formIsCurrent()) return held(changed().message);
    win = window; win.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, sourceEvent);
    if (!Number.isFinite(options.file.size) || options.file.size <= 0 || options.file.size > KML_PARSER_LIMITS.maxUtf16Chars)
      return held('Choose a nonempty KML file up to 1 MB.');
    const rendered = inspectFieldLayoutMapSource({ rawState: options.state, effectiveFrame: options.frame });
    if (rendered.status !== 'ready') return held('Use a saved map with a matching scale before importing field outlines.');
    const source = readCanvasSourceReceipt(options.state.siteId);
    if (!currentActor() || source.status !== 'ready' || source.ownerUid !== options.actor.owner || source.sample !== options.actor.sample)
      return held('Save the current map in this account before importing fields.');
    const saved = inspectFieldLayoutMapSource({ rawState: source.raw, effectiveFrame: options.frame });
    if (saved.status !== 'ready' || saved.sourceKey !== rendered.sourceKey)
      return held('The visible map differs from its saved copy. Save it before importing.');
    const allocations = readFieldBlockAllocations(options.actor);
    try { assertFieldBlockLayoutReadable(allocations); }
    catch { return held('The crop records need checking. Open the crop planner before changing field ground.'); }
    let ownReceipt: string | null = null;
    const sourceCurrent = () => {
      if (!currentActor()) return false;
      try {
        assertFieldBlockAllocationsCurrent(allocations);
        const fresh = readCanvasSourceReceipt(options.state.siteId);
        return currentActor() && fresh.status === 'ready' && fresh.ownerUid === source.ownerUid && fresh.sample === source.sample
          && fresh.revision === (ownReceipt ?? source.revision);
      } catch { return false; }
    };
    if (!sourceCurrent() || !options.formIsCurrent()) return held(changed().message);
    const text = await options.file.text();
    if (!sourceCurrent() || !options.formIsCurrent()) return held(changed().message);
    const parsed = parseFieldLayoutKml(text);
    if (parsed.status !== 'parsed') return held(readableParseHold(parsed.reason));
    const inspection = inspectFieldLayoutImport({ rawState: source.raw, effectiveFrame: options.frame, parsed });
    if (!sourceCurrent() || !options.formIsCurrent()) return held(changed().message);
    if (inspection.status !== 'inspected') return held('The outlines cannot be placed on this map. Check its reference and scale.');
    const review: FieldImportPanelReview = Object.freeze({ status: 'review', candidates: Object.freeze(inspection.candidates.map(candidate =>
      candidate.status === 'ready' ? candidate : Object.freeze({ ...candidate, reasons: Object.freeze(candidate.reasons.map(readableGeometryHold)) }))),
      excludedPlacemarkCount: inspection.excludedPlacemarkCount });
    let used = false;
    bindings.set(review, { release, begin(ids, createId, formCurrent) {
      if (used || !sourceCurrent() || !options.formIsCurrent() || !formCurrent()) throw changed();
      used = true;
      const selected = ids.map(candidateId => ({ candidateId, zoneId: createId() }));
      let resultKey: string | null = null;
      let originalResult: DesignCanvasState | null = null;
      const originalKey = inspection.sourceKey;
      return {
        apply(state, frame) {
          if (!sourceCurrent() || !ownReceipt && (!options.formIsCurrent() || !formCurrent())) throw changed();
          const actual = inspectFieldLayoutMapSource({ rawState: state, effectiveFrame: frame });
          if (actual.status !== 'ready') throw changed();
          // A returned-state replay still checks the current actor, book, saved
          // bytes and frame before recognizing this action's exact own result.
          if (resultKey && actual.sourceKey === resultKey) return state;
          if (actual.sourceKey !== originalKey) throw changed();
          if (ownReceipt && originalResult) return originalResult;
          const appended = appendFieldLayoutImport({ rawState: state, effectiveFrame: frame, parsed,
            expectedSourceKey: originalKey, selections: selected });
          if (appended.status !== 'ready') throw Error('Select distinct outlines that do not overlap saved fields or placed elements.');
          if (!sourceCurrent() || !formCurrent()) throw changed();
          const after = inspectFieldLayoutMapSource({ rawState: appended.state, effectiveFrame: frame });
          if (after.status !== 'ready') throw changed();
          resultKey = after.sourceKey;
          originalResult = appended.state;
          // The following synchronous parent save may advance only this receipt.
          // Events outside that write irreversibly withdraw the proposal.
          writing = true;
          return appended.state;
        },
        written(state) {
          try {
            assertFieldBlockAllocationsCurrent(allocations);
            const actual = inspectFieldLayoutMapSource({ rawState: state, effectiveFrame: options.frame });
            const receipt = readCanvasSourceReceipt(state.siteId);
            if (!currentActor() || !formCurrent() || !resultKey || actual.status !== 'ready' || actual.sourceKey !== resultKey
              || receipt.status !== 'ready' || receipt.ownerUid !== source.ownerUid || receipt.sample !== source.sample) throw changed();
            const fresh = inspectFieldLayoutMapSource({ rawState: receipt.raw, effectiveFrame: options.frame });
            if (fresh.status !== 'ready' || fresh.sourceKey !== resultKey) throw changed();
            assertFieldBlockAllocationsCurrent(allocations);
            ownReceipt = receipt.revision;
          } finally { writing = false; }
        },
        failed() { writing = false; release(); },
      };
    } });
    retained = true;
    return review;
  } catch { return held('The KML could not be reviewed. No field outlines were added.'); }
  finally { if (!retained) release(); }
}

export function discardFieldLayoutImport(review: FieldImportPanelReview): void {
  bindings.get(review)?.release(); bindings.delete(review);
}
export function beginFieldLayoutImportAppend(review: FieldImportPanelReview, ids: readonly string[], createId: () => string,
  formCurrent: () => boolean): FieldImportAppendAction {
  const binding = bindings.get(review);
  if (!binding) throw changed();
  return binding.begin(ids, createId, formCurrent);
}
