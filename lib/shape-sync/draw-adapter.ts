// Shape sync v2 ↔ Mapbox Draw adapter.
//
// Map.tsx's draw store is PRESENTATION. Nothing read from it is ever pushed as a snapshot. Each
// farmer action reaches the controller here as one typed intent, and every presentation-only
// mutation (remote paint, reticle lift, teardown) produces no op at all:
//
//   farmer action                         → op                     identity
//   ─────────────────────────────────────────────────────────────────────────────────────────
//   reticle Finish (new shape)            → create 'reticle-create' fresh shp-… id, set on Feature.id
//   native draw.create (defensive)        → create 'draw-create'   Draw's own id
//   reticle Edit START                    → (none) draft lift      —
//   reticle Done                          → update 'reticle-done'  SAME id; all props + holes kept
//   reticle Cancel / Escape               → (none) exact original  SAME id, byte-identical
//   native vertex drag / move             → update 'native-edit'   SAME id
//   native Undo                           → update 'native-undo'   SAME id (reverts own session)
//   rename sheet Save                     → update 'rename'        SAME id (also during reticle)
//   🗑 confirm / clearType                → delete per id          tombstone, own baseRev each
//   Backspace/Delete in Draw (draw.delete)→ delete 'keyboard-delete'
//   remote paint / account switch / unmount → (none)              isPresentation() guard
//
// Each edit SESSION captures its basis (server rev + own deps + content) when it STARTS, because
// Map.tsx defers remote redraws for the session's duration: the farmer edits what they see, so the
// op must claim exactly that base — never one that silently includes remote changes they never saw.
//
// The adapter depends only on the DrawLike subset below, so it is testable without mapbox-gl.
// That the real @mapbox/mapbox-gl-draw honours explicit string ids in add() and fires no events for
// programmatic add/delete/set/changeMode is an ASSUMPTION verified only in the browser gate (GATES.md).

import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import type { EditBasis, RecordResult, ShapeSyncController } from './controller';
import { cloneJson, type Json, type OpSource } from './protocol';

export interface DrawLike {
  getAll(): FeatureCollection;
  get(id: string): Feature | undefined;
  add(geojson: Feature | FeatureCollection): string[];
  delete(ids: string | string[]): unknown;
  setFeatureProperty(id: string, property: string, value: unknown): unknown;
}

export interface ReticleSession { kind: 'reticle'; shapeId: string; original: Feature; basis: EditBasis; active: boolean }
export interface NativeSession { kind: 'native'; shapeId: string; backup: Feature; basis: EditBasis; active: boolean }
export interface PropertyEdit { shapeId: string; basis: EditBasis; reticle: ReticleSession | null }

export interface DrawShapeAdapterOptions {
  getController: () => ShapeSyncController | null;
  getDraw: () => DrawLike | null;
  /** True while Map.tsx paints remote state (applyingRemoteRef) or tears down (tearingDownRef). */
  isPresentation: () => boolean;
  newShapeId: () => string;
  onRecordFailure?: (result: RecordResult, context: string) => void;
}

export interface DrawShapeAdapter {
  addNewShape(feature: Feature, source?: OpSource): string | null;
  recordDrawCreate(ids: readonly string[]): void;
  recordDrawUpdate(features: readonly Feature[]): void;
  recordDrawDelete(features: readonly Feature[]): void;
  deleteShapes(ids: readonly string[], source: OpSource): RecordResult | null;
  beginReticleEdit(shapeId: string): ReticleSession | null;
  finishReticleEdit(session: ReticleSession | null, openRing: readonly Position[], defaults?: Record<string, Json>): string | null;
  cancelReticleEdit(session: ReticleSession | null): void;
  beginNativeEdit(shapeId: string): NativeSession | null;
  endNativeEdit(): void;
  nativeUndo(): boolean;
  beginPropertyEdit(shapeId: string): PropertyEdit | null;
  commitPropertyEdit(edit: PropertyEdit | null, props: Record<string, Json | undefined>): RecordResult | null;
  activeReticle(): ReticleSession | null;
  activeNative(): NativeSession | null;
  /** Account switch / unmount: drop draft sessions. Draft state belongs to the old owner; no op. */
  reset(): void;
}

