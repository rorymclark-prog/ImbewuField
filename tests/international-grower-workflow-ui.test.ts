import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import type { GrowerPlanningProfile, GrowerInput } from '../lib/international/grower-planning.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { GrowerAutoPlanPanelProps } from '../components/crops/GrowerAutoPlanPanel.tsx';

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/components/crops/GrowerAutoPlanPanel.tsx')) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
after(() => hooks.deregister());

// Synthetic review fixtures. These are neither crop instructions nor equipment defaults.
const recordedAt = '2026-11-03T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-profile-id', cropKey: CROPS[0].key, scope, inputs: {
  plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
  nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(1, 'days'),
  fieldOccupancyDays: own(2, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
} };
const target: HarvestTarget = { id: 'private-buyer-target-id', siteId: scope.siteId, cropKey: profile.cropKey,
  weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02', marketablePercent: 50 };
const canvas = buildDemoDesignCanvasState();
canvas.siteId = scope.siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
canvas.items = [{ ...canvas.items.find(item => item.defId === 'veg_bed')!, id: 'private-bed-id', label: 'Fixture bed', wM: 3, hM: 2 }];
canvas.zones = []; canvas.lines = [];
const inspected = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
  raw: canvas, sourceRevision: 'private-fixture-raw-receipt' }));
assert.equal(inspected.status, 'ready');
if (inspected.status !== 'ready') throw Error('The authored fixture source must be valid');
const source = inspected;
const book: CropPlanState = { version: 1, plantings: [], harvestTargets: [target], growerPlanningProfiles: [profile], updatedAt: 1 };
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount() {
  let renderer!: ReactTestRenderer;
  let pending: ((draft: GrowerWorkflowDraft) => Promise<GrowerWorkflowReview>) | null = null;
  const attempts: GrowerWorkflowDraft[] = [];
  const props: GrowerAutoPlanPanelProps = { scope, source, sourceName: 'Synthetic saved garden', sourceIssue: null, checking: false,
    contextRevision: 1, profiles: [profile], targets: [target], targetSiteId: scope.siteId,
    onRefresh: async () => {}, onReview: async draft => {
      attempts.push(structuredClone(draft));
      return pending ? pending(draft) : assembleGrowerWorkflowReview({ scope: props.scope, source: props.source, book, draft, recordedAt });
    } };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(item => text(item).startsWith(label));
    assert.ok(node, `Missing actual review field: ${label}`);
    return node.findAll(item => item.type === 'input' || item.type === 'select')[0];
  };
  return { props, attempts, get renderer() { return renderer; }, text: () => text(renderer.root), field,
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string, checked = true) { act(() => field(label).props.onChange({ target: { checked } })); },
    async click(label: string) { const node = renderer.root.findAllByType('button').find(item => text(item) === label); assert.ok(node); await act(async () => { await node.props.onClick(); }); },
    update(values: Partial<GrowerAutoPlanPanelProps>) { Object.assign(props, values); act(() => renderer.update(React.createElement(Panel, props))); },
    defer(callback: typeof pending) { pending = callback; }, dispose() { act(() => renderer.unmount()); } };
}
function fill(screen: ReturnType<typeof mount>) {
  screen.check(`Include ${CROPS[0].name}`);
  assert.equal(screen.field('Growing estimate for this target').props.value, '', 'a matching profile must still be chosen explicitly');
  screen.change('Growing estimate for this target', profile.profileId);
  screen.change('First planning date', '2028-02-01'); screen.change('Planning ends before', '2028-03-01'); screen.change('Search work limit', '1000');
  screen.check(`I confirm availability for ${source.beds[0].label}`); screen.change('Available from', '2028-02-01'); screen.change('Available until', '2028-03-01');
  screen.check('I supply these planning dates and availability as my estimates.');
}

