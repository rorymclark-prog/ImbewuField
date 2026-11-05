import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource, type GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { resolveGrowerNurseryBatchReference } from '../lib/international/grower-nursery.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { createJournalEntry, inspectJournalNurseryProgress, type JournalEntry } from '../lib/field-journal.ts';
import type { GrowerFieldObservationResult, GrowerNurseryProgressInput } from '../lib/grower-field-observation.ts';
import type { GrowerSavedNurseryReview } from '../components/crops/useGrowerWorkflow.ts';
import type { NurseryProgressObservationFormProps } from '../components/crops/NurseryProgressObservationForm.tsx';
import type { SavedGrowerNurseryReviewPanelProps } from '../components/crops/SavedGrowerNurseryReviewPanel.tsx';

const prior = new Map(['IS_REACT_ACT_ENVIRONMENT', 'window', 'self'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const root = new URL('../', import.meta.url).href;
const module = (code: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/journal/JournalEntrySheet.tsx')) {
      if (specifier === '@/lib/i18n') return module('export const useLanguage=()=>({lang:"en"});');
      if (specifier === '@/lib/app-level') return module('export const useAppLevel=()=>"simple";');
    }
    if (context.parentURL?.startsWith(root) && specifier.endsWith('.module.css')) return module('export default {};');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { default: Form } = await import('../components/crops/NurseryProgressObservationForm.tsx');
const { default: SavedPanel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
const { default: Summary } = await import('../components/journal/JournalNurseryProgressSummary.tsx');
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });
// The view uses actual saved-cycle and reference authorities. Only the record
// callback is controlled: this suite does not simulate the production writer or
// claim a journal storage receipt. Historical entries use the real inspector.
async function fixture(): Promise<GrowerSavedNurseryReview> {
  const canvas = buildDemoDesignCanvasState(); canvas.siteId = 'site:0.00000,0.00000'; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  canvas.items = [{ ...canvas.items.find(row => row.defId === 'veg_bed')!, id: 'private-progress-bed', label: 'Fixture growing space', wM: 3, hM: 4 }]; canvas.lines = []; canvas.zones = [];
  const checked = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId, raw: canvas, sourceRevision: 'private-progress-receipt' }));
  assert.equal(checked.status, 'ready'); if (checked.status !== 'ready') throw Error('Saved source fixture required');
  const source: GrowerWorkflowSource = checked;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-progress-profile', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })), planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-progress-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'), harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-progress-planting', acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
  const rows = [{ ...row, variety: 'Entered variety label' }], cycleContext = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const cycle = projectGrowerCycles(rows, cycleContext).ownCycles[0]; assert.ok(cycle.nurseryDemand);
  return { kind: 'saved-nursery-review', source, rows, cycleContext, horizon: own(cycle.nurseryDemand.interval, 'utc-date-window'), references: [{
    plantingId: row.id, cropKey: row.cropKey, bedId: row.bedId, startDate: cycle.nurseryDemand.interval.start, endDateExclusive: cycle.nurseryDemand.interval.endExclusive,
    reference: resolveGrowerNurseryBatchReference(rows, cycleContext, row.id),
  }] };
}
const mounted = new Set<ReactTestRenderer>();
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function defer<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function form(view: GrowerSavedNurseryReview) {
  let renderer!: ReactTestRenderer;
  let handler: NurseryProgressObservationFormProps['onRecord'] = async () => ({ status: 'saved', message: 'Observation saved in the journal.' });
  const calls: { input: GrowerNurseryProgressInput; current: () => boolean }[] = [];
  let props: NurseryProgressObservationFormProps = { view, plantingId: view.references[0].plantingId, contextRevision: 1,
    onRecord: async (input, current) => { calls.push({ input, current }); return handler(input, current); } };
  act(() => { renderer = create(React.createElement(Form, props)); }); mounted.add(renderer);
  const field = (label: string) => { const node = renderer.root.findAllByType('label').find(row => text(row).startsWith(label)); assert.ok(node, label); return node.findAll(row => row.type === 'input' || row.type === 'textarea' || row.type === 'select')[0]; };
  const button = (label = 'Save nursery count observation') => { const node = renderer.root.findAllByType('button').find(row => text(row) === label); assert.ok(node, label); return node; };
  return { renderer, calls, field, button, text: () => text(renderer.root), handler(next: typeof handler) { handler = next; },
    edit(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    confirm(value = true) { act(() => field('I confirm this day').props.onChange({ target: { checked: value } })); },
    async press(label?: string) { await act(async () => { button(label).props.onClick(); await Promise.resolve(); }); },
    update(patch: Partial<NurseryProgressObservationFormProps>) { props = { ...props, ...patch }; act(() => renderer.update(React.createElement(Form, props))); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
function fill(ui: ReturnType<typeof form>, count = '0', stage = 'alive', coverage = 'whole-batch') {
  ui.edit('Actual observed day', '2026-11-05'); ui.edit('What you observed', 'I counted plants in the nursery.');
  ui.edit('Plants you observed', count); ui.edit('Your assessment', stage); ui.edit('What you counted', coverage); ui.confirm();
}
function history(plantsObserved = 0, stage: 'emerged' | 'alive' | 'ready' = 'ready', coverage: 'whole-batch' | 'checked-subset' = 'checked-subset'): JournalEntry {
  return createJournalEntry({ date: '2026-11-05', title: 'Entered nursery count', notes: 'Original ordinary journal note.', category: 'planting', bedId: 'historic-bed',
    growerCycleLink: { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' }, plantingId: 'historic-planting', bedId: 'historic-bed', eventKind: 'nursery-start', plannedDate: '2028-02-09' },
    nurseryProgress: { kind: 'nursery-progress-observation', version: 1, plantsObserved, stage, coverage,
      references: { variety: 'Historical variety label', seedLotReference: 'Historical lot label', raisingBatchReference: null } },
  }, 1000);
}
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('count form starts with no planned values, inferred stage or coverage and readonly reference labels', async () => {
  const view = await fixture(), before = JSON.stringify(view), ui = form(view);
  for (const label of ['Actual observed day', 'What you observed', 'Plants you observed', 'Your assessment', 'What you counted']) {
    const control = ui.field(label); assert.equal(control.props.value, ''); assert.match(control.props.className, /min-h-11/); assert.equal(control.parent!.props.htmlFor, control.props.id);
  }
  assert.equal(ui.field('I confirm this day').props.checked, false); assert.equal(ui.button().props.disabled, true);
  assert.match(ui.text(), /Entered variety label/); assert.match(ui.text(), /do not verify seed identity/);
  assert.match(ui.text(), /Repeated observations are not added together as stock/); assert.match(ui.text(), /not a readiness certificate/);
  assert.equal(ui.calls.length, 0); assert.equal(JSON.stringify(view), before);
});

for (const [stage, coverage, count] of [['emerged', 'whole-batch', '0'], ['alive', 'checked-subset', '2'], ['ready', 'whole-batch', '1']] as const) {
  test(`explicit ${stage}/${coverage} count submits exactly the six observed fields, including real zero`, async () => {
    const view = await fixture(), ui = form(view); fill(ui, count, stage, coverage); await ui.press();
    assert.equal(ui.calls.length, 1); assert.deepEqual(ui.calls[0].input, { observedDate: '2026-11-05', note: 'I counted plants in the nursery.', plantsObserved: Number(count), stage, coverage, confirmed: true });
    assert.notEqual(ui.calls[0].input.observedDate, view.references[0].startDate);
    assert.equal(ui.renderer.root.findByType('a').props.href, '/journal'); assert.match(ui.renderer.root.findByType('a').props.className, /min-h-11/);
  });
}

test('blank count is not zero and day, note, whole safe count, stage, coverage and confirmation are all required', async () => {
  const ui = form(await fixture()); fill(ui); ui.confirm(false); await ui.press(); assert.equal(ui.calls.length, 0); ui.confirm();
  for (const count of ['', '1.5', '-1', '1e2', '9007199254740992']) { ui.edit('Plants you observed', count); await ui.press(); assert.equal(ui.calls.length, 0); }
  ui.edit('Plants you observed', '0'); ui.edit('Your assessment', ''); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('Your assessment', 'ready'); ui.edit('What you counted', ''); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('What you counted', 'checked-subset'); ui.edit('Actual observed day', '2026-02-30'); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('Actual observed day', '2026-11-05'); ui.edit('What you observed', ' '); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('What you observed', 'Observed count note'); await ui.press(); assert.equal(ui.calls.length, 1);
});

test('stable original intent blocks reentrant appends and held retries keep one proof until a deliberate edit', async () => {
  const ui = form(await fixture()), waiting = defer<GrowerFieldObservationResult>(); ui.handler(async () => waiting.promise); fill(ui);
  const submit = ui.button().props.onClick; act(() => { submit(); submit(); }); assert.equal(ui.calls.length, 1);
  const proof = ui.calls[0].current; assert.equal(proof(), true);
  await act(async () => waiting.resolve({ status: 'held', message: 'Check records.' }));
  ui.handler(async () => ({ status: 'held', message: 'Still held.' })); await ui.press(); assert.equal(ui.calls[1].current, proof);
  const staleChange = ui.field('What you counted').props.onChange;
  ui.edit('Your assessment', 'ready'); assert.equal(proof(), false);
  act(() => staleChange({ target: { value: 'checked-subset' } })); assert.equal(ui.field('What you counted').props.value, 'whole-batch');
  await ui.press(); assert.notEqual(ui.calls[2].current, proof);
});

test('saved count cannot append twice and explicit new intent clears all six inputs', async () => {
  const ui = form(await fixture()); fill(ui, '2', 'ready', 'checked-subset'); const submit = ui.button().props.onClick;
  await ui.press(); act(() => submit()); await ui.press(); assert.equal(ui.calls.length, 1);
  const another = ui.button('Record another nursery count').props.onClick; await ui.press('Record another nursery count');
  for (const label of ['Actual observed day', 'What you observed', 'Plants you observed', 'Your assessment', 'What you counted']) assert.equal(ui.field(label).props.value, '');
  assert.equal(ui.field('I confirm this day').props.checked, false);
  ui.edit('What you observed', 'New note'); act(() => another()); assert.equal(ui.field('What you observed').props.value, 'New note');
  fill(ui); await ui.press(); assert.equal(ui.calls.length, 2); assert.notEqual(ui.calls[0].current, ui.calls[1].current);
});

test('uncertain receipt consumes the original count intent and asks for journal inspection without retry or reset', async () => {
  const ui = form(await fixture()); ui.handler(async () => ({ status: 'unconfirmed', message: 'Final receipt not confirmed.' })); fill(ui);
  const submit = ui.button().props.onClick; await ui.press(); act(() => submit()); await ui.press(); assert.equal(ui.calls.length, 1);
  assert.match(ui.text(), /Inspect the journal before recording again/); assert.match(ui.text(), /no automatic retry/);
  assert.equal(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Record another nursery count'), false);
  assert.equal(ui.field('Actual observed day').props.disabled, true); assert.equal(ui.renderer.root.findByType('a').props.href, '/journal');
});

for (const change of ['source', 'revision', 'sample'] as const) test(`pending count is withdrawn by ${change} change and late success is not shown`, async () => {
  const view = await fixture(), ui = form(view), waiting = defer<GrowerFieldObservationResult>(); ui.handler(async () => waiting.promise); fill(ui); await ui.press();
  ui.update(change === 'source' ? { view: { ...view } } : change === 'sample' ? { sample: true } : { contextRevision: 2 });
  assert.equal(ui.calls[0].current(), false); await act(async () => waiting.resolve({ status: 'saved', message: 'Stale success forbidden.' }));
  assert.doesNotMatch(ui.text(), /Stale success forbidden/); assert.match(ui.text(), /earlier checked batch/);
});

test('observed sample ABA cannot revive retained form intents or old editable controls', async () => {
  const view = await fixture(), ui = form(view); fill(ui); ui.handler(async () => ({ status: 'held', message: 'Check source.' })); await ui.press();
  const proof = ui.calls[0].current, submit = ui.button().props.onClick, oldInput = ui.field('Plants you observed').props.onChange;
  ui.update({ sample: true }); ui.update({ sample: undefined });
  assert.equal(proof(), false); await act(async () => { submit(); oldInput({ target: { value: '99' } }); });
  assert.equal(ui.calls.length, 1); assert.match(ui.text(), /earlier checked batch/);
});

test('SavedPanel clean saved row offers progress separately from sowing; dirty reference revokes a running count synchronously', async () => {
  const view = await fixture(), waiting = defer<GrowerFieldObservationResult>(), calls: { view: GrowerSavedNurseryReview; id: string; current: () => boolean }[] = [];
  const props: SavedGrowerNurseryReviewPanelProps = { review: view, checking: false, contextRevision: 1, onRefresh: async () => ({ status: 'ready', view }), onCheckCurrent: async () => true,
    onSaveReferences: async () => ({ status: 'unchanged' }), onRecordSowing: async () => ({ status: 'held', message: 'Separate sowing flow.' }),
    onRecordProgress: async (given, id, _input, current) => { calls.push({ view: given, id, current }); return waiting.promise; } };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(SavedPanel, props)); }); mounted.add(renderer);
  const button = (label: string) => { const found = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(found); return found; };
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => node.type === 'input' || node.type === 'textarea' || node.type === 'select')[0]; };
  assert.ok(button('Record nursery sowing')); const open = button('Record nursery plant count').props.onClick; act(() => open());
  for (const [label, value] of [['Actual observed day', '2026-11-05'], ['What you observed', 'Actual count'], ['Plants you observed', '0'], ['Your assessment', 'ready'], ['What you counted', 'checked-subset']]) act(() => field(label).props.onChange({ target: { value } }));
  act(() => field('I confirm this day').props.onChange({ target: { checked: true } }));
  act(() => { button('Save nursery count observation').props.onClick(); assert.equal(calls.length, 1);
    renderer.root.findByProps({ 'aria-label': 'Your seed-lot reference (optional) — saved batch 1' }).props.onChange({ target: { value: 'Unsaved label' } });
    assert.equal(calls[0].current(), false); });
  assert.equal(calls[0].view, view); assert.equal(calls[0].id, view.references[0].plantingId);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery count' }).length, 0);
  act(() => open()); assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery count' }).length, 0);
  await act(async () => waiting.resolve({ status: 'held', message: 'Changed.' }));
  const heldView = { ...view, references: view.references.map(row => ({ ...row, reference: { status: 'held' as const, reason: 'malformed-reference' } })) };
  act(() => renderer.update(React.createElement(SavedPanel, { ...props, review: heldView, contextRevision: 2 })));
  assert.equal(renderer.root.findAllByType('button').some(node => text(node) === 'Record nursery plant count'), false);
});

test('SavedPanel caches the same combined progress proof for held retries; source replacement revokes retained form callbacks', async () => {
  const view = await fixture(), proofs: (() => boolean)[] = [];
  const props: SavedGrowerNurseryReviewPanelProps = { review: view, checking: false, contextRevision: 1, onRefresh: async () => ({ status: 'ready', view }), onCheckCurrent: async () => true,
    onSaveReferences: async () => ({ status: 'unchanged' }), onRecordProgress: async (_view, _id, _input, proof) => { proofs.push(proof); return { status: 'held', message: 'Check storage.' }; } };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(SavedPanel, props)); }); mounted.add(renderer);
  const button = (label: string) => { const found = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(found); return found; };
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => ['input', 'textarea', 'select'].includes(node.type as string))[0]; };
  const open = button('Record nursery plant count').props.onClick; act(() => open());
  for (const [label, value] of [['Actual observed day', '2026-11-05'], ['What you observed', 'Observed'], ['Plants you observed', '0'], ['Your assessment', 'alive'], ['What you counted', 'whole-batch']]) act(() => field(label).props.onChange({ target: { value } }));
  act(() => field('I confirm this day').props.onChange({ target: { checked: true } }));
  const save = button('Save nursery count observation').props.onClick;
  await act(async () => save()); await act(async () => button('Save nursery count observation').props.onClick());
  assert.equal(proofs.length, 2); assert.equal(proofs[0], proofs[1]); assert.equal(proofs[0](), true);
  act(() => renderer.update(React.createElement(SavedPanel, { ...props, review: { ...view }, contextRevision: 2 })));
  assert.equal(proofs[0](), false); await act(async () => { save(); open(); }); assert.equal(proofs.length, 2);
});

