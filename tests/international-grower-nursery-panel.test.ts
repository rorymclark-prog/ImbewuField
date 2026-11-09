import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import { buildGrowerNurseryForecast, nurserySettingsFingerprint, type GrowerNurseryRequest } from '../lib/international/grower-nursery.ts';
import { buildGrowerNurseryCsv } from '../lib/nursery-export.ts';
import type { GrowerNurseryReviewPanelProps } from '../components/crops/GrowerNurseryReviewPanel.tsx';

const deliveries: { blob: Blob; filename: string }[] = [];
const deliverySignal: { onDownload?: () => void } = {};
Object.assign(globalThis, { __growerNurseryPanelDelivery: deliveries, __growerNurseryPanelDeliverySignal: deliverySignal, IS_REACT_ACT_ENVIRONMENT: true });
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/crops/GrowerNurseryReviewPanel.tsx') && specifier === '@/lib/file-delivery') {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export function downloadFile(blob, filename) {globalThis.__growerNurseryPanelDelivery.push({blob,filename});globalThis.__growerNurseryPanelDeliverySignal.onDownload?.();return "downloaded";}') };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: GrowerNurseryReviewPanel } = await import('../components/crops/GrowerNurseryReviewPanel.tsx');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__growerNurseryPanelDelivery'); Reflect.deleteProperty(globalThis, '__growerNurseryPanelDeliverySignal'); Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT'); });

// Synthetic engineering fixtures only; none of these figures is growing advice.
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt: stamp } });
async function fixture(withReservation = false, direct = false) {
  const canvas = buildDemoDesignCanvasState(); canvas.siteId = 'site:0.00000,0.00000'; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  canvas.items = [{ ...canvas.items.find(row => row.defId === 'veg_bed')!, id: 'private-bed-id', wM: 3, hM: 4 }]; canvas.lines = []; canvas.zones = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId,
    raw: canvas, sourceRevision: 'synthetic-source-revision' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Fixture source unavailable');
  const crop = CROPS.find(row => !row.transplant)!;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-estimate-id', cropKey: crop.key, scope: source.scope,
    inputs: { plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(direct ? 'direct' : 'transplant', 'method'), nurseryDays: direct ? { state: 'missing', reason: 'not-entered' } : own(10, 'days'),
      fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months') } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [profile], beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: withReservation ? [{ id: 'private-reservation-id', bedId: source.beds[0].id, scope: source.scope,
      window: own({ start: '2028-03-10', endExclusive: '2028-03-15' }, 'utc-date-window') }] : [],
    demands: [{ demandId: 'private-demand-id', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  const review: Extract<GrowerWorkflowReview, { status: 'review' }> = { status: 'review', recordedAt: stamp, request, proposal,
    issues: [], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] };
  const settings: NurserySettings = { version: 1, spaces: [{ id: 'private-bench-id', siteId: source.resourceSiteId, name: 'Fixture bench', usableM2: 2 }],
    containers: [{ id: 'private-tray-id', siteId: source.resourceSiteId, name: 'Fixture trays', cells: 40, widthCm: 50, lengthCm: 40, owned: 5 }],
    profiles: [{ id: 'private-recipe-id', siteId: source.resourceSiteId, cropKey: crop.key, model: 'seed-cell', containerId: 'private-tray-id', spaceId: 'private-bench-id',
      fieldSurvivalPercent: 80, germinationPercent: 50, nurserySurvivalPercent: 75 }] };
  return { source, review, settings };
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(props: GrowerNurseryReviewPanelProps) {
  let renderer: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(GrowerNurseryReviewPanel, props)); });
  const namedButton = (name: string) => {
    const found = renderer.root.findAllByType('button').find(node => text(node) === name);
    assert.ok(found, `Missing button ${name}`); return found;
  };
  const label = (prefix: string, container = renderer.root) => {
    const found = container.findAllByType('label').find(node => text(node).startsWith(prefix));
    assert.ok(found, `Missing field ${prefix}`); return found.findAll(node => node.type === 'input' || node.type === 'select')[0];
  };
  return {
    get renderer() { return renderer; }, props, text: () => text(renderer.root),
    click(name: string) { act(() => { namedButton(name).props.onClick(); }); },
    async press(name: string) { await act(async () => { await namedButton(name).props.onClick(); }); },
    check(prefix: string, checked = true) { act(() => label(prefix).props.onChange({ target: { checked } })); },
    resource(kind: 'Available resource' | 'Competing resource use', index: number, values: { resource: string; quantity: string; start: string; endExclusive: string }) {
      for (const [prefix, value] of [['Resource', values.resource], ['Quantity', values.quantity], ['From (UTC)', values.start], ['Until (exclusive, UTC)', values.endExclusive]]) {
        const fieldset = renderer.root.findAllByType('fieldset').find(node => node.children.some(child => typeof child !== 'string' && child.type === 'legend' && text(child) === `${kind} ${index + 1}`));
        assert.ok(fieldset); act(() => label(prefix, fieldset).props.onChange({ target: { value } }));
      }
    },
    update(patch: Partial<GrowerNurseryReviewPanelProps>) { Object.assign(props, patch); act(() => renderer.update(React.createElement(GrowerNurseryReviewPanel, { ...props }))); },
    dispose() { act(() => renderer.unmount()); },
  };
}
function allocations(screen: ReturnType<typeof mount>, zero = false) {
  screen.click('Add resource availability'); screen.resource('Available resource', 0, { resource: 'container:private-tray-id', quantity: zero ? '0' : '5', start: '2028-02-01', endExclusive: '2028-03-15' });
  screen.click('Add resource availability'); screen.resource('Available resource', 1, { resource: 'space:private-bench-id', quantity: zero ? '0' : '2', start: '2028-02-01', endExclusive: '2028-03-15' });
  screen.check('I have reviewed the saved nursery'); screen.check('I confirm these dated resource'); screen.check('I have listed all other nursery uses');
}

