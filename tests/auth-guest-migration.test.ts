// Confirms the wiring in lib/auth.tsx itself — not just the pure helper in
// lib/account-local-storage.ts (see tests/account-local-storage.test.ts for that) —
// actually calls the guest → account localStorage migration on a successful sign-in,
// with the same three guarantees: it happens, it never clobbers real account data,
// and a failure inside it can never stop a farmer from signing in.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

type FakeUser = { uid: string };
type AuthListener = (user: FakeUser | null) => void | Promise<void>;

const fakeAuth: { currentUser: FakeUser | null } = { currentUser: null };
let authListener: AuthListener | null = null;

const harness = {
  firebase: { auth: fakeAuth },
  installAuthListener(listener: AuthListener) {
    authListener = listener;
    return () => {
      if (authListener === listener) authListener = null;
    };
  },
};

Object.assign(globalThis, { __imbewuAuthGuestMigrationHarness: harness });

// Same MemoryStorage convention as tests/account-local-storage.test.ts, plus a
// single knob to make one specific key's write fail — the stand-in for a real
// localStorage failure (quota exceeded, privacy mode) mid-migration.
class MemoryStorage {
  private rows = new Map<string, string>();
  throwOnSetKey: string | null = null;

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSetKey !== null && key === this.throwOnSetKey) {
      throw new Error('storage unavailable (simulated)');
    }
    this.rows.set(key, String(value));
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
    this.throwOnSetKey = null;
  }
}

const localStorageMock = new MemoryStorage();
const sessionStorageMock = new MemoryStorage();

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: localStorageMock, sessionStorage: sessionStorageMock },
});

const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

// signInWithEmailAndPassword resolves with a uid equal to the email it was called
// with — this test never touches real credentials, so the string is just a handle.
const fakeFirebaseAuthModule = moduleUrl(`
const harness = globalThis.__imbewuAuthGuestMigrationHarness;
export const onAuthStateChanged = (_auth, listener) => harness.installAuthListener(listener);
export const getRedirectResult = async () => null;
export const signInWithEmailAndPassword = async (_auth, email) => {
  const uid = email;
  harness.firebase.auth.currentUser = { uid };
  return { user: { uid } };
};
export const createUserWithEmailAndPassword = async () => {
  throw new Error('not used by this test');
};
export const signOut = async () => {};
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
export const updatePassword = async () => {};
export const reauthenticateWithCredential = async () => {};
export const signInWithPopup = async () => {
  throw new Error('not used by this test');
};
export const signInWithRedirect = async () => {};
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({ providerId: 'password' }) };
`);

const fakeFirebaseInitModule = moduleUrl(`
const harness = globalThis.__imbewuAuthGuestMigrationHarness;
export const getFirebase = () => harness.firebase;
export const isBackendConfigured = () => true;
`);

const fakeQueriesModule = moduleUrl(`
export const getMyProfile = async () => null;
export const updateMyProfile = async () => {};
`);

const authModuleUrl = new URL('../lib/auth.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === authModuleUrl) {
      if (specifier === 'firebase/auth') {
        return { url: fakeFirebaseAuthModule, shortCircuit: true };
      }
      if (specifier === '@/lib/firebase/init') {
        return { url: fakeFirebaseInitModule, shortCircuit: true };
      }
      if (specifier === '@/lib/db/queries') {
        return { url: fakeQueriesModule, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === authModuleUrl) {
      const source = readFileSync(new URL(url), 'utf8');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: 'auth.tsx',
      });
      return { format: 'module', source: transpiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { AuthProvider, useAuth } = await import('../lib/auth.tsx');
// A pure string-formatting helper (no Firebase calls) — safe to import unmocked.
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

const guestKey = (baseKey: string) => `${baseKey}::imbewu-owner::guest`;
const uidKey = (baseKey: string, uid: string) => accountLocalStorageKey(baseKey, uid);

async function withSignIn(
  run: (signIn: (email: string, password: string) => Promise<string | null>) => Promise<void>,
): Promise<void> {
  let latestSignIn: ((email: string, password: string) => Promise<string | null>) | null = null;

  function Probe() {
    const auth = useAuth();
    latestSignIn = auth.signIn;
    return null;
  }

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(AuthProvider, null, createElement(Probe)));
    await Promise.resolve();
  });

  // AuthProvider suspends its children until the first auth-state transition
  // resolves. Emit "signed out" so Probe mounts and hands us a live `signIn`.
  await act(async () => {
    fakeAuth.currentUser = null;
    void authListener?.(null);
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.ok(latestSignIn, 'AuthProvider should have rendered its children and exposed signIn');
  await run(latestSignIn!);
  act(() => renderer.unmount());
}

test('a successful sign-in migrates guest Field Journal and Crop Planner rows into the account, and clears the guest rows', async () => {
  localStorageMock.clear();
  localStorageMock.setItem(guestKey('imbewu_field_journal_v1'), '[{"id":"je_1"}]');
  localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), '{"version":1,"plantings":[{"id":"p1"}],"updatedAt":1}');

  await withSignIn(async (signIn) => {
    const err = await signIn('farmer-a', 'irrelevant');
    assert.equal(err, null, 'sign-in itself must still succeed');
  });

  assert.equal(
    localStorageMock.getItem(uidKey('imbewu_field_journal_v1', 'farmer-a')),
    '[{"id":"je_1"}]',
  );
  assert.equal(localStorageMock.getItem(guestKey('imbewu_field_journal_v1')), null);

  assert.equal(
    localStorageMock.getItem(uidKey('imbewu_crop_plan_v1', 'farmer-a')),
    '{"version":1,"plantings":[{"id":"p1"}],"updatedAt":1}',
  );
  assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), null);
});

test('signing in on a second device never lets a stale guest draft overwrite a real account row', async () => {
  localStorageMock.clear();
  localStorageMock.setItem(guestKey('imbewu_field_journal_v1'), '[{"id":"stale-guest-draft"}]');
  localStorageMock.setItem(
    uidKey('imbewu_field_journal_v1', 'farmer-b'),
    '[{"id":"real-cloud-entry"}]',
  );

  await withSignIn(async (signIn) => {
    const err = await signIn('farmer-b', 'irrelevant');
    assert.equal(err, null);
  });

  assert.equal(
    localStorageMock.getItem(uidKey('imbewu_field_journal_v1', 'farmer-b')),
    '[{"id":"real-cloud-entry"}]',
    'the real account row must survive untouched',
  );
});

test('a storage failure during migration does not stop the farmer from signing in', async () => {
  localStorageMock.clear();
  localStorageMock.setItem(guestKey('imbewu_field_journal_v1'), '[{"id":"je_1"}]');
  // Force the write into the new account's row to throw, simulating a full origin.
  localStorageMock.throwOnSetKey = uidKey('imbewu_field_journal_v1', 'farmer-c');

  await withSignIn(async (signIn) => {
    const err = await signIn('farmer-c', 'irrelevant');
    assert.equal(err, null, 'signIn must resolve successfully even though the migration write threw');
  });

  // The write failed, so the row was never populated — but nothing propagated
  // out of signIn to say so, which is the whole point of the guarantee.
  assert.equal(localStorageMock.getItem(uidKey('imbewu_field_journal_v1', 'farmer-c')), null);
});