// Locate the actual rendered row, so ordinary edits never reuse a callback
// captured before a sibling was inserted or removed.
function intervals(screen: ReturnType<typeof mount>, bedLabel = source.beds[0].label) {
  return screen.renderer.root.findAllByType('label').filter(node => text(node).startsWith(`I confirm availability for ${bedLabel} ·`))
    .map(label => {
      const row = label.parent!;
      return { label, confirm: label.findByType('input'), dates: row.findAllByType('input').filter(node => node.props.type === 'date'),
        remove: row.findByType('button') };
    });
}
function availabilityButton(screen: ReturnType<typeof mount>, bedLabel = source.beds[0].label) {
  const button = screen.renderer.root.findAllByType('button').find(node => node.props['aria-label']?.startsWith(`Add availability interval for ${bedLabel},`));
  assert.ok(button); return button;
}
function addInterval(screen: ReturnType<typeof mount>, bedLabel = source.beds[0].label) {
  act(() => availabilityButton(screen, bedLabel).props.onClick());
}
function dateInterval(screen: ReturnType<typeof mount>, index: number, start: string, end: string, bedLabel = source.beds[0].label) {
  act(() => intervals(screen, bedLabel)[index].dates[0].props.onChange({ target: { value: start } }));
  act(() => intervals(screen, bedLabel)[index].dates[1].props.onChange({ target: { value: end } }));
}
function confirmInterval(screen: ReturnType<typeof mount>, index: number, checked: boolean, bedLabel = source.beds[0].label) {
  act(() => intervals(screen, bedLabel)[index].confirm.props.onChange({ target: { checked } }));
}
function intervalValues(screen: ReturnType<typeof mount>, bedLabel = source.beds[0].label) {
  return intervals(screen, bedLabel).map(row => ({ start: row.dates[0].props.value, endExclusive: row.dates[1].props.value, confirmed: row.confirm.props.checked }));
}

test('recurring buyer-demand decimals stay readable while the reviewed request and calculations remain exact', async () => {
  const screen = mount();
  try {
    const fractionalTarget = { ...target, weeklyKg: 1 };
    screen.update({ targets: [fractionalTarget] });
    let reviewed: GrowerWorkflowReview | undefined, before = '';
    screen.defer(async draft => {
      reviewed = assembleGrowerWorkflowReview({ scope, source, book: { ...book, harvestTargets: [fractionalTarget] }, draft, recordedAt });
      before = JSON.stringify(reviewed);
      return reviewed;
    });
    fill(screen); await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Buyer demand: ≈4\.143 kg/);
    assert.match(screen.text(), /Gross estimated cycle capacity needed: ≈8\.286 kg/);
    assert.equal(JSON.stringify(reviewed), before, 'formatting must never round the actual request, dates, capacities or proposal');
    assert.doesNotMatch(screen.text(), /4\.142857142857143/);
  } finally { screen.dispose(); }
});

test('automatic own-plan controls start without dates, budgets, profile selections or assumed free beds', async () => {
  const screen = mount(); try {
    for (const input of screen.renderer.root.findAllByType('input')) {
      if (input.props.type === 'checkbox') assert.equal(input.props.checked, false); else assert.equal(input.props.value, '');
    }
    await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Confirm that you supply these planning dates/);
    assert.equal(screen.attempts.length, 1);
    assert.deepEqual(screen.attempts[0].available, []);
    assert.deepEqual(screen.attempts[0].targetProfiles, []);
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
  } finally { screen.dispose(); }
});

test('actual buyer/profile/availability choices produce a proposal without writing a crop or promising weekly deliveries', async () => {
  const screen = mount(), before = JSON.stringify(book);
  try {
    fill(screen); await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Proposed whole-bed crop cycles/);
    assert.match(screen.text(), /Buyer demand: 29 kg/); assert.match(screen.text(), /Gross estimated cycle capacity needed: 58 kg/);
    assert.match(screen.text(), /Weekly delivery quantities remain unverified/);
    assert.match(screen.text(), /12 kg for this whole cycle/);
    assert.match(screen.text(), /No crop cycle has been added to your saved plan/);
    assert.equal(JSON.stringify(book), before);
    assert.equal(screen.renderer.root.findAllByType('button').some(node => /Add .*plan|Accept/.test(text(node))), false);
    for (const hidden of [profile.profileId, target.id, source.sourceKey, source.sourceRevision, source.geometryFingerprint, source.beds[0].id]) assert.equal(screen.text().includes(hidden), false);
  } finally { screen.dispose(); }
});

test('an edited review cannot display a late proposal from the prior controls', async () => {
  const screen = mount(); let complete!: (value: GrowerWorkflowReview) => void;
  try {
    fill(screen); screen.defer(async () => new Promise(resolve => { complete = resolve; }));
    const pending = screen.click('Review automatic crop plan');
    screen.change('Search work limit', '500');
    const draft = screen.attempts[0]; complete(assembleGrowerWorkflowReview({ scope, source, book, draft, recordedAt }));
    await pending; assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|12 kg for this whole cycle/);
  } finally { screen.dispose(); }
});

