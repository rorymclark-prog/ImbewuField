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
  migrateGuestLocalStorageRows,
  removeSignedInLegacyLocalStorageKey,
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

test('only a mounted signed-in account may retire an unowned legacy row', () => {
  localStorage.clear();
  sessionStorage.clear();
  harness.configured = true;
  harness.currentUid = 'farmer-a';
  localStorage.setItem('legacy-gate', 'account-unknown');

  removeSignedInLegacyLocalStorageKey('legacy-gate');
  assert.equal(localStorage.getItem('legacy-gate'), null);

  harness.currentUid = null;
  localStorage.setItem('legacy-gate', 'guest-local');
  removeSignedInLegacyLocalStorageKey('legacy-gate');
  assert.equal(localStorage.getItem('legacy-gate'), 'guest-local');

  harness.configured = false;
  removeSignedInLegacyLocalStorageKey('legacy-gate');
  assert.equal(localStorage.getItem('legacy-gate'), 'guest-local');
});

// A minimal, array-shaped isEmpty predicate — the same convention lib/auth.tsx
// uses for the Field Journal's row (an empty JSON array reads as no entries).
const arrayIsEmpty = (raw: string | null): boolean => {
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    return !Array.isArray(parsed) || parsed.length === 0;
  } catch {
    return false;
  }
};

test('migrateGuestLocalStorageRows copies a guest row into an empty uid row, then clears the guest row', () => {
  localStorage.clear();
  const guestKey = 'imbewu_field_journal_v1::imbewu-owner::guest';
  const uidKey = accountLocalStorageKey('imbewu_field_journal_v1', 'farmer-a');
  localStorage.setItem(guestKey, '[{"id":"je_1"}]');

  migrateGuestLocalStorageRows(
    [{ baseKey: 'imbewu_field_journal_v1', isEmpty: arrayIsEmpty }],
    'farmer-a',
  );

  assert.equal(localStorage.getItem(uidKey), '[{"id":"je_1"}]');
  assert.equal(localStorage.getItem(guestKey), null, 'the guest row must not survive the copy — a shared phone must not replay it to the next guest');
});

test('migrateGuestLocalStorageRows never overwrites a non-empty uid row with a stale guest draft', () => {
  localStorage.clear();
  const guestKey = 'imbewu_field_journal_v1::imbewu-owner::guest';
  const uidKey = accountLocalStorageKey('imbewu_field_journal_v1', 'farmer-a');
  localStorage.setItem(guestKey, '[{"id":"stale-guest-draft"}]');
  localStorage.setItem(uidKey, '[{"id":"real-cloud-entry"}]');

  migrateGuestLocalStorageRows(
    [{ baseKey: 'imbewu_field_journal_v1', isEmpty: arrayIsEmpty }],
    'farmer-a',
  );

  assert.equal(localStorage.getItem(uidKey), '[{"id":"real-cloud-entry"}]', 'real account data must survive signing in on a second device');
  assert.equal(localStorage.getItem(guestKey), '[{"id":"stale-guest-draft"}]', 'nothing was copied, so the guest row is left alone rather than silently dropped');
});

test('migrateGuestLocalStorageRows never throws, and one bad row does not block another', () => {
  localStorage.clear();
  const throwingGuestKey = 'imbewu_crop_plan_v1::imbewu-owner::guest';
  const okGuestKey = 'imbewu_field_journal_v1::imbewu-owner::guest';
  const okUidKey = accountLocalStorageKey('imbewu_field_journal_v1', 'farmer-a');
  localStorage.setItem(throwingGuestKey, 'irrelevant');
  localStorage.setItem(okGuestKey, '[{"id":"je_1"}]');

  assert.doesNotThrow(() => {
    migrateGuestLocalStorageRows(
      [
        {
          baseKey: 'imbewu_crop_plan_v1',
          isEmpty: () => {
            throw new Error('corrupt guest JSON');
          },
        },
        { baseKey: 'imbewu_field_journal_v1', isEmpty: arrayIsEmpty },
      ],
      'farmer-a',
    );
  }, 'a farmer must be able to sign in even when one row\'s migration throws');

  assert.equal(localStorage.getItem(okUidKey), '[{"id":"je_1"}]', 'a later, healthy row still migrates despite an earlier row throwing');
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