for (const invalid of ['above-saved-stock', 'empty-date-interval'] as const) test(`invalid nursery allocation ${invalid} cannot report an absent transplant batch`, async () => {
  const data = await fixture(), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen);
    screen.resource('Available resource', 0, { resource: 'container:private-tray-id', quantity: invalid === 'above-saved-stock' ? '6' : '5',
      start: '2028-02-01', endExclusive: invalid === 'empty-date-interval' ? '2028-02-01' : '2028-03-15' });
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /The preparation worksheet is unavailable/);
    assert.doesNotMatch(screen.text(), /This proposal has no transplant raising batch|These saved cycles have no represented transplant raising batch/);
    assert.match(screen.text(), /Unknown; spare capacity is not established/);
    screen.resource('Available resource', 0, { resource: 'container:private-tray-id', quantity: '5', start: '2028-02-01', endExclusive: '2028-03-15' });
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Proposed raising batch 1/);
    assert.match(screen.text(), /Within the supplied dated budget/);
  } finally { screen.dispose(); }
});

test('a checked direct-field proposal still reports genuinely absent nursery batches', async () => {
  const data = await fixture(false, true), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /This proposal has no transplant raising batch/);
    assert.match(screen.text(), /No transplant batch is represented in this review/);
    assert.doesNotMatch(screen.text(), /The preparation worksheet is unavailable|Proposed raising batch 1/);
  } finally { screen.dispose(); }
});

test('own proposal quantities stay visible but missing confirmations cannot certify resource headroom', async () => {
  const data = await fixture(), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Incomplete nursery estimates/); assert.match(screen.text(), /Unknown; spare capacity is not established/);
    assert.match(screen.text(), /Starts to raise60Seeds160Container fills4Outer container footprint \(m²\)0.8/);
    assert.match(screen.text(), /2028-02-09 to before 2028-02-19/);
    assert.doesNotMatch(screen.text(), /private-(bed|tray|bench|recipe|demand|estimate)-id|row spacing|sow .*deep|accepted sowing/i);
  } finally { screen.dispose(); }
});

test('explicit availability and complete other-use assertion produce a same-snapshot CSV without private identities', async () => {
  deliveries.length = 0; const data = await fixture(); let checks = 0;
  const screen = mount({ ...data, contextRevision: 1, sample: true, onCheckCurrent: async review => { assert.equal(review, data.review); checks++; return true; } });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Dated nursery estimates/); assert.match(screen.text(), /Within the supplied dated budget/);
    await screen.press('Download reviewed nursery CSV'); assert.equal(checks, 2); assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].filename, 'ImbewuField-demo-own-nursery.csv'); const csv = await deliveries[0].blob.text();
    assert.match(csv, /DEMO — example own-input nursery review/); assert.match(csv, /"2028-02-09","2028-02-19","48","60","160","4","0.8"/);
    assert.doesNotMatch(csv, /private-|geometryFingerprint|sourceRevision|acceptedAt/);
    assert.match(screen.text(), /CSV downloaded/);
  } finally { screen.dispose(); }
});

