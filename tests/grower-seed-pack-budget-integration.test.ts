import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, account, samples, deferred } from './international-grower-operations-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { knownVegetativePropagationUnit } from '../lib/crop-plan.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import type { GrowerSavedNurseryReview } from '../components/crops/useGrowerWorkflow';
import type { SavedNurseryReviewPanelProps } from '../components/crops/GrowerNurseryReviewPanel';
import type { GrowerFieldSeedSourcingSectionProps } from '../components/crops/GrowerFieldSeedSourcingSection';
import type { GrowerSeedSourcingPanelProps } from '../components/crops/GrowerSeedSourcingPanel';
import type { SeedSourcingGroupPatch } from '../components/crops/GrowerSeedSourcingForm';
import type { GrowerSeedPackBudgetProps } from '../components/crops/GrowerSeedPackBudget';
import { Ctx } from '../lib/i18n-context.ts';

// Both parents, the shared budget, source projections and arithmetic are real.
// Firebase/storage use the established isolated fixture. Fresh saved-book
// permission callbacks are controlled boundaries, not production hook admission.
const root = new URL('../', import.meta.url).href;
let deliveries = 0;
const priorDelivery = Object.getOwnPropertyDescriptor(globalThis, '__seedBudgetDelivery');
Object.assign(globalThis, { __seedBudgetDelivery: () => { deliveries++; } });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/file-delivery' && context.parentURL?.includes('/components/crops/')) {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        'export function downloadFile(){globalThis.__seedBudgetDelivery();return "downloaded";}') };
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
const { default: FieldSection } = await import('../components/crops/GrowerFieldSeedSourcingSection.tsx');
const { default: SeedPanel } = await import('../components/crops/GrowerSeedSourcingPanel.tsx');
const { default: Budget } = await import('../components/crops/GrowerSeedPackBudget.tsx');

