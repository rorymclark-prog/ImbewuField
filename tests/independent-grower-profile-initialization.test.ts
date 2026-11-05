import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

type FakeUser = { uid: string; displayName: string };
type AuthListener = (user: FakeUser | null) => void | Promise<void>;
type StoredProfile = Record<string, unknown>;
type ProfileWrite = { uid: string; patch: StoredProfile };
type BlockedProfileRead = { uid: string; resolve: (profile: StoredProfile | null) => void };

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}

// Auth still executes the real guest-data transfer. Empty isolated stores and
// faithful exclusive locks keep that unrelated prerequisite from hiding a path.
class MemoryLocks {
  private held = new Set<string>();
  async request<T>(name: string, _options: unknown, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return await run(null);
    this.held.add(name);
    try { return await run({ name, mode: 'exclusive' }); }
    finally { this.held.delete(name); }
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
const harness = {
  firebase: { auth: { currentUser: null as FakeUser | null } },
  listener: null as AuthListener | null,
  redirectUid: null as string | null,
  popupUid: 'popup-profile',
  profiles: new Map<string, StoredProfile>(),
  writes: [] as ProfileWrite[],
  reads: [] as string[],
  blockedRead: null as BlockedProfileRead | null,
  deferNextRead: false,
  credential(uid: string) {
    const user = { uid, displayName: `Name ${uid}` };
    this.firebase.auth.currentUser = user;
    // Observer delivery is explicit. Otherwise fallback initialization could
    // accidentally satisfy a test intended for redirect, signup or popup.
    return { user };
  },
  async readProfile(): Promise<StoredProfile | null> {
    const uid = this.firebase.auth.currentUser?.uid;
    assert.ok(uid, 'Only a signed-in actor may request its profile');
    this.reads.push(uid);
    if (this.deferNextRead) {
      this.deferNextRead = false;
      return new Promise(resolve => { this.blockedRead = { uid, resolve }; });
    }
    return this.profiles.get(uid) ?? null;
  },
  async writeProfile(patch: StoredProfile) {
    const uid = this.firebase.auth.currentUser?.uid;
    assert.ok(uid, 'Profile writes must retain the actor at the query boundary');
    const detached = structuredClone(patch);
    this.writes.push({ uid, patch: detached });
    this.profiles.set(uid, { id: uid, ...this.profiles.get(uid), ...detached });
  },
};

const globals = {
  window: { localStorage: local, sessionStorage: session },
  navigator: { userAgent: 'profile-regression-browser', locks: new MemoryLocks() },
  __independentProfileHarness: harness,
  IS_REACT_ACT_ENVIRONMENT: true,
};
const prior = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const firebaseAuth = moduleUrl(`
const h = globalThis.__independentProfileHarness;
export const onAuthStateChanged = (_auth, listener) => { h.listener=listener; return () => { if(h.listener===listener)h.listener=null; }; };
export const getRedirectResult = async () => h.redirectUid === null ? null : h.credential(h.redirectUid);
export const createUserWithEmailAndPassword = async (_auth,email) => h.credential(email);
export const signInWithEmailAndPassword = async (_auth,email) => h.credential(email);
export const signInWithPopup = async () => h.credential(h.popupUid);
export const signOut = async () => {};
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
export const updatePassword = async () => {};
export const reauthenticateWithCredential = async () => {};
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({}) };
`);
const firebaseInit = moduleUrl(`
const h = globalThis.__independentProfileHarness;
export const getFirebase = () => h.firebase;
export const isBackendConfigured = () => true;
`);
const queries = moduleUrl(`
const h = globalThis.__independentProfileHarness;
export const getMyProfile = () => h.readProfile();
export const updateMyProfile = patch => h.writeProfile(patch);
`);
const authUrl = new URL('../lib/auth.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === authUrl) {
      if (specifier === 'firebase/auth') return { url: firebaseAuth, shortCircuit: true };
      if (specifier === '@/lib/db/queries') return { url: queries, shortCircuit: true };
    }
    if ((specifier === '@/lib/firebase/init' || specifier === './firebase/init')
      && (context.parentURL === authUrl || context.parentURL?.endsWith('/lib/account-local-storage.ts'))) {
      return { url: firebaseInit, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === authUrl) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { fileName: 'auth.tsx', compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
      } }).outputText };
    return next(url, context);
  },
});
const { AuthProvider, useAuth } = await import('../lib/auth.tsx');
hooks.deregister();
after(() => {
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function mounted(
  run: (api: { auth: () => ReturnType<typeof useAuth>; emit: (uid: string) => Promise<void> }) => Promise<void>,
  options: { redirectUid?: string; existing?: StoredProfile } = {},
) {
  local.clear(); session.clear(); harness.profiles.clear();
  harness.writes = []; harness.reads = []; harness.blockedRead = null; harness.deferNextRead = false;
  harness.firebase.auth.currentUser = null;
  harness.redirectUid = options.redirectUid ?? null;
  if (options.existing) harness.profiles.set(String(options.existing.id), structuredClone(options.existing));
  let latest!: ReturnType<typeof useAuth>;
  function Probe() { latest = useAuth(); return createElement('span', null, latest.user?.uid ?? 'guest'); }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(AuthProvider, null, createElement(Probe))); });
  try {
    // A redirect runs during mount. Allow its own promise chain to complete
    // before delivering the observer so the producing path stays identifiable.
    await act(async () => { await new Promise<void>(resolve => setImmediate(resolve)); });
    if (!options.redirectUid) await act(async () => { await harness.listener?.(null); });
    await run({ auth: () => latest, async emit(uid) {
      const { user } = harness.credential(uid);
      await act(async () => { await harness.listener?.(user); });
    } });
  } finally {
    (harness.blockedRead as BlockedProfileRead | null)?.resolve(null);
    await act(async () => { renderer.unmount(); });
  }
}

