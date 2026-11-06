import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import { readMassQuantityEntry } from '../lib/mass-units.ts';
import type { GrowerAutoPlanPanelProps } from '../components/crops/GrowerAutoPlanPanel.tsx';

const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
// The actual panel, mass field, strict parser and engine execute. Only native
// Node TSX loading is adapted; parent writes and browser navigation are not proved.
const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/components/crops/GrowerAutoPlanPanel.tsx')) return { shortCircuit: true, format: 'module',
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
after(() => {
  hooks.deregister();
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else Reflect.deleteProperty(globalThis, 'self');
});

// Existing source-fixture dimensions/durations only, never farming advice.
const recordedAt = '2026-11-06T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const profile: GrowerPlanningProfile = { version: 1, profileId: 'mass-fixture-profile', cropKey: CROPS[0].key, scope, inputs: {
  plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
  nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(1, 'days'),
  fieldOccupancyDays: own(2, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
} };
const canvas = buildDemoDesignCanvasState();
canvas.siteId = scope.siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
canvas.items = [{ ...canvas.items.find(item => item.defId === 'veg_bed')!, id: 'mass-fixture-bed', label: 'Fixture bed', wM: 3, hM: 2 }];
canvas.zones = []; canvas.lines = [];
const inspected = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
  raw: canvas, sourceRevision: 'mass-source-fixture' }));
assert.equal(inspected.status, 'ready');
if (inspected.status !== 'ready') throw Error('Synthetic measured source held');
const source = inspected;
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount() {
  let renderer!: ReactTestRenderer;
  let deferred: ((draft: GrowerWorkflowDraft) => Promise<GrowerWorkflowReview>) | null = null;
  const attempts: GrowerWorkflowDraft[] = [], reviews: GrowerWorkflowReview[] = [];
  const accepts: { review: Review; current: () => boolean }[] = [];
  const book: CropPlanState = { version: 1, plantings: [], harvestTargets: [], growerPlanningProfiles: [profile], updatedAt: 1 };
  const props: GrowerAutoPlanPanelProps = { scope, source, sourceName: 'Engineering source', sourceIssue: null, checking: false,
    contextRevision: 1, profiles: [profile], targets: [], targetSiteId: scope.siteId, onRefresh: async () => {},
    onReview: async draft => {
      attempts.push(structuredClone(draft));
      const result = deferred ? await deferred(draft) : assembleGrowerWorkflowReview({ scope: props.scope, source: props.source, book, draft, recordedAt });
      reviews.push(result); return result;
    }, onAccept: async (review, current) => { accepts.push({ review, current }); return { status: 'held', reasons: ['controlled-parent-no-write'] }; } };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(item => text(item).startsWith(label));
    assert.ok(node, `Missing field ${label}`);
    const control = node.findAll(item => item.type === 'input' || item.type === 'select')[0]; assert.ok(control); return control;
  };
  const button = (label: string) => {
    const node = renderer.root.findAllByType('button').find(item => text(item) === label); assert.ok(node, `Missing action ${label}`); return node;
  };
  return { props, attempts, reviews, accepts, book, field, button, renderer, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string) { act(() => field(label).props.onChange({ target: { checked: true } })); },
    async click(label: string) { await act(async () => { await button(label).props.onClick(); }); },
    update(values: Partial<GrowerAutoPlanPanelProps>) { Object.assign(props, values); act(() => renderer.update(React.createElement(Panel, props))); },
    defer(next: typeof deferred) { deferred = next; }, dispose() { act(() => renderer.unmount()); } };
}
type Screen = ReturnType<typeof mount>;
async function fill(screen: Screen, weight?: string) {
  screen.change('First planning date', '2028-02-01'); screen.change('Planning ends before', '2028-03-01'); screen.change('Search work limit', '1000');
  screen.check('I confirm availability for'); screen.change('Available from', '2028-02-01'); screen.change('Available until', '2028-03-01');
  screen.check('I supply these planning dates'); await screen.click('Add household demand');
  screen.change('Crop —', profile.cropKey); screen.change('Growing estimate —', profile.profileId);
  if (weight !== undefined) screen.change('Gross harvest weight', weight);
  screen.change('Harvest from', '2028-02-01'); screen.change('Harvest ends before', '2028-03-01');
}
function demand(screen: Screen) {
  const row = screen.attempts.at(-1)?.demands?.[0]; assert.ok(row && row.kind === 'grower-entered'); return row;
}
function review(screen: Screen): Review {
  const value = screen.reviews.at(-1); assert.ok(value && value.status === 'review'); return value;
}
function save(screen: Screen) { return screen.renderer.root.findAllByType('button').find(node => /^Save all \d+ planned crop cycles$/.test(text(node))); }

test('kg to lb to kg viewing retains exact authored text, canonical request and the reviewed basis', async () => {
  const screen = mount();
  try {
    await fill(screen, '12.3456789'); await screen.click('Review automatic crop plan');
    const before = structuredClone(screen.attempts[0]); assert.ok(save(screen));
    assert.deepEqual(demand(screen).quantityEntry, { unit: 'kg', text: '12.3456789' });
    screen.change('Weight display unit', 'lb');
    assert.equal(screen.field('Weight display unit').props.value, 'lb');
    assert.notEqual(screen.field('Gross harvest weight').props.value, '12.3456789');
    assert.match(screen.text(), /Converted display only/); assert.ok(save(screen));
    assert.equal(screen.attempts.length, 1); assert.match(screen.text(), /12\.3456789 kg/);
    screen.change('Weight display unit', 'kg');
    assert.equal(screen.field('Gross harvest weight').props.value, '12.3456789'); assert.ok(save(screen));
    await screen.click('Review automatic crop plan');
    assert.deepEqual(screen.attempts[1], before);
    const weight = review(screen).request.demands[0].totalKg;
    assert.equal(weight.state === 'provided' && weight.value, 12.3456789);
  } finally { screen.dispose(); }
});

