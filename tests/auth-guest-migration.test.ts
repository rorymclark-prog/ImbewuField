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

// Auth now transfers a canonical crop-book/evidence pair under Web Locks. The
// fixture supplies the real lock contract rather than bypassing that boundary.
class MemoryLocks {
  private held = new Set<string>();
  async request<T>(name: string, _options: unknown, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return await run(null);
    this.held.add(name);
    try { return await run({ name, mode: 'exclusive' }); }
    finally { this.held.delete(name); }
  }
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'auth-test', locks: new MemoryLocks() } });

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

function canonicalCropRaw(uid: string): string | null {
  const raw = localStorageMock.getItem(uidKey('imbewu_crop_plan_v2', uid));
  if (raw === null) return null;
  const book = JSON.parse(raw);
  const receipt = JSON.parse(localStorageMock.getItem(uidKey('imbewu_crop_plan_cutover_v2', uid)) ?? 'null');
  assert.equal(book.storageVersion, 2, 'the transferred book must use the current canonical schema');
  assert.equal(receipt?.canonicalKey, uidKey('imbewu_crop_plan_v2', uid), 'evidence binds the destination account');
  assert.equal(receipt?.cutoverId, book.cutoverId, 'partial or unrelated evidence is not a completed transfer');
  return book.bookRaw;
}

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

test('a successful sign-in migrates journal work and the canonical crop-book pair, and clears the transferred guest rows', async () => {
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
    canonicalCropRaw('farmer-a'),
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

// An explicit zero is an observation, not an unanswered record or an empty farm.
const productionOnlyPlan = {
  version: 1, plantings: [], updatedAt: 1,
  productionRecords: [{ id: 'observed-eggs', siteId: 'site:-28.00000,32.00000',
    sourceIconKey: 'animal:chicken-layer', label: 'Eggs', date: { year: 2027, month: 1 },
    quantity: 0, unit: 'eggs', status: 'actual', pricePerUnit: 0, provenance: 'farm-record' }],
};
const stockOnlyPlan = {
  version: 1, plantings: [], updatedAt: 1,
  preservedProducts: [{ id: 'observed-nuts', siteId: 'site:-28.00000,32.00000',
    sourceIconKey: 'tree:macadamia-integrifolia', label: 'Stored nuts', method: 'stored',
    dates: [{ year: 2027, month: 1 }], quantities: [{ year: 2027, month: 1, kg: 0 }],
    provenance: 'farm-record', note: 'Measured empty store, not an inferred harvest.' }],
};
const emptyProductionPlan = JSON.stringify({ version: 1, plantings: [], productionRecords: [], preservedProducts: [], updatedAt: 1 });

test('signing in cannot overwrite a real account’s production-only or stock-only plan even when the observed amount is zero', async () => {
  for (const [kind, plan] of [['production', productionOnlyPlan], ['stock', stockOnlyPlan]] as const) {
    localStorageMock.clear();
    const owner = `protected-${kind}-owner`;
    const realRaw = JSON.stringify(plan);
    const guestRaw = JSON.stringify({ version: 1, plantings: [{ id: 'stale-guest-crop' }], updatedAt: 2 });
    localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', owner), realRaw);
    localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
    await withSignIn(async (signIn) => { assert.equal(await signIn(owner, 'irrelevant'), null); });
    assert.equal(localStorageMock.getItem(uidKey('imbewu_crop_plan_v1', owner)), realRaw,
      `${kind} records without crop beds must survive sign-in byte for byte, including site ownership and explicit zero`);
    assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), guestRaw,
      'refusing to overwrite a real account must not consume the separate guest draft');
  }
});