test('source or account invalidation clears an existing proposal immediately', async () => {
  const screen = mount(); try {
    fill(screen); await screen.click('Review automatic crop plan'); assert.match(screen.text(), /Proposed whole-bed crop cycles/);
    screen.update({ contextRevision: 2, source: null, sourceIssue: 'Current context changed.' });
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|12 kg for this whole cycle/);
    const action = screen.renderer.root.findAllByType('button').find(node => text(node) === 'Review automatic crop plan')!;
    assert.equal(action.props.disabled, true);
  } finally { screen.dispose(); }
});

test('two confirmed intervals for one saved bed reach the real planner separately without inferred gap availability', async () => {
  const screen = mount(), before = JSON.stringify(canvas);
  try {
    fill(screen); dateInterval(screen, 0, '2028-02-01', '2028-02-10');
    addInterval(screen);
    assert.deepEqual(intervalValues(screen), [
      { start: '2028-02-01', endExclusive: '2028-02-10', confirmed: true },
      { start: '', endExclusive: '', confirmed: false },
    ]);
    dateInterval(screen, 1, '2028-02-20', '2028-03-01'); confirmInterval(screen, 1, true);
    await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Proposed whole-bed crop cycles/);
    assert.match(screen.text(), /Gaps are unavailable/);
    assert.match(screen.text(), /end day is outside that interval/);
    assert.match(screen.text(), /Adjacent intervals stay separate/);
    const request = screen.attempts.at(-1)!;
    assert.deepEqual(request.available, [
      { bedId: source.beds[0].id, start: '2028-02-01', endExclusive: '2028-02-10', confirmed: true },
      { bedId: source.beds[0].id, start: '2028-02-20', endExclusive: '2028-03-01', confirmed: true },
    ], 'private row identities must not change the established workflow DTO');
    const actual = assembleGrowerWorkflowReview({ scope, source, book, draft: request, recordedAt });
    assert.equal(actual.status, 'review');
    if (actual.status === 'review') {
      assert.ok(actual.proposal.cycles.length > 0);
      for (const cycle of actual.proposal.cycles) {
        // Compare actual proposal interval fields without supplying a parallel planner.
        assert.ok(request.available.some(window => window.start <= cycle.assessment.schedule.fieldEntryDate
          && cycle.assessment.schedule.nextFieldEntryDate <= window.endExclusive));
      }
    }
    assert.equal(JSON.stringify(canvas), before);
  } finally { screen.dispose(); }
});

test('each interval has associated unique controls and removing one preserves its siblings and other saved beds', async () => {
  const screen = mount();
  try {
    const secondBed = { ...source.beds[0], id: 'private-second-bed', label: 'Second fixture bed' };
    screen.update({ source: { ...source, beds: [...source.beds, secondBed] } });
    fill(screen); addInterval(screen);
    dateInterval(screen, 1, '2028-02-20', '2028-03-01'); confirmInterval(screen, 1, true);
    dateInterval(screen, 0, '2028-02-11', '2028-02-15', secondBed.label);
    confirmInterval(screen, 0, true, secondBed.label);
    const ids: string[] = [];
    for (const bed of [source.beds[0], secondBed]) for (const row of intervals(screen, bed.label)) {
      for (const input of [row.confirm, ...row.dates]) {
        ids.push(input.props.id);
        assert.equal(input.parent!.props.htmlFor, input.props.id);
        assert.match(input.props.type === 'checkbox' ? input.parent!.props.className : input.props.className, /min-h-11/);
      }
      assert.match(row.remove.props.className, /min-h-11/);
      assert.match(row.remove.props['aria-label'], /growing space \d/);
    }
    assert.equal(new Set(ids).size, ids.length);
    assert.match(availabilityButton(screen).props.className, /min-h-11/);
    const secondBefore = intervalValues(screen, secondBed.label);
    dateInterval(screen, 0, '2028-02-02', '2028-02-09');
    assert.deepEqual(intervalValues(screen)[1], { start: '2028-02-20', endExclusive: '2028-03-01', confirmed: true });
    act(() => intervals(screen)[0].remove.props.onClick());
    assert.deepEqual(intervalValues(screen), [{ start: '2028-02-20', endExclusive: '2028-03-01', confirmed: true }]);
    assert.deepEqual(intervalValues(screen, secondBed.label), secondBefore);
    await screen.click('Review automatic crop plan');
    assert.equal(screen.attempts.at(-1)!.available.length, 2);
    assert.equal(screen.attempts.at(-1)!.available.filter(row => row.bedId === secondBed.id).length, 1);
  } finally { screen.dispose(); }
});