test('an unedited legacy kg row keeps its DTO shape through viewing, while a real lb edit authors only the new branch', async () => {
  const screen = mount();
  try {
    await fill(screen); screen.change('Weight display unit', 'lb'); screen.change('Weight display unit', 'kg');
    await screen.click('Review automatic crop plan');
    assert.equal(Object.hasOwn(demand(screen), 'grossKg'), true); assert.equal(demand(screen).grossKg, '');
    assert.equal(Object.hasOwn(demand(screen), 'quantityEntry'), false);
    screen.change('Gross harvest weight', '12'); await screen.click('Review automatic crop plan');
    const oldSave = save(screen)!.props.onClick;
    screen.change('Weight display unit', 'lb'); screen.change('Gross harvest weight', '10.00');
    assert.equal(save(screen), undefined); act(() => oldSave()); assert.equal(screen.accepts.length, 0);
    await screen.click('Review automatic crop plan');
    assert.equal(Object.hasOwn(demand(screen), 'grossKg'), false);
    assert.deepEqual(demand(screen).quantityEntry, { unit: 'lb', text: '10.00' });
    const weight = review(screen).request.demands[0].totalKg;
    assert.equal(weight.state === 'provided' && weight.value, 4.5359237);
    assert.deepEqual(review(screen).enteredDemandMetadata?.[0].quantityEntry, { unit: 'lb', text: '10.00' });
    assert.match(screen.text(), /10\.00 lb/); assert.equal(screen.accepts.length, 0);
  } finally { screen.dispose(); }
});

for (const weight of ['12..', '9007199254740990.1']) test(`unfinished or lossy text ${weight} stays visible and cannot be normalized by a unit toggle`, async () => {
  const screen = mount();
  try {
    await fill(screen, weight); assert.equal(readMassQuantityEntry({ unit: 'kg', text: weight }).status, 'held');
    screen.change('Weight display unit', 'lb');
    assert.equal(screen.field('Weight display unit').props.value, 'kg'); assert.equal(screen.field('Gross harvest weight').props.value, weight);
    screen.update({ sourceName: 'Same source, another render' });
    assert.equal(screen.field('Gross harvest weight').props.value, weight);
    await screen.click('Review automatic crop plan');
    assert.deepEqual(demand(screen).quantityEntry, { unit: 'kg', text: weight });
    assert.equal(screen.reviews.at(-1)?.status, 'held'); assert.equal(save(screen), undefined);
    assert.equal(screen.field('Gross harvest weight').props.value, weight);
  } finally { screen.dispose(); }
});

test('retained mass controls cannot edit an earlier unit view or cross a changed parent epoch', async () => {
  const screen = mount();
  try {
    await fill(screen, '12');
    const oldEdit = screen.field('Gross harvest weight').props.onChange, oldUnit = screen.field('Weight display unit').props.onChange;
    screen.change('Weight display unit', 'lb');
    const converted = screen.field('Gross harvest weight').props.value;
    act(() => { oldEdit({ target: { value: '99' } }); oldUnit({ target: { value: 'kg' } }); });
    assert.equal(screen.field('Weight display unit').props.value, 'lb'); assert.equal(screen.field('Gross harvest weight').props.value, converted);
    const lbEdit = screen.field('Gross harvest weight').props.onChange, lbUnit = screen.field('Weight display unit').props.onChange;
    const oldReview = screen.button('Review automatic crop plan').props.onClick;
    screen.update({ contextRevision: 2 });
    act(() => { lbEdit({ target: { value: '100' } }); lbUnit({ target: { value: 'kg' } }); oldReview(); });
    assert.equal(screen.attempts.length, 0); assert.equal(screen.field('Gross harvest weight').props.value, converted);
    await screen.click('Review automatic crop plan');
    assert.deepEqual(demand(screen).quantityEntry, { unit: 'kg', text: '12' });
  } finally { screen.dispose(); }
});

test('an actual mass edit withdraws a delayed earlier-unit review instead of publishing its old save button', async () => {
  const screen = mount(); let complete!: (value: GrowerWorkflowReview) => void;
  const deferred = new Promise<GrowerWorkflowReview>(resolve => { complete = resolve; });
  let pending: Promise<void> | undefined;
  try {
    await fill(screen, '12'); screen.defer(async () => deferred);
    pending = screen.click('Review automatic crop plan');
    const earlier = assembleGrowerWorkflowReview({ scope, source, book: screen.book, draft: screen.attempts[0], recordedAt });
    screen.change('Weight display unit', 'lb'); screen.change('Gross harvest weight', '10.00');
    await act(async () => { complete(earlier); }); await pending;
    assert.equal(save(screen), undefined); assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
    assert.equal(screen.field('Gross harvest weight').props.value, '10.00');
    screen.defer(null); await screen.click('Review automatic crop plan');
    assert.deepEqual(demand(screen).quantityEntry, { unit: 'lb', text: '10.00' }); assert.ok(save(screen));
  } finally { screen.dispose(); }
});
