import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import {
  createElement,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

type FakeUser = {
  uid: string;
  displayName: string;
  email: string;
  providerData: Array<{ providerId: string }>;
};

type FakeProfile = {
  id: string;
  full_name: string;
  role: 'farmer';
  org_id: null;
  language: 'en';
  id_number: null;
  phone: null;
  photo_url: null;
  created_at: string;
};

type AuthListener = (user: FakeUser | null) => void | Promise<void>;

interface PendingProfile {
  uid: string;
  resolve: (profile: FakeProfile | null) => void;
}

const fakeAuth: { currentUser: FakeUser | null } = { currentUser: null };
let authListener: AuthListener | null = null;
const pendingProfiles: PendingProfile[] = [];

const harness = {
  firebase: { auth: fakeAuth },
  installAuthListener(listener: AuthListener) {
    authListener = listener;
    return () => {
      if (authListener === listener) authListener = null;
    };
  },
  getMyProfile() {
    const uid = fakeAuth.currentUser?.uid ?? 'signed-out';
    return new Promise<FakeProfile | null>((resolve) => {
      pendingProfiles.push({ uid, resolve });
    });
  },
};

Object.assign(globalThis, {
  __imbewuAuthTransitionHarness: harness,
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    sessionStorage: {
      getItem: () => null,
    },
  },
});

const moduleUrl = (source: string) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

const fakeFirebaseAuthModule = moduleUrl(`
const harness = globalThis.__imbewuAuthTransitionHarness;

export const onAuthStateChanged = (_auth, listener) =>
  harness.installAuthListener(listener);
export const getRedirectResult = async () => null;
export const signInWithEmailAndPassword = async () => {
  throw new Error('not used by this test');
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
export const EmailAuthProvider = {
  credential: () => ({ providerId: 'password' }),
};
`);

const fakeFirebaseInitModule = moduleUrl(`
const harness = globalThis.__imbewuAuthTransitionHarness;
export const getFirebase = () => harness.firebase;
export const isBackendConfigured = () => true;
`);

const fakeQueriesModule = moduleUrl(`
const harness = globalThis.__imbewuAuthTransitionHarness;
export const getMyProfile = () => harness.getMyProfile();
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
      return {
        format: 'module',
        source: transpiled.outputText,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { AuthProvider, useAuth } = await import('../lib/auth.tsx');
const { activeAccountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

const userA: FakeUser = {
  uid: 'farmer-a',
  displayName: 'Farmer A',
  email: 'a@example.test',
  providerData: [{ providerId: 'password' }],
};
const userB: FakeUser = {
  uid: 'farmer-b',
  displayName: 'Farmer B',
  email: 'b@example.test',
  providerData: [{ providerId: 'password' }],
};

const profileFor = (user: FakeUser): FakeProfile => ({
  id: user.uid,
  full_name: user.displayName,
  role: 'farmer',
  org_id: null,
  language: 'en',
  id_number: null,
  phone: null,
  photo_url: null,
  created_at: '2026-07-30T00:00:00.000Z',
});

function takePendingProfile(uid: string): PendingProfile {
  const index = pendingProfiles.findIndex((request) => request.uid === uid);
  assert.notEqual(index, -1, `expected a pending profile request for ${uid}`);
  return pendingProfiles.splice(index, 1)[0];
}

async function emitAuthUser(user: FakeUser | null): Promise<void> {
  assert.ok(authListener, 'AuthProvider should subscribe to Firebase Auth');
  fakeAuth.currentUser = user;
  await act(async () => {
    void authListener?.(user);
    await Promise.resolve();
  });
}

async function resolveProfile(
  request: PendingProfile,
  profile: FakeProfile | null,
): Promise<void> {
  await act(async () => {
    request.resolve(profile);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderedText(renderer: ReactTestRenderer): string | null {
  const json = renderer.toJSON();
  if (!json || Array.isArray(json)) return null;
  return Array.isArray(json.children) ? json.children.join('') : null;
}

test('a direct A to B switch unmounts account state and rejects a delayed A profile', async () => {
  const lifecycle: string[] = [];
  let nextInstance = 0;
  let latestAuth: ReturnType<typeof useAuth> | null = null;
  let setLocalMarker: Dispatch<SetStateAction<string>> | null = null;

  function AccountProbe() {
    const auth = useAuth();
    const [instance] = useState(() => ++nextInstance);
    const [localMarker, setMarker] = useState('fresh');
    latestAuth = auth;
    setLocalMarker = setMarker;

    useEffect(() => {
      const mountedUid = auth.user?.uid ?? 'signed-out';
      lifecycle.push(`mount:${mountedUid}:${instance}`);
      return () => {
        lifecycle.push(`unmount:${mountedUid}:${instance}`);
      };
    }, []);

    return createElement(
      'span',
      null,
      `${auth.user?.uid ?? 'none'}|${auth.profile?.full_name ?? 'no-profile'}|${instance}|${localMarker}`,
    );
  }

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(
      AuthProvider,
      null,
      createElement(AccountProbe),
    ));
    await Promise.resolve();
  });
  assert.equal(renderer.toJSON(), null, 'account children stay suspended until the first profile is ready');

  await emitAuthUser(userA);
  assert.equal(renderer.toJSON(), null, 'A must not mount while A profile loading is pending');
  await resolveProfile(takePendingProfile(userA.uid), profileFor(userA));
  assert.equal(renderedText(renderer), 'farmer-a|Farmer A|1|fresh');
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:farmer-a',
  );

  act(() => setLocalMarker?.('A-only-state'));
  assert.equal(renderedText(renderer), 'farmer-a|Farmer A|1|A-only-state');

  assert.ok(latestAuth);
  let staleRefresh: Promise<void> | null = null;
  act(() => {
    staleRefresh = latestAuth?.refreshProfile() ?? null;
  });
  const delayedAProfile = takePendingProfile(userA.uid);

  // Firebase changes currentUser before it delivers its observer. Hold that
  // delivery deliberately: any last callback from A must still resolve A's key,
  // never B's, during this otherwise invisible timing window.
  fakeAuth.currentUser = userB;
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:farmer-a',
  );

  await emitAuthUser(userB);
  assert.equal(
    renderer.toJSON(),
    null,
    'the A subtree must be gone for the entire interval in which B profile loading is pending',
  );
  assert.deepEqual(lifecycle, [
    'mount:farmer-a:1',
    'unmount:farmer-a:1',
  ]);
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:farmer-a',
    'the namespace rotates only after the old account subtree is unmounted',
  );

  await resolveProfile(takePendingProfile(userB.uid), profileFor(userB));
  assert.equal(
    renderedText(renderer),
    'farmer-b|Farmer B|2|fresh',
    'B must mount as a fresh subtree rather than inherit A component state',
  );
  assert.equal(
    activeAccountLocalStorageKey('farmer-data'),
    'farmer-data::imbewu-owner::uid:farmer-b',
  );

  await resolveProfile(delayedAProfile, {
    ...profileFor(userA),
    full_name: 'STALE FARMER A',
  });
  await staleRefresh;
  assert.equal(
    renderedText(renderer),
    'farmer-b|Farmer B|2|fresh',
    'an A request completing after B mounts must not replace B profile state',
  );
  act(() => renderer.unmount());
  assert.deepEqual(lifecycle, [
    'mount:farmer-a:1',
    'unmount:farmer-a:1',
    'mount:farmer-b:2',
    'unmount:farmer-b:2',
  ]);
});