function assertIndependentWrite(uid: string, role: string, fullName: string) {
  assert.deepEqual(harness.writes, [{ uid, patch: { full_name: fullName, role, language: 'en', org_id: null } }]);
  assert.equal(Object.hasOwn(harness.writes[0].patch, 'org_id'), true, 'An explicit null gives the personal-design rules a known absence of membership');
}

test('a new Google redirect profile records explicit absent membership before observer fallback runs', async () => {
  const uid = 'redirect-profile';
  await mounted(async ({ emit, auth }) => {
    assertIndependentWrite(uid, 'farmer', `Name ${uid}`);
    await emit(uid);
    assert.equal(auth().profile?.org_id, null);
    assert.equal(harness.writes.length, 1, 'The observer must retain the initialized profile');
  }, { redirectUid: uid });
});

test('the signed-in observer repairs a genuinely missing profile with explicit absent membership', async () => {
  const uid = 'observer-profile';
  await mounted(async ({ emit, auth }) => {
    await emit(uid);
    assertIndependentWrite(uid, 'farmer', `Name ${uid}`);
    assert.equal(auth().profile?.id, uid);
    assert.equal(auth().profile?.org_id, null);
  });
});

test('email signup initializes a personal profile while retaining the selected student role', async () => {
  await mounted(async ({ auth, emit }) => {
    const uid = 'signup-profile';
    await act(async () => { assert.equal(await auth().signUp(uid, 'unused-fixture', 'Chosen name', 'student'), null); });
    assertIndependentWrite(uid, 'student', 'Chosen name');
    await emit(uid);
    assert.equal(auth().profile?.role, 'student');
    assert.equal(auth().profile?.org_id, null);
    assert.equal(harness.writes.length, 1);
  });
});

test('a new Google popup profile records explicit absent membership without relying on its observer', async () => {
  await mounted(async ({ auth, emit }) => {
    await act(async () => { assert.equal(await auth().signInWithGoogle(), null); });
    assertIndependentWrite(harness.popupUid, 'farmer', `Name ${harness.popupUid}`);
    await emit(harness.popupUid);
    assert.equal(auth().profile?.org_id, null);
    assert.equal(harness.writes.length, 1);
  });
});

for (const method of ['redirect', 'observer', 'popup'] as const) {
  test(`an existing ${method} profile retains its administrator-granted membership and role`, async () => {
    const uid = method === 'popup' ? harness.popupUid : `${method}-existing`;
    const existing = { id: uid, org_id: 'trusted-membership', role: 'mentor', full_name: 'Existing name', language: 'zu' };
    await mounted(async ({ auth, emit }) => {
      if (method === 'popup') await act(async () => { assert.equal(await auth().signInWithGoogle(), null); });
      await emit(uid);
      assert.deepEqual(harness.writes, [], 'Initialization must never repair a present profile by replacing its membership or role');
      assert.deepEqual(harness.profiles.get(uid), existing);
      assert.equal(auth().profile?.role, existing.role);
      assert.equal(auth().profile?.org_id, existing.org_id);
    }, { existing, ...(method === 'redirect' ? { redirectUid: uid } : {}) });
  });
}

test('an obsolete missing-profile lookup cannot initialize the replacement account', async () => {
  await mounted(async ({ auth }) => {
    harness.deferNextRead = true;
    const { user } = harness.credential('old-account');
    let oldTransition!: Promise<void>;
    await act(async () => {
      oldTransition = Promise.resolve(harness.listener?.(user));
      await new Promise<void>(resolve => setImmediate(resolve));
    });
    assert.equal(harness.blockedRead?.uid, 'old-account', 'The real observer reached its asynchronous profile read');
    const replacement = { id: 'replacement-account', org_id: 'replacement-org', role: 'farmer', full_name: 'Replacement', language: 'en' };
    harness.profiles.set(replacement.id, replacement);
    const next = harness.credential(replacement.id).user;
    await act(async () => { await harness.listener?.(next); });
    await act(async () => { harness.blockedRead?.resolve(null); await oldTransition; });
    assert.deepEqual(harness.writes, []);
    assert.equal(auth().profile?.id, replacement.id);
    assert.equal(auth().profile?.org_id, replacement.org_id);
  });
});
