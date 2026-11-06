import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { DwdMosmixImportResult } from '../lib/international/providers/dwd-mosmix-import.ts';
import type { DwdMosmixIssue } from '../lib/international/providers/dwd-mosmix-reference.ts';

type Reference = Extract<DwdMosmixImportResult, { status: 'available' | 'partial' }>;
type Failure = Extract<DwdMosmixImportResult, { status: 'failed' }>;
type Lifecycle = { setup: () => void | (() => void); cleanup: void | (() => void); active: boolean };
const stationFiles = 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/';
const copyright = 'https://www.dwd.de/copyright';
const issuedAt = '2026-11-06T00:00:00.001Z', fetchedAt = '2026-11-06T00:02:03.456Z';
const watchdog = { timeout: 3_000 };
const prior = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', '__dwdStationUi', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 };
const probe = {
  calls: [] as unknown[][],
  next: (async () => reference()) as (...args: unknown[]) => Promise<DwdMosmixImportResult>,
  lifecycles: [] as Lifecycle[],
  loadedSourceSha256: '',
};
const forbiddenStorage = () => { effects.storage++; throw Error('Public station UI must not read or write storage'); };
const forbiddenFetch = () => { effects.network++; throw Error('Public station UI must use its explicit server action'); };
const browser = Object.defineProperties({}, { localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: forbiddenFetch }, window: { value: browser },
  localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage },
  __dwdStationUi: { value: probe }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const componentUrl = new URL('../components/international/countries/DwdStationReference.tsx', import.meta.url).href;
