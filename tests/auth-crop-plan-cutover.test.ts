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
  nextUid: 'cutover-farmer',
  emitCredentialObserver: true,
  redirectUid: null as string | null,
  credential(uid: string) {
    fakeAuth.currentUser = { uid };
    if (this.emitCredentialObserver) void authListener?.(fakeAuth.currentUser);
    return { user: fakeAuth.currentUser };
  },
  installAuthListener(listener: AuthListener) {
    authListener = listener;
    return () => {
      if (authListener === listener) authListener = null;
    };
  },
};

Object.assign(globalThis, { __imbewuAuthCutoverHarness: harness });

// Same MemoryStorage convention as tests/account-local-storage.test.ts, plus a
// single knob to make one specific key's write fail — the stand-in for a real
// localStorage failure (quota exceeded, privacy mode) mid-migration.
class MemoryStorage {
  private rows = new Map<string, string>();
  writes: string[] = [];
  throwOnSetKey: string | null = null;

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSetKey !== null && key === this.throwOnSetKey) {
      throw new Error('storage unavailable (simulated)');
    }
    this.rows.set(key, String(value));
    this.writes.push(key);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
    this.throwOnSetKey = null;
    this.writes = [];
  }
}

// Auth now transfers a canonical crop-book/evidence pair under Web Locks. The
// fixture supplies the real lock contract rather than bypassing that boundary.
class MemoryLocks {
  private held = new Set<string>();
  pauseNext = false;
  releasePaused: (() => void) | null = null;
  requests = 0;
  resume(): void { this.releasePaused?.(); }
  async request<T>(name: string, _options: unknown, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    this.requests++;
    if (this.pauseNext) {
      this.pauseNext = false;
      await new Promise<void>(resolve => { this.releasePaused = resolve; });
      this.releasePaused = null;
    }
    if (this.held.has(name)) return await run(null);
    this.held.add(name);
    try { return await run({ name, mode: 'exclusive' }); }
    finally { this.held.delete(name); }
  }
}
const locks = new MemoryLocks();
const testNavigator: { userAgent: string; locks?: MemoryLocks } = { userAgent: 'auth-cutover-test', locks };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: testNavigator });

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
const harness = globalThis.__imbewuAuthCutoverHarness;
export const onAuthStateChanged = (_auth, listener) => harness.installAuthListener(listener);
export const getRedirectResult = async () => {
  if (harness.redirectUid === null) return null;
  await Promise.resolve();
  return harness.credential(harness.redirectUid);
};
export const signInWithEmailAndPassword = async (_auth, email) => harness.credential(email);
export const createUserWithEmailAndPassword = async (_auth, email) => harness.credential(email);
export const signOut = async () => {};
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
export const updatePassword = async () => {};
export const reauthenticateWithCredential = async () => {};
export const signInWithPopup = async () => harness.credential(harness.nextUid);
export const signInWithRedirect = async () => {};
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({ providerId: 'password' }) };
`);

const fakeFirebaseInitModule = moduleUrl(`
const harness = globalThis.__imbewuAuthCutoverHarness;
export const getFirebase = () => harness.firebase;
export const isBackendConfigured = () => true;
`);

const fakeQueriesModule = moduleUrl(`
export const getMyProfile = async () => ({ id: 'test-profile', role: 'farmer', org_id: null });
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
const { initialiseCropPlanStorage, makeBrowserCropPlanStorageContext, readCropPlanStorageTransferHold } = await import('../lib/crop-plan-storage.ts');
hooks.deregister();

const guestKey = (baseKey: string) => `${baseKey}::imbewu-owner::guest`;
const uidKey = (baseKey: string, uid: string) => accountLocalStorageKey(baseKey, uid);

const LEGACY = 'imbewu_crop_plan_v1';
const CANONICAL = 'imbewu_crop_plan_v2';
const EVIDENCE = 'imbewu_crop_plan_cutover_v2';
const guestRaw = '{"version":1,"plantings":[],"updatedAt":1,"growerPlanningProfiles":[{"profileId":"unfinished-estimate"}],"futureMetadata":{"note":"Authored but not yet understood"}}';
const emptyRaw = '{"version":1,"plantings":[],"updatedAt":1}';

