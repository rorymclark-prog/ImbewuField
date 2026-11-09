import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import { crop, account, samples, local, events, probe, studioKey, studio, ownRow, reset, cleanup, siteId, pauseHashes } from './international-grower-operations-fixture.ts';
import { growerPlanningScopeKey } from '../lib/international/grower-planning.ts';
import { prepareGrowerWorkflowAcceptance, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { GrowerWorkflowAcceptanceResult } from '../components/crops/useGrowerWorkflow.ts';

// Actual parent functions are extracted with their original text, following the
// existing acceptance-controller tests. This is not the whole parent form.
// Real hook/panel, source hashing, planner, acceptance preparation, admission and
// writer run. Existing fixture substitutes auth/network and memory storage only.
// Unlike the provider's discarded in-place-mutating parent double, each parent
// change publishes a new React state snapshot and each book change is immutable.
const previousSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return {
      shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();') };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/crops/GrowerAutoPlanPanel.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
beforeEach(reset);
after(() => {
  hooks.deregister(); cleanup();
  if (previousSelf) Object.defineProperty(globalThis, 'self', previousSelf); else Reflect.deleteProperty(globalThis, 'self');
});

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'readCurrentGrowerBook', 'commitGrowerAcceptance', 'rememberStoredPlan'];
const bodies = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) bodies.set(node.name.text, node.getText(page));
  ts.forEachChild(node, visit);
}
visit(page); assert.equal(bodies.size, names.length);
const compiled = ts.transpileModule([...bodies.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const scope = { kind: 'mapped-site' as const, siteId };
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
const noWrite = /No crop cycle has been added to your saved plan/;
const unconfirmed = /The write completed, but the current saved plan could not be confirmed/;
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function parent(book: CropPlanState) {
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book));
  let notify = () => {};
  const state: any = { plan: crop.loadCropPlanWithWriteAdmission().book, planWriteBase: { current: null }, planSaveConflict: false, planSaveFailed: false, saveTimer: { current: null },
    growerOwner: account.activeAccountUid(), growerSample: samples.isSampleMode(), growerScope: scope, growerScopeKey: growerPlanningScopeKey(scope), productionSiteId: siteId,
    growerBookContext: { current: { siteId, owner: account.activeAccountUid(), sample: samples.isSampleMode(), scopeKey: growerPlanningScopeKey(scope) } },
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode, isBackendConfigured: () => probe.configured,
    getFirebase: () => ({ auth: { currentUser: probe.actor ? { uid: probe.actor } : null } }),
    readRawCropPlanReceipt: crop.readRawCropPlanReceipt, loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission,
    cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches, cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless,
    cropPlanWriteToken: crop.cropPlanWriteToken, saveCropPlanWithReceipt: crop.saveCropPlanWithReceipt, prepareGrowerWorkflowAcceptance, growerPlanningScopeKey,
    clearTimeout() {},
    setPlan(value: CropPlanState | ((book: CropPlanState) => CropPlanState)) { state.plan = typeof value === 'function' ? value(state.plan) : value; notify(); },
    setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; notify(); },
    setPlanSaveFailed(value: boolean) { state.planSaveFailed = value; notify(); } };
  const actual = Function('state', `with(state){${compiled};return {${names.join(',')}};}`)(state);
  const admitted = crop.loadCropPlanWithWriteAdmission(); assert.ok(admitted.token);
  actual.rememberStoredPlan(state.plan, admitted.token);
  assert.equal(actual.readCurrentGrowerBook().status, 'ready');
  return { state, ...actual, notify(callback: () => void) { notify = callback; }, publish() { notify(); } };
}
async function fixture() {
  const own = await ownRow();
  const target: HarvestTarget = { id: 'buyer', siteId, cropKey: CROPS[0].key, startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 7, marketablePercent: 100 };
  // Engineering capacities and dates only; no crop guidance or production observations.
  const book: CropPlanState = { version: 1, plantings: [], harvestTargets: [target], growerPlanningProfiles: [own.row.growerCycle.assessmentSnapshot.profile], updatedAt: 7 };
  local.setItem(studioKey(), JSON.stringify(studio()));
  const controller = parent(book);
  let renderer!: ReactTestRenderer, latest!: ReturnType<typeof useGrowerWorkflow>;
  let reviewPending: Promise<GrowerWorkflowReview> | null = null, acceptPending: Promise<GrowerWorkflowAcceptanceResult> | null = null;
  let lastReview: GrowerWorkflowReview | null = null, ids = 0;
  let selection: Parameters<typeof useGrowerWorkflow>[0]['selection'] = { kind: 'studio-canvas', sourceId: siteId };
  let refreshPending: Promise<void> | null = null;
  function App() {
    const [model, setModel] = React.useState(() => ({ book: controller.state.plan as CropPlanState, tick: 0 }));
    controller.notify(() => setModel(previous => ({ book: controller.state.plan, tick: previous.tick + 1 })));
    latest = useGrowerWorkflow({ selection, scope, resourceSiteId: siteId, book: model.book,
      actorIsCurrent: controller.growerActorIsCurrent, readCurrentBook: controller.readCurrentGrowerBook,
      commitAcceptance: controller.commitGrowerAcceptance, createPlantingId: () => `held-review-persistent-${++ids}` });
    return React.createElement(Panel, { scope, source: latest.source, sourceName: 'Engineering saved garden', sourceIssue: latest.sourceIssue,
      checking: latest.checking, contextRevision: latest.contextRevision, profiles: model.book.growerPlanningProfiles ?? [], targets: model.book.harvestTargets ?? [], targetSiteId: siteId,
      onRefresh: () => { refreshPending = latest.onRefresh(); return refreshPending; },
      onReview: (draft: GrowerWorkflowDraft) => { reviewPending = latest.onReview(draft).then(result => { lastReview = result; return result; }); return reviewPending; },
      onAccept: (review: Review, current: () => boolean) => { acceptPending = latest.onAccept(review, current); return acceptPending; }, acceptance: latest.acceptance });
  }
  act(() => { renderer = create(React.createElement(App)); });
  const field = (label: string) => { const node = renderer.root.findAllByType('label').find(item => text(item).startsWith(label)); assert.ok(node, label); return node.findAll(item => item.type === 'input' || item.type === 'select')[0]; };
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(item => text(item) === label); assert.ok(node, label); return node; };
  const ui = { controller, renderer, field, button, text: () => text(renderer.root),
    get latest() { return latest; }, get lastReview() { return lastReview; }, get acceptPending() { return acceptPending; }, get reviewPending() { return reviewPending; },
    saveButton: () => renderer.root.findAllByType('button').find(item => /^Save all \d+ planned crop cycles$/.test(text(item))),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string) { act(() => field(label).props.onChange({ target: { checked: true } })); },
    async click(label: string) { const previous = [reviewPending, acceptPending, refreshPending]; await act(async () => { button(label).props.onClick(); if (reviewPending !== previous[0]) await reviewPending; if (acceptPending !== previous[1]) await acceptPending; if (refreshPending !== previous[2]) await refreshPending; }); },
    beginReview() { button('Review automatic crop plan').props.onClick(); assert.ok(reviewPending); return reviewPending; },
    render() { act(() => controller.publish()); },
    select(next: typeof selection) { selection = next; act(() => renderer.update(React.createElement(App))); },
    dispose() { act(() => renderer.unmount()); } };
  await ui.click('Check saved design');
  ui.check(`Include ${CROPS[0].name}`); ui.change('Growing estimate for this target', 'own-estimate');
  ui.change('First planning date', '2028-12-01'); ui.change('Planning ends before', '2029-01-01'); ui.change('Search work limit', '1000');
  ui.check('I confirm availability'); ui.change('Available from', '2028-12-01'); ui.change('Available until', '2029-01-01'); ui.check('I supply these planning dates');
  await ui.click('Review automatic crop plan'); assert.equal(ui.lastReview?.status, 'review'); assert.ok(ui.saveButton());
  return ui;
}
type Screen = Awaited<ReturnType<typeof fixture>>;
async function save(ui: Screen, outcome: 'confirmed' | 'superseded' = 'confirmed') {
  let written: CropPlanState | null = null;
  const supersede = () => {
    written = JSON.parse(readCanonicalCropPlanFixtureRaw());
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ ...written, updatedAt: 1234 }));
  };
  if (outcome === 'superseded') events.addEventListener(crop.CROP_PLAN_CHANGED_EVENT, supersede, { once: true });
  try { await ui.click(text(ui.saveButton()!)); } finally { events.removeEventListener(crop.CROP_PLAN_CHANGED_EVENT, supersede); }
  assert.equal(ui.latest.acceptance.status, outcome);
  const stored = JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
  assert.ok(stored.plantings.length > 0, 'the real writer must have appended canonical cycles before a receipt assertion');
  if (outcome === 'superseded') { assert.ok(written); assert.deepEqual(stored.plantings, (written as CropPlanState).plantings); assert.match(ui.text(), unconfirmed); }
  else { assert.match(ui.text(), /planned crop cycles saved on this device/); assert.equal(ui.saveButton(), undefined, 'a real parent book update withdraws the old review'); }
  return stored;
}
function heldBook(ui: Screen, mode: 'pending' | 'conflict') {
  if (mode === 'pending') ui.controller.state.plan = { ...ui.controller.state.plan, planNotes: [{ kind: 'basis', text: 'Engineering unsaved edit' }] };
  else ui.controller.state.planSaveConflict = true;
  ui.render(); assert.equal(ui.controller.readCurrentGrowerBook().status, 'held');
}

