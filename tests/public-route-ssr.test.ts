/*
 * The marketing pages must render their own content while the account is still unresolved.
 *
 * WHAT THIS IS GUARDING AGAINST, precisely. AuthProvider replaces the entire tree with a pulsing
 * dot whenever `loading` is true, and `loading` starts true and can only be cleared by a Firebase
 * observer that never runs during a server prerender. AuthProvider sits in the root layout, so on
 * 2026-08-29 every route on production served a <body> containing the holding screen and nothing
 * else — zero <h1>, zero <section>, zero <a>. Head metadata was fine, so link unfurls and basic
 * indexing worked and the gap stayed invisible; the pages that exist to be READ by strangers were
 * the ones serving them a spinner.
 *
 * A UNIT TEST OF THE PREDICATE ALONE WOULD NOT CATCH THE REGRESSION. `shouldSuspendAccountTree`
 * could be perfect and still be called, ignored, and the unfiltered holding screen rendered anyway
 * — the predicate runs, its answer is dropped, and the suite stays green. So the two tests that
 * matter here render AuthProvider for real and look at what comes out: a public route must produce
 * the CHILD, a normal route must produce the aria-busy div. The pure-function tests below them are
 * a convenience for pinning the edges, not the guard.
 *
 * The mirror of this file is tests/auth-account-transition.test.ts, which asserts the holding
 * screen is still there for the case it was written for — an A → B account switch, where the tree
 * must stay unmounted while the browser-storage namespace rotates. Both must pass. If a change
 * makes one of them go green by making the other go red, it has traded one bug for another.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

// The pathname the faked next/navigation will report. Mutable so one loaded copy of auth.tsx can
// be rendered as several different routes.
const harness = { pathname: '/' as string | null };

Object.assign(globalThis, { __imbewuPublicRouteHarness: harness });
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { sessionStorage: { getItem: () => null } },
});

const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

// Firebase configured but permanently silent: no observer ever fires, so `loading` stays true for
// the whole test. That is exactly the prerender/first-paint condition being reproduced.
const fakeFirebaseAuthModule = moduleUrl(`
export const onAuthStateChanged = () => () => {};
export const getRedirectResult = async () => null;
export const signInWithEmailAndPassword = async () => {};
export const createUserWithEmailAndPassword = async () => {};
export const signOut = async () => {};
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
export const updatePassword = async () => {};
export const reauthenticateWithCredential = async () => {};
export const signInWithPopup = async () => {};
export const signInWithRedirect = async () => {};
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({ providerId: 'password' }) };
`);

const fakeFirebaseInitModule = moduleUrl(`
export const getFirebase = () => ({ auth: { currentUser: null } });
export const isBackendConfigured = () => true;
`);

const fakeQueriesModule = moduleUrl(`
export const getMyProfile = async () => null;
export const updateMyProfile = async () => {};
`);

const fakeNavigationModule = moduleUrl(`
const harness = globalThis.__imbewuPublicRouteHarness;
export const usePathname = () => harness.pathname;
`);

const authModuleUrl = new URL('../lib/auth.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === authModuleUrl) {
      if (specifier === 'firebase/auth') return { url: fakeFirebaseAuthModule, shortCircuit: true };
      if (specifier === '@/lib/firebase/init') return { url: fakeFirebaseInitModule, shortCircuit: true };
      if (specifier === '@/lib/db/queries') return { url: fakeQueriesModule, shortCircuit: true };
      if (specifier === 'next/navigation') return { url: fakeNavigationModule, shortCircuit: true };
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

const { AuthProvider } = await import('../lib/auth.tsx');
const { isPublicMarketingRoute, shouldSuspendAccountTree, PUBLIC_MARKETING_ROUTES } =
  await import('../lib/public-routes.ts');
hooks.deregister();

const MARKER = 'the-page-content';

/** Render AuthProvider at `pathname` with the account permanently unresolved. */
async function renderAt(pathname: string | null): Promise<ReactTestRenderer> {
  harness.pathname = pathname;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(AuthProvider, null, createElement('span', null, MARKER)));
    await Promise.resolve();
  });
  return renderer;
}

function renderedJson(renderer: ReactTestRenderer) {
  const tree = renderer.toJSON();
  assert.ok(tree && !Array.isArray(tree), 'expected a single rendered root');
  return tree;
}

test('a public marketing route renders its content while the account is unresolved', async () => {
  for (const route of PUBLIC_MARKETING_ROUTES) {
    const renderer = await renderAt(route);
    const tree = renderedJson(renderer);
    assert.equal(
      tree.props['aria-busy'],
      undefined,
      `${route} must not serve the holding screen — that is the html a crawler receives`,
    );
    assert.deepEqual(
      tree.children,
      [MARKER],
      `${route} must render real page content, not a spinner`,
    );
    act(() => renderer.unmount());
  }
});

test('a normal account route still suspends — the holding screen is not weakened', async () => {
  for (const route of ['/', '/home', '/farmer', '/records', '/ngo']) {
    const renderer = await renderAt(route);
    const tree = renderedJson(renderer);
    assert.equal(
      tree.props['aria-busy'],
      'true',
      `${route} is somebody's own farm and must stay unmounted until the namespace is bound`,
    );
    act(() => renderer.unmount());
  }
});

test('an unknown pathname is treated as private, not public', async () => {
  // usePathname() returns null outside a Next router. Failing closed here is what lets
  // tests/auth-account-transition.test.ts keep asserting the holding screen unchanged.
  const renderer = await renderAt(null);
  assert.equal(renderedJson(renderer).props['aria-busy'], 'true');
  act(() => renderer.unmount());
});

test('a path that merely starts with a public route is not public', () => {
  // '/partnerships-private'.startsWith('/partners') is true — a prefix test alone would have
  // quietly enrolled it. Segment boundaries only.
  assert.equal(isPublicMarketingRoute('/partnerships-private'), false);
  assert.equal(isPublicMarketingRoute('/pitchdeck-internal'), false);
  assert.equal(isPublicMarketingRoute('/partners'), true);
  assert.equal(isPublicMarketingRoute('/partners/za'), true);
});

test('the exemption cannot fire when there is nothing to wait for', () => {
  // Two independent reasons to render children; neither may be swallowed by the route check.
  assert.equal(
    shouldSuspendAccountTree({ backendConfigured: false, loading: true, pathname: '/home' }),
    false,
    'a build with no backend has no account to resolve',
  );
  assert.equal(
    shouldSuspendAccountTree({ backendConfigured: true, loading: false, pathname: '/home' }),
    false,
    'once loading clears, every route renders alike',
  );
  assert.equal(
    shouldSuspendAccountTree({ backendConfigured: true, loading: true, pathname: '/home' }),
    true,
  );
});
