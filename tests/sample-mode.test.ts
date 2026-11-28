import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import type { SampleWorkspace } from '../lib/sample-mode';

class MemoryStorage {
  readonly rows = new Map<string, string>();
  refuseWrites = false;
  throwOnWrite = false;

  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(String(key)) ?? null; }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('storage unavailable');
    if (!this.refuseWrites) this.rows.set(String(key), String(value));
  }
  removeItem(key: string): void { this.rows.delete(String(key)); }
  clear(): void { this.rows.clear(); }
}

Object.defineProperty(globalThis, 'Storage', {
  configurable: true,
  value: MemoryStorage,
});

const realLocal = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = realLocal;
browser.sessionStorage = session;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: realLocal });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const sample = await import('../lib/sample-mode.ts');
const { DEMO_SITE, buildDemoStorageSeeds } = await import('../lib/demo-farm.ts');
const { GREEN_HORIZON_SITE, buildGreenHorizonLettuceTarget, buildGreenHorizonChardTarget, buildGreenHorizonPlanningDraft,
  buildGreenHorizonWeeklyPracticeDraft, buildGreenHorizonStorageSeeds } = await import('../lib/green-horizon-demo.ts');
const { RIVIER_UITSIG_SITE, RIVIER_UITSIG_SITE_ID } = await import('../lib/rivier-uitsig-layout.ts');
const { buildRivierUitsigPlanningDraft } = await import('../lib/rivier-uitsig-demo.ts');
const { weeklyProductionOrders } = await import('../lib/international/grower-weekly-production.ts');
const { loadCropPlan, saveCropPlanWithReceipt } = await import('../lib/crop-plan.ts');
const { readCanvasSourceReceipt } = await import('../lib/design-canvas.ts');
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
const { assembleGrowerWorkflowReview, prepareGrowerWorkflowAcceptance } = await import('../lib/international/grower-workflow.ts');
const { designSiteIdFromLocation } = await import('../lib/design-studio.ts');
const { loadPlaces } = await import('../lib/saved-places.ts');
const { prepareSampleFarm } = await import('../lib/sample-farm-session.ts');
// The role action itself never uses React auth. Keep the provider's TSX out
// of the Node-only session/storage test so the action can execute directly.
const roleNavigationUrl = new URL('../lib/use-role-navigation.ts', import.meta.url).href;
const mockAuth = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './auth' && context.parentURL === roleNavigationUrl) {
      return { url: 'data:text/javascript,export%20function%20useAuth()%20%7B%7D', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { openRolePreview } = await import('../lib/use-role-navigation.ts');
mockAuth.deregister();

function reset(): void {
  session.refuseWrites = false;
  session.throwOnWrite = false;
  sample.exitSampleMode();
  realLocal.rows.clear();
  session.rows.clear();
}

test('sample localStorage reads and writes are isolated from a real farmer', () => {
  reset();
  realLocal.setItem('real-only', 'farmer');
  realLocal.setItem('shared-key', 'real value');

  assert.equal(sample.enterSampleMode(), true);
  assert.equal(sample.isSampleMode(), true);
  assert.equal(realLocal.getItem('real-only'), null);
  assert.equal(realLocal.getItem('shared-key'), null);

  realLocal.setItem('shared-key', 'demo value');
  realLocal.setItem('demo-only', 'sandbox');
  assert.equal(realLocal.getItem('shared-key'), 'demo value');
  assert.equal(realLocal.getItem('demo-only'), 'sandbox');

  realLocal.clear();
  assert.equal(realLocal.getItem('demo-only'), null);
  assert.deepEqual(
    Object.fromEntries(realLocal.rows),
    { 'real-only': 'farmer', 'shared-key': 'real value' },
    'sample clear() must not touch the backing store',
  );

  sample.exitSampleMode();
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');
  assert.equal(realLocal.getItem('shared-key'), 'real value');
  assert.equal(realLocal.getItem('demo-only'), null);
});

test('the session flag is never swallowed by the localStorage shim', () => {
  reset();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(session.getItem('imbewu_sample_mode'), '1');

  realLocal.clear();
  assert.equal(session.getItem('imbewu_sample_mode'), '1');

  sample.exitSampleMode();
  assert.equal(session.getItem('imbewu_sample_mode'), null);
});

test('sample pages keep the chosen interface language across reloads without changing the real account', () => {
  reset();
  realLocal.setItem('permamap_lang', 'zu');
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(realLocal.getItem('permamap_lang'), 'zu');
  assert.equal(session.getItem('imbewu_sample_lang'), 'zu', 'the sample tab can restore its language after a hard navigation');

  realLocal.setItem('permamap_lang', 'en');
  assert.equal(realLocal.getItem('permamap_lang'), 'en');
  assert.equal(session.getItem('imbewu_sample_lang'), 'en');
  assert.equal(realLocal.rows.get('permamap_lang'), 'zu', 'sample language changes must not write the real account preference');

  sample.exitSampleMode();
  assert.equal(session.getItem('imbewu_sample_lang'), null);
  assert.equal(realLocal.getItem('permamap_lang'), 'zu');
});

test('entering again starts from clean seeded storage and clean typed data', () => {
  reset();
  const seeds = buildDemoStorageSeeds();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(realLocal.getItem('imbewu_farm_shapes'), seeds.imbewu_farm_shapes);

  realLocal.setItem('demo-edit', 'changed');
  const originalSales = sample.getSandboxSales().length;
  sample.addSandboxSale({ crop: 'temporary sample edit' });
  assert.equal(sample.getSandboxSales().length, originalSales + 1);

  sample.exitSampleMode();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(realLocal.getItem('demo-edit'), null);
  assert.equal(realLocal.getItem('imbewu_farm_shapes'), buildDemoStorageSeeds().imbewu_farm_shapes);
  assert.equal(sample.getSandboxSales().length, originalSales);
});

test('Green Horizon keeps its typed and raw edits apart from Ubhejane and real records', () => {
  reset();
  realLocal.setItem('imbewu_field_journal_v1', 'private journal');
  realLocal.setItem('permamap_saved_places', 'private places');
  realLocal.setItem('fp-theme', 'slate');
  assert.equal(sample.enterSampleMode('ubhejane'), true);
  realLocal.setItem('example-edit', 'Ubhejane');
  sample.addSandboxSale({ crop: 'Ubhejane only' });
  const ubhejaneCanvasKey = `imbewu_design_canvas_${designSiteIdFromLocation(DEMO_SITE)}`;
  assert.ok(realLocal.getItem(ubhejaneCanvasKey));

  assert.equal(sample.enterSampleMode('green-horizon'), true);
  assert.deepEqual(sample.getSampleMapSite(), GREEN_HORIZON_SITE);
  const { lat, lon } = GREEN_HORIZON_SITE;
  assert.equal(sample.isFictionalSampleLocation(lat, lon), true);
  assert.equal(sample.isFictionalSampleLocation(lat + 0.00001, lon), false);
  assert.deepEqual(loadPlaces().map(({ name, elevation }) => ({ name, elevation })), [{ name: GREEN_HORIZON_SITE.name, elevation: null }]);
  const seeds = buildGreenHorizonStorageSeeds();
  assert.deepEqual(seeds, buildGreenHorizonStorageSeeds(), 'the sample records and geometry are reproducible');
  const canvasKey = `imbewu_design_canvas_${designSiteIdFromLocation(GREEN_HORIZON_SITE)}`;
  const rawCanvas = JSON.parse(realLocal.getItem(canvasKey) ?? '');
  assert.equal(rawCanvas.baseMode, 'blank');
  assert.equal(rawCanvas.siteId, designSiteIdFromLocation(GREEN_HORIZON_SITE));
  assert.deepEqual(rawCanvas.items.map((bed: { id: string }) => bed.id), [
    'green-horizon-bed-a1', 'green-horizon-bed-a2', 'green-horizon-bed-b1',
  ]);
  assert.deepEqual(sample.getSandboxCropPlan().plantings.map(planting => planting.bedId), ['green-horizon-bed-a2'],
    'the example leaves A1 and B1 open for dated practice while A2 keeps its month-only record');
  assert.equal(realLocal.getItem('imbewu_field_journal_v1'), seeds.imbewu_field_journal_v1);
  assert.equal(realLocal.getItem('fp-theme'), 'slate');
  assert.equal(realLocal.getItem(ubhejaneCanvasKey), null);
  assert.equal(realLocal.getItem('example-edit'), null);
  assert.deepEqual(sample.getSandboxSales().map(row => row.crop), ['Lettuce']);
  assert.equal(sample.getSandboxProfile().farm_name, GREEN_HORIZON_SITE.name);
  assert.throws(() => prepareSampleFarm(), /Ubhejane/);

  realLocal.setItem('imbewu_field_journal_v1', 'Green Horizon journal edit');
  sample.addSandboxSale({ crop: 'Green Horizon only' });
  assert.equal(sample.enterSampleMode(), true);
  assert.deepEqual(sample.getSampleMapSite(), DEMO_SITE);
  assert.equal(sample.isFictionalSampleLocation(lat, lon), false);
  assert.ok(!sample.getSandboxSales().some(row => row.crop.includes('only')));
  assert.equal(realLocal.getItem(canvasKey), null);
  assert.ok(realLocal.getItem(ubhejaneCanvasKey));
  assert.notEqual(realLocal.getItem('imbewu_field_journal_v1'), 'Green Horizon journal edit');

  sample.exitSampleMode();
  assert.equal(sample.isFictionalSampleLocation(lat, lon), false);
  assert.equal(sample.getSampleWorkspace(), null);
  assert.equal(sample.getSampleMapSite(), null);
  assert.equal(session.getItem('imbewu_sample_workspace'), null);
  assert.equal(realLocal.getItem('imbewu_field_journal_v1'), 'private journal');
  assert.equal(realLocal.getItem('permamap_saved_places'), 'private places');
});

test('sample profile keys are allowlisted and ignored until the isolation flag is present', () => {
  reset();
  session.setItem('imbewu_sample_workspace', 'green-horizon');
  assert.equal(sample.getSampleWorkspace(), null);
  assert.equal(sample.enterSampleMode('invalid' as SampleWorkspace), false);
  assert.equal(sample.isSampleMode(), false);

  session.setItem('imbewu_sample_mode', '1');
  assert.equal(sample.getSampleWorkspace(), 'green-horizon');
  assert.equal(sample.getSandboxProfile().farm_name, GREEN_HORIZON_SITE.name);
  assert.match(realLocal.getItem('imbewu_farm_shapes') ?? '', /green-horizon/);
  session.setItem('imbewu_sample_workspace', 'invalid');
  assert.equal(sample.getSampleWorkspace(), 'ubhejane');
  assert.equal(sample.getSandboxProfile().farm_name, 'Ubhejane Crèche garden');
  assert.doesNotMatch(realLocal.getItem('imbewu_farm_shapes') ?? '', /green-horizon/);
  session.removeItem('imbewu_sample_workspace');
  assert.equal(sample.getSampleWorkspace(), 'ubhejane');
});

test('Green Horizon’s dated lettuce target survives the normal sample save and resets on changing examples', () => {
  reset();
  assert.equal(sample.enterSampleMode('green-horizon'), true);
  const plan = loadCropPlan();
  const target = buildGreenHorizonLettuceTarget();
  const chard = buildGreenHorizonChardTarget();
  assert.deepEqual(plan.harvestTargets, [target, chard]);
  assert.equal(target.siteId, designSiteIdFromLocation(GREEN_HORIZON_SITE));
  assert.equal(saveCropPlanWithReceipt({
    ...plan,
    harvestTargets: [{ ...target, weeklyKg: 9 }, chard],
  }).saved, true);
  assert.equal(loadCropPlan().harvestTargets?.[0]?.weeklyKg, 9);
  assert.deepEqual(loadCropPlan().harvestTargets?.[1], chard);
  assert.equal(sample.getSandboxProduction()[0]?.kg, 6);
  assert.equal(sample.getSandboxSales()[0]?.kg, 4);
  assert.equal(sample.enterSampleMode('ubhejane'), true);
  assert.ok(!loadCropPlan().harvestTargets?.some(row => row.id === target.id));
  assert.equal(sample.enterSampleMode('green-horizon'), true);
  assert.deepEqual(loadCropPlan().harvestTargets, [target, chard]);
});

test('the staggered market-garden review keeps dated picking, an entered zero and an unknown quantity distinct', async () => {
  reset();
  assert.ok(sample.enterSampleMode('green-horizon'));
  const target = buildGreenHorizonChardTarget();
  const receipt = readCanvasSourceReceipt(target.siteId);
  assert.equal(receipt.status, 'ready');
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({
    kind: 'studio-canvas', sourceId: target.siteId, raw: receipt.raw, sourceRevision: receipt.revision,
  }));
  assert.equal(source.status, 'ready');
  const practice = buildGreenHorizonWeeklyPracticeDraft();
  const draft = { ...practice, assumptionsConfirmed: true, available: practice.available.map(row => ({ ...row, confirmed: true })) };
  const inputs = { scope: source.scope, source, book: loadCropPlan(), draft, recordedAt: '2026-11-27T09:00:00.000Z' };
  const review = assembleGrowerWorkflowReview(inputs);
  assert.equal(review.status, 'review', review.issues.join(', '));
  assert.equal(review.proposal.status, 'ready', 'the opening practice draft can save both cycles despite its separate weekly gap');
  const chardDemand = review.proposal.demandResults.find(row => row.demandId === target.id);
  assert.ok(chardDemand);
  assert.equal(chardDemand.unmetKg, 0);
  const heavierPacks = assembleGrowerWorkflowReview({ ...inputs, book: { ...inputs.book,
    harvestTargets: inputs.book.harvestTargets?.map(row => row.id === target.id ? { ...target, kgPerUnit: 0.35 } : row),
  } });
  assert.equal(heavierPacks.status, 'review');
  assert.equal(heavierPacks.proposal.status, 'with-gaps', 'whole-cycle limits still hold with the heavier practice packs');
  const cycles = review.proposal.cycles.map(cycle => ({
    siteId: target.siteId, plantingId: null, targetId: cycle.demandId, bedId: cycle.bedId,
    cropKey: cycle.assessment.snapshot.profile.cropKey, schedule: cycle.assessment.schedule,
    basis: 'worked-example' as const, wholeCycleKg: cycle.assessment.capacity.estimatedYieldKg,
  }));
  assert.deepEqual(cycles.map(({ bedId, schedule }) => [bedId, schedule.firstHarvestDate]), [
    ['green-horizon-bed-a1', '2026-11-02'], ['green-horizon-bed-b1', '2026-11-09'],
  ]);
  const [first, second] = target.weeklyPlan!;
  const periods = weeklyProductionOrders(target, cycles);
  assert.deepEqual(periods.map(row => [row.start, row.requested, row.planned, row.planningGap, row.daysWithoutPicking]), [
    ['2026-11-09', 12, 12, 0, 4],
    ['2026-11-16', 12, 0, 12, 7],
    ['2026-11-23', 12, null, null, 7],
  ]);
  assert.equal(weeklyProductionOrders({ ...target, weeklyPlan: [first, first] }, cycles)[0].planned, null);
  assert.equal(weeklyProductionOrders({ ...target, weeklyPlan: [{ ...first, unit: 'kg' }] }, cycles)[0].planned, null);
  const shorter = { ...target, window: { ...target.window, endExclusive: '2026-11-25' } };
  assert.equal(weeklyProductionOrders(shorter, cycles).at(-1)?.requested, null);
  const book = loadCropPlan();
  assert.ok(saveCropPlanWithReceipt({ ...book, harvestTargets: book.harvestTargets?.map(row => row.id === target.id
    ? { ...target, weeklyPlan: [first, { ...second, quantity: 7 }] } : row) }).saved);
  const saved = loadCropPlan().harvestTargets?.find(row => row.id === target.id);
  assert.ok(saved);
  assert.equal(weeklyProductionOrders(saved, cycles)[1].planningGap, 5);
  assert.ok(sample.enterSampleMode('green-horizon'));
  assert.equal(loadCropPlan().harvestTargets?.find(row => row.id === target.id)?.weeklyPlan?.[1].quantity, 0);
});

test('the Green Horizon practice inputs produce a saved cycle with an explicitly partial picking window', async () => {
  reset();
  assert.ok(sample.enterSampleMode('green-horizon'));
  const { siteId } = buildGreenHorizonLettuceTarget();
  const receipt = readCanvasSourceReceipt(siteId);
  assert.equal(receipt.status, 'ready');
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({
    kind: 'studio-canvas', sourceId: siteId, raw: receipt.raw, sourceRevision: receipt.revision,
  }));
  assert.equal(source.status, 'ready');
  const book = loadCropPlan();
  const practice = buildGreenHorizonPlanningDraft();
  assert.equal(practice.assumptionsConfirmed, false);
  assert.equal(practice.available[0].confirmed, false);
  const draft = { ...practice, assumptionsConfirmed: true, available: practice.available.map(row => ({ ...row, confirmed: true })) };
  const recordedAt = '2026-11-27T09:00:00.000Z';
  const review = assembleGrowerWorkflowReview({ scope: source.scope, source, book, draft, recordedAt });
  assert.equal(review.status, 'review', review.issues.join(', '));
  assert.equal(review.proposal.status, 'ready');
  assert.equal(review.targetMetadata[0].buyerTotalKg, 8);
  assert.equal(review.targetMetadata[0].grossCapacityRequiredKg, 10);
  assert.equal(review.targetMetadata[0].deliveryDistribution, 'not-established');
  assert.equal(review.proposal.cycles.length, 1);
  const [cycle] = review.proposal.cycles;
  assert.equal(cycle.bedId, 'green-horizon-bed-a1');
  assert.equal(cycle.assessment.schedule.firstHarvestDate, '2026-11-02');
  assert.equal(cycle.assessment.schedule.harvestEndExclusiveDate, '2026-11-05');
  const accepted = prepareGrowerWorkflowAcceptance({ scope: source.scope, source, book, review, binding: { draft, source, recordedAt },
    acceptedAt: recordedAt, plantingIds: [{ cycleId: cycle.cycleId, plantingId: 'accepted-green-horizon-cycle' }] });
  assert.equal(accepted.status, 'prepared');
  assert.equal(saveCropPlanWithReceipt(accepted.book).saved, true);
  assert.deepEqual(loadCropPlan().plantings.find(row => row.id === accepted.rows[0].id), accepted.rows[0]);
  assert.equal(sample.getSandboxProduction()[0].kg, 6);
  assert.equal(sample.getSandboxSales()[0].kg, 4);
});

