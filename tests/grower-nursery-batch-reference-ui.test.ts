import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource, type GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { resolveGrowerNurseryBatchReference, prepareGrowerNurseryBatchReferenceChanges, type GrowerNurseryBatchReferenceChange } from '../lib/international/grower-nursery.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import type { GrowerSavedNurseryReview, GrowerSavedNurseryReadResult, GrowerNurseryBatchReferenceSaveResult, GrowerNurseryReferenceAcknowledgement } from '../components/crops/useGrowerWorkflow.ts';
import type { SavedGrowerNurseryReviewPanelProps } from '../components/crops/SavedGrowerNurseryReviewPanel.tsx';

const deliveries: { blob: Blob; filename: string }[] = [];
const prior = new Map(['__nurseryReferenceUiDownloads', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __nurseryReferenceUiDownloads: deliveries, IS_REACT_ACT_ENVIRONMENT: true });
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    // This fixture exercises nursery references without a browser. The separate
    // field worksheet has its own real composed-panel and platform coverage.
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === './GrowerFieldSeedSourcingSection') return { shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent('export default function FieldWorksheetBoundary(){return null;}') };
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === '@/lib/file-delivery') return { shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent('export function downloadFile(blob,filename){globalThis.__nurseryReferenceUiDownloads.push({blob,filename});return "downloaded";}') };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });

// Real generated cycles, saved row creation, reference resolver/preparer and
// nursery calculation/export run. Parent storage receipts/acknowledgements are
// controlled callback boundaries here, not a test of the controller's private
// receipt map, actor observers or real device persistence.
async function fixture() {
  const canvas = buildDemoDesignCanvasState(); canvas.siteId = 'site:0.00000,0.00000'; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(row => row.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...template, x, y: 0.5, id: `private-reference-bed-${index}`, label: `Fixture growing space ${index + 1}`, wM: 3, hM: 4 }));
  canvas.lines = []; canvas.zones = [];
  const inspected = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId, raw: canvas, sourceRevision: 'private-reference-source' }));
  assert.equal(inspected.status, 'ready'); if (inspected.status !== 'ready') throw Error('Synthetic saved source must be valid');
  const source: GrowerWorkflowSource = inspected;
  const crop = CROPS[0];
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-reference-profile', cropKey: crop.key, scope: source.scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-reference-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(13, 'kg-total'), harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, index) => {
    const row = createGrowerCyclePlanting(cycle, { plantingId: `private-reference-planting-${index}`, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint });
    // The creation authority freezes its result. Detached persisted fixtures
    // let a test author pre-existing metadata without mutating that receipt.
    assert.ok(row); return structuredClone(row);
  });
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const settings: NurserySettings = { version: 1, spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Fixture bench', usableM2: 2 }],
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Fixture trays', cells: 40, widthCm: 50, lengthCm: 40, owned: 10 }],
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench', fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  function view(book: CropPlanState): GrowerSavedNurseryReview {
    const cycles = projectGrowerCycles(book.plantings, context).ownCycles.filter(cycle => cycle.nurseryDemand);
    const starts = cycles.map(cycle => cycle.nurseryDemand!.interval.start).sort(), ends = cycles.map(cycle => cycle.nurseryDemand!.interval.endExclusive).sort();
    return { kind: 'saved-nursery-review', source, rows: book.plantings, cycleContext: context,
      horizon: own({ start: starts[0], endExclusive: ends.at(-1)! }, 'utc-date-window'),
      references: cycles.map(cycle => ({ plantingId: cycle.plantingId, cropKey: cycle.cropKey, bedId: cycle.bedId,
        startDate: cycle.nurseryDemand!.interval.start, endDateExclusive: cycle.nurseryDemand!.interval.endExclusive,
        reference: resolveGrowerNurseryBatchReference(book.plantings, context, cycle.plantingId) })) };
  }
  return { source, settings, context, view, book: { version: 1, plantings: rows, harvestTargets: [], updatedAt: 1 } as CropPlanState };
}
type Data = Awaited<ReturnType<typeof fixture>>;
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function mount(data: Data, initiallyChecked = true) {
  let renderer!: ReactTestRenderer, book = data.book, refreshes = 0;
  let acknowledgement: GrowerNurseryReferenceAcknowledgement | null = null;
  const saves: { view: GrowerSavedNurseryReview; changes: readonly GrowerNurseryBatchReferenceChange[]; isCurrent: () => boolean }[] = [];
  const refreshAcks: (GrowerNurseryReferenceAcknowledgement | undefined)[] = [];
  const handlers: { save?: SavedGrowerNurseryReviewPanelProps['onSaveReferences']; refresh?: SavedGrowerNurseryReviewPanelProps['onRefresh']; check?: SavedGrowerNurseryReviewPanelProps['onCheckCurrent'] } = {};
  let props: SavedGrowerNurseryReviewPanelProps = { review: initiallyChecked ? data.view(book) : null, checking: false, settings: data.settings, contextRevision: 1,
    onRefresh: async ack => {
      refreshes++; refreshAcks.push(ack); if (handlers.refresh) return handlers.refresh(ack);
      if (ack && ack !== acknowledgement) return { status: 'held', reason: 'acknowledgement-withdrawn' };
      if (ack) acknowledgement = null;
      const view = data.view(book); update({ review: view }); return { status: 'ready', view };
    },
    onCheckCurrent: async view => handlers.check ? handlers.check(view) : view === props.review && JSON.stringify(view.rows) === JSON.stringify(book.plantings),
    onSaveReferences: async (view, changes, isCurrent) => {
      saves.push({ view, changes, isCurrent }); if (handlers.save) return handlers.save(view, changes, isCurrent);
      if (!isCurrent()) return { status: 'held', reasons: ['context-changed'] };
      const prepared = prepareGrowerNurseryBatchReferenceChanges({ book, originalRows: view.rows, originalContext: view.cycleContext, currentContext: data.context, changes });
      if (prepared.status === 'held') return { status: 'held', reasons: prepared.reasons };
      if (prepared.status === 'unchanged') return { status: 'unchanged' };
      book = prepared.book; acknowledgement = Object.freeze({ kind: 'nursery-reference-acknowledgement' });
      update({ review: null, contextRevision: props.contextRevision + 1 });
      return { status: 'confirmed', rows: prepared.changedPlantingIds.length, sample: props.sample === true, acknowledgement };
    } };
  function update(patch: Partial<SavedGrowerNurseryReviewPanelProps>) { props = { ...props, ...patch }; renderer.update(React.createElement(Panel, props)); }
  act(() => { renderer = create(React.createElement(Panel, props)); }); mounted.add(renderer);
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(row => text(row) === label); assert.ok(node, `Missing actual button: ${label}`); return node; };
  const field = (name: string, batch = 1) => renderer.root.findByProps({ 'aria-label': `${name} — saved batch ${batch}` });
  return { renderer, handlers, saves, refreshAcks, get refreshes() { return refreshes; }, get props() { return props; }, get book() { return book; },
    text: () => text(renderer.root), button, field,
    edit(name: string, value: string, batch = 1) { act(() => field(name, batch).props.onChange({ target: { value } })); },
    async press(label: string) { await act(async () => { button(label).props.onClick(); await new Promise<void>(resolve => setImmediate(resolve)); }); },
    async flush() { await act(async () => { await new Promise<void>(resolve => setImmediate(resolve)); }); },
    update(patch: Partial<SavedGrowerNurseryReviewPanelProps>) { act(() => update(patch)); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
}
const variety = 'Your variety / cultivar (optional)', seedLot = 'Your seed-lot reference (optional)', raising = 'Your raising-batch reference (optional)';
async function reviewBudget(ui: ReturnType<typeof mount>) {
  const horizon = ui.props.review?.horizon;
  assert.equal(horizon?.state, 'provided'); if (horizon?.state !== 'provided') throw Error('Saved interval fixture required');
  for (const [index, resource, quantity] of [[0, 'container:private-tray', '10'], [1, 'space:private-bench', '2']] as const) {
    await ui.press('Add resource availability');
    for (const [label, value] of [['Resource', resource], ['Quantity', quantity], ['From (UTC)', horizon.value.start], ['Until (exclusive, UTC)', horizon.value.endExclusive]]) {
      const row = ui.renderer.root.findAllByType('fieldset').find(node => node.children.some(child => typeof child !== 'string' && child.type === 'legend' && text(child) === `Available resource ${index + 1}`));
      assert.ok(row); const control = row.findAllByType('label').find(node => text(node).startsWith(label)); assert.ok(control);
      const input = control.findAll(node => node.type === 'input' || node.type === 'select')[0];
      act(() => input.props.onChange({ target: { value } }));
    }
  }
  for (const prefix of ['I have reviewed the saved nursery', 'I confirm these dated resource', 'I have listed all other nursery uses']) {
    const label = ui.renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label);
    act(() => label.findByType('input').props.onChange({ target: { checked: true } }));
  }
  await ui.press('Review own nursery requirements');
}
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); deliveries.length = 0; });
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('checking saved nursery batches is explicit and individual optional fields start blank without inventing stock or labels', async () => {
  const data = await fixture(), before = JSON.stringify(data.book), ui = mount(data, false);
  assert.equal(ui.refreshes, 0); assert.equal(ui.saves.length, 0); assert.equal(ui.renderer.root.findAllByType('input').length, 0);
  await ui.press('Check saved nursery batches'); assert.equal(ui.refreshes, 1); assert.equal(ui.saves.length, 0);
  assert.equal(ui.props.review!.references.length, 2);
  for (const batch of [1, 2]) for (const name of [variety, seedLot, raising]) {
    const input = ui.field(name, batch); assert.equal(input.props.value, ''); assert.match(input.props.className, /min-h-11/);
    assert.equal(input.parent!.props.htmlFor, input.props.id);
  }
  assert.equal(ui.button('Save all touched references').props.disabled, true);
  assert.match(ui.text(), /References do not record actual sowing, available seeds or live nursery stock/);
  assert.equal(JSON.stringify(data.book), before); assert.doesNotMatch(ui.text(), /private-reference-(planting|source|profile|bed)/);
});