for (const completed of ['confirmed', 'superseded'] as const) test(`${completed} writer followed by a held book review never claims that no cycle was added`, async () => {
  const ui = await fixture(); try {
    await save(ui, completed); const stored = readCanonicalCropPlanFixtureRaw(); heldBook(ui, completed === 'confirmed' ? 'pending' : 'conflict');
    const writes = local.writes; await ui.click('Review automatic crop plan');
    assert.equal(ui.lastReview?.status, 'held'); assert.match(ui.text(), /Review inputs before planning/); assert.equal(ui.saveButton(), undefined);
    assert.doesNotMatch(ui.text(), noWrite);
    if (completed === 'superseded') { assert.equal(ui.latest.acceptance.status, 'superseded'); assert.match(ui.text(), unconfirmed); }
    assert.equal(readCanonicalCropPlanFixtureRaw(), stored); assert.equal(local.writes, writes);
  } finally { ui.dispose(); }
});

test('an explicit source refresh keeps its reset but a still-held book does not gain the no-write sentence', async () => {
  const ui = await fixture(); try {
    await save(ui, 'superseded'); await ui.click('Check saved design'); assert.equal(ui.latest.acceptance.status, 'idle');
    assert.doesNotMatch(ui.text(), unconfirmed); assert.equal(ui.controller.readCurrentGrowerBook().status, 'held');
    const writes = local.writes; await ui.click('Review automatic crop plan'); assert.equal(ui.lastReview?.status, 'held');
    assert.doesNotMatch(ui.text(), noWrite); assert.equal(ui.saveButton(), undefined); assert.equal(local.writes, writes);
  } finally { ui.dispose(); }
});

