import test, { after, afterEach, beforeEach } from 'node:test';
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
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { assembleGrowerWorkflowReview, type GrowerWorkflowDraft, type GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { GrowerAutoPlanPanelProps } from '../components/crops/GrowerAutoPlanPanel.tsx';

const componentUrl = new URL('../components/crops/GrowerAutoPlanPanel.tsx', import.meta.url).href;
const projectorUrl = new URL('../lib/international/grower-harvest-demand.ts', import.meta.url).href;
const globals = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', '__buyerPickingUi', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 }, probe = { calls: 0 };
const storage = () => { effects.storage++; throw Error('Picking review must not access saved storage'); };
for (const [key, descriptor] of Object.entries({
  fetch: { value: () => { effects.network++; throw Error('Picking review must not request a service'); } },
  window: { value: Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } }) },
  localStorage: { get: storage }, sessionStorage: { get: storage },
  __buyerPickingUi: { value: probe }, IS_REACT_ACT_ENVIRONMENT: { value: true },
})) Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
const moduleText = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// Actual panel, assembler, engine and projector execute. This wrapper counts
// real projector calls without replacing its result or source validation.
// Next navigation is outside this read-only date-presence review.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl && specifier === '@/lib/international/grower-harvest-demand') {
      return moduleText(`export * from ${JSON.stringify(projectorUrl)};import {projectGrowerBuyerPickingPeriods as actual} from ${JSON.stringify(projectorUrl)};
export function projectGrowerBuyerPickingPeriods(...args){globalThis.__buyerPickingUi.calls++;return actual(...args);}`);
    }
    if (context.parentURL === componentUrl && specifier === 'next/link') return moduleText(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children);}`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');

// Existing grower-workflow engineering fixture pattern. These short durations,
// quantities and dimensions exercise boundaries, never farming instructions.
const recordedAt = '2026-11-05T12:00:00.000Z';
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic UI date-presence fixture only.' } });
async function fixture(options: { zero?: boolean; noBuyers?: boolean; twoBuyers?: boolean; missingYield?: boolean } = {}) {
  const canvas = buildDemoDesignCanvasState();
  canvas.siteId = scope.siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const first = canvas.items.find(item => item.defId === 'veg_bed'); assert.ok(first);
  canvas.items = [0, 1].slice(0, options.twoBuyers ? 2 : 1).map(index => ({ ...first,
    id: `private-picking-bed-${index}`, label: `Fixture bed ${index + 1}`, x: (index + 1) / 3, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: scope.siteId,
    raw: canvas, sourceRevision: 'private-picking-source-receipt' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') assert.fail('Existing measured fixture must be readable');
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-picking-profile-a', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: options.missingYield ? { state: 'missing', reason: 'not-entered' } : own(1, 'kg/m2/cycle'),
    establishment: own('direct', 'method'), nurseryDays: { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const target: HarvestTarget = { id: 'private-picking-buyer-a', siteId: scope.siteId, cropKey: profile.cropKey,
    startMonth: '2028-02', endMonth: '2028-02', weeklyKg: options.zero ? 0 : 1, marketablePercent: 100 };
  const profileB: GrowerPlanningProfile = { ...profile, profileId: 'private-picking-profile-b', cropKey: CROPS[1].key };
  const targetB: HarvestTarget = { ...target, id: 'private-picking-buyer-b', cropKey: profileB.cropKey };
  const book: CropPlanState = { version: 1, plantings: [], updatedAt: 1,
    growerPlanningProfiles: options.twoBuyers ? [profile, profileB] : [profile],
    harvestTargets: options.noBuyers ? [] : options.twoBuyers ? [target, targetB] : [target] };
  return { scope, source, canvas, book, profile, target, profileB, targetB };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Review = Extract<GrowerWorkflowReview, { status: 'review' }>;
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(f: Fixture) {
  let renderer!: ReactTestRenderer;
  let override: null | ((draft: GrowerWorkflowDraft) => Promise<GrowerWorkflowReview>) = null;
  let pending: Promise<GrowerWorkflowReview> | null = null;
  const attempts: GrowerWorkflowDraft[] = [], reviews: GrowerWorkflowReview[] = [];
  const props: GrowerAutoPlanPanelProps = { scope: f.scope, source: f.source, sourceName: 'Engineering saved garden', sourceIssue: null,
    checking: false, contextRevision: 1, profiles: f.book.growerPlanningProfiles!, targets: f.book.harvestTargets!, targetSiteId: scope.siteId,
    onRefresh: async () => {}, onReview: draft => {
      attempts.push(structuredClone(draft));
      pending = (override ? override(draft) : Promise.resolve(assembleGrowerWorkflowReview({ scope: props.scope, source: props.source, book: f.book, draft, recordedAt })))
        .then(result => { reviews.push(result); return result; });
      return pending;
    } };
  act(() => { renderer = create(React.createElement(Panel, props)); }); mounted.add(renderer);
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(item => text(item).startsWith(label)); assert.ok(node, label);
    const control = node.findAll(item => item.type === 'input' || item.type === 'select')[0]; assert.ok(control, label); return control;
  };
  const button = (label: string) => {
    const node = renderer.root.findAllByType('button').find(item => text(item) === label); assert.ok(node, label); return node;
  };
  return { renderer, props, attempts, reviews, field, button, text: () => text(renderer.root),
    report: () => renderer.root.findAllByProps({ 'aria-label': 'Buyer picking date review' })[0],
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string, checked = true) { act(() => field(label).props.onChange({ target: { checked } })); },
    async click(label: string) { const before = pending; await act(async () => { button(label).props.onClick(); if (pending && pending !== before) await pending; await Promise.resolve(); }); },
    beginReview() { act(() => button('Review automatic crop plan').props.onClick()); assert.ok(pending); return pending; },
    update(next: Partial<GrowerAutoPlanPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    defer(next: typeof override) { override = next; },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
}
type Screen = ReturnType<typeof mount>;
function planning(screen: Screen, f: Fixture, start = '2028-02-01', end = '2028-03-01', availableStart = start, availableEnd = end) {
  screen.change('First planning date', start); screen.change('Planning ends before', end); screen.change('Search work limit', '1000');
  for (const bed of f.source.beds) {
    screen.check(`I confirm availability for ${bed.label}`);
    screen.change(`Available from — ${bed.label}`, availableStart); screen.change(`Available until (exclusive) — ${bed.label}`, availableEnd);
  }
  screen.check('I supply these planning dates and availability as my estimates.');
}
function buyer(screen: Screen, f: Fixture, second = false) {
  const target = second ? f.targetB : f.target, profile = second ? f.profileB : f.profile;
  screen.check(`Include ${CROPS.find(crop => crop.key === target.cropKey)!.name}`);
  const rows = screen.renderer.root.findAllByType('label').filter(node => text(node).startsWith('Growing estimate for this target'));
  const cropLabel = screen.renderer.root.findAllByType('label').find(node => text(node).startsWith(`Include ${CROPS.find(crop => crop.key === target.cropKey)!.name}`)); assert.ok(cropLabel);
  const row = rows.find(node => node.parent === cropLabel.parent); assert.ok(row);
  act(() => row.findByType('select').props.onChange({ target: { value: profile.profileId } }));
}
function review(screen: Screen): Review {
  const result = screen.reviews.at(-1); assert.equal(result?.status, 'review');
  if (!result || result.status !== 'review') assert.fail('Expected the actual workflow assembler review'); return result;
}
function periods(screen: Screen, index = 1) {
  const report = screen.report(); assert.ok(report);
  const buyerSection = report.findByProps({ 'aria-label': `Buyer ${index} picking periods` });
  return buyerSection.findByType('ol').children.filter((child): child is ReactTestInstance => typeof child !== 'string');
}
async function household(screen: Screen, f: Fixture) {
  await screen.click('Add household demand'); screen.change('Crop —', f.profile.cropKey); screen.change('Growing estimate —', f.profile.profileId);
  screen.change('Gross harvest weight', '1'); screen.change('Harvest from', '2028-02-01'); screen.change('Harvest ends before', '2028-03-01');
}
beforeEach(() => { probe.calls = 0; effects.network = 0; effects.storage = 0; });
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); assert.deepEqual(effects, { network: 0, storage: 0 }); });
after(() => { hooks.deregister(); for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('buyer date presence uses exact seven-day and leap-day final bins, not a weekly delivery quantity', async () => {
  const f = await fixture(), before = JSON.stringify(f), ui = mount(f); planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan');
  const actual = review(ui); assert.equal(actual.proposal.status, 'ready'); assert.equal(probe.calls, 1);
  const detail = ui.report(); assert.ok(detail); assert.notEqual(detail.props.open, true);
  assert.match(detail.findByType('summary').props.className, /min-h-11/); assert.match(detail.props.className, /overflow-wrap:anywhere/);
  const rows = periods(ui); assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(row => text(row.findByType('h5'))), [
    'Review period 1: 2028-02-01 to before 2028-02-08 (UTC, exclusive)',
    'Review period 2: 2028-02-08 to before 2028-02-15 (UTC, exclusive)',
    'Review period 3: 2028-02-15 to before 2028-02-22 (UTC, exclusive)',
    'Review period 4: 2028-02-22 to before 2028-02-29 (UTC, exclusive)',
    'Review period 5: 2028-02-29 to before 2028-03-01 (UTC, exclusive)',
  ]);
  assert.match(text(rows[0]), /Some proposed picking dates are present/);
  assert.match(text(rows[0]), /Proposed cycle 1 · Fixture bed 1: 2028-02-02 to before 2028-02-04/);
  for (const row of rows.slice(1)) assert.match(text(row), /No proposed picking window overlaps/);
  for (const row of rows) assert.match(text(row), /Harvest\/delivery quantity for this period: Unknown/);
  assert.match(text(detail), /do not establish picking throughout the whole period/); assert.match(text(detail), /weekly supply/);
  assert.doesNotMatch(text(detail), /\d+(?:\.\d+)? kg|observed stock|coverage percent/);
  assert.match(ui.text(), /Weekly delivery quantities remain unverified/); assert.equal(JSON.stringify(f), before);
  for (const hidden of [f.profile.profileId, f.target.id, f.source.beds[0].id, f.source.geometryFingerprint]) assert.equal(text(detail).includes(hidden), false);
});

test('a buyer overlap excludes an earlier household cycle and an end touching the next period remains exclusive', async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f); await household(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan');
  const actual = review(ui); assert.equal(actual.proposal.cycles.length, 2);
  assert.notEqual(actual.proposal.cycles[0].demandId, f.target.id); assert.equal(actual.proposal.cycles[1].demandId, f.target.id);
  const rows = periods(ui); assert.match(text(rows[0]), /Proposed cycle 2 · Fixture bed 1: 2028-02-06 to before 2028-02-08/);
  assert.doesNotMatch(text(rows[0]), /Proposed cycle 1 ·/); assert.match(text(rows[1]), /No proposed picking window overlaps/);
  assert.equal(rows[1].findAllByType('ul').length, 0);
});

test('periods crossing this plan boundary remain unassessed even when their in-plan part has proposed picking', async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f, '2028-02-04', '2028-02-20', '2028-02-05', '2028-02-09'); buyer(ui, f);
  await ui.click('Review automatic crop plan'); const rows = periods(ui);
  assert.match(text(rows[0]), /Not fully within this plan/); assert.match(text(rows[0]), /Outside-plan dates are unassessed/);
  assert.match(text(rows[0]), /Proposed cycle 1 · Fixture bed 1: 2028-02-06 to before 2028-02-08/);
  assert.doesNotMatch(text(rows[0]), /No proposed picking window overlaps/);
  assert.match(text(rows[1]), /No proposed picking window overlaps/);
  for (const row of rows.slice(2)) assert.match(text(row), /Not fully within this plan/);
});

test('buyer order and the actual proposal ordinal determine displayed labels without exposing private identities', async () => {
  const f = await fixture({ twoBuyers: true }), ui = mount(f); planning(ui, f); buyer(ui, f, true); buyer(ui, f); await ui.click('Review automatic crop plan');
  const actual = review(ui); assert.deepEqual(actual.targetMetadata.map(row => row.targetId), [f.targetB.id, f.target.id]);
  const detail = ui.report(); assert.ok(detail);
  const first = detail.findByProps({ 'aria-label': 'Buyer 1 picking periods' }), second = detail.findByProps({ 'aria-label': 'Buyer 2 picking periods' });
  assert.equal(text(first.findByType('h4')), `Buyer 1 · ${CROPS[1].name}`); assert.equal(text(second.findByType('h4')), `Buyer 2 · ${CROPS[0].name}`);
  assert.match(text(first), /Proposed cycle 1 · Fixture bed 1/); assert.match(text(second), /Proposed cycle 2 · Fixture bed 2/);
  for (const hidden of [f.target.id, f.targetB.id, f.profile.profileId, f.profileB.profileId]) assert.equal(text(detail).includes(hidden), false);
});

// Saved buyer records reject weeklyKg <= 0 in sanitiseHarvestTargets. That
// boundary must remain held; zero-demand support in the canonical engine/report
// does not make zero a supported saved buyer-target entry.
test('a saved zero weekly buyer target remains held without a false picking-gap conclusion', async () => {
  const f = await fixture({ zero: true }), ui = mount(f); planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan');
  assert.equal(ui.reviews.at(-1)?.status, 'held'); assert.equal(ui.report(), undefined); assert.equal(probe.calls, 0);
  assert.doesNotMatch(ui.text(), /Known zero demand|No proposed picking window overlaps|Review period 1:/);
});

test('a synthetic canonical zero-review DTO has no bins or invented missing-picking gap, independently of saved-target entry', async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f); buyer(ui, f);
  ui.defer(async draft => {
    const positive = assembleGrowerWorkflowReview({ ...f, draft, recordedAt });
    assert.equal(positive.status, 'review');
    if (positive.status !== 'review') assert.fail('The actual positive saved-target fixture must assemble first');
    const detached = structuredClone(positive);
    assert.equal(detached.request.demands.length, 1); assert.equal(detached.targetMetadata.length, 1);
    // Exercise the consumer at its DTO boundary using the actual engine, not a
    // fabricated proposal/fingerprint or a claim that the saved target is zero.
    const request = { ...detached.request, demands: detached.request.demands.map(demand => {
      const total = demand.totalKg;
      if (total.state !== 'provided') assert.fail('The positive fixture must have canonical provided demand');
      return { ...demand, totalKg: { ...total, value: 0 } };
    }) };
    const proposal = generateGrowerAutoPlan(request);
    assert.equal(proposal.status, 'ready');
    return { ...detached, request, proposal, targetMetadata: detached.targetMetadata.map(metadata => ({
      ...metadata, buyerTotalKg: 0, grossCapacityRequiredKg: 0,
    })) };
  });
  await ui.click('Review automatic crop plan');
  assert.equal(review(ui).proposal.status, 'ready'); const detail = ui.report(); assert.ok(detail);
  assert.match(text(detail), /Known zero demand/); assert.equal(detail.findAllByType('ol').length, 0);
  assert.doesNotMatch(text(detail), /No proposed picking window overlaps|Review period 1:/);
});

test('a household-only valid proposal does not gain a buyer picking report', async () => {
  const f = await fixture({ noBuyers: true }), ui = mount(f); planning(ui, f); await household(ui, f); await ui.click('Review automatic crop plan');
  assert.equal(review(ui).proposal.status, 'ready'); assert.equal(review(ui).targetMetadata.length, 0);
  assert.equal(probe.calls, 1); assert.equal(ui.report(), undefined);
});

test('a held consistency report cannot render periods or turn an unchecked review into a date gap', async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f); buyer(ui, f);
  ui.defer(async draft => {
    const actual = assembleGrowerWorkflowReview({ ...f, draft, recordedAt }); assert.equal(actual.status, 'review');
    if (actual.status !== 'review') assert.fail('Real positive fixture must assemble');
    return { ...actual, recordedAt: '2026-11-06T12:00:00.000Z' };
  });
  await ui.click('Review automatic crop plan'); const detail = ui.report(); assert.ok(detail);
  assert.match(text(detail), /Picking dates could not be checked/); assert.match(text(detail), /No gap or date-coverage conclusion/);
  assert.equal(detail.findAllByType('ol').length, 0); assert.doesNotMatch(text(detail), /No proposed picking window overlaps|Some proposed picking dates are present/);
});

test('held and missing-input workflow reviews never get a missing-picking conclusion or invoke the projector', async () => {
  const f = await fixture({ missingYield: true }), ui = mount(f); await ui.click('Review automatic crop plan');
  assert.equal(ui.reviews.at(-1)?.status, 'held'); assert.equal(ui.report(), undefined); assert.equal(probe.calls, 0);
  planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan');
  assert.equal(review(ui).proposal.status, 'missing-inputs'); assert.equal(ui.report(), undefined); assert.equal(probe.calls, 0);
});

test('one canonical report is reused across ordinary rerenders and refreshed only for a new review', async () => {
  const f = await fixture(), ui = mount(f); assert.equal(probe.calls, 0); planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan');
  const first = review(ui), bytes = JSON.stringify(first); assert.equal(probe.calls, 1);
  ui.update({ sourceName: 'Updated visible source name' }); ui.update({ nurseryReview: () => React.createElement('p', null, 'Unrelated nursery display') });
  assert.equal(probe.calls, 1); assert.equal(JSON.stringify(first), bytes);
  await ui.click('Review automatic crop plan'); assert.equal(probe.calls, 2); assert.notEqual(review(ui), first);
});

for (const kind of ['source', 'account', 'scope'] as const) test(`${kind} invalidation withdraws buyer picking detail through the existing context guard`, async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan'); assert.ok(ui.report());
  ui.update(kind === 'source' ? { source: { ...f.source } } : kind === 'account' ? { contextRevision: 2 } : { scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } });
  assert.equal(ui.report(), undefined); assert.doesNotMatch(ui.text(), /Buyer picking dates by review period/); assert.equal(probe.calls, 1);
});

test('an ordinary draft edit withdraws the date report and a late review cannot recreate it', async () => {
  const f = await fixture(), ui = mount(f); planning(ui, f); buyer(ui, f); await ui.click('Review automatic crop plan'); assert.ok(ui.report());
  ui.change('Search work limit', '900'); assert.equal(ui.report(), undefined);
  let resolve!: (value: GrowerWorkflowReview) => void;
  ui.defer(async () => new Promise<GrowerWorkflowReview>(done => { resolve = done; })); const pending = ui.beginReview();
  const draft = ui.attempts.at(-1); assert.ok(draft); ui.change('Search work limit', '800');
  await act(async () => { resolve(assembleGrowerWorkflowReview({ ...f, draft, recordedAt })); await pending; });
  assert.equal(ui.report(), undefined); assert.equal(probe.calls, 1);
});
