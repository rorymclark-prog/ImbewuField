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
