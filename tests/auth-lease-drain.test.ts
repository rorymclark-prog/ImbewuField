import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { LeaseDrainStorage, LeaseDrainLocks } from './lease-drain-fixture.ts';

type FakeUser = { uid: string };
type Listener = (user: FakeUser | null) => void | Promise<void>;
const harness = { auth: { currentUser: null as FakeUser | null }, listener: null as Listener | null,
  credentialObserver: Promise.resolve() as Promise<void>,
  cropTransfers: [] as string[], journalTransfers: [] as string[] };
const globalKeys = ['window', 'navigator', '__imbewuAuthLeaseDrain', 'IS_REACT_ACT_ENVIRONMENT'] as const;
const originals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __imbewuAuthLeaseDrain: harness, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
const authUrl = new URL('../lib/auth.tsx', import.meta.url).href;
const cropUrl = new URL('../lib/crop-plan-storage.ts', import.meta.url).href;
const journalUrl = new URL('../lib/journal-storage.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'firebase/auth' && context.parentURL === authUrl) return data(`
      const h=globalThis.__imbewuAuthLeaseDrain;
      export const onAuthStateChanged=(_auth,listener)=>{h.listener=listener;return()=>{if(h.listener===listener)h.listener=null;}};
      export const getRedirectResult=async()=>null;
      export const signInWithEmailAndPassword=async(_auth,uid)=>{h.auth.currentUser={uid};h.credentialObserver=Promise.resolve(h.listener?.(h.auth.currentUser));return{user:h.auth.currentUser};};
      export const createUserWithEmailAndPassword=signInWithEmailAndPassword;
      export const signInWithPopup=async()=>({user:h.auth.currentUser});
      export const signOut=async()=>{};export const updateProfile=async()=>{};
      export const sendPasswordResetEmail=async()=>{};export const updatePassword=async()=>{};
      export const reauthenticateWithCredential=async()=>{};export class GoogleAuthProvider{};
      export const EmailAuthProvider={credential:()=>({})};`);
    if (specifier === '@/lib/firebase/init' || specifier === './firebase/init') return data(`
      export const getFirebase=()=>({auth:globalThis.__imbewuAuthLeaseDrain.auth});export const isBackendConfigured=()=>true;`);
    if (context.parentURL === authUrl) {
      if (specifier === '@/lib/db/queries') return data(`
        export const getMyProfile=async()=>({id:globalThis.__imbewuAuthLeaseDrain.auth.currentUser?.uid,role:'farmer',org_id:null});
        export const updateMyProfile=async()=>{throw Error('Real profile writes forbidden');};`);
      if (specifier === '@/lib/field-session') return data('export const bindFieldIdentity=()=>{};');
      if (specifier === 'next/navigation') return data("export const usePathname=()=>'/facilitator/crops';");
      if (specifier === '@/lib/public-routes') return data('export const shouldSuspendAccountTree=({loading})=>loading;');
      // Count actual transfer entry points, then delegate unchanged. With A→B→A,
      // a stale A would otherwise hide behind the same final destination key.
      if (specifier === '@/lib/crop-plan-storage') return data(`
        export * from ${JSON.stringify(cropUrl)};
        import {transferCropPlanStoragePair as transfer} from ${JSON.stringify(cropUrl)};
        export function transferCropPlanStoragePair(source,target,options){globalThis.__imbewuAuthLeaseDrain.cropTransfers.push(target.canonicalKey);return transfer(source,target,options);}`);
      if (specifier === '@/lib/journal-storage') return data(`
        export * from ${JSON.stringify(journalUrl)};
        import {transferJournalStoragePair as transfer} from ${JSON.stringify(journalUrl)};
        export function transferJournalStoragePair(source,target,options){globalThis.__imbewuAuthLeaseDrain.journalTransfers.push(target.canonicalKey);return transfer(source,target,options);}`);
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
// Both the mount and these helpers use the actual crop/journal/invoice adapters.
// In particular, invoice release is not replaced with a resolved Promise.
const { AuthProvider, useAuth } = await import('../lib/auth.tsx');
const crop = await import('../lib/crop-plan-storage.ts');
const journal = await import('../lib/journal-storage.ts');
const invoice = await import('../lib/invoice-storage.ts');
const account = await import('../lib/account-local-storage.ts');
hooks.deregister();

async function releaseAll() {
  await Promise.all([crop.releaseAllDocumentCropPlanLeases(), journal.releaseAllDocumentJournalLeases(), invoice.releaseAllDocumentInvoiceLeases()]);
}
async function setup(initialise: 'all' | 'invoice' | 'none' = 'all') {
  await releaseAll();
  const local = new LeaseDrainStorage(), session = new LeaseDrainStorage(), locks = new LeaseDrainLocks();
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks, userAgent: 'synthetic-auth-lease-drain' } });
  harness.auth.currentUser = null; harness.credentialObserver = Promise.resolve(); harness.cropTransfers = []; harness.journalTransfers = [];
  account.bindMountedAccountLocalStorageUid(null);
  let latest!: ReturnType<typeof useAuth>, renderer!: ReactTestRenderer;
  function Probe() { latest = useAuth(); return createElement('span', null, latest.user?.uid ?? 'guest'); }
  await act(async () => { renderer = create(createElement(AuthProvider, null, createElement(Probe))); });
  await act(async () => { await harness.listener?.(null); });
  assert.equal(latest.loading, false);
  if (initialise === 'all') {
    assert.equal((await crop.initialiseCropPlanStorage(crop.makeBrowserCropPlanStorageContext(), locks)).writable, true);
    assert.equal((await journal.initialiseJournalStorage(journal.makeBrowserJournalStorageContext(), locks)).writable, true);
  }
  if (initialise !== 'none') assert.equal((await invoice.initialiseInvoiceStorage(invoice.makeBrowserInvoiceStorageContext(), locks)).writable, true);
  return { local, session, locks, renderer, get latest() { return latest; },
    get accountConsumerCount() { return renderer.root.findAllByType(Probe).length; } };
}
type Harness = Awaited<ReturnType<typeof setup>>;
async function cleanup(h: Harness) {
  h.locks.open(); await act(async () => { h.renderer.unmount(); }); await releaseAll();
}
function observed(uid: string) {
  harness.auth.currentUser = { uid };
  assert.ok(harness.listener);
  return Promise.resolve(harness.listener(harness.auth.currentUser));
}
const physical = (base: string, uid: string) => account.accountLocalStorageKey(base, uid);
function assertAccountPairs(h: Harness, uid: string) {
  for (const base of [crop.CROP_PLAN_STORAGE_KEY, journal.JOURNAL_STORAGE_KEY]) assert.ok(h.local.getItem(physical(base, uid)));
}
function assertNoAccountPairs(h: Harness, uid: string) {
  for (const base of [crop.CROP_PLAN_STORAGE_KEY, crop.CROP_PLAN_CUTOVER_KEY, journal.JOURNAL_STORAGE_KEY, journal.JOURNAL_CUTOVER_KEY]) {
    assert.equal(h.local.getItem(physical(base, uid)), null);
  }
}
after(async () => {
  await releaseAll(); account.bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('actual Auth first sign-in waits for owned crop, journal and invoice manager releases without Retry', async () => {
  const h = await setup();
  try {
    assert.equal(h.accountConsumerCount, 1);
    let signing!: Promise<string | null>;
    await act(async () => { signing = h.latest.signIn('fresh-A', 'synthetic-unused'); await h.locks.releaseEntered.promise; });
    assertNoAccountPairs(h, 'fresh-A');
    // Suspended children cannot observe loading=true: their last context value
    // is deliberately stale. The actual safety rule is that they are unmounted.
    assert.equal(h.accountConsumerCount, 0, 'Account content must be withdrawn until the manager drain finishes');
    // ARIA true has the same DOM meaning whether JSX supplies a string or boolean.
    assert.ok(h.renderer.root.findAll(node => String(node.props['aria-busy']) === 'true').length > 0);
    // The credential entry point waits for migration, while the observer also
    // finishes profile loading and releases the account subtree afterward.
    await act(async () => { h.locks.open(); await signing; await harness.credentialObserver; });
    assert.equal(h.accountConsumerCount, 1);
    assert.equal(h.latest.user?.uid, 'fresh-A'); assert.equal(h.latest.cropPlanMigrationHold, null); assert.equal(h.latest.journalMigrationHold, null);
    assertAccountPairs(h, 'fresh-A'); assert.equal(harness.cropTransfers.length, 1); assert.equal(harness.journalTransfers.length, 1);
  } finally { await cleanup(h); }
});

test('actual Auth discards A during the drain and admits only current B', async () => {
  const h = await setup();
  try {
    let signing!: Promise<string | null>, observer!: Promise<void>;
    await act(async () => { signing = h.latest.signIn('obsolete-A', 'synthetic-unused'); await h.locks.releaseEntered.promise; });
    await act(async () => { observer = observed('current-B'); });
    await act(async () => { h.locks.open(); await signing; await harness.credentialObserver; await observer; });
    assert.equal(h.latest.user?.uid, 'current-B'); assert.equal(h.latest.cropPlanMigrationHold, null); assert.equal(h.latest.journalMigrationHold, null);
    assertNoAccountPairs(h, 'obsolete-A'); assertAccountPairs(h, 'current-B');
    assert.equal(harness.cropTransfers.length, 1); assert.equal(harness.journalTransfers.length, 1);
  } finally { await cleanup(h); }
});

test('actual Auth A→B→A cannot revive the first A migration while its own manager drain waits', async () => {
  const h = await setup();
  try {
    let signing!: Promise<string | null>, observerB!: Promise<void>, observerA!: Promise<void>;
    await act(async () => { signing = h.latest.signIn('same-A', 'synthetic-unused'); await h.locks.releaseEntered.promise; });
    await act(async () => { observerB = observed('intervening-B'); observerA = observed('same-A'); });
    assert.equal(harness.cropTransfers.length, 0); assert.equal(harness.journalTransfers.length, 0);
    await act(async () => { h.locks.open(); await signing; await harness.credentialObserver; await observerB; await observerA; });
    assert.equal(h.latest.user?.uid, 'same-A'); assert.equal(h.latest.loading, false);
    assert.equal(h.latest.cropPlanMigrationHold, null); assert.equal(h.latest.journalMigrationHold, null);
    assertNoAccountPairs(h, 'intervening-B'); assertAccountPairs(h, 'same-A');
    // If the obsolete A revived merely because the UID matches again, two
    // migrations would enter: that stale one and the latest observed A.
    assert.deepEqual(harness.cropTransfers, [physical(crop.CROP_PLAN_STORAGE_KEY, 'same-A')]);
    assert.deepEqual(harness.journalTransfers, [physical(journal.JOURNAL_STORAGE_KEY, 'same-A')]);
  } finally { await cleanup(h); }
});

test('actual invoice factory alone can hold the Auth drain; releasing it changes no invoice bytes', async () => {
  const h = await setup('invoice');
  try {
    const c = invoice.makeBrowserInvoiceStorageContext(); assert.ok(c);
    const proof = invoice.captureInvoiceStorageLease(c); assert.ok(proof);
    const invoiceRows = new Map([...h.local.rows].filter(([key]) => key === c.canonicalKey || key === c.receiptKey || c.legacyKeys.includes(key)));
    const invoiceWrites = h.local.writes.filter(key => invoiceRows.has(key));
    // Crop work exists, but no crop/journal lease can explain the delayed read.
    const guestLegacy = `${crop.CROP_PLAN_LEGACY_KEY}${account.ACCOUNT_LOCAL_STORAGE_OWNER_SEPARATOR}guest`;
    h.local.rows.set(guestLegacy, '{"version":1,"plantings":[null],"updatedAt":1}');
    let signing!: Promise<string | null>;
    await act(async () => { signing = h.latest.signIn('invoice-waiter', 'synthetic-unused'); await h.locks.releaseEntered.promise; });
    assert.equal(invoice.invoiceStorageLeaseMatches(proof, c), false);
    assert.equal(h.locks.held.size, 1); assertNoAccountPairs(h, 'invoice-waiter'); assert.equal(harness.cropTransfers.length, 0);
    await act(async () => { h.locks.open(); await signing; await harness.credentialObserver; });
    assert.equal(h.latest.loading, false); assert.equal(h.latest.cropPlanMigrationHold, null);
    assert.ok(h.local.getItem(physical(crop.CROP_PLAN_STORAGE_KEY, 'invoice-waiter')));
    assert.deepEqual(new Map([...h.local.rows].filter(([key]) => invoiceRows.has(key))), invoiceRows);
    assert.deepEqual(h.local.writes.filter(key => invoiceRows.has(key)), invoiceWrites);
  } finally { await cleanup(h); }
});

test('actual Auth with truly absent guest stores performs no local writes during sign-in', async () => {
  const h = await setup('none');
  try {
    h.locks.open(); const before = new Map(h.local.rows), writes = [...h.local.writes];
    await act(async () => { await h.latest.signIn('empty-account', 'synthetic-unused'); await harness.credentialObserver; });
    assert.equal(h.latest.user?.uid, 'empty-account'); assert.equal(h.latest.cropPlanMigrationHold, null); assert.equal(h.latest.journalMigrationHold, null);
    assert.deepEqual(h.local.rows, before); assert.deepEqual(h.local.writes, writes); assertNoAccountPairs(h, 'empty-account');
  } finally { await cleanup(h); }
});