test('Rivier Uitsig checks all 16 mapped beds and reopens both saved practice cycles in its own workspace', async () => {
  reset();
  realLocal.setItem('private-rivier-canary', 'personal bytes');
  const personal = [...realLocal.rows];
  assert.ok(sample.enterSampleMode('rivier-uitsig'));
  assert.deepEqual(sample.getSampleMapSite(), RIVIER_UITSIG_SITE);
  assert.equal(sample.isFictionalSampleLocation(RIVIER_UITSIG_SITE.lat, RIVIER_UITSIG_SITE.lon), true);
  assert.equal(sample.isFictionalSampleLocation(GREEN_HORIZON_SITE.lat, GREEN_HORIZON_SITE.lon), false);
  assert.equal(sample.getSandboxProfile().farm_name, 'Rivier Uitsig');
  assert.equal(realLocal.getItem('private-rivier-canary'), null);
  assert.deepEqual(sample.getSandboxProduction(), []);
  assert.deepEqual(sample.getSandboxSales(), []);
  const book = loadCropPlan();
  assert.deepEqual(book.plantings, []);
  assert.equal(book.harvestTargets?.every(row => row.siteId === RIVIER_UITSIG_SITE_ID), true);
  const practice = buildRivierUitsigPlanningDraft();
  assert.equal(practice.assumptionsConfirmed, false);
  assert.deepEqual(practice.available.map(row => [row.bedId, row.confirmed]), [
    ['rivier-uitsig-bed-a01', false], ['rivier-uitsig-bed-b01', false],
  ]);

  const receipt = readCanvasSourceReceipt(RIVIER_UITSIG_SITE_ID);
  assert.equal(receipt.status, 'ready');
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({
    kind: 'studio-canvas', sourceId: RIVIER_UITSIG_SITE_ID, raw: receipt.raw, sourceRevision: receipt.revision,
  }));
  assert.equal(source.status, 'ready');
  assert.equal(source.beds.length, 16);
  assert.ok(Math.abs(source.beds.reduce((sum, bed) => sum + bed.areaM2, 0) - 460.8) < 0.001);
  const draft = { ...practice, assumptionsConfirmed: true, available: practice.available.map(row => ({ ...row, confirmed: true })) };
  const recordedAt = '2026-11-28T10:00:00.000Z';
  const review = assembleGrowerWorkflowReview({ scope: source.scope, source, book, draft, recordedAt });
  assert.equal(review.status, 'review', review.issues.join(', '));
  assert.equal(review.proposal.status, 'ready');
  assert.deepEqual(review.proposal.cycles.map(row => [row.bedId, row.assessment.schedule.firstHarvestDate]), [
    ['rivier-uitsig-bed-a01', '2026-11-02'], ['rivier-uitsig-bed-b01', '2026-11-09'],
  ]);
  const accepted = prepareGrowerWorkflowAcceptance({ scope: source.scope, source, book, review,
    binding: { draft, source, recordedAt }, acceptedAt: recordedAt,
    plantingIds: review.proposal.cycles.map((row, index) => ({ cycleId: row.cycleId, plantingId: `rivier-practice-accepted-${index}` })),
  });
  assert.equal(accepted.status, 'prepared');
  assert.ok(saveCropPlanWithReceipt(accepted.book).saved);
  assert.deepEqual(loadCropPlan().plantings, accepted.rows);
  assert.deepEqual(sample.getSandboxProduction(), []);

  assert.ok(sample.enterSampleMode('green-horizon'));
  assert.equal(sample.getSandboxProduction()[0].kg, 6);
  assert.equal(sample.getSandboxSales()[0].kg, 4);
  assert.equal(realLocal.getItem(`imbewu_design_canvas_${RIVIER_UITSIG_SITE_ID}`), null);
  assert.ok(sample.enterSampleMode('ubhejane'));
  assert.deepEqual(sample.getSampleMapSite(), DEMO_SITE);
  assert.ok(sample.enterSampleMode('rivier-uitsig'));
  assert.deepEqual(loadCropPlan().plantings, []);
  assert.deepEqual(sample.getSandboxSales(), []);
  sample.exitSampleMode();
  assert.deepEqual([...realLocal.rows], personal);
});