test('one save submits full fields for touched persistent batches only, then refreshes once with the confirmed acknowledgement after parent commit', async () => {
  const data = await fixture(), ui = mount(data), original = ui.props.review;
  ui.edit(variety, 'Grower choice A'); ui.edit(seedLot, 'Lot A'); ui.edit(raising, 'Raising B', 2);
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Own-input nursery review' }).length, 0, 'dirty metadata cannot bless an older resource review');
  await ui.press('Save all touched references'); await ui.flush();
  assert.equal(ui.saves.length, 1); assert.equal(ui.saves[0].view, original);
  assert.deepEqual(ui.saves[0].changes, [
    { plantingId: data.book.plantings[0].id, variety: 'Grower choice A', seedLotReference: 'Lot A', raisingBatchReference: null },
    { plantingId: data.book.plantings[1].id, variety: null, seedLotReference: null, raisingBatchReference: 'Raising B' },
  ]);
  assert.equal(ui.refreshes, 1); assert.equal(ui.refreshAcks[0]?.kind, 'nursery-reference-acknowledgement');
  assert.match(ui.text(), /References saved and current saved batches checked/);
  assert.equal(ui.field(seedLot).props.value, 'Lot A'); assert.equal(ui.field(raising, 2).props.value, 'Raising B');
  assert.equal(ui.field(seedLot, 2).props.value, ''); assert.equal(ui.button('Save all touched references').props.disabled, true);
  assert.notEqual(ui.props.review, original); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Own-input nursery review' }).length, 1);
  assert.equal(ui.saves[0].isCurrent(), false, 'the old submitted editor is consumed, never renewed by the saved readback');
});

test('explicit clearing sends null for the touched field while untouched sibling batches and all planning arithmetic remain unchanged', async () => {
  const data = await fixture(); data.book.plantings[0].variety = 'Existing grower choice';
  const ui = mount(data), sibling = JSON.stringify(ui.book.plantings[1]), attachment = JSON.stringify(ui.book.plantings[0].growerCycle);
  ui.edit(variety, ''); await ui.press('Save all touched references'); await ui.flush();
  assert.deepEqual(ui.saves[0].changes, [{ plantingId: data.book.plantings[0].id, variety: null, seedLotReference: null, raisingBatchReference: null }]);
  assert.equal(JSON.stringify(ui.book.plantings[1]), sibling); assert.equal(JSON.stringify(ui.book.plantings[0].growerCycle), attachment);
  assert.equal(ui.field(variety).props.value, '');
});

