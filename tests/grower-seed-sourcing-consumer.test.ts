import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, account, samples, deferred } from './international-grower-operations-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest } from '../lib/international/grower-nursery.ts';
import type { GrowerSavedNurseryReview } from '../components/crops/useGrowerWorkflow';
import type { SavedNurseryReviewPanelProps } from '../components/crops/GrowerNurseryReviewPanel';
import type { GrowerSeedSourcingPanelProps } from '../components/crops/GrowerSeedSourcingPanel';
import type { SeedSourcingGroupPatch } from '../components/crops/GrowerSeedSourcingForm';

// Real saved-cycle generation, nursery forecast, exact input parser, projector,
// composed controls and CSV builder execute. The existing fixture owns the fake
// Firebase boundary. Caller freshness checks are controlled here, not claimed as
// live remote/account integration; shared actor/sample epochs remain real.
const boundary = { deliveries: [] as { blob: Blob; filename: string }[], csvCalls: 0,
  beforeCsv: null as (() => void) | null, afterCsv: null as (() => void) | null };
const previousBoundary = Object.getOwnPropertyDescriptor(globalThis, '__seedSourcingConsumerBoundary');
Object.assign(globalThis, { __seedSourcingConsumerBoundary: boundary });
const root = new URL('../', import.meta.url).href, exporter = new URL('../lib/nursery-export.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx')) {
      if (specifier === '@/lib/file-delivery') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        'export function downloadFile(blob,filename){globalThis.__seedSourcingConsumerBoundary.deliveries.push({blob,filename});return "downloaded";}') };
      if (specifier === '@/lib/nursery-export') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        `export * from ${JSON.stringify(exporter)}; import {buildGrowerSeedSourcingCsv as actual} from ${JSON.stringify(exporter)};
        export function buildGrowerSeedSourcingCsv(...args){const b=globalThis.__seedSourcingConsumerBoundary;b.csvCalls++;b.beforeCsv?.();
          const csv=actual(...args);b.afterCsv?.();return csv;}`) };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: NurseryPanel } = await import('../components/crops/GrowerNurseryReviewPanel.tsx');
const { default: SeedPanel } = await import('../components/crops/GrowerSeedSourcingPanel.tsx');

