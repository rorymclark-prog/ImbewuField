import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { NWS_REFERENCE_PROVIDER } from '../lib/international/providers/nws-reference.ts';
import type { NwsPublicDemoFailure, NwsPublicDemoResult } from '../lib/international/providers/nws-public-demo.ts';

const prior = new Map(['__nwsReferenceUi', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const probe = { calls: 0, next: (() => Promise.resolve<NwsPublicDemoResult>(available())) as () => Promise<NwsPublicDemoResult> };
Object.assign(globalThis, { __nwsReferenceUi: probe, IS_REACT_ACT_ENVIRONMENT: true });
const componentUrl = new URL('../components/international/countries/NwsForecastReference.tsx', import.meta.url).href;
// The real component and provider constants run unchanged. Only the server
// action transport is replaced; these synthetic decoded DTOs are not live
// forecast API responses or an independent test of the gateway/decoder.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl && specifier === '@/app/international/nws-actions') return { shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent('export const checkNwsPublicDemo=()=>{const p=globalThis.__nwsReferenceUi;p.calls++;return p.next();};') };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
const { default: Card } = await import('../components/international/countries/NwsForecastReference.tsx');
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function available(): Extract<NwsPublicDemoResult, { status: 'available' | 'partial' }> {
  return { status: 'available', units: 'C', metadata: { generatedAt: '2026-11-05T06:01:00+00:00', updateTime: '2026-11-05T00:30:00+00:00',
    validTimes: '2026-11-05T01:00:00+00:00/P7DT11H', sourceUnits: 'si' },
    provenance: { providerId: 'nws-forecast-reference', referenceOnly: true, demoPlace: 'Synthetic public Washington point',
      endpoint: 'https://api.weather.gov/gridpoints/LWX/1,2/forecast?units=si', fetchedAt: '2026-11-05T06:02:03.456Z' },
    periods: [
      { number: 1, name: 'Synthetic zero', startTime: '2026-11-05T06:00:00-05:00', endTime: '2026-11-05T18:00:00-05:00', isDaytime: true,
        temperatureC: 0, precipitationPercent: 0, shortForecast: 'Source summary zero', detailedForecast: 'Independent source prose, not inferred from numeric values.' },
      { number: 2, name: 'Synthetic negative', startTime: '2026-11-05T18:00:00-05:00', endTime: '2026-11-06T06:00:00-05:00', isDaytime: false,
        temperatureC: -2.125, precipitationPercent: 12.5, shortForecast: 'Source summary negative', detailedForecast: 'Synthetic source detail.' },
      { number: 3, name: 'Synthetic fractional', startTime: '2026-11-06T06:00:00-05:00', endTime: '2026-11-06T18:00:00-05:00', isDaytime: true,
        temperatureC: 17.77777777777778, precipitationPercent: 23, shortForecast: 'Source summary fractional', detailedForecast: 'Do not substitute prose rounding for the numeric value.' },
    ] };
}
function mount(strict = false) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(strict ? React.createElement(React.StrictMode, null, React.createElement(Card)) : React.createElement(Card)); });
  mounted.add(renderer);
  return { renderer, text: () => text(renderer.root), button: () => renderer.root.findByType('button'),
    async click() { await act(async () => { renderer.root.findByType('button').props.onClick(); await Promise.resolve(); }); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
function deferred() {
  let resolve!: (value: NwsPublicDemoResult) => void, reject!: (reason: Error) => void;
  const promise = new Promise<NwsPublicDemoResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { probe.calls = 0; probe.next = async () => available(); });
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('mounting the public Washington card makes no request and does not present empty data as zero or farm conditions', () => {
  const ui = mount();
  assert.equal(probe.calls, 0); assert.match(ui.text(), /No forecast has been requested/);
  assert.match(ui.text(), /coarse public Washington demonstration, not current conditions at your farm/);
  assert.match(ui.text(), /do not change crop advice, planning dates or country readiness/);
  assert.doesNotMatch(ui.text(), /0 °C|0%|Public forecast reference received/);
  assert.match(ui.button().props.className, /min-h-11/);
  const links = ui.renderer.root.findAllByType('a');
  assert.deepEqual(links.map(link => link.props.href), [NWS_REFERENCE_PROVIDER.apiDocsUrl, NWS_REFERENCE_PROVIDER.disclaimerUrl]);
  for (const link of links) assert.match(link.props.className, /min-h-11/);
  assert.equal(ui.renderer.root.findByProps({ role: 'status' }).props['aria-live'], 'polite');
  assert.match(ui.renderer.root.findByType('section').props.className, /min-w-0/);
});

test('available reference keeps zero, negative and fractional numeric values and all four original timestamp meanings', async () => {
  const result = available(), before = JSON.stringify(result); probe.next = async () => result;
  const ui = mount(); await ui.click();
  assert.equal(probe.calls, 1); assert.match(ui.text(), /0 °C/); assert.match(ui.text(), /0%/);
  assert.match(ui.text(), /-2\.125 °C/); assert.match(ui.text(), /12\.5%/); assert.match(ui.text(), /17\.77777777777778 °C/);
  const labels = ui.renderer.root.findAllByType('dt').map(node => text(node));
  for (const label of ['Source generatedAt', 'Underlying source updateTime', 'Source validTimes interval', 'Response retrieved at']) assert.ok(labels.includes(label));
  for (const raw of [result.metadata.generatedAt, result.metadata.updateTime, result.metadata.validTimes, result.provenance.fetchedAt,
    result.periods[0].startTime, result.periods[0].endTime, result.periods[0].detailedForecast!]) assert.ok(ui.text().includes(raw));
  assert.equal(JSON.stringify(result), before);
  assert.equal(ui.renderer.root.findAllByType('table').length, 0, 'period cards keep long offset strings wrapping on narrow layouts');
  for (const row of ui.renderer.root.findAllByType('li')) assert.match(row.props.className, /min-w-0/);
});

test('partial null measurements and source prose remain Unknown independently, never inferred from one another', async () => {
  const result = available(); result.status = 'partial';
  result.periods = [{ ...result.periods[0], name: null, temperatureC: null, precipitationPercent: null,
    shortForecast: null, detailedForecast: 'Source prose does not supply missing numeric measurements.' }];
  probe.next = async () => result; const ui = mount(); await ui.click();
  assert.match(ui.text(), /Partial public reference/);
  const row = ui.renderer.root.findByType('li');
  assert.match(text(row), /Period 1: Unknown/);
  assert.deepEqual(row.findAllByType('dd').slice(-2).map(node => text(node)), ['Unknown', 'Unknown']);
  assert.match(text(row), /NWS source summaryUnknown/);
  assert.match(text(row), /Source prose does not supply missing numeric measurements/);
  assert.doesNotMatch(text(row), /0 °C|0%/);
});

test('a new explicit request withdraws prior values and synchronous duplicate or retained callbacks cannot start another request', async () => {
  const ui = mount(), initial = ui.button().props.onClick; await ui.click();
  assert.match(ui.text(), /17\.77777777777778/);
  const request = deferred(); probe.next = () => request.promise;
  const current = ui.button().props.onClick;
  act(() => { current(); current(); initial(); });
  assert.equal(probe.calls, 2); assert.equal(ui.button().props.disabled, true);
  assert.match(ui.text(), /request is in progress/); assert.doesNotMatch(ui.text(), /17\.77777777777778|Source generatedAt/);
  await act(async () => { request.resolve(available()); });
  assert.equal(ui.button().props.disabled, false);
  act(() => { current(); initial(); }); assert.equal(probe.calls, 2, 'completion never refreshes authority for an old button callback');
  await ui.click(); assert.equal(probe.calls, 3, 'a fresh explicit button still works');
});

for (const reason of ['unsupported-demo', 'invalid-options', 'timeout', 'network-error', 'rate-limited', 'http-error', 'malformed-response', 'response-too-large'] as const satisfies readonly NwsPublicDemoFailure[]) {
  test(`reported ${reason} failure stays explicit with no automatic request or invented replacement values`, async () => {
    const base = available(); probe.next = async () => ({ status: 'failed', reason, stage: 'forecast', provenance: base.provenance,
      ...(reason === 'rate-limited' ? { httpStatus: 429, retryAfterSeconds: 0 } : {}), decoderReason: 'private decoder diagnostics are not user copy' });
    const ui = mount(); await ui.click();
    assert.equal(probe.calls, 1); assert.equal(ui.button().props.disabled, false);
    assert.match(ui.text(), /No automatic retry/); assert.match(ui.text(), /Request stage: forecast/);
    assert.doesNotMatch(ui.text(), /0 °C|0%|Source generatedAt|private decoder diagnostics/);
    if (reason === 'rate-limited') assert.match(ui.text(), /HTTP status: 429\. Reported Retry-After: 0 seconds\./);
    await act(async () => { await Promise.resolve(); }); assert.equal(probe.calls, 1);
  });
}

test('a pending server-action rejection clears loading without exposing transport error bodies and permits only explicit retry', async () => {
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount(); await ui.click();
  assert.equal(ui.button().props.disabled, true); assert.equal(probe.calls, 1);
  await act(async () => { pending.reject(new Error('private transport detail')); });
  assert.match(ui.text(), /reference check could not be completed/);
  assert.doesNotMatch(ui.text(), /private transport detail|0 °C|0%/); assert.equal(ui.button().props.disabled, false);
  assert.equal(probe.calls, 1); probe.next = async () => available(); await ui.click(); assert.equal(probe.calls, 2);
});

for (const completion of ['resolve', 'reject'] as const) test(`switching away unmounts the request owner; late ${completion} cannot populate a new country card`, async () => {
  const pending = deferred(); probe.next = () => pending.promise; const old = mount(), retained = old.button().props.onClick;
  await old.click(); old.dispose(); probe.next = async () => available(); const current = mount();
  await act(async () => { if (completion === 'resolve') pending.resolve(available()); else pending.reject(new Error('late private failure')); });
  act(() => retained()); assert.equal(probe.calls, 1);
  assert.match(current.text(), /No forecast has been requested/); assert.doesNotMatch(current.text(), /17\.77777777777778|could not be completed/);
  await current.click(); assert.equal(probe.calls, 2); assert.match(current.text(), /Public forecast reference received/);
});

test('StrictMode effect replay leaves the current explicit button usable without requesting on mount', async () => {
  const ui = mount(true); assert.equal(probe.calls, 0); await ui.click();
  assert.equal(probe.calls, 1); assert.match(ui.text(), /Public forecast reference received/);
});