for (const hold of ['before-book', 'after-book', 'source'] as const) test(`a new review held at ${hold} retains the completed-unconfirmed warning without writing`, async () => {
  const ui = await fixture(); try {
    await save(ui, 'superseded'); const originalReview = ui.lastReview!;
    // Re-admit the actual stored append to isolate the later review gate.
    const admitted = crop.loadCropPlanWithWriteAdmission(); ui.controller.state.plan = admitted.book; ui.controller.state.planSaveConflict = false;
    ui.controller.rememberStoredPlan(admitted.book, admitted.token); ui.render();
    if (hold === 'before-book') heldBook(ui, 'pending');
    if (hold === 'source') { const moved = studio(); moved.items[0].x += 0.1; local.setItem(studioKey(), JSON.stringify(moved)); }
    const writes = local.writes, bytes = readCanonicalCropPlanFixtureRaw();
    if (hold === 'after-book') {
      const gate = pauseHashes(); let pending!: Promise<GrowerWorkflowReview>;
      act(() => { pending = ui.beginReview(); }); await gate.started;
      heldBook(ui, 'conflict'); await act(async () => { gate.resume(); await pending; });
    } else await ui.click('Review automatic crop plan');
    assert.equal(ui.latest.acceptance.status, 'superseded'); assert.match(ui.text(), unconfirmed); assert.doesNotMatch(ui.text(), noWrite);
    assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
    let replay!: GrowerWorkflowAcceptanceResult;
    await act(async () => { replay = await ui.latest.onAccept(originalReview as Review); });
    assert.equal(replay.status, 'held'); assert.equal(ui.latest.acceptance.status, 'superseded'); assert.equal(local.writes, writes);
  } finally { ui.dispose(); }
});

