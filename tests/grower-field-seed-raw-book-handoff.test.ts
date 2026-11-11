import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The real hook and page reader own admission. This isolated process replaces
// only platform/source services with memory boundaries; no WeakSet or projected
// view can stand in for the hook's private saved-book binding.
const child = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = process.cwd() + '/';
const require = createRequire(root + 'package.json');
const ts = require('typescript'), React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
class MemoryStorage {
  rows = new Map();
  get length() { return this.rows.size; }
  key(index) { return [...this.rows.keys()][index] ?? null; }
  getItem(key) { return this.rows.get(key) ?? null; }
  setItem(key, value) { this.rows.set(key, String(value)); }
  removeItem(key) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
const boundary = { raw: null, actorUid: 'owner-a', auth: new Set() };
Object.assign(globalThis, { window: events, localStorage: local, sessionStorage: session,
  Storage: MemoryStorage, __fieldRawBookBoundary: boundary });
const data = source => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
const sourceModule = [
  'const b=()=>globalThis.__fieldRawBookBoundary;',
  'const read=()=>({status:"ready",raw:structuredClone(b().raw),revision:JSON.stringify(b().raw),ownerUid:"owner-a",sample:false});',
  'export const readCanvasSourceReceipt=read;export const readFacilitatorSourceReceipt=read;',
  'export const DESIGN_CANVAS_CHANGED_EVENT="imbewu-design-canvas-changed";',
].join('\n');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts')) {
      if (specifier === '@/lib/design-canvas' || specifier === '@/lib/facilitator-design') return data(sourceModule);
      if (specifier === '@/lib/db/queries') return data('export const myDesigns=async()=>[];');
    }
    if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return data(
      'export const isBackendConfigured=()=>true;export const getFirebase=()=>({auth:{currentUser:{uid:globalThis.__fieldRawBookBoundary.actorUid}}});');
    if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(
      'export const onAuthStateChanged=(_auth,listener)=>{const set=globalThis.__fieldRawBookBoundary.auth;set.add(listener);return()=>set.delete(listener)};');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith(pathToFileURL(root).href)
      || !(url.endsWith('.tsx') || url.endsWith('/components/crops/useGrowerWorkflow.ts'))) return next(url, context);
    // Compose with upstream loaders so a frozen-source overlay can exercise this
    // identical regression against the old implementation without editing files.
    const loaded = next(url, { ...context, format: 'module' });
    const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
    return { ...loaded, format: 'module', shortCircuit: true,
      source: ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
  },
});

const fixture = await import(pathToFileURL(root + 'tests/crop-plan-storage-fixture.ts').href);
const cropBook = await import(pathToFileURL(root + 'lib/crop-plan.ts').href);
const account = await import(pathToFileURL(root + 'lib/account-local-storage.ts').href);
const { isSampleMode } = await import(pathToFileURL(root + 'lib/sample-mode.ts').href);
const { CROPS } = await import(pathToFileURL(root + 'lib/crop-catalog.ts').href);
const { growerPlanningScopeKey } = await import(pathToFileURL(root + 'lib/international/grower-planning.ts').href);
const { createGrowerCyclePlanting } = await import(pathToFileURL(root + 'lib/international/grower-cycle.ts').href);
const { useGrowerWorkflow } = await import(pathToFileURL(root + 'components/crops/useGrowerWorkflow.ts').href);
const { default: SavedPanel } = await import(pathToFileURL(root + 'components/crops/SavedGrowerNurseryReviewPanel.tsx').href);
account.bindMountedAccountLocalStorageUid('owner-a');
await fixture.initialiseCropPlanFixture();

// Explicit engineering fixtures, never farming recommendations or calendar defaults.
const siteId = 'site:0.00000,0.00000', scope = { kind: 'mapped-site', siteId };
const stamp = '2026-11-06T12:00:00.000Z';
const own = (value, unit) => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt: stamp } });
boundary.raw = { siteId, frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
  items: [{ id: 'bed-a', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4, rot: 0 }],
  zones: [], lines: [], step: 'planting', updatedAt: stamp, rev: 1 };