test('known zero allocations show a shortage and changing any resource control withdraws the prior review', async () => {
  const data = await fixture(), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen, true); await screen.press('Review own nursery requirements'); assert.match(screen.text(), /Known shortage/);
    assert.match(screen.text(), /Known shortage: 4/);
    screen.check('I confirm these dated resource', false);
    assert.doesNotMatch(screen.text(), /Dated nursery estimates|Incomplete nursery estimates/);
  } finally { screen.dispose(); }
});

test('known tray and surface budgets do not pretend missing seed purchases are known', async () => {
  const data = await fixture();
  data.settings.profiles[0] = { ...data.settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 20 };
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Incomplete nursery estimates/); assert.match(screen.text(), /Within the supplied dated budget/);
    assert.match(screen.text(), /SeedsUnknown/); assert.match(screen.text(), /covers containers and surface only/);
  } finally { screen.dispose(); }
});

test('late current-source checks cannot publish a review after a context switch', async () => {
  const data = await fixture(); let resolve!: (value: boolean) => void;
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: () => new Promise(answer => { resolve = answer; }) });
  try {
    screen.click('Review own nursery requirements'); screen.update({ contextRevision: 2 });
    await act(async () => { resolve(true); await Promise.resolve(); });
    assert.doesNotMatch(screen.text(), /Dated nursery estimates|Incomplete nursery estimates/);
  } finally { screen.dispose(); }
});

test('a failed initial source check never computes or displays a nursery review', async () => {
  const data = await fixture(), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => false });
  try {
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /could not be confirmed/);
    assert.doesNotMatch(screen.text(), /Dated nursery estimates|Incomplete nursery estimates|Starts to raise/);
  } finally { screen.dispose(); }
});

test('an actual sample-mode transition during a current-source check withdraws the pending result', async () => {
  const data = await fixture(); let resolve!: (value: boolean) => void, sample = false;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: { getItem: () => sample ? '1' : null } } });
  const screen = mount({ ...data, contextRevision: 1, sample: false, onCheckCurrent: () => new Promise(answer => { resolve = answer; }) });
  try {
    screen.click('Review own nursery requirements'); sample = true;
    await act(async () => { resolve(true); await Promise.resolve(); });
    assert.doesNotMatch(screen.text(), /Dated nursery estimates|Incomplete nursery estimates/);
    screen.update({ contextRevision: 2 }); assert.match(screen.text(), /DEMO — example planning data/);
  } finally {
    screen.dispose(); if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('failed current-source confirmation delivers nothing and a changed recipe invalidates visible quantities', async () => {
  deliveries.length = 0; const data = await fixture(); let allow = true;
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => allow });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    allow = false; await screen.press('Download reviewed nursery CSV'); assert.equal(deliveries.length, 0); assert.match(screen.text(), /No file was delivered/);
    allow = true; await screen.press('Review own nursery requirements');
    const changed = structuredClone(data.settings); delete changed.profiles[0].fieldSurvivalPercent; screen.update({ settings: changed });
    assert.doesNotMatch(screen.text(), /Dated nursery estimates/);
    const confirmation = screen.renderer.root.findAllByType('label').find(node => text(node).startsWith('I have reviewed the saved nursery'))!.findByType('input');
    assert.equal(confirmation.props.checked, false, 'a remote or source settings change must not inherit prior confirmation');
    await screen.press('Review own nursery requirements');
    assert.match(screen.text(), /Starts to raiseUnknownSeedsUnknown/); assert.match(screen.text(), /field survival estimate is missing/);
  } finally { screen.dispose(); }
});

test('a source or recipe change while an export check waits cannot hand off the old snapshot', async () => {
  deliveries.length = 0; const data = await fixture(); let pending = false, resolve!: (value: boolean) => void;
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => pending ? new Promise(answer => { resolve = answer; }) : true });
  try {
    allocations(screen); await screen.press('Review own nursery requirements'); pending = true; screen.click('Download reviewed nursery CSV');
    const changed = structuredClone(data.settings); changed.containers = []; screen.update({ settings: changed });
    await act(async () => { resolve(true); await Promise.resolve(); }); assert.equal(deliveries.length, 0);
    assert.doesNotMatch(screen.text(), /Dated nursery estimates/);
  } finally { screen.dispose(); }
});

