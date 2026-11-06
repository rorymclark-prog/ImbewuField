import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, account, deferred } from './international-grower-operations-fixture.ts';
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
const previousBoundary = Object.getOwnPropertyDescriptor(globalThis, '__seedIdentificationConsumerBoundary');
Object.assign(globalThis, { __seedIdentificationConsumerBoundary: boundary });
const root = new URL('../', import.meta.url).href, exporter = new URL('../lib/nursery-export.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx')) {
      if (specifier === '@/lib/file-delivery') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        'export function downloadFile(blob,filename){globalThis.__seedIdentificationConsumerBoundary.deliveries.push({blob,filename});return "downloaded";}') };
      if (specifier === '@/lib/nursery-export') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        `export * from ${JSON.stringify(exporter)}; import {buildGrowerSeedSourcingCsv as actual} from ${JSON.stringify(exporter)};
        export function buildGrowerSeedSourcingCsv(...args){const b=globalThis.__seedIdentificationConsumerBoundary;b.csvCalls++;b.beforeCsv?.();
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
const { default: Summary } = await import('../components/crops/GrowerSeedSourcingSummary.tsx');

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
  if (previousBoundary) Object.defineProperty(globalThis, '__seedIdentificationConsumerBoundary', previousBoundary);
  else Reflect.deleteProperty(globalThis, '__seedIdentificationConsumerBoundary');
});

const disclosure = 'The CSV includes your entered supply-group labels. Leave out information you do not want in the file.';
function seedPatch(ui: Awaited<ReturnType<typeof mount>>, label: string): SeedSourcingGroupPatch {
  return { label, batchIds: ui.seed().batches.map(batch => batch.id), interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '20', seedsPerPackText: '100' };
}
function summary(ui: Awaited<ReturnType<typeof mount>>) {
  return ui.renderer.root.findByType(Summary);
}
function assertNoMarkup(node: ReactTestInstance) {
  for (const tag of ['script', 'img', 'iframe'] as const) assert.equal(node.findAllByType(tag).length, 0);
  assert.equal(node.findAll(child => Object.hasOwn(child.props, 'dangerouslySetInnerHTML')).length, 0);
}
function labelInput(ui: Awaited<ReturnType<typeof mount>>) {
  const label = ui.renderer.root.findAllByType('label').find(node => text(node).includes('Your supply group label (optional)'));
  assert.ok(label); return label.findByType('input');
}

test('an explicit label travels unchanged through the actual form, parent, canonical review, summary and user-clicked worksheet', async () => {
  const ui = await mount(), before = JSON.stringify([...local.rows]), beforeSession = JSON.stringify([...session.rows]);
  await ui.nursery();
  const label = '  My supplies — 家庭 / e\u0301 <img src=x onerror="fetch(1)">  ';
  ui.add(seedPatch(ui, ''));
  act(() => labelInput(ui).props.onChange({ target: { value: label } }));
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
  await ui.reviewSeed();
  const review = ui.seed().review; assert.ok(review);
  assert.equal(review.groups[0].identification.enteredLabel, label);
  assert.equal(review.groups[0].identification.labelStatus, 'provided');
  assert.deepEqual(review.groups[0].identification.cropNames, [crop.name]);
  assert.equal(review.groups[0].identification.cropIdentityCount, 1);
  assert.equal(review.groups[0].requiredSeeds, 320);
  assert.deepEqual(review.groups[0].counts, { status: 'complete', neededSeeds: 300, packsNeeded: 3, plannedPackSeeds: 300 });
  assert.ok(text(summary(ui)).includes(label)); assert.ok(text(summary(ui)).includes(crop.name));
  assert.ok(text(summary(ui)).includes(review.groups[0].identification.description));
  assertNoMarkup(summary(ui)); assert.ok(ui.text().includes(disclosure));
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
  await ui.download();
  assert.equal(boundary.csvCalls, 1); assert.equal(boundary.deliveries.length, 1);
  const csv = await boundary.deliveries[0].blob.text(), row = rows(csv).find(row => row.record_type === 'supply_group');
  assert.ok(row); assert.equal(row.entered_supply_group_label, label); assert.equal(row.label_status, 'provided');
  assert.deepEqual(JSON.parse(row.public_crop_names), [crop.name]);
  assert.equal(row.identification_description, review.groups[0].identification.description);
  assert.doesNotMatch(csv, /private-|seed-supply-|fingerprint|owner-a/);
  assert.equal(JSON.stringify([...local.rows]), before); assert.equal(JSON.stringify([...session.rows]), beforeSession);
});

test('blank label review shows Not recorded while a held group retains its authored identification and unknown purchase counts', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add(seedPatch(ui, ' \t '));
  await ui.reviewSeed();
  assert.equal(ui.seed().review!.groups[0].identification.enteredLabel, ' \t ');
  assert.equal(ui.seed().review!.groups[0].identification.labelStatus, 'not-recorded');
  assert.match(text(summary(ui)), /Not recorded/);
  const label = '  Separate planning supplies  ';
  ui.change(id, { label, interchangeabilityConfirmed: false }); await ui.reviewSeed();
  const held = ui.seed().review!.groups[0];
  assert.equal(held.status, 'held'); assert.equal(held.counts, null);
  assert.equal(held.identification.enteredLabel, label); assert.deepEqual(held.identification.cropNames, [crop.name]);
  assert.ok(text(summary(ui)).includes(label)); assert.match(text(summary(ui)), /Unknown/);
  assert.ok(ui.text().includes(disclosure));
  await ui.download(); assert.equal(boundary.deliveries.length, 1);
  const row = rows(await boundary.deliveries[0].blob.text()).find(row => row.record_type === 'supply_group');
  assert.ok(row); assert.equal(row.entered_supply_group_label, label); assert.equal(row.group_status, 'held');
  assert.equal(row.required_seeds, 'unknown'); assert.equal(row.additional_seeds_needed, 'unknown');
});

test('a label-only edit withdraws the summary and retires retained review and download callbacks before a newly reviewed explicit download', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add(seedPatch(ui, 'Earlier label')); await ui.reviewSeed();
  const old = ui.seed(), oldDownload = ui.button('Download seed sourcing worksheet CSV').props.onClick;
  const label = '  Revised label / বাংলা  ', calls = ui.gate.calls;
  ui.change(id, { label }); assert.equal(ui.seed().review, null);
  assert.doesNotMatch(text(summary(ui)), /Earlier label/);
  await act(async () => { old.onReview(); oldDownload(); });
  assert.equal(ui.gate.calls, calls); assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
  assert.equal(ui.seed().groups[0].label, label);
  await ui.reviewSeed(); assert.equal(ui.seed().review!.groups[0].identification.enteredLabel, label);
  await ui.download(); assert.equal(boundary.deliveries.length, 1);
  const row = rows(await boundary.deliveries[0].blob.text()).find(row => row.record_type === 'supply_group');
  assert.ok(row); assert.equal(row.entered_supply_group_label, label);
});

test('pending review rejects retained label edits and cannot publish labelled output after source withdrawal', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add(seedPatch(ui, 'Pending old label'));
  const rendered = ui.seed(), pending = deferred<boolean>(); ui.gate.check = async () => pending.promise;
  act(() => rendered.onReview());
  act(() => rendered.onChangeGroup(id, { label: '  Current label  ' }));
  assert.equal(ui.seed().groups[0].label, 'Pending old label', 'A pending operation must retain the existing editor guard');
  ui.update({ contextRevision: 2 });
  await act(async () => { pending.resolve(true); await pending.promise; });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
  assert.doesNotMatch(ui.text(), /Pending old label|Current label/);
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
});

test('pending download rejects retained label edits and loses authority after source withdrawal even when its check later succeeds', async () => {
  const ui = await mount(); await ui.nursery(); const id = ui.add(seedPatch(ui, 'Old download label')); await ui.reviewSeed();
  const rendered = ui.seed(), pending = deferred<boolean>(); ui.gate.check = async () => pending.promise;
  act(() => ui.button('Download seed sourcing worksheet CSV').props.onClick());
  act(() => rendered.onChangeGroup(id, { label: 'Edited during download' }));
  assert.equal(ui.seed().groups[0].label, 'Old download label', 'A retained handler cannot bypass pending-operation disablement');
  ui.update({ contextRevision: 2 });
  await act(async () => { pending.resolve(true); await pending.promise; });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
  assert.doesNotMatch(ui.text(), /Old download label|Edited during download/);
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
});

test('the observed Auth A to B to A history revokes pending labelled output rather than exposing it under a restored actor name', async () => {
  const ui = await mount(); await ui.nursery(); ui.add(seedPatch(ui, 'Personal pending label')); await ui.reviewSeed();
  const rendered = ui.seed(), oldDownload = ui.button('Download seed sourcing worksheet CSV').props.onClick;
  const pending = deferred<boolean>(); ui.gate.check = async () => pending.promise;
  act(() => oldDownload());
  act(() => { observedActor('owner-b'); observedActor('owner-a'); });
  await act(async () => { pending.resolve(true); await pending.promise; rendered.onReview(); oldDownload(); });
  assert.equal(ui.renderer.root.findAllByType(SeedPanel).length, 0);
  assert.doesNotMatch(ui.text(), /Personal pending label/);
  assert.equal(boundary.csvCalls, 0); assert.equal(boundary.deliveries.length, 0);
});