test('confirmation is per interval and unconfirming immediately withdraws the displayed proposal without discarding dates', async () => {
  const screen = mount();
  try {
    fill(screen); dateInterval(screen, 0, '2028-02-01', '2028-02-10'); addInterval(screen);
    dateInterval(screen, 1, '2028-02-20', '2028-03-01');
    assert.deepEqual(intervalValues(screen).map(row => row.confirmed), [true, false]);
    confirmInterval(screen, 1, true); await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Proposed whole-bed crop cycles/);
    confirmInterval(screen, 0, false);
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
    assert.deepEqual(intervalValues(screen), [
      { start: '2028-02-01', endExclusive: '2028-02-10', confirmed: false },
      { start: '2028-02-20', endExclusive: '2028-03-01', confirmed: true },
    ]);
  } finally { screen.dispose(); }
});

test('removed row callbacks cannot edit a shifted sibling or lend its dates and confirmation to a replacement first row', () => {
  const screen = mount();
  try {
    fill(screen); addInterval(screen); dateInterval(screen, 1, '2028-02-20', '2028-03-01');
    const removed = intervals(screen)[0], edit = removed.dates[0].props.onChange, check = removed.confirm.props.onChange, remove = removed.remove.props.onClick;
    act(() => remove());
    const remaining = intervalValues(screen);
    act(() => { edit({ target: { value: '2028-02-25' } }); check({ target: { checked: true } }); remove(); });
    assert.deepEqual(intervalValues(screen), remaining);
    const last = intervals(screen)[0], lastId = last.confirm.props.id, lastCheck = last.confirm.props.onChange, lastDate = last.dates[0].props.onChange;
    act(() => last.remove.props.onClick());
    assert.notEqual(intervals(screen)[0].confirm.props.id, lastId);
    assert.deepEqual(intervalValues(screen), [{ start: '', endExclusive: '', confirmed: false }]);
    act(() => { lastDate({ target: { value: '2028-02-20' } }); lastCheck({ target: { checked: true } }); });
    assert.deepEqual(intervalValues(screen), [{ start: '', endExclusive: '', confirmed: false }]);
    assert.equal(intervals(screen)[0].remove.props.disabled, true);
    confirmInterval(screen, 0, true);
    assert.deepEqual(intervalValues(screen), [{ start: '', endExclusive: '', confirmed: true }], 'only a fresh explicit handler may materialize the new row');
  } finally { screen.dispose(); }
});

for (const kind of ['source', 'account'] as const) test(`retained interval Add, Remove and confirmation handlers withdraw after ${kind} changes`, () => {
  const screen = mount();
  try {
    fill(screen); addInterval(screen);
    const oldAdd = availabilityButton(screen).props.onClick, oldRemove = intervals(screen)[0].remove.props.onClick,
      oldConfirm = intervals(screen)[1].confirm.props.onChange;
    screen.update(kind === 'source' ? { source: { ...source } } : { contextRevision: 2 });
    const before = intervalValues(screen);
    act(() => { oldAdd(); oldRemove(); oldConfirm({ target: { checked: true } }); });
    assert.deepEqual(intervalValues(screen), before);
    addInterval(screen);
    assert.equal(intervals(screen).length, 3, 'the current context retains working explicit controls');
  } finally { screen.dispose(); }
});

for (const edit of ['add', 'date', 'remove', 'unconfirm'] as const) test(`a late review cannot survive an availability ${edit}`, async () => {
  const screen = mount(); let complete!: (value: GrowerWorkflowReview) => void;
  try {
    fill(screen); screen.defer(async () => new Promise(resolve => { complete = resolve; }));
    const waiting = screen.click('Review automatic crop plan');
    if (edit === 'add') addInterval(screen);
    if (edit === 'date') dateInterval(screen, 0, '2028-02-02', '2028-03-01');
    if (edit === 'remove') act(() => intervals(screen)[0].remove.props.onClick());
    if (edit === 'unconfirm') confirmInterval(screen, 0, false);
    complete(assembleGrowerWorkflowReview({ scope, source, book, draft: screen.attempts[0], recordedAt }));
    await waiting;
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles|12 kg for this whole cycle/);
  } finally { screen.dispose(); }
});

