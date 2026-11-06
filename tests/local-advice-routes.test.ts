import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import { bindSiteContext, createSiteCountryContext } from '../lib/international/site-context.ts';
import { resolvePlanningSupport } from '../lib/international/planning-policy.ts';

type Route = 'chat' | 'ai-insights' | 'design';
const routes: Route[] = ['chat', 'ai-insights', 'design'];
const uid = 'local-advice-fixture-owner';
const text = 'SENSITIVE-FIRST|SENSITIVE-LAST';
const usage = { input_tokens: 7, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const probe = {
  auth: { uid: uid as string | null, guest: undefined as true | undefined, response: undefined as Response | undefined },
  authCalls: 0, constructors: 0, allowanceCalls: 0, starts: 0,
  places: new Map<string, unknown>(), reads: [] as string[], failPlaces: false,
  inputs: [] as unknown[], options: [] as { signal?: AbortSignal }[], records: [] as unknown[], settled: 0,
  authWait: null as Promise<void> | null, allowanceWait: null as Promise<void> | null,
  recordWait: null as Promise<void> | null, afterFirstWait: null as Promise<void> | null,
  allowanceResponse: undefined as Response | undefined,
  onRead: null as ((index: number) => Promise<void> | void) | null,
  onAllowance: null as (() => void) | null, onStart: null as (() => void) | null,
  afterFirst: null as (() => void) | null, onComplete: null as (() => void) | null, onRecord: null as (() => void) | null,
  modelError: false,
  makeStream: (_input: unknown, _options: { signal?: AbortSignal }) => ({} as unknown),
  budget: {} as { model: (preferred: string) => string; record: (_model: string, value: unknown) => Promise<void> },
};
const previous = Object.getOwnPropertyDescriptor(globalThis, '__localAdviceRoutes');
Object.assign(globalThis, { __localAdviceRoutes: probe });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const realMeterUrl = new URL('../lib/metered-ai.ts', import.meta.url).href;
// Actual route functions, prompt selector, country policy, alias binding and
// meter() run. Auth, saved-place transport, budget IO and SDK transport are
// fixtures; no model request, real Admin client, API key or user store is used.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@anthropic-ai/sdk') return data(`
    export default class Anthropic { constructor(){globalThis.__localAdviceRoutes.constructors++;}
      messages={stream:(input,options)=>globalThis.__localAdviceRoutes.makeStream(input,options)}; }`);
  if (specifier === '@/lib/api-auth' || specifier === './api-auth' && context.parentURL?.endsWith('/lib/report-country-policy.ts')) return data(`
    export async function guardPaidApiRequest(){const p=globalThis.__localAdviceRoutes;p.authCalls++;if(p.authWait)await p.authWait;return {...p.auth};}
    export const declaresSampleMode=req=>req.headers.get('x-imbewu-sample')==='1';`);
  if (specifier === '@/lib/metered-ai') return data(`
    import {meter} from ${JSON.stringify(realMeterUrl)};export {AI_MODELS} from ${JSON.stringify(realMeterUrl)};
    export async function meteredAi(_req,_auth,route,client){const p=globalThis.__localAdviceRoutes;p.allowanceCalls++;p.onAllowance?.();
      if(p.allowanceWait)await p.allowanceWait;if(p.allowanceResponse)return {response:p.allowanceResponse};
      return {ai:meter(client,p.budget,route)};}`);
  if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return data('export const getFirebase=()=>null;export const isBackendConfigured=()=>false;');
  if (context.parentURL?.endsWith('/lib/report-country-policy.ts')) {
    if (specifier === 'firebase-admin/app') return data('export const getApps=()=>[{}];export const getApp=()=>({});export const initializeApp=()=>({});');
    if (specifier === 'firebase-admin/firestore') return data(`
      export function getFirestore() {
        return {
          collection(name) {
            if(name!=='user_map_data')throw Error('Unexpected collection');
            return {
              doc(owner) {
                return {
                  collection(child) {
                    if(child!=='data')throw Error('Unexpected child');
                    return {
                      doc(id) {
                        if(id!=='places')throw Error('Unexpected document');
                        return {
                          async get() {
                            const p=globalThis.__localAdviceRoutes;p.reads.push(owner);
                            await p.onRead?.(p.reads.length);if(p.failPlaces)throw Error('PRIVATE STORE FAILURE');
                            const value=structuredClone(p.places.get(owner));
                            return {exists:p.places.has(owner),data:()=>({places:value})};
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }`);
  }
  return next(specifier, context);
} });
const handlers = {
  chat: (await import('../app/api/chat/route.ts')).POST,
  'ai-insights': (await import('../app/api/ai-insights/route.ts')).POST,
  design: (await import('../app/api/design/route.ts')).POST,
};
const { DEMO_LOCATION } = await import('../lib/demo-site.ts');
const { selectLocalAdviceSystem } = await import('../lib/local-advice-prompts.ts');
const siteId = `site:${DEMO_LOCATION.lat.toFixed(5)},${DEMO_LOCATION.lon.toFixed(5)}`;
function place(countryCode?: string, id = 'private-place') {
  const row = { id, lat: DEMO_LOCATION.lat, lon: DEMO_LOCATION.lon, updatedAt: 100, savedAt: '2026-11-01T12:00:00.000Z' };
  return { ...row, ...(countryCode ? { siteCountryContext: bindSiteContext(createSiteCountryContext({ siteId, countryCode, confirmed: true },
    '2026-11-02T12:00:00.000Z')!, row)! } : {}) };
}
function personal() {
  return { mode: 'personal-site', siteId, countryFingerprint: resolvePlanningSupport({ siteId, places: [place('ZA')] }).fingerprint };
}
function payload(route: Route, adviceContext: unknown = personal()) {
  const locationData = structuredClone(DEMO_LOCATION);
  if (route === 'chat') return { adviceContext, messages: [{ role: 'user', content: 'Synthetic site question' }], context: { locationData, language: 'en' } };
  if (route === 'ai-insights') return { adviceContext, locationData };
  return { adviceContext, locationData, images: [{ data: 'AA==', mediaType: 'image/png' }], language: 'en', tone: 'simple' };
}
function request(route: Route, body: unknown, signal?: AbortSignal, raw?: string) {
  return new Request(`http://localhost/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-imbewu-sample': '1' },
    body: raw ?? JSON.stringify(body), ...(signal ? { signal } : {}) });
}
function post(route: Route, body: unknown = payload(route), signal?: AbortSignal) { return handlers[route](request(route, body, signal) as never); }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
async function held(response: Response, spent: boolean) {
  assert.ok(response.status >= 400); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json(); assert.match(body.code, /^LOCAL_ADVICE_/); assert.equal(body.allowanceMayBeSpent, spent);
  assert.equal(typeof body.error, 'string');
  assert.doesNotMatch(JSON.stringify(body), /SENSITIVE-|PRIVATE|local-advice-fixture-owner|private-place|countryFingerprint|siteId|fingerprint/);
  return body;
}
function untouched() { assert.equal(probe.constructors, 0); assert.equal(probe.allowanceCalls, 0); assert.equal(probe.starts, 0); assert.equal(probe.records.length, 0); }
async function reachedBeforeResponse(trigger: Promise<void>, pending: Promise<Response>) {
  assert.equal(await Promise.race([trigger.then(() => true), pending.then(() => false)]), true,
    'the actual provider/usage boundary must be reached while all model text is still buffered');
}
beforeEach(() => {
  probe.auth = { uid, guest: undefined, response: undefined }; probe.authCalls = 0; probe.constructors = 0; probe.allowanceCalls = 0; probe.starts = 0;
  probe.places.clear(); probe.places.set(uid, [place('ZA')]); probe.reads.length = 0; probe.failPlaces = false;
  probe.inputs.length = 0; probe.options.length = 0; probe.records.length = 0; probe.settled = 0;
  probe.authWait = null; probe.allowanceWait = null; probe.recordWait = null; probe.afterFirstWait = null; probe.allowanceResponse = undefined;
  probe.onRead = null; probe.onAllowance = null; probe.onStart = null; probe.afterFirst = null; probe.onComplete = null; probe.onRecord = null; probe.modelError = false;
  probe.budget = { model: preferred => preferred, async record(_model, value) {
    probe.records.push(value); probe.onRecord?.(); if (probe.recordWait) await probe.recordWait; probe.settled++;
  } };
  probe.makeStream = (input, options) => {
    probe.starts++; probe.inputs.push(input); probe.options.push(options); probe.onStart?.();
    const final = deferred<{ usage: typeof usage }>();
    return { finalMessage: () => final.promise, async *[Symbol.asyncIterator]() {
      try {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'SENSITIVE-FIRST|' } };
        probe.afterFirst?.(); if (probe.afterFirstWait) await probe.afterFirstWait;
        if (probe.modelError) throw Error('PRIVATE SDK BODY WITH IDENTIFIERS');
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'SENSITIVE-LAST' } };
        probe.onComplete?.(); final.resolve({ usage });
      } catch (error) { final.reject(error instanceof Error ? error : Error('PRIVATE SDK FAILURE')); throw error; }
    } };
  };
});
after(() => {
  hooks.deregister(); if (previous) Object.defineProperty(globalThis, '__localAdviceRoutes', previous); else Reflect.deleteProperty(globalThis, '__localAdviceRoutes');
});

for (const route of routes) {
  test(`${route}: unknown, foreign, stale and conflicting saved country cannot construct a client, load allowance or start a model`, async () => {
    const stale = { ...place('ZA'), updatedAt: 101 };
    const cases = [[], [place()], [stale], ...['KE', 'GB', 'US', 'BR'].map(code => [place(code)]), [place('ZA'), place('KE', 'private-alias')]];
    for (const rows of cases) {
      probe.places.set(uid, rows); const response = await post(route, { ...payload(route), countryCode: 'ZA', localAgronomyApproved: true, ownerUid: uid });
      await held(response, false); untouched();
    }
    assert.ok(probe.reads.every(owner => owner === uid));
  });

  test(`${route}: missing scope, stale fingerprint, unreadable places and a forged guest demo never spend`, async () => {
    const missing = payload(route) as { adviceContext?: unknown }; delete missing.adviceContext;
    await held(await post(route, missing), false); untouched();
    await held(await post(route, payload(route, { ...personal(), countryFingerprint: 'stale-country' })), false); untouched();
    probe.failPlaces = true; assert.equal((await held(await post(route), false)).code, 'LOCAL_ADVICE_COUNTRY_SOURCE_UNAVAILABLE'); untouched(); probe.failPlaces = false;
    probe.places.set(uid, { malformed: true }); await held(await post(route), false); untouched(); probe.places.set(uid, [place('ZA')]);
    probe.auth = { uid: null, guest: true, response: undefined };
    await held(await post(route, { ...payload(route), uid, ownerUid: uid, sample: true }), false); untouched();
  });

  test(`${route}: verified own-site ZA still returns the same complete text and settles actual transport usage`, async () => {
    const controller = new AbortController(), req = request(route, payload(route), controller.signal);
    const response = await handlers[route](req as never);
    assert.equal(response.status, 200); assert.equal(await response.text(), text);
    assert.equal(response.headers.get('X-Imbewu-Advice-Mode'), 'personal-site'); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/); assert.equal(probe.authCalls, 1);
    assert.equal(probe.constructors, 1); assert.equal(probe.allowanceCalls, 1); assert.equal(probe.starts, 1);
    assert.deepEqual(probe.records, [usage]); assert.equal(probe.settled, 1); assert.equal(probe.options[0].signal, req.signal);
    assert.ok(probe.reads.length >= 4); assert.ok(probe.reads.every(owner => owner === uid));
  });

  test(`${route}: country loss during auth or the pre-allowance reader stops before SDK and allowance`, async () => {
    const authWait = deferred<void>(); probe.authWait = authWait.promise; const authPending = post(route);
    probe.places.set(uid, [place('KE')]); authWait.resolve(); await held(await authPending, false); untouched();
    probe.authWait = null; probe.places.set(uid, [place('ZA')]); probe.reads.length = 0;
    const readWait = deferred<void>(), started = deferred<void>();
    probe.onRead = async index => { if (index === 2) { started.resolve(); await readWait.promise; } };
    const pending = post(route); await reachedBeforeResponse(started.promise, pending);
    probe.places.set(uid, [place('KE')]); readWait.resolve(); await held(await pending, false); untouched();
  });

  test(`${route}: a country change while allowance loads withholds before model start`, async () => {
    const wait = deferred<void>(), started = deferred<void>(); probe.allowanceWait = wait.promise; probe.onAllowance = () => started.resolve();
    const pending = post(route); await reachedBeforeResponse(started.promise, pending);
    probe.places.set(uid, [place('KE')]); wait.resolve(); await held(await pending, true);
    assert.equal(probe.allowanceCalls, 1); assert.equal(probe.starts, 0); assert.equal(probe.records.length, 0);
  });

  test(`${route}: an emitted provider prefix stays buffered when country changes during the model wait`, async () => {
    const wait = deferred<void>(), first = deferred<void>(); probe.afterFirstWait = wait.promise; probe.afterFirst = () => first.resolve();
    const pending = post(route);
    try {
      await reachedBeforeResponse(first.promise, pending); probe.places.set(uid, [place('KE')]); wait.resolve();
      await held(await pending, true); assert.equal(probe.starts, 1); assert.deepEqual(probe.records, [usage]); assert.equal(probe.settled, 1);
    } finally { wait.resolve(); }
  });

  test(`${route}: country loss during actual usage settlement discards the complete result after recording completed work`, async () => {
    const wait = deferred<void>(), started = deferred<void>(); probe.recordWait = wait.promise; probe.onRecord = () => started.resolve();
    const pending = post(route);
    try {
      await reachedBeforeResponse(started.promise, pending); probe.places.set(uid, [place('KE')]); wait.resolve();
      await held(await pending, true); assert.deepEqual(probe.records, [usage]); assert.equal(probe.settled, 1);
    } finally { wait.resolve(); }
  });

  test(`${route}: country loss on model completion is checked before any text response`, async () => {
    probe.onComplete = () => { probe.places.set(uid, [place('KE')]); };
    await held(await post(route), true); assert.equal(probe.starts, 1); assert.equal(probe.records.length, 1);
  });

  test(`${route}: provider failure cannot return its prefix or private SDK error body`, async () => {
    probe.modelError = true; const response = await post(route), result = await held(response, true);
    assert.equal(response.status, 502); assert.equal(result.code, 'LOCAL_ADVICE_MODEL_UNAVAILABLE'); assert.equal(probe.starts, 1);
  });

  test(`${route}: abort before start spends nothing and abort during an ignoring transport withholds its completed result`, async () => {
    const early = new AbortController(); early.abort(); await held(await post(route, payload(route), early.signal), false); untouched();
    const controller = new AbortController(); probe.afterFirst = () => controller.abort();
    await held(await post(route, payload(route), controller.signal), true); assert.equal(probe.starts, 1); assert.equal(probe.settled, 1);
  });
}

test('explicit general app help uses only the bounded general prompt and never reads saved-site context', async () => {
  probe.auth = { uid: null, guest: true, response: undefined };
  const response = await post('chat', { adviceContext: { mode: 'general-help' }, messages: [{ role: 'user', content: 'How do sharing controls work?' }], context: { language: 'en' } });
  assert.equal(response.status, 200); assert.equal(await response.text(), text); assert.equal(response.headers.get('X-Imbewu-Advice-Mode'), 'general-help');
  assert.equal(probe.reads.length, 0); assert.equal(probe.starts, 1);
  const input = probe.inputs[0] as { system: string | Array<{ text: string }> };
  const system = typeof input.system === 'string' ? input.system : input.system.map(block => block.text).join('');
  assert.equal(system, selectLocalAdviceSystem('general-help', 'PRIVATE PERSONAL PROMPT'));
  assert.doesNotMatch(system, /THIS FARMER'S SITE|specific South African grower|PRIVATE PERSONAL PROMPT/);
});

test('general help rejects every personal context field even null, unknown context and images without model or allowance', async () => {
  for (const key of ['locationData', 'siteData', 'waterData', 'reports', 'production', 'sales', 'consent', 'project', 'unknownPrivateField']) {
    await held(await post('chat', { adviceContext: { mode: 'general-help' }, messages: [{ role: 'user', content: 'Synthetic request' }], context: { [key]: null } }), false);
    untouched();
  }
  await held(await post('chat', { adviceContext: { mode: 'general-help' }, messages: [{ role: 'user', content: 'Synthetic request' }], image: null }), false); untouched();
  await held(await post('chat', { adviceContext: { mode: 'general-help', countryCode: 'ZA' }, messages: [{ role: 'user', content: 'Synthetic request' }] }), false); untouched();
});

for (const route of ['ai-insights', 'design'] as const) test(`${route}: general app help cannot be used to admit local inputs`, async () => {
  await held(await post(route, payload(route, { mode: 'general-help' })), false); untouched();
});

test('malformed bodies and request limits run before allowance or SDK setup', async () => {
  for (const route of routes) {
    const response = await handlers[route](request(route, null, undefined, '{invalid') as never); assert.equal(response.status, 400); untouched();
  }
  const chat = await post('chat', { ...payload('chat'), messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'Synthetic message' })) });
  assert.equal(chat.status, 413); untouched();
  const design = await post('design', { ...payload('design'), images: Array.from({ length: 7 }, () => ({ data: 'AA==', mediaType: 'image/png' })) });
  assert.equal(design.status, 413); untouched();
  assert.equal((await post('ai-insights', DEMO_LOCATION)).status, 400); untouched();
});

test('existing auth and allowance refusals remain authoritative without a model start', async () => {
  for (const route of routes) {
    const denied = Response.json({ error: 'Synthetic auth hold' }, { status: 401 }); probe.auth.response = denied;
    assert.equal(await post(route), denied); untouched(); probe.auth.response = undefined;
  }
  probe.allowanceResponse = Response.json({ error: 'Synthetic allowance hold' }, { status: 429 });
  assert.equal(await post('chat'), probe.allowanceResponse); assert.equal(probe.starts, 0);
});