test('production-only and stock-only guest work migrates into an empty account without creating plantings, quantities or repeated dates', async () => {
  for (const [kind, plan] of [['production', productionOnlyPlan], ['stock', stockOnlyPlan]] as const) {
    localStorageMock.clear();
    const owner = `new-${kind}-owner`;
    const guestRaw = JSON.stringify(plan);
    localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
    localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', owner), emptyProductionPlan);
    await withSignIn(async (signIn) => { assert.equal(await signIn(owner, 'irrelevant'), null); });
    assert.equal(canonicalCropRaw(owner), guestRaw,
      `${kind} work is real guest work even with no crop beds; migration must preserve its native units, zero and provenance`);
    assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), null,
      'a successfully transferred production or stock record must leave the shared guest namespace');
    assert.equal(localStorageMock.getItem(uidKey('imbewu_crop_plan_v1', owner)), emptyProductionPlan,
      'new clients must leave the target old-client copy untouched after canonical cutover');
  }
});

test('genuinely empty crop and record lists remain empty for migration while an empty account can still receive a guest crop plan', async () => {
  localStorageMock.clear();
  localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), emptyProductionPlan);
  await withSignIn(async (signIn) => { assert.equal(await signIn('empty-guest-owner', 'irrelevant'), null); });
  assert.equal(canonicalCropRaw('empty-guest-owner'), null,
    'an unanswered guest plan must not create an account record');

  localStorageMock.clear();
  const guestRaw = JSON.stringify({ version: 1, plantings: [{ id: 'real-guest-crop' }], updatedAt: 2 });
  localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
  localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', 'empty-account-owner'), emptyProductionPlan);
  await withSignIn(async (signIn) => { assert.equal(await signIn('empty-account-owner', 'irrelevant'), null); });
  assert.equal(canonicalCropRaw('empty-account-owner'), guestRaw,
    'explicit empty production and stock lists must not block the existing crop-plan migration');
  assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), null);
});

const emptyNursery = () => ({ version: 1, spaces: [], containers: [], profiles: [] });
// Migration preserves opaque authored rows; it is not a second profile/crop
// validator. Even incomplete or zero-valued work must survive this boundary.
const metadataOnlyPlans: Array<[string, Record<string, unknown>]> = [
  ['growing-estimate', { growerPlanningProfiles: [{ profileId: 'saved-estimate', inputs: { note: 'Still gathering measurements' } }] }],
  ['buyer-target', { harvestTargets: [{ id: 'saved-target' }] }],
  ['workspace-reference', { workspaceReferences: [{ workspaceId: 'virtual-bed', basis: 'south-african-reference', acknowledgedAt: '2026-11-03T00:00:00.000Z' }] }],
  ['plan-notes', { planNotes: [{ kind: 'gap', text: 'Missing inputs were recorded here.' }] }],
  ['nursery-space-zero', { nursery: { ...emptyNursery(), spaces: [{ id: 'saved-space', siteId: 'site:0.00000,0.00000', name: 'Recorded surface', usableM2: 0 }] } }],
  ['nursery-container', { nursery: { ...emptyNursery(), containers: [{ id: 'saved-container', siteId: 'site:0.00000,0.00000', name: 'Unmeasured container', owned: 0 }] } }],
  ['nursery-recipe', { nursery: { ...emptyNursery(), profiles: [{ id: 'saved-recipe' }] } }],
  ['nursery-source-issues', { nursery: { ...emptyNursery(), sourceIssues: ['nursery-held-inputs-unresolved'] } }],
  ['nursery-held-evidence', { nursery: { ...emptyNursery(), heldInputs: [{ collection: 'containers', reason: 'ambiguous-identities', rows: [{ id: 'conflicting-identity', name: 'First saved claim' }, { id: 'conflicting-identity', name: 'Second saved claim' }] }] } }],
  ['climate-choice', { rainPattern: 'winter' }],
  ['dated-note-metadata', { planNotesAt: 1 }],
  ['future-metadata', { futurePlannerMetadata: { note: 'Unknown does not mean disposable' } }],
];

test('sign-in preserves metadata-only account plans and leaves the unrelated guest draft available', async () => {
  for (const [kind, metadata] of metadataOnlyPlans) {
    localStorageMock.clear(); const owner = `protected-${kind}`;
    const accountRaw = JSON.stringify({ version: 1, plantings: [], updatedAt: 1, ...metadata });
    const guestRaw = '{"version":1,"plantings":[{"id":"separate-guest-crop"}],"updatedAt":2}';
    localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', owner), accountRaw);
    localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
    await withSignIn(async signIn => { assert.equal(await signIn(owner, 'irrelevant'), null); });
    assert.equal(localStorageMock.getItem(uidKey('imbewu_crop_plan_v1', owner)), accountRaw, `${kind} must remain byte-identical`);
    assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), guestRaw, `${kind} refusal cannot consume the guest copy`);
  }
});