test('history renders zero, assessment, subset and original labels independently of any current plan', () => {
  const entry = history(), before = JSON.stringify(entry); assert.equal(inspectJournalNurseryProgress(entry).status, 'observed');
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(Summary, { entry })); }); mounted.add(renderer);
  assert.deepEqual(renderer.root.findAllByType('dd').map(node => text(node)), ['0', 'Ready — grower assessment', 'Checked subset only', 'Historical variety label', 'Historical lot label', 'Not recorded']);
  assert.match(text(renderer.root), /not certification/); assert.match(text(renderer.root), /not summed into available stock/);
  assert.doesNotMatch(text(renderer.root), /2028-02-09/); assert.equal(JSON.stringify(entry), before);
});

test('malformed, dual-payload and accessor history is held without getters or unsafe text; ordinary legacy stays unchanged', () => {
  let getters = 0; const unsafe = { ...history() }; Object.defineProperty(unsafe, 'nurseryProgress', { enumerable: true, get() { getters++; return 'private-unsafe'; } });
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(Summary, { entry: unsafe })); }); mounted.add(renderer);
  assert.equal(getters, 0); assert.match(text(renderer.root), /Stored nursery count evidence needs review/); assert.doesNotMatch(text(renderer.root), /private-unsafe|Historical lot/);
  const dual = { ...history(), nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: 0, references: { variety: null, seedLotReference: null, raisingBatchReference: null } } };
  act(() => renderer.update(React.createElement(Summary, { entry: dual }))); assert.match(text(renderer.root), /needs review/); assert.equal(renderer.root.findAllByType('dd').length, 0);
  const legacy = { ...history() }; delete legacy.nurseryProgress;
  act(() => renderer.update(React.createElement(Summary, { entry: legacy }))); assert.equal(renderer.toJSON(), null); assert.equal(legacy.notes, 'Original ordinary journal note.');
});