test('a fully re-admitted new ready review replaces the old warning and offers a fresh explicit save', async () => {
  const ui = await fixture(); try {
    await save(ui, 'superseded'); const admitted = crop.loadCropPlanWithWriteAdmission();
    ui.controller.state.plan = admitted.book; ui.controller.state.planSaveConflict = false; ui.controller.rememberStoredPlan(admitted.book, admitted.token); ui.render();
    const writes = local.writes; await ui.click('Review automatic crop plan'); assert.equal(ui.lastReview?.status, 'review');
    assert.equal(ui.latest.acceptance.status, 'idle'); assert.doesNotMatch(ui.text(), unconfirmed); assert.ok(ui.saveButton()); assert.equal(ui.saveButton()!.props.disabled, false);
    assert.match(ui.text(), noWrite); assert.equal(local.writes, writes, 'reviewing still does not write');
  } finally { ui.dispose(); }
});

for (const outcome of ['held', 'failed'] as const) test(`${outcome} prewrite outcomes retain explicit manual retry and never fabricate a completed receipt`, async () => {
  const ui = await fixture(); try {
    if (outcome === 'held') ui.controller.state.plan = { ...ui.controller.state.plan, planNotes: [{ kind: 'basis', text: 'Engineering pending edit' }] };
    const actual = local.setItem; if (outcome === 'failed') local.setItem = () => { throw Error('Engineering quota failure'); };
    const bytes = readCanonicalCropPlanFixtureRaw(); let result: GrowerWorkflowAcceptanceResult | null = null;
    try { await ui.click(text(ui.saveButton()!)); result = await ui.acceptPending; } finally { local.setItem = actual; }
    assert.equal(result?.status, outcome); assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
    assert.ok(ui.saveButton()); assert.equal(ui.saveButton()!.props.disabled, false); assert.doesNotMatch(ui.text(), unconfirmed);
    if (outcome === 'held') ui.controller.state.plan = crop.loadCropPlanWithWriteAdmission().book;
    ui.render(); await ui.click(text(ui.saveButton()!)); assert.equal(ui.latest.acceptance.status, 'confirmed');
    const writes = local.writes; assert.match(ui.text(), /planned crop cycles saved on this device/); assert.doesNotMatch(ui.text(), noWrite);
    assert.equal(ui.saveButton(), undefined); assert.equal(local.writes, writes);
  } finally { ui.dispose(); }
});

test('a held review before any write has neither a completed receipt nor an asserted write absence from earlier proposals', async () => {
  const ui = await fixture(); try {
    heldBook(ui, 'pending'); const writes = local.writes, before = readCanonicalCropPlanFixtureRaw();
    await ui.click('Review automatic crop plan'); assert.equal(ui.lastReview?.status, 'held'); assert.doesNotMatch(ui.text(), noWrite);
    assert.doesNotMatch(ui.text(), /write completed|planned crop cycles saved on this device/); assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  } finally { ui.dispose(); }
});

test('completed writes block retained Save and direct old acceptance while source refresh remains an explicit reset', async () => {
  for (const completed of ['confirmed', 'superseded'] as const) {
    await reset(); const ui = await fixture(); try {
      const retained = ui.saveButton()!.props.onClick, original = ui.lastReview as Review;
      await save(ui, completed); const writes = local.writes, bytes = readCanonicalCropPlanFixtureRaw();
      await act(async () => { retained(); assert.equal((await ui.latest.onAccept(original)).status, 'held'); });
      assert.equal(ui.latest.acceptance.status, completed); assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
      await ui.click('Check saved design'); assert.equal(ui.latest.acceptance.status, 'idle'); assert.equal(ui.saveButton(), undefined);
      await act(async () => retained()); assert.equal(local.writes, writes);
    } finally { ui.dispose(); }
  }
});

