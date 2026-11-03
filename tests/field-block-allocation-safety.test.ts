import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import ts from 'typescript';
import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import type { CanvasFrame, DesignCanvasState } from '../lib/design-canvas.ts';
import type { FieldBlockConfig } from '../lib/bed-block.ts';
import type { FieldBlockEditActor } from '../lib/field-block-allocations.ts';

const probe = { actor: 'owner-a' as string | null, configured: true, available: true };
Object.assign(globalThis, { __fieldAllocationSafety: probe });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ((specifier === './firebase/init' || specifier === '@/lib/firebase/init') && context.parentURL?.startsWith(new URL('../lib/', import.meta.url).href)) return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`const p=globalThis.__fieldAllocationSafety;
export const isBackendConfigured=()=>p.configured;export const getFirebase=()=>p.configured&&p.available?{auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}}:null;`),
  };
  return next(specifier, context);
} });
class Storage {
  rows = new Map<string, string>(); writes: string[] = []; fail = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { if (this.fail) throw Error('Synthetic unavailable storage'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw Error('Synthetic unavailable storage'); this.rows.set(key, String(value)); this.writes.push(key); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.writes = []; this.fail = false; }
}
const local = new Storage(), session = new Storage();
const original = new Map(['window', 'localStorage', 'sessionStorage', 'Storage', '__fieldAllocationSafety'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
Object.assign(globalThis, { window: browser, localStorage: local, sessionStorage: session, Storage });
const crop = await import('../lib/crop-plan.ts');
const account = await import('../lib/account-local-storage.ts');
const samples = await import('../lib/sample-mode.ts');
const canvas = await import('../lib/design-canvas.ts');
const { CROPS } = await import('../lib/crop-catalog.ts');
const { configureFieldBlock, reconcileFieldBlockEdit } = await import('../lib/bed-block.ts');
const { ELEMENTS_BY_ID } = await import('../lib/design-elements.ts');
const { BED_DEF_IDS, bedsFromDesignCanvas } = await import('../lib/design-beds-bridge.ts');
const authority = await import('../lib/field-block-allocations.ts');
const frame: CanvasFrame = { centerLng: 0, centerLat: 0, zoom: 18, imgW: 100, imgH: 50, mPerPx: 0.2, satDataUrl: null };
// Reused engineering dimensions, not crop or access-width recommendations.
const config: FieldBlockConfig = { mode: 'beds', bedLengthM: 4, bedWidthM: 2, pathWidthM: 1, angleDeg: 0 };
function source(): DesignCanvasState {
  return { siteId: 'site:0.00000,0.00000', frame, rev: 1, step: 'planting', updatedAt: '2026-10-30T00:00:00Z', items: [], lines: [],
    zones: [{ id: 'field-a', feature: 'staple_garden', zone: 3, points: [[0, 0], [0.6, 0], [0.6, 1], [0, 1]] },
      { id: 'existing-house', feature: 'house', zone: 1, name: 'Existing house', points: [[0.8, 0.2], [0.9, 0.2], [0.9, 0.3], [0.8, 0.3]] }] };
}
function filled() { return configureFieldBlock(source(), 'field-a', 'Engineering field', config, frame); }
function row(bedId: string) { return { id: 'saved-allocation', bedId, cropKey: CROPS[0].key, sowMonth: 1 }; }
const expected = { owner: 'owner-a', sample: false, loading: false };
function raw(plantings: unknown[]) { replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings, updatedAt: 1 })); }