function seedPair(owner: string | null, raw: string, legacy: string | null = null): void {
  const physical = (base: string) => owner === null ? guestKey(base) : uidKey(base, owner);
  const cutoverId = `fixture-${owner ?? 'guest'}`;
  if (legacy !== null) localStorageMock.setItem(physical(LEGACY), legacy);
  localStorageMock.setItem(physical(CANONICAL), JSON.stringify({ storageVersion: 2, cutoverId, bookRaw: raw }));
  localStorageMock.setItem(physical(EVIDENCE), JSON.stringify({ receiptVersion: 1,
    canonicalKey: physical(CANONICAL), cutoverId, legacyBytes: legacy, importedBookRaw: raw }));
}

function accountBook(uid: string): string | null {
  const raw = localStorageMock.getItem(uidKey(CANONICAL, uid));
  if (raw === null) return null;
  const envelope = JSON.parse(raw);
  const evidence = JSON.parse(localStorageMock.getItem(uidKey(EVIDENCE, uid)) ?? 'null');
  assert.equal(envelope.storageVersion, 2);
  assert.equal(evidence?.canonicalKey, uidKey(CANONICAL, uid));
  assert.equal(evidence?.cutoverId, envelope.cutoverId);
  return envelope.bookRaw;
}

async function mounted(run: (h: { renderer: ReactTestRenderer; auth: () => ReturnType<typeof useAuth> }) => Promise<void>, options: { beforeMount?: () => void; redirectUid?: string } = {}): Promise<void> {
  localStorageMock.clear(); sessionStorageMock.clear();
  fakeAuth.currentUser = null; testNavigator.locks = locks;
  locks.pauseNext = false; locks.releasePaused = null; locks.requests = 0;
  harness.emitCredentialObserver = true;
  harness.redirectUid = options.redirectUid ?? null;
  options.beforeMount?.();
  let latest!: ReturnType<typeof useAuth>;
  function Probe() { latest = useAuth(); return createElement('span', null, latest.user?.uid ?? 'guest'); }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(AuthProvider, null, createElement(Probe))); });
  await act(async () => { await authListener?.(fakeAuth.currentUser); });
  assert.equal(latest.loading, false);
  try { await run({ renderer, auth: () => latest }); }
  finally {
    locks.resume();
    act(() => renderer.unmount());
    testNavigator.locks = locks;
  }
}

test('sign-in transfers a canonical guest pair with exact authored bytes and destination-bound provenance', async () => {
  await mounted(async ({ auth }) => {
    seedPair(null, guestRaw, emptyRaw);
    const sourceCapture = { canonicalRaw: localStorageMock.getItem(guestKey(CANONICAL)),
      receiptRaw: localStorageMock.getItem(guestKey(EVIDENCE)), legacyRaw: localStorageMock.getItem(guestKey(LEGACY)) };
    await act(async () => { assert.equal(await auth().signIn('pair-owner', 'irrelevant'), null); });
    assert.equal(accountBook('pair-owner'), guestRaw);
    const receipt = JSON.parse(localStorageMock.getItem(uidKey(EVIDENCE, 'pair-owner'))!);
    assert.deepEqual(receipt.sourceCapture, sourceCapture, 'all three source snapshots survive transfer, including acknowledged legacy provenance');
    assert.equal(receipt.importedBookRaw, guestRaw);
    assert.equal(receipt.legacyBytes, null, 'destination baseline belongs to destination, not to guest legacy');
    assert.notEqual(receipt.cutoverId, 'fixture-guest');
    for (const key of [LEGACY, CANONICAL, EVIDENCE]) assert.equal(localStorageMock.getItem(guestKey(key)), null);
    assert.equal(localStorageMock.writes.filter(k => k === uidKey(CANONICAL, 'pair-owner')).length, 1,
      'credential and observer entry points share one completed migration');
  });
});

test('account children remain suspended until the asynchronous migration finishes', async () => {
  await mounted(async ({ renderer, auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw); locks.pauseNext = true;
    let signingIn!: Promise<string | null>;
    await act(async () => { signingIn = auth().signIn('waiting-owner', 'irrelevant'); await Promise.resolve(); });
    assert.ok(locks.releasePaused, 'the actual pair transfer must have reached its lock boundary');
    assert.equal(renderer.root.findAllByType('span').length, 1, 'only the loading indicator remains');
    assert.equal(renderer.root.findAllByProps({ 'aria-busy': 'true' }).length, 1, JSON.stringify(renderer.toJSON()));
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'waiting-owner')), null);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), guestRaw);
    await act(async () => { locks.resume(); assert.equal(await signingIn, null); });
    assert.equal(auth().loading, false); assert.equal(auth().user?.uid, 'waiting-owner');
    assert.equal(accountBook('waiting-owner'), guestRaw);
  });
});

