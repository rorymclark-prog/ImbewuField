import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const harness: {
  configured: boolean;
  currentUid: string | null;
} = {
  configured: true,
  currentUid: 'farmer-a',
};

Object.assign(globalThis, {
  __imbewuAccountStorageHarness: harness,
});

const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuAccountStorageHarness;
export const getFirebase = () => ({
  auth: {
    currentUser: harness.currentUid ? { uid: harness.currentUid } : null,
  },
});
export const isBackendConfigured = () => harness.configured;
`)}`;

const helperUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === helperUrl && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
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
    this.rows.set(key, String(value));
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage, sessionStorage },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
});

const {
  accountLocalStorageKey,
  accountLocalStorageKeyMatchesPrefix,
  activeAccountLocalStorageKey,
  activeAccountUid,
} = await import('../lib/account-local-storage.ts');
hooks.deregister();

test('configured accounts, signed-out drafts, and an actual uid named guest never share a key', () => {
  harness.configured = true;
  harness.currentUid = 'farmer/a';
  sessionStorage.clear();

  assert.equal(activeAccountUid(), 'farmer/a');
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:farmer%2Fa',
  );

  harness.currentUid = null;
  assert.equal(activeAccountUid(), null);
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::guest',
  );

  harness.currentUid = 'guest';
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:guest',
  );
  assert.notEqual(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::guest',
  );
});

test('sample mode and backend-unconfigured local-only mode retain historical bare keys', () => {
  harness.configured = true;
  harness.currentUid = 'real-user-behind-sample';
  sessionStorage.setItem('imbewu_sample_mode', '1');

  assert.equal(activeAccountUid(), null);
  assert.equal(activeAccountLocalStorageKey('farmer-data'), 'farmer-data');

  sessionStorage.clear();
  harness.configured = false;
  harness.currentUid = null;
  assert.equal(activeAccountLocalStorageKey('farmer-data'), 'farmer-data');
});

test('prefix enumeration rejects bare legacy rows and every other signed-in owner', () => {
  const prefix = 'imbewu_site_survey_';
  const aKey = accountLocalStorageKey(`${prefix}site-1`, 'farmer-a');
  const bKey = accountLocalStorageKey(`${prefix}site-1`, 'farmer-b');
  const bareKey = `${prefix}site-1`;

  assert.equal(accountLocalStorageKeyMatchesPrefix(aKey, prefix, 'farmer-a'), true);
  assert.equal(accountLocalStorageKeyMatchesPrefix(bKey, prefix, 'farmer-a'), false);
  assert.equal(accountLocalStorageKeyMatchesPrefix(bareKey, prefix, 'farmer-a'), false);
  assert.equal(accountLocalStorageKeyMatchesPrefix(bareKey, prefix, null), true);
  assert.equal(accountLocalStorageKeyMatchesPrefix(aKey, prefix, null), false);
});
