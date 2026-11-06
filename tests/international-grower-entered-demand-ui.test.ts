import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { GrowerAutoPlanPanelProps } from '../components/crops/GrowerAutoPlanPanel.tsx';
import type { GrowerWorkflowAcceptanceResult } from '../components/crops/useGrowerWorkflow.ts';

// Real Next Link schedules idle work when a confirmed receipt mounts it.
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/components/crops/GrowerAutoPlanPanel.tsx')) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
after(() => {
  hooks.deregister();
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf);
  else Reflect.deleteProperty(globalThis, 'self');
});

// Reuse the existing mounted-workflow engineering inputs. These dimensions,
// durations and quantities are synthetic arithmetic, never farming guidance.
const recordedAt = '2026-11-03T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-entered-profile', cropKey: CROPS[0].key, scope, inputs: {
  plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
  nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(1, 'days'),
  fieldOccupancyDays: own(2, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
} };
const target: HarvestTarget = { id: 'private-entered-buyer', siteId: scope.siteId, cropKey: profile.cropKey,
  weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02', marketablePercent: 50 };
const canvas = buildDemoDesignCanvasState();
canvas.siteId = scope.siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
canvas.items = [{ ...canvas.items.find(item => item.defId === 'veg_bed')!, id: 'private-entered-bed', label: 'Fixture bed', wM: 3, hM: 2 }];
canvas.zones = []; canvas.lines = [];
const inspected = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
  raw: canvas, sourceRevision: 'private-entered-source-receipt' }));
assert.equal(inspected.status, 'ready');
if (inspected.status !== 'ready') throw Error('The existing engineering source must be readable');
const source = inspected;
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(withBuyer = false) {
  let renderer!: ReactTestRenderer;
  let pending: ((draft: GrowerWorkflowDraft) => Promise<GrowerWorkflowReview>) | null = null;
  const attempts: GrowerWorkflowDraft[] = [], reviews: GrowerWorkflowReview[] = [];
  const accepts: { review: Review; current: () => boolean }[] = [];
  const book: CropPlanState = { version: 1, plantings: [], harvestTargets: withBuyer ? [target] : [],
    growerPlanningProfiles: [profile], updatedAt: 1 };
  const props: GrowerAutoPlanPanelProps = { scope, source, sourceName: 'Synthetic saved garden', sourceIssue: null, checking: false,
    contextRevision: 1, profiles: [profile], targets: book.harvestTargets!, targetSiteId: scope.siteId,
    onRefresh: async () => {}, onReview: async draft => {
      attempts.push(structuredClone(draft));
      const result = pending ? await pending(draft) : assembleGrowerWorkflowReview({ scope: props.scope, source: props.source, book, draft, recordedAt });
      reviews.push(result); return result;
    }, onAccept: async (review, current) => { accepts.push({ review, current }); return { status: 'held', reasons: ['fixture-parent-hold'] }; } };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(item => text(item).startsWith(label));
    assert.ok(node, `Missing actual entered-demand field: ${label}`);
    const control = node.findAll(item => item.type === 'input' || item.type === 'select')[0];
    assert.ok(control); return control;
  };
  const button = (label: string) => {
    const node = renderer.root.findAllByType('button').find(item => text(item) === label || item.props['aria-label'] === label);
    assert.ok(node, `Missing actual entered-demand action: ${label}`); return node;
  };
  return { props, book, attempts, reviews, accepts, field, button, get renderer() { return renderer; }, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string, checked = true) { act(() => field(label).props.onChange({ target: { checked } })); },
    async click(label: string) { await act(async () => { await button(label).props.onClick(); }); },
    update(values: Partial<GrowerAutoPlanPanelProps>) { Object.assign(props, values); act(() => renderer.update(React.createElement(Panel, props))); },
    defer(callback: typeof pending) { pending = callback; }, dispose() { act(() => renderer.unmount()); } };
}
type Screen = ReturnType<typeof mount>;
function fillPlanning(screen: Screen) {
  screen.change('First planning date', '2028-02-01'); screen.change('Planning ends before', '2028-03-01'); screen.change('Search work limit', '1000');
  screen.check(`I confirm availability for ${source.beds[0].label}`);
  screen.change('Available from', '2028-02-01'); screen.change('Available until', '2028-03-01');
  screen.check('I supply these planning dates and availability as my estimates.');
}
async function addEntered(screen: Screen, purpose: 'Household' | 'Trial' = 'Household', quantity = '12', dates = true) {
  await screen.click(`Add ${purpose.toLowerCase()} demand`);
  assert.equal(screen.field('Purpose —').props.value, purpose.toLowerCase());
  assert.equal(screen.field('Crop —').props.value, ''); assert.equal(screen.field('Growing estimate —').props.value, '');
  assert.equal(screen.field('Gross harvest weight').props.value, '');
  screen.change('Crop —', profile.cropKey); screen.change('Growing estimate —', profile.profileId);
  screen.change('Gross harvest weight', quantity);
  if (dates) {
    screen.change('Harvest from', '2028-02-01'); screen.change('Harvest ends before', '2028-03-01');
  }
}
function reviewed(screen: Screen): Review {
  const review = screen.reviews.at(-1); assert.equal(review?.status, 'review');
  if (!review || review.status !== 'review') throw Error('The actual assembler held the engineering inputs');
  return review;
}
function saveButton(screen: Screen) {
  return screen.renderer.root.findAllByType('button').find(node => /^Save all \d+ planned crop cycles$/.test(text(node)));
}