const initial = { version: 1, plantings: [], harvestTargets: [
  { id: 'own-target', siteId, cropKey: CROPS[0].key, startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 7, marketablePercent: 100 }],
  growerPlanningProfiles: [{ version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(2, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'),
    allowedEntryMonths: own([12], 'utc-months'),
  } }], nursery: { version: 1, profiles: [], containers: [], spaces: [] }, updatedAt: Date.now() - 1000 };
assert.equal(cropBook.saveCropPlan(initial), true);
const loaded = cropBook.loadCropPlanWithWriteAdmission();
const state = {
  plan: loaded.book, productionSiteId: siteId, growerOwner: 'owner-a', growerSample: false,
  growerScopeKey: growerPlanningScopeKey(scope),
  growerBookContext: { current: { siteId, owner: 'owner-a', sample: false, scopeKey: growerPlanningScopeKey(scope) } },
  planWriteBase: { current: { owner: 'owner-a', sample: false, token: loaded.token,
    planKey: JSON.stringify(loaded.book), admission: loaded.admission } },
  planSaveConflict: false,
  activeAccountUid: account.activeAccountUid, isSampleMode, isBackendConfigured: () => true,
  getFirebase: () => ({ auth: { currentUser: { uid: boundary.actorUid } } }),
  cropPlanWriteToken: cropBook.cropPlanWriteToken, readRawCropPlanReceipt: cropBook.readRawCropPlanReceipt,
  cropPlanWriteAdmissionMatches: cropBook.cropPlanWriteAdmissionMatches,
  loadCropPlanWithWriteAdmission: cropBook.loadCropPlanWithWriteAdmission,
  setPlanSaveConflict(value) { state.planSaveConflict = value; },
};
const page = ts.createSourceFile('page.tsx', readFileSync(root + 'app/facilitator/crops/page.tsx', 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'readCurrentGrowerBook', 'rememberStoredPlan'];
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) functions.set(node.name.text, node.getText(page));
  ts.forEachChild(node, visit);
}
visit(page);
assert.equal(functions.size, names.length, 'exercise the actual parent actor and raw-book reader functions');
const parentSource = ts.transpileModule([...functions.values()].join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const parent = new Function('context', 'with(context){' + parentSource + ';return {' + names.join(',') + '}}')(state);
const input = { selection: { kind: 'studio-canvas', sourceId: siteId }, scope, resourceSiteId: siteId,
  book: state.plan, actorIsCurrent: parent.growerActorIsCurrent, readCurrentBook: parent.readCurrentGrowerBook };

const platform = { urls: new Map(), clicks: [], timers: [], prepared: false, removes: 0, revoked: 0 };
const priorCreate = URL.createObjectURL, priorRevoke = URL.revokeObjectURL, priorTimeout = globalThis.setTimeout;
let renderer, latest, hookRenders = 0, originalView, originalViewJSON, originalReceipt;
let completedChecks = 0, waiters = [], armed = false, injected = false, mutation = null, eventCount = 0;
const settle = () => new Promise(resolve => setImmediate(resolve));
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
function waitForChecks(count) {
  return completedChecks >= count ? Promise.resolve() : new Promise(resolve => { waiters.push({ count, resolve }); });
}
function completeCheck() {
  completedChecks++;
  for (const waiter of waiters.filter(row => completedChecks >= row.count)) waiter.resolve();
  waiters = waiters.filter(row => completedChecks < row.count);
}
function field() { return renderer.root.findByProps({ 'aria-label': 'Field seed sourcing worksheet' }); }
function button(label) {
  const found = renderer.root.findAllByType('button').find(node => text(node) === label);
  assert.ok(found, 'actual composed button: ' + label); return found;
}
function change(label, value, group = field()) {
  const found = group.findAllByType('label').find(node => text(node).startsWith(label));
  assert.ok(found, label);
  const control = found.findAll(node => node.type === 'input' || node.type === 'select')[0];
  assert.ok(control, label + ' control');
  act(() => control.props.onChange({ target: typeof value === 'boolean' ? { checked: value } : { value } }));
}
async function press(label, checks) {
  const until = completedChecks + checks;
  await act(async () => { button(label).props.onClick(); await waitForChecks(until); await settle(); });
}
function Harness() {
  hookRenders++;
  latest = useGrowerWorkflow(input);
  const checked = latest.onCheckSavedNurseryCurrent;
  const check = async view => {
    const allowed = await checked(view);
    if (armed && platform.prepared && !injected && allowed === true) {
      injected = true;
      queueMicrotask(() => {
        const before = fixture.readCanonicalCropPlanFixtureRaw(), eventsBefore = eventCount;
        const current = cropBook.loadCropPlan();
        const saved = cropBook.saveCropPlan({ ...current, plantings: [], updatedAt: Date.now() + 1 });
        mutation = { actualHookAllowed: allowed, writerSaved: saved,
          rawBookChanged: before !== fixture.readCanonicalCropPlanFixtureRaw(), normalWriterEvents: eventCount - eventsBefore,
          receiptCurrent: originalReceipt.isCurrent(), parentReaderStatus: parent.readCurrentGrowerBook().status,
          originalViewUnchanged: JSON.stringify(originalView) === originalViewJSON, hookRenders };
      });
    }
    completeCheck(); return allowed;
  };
  // Propagate the real hook's current view and revision on every parent render.
  // This extra prop is simply undefined/ignored by the old implementation; its
  // positive path still executes, so old-source failure must be the stale click.
  return React.createElement(SavedPanel, {
    review: latest.savedNurseryReview, checking: latest.savedNurseryChecking, settings: input.book.nursery,
    contextRevision: latest.contextRevision, sample: false, onRefresh: latest.onReadSavedNursery,
    onCheckCurrent: check, onCheckBindingCurrent: latest.onCheckSavedNurseryBindingCurrent,
    onSaveReferences: latest.onSaveNurseryBatchReferences, onRecordSowing: latest.onRecordNurserySowing,
    onRecordProgress: latest.onRecordNurseryProgress, onRecordFieldPlanting: latest.onRecordNurseryFieldPlanting,
  });
}
try {
  events.addEventListener(cropBook.CROP_PLAN_CHANGED_EVENT, () => { eventCount++; });
  URL.createObjectURL = blob => { const key = 'blob:raw-book-' + platform.urls.size;
    platform.urls.set(key, blob); platform.prepared = true; return key; };
  URL.revokeObjectURL = key => { platform.revoked++; platform.urls.delete(key); };
  Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: (callback, delay, ...args) => {
    if (delay === 10_000) { platform.timers.push(callback); return 1; }
    return priorTimeout(callback, delay, ...args);
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    body: { appendChild() {} }, createElement() { return { hidden: false, tabIndex: 0, href: '', download: '', rel: '',
      click() { platform.clicks.push({ receiptCurrent: originalReceipt.isCurrent(),
        parentReaderStatus: parent.readCurrentGrowerBook().status, originalViewUnchanged: JSON.stringify(originalView) === originalViewJSON }); },
      remove() { platform.removes++; platform.prepared = false; },
    }; },
  } });
  act(() => { renderer = create(React.createElement(Harness)); });
  await act(async () => { await latest.onRefresh(); });
  const draft = { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: 'own-target', profileId: 'own-profile' }],
    available: [{ bedId: 'bed-a', start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true }], assumptionsConfirmed: true };
  let reviewed;
  await act(async () => { reviewed = await latest.onReview(draft); });
  assert.equal(reviewed.status, 'review'); assert.equal(reviewed.proposal.status, 'ready');
  const row = createGrowerCyclePlanting(reviewed.proposal.cycles[0], {
    plantingId: 'raw-book-engineering-fixture', acceptedAt: stamp, geometryFingerprint: latest.source.geometryFingerprint,
  });
  assert.ok(row);
  await act(async () => {
    assert.equal(cropBook.saveCropPlan({ ...state.plan, plantings: [row], updatedAt: Date.now() }), true);
    const current = cropBook.loadCropPlanWithWriteAdmission();
    state.plan = current.book; parent.rememberStoredPlan(current.book, current.token); input.book = current.book;
    renderer.update(React.createElement(Harness));
  });
  let saved;
  await act(async () => { saved = await latest.onReadSavedNursery(); });
  assert.equal(saved.status, 'ready'); originalView = saved.view; originalViewJSON = JSON.stringify(originalView);
  originalReceipt = parent.readCurrentGrowerBook();
  assert.equal(originalReceipt.status, 'ready'); assert.equal(originalReceipt.isCurrent(), true);
  assert.equal(await latest.onCheckSavedNurseryCurrent(structuredClone(originalView)), false,
    'a structurally identical view cannot borrow the actual hook binding');

  await press('Check saved field cycles for seed sourcing', 2);
  change('Planting material declaration', 'botanical-seed'); change('Your gross required seeds', '100');
  change('I confirm my gross whole-seed requirement', true);
  act(() => button('Add field supply group').props.onClick());
  const group = renderer.root.findByProps({ 'aria-label': 'Field supply group 1' });
  change('Your field supply group label', 'Engineering fixture supplies', group); change('Field cycle 1', true, group);
  change('I confirm these selected field cycles', true, group); change('Allocated to this field plan', '0', group);
  change('Seeds per pack', '10', group);
  await press('Review field seed sourcing', 2);
  await press('Download field seed sourcing CSV', 4);
  assert.equal(platform.clicks.length, 1, 'positive control: actual fresh saved-book binding permits one real delivery click');
  assert.deepEqual(platform.clicks[0], { receiptCurrent: true, parentReaderStatus: 'ready', originalViewUnchanged: true });
  for (const callback of platform.timers.splice(0)) callback();
  assert.equal(platform.urls.size, 0);

  const clicksBefore = platform.clicks.length, removesBefore = platform.removes, revokedBefore = platform.revoked;
  const until = completedChecks + 4;
  armed = true;
  act(() => button('Download field seed sourcing CSV').props.onClick());
  await waitForChecks(until); await settle(); await settle();
  assert.ok(mutation, 'the final real async source check reached a successful result before the queued writer ran');
  assert.equal(mutation.actualHookAllowed, true); assert.equal(mutation.writerSaved, true);
  assert.equal(mutation.rawBookChanged, true); assert.equal(mutation.normalWriterEvents, 1);
  assert.equal(mutation.receiptCurrent, false); assert.equal(mutation.parentReaderStatus, 'held');
  assert.equal(mutation.originalViewUnchanged, true, 'only the actual raw book changed; displayed DTO bytes did not');
  assert.equal(platform.clicks.length, clicksBefore,
    'A canonical raw-book change after async admission must not reach the browser download click');
  assert.equal(platform.removes, removesBefore + 1); assert.equal(platform.revoked, revokedBefore + 1);
  assert.equal(platform.prepared, false); assert.equal(platform.urls.size, 0); assert.equal(platform.timers.length, 0);
  assert.equal(originalReceipt.isCurrent(), false); assert.equal(parent.readCurrentGrowerBook().status, 'held');
  assert.equal(await latest.onCheckSavedNurseryCurrent(originalView), false);
  assert.equal(latest.savedNurseryReview, null);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Field seed sourcing worksheet' }).length, 0,
    'the real parent propagation retires the field view as well as withholding its handoff');
  process.stdout.write(JSON.stringify({ positiveDownloads: clicksBefore, staleDownloads: platform.clicks.length - clicksBefore,
    actualRawBookChanged: mutation.rawBookChanged, normalWriterEvents: mutation.normalWriterEvents,
    originalReceiptCurrent: originalReceipt.isCurrent(), parentReaderStatus: parent.readCurrentGrowerBook().status,
    originalViewUnchanged: mutation.originalViewUnchanged, parentRetiredView: latest.savedNurseryReview === null }));
} finally {
  if (renderer) act(() => renderer.unmount());
  for (const callback of platform.timers) callback();
  URL.createObjectURL = priorCreate; URL.revokeObjectURL = priorRevoke;
  Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: priorTimeout });
  fixture.releaseCropPlanFixture(); account.bindMountedAccountLocalStorageUid(null); hooks.deregister();
}
`;

test('a real saved-book change after the final async check withholds a composed field worksheet download', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = execFileSync(process.execPath, ['--import', root + 'tests/register-alias.mjs', '--input-type=module', '--eval', child], {
    cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 1 << 20,
  });
  const observation = JSON.parse(output);
  assert.equal(observation.positiveDownloads, 1);
  assert.equal(observation.staleDownloads, 0);
  assert.equal(observation.actualRawBookChanged, true);
  assert.equal(observation.normalWriterEvents, 1);
  assert.equal(observation.originalReceiptCurrent, false);
  assert.equal(observation.parentReaderStatus, 'held');
  assert.equal(observation.originalViewUnchanged, true);
  assert.equal(observation.parentRetiredView, true);
});
