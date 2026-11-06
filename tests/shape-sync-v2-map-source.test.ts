import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// SOURCE-STRUCTURE checks on components/Map.tsx. Map.tsx needs React, Mapbox GL and Mapbox Draw,
// none of which run here, so these are NOT behaviour tests: they pin the integration contract the
// behaviour tests (adapter/controller suites) rely on, so a later edit cannot silently re-route a
// farmer action around the adapter. Browser gate G4 still has to prove the runtime behaviour.
// MAP_TSX overrides the file (used to run this suite against the first package as a control).

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.MAP_TSX ?? path.join(here, '..', 'components', 'Map.tsx');
const raw = readFileSync(file, 'utf8');
/** Source with // line comments and {/* … *\/} JSX comments removed, so prose cannot satisfy or trip a check. */
const code = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '') // block comments that start a line (not `accept="image/*"`)
  .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

/** Body of `const name = useCallback(` up to its closing `  }, [` (Map.tsx's 2-space hook indent). */
function hook(name: string): string {
  const start = code.indexOf(`const ${name} = useCallback(`);
  assert.ok(start >= 0, `${name} not found`);
  const end = code.indexOf('\n  }, [', start);
  assert.ok(end > start, `${name} end not found`);
  return code.slice(start, end);
}
/** The onClick handler of the native-edit Undo button. */
function undoHandler(): string {
  const label = code.indexOf("t('nativeEditUndoButton')");
  assert.ok(label > 0, 'native undo button not found');
  const start = code.lastIndexOf('<button onClick={() => {', label);
  return code.slice(start, label);
}

test('no farmer action reaches the v1 whole-collection writer', () => {
  assert.equal((code.match(/\bpushShapes\s*\(/g) ?? []).length, 0);
});

test('recompute is stats-only: no persistence, no push', () => {
  const body = hook('recompute');
  assert.ok(!/localStorage\.setItem|pushShapes|setDoc/.test(body));
});

test('reticle edit lifts the shape through the adapter (presentation-only), never a raw draw.delete', () => {
  const body = hook('startReticleEdit');
  assert.match(body, /beginReticleEdit\(featureId\)/);
  assert.ok(!/draw\.delete\(/.test(body));
  assert.match(body, /if \(!session\) return/);
});

test('reticle Done/Cancel go through the adapter (same id, full feature); no rebuilt `properties: {}` feature', () => {
  for (const name of ['finishReticleEdit', 'cancelReticleEdit']) {
    const body = hook(name);
    assert.match(body, new RegExp(`shapeAdapterRef\\.current\\?\\.${name}\\(reticleSessionRef\\.current`));
    assert.ok(!/draw\.add\(/.test(body), `${name} must not re-add a hand-built feature`);
  }
  assert.ok(!/draw\.add\(\s*\{[^;]*properties:\s*\{\s*\}/.test(code), 'no draw.add of a feature rebuilt with empty properties');
});

test('rename binds to an edit basis captured when the sheet opens and commits through the adapter', () => {
  const body = hook('confirmShapeNaming');
  assert.match(body, /commitPropertyEdit\(edit,/);
  assert.ok(!/setFeatureProperty/.test(body));
});

test('share import is additive and idempotent (importShared), never draw.set(shared)', () => {
  assert.match(code, /importShared\(data\.geojson, code\)/);
  assert.ok(!/draw\.set\(\s*data\.geojson/.test(code));
});

test('native Undo is a typed op on the ACTIVE session only; no untracked draw-store revert', () => {
  const body = undoHandler();
  assert.match(body, /activeNative\(\)/);
  assert.match(body, /nativeUndo\(\)/);
  assert.ok(!/draw\.add\(/.test(body), 'an unrecorded revert would be captured by the next drag as a stale edit');
});

test('every programmatic draw.set is a guarded presentation (adapter ignores it)', () => {
  const sets = [...code.matchAll(/draw\.set\(/g)].map((m) => m.index ?? 0);
  assert.ok(sets.length > 0);
  for (const at of sets) {
    const before = code.slice(Math.max(0, at - 400), at);
    assert.match(before, /applyingRemoteRef\.current = true;[^]*$/, `unguarded draw.set at offset ${at}`);
    assert.ok(before.lastIndexOf('applyingRemoteRef.current = true') > before.lastIndexOf('applyingRemoteRef.current = false'));
  }
});

test('the controller effect is declared BEFORE the account-switch repaint effect', () => {
  const controllerAt = code.indexOf('createShapeSyncController({');
  const switchAt = code.indexOf('shapeAdapterRef.current?.reset();\n    reticleSessionRef.current = null;\n    propertyEditRef.current = null;\n    setEditingFeatureId(null);');
  assert.ok(controllerAt > 0 && switchAt > 0 && controllerAt < switchAt);
});

test('paint source is the controller view (not raw FARM_KEY) whenever a controller exists', () => {
  const body = code.slice(code.indexOf('const readPaintCollection'), code.indexOf('const restoreShapes'));
  assert.match(body, /if \(controller\) return \{ type: 'FeatureCollection', features: controller\.view\(\)\.features \}/);
  for (const name of ['restoreShapes', 'redrawShapesFromStorage']) assert.match(hook(name), /readPaintCollection\(\)/);
});

test('same-account tabs: the storage event re-reads the journal (controller.refresh)', () => {
  assert.match(code, /addEventListener\('storage', onStorage\)/);
  assert.match(code, /controller\.refresh\(\)/);
  assert.match(code, /removeEventListener\('storage', onStorage\)/);
});

test('farmer-facing wording comes only from shapeSyncNotice; the island is never drained by default', () => {
  assert.match(code, /shapeSyncNotice\(shapeSyncStatus\)/);
  assert.ok(!/All map changes synced|change\(s\) syncing/.test(code), 'no hard-coded success text in Map.tsx');
  assert.match(code, /drainLegacyIsland: false/);
});
