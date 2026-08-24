// WHERE prompt caching may be switched on, and where it must not be.
//
// A cache write costs 1.25x an ordinary send (lib/ai-cost.ts). So caching only saves money when a
// previous call has already written the entry. That makes the safety of `cache_control` a property
// of the CALLER'S CONCURRENCY, not of the cache:
//
//   app/api/chat        turns are SEQUENTIAL      -> turn 2 reads what turn 1 wrote. Safe.
//   app/api/generate-report  batches fire through Promise.all -> all miss, all write, bill goes UP 25%.
//
// The second case is the trap, and it is invisible to any test that prices a single call, so it is
// asserted here against the source instead. If the report builder is ever made sequential (or given
// a warm-up call that lands before the rest), this test is the place to record that decision.
//
// Comments are stripped before scanning so this explanation cannot satisfy the assertions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const chat = stripComments(readFileSync(join(ROOT, 'app/api/chat/route.ts'), 'utf8'));
const report = stripComments(readFileSync(join(ROOT, 'app/api/generate-report/route.ts'), 'utf8'));

test('chat caches its system prompt — the block that repeats every turn', () => {
  assert.match(chat, /cache_control/, 'chat should cache: ~2,500 shared tokens re-sent on every turn');
  // It must sit on `system`, not on the messages: the message list is what CHANGES each turn.
  const systemArg = chat.slice(chat.indexOf('messages.stream'), chat.indexOf('messages: clean'));
  assert.match(systemArg, /cache_control/, 'the cache marker belongs on the system block');
});

test('chat only marks the cache when the prefix is big enough to be worth writing', () => {
  assert.match(
    chat,
    /CACHE_MIN_CHARS|cacheableSystem/,
    'below the minimum cacheable size a marker just pays the write multiplier for nothing',
  );
});

test('THE TRAP: the report builder must not cache while its batches run concurrently', () => {
  const usesPromiseAll = /await Promise\.all\(\s*batches\.map/.test(report);
  const caches = /cache_control/.test(report);

  if (usesPromiseAll && caches) {
    assert.fail(
      'generate-report fires every batch through Promise.all, so adding cache_control makes all N '
      + 'batches miss AND write — 25% MORE expensive than not caching. Warm the cache with one call '
      + 'that completes before the rest start, then this is safe.',
    );
  }
  // Pin the premise: if the concurrency changes, this test should be revisited deliberately.
  assert.ok(
    usesPromiseAll || caches,
    'generate-report no longer runs batches concurrently — re-evaluate caching there, it may now pay',
  );
});