test('a refused workspace switch preserves the active sample isolation and edits', () => {
  reset();
  realLocal.setItem('private', 'real record');
  assert.equal(sample.enterSampleMode('green-horizon'), true);
  realLocal.setItem('example-edit', 'practice edit');
  session.refuseWrites = true;
  assert.equal(sample.enterSampleMode('ubhejane'), false);
  assert.equal(sample.getSampleWorkspace(), 'green-horizon');
  assert.equal(realLocal.getItem('private'), null);
  assert.equal(realLocal.getItem('example-edit'), 'practice edit');
});

test('a role preview leaves the market garden with a hard remount before continuing in Ubhejane', () => {
  reset();
  assert.equal(sample.enterSampleMode('green-horizon'), true);
  const remounts: string[] = [];
  const clientRoutes: string[] = [];
  Object.defineProperty(browser, 'location', {
    configurable: true,
    value: { assign: (target: string) => remounts.push(target) },
  });
  try {
    assert.equal(openRolePreview('funder', '/funder', target => clientRoutes.push(target)), true);
    assert.equal(sample.getSampleWorkspace(), 'ubhejane');
    assert.deepEqual(remounts, ['/funder']);
    assert.equal(clientRoutes.length, 0);
    assert.equal(openRolePreview('mentor', '/mentor', target => clientRoutes.push(target)), true);
    assert.deepEqual(clientRoutes, ['/mentor']);
    assert.equal(openRolePreview('admin', '/admin', target => clientRoutes.push(target)), false);
    assert.deepEqual(clientRoutes, ['/mentor']);
  } finally {
    Reflect.deleteProperty(browser, 'location');
  }
});