const stamp = '2026-11-06T12:00:00.000Z';
const crop = CROPS.find(row => knownVegetativePropagationUnit(row.key) === null)!;
const own = <T, U extends string>(value: T, unit: U): Extract<GrowerInput<T, U>, { state: 'provided' }> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp },
});
async function fixture(nursery: boolean, unknownSeeds: boolean) {
  const siteId = 'site:0.00000,0.00000', canvas = buildDemoDesignCanvasState();
  canvas.siteId = siteId; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  const template = canvas.items.find(item => item.defId === 'veg_bed')!;
  canvas.items = [0.3, 0.7].map((x, i) => ({ ...template, id: `private-budget-bed-${i}`, x, y: 0.5, wM: 3, hM: 4 }));
  canvas.zones = []; canvas.lines = [];
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: canvas, sourceRevision: 'private-budget-source' }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic source held');
  const scope = source.scope;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-budget-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'),
    establishment: own(nursery ? 'transplant' : 'direct', 'method'),
    nurseryDays: nursery ? own(10, 'days') : { state: 'missing', reason: 'not-entered' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  // Synthetic capacities and counts exercise two represented cycles; these are
  // software fixtures, never crop timings, seed recommendations or observations.
  const proposal = generateGrowerAutoPlan({ requestedAt: stamp, scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'private-budget-demand', profileId: profile.profileId, scope, totalKg: own(13, 'kg-total'),
      harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 2);
  const rows = proposal.cycles.map((cycle, i) => createGrowerCyclePlanting(cycle, {
    plantingId: `private-budget-planting-${i}`, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint,
  })!);
  const view: GrowerSavedNurseryReview = { kind: 'saved-nursery-review', source, rows,
    cycleContext: { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint },
    horizon: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window'), references: [] };
  const settings: NurserySettings = { version: 1,
    containers: [{ id: 'private-budget-tray', siteId: source.resourceSiteId, name: 'Fixture tray', cells: 40, widthCm: 50, lengthCm: 40, owned: 20 }],
    spaces: [{ id: 'private-budget-bench', siteId: source.resourceSiteId, name: 'Fixture bench', usableM2: 10 }],
    profiles: [{ id: 'private-budget-recipe', siteId: source.resourceSiteId, cropKey: crop.key, containerId: 'private-budget-tray',
      spaceId: 'private-budget-bench', fieldSurvivalPercent: 80,
      ...(unknownSeeds ? { model: 'measured-tray' as const, usableStartsPerTray: 60 }
        : { model: 'seed-cell' as const, germinationPercent: 50, nurserySurvivalPercent: 75 }) }] };
  return { view, source, settings };
}

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
async function mount(kind: 'nursery' | 'field', options: { unknown?: boolean; partial?: boolean; missingNurseryBinding?: boolean } = {}) {
  const f = await fixture(kind === 'nursery', options.unknown === true);
  const gate = { check: async (_view: GrowerSavedNurseryReview) => true, binding: (_view: GrowerSavedNurseryReview) => true };
  let revision = 1, sample = false, lang = 'en', view = f.view;
  const check = async (captured: GrowerSavedNurseryReview) => captured === f.view && await gate.check(captured);
  const binding = (captured: GrowerSavedNurseryReview) => captured === f.view && gate.binding(captured);
  const parentElement = () => {
    const common: GrowerFieldSeedSourcingSectionProps = { savedReview: view, contextRevision: revision, sample,
      onCheckSavedCurrent: check, onCheckSavedBindingCurrent: binding };
    return kind === 'nursery'
      ? React.createElement(NurseryPanel, { ...common, source: f.source, settings: f.settings,
          ...(options.missingNurseryBinding ? { onCheckSavedBindingCurrent: undefined } : {}) } as SavedNurseryReviewPanelProps)
      : React.createElement(FieldSection, common);
  };
  let parent = parentElement();
  const element = () => React.createElement(Ctx.Provider, {
    value: { lang, setLang() {}, t: (key: string) => key, onboarded: true, completeOnboarding() {} },
  }, parent);
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(element()); }); mounted.add(renderer);
  const button = (label: string) => {
    const node = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(node, label); return node;
  };
  const change = (label: string, value: string | boolean, scope = renderer.root) => {
    const node = scope.findAllByType('label').find(node => text(node).startsWith(label)); assert.ok(node, label);
    const input = node.findAll(node => node.type === 'input' || node.type === 'select')[0]; assert.ok(input);
    act(() => input.props.onChange({ target: typeof value === 'boolean' ? { checked: value } : { value } }));
  };
  const seed = () => renderer.root.findByType(SeedPanel).props as GrowerSeedSourcingPanelProps;
  const budget = () => renderer.root.findByType(Budget).props as GrowerSeedPackBudgetProps;
  const ui = { renderer, gate, seed, budget, change, button,
    async press(label: string) { await act(async () => { button(label).props.onClick(); }); },
    update(patch: { revision?: number; sample?: boolean; lang?: string; view?: GrowerSavedNurseryReview } = {}) {
      revision = patch.revision ?? revision; sample = patch.sample ?? sample; lang = patch.lang ?? lang; view = patch.view ?? view;
      // A language context change does not replace the source owner's props.
      // Explicit source changes do; the nursery authority deliberately binds
      // that original props object as well as its canonical source content.
      if (patch.revision !== undefined || patch.sample !== undefined || patch.view !== undefined) parent = parentElement();
      act(() => renderer.update(element()));
    },
    edit() {
      if (kind === 'nursery') { const id = seed().groups[0].id; act(() => seed().onChangeGroup(id, { label: 'Changed supply' })); }
      else change('Your field supply group label', 'Changed supply');
    },
    async review() {
      if (kind === 'nursery') await act(async () => seed().onReview());
      else await this.press('Review field seed sourcing');
    },
    async ready() {
      if (kind === 'nursery') {
        for (const [index, resource, quantity] of [
          [1, 'container:private-budget-tray', '20'], [2, 'space:private-budget-bench', '10'],
        ] as const) {
          await this.press('Add resource availability');
          const row = () => renderer.root.findAllByType('fieldset').find(node => node.children.some(child =>
            typeof child !== 'string' && child.type === 'legend' && text(child) === `Available resource ${index}`));
          for (const [label, value] of [['Resource', resource], ['Quantity', quantity],
            ['From (UTC)', '2028-02-01'], ['Until (exclusive, UTC)', '2028-03-15']]) {
            const scope = row(); assert.ok(scope); change(label, value, scope);
          }
        }
        change('I have reviewed the saved nursery equipment', true); change('I confirm these dated resource allocations', true);
        change('I have listed all other nursery uses', true); await this.press('Review own nursery requirements');
        act(() => seed().onAddGroup());
        const patch: SeedSourcingGroupPatch = { label: 'Fixture supply', batchIds: seed().batches.slice(0, options.partial ? 1 : 2).map(row => row.id),
          interchangeabilityConfirmed: true, allocatedToPlanSeedsText: '0', seedsPerPackText: '100' };
        act(() => seed().onChangeGroup(seed().groups[0].id, patch));
      } else {
        await this.press('Check saved field cycles for seed sourcing');
        for (let i = 1; i <= 2; i++) {
          const scope = renderer.root.findByProps({ 'aria-label': `Field cycle ${i}` });
          change('Planting material declaration', 'botanical-seed', scope);
          change('Your gross required seeds', options.unknown ? '' : '100', scope);
          change('I confirm my gross whole-seed requirement', true, scope);
        }
        await this.press('Add field supply group');
        const group = renderer.root.findByProps({ 'aria-label': 'Field supply group 1' });
        change('Your field supply group label', 'Fixture supply', group); change('Field cycle 1', true, group);
        if (!options.partial) change('Field cycle 2', true, group);
        change('I confirm these selected field cycles', true, group); change('Allocated to this field plan', '0', group);
        change('Seeds per pack', '100', group);
      }
      await this.review();
    },
  };
  return ui;
}
function observedActor(uid: string) {
  assert.ok(probe.auth.size > 0); probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const listener of [...probe.auth]) listener({ uid });
}
beforeEach(async () => { await reset(); deliveries = 0; });
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => {
  hooks.deregister(); cleanup();
  if (priorDelivery) Object.defineProperty(globalThis, '__seedBudgetDelivery', priorDelivery);
  else Reflect.deleteProperty(globalThis, '__seedBudgetDelivery');
});