// Reuse the established preparation arithmetic controls. These numbers are
// synthetic test inputs, never seed recommendations or observed inventory.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
const crop = CROPS.find(row => !row.transplant)!;
async function fixture() {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, index) => ({ ...template, id: `private-sourcing-bed-${index}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-sourcing-source-receipt' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-sourcing-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-sourcing-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') throw Error('Fixture proposal unavailable');
  assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, index) => createGrowerCyclePlanting(cycle, {
    plantingId: `private-sourcing-planting-${index}`, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint,
  })!);
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-tray', siteId: source.resourceSiteId, name: 'Fixture container', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-bench', siteId: source.resourceSiteId, name: 'Fixture surface', usableM2: 10 }],
    profiles: [{ id: 'private-recipe', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray', spaceId: 'private-bench',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  const review: GrowerNurseryRequest = { source: { kind: 'saved-cycles', rows,
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint } }, resourceContext: source, settings,
    settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: own([{ resourceKind: 'container', resourceId: 'private-tray', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 20 },
      { resourceKind: 'space', resourceId: 'private-bench', scope, window: { start: '2028-02-01', endExclusive: '2028-03-15' }, quantity: 10 }], 'nursery-resource-windows'),
    otherReservations: own([], 'nursery-resource-reservations') };
  const result = buildGrowerNurseryForecast(review); assert.equal(result.status, 'ready', result.issues.join(','));
  assert.equal(result.sourceStatus, 'saved-planned'); assert.equal(result.batches.length, 2);
  return { source, review, result, settings, proposal, request };
}

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
async function mount(options: { sample?: boolean; unknownSeeds?: boolean } = {}) {
  const f = await fixture();
  if (f.review.source.kind !== 'saved-cycles' || !f.review.source.cycleContext) throw Error('Saved fixture unavailable');
  const view: GrowerSavedNurseryReview = { kind: 'saved-nursery-review', source: f.source, rows: f.review.source.rows,
    cycleContext: f.review.source.cycleContext, horizon: f.review.horizon, references: [] };
  const settings = structuredClone(f.settings);
  if (options.unknownSeeds) {
    settings.profiles[0].model = 'measured-tray'; settings.profiles[0].usableStartsPerTray = 60;
    delete settings.profiles[0].seedsPerTray;
  }
  const gate = { calls: 0, check: async (_view: GrowerSavedNurseryReview): Promise<boolean> => true };
  let props: SavedNurseryReviewPanelProps = { source: f.source, savedReview: view, settings, contextRevision: 1, sample: options.sample,
    onCheckSavedCurrent: async checked => { gate.calls++; return gate.check(checked); } };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(NurseryPanel, props)); }); mounted.add(renderer);
  const button = (name: string) => {
    const result = renderer.root.findAllByType('button').find(node => text(node) === name); assert.ok(result, name); return result;
  };
  const seed = () => renderer.root.findByType(SeedPanel).props as GrowerSeedSourcingPanelProps;
  const ui = { renderer, gate, source: f.source, view, text: () => text(renderer.root), button, seed,
    update(next: Partial<SavedNurseryReviewPanelProps>) { props = { ...props, ...next }; act(() => renderer.update(React.createElement(NurseryPanel, props))); },
    async press(name: string) { await act(async () => { button(name).props.onClick(); }); },
    check(fragment: string) {
      const label = renderer.root.findAllByType('label').find(node => text(node).includes(fragment)); assert.ok(label, fragment);
      act(() => label.findByType('input').props.onChange({ target: { checked: true } }));
    },
    async nursery() {
      this.check('I have reviewed the saved nursery equipment'); this.check('I confirm these dated resource allocations');
      this.check('I have listed all other nursery uses'); await this.press('Review own nursery requirements');
      assert.ok(renderer.root.findAllByType(SeedPanel).length, 'The actual saved nursery forecast must expose the seed workflow');
    },
    add(patch?: SeedSourcingGroupPatch) {
      act(() => seed().onAddGroup()); const id = seed().groups.at(-1)!.id;
      if (patch) act(() => seed().onChangeGroup(id, patch)); return id;
    },
    change(id: string, patch: SeedSourcingGroupPatch) { act(() => seed().onChangeGroup(id, patch)); },
    async reviewSeed() { await act(async () => seed().onReview()); },
    async download() { await this.press('Download seed sourcing worksheet CSV'); },
  };
  return ui;
}
function rows(csv: string): Record<string, string>[] {
  const table: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const raw = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\r' && raw[i + 1] === '\n' && !quoted) { row.push(cell); table.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  assert.equal(quoted, false); const header = table.shift()!;
  return table.map(values => { assert.equal(values.length, header.length); return Object.fromEntries(header.map((key, i) => [key, values[i]])); });
}
function observedActor(uid: string) {
  // The shared epoch listens to Firebase's observer. Mutating a test variable
  // A→B→A without delivering either event invents an unobservable history; it
  // does not exercise the actual actor notification boundary used by the app.
  assert.ok(probe.auth.size > 0, 'The real shared preference authority must have an active Auth observer');
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const listener of [...probe.auth]) listener({ uid });
}
beforeEach(async () => {
  await reset(); boundary.deliveries.length = 0; boundary.csvCalls = 0; boundary.beforeCsv = null; boundary.afterCsv = null;
});
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
});
after(() => {
  hooks.deregister(); cleanup();
  if (previousBoundary) Object.defineProperty(globalThis, '__seedSourcingConsumerBoundary', previousBoundary);
  else Reflect.deleteProperty(globalThis, '__seedSourcingConsumerBoundary');
});

test('actual saved accepted nursery batches start unselected with blank counts and explicit confirmation, then export the same canonical planning arithmetic without saving', async () => {
  const ui = await mount(), before = JSON.stringify([...local.rows]), beforeSession = JSON.stringify([...session.rows]);
  await ui.nursery(); assert.equal(ui.seed().groups.length, 0); assert.equal(ui.seed().batches.length, 2); assert.equal(ui.seed().review, null);
  const id = ui.add(); const initial = ui.seed().groups[0];
  assert.deepEqual(initial.batchIds, []); assert.equal(initial.allocatedToPlanSeedsText, ''); assert.equal(initial.seedsPerPackText, '');
  assert.equal(initial.interchangeabilityConfirmed, false); assert.equal(initial.label, '');
  ui.change(id, { label: '  My supply only  ', batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: ' 0020 ', seedsPerPackText: '100' });
  await ui.reviewSeed(); const review = ui.seed().review; assert.ok(review);
  assert.equal(review.groups[0].requiredSeeds, 320); assert.deepEqual(review.groups[0].counts,
    { status: 'complete', neededSeeds: 300, packsNeeded: 3, plannedPackSeeds: 300 });
  assert.equal(ui.seed().groups[0].allocatedToPlanSeedsText, ' 0020 '); assert.equal(ui.seed().groups[0].label, '  My supply only  ');
  const checks = ui.gate.calls; await ui.download(); assert.equal(ui.gate.calls, checks + 2);
  assert.equal(boundary.csvCalls, 1); assert.equal(boundary.deliveries.length, 1);
  const file = boundary.deliveries[0], csv = await file.blob.text(), entries = rows(csv), entry = entries.find(row => row.record_type === 'supply_group')!;
  assert.equal(file.filename, 'ImbewuField-planned-seed-sourcing.csv');
  assert.deepEqual([entry.known_required_seed_subtotal, entry.required_seeds, entry.additional_seeds_needed, entry.planned_packs, entry.planned_pack_seeds], ['320', '320', '300', '3', '300']);
  assert.equal(entry.source_verification, 'not-verified'); assert.equal(entry.whole_farm_coverage, 'not-assessed');
  // Explicit presentation labels now accompany the download disclosure;
  // internal handles and automatically joined saved references remain excluded.
  assert.equal(entry.entered_supply_group_label, '  My supply only  ');
  assert.equal(entry.label_status, 'provided');
  assert.deepEqual(JSON.parse(entry.public_crop_names), [crop.name]);
  assert.doesNotMatch(csv, /private-|seed-supply-|fingerprint|owner-a/);
  assert.equal(JSON.stringify([...local.rows]), before); assert.equal(JSON.stringify([...session.rows]), beforeSession);
  assert.match(ui.text(), /temporary and are not saved/); assert.match(ui.text(), /no stock was recorded or order placed/i);
});

test('raw blank and zero counts remain distinct while fractions, separators and unsafe integers hold instead of rounding or becoming unknown', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true });
  await ui.reviewSeed(); assert.equal(ui.seed().review!.groups[0].status, 'unknown'); assert.equal(ui.seed().review!.groups[0].counts?.neededSeeds, null);
  ui.change(id, { allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await ui.reviewSeed();
  assert.equal(ui.seed().review!.groups[0].requiredSeeds, 320); assert.equal(ui.seed().review!.groups[0].counts?.neededSeeds, 320);
  for (const raw of ['9007199254740993', '1.25', '1,234', '1e3', '-1']) {
    ui.change(id, { allocatedToPlanSeedsText: raw }); assert.equal(ui.seed().review, null);
    assert.equal(ui.seed().groups[0].allocatedToPlanSeedsText, raw); await ui.reviewSeed();
    assert.equal(ui.seed().review!.groups[0].status, 'held'); assert.equal(ui.seed().review!.groups[0].counts, null);
  }
  ui.change(id, { allocatedToPlanSeedsText: '0', seedsPerPackText: '0' }); await ui.reviewSeed();
  assert.equal(ui.seed().review!.groups[0].status, 'held'); assert.equal(boundary.deliveries.length, 0);
});

test('unknown canonical seed requirements, overlapping groups and unconfirmed membership remain visible instead of acquiring a purchase amount', async () => {
  const ui = await mount({ unknownSeeds: true }); await ui.nursery();
  const id = ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true, allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  await ui.reviewSeed(); assert.equal(ui.seed().review!.groups[0].status, 'unknown'); assert.equal(ui.seed().review!.groups[0].requiredSeeds, null);
  ui.change(id, { interchangeabilityConfirmed: false }); await ui.reviewSeed();
  assert.equal(ui.seed().review!.groups[0].status, 'held'); assert.equal(ui.seed().review!.groups[0].counts, null);
  ui.change(id, { interchangeabilityConfirmed: true }); ui.add({ batchIds: [ui.seed().batches[0].id], interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  await ui.reviewSeed(); assert.deepEqual(ui.seed().review!.groups.map(group => group.status), ['held', 'held']);
  assert.ok(ui.seed().review!.groups.every(group => group.counts === null));
});

test('old edit, review and download callbacks cannot revive counts after any raw edit or a source rerender', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await ui.reviewSeed();
  const old = ui.seed(), download = ui.button('Download seed sourcing worksheet CSV').props.onClick, calls = ui.gate.calls;
  ui.change(id, { label: 'Unsaved new label' }); assert.equal(ui.seed().review, null);
  await act(async () => { old.onChangeGroup(id, { allocatedToPlanSeedsText: '999' }); old.onReview(); download(); });
  assert.equal(ui.seed().groups[0].allocatedToPlanSeedsText, '0'); assert.equal(ui.gate.calls, calls); assert.equal(boundary.deliveries.length, 0);
  const current = ui.seed(); ui.update({ contextRevision: 2 });
  await act(async () => { current.onAddGroup(); current.onReview(); download(); });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0); assert.equal(boundary.deliveries.length, 0);
});

test('deferred source checks cannot publish a review after an edit or deliver a worksheet after source withdrawal', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  const pending = deferred<boolean>(); ui.gate.check = async () => pending.promise;
  act(() => ui.seed().onReview()); assert.equal(ui.seed().review, null);
  // Invoke the already-rendered nursery input handler during the source await;
  // UI disablement is not the authority for withdrawing an async operation.
  ui.check('I confirm these dated resource allocations');
  await act(async () => { pending.resolve(true); await pending.promise; });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0); assert.equal(boundary.deliveries.length, 0);
  ui.gate.check = async () => true; await ui.nursery();
  assert.equal(ui.seed().groups.length, 0, 'A changed request must not acquire the old membership assertion');
  ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true, allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  await ui.reviewSeed(); const exporting = deferred<boolean>(); ui.gate.check = async () => exporting.promise;
  act(() => ui.button('Download seed sourcing worksheet CSV').props.onClick()); ui.update({ contextRevision: 3 });
  await act(async () => { exporting.resolve(true); await exporting.promise; });
  assert.equal(boundary.deliveries.length, 0);
});

test('the real shared actor epoch withdraws retained callbacks even after account A to B to A and even if the caller check returns true', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await ui.reviewSeed();
  const old = ui.seed(), download = ui.button('Download seed sourcing worksheet CSV').props.onClick;
  act(() => { observedActor('owner-b'); observedActor('owner-a'); });
  await act(async () => { old.onAddGroup(); old.onReview(); download(); });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0); assert.equal(boundary.deliveries.length, 0);
  assert.equal(boundary.csvCalls, 0);
});

test('sample transitions during a pending check revoke old personal drafts and an explicit DEMO review exports a labelled file', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  const pending = deferred<boolean>(); ui.gate.check = async () => pending.promise; const old = ui.seed();
  act(() => old.onReview()); act(() => { samples.enterSampleMode(); });
  await act(async () => { pending.resolve(true); await pending.promise; old.onReview(); });
  assert.equal(boundary.deliveries.length, 0); assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
  const demo = await mount({ sample: true }); await demo.nursery(); demo.add({ batchIds: demo.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await demo.reviewSeed(); await demo.download();
  assert.equal(boundary.deliveries.length, 1); assert.match(boundary.deliveries[0].filename, /-demo-/);
  assert.match(await boundary.deliveries[0].blob.text(), /DEMO/);
});

test('source failure before review or after synchronous canonical CSV creation clears counts and prevents delivery', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' });
  ui.gate.check = async () => false; await ui.reviewSeed(); assert.equal(ui.seed().review, null); assert.equal(boundary.csvCalls, 0);
  ui.gate.check = async () => true; await ui.reviewSeed(); assert.ok(ui.seed().review);
  boundary.afterCsv = () => { ui.gate.check = async () => false; };
  await ui.download(); assert.equal(boundary.csvCalls, 1); assert.equal(boundary.deliveries.length, 0); assert.equal(ui.seed().review, null);
});

test('a synchronous CSV callback cannot escape a revoked shared actor context before its post-build source check', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await ui.reviewSeed();
  boundary.beforeCsv = () => observedActor('owner-b');
  await ui.download(); assert.equal(boundary.csvCalls, 1); assert.equal(boundary.deliveries.length, 0);
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
});

test('a raw actor mismatch blocks delivery and withdraws seed counts before the later Auth observer updates the account UI', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '0', seedsPerPackText: '100' }); await ui.reviewSeed();
  // Firebase's raw user and mounted owner no longer match the captured proof,
  // but intentionally defer observer delivery to test the smaller guard window.
  boundary.beforeCsv = () => { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); };
  await ui.download(); assert.equal(boundary.csvCalls, 1); assert.equal(boundary.deliveries.length, 0);
  assert.equal(ui.seed().review, null); assert.deepEqual(ui.seed().groups, []);
  act(() => observedActor('owner-b'));
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
});

test('a presentation-only unit switch retires counts but retains exact raw groups only after the unchanged canonical request is reviewed again', async () => {
  const ui = await mount(); await ui.nursery(); ui.add({ label: '  authored supply  ', batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: ' 0000 ', seedsPerPackText: '0100' }); await ui.reviewSeed(); const before = structuredClone(ui.seed().groups);
  const unit = ui.renderer.root.findAllByType('select').find(node => node.props['aria-label'] === 'Nursery units'); assert.ok(unit);
  act(() => unit.props.onChange({ target: { value: 'imperial' } })); assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
  await ui.press('Review own nursery requirements'); assert.deepEqual(ui.seed().groups, before); assert.equal(ui.seed().review, null);
  await ui.reviewSeed(); assert.equal(ui.seed().review!.groups[0].requiredSeeds, 320);
});

test('an actual proposed nursery forecast cannot expose seed purchasing inputs before the cycles are saved and accepted', async () => {
  const f = await fixture();
  const review = { status: 'review' as const, recordedAt: stamp, request: f.request, proposal: f.proposal,
    issues: [], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(NurseryPanel, { source: f.source, review, settings: f.settings,
    contextRevision: 1, onCheckCurrent: async () => true })); }); mounted.add(renderer);
  for (const fragment of ['I have reviewed the saved nursery equipment', 'I confirm these dated resource allocations', 'I have listed all other nursery uses']) {
    const label = renderer.root.findAllByType('label').find(node => text(node).includes(fragment)); assert.ok(label);
    act(() => label.findByType('input').props.onChange({ target: { checked: true } }));
  }
  const button = renderer.root.findAllByType('button').find(node => text(node) === 'Review own nursery requirements'); assert.ok(button);
  await act(async () => button.props.onClick());
  assert.ok(renderer.root.findAll(node => node.props['aria-label'] === 'Reviewed own nursery requirements').length,
    'The proposed nursery calculation really ran, rather than failing setup');
  assert.equal(renderer.root.findAllByType(SeedPanel).length, 0);
  assert.equal(renderer.root.findAllByType('button').filter(node => text(node) === 'Download seed sourcing worksheet CSV').length, 0);
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
});
