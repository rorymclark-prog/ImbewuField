import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

// Only browser/Firebase/auth delivery is substituted. Places normalization, alias
// binding, country navigation, actor/sample retirement and rendered components are real.
class MemoryStorage {
  rows = new Map<string, string>(); writes = 0; reads = 0; fail = false; onRead: (() => void) | null = null;
  getItem(key: string) { this.reads++; if (this.fail) throw Error('unavailable fixture storage'); this.onRead?.(); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, value); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const probe = { uid: 'learning-a' as string | null, loading: false, auth: new Set<(user: { uid: string } | null) => void>(),
  errors: new Set<() => void>(), placeSubscriptions: 0, placeStops: 0, cloudWrites: 0, samplePlaces: [] as unknown[] };
const original = new Map(['window', 'localStorage', 'sessionStorage', '__learningRegionProbe', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __learningRegionProbe: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const root = new URL('../', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('/firebase/init')) return data(`export const isBackendConfigured=()=>true;
      export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__learningRegionProbe.uid;return uid?{uid}:null;}}});`);
    if (specifier === 'firebase/auth' && context.parentURL?.endsWith('/lib/length-unit-preference.ts')) return data(`
      export function onAuthStateChanged(_auth,next,error){const p=globalThis.__learningRegionProbe;p.auth.add(next);p.errors.add(error);
        return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
    if (specifier === '@/lib/auth') return data(`export function useAuth(){const p=globalThis.__learningRegionProbe;
      return{user:p.uid?{uid:p.uid}:null,loading:p.loading};}`);
    if (specifier === './sample-mode' || specifier === '@/lib/sample-mode') return data(`
      export const isSampleMode=()=>window.sessionStorage.getItem('imbewu_sample_mode')==='1';
      export const getSandboxPlaces=()=>globalThis.__learningRegionProbe.samplePlaces;
      export function upsertSandboxPlace(){globalThis.__learningRegionProbe.cloudWrites++;throw Error('unexpected write');}
      export const deleteSandboxPlace=upsertSandboxPlace;`);
    if ((specifier === './user-sync' && context.parentURL?.endsWith('/lib/saved-places.ts'))
      || (specifier === '@/lib/user-sync' && context.parentURL?.endsWith('/SavedSiteUpdates.tsx'))) return data(`
      export function upsertPlace(){globalThis.__learningRegionProbe.cloudWrites++;throw Error('unexpected write');}
      export const removePlace=upsertPlace,mergePlaces=upsertPlace,upsertPlaceContextResult=upsertPlace;
      export const DEFINITIVE_CONTEXT_REJECTIONS=[];
      export function subscribeUserPlaces(){const p=globalThis.__learningRegionProbe;p.placeSubscriptions++;return()=>p.placeStops++;}`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Context, LearningRegionNotice } = await import('../components/studies/LearningRegionNotice.tsx');
const { SavedSiteUpdatesProvider } = await import('../components/international/countries/SavedSiteUpdates.tsx');
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
const { createSiteCountryContext, bindSiteContext, coordinateSiteIdForPlace, resolveSiteCountryContext } = await import('../lib/international/site-context.ts');
const { evaluateCountryReadiness } = await import('../lib/international/countries/readiness.ts');
import type { SavedPlace } from '../lib/saved-places.ts';
import type { CountryProfile } from '../lib/international/countries/types.ts';

let browser: EventTarget;
const mounted = new Set<ReactTestRenderer>(), cleanup: Array<() => void> = [];
const stamp = '2026-11-07T00:00:00.000Z';
function place(id = 'place-a', country: string | null = 'ZA', lat = 1, region: string | null = null): SavedPlace {
  const row: SavedPlace = { id, name: 'Private site ' + id, lat, lon: 2, savedAt: stamp, biome: 'fixture', rainfall: 0, elevation: 0 };
  if (country) {
    const context = createSiteCountryContext({ siteId: coordinateSiteIdForPlace(row)!, countryCode: country,
      agriculturalRegionReference: region, confirmed: true }, stamp)!;
    row.siteCountryContext = bindSiteContext(context, row)!;
  }
  return row;
}
function store(rows: SavedPlace[], uid = probe.uid) {
  local.rows.set(account.accountLocalStorageKey('permamap_saved_places', uid), JSON.stringify(rows));
}
function actor(uid: string | null, mountedUid = uid) {
  probe.uid = uid; account.bindMountedAccountLocalStorageUid(mountedUid);
  for (const next of [...probe.auth]) if (probe.auth.has(next)) next(uid ? { uid } : null);
}
function sample(enabled: boolean) {
  if (enabled) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  browser.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
function content(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => content(child as ReactTestInstance | string)).join('');
}
function mount(scope: 'core-farming' | 'design-preview' | 'finance-preview' = 'core-farming', shared = false) {
  let renderer!: ReactTestRenderer;
  const element = () => shared ? React.createElement(SavedSiteUpdatesProvider, { children: React.createElement(Context, { scope }) }) : React.createElement(Context, { scope });
  act(() => { renderer = create(element()); }); mounted.add(renderer);
  return {
    renderer, text: () => content(renderer.root), select: () => renderer.root.findByType('select'),
    choose(value: unknown) { act(() => renderer.root.findByType('select').props.onChange({ target: { value } })); },
    render() { act(() => renderer.update(element())); },
    event(name = 'permamap-places-changed') { act(() => browser.dispatchEvent(new Event(name))); },
    unmount() { act(() => renderer.unmount()); mounted.delete(renderer); },
  };
}
beforeEach(() => {
  probe.uid = 'learning-a'; probe.loading = false; probe.samplePlaces = []; probe.placeSubscriptions = 0; probe.placeStops = 0; probe.cloudWrites = 0;
  account.bindMountedAccountLocalStorageUid(probe.uid);
  for (const storage of [local, session]) { storage.rows.clear(); storage.writes = 0; storage.reads = 0; storage.fail = false; storage.onRead = null; }
  browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.assign(globalThis, { window: browser, localStorage: local, sessionStorage: session });
});
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  for (const stop of cleanup.splice(0).reverse()) stop();
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
  assert.equal(local.writes, 0, 'presentation never writes account storage');
  assert.equal(session.writes, 0, 'selection never writes a session preference');
  assert.equal(probe.cloudWrites, 0, 'presentation never saves context or course state');
});
after(() => {
  hooks.deregister(); account.bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('saved sites are offered without borrowing a main, profile or language choice; selection is local and explicit', () => {
  const row = place(); store([row]); local.rows.set(account.accountLocalStorageKey('permamap_main_place', probe.uid), row.id);
  const ui = mount(); assert.equal(ui.select().props.value, ''); assert.match(ui.text(), /No site selected/);
  assert.doesNotMatch(ui.text(), /Saved site country/); assert.match(ui.text(), /South African source/);
  ui.choose(coordinateSiteIdForPlace(row)); assert.match(ui.text(), /Saved site country: ZA/);
  assert.match(ui.text(), /Agricultural region: Unknown/); assert.match(ui.text(), /not been assessed here/);
  ui.unmount(); const next = mount(); assert.equal(next.select().props.value, '');
});

test('confirmed foreign country, free-text region and unsupported dossier never grant curriculum approval or choose a substitute', () => {
  const row = place('foreign', 'ZZ', 3, 'grower free text'); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  assert.match(ui.text(), /country: ZZ/); assert.match(ui.text(), /grower free text/); assert.match(ui.text(), /grower’s description/);
  assert.match(ui.text(), /No country reference dossier is listed/); assert.doesNotMatch(ui.text(), /country: ZA|country: KE/);
  assert.match(ui.text(), /not been assessed here/); assert.equal(ui.renderer.root.findByType('a').props.href, '/international?country=ZZ');
});

test('aliases are one explicit option and conflicting or unbound descriptions stay unresolved', () => {
  const a = place(), b = place('alias', 'KE'); store([a, b]); const ui = mount();
  assert.equal(ui.renderer.root.findAllByType('option').length, 2); ui.choose(coordinateSiteIdForPlace(a));
  assert.match(ui.text(), /Saved details for this site disagree/); assert.doesNotMatch(ui.text(), /Saved site country/);
  store([a, { ...place('alias'), siteCountryContext: { ...place('alias').siteCountryContext!, base: undefined } }]); ui.event();
  assert.match(ui.text(), /Saved details for this site disagree/);
});

test('legacy unknown country stays unknown without blocking the readable course or inventing South African destination', () => {
  const row = place('unknown', null); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  assert.match(ui.text(), /country has not been confirmed/); assert.equal(ui.renderer.root.findAllByType('button').length, 0, 'context does not introduce a course access gate');
  assert.doesNotMatch(ui.text(), /Saved site country/); assert.equal(ui.renderer.root.findAllByType('a').length, 0);
});

test('source edits update the selected description, while a moved or deleted alias never rebinds by its name', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  store([place(row.id, 'KE', 1, 'own region')]); ui.event(); assert.match(ui.text(), /country: KE/); assert.match(ui.text(), /own region/);
  const moved = place(row.id, 'US', 5); store([moved]); ui.event();
  assert.match(ui.text(), /has moved or is no longer available/); assert.doesNotMatch(ui.text(), /country: US/);
  assert.equal(ui.select().props.value, coordinateSiteIdForPlace(row)); ui.choose(coordinateSiteIdForPlace(moved)); assert.match(ui.text(), /country: US/);
  store([]); ui.event(); assert.match(ui.text(), /no longer available/);
});

test('editing a saved place without rebinding its confirmation withdraws its old country', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  store([{ ...row, updatedAt: 42 }]); ui.event(); assert.match(ui.text(), /country has not been confirmed/);
  assert.doesNotMatch(ui.text(), /Saved site country/);
});

test('account A to B to A retires selection permanently and never reveals another owner’s labels', () => {
  const a = place('owner-a'), b = place('owner-b', 'KE', 3); store([a]); store([b], 'learning-b');
  const ui = mount(); ui.choose(coordinateSiteIdForPlace(a)); const old = ui.select().props.onChange;
  act(() => actor('learning-b')); ui.render(); assert.doesNotMatch(ui.text(), /Private site owner-a/); assert.equal(ui.select().props.value, '');
  const reads = local.reads; act(() => old({ target: { value: coordinateSiteIdForPlace(b) } })); assert.equal(local.reads, reads);
  act(() => actor('learning-a')); ui.render(); assert.equal(ui.select().props.value, ''); assert.doesNotMatch(ui.text(), /Private site owner-b/);
});

test('a live Firebase mismatch hides private options on render even before the mounted owner and auth observer catch up', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  probe.uid = 'learning-b'; ui.render(); assert.doesNotMatch(ui.text(), /Private site place-a|country: ZA/); assert.equal(ui.select().props.disabled, true);
});

test('sample entry and return clear the live selection and keep DEMO labels separate', () => {
  const row = place(), demo = place('demo-only', 'KE', 4); store([row]); probe.samplePlaces = [demo];
  const ui = mount(); ui.choose(coordinateSiteIdForPlace(row)); act(() => sample(true));
  assert.equal(ui.select().props.value, ''); assert.match(ui.text(), /DEMO/); assert.doesNotMatch(ui.text(), /Private site place-a/);
  ui.choose(coordinateSiteIdForPlace(demo)); assert.match(ui.text(), /country: KE/); act(() => sample(false));
  assert.equal(ui.select().props.value, ''); assert.doesNotMatch(ui.text(), /DEMO|Private site demo-only|country: KE/);
});

test('sample on-off ABA in one React batch cannot revive a retained real-site handler', () => {
  const row = place(); store([row]); const ui = mount(), old = ui.select().props.onChange;
  act(() => { sample(true); sample(false); }); assert.equal(ui.select().props.value, '');
  const reads = local.reads; act(() => old({ target: { value: coordinateSiteIdForPlace(row) } })); assert.equal(local.reads, reads);
});

test('a superseded render handler does not even inspect its retained event or read saved places', () => {
  const row = place(); store([row]); const ui = mount(), old = ui.select().props.onChange; ui.render();
  let inspected = 0; const reads = local.reads;
  act(() => old({ get target() { inspected++; throw Error('stale event inspected'); } }));
  assert.equal(inspected, 0); assert.equal(local.reads, reads); assert.equal(ui.select().props.value, '');
});

test('an account change during the places read cannot publish the old owner’s selected source', () => {
  const row = place(); store([row]); const ui = mount(); let changed = false;
  local.onRead = () => { if (!changed) { changed = true; actor('learning-b'); } };
  ui.choose(coordinateSiteIdForPlace(row)); local.onRead = null;
  assert.doesNotMatch(ui.text(), /Private site place-a|country: ZA/); assert.equal(ui.select().props.value, '');
});

test('a rerender during the places read cannot let the superseded selector continuation commit', () => {
  const row = place(); store([row]); const ui = mount(), retained = ui.select().props.onChange; let changed = false;
  local.onRead = () => { if (!changed) { changed = true; ui.render(); } };
  retained({ target: { value: coordinateSiteIdForPlace(row) } }); local.onRead = null;
  assert.equal(ui.select().props.value, ''); assert.doesNotMatch(ui.text(), /Saved site country/);
});

test('unreadable saved places are disclosed without asserting that the grower owns no sites', () => {
  local.fail = true; const ui = mount(); assert.match(ui.text(), /No readable saved sites are available/);
  assert.doesNotMatch(ui.text(), /Saved site country/); assert.equal(ui.select().props.value, '');
});

test('auth observer failure withdraws private labels without a fallback destination', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  act(() => { for (const fail of [...probe.errors]) fail(); });
  assert.doesNotMatch(ui.text(), /Private site place-a|country: ZA/); assert.equal(ui.select().props.value, '');
  assert.equal(ui.select().props.disabled, true);
  act(() => ui.renderer.root.findByType('button').props.onClick());
  assert.equal(ui.select().props.disabled, false); assert.equal(ui.select().props.value, '');
  assert.doesNotMatch(ui.text(), /Saved site country/);
});

test('the mounted context uses the existing provider’s one places subscription and releases it normally', () => {
  store([place()]); const ui = mount('core-farming', true); assert.equal(probe.placeSubscriptions, 1);
  ui.choose(coordinateSiteIdForPlace(place())); ui.event(); assert.equal(probe.placeSubscriptions, 1);
  ui.unmount(); assert.equal(probe.placeStops, 1); assert.equal(probe.auth.size, 0);
});

test('unmount makes retained selectors inert, removes refresh listeners, and preserves another purpose’s live proof', () => {
  const row = place(); store([row]); const anchor = prefs.captureLengthUnitPreferenceContext(); assert.ok(anchor);
  cleanup.push(() => prefs.revokeLengthUnitPreferenceContext(anchor));
  const ui = mount(), old = ui.select().props.onChange; ui.unmount(); const reads = local.reads;
  old({ target: { value: coordinateSiteIdForPlace(row) } }); browser.dispatchEvent(new Event('permamap-places-changed'));
  assert.equal(local.reads, reads); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(anchor), true);
  assert.equal(probe.auth.size, 1, 'the shared observer remains only for the unrelated proof');
});

test('learning receipts reject structural forgeries and cross-purpose reads, writes, subscriptions and revocation', () => {
  const learning = prefs.captureLearningSiteContext(), unit = prefs.captureLengthUnitPreferenceContext(); assert.ok(learning); assert.ok(unit);
  cleanup.push(() => prefs.revokeLearningSiteContext(learning), () => prefs.revokeLengthUnitPreferenceContext(unit));
  assert.ok(Object.isFrozen(learning)); assert.deepEqual(learning, { kind: 'learning-site-context' });
  assert.equal(prefs.learningSiteContextIsCurrent({ kind: 'learning-site-context' }), false);
  assert.equal(prefs.learningSiteContextIsCurrent(unit as unknown as typeof learning), false);
  assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(learning as unknown as typeof unit), false);
  const reads = local.reads;
  assert.deepEqual(prefs.readLengthUnitPreference(learning as unknown as typeof unit), { unit: 'm', remembered: false, destination: 'unavailable' });
  assert.deepEqual(prefs.writeLengthUnitPreference(learning as unknown as typeof unit, 'ft'), { remembered: false, destination: 'unavailable' });
  for (const read of [prefs.readNurseryUnitPreference, prefs.readHarvestMassUnitPreference, prefs.readGrowerEstimateUnitPreference]) {
    assert.equal(read(learning as never).destination, 'unavailable');
  }
  assert.equal(prefs.writeNurseryUnitPreference(learning as never, 'imperial').destination, 'unavailable');
  assert.equal(prefs.writeHarvestMassUnitPreference(learning as never, 'lb').destination, 'unavailable');
  assert.equal(prefs.writeGrowerEstimateUnitPreference(learning as never, 'imperial').destination, 'unavailable');
  assert.equal(local.reads, reads); let notified = 0;
  prefs.subscribeLearningSiteContext(unit as unknown as typeof learning, () => { notified++; });
  prefs.revokeLearningSiteContext(unit as unknown as typeof learning); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(unit), true);
  prefs.revokeLearningSiteContext(learning); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(unit), true);
  actor('learning-b'); assert.equal(notified, 0, 'a cross-purpose subscription must remain inert even when the shared epoch changes');
});

test('core provenance is independent of interface language and previews retain their distinct source scope', () => {
  const base = { destination: { status: 'unselected' as const } };
  for (const language of ['en', 'zu', 'st', 'ts', 've']) {
    const markup = renderToString(React.createElement('div', { lang: language }, React.createElement(LearningRegionNotice, { ...base, scope: 'core-farming' })));
    assert.match(markup, /South African source material/); assert.doesNotMatch(markup, /Saved site country/);
  }
  const finance = renderToString(React.createElement(LearningRegionNotice, { ...base, scope: 'finance-preview' }));
  assert.match(finance, /Classroom examples/); assert.doesNotMatch(finance, /South African source/);
  const design = renderToString(React.createElement(LearningRegionNotice, { ...base, scope: 'design-preview' })); assert.match(design, /Southern African and other teaching sources/);
});

test('server markup and first client render do not read private storage or infer a sample destination', () => {
  session.rows.set('imbewu_sample_mode', '1'); probe.samplePlaces = [place('ssr-demo')]; const reads = local.reads + session.reads;
  const server = renderToString(React.createElement(Context, { scope: 'core-farming' }));
  assert.equal(local.reads + session.reads, reads); assert.doesNotMatch(server, /ssr-demo|DEMO/);
  assert.match(server, /No site selected/); assert.match(server, /English source/);
  let renderer!: ReactTestRenderer; const commits: unknown[] = [];
  act(() => { renderer = create(React.createElement(React.Profiler, { id: 'first-paint', onRender: () => commits.push(renderer.toJSON()) }, React.createElement(Context, { scope: 'core-farming' }))); });
  mounted.add(renderer);
  assert.ok(commits.length >= 2, 'the fixture observes first commit and the subsequent mounted delivery');
  assert.doesNotMatch(JSON.stringify(commits[0]), /ssr-demo|DEMO/);
  assert.match(JSON.stringify(commits[0]), /No site selected/);
  assert.equal(renderer.root.findByType('select').props.value, ''); assert.match(content(renderer.root), /DEMO/);
});

test('even fully reviewed country evidence cannot turn a grower’s region text into curriculum approval', () => {
  const categories = ['biodiversity', 'agricultural-extension', 'weather-frost', 'soils', 'plant-legality'] as const;
  const profile: CountryProfile = { code: 'ZZ', name: 'Engineering fixture', stage: 'engineering-pilot', jurisdictionNote: 'Fixture only',
    regions: [{ id: 'reviewed-id', name: 'Fixture region', definitionSourceId: 's0', status: 'reviewed' }],
    sources: categories.map((category, i) => ({ id: 's' + i, category, authority: 'Fixture', title: 'Fixture', url: 'https://example.invalid',
      coverage: 'Fixture', resolution: { status: 'unknown', reason: 'Fixture' }, units: { status: 'unknown', reason: 'Fixture' }, updateCadence: { status: 'unknown', reason: 'Fixture' }, licence: { status: 'unknown', reason: 'Fixture' }, attribution: 'Fixture', accessRequirements: { status: 'unknown', reason: 'Fixture' }, missingDataBehavior: 'Fixture', verification: 'content-read', accessedOn: '2026-11-01', publishedOn: '2026-11-01', reviewDueOn: null, verifiedClaim: 'Engineering fixture only', limitations: 'No farming guidance' })),
    agronomyReview: { status: 'reviewed', regionId: 'reviewed-id', reviewedOn: '2026-11-01', validThrough: '2026-12-01', sourceIds: categories.map((_, i) => 's' + i), reviewer: 'Engineering fixture' } };
  assert.equal(evaluateCountryReadiness({ countryCode: 'ZZ', agriculturalRegionId: 'reviewed-id' }, '2026-11-07', [profile]).status, 'reviewed-evidence-only');
  const row = place('reviewed-text', 'ZZ', 6, 'reviewed-id'); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  assert.match(ui.text(), /not been assessed here/); assert.match(ui.text(), /grower’s description/); assert.match(ui.text(), /country evidence or a translation cannot establish it/);
  const resolution = resolveSiteCountryContext([row], coordinateSiteIdForPlace(row)); assert.equal(resolution.context?.agriculturalRegionReference, 'reviewed-id');
});


test('an otherwise current selector withdraws private labels on live Firebase mismatch before any places read', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row));
  const retained = ui.select().props.onChange, reads = local.reads; probe.uid = 'learning-b';
  act(() => retained({ target: { value: '' } }));
  assert.equal(local.reads, reads); assert.doesNotMatch(ui.text(), /Private site place-a|country: ZA/);
  assert.equal(ui.select().props.disabled, true);
});

test('a source refresh cannot overwrite a newer explicit selection made while its places read was in progress', () => {
  const row = place(); store([row]); const ui = mount(); ui.choose(coordinateSiteIdForPlace(row)); let intervened = false;
  store([place(row.id, 'KE')]);
  local.onRead = () => { if (!intervened) { intervened = true; ui.choose(''); } };
  browser.dispatchEvent(new Event('permamap-places-changed')); local.onRead = null;
  assert.equal(intervened, true); assert.equal(ui.select().props.value, '');
  assert.doesNotMatch(ui.text(), /Saved site country/);
});

test('account loading keeps choices unavailable, and damaged current events cannot read or select a destination', () => {
  store([place()]); probe.loading = true; const ui = mount(); assert.equal(ui.select().props.disabled, true); assert.equal(local.reads, 0);
  probe.loading = false; ui.render(); assert.equal(ui.select().props.disabled, false);
  const reads = local.reads; ui.choose({ toString() { throw Error('must not coerce'); } }); assert.equal(local.reads, reads);
  assert.equal(ui.select().props.value, '');
});