for (const kind of ['nursery', 'field'] as const) {
  test(`${kind} mounts the actual shared budget with the original reviewed proof, canonical groups and explicit locale only`, async () => {
    const ui = await mount(kind); assert.equal(ui.renderer.root.findAllByType(Budget).length, 0);
    await ui.ready(); const props = ui.budget();
    const proof = props.reviewProof as { review: unknown; draft: { groups: readonly { id: string }[] } };
    assert.equal(proof.review, props.review); assert.equal(props.isCurrent(proof), true);
    assert.equal(props.isCurrent({ ...proof }), false);
    assert.equal(props.review.status, 'available', JSON.stringify({ issues: props.review.issues,
      sourceIssues: props.review.sourceIssues, groups: props.review.groups.map(row => ({ status: row.status, issues: row.issues })) }));
    assert.equal(props.review.groups[0].id, proof.draft.groups[0].id);
    if (kind === 'nursery') assert.equal(proof.draft.groups, ui.seed().groups);
    assert.equal(props.sample, false); assert.equal(props.disabled, false); assert.equal(props.formatting.requested, 'en');
    const before = JSON.stringify([...local.rows]), beforeSession = JSON.stringify([...session.rows]);
    const leaf = () => ui.renderer.root.findByType(Budget);
    const select = leaf().findByType('select'); assert.equal(select.props.value, '');
    act(() => select.props.onChange({ target: { value: 'GBP' } }));
    const input = leaf().findAllByType('input').find(node => node.props.type === 'text'); assert.ok(input);
    act(() => input.props.onChange({ target: { value: '1,25' } }));
    ui.update({ lang: 'de' }); const translatedFormatting = ui.budget();
    assert.equal(translatedFormatting.reviewProof, proof); assert.equal(translatedFormatting.review, props.review);
    assert.equal(translatedFormatting.formatting.requested, 'de'); assert.equal(translatedFormatting.isCurrent(proof), true);
    assert.equal(leaf().findByType('select').props.value, 'GBP');
    assert.equal(leaf().findAllByType('input').find(node => node.props.type === 'text')!.props.value, '1,25');
    assert.equal(JSON.stringify([...local.rows]), before); assert.equal(JSON.stringify([...session.rows]), beforeSession);
    assert.equal(deliveries, 0);
  });

  for (const retirement of ['source', 'edit', 'actor', 'sample', 'unmount'] as const) {
    test(`${kind} retained budget admission fails after actual ${retirement} retirement`, async () => {
      const ui = await mount(kind); await ui.ready(); const props = ui.budget();
      assert.equal(props.isCurrent(props.reviewProof), true);
      if (retirement === 'source') ui.update({ revision: 2 });
      else if (retirement === 'edit') ui.edit();
      else if (retirement === 'actor') act(() => observedActor('owner-b'));
      else if (retirement === 'sample') act(() => { samples.enterSampleMode(); samples.exitSampleMode(); });
      else { mounted.delete(ui.renderer); act(() => ui.renderer.unmount()); }
      assert.equal(props.isCurrent(props.reviewProof), false);
      if (retirement !== 'unmount') assert.equal(ui.renderer.root.findAllByType(Budget).length, 0);
      assert.equal(deliveries, 0);
    });
  }

  test(`${kind} a new checking operation withdraws retained budget admission before its asynchronous permission returns`, async () => {
    const ui = await mount(kind); await ui.ready(); const props = ui.budget();
    const pending = deferred<boolean>(), started = deferred<void>();
    ui.gate.check = async () => { started.resolve(); return pending.promise; };
    act(() => {
      if (kind === 'nursery') ui.seed().onReview();
      else ui.button('Review field seed sourcing').props.onClick();
    });
    await started.promise;
    assert.equal(props.isCurrent(props.reviewProof), false);
    await act(async () => { pending.resolve(false); await pending.promise; });
    assert.equal(ui.renderer.root.findAllByType(Budget).length, 0); assert.equal(deliveries, 0);
  });

  for (const incomplete of ['unknown', 'partial'] as const) {
    test(`${kind} passes ${incomplete} seed coverage unchanged rather than substituting complete purchasing counts`, async () => {
      const ui = await mount(kind, { [incomplete]: true }); await ui.ready(); const props = ui.budget();
      assert.equal(props.review.status, 'partial'); assert.equal(props.isCurrent(props.reviewProof), true);
      assert.equal(props.review.wholeFarmCoverage, 'not-assessed');
      if (incomplete === 'unknown') {
        assert.equal(props.review.groups[0].status, 'unknown'); assert.equal(props.review.groups[0].counts?.packsNeeded, null);
      } else {
        const unassigned = 'unassignedBatchIds' in props.review ? props.review.unassignedBatchIds : props.review.unassignedPlantingIds;
        assert.equal(unassigned.length, 1); assert.equal(props.review.groups[0].status, 'complete');
      }
      assert.equal(ui.renderer.root.findByType(Budget).findByType('select').props.value, '');
      assert.equal(deliveries, 0);
    });
  }
}

