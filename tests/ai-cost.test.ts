// Pricing an AI call, and the arithmetic that decides whether caching helps or hurts.
//
// The reason this file leans hard on the cache multipliers: a prompt cache WRITE costs 1.25x an
// ordinary send. app/api/generate-report/route.ts fires every batch concurrently through
// Promise.all, so if cache_control were simply added to that call, all N batches would be in
// flight before any of them had written the entry — N misses, N writes, and a bill 25% HIGHER than
// doing nothing. The saving only exists if one call is allowed to land first. That is a property
// of the CONCURRENCY, not of the cache, and it is invisible in any test that prices one call.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  costOf,
  totalCost,
  logAiUsage,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
} from '../lib/ai-cost.ts';

test('prices a plain call at the model rate', () => {
  const c = costOf('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
  assert.equal(c.usd, 18); // $3 input + $15 output
  assert.equal(c.effectiveInputTokens, 1_000_000);
});

test('an unknown model is NaN, never a silent zero', () => {
  const c = costOf('claude-imaginary-9', { input_tokens: 1_000_000, output_tokens: 0 });
  assert.ok(Number.isNaN(c.usd), 'an unpriced model must not read as a free call');
});

test('missing or malformed usage degrades to zero rather than NaN-poisoning a total', () => {
  for (const u of [null, undefined, {}, { input_tokens: null }, { output_tokens: Number.NaN }]) {
    const c = costOf('claude-sonnet-4-6', u as never);
    assert.equal(c.usd, 0, `usage ${JSON.stringify(u)} should price at 0`);
  }
});

test('cache reads are a tenth and cache writes are a quarter dearer', () => {
  const read = costOf('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 });
  const write = costOf('claude-sonnet-4-6', { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 });
  const plain = costOf('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 0 });

  assert.equal(read.usd, plain.usd * CACHE_READ_MULTIPLIER);
  assert.equal(write.usd, plain.usd * CACHE_WRITE_MULTIPLIER);
  assert.ok(write.usd > plain.usd, 'a cache WRITE must be dearer than not caching — this is the trap');
});

test('THE TRAP: N concurrent batches that all miss cost MORE than not caching at all', () => {
  const BATCHES = 11;              // a comprehensive report
  const SHARED = 10_000;           // system prompt + seven images, identical every batch
  const VARYING = 8_000;           // the section instructions, different every batch

  const noCache = totalCost(
    Array.from({ length: BATCHES }, () =>
      costOf('claude-sonnet-4-6', { input_tokens: SHARED + VARYING, output_tokens: 0 })),
  );

  // Every batch in flight before any has written the entry — what Promise.all actually does.
  const allMiss = totalCost(
    Array.from({ length: BATCHES }, () =>
      costOf('claude-sonnet-4-6', {
        input_tokens: VARYING, output_tokens: 0, cache_creation_input_tokens: SHARED,
      })),
  );

  assert.ok(
    allMiss.usd > noCache.usd,
    'naive concurrent caching must be recognised as MORE expensive, not less',
  );

  // One call lands first and writes; the rest read.
  const warmed = totalCost([
    costOf('claude-sonnet-4-6', { input_tokens: VARYING, output_tokens: 0, cache_creation_input_tokens: SHARED }),
    ...Array.from({ length: BATCHES - 1 }, () =>
      costOf('claude-sonnet-4-6', { input_tokens: VARYING, output_tokens: 0, cache_read_input_tokens: SHARED })),
  ]);

  assert.ok(warmed.usd < noCache.usd, 'warming the cache first must actually save money');

  // Guard the SHAPE of the win so nobody oversells it: the varying half cannot be cached, so the
  // saving is bounded by how much of the prompt is genuinely shared.
  const saving = 1 - warmed.usd / noCache.usd;
  assert.ok(saving > 0.2 && saving < 0.6, `expected a partial saving, got ${(saving * 100).toFixed(1)}%`);
});

test('totalCost sums calls and survives an unpriced model in the set', () => {
  const t = totalCost([
    costOf('claude-sonnet-4-6', { input_tokens: 1_000_000, output_tokens: 0 }),
    costOf('claude-nope', { input_tokens: 1_000_000, output_tokens: 0 }),
  ]);
  assert.equal(t.calls, 2);
  assert.equal(t.usd, 3, 'a NaN call must not poison the total');
  assert.equal(t.inputTokens, 2_000_000, 'but its tokens are still counted');
});

test('logAiUsage emits one greppable [ai-cost] line and returns the cost', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (m?: unknown) => { lines.push(String(m)); };
  let c;
  try {
    c = logAiUsage('generate-report', 'claude-sonnet-4-6', { input_tokens: 1000, output_tokens: 500 }, 'batch 1/11');
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[ai-cost\] /);
  const payload = JSON.parse(lines[0].replace('[ai-cost] ', ''));
  assert.equal(payload.route, 'generate-report');
  assert.equal(payload.note, 'batch 1/11');
  assert.ok(payload.usd > 0);
  assert.equal(c.inputTokens, 1000);
});
