import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// The 25% fresh default is a sourced SA smallholder opening position (CSIR 2021
// 9% production + 18.3% post-harvest ≈ 25.6% cumulative; FAO Food Loss Index
// fruit & veg 25.4%; Molelekoa et al. 2025: 25.15% on 3,115 tomatoes across 8 SA
// smallholder farms — triangulation with shared data ancestry, not independence).
// The MIGRATION rule this file enforces is stricter than the default itself:
// only a genuinely fresh account may see 25. Any persisted settings — confirmed
// or not, including a deliberate 0 — must load back byte-for-byte unchanged.

const accountState = { backendConfigured: true, currentUid: 'loss-default-farmer' as string | null };
Object.assign(globalThis, { __imbewuLossDefaultAccount: accountState });

const fakeFirebaseInitModule = `data:text/javascript,${encodeURIComponent(`
const state = globalThis.__imbewuLossDefaultAccount;
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
  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(String(key), String(value)); }
  removeItem(key: string): void { this.rows.delete(key); }
  clear(): void { this.rows.clear(); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });

const cropPlan = await import('../lib/crop-plan.ts');
const { activeAccountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

const STORE_KEY = () => activeAccountLocalStorageKey('imbewu_cashflow_settings_v1');

test('a genuinely fresh account opens the loss slider at 25%, unconfirmed', () => {
  localStorage.clear();
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 100, lossPercent: 25, confirmed: false });
  // The gate itself: confirmed must be false so no Rand headline can render
  // from the default alone.
  assert.equal(cropPlan.DEFAULT_CASHFLOW_SETTINGS.confirmed, false);
  assert.equal(cropPlan.DEFAULT_CASHFLOW_SETTINGS.lossPercent, 25);
});

test('every persisted settings shape loads back unchanged — the 25% default never migrates onto a saved farm', () => {
  // A farmer who deliberately confirmed 0% loss keeps 0%.
  localStorage.clear();
  cropPlan.saveCashflowSettings({ sellPercent: 60, lossPercent: 0, confirmed: true });
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 60, lossPercent: 0, confirmed: true });

  // A farmer who touched the sliders but never confirmed also keeps their values.
  localStorage.clear();
  cropPlan.saveCashflowSettings({ sellPercent: 100, lossPercent: 0, confirmed: false });
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 100, lossPercent: 0, confirmed: false });

  // Arbitrary persisted values round-trip exactly.
  localStorage.clear();
  cropPlan.saveCashflowSettings({ sellPercent: 35, lossPercent: 42, confirmed: true });
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 35, lossPercent: 42, confirmed: true });
});

test('a persisted blob missing lossPercent falls back to the value the old code showed (0), not the new fresh default', () => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY(), JSON.stringify({ sellPercent: 80 }));
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 80, lossPercent: 0, confirmed: false });

  // Non-numeric junk in a stored field behaves the same as a missing field.
  localStorage.setItem(STORE_KEY(), JSON.stringify({ sellPercent: 'high', lossPercent: 'low', confirmed: 'yes' }));
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 100, lossPercent: 0, confirmed: false });
});

test('an unreadable store is a fresh start: corrupt JSON yields the fresh defaults', () => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY(), '{not json');
  assert.deepEqual(cropPlan.loadCashflowSettings(), { sellPercent: 100, lossPercent: 25, confirmed: false });
});

test('the sample-mode sandbox opens with the same fresh defaults (lockstep with DEFAULT_CASHFLOW_SETTINGS)', async () => {
  const sampleMode = await import('../lib/sample-mode.ts');
  assert.deepEqual(sampleMode.getSandboxCashflowSettings(), cropPlan.DEFAULT_CASHFLOW_SETTINGS);
});