test('sample-mode entry fails closed when sessionStorage throws or silently refuses the flag', () => {
  reset();
  realLocal.setItem('real-only', 'farmer');

  session.throwOnWrite = true;
  assert.equal(sample.enterSampleMode(), false);
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');

  session.throwOnWrite = false;
  session.refuseWrites = true;
  assert.equal(sample.enterSampleMode(), false);
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');
});

test('entry dispatches one change event only after isolation is active', () => {
  reset();
  let changes = 0;
  const onChange = () => {
    changes += 1;
    assert.equal(sample.isSampleMode(), true);
  };
  browser.addEventListener(sample.SAMPLE_MODE_EVENT, onChange);

  assert.equal(sample.enterSampleMode(), true);
  assert.equal(changes, 1);

  browser.removeEventListener(sample.SAMPLE_MODE_EVENT, onChange);
  sample.exitSampleMode();
});

test('the home invitation opens the tour chooser before entering the isolated workspace', () => {
  const source = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /showTourInvitation && <button/);
  assert.ok(source.includes("router.push('/tour')"));
  const provider = readFileSync(new URL('../components/ProductTourProvider.tsx', import.meta.url), 'utf8');
  assert.ok(provider.includes("previousWorkspace !== 'ubhejane' && !enterSampleMode()"), 'the tour must still verify the right isolated workspace before preparing practice records');
});