test('existing field work requires its own acknowledgement and competing uses reduce the same nursery budget', async () => {
  const data = await fixture(true), screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen); await screen.press('Review own nursery requirements'); assert.match(screen.text(), /Account for nursery resources used/);
    assert.doesNotMatch(screen.text(), /private-reservation-id/);
    screen.check('I accounted for nursery resources');
    screen.click('Add competing nursery use'); screen.resource('Competing resource use', 0, { resource: 'container:private-tray-id', quantity: '2', start: '2028-02-01', endExclusive: '2028-03-15' });
    await screen.press('Review own nursery requirements'); assert.match(screen.text(), /Known shortage: 1/);
  } finally { screen.dispose(); }
});

test('own CSV preserves zero versus unknown and escapes user labels without exporting hidden source data', async () => {
  const data = await fixture(); const settings = structuredClone(data.settings);
  settings.profiles[0] = { ...settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 20, seedsPerTray: 0 };
  delete settings.containers[0].lengthCm; settings.containers[0].name = '=synthetic label';
  const request: GrowerNurseryRequest = { source: { kind: 'proposal', proposal: data.review.proposal, currentRequest: data.review.request },
    resourceContext: data.source, settings, settingsReview: own(nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'),
    availability: { state: 'missing', reason: 'not-entered' }, otherReservations: { state: 'missing', reason: 'not-entered' } };
  const result = buildGrowerNurseryForecast(request), csv = buildGrowerNurseryCsv(result, data.source.beds);
  assert.equal(result.batches[0].seeds, 0); assert.equal(result.batches[0].areaM2, null);
  assert.match(csv, /"48","60","0","3","unknown"/); assert.match(csv, /'=synthetic label/);
  assert.doesNotMatch(csv, /private-|geometryFingerprint|sourceRevision/);
});

test('transplant preparation uses the actual proposal batches and checks the source again before delivering its worksheet', async () => {
  deliveries.length = 0;
  const data = await fixture(); let checks = 0;
  const screen = mount({ ...data, contextRevision: 1, sample: true, onCheckCurrent: async () => { ++checks; return true; } });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    const summary = screen.renderer.root.findByProps({ 'aria-label': 'Planned transplant preparation' });
    assert.match(text(summary), /Final field positions48Starts to raise60Seeds to sow160/);
    assert.match(text(summary), /2028-02-09/);
    assert.match(text(summary), /before 2028-02-19/);
    assert.match(text(summary), /represented transplant batches only/i);
    assert.match(text(summary), /not observed sowing, stock or seedling readiness/i);
    await screen.press('Download transplant preparation CSV');
    assert.equal(checks, 2); assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].filename, 'ImbewuField-demo-transplant-preparation.csv');
    const csv = await deliveries[0].blob.text();
    assert.match(csv, /DEMO — planned grower-estimated transplant preparation/);
    assert.match(csv, /"field_positions","complete","48","48"/);
    assert.match(csv, /"starts_to_raise","complete","60","60"/);
    assert.match(csv, /"seeds_to_sow","complete","160","160"/);
    assert.doesNotMatch(csv, /private-|geometryFingerprint|sourceRevision|acceptedAt/);
  } finally { screen.dispose(); }
});

test('a missing seed estimate keeps the worksheet subtotal unknown without hiding known starts or claiming a full purchase list', async () => {
  const data = await fixture();
  data.settings.profiles[0] = { ...data.settings.profiles[0], model: 'measured-tray', usableStartsPerTray: 20 };
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => true });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    const summary = screen.renderer.root.findByProps({ 'aria-label': 'Planned transplant preparation' });
    assert.match(text(summary), /Starts to raise60/);
    assert.match(text(summary), /Seeds to sowUnknown total; known subtotal Unknown/);
    assert.match(text(summary), /This preparation worksheet is incomplete/);
    assert.doesNotMatch(text(summary), /Seeds to sow0/);
  } finally { screen.dispose(); }
});

test('a pending preparation download is withdrawn when the source changes and a failed fresh check delivers nothing', async () => {
  deliveries.length = 0;
  const data = await fixture(); let pending = false, allow = true, resolve!: (value: boolean) => void;
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => pending ? new Promise(answer => { resolve = answer; }) : allow });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    pending = true; screen.click('Download transplant preparation CSV');
    screen.update({ contextRevision: 2 });
    await act(async () => { resolve(true); await Promise.resolve(); });
    assert.equal(deliveries.length, 0);
    assert.equal(screen.renderer.root.findAllByProps({ 'aria-label': 'Planned transplant preparation' }).length, 0);
    pending = false;
    // The old rows remain visible for editing but their area draft belongs to
    // the previous source. Explicitly replace them before the fresh review.
    screen.click('Remove available resource 1'); screen.click('Remove available resource 1');
    allocations(screen); await screen.press('Review own nursery requirements');
    allow = false; await screen.press('Download transplant preparation CSV');
    assert.equal(deliveries.length, 0); assert.match(screen.text(), /No file was delivered/);
  } finally { screen.dispose(); }
});