test('metadata-only guest plans transfer byte for byte into genuinely empty accounts without inventing plantings', async () => {
  for (const [kind, metadata] of metadataOnlyPlans) {
    localStorageMock.clear(); const owner = `new-${kind}`;
    const guestRaw = JSON.stringify({ version: 1, plantings: [], updatedAt: 1, ...metadata });
    localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
    localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', owner), emptyProductionPlan);
    await withSignIn(async signIn => { assert.equal(await signIn(owner, 'irrelevant'), null); });
    assert.equal(canonicalCropRaw(owner), guestRaw, `${kind} guest metadata is authored work`);
    assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), null, `${kind} successful transfer must clear the shared guest namespace`);
  }
});

test('malformed scaffolds and unknown authored fields never provide permission to overwrite an account book', async () => {
  const damaged = [
    '', 'null', '[]', '{}', '{broken',
    JSON.stringify({ version: 99, plantings: [], updatedAt: 1 }),
    JSON.stringify({ version: 1, plantings: null, updatedAt: 1 }),
    JSON.stringify({ version: 1, plantings: [], updatedAt: null }),
    JSON.stringify({ version: 1, plantings: [], futurePlannerMetadata: [] }),
    ...['productionRecords', 'preservedProducts', 'growerPlanningProfiles', 'harvestTargets', 'workspaceReferences', 'planNotes'].map(key => JSON.stringify({ version: 1, plantings: [], [key]: {} })),
    ...[null, { version: 1 }, { ...emptyNursery(), spaces: null }, { ...emptyNursery(), sourceIssues: null },
      { ...emptyNursery(), heldInputs: {} }, { ...emptyNursery(), futureNurseryMetadata: [] }].map(nursery => JSON.stringify({ version: 1, plantings: [], nursery })),
  ];
  for (const [index, accountRaw] of damaged.entries()) {
    localStorageMock.clear(); const owner = `unresolved-${index}`;
    const guestRaw = '{"version":1,"plantings":[{"id":"separate-guest-crop"}],"updatedAt":2}';
    localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', owner), accountRaw);
    localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
    await withSignIn(async signIn => { assert.equal(await signIn(owner, 'irrelevant'), null); });
    assert.equal(localStorageMock.getItem(uidKey('imbewu_crop_plan_v1', owner)), accountRaw, `unresolved case ${index}`);
    assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), guestRaw, `unresolved case ${index} retains guest work`);
  }
});

test('recognized empty optional collections and nursery scaffolds retain the existing guest migration behavior', async () => {
  const empty = JSON.stringify({ version: 1, plantings: [], updatedAt: 1, productionRecords: [], preservedProducts: [],
    growerPlanningProfiles: [], harvestTargets: [], workspaceReferences: [], planNotes: [],
    nursery: { ...emptyNursery(), sourceIssues: [], heldInputs: [] } });
  localStorageMock.clear(); localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), empty);
  await withSignIn(async signIn => { assert.equal(await signIn('empty-metadata-guest', 'irrelevant'), null); });
  assert.equal(canonicalCropRaw('empty-metadata-guest'), null);

  localStorageMock.clear(); const guestRaw = '{"version":1,"plantings":[{"id":"legacy-guest-crop"}],"updatedAt":2}';
  localStorageMock.setItem(guestKey('imbewu_crop_plan_v1'), guestRaw);
  localStorageMock.setItem(uidKey('imbewu_crop_plan_v1', 'empty-metadata-account'), empty);
  await withSignIn(async signIn => { assert.equal(await signIn('empty-metadata-account', 'irrelevant'), null); });
  assert.equal(canonicalCropRaw('empty-metadata-account'), guestRaw);
  assert.equal(localStorageMock.getItem(guestKey('imbewu_crop_plan_v1')), null);
});
