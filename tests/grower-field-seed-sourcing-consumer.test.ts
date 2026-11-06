import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, events, account, samples, deferred } from './international-grower-operations-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerSavedNurseryReview } from '../components/crops/useGrowerWorkflow';
import type { GrowerFieldSeedSourcingSectionProps } from '../components/crops/GrowerFieldSeedSourcingSection';
import type { SavedGrowerNurseryReviewPanelProps } from '../components/crops/SavedGrowerNurseryReviewPanel';

// Accepted-cycle creation, field projection, count parsing, CSV formatting,
// composed panels and guarded download are real. The fixture owns Firebase
// and browser storage. The permission callback admits only its original opaque
// fixture view; it does not claim integration with the production hook's WeakMap.
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({ load(url, context, next) {
  if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: FieldSection } = await import('../components/crops/GrowerFieldSeedSourcingSection.tsx');
const { default: NurseryPanel } = await import('../components/crops/GrowerNurseryReviewPanel.tsx');
const { default: SavedPanel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
// Link the shared authority after the fixture has installed its Firebase hooks;
// a static import would capture the real backend before that boundary exists.
const { captureJournalObservationContext, revokeJournalObservationContext } = await import('../lib/length-unit-preference.ts');
const stamp = '2026-11-06T12:00:00.000Z';
const candidate = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) === null)!;
const vegetative = CROPS.find(crop => knownVegetativePropagationUnit(crop.key) !== null)!;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
async function fixture(cropKey = candidate.key, mutableSource = false): Promise<GrowerSavedNurseryReview> {
  const canvas = buildDemoDesignCanvasState(), siteId = 'site:0.00000,0.00000';
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [{ ...template, id: 'private-field-seed-bed', x: 0.5, y: 0.5, wM: 3, hM: 4 }]; canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    sourceRevision: 'private-field-seed-source', raw: canvas }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-field-seed-profile', cropKey, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-entered' }, fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const proposal = generateGrowerAutoPlan({ requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'private-field-seed-demand', profileId: profile.profileId, scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-field-seed-planting', acceptedAt: stamp,
    geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
  const view: GrowerSavedNurseryReview = { kind: 'saved-nursery-review', source, rows: [mutableSource ? structuredClone(row) : row],
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint },
    horizon: { state: 'missing', reason: 'not-entered' }, references: [] };
  assert.ok(projectGrowerCycles(view.rows, view.cycleContext).ownCycles.every(cycle => cycle.nurseryDemand === null));
  return view;
}

