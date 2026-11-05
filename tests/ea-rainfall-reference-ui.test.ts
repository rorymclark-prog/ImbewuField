import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { EaRainfallPublicDemoResult } from '../lib/international/providers/ea-rainfall-public-demo.ts';

const contractBytes = readFileSync(new URL('../docs/international/EA-RAINFALL-REFERENCE-CONTRACT.json', import.meta.url));
assert.equal(createHash('sha256').update(contractBytes).digest('hex'), '7fbbd63d878d4289cd99954f20c67c5415a577729134de36587ac0841f6c5757');
const contract = JSON.parse(contractBytes.toString('utf8'));
const receipt = '2026-11-05T06:03:04.005Z', reported = '2026-11-04T09:15:00-03:30';
const prior = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', '__eaRainfallUi', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 };
const forbiddenStorage = () => { effects.storage++; throw Error('Public reference UI must not access storage'); };
const forbiddenFetch = () => { effects.network++; throw Error('Public reference UI must use its server action'); };
const probe = { calls: 0, next: null as null | (() => Promise<EaRainfallPublicDemoResult>) };
const browser = Object.defineProperties({}, { localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: forbiddenFetch }, window: { value: browser }, localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage }, __eaRainfallUi: { value: probe }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const root = new URL('../', import.meta.url).href;
const asModule = (code: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
// The card, actual parent, registry and pure decoder execute. Server action
// transport and unrelated framework chrome/CSS are the only substitutions;
// synthetic public-response shapes below are not live retrieval evidence.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/international/countries/EaRainfallReference.tsx') && specifier === '@/app/international/ea-rainfall-actions') {
      return asModule('export function checkEaRainfallPublicDemo(){const p=globalThis.__eaRainfallUi;p.calls++;return p.next();}');
    }
    if (context.parentURL?.startsWith(root) && specifier.endsWith('.module.css')) {
      const css = readFileSync(new URL(specifier, context.parentURL), 'utf8');
      return asModule(`export default ${JSON.stringify(Object.fromEntries([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(match => [match[1], match[1]])))};`);
    }
    if (context.parentURL?.endsWith('/components/international/countries/CountryReview.tsx')) {
      if (specifier === 'next/link') return asModule(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement("a",props,children);}`);
      if (specifier === '@/components/MenuButton') return asModule('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return asModule('export function useRegisterBackControl(){}');
    }
    if (context.parentURL?.endsWith('/components/international/countries/NwsForecastReference.tsx') && specifier === '@/app/international/nws-actions') return asModule('export function checkNwsPublicDemo(){return globalThis.fetch("forbidden-unrelated-request");}');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
// These require the actual native decoder; no stand-in provider is created.
const { decodeEaRainfallReference, EA_RAINFALL_REFERENCE_PROVIDER } = await import('../lib/international/providers/ea-rainfall-reference.ts');
const { COUNTRY_PROFILES } = await import('../lib/international/countries/registry.ts');
const { default: Card } = await import('../components/international/countries/EaRainfallReference.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const importEffects = { ...effects }, profilesBefore = JSON.stringify(COUNTRY_PROFILES);
function sourceRow(): Record<string, unknown> { return { value: 0, dateTime: reported,
  measure: { parameter: 'rainfall', unitName: 'mm', period: 900, valueType: 'total' },
  stationReference: 'discarded-station-marker', arbitraryUrl: 'https://untrusted.example.invalid/hidden-marker' }; }
const decode = (items: unknown = [sourceRow()], fetchedAt: unknown = receipt) => decodeEaRainfallReference({ meta: { limit: 1 }, items }, fetchedAt);
function deferred() { let resolve!: (value: EaRainfallPublicDemoResult) => void, reject!: (reason: Error) => void;
  const promise = new Promise<EaRainfallPublicDemoResult>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(parent = false) {
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(parent ? CountryReview : Card)); }); mounted.add(renderer);
  const card = () => renderer.root.findByProps({ 'aria-label': 'Environment Agency public rainfall network reference' });
  const button = () => card().findByType('button');
  const field = (label: string) => { const row = renderer.root.findAllByType('label').find(node => text(node).startsWith(label)); assert.ok(row); return row.findAll(node => node.type === 'input' || node.type === 'select')[0]; };
  return { renderer, card, button, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    async click() { await act(async () => { button().props.onClick(); await Promise.resolve(); }); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; probe.calls = 0; probe.next = async () => decode(); });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 }); assert.equal(JSON.stringify(COUNTRY_PROFILES), profilesBefore);
});
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('imports and mounting make no request or storage access, with honest network scope and safe 44px source links', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0 }); const ui = mount(); assert.equal(probe.calls, 0);
  assert.match(ui.text(), /not a reading for your farm/); assert.match(ui.text(), /Latest available data can be delayed/);
  assert.match(ui.text(), /No rainfall reference has been requested/); assert.doesNotMatch(ui.text(), /0 mm|network reference received/);
  assert.ok(ui.text().includes(contract.provider.attribution));
  const anchors = ui.card().findAllByType('a'); assert.deepEqual(anchors.map(node => node.props.href), [contract.provider.docsUrl, contract.provider.referenceUrl, contract.provider.licenceUrl]);
  for (const link of anchors) { assert.equal(link.props.target, '_blank'); assert.equal(link.props.rel, 'noopener noreferrer'); assert.equal(link.props.referrerPolicy, 'no-referrer'); assert.match(link.props.className, /min-h-11/); assert.match(link.props.className, /max-w-full/); }
  const details = ui.card().findByType('details'); assert.notEqual(details.props.open, true); assert.match(details.findByType('summary').props.className, /min-h-11/);
  assert.match(text(details), /Quality statusUnknown/); assert.match(text(details), /Accumulation time boundariesUnknown/);
  assert.ok(text(details).includes(contract.provider.coverage)); assert.match(ui.button().props.className, /min-h-11/);
  assert.match(ui.card().props.className, /min-w-0/); assert.equal(ui.card().findByProps({ role: 'status' }).props['aria-live'], 'polite');
});

test('a genuine zero remains 0 mm for the 900-second total, with raw reported time and retrieval receipt kept separate', async () => {
  const row = sourceRow(), original = JSON.stringify(row); probe.next = async () => decode([row]);
  const ui = mount(); await ui.click(); assert.equal(probe.calls, 1);
  assert.match(ui.text(), /Accumulated rainfall total · 900 seconds0 mm/);
  assert.ok(ui.text().includes(reported)); assert.ok(ui.text().includes(receipt));
  assert.match(ui.text(), /Source-reported time · unverified text/); assert.match(ui.text(), /not independently verified as a timestamp/);
  assert.match(ui.text(), /Whether it marks the accumulation’s start or end is unknown/);
  assert.match(ui.text(), /Response retrieved at:/); assert.match(ui.text(), /Retrieval does not establish measurement freshness/);
  assert.doesNotMatch(ui.text(), /discarded-station-marker|hidden-marker/); assert.equal(JSON.stringify(row), original);
  assert.equal(ui.card().findAllByType('time').length, 0, 'opaque source text is not promoted to a verified HTML date-time');
});

test('fractional source quantity and opaque non-calendar reported text are displayed without rounding or date interpretation', async () => {
  const row = sourceRow(); row.value = 1.23456789; row.dateTime = 'provider-reported-sequence-unknown-calendar';
  probe.next = async () => decode([row]); const ui = mount(); await ui.click();
  assert.match(ui.text(), /1\.23456789 mm/); assert.match(ui.text(), /provider-reported-sequence-unknown-calendar/);
  assert.match(ui.text(), /not independently verified as a timestamp/);
});

for (const missing of ['value', 'dateTime', 'both'] as const) test(`absent ${missing} stays independently Unknown rather than borrowing zero or another date`, async () => {
  const row = sourceRow(); if (missing !== 'dateTime') delete row.value; if (missing !== 'value') delete row.dateTime;
  probe.next = async () => decode([row]); const ui = mount(); await ui.click();
  assert.match(ui.text(), /Partial network reference/);
  const values = ui.card().findAllByType('dd').slice(0, 2).map(node => text(node));
  assert.equal(values[0], missing === 'dateTime' ? '0 mm' : 'Unknown'); assert.equal(values[1], missing === 'value' ? reported : 'Unknown');
  assert.ok(ui.text().includes(receipt));
});

test('an empty bounded response has no reading and never becomes a zero-rainfall measurement', async () => {
  probe.next = async () => decode([]); const ui = mount(); await ui.click();
  assert.match(ui.text(), /No reading was returned/); assert.match(ui.text(), /Missing is not zero rainfall/);
  assert.doesNotMatch(ui.text(), /0 mm|Accumulated rainfall total|Source-reported time/);
});

for (const variant of ['null-value', 'negative-value', 'wrong-period', 'wrong-unit', 'too-many'] as const) test(`actual decoder ${variant} hold reaches the action boundary without exposing a substitute measurement`, async () => {
  const row = sourceRow();
  if (variant === 'null-value') row.value = null;
  if (variant === 'negative-value') row.value = -1;
  if (variant === 'wrong-period') row.measure = { parameter: 'rainfall', unitName: 'mm', period: 60, valueType: 'total' };
  if (variant === 'wrong-unit') row.measure = { parameter: 'rainfall', unitName: 'cm', period: 900, valueType: 'total' };
  const result = decode(variant === 'too-many' ? [row, row] : [row]); assert.equal(result.status, 'failed');
  probe.next = async () => result; const ui = mount(); await ui.click();
  assert.match(ui.text(), /Values are withheld/); assert.doesNotMatch(ui.text(), /0 mm|Accumulated rainfall total|discarded-station-marker/);
  assert.equal(probe.calls, 1); assert.equal(ui.button().props.disabled, false);
});

test('missing retrieval provenance stays Unknown and cannot fabricate a receipt or measurement', async () => {
  probe.next = async () => decode([sourceRow()], null); const ui = mount(); await ui.click();
  assert.match(ui.text(), /retrieval receipt could not be checked/); assert.match(ui.text(), /Response retrieved at: Unknown/);
  assert.doesNotMatch(ui.text(), /0 mm|Accumulated rainfall total/);
});

test('new requests withdraw old values immediately and synchronous or retained buttons cannot start extra work', async () => {
  const ui = mount(), initial = ui.button().props.onClick; await ui.click(); assert.match(ui.text(), /0 mm/);
  const waiting = deferred(); probe.next = () => waiting.promise; const retained = ui.button().props.onClick;
  act(() => { retained(); retained(); initial(); });
  assert.equal(probe.calls, 2); assert.equal(ui.button().props.disabled, true); assert.doesNotMatch(ui.text(), /0 mm|Source-reported time|Response retrieved at:/);
  await act(async () => { waiting.resolve(decode([])); });
  assert.match(ui.text(), /No reading was returned/); act(() => { initial(); retained(); }); assert.equal(probe.calls, 2);
  probe.next = async () => decode(); await ui.click(); assert.equal(probe.calls, 3);
});

for (const reason of ['timeout', 'network-error', 'http-error', '__proto__'] as const) test(`transport ${reason} failure uses safe static copy and never retries automatically`, async () => {
  probe.next = async () => {
    const result = { status: 'failed', reason, stage: 'request', provenance: { providerId: 'ea-rainfall-public-reference', endpoint: EA_RAINFALL_REFERENCE_PROVIDER.endpoint, fetchedAt: null, referenceOnly: true } } as const;
    // An unexpected transport reason is deliberately outside the typed union;
    // it must still use static fallback copy rather than an inherited object.
    return result as unknown as EaRainfallPublicDemoResult;
  };
  const ui = mount(); await ui.click(); assert.equal(probe.calls, 1); assert.match(ui.text(), /No automatic retry/);
  assert.doesNotMatch(ui.text(), /0 mm|Accumulated rainfall total|__proto__/); assert.equal(ui.button().props.disabled, false);
});

test('rejected action settles the pending indicator without displaying raw failure bodies', async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const ui = mount(); await ui.click(); assert.equal(ui.button().props.disabled, true);
  await act(async () => { waiting.reject(new Error('private transport marker')); });
  assert.match(ui.text(), /public reference check could not be completed/); assert.doesNotMatch(ui.text(), /private transport marker|0 mm/);
  assert.equal(ui.button().props.disabled, false); assert.equal(probe.calls, 1);
});

test('the actual parent mounts only in GB and country withdrawal/reentry cannot surface an earlier response', async () => {
  const ui = mount(true); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Environment Agency public rainfall network reference' }).length, 0);
  ui.change('Country', 'GB'); assert.equal(probe.calls, 0); assert.match(text(ui.card()), /No rainfall reference has been requested/);
  const waiting = deferred(); probe.next = () => waiting.promise; const oldButton = ui.button().props.onClick; await ui.click();
  ui.change('Country', 'OTHER'); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Environment Agency public rainfall network reference' }).length, 0);
  ui.change('Country', 'GB'); await act(async () => { waiting.resolve(decode()); }); act(() => oldButton());
  assert.equal(probe.calls, 1); assert.match(text(ui.card()), /No rainfall reference has been requested/); assert.doesNotMatch(text(ui.card()), /0 mm/);
  probe.next = async () => decode(); await ui.click(); assert.equal(probe.calls, 2); assert.match(text(ui.card()), /0 mm/);
});

test('an unmounted pending card discards late rejection and its retained button cannot request for a new mount', async () => {
  const waiting = deferred(); probe.next = () => waiting.promise; const old = mount(), retained = old.button().props.onClick; await old.click(); old.dispose();
  const current = mount(); await act(async () => { waiting.reject(new Error('late source marker')); }); act(() => retained());
  assert.equal(probe.calls, 1); assert.match(current.text(), /No rainfall reference has been requested/); assert.doesNotMatch(current.text(), /could not be completed|late source marker/);
});