test('household controls reach the real planner with no buyer targets and do not accept automatically', async () => {
  const screen = mount(), before = JSON.stringify(screen.book);
  try {
    assert.deepEqual(screen.props.targets, []);
    fillPlanning(screen); await addEntered(screen); await screen.click('Review automatic crop plan');
    const result = reviewed(screen);
    assert.equal(result.proposal.status, 'ready'); assert.ok(result.proposal.cycles.length > 0);
    assert.deepEqual(screen.attempts[0].targetProfiles, []);
    assert.equal(screen.attempts[0].demands?.[0].kind, 'grower-entered');
    assert.deepEqual(result.targetMetadata, []);
    assert.deepEqual(result.enteredDemandMetadata?.map(row => [row.purpose, row.grossCapacityKg, row.buyer]), [['household', 12, 'none']]);
    assert.equal(result.request.demands[0].totalKg.state, 'provided');
    assert.equal(result.request.demands[0].profileId, profile.profileId);
    assert.ok(saveButton(screen)); assert.equal(screen.accepts.length, 0);
    assert.match(screen.text(), /Household demand you entered: 12 kg gross for the whole window/);
    assert.match(screen.text(), /No buyer or sale; not a nutrition check/);
    assert.match(screen.text(), /No crop cycle has been added to your saved plan/);
    assert.doesNotMatch(screen.text(), /Buyer demand:/);
    assert.equal(JSON.stringify(screen.book), before);
    for (const hidden of [profile.profileId, source.sourceKey, source.sourceRevision, source.geometryFingerprint]) assert.equal(screen.text().includes(hidden), false);
  } finally { screen.dispose(); }
});

test('switching household to trial and editing its quantity withdraw the actual review and controlled parent receipt', async () => {
  const screen = mount();
  try {
    fillPlanning(screen); await addEntered(screen); await screen.click('Review automatic crop plan');
    const staleSave = saveButton(screen)!.props.onClick;
    await screen.click(text(saveButton(screen)!)); assert.equal(screen.accepts.length, 1);
    // The parent owns receipts. Supplying its acknowledgement tests rendering,
    // and deliberately makes no claim that this mounted panel wrote a book.
    screen.update({ acceptance: { status: 'confirmed', rows: reviewed(screen).proposal.cycles.length, sample: true } });
    assert.match(screen.text(), /planned crop cycles saved in the example workspace/);
    screen.change('Purpose —', 'trial');
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|planned crop cycles saved in the example workspace/);
    assert.equal(saveButton(screen), undefined);
    act(() => staleSave()); assert.equal(screen.accepts.length, 1, 'a retained Save must not accept the withdrawn household review');
    await screen.click('Review automatic crop plan');
    const result = reviewed(screen);
    assert.equal(result.enteredDemandMetadata?.[0].purpose, 'trial');
    const quantity = result.request.demands[0].totalKg;
    assert.ok(quantity.state === 'provided' && quantity.provenance.kind === 'grower-estimate'
      && /not agronomic evidence/.test(quantity.provenance.note ?? ''));
    assert.match(screen.text(), /Trial demand you entered/);
    assert.match(screen.text(), /trial evidence or safety finding/);
    screen.change('Gross harvest weight', '24');
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|planned crop cycles saved in the example workspace/);
    assert.equal(screen.accepts.length, 1);
  } finally { screen.dispose(); }
});