const platform = { urls: new Map<string, Blob>(), downloads: [] as { filename: string; blob: Blob }[], removed: 0,
  revoked: [] as string[], onAllocate: null as (() => void) | null, onAppend: null as (() => void) | null };
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const priorCreate = URL.createObjectURL, priorRevoke = URL.revokeObjectURL, priorTimeout = globalThis.setTimeout;
URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); const key = `blob:field-seed-${platform.urls.size}`; platform.urls.set(key, blob); platform.onAllocate?.(); return key; };
URL.revokeObjectURL = url => { platform.revoked.push(url); platform.urls.delete(url); };
// Real download cleanup timers must not keep this isolated platform fixture
// alive. Other scheduling keeps its original behavior.
Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: (callback: () => void, delay?: number) => {
  const timer = priorTimeout(callback, delay); if (delay === 10_000) timer.unref(); return timer;
} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  body: { appendChild() { platform.onAppend?.(); } },
  createElement() { return { href: '', download: '', rel: '', click() {
    const blob = platform.urls.get(this.href); assert.ok(blob); platform.downloads.push({ filename: this.download, blob });
  }, remove() { platform.removed++; } }; },
} });
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
async function mount(options: { composed?: boolean; strict?: boolean; cropKey?: string; sample?: boolean; fakeView?: boolean; mutableSource?: boolean } = {}) {
  const actual = await fixture(options.cropKey, options.mutableSource), displayed = options.fakeView ? structuredClone(actual) : actual;
  const admitted = new WeakSet([actual]);
  const gate = { calls: [] as GrowerSavedNurseryReview[], check: async (_view: GrowerSavedNurseryReview) => true };
  let props: GrowerFieldSeedSourcingSectionProps = { savedReview: displayed, contextRevision: 1, sample: options.sample,
    onCheckSavedCurrent: async checked => { gate.calls.push(checked); return admitted.has(checked) && await gate.check(checked); } };
  const element = () => options.composed ? React.createElement(NurseryPanel, { ...props, source: props.savedReview.source })
    : React.createElement(FieldSection, props);
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(options.strict ? React.createElement(React.StrictMode, null, element()) : element()); }); mounted.add(renderer);
  const section = () => renderer.root.findByProps({ 'aria-label': 'Field seed sourcing worksheet' });
  const button = (label: string) => { const found = section().findAllByType('button').find(node => text(node) === label); assert.ok(found, label); return found; };
  const labelled = (label: string, scope = section()) => { const found = scope.findAllByType('label').find(node => text(node).startsWith(label)); assert.ok(found, label); return found; };
  const change = (label: string, value: string | boolean, scope?: ReactTestInstance) => {
    const node = labelled(label, scope); const control = node.findAll(node => node.type === 'input' || node.type === 'select')[0]; assert.ok(control);
    act(() => control.props.onChange({ target: typeof value === 'boolean' ? { checked: value } : { value } }));
  };
  const ui = { renderer, actual, displayed, gate, section, button, labelled, change, text: () => text(section()),
    update(patch: Partial<GrowerFieldSeedSourcingSectionProps>) { props = { ...props, ...patch }; act(() => renderer.update(element())); },
    async press(label: string) { await act(async () => button(label).props.onClick()); },
    async open() { await this.press('Check saved field cycles for seed sourcing'); },
    async review() { await this.press('Review field seed sourcing'); },
    async download() { await this.press('Download field seed sourcing CSV'); },
    requirement(raw = '100', material: 'botanical-seed' | 'vegetative' = 'botanical-seed', confirm = true) {
      change('Planting material declaration', material); change('Your gross required seeds', raw); change('I confirm my gross whole-seed requirement', confirm);
    },
    async ready(raw = '100') {
      await this.open(); this.requirement(raw); await this.press('Add field supply group'); this.group(); await this.review();
    },
    group(label = '  My field supply  ') {
      const group = () => section().findByProps({ 'aria-label': 'Field supply group 1' });
      change('Your field supply group label', label, group()); change('Field cycle 1', true, group());
      change('I confirm these selected field cycles', true, group()); change('Allocated to this field plan', '0', group()); change('Seeds per pack', '10', group());
    },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
  return ui;
}
function reviewed(ui: Awaited<ReturnType<typeof mount>>) { return ui.section().findByProps({ 'aria-label': 'Reviewed field seed sourcing' }); }
function metric(ui: Awaited<ReturnType<typeof mount>>, label: string) {
  const entry = reviewed(ui).findAllByType('dt').find(node => text(node) === label); assert.ok(entry); return text(entry.parent!.findByType('dd'));
}
function observedActor(uid: string) {
  assert.ok(probe.auth.size > 0); probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of [...probe.auth]) notify({ uid });
}
beforeEach(async () => {
  await reset(); platform.urls.clear(); platform.downloads.length = 0; platform.removed = 0; platform.revoked.length = 0;
  platform.onAllocate = null; platform.onAppend = null;
});
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => {
  URL.createObjectURL = priorCreate; URL.revokeObjectURL = priorRevoke;
  Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: priorTimeout });
  if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument); else Reflect.deleteProperty(globalThis, 'document');
  hooks.deregister(); cleanup();
});

test('actual composed field-only saved cycles work without raising references, equipment, a nursery result or horizon', async () => {
  const ui = await mount({ composed: true }); const before = JSON.stringify([...local.rows]), beforeSession = JSON.stringify([...session.rows]);
  assert.equal(ui.actual.references.length, 0); assert.equal(ui.actual.horizon.state, 'missing'); assert.equal(ui.gate.calls.length, 0);
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Reviewed own nursery requirements' }).length, 0);
  await ui.open(); assert.equal(ui.gate.calls.length, 2); assert.ok(ui.gate.calls.every(view => view === ui.actual));
  const cycle = ui.section().findByProps({ 'aria-label': 'Field cycle 1' });
  assert.equal(cycle.findByType('select').props.value, '');
  assert.equal(ui.labelled('Your gross required seeds').findByType('input').props.value, '');
  assert.equal(ui.labelled('I confirm my gross whole-seed requirement').findByType('input').props.checked, false);
  assert.equal(ui.section().findAllByProps({ 'aria-label': 'Field supply group 1' }).length, 0);
  assert.match(ui.text(), /No nursery phase does not establish botanical direct sowing/);
  assert.equal(JSON.stringify([...local.rows]), before); assert.equal(JSON.stringify([...session.rows]), beforeSession);
});

