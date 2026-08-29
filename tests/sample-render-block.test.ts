import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// SAMPLE MODE MUST REFUSE EVERY ROUTE TO A BILLED RENDER, NOT JUST THE QUEUE.
//
// Security review, verified: lib/render-jobs.ts's enqueueRenderJob already refuses AI sheets while
// sample mode is on — but DesignGlossy has two DIRECT callers that never go anywhere near it.
// generate('gemini') (the analysis styles: Sun & Wind, What's-here, Opportunities, Implementation)
// posts straight to /api/ai-render via lib/ai-render-client.ts's requestRender, and
// generateAllStyledSheets posts straight to /api/image-producer via the module-scope
// requestProducer. Both bill a real vendor account (OpenAI/fal or Gemini) exactly like the queue
// does, so an anonymous sample-mode visitor could reach billed image generation through either
// path — softened only by the 8/hour/IP rate limit added in PR #374, not actually closed.
//
// Source-shape checks, in the same style as tests/paid-render-gate.test.ts and
// tests/sheet-scale.test.ts: requestProducer lives inside a ~16k-line React component with no DOM
// or Firebase queue in this suite, and "does the network call fire" is exactly the kind of
// property worth pinning at the text level so a reordered statement or a copy-pasted new call site
// cannot quietly drop the gate.

const CLIENT = readFileSync(join(process.cwd(), 'lib', 'ai-render-client.ts'), 'utf8');
const GLOSSY = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');
const SAMPLE_MODE = readFileSync(join(process.cwd(), 'lib', 'sample-mode.ts'), 'utf8');
const RENDER_JOBS = readFileSync(join(process.cwd(), 'lib', 'render-jobs.ts'), 'utf8');

/** Body of a `const <name> = useCallback(...)` up to the closing `}, [deps]);` at that indent —
 *  same helper as tests/paid-render-gate.test.ts, kept local so this file has no cross-file
 *  runtime dependency on another test. */