test('blank quantity remains missing while explicit zero needs no harvest window and cannot offer a cycle save', async () => {
  const screen = mount();
  try {
    fillPlanning(screen); await addEntered(screen, 'Household', '', false); await screen.click('Review automatic crop plan');
    let result = reviewed(screen);
    assert.equal(result.proposal.status, 'missing-inputs');
    assert.equal(result.proposal.demandResults[0].requestedKg, null);
    assert.equal(result.enteredDemandMetadata?.[0].grossCapacityKg, null);
    assert.match(screen.text(), /Blank is not zero/); assert.equal(saveButton(screen), undefined);
    screen.change('Gross harvest weight', '0'); await screen.click('Review automatic crop plan');
    result = reviewed(screen);
    assert.equal(result.proposal.status, 'ready'); assert.equal(result.proposal.cycles.length, 0);
    assert.deepEqual(result.proposal.demandResults.map(row => [row.status, row.requestedKg]), [['zero-demand', 0]]);
    assert.equal(screen.field('Harvest from').props.value, ''); assert.equal(screen.field('Harvest ends before').props.value, '');
    assert.equal(saveButton(screen), undefined); assert.equal(screen.accepts.length, 0);
    screen.change('Gross harvest weight', '12'); await screen.click('Review automatic crop plan');
    result = reviewed(screen);
    assert.equal(result.proposal.status, 'missing-inputs');
    assert.ok(result.proposal.issues.some(issue => issue.endsWith(':harvestWindow')));
    assert.equal(saveButton(screen), undefined); assert.equal(screen.accepts.length, 0);
  } finally { screen.dispose(); }
});

test('actual priority controls reorder mixed buyer and entered demand in the real engine without sharing occupied bed intervals', async () => {
  const screen = mount(true);
  try {
    fillPlanning(screen); await addEntered(screen);
    screen.check(`Include ${CROPS[0].name}`); screen.change('Growing estimate for this target', profile.profileId);
    await screen.click('Review automatic crop plan');
    const first = reviewed(screen), enteredId = first.enteredDemandMetadata![0].demandId;
    assert.deepEqual(first.request.demands.map(row => row.demandId), [enteredId, target.id]);
    assert.equal(first.proposal.cycles[0].demandId, enteredId);
    await screen.click('Move demand 2 earlier');
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
    await screen.click('Review automatic crop plan');
    const second = reviewed(screen);
    assert.deepEqual(second.request.demands.map(row => row.demandId), [target.id, enteredId]);
    assert.deepEqual(second.proposal.demandResults.map(row => row.demandId), [target.id, enteredId]);
    assert.equal(second.proposal.cycles[0].demandId, target.id);
    assert.equal(second.proposal.status, 'ready');
    for (const result of [first, second]) for (let i = 0; i < result.proposal.cycles.length; i++) {
      const a = result.proposal.cycles[i];
      for (const b of result.proposal.cycles.slice(i + 1)) if (a.bedId === b.bedId) assert.ok(
        a.assessment.schedule.nextFieldEntryDate <= b.assessment.schedule.fieldEntryDate
        || b.assessment.schedule.nextFieldEntryDate <= a.assessment.schedule.fieldEntryDate);
    }
    assert.equal(screen.accepts.length, 0);
  } finally { screen.dispose(); }
});

