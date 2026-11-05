import assert from 'node:assert/strict';
import test from 'node:test';
import { requestDesignAdvice, type DesignAdviceClientSnapshot } from '../lib/design-advice-client.ts';
import { designAdviceSourceFingerprint } from '../lib/design-advice-source.ts';

const siteId = 'site:0.00000,0.00000';
const raw = { siteId, frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
  items: [{ id: 'fixture-bed', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4 }], zones: [], lines: [],
  step: 'planting', updatedAt: '2026-11-04T12:00:00.000Z' };
const fingerprint = await designAdviceSourceFingerprint(raw, siteId);
assert.ok(fingerprint);
const snapshot: DesignAdviceClientSnapshot = { key: 'captured-account-site-source-country-step', mode: 'personal-site', siteId,
  currentStep: 'planting', countryFingerprint: 'current-country-confirmation', raw };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function response(extra: Record<string, unknown> = {}) {
  return Response.json({ mode: snapshot.mode, siteId, currentStep: snapshot.currentStep, sourceFingerprint: fingerprint,
    countryFingerprint: snapshot.countryFingerprint, suggestions: [' Fixture tip ', '', 'Second tip'], ...extra });
}
function fixture() {
  const state = { current: true, headers: 0, fetches: [] as RequestInit[] };
  const controller = new AbortController();
  const input = { snapshot, signal: controller.signal, isCurrent: () => state.current,
    headers: async (): Promise<Record<string, string>> => { ++state.headers; return { Authorization: 'Bearer fixture-token' }; },
    fetcher: async (init: RequestInit) => { state.fetches.push(init); return response(); } };
  return { state, controller, input };
}

test('account, site, source, sample or country withdrawal during fingerprinting never asks for credentials or fetches', async () => {
  const { state, input } = fixture();
  const pending = requestDesignAdvice(input); state.current = false;
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(state.headers, 0); assert.equal(state.fetches.length, 0);
});

test('context withdrawal while the captured token is pending cannot submit a paid request', async () => {
  const { state, input } = fixture(), token = deferred<Record<string, string>>(), entered = deferred<void>();
  input.headers = () => { ++state.headers; entered.resolve(); return token.promise; };
  const pending = requestDesignAdvice(input); await entered.promise;
  state.current = false; token.resolve({ Authorization: 'Bearer captured-account-token' });
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(state.fetches.length, 0);
});

test('a late response from the previous context is discarded before reading its text', async () => {
  const { state, input } = fixture(), network = deferred<Response>(), entered = deferred<void>();
  let parsed = 0;
  input.fetcher = async init => { state.fetches.push(init); entered.resolve(); return network.promise; };
  const pending = requestDesignAdvice(input); await entered.promise;
  state.current = false;
  const late = response(); late.json = async () => { ++parsed; return {}; }; network.resolve(late);
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(parsed, 0);
});

test('withdrawal while JSON decoding or a network error completes releases neither tips nor an old-context error', async () => {
  const { state, input } = fixture(), decoded = deferred<unknown>(), entered = deferred<void>();
  const late = response(); late.json = () => { entered.resolve(); return decoded.promise; };
  input.fetcher = async () => late;
  const pending = requestDesignAdvice(input); await entered.promise;
  state.current = false; decoded.resolve({ suggestions: ['Must never appear'] });
  assert.deepEqual(await pending, { status: 'stale' });
});

test('a current personal request sends only source references, preserves credentials, and rejects mismatched response identity', async () => {
  const { state, input } = fixture();
  const result = await requestDesignAdvice(input);
  assert.deepEqual(result, { status: 'ready', suggestions: ['Fixture tip', 'Second tip'] });
  assert.equal((state.fetches[0].headers as Record<string, string>).Authorization, 'Bearer fixture-token');
  assert.deepEqual(JSON.parse(state.fetches[0].body as string), { mode: 'personal-site', siteId, currentStep: 'planting',
    sourceFingerprint: fingerprint, countryFingerprint: snapshot.countryFingerprint });
  for (const patch of [{ mode: 'original-demo-reference' }, { siteId: 'site:1.00000,1.00000' }, { sourceFingerprint: '0'.repeat(64) },
    { countryFingerprint: 'changed-country' }, { currentStep: 'water' }]) {
    input.fetcher = async () => response(patch);
    assert.deepEqual(await requestDesignAdvice(input), { status: 'error' });
  }
});

test('fixed original-demo responses may describe a different reference source but must keep their explicit mode and country basis', async () => {
  const { input } = fixture(); input.snapshot = { ...snapshot, mode: 'original-demo-reference' };
  input.fetcher = async () => response({ mode: 'original-demo-reference', sourceFingerprint: '0'.repeat(64) });
  assert.equal((await requestDesignAdvice(input)).status, 'ready');
  input.fetcher = async () => response({ mode: 'original-demo-reference', countryFingerprint: 'foreign-context' });
  assert.deepEqual(await requestDesignAdvice(input), { status: 'error' });
});

test('aborting an obsolete advisor request is quiet and a current typed boundary refusal remains actionable', async () => {
  const { input, controller } = fixture(); controller.abort();
  assert.deepEqual(await requestDesignAdvice(input), { status: 'stale' });
  const next = fixture(); next.input.fetcher = async () => Response.json({ code: 'ADVICE_SOURCE_CHANGED', error: 'Wait for this design to save.' }, { status: 409 });
  assert.deepEqual(await requestDesignAdvice(next.input), { status: 'error', error: 'Wait for this design to save.' });
});

test('an unreadable current context holds without credentials or an uncaught error', async () => {
  const { state, input } = fixture(); input.isCurrent = () => { throw Error('Context unavailable'); };
  assert.deepEqual(await requestDesignAdvice(input), { status: 'stale' });
  assert.equal(state.headers, 0); assert.equal(state.fetches.length, 0);
});