test('a structurally valid cloned view cannot borrow the permission callback’s original opaque admission', async () => {
  const ui = await mount({ fakeView: true }); await ui.open();
  assert.equal(ui.gate.calls.length, 1); assert.notEqual(ui.displayed, ui.actual);
  assert.equal(ui.section().findAllByProps({ 'aria-label': 'Field cycle 1' }).length, 0);
  assert.match(ui.text(), /could not be confirmed/); assert.equal(platform.downloads.length, 0);
});

test('deliberately confirmed zero is preserved and the exact Unicode group label is disclosed and exported without private associations', async () => {
  const ui = await mount(), label = '  Étiquette e\u0301, “field”  ';
  const before = JSON.stringify([...local.rows]), beforeSession = JSON.stringify([...session.rows]);
  await ui.open(); ui.requirement(' 000 '); await ui.press('Add field supply group'); ui.group(label); await ui.review();
  assert.equal(metric(ui, 'Required seeds'), '0'); assert.equal(metric(ui, 'Additional seeds needed'), '0');
  assert.ok(ui.text().includes(label)); assert.match(ui.text(), /CSV includes your entered supply-group labels exactly/);
  await ui.download(); assert.equal(platform.downloads.length, 1); const file = platform.downloads[0], csv = await file.blob.text();
  assert.equal(file.filename, 'ImbewuField-field-seed-sourcing.csv'); assert.ok(csv.includes(label.replaceAll('"', '""')));
  assert.doesNotMatch(csv, /private-field-seed-|field-seed-supply-|owner-a|geometryFingerprint|seedLotReference|raisingBatchReference/);
  assert.equal(JSON.stringify([...local.rows]), before); assert.equal(JSON.stringify([...session.rows]), beforeSession);
  assert.match(ui.text(), /no stock was recorded or order placed/); assert.ok(ui.gate.calls.every(view => view === ui.actual));
});

test('blank gross counts remain Unknown, invalid whole-count spellings hold, and unknown never inherits the final stand', async () => {
  const ui = await mount(); await ui.ready(''); assert.equal(metric(ui, 'Required seeds'), 'Unknown');
  assert.equal(metric(ui, 'Additional seeds needed'), 'Unknown'); assert.match(ui.text(), /Some selected seed requirements are unknown/);
  for (const raw of ['1.25', '1,000', '1e3', '-1', '9007199254740993']) {
    ui.change('Your gross required seeds', raw); ui.change('I confirm my gross whole-seed requirement', true); await ui.review();
    assert.equal(metric(ui, 'Required seeds'), 'Unknown'); assert.match(ui.text(), /Enter a safe whole seed count/);
    assert.equal(ui.labelled('Your gross required seeds').findByType('input').props.value, raw);
  }
});

test('known vegetative material stays held even after a botanical declaration and entered seed count', async () => {
  const ui = await mount({ cropKey: vegetative.key }); await ui.ready('100');
  assert.match(ui.text(), /recorded propagation material is vegetative/i); assert.equal(metric(ui, 'Required seeds'), 'Unknown');
  assert.match(ui.text(), /Review needed/); assert.doesNotMatch(text(reviewed(ui)), /Planning counts complete/);
});

test('a draft edit retires reviewed/export handlers and duplicate operations cannot begin or edit while awaiting source checks', async () => {
  const ui = await mount(); await ui.ready(); const retainedDownload = ui.button('Download field seed sourcing CSV').props.onClick;
  const retainedEdit = ui.labelled('Your gross required seeds').findByType('input').props.onChange;
  ui.change('Your gross required seeds', '200'); act(() => retainedDownload()); assert.equal(platform.downloads.length, 0);
  ui.change('I confirm my gross whole-seed requirement', true);
  const wait = deferred<boolean>(); ui.gate.check = () => wait.promise;
  const reviewButton = ui.button('Review field seed sourcing').props.onClick, calls = ui.gate.calls.length;
  act(() => { reviewButton(); reviewButton(); retainedEdit({ target: { value: '999' } }); });
  assert.equal(ui.gate.calls.length, calls + 1); assert.equal(ui.labelled('Your gross required seeds').findByType('input').props.value, '200');
  ui.gate.check = async () => true; await act(async () => wait.resolve(true)); assert.equal(metric(ui, 'Required seeds'), '200');
  act(() => { retainedDownload(); reviewButton(); }); assert.equal(platform.downloads.length, 0);
});