for (const invalidation of ['actor epoch', 'source', 'scope'] as const) test(`a late entered-demand review and retained controls cannot cross a changed ${invalidation}`, async () => {
  const screen = mount(); let complete!: (review: GrowerWorkflowReview) => void;
  const deferred = new Promise<GrowerWorkflowReview>(resolve => { complete = resolve; });
  let pending: Promise<void> | undefined, late: GrowerWorkflowReview | undefined;
  try {
    fillPlanning(screen); await addEntered(screen);
    const oldChange = screen.field('Gross harvest weight').props.onChange;
    const oldReview = screen.button('Review automatic crop plan').props.onClick;
    screen.defer(async () => deferred);
    pending = screen.click('Review automatic crop plan'); assert.equal(screen.attempts.length, 1);
    late = assembleGrowerWorkflowReview({ scope, source, book: screen.book, draft: screen.attempts[0], recordedAt });
    assert.equal(late.status, 'review');
    // The panel receives actor invalidation as the parent's revision, not an
    // account credential. The actual controller's actor lease is tested there.
    if (invalidation === 'actor epoch') screen.update({ contextRevision: 2 });
    if (invalidation === 'source') screen.update({ source: { ...source, sourceRevision: 'different-private-source-receipt' } });
    if (invalidation === 'scope') screen.update({ scope: null, source: null, contextRevision: 2 });
    act(() => { oldChange({ target: { value: '24' } }); oldReview(); });
    assert.equal(screen.attempts.length, 1);
    if (invalidation !== 'scope') assert.equal(screen.field('Gross harvest weight').props.value, '12');
    await act(async () => { complete(late!); });
    await pending;
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|Household demand you entered:/);
    assert.equal(saveButton(screen), undefined); assert.equal(screen.accepts.length, 0);
    if (invalidation === 'scope') {
      screen.update({ scope, source, contextRevision: 3 });
      assert.equal(screen.field('Gross harvest weight').props.value, '12', 'the retained old edit must not change a hidden entered row');
      assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
    }
  } finally {
    // Settle even a failed assertion's deferred callback before unmounting.
    if (pending) {
      await act(async () => { complete(late ?? assembleGrowerWorkflowReview({ scope, source, book: screen.book, draft: screen.attempts[0], recordedAt })); });
      await pending;
    }
    screen.dispose();
  }
});

test('a trial purpose edit synchronously revokes an in-flight acceptance and its retained Save callback', async () => {
  const screen = mount(); let current!: () => boolean, complete: ((result: GrowerWorkflowAcceptanceResult) => void) | undefined;
  try {
    screen.update({ onAccept: async (review, isCurrent) => {
      screen.accepts.push({ review, current: isCurrent }); current = isCurrent;
      return new Promise<GrowerWorkflowAcceptanceResult>(resolve => { complete = resolve; });
    } });
    fillPlanning(screen); await addEntered(screen); await screen.click('Review automatic crop plan');
    const staleSave = saveButton(screen)!.props.onClick;
    act(() => staleSave()); assert.equal(screen.accepts.length, 1); assert.equal(current(), true);
    const edit = screen.field('Purpose —').props.onChange;
    act(() => { edit({ target: { value: 'trial' } }); assert.equal(current(), false); });
    await act(async () => { complete!({ status: 'superseded' }); });
    act(() => staleSave()); assert.equal(screen.accepts.length, 1);
    assert.equal(saveButton(screen), undefined); assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
    await screen.click('Review automatic crop plan');
    assert.equal(reviewed(screen).enteredDemandMetadata?.[0].purpose, 'trial');
    assert.equal(screen.accepts.length, 1, 'a fresh proposal still needs its own explicit Save');
  } finally {
    if (complete) await act(async () => { complete!({ status: 'superseded' }); });
    screen.dispose();
  }
});

for (const outcome of ['held', 'failed', 'superseded'] as const) test(`an entered-demand ${outcome} acknowledgement never starts an automatic acceptance retry`, async () => {
  const screen = mount();
  try {
    const result: GrowerWorkflowAcceptanceResult = outcome === 'held' ? { status: 'held', reasons: ['fixture-parent-hold'] } : { status: outcome };
    screen.update({ onAccept: async (review, current) => { screen.accepts.push({ review, current }); return result; } });
    fillPlanning(screen); await addEntered(screen, 'Trial'); await screen.click('Review automatic crop plan');
    assert.equal(screen.accepts.length, 0);
    await screen.click(text(saveButton(screen)!)); assert.equal(screen.accepts.length, 1);
    screen.update({ acceptance: result });
    await act(async () => {});
    screen.update({ sourceIssue: 'Parent check still needs review.' });
    await act(async () => {});
    assert.equal(screen.accepts.length, 1);
    screen.change('Gross harvest weight', '24'); await screen.click('Review automatic crop plan');
    assert.equal(screen.accepts.length, 1, 'editing and re-reviewing must not retry a save');
  } finally { screen.dispose(); }
});