const actionUrl = new URL('../app/international/dwd-mosmix-actions.ts', import.meta.url).href;
const moduleText = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const actualReact = JSON.stringify(import.meta.resolve('react'));
// Actual React state/ref hooks and the actual station parser execute. The only
// transport replacement returns synthetic decoded DTOs, never live DWD data.
// Wrapping effect registration also supplies an explicitly labelled lifecycle
// replay seam below; it is not a claim about a DOM/browser scheduling sequence.
const reactModule = moduleText(`import React from ${actualReact};export * from ${actualReact};export default React;
function owned(kind,setup,deps){return React[kind](()=>{const entry={setup,cleanup:undefined,active:true};
entry.cleanup=setup();globalThis.__dwdStationUi.lifecycles.push(entry);
return()=>{entry.active=false;if(typeof entry.cleanup==='function')entry.cleanup();};},deps);}
export function useEffect(setup,deps){return owned('useEffect',setup,deps);}
export function useLayoutEffect(setup,deps){return owned('useLayoutEffect',setup,deps);}`);
const actionModule = moduleText(`export function checkDwdStationReference(...args){const p=globalThis.__dwdStationUi;
p.calls.push(args);return p.next(...args);}`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl && specifier === 'react') return reactModule;
    const resolved = next(specifier, context);
    if (context.parentURL === componentUrl && resolved.url === actionUrl) return actionModule;
    return resolved;
  },
  load(url, context, next) {
    if (url === componentUrl) {
      const source = readFileSync(new URL(url), 'utf8');
      probe.loadedSourceSha256 = createHash('sha256').update(source).digest('hex');
      return { shortCircuit: true, format: 'module', source: ts.transpileModule(source,
        { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    }
    return next(url, context);
  },
});
const { parseDwdStationRequest, parseDwdMosmixProvenance, dwdMosmixStationEndpoint, DWD_MOSMIX_PROVIDER_ID } =
  await import('../lib/international/providers/dwd-mosmix-request.ts');
const { default: Card } = await import('../components/international/countries/DwdStationReference.tsx');
const importEffects = { ...effects };
const mounted = new Set<ReactTestRenderer>();

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function readable(node: ReactTestInstance): string { return text(node).replace(/\s+/g, ' ').trim(); }
function datum(node: ReactTestInstance, label: RegExp): string {
  const term = node.findAllByType('dt').find(candidate => label.test(readable(candidate)));
  assert.ok(term, `Missing labelled value ${label}`);
  const definition = term.parent?.findAllByType('dd')[0];
  assert.ok(definition, `Missing definition for ${label}`);
  return readable(definition);
}
function provenance(stationId = '01001') {
  const source = parseDwdMosmixProvenance({ providerId: DWD_MOSMIX_PROVIDER_ID,
    endpoint: dwdMosmixStationEndpoint({ stationId }), fetchedAt, expectedStationId: stationId,
    kind: 'public-station', referenceOnly: true });
  assert.ok(source, 'Synthetic source context must satisfy the actual parser; it proves no retrieval');
  return source;
}
function reference(stationId = '01001', count = 3, description = 'Synthetic decoded public station'): Reference {
  // Deliberately irregular sub-hourly engineering fixtures make a period cap
  // distinguishable from a claim about hours. These are not forecast observations.
  return { status: 'available', station: { id: stationId, description }, issuedAt,
    units: { temperature: 'K', precipitation: 'kg/m2' }, provenance: provenance(stationId), issues: [],
    periods: Array.from({ length: count }, (_, i) => ({
      validAt: new Date(Date.UTC(2026, 10, 6, 1, i * 2, 0, i * 7)).toISOString(),
      temperatureK: i === 0 ? 0 : i === 1 ? 273.1567890123 : 280,
      precipitationKgM2: i === 0 ? 0 : i === 1 ? 0.1234567890123 : 2.5,
    })) };
}
function failure(reason: Failure['reason'], extra: { httpStatus?: number; retryAfterSeconds?: number | null } = {}): Failure {
  switch (reason) {
    case 'invalid-station': case 'invalid-options': case 'timeout': case 'network-error':
    case 'rate-limited': case 'http-error': case 'malformed-response': case 'response-too-large':
      return { status: 'failed', reason, endpoint: null, stationId: null, provenance: null, ...extra };
    case 'invalid-archive': case 'unsupported-archive': case 'aborted':
      return { status: 'failed', reason, provenance: provenance() };
    case 'invalid-byte-input': case 'unsupported-encoding': case 'invalid-byte-encoding':
      return { status: 'failed', reason, provenance: provenance() };
    default:
      return { status: 'failed', reason, provenance: provenance() };
  }
}
function deferred() {
  let resolve!: (value: DwdMosmixImportResult) => void, reject!: (error: Error) => void;
  const promise = new Promise<DwdMosmixImportResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount(options: { strict?: boolean; country?: string } = {}) {
  let renderer!: ReactTestRenderer;
  const element = (country: string) => {
    const card = React.createElement(Card, { key: country });
    return options.strict ? React.createElement(React.StrictMode, null, card) : card;
  };
  act(() => { renderer = create(element(options.country ?? 'A')); }); mounted.add(renderer);
  const card = () => renderer.root.findByType('section');
  const input = () => card().findByType('input');
  const button = () => card().findByType('button');
  return { renderer, card, input, button, text: () => readable(card()),
    edit(value: string) { act(() => input().props.onChange({ target: { value } })); },
    async click() {
      // Do not await the action callback: an intentionally pending request must
      // remain observable, and removing an async guard must fail rather than hang.
      await act(async () => { button().props.onClick(); await Promise.resolve(); });
    },
    changeCountry(country: string) { act(() => renderer.update(element(country))); },
    replayEffects() {
      assert.equal(mounted.size, 1, 'The lifecycle seam is scoped to one real rendered owner');
      const live = probe.lifecycles.filter(entry => entry.active);
      assert.ok(live.some(entry => typeof entry.cleanup === 'function'), 'Real component must register owner cleanup');
      act(() => {
        for (const entry of live) { entry.active = false; if (typeof entry.cleanup === 'function') entry.cleanup(); }
        for (const entry of live) { entry.active = true; entry.cleanup = entry.setup(); }
      });
    },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
}
type Ui = ReturnType<typeof mount>;
function periods(ui: Ui): ReactTestInstance[] { return ui.card().findByType('ol').findAllByType('li'); }
async function settle(operation: () => void) { await act(async () => { operation(); await Promise.resolve(); }); }
beforeEach(() => {
  effects.network = effects.storage = 0; probe.calls.length = 0; probe.lifecycles.length = 0;
  probe.next = async (input) => {
    const request = parseDwdStationRequest(input); assert.ok(request);
    return reference(request.stationId);
  };
});
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('imports, mount and idle edits never request a station or access storage, and the English prototype identifies its limits', watchdog, context => {
  context.diagnostic(`Actual loaded card SHA256: ${probe.loadedSourceSha256}`);
  assert.deepEqual(importEffects, { network: 0, storage: 0 });
  const ui = mount(); assert.equal(probe.calls.length, 0); assert.equal(ui.input().props.value, '');
  assert.equal(ui.input().props.type, 'text'); assert.equal(ui.card().props.lang, 'en');
  const label = ui.card().findByType('label'); assert.equal(readable(label), 'Station ID');
  assert.ok(label.findAllByType('input').includes(ui.input()) || label.props.htmlFor === ui.input().props.id);
  assert.equal(readable(ui.card().findByType('h2')), 'Check a public station forecast');
  assert.equal(readable(ui.button()), 'Check station reference');
  assert.match(ui.text(), /No .*reference.*requested|No station forecast has been requested/i);
  assert.match(ui.text(), /not farm observations/i); assert.match(ui.text(), /weather-alert service/);
  assert.match(ui.text(), /country readiness/); assert.match(ui.text(), /planting advice/);
  assert.match(ui.text(), /No relationship.*reviewed country.*inferred/i);
  // The coordinator's Nov 6 primary copyright-page capture supersedes the
  // earlier unresolved-licence claim. Credit and changes still need disclosure;
  // the public-data licence supplies neither endorsement nor farm observations.
  assert.ok(ui.text().includes('Source: Deutscher Wetterdienst (DWD), MOSMIX. Selected source values extracted and displayed by ImbewuField.'));
  assert.doesNotMatch(ui.text(), /DWD endorsement|DWD endorses|0 K|0 kg\/m²/);
  const links = ui.card().findAllByType('a');
  const licence = links.find(link => link.props.href === 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(licence, 'The public-data credit must include the actual licence destination');
  assert.match(readable(licence), /CC BY\s*4\.0|Creative Commons Attribution 4\.0/i);
  assert.deepEqual(new Set(links.map(link => link.props.href)), new Set([stationFiles, copyright, 'https://creativecommons.org/licenses/by/4.0/']));
  for (const link of links) assert.match(link.props.className, /min-h-11/);
  for (const node of [ui.input(), ui.button()]) assert.match(node.props.className, /min-h-11/);
  assert.match(ui.card().props.className, /min-w-0/);
  const status = ui.card().findByProps({ role: 'status' });
  assert.equal(status.props['aria-live'], 'polite'); assert.equal(status.props['aria-busy'], false);
  ui.edit('01001'); ui.edit('A051'); assert.equal(probe.calls.length, 0);
});

test('blank and noncanonical input stays literal and cannot start work, even through programmatic Check callbacks', watchdog, async () => {
  const ui = mount();
  for (const value of ['', '1234', '123456', ' 01001', '01001 ', 'a051', 'A051\n', 'A051\r', 'A051\u2028',
    '０１００１', 'AB12', 'ABC12', 'A01/1', '01001?x=1', 'https://untrusted.invalid/01001']) {
    ui.edit(value); await ui.click();
    assert.equal(ui.input().props.value, value, 'The input is never trimmed, case-folded or padded');
    assert.equal(probe.calls.length, 0, `No request for ${JSON.stringify(value)}`);
    assert.doesNotMatch(ui.text(), /Public forecast reference received|0 K|0 kg\/m²/);
    assert.doesNotMatch(ui.text(), /station (?:does not exist|was not found)|unregistered station|recognized DWD MOSMIX station code/i);
  }
});

test('explicit checks preserve leading zeros and each admitted spelling family, with one input argument and no transport options', watchdog, async () => {
  // Format examples exercise the real parser; they are not catalogue membership claims.
  for (const stationId of ['01001', 'A051', 'C0014', 'EW002']) {
    const ui = mount(); ui.edit(stationId); const before = probe.calls.length; await ui.click();
    assert.equal(probe.calls.length, before + 1); assert.deepEqual(probe.calls.at(-1), [{ stationId }]);
    assert.equal(datum(ui.card(), /^Station ID/), stationId); ui.dispose();
  }
});

test('source K and kg/m² values retain zero and long fractions, with issue, retrieval and validity UTC kept distinct', watchdog, async () => {
  const result = reference(), before = JSON.stringify(result); probe.next = async () => result;
  const ui = mount(); ui.edit('01001'); await ui.click();
  assert.equal(datum(ui.card(), /issued/i), issuedAt); assert.equal(datum(ui.card(), /retriev/i), fetchedAt);
  for (const term of ui.card().findAllByType('dt').filter(node => /issued|retriev/i.test(readable(node)))) {
    assert.match(readable(term), /UTC/);
  }
  assert.equal(datum(ui.card(), /^Station Description/), result.station.description);
  const rows = periods(ui); assert.equal(rows.length, 3);
  assert.equal(datum(rows[0], /^Temperature/), '0 K'); assert.equal(datum(rows[0], /^Precipitation/), '0 kg/m²');
  assert.equal(datum(rows[1], /^Temperature/), '273.1567890123 K');
  assert.equal(datum(rows[1], /^Precipitation/), '0.1234567890123 kg/m²');
  result.periods.forEach((period, index) => {
    assert.ok(readable(rows[index]).includes(period.validAt)); assert.match(readable(rows[index]), /Valid at \(UTC\)/i);
  });
  assert.doesNotMatch(ui.text(), /°C|°F|\bmm\b|273\.157 K|0\.123 kg\/m²/);
  assert.equal(JSON.stringify(result), before);
});

test('the first-12 display cap reports source count truthfully and does not claim a twelve-hour forecast horizon', watchdog, async () => {
  const result = reference('01001', 15); probe.next = async () => result;
  const ui = mount(); ui.edit('01001'); await ui.click();
  assert.match(ui.text(), /Showing first 12 of 15 source periods/); assert.equal(periods(ui).length, 12);
  for (const period of result.periods.slice(0, 12)) assert.ok(ui.text().includes(period.validAt));
  for (const period of result.periods.slice(12)) assert.ok(!ui.text().includes(period.validAt));
  assert.doesNotMatch(ui.text(), /Showing[^.]*12 (?:hours|days)/i);
});

test('partial independent nulls remain Unknown while independent zero quantities and source receipt survive', watchdog, async () => {
  const base = reference(); const result: Reference = { ...base, status: 'partial', station: { ...base.station, description: null },
    issues: ['temperature-values-missing', 'precipitation-values-missing'], periods: [
      { ...base.periods[0], temperatureK: null }, { ...base.periods[1], temperatureK: 0, precipitationKgM2: null },
    ] };
  probe.next = async () => result; const ui = mount(); ui.edit('01001'); await ui.click();
  assert.match(ui.text(), /Partial public reference/i); assert.equal(datum(ui.card(), /^Station Description/), 'Unknown');
  const rows = periods(ui);
  assert.equal(datum(rows[0], /^Temperature/), 'Unknown'); assert.equal(datum(rows[0], /^Precipitation/), '0 kg/m²');
  assert.equal(datum(rows[1], /^Temperature/), '0 K'); assert.equal(datum(rows[1], /^Precipitation/), 'Unknown');
  assert.equal(datum(ui.card(), /retriev/i), fetchedAt); assert.match(ui.text(), /Showing first 2 of 2 source periods/);
});

const issueDescriptions: Record<DwdMosmixIssue, RegExp> = {
  'missing-temperature-series': /temperature.*(?:missing|not.*provided|unavailable)/i,
  'missing-precipitation-series': /precipitation.*(?:missing|not.*provided|unavailable)/i,
  'temperature-values-missing': /temperature.*(?:missing|not.*provided|unavailable)/i,
  'precipitation-values-missing': /precipitation.*(?:missing|not.*provided|unavailable)/i,
};
for (const issue of Object.keys(issueDescriptions) as DwdMosmixIssue[]) test(`partial ${issue} is explained without inventing a zero series`, watchdog, async () => {
  const base = reference(); const temperature = issue.startsWith('temperature') || issue === 'missing-temperature-series';
  const result: Reference = { ...base, status: 'partial', issues: [issue],
    periods: base.periods.map(period => ({ ...period, ...(temperature ? { temperatureK: null } : { precipitationKgM2: null }) })) };
  probe.next = async () => result; const ui = mount(); ui.edit('01001'); await ui.click();
  assert.match(ui.text(), /Partial public reference/i); assert.match(ui.text(), issueDescriptions[issue]);
  assert.doesNotMatch(ui.text(), /R101/);
  for (const row of periods(ui)) assert.equal(datum(row, temperature ? /^Temperature/ : /^Precipitation/), 'Unknown');
});

test('all missing decoded values are partial unknown data, never an invented zero forecast', watchdog, async () => {
  const base = reference(); const result: Reference = { ...base, status: 'partial',
    issues: ['temperature-values-missing', 'precipitation-values-missing'],
    periods: base.periods.map(period => ({ ...period, temperatureK: null, precipitationKgM2: null })) };
  probe.next = async () => result; const ui = mount(); ui.edit('01001'); await ui.click();
  assert.match(ui.text(), /Partial public reference/i); assert.doesNotMatch(ui.text(), /0 K|0 kg\/m²/);
  for (const row of periods(ui)) assert.deepEqual(row.findAllByType('dd').map(node => readable(node)), ['Unknown', 'Unknown']);
});

test('idle input A-B-A changes permanently retire earlier Check handlers even when the string becomes equal again', watchdog, async () => {
  const ui = mount(); const blankCheck = ui.button().props.onClick;
  ui.edit('01001'); const oldA = ui.button().props.onClick;
  ui.edit('A051'); act(() => oldA()); assert.equal(probe.calls.length, 0);
  ui.edit('01001'); act(() => { oldA(); blankCheck(); }); assert.equal(probe.calls.length, 0);
  await ui.click(); assert.deepEqual(probe.calls, [[{ stationId: '01001' }]]);
});

test('a retained old input callback cannot alter the selected station or clear a later displayed result', watchdog, async () => {
  const ui = mount(); ui.edit('01001'); const oldInput = ui.input().props.onChange;
  ui.edit('A051'); await ui.click(); assert.match(ui.text(), /Public forecast reference received/);
  act(() => oldInput({ target: { value: '01001' } }));
  assert.equal(ui.input().props.value, 'A051'); assert.equal(datum(ui.card(), /^Station ID/), 'A051');
  assert.equal(probe.calls.length, 1);
});

test('idle A-B-A edits do not renew a retained earlier input callback or silently replace current input', watchdog, () => {
  const ui = mount(); ui.edit('01001'); const oldInput = ui.input().props.onChange;
  ui.edit('A051'); act(() => oldInput({ target: { value: 'EW002' } }));
  assert.equal(ui.input().props.value, 'A051');
  ui.edit('01001'); act(() => oldInput({ target: { value: 'C0014' } }));
  assert.equal(ui.input().props.value, '01001'); assert.equal(probe.calls.length, 0);
});

test('one accepted idle edit synchronously retires its captured input callback before React commits another render', watchdog, () => {
  const ui = mount(); const edit = ui.input().props.onChange;
  act(() => { edit({ target: { value: '01001' } }); edit({ target: { value: 'A051' } }); });
  assert.equal(ui.input().props.value, '01001'); assert.equal(probe.calls.length, 0);
});

test('a pending explicit request withdraws old data, blocks synchronous double clicks and ignores programmatic edits', watchdog, async () => {
  const ui = mount(); ui.edit('01001'); await ui.click(); assert.ok(ui.text().includes(issuedAt));
  const waiting = deferred(); probe.next = () => waiting.promise; const current = ui.button().props.onClick;
  act(() => { current(); current(); }); assert.equal(probe.calls.length, 2);
  assert.equal(ui.button().props.disabled, true); assert.equal(ui.input().props.disabled, true);
  assert.equal(readable(ui.button()), 'Checking station reference…');
  assert.equal(ui.card().findByProps({ role: 'status' }).props['aria-busy'], true);
  assert.ok(!ui.text().includes(issuedAt)); assert.doesNotMatch(ui.text(), /0 K|0 kg\/m²/);
  act(() => ui.input().props.onChange({ target: { value: 'A051' } })); assert.equal(ui.input().props.value, '01001');
  await settle(() => waiting.resolve(reference())); assert.equal(ui.button().props.disabled, false);
  act(() => current()); assert.equal(probe.calls.length, 2, 'Settling an operation cannot renew its earlier callback');
  probe.next = async () => reference(); await ui.click(); assert.equal(probe.calls.length, 3);
});

test('editing after a result clears it without an automatic lookup and without renewing its old Check handler', watchdog, async () => {
  const ui = mount(); ui.edit('01001'); await ui.click(); const oldCheck = ui.button().props.onClick;
  ui.edit('A051'); assert.ok(!ui.text().includes(issuedAt)); assert.equal(probe.calls.length, 1);
  act(() => oldCheck()); assert.equal(probe.calls.length, 1);
  await ui.click(); assert.deepEqual(probe.calls.at(-1), [{ stationId: 'A051' }]);
});

for (const completion of ['resolve', 'reject'] as const) test(`unmount retires a pending owner and its loading-view handlers before late ${completion}`, watchdog, async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const old = mount(); old.edit('01001'); await old.click();
  const oldCheck = old.button().props.onClick, oldInput = old.input().props.onChange; old.dispose(); const current = mount();
  // Check first: an incorrectly accepted old edit must not accidentally mask a
  // missing mounted guard by changing the view before the old Check executes.
  act(() => { oldCheck(); oldInput({ target: { value: 'A051' } }); }); assert.equal(probe.calls.length, 1);
  await settle(() => completion === 'resolve' ? waiting.resolve(reference('01001', 3, 'LATE_OWNER_MARKER')) : waiting.reject(Error('PRIVATE_LATE_ERROR')));
  assert.equal(current.input().props.value, ''); assert.match(current.text(), /No .*requested/i);
  assert.doesNotMatch(current.text(), /LATE_OWNER_MARKER|PRIVATE_LATE_ERROR|could not be completed/);
});

test('a keyed A-B-A remount is a fresh card, never a route claim or permission for an old owner response', watchdog, async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const ui = mount({ country: 'A' }); ui.edit('01001'); await ui.click();
  const oldCheck = ui.button().props.onClick; ui.changeCountry('B'); ui.changeCountry('A');
  await settle(() => waiting.resolve(reference('01001', 3, 'LATE_KEYED_OWNER'))); act(() => oldCheck());
  assert.equal(probe.calls.length, 1); assert.equal(ui.input().props.value, '');
  assert.match(ui.text(), /No .*requested/i); assert.doesNotMatch(ui.text(), /LATE_KEYED_OWNER|0 K/);
  probe.next = async () => reference('A051'); ui.edit('A051'); await ui.click(); assert.equal(probe.calls.length, 2);
});

test('StrictMode initial effect replay requests nothing and leaves the current explicit controls usable', watchdog, async () => {
  const ui = mount({ strict: true }); assert.equal(probe.calls.length, 0); ui.edit('01001'); await ui.click();
  assert.equal(probe.calls.length, 1); assert.match(ui.text(), /Public forecast reference received/);
});

for (const completion of ['resolve', 'reject'] as const) test(`real-state/ref cleanup/setup seam retires a pending generation before late ${completion} (not DOM scheduling proof)`, watchdog, async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const ui = mount(); ui.edit('01001'); await ui.click();
  ui.replayEffects();
  await settle(() => completion === 'resolve' ? waiting.resolve(reference('01001', 3, 'RETIRED_GENERATION_MARKER')) : waiting.reject(Error('PRIVATE_RETIRED_ERROR')));
  assert.equal(probe.calls.length, 1);
  assert.doesNotMatch(ui.text(), /RETIRED_GENERATION_MARKER|PRIVATE_RETIRED_ERROR|Public forecast reference received|reference check could not be completed/);
});

const failureFamilies: Record<Failure['reason'], RegExp> = {
  'invalid-station': /station.*(?:ID|code|format|identifier)/i,
  'invalid-options': /request.*(?:prepared|options)/i,
  timeout: /timed out|time.*limit|timeout/i,
  'network-error': /(?:service|network).*(?:reached|unavailable)|connect/i,
  'rate-limited': /rate.limit|too many requests/i,
  'http-error': /HTTP|service.*error/i,
  'malformed-response': /response.*(?:match|format|structure)|archive.*response/i,
  'response-too-large': /(?:response|download).*(?:size|large|limit|ceiling)/i,
  'invalid-provenance': /provenance|source context|receipt/i,
  'invalid-archive': /archive.*(?:verified|unpack|invalid|read)/i,
  'software-bound': /bound|limit|ceiling/i,
  'unsupported-archive': /archive.*(?:support|format|compression)/i,
  aborted: /abort|cancel/i,
  'invalid-byte-input': /byte|document.*invalid/i,
  'unsupported-encoding': /encoding.*support/i,
  'invalid-byte-encoding': /encod|decod/i,
  'invalid-xml-input': /XML.*(?:empty|invalid)|document.*invalid/i,
  'unsafe-xml': /XML.*(?:unsupported|unsafe)|unsafe.*document/i,
  'malformed-xml': /XML.*pars|document.*pars/i,
  'unsupported-profile': /profile|MOSMIX.*(?:match|support)/i,
  'station-mismatch': /station.*(?:match|requested)/i,
  'invalid-timestamps': /time|timestamp/i,
  'invalid-values': /values|series/i,
  'no-supported-series': /(?:temperature|precipitation|series).*(?:found|available|support)|No supported/i,
};
for (const reason of Object.keys(failureFamilies) as Failure['reason'][]) test(`${reason} failure is static, explicit and never supplies a replacement forecast`, watchdog, async () => {
  const result = { ...failure(reason), diagnostics: 'PRIVATE_PROVIDER_BODY_DO_NOT_RENDER' };
  probe.next = async () => result; const ui = mount(); ui.edit('01001'); await ui.click();
  assert.equal(probe.calls.length, 1); assert.match(ui.text(), failureFamilies[reason]); assert.match(ui.text(), /No automatic retry/i);
  assert.doesNotMatch(ui.text(), /PRIVATE_PROVIDER_BODY_DO_NOT_RENDER|Public forecast reference received|0 K|0 kg\/m²/);
  assert.equal(ui.button().props.disabled, false); assert.equal(ui.input().props.disabled, false);
  await settle(() => {}); assert.equal(probe.calls.length, 1);
});

for (const retry of [0, null, undefined] as const) test(`HTTP429 Retry-After ${String(retry)} never borrows a zero from unknown metadata`, watchdog, async () => {
  probe.next = async () => failure('rate-limited', { httpStatus: 429, ...(retry === undefined ? {} : { retryAfterSeconds: retry }) });
  const ui = mount(); ui.edit('01001'); await ui.click(); assert.match(ui.text(), /HTTP status: 429/);
  if (retry === 0) assert.match(ui.text(), /Retry-After:\s*0 seconds/);
  else { assert.doesNotMatch(ui.text(), /Retry-After:\s*0/); if (retry === null) assert.match(ui.text(), /Retry-After:\s*Unknown/); }
  assert.equal(probe.calls.length, 1);
});

test('an unexpected rejected action clears pending with static copy and requires a fresh explicit retry', watchdog, async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const ui = mount(); ui.edit('01001'); await ui.click();
  const old = ui.button().props.onClick; assert.equal(ui.input().props.disabled, true);
  await settle(() => waiting.reject(Error('PRIVATE_UNEXPECTED_ACTION_DETAIL')));
  assert.match(ui.text(), /reference check could not be completed/i); assert.doesNotMatch(ui.text(), /PRIVATE_UNEXPECTED_ACTION_DETAIL|0 K/);
  assert.equal(ui.input().props.disabled, false); assert.equal(ui.button().props.disabled, false);
  act(() => old()); assert.equal(probe.calls.length, 1);
  probe.next = async () => reference(); await ui.click(); assert.equal(probe.calls.length, 2);
});

test('a synchronous unexpected action throw is also static and cannot leave controls stuck pending', watchdog, async () => {
  probe.next = () => { throw Error('PRIVATE_SYNCHRONOUS_ACTION_DETAIL'); };
  const ui = mount(); ui.edit('01001'); await ui.click(); assert.equal(probe.calls.length, 1);
  assert.match(ui.text(), /reference check could not be completed/i); assert.doesNotMatch(ui.text(), /PRIVATE_SYNCHRONOUS_ACTION_DETAIL/);
  assert.equal(ui.button().props.disabled, false); assert.equal(ui.input().props.disabled, false);
});
