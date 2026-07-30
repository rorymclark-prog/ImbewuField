import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

type FakeAccountState = {
  backendConfigured: boolean;
  currentUid: string | null;
};

const accountState: FakeAccountState = {
  backendConfigured: true,
  currentUid: 'farmer-a',
};

Object.assign(globalThis, {
  __imbewuPersonalCacheAccount: accountState,
});

const fakeFirebaseInitModule = `data:text/javascript,${encodeURIComponent(`
const state = globalThis.__imbewuPersonalCacheAccount;
export const isBackendConfigured = () => state.backendConfigured;
export const getFirebase = () => state.backendConfigured
  ? { auth: { currentUser: state.currentUid ? { uid: state.currentUid } : null } }
  : null;
`)}`;

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromAccountBoundary = context.parentURL?.includes('/lib/account-local-storage.ts') ?? false;
    if (fromAccountBoundary && specifier === './firebase/init') {
      return { url: fakeFirebaseInitModule, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private rows = new Map<string, string>();

  get length(): number {
    return this.rows.size;
  }

  key(index: number): string | null {
    return [...this.rows.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.rows.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = local;
browser.sessionStorage = session;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: browser,
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: local,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: session,
});

const cropPlan = await import('../lib/crop-plan.ts');
const cropPrices = await import('../lib/crop-prices.ts');
const taskBoard = await import('../lib/task-board.ts');
const siteProgress = await import('../lib/site-progress.ts');
const facilitatorDesign = await import('../lib/facilitator-design.ts');

function plan(id: string): import('../lib/crop-plan.ts').CropPlanState {
  return {
    version: 1,
    plantings: [{
      id,
      bedId: `${id}-bed`,
      cropKey: 'lettuce',
      sowMonth: 3,
    }],
    updatedAt: 1,
  };
}

function design(id: string): import('../lib/facilitator-design.ts').FacilitatorDesignState {
  return {
    version: 1,
    items: [{
      id,
      type: 'bed',
      x: 1,
      y: 2,
      wM: 3,
      hM: 4,
      rotation: 0,
    }],
    lines: [],
    sectors: [],
    pxPerM: 5,
    activeLayer: 'planting',
    hiddenLayers: [],
    savedAt: 1,
  };
}

test('a direct farmer switch keeps planning, progress and facilitator caches with their owner', () => {
  accountState.currentUid = 'farmer-a';
  cropPlan.saveCropPlan(plan('a-plan'));
  cropPlan.saveFavouriteCropKeys(new Set(['lettuce']));
  cropPlan.saveAllowBedSharing(true);
  cropPlan.saveCashflowSettings({ sellPercent: 75, lossPercent: 5 });
  cropPrices.saveCropPriceOverrides({
    lettuce: { retailPerKg: 111, wholesalePerKg: 22, confidence: 'estimated' },
  });
  assert.equal(taskBoard.saveCompletedTaskIds(new Set(['a-plan:sow'])), true);
  siteProgress.setGuidedState({ enabled: false, dismissals: 2 });
  facilitatorDesign.saveFacilitatorState(design('a-design'));

  accountState.currentUid = 'farmer-b';
  assert.deepEqual(cropPlan.loadCropPlan().plantings, []);
  assert.deepEqual([...cropPlan.loadFavouriteCropKeys()], []);
  assert.equal(cropPlan.loadAllowBedSharing(), false);
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 100, lossPercent: 0 });
  assert.deepEqual(cropPrices.loadCropPriceOverrides(), {});
  assert.deepEqual([...taskBoard.loadCompletedTaskIds()], []);
  assert.deepEqual(siteProgress.getGuidedState(), {
    enabled: true,
    dismissals: 0,
    retired: false,
  });
  assert.equal(facilitatorDesign.loadFacilitatorState(), null);

  cropPlan.saveCropPlan(plan('b-plan'));
  cropPlan.saveFavouriteCropKeys(new Set(['cabbage']));
  cropPlan.saveAllowBedSharing(false);
  cropPlan.saveCashflowSettings({ sellPercent: 20, lossPercent: 10 });
  cropPrices.saveCropPriceOverrides({
    cabbage: { retailPerKg: 222, wholesalePerKg: 33, confidence: 'estimated' },
  });
  assert.equal(taskBoard.saveCompletedTaskIds(new Set(['b-plan:harvest'])), true);
  siteProgress.setGuidedState({ enabled: true, dismissals: 1 });
  facilitatorDesign.saveFacilitatorState(design('b-design'));

  accountState.currentUid = 'farmer-a';
  assert.equal(cropPlan.loadCropPlan().plantings[0]?.id, 'a-plan');
  assert.deepEqual([...cropPlan.loadFavouriteCropKeys()], ['lettuce']);
  assert.equal(cropPlan.loadAllowBedSharing(), true);
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 75, lossPercent: 5 });
  assert.equal(cropPrices.loadCropPriceOverrides().lettuce?.retailPerKg, 111);
  assert.deepEqual([...taskBoard.loadCompletedTaskIds()], ['a-plan:sow']);
  assert.deepEqual(siteProgress.getGuidedState(), {
    enabled: false,
    dismissals: 2,
    retired: false,
  });
  assert.equal(facilitatorDesign.loadFacilitatorState()?.items[0]?.id, 'a-design');

  // Clearing B's design must never remove A's saved work.
  accountState.currentUid = 'farmer-b';
  facilitatorDesign.clearFacilitatorState();
  accountState.currentUid = 'farmer-a';
  assert.equal(facilitatorDesign.loadFacilitatorState()?.items[0]?.id, 'a-design');
});

test('backend-unconfigured local-only mode retains the historical bare storage keys', () => {
  accountState.backendConfigured = false;
  accountState.currentUid = null;

  cropPrices.saveCropPriceOverrides({
    onions: { retailPerKg: 10, wholesalePerKg: 5, confidence: 'estimated' },
  });
  assert.ok(local.getItem('imbewu_crop_price_overrides_v1'));
  assert.equal(cropPrices.loadCropPriceOverrides().onions?.retailPerKg, 10);

  accountState.backendConfigured = true;
});

test.after(() => {
  hooks.deregister();
});
