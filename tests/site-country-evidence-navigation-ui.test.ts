import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { bindSiteContext, createSiteCountryContext, resolveSiteCountryContext, type SiteContextPlace, type SiteContextResolution } from '../lib/international/site-context.ts';
import { COUNTRY_PROFILES } from '../lib/international/countries/registry.ts';
import { evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';
import type { CountrySource } from '../lib/international/countries/types.ts';
import { COUNTRY_CLIMATE_DEMOS, NASA_REFERENCE_PROVIDER, type ClimateReferenceResult } from '../lib/international/providers/nasa-reference.ts';
import type { CountryReviewProps } from '../components/international/countries/CountryReview.tsx';

const countryUrl = new URL('../components/international/countries/CountryReview.tsx', import.meta.url).href;
const savedUrl = new URL('../components/international/countries/SiteCountryPanel.tsx', import.meta.url).href;
const pageUrl = new URL('../app/international/page.tsx', import.meta.url).href;
const nasaUrl = new URL('../lib/international/providers/nasa-reference.ts', import.meta.url).href;
const key = '__siteCountryEvidenceNavigationUi';
const original = new Map([key, 'IS_REACT_ACT_ENVIRONMENT'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const probe = { calls: [] as string[], saves: 0, backRegistrations: 0, replayEffects: false, effectCleanups: 0,
  next: ((_code: string) => Promise.resolve(reference('current synthetic public reference'))) as (code: string) => Promise<ClimateReferenceResult> };
Object.assign(globalThis, { [key]: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const widgetImports = { './NwsForecastReference': 'US', './CountyBulletinReference': 'KE', './EaRainfallReference': 'GB', './InmetAlertLinks': 'BR', './BmkgResearchLinks': 'research-queue', './DwdStationReference': 'DWD-forecast', './DwdStationCatalogSearch': 'DWD-catalog' };
// Run the real page/components, navigation helper, registry and readiness. Only
// framework affordances, existing child widgets, provider transport and the
// external saved-place write sink are isolated; no production store is touched.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([countryUrl, savedUrl].includes(context.parentURL ?? '') && specifier === 'next/link') return data(`
    import React from ${JSON.stringify(new URL('../node_modules/react/index.js', import.meta.url).href)};
    export default function Link({children,...props}){return React.createElement('a',props,children);}`);
  if (context.parentURL === countryUrl) {
    // This renderer omits React DOM's development effect replay. Exercise the
    // real component's setup/cleanup/setup without replacing its state or refs.
    if (specifier === 'react') return data(`
      import React from ${JSON.stringify(new URL('../node_modules/react/index.js', import.meta.url).href)};
      export * from ${JSON.stringify(new URL('../node_modules/react/index.js', import.meta.url).href)};
      export function useEffect(setup,deps){return React.useEffect(()=>{
        const cleanup=setup();const p=globalThis.${key};
        if(!p.replayEffects)return cleanup;
        cleanup?.();p.effectCleanups++;return setup();
      },deps);}`);
    if (specifier === '@/components/MenuButton') return data('export default function MenuButton(){return null;}');
    if (specifier === '@/components/BackControl') return data(`export function useRegisterBackControl(){globalThis.${key}.backRegistrations++;}`);
    if (specifier === './CountryReview.module.css') return data('export default {};');
    // DWD's station tools are global references, not the selected country's
    // local provider. Keep that distinction in this dossier-navigation probe.
    if (Object.hasOwn(widgetImports, specifier)) return data(`
      import React from ${JSON.stringify(new URL('../node_modules/react/index.js', import.meta.url).href)};
      export default function Widget(){return React.createElement('section',{${JSON.stringify(specifier.startsWith('./Dwd') ? 'data-global-reference-widget' : 'data-navigation-widget')}:${JSON.stringify(widgetImports[specifier as keyof typeof widgetImports])}},'Existing provider boundary');}`);
    if (specifier === '@/lib/international/providers/nasa-reference') return data(`
      export * from ${JSON.stringify(nasaUrl)};
      export function fetchCountryClimateReference(code){const p=globalThis.${key};p.calls.push(code);return p.next(code);}`);
  }
  if (context.parentURL === savedUrl && specifier === '@/lib/saved-places') return data(`
    export function updateSiteCountryContext(){globalThis.${key}.saves++;throw Error('Navigation must not write saved country data');}`);
  // This suite owns the saved-country link, while the point consumer exercises
  // its real account/store/request lifecycle in its separate component suite.
  if (context.parentURL === savedUrl && specifier === './SavedSiteNwsReference') return data('export default function SavedSiteNwsReference(){return null;}');
  return next(specifier, context);
}, load(url, context, next) {
  if ([countryUrl, savedUrl, pageUrl].includes(url)) return { shortCircuit: true, format: 'module',
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: CountryReviewModule, CountryEvidenceDetails } = await import('../components/international/countries/CountryReview.tsx');
const CountryReview: React.ComponentType<CountryReviewProps> = CountryReviewModule;
const { default: SiteCountryPanel } = await import('../components/international/countries/SiteCountryPanel.tsx');
const { default: InternationalReviewPage, metadata } = await import('../app/international/page.tsx');
const mounted = new Set<ReactTestRenderer>();
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function reference(label: string): Extract<ClimateReferenceResult, { status: 'available' | 'partial' }> {
  return { status: 'available', units: 'C', monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, state: 'value' as const, valueC: 0 })),
    period: { start: '2001-01', end: '2002-12', description: label },
    dataset: { apiVersion: 'synthetic', sources: ['Synthetic public reference source'], timeStandard: 'UTC' },
    provenance: { providerId: NASA_REFERENCE_PROVIDER.id, attribution: 'Synthetic public reference attribution',
      fetchedAt: '2026-11-06T12:00:00.000Z', endpoint: null, demoPlace: 'Synthetic public coarse point', referenceOnly: true } };
}
function deferred() {
  let resolve!: (value: ClimateReferenceResult) => void;
  const promise = new Promise<ClimateReferenceResult>(yes => { resolve = yes; }); return { promise, resolve };
}
function mount(hint?: unknown) {
  let renderer!: ReactTestRenderer;
  const commits: Array<{ code: unknown; region: unknown; widgets: unknown[]; visible: string }> = [];
  const element = (countryHint?: unknown) => React.createElement(React.Profiler, { id: 'country-evidence', onRender() {
    if (!renderer) return;
    commits.push({ code: renderer.root.findByType('select').props.value,
      region: renderer.root.findAllByType('input')[0]?.props.value,
      widgets: renderer.root.findAll(node => node.props['data-navigation-widget'] !== undefined).map(node => node.props['data-navigation-widget']),
      visible: text(renderer.root) });
  } }, React.createElement(CountryReview, { countryHint }));
  act(() => { renderer = create(element(hint)); }); mounted.add(renderer);
  const button = () => renderer.root.findAllByType('button').find(node => /Check public reference|Checking public reference/.test(text(node)))!;
  return { renderer, commits, button, text: () => text(renderer.root), select: () => renderer.root.findByType('select'),
    region: () => renderer.root.findAllByType('input')[0],
    update(countryHint?: unknown) { act(() => renderer.update(element(countryHint))); },
    change(code: string) { act(() => renderer.root.findByType('select').props.onChange({ target: { value: code } })); },
    async click() { await act(async () => { button().props.onClick(); await Promise.resolve(); }); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
function widgets(renderer: ReactTestRenderer) {
  return renderer.root.findAll(node => ['KE', 'GB', 'US', 'BR'].includes(node.props['data-navigation-widget'])).map(node => node.props['data-navigation-widget']);
}
function saved(code = 'GB'): SiteContextResolution {
  const siteId = 'site:0.00000,0.00000', stamp = '2026-11-06T12:00:00.000Z';
  const row: SiteContextPlace = { id: 'private-navigation-place', lat: 0, lon: 0, savedAt: stamp, updatedAt: 42 };
  const context = createSiteCountryContext({ siteId, countryCode: code, confirmed: true,
    jurisdictionReference: 'Private jurisdiction', agriculturalRegionReference: 'Private region' }, stamp);
  assert.ok(context); row.siteCountryContext = bindSiteContext(context, row);
  const resolution = resolveSiteCountryContext([row], siteId); assert.equal(resolution.status, 'confirmed'); return resolution;
}
test('global station tools remain distinct from each selected country provider without starting a request', () => {
  for (const code of ['KE', 'GB', 'US', 'BR'] as const) {
    const ui = mount(code);
    assert.deepEqual(widgets(ui.renderer), [code]);
    assert.deepEqual(ui.renderer.root.findAll(node => node.props['data-global-reference-widget'] !== undefined)
      .map(node => node.props['data-global-reference-widget']), ['DWD-catalog', 'DWD-forecast']);
    assert.equal(probe.calls.length, 0);
    assert.equal(probe.saves, 0);
    ui.dispose();
  }
});
const evidenceLinks = (renderer: ReactTestRenderer) => renderer.root.findAllByType('a').filter(node => text(node) === 'Review country evidence');
beforeEach(() => { probe.calls = []; probe.saves = 0; probe.backRegistrations = 0; probe.replayEffects = false; probe.effectCleanups = 0; probe.next = async () => reference('current synthetic public reference'); });
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => {
  hooks.deregister(); for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
});

test('source review steps distinguish absent evidence, unusable dates, overdue review and dated reference without approving advice', () => {
  const source: CountrySource = { ...structuredClone(COUNTRY_PROFILES[0].sources[0]),
    publishedOn: '2026-10-01', accessedOn: '2026-11-01', reviewDueOn: '2026-12-01', verification: 'content-read' };
  const cases: Array<[Partial<CountrySource>, RegExp, RegExp]> = [
    [{}, /Dated reference evidence/, /Check the recorded coverage, units and licence/],
    [{ verification: 'unavailable' }, /Full source evidence not recorded/, /Read the full official source/],
    [{ verification: 'snippet-only' }, /Full source evidence not recorded/, /Read the full official source/],
    [{ publishedOn: null, lastModifiedOn: '2026-11-01' }, /Evidence dates are missing or unusable/, /cannot replace an unknown publication date/],
    [{ accessedOn: '2026-12-01' }, /Evidence dates are missing or unusable/, /Confirm the publication, access and review dates/],
    [{ reviewDueOn: '2026-02-30' }, /Evidence dates are missing or unusable/, /Confirm the publication, access and review dates/],
    [{ reviewDueOn: '2026-10-31' }, /Recorded review is overdue/, /previous review window has ended/],
  ];
  for (const [override, label, action] of cases) {
    const input = { ...source, ...override }, before = JSON.stringify(input);
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(CountryEvidenceDetails, { source: input, asOf: '2026-11-10' })); });
    mounted.add(renderer);
    assert.match(text(renderer.root.findByType('summary')), label);
    assert.match(text(renderer.root), action);
    assert.match(text(renderer.root), /Review next:/);
    const link = renderer.root.findByType('a');
    assert.equal(link.props.href, source.url);
    assert.equal(link.props.rel, 'noreferrer');
    for (const retained of [source.verifiedClaim, source.limitations, source.coverage, source.attribution, source.missingDataBehavior]) {
      assert.ok(text(renderer.root).includes(retained));
    }
    const due = renderer.root.findAllByType('dt').find(node => text(node) === 'Review due')!;
    assert.ok(due);
    assert.equal(JSON.stringify(input), before);
    assert.doesNotMatch(text(renderer.root), /local farming advice approved|international planning enabled/i);
    act(() => renderer.unmount()); mounted.delete(renderer);
  }
  assert.deepEqual(probe.calls, []); assert.equal(probe.saves, 0);
});

test('every pilot purpose shows its existing dated-evidence count while unsupported countries keep zero evidence and no local approval', () => {
  const before = JSON.stringify(COUNTRY_PROFILES), asOf = new Date().toISOString().slice(0, 10);
  for (const code of ['KE', 'GB', 'US', 'BR', 'ZA', 'OTHER']) {
    const ui = mount(code), readiness = evaluateCountryReadiness({ countryCode: code }, asOf);
    const evidence = ui.renderer.root.findAllByType('article');
    assert.equal(evidence.length, readiness.evidence.length);
    for (let i = 0; i < evidence.length; i++) {
      const expected = readiness.evidence[i];
      assert.ok(text(evidence[i]).includes(`Dated reference evidence: ${expected.availableCount} of ${expected.sources.length} recorded sources.`));
      assert.match(text(evidence[i]), /This does not approve local farming advice/);
      assert.equal(evidence[i].findAllByType('details').length, expected.sources.length);
      if (!expected.sources.length) assert.match(text(evidence[i]), /No source dossier recorded/);
    }
    assert.equal(readiness.productionPlanSupported, false);
    assert.match(ui.text(), /International production planning is unavailable/);
    ui.dispose();
  }
  assert.equal(JSON.stringify(COUNTRY_PROFILES), before);
  assert.deepEqual(probe.calls, []); assert.equal(probe.saves, 0);
});

test('Next14 page forwards only the country hint, supports a bare call and does not forward private query metadata or fetch', () => {
  const queries = [undefined, {}, { country: 'GB' }, { country: ['GB', 'US'] },
    { country: 'US', site: 'private-site', actor: 'private-actor', lat: 'private-coordinate', region: 'Private region' }];
  for (const searchParams of queries) {
    const node = searchParams === undefined ? InternationalReviewPage() : InternationalReviewPage({ searchParams });
    assert.ok(React.isValidElement<{ countryHint?: unknown }>(node)); assert.equal(node.type, CountryReview);
    assert.deepEqual(Object.keys(node.props), ['countryHint']); assert.equal(node.props.countryHint, searchParams?.country);
    assert.doesNotMatch(JSON.stringify(node.props), /private-|Private region/);
  }
  assert.equal(probe.calls.length, 0); assert.equal(probe.saves, 0);
  assert.equal(metadata.title, 'Country evidence review — ImbewuField');
});

test('each exact pilot opens its real dossier and existing provider widget with no request, persistence or planning grant', () => {
  for (const code of ['KE', 'GB', 'US', 'BR'] as const) {
    const ui = mount(code), profile = COUNTRY_PROFILES.find(row => row.code === code)!;
    assert.equal(ui.select().props.value, code); assert.deepEqual(widgets(ui.renderer), [code]);
    assert.ok(ui.text().includes(profile.jurisdictionNote)); assert.ok(ui.text().includes(COUNTRY_CLIMATE_DEMOS[code].label));
    assert.equal(ui.region().props.value, ''); assert.match(ui.text(), /International production planning is unavailable/);
    assert.match(ui.text(), /South African defaults are never applied/); assert.match(ui.text(), /not been identified and reviewed/);
    assert.equal(ui.renderer.root.findAllByType('a').filter(link => link.props.href === '/international/locales').length, 1);
    assert.equal(ui.renderer.root.findAllByType('a').filter(link => link.props.href === '/international/projects').length, 1);
    assert.ok(ui.renderer.root.findAllByType('a').some(link => link.props.href === profile.sources[0].url));
    assert.equal(probe.calls.length, 0); assert.equal(probe.saves, 0); ui.dispose();
  }
  assert.ok(probe.backRegistrations >= 4);
});

test('only undefined starts Kenya; explicit unsupported and malformed hints show OTHER without a phantom pilot or unsanitized query', () => {
  const bare = mount(); assert.equal(bare.select().props.value, 'KE'); assert.deepEqual(widgets(bare.renderer), ['KE']); bare.dispose();
  const privateText = 'private-query-<script>alert(1)</script>';
  for (const hint of ['ZA', 'ZZ', 'UK', null, '', 'gb', ' GB ', ['GB', 'US'], { country: privateText }, privateText]) {
    const ui = mount(hint); assert.equal(ui.select().props.value, 'OTHER'); assert.deepEqual(widgets(ui.renderer), []);
    assert.match(ui.text(), /No reviewed dossier/); assert.match(ui.text(), /No demo available/); assert.equal(ui.button().props.disabled, true);
    assert.doesNotMatch(ui.text(), /Nairobi public coarse demo/); assert.equal(ui.text().includes(privateText), false);
    assert.equal(JSON.stringify(ui.renderer.toJSON()).includes(privateText), false); assert.equal(probe.calls.length, 0);
    act(() => ui.button().props.onClick()); assert.equal(probe.calls.length, 0, 'a disabled no-demo callback has no request authority'); ui.dispose();
  }
  let reads = 0;
  const unsafe = new Proxy({}, { get() { reads++; throw Error('Navigation must not inspect query objects'); },
    ownKeys() { reads++; throw Error('Navigation must not enumerate query objects'); },
    getOwnPropertyDescriptor() { reads++; throw Error('Navigation must not inspect query descriptors'); } });
  const ui = mount(unsafe); assert.equal(ui.select().props.value, 'OTHER'); assert.deepEqual(widgets(ui.renderer), []);
  assert.equal(reads, 0); assert.equal(probe.calls.length, 0); ui.dispose();
});

test('function and NaN hints remain invalid data on initial and incoming renders without executing callbacks or looping', () => {
  let calls = 0;
  const functionHint = () => { calls++; return 'GB'; };
  for (const initial of [functionHint, NaN]) {
    const ui = mount(initial);
    const assertInvalid = () => {
      assert.equal(ui.select().props.value, 'OTHER'); assert.deepEqual(widgets(ui.renderer), []);
      assert.match(ui.text(), /No reviewed dossier/); assert.match(ui.text(), /No demo available/);
      assert.doesNotMatch(ui.text(), /Nairobi public coarse demo/); assert.equal(ui.button().props.disabled, true);
      assert.equal(calls, 0); assert.deepEqual(probe.calls, []); assert.equal(probe.saves, 0);
    };
    assertInvalid();
    // Repeating NaN exercises identity comparison rather than !==; moving back
    // to a function exercises React's updater interpretation on the reset path.
    for (const incoming of [NaN, NaN, functionHint, functionHint, NaN]) { ui.update(incoming); assertInvalid(); }
    ui.dispose();
  }
});

test('saved GB evidence link ignores unsaved US form edits, carries no private metadata and updates only with a new saved resolution', () => {
  let refreshes = 0; const initial = saved('GB'), before = JSON.stringify(initial); let renderer!: ReactTestRenderer;
  const props = (resolution: SiteContextResolution) => ({ resolution, onSaved() { refreshes++; } });
  act(() => { renderer = create(React.createElement(SiteCountryPanel, props(initial))); }); mounted.add(renderer);
  assert.equal(evidenceLinks(renderer).length, 1); assert.equal(evidenceLinks(renderer)[0].props.href, '/international?country=GB');
  assert.match(evidenceLinks(renderer)[0].props.className, /min-h-11/);
  assert.match(text(renderer.root), /Reference tools only/); assert.match(text(renderer.root), /does not save country details or approve farming advice/);
  act(() => { renderer.root.findByType('select').props.onChange({ target: { value: 'US' } }); });
  assert.equal(renderer.root.findByType('select').props.value, 'US'); assert.equal(evidenceLinks(renderer)[0].props.href, '/international?country=GB');
  const textFields = renderer.root.findAllByType('input').filter(node => node.props.type !== 'checkbox');
  act(() => { textFields[0].props.onChange({ target: { value: 'Private unsaved jurisdiction' } }); textFields[1].props.onChange({ target: { value: 'Private unsaved region' } }); });
  assert.equal(evidenceLinks(renderer)[0].props.href, '/international?country=GB');
  assert.equal(probe.saves, 0); assert.equal(refreshes, 0); assert.equal(JSON.stringify(initial), before);
  act(() => renderer.update(React.createElement(SiteCountryPanel, props(saved('US')))));
  assert.equal(evidenceLinks(renderer)[0].props.href, '/international?country=US');
  assert.doesNotMatch(evidenceLinks(renderer)[0].props.href, /private|Private|site|region|0\.00000/);
  for (const status of ['unknown', 'conflict', 'missing-site'] as const) {
    act(() => renderer.update(React.createElement(SiteCountryPanel, props({ ...initial, status, context: null }))));
    assert.deepEqual(evidenceLinks(renderer), []); assert.equal(probe.saves, 0);
  }
});

test('incoming hint retires a prior dossier, entered region and visible result before any stale frame commits', async () => {
  const ui = mount('GB'); act(() => ui.region().props.onChange({ target: { value: 'Private previous region' } }));
  await ui.click(); assert.match(ui.text(), /current synthetic public reference/);
  ui.commits.length = 0; ui.update('US');
  assert.ok(ui.commits.length > 0);
  for (const commit of ui.commits) {
    assert.equal(commit.code, 'US'); assert.equal(commit.region, ''); assert.deepEqual(commit.widgets.filter(value => value !== 'research-queue'), ['US']);
    assert.doesNotMatch(commit.visible, /Private previous region|current synthetic public reference|One bounded public request is in progress/);
  }
  assert.deepEqual(probe.calls, ['GB']); assert.equal(ui.button().props.disabled, false);
  ui.change('BR'); ui.update('US'); assert.equal(ui.select().props.value, 'BR', 'unchanged incoming hint does not undo a deliberate manual choice');
});

test('late public result from an old hint cannot replace the new country or clear its newer in-flight request', async () => {
  const old = deferred(), current = deferred(); probe.next = () => old.promise; const ui = mount('GB');
  await ui.click(); assert.deepEqual(probe.calls, ['GB']); assert.equal(ui.button().props.disabled, true);
  ui.update('US'); assert.equal(ui.button().props.disabled, false); assert.equal(ui.region().props.value, '');
  probe.next = () => current.promise; await ui.click(); assert.deepEqual(probe.calls, ['GB', 'US']);
  await act(async () => old.resolve(reference('obsolete previous-country reference')));
  assert.equal(ui.select().props.value, 'US'); assert.deepEqual(widgets(ui.renderer), ['US']);
  assert.doesNotMatch(ui.text(), /obsolete previous-country reference/); assert.equal(ui.button().props.disabled, true);
  assert.match(ui.text(), /One bounded public request is in progress/);
  await act(async () => current.resolve(reference('current-country explicit reference')));
  assert.match(ui.text(), /current-country explicit reference/); assert.doesNotMatch(ui.text(), /obsolete previous-country reference/);
  assert.equal(ui.button().props.disabled, false); assert.match(ui.text(), /International production planning is unavailable/);
});

test('manual country changes withdraw linked-country notice and invalidate a pending result independently of the unchanged URL hint', async () => {
  const invalid = mount('UK');
  const linkedText = invalid.text();
  invalid.change('OTHER');
  const manualText = invalid.text();
  // Keeping OTHER selected changes no dossier or provider. A visible difference
  // here therefore demonstrates retirement of the link-specific explanation,
  // rather than merely the ordinary no-dossier paragraph disappearing later.
  assert.ok(linkedText.length > manualText.length, 'manual OTHER selection retires a visible linked-country explanation');
  let prefix = 0, suffix = 0;
  while (prefix < manualText.length && linkedText[prefix] === manualText[prefix]) prefix++;
  while (suffix < manualText.length - prefix && linkedText[linkedText.length - suffix - 1] === manualText[manualText.length - suffix - 1]) suffix++;
  assert.equal(manualText.slice(prefix, manualText.length - suffix), '');
  assert.match(linkedText.slice(prefix, linkedText.length - suffix), /country|link|hint|dossier|selection/i);
  invalid.change('US'); assert.equal(invalid.select().props.value, 'US'); assert.deepEqual(widgets(invalid.renderer), ['US']);
  invalid.dispose();
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount('GB'), change = ui.select().props.onChange;
  await ui.click();
  // Directly invoke the retained control to cover source retirement even when a
  // disabled select would ordinarily prevent a new browser event during loading.
  act(() => change({ target: { value: 'BR' } }));
  assert.equal(ui.select().props.value, 'BR'); assert.deepEqual(widgets(ui.renderer), ['BR']); assert.equal(ui.button().props.disabled, false);
  await act(async () => pending.resolve(reference('obsolete manually-left-country reference')));
  assert.doesNotMatch(ui.text(), /obsolete manually-left-country reference/); assert.deepEqual(probe.calls, ['GB']);
  ui.change('OTHER'); act(() => ui.button().props.onClick()); assert.deepEqual(probe.calls, ['GB']);
});

test('unmounting retires a pending country request; its completion cannot appear in a newly mounted review', async () => {
  const pending = deferred(); probe.next = () => pending.promise; const old = mount('GB'); await old.click(); old.dispose();
  const current = mount('US'); assert.equal(current.button().props.disabled, false);
  await act(async () => pending.resolve(reference('obsolete unmounted-country reference')));
  assert.equal(current.select().props.value, 'US'); assert.deepEqual(widgets(current.renderer), ['US']);
  assert.doesNotMatch(current.text(), /obsolete unmounted-country reference|Public reference received/);
  assert.equal(current.button().props.disabled, false); assert.deepEqual(probe.calls, ['GB']); assert.equal(probe.saves, 0);
});

test('retained idle GB callback cannot start work under an incoming US hint or retire the new US request and result', async () => {
  const ui = mount('GB'), oldGbCheck = ui.button().props.onClick;
  ui.update('US');
  await act(async () => { oldGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, []); assert.equal(ui.select().props.value, 'US'); assert.deepEqual(widgets(ui.renderer), ['US']);
  assert.equal(ui.button().props.disabled, false); assert.doesNotMatch(ui.text(), /Public reference received|One bounded public request is in progress/);
  const pending = deferred(); probe.next = () => pending.promise;
  await ui.click(); assert.deepEqual(probe.calls, ['US']); assert.equal(ui.button().props.disabled, true);
  await act(async () => { oldGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['US']); assert.equal(ui.button().props.disabled, true);
  assert.match(ui.text(), /One bounded public request is in progress/);
  await act(async () => pending.resolve(reference('fresh US request survives obsolete GB callback')));
  assert.match(ui.text(), /fresh US request survives obsolete GB callback/); assert.equal(ui.button().props.disabled, false);
  await act(async () => { oldGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['US']); assert.match(ui.text(), /fresh US request survives obsolete GB callback/);
  assert.equal(ui.button().props.disabled, false);
});

test('manual changes retire idle callbacks even after GB to US to GB returns to the original code', async () => {
  const ui = mount('GB'), originalGbCheck = ui.button().props.onClick;
  ui.change('US');
  await act(async () => { originalGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, []); assert.equal(ui.select().props.value, 'US'); assert.equal(ui.button().props.disabled, false);
  ui.change('GB');
  await act(async () => { originalGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, []); assert.equal(ui.select().props.value, 'GB'); assert.deepEqual(widgets(ui.renderer), ['GB']);
  assert.doesNotMatch(ui.text(), /Public reference received|One bounded public request is in progress/);
  probe.next = async () => reference('fresh manual GB request'); await ui.click();
  assert.deepEqual(probe.calls, ['GB']); assert.match(ui.text(), /fresh manual GB request/);
  await act(async () => { originalGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['GB']); assert.match(ui.text(), /fresh manual GB request/); assert.equal(ui.button().props.disabled, false);
});

test('an idle callback retained beyond unmount cannot start a provider call or disturb a separately mounted current request', async () => {
  const old = mount('GB'), unmountedGbCheck = old.button().props.onClick; old.dispose();
  await act(async () => { unmountedGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, []);
  const pending = deferred(); probe.next = () => pending.promise; const current = mount('US'); await current.click();
  assert.deepEqual(probe.calls, ['US']); assert.equal(current.button().props.disabled, true);
  await act(async () => { unmountedGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['US']); assert.equal(current.button().props.disabled, true);
  await act(async () => pending.resolve(reference('current mounted US request')));
  assert.match(current.text(), /current mounted US request/); assert.equal(current.button().props.disabled, false);
  await act(async () => { unmountedGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['US']); assert.match(current.text(), /current mounted US request/); assert.equal(current.button().props.disabled, false);
  assert.equal(probe.saves, 0);
});

test('development effect setup cleanup setup still permits a fresh current-country request and retires old handlers', async () => {
  probe.replayEffects = true;
  const ui = mount('GB');
  assert.equal(probe.effectCleanups, 1);
  await ui.click();
  assert.deepEqual(probe.calls, ['GB']);
  assert.match(ui.text(), /current synthetic public reference/);
  const oldGbCheck = ui.button().props.onClick;
  ui.update('US');
  await act(async () => { oldGbCheck(); await Promise.resolve(); });
  assert.deepEqual(probe.calls, ['GB']);
  await ui.click();
  assert.deepEqual(probe.calls, ['GB', 'US']);
  assert.equal(probe.saves, 0);
});