test('a printable preparation file contains the same planned counts and checks current source again after building', { timeout: 5000 }, async () => {
  deliveries.length = 0; const data = await fixture(); let checks = 0;
  const screen = mount({ ...data, contextRevision: 1, sample: true, onCheckCurrent: async () => { ++checks; return true; } });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    // Resolve from the actual delivery call, not a timer guessing when the
    // dynamic PDF import might finish.
    const delivered = new Promise<void>(resolve => { deliverySignal.onDownload = resolve; });
    screen.click('Download preparation PDF');
    await act(async () => { await delivered; });
    assert.equal(checks, 3); assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].filename, 'ImbewuField-demo-transplant-preparation.pdf');
    assert.equal(deliveries[0].blob.type, 'application/pdf');
    const pdf = Buffer.from(await deliveries[0].blob.arrayBuffer()).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-')); assert.match(pdf, /DEMO - EXAMPLE PLANNING DATA/);
    for (const count of ['48', '60', '160']) assert.ok(pdf.includes(`(${count}) Tj`));
    assert.doesNotMatch(pdf, /private-|geometryFingerprint|sourceRevision/);
    assert.match(screen.text(), /PDF downloaded/);
  } finally { delete deliverySignal.onDownload; screen.dispose(); }
});

test('a source change while the post-PDF check waits withdraws the file and a refused second check delivers nothing', { timeout: 5000 }, async () => {
  deliveries.length = 0; const data = await fixture(); let checks = 0, release!: (value: boolean) => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => {
    ++checks;
    if (checks === 3) { entered(); return new Promise<boolean>(resolve => { release = resolve; }); }
    return true;
  } });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    screen.click('Download preparation PDF');
    await act(async () => { await waiting; });
    screen.update({ contextRevision: 2 });
    await act(async () => { release(true); await Promise.resolve(); });
    assert.equal(checks, 3); assert.equal(deliveries.length, 0);
  } finally { release?.(false); screen.dispose(); }

  checks = 0;
  let refuseEntered!: () => void;
  const refusal = new Promise<void>(resolve => { refuseEntered = resolve; });
  const refused = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => {
    if (++checks === 3) { refuseEntered(); return false; } return true;
  } });
  try {
    allocations(refused); await refused.press('Review own nursery requirements');
    refused.click('Download preparation PDF');
    await act(async () => { await refusal; });
    assert.equal(checks, 3); assert.equal(deliveries.length, 0);
    assert.match(refused.text(), /No file was delivered/);
  } finally { refused.dispose(); }
});


// Inspect PDF text operands rather than layout coordinates, so a missing count
// cannot accidentally pass because the same digits occur in a drawing position.
function batchCardPdfText(pdf: string): string {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(match => match[1]
    .replace(/\\([\\()])/g, '$1').replace(/\\[nr]/g, ' ')).join(' ');
}

test('planned batch cards use the actual PDF builder, preserve counts and distinguish ordinary and demo delivery', { timeout: 5000 }, async () => {
  for (const sample of [false, true]) {
    deliveries.length = 0; const data = await fixture(); let checks = 0;
    const screen = mount({ ...data, contextRevision: 1, sample, onCheckCurrent: async () => { ++checks; return true; } });
    try {
      allocations(screen); await screen.press('Review own nursery requirements');
      const action = screen.renderer.root.findAllByType('button').find(button => text(button) === 'Download planned batch cards');
      assert.ok(action); assert.match(action.props.className, /min-h-11/);
      assert.equal(screen.renderer.root.findByProps({ 'aria-label': 'Own-input nursery review' }).props.lang, 'en');
      const delivered = new Promise<void>(resolve => { deliverySignal.onDownload = resolve; });
      screen.click('Download planned batch cards');
      await act(async () => { await delivered; });
      assert.equal(checks, 3); assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].filename, `ImbewuField${sample ? '-demo' : ''}-planned-nursery-batch-cards.pdf`);
      assert.equal(deliveries[0].blob.type, 'application/pdf');
      const raw = Buffer.from(await deliveries[0].blob.arrayBuffer()).toString('latin1');
      assert.ok(raw.startsWith('%PDF-'));
      const extracted = batchCardPdfText(raw);
      for (const count of ['48', '60', '160']) assert.match(extracted, new RegExp(`\\b${count}\\b`));
      if (sample) assert.match(extracted, /DEMO/); else assert.doesNotMatch(extracted, /DEMO/);
      assert.doesNotMatch(extracted, /private-|geometryFingerprint|sourceRevision/);
      assert.match(screen.text(), /Planned nursery batch cards downloaded/);
      assert.match(screen.text(), /planned estimates, not observed sowing or stock/);
    } finally { delete deliverySignal.onDownload; screen.dispose(); }
  }
});