test('an interval edit synchronously revokes an in-flight acceptance and a retained Save cannot accept the withdrawn review', async () => {
  const screen = mount(); let calls = 0, isCurrent!: () => boolean, complete!: () => void;
  try {
    screen.update({ onAccept: async (_review, current) => {
      calls++; isCurrent = current; await new Promise<void>(resolve => { complete = resolve; }); return { status: 'superseded' };
    } });
    fill(screen); await screen.click('Review automatic crop plan');
    const save = screen.renderer.root.findAllByType('button').find(node => /^Save all \d+ planned crop cycles$/.test(text(node)));
    assert.ok(save, 'the real reviewed proposal must be eligible for its parent acceptance boundary');
    const staleSave = save.props.onClick;
    act(() => staleSave()); assert.equal(calls, 1); assert.equal(isCurrent(), true);
    const edit = intervals(screen)[0].confirm.props.onChange;
    act(() => { edit({ target: { checked: false } }); assert.equal(isCurrent(), false); });
    await act(async () => { complete(); });
    act(() => staleSave()); assert.equal(calls, 1);
  } finally { screen.dispose(); }
});

test('overlapping checked intervals show the real model hold instead of treating a repeated bed as a duplicate selection', async () => {
  const screen = mount();
  try {
    fill(screen); addInterval(screen); dateInterval(screen, 1, '2028-02-10', '2028-02-20'); confirmInterval(screen, 1, true);
    await screen.click('Review automatic crop plan');
    assert.match(screen.text(), /Confirmed intervals for the same growing space overlap/);
    assert.doesNotMatch(screen.text(), /Proposed whole-bed crop cycles/);
  } finally { screen.dispose(); }
});

test('interval area labels abbreviate saved fractional measurements without rounding the source or real planner capacity', async () => {
  const screen = mount();
  try {
    // Synthetic engineering dimensions exercise the long tails observed on
    // calibrated sample plots; the display must not replace measured authority.
    const fractionalCanvas = structuredClone(canvas);
    fractionalCanvas.items[0].wM = 7.000064527197272; fractionalCanvas.items[0].hM = 3;
    const fractionalSource = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
      raw: fractionalCanvas, sourceRevision: 'private-fractional-raw-receipt' }));
    assert.equal(fractionalSource.status, 'ready');
    if (fractionalSource.status !== 'ready') throw Error('The fractional saved geometry fixture must remain readable');
    const area = fractionalSource.beds[0].areaM2;
    assert.ok(area > 21 && area < 21.001);
    const canvasBefore = JSON.stringify(fractionalCanvas), sourceBefore = JSON.stringify(fractionalSource);
    screen.update({ source: fractionalSource }); fill(screen); addInterval(screen);
    for (const row of intervals(screen)) {
      assert.match(text(row.label), /· ≈21 m² ·/);
      assert.equal(text(row.label).includes(String(area)), false);
    }
    await screen.click('Review automatic crop plan');
    const request = screen.attempts.at(-1)!;
    assert.deepEqual(request.available, [
      { bedId: fractionalSource.beds[0].id, start: '2028-02-01', endExclusive: '2028-03-01', confirmed: true },
      { bedId: fractionalSource.beds[0].id, start: '', endExclusive: '', confirmed: false },
    ]);
    const actual = assembleGrowerWorkflowReview({ scope, source: fractionalSource, book, draft: request, recordedAt });
    assert.equal(actual.status, 'review');
    if (actual.status === 'review') {
      assert.ok(actual.proposal.cycles.length > 0);
      for (const cycle of actual.proposal.cycles) assert.equal(cycle.assessment.capacity.measuredAreaM2, area);
    }
    assert.equal(JSON.stringify(fractionalSource), sourceBefore);
    assert.equal(JSON.stringify(fractionalCanvas), canvasBefore);
  } finally { screen.dispose(); }
});

