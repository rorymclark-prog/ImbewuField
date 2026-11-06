import assert from 'node:assert/strict';
import test from 'node:test';
import { requestLocalAdvice, localAdviceHoldMessage, localAdviceUnavailableMessage } from '../lib/local-advice-client.ts';
import type { LocalAdviceClientSnapshot } from '../lib/local-advice-client.ts';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const snapshot: LocalAdviceClientSnapshot = { key: 'synthetic-current-context',
  adviceContext: { mode: 'personal-site', siteId: 'site:0.00000,0.00000', countryFingerprint: 'synthetic-country-receipt' } };
function reply(text = 'Current answer', mode = 'personal-site') {
  return new Response(text, { headers: { 'X-Imbewu-Advice-Mode': mode } });
}
function fixture() {
  const state = { current: true, headers: 0, fetches: [] as RequestInit[] };
  const controller = new AbortController();
  const input = { snapshot, body: { context: { language: 'en' }, messages: [{ role: 'user', content: 'Synthetic question' }] },
    signal: controller.signal, isCurrent: () => state.current,
    headers: async (): Promise<Record<string, string>> => { ++state.headers; return { Authorization: 'Bearer synthetic-token' }; },
    fetcher: async (init: RequestInit) => { state.fetches.push(init); return reply(); } };
  return { state, controller, input };
}

test('a retired advice context never acquires credentials or sends a request', async () => {
  const { input, state } = fixture(); state.current = false;
  assert.deepEqual(await requestLocalAdvice(input), { status: 'stale' });
  assert.equal(state.headers, 0); assert.equal(state.fetches.length, 0);
});

test('site, country or actor withdrawal during token acquisition cannot submit the paid advice', async () => {
  const { input, state } = fixture(), token = deferred<Record<string, string>>(), entered = deferred<void>();
  input.headers = () => { ++state.headers; entered.resolve(); return token.promise; };
  const pending = requestLocalAdvice(input); await entered.promise;
  state.current = false; token.resolve({ Authorization: 'Bearer obsolete-token' });
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(state.fetches.length, 0);
});

test('the submitted question and approval are frozen before a delayed token resolves', async () => {
  const { input, state } = fixture(), token = deferred<Record<string, string>>(), entered = deferred<void>();
  input.headers = () => { entered.resolve(); return token.promise; };
  const pending = requestLocalAdvice(input); await entered.promise;
  input.body.messages[0].content = 'A later unsent question';
  token.resolve({ Authorization: 'Bearer captured-token' });
  assert.deepEqual(await pending, { status: 'ready', text: 'Current answer' });
  const sent = JSON.parse(state.fetches[0].body as string);
  assert.equal(sent.messages[0].content, 'Synthetic question'); assert.deepEqual(sent.adviceContext, snapshot.adviceContext);
  assert.equal((state.fetches[0].headers as Record<string, string>).Authorization, 'Bearer captured-token');
});

test('a late network response is retired without reading its old-context answer', async () => {
  const { input, state } = fixture(), network = deferred<Response>(), entered = deferred<void>(); let cancelled = 0;
  input.fetcher = async init => { state.fetches.push(init); entered.resolve(); return network.promise; };
  const pending = requestLocalAdvice(input); await entered.promise; state.current = false;
  network.resolve(new Response(new ReadableStream({ cancel() { ++cancelled; } }), { headers: { 'X-Imbewu-Advice-Mode': 'personal-site' } }));
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(cancelled, 1);
});

test('advice text remains private until the final chunk and current context agree', async () => {
  const { input, state } = fixture(), waiting = deferred<void>(); let stream!: ReadableStreamDefaultController<Uint8Array>, cancelled = 0;
  input.fetcher = async () => new Response(new ReadableStream({
    start(controller) { stream = controller; controller.enqueue(new TextEncoder().encode('Never publish this partial answer')); waiting.resolve(); },
    cancel() { ++cancelled; },
  }), { headers: { 'X-Imbewu-Advice-Mode': 'personal-site' } });
  let completed = false; const pending = requestLocalAdvice(input).then(value => { completed = true; return value; });
  await waiting.promise; await Promise.resolve(); assert.equal(completed, false);
  state.current = false; stream.enqueue(new TextEncoder().encode(' late chunk'));
  assert.deepEqual(await pending, { status: 'stale' }); assert.equal(cancelled, 1);
});