export function createDrawShapeAdapter(opts: DrawShapeAdapterOptions): DrawShapeAdapter {
  let reticle: ReticleSession | null = null;
  let native: NativeSession | null = null;

  const report = (result: RecordResult | null | undefined, context: string) => {
    if (result && !result.ok) opts.onRecordFailure?.(result, context);
    return result ?? null;
  };

  function addNewShape(feature: Feature, source: OpSource = 'reticle-create'): string | null {
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!draw || !controller) return null;
    const id = opts.newShapeId();
    const withId = { ...cloneJson(feature), id } as Feature;
    let added: string[] = [];
    try { added = draw.add(withId); } catch { return null; }
    const actualId = added?.[0] != null ? String(added[0]) : id;
    report(controller.create(draw.get(actualId) ?? { ...withId, id: actualId }, source), 'add');
    return actualId;
  }

  function recordDrawCreate(ids: readonly string[]): void {
    if (opts.isPresentation()) return;
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!draw || !controller) return;
    for (const id of ids) {
      const feature = draw.get(id);
      if (!feature) continue;
      const result = controller.create(feature, 'draw-create');
      if (!result.ok && result.reason !== 'id-in-use') report(result, 'draw.create');
    }
  }

  function recordDrawUpdate(features: readonly Feature[]): void {
    if (opts.isPresentation()) return;
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!draw || !controller) return;
    for (const event of features) {
      if (event?.id == null) continue;
      const id = String(event.id);
      const current = draw.get(id) ?? event;
      const basis = native?.active && native.shapeId === id ? native.basis : controller.captureBasis(id);
      if (!basis) continue;
      report(controller.update(basis, current, 'native-edit'), 'draw.update');
    }
  }

  function recordDrawDelete(features: readonly Feature[]): void {
    if (opts.isPresentation()) return;
    const controller = opts.getController();
    if (!controller) return;
    const ids = features.filter((f) => f?.id != null).map((f) => String(f.id));
    const bases = new Map<string, EditBasis>();
    if (native?.active && ids.includes(native.shapeId)) { bases.set(native.shapeId, native.basis); native.active = false; native = null; }
    if (ids.length) report(controller.remove(ids, 'keyboard-delete', bases), 'draw.delete');
  }

  function deleteShapes(ids: readonly string[], source: OpSource): RecordResult | null {
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!controller || ids.length === 0) return null;
    const bases = new Map<string, EditBasis>();
    if (native?.active && ids.includes(native.shapeId)) { bases.set(native.shapeId, native.basis); native.active = false; native = null; }
    if (reticle?.active && ids.includes(reticle.shapeId)) { bases.set(reticle.shapeId, reticle.basis); reticle.active = false; reticle = null; }
    try { draw?.delete([...ids]); } catch { /* presentation only; the op below is what counts */ }
    return report(controller.remove(ids, source, bases), 'delete');
  }

  function beginReticleEdit(shapeId: string): ReticleSession | null {
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!draw || !controller) return null;
    const feature = draw.get(shapeId);
    const basis = controller.captureBasis(shapeId);
    if (!feature || !basis) return null;
    reticle = { kind: 'reticle', shapeId, original: cloneJson(feature), basis, active: true };
    // Lift the shape out of the draw store so the reticle overlay owns it. Presentation only: the
    // controller is not told, so this can never become a tombstone (v1 bug: a recompute() during
    // the edit — e.g. Rename — pushed the store WITHOUT this shape, deleting it remotely).
    try { draw.delete(shapeId); } catch { /* already absent */ }
    return reticle;
  }

  function finishReticleEdit(session: ReticleSession | null, openRing: readonly Position[], defaults: Record<string, Json> = {}): string | null {
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!session?.active || !draw || !controller || openRing.length < 3) return null;
    const ring = [...openRing.map((c) => [c[0], c[1]]), [openRing[0][0], openRing[0][1]]];
    const original = session.original;
    // Keep every inner ring (hole) — v1 rebuilt the feature from the outer ring alone.
    const holes = original.geometry?.type === 'Polygon' ? (original.geometry as Polygon).coordinates.slice(1) : [];
    const properties: Record<string, unknown> = { ...(original.properties ?? {}) };
    // Mirrors v1's `snap?.siteId ?? activeSiteId`: only a missing/null property takes the default.
    for (const [key, value] of Object.entries(defaults)) if (properties[key] === undefined || properties[key] === null) properties[key] = value;
    const edited = { ...cloneJson(original), properties, geometry: { type: 'Polygon', coordinates: [ring, ...holes] } } as Feature;
    session.active = false;
    if (reticle === session) reticle = null;
    try { draw.add(edited); } catch { return null; }
    report(controller.update(session.basis, draw.get(session.shapeId) ?? edited, 'reticle-done'), 'reticle-done');
    return session.shapeId;
  }

  function cancelReticleEdit(session: ReticleSession | null): void {
    const draw = opts.getDraw();
    if (!session?.active) return;
    session.active = false;
    if (reticle === session) reticle = null;
    // Put back EXACTLY what was lifted: same id, every property, original geometry. No op.
    try { draw?.add(cloneJson(session.original)); } catch { /* the controller view still has it; next redraw restores */ }
  }

  function beginNativeEdit(shapeId: string): NativeSession | null {
    if (native?.active && native.shapeId === shapeId) return native;
    endNativeEdit();
    const draw = opts.getDraw();
    const controller = opts.getController();
    const feature = draw?.get(shapeId);
    const basis = controller?.captureBasis(shapeId) ?? null;
    if (!feature || !basis) return null;
    native = { kind: 'native', shapeId, backup: cloneJson(feature), basis, active: true };
    return native;
  }

  function endNativeEdit(): void {
    if (native) native.active = false;
    native = null;
  }

  function nativeUndo(): boolean {
    const draw = opts.getDraw();
    const controller = opts.getController();
    if (!native?.active || !draw || !controller) return false;
    const { shapeId, backup, basis } = native;
    try { draw.delete(shapeId); draw.add(cloneJson(backup)); } catch { return false; }
    // Reverts this session's own changes; fields changed by another device meanwhile are not in
    // the session's deps, so reverting over them opens a conflict branch instead of erasing them.
    report(controller.update(basis, draw.get(shapeId) ?? backup, 'native-undo'), 'native-undo');
    return true;
  }

  function beginPropertyEdit(shapeId: string): PropertyEdit | null {
    if (reticle?.active && reticle.shapeId === shapeId) return { shapeId, basis: reticle.basis, reticle };
    if (native?.active && native.shapeId === shapeId) return { shapeId, basis: native.basis, reticle: null };
    const basis = opts.getController()?.captureBasis(shapeId) ?? null;
    return basis ? { shapeId, basis, reticle: null } : null;
  }

  function commitPropertyEdit(edit: PropertyEdit | null, props: Record<string, Json | undefined>): RecordResult | null {
    const controller = opts.getController();
    if (!edit || !controller) return null;
    if (edit.reticle) {
      if (!edit.reticle.active) return null;
      // The shape is lifted out of the draw store: apply to the session copy, so Done AND Cancel
      // both put it back with the new name, and record the rename now as its own op.
      const nextProps: Record<string, unknown> = { ...(edit.reticle.original.properties ?? {}) };
      for (const [key, value] of Object.entries(props)) { if (value === undefined) delete nextProps[key]; else nextProps[key] = value; }
      edit.reticle.original = { ...edit.reticle.original, properties: nextProps } as Feature;
      return report(controller.update(edit.basis, edit.reticle.original, 'rename'), 'rename');
    }
    const draw = opts.getDraw();
    const inStore = draw?.get(edit.shapeId);
    let after: Feature | null = null;
    if (draw && inStore) {
      for (const [key, value] of Object.entries(props)) {
        try { draw.setFeatureProperty(edit.shapeId, key, value); } catch { /* presentation */ }
      }
      after = draw.get(edit.shapeId) ?? null;
    }
    if (!after) {
      const base = controller.feature(edit.shapeId);
      if (!base) return null;
      const nextProps: Record<string, unknown> = { ...(base.properties ?? {}) };
      for (const [key, value] of Object.entries(props)) { if (value === undefined) delete nextProps[key]; else nextProps[key] = value; }
      after = { ...base, properties: nextProps } as Feature;
    }
    return report(controller.update(edit.basis, after, 'rename'), 'rename');
  }

  return {
    addNewShape, recordDrawCreate, recordDrawUpdate, recordDrawDelete, deleteShapes,
    beginReticleEdit, finishReticleEdit, cancelReticleEdit,
    beginNativeEdit, endNativeEdit, nativeUndo,
    beginPropertyEdit, commitPropertyEdit,
    activeReticle: () => (reticle?.active ? reticle : null),
    activeNative: () => (native?.active ? native : null),
    reset: () => { if (reticle) reticle.active = false; if (native) native.active = false; reticle = null; native = null; },
  };
}