test('a later account epoch revokes the queued first-account transfer without consuming its source', async () => {
  await mounted(async ({ auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw); locks.pauseNext = true;
    let first!: Promise<string | null>;
    await act(async () => { first = auth().signIn('stale-owner', 'irrelevant'); await Promise.resolve(); });
    assert.ok(locks.releasePaused);
    fakeAuth.currentUser = { uid: 'current-owner' };
    let transition!: Promise<void>;
    await act(async () => { transition = Promise.resolve(authListener?.(fakeAuth.currentUser)); await Promise.resolve(); });
    await act(async () => { locks.resume(); await first; await transition; });
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'stale-owner')), null);
    assert.equal(localStorageMock.getItem(uidKey(EVIDENCE, 'stale-owner')), null);
    assert.equal(accountBook('current-owner'), guestRaw);
    assert.equal(auth().user?.uid, 'current-owner');
  });
});

test('sample entry during lock acquisition revokes persistent migration while authentication can finish', async () => {
  await mounted(async ({ auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw); locks.pauseNext = true;
    let signingIn!: Promise<string | null>;
    await act(async () => { signingIn = auth().signIn('sample-owner', 'irrelevant'); await Promise.resolve(); });
    assert.ok(locks.releasePaused);
    sessionStorageMock.setItem('imbewu_sample_mode', '1');
    await act(async () => { locks.resume(); assert.equal(await signingIn, null); });
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'sample-owner')), null);
    assert.equal(localStorageMock.getItem(uidKey(EVIDENCE, 'sample-owner')), null);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), guestRaw);
    assert.equal(auth().loading, false);
  });
});

test('quota failures retain the guest and partial destination evidence without failing authentication', async () => {
  for (const failedKey of [EVIDENCE, CANONICAL]) await mounted(async ({ auth }) => {
    seedPair(null, guestRaw); const source = [LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key)));
    localStorageMock.throwOnSetKey = uidKey(failedKey, 'quota-owner');
    await act(async () => { assert.equal(await auth().signIn('quota-owner', 'irrelevant'), null); });
    assert.equal(auth().loading, false);
    if (failedKey === EVIDENCE) {
      assert.ok(auth().cropPlanMigrationHold, 'retained guest work cannot be silently hidden behind a new empty account');
      assert.ok(readCropPlanStorageTransferHold(makeBrowserCropPlanStorageContext()));
      const attempted = await initialiseCropPlanStorage(makeBrowserCropPlanStorageContext(), locks);
      assert.equal(attempted.writable, false);
      assert.equal(attempted.reason, 'guest-transfer-held');
    }
    assert.deepEqual([LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key))), source);
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'quota-owner')), null);
    if (failedKey === CANONICAL) assert.ok(localStorageMock.getItem(uidKey(EVIDENCE, 'quota-owner')),
      'receipt-first partial failure must remain distinguishable from never migrated');
  });
});

test('a valid empty canonical destination is authoritative and cannot resurrect a stale guest plan', async () => {
  await mounted(async ({ auth }) => {
    seedPair('empty-current', emptyRaw); seedPair(null, guestRaw);
    const destination = [CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(uidKey(key, 'empty-current')));
    const source = [CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key)));
    await act(async () => { assert.equal(await auth().signIn('empty-current', 'irrelevant'), null); });
    assert.deepEqual([CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(uidKey(key, 'empty-current'))), destination);
    assert.deepEqual([CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key))), source);
    assert.equal(accountBook('empty-current'), emptyRaw);
    assert.equal(auth().cropPlanMigrationHold, null, 'existing canonical work must remain usable with the guest preserved');
  });
});

test('corrupt, partial or diverged pairs retain both histories instead of granting a destination overwrite', async () => {
  for (const scenario of ['target-corrupt', 'target-partial', 'guest-partial', 'guest-diverged']) await mounted(async ({ auth }) => {
    seedPair(null, guestRaw, emptyRaw);
    if (scenario === 'target-corrupt') localStorageMock.setItem(uidKey(CANONICAL, 'held-owner'), '{broken');
    if (scenario === 'target-partial') localStorageMock.setItem(uidKey(EVIDENCE, 'held-owner'), '{}');
    if (scenario === 'guest-partial') localStorageMock.removeItem(guestKey(CANONICAL));
    if (scenario === 'guest-diverged') localStorageMock.setItem(guestKey(LEGACY), guestRaw);
    const source = [LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key)));
    const destination = [LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(uidKey(key, 'held-owner')));
    await act(async () => { assert.equal(await auth().signIn('held-owner', 'irrelevant'), null); });
    assert.deepEqual([LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(guestKey(key))), source, scenario);
    assert.deepEqual([LEGACY, CANONICAL, EVIDENCE].map(key => localStorageMock.getItem(uidKey(key, 'held-owner'))), destination, scenario);
    assert.equal(auth().loading, false);
  });
});