function callbackBody(name: string): string {
  const start = GLOSSY.indexOf(`const ${name} = useCallback(`);
  assert.notEqual(start, -1, `${name} not found — this test needs updating, not deleting`);
  const end = GLOSSY.indexOf('\n  }, [', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return GLOSSY.slice(start, end);
}

test('requestRender (lib/ai-render-client.ts) checks isSampleMode before it ever calls fetch', () => {
  const start = CLIENT.indexOf('export async function requestRender(');
  assert.notEqual(start, -1, 'requestRender moved or was renamed — update this test, do not delete it');
  const gateAt = CLIENT.indexOf('isSampleMode()', start);
  const fetchAt = CLIENT.indexOf("fetch('/api/ai-render'", start);
  assert.notEqual(gateAt, -1, 'requestRender must check isSampleMode() — this is the only direct caller of /api/ai-render');
  assert.notEqual(fetchAt, -1, 'the /api/ai-render fetch moved — update this test');
  assert.ok(gateAt < fetchAt, 'the sample-mode gate must run before the /api/ai-render fetch, not after');
});

test('requestProducer (DesignGlossy.tsx) checks isSampleMode before it ever calls fetch', () => {
  const start = GLOSSY.indexOf('async function requestProducer(');
  assert.notEqual(start, -1, 'requestProducer moved or was renamed — update this test, do not delete it');
  const gateAt = GLOSSY.indexOf('isSampleMode()', start);
  const fetchAt = GLOSSY.indexOf("fetch('/api/image-producer'", start);
  assert.notEqual(gateAt, -1, 'requestProducer must check isSampleMode() — it posts to /api/image-producer directly, bypassing the queue');
  assert.notEqual(fetchAt, -1, 'the /api/image-producer fetch moved — update this test');
  assert.ok(gateAt < fetchAt, 'the sample-mode gate must run before the /api/image-producer fetch, not after');
  // Gating INSIDE the function (not at each call site) protects every caller, including
  // generateProducer — currently unreferenced by the primary action dispatcher, restorable in one
  // line per its own comment — for free, the same reasoning tests/sheet-scale.test.ts already
  // applies to the AI-input size cap a few lines below this gate.
  assert.ok(
    GLOSSY.slice(start, start + 1500).includes('capForAiInput'),
    'the sample-mode gate must not push the existing size-cap boundary check out of its budget',
  );
});

test('both direct-call gates throw — never a silent no-op or a swallowed rejection', () => {
  for (const [label, src, marker] of [
    ['requestRender', CLIENT, 'export async function requestRender('],
    ['requestProducer', GLOSSY, 'async function requestProducer('],
  ] as const) {
    const start = src.indexOf(marker);
    const gateAt = src.indexOf('isSampleMode()', start);
    const window = src.slice(gateAt, gateAt + 200);
    assert.match(window, /throw new Error\(/, `${label}'s sample-mode gate must throw, not return/resolve quietly`);
    assert.doesNotMatch(window, /return\s*(null|undefined|;)/, `${label}'s gate must not resolve as if nothing happened`);
  }
});

test('the direct-call gates reuse the exact refusal wording the queue already uses', () => {
  // lib/render-jobs.ts's enqueueRenderJob throws RenderJobError(SAMPLE_MODE_RENDER_REFUSAL) — same
  // constant, same words, so a farmer sees identical text whichever render path they hit.
  assert.match(SAMPLE_MODE, /export const SAMPLE_MODE_RENDER_REFUSAL\s*=/, 'the shared refusal message moved or was removed from lib/sample-mode.ts');
  assert.match(RENDER_JOBS, /SAMPLE_MODE_RENDER_REFUSAL/, "the queue's existing refusal must keep using the shared message");
  assert.match(CLIENT, /SAMPLE_MODE_RENDER_REFUSAL/, 'requestRender should reuse the shared refusal message, not invent its own');
  assert.match(GLOSSY, /SAMPLE_MODE_RENDER_REFUSAL/, 'requestProducer should reuse the shared refusal message, not invent its own');
});

test('the refusal actually reaches the farmer: every caller of the two gated functions surfaces err.message as visible text', () => {
  // This is the mechanism: requestRender/requestProducer throw a plain Error, and each of the three
  // callers below already wraps its call in `catch (err) { setError(err instanceof Error ?
  // err.message : ...) }` — pre-existing code, unrelated to this fix, that this test pins so a
  // future refactor cannot quietly move the call outside that catch and turn the throw back into
  // an unhandled rejection. setError's own render (checked below) is what makes it visible.
  const SET_ERROR_MARKER = "setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));";
  for (const flow of ['generate', 'generateProducer', 'generateAllStyledSheets']) {
    const body = callbackBody(flow);
    assert.ok(
      body.includes(SET_ERROR_MARKER),
      `${flow} must catch a thrown sample-mode refusal and hand it to setError — otherwise it becomes a swallowed promise, worse than the leak it fixes`,
    );
  }
  // And setError must actually paint something a farmer can see — not a console.log, not a toast
  // that already rendered and vanished, but a persistent line in the panel these flows are called
  // from.
  assert.match(GLOSSY, /\{error && <p[^>]*>\{error\}<\/p>\}/, 'the visible error banner this refusal relies on moved or was removed');
});

test('the queue path is untouched: enqueueRenderJob still gates itself independently of the direct-call layer', () => {
  // The fix must be additive. If enqueueRenderJob's own gate were removed on the theory that "the
  // direct layer covers it now", a caller that reaches the queue through some future path other
  // than these two functions would stop being checked at all.
  const start = RENDER_JOBS.indexOf('export async function enqueueRenderJob(');
  assert.notEqual(start, -1, 'enqueueRenderJob moved or was renamed — update this test, do not delete it');
  const gateAt = RENDER_JOBS.indexOf('isSampleMode()', start);
  assert.notEqual(gateAt, -1, "enqueueRenderJob's own sample-mode gate must still be there, unchanged");
});