test('the confirmed DEMO plan link uses real Next client navigation without reseeding the active sample book', async () => {
  const previous = new Map(['window', 'self', 'Storage', 'localStorage', 'sessionStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class MemoryStorage {
    rows = new Map<string, string>();
    get length() { return this.rows.size; }
    key(index: number) { return [...this.rows.keys()][index] ?? null; }
    getItem(key: string) { return this.rows.get(key) ?? null; }
    setItem(key: string, value: string) { this.rows.set(key, String(value)); }
    removeItem(key: string) { this.rows.delete(key); }
    clear() { this.rows.clear(); }
  }
  let hardNavigations = 0, network = 0, sampleChanges = 0, prefetches = 0;
  const hardNavigate = () => { hardNavigations++; throw Error('Task navigation must not reload the DEMO document'); };
  const location = { assign: hardNavigate, replace: hardNavigate, reload: hardNavigate,
    get href() { return 'https://example.invalid/facilitator/crops'; }, set href(_value: string) { hardNavigate(); } };
  const local = new MemoryStorage(), session = new MemoryStorage();
  const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session, location });
  for (const [key, value] of Object.entries({ window: browser, self: globalThis, Storage: MemoryStorage,
    localStorage: local, sessionStorage: session, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { network++; throw Error('The navigation fixture must not fetch'); } })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const samples = await import('../lib/sample-mode.ts');
  let renderer: ReactTestRenderer | undefined;
  const pushes: string[] = [];
  const changed = () => { sampleChanges++; };
  try {
    assert.equal(samples.enterSampleMode(), true);
    // Use the genuine sandbox with a distinct existing engineering fixture. This
    // checks the navigation boundary, not whether an acceptance write occurred.
    samples.setSandboxCropPlan(structuredClone(book));
    const retained = samples.getSandboxCropPlan(), before = JSON.stringify(retained);
    browser.addEventListener(samples.SAMPLE_MODE_EVENT, changed);
    function Destination() {
      assert.equal(samples.isSampleMode(), true);
      assert.equal(samples.getSandboxCropPlan(), retained, 'client navigation must retain the actual module-owned sample object');
      return React.createElement('p', { 'data-task-route': true }, JSON.stringify(samples.getSandboxCropPlan()));
    }
    function Host() {
      const [path, setPath] = React.useState('/facilitator/crops');
      const router = { back() {}, forward() {}, refresh: hardNavigate, replace: hardNavigate,
        prefetch() { prefetches++; }, push(href: string) { pushes.push(href); setPath(href); } };
      return React.createElement(AppRouterContext.Provider, { value: router }, path === '/cropplan'
        ? React.createElement(Destination)
        : React.createElement(Panel, { scope, source, sourceName: 'Synthetic saved garden', sourceIssue: null, checking: false,
          contextRevision: 1, profiles: [profile], targets: [target], targetSiteId: scope.siteId,
          onRefresh: async () => {}, onReview: async () => { throw Error('Navigation must not run a crop review'); },
          acceptance: { status: 'confirmed', rows: 1, sample: true } }));
    }
    act(() => { renderer = create(React.createElement(Host)); });
    const link = renderer!.root.findByType('a');
    assert.equal(link.props.href, '/cropplan'); assert.equal(text(link), 'Open dated work in the Task Planner');
    const status = renderer!.root.findAllByType('p').find(node => node.props.role === 'status'
      && text(node).includes('Open dated work in the Task Planner'));
    assert.ok(status); assert.match(text(status), /DEMO — 1 planned crop cycles saved in the example workspace/);
    assert.equal(typeof link.props.onClick, 'function', 'a plain anchor reloads and loses the in-memory sample book');
    const event = { currentTarget: { nodeName: 'A', getAttribute: () => null }, defaultPrevented: false,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, nativeEvent: { which: 1 },
      preventDefault() { this.defaultPrevented = true; } };
    await act(async () => link.props.onClick(event));
    assert.equal(event.defaultPrevented, true, 'the real Link must suppress native document navigation');
    assert.deepEqual(pushes, ['/cropplan']);
    assert.equal(text(renderer!.root.findByProps({ 'data-task-route': true })), before);
    assert.equal(JSON.stringify(samples.getSandboxCropPlan()), before);
    assert.equal(sampleChanges, 0); assert.equal(hardNavigations, 0); assert.equal(prefetches, 0); assert.equal(network, 0);
  } finally {
    if (renderer) act(() => renderer!.unmount());
    browser.removeEventListener(samples.SAMPLE_MODE_EVENT, changed); samples.exitSampleMode();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