test('unsupported locking preserves guest work and returns from sign-in without pretending a crop transfer', async () => {
  await mounted(async ({ auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw); testNavigator.locks = undefined;
    await act(async () => { assert.equal(await auth().signIn('unsupported-owner', 'irrelevant'), null); });
    assert.equal(auth().loading, false);
    assert.ok(auth().cropPlanMigrationHold);
    const attempted = await initialiseCropPlanStorage(makeBrowserCropPlanStorageContext(), locks);
    assert.equal(attempted.reason, 'guest-transfer-held');
    assert.equal(attempted.writable, false);
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'unsupported-owner')), null);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), guestRaw);
  });
});

test('signup and Google popup use the same guarded pair transfer as password sign-in', async () => {
  for (const method of ['signup', 'popup']) await mounted(async ({ auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw);
    await act(async () => {
      if (method === 'signup') assert.equal(await auth().signUp('new-owner', 'irrelevant', 'Test grower'), null);
      else { harness.nextUid = 'new-owner'; assert.equal(await auth().signInWithGoogle(), null); }
    });
    assert.equal(accountBook('new-owner'), guestRaw, method);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), null, method);
    assert.equal(auth().loading, false);
  });
});

test('redirect completion shares the observer migration barrier and cannot double-write its imported guest book', async () => {
  await mounted(async ({ auth }) => {
    assert.equal(auth().user?.uid, 'redirect-owner');
    assert.equal(auth().loading, false);
    assert.equal(accountBook('redirect-owner'), guestRaw);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), null);
    assert.equal(localStorageMock.writes.filter(key => key === uidKey(CANONICAL, 'redirect-owner')).length, 1);
  }, { redirectUid: 'redirect-owner', beforeMount: () => localStorageMock.setItem(guestKey(LEGACY), guestRaw) });
});

test('an unmounted provider cannot consume guest work when its delayed lock eventually resolves', async () => {
  await mounted(async ({ renderer, auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw); locks.pauseNext = true;
    let signingIn!: Promise<string | null>;
    await act(async () => { signingIn = auth().signIn('unmounted-owner', 'irrelevant'); await Promise.resolve(); });
    assert.ok(locks.releasePaused);
    act(() => renderer.unmount());
    await act(async () => { locks.resume(); assert.equal(await signingIn, null); });
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'unmounted-owner')), null);
    assert.equal(localStorageMock.getItem(uidKey(EVIDENCE, 'unmounted-owner')), null);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), guestRaw);
  });
});

test('an explicit guarded retry transfers retained guest work before an empty destination can be initialised', async () => {
  await mounted(async ({ auth }) => {
    localStorageMock.setItem(guestKey(LEGACY), guestRaw);
    localStorageMock.throwOnSetKey = uidKey(EVIDENCE, 'retry-owner');
    await act(async () => { assert.equal(await auth().signIn('retry-owner', 'irrelevant'), null); });
    assert.ok(auth().cropPlanMigrationHold);
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'retry-owner')), null);
    localStorageMock.throwOnSetKey = null;
    await act(async () => { await auth().retryCropPlanMigration(); });
    assert.equal(auth().cropPlanMigrationHold, null);
    assert.equal(readCropPlanStorageTransferHold(makeBrowserCropPlanStorageContext()), null);
    assert.equal(accountBook('retry-owner'), guestRaw);
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), null);
  });
});

test('a retained retry from an earlier account cannot transfer or consume a later guest draft', async () => {
  await mounted(async ({ auth }) => {
    await act(async () => { assert.equal(await auth().signIn('first-owner', 'irrelevant'), null); });
    const staleRetry = auth().retryCropPlanMigration;
    localStorageMock.setItem(guestKey(LEGACY), guestRaw);
    fakeAuth.currentUser = { uid: 'next-owner' };
    await act(async () => { await staleRetry(); });
    assert.equal(localStorageMock.getItem(guestKey(LEGACY)), guestRaw);
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'first-owner')), null);
    assert.equal(localStorageMock.getItem(uidKey(CANONICAL, 'next-owner')), null);
    await act(async () => { await authListener?.(fakeAuth.currentUser); });
    assert.equal(accountBook('next-owner'), guestRaw);
  });
});