// The binding callback is an explicitly controlled source-owner boundary. These
// cases do not claim production-hook or authenticated persistence admission.
for (const decline of ['false', 'throw'] as const) {
  test('nursery budget withdraws a ' + decline + ' original saved binding on the next price event and cannot revive that proof', async () => {
    const ui = await mount('nursery'); await ui.ready();
    const leaf = () => ui.renderer.root.findByType(Budget);
    act(() => leaf().findByType('select').props.onChange({ target: { value: 'USD' } }));
    act(() => leaf().findByType('input').props.onChange({ target: { value: '9.75' } }));
    assert.equal(leaf().findByType('input').props.value, '9.75');
    assert.ok(leaf().findAllByType('dd').some(node => /USD/.test(text(node))));
    const original = ui.budget().reviewProof;
    ui.gate.binding = () => { if (decline === 'throw') throw Error('PRIVATE_BINDING_DETAIL'); return false; };
    act(() => leaf().findByType('input').props.onChange({ target: { value: '1.23' } }));
    assert.equal(leaf().findAllByType('input').length, 0, 'source-owner rejection must withdraw displayed nursery costs immediately');
    assert.equal(leaf().findAllByType('dd').length, 0); assert.doesNotMatch(text(leaf()), /PRIVATE_BINDING_DETAIL/);
    ui.gate.binding = () => true; ui.update({ lang: 'de' });
    assert.equal(ui.budget().reviewProof, original);
    assert.equal(leaf().findAllByType('input').length, 0, 'the declined proof must remain held after the original binding predicate recovers');
    assert.equal(deliveries, 0);
  });
}

test('nursery budget requires the original synchronous saved binding callback rather than treating a missing callback as admission', async () => {
  const ui = await mount('nursery', { missingNurseryBinding: true }); await ui.ready();
  const props = ui.budget(), leaf = ui.renderer.root.findByType(Budget);
  assert.equal(props.isCurrent(props.reviewProof), false);
  assert.equal(leaf.findAllByType('select').length, 0); assert.equal(leaf.findAllByType('input').length, 0);
  assert.match(text(leaf), /held|unverified|unavailable/i); assert.equal(deliveries, 0);
});

test('nursery budget still admits ordinary price edits when the original saved binding remains affirmative', async () => {
  const ui = await mount('nursery'); await ui.ready();
  const props = ui.budget(), leaf = () => ui.renderer.root.findByType(Budget);
  assert.equal(props.isCurrent(props.reviewProof), true);
  act(() => leaf().findByType('select').props.onChange({ target: { value: 'USD' } }));
  act(() => leaf().findByType('input').props.onChange({ target: { value: '1.25' } }));
  assert.equal(leaf().findByType('input').props.value, '1.25');
  assert.ok(leaf().findAllByType('dd').some(node => /USD/.test(text(node))));
  assert.equal(deliveries, 0);
});