beforeEach(async () => {
  releaseCropPlanFixture(); samples.exitSampleMode(); local.clear(); session.clear();
  probe.actor = 'owner-a'; probe.configured = true; probe.available = true; account.bindMountedAccountLocalStorageUid('owner-a');
  await initialiseCropPlanFixture();
});
after(() => {
  releaseCropPlanFixture(); samples.exitSampleMode(); hooks.deregister(); account.bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map<string, string>(); let apply = '', persist = '';
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ['handleChange', 'handleUndo', 'handleRedo'].includes(node.name.getText(page)) && node.initializer)
    callbacks.set(node.name.getText(page), node.initializer.getText(page));
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'persistCanvasState') persist = node.getText(page);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'FieldBlocksPanel') {
    const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(page) === 'onApply');
    if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) apply = attribute.initializer.expression?.getText(page) ?? '';
  }
  ts.forEachChild(node, inspect);
}
inspect(page); assert.equal(callbacks.size, 3); assert.ok(apply); assert.ok(persist);
const executable = ts.transpileModule(persist + '\n' + [...callbacks].map(([name, value]) => `const ${name}=${value};`).join('\n') + `\nconst apply=${apply};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

/** Execute actual parent callbacks and actual local design persistence. Only
 * React scheduling/UI setters and the cloud transport are controlled. */
function parent(initial = filled(), actor: FieldBlockEditActor = expected) {
  const queue: Array<(state: DesignCanvasState) => DesignCanvasState> = [];
  const h = { current: initial, error: null as string | null, saved: true, saveError: null as string | null,
    onUnsaved: null as (() => void) | null, pushes: 0 };
  const context = { ...authority, configureFieldBlock, reconcileFieldBlockEdit, canvasState: initial, frame,
    fieldFrameRef: { current: frame as CanvasFrame | null }, fieldEditActor: actor,
    useCallback: <T>(fn: T) => fn, t: (key: string) => key, MAX_UNDO: 20,
    undoStack: { current: [] as DesignCanvasState[] }, redoStack: { current: [] as DesignCanvasState[] },
    setCanvasState(fn: (state: DesignCanvasState) => DesignCanvasState) { queue.push(fn); },
    setSaved(value: boolean) { h.saved = value; if (!value) h.onUnsaved?.(); },
    setEditError(value: string | null) { h.error = value; }, setSaveError(value: string | null) { h.saveError = value; },
    saveCanvasState: canvas.saveCanvasState, CanvasSaveError: canvas.CanvasSaveError,
    withSelfSaveFlag: <T>(fn: () => T) => fn(), pushDesignCanvas: async () => { h.pushes++; },
    handleSetTool() {}, setActiveLayers() {},
  };
  const handlers = new Function('context', `with(context){${executable};return {handleChange,handleUndo,handleRedo,apply};}`)(context) as {
    handleChange: (fn: (state: DesignCanvasState) => DesignCanvasState) => void; handleUndo: () => void; handleRedo: () => void;
    apply: (id: string, name: string, config: FieldBlockConfig) => void;
  };
  return { ...handlers, h, context, flush() { while (queue.length) h.current = queue.shift()!(h.current); } };
}
const designWrites = () => local.writes.filter(key => key.includes('imbewu_design_canvas_')).length;
const resize = (state: DesignCanvasState): DesignCanvasState => ({ ...state, items: state.items.map((item, index) => index === 0 ? { ...item, wM: 1 } : item) });
const renameHouse = (state: DesignCanvasState): DesignCanvasState => ({ ...state, zones: state.zones.map(zone => zone.id === 'existing-house' ? { ...zone, name: 'Reviewed house label' } : zone) });

test('null beside a known allocation cannot turn the actual layout apply into an unallocated resize', () => {
  const state = filled(); raw([null, row(state.items[0].id)]);
  assert.deepEqual(crop.loadCropPlan().plantings, [], 'exercise the real display-fallback trigger');
  assert.equal(crop.readRawCropPlanReceipt().status, 'ready');
  const read = authority.readFieldBlockAllocations(expected);
  assert.equal(read.status, 'unknown'); assert.deepEqual(read.allocatedIds, [state.items[0].id]);
  const ui = parent(state), before = JSON.stringify(state), writes = designWrites();
  assert.throws(() => ui.apply('field-a', 'Unsafe old path', { ...config, bedWidthM: 1 }), /unresolved crop records/);
  ui.flush(); assert.equal(JSON.stringify(ui.h.current), before); assert.equal(designWrites(), writes);
});

test('known bed references remain protected even if crop fields or other row identities are invalid', () => {
  const state = filled(); raw([{ ...row(state.items[0].id), cropKey: null, sowMonth: null }, { ...row('different-bed'), id: null }]);
  const read = authority.readFieldBlockAllocations(expected); assert.equal(read.status, 'known');
  assert.deepEqual(read.allocatedIds, [state.items[0].id, 'different-bed']);
  const ui = parent(state); assert.throws(() => ui.apply('field-a', 'Still allocated', { ...config, bedWidthM: 1 }), /crop allocations/);
});

test('unknown raw references protect existing field ground but allow an unrelated house label edit', () => {
  for (const plantings of [[null], [{ bedId: 12 }], [{ bedId: '' }], [{ bedId: ' padded-reference ' }]]) {
    raw(plantings); const state = filled(), guarded = parent(state), writes = designWrites();
    guarded.handleChange(resize); guarded.flush(); assert.equal(guarded.h.current, state); assert.equal(designWrites(), writes);
    assert.match(guarded.h.error!, /crop allocations/);
    const house = parent(state); house.handleChange(renameHouse); house.flush();
    assert.equal(house.h.current.zones.find(zone => zone.id === 'existing-house')!.name, 'Reviewed house label');
    assert.equal(designWrites(), writes + 1); assert.equal(house.h.saved, true);
  }
});

test('an unreadable whole book blocks field regeneration and still permits an unrelated non-field edit', () => {
  replaceCanonicalCropPlanFixtureRaw('{broken'); const state = filled();
  const ui = parent(state); assert.throws(() => ui.apply('field-a', 'Held field', config), /unresolved crop records/);
  ui.handleChange(renameHouse); ui.flush(); assert.equal(ui.h.saved, true);
  assert.equal(ui.h.current.zones[0].points, state.zones[0].points);
});

test('a known empty canonical book permits an explicit field layout and its real measured dimensions persist', () => {
  raw([]); const initial = filled(), ui = parent(initial), writes = designWrites();
  ui.apply('field-a', 'Changed field', { ...config, bedWidthM: 1 }); ui.flush();
  assert.equal(designWrites(), writes + 1); assert.equal(ui.h.current.items[0].wM, 1); assert.equal(ui.h.saved, true);
  assert.equal(canvas.loadCanvasState(initial.siteId)!.items[0].wM, 1);
});

test('queued apply cannot adopt changed same-ID ground, another site or a recalibrated frame', () => {
  for (const change of ['points', 'site', 'frame']) {
    raw([]); const ui = parent(); ui.apply('field-a', 'Queued layout', { ...config, bedWidthM: 1 });
    if (change === 'points') ui.h.current = { ...ui.h.current, zones: ui.h.current.zones.map(zone => zone.id === 'field-a' ? { ...zone, points: zone.points.map(([x, y]) => [x / 2, y]) } : zone) };
    if (change === 'site') ui.h.current = { ...ui.h.current, siteId: 'site:1.00000,1.00000' };
    if (change === 'frame') ui.context.fieldFrameRef.current = { ...frame, mPerPx: 0.3 };
    const before = ui.h.current, writes = designWrites(); ui.flush();
    assert.equal(ui.h.current, before, change); assert.equal(designWrites(), writes, change); assert.match(ui.h.error!, /field or map scale changed/);
  }
});

test('a queued apply observes allocations that arrived after its outer preview validation', () => {
  raw([]); const state = filled(), ui = parent(state); ui.apply('field-a', 'Queued layout', { ...config, bedWidthM: 1 });
  raw([row(state.items[0].id)]); const writes = designWrites(); ui.flush();
  assert.equal(ui.h.current, state); assert.equal(designWrites(), writes); assert.match(ui.h.error!, /crop records or account changed/);
  assert.deepEqual(authority.readFieldBlockAllocations(expected).allocatedIds, [state.items[0].id]);
});

test('the final actual persist boundary rejects a later raw revision without consuming undo history', () => {
  raw([]); const state = filled(), ui = parent(state); ui.context.redoStack.current = [state];
  ui.h.onUnsaved = () => { ui.h.onUnsaved = null; raw([row(state.items[0].id)]); };
  const writes = designWrites(); ui.handleChange(renameHouse); ui.flush();
  assert.equal(ui.h.current, state); assert.equal(designWrites(), writes);
  assert.equal(ui.context.undoStack.current.length, 0); assert.equal(ui.context.redoStack.current.length, 1);
  assert.match(ui.h.error!, /crop records or account changed/);
});

test('actual undo and redo protect allocated open-parent layout metadata and unknown generated children', () => {
  for (const operation of ['handleUndo', 'handleRedo'] as const) {
    const open = configureFieldBlock(source(), 'field-a', 'Open field', { ...config, mode: 'open' }, frame);
    raw([row('field-a')]); const ui = parent(open);
    const changed = { ...open, zones: open.zones.map(zone => zone.id === 'field-a' ? { ...zone, fieldBlock: { ...config, mode: 'beds' as const } } : zone) };
    const stack = operation === 'handleUndo' ? ui.context.undoStack : ui.context.redoStack; stack.current = [changed];
    const writes = designWrites(); ui[operation](); ui.flush(); assert.equal(ui.h.current, open); assert.equal(stack.current.length, 1); assert.equal(designWrites(), writes);
    raw([null]); const generated = filled(), next = parent(generated);
    const history = operation === 'handleUndo' ? next.context.undoStack : next.context.redoStack; history.current = [resize(generated)];
    next[operation](); next.flush(); assert.equal(next.h.current, generated); assert.equal(history.current.length, 1); assert.equal(designWrites(), writes);
  }
});

test('allocated field names and unrelated house changes remain valid through ordinary edits and history', () => {
  const open = configureFieldBlock(source(), 'field-a', 'Old name', { ...config, mode: 'open' }, frame); raw([row('field-a')]);
  const renamed = { ...open, zones: open.zones.map(zone => zone.id === 'field-a' ? { ...zone, name: 'New name' } : zone) };
  assert.equal(reconcileFieldBlockEdit(open, renamed, new Set(['field-a'])), renamed);
  const ui = parent(open); ui.handleChange(() => renamed); ui.flush(); assert.equal(ui.h.current.zones[0].name, 'New name');
  ui.handleUndo(); ui.flush(); assert.equal(ui.h.current.zones[0].name, 'Old name');
  ui.handleRedo(); ui.flush(); assert.equal(ui.h.current.zones[0].name, 'New name');
});

test('every saved layout dimension or mode stays bound to an allocated open parent', () => {
  const open = configureFieldBlock(source(), 'field-a', 'Open field', { ...config, mode: 'open' }, frame);
  for (const change of [{ mode: 'beds' as const }, { bedLengthM: 5 }, { bedWidthM: 1 }, { pathWidthM: 0.5 }, { angleDeg: 90 }]) {
    const altered = { ...open, zones: open.zones.map(zone => zone.id === 'field-a' ? { ...zone, fieldBlock: { ...zone.fieldBlock!, ...change } } : zone) };
    assert.throws(() => reconcileFieldBlockEdit(open, altered, new Set(['field-a'])), /crop allocations/);
  }
});

test('an allocated legacy field without layout metadata cannot be deleted by an edit or history restoration', () => {
  const legacy = source(), deleted = { ...legacy, zones: legacy.zones.filter(zone => zone.id !== 'field-a') };
  assert.throws(() => reconcileFieldBlockEdit(legacy, deleted, new Set(['field-a'])), /crop allocations/);
  assert.equal(reconcileFieldBlockEdit(legacy, deleted, new Set()), deleted, 'an unallocated legacy polygon keeps its ordinary deletion behavior');
  for (const plantings of [[row('field-a')], [null]]) {
    raw(plantings);
    for (const operation of ['edit', 'handleUndo', 'handleRedo'] as const) {
      const ui = parent(legacy), writes = designWrites();
      if (operation === 'edit') ui.handleChange(() => deleted);
      else {
        const stack = operation === 'handleUndo' ? ui.context.undoStack : ui.context.redoStack;
        stack.current = [deleted]; ui[operation]();
      }
      ui.flush(); assert.equal(ui.h.current, legacy); assert.equal(designWrites(), writes); assert.match(ui.h.error!, /crop allocations/);
    }
  }
});

test('changing an allocated generated bed to a non-bed cannot remove its planning area through edit or history', () => {
  const state = filled(), id = state.items[0].id;
  const defId = Object.keys(ELEMENTS_BY_ID).find(key => !(BED_DEF_IDS as readonly string[]).includes(key)); assert.ok(defId);
  const changed = { ...state, items: state.items.map(item => item.id === id ? { ...item, defId } : item) };
  assert.ok(bedsFromDesignCanvas(state).some(bed => bed.id === id));
  assert.equal(bedsFromDesignCanvas(changed).some(bed => bed.id === id), false, 'the unchanged ID/dimensions still lose their actual planner capacity');
  for (const plantings of [[row(id)], [null]]) {
    raw(plantings);
    for (const operation of ['edit', 'handleUndo', 'handleRedo'] as const) {
      const ui = parent(state), writes = designWrites();
      if (operation === 'edit') ui.handleChange(() => changed);
      else {
        const stack = operation === 'handleUndo' ? ui.context.undoStack : ui.context.redoStack;
        stack.current = [changed]; ui[operation]();
      }
      ui.flush(); assert.equal(ui.h.current, state); assert.equal(designWrites(), writes); assert.match(ui.h.error!, /crop allocations/);
    }
  }
});

test('an allocated generated child also protects its parent mode and prevents a second parent planning area', () => {
  const state = filled(), child = state.items[0].id;
  const opened = { ...state, zones: state.zones.map(zone => zone.id === 'field-a' ? { ...zone, fieldBlock: { ...config, mode: 'open' as const } } : zone) };
  assert.equal(bedsFromDesignCanvas(opened).some(bed => bed.id === 'field-a'), true, 'this metadata change would add the parent beside its still-present children');
  raw([row(child)]);
  for (const operation of ['edit', 'handleUndo', 'handleRedo'] as const) {
    const ui = parent(state), writes = designWrites();
    if (operation === 'edit') ui.handleChange(() => opened);
    else {
      const stack = operation === 'handleUndo' ? ui.context.undoStack : ui.context.redoStack;
      stack.current = [opened]; ui[operation]();
    }
    ui.flush(); assert.equal(ui.h.current, state); assert.equal(designWrites(), writes); assert.match(ui.h.error!, /crop allocations/);
  }
  const named = { ...state, zones: state.zones.map(zone => zone.id === 'field-a' ? { ...zone, name: 'Updated field name' } : zone) };
  assert.equal(reconcileFieldBlockEdit(state, named, new Set([child])), named);
});

for (const change of ['savedScale', 'photoScale', 'photoCalibration'] as const) test(`queued layout holds changed saved calibration ${change} before the live frame catches up`, () => {
  raw([]);
  const initial = change === 'savedScale' ? filled() : { ...filled(), baseMode: 'photo' as const,
    customBase: { url: 'https://example.test/engineering-photo.png', uploadedAt: '2026-10-30T00:00:00Z', mPerPx: frame.mPerPx, scale: 1 } };
  const ui = parent(initial); ui.apply('field-a', 'Queued before calibration', { ...config, bedWidthM: 1 });
  if (change === 'savedScale') ui.h.current = { ...ui.h.current, scaleFactor: 2 };
  else ui.h.current = { ...ui.h.current, customBase: { ...ui.h.current.customBase!, ...(change === 'photoScale' ? { scale: 2 } : { mPerPx: 0.3 }) } };
  const before = ui.h.current, writes = designWrites(); ui.flush();
  assert.equal(ui.h.current, before, 'the actual functional updater must not configure a changed saved measurement basis using the preceding frame');
  assert.equal(designWrites(), writes); assert.match(ui.h.error!, /field or map scale changed/);
});

test('a queued edit or layout cannot acquire a newly granted lease after its original capability was released', async () => {
  for (const operation of ['edit', 'apply']) {
    raw([]); const ui = parent(), before = ui.h.current;
    if (operation === 'edit') ui.handleChange(renameHouse);
    else ui.apply('field-a', 'Earlier lease', { ...config, bedWidthM: 1 });
    const bookBytes = crop.cropPlanWriteToken(); await initialiseCropPlanFixture();
    assert.notEqual(crop.cropPlanWriteToken(), bookBytes, 'the actual lock authority must provide a new lease identity');
    const writes = designWrites(); ui.flush(); assert.equal(ui.h.current, before); assert.equal(designWrites(), writes);
    assert.match(ui.h.error!, /crop records or account changed/);
  }
});

test('actual Firebase changes and sample transitions revoke captured allocation capabilities', () => {
  raw([]); const read = authority.readFieldBlockAllocations(expected); assert.equal(read.status, 'known');
  probe.actor = 'owner-b'; assert.equal(authority.fieldBlockAllocationsAreCurrent(read), false);
  const ui = parent(); const before = ui.h.current, writes = designWrites(); ui.handleChange(renameHouse); ui.flush();
  assert.equal(ui.h.current, before); assert.equal(designWrites(), writes);
  probe.actor = 'owner-a'; assert.equal(samples.enterSampleMode(), true);
  assert.equal(authority.fieldBlockAllocationsAreCurrent(read), false);
});

test('configured but unavailable authentication cannot acquire guest authority while real guest and isolated paths remain usable', async () => {
  probe.actor = null; account.bindMountedAccountLocalStorageUid(null); await initialiseCropPlanFixture(); raw([]);
  const guest = { owner: null, sample: false, loading: false };
  assert.equal(authority.readFieldBlockAllocations(guest).status, 'known', 'an actual auth object with currentUser null is the real guest positive control');
  probe.available = false;
  const denied = authority.readFieldBlockAllocations(guest); assert.equal(denied.status, 'denied');
  const ui = parent(filled(), guest), before = ui.h.current, writes = designWrites();
  ui.handleChange(renameHouse); ui.flush(); assert.equal(ui.h.current, before); assert.equal(designWrites(), writes);
  probe.configured = false; await initialiseCropPlanFixture(); raw([]);
  assert.equal(authority.readFieldBlockAllocations(guest).status, 'known', 'backend-unconfigured local-only data retains its distinct path');
  probe.configured = true; assert.equal(samples.enterSampleMode(), true);
  samples.setSandboxCropPlan({ version: 1, plantings: [], updatedAt: 1 });
  assert.equal(authority.readFieldBlockAllocations({ owner: null, sample: true, loading: false }).status, 'known', 'DEMO remains isolated without claiming real guest authentication');
});

test('an unavailable physical store never produces a false saved claim for an otherwise allowed house edit', () => {
  raw([]); const state = filled(), ui = parent(state), writes = designWrites(); local.fail = true;
  ui.handleChange(renameHouse); ui.flush();
  assert.equal(designWrites(), writes); assert.equal(ui.h.saved, false); assert.equal(ui.h.saveError, 'designStorageFull');
  assert.equal(ui.h.pushes, 0, 'a failed device write must not publish an unpersisted cloud candidate');
  assert.equal(ui.h.current.zones[0].points, state.zones[0].points);
});

test('sample getter-bearing raw rows stay unknown without executing a getter or borrowing real allocations', () => {
  const physical = JSON.stringify([...local.rows]); assert.equal(samples.enterSampleMode(), true); let calls = 0;
  samples.setSandboxCropPlan({ version: 1, plantings: [{ get bedId() { calls++; return 'field-a'; } }], updatedAt: 1 } as never);
  const read = authority.readFieldBlockAllocations({ owner: null, sample: true, loading: false });
  assert.equal(read.status, 'unknown'); assert.equal(calls, 0);
  assert.throws(() => authority.assertFieldBlockLayoutReadable(read), /unresolved crop records/);
  assert.equal(JSON.stringify([...local.rows]), physical);
});

test('copied read objects cannot grant authority and unchanged source metadata does not erase a length draft', () => {
  const state = filled(), read = authority.readFieldBlockAllocations(expected);
  assert.equal(authority.fieldBlockAllocationsAreCurrent({ ...read }), false);
  const key = authority.fieldBlockSourceKey(state, 'field-a', frame), before = JSON.stringify(state);
  assert.equal(authority.fieldBlockSourceKey({ ...state, rev: 99, updatedAt: '2026-11-03T00:00:00Z' }, 'field-a', { ...frame, satDataUrl: 'paint-only' }), key);
  assert.notEqual(authority.fieldBlockSourceKey({ ...state, items: [...state.items].reverse() }, 'field-a', frame), key);
  assert.notEqual(authority.fieldBlockSourceKey({ ...state, zones: state.zones.map(zone => zone.id === 'field-a' ? { ...zone, fieldBlock: { ...config, bedWidthM: 1 } } : zone) }, 'field-a', frame), key);
  assert.equal(JSON.stringify(state), before, 'source inspection never mutates measured saved geometry');
});

test('image bytes, upload timestamps and paint-only alignment do not become a new field measurement basis', () => {
  const state = { ...filled(), baseMode: 'photo' as const,
    customBase: { url: 'https://example.test/first-photo.png', uploadedAt: '2026-10-30T00:00:00Z', mPerPx: frame.mPerPx, scale: 1 } };
  const next = { ...state, updatedAt: '2026-11-03T00:00:00Z', rev: 12,
    frame: { ...state.frame, satDataUrl: 'other-paint-bytes', underlayDataUrl: 'another-underlay' },
    customBase: { ...state.customBase, url: 'https://example.test/second-photo.png', uploadedAt: '2026-11-03T00:00:00Z', opacity: 0.5, dx: 0.1, dy: 0.1, rotationDeg: 90 } };
  assert.equal(authority.fieldBlockSourceKey(next, 'field-a', { ...frame, satDataUrl: 'new-live-paint' }), authority.fieldBlockSourceKey(state, 'field-a', frame));
});