test('a current multibyte answer is returned completely with its expected mode', async () => {
  const { input } = fixture(); const bytes = new TextEncoder().encode('Réponse complète');
  input.fetcher = async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 2)); controller.enqueue(bytes.slice(2)); controller.close();
  } }), { headers: { 'X-Imbewu-Advice-Mode': 'personal-site' } });
  assert.deepEqual(await requestLocalAdvice(input), { status: 'ready', text: 'Réponse complète' });
});

test('a changed or missing response scope cannot be relabelled as personal advice', async () => {
  const { input } = fixture();
  for (const mode of ['general-help', 'unknown', '']) {
    input.fetcher = async () => reply('Wrong scope answer', mode);
    assert.deepEqual(await requestLocalAdvice(input), { status: 'error' });
  }
  input.fetcher = async () => new Response('Unscoped old-server answer');
  assert.deepEqual(await requestLocalAdvice(input), { status: 'error' });
});

test('general app-help preserves its explicit scope instead of using the personal default', async () => {
  const { input, state } = fixture(); input.snapshot = { key: 'general', adviceContext: { mode: 'general-help' } };
  input.fetcher = async init => { state.fetches.push(init); return reply('How to use the app', 'general-help'); };
  assert.deepEqual(await requestLocalAdvice(input), { status: 'ready', text: 'How to use the app' });
  assert.deepEqual(JSON.parse(state.fetches[0].body as string).adviceContext, { mode: 'general-help' });
});

test('typed policy holds disclose possible spent work without displaying arbitrary server errors', async () => {
  const { input } = fixture();
  input.fetcher = async () => Response.json({ code: 'LOCAL_ADVICE_CONTEXT_CHANGED', error: 'Private raw transport detail', allowanceMayBeSpent: true }, { status: 409 });
  const result = await requestLocalAdvice(input);
  assert.deepEqual(result, { status: 'held', allowanceMayBeSpent: true });
  assert.match(localAdviceHoldMessage({ allowanceMayBeSpent: true }), /may have used allowance/);
  assert.doesNotMatch(localAdviceHoldMessage({ allowanceMayBeSpent: true }), /Private raw/);
  input.fetcher = async () => Response.json({ code: 'ARBITRARY', error: 'Raw SDK credential detail' }, { status: 500 });
  assert.deepEqual(await requestLocalAdvice(input), { status: 'error' });
});

test('withdrawal during policy-error decoding does not show an obsolete refusal', async () => {
  const { input, state } = fixture(), decoded = deferred<unknown>(), entered = deferred<void>();
  const response = Response.json({}, { status: 409 });
  response.json = () => { entered.resolve(); return decoded.promise; };
  input.fetcher = async () => response;
  const pending = requestLocalAdvice(input); await entered.promise; state.current = false;
  decoded.resolve({ code: 'LOCAL_ADVICE_CONTEXT_CHANGED', allowanceMayBeSpent: true });
  assert.deepEqual(await pending, { status: 'stale' });
});

test('model unavailability is distinguished from a saved-country refusal without hiding possible spent work', async () => {
  const { input } = fixture();
  input.fetcher = async () => Response.json({ code: 'LOCAL_ADVICE_MODEL_UNAVAILABLE', allowanceMayBeSpent: true,
    error: 'Private SDK transport detail' }, { status: 502 });
  assert.deepEqual(await requestLocalAdvice(input), { status: 'unavailable', allowanceMayBeSpent: true });
  const message = localAdviceUnavailableMessage({ allowanceMayBeSpent: true });
  assert.match(message, /could not be completed/); assert.match(message, /may have used allowance/);
  assert.doesNotMatch(message, /Sign in|country details|Private SDK/);
});

test('abort, unreadable context and failed partial streams never deliver an answer fragment', async () => {
  const first = fixture(); first.controller.abort();
  assert.deepEqual(await requestLocalAdvice(first.input), { status: 'stale' }); assert.equal(first.state.headers, 0);
  const second = fixture(); second.input.isCurrent = () => { throw Error('Unavailable context'); };
  assert.deepEqual(await requestLocalAdvice(second.input), { status: 'stale' }); assert.equal(second.state.headers, 0);
  const third = fixture(); third.input.fetcher = async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('Partial must not escape')); controller.error(Error('Synthetic stream failure'));
  } }), { headers: { 'X-Imbewu-Advice-Mode': 'personal-site' } });
  assert.deepEqual(await requestLocalAdvice(third.input), { status: 'error' });
});