test('real journal timeline and opened sheet show the canonical count snapshot with no writes or current crop plan', async () => {
  const { mountJournal } = await import('./journal-workflow-renderer.ts'), entry = history(), before = JSON.stringify(entry);
  const app = await mountJournal({ entries: [entry], lang: 'en' });
  try {
    assert.equal(app.renderer.root.findAllByProps({ 'aria-label': 'Recorded nursery count observation' }).length, 1);
    const summary = app.renderer.root.findByProps({ 'aria-label': 'Recorded nursery count observation' }); assert.match(text(summary), /Historical lot label/); assert.equal(text(summary.findAllByType('dd')[0]), '0');
    const open = app.renderer.root.findAllByType('button').find(node => node.props['aria-label'] === `Edit entry: ${entry.title}`); assert.ok(open);
    await act(async () => open.props.onClick());
    const sheet = app.renderer.root.findByType(app.Sheet); assert.match(text(sheet), /Checked subset only/); assert.match(text(sheet), /Historical variety label/);
    assert.equal(sheet.findByType('textarea').props.value, entry.notes); assert.equal(app.writes.length, 0); assert.equal(JSON.stringify(entry), before);
  } finally { await app.close(); }
});

test('Open journal uses actual Next client navigation, retaining the observed session snapshot rather than reloading', async () => {
  const view = await fixture(), stored = history(), before = JSON.stringify(stored), pushes: string[] = [];
  let renderer!: ReactTestRenderer;
  function Host() {
    const [path, setPath] = React.useState('/facilitator/crops');
    const router = { back() {}, forward() {}, refresh() {}, replace() {}, prefetch() {}, push(next: string) { pushes.push(next); setPath(next); } };
    return React.createElement(AppRouterContext.Provider, { value: router }, path === '/journal' ? React.createElement(Summary, { entry: stored })
      : React.createElement(Form, { view, plantingId: view.references[0].plantingId, contextRevision: 1, sample: true, onRecord: async () => ({ status: 'saved' as const, message: 'Saved in sample journal.' }) }));
  }
  act(() => { renderer = create(React.createElement(Host)); }); mounted.add(renderer);
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => ['input', 'textarea', 'select'].includes(node.type as string))[0]; };
  for (const [label, value] of [['Actual observed day', stored.date], ['What you observed', stored.notes], ['Plants you observed', '0'], ['Your assessment', 'ready'], ['What you counted', 'checked-subset']]) act(() => field(label).props.onChange({ target: { value } }));
  act(() => field('I confirm this day').props.onChange({ target: { checked: true } }));
  const save = renderer.root.findAllByType('button').find(node => text(node) === 'Save nursery count observation'); assert.ok(save); await act(async () => save.props.onClick());
  const link = renderer.root.findByType('a'); assert.equal(link.props.href, '/journal'); assert.equal(typeof link.props.onClick, 'function', 'plain anchors lose sample in-memory journal on reload');
  const event = { currentTarget: { nodeName: 'A', getAttribute: () => null }, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, nativeEvent: { which: 1 }, preventDefault() { this.defaultPrevented = true; } };
  await act(async () => link.props.onClick(event)); assert.equal(event.defaultPrevented, true); assert.deepEqual(pushes, ['/journal']);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery count' }).length, 0);
  assert.match(text(renderer.root.findByProps({ 'aria-label': 'Recorded nursery count observation' })), /Historical lot label/); assert.equal(JSON.stringify(stored), before);
});