test('a refused initial batch-card export source check delivers nothing and keeps the same failure handling', { timeout: 5000 }, async () => {
  deliveries.length = 0; const data = await fixture(); let checks = 0, entered!: () => void;
  const refusal = new Promise<void>(resolve => { entered = resolve; });
  const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => {
    if (++checks === 2) { entered(); return false; } return true;
  } });
  try {
    allocations(screen); await screen.press('Review own nursery requirements');
    screen.click('Download planned batch cards'); await act(async () => { await refusal; });
    assert.equal(checks, 2); assert.equal(deliveries.length, 0); assert.match(screen.text(), /No file was delivered/);
  } finally { screen.dispose(); }
});

test('batch-card post-build checks reject changed source, actor, sample or same-key input evidence before delivery', { timeout: 5000 }, async () => {
  for (const change of ['source', 'actor', 'sample', 'inputs']) {
    deliveries.length = 0; const data = await fixture(); let checks = 0, actorCurrent = true, sample = false;
    let release!: (value: boolean) => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    if (change === 'sample') Object.defineProperty(globalThis, 'window', { configurable: true,
      value: { sessionStorage: { getItem: () => sample ? '1' : null } } });
    const screen = mount({ ...data, contextRevision: 1, onCheckCurrent: async () => {
      ++checks;
      if (checks === 3) {
        entered(); const allowed = await new Promise<boolean>(resolve => { release = resolve; });
        return allowed && actorCurrent;
      }
      return true;
    } });
    try {
      allocations(screen); await screen.press('Review own nursery requirements');
      screen.click('Download planned batch cards'); await act(async () => { await waiting; });
      const buttons = screen.renderer.root.findAllByType('button');
      assert.equal(buttons.find(button => text(button) === 'Download planned batch cards')?.props.disabled, true);
      assert.equal(buttons.find(button => text(button) === 'Download preparation PDF')?.props.disabled, true);
      if (change === 'source') screen.update({ contextRevision: 2 });
      if (change === 'actor') actorCurrent = false;
      if (change === 'sample') sample = true;
      // Deliberately no render/key update: the second full-result comparison must
      // notice changed saved inputs even when parent source approval still passes.
      if (change === 'inputs') data.settings.profiles[0].fieldSurvivalPercent = 90;
      await act(async () => { release(true); await Promise.resolve(); });
      assert.equal(checks, 3, change); assert.equal(deliveries.length, 0, change);
      // A settings/source/sample revision withdraws the old review and clears
      // its status through the existing key-change effect. The lasting rule is
      // no old export or inherited confirmation, not a stale-context message.
      const currentButtons = screen.renderer.root.findAllByType('button');
      assert.equal(currentButtons.filter(button => ['Download planned batch cards', 'Download preparation PDF', 'Download transplant preparation CSV'].includes(text(button))).length, 0, change);
      assert.doesNotMatch(screen.text(), /Dated nursery estimates|Incomplete nursery estimates|Planned nursery batch cards downloaded/, change);
      const reviewAction = currentButtons.find(button => text(button) === 'Review own nursery requirements');
      assert.ok(reviewAction, change); assert.equal(reviewAction.props.disabled, false, change);
      if (change !== 'actor') {
        const confirmations = screen.renderer.root.findAllByType('input').filter(input => input.props.type === 'checkbox');
        assert.equal(confirmations.length, 3, change);
        assert.ok(confirmations.every(input => input.props.checked === false), change);
      } else {
        // This fixture changes only the parent's actor approval, not the display
        // key. Its same-context source refusal still keeps the actionable hold.
        assert.match(screen.text(), /No file was delivered/);
      }
    } finally {
      release?.(false); screen.dispose();
      if (change === 'sample') {
        if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window');
      }
    }
  }
});