for (const status of ['held', 'failed', 'superseded'] as const) test(`${status} save retains the exact draft with no refresh, success claim or resource review`, async () => {
  const data = await fixture(), ui = mount(data), before = JSON.stringify(data.book);
  ui.handlers.save = async () => status === 'held' ? { status, reasons: ['saved-plan-changed'] } : { status };
  ui.edit(seedLot, 'Retain my input'); await ui.press('Save all touched references');
  assert.equal(ui.field(seedLot).props.value, 'Retain my input'); assert.equal(ui.refreshes, 0); assert.equal(ui.saves.length, 1);
  assert.match(ui.text(), /entries are retained/); assert.doesNotMatch(ui.text(), /References saved and current saved batches checked/);
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Own-input nursery review' }).length, 0); assert.equal(JSON.stringify(data.book), before);
});

test('a synchronous save latch rejects duplicate calls and retained inputs while the original editor waits', async () => {
  const data = await fixture(), ui = mount(data), waiting = deferred<GrowerNurseryBatchReferenceSaveResult>();
  ui.handlers.save = async () => waiting.promise; ui.edit(seedLot, 'Original lot');
  const staleInput = ui.field(seedLot).props.onChange, submit = ui.button('Save all touched references').props.onClick;
  act(() => { submit(); submit(); staleInput({ target: { value: 'Must not replace pending input' } }); });
  assert.equal(ui.saves.length, 1); assert.equal(ui.saves[0].isCurrent(), true); assert.equal(ui.field(seedLot).props.value, 'Original lot');
  await act(async () => { waiting.resolve({ status: 'held', reasons: ['context-changed'] }); });
  assert.equal(ui.field(seedLot).props.value, 'Original lot');
});

for (const transition of ['source', 'account-epoch', 'sample'] as const) test(`retained editor and save callbacks cannot spend the ${transition} replacement's source`, async () => {
  const data = await fixture(), ui = mount(data); ui.edit(seedLot, 'Old context');
  const oldEdit = ui.field(seedLot).props.onChange, oldSave = ui.button('Save all touched references').props.onClick,
    oldRefresh = ui.button('Check saved nursery batches').props.onClick;
  ui.update(transition === 'source' ? { review: data.view(data.book) } : transition === 'sample' ? { sample: true } : { contextRevision: 2 });
  act(() => { oldEdit({ target: { value: 'Leaked value' } }); oldSave(); oldRefresh(); });
  assert.equal(ui.field(seedLot).props.value, ''); assert.equal(ui.saves.length, 0); assert.equal(ui.refreshes, 0);
});

test('malformed present reference metadata stays visibly held instead of becoming editable blank fields', async () => {
  const data = await fixture(); Object.assign(data.book.plantings[0], { nurseryBatchReference: { unexpected: 'preserve-evidence' } });
  const ui = mount(data), before = JSON.stringify(data.book);
  assert.equal(ui.props.review!.references[0].reference.status, 'held');
  assert.match(ui.text(), /Retained evidence has not been replaced with blank fields/);
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': `${seedLot} — saved batch 1` }).length, 0);
  assert.equal(ui.button('Save all touched references').props.disabled, true);
  assert.equal(JSON.stringify(data.book), before);
});

test('a ready sibling reference can be saved once while another member stays held and its original evidence and planned counts survive', async () => {
  const data = await fixture(); Object.assign(data.book.plantings[0], { nurseryBatchReference: { unexpected: 'retain-exact-evidence' } });
  const heldBefore = JSON.stringify(data.book.plantings[0]), ui = mount(data);
  ui.edit(seedLot, 'Eligible sibling lot', 2);
  assert.equal(ui.button('Save all touched references').props.disabled, false);
  await ui.press('Save all touched references'); await ui.flush();
  assert.equal(ui.saves.length, 1); assert.equal(ui.saves[0].changes.length, 1);
  assert.equal(ui.saves[0].changes[0].plantingId, data.book.plantings[1].id);
  assert.equal(JSON.stringify(ui.book.plantings[0]), heldBefore);
  assert.equal(ui.props.review!.references[0].reference.status, 'held'); assert.equal(ui.field(seedLot, 2).props.value, 'Eligible sibling lot');
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': `${seedLot} — saved batch 1` }).length, 0);
  await reviewBudget(ui); assert.match(ui.text(), /Within the supplied dated budget/);
  assert.match(ui.text(), /Individual saved batch reference: Needs review/);
  await ui.press('Download transplant preparation CSV'); assert.equal(deliveries.length, 1);
  const csv = await deliveries[0].blob.text(); assert.ok(csv.includes('Needs review')); assert.ok(csv.includes('Eligible sibling lot'));
  assert.doesNotMatch(csv, /retain-exact-evidence/);
  assert.equal(JSON.stringify(ui.book.plantings[0]), heldBefore);
});

