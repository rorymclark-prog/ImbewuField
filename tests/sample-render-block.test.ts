import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { UserFacingError, userFacingMessage } from '../lib/user-facing-error.ts';
import { SAMPLE_MODE_RENDER_REFUSAL } from '../lib/sample-mode.ts';

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
// Keep source ordering checks at the billed boundary, then execute the real boundary functions
// and their caller catches without mounting the full sheet renderer. A network attempt is a
// failing spy; intentional refusal text must survive while unrelated provider text stays hidden.

const CLIENT = readFileSync(join(process.cwd(), 'lib', 'ai-render-client.ts'), 'utf8');
const GLOSSY = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');
const SAMPLE_MODE = readFileSync(join(process.cwd(), 'lib', 'sample-mode.ts'), 'utf8');
const RENDER_JOBS = readFileSync(join(process.cwd(), 'lib', 'render-jobs.ts'), 'utf8');

function sourceTree(text: string) {
  return ts.createSourceFile('render-boundary.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function declaration(text: string, name: string): ts.FunctionDeclaration {
  const tree = sourceTree(text);
  let found: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found, `The real ${name} boundary must remain covered`);
  return found;
}

function compile<T>(text: string, result: string, scope: Record<string, unknown>): T {
  const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('scope', `with(scope) { ${js}; return ${result}; }`)(scope) as T;
}

async function sampleRefusal(label: 'requestRender' | 'requestProducer'): Promise<Error> {
  const text = label === 'requestRender' ? CLIENT : GLOSSY;
  let paidWork = 0;
  const forbidden = () => { paidWork++; throw Error('A billed render boundary was reached'); };
  const scope = {
    isSampleMode: () => true, SAMPLE_MODE_RENDER_REFUSAL, UserFacingError,
    paidApiHeaders: forbidden, capForAiInput: forbidden, stripDataUrl: forbidden, fetch: forbidden,
  };
  const run = compile<(...args: unknown[]) => Promise<unknown>>(
    declaration(text, label).getText().replace(/^export\s+/, ''), label, scope,
  );
  let refusal: unknown;
  try { await run(...(label === 'requestRender' ? [{}] : ['', '', '', ''])); }
  catch (error) { refusal = error; }
  assert.equal(paidWork, 0, `${label} must refuse before auth, image preparation or network work`);
  assert.ok(refusal instanceof Error, `${label} must reject rather than silently return`);
  assert.equal(refusal.message, SAMPLE_MODE_RENDER_REFUSAL);
  return refusal;
}

function callerCatch(flow: string, setError: (value: string) => void) {
  const tree = sourceTree(GLOSSY);
  let callback: ts.ArrowFunction | undefined;
  const findCallback = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === flow
      && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.arguments[0] && ts.isArrowFunction(node.initializer.arguments[0])) {
      callback = node.initializer.arguments[0];
    }
    ts.forEachChild(node, findCallback);
  };
  findCallback(tree);
  assert.ok(callback, `The real ${flow} flow must remain covered`);
  let catcher: ts.CatchClause | undefined;
  const findCatch = (node: ts.Node) => {
    if (ts.isCatchClause(node) && /\bsetError\(/.test(node.block.getText(tree))) catcher = node;
    ts.forEachChild(node, findCatch);
  };
  findCatch(callback.body);
  assert.ok(catcher?.variableDeclaration, `${flow} must handle its rejected render visibly`);
  return compile<(error: Error) => void>(
    `function show(${catcher.variableDeclaration.name.getText(tree)}) ${catcher.block.getText(tree)}`,
    'show', {
      setError, userFacingMessage, t: () => 'Render unavailable. Try again.',
      refreshPendingRef: { current: true },
    },
  );
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

test('both direct-call gates reject with the shared refusal before any paid work', async () => {
  // A typed, intentional Error is still a refusal. Pinning `new Error` missed that contract
  // and prevented the friendly-error boundary from distinguishing it from provider diagnostics.
  await sampleRefusal('requestRender');
  await sampleRefusal('requestProducer');
});

test('the direct-call gates reuse the exact refusal wording the queue already uses', () => {
  // lib/render-jobs.ts's enqueueRenderJob throws RenderJobError(SAMPLE_MODE_RENDER_REFUSAL) — same
  // constant, same words, so a farmer sees identical text whichever render path they hit.
  assert.match(SAMPLE_MODE, /export const SAMPLE_MODE_RENDER_REFUSAL\s*=/, 'the shared refusal message moved or was removed from lib/sample-mode.ts');
  assert.match(RENDER_JOBS, /SAMPLE_MODE_RENDER_REFUSAL/, "the queue's existing refusal must keep using the shared message");
  assert.match(CLIENT, /SAMPLE_MODE_RENDER_REFUSAL/, 'requestRender should reuse the shared refusal message, not invent its own');
  assert.match(GLOSSY, /SAMPLE_MODE_RENDER_REFUSAL/, 'requestProducer should reuse the shared refusal message, not invent its own');
});

test('every render caller shows the deliberate tour refusal while hiding unrelated provider diagnostics', async () => {
  // The farmer must still read the refusal, but trusting every raw err.message also exposed
  // Firebase/vendor failures. Execute each actual catch with both kinds of rejection.
  const refusals = await Promise.all([sampleRefusal('requestRender'), sampleRefusal('requestProducer')]);
  for (const flow of ['generate', 'generateProducer', 'generateAllStyledSheets']) {
    let message = '';
    const show = callerCatch(flow, value => { message = value; });
    for (const refusal of refusals) {
      show(refusal);
      assert.equal(message, SAMPLE_MODE_RENDER_REFUSAL, `${flow} must keep the real tour instruction visible`);
    }
    show(new Error('Firebase: Missing or insufficient permissions.'));
    assert.equal(message, 'Render unavailable. Try again.');
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