for (const change of ['view', 'revision', 'source']) test(`${change} changes withdraw old view, draft and handlers before a late source check returns`, async () => {
  const ui = await mount({ mutableSource: change === 'source' }); await ui.ready(); const retained = ui.button('Download field seed sourcing CSV').props.onClick;
  const wait = deferred<boolean>(); ui.gate.check = () => wait.promise; act(() => retained());
  if (change === 'view') ui.update({ savedReview: structuredClone(ui.actual) });
  else if (change === 'revision') ui.update({ contextRevision: 2 });
  else {
    const row = (ui.actual.rows as { variety?: string }[])[0];
    assert.equal(Object.isExtensible(row), true, 'the source-change fixture is a detached mutable accepted row');
    row.variety = 'Changed private variety'; ui.update({});
  }
  assert.equal(ui.section().findAllByProps({ 'aria-label': 'Reviewed field seed sourcing' }).length, 0);
  await act(async () => wait.resolve(true)); act(() => retained()); assert.equal(platform.downloads.length, 0);
});

test('observed actor ABA and sample events retire original authority even when the displayed props return unchanged', async () => {
  const ui = await mount(); await ui.ready(); const retained = ui.button('Download field seed sourcing CSV').props.onClick;
  // The consumer releases its own proof at the first edge. Another real
  // purpose keeps the shared scope subscribed so both ABA edges are observed.
  const anchor = captureJournalObservationContext(); assert.ok(anchor);
  try {
    act(() => { observedActor('owner-b'); observedActor('owner-a'); retained(); });
    assert.equal(ui.section().findAllByProps({ 'aria-label': 'Field cycle 1' }).length, 0); assert.equal(platform.downloads.length, 0);
    await ui.ready(); act(() => { events.dispatchEvent(new Event('imbewu-sample-mode-changed')); retained(); });
    assert.equal(ui.section().findAllByProps({ 'aria-label': 'Field cycle 1' }).length, 0); assert.equal(platform.downloads.length, 0);
    await ui.ready(); act(() => { samples.enterSampleMode(); samples.exitSampleMode(); retained(); });
    assert.equal(ui.section().findAllByProps({ 'aria-label': 'Field cycle 1' }).length, 0); assert.equal(platform.downloads.length, 0);
    await ui.ready(); await ui.download(); assert.equal(platform.downloads.length, 1);
  } finally { revokeJournalObservationContext(anchor); }
});

test('a delayed pre-click download check withholds the file when the source changes after DOM preparation', async () => {
  const ui = await mount(); await ui.ready(); const wait = deferred<boolean>();
  platform.onAppend = () => { ui.gate.check = () => wait.promise; };
  act(() => ui.button('Download field seed sourcing CSV').props.onClick());
  await act(async () => { for (let i = 0; i < 12 && !platform.urls.size; i++) await Promise.resolve(); });
  assert.equal(platform.urls.size, 1); ui.update({ contextRevision: 2 });
  await act(async () => wait.resolve(true)); assert.equal(platform.downloads.length, 0); assert.equal(platform.urls.size, 0);
  assert.ok(platform.removed > 0); assert.ok(platform.revoked.length > 0);
});

for (const boundary of ['allocation', 'append']) test(`source withdrawal during platform ${boundary} cannot escape the final guarded click`, async () => {
  const ui = await mount(); await ui.ready();
  const withdraw = () => ui.update({ contextRevision: 2 });
  if (boundary === 'allocation') platform.onAllocate = withdraw; else platform.onAppend = withdraw;
  await ui.download(); assert.equal(platform.downloads.length, 0); assert.equal(platform.urls.size, 0);
});