test('a confirmed result cannot claim saved success until acknowledgement refresh is installed and independently current', async () => {
  const data = await fixture(), ui = mount(data), refresh = deferred<GrowerSavedNurseryReadResult>();
  ui.handlers.refresh = async () => refresh.promise; ui.handlers.check = async () => false;
  ui.edit(seedLot, 'Needs actual recheck'); await ui.press('Save all touched references');
  assert.equal(ui.refreshes, 1); assert.doesNotMatch(ui.text(), /References saved and current saved batches checked/);
  const next = data.view(ui.book); ui.update({ review: next });
  await act(async () => { refresh.resolve({ status: 'ready', view: next }); }); await ui.flush();
  assert.doesNotMatch(ui.text(), /References saved and current saved batches checked/);
  assert.match(ui.text(), /Current saved records could not be confirmed/);
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Own-input nursery review' }).length, 0);
});

test('unmounting a pending editor revokes its save proof and late confirmed completion cannot refresh another workspace', async () => {
  const data = await fixture(), ui = mount(data), waiting = deferred<GrowerNurseryBatchReferenceSaveResult>();
  ui.handlers.save = async () => waiting.promise; ui.edit(raising, 'Keep with this batch');
  act(() => ui.button('Save all touched references').props.onClick()); assert.equal(ui.saves.length, 1);
  ui.dispose(); assert.equal(ui.saves[0].isCurrent(), false);
  await act(async () => { waiting.resolve({ status: 'confirmed', rows: 1, sample: false, acknowledgement: { kind: 'nursery-reference-acknowledgement' } }); });
  assert.equal(ui.refreshes, 0);
});

test('saved-mode budget and preparation exports use the same real planned rows and individual references, then editing revokes retained exports', async () => {
  const data = await fixture(), ui = mount(data);
  ui.edit(seedLot, 'Seed lot A'); ui.edit(raising, 'Raising B', 2); await ui.press('Save all touched references'); await ui.flush();
  await reviewBudget(ui);
  assert.match(ui.text(), /Nursery requirements for saved planned batches/);
  assert.match(ui.text(), /Within the supplied dated budget/);
  assert.match(ui.text(), /Your seed-lot referenceSeed lot A/);
  assert.match(ui.text(), /Your raising-batch referenceRaising B/);
  assert.match(ui.text(), /Saved planned raising batch 1/);
  assert.doesNotMatch(ui.text(), /No sowing has been accepted or observed/);
  await ui.press('Download transplant preparation CSV'); assert.equal(deliveries.length, 1);
  const csv = await deliveries[0].blob.text(); assert.ok(csv.includes('Seed lot A')); assert.ok(csv.includes('Raising B'));
  assert.doesNotMatch(csv, /private-reference-(planting|profile|source|bed)/);
  const retainedExport = ui.button('Download transplant preparation CSV').props.onClick;
  ui.edit(seedLot, 'New unsaved label');
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Own-input nursery review' }).length, 0);
  await act(async () => { retainedExport(); await new Promise<void>(resolve => setImmediate(resolve)); });
  assert.equal(deliveries.length, 1, 'unmounting the old budget prevents its retained handler from minting a new export turn');
});

test('unsupported reference glyphs use the typed actual PDF hold and retain a usable exact-text CSV fallback', async () => {
  // The bundled report font supports Greek. An astral character exercises its
  // actual missing-glyph boundary instead of treating all non-ASCII as invalid.
  const data = await fixture(); data.book.plantings[0].variety = 'Grower 😀';
  const ui = mount(data); await reviewBudget(ui);
  await ui.press('Download preparation PDF');
  assert.equal(deliveries.length, 0); assert.match(ui.text(), /PDF font cannot print a planned reference faithfully/);
  assert.match(ui.text(), /Download the transplant preparation CSV to retain its exact text/);
  assert.doesNotMatch(ui.text(), /ReferenceError|stack|unsupported-reference-glyph/);
  await ui.press('Download transplant preparation CSV'); assert.equal(deliveries.length, 1);
  assert.ok((await deliveries[0].blob.text()).includes('Grower 😀'));
});

