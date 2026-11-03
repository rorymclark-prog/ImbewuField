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
      return pending ? pending(draft) : assembleGrowerWorkflowReview({ scope, source, book, draft, recordedAt });
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