test('source selection changes and unmount do not let an old completed review restore its receipt or write again', async () => {
  const ui = await fixture(); let disposed = false; try {
    const retained = ui.saveButton()!.props.onClick, original = ui.lastReview as Review; await save(ui, 'superseded');
    ui.select(null); assert.equal(ui.latest.acceptance.status, 'idle'); assert.doesNotMatch(ui.text(), unconfirmed);
    ui.select({ kind: 'studio-canvas', sourceId: siteId }); const writes = local.writes, bytes = readCanonicalCropPlanFixtureRaw();
    const accept = ui.latest.onAccept; ui.dispose(); disposed = true;
    await act(async () => retained()); assert.equal((await accept(original)).status, 'held');
    assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
  } finally { if (!disposed) ui.dispose(); }
});


test('the actual parent classifies a readback exception after its completed write as superseded and a held review keeps that warning', async () => {
  const ui = await fixture(); try {
    const actualRead = ui.controller.state.loadCropPlanWithWriteAdmission; let reads = 0;
    ui.controller.state.loadCropPlanWithWriteAdmission = () => {
      if (++reads === 2) throw Error('Engineering postwrite readback failure');
      return actualRead();
    };
    const writes = local.writes;
    try { await ui.click(text(ui.saveButton()!)); } finally { ui.controller.state.loadCropPlanWithWriteAdmission = actualRead; }
    assert.equal(reads, 2); assert.equal(ui.latest.acceptance.status, 'superseded');
    assert.ok(JSON.parse(readCanonicalCropPlanFixtureRaw()).plantings.length > 0);
    assert.equal(local.writes, writes + 1, 'the actual writer completed exactly one append before its readback failed');
    assert.match(ui.text(), unconfirmed); assert.equal(ui.controller.readCurrentGrowerBook().status, 'held');
    await ui.click('Review automatic crop plan'); assert.equal(ui.lastReview?.status, 'held');
    assert.equal(ui.latest.acceptance.status, 'superseded'); assert.match(ui.text(), unconfirmed); assert.doesNotMatch(ui.text(), noWrite);
    assert.equal(local.writes, writes + 1);
  } finally { ui.dispose(); }
});

test('a ready book with a new admitted token after source hashing cannot replace a completed-unconfirmed warning', async () => {
  const ui = await fixture(); let gate: ReturnType<typeof pauseHashes> | null = null;
  try {
    await save(ui, 'superseded'); let admitted = crop.loadCropPlanWithWriteAdmission();
    ui.controller.state.plan = admitted.book; ui.controller.state.planSaveConflict = false;
    ui.controller.rememberStoredPlan(admitted.book, admitted.token); ui.render();
    const before = ui.controller.readCurrentGrowerBook(); assert.equal(before.status, 'ready');
    gate = pauseHashes(); let pending!: Promise<GrowerWorkflowReview>;
    act(() => { pending = ui.beginReview(); }); await gate.started;
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ ...admitted.book, updatedAt: Date.now() + 1 }));
    admitted = crop.loadCropPlanWithWriteAdmission(); ui.controller.state.plan = admitted.book;
    ui.controller.rememberStoredPlan(admitted.book, admitted.token); ui.render();
    const after = ui.controller.readCurrentGrowerBook(); assert.equal(after.status, 'ready');
    assert.notEqual(after.token, before.token, 'both gates must be ready while their actual stored tokens differ');
    const bytes = readCanonicalCropPlanFixtureRaw(), writes = local.writes;
    await act(async () => { gate!.resume(); await pending; }); gate = null;
    assert.equal(ui.lastReview?.status, 'held'); assert.ok(ui.lastReview?.issues.includes('saved-plan-changed'));
    assert.equal(ui.latest.acceptance.status, 'superseded'); assert.match(ui.text(), unconfirmed); assert.doesNotMatch(ui.text(), noWrite);
    assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
  } finally { gate?.resume(); ui.dispose(); }
});