for (const retirement of ['source', 'actor']) test(`queued ${retirement} retirement after final async admission is checked synchronously before click`, async () => {
  const ui = await mount(); await ui.ready(); let queued = false, retired = false;
  platform.onAppend = () => {
    ui.gate.check = async () => {
      // The first storage observation after this reader resolves is inside the
      // consumer predicate's final operation check. Queue retirement after that
      // synchronous check returns true, before the delivery await resumes.
      session.onRead = () => {
        session.onRead = null; queued = true;
        queueMicrotask(() => {
          if (retirement === 'source') ui.update({ contextRevision: 2 });
          else act(() => observedActor('owner-b'));
          retired = true;
        });
      };
      return true;
    };
  };
  await ui.download();
  assert.equal(queued, true, 'the final admitted operation actually queued the adverse transition');
  assert.equal(retired, true); assert.equal(platform.downloads.length, 0);
  assert.equal(platform.urls.size, 0); assert.ok(platform.removed > 0); assert.ok(platform.revoked.length > 0);
});

test('a late old finally cannot clear the new operation after source A-B-A, and retained callbacks cannot restart it', async () => {
  const ui = await mount(); await ui.ready(); const old = deferred<boolean>(); ui.gate.check = () => old.promise;
  const retained = ui.button('Download field seed sourcing CSV').props.onClick; act(() => retained());
  ui.update({ contextRevision: 2 }); ui.update({ contextRevision: 1 });
  const fresh = deferred<boolean>(); ui.gate.check = () => fresh.promise;
  act(() => ui.button('Check saved field cycles for seed sourcing').props.onClick());
  await act(async () => old.resolve(true));
  assert.equal(ui.button('Check saved field cycles for seed sourcing').props.disabled, true);
  act(() => retained()); assert.equal(platform.downloads.length, 0);
  ui.gate.check = async () => true; await act(async () => fresh.resolve(true));
  assert.equal(ui.button('Check saved field cycles for seed sourcing').props.disabled, false);
});

test('unmount blocks retained callbacks and late permission delivery; StrictMode replay acquires only current explicit authority', async () => {
  const ui = await mount(), wait = deferred<boolean>(); ui.gate.check = () => wait.promise;
  const retained = ui.button('Check saved field cycles for seed sourcing').props.onClick; act(() => retained()); ui.dispose();
  const calls = ui.gate.calls.length; await act(async () => wait.resolve(true)); act(() => retained()); assert.equal(ui.gate.calls.length, calls);
  const current = await mount({ strict: true }); assert.equal(current.gate.calls.length, 0); await current.ready();
  assert.equal(metric(current, 'Required seeds'), '100'); assert.equal(platform.downloads.length, 0);
});

test('initial sample text is hydration-consistent and DEMO is reconciled after mount without automatic review or download', async () => {
  const view = await fixture(), props: GrowerFieldSeedSourcingSectionProps = { savedReview: view, contextRevision: 1, onCheckSavedCurrent: async () => true };
  const element = React.createElement(FieldSection, props), first = renderToString(element);
  session.rows.set('imbewu_sample_mode', '1'); assert.equal(renderToString(element), first);
  const ui = await mount(); assert.match(ui.text(), /DEMO/); assert.equal(ui.gate.calls.length, 0); assert.equal(platform.downloads.length, 0);
});

test('saved-panel checking and blocked-view gates still withhold the entire additive field consumer', async () => {
  const view = await fixture(); let props: SavedGrowerNurseryReviewPanelProps = { review: view, checking: true, contextRevision: 1,
    onRefresh: async () => ({ status: 'held', reason: 'fixture' } as Awaited<ReturnType<SavedGrowerNurseryReviewPanelProps['onRefresh']>>),
    onCheckCurrent: async checked => checked === view, onSaveReferences: async () => ({ status: 'held', reasons: ['fixture'] }) };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(SavedPanel, props)); }); mounted.add(renderer);
  assert.equal(renderer.root.findAllByType(FieldSection).length, 0);
  props = { ...props, checking: false }; act(() => renderer.update(React.createElement(SavedPanel, props)));
  assert.equal(renderer.root.findAllByType(FieldSection).length, 1);
  const refresh = renderer.root.findAllByType('button').find(node => text(node) === 'Check saved nursery batches')!;
  await act(async () => refresh.props.onClick()); assert.equal(renderer.root.findAllByType(FieldSection).length, 0);
});
