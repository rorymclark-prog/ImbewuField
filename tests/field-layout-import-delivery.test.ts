import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach, beforeEach } from 'node:test';
import ts from 'typescript';
import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw,
  readCanonicalCropPlanFixtureRaw, canonicalCropPlanFixtureKey } from './crop-plan-storage-fixture.ts';
import type { CanvasFrame, DesignCanvasState } from '../lib/design-canvas.ts';
import type { FieldLayoutKmlParseResult } from '../lib/field-layout-import.types.ts';
import type { FieldImportPanelReview } from '../components/design/FieldLayoutImportPanel.tsx';
import type { FieldImportReadOptions } from '../lib/field-layout-import-delivery.ts';

const savedGlobals = new Map(['window', 'localStorage', 'sessionStorage', 'Storage', '__fieldImportDelivery']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const probe = { actor: 'owner-a' as string | null, configured: true, parsed: null as FieldLayoutKmlParseResult | null,
  parserCalls: 0, listeners: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __fieldImportDelivery: probe });
const library = new URL('../lib/', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__fieldImportDelivery;
    export const isBackendConfigured=()=>p.configured;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__fieldImportDelivery;
    export const onAuthStateChanged=(_auth,next,error)=>{p.listeners.add(next);p.errors.add(error);return()=>{p.listeners.delete(next);p.errors.delete(error);};};`);
  // Only the delivery module's XML boundary is controlled. Synthetic numeric
  // DTOs exercise real projection, topology, append and persistence authorities;
  // this fixture does not parse or validate XML.
  if (context.parentURL?.endsWith('/lib/field-layout-import-delivery.ts') && specifier === './field-layout-kml-parser') return data(`
    const p=globalThis.__fieldImportDelivery;
    export const KML_PARSER_LIMITS=Object.freeze({maxUtf16Chars:1000000});
    export const parseFieldLayoutKml=value=>{p.parserCalls++;return typeof value==='string'?p.parsed:{status:'held',reason:'Primitive text required'};};`);
  return next(specifier, context);
} });
const delivery = await import('../lib/field-layout-import-delivery.ts');
const account = await import('../lib/account-local-storage.ts');
const canvas = await import('../lib/design-canvas.ts');
const crop = await import('../lib/crop-plan.ts');
const { CROPS } = await import('../lib/crop-catalog.ts');
const allocations = await import('../lib/field-block-allocations.ts');
const { reconcileFieldBlockEdit } = await import('../lib/bed-block.ts');

class Storage {
  rows = new Map<string, string>(); reads: string[] = []; writes: string[] = [];
  failRead = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { this.reads.push(key); if (this.failRead) throw Error('Synthetic unavailable storage'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
class Browser extends EventTarget {
  localStorage = new Storage(); sessionStorage = new Storage();
  registered = new Map<string, Set<EventListenerOrEventListenerObject>>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (listener) { const group = this.registered.get(type) ?? new Set(); group.add(listener); this.registered.set(type, group); }
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (listener) this.registered.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
}
let win: Browser;
const reviews = new Set<FieldImportPanelReview>();
const frame: CanvasFrame = { centerLng: 0, centerLat: 0, zoom: 18, imgW: 200, imgH: 100, mPerPx: 0.5, satDataUrl: null };
function fixture(): DesignCanvasState {
  return { siteId: 'site:0.00000,0.00000', frame: { ...frame }, rev: 1, step: 'planting', updatedAt: '2026-11-04T00:00:00.000Z',
    items: [{ id: 'existing-bed', defId: 'veg_bed', fieldBlockId: 'existing-field', label: 'Existing bed label', x: 0.2, y: 0.2, wM: 2, hM: 4 }],
    lines: [{ id: 'existing-path', fieldBlockId: 'existing-field', kind: 'bedpath', name: 'Existing path label', points: [[0.1, 0.3], [0.3, 0.3]], widthM: 0.5 }],
    zones: [{ id: 'existing-field', zone: 3, feature: 'staple_garden', name: 'Existing field label',
      points: [[0.05, 0.05], [0.35, 0.05], [0.35, 0.35], [0.05, 0.35]],
      fieldBlock: { mode: 'beds', bedLengthM: 4, bedWidthM: 2, pathWidthM: 0.5, angleDeg: 90 } },
    { id: 'existing-house', zone: 1, feature: 'house', name: 'Existing house', points: [[0.4, 0.1], [0.5, 0.1], [0.5, 0.2], [0.4, 0.2]] }] };
}
function parsed(): FieldLayoutKmlParseResult {
  const project = canvas.makeMercatorUnprojector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH);
  const ring = ([[0.65, 0.55], [0.85, 0.55], [0.85, 0.8], [0.65, 0.8], [0.65, 0.55]] as Array<[number, number]>).map(project);
  return { status: 'parsed', candidates: [{ id: 'polygon-1', name: 'External suggestion label', ring }], excludedPlacemarkCount: 2 };
}
const baseKey = (state: DesignCanvasState) => `imbewu_design_canvas_${state.siteId}`;
function store(state: DesignCanvasState, owner: string | null = probe.actor) {
  const key = account.accountLocalStorageKey(baseKey(state), owner);
  win.localStorage.rows.set(key, JSON.stringify(state)); return key;
}
function options(state = fixture(), overrides: Partial<FieldImportReadOptions> = {}): FieldImportReadOptions {
  return { state, frame: { ...frame }, actor: { owner: 'owner-a', sample: false, loading: false },
    file: { size: 100, text: async () => 'synthetic parser input, not actual XML' },
    isCurrent: () => true, formIsCurrent: () => true, ...overrides };
}
async function read(opts: FieldImportReadOptions) {
  const result = await delivery.readFieldLayoutImportFile(opts);
  if (result.status === 'review') reviews.add(result);
  return result;
}
async function reviewed(opts: FieldImportReadOptions) {
  const result = await read(opts); assert.equal(result.status, 'review', JSON.stringify(result));
  if (result.status !== 'review') throw Error('Expected a real geometry review');
  return result;
}
function begin(review: FieldImportPanelReview, formCurrent = () => true) {
  return delivery.beginFieldLayoutImportAppend(review, ['polygon-1'], () => 'fresh-imported-field', formCurrent);
}
function actor(uid: string | null) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const listener of probe.listeners) listener(uid ? { uid } : null);
}
function sample(enabled: boolean) {
  if (enabled) win.sessionStorage.setItem('imbewu_sample_mode', '1'); else win.sessionStorage.removeItem('imbewu_sample_mode');
  win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>(yes => { resolve = yes; });
  return { promise, resolve };
}
function released() {
  assert.equal(probe.listeners.size, 0); assert.equal(probe.errors.size, 0);
  assert.equal([...win.registered.values()].reduce((sum, group) => sum + group.size, 0), 0);
}
function changedBook() {
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], updatedAt: 2 }));
}

beforeEach(async () => {
  releaseCropPlanFixture(); probe.actor = 'owner-a'; probe.configured = true; probe.parserCalls = 0;
  probe.listeners.clear(); probe.errors.clear(); reviews.clear(); win = new Browser();
  for (const [key, value] of Object.entries({ window: win, localStorage: win.localStorage, sessionStorage: win.sessionStorage, Storage })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  account.bindMountedAccountLocalStorageUid('owner-a');
  await initialiseCropPlanFixture();
  // An actual canonical envelope and retained lease back the crop allocation
  // proof. No fake ready token or legacy-only book can admit this fixture.
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1,
    plantings: [{ id: 'existing-planting', bedId: 'existing-bed', cropKey: CROPS[0].key, sowMonth: 1 }], updatedAt: 1 }));
  assert.notEqual(crop.cropPlanWriteToken(), null);
  probe.parsed = parsed(); win.localStorage.writes = []; win.sessionStorage.writes = [];
});
afterEach(() => {
  for (const review of reviews) delivery.discardFieldLayoutImport(review);
  released(); releaseCropPlanFixture();
});
after(() => {
  releaseCropPlanFixture(); hooks.deregister(); account.bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('reading a local file makes a detached real geometry review without writing the design, crop book or preferences', async () => {
  const state = fixture(); store(state);
  const before = new Map(win.localStorage.rows), book = readCanonicalCropPlanFixtureRaw(), original = JSON.stringify(state);
  let textCalls = 0;
  const review = await reviewed(options(state, { file: { size: 100, text: async () => { textCalls++; return 'synthetic input'; } } }));
  assert.equal(textCalls, 1); assert.equal(probe.parserCalls, 1); assert.equal(review.excludedPlacemarkCount, 2);
  assert.equal(review.candidates[0].status, 'ready'); assert.ok(review.candidates[0].points?.every(point => point.every(Number.isFinite)));
  assert.deepEqual(win.localStorage.rows, before); assert.deepEqual(win.localStorage.writes, []);
  assert.equal(readCanonicalCropPlanFixtureRaw(), book); assert.equal(JSON.stringify(state), original);
  assert.ok(Object.isFrozen(review)); assert.equal(probe.listeners.size, 1);
  delivery.discardFieldLayoutImport(review); released();
});

test('explicit append keeps existing geometry and crop allocations, creates a fresh outline and accepts only its actual saved receipt', async () => {
  const state = fixture(); store(state); const original = JSON.stringify(state), book = readCanonicalCropPlanFixtureRaw();
  const review = await reviewed(options(state)), action = begin(review), added = action.apply(state, frame);
  assert.notEqual(added, state); assert.equal(added.zones.length, state.zones.length + 1);
  assert.deepEqual(added.items, state.items); assert.deepEqual(added.lines, state.lines);
  assert.deepEqual(added.zones.slice(0, state.zones.length), state.zones);
  assert.equal(JSON.stringify(state), original); assert.deepEqual(win.localStorage.writes, []);
  const last = added.zones.at(-1)!;
  assert.equal(last.id, 'fresh-imported-field'); assert.equal(last.feature, 'staple_garden'); assert.equal(last.status, 'proposed');
  assert.equal(last.name, 'Imported field'); assert.equal(last.fieldBlock, undefined);
  assert.equal(readCanonicalCropPlanFixtureRaw(), book);
  const saved = canvas.saveCanvasState(added); action.written(saved);
  assert.equal(canvas.readCanvasSourceReceipt(state.siteId).status, 'ready');
  assert.strictEqual(action.apply(saved, frame), saved, 'returned-state replay adds no second outline');
  assert.strictEqual(action.apply(state, frame), added, 'original-state replay recognizes this action’s own saved result');
  assert.equal(win.localStorage.writes.length, 1); assert.equal(readCanonicalCropPlanFixtureRaw(), book);
  assert.throws(() => begin(review), /changed|Read the KML/i);
});

test('a forged review and colliding or duplicate selections cannot gain append authority', async () => {
  const state = fixture(); store(state); const review = await reviewed(options(state));
  assert.throws(() => begin({ ...review }), /changed|Read the KML/i);
  const collision = delivery.beginFieldLayoutImportAppend(review, ['polygon-1'], () => 'existing-field', () => true);
  assert.throws(() => collision.apply(state, frame), /distinct|overlap/i); collision.failed();
  const again = await reviewed(options(state));
  const duplicate = delivery.beginFieldLayoutImportAppend(again, ['polygon-1', 'polygon-1'], () => 'fresh-imported-field', () => true);
  assert.throws(() => duplicate.apply(state, frame), /distinct|overlap/i); duplicate.failed();
  assert.deepEqual(win.localStorage.writes, []);
});

test('allocation and raw saved-map proof must be readable before file bytes are requested', async () => {
  const state = fixture(); let textCalls = 0;
  const file = { size: 100, text: async () => { textCalls++; return 'synthetic input'; } };
  assert.equal((await read(options(state, { file }))).status, 'held');
  store(state); replaceCanonicalCropPlanFixtureRaw('{broken');
  assert.equal((await read(options(state, { file }))).status, 'held');
  assert.equal(textCalls, 0); assert.equal(probe.parserCalls, 0); released();
});

test('malformed files and failed local reads hold without a source write or retained proposal', async () => {
  const state = fixture(); store(state); let textCalls = 0;
  for (const size of [0, -1, NaN, Infinity, 1_000_001]) {
    assert.equal((await read(options(state, { file: { size, text: async () => { textCalls++; return ''; } } }))).status, 'held');
    released();
  }
  assert.equal(textCalls, 0);
  for (const file of [null, { size: 1 }, { size: 1, text: async () => { throw Error('Synthetic file read failure'); } },
    { size: 1, text: async () => ({ unexpected: true }) }]) {
    assert.equal((await read(options(state, { file: file as unknown as FieldImportReadOptions['file'] }))).status, 'held'); released();
  }
  assert.deepEqual(win.localStorage.writes, []);
});

for (const change of ['raw-source', 'source-event', 'frame', 'crop-book', 'actor-ABA', 'sample-ABA', 'caller', 'read-form'] as const) {
  test(`${change} during File.text withdraws the read before it can become an append review`, async () => {
    const state = fixture(); store(state); const waiting = deferred(); let current = true, readForm = true, textCalls = 0;
    const opts = options(state, { isCurrent: () => current, formIsCurrent: () => readForm,
      file: { size: 100, text: () => { textCalls++; return waiting.promise; } } });
    const pending = read(opts); assert.equal(textCalls, 1);
    if (change === 'raw-source') { const other = structuredClone(state); other.lines[0].name = 'Changed saved path'; store(other); }
    if (change === 'source-event') win.dispatchEvent(new Event(canvas.DESIGN_CANVAS_CHANGED_EVENT));
    if (change === 'frame') opts.frame.mPerPx *= 2;
    if (change === 'crop-book') changedBook();
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (change === 'sample-ABA') { sample(true); sample(false); }
    if (change === 'caller') current = false;
    if (change === 'read-form') readForm = false;
    waiting.resolve('synthetic input'); assert.equal((await pending).status, 'held');
    assert.deepEqual(win.localStorage.writes, change === 'crop-book' ? [canonicalCropPlanFixtureKey()] : []);
    released();
  });
}

for (const change of ['raw-source', 'source-event', 'frame', 'crop-book', 'actor-ABA', 'sample-ABA', 'form', 'read-form'] as const) {
  test(`${change} after review prevents the queued append from using obsolete authority`, async () => {
    const state = fixture(); store(state); let current = true, readForm = true;
    const review = await reviewed(options(state, { formIsCurrent: () => readForm }));
    const action = begin(review, () => current); let liveState = state, liveFrame = frame;
    if (change === 'raw-source') { const other = structuredClone(state); other.zones[0].name = 'Changed saved field'; store(other); }
    if (change === 'source-event') win.dispatchEvent(new Event(canvas.DESIGN_CANVAS_CHANGED_EVENT));
    if (change === 'frame') { liveFrame = { ...frame, mPerPx: frame.mPerPx * 2 }; liveState = { ...state, frame: liveFrame }; }
    if (change === 'crop-book') changedBook();
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (change === 'sample-ABA') { sample(true); sample(false); }
    if (change === 'form') current = false;
    if (change === 'read-form') readForm = false;
    assert.throws(() => action.apply(liveState, liveFrame), /changed|Read the KML/i);
    action.failed(); released();
  });
}

test('discarding or failing an action revokes its private review proof and releases every observer', async () => {
  const state = fixture(); store(state); const review = await reviewed(options(state));
  const action = begin(review); delivery.discardFieldLayoutImport(review); delivery.discardFieldLayoutImport(review);
  assert.throws(() => action.apply(state, frame), /changed|Read the KML/i);
  assert.throws(() => begin(review), /changed|Read the KML/i); released();
  const replacement = await reviewed(options(state)), failed = begin(replacement);
  failed.failed(); assert.throws(() => failed.apply(state, frame), /changed|Read the KML/i); released();
});

test('written cannot claim an unsaved or different saved design as this action’s receipt', async () => {
  const state = fixture(); store(state); const review = await reviewed(options(state)), action = begin(review);
  const added = action.apply(state, frame);
  assert.throws(() => action.written(added), /changed|Read the KML/i);
  const other = structuredClone(added); other.zones.at(-1)!.name = 'Different saved result'; store(other);
  assert.throws(() => action.written(added), /changed|Read the KML/i); action.failed();
});

test('a crop-book change between append calculation and write acknowledgement cannot bless a stale allocation proof', async () => {
  const state = fixture(); store(state); const review = await reviewed(options(state)), action = begin(review);
  const added = action.apply(state, frame), saved = canvas.saveCanvasState(added); changedBook();
  assert.throws(() => action.written(saved), /changed|Read the KML/i); action.failed();
});

test('completed own-write replays survive consumed UI form guards while actor and saved-receipt authority remain live', async () => {
  const state = fixture(); store(state); let readForm = true, appendForm = true;
  const review = await reviewed(options(state, { formIsCurrent: () => readForm }));
  const action = begin(review, () => appendForm), added = action.apply(state, frame);
  const saved = canvas.saveCanvasState(added); action.written(saved);
  readForm = false; appendForm = false;
  const writes = [...win.localStorage.writes], cloned = structuredClone(saved);
  assert.strictEqual(action.apply(state, frame), added);
  assert.strictEqual(action.apply(saved, frame), saved);
  assert.strictEqual(action.apply(cloned, frame), cloned);
  assert.deepEqual(win.localStorage.writes, writes, 'recognizing an exact own result performs no second save');
  actor('owner-b'); actor('owner-a');
  assert.throws(() => action.apply(saved, frame), /changed|Read the KML/i);
});

test('both live form guards are required to begin an append and a changed parent cannot be adopted by a read', async () => {
  const state = fixture(); store(state); let readForm = true;
  const review = await reviewed(options(state, { formIsCurrent: () => readForm }));
  readForm = false;
  assert.throws(() => begin(review), /changed|Read the KML/i);
  delivery.discardFieldLayoutImport(review);
  const next = await reviewed(options(state));
  assert.throws(() => begin(next, () => false), /changed|Read the KML/i);
  let textCalls = 0;
  const invalid = await read(options(state, { isCurrent: () => false,
    file: { size: 100, text: async () => { textCalls++; return 'synthetic input'; } } }));
  assert.equal(invalid.status, 'held'); assert.equal(textCalls, 0);
});

for (const change of ['parent', 'raw-source', 'crop-book', 'sample-ABA', 'frame'] as const) {
  test(`a completed action cannot replay after ${change} changes even though UI forms were consumed`, async () => {
    const state = fixture(); store(state); let current = true, forms = true;
    const review = await reviewed(options(state, { isCurrent: () => current, formIsCurrent: () => forms }));
    const action = begin(review, () => forms), added = action.apply(state, frame), saved = canvas.saveCanvasState(added);
    action.written(saved); forms = false;
    if (change === 'parent') current = false;
    if (change === 'raw-source') { const other = structuredClone(saved); other.lines[0].name = 'External path edit'; store(other); }
    if (change === 'crop-book') changedBook();
    if (change === 'sample-ABA') { sample(true); sample(false); }
    const nextFrame = change === 'frame' ? { ...frame, mPerPx: frame.mPerPx * 2 } : frame;
    assert.throws(() => action.apply(saved, nextFrame), /changed|Read the KML/i); action.failed();
  });
}

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let persist = '', handleChange = '', onRead = '', onAppend = '';
function inspectParent(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'persistCanvasState') persist = node.getText(page);
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === 'handleChange' && node.initializer) handleChange = node.initializer.getText(page);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'FieldLayoutImportPanel') {
    for (const property of node.attributes.properties) {
      if (!ts.isJsxAttribute(property) || !property.initializer || !ts.isJsxExpression(property.initializer)) continue;
      if (property.name.getText(page) === 'onRead') onRead = property.initializer.expression?.getText(page) ?? '';
      if (property.name.getText(page) === 'onAppend') onAppend = property.initializer.expression?.getText(page) ?? '';
    }
  }
  ts.forEachChild(node, inspectParent);
}
inspectParent(page); assert.ok(persist); assert.ok(handleChange); assert.ok(onRead); assert.ok(onAppend);
const parentExecutable = ts.transpileModule(`${persist}\nconst handleChange=${handleChange};\nconst onRead=${onRead};\nconst onAppend=${onAppend};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

/** Runs the actual parent callbacks and reducer, not React's scheduler or a UI
 * timing simulation. Queue replay/completion flags are explicit controlled inputs.
 * Only UI setters, ID allocation and cloud transport are replaced. */
function parent(initial: DesignCanvasState) {
  const queue: Array<(state: DesignCanvasState) => DesignCanvasState> = [];
  const h = { error: null as string | null, saveError: null as string | null, pushes: 0, layerUpdates: 0, saved: true, ids: 0 };
  const actor = { owner: 'owner-a', sample: false, loading: false };
  const context = { ...allocations, ...delivery, reconcileFieldBlockEdit, canvasState: initial, frame, fieldEditActor: actor,
    fieldExportView: { current: { state: initial, frame, actor } }, fieldExportMounted: { current: true },
    fieldFrameRef: { current: frame }, undoStack: { current: [] as DesignCanvasState[] }, redoStack: { current: [initial] }, MAX_UNDO: 20,
    useCallback: <T>(fn: T) => fn, t: (value: string) => value,
    setCanvasState(fn: (state: DesignCanvasState) => DesignCanvasState) { queue.push(fn); },
    setSaved(value: boolean) { h.saved = value; }, setEditError(value: string | null) { h.error = value; },
    setSaveError(value: string | null) { h.saveError = value; },
    setActiveLayers(update: (value: Record<string, boolean>) => Record<string, boolean>) { update({}); h.layerUpdates++; },
    saveCanvasState: canvas.saveCanvasState, CanvasSaveError: canvas.CanvasSaveError,
    withSelfSaveFlag: <T>(fn: () => T) => fn(), pushDesignCanvas: async () => { h.pushes++; },
    newId: () => `parent-imported-field-${++h.ids}`,
  };
  const callbacks = new Function('context', `with(context){${parentExecutable};return {onRead,onAppend};}`)(context) as {
    onRead: (file: FieldImportReadOptions['file'], formCurrent: () => boolean) => Promise<Awaited<ReturnType<typeof delivery.readFieldLayoutImportFile>>>;
    onAppend: (review: FieldImportPanelReview, ids: readonly string[], formCurrent: () => boolean) => Promise<{ status: 'applied' | 'held'; message: string }>;
  };
  return { context, h, ...callbacks,
    takeQueued() { const fn = queue.shift(); assert.ok(fn, 'the actual parent must enqueue its reducer'); return fn; },
  };
}
const designWrites = () => win.localStorage.writes.filter(key => key.includes('imbewu_design_canvas_')).length;

test('the actual parent saves one append/history entry and replays original, returned and cloned results after UI completion', async () => {
  const state = fixture(); store(state); const ui = parent(state); let readForm = true, appendForm = true;
  const review = await ui.onRead(options(state).file, () => readForm);
  assert.equal(review.status, 'review'); if (review.status !== 'review') throw Error('Parent read held'); reviews.add(review);
  const pending = ui.onAppend(review, ['polygon-1'], () => appendForm), reducer = ui.takeQueued();
  const saved = reducer(state); assert.equal((await pending).status, 'applied');
  assert.equal(saved.zones.length, state.zones.length + 1); assert.equal(saved.zones.at(-1)!.id, 'parent-imported-field-1');
  assert.equal(designWrites(), 1); assert.equal(ui.h.pushes, 1); assert.equal(ui.h.layerUpdates, 1); assert.equal(ui.h.ids, 1);
  assert.equal(ui.context.undoStack.current.length, 1); assert.strictEqual(ui.context.undoStack.current[0], state);
  assert.deepEqual(ui.context.redoStack.current, []); assert.equal(ui.h.saved, true); assert.equal(ui.h.error, null);
  readForm = false; appendForm = false;
  assert.strictEqual(reducer(state), saved); assert.strictEqual(reducer(saved), saved);
  const clone = structuredClone(saved); assert.strictEqual(reducer(clone), clone);
  assert.equal(designWrites(), 1); assert.equal(ui.h.pushes, 1); assert.equal(ui.h.layerUpdates, 1);
  assert.equal(ui.context.undoStack.current.length, 1); assert.equal(ui.h.error, null);
});

for (const change of ['actor-ABA', 'frame', 'crop-book', 'saved-source'] as const) {
  test(`the actual parent refuses ${change} during a replay without another save or history entry`, async () => {
    const state = fixture(); store(state); const ui = parent(state); let forms = true;
    const review = await ui.onRead(options(state).file, () => forms);
    assert.equal(review.status, 'review'); if (review.status !== 'review') throw Error('Parent read held'); reviews.add(review);
    const pending = ui.onAppend(review, ['polygon-1'], () => forms), reducer = ui.takeQueued();
    const saved = reducer(state); assert.equal((await pending).status, 'applied'); forms = false;
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (change === 'frame') ui.context.fieldFrameRef.current = { ...frame, mPerPx: frame.mPerPx * 2 };
    if (change === 'crop-book') changedBook();
    if (change === 'saved-source') { const other = structuredClone(saved); other.zones[0].name = 'External field edit'; store(other); }
    const writes = designWrites(), history = ui.context.undoStack.current.length;
    assert.strictEqual(reducer(state), state); assert.ok(ui.h.error);
    assert.equal(designWrites(), writes); assert.equal(ui.context.undoStack.current.length, history); assert.equal(ui.h.pushes, 1);
  });
}
