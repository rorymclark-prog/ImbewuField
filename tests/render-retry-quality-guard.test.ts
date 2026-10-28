// A retry may never render at a tier the caller did not ask for.
//
// `openaiEdit` in functions/src/index.ts takes `quality: 'high' | 'medium' | 'low' = 'high'` and
// recurses on three failure paths: network/abort, 429, and 5xx. The network path passed `quality`
// through; the 429 and 5xx paths did not, so those retries re-entered on the PARAMETER DEFAULT.
// A sheet the caller budgeted at 'low' came back at 'high' — the file's own comment puts that at
// roughly 35x — and with MAX_429_RETRIES = 5 it could happen five times for one sheet.
//
// The sting is the trigger. 429 is what a BUSY fleet provokes, so the escalation fired hardest
// exactly when the two spend governors above it were doing their job. The governors bound how
// many sheets render; nothing bound what each one cost once a retry had laundered the tier.
//
// The rule this file guards:
//
//   Every recursive call to openaiEdit passes `quality` explicitly. The default exists only for
//   old job docs written before the field did — never as the value a retry falls back to.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/render-retry-quality-guard.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { OPENAI_MAP_MODEL } from '../lib/ai-render/model.ts';

const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');

/** Comments are stripped before scanning, so the explanation above cannot trip its own guard. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('every recursive openaiEdit call forwards the quality tier', () => {
  const calls = code.match(/return openaiEdit\([^)]*\)/g) ?? [];

  assert.ok(
    calls.length >= 3,
    `expected at least 3 recursive openaiEdit calls (network, 429, 5xx); found ${calls.length}. ` +
      'If a retry path was removed this guard needs revisiting, not deleting.',
  );

  for (const call of calls) {
    assert.match(
      call,
      /,\s*quality\s*\)$/,
      `a retry re-enters openaiEdit without passing quality, so it renders at the 'high' default:\n` +
        `  ${call}\n` +
        "Append ', quality' — a retry must cost what the caller budgeted, not what the default is.",
    );
  }
});

test('the quality parameter still defaults to high for pre-field job docs', () => {
  // If this ever changes the comment above is stale — the default is deliberate, the LEAK was not.
  assert.match(
    code,
    /quality:\s*'high'\s*\|\s*'medium'\s*\|\s*'low'\s*=\s*'high'/,
    'openaiEdit no longer defaults quality to high; update this guard and its rationale.',
  );
});


test('paid map edits use GPT Image 2.5 while preserving the chosen quality and protect mask', async () => {
  // Run the actual worker request builder with a fake transport. A picker-label-only upgrade,
  // an old model on the wire, or a lost quality/mask must all fail without buying an image.
  const requestSource = source.slice(source.indexOf('function jpegDims('), source.indexOf('// Patch one sheet'));
  const compiled = ts.transpileModule(requestSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const calls: Array<{ url: string; body: FormData }> = [];
  const edit = new Function('OPENAI_MAP_MODEL', 'ATTEMPT_TIMEOUT_MS', 'MAX_RETRIES', 'MAX_429_RETRIES',
    'friendlyProviderError', 'sleep', 'fetch', `${compiled}; return openaiEdit;`)(
      OPENAI_MAP_MODEL, 1000, 0, 0, () => 'provider failure', async () => {},
      async (url: string, init: RequestInit) => {
        calls.push({ url, body: init.body as FormData });
        return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: 'painted-image' }] }) };
      },
    );
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(0x0d0a1a0a, 4);
  png.writeUInt32BE(1600, 16);
  png.writeUInt32BE(1000, 20);
  for (const quality of ['low', 'medium', 'high']) {
    assert.equal(await edit('fake-key', png.toString('base64'), 'Saved geometry only', png.toString('base64'), null, 0, quality), 'painted-image');
    const call = calls.at(-1)!;
    assert.equal(call.url, 'https://api.openai.com/v1/images/edits');
    assert.equal(call.body.get('model'), 'gpt-image-2.5-sunburst');
    assert.equal(call.body.get('quality'), quality);
    assert.equal(call.body.get('n'), '1');
    assert.equal(call.body.get('output_format'), 'png');
    assert.equal(call.body.get('prompt'), 'Saved geometry only');
    assert.ok(call.body.get('image[]') instanceof Blob);
    assert.ok(call.body.get('mask') instanceof Blob);
    const [w, h] = String(call.body.get('size')).split('x').map(Number);
    assert.equal(w % 16, 0);
    assert.equal(h % 16, 0);
    assert.ok(Math.abs(w / h - 1.6) < 0.02);
  }
  assert.equal(calls.length, 3);
  assert.match(source, /if \(job\.engine === 'openai'\) await ref\.update\(\{ model: OPENAI_MAP_MODEL \}\)/,
    'the worker must stamp the same actual model it sends to OpenAI');
});
