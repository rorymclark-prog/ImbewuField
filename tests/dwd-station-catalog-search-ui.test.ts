import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { DwdMosmixCatalogSearchResult } from '../lib/international/providers/dwd-mosmix-catalog-search.ts';

type Props = {
  searchCatalog: (query: string) => Promise<DwdMosmixCatalogSearchResult>;
  onSelectStation: (stationId: string) => void;
};
type Lifecycle = { setup: () => void | (() => void); cleanup: void | (() => void); active: boolean };
const watchdog = { timeout: 3_000 };
const key = '__dwdCatalogSearchUi';
const prior = new Map([key, 'fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const effects = { network: 0, storage: 0 };
const probe = { searches: [] as unknown[][], selections: [] as string[], lifecycles: [] as Lifecycle[], sourceSha256: '' };
const noStorage = () => { effects.storage++; throw Error('Catalogue search must not acquire or change saved context'); };
const noFetch = () => { effects.network++; throw Error('The prop-controlled catalogue UI must not perform its own fetch'); };
const browser = Object.defineProperties({}, { localStorage: { get: noStorage }, sessionStorage: { get: noStorage } });
for (const [name, descriptor] of Object.entries({ [key]: { value: probe }, fetch: { value: noFetch },
  window: { value: browser }, localStorage: { get: noStorage }, sessionStorage: { get: noStorage },
  IS_REACT_ACT_ENVIRONMENT: { value: true } })) Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
const componentUrl = new URL('../components/international/countries/DwdStationCatalogSearch.tsx', import.meta.url).href;
const asModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const reactUrl = JSON.stringify(import.meta.resolve('react'));
// State, refs and the canonical query/catalogue helpers run unchanged. Props
// supply synthetic results only. Effect registration exposes a labelled replay
// seam; manually invoking cleanup/setup is not DOM/browser scheduling evidence.
const reactModule = asModule(`import React from ${reactUrl};export * from ${reactUrl};export default React;
function owned(kind,setup,deps){return React[kind](()=>{const entry={setup,cleanup:undefined,active:true};
entry.cleanup=setup();globalThis.${key}.lifecycles.push(entry);
return()=>{entry.active=false;if(typeof entry.cleanup==='function')entry.cleanup();};},deps);}
export function useEffect(setup,deps){return owned('useEffect',setup,deps);}
export function useLayoutEffect(setup,deps){return owned('useLayoutEffect',setup,deps);}`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl && specifier === 'react') return reactModule;
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) {
      const source = readFileSync(new URL(url), 'utf8'); probe.sourceSha256 = createHash('sha256').update(source).digest('hex');
      return { shortCircuit: true, format: 'module', source: ts.transpileModule(source,
        { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    }
    return next(url, context);
  },
});
const { parseDwdMosmixCatalogSearchQuery, searchDwdMosmixStationCatalogBytes } =
  await import('../lib/international/providers/dwd-mosmix-catalog-search.ts');
const { default: CardModule } = await import('../components/international/countries/DwdStationCatalogSearch.tsx');
const Card: React.ComponentType<Props> = CardModule;
const importEffects = { ...effects }, mounted = new Set<ReactTestRenderer>();
const ascii = (value: string) => new TextEncoder().encode(value);
function row(id: string, name: string | Uint8Array) {
  // Opaque ignored columns deliberately are not station coordinates/elevation.
  const bytes = new Uint8Array(52).fill(32), label = typeof name === 'string' ? ascii(name) : name;
  assert.equal(id.length, 5); assert.ok(label.length <= 20);
  bytes.set(ascii(id), 0); bytes.set(ascii('ABCD'), 6); bytes.set(label, 11);
  bytes.set(ascii('ABCDEF'), 32); bytes.set(ascii('GHIJKLM'), 39); bytes.set(ascii('NOPQR'), 47); return bytes;
}
function catalog(rows = [row('99999', 'Synthetic North'), row('01234', 'north MiXeD'), row(' A051', new Uint8Array([0xc3, 0xa9]))]) {
  const parts = [ascii('ID    ICAO NAME                 LAT    LON     ELEV'), ascii('----- ---- -------------------- -----  ------- -----'), ...rows];
  const bytes = new Uint8Array(parts.reduce((n, part) => n + part.length + 1, 0)); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; bytes[offset++] = 10; } return bytes;
}
function matches(query = 'north', bytes = catalog()) {
  const result = searchDwdMosmixStationCatalogBytes(bytes, query);
  assert.notEqual(result.status, 'failed', 'Synthetic fixtures must pass the real canonical parser/search authority');
  if (result.status === 'failed') throw Error('Invalid independent fixture'); return result;
}
function searchProvider(next: (query: string) => Promise<DwdMosmixCatalogSearchResult> = async query => matches(query)): Props['searchCatalog'] {
  return (...args: [string]) => { probe.searches.push(args); return next(...args); };
}
function selector(): Props['onSelectStation'] { return stationId => { probe.selections.push(stationId); }; }
function deferred() {
  let resolve!: (value: DwdMosmixCatalogSearchResult) => void, reject!: (error: Error) => void;
  const promise = new Promise<DwdMosmixCatalogSearchResult>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function readable(node: ReactTestInstance) { return text(node).replace(/\s+/g, ' ').trim(); }
async function settle(operation: () => void) { await act(async () => { operation(); await Promise.resolve(); }); }
function mount(props: Partial<Props> = {}, strict = false) {
  let renderer!: ReactTestRenderer, current: Props = { searchCatalog: searchProvider(), onSelectStation: selector(), ...props }, owner = 'A';
  const element = () => { const node = React.createElement(Card, { ...current, key: owner });
    return strict ? React.createElement(React.StrictMode, null, node) : node; };
  act(() => { renderer = create(element()); }); mounted.add(renderer);
  const scope = () => renderer.root.findByType(Card);
  const input = () => scope().findByType('input');
  const uses = () => scope().findAllByType('button').filter(button => /^Use station /.test(readable(button)));
  const search = () => scope().findAllByType('button').find(button => !/^Use station /.test(readable(button)))!;
  return { renderer, scope, input, uses, search, props: () => current, text: () => readable(scope()), rawText: () => text(scope()),
    edit(value: unknown) { act(() => input().props.onChange({ target: { value } })); },
    async check() { await act(async () => { search().props.onClick(); await Promise.resolve(); }); },
    use(index = 0) { act(() => uses()[index].props.onClick()); },
    update(patch: Partial<Props> = {}) { current = { ...current, ...patch }; act(() => renderer.update(element())); },
    owner(next: string) { owner = next; act(() => renderer.update(element())); },
    replayEffects() {
      assert.equal(mounted.size, 1); const live = probe.lifecycles.filter(entry => entry.active);
      assert.ok(live.some(entry => typeof entry.cleanup === 'function'), 'The actual component must retire its mounted owner');
      act(() => {
        for (const entry of live) { entry.active = false; if (typeof entry.cleanup === 'function') entry.cleanup(); }
        for (const entry of live) { entry.active = true; entry.cleanup = entry.setup(); }
      });
    },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
}
function assertStaticHold(ui: ReturnType<typeof mount>) {
  assert.equal(ui.uses().length, 0); assert.doesNotMatch(ui.text(), /PRIVATE_|STALE_|RETIRED_/);
  // Duplicate identity explains a held catalogue itself; each failure family
  // below still checks its specific explanation, not a mandatory shared verb.
  assert.match(readable(ui.scope().findByProps({ role: 'status' })), /(?:ASCII|could not|cannot|unable|invalid|held|not match|not accepted|unsupported|not supported|failed|exceeded|unavailable|outside.*profile|duplicate|ambiguous)/i);
}
beforeEach(() => { effects.network = effects.storage = 0; probe.searches.length = probe.selections.length = probe.lifecycles.length = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); assert.deepEqual(effects, { network: 0, storage: 0 });
});
after(() => {
  hooks.deregister(); for (const [name, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
  }
});

test('mount, input edits and stable prop rerenders never request or select, while the English reference discloses its limits', watchdog, context => {
  context.diagnostic(`Actual loaded catalogue-search card SHA256: ${probe.sourceSha256}`);
  assert.deepEqual(importEffects, { network: 0, storage: 0 }); const ui = mount();
  assert.equal(ui.input().props.value, ''); assert.equal(ui.input().props.type, 'text');
  const section = ui.scope().findByType('section'); assert.equal(section.props.lang, 'en'); assert.match(section.props.className, /min-w-0/);
  const label = ui.scope().findByType('label'); assert.ok(readable(label));
  assert.ok(label.findAllByType('input').includes(ui.input()) || label.props.htmlFor === ui.input().props.id);
  assert.match(ui.text(), /ASCII/); assert.match(ui.text(), /name.*ID|ID.*name/i);
  assert.match(ui.text(), /nearest station/i); assert.match(ui.text(), /country/i); assert.match(ui.text(), /farm suitability|suitability.*farm/i);
  assert.match(ui.text(), /DWD|Deutscher Wetterdienst/); assert.match(ui.text(), /MOSMIX/);
  assert.match(ui.text(), /extract/i); assert.match(ui.text(), /display/i);
  assert.equal(ui.scope().findByProps({ role: 'status' }).props['aria-live'], 'polite');
  const links = ui.scope().findAllByType('a'); assert.deepEqual(new Set(links.map(link => link.props.href)), new Set([
    'https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix.html', 'https://www.dwd.de/copyright', 'https://creativecommons.org/licenses/by/4.0/',
  ]));
  for (const node of [ui.input(), ui.search(), ...links]) assert.match(node.props.className, /min-h-11/);
  assert.equal(ui.uses().length, 0); ui.edit('north'); ui.update();
  assert.deepEqual(probe.searches, []); assert.deepEqual(probe.selections, []);
});

test('invalid strings stay literal and use the ASCII-profile explanation instead of making a no-station claim', watchdog, async () => {
  const ui = mount();
  for (const query of ['', '   ', '\t', 'north\n', 'north\r', 'café', 'cafe\u0301', '\u00a0north', '０１２３４', 'north\u2028', 'x'.repeat(65), ' '.repeat(60) + '01234']) {
    assert.equal(parseDwdMosmixCatalogSearchQuery(query), null); ui.edit(query); await ui.check();
    assert.equal(ui.input().props.value, query); assert.deepEqual(probe.searches, []); assert.deepEqual(probe.selections, []);
    assert.match(ui.text(), /ASCII/); assert.equal(ui.uses().length, 0);
    assert.doesNotMatch(ui.text(), /no stations? (?:exist|available|found)|no relevant station/i);
  }
});

test('hostile non-string input cannot be coerced into a query or invoke ordinary getters', watchdog, async () => {
  let coercions = 0;
  const hostile = Object.defineProperties({}, { toString: { get() { coercions++; throw Error('PRIVATE_QUERY_COERCION'); } },
    [Symbol.toPrimitive]: { get() { coercions++; throw Error('PRIVATE_QUERY_PRIMITIVE'); } } });
  const ui = mount();
  for (const query of [null, undefined, 0, false, hostile, new String('north'), Symbol('north')]) {
    ui.edit(query); await ui.check(); assert.equal(coercions, 0); assert.deepEqual(probe.searches, []); assert.equal(ui.uses().length, 0);
  }
});

test('the single query authority preserves case, internal spaces and literal punctuation while normalizing only ASCII edge spaces', watchdog, async () => {
  const ui = mount();
  for (const query of ['  nOrTh  ', '  Two  Spaces ', '[a].*', 'Q'.repeat(64), ' '.repeat(59) + '01234']) {
    const expected = parseDwdMosmixCatalogSearchQuery(query); assert.ok(expected); ui.edit(query); await ui.check();
    assert.deepEqual(probe.searches.at(-1), [expected]);
  }
  assert.equal(probe.searches.length, 5); assert.equal(probe.selections.length, 0);
});

test('canonical IDs, exact source names, source order and independent counts come from the actual catalogue helper', watchdog, async () => {
  const result = matches('nOrTh'), before = JSON.stringify(result); const ui = mount({ searchCatalog: searchProvider(async () => result) });
  ui.edit('nOrTh'); await ui.check(); assert.deepEqual(ui.uses().map(button => readable(button)), ['Use station 99999', 'Use station 01234']);
  assert.ok(ui.rawText().includes('Synthetic North')); assert.ok(ui.rawText().includes('north MiXeD'));
  assert.match(ui.text(), /2\s*(?:of|\/)\s*2|(?:returned|showing|matches)[^\d]{0,24}2/i);
  assert.match(ui.text(), /(?:catalog|catalogue)[^\d]{0,32}3|3[^\d]{0,24}(?:catalog|catalogue|stations)/i);
  assert.match(ui.text(), /(?:withheld|unknown)[^\d]{0,32}1|1[^\d]{0,24}(?:withheld|unknown)/i);
  assert.match(ui.text(), /encoding.*(?:verified|unverified)|(?:verified|unverified).*encoding/i);
  assert.deepEqual(probe.selections, []); assert.equal(JSON.stringify(result), before);
  ui.use(1); assert.deepEqual(probe.selections, ['01234']); assert.equal(probe.searches.length, 1);
  for (const button of ui.uses()) assert.match(button.props.className, /min-h-11/);
});

test('a withheld null name remains Unknown and selectable only by its canonical ID, never a guessed query label', watchdog, async () => {
  const ui = mount(); ui.edit('a05'); await ui.check();
  assert.deepEqual(ui.uses().map(button => readable(button)), ['Use station A051']); assert.match(ui.text(), /Unknown/);
  assert.doesNotMatch(ui.text(), /café|\uFFFD/); assert.deepEqual(probe.selections, []);
  ui.use(); assert.deepEqual(probe.selections, ['A051']); assert.notEqual(probe.selections[0], 'a05');
});

test('twenty retained rows report the full total honestly without sorting, padding or selecting hidden matches', watchdog, async () => {
  const rows = Array.from({ length: 27 }, (_, i) => row(String(99999 - i), 'COMMON NAME'));
  rows.push(row(' A051', new Uint8Array([0xe9]))); const result = matches('common', catalog(rows));
  const ui = mount({ searchCatalog: searchProvider(async () => result) }); ui.edit('common'); await ui.check();
  assert.equal(ui.uses().length, 20); assert.deepEqual(ui.uses().map(button => readable(button)), result.matches.map(station => 'Use station ' + station.stationId));
  assert.match(ui.text(), /20\s*(?:of|\/)\s*27|(?:returned|showing)[^\d]{0,24}20/i);
  assert.match(ui.text(), /(?:total|of)[^\d]{0,24}27|27[^\d]{0,24}(?:matches|matching)/i);
  assert.match(ui.text(), /(?:catalog|catalogue)[^\d]{0,32}28|28[^\d]{0,24}(?:catalog|catalogue|stations)/i);
  assert.match(ui.text(), /(?:withheld|unknown)[^\d]{0,32}1|1[^\d]{0,24}(?:withheld|unknown)/i);
  for (const station of rows.slice(20, 27)) assert.ok(!ui.text().includes(new TextDecoder().decode(station.slice(0, 5))));
  assert.deepEqual(probe.selections, []);
});

test('zero matches and zero withheld names are explicit counts, not a missing-data or no-relevant-station conclusion', watchdog, async () => {
  const result = matches('absent', catalog([row('01234', 'KNOWN')]));
  const ui = mount({ searchCatalog: searchProvider(async () => result) }); ui.edit('absent'); await ui.check();
  assert.equal(result.totalMatches, 0); assert.equal(result.catalogWithheldNameCount, 0); assert.equal(ui.uses().length, 0);
  assert.match(ui.text(), /no match(?:es|ing stations)/i);
  assert.match(ui.text(), /(?:showing|returned)\s*:?\s*0\s*(?:of|\/)\s*0/i, 'Zero returned/total match counts stay visible independently of the withheld-name count');
  assert.match(ui.text(), /(?:withheld|unknown)[^\d]{0,32}0|0[^\d]{0,24}(?:withheld|unknown)/i);
  assert.match(ui.text(), /does not (?:mean|prove|establish)|not evidence/i); assert.equal(probe.selections.length, 0);
});

for (const returnedQuery of ['NORTH', 'north ', 'different']) test(`a result for ${JSON.stringify(returnedQuery)} cannot relabel the exact requested query or become selectable`, watchdog, async () => {
  const result = { ...matches('north'), query: returnedQuery }; const ui = mount({ searchCatalog: searchProvider(async () => result) });
  ui.edit('north'); await ui.check(); assertStaticHold(ui); assert.deepEqual(probe.selections, []);
  assert.doesNotMatch(ui.text(), /Synthetic North|north MiXeD/);
});

test('accepted edits synchronously retire idle Search and input callbacks across A-B-A, without automatic work', watchdog, async () => {
  const ui = mount(); ui.edit('north'); const oldSearch = ui.search().props.onClick, oldEdit = ui.input().props.onChange;
  ui.edit('a05'); act(() => { oldSearch(); oldEdit({ target: { value: 'changed' } }); });
  assert.equal(ui.input().props.value, 'a05'); assert.deepEqual(probe.searches, []);
  ui.edit('north'); act(() => { oldSearch(); oldEdit({ target: { value: 'changed' } }); });
  assert.equal(ui.input().props.value, 'north'); assert.deepEqual(probe.searches, []);
  await ui.check(); assert.deepEqual(probe.searches, [['north']]);
});

test('pending work clears prior rows, blocks synchronous duplicate calls and programmatic edits, then permits a fresh explicit retry', watchdog, async () => {
  const waiting = deferred(); const ui = mount(); ui.edit('north'); await ui.check(); const oldSelect = ui.uses()[0].props.onClick;
  ui.update({ searchCatalog: searchProvider(() => waiting.promise) }); ui.edit('north'); const search = ui.search().props.onClick;
  act(() => { search(); search(); }); assert.equal(probe.searches.length, 2);
  assert.equal(ui.input().props.disabled, true); assert.equal(ui.search().props.disabled, true); assert.equal(ui.uses().length, 0);
  assert.equal(ui.scope().findByProps({ role: 'status' }).props['aria-busy'], true);
  act(() => { ui.input().props.onChange({ target: { value: 'a05' } }); oldSelect(); });
  assert.equal(ui.input().props.value, 'north'); assert.deepEqual(probe.selections, []);
  await settle(() => waiting.resolve(matches('north'))); assert.equal(ui.input().props.disabled, false);
  act(() => search()); assert.equal(probe.searches.length, 2);
});

test('editing a completed search removes rows and permanently retires their selection callbacks', watchdog, async () => {
  const ui = mount(); ui.edit('north'); await ui.check(); const select = ui.uses()[0].props.onClick;
  ui.edit('a05'); assert.equal(ui.uses().length, 0); act(() => select()); assert.deepEqual(probe.selections, []);
  ui.edit('north'); act(() => select()); assert.deepEqual(probe.selections, []); assert.equal(probe.searches.length, 1);
  await ui.check(); ui.use(); assert.deepEqual(probe.selections, ['99999']);
});

for (const changedProp of ['searchCatalog', 'onSelectStation'] as const) {
  for (const completion of ['resolve', 'reject'] as const) test(`${changedProp} replacement retires pending ${completion} and never requests or selects automatically`, watchdog, async () => {
    const waiting = deferred(); const ui = mount({ searchCatalog: searchProvider(() => waiting.promise) }); ui.edit('north'); await ui.check();
    const search = ui.search().props.onClick;
    ui.update(changedProp === 'searchCatalog' ? { searchCatalog: searchProvider() } : { onSelectStation: selector() });
    const currentView = ui.text();
    await settle(() => completion === 'resolve' ? waiting.resolve({ ...matches('north'), matches: [{ stationId: '01234', name: 'STALE_PROP_RESULT' }] }) : waiting.reject(Error('PRIVATE_OLD_PROP_ERROR')));
    assert.equal(ui.text(), currentView, 'A retired promise cannot publish even a generic error into a replacement prop owner');
    assert.equal(ui.uses().length, 0); assert.doesNotMatch(ui.text(), /STALE_PROP_RESULT|PRIVATE_OLD_PROP_ERROR/);
    assert.equal(ui.input().props.disabled, false); act(() => search()); assert.equal(probe.searches.length, 1); assert.deepEqual(probe.selections, []);
  });
}

for (const changedProp of ['searchCatalog', 'onSelectStation'] as const) {
  for (const completion of ['resolve', 'reject'] as const) test(`${changedProp} A-B-A prop ownership cannot revive a pending ${completion}`, watchdog, async () => {
    const waiting = deferred(), aSearch = searchProvider(() => waiting.promise), bSearch = searchProvider();
    const aSelect = selector(), bSelect = selector(); const ui = mount({ searchCatalog: aSearch, onSelectStation: aSelect });
    ui.edit('north'); await ui.check();
    ui.update(changedProp === 'searchCatalog' ? { searchCatalog: bSearch } : { onSelectStation: bSelect });
    ui.update(changedProp === 'searchCatalog' ? { searchCatalog: aSearch } : { onSelectStation: aSelect });
    const currentView = ui.text();
    await settle(() => completion === 'resolve' ? waiting.resolve(matches('north')) : waiting.reject(Error('PRIVATE_ABA_PROP_ERROR')));
    assert.equal(ui.text(), currentView); assert.equal(ui.uses().length, 0);
    assert.equal(ui.input().props.disabled, false); assert.equal(probe.searches.length, 1); assert.deepEqual(probe.selections, []);
  });
  test(`${changedProp} A-B-A prop ownership cannot renew a retained input callback`, watchdog, () => {
    const aSearch = searchProvider(), bSearch = searchProvider(), aSelect = selector(), bSelect = selector();
    const ui = mount({ searchCatalog: aSearch, onSelectStation: aSelect }); ui.edit('north'); const oldEdit = ui.input().props.onChange;
    ui.update(changedProp === 'searchCatalog' ? { searchCatalog: bSearch } : { onSelectStation: bSelect });
    ui.update(changedProp === 'searchCatalog' ? { searchCatalog: aSearch } : { onSelectStation: aSelect });
    const currentValue = ui.input().props.value; act(() => oldEdit({ target: { value: 'changed' } }));
    assert.equal(ui.input().props.value, currentValue); assert.deepEqual(probe.searches, []); assert.deepEqual(probe.selections, []);
  });
}

test('search callback A-B-A replacement cannot renew old idle Search or completed-result selection authority', watchdog, async () => {
  const a = searchProvider(), b = searchProvider(); const ui = mount({ searchCatalog: a }); ui.edit('north');
  const oldSearch = ui.search().props.onClick; ui.update({ searchCatalog: b }); ui.update({ searchCatalog: a });
  act(() => oldSearch()); assert.deepEqual(probe.searches, []); ui.edit('north'); await ui.check(); const oldSelect = ui.uses()[0].props.onClick;
  ui.update({ searchCatalog: b }); ui.update({ searchCatalog: a }); act(() => oldSelect()); assert.deepEqual(probe.selections, []);
});

test('selection callback A-B-A replacement cannot reroute a retained result button to either callback', watchdog, async () => {
  const aCalls: string[] = [], bCalls: string[] = []; const a = (id: string) => { aCalls.push(id); }, b = (id: string) => { bCalls.push(id); };
  const ui = mount({ onSelectStation: a }); ui.edit('north'); await ui.check();
  const oldSelect = ui.uses()[0].props.onClick, oldSearch = ui.search().props.onClick;
  ui.update({ onSelectStation: b }); act(() => oldSelect()); ui.update({ onSelectStation: a }); act(() => oldSelect());
  assert.deepEqual(aCalls, []); assert.deepEqual(bCalls, []);
  act(() => oldSearch()); assert.equal(probe.searches.length, 1);
  ui.edit('north'); await ui.check(); ui.use(1); assert.deepEqual(aCalls, ['01234']); assert.deepEqual(bCalls, []);
});

test('stable callback prop rerenders preserve a current result and one explicit canonical selection', watchdog, async () => {
  const ui = mount(); ui.edit('north'); await ui.check(); ui.update();
  assert.equal(ui.uses().length, 2); ui.use(); assert.deepEqual(probe.selections, ['99999']); assert.deepEqual(probe.searches, [['north']]);
});

for (const completion of ['resolve', 'reject'] as const) test(`unmount and keyed owner A-B-A retire all pending work and retained callbacks before late ${completion}`, watchdog, async () => {
  const waiting = deferred(); const ui = mount({ searchCatalog: searchProvider(() => waiting.promise) }); ui.edit('north'); await ui.check();
  const oldSearch = ui.search().props.onClick, oldEdit = ui.input().props.onChange;
  ui.owner('B'); ui.owner('A'); act(() => { oldSearch(); oldEdit({ target: { value: 'a05' } }); });
  await settle(() => completion === 'resolve' ? waiting.resolve({ ...matches('north'), matches: [{ stationId: '01234', name: 'STALE_OWNER_RESULT' }] }) : waiting.reject(Error('PRIVATE_OLD_OWNER_ERROR')));
  assert.equal(ui.input().props.value, ''); assert.equal(ui.uses().length, 0); assert.equal(probe.searches.length, 1); assert.deepEqual(probe.selections, []);
  assert.doesNotMatch(ui.text(), /STALE_OWNER_RESULT|PRIVATE_OLD_OWNER_ERROR/);
});

test('an unmounted completed result cannot select a station through its retained Use callback', watchdog, async () => {
  const ui = mount(); ui.edit('north'); await ui.check(); const oldSelect = ui.uses()[0].props.onClick; ui.dispose();
  act(() => oldSelect()); assert.deepEqual(probe.selections, []); assert.equal(probe.searches.length, 1);
});

test('StrictMode mount replay makes no request and leaves current explicit Search and Use controls working', watchdog, async () => {
  const ui = mount({}, true); assert.deepEqual(probe.searches, []); assert.deepEqual(probe.selections, []);
  ui.edit('north'); await ui.check(); ui.use(); assert.deepEqual(probe.searches, [['north']]); assert.deepEqual(probe.selections, ['99999']);
});

for (const completion of ['resolve', 'reject'] as const) test(`real-state/ref cleanup/setup seam retires pending ${completion} without a DOM scheduling claim`, watchdog, async () => {
  const waiting = deferred(); const ui = mount({ searchCatalog: searchProvider(() => waiting.promise) }); ui.edit('north'); await ui.check(); ui.replayEffects();
  const currentView = ui.text();
  await settle(() => completion === 'resolve' ? waiting.resolve({ ...matches('north'), matches: [{ stationId: '01234', name: 'RETIRED_GENERATION_RESULT' }] }) : waiting.reject(Error('PRIVATE_RETIRED_GENERATION')));
  assert.equal(ui.text(), currentView);
  assert.equal(ui.uses().length, 0); assert.doesNotMatch(ui.text(), /RETIRED_GENERATION_RESULT|PRIVATE_RETIRED_GENERATION|could not be completed|unexpected error/i);
  assert.equal(probe.searches.length, 1); assert.deepEqual(probe.selections, []);
});

const failureCopy: Record<Extract<DwdMosmixCatalogSearchResult, { status: 'failed' }>['reason'], RegExp> = {
  'invalid-query': /query|ASCII/i, 'invalid-byte-input': /catalog|catalogue|bytes/i,
  'invalid-catalog': /catalog|catalogue/i, 'unsupported-profile': /profile|format|support/i,
  'unsupported-station-id': /station.*ID|identifier/i, 'ambiguous-catalog': /ambiguous|duplicate|identity|repeat/i,
  'software-bound': /limit|bound|large/i,
};
for (const reason of Object.keys(failureCopy) as (keyof typeof failureCopy)[]) test(`${reason} is a held search, never a no-match or selectable partial catalogue`, watchdog, async () => {
  const ui = mount({ searchCatalog: searchProvider(async () => ({ status: 'failed', reason })) }); ui.edit('north'); await ui.check();
  assertStaticHold(ui); assert.match(ui.text(), failureCopy[reason]); assert.equal(probe.searches.length, 1);
  assert.doesNotMatch(ui.text(), /no matches|no stations? (?:exist|found)/i); assert.deepEqual(probe.selections, []);
  assert.equal(ui.input().props.disabled, false); assert.equal(ui.search().props.disabled, false);
});

test('unexpected provider rejection uses static copy, clears pending and allows only an explicit fresh retry', watchdog, async () => {
  const waiting = deferred(); const ui = mount({ searchCatalog: searchProvider(() => waiting.promise) }); ui.edit('north'); await ui.check();
  const old = ui.search().props.onClick; await settle(() => waiting.reject(Error('PRIVATE_PROVIDER_ERROR_DETAIL')));
  assertStaticHold(ui); assert.equal(ui.input().props.disabled, false); assert.equal(ui.search().props.disabled, false);
  act(() => old()); assert.equal(probe.searches.length, 1); assert.deepEqual(probe.selections, []);
  ui.update({ searchCatalog: searchProvider() }); ui.edit('north'); await ui.check(); assert.equal(probe.searches.length, 2); assert.equal(ui.uses().length, 2);
});

test('a synchronous provider throw is static and cannot strand the query controls pending', watchdog, async () => {
  const ui = mount({ searchCatalog: searchProvider(() => { throw Error('PRIVATE_SYNCHRONOUS_DETAIL'); }) }); ui.edit('north'); await ui.check();
  assertStaticHold(ui); assert.equal(ui.input().props.disabled, false); assert.equal(ui.search().props.disabled, false); assert.equal(probe.searches.length, 1);
});
