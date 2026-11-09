import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import ts from 'typescript';
import type { CanvasFrame, DesignCanvasState } from '../lib/design-canvas.ts';

const probe = { actor: 'owner-a' as string | null, configured: true,
  listeners: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __fieldLayoutDelivery: probe });
const library = new URL('../lib/', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__fieldLayoutDelivery;
    export const isBackendConfigured=()=>p.configured;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__fieldLayoutDelivery;
    export const onAuthStateChanged=(_auth,next,error)=>{p.listeners.add(next);p.errors.add(error);return()=>{p.listeners.delete(next);p.errors.delete(error);};};`);
  return next(specifier, context);
} });
const delivery = await import('../lib/field-layout-delivery.ts');
const account = await import('../lib/account-local-storage.ts');
const preferences = await import('../lib/length-unit-preference.ts');
const { configureFieldBlock } = await import('../lib/bed-block.ts');
const { DESIGN_CANVAS_CHANGED_EVENT } = await import('../lib/design-canvas.ts');

class Storage {
  rows = new Map<string, string>(); reads: string[] = []; writes: string[] = [];
  failRead = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { this.reads.push(key); if (this.failRead) throw Error('Unavailable'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
class Browser extends EventTarget {
  localStorage = new Storage(); sessionStorage = new Storage(); coarse = false;
  registered = new Map<string, Set<EventListenerOrEventListenerObject>>();
  matchMedia() { return { matches: this.coarse }; }
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (listener) { const group = this.registered.get(type) ?? new Set(); group.add(listener); this.registered.set(type, group); }
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (listener) this.registered.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
}
const savedGlobals = new Map(['window', 'localStorage', 'sessionStorage', 'document', 'navigator', 'setTimeout', '__fieldLayoutDelivery']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
let win: Browser, urls: Map<string, Blob>, files: Array<{ name: string; blob: Blob }>, shareCalls: number;
let share: () => Promise<void>;
const frame: CanvasFrame = { centerLng: 0, centerLat: 0, zoom: 18, imgW: 100, imgH: 50, mPerPx: 0.1, satDataUrl: null };
function fixture(): DesignCanvasState {
  const empty: DesignCanvasState = { siteId: 'site:0.00000,0.00000', frame: { ...frame }, rev: 1,
    updatedAt: '2026-11-04T00:00:00.000Z', step: 'planting', items: [], lines: [], zones: [
      { id: 'private-field-id', feature: 'staple_garden', zone: 3, name: 'Saved private label', points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] },
    ] };
  return configureFieldBlock(empty, 'private-field-id', 'Saved private label',
    { mode: 'beds', bedLengthM: 2, bedWidthM: 1, pathWidthM: 0.25, angleDeg: 0 }, frame);
}
const baseKey = (state: DesignCanvasState) => `imbewu_design_canvas_${state.siteId}`;
function store(state: DesignCanvasState, owner: string | null = probe.actor, sample = false) {
  const key = sample ? baseKey(state) : account.accountLocalStorageKey(baseKey(state), owner);
  win.localStorage.rows.set(key, JSON.stringify(state)); return key;
}
function options(state = fixture()) {
  return { state, frame: { ...frame }, actor: { owner: 'owner-a', sample: false, loading: false },
    selection: { kind: 'selected' as const, fieldId: 'private-field-id' }, includeLabels: false, isCurrent: () => true };
}
function actor(uid: string | null, observe = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observe) for (const listener of probe.listeners) listener(uid ? { uid } : null);
}
function sample(enabled: boolean) {
  if (enabled) win.sessionStorage.setItem('imbewu_sample_mode', '1'); else win.sessionStorage.removeItem('imbewu_sample_mode');
  win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
function deferred() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function released() {
  assert.equal(probe.listeners.size, 0, 'Each attempted file must release its own auth observer');
  assert.equal(probe.errors.size, 0);
  assert.equal([...win.registered.values()].reduce((sum, values) => sum + values.size, 0), 0, 'Source/sample observers must not outlive delivery');
}
beforeEach(() => {
  probe.actor = 'owner-a'; probe.configured = true; probe.listeners.clear(); probe.errors.clear();
  account.bindMountedAccountLocalStorageUid('owner-a'); win = new Browser(); urls = new Map(); files = []; shareCalls = 0;
  share = async () => {};
  const globals = { window: win, localStorage: win.localStorage, sessionStorage: win.sessionStorage,
    navigator: { canShare: () => true, share: async () => { shareCalls++; await share(); } },
    document: { body: { appendChild() {} }, createElement: () => ({ href: '', download: '', rel: '',
      click() { const blob = urls.get(this.href); assert.ok(blob); files.push({ name: this.download, blob }); }, remove() {} }) },
    // Object-URL retention belongs to the shared delivery helper's tests. No
    // ten-second revocation timer may keep this isolated boundary test alive.
    setTimeout: () => 0,
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); const key = `blob:field-layout-${urls.size}`; urls.set(key, blob); return key; };
  URL.revokeObjectURL = key => { urls.delete(key); };
});
after(() => {
  hooks.deregister(); account.bindMountedAccountLocalStorageUid(null);
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  for (const [key, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
  Reflect.deleteProperty(globalThis, '__fieldLayoutDelivery');
});

test('desktop delivery uses the real saved layout, generic labels and a local KML download without a source write', async () => {
  const state = fixture(); store(state);
  const source = JSON.stringify(state), before = new Map(win.localStorage.rows);
  const result = await delivery.deliverFieldLayoutExport(options(state));
  assert.equal(result.status, 'downloaded'); assert.equal(files.length, 1); assert.equal(shareCalls, 0);
  assert.equal(files[0].name, 'ImbewuField-field-layout.kml');
  assert.equal(files[0].blob.type, 'application/vnd.google-earth.kml+xml');
  const text = await files[0].blob.text(); assert.ok(text.includes('<Polygon>'));
  assert.ok(!text.includes('private-field-id')); assert.ok(!text.includes('Saved private label')); assert.ok(!text.includes('owner-a'));
  assert.equal(JSON.stringify(state), source); assert.deepEqual(win.localStorage.rows, before); assert.deepEqual(win.localStorage.writes, []);
  released();
});

test('missing, unreadable and display-different saved sources hold without adopting a supplied DTO', async () => {
  const state = fixture();
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'held'); released();
  store(state); win.localStorage.failRead = true;
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'held'); released();
  win.localStorage.failRead = false;
  const stale = structuredClone(state); stale.items[0].label = 'Not the current saved row';
  assert.equal((await delivery.deliverFieldLayoutExport(options(stale))).status, 'held');
  assert.equal(files.length, 0); released();
});

test('same-site data in a different account namespace cannot substitute for this account’s source', async () => {
  const state = fixture(), foreign = structuredClone(state); foreign.zones[0].name = 'Other account label';
  store(state); const foreignKey = store(foreign, 'owner-b');
  assert.equal((await delivery.deliverFieldLayoutExport(options(foreign))).status, 'held');
  assert.ok(!win.localStorage.reads.includes(foreignKey)); assert.equal(files.length, 0); released();
});

test('loading actors, obsolete callers and pre-observer identity changes cannot start a file', async () => {
  const state = fixture(); store(state);
  assert.equal((await delivery.deliverFieldLayoutExport({ ...options(state), actor: { ...options(state).actor, loading: true } })).status, 'held');
  assert.equal((await delivery.deliverFieldLayoutExport({ ...options(state), isCurrent: () => false })).status, 'held');
  probe.actor = 'owner-b';
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'held');
  assert.equal(files.length, 0); released();
});

for (const change of ['actor', 'sample', 'source', 'source-event', 'options'] as const) {
  test(`${change} withdrawal during a share attempt prevents its later download fallback`, async () => {
    const state = fixture(); store(state); win.coarse = true;
    const waiting = deferred(); share = () => waiting.promise;
    let current = true;
    const pending = delivery.deliverFieldLayoutExport({ ...options(state), isCurrent: () => current });
    assert.equal(shareCalls, 1, 'The actual shared file helper reached its asynchronous boundary');
    if (change === 'actor') { actor('owner-b'); actor('owner-a'); }
    if (change === 'sample') { sample(true); sample(false); }
    if (change === 'source') { const replacement = structuredClone(state); replacement.lines[0].widthM = 0.5; store(replacement); }
    if (change === 'source-event') win.dispatchEvent(new Event(DESIGN_CANVAS_CHANGED_EVENT));
    if (change === 'options') current = false;
    waiting.reject(Error('Share destination unavailable'));
    const result = await pending;
    assert.equal(result.status, 'cancelled'); assert.equal(files.length, 0); released();
  });
}

test('a user-cancelled share never triggers a second file and successful sharing reports its actual route', async () => {
  const state = fixture(); store(state); win.coarse = true;
  share = async () => { const error = new Error('User cancelled'); error.name = 'AbortError'; throw error; };
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'cancelled');
  assert.equal(files.length, 0); released();
  share = async () => {};
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'shared');
  assert.equal(files.length, 0); assert.equal(shareCalls, 2); released();
});

test('explicit sample exports remain DEMO while optional field labels require a deliberate choice', async () => {
  const state = fixture(); sample(true); store(state, null, true);
  const result = await delivery.deliverFieldLayoutExport({ ...options(state), actor: { owner: null, sample: true, loading: false }, includeLabels: true });
  assert.equal(result.status, 'downloaded'); assert.match(files[0].name, /DEMO/);
  const text = await files[0].blob.text(); assert.ok(text.includes('DEMO')); assert.ok(text.includes('Saved private label'));
  assert.ok(!text.includes('private-field-id')); released();
});

test('unsafe geometry getters are never evaluated or normalized into a file', async () => {
  const state = fixture(); store(state); let calls = 0;
  Object.defineProperty(state, 'zones', { enumerable: true, get() { calls++; return []; } });
  assert.equal((await delivery.deliverFieldLayoutExport(options(state))).status, 'held');
  assert.equal(calls, 0); assert.equal(files.length, 0); released();
});

test('the export epoch context cannot be forged or used to overwrite remembered unit choices', () => {
  assert.equal(preferences.fieldLayoutExportContextIsCurrent({ kind: 'field-layout-export-context' }), false);
  const context = preferences.captureFieldLayoutExportContext(); assert.ok(context);
  const before = new Map(win.localStorage.rows);
  assert.equal(preferences.writeLengthUnitPreference(context as never, 'ft').remembered, false);
  assert.equal(preferences.writeGrowerEstimateUnitPreference(context as never, 'imperial').remembered, false);
  assert.deepEqual(win.localStorage.rows, before);
  actor('owner-b'); actor('owner-a'); assert.equal(preferences.fieldLayoutExportContextIsCurrent(context), false);
  preferences.revokeFieldLayoutExportContext(context); released();
});

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let parentExport = '';
function inspect(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'FieldBlocksPanel') {
    const attribute = node.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText(page) === 'onExport');
    if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) parentExport = attribute.initializer.expression?.getText(page) ?? '';
  }
  ts.forEachChild(node, inspect);
}
inspect(page); assert.ok(parentExport);
const executable = ts.transpileModule(`return (${parentExport});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

test('the actual parent callback binds its rendered account/source rather than borrowing a newer ref', async () => {
  const state = fixture(); store(state);
  const actorA = options(state).actor;
  const view = { current: { state, frame, selectedId: 'private-field-id', actor: actorA } };
  const mounted = { current: true };
  const action = new Function('canvasState', 'frame', 'selectedId', 'fieldEditActor', 'fieldExportView', 'fieldExportMounted', 'deliverFieldLayoutExport', executable)(
    state, frame, 'private-field-id', actorA, view, mounted, delivery.deliverFieldLayoutExport);
  assert.equal((await action({ fieldId: 'private-field-id', allFields: false, includeLabels: false }, () => true)).status, 'downloaded');
  assert.equal(files.length, 1); released();
  actor('owner-b'); store(state, 'owner-b'); view.current = { ...view.current, actor: { ...actorA, owner: 'owner-b' } };
  assert.equal((await action({ fieldId: 'private-field-id', allFields: false, includeLabels: true }, () => true)).status, 'held');
  assert.equal(files.length, 1, 'An old callback cannot borrow the replacement actor even when the form guard is mistakenly permissive'); released();
  actor('owner-a'); view.current = { ...view.current, actor: actorA }; mounted.current = false;
  assert.equal((await action({ fieldId: 'private-field-id', allFields: false, includeLabels: false }, () => true)).status, 'held');
  assert.equal(files.length, 1); released();
});
