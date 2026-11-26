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
const { GREEN_HORIZON_SITE, buildGreenHorizonStorageSeeds } = await import('../lib/green-horizon-demo.ts');
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
  assert.deepEqual(rawCanvas.items.map((bed: { id: string }) => bed.id), sample.getSandboxCropPlan().plantings.map(planting => planting.bedId));
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