test('supported non-ASCII grower reference text remains eligible for the actual PDF rather than a blanket Unicode hold', async () => {
  const data = await fixture(); data.book.plantings[0].variety = 'Grower α';
  const ui = mount(data); await reviewBudget(ui); await ui.press('Download preparation PDF');
  assert.equal(deliveries.length, 1); assert.equal(deliveries[0].blob.type, 'application/pdf');
  assert.match(ui.text(), /Transplant preparation PDF downloaded/);
  assert.doesNotMatch(ui.text(), /PDF font cannot print/);
  assert.equal(ui.field(variety).props.value, 'Grower α');
});

// REVIEW-A proposal controls: status is simulated here as the real parent's POST-WRITE
// contract. These UI tests do not establish persistence; provider R-A1/R-A2 supply that
// separate actual-parent/hook/storage-boundary evidence. No production writer is stubbed green.
test('post-write superseded in the same displayed view is honest and blocks its source, not only resource review', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'superseded' });
  ui.edit(seedLot, 'Post-write retained input'); await ui.press('Save all touched references');
  assert.match(ui.text(), /The write completed, but current saved batches could not be confirmed/);
  assert.doesNotMatch(ui.text(), /Unsaved reference changes:/);
  assert.equal(ui.button('Save all touched references').props.disabled, true);
  assert.equal(ui.field(seedLot).props.disabled, true);
  assert.equal(ui.saves.length, 1);
});
test('a returned post-write superseded latches the view against retained edit and submit callbacks', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'superseded' });
  ui.edit(seedLot, 'Original retained input');
  const submit = ui.button('Save all touched references').props.onClick, edit = ui.field(seedLot).props.onChange;
  await ui.press('Save all touched references');
  act(() => { submit(); edit({ target: { value: 'Do not replace old write evidence' } }); submit(); }); await ui.flush();
  assert.equal(ui.saves.length, 1, 'handler gate rejects retry even when disabled DOM is bypassed');
  assert.equal(ui.field(seedLot).props.value, 'Original retained input');
  assert.match(ui.text(), /The write completed/);
});
test('post-write truth follows the retained editor when the hook withdraws its checked source', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'superseded' });
  ui.edit(seedLot, 'Written but not confirmed'); await ui.press('Save all touched references');
  ui.update({ review: null, contextRevision: ui.props.contextRevision + 1 }); await ui.flush();
  assert.match(ui.text(), /Earlier checked-batch entries · write completed, current saved batches not confirmed/);
  assert.match(ui.text(), /Written but not confirmed/); assert.doesNotMatch(ui.text(), /unsaved and held separately|have not been applied to current saved batches/);
  assert.equal(ui.saves.length, 1);
});
test('a held explicit recheck of the same source does not release its post-write retry latch', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'superseded' });
  ui.edit(seedLot, 'Retain under hold'); await ui.press('Save all touched references');
  ui.handlers.refresh = async () => ({ status: 'held', reason: 'saved-plan-changed' });
  await ui.press('Check saved nursery batches'); await ui.press('Save all touched references');
  assert.equal(ui.saves.length, 1); assert.equal(ui.button('Save all touched references').props.disabled, true);
  assert.equal(ui.field(seedLot).props.value, 'Retain under hold');
});
test('a fresh authoritative checked view permits explicit new edits and a confirmed save, rather than blocking forever', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'superseded' });
  ui.edit(seedLot, 'Old unconfirmed input'); const oldView = ui.props.review;
  await ui.press('Save all touched references'); ui.handlers.save = undefined;
  await ui.press('Check saved nursery batches'); assert.notEqual(ui.props.review, oldView);
  ui.edit(seedLot, 'Explicit entry against fresh checked view');
  assert.equal(ui.field(seedLot).props.disabled, false); assert.equal(ui.button('Save all touched references').props.disabled, false);
  await ui.press('Save all touched references'); await ui.flush();
  assert.equal(ui.saves.length, 2); assert.match(ui.text(), /References saved and current saved batches checked/);
});
test('a legitimate pre-write held result never claims a completed write or installs the post-write latch', async () => {
  const ui = mount(await fixture()); ui.handlers.save = async () => ({ status: 'held', reasons: ['saved-plan-changed'] });
  ui.edit(seedLot, 'Pre-write entry'); await ui.press('Save all touched references');
  assert.doesNotMatch(ui.text(), /The write completed/); assert.equal(ui.button('Save all touched references').props.disabled, false);
  ui.edit(seedLot, 'Corrected explicit entry'); assert.equal(ui.field(seedLot).props.value, 'Corrected explicit entry');
  assert.equal(ui.field(seedLot).props.disabled, false);
});
