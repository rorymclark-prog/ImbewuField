import assert from 'node:assert/strict';
import test from 'node:test';
import { runInBatches } from '../lib/batch.ts';

/*
 * runInBatches exists for one caller today — app/api/network/farmers/route.ts, which the scale
 * audit (2026-08-29) flagged for a serverless-timeout risk: farmers loaded one at a time, fully,
 * before the next started (~900s modelled at 5,000 farmers). What this pins:
 *
 *   1. Concurrency is real and BOUNDED at batchSize — not still 1 (the bug this replaces) and not
 *      Infinity (a different, worse bug: one request firing as many concurrent reads as an org
 *      happens to have grown to). Proven by a live in-flight counter, not a timing guess: every
 *      job yields on a macrotask (setTimeout 0) before resolving, so every call dispatched
 *      synchronously within one batch increments the counter before any of them decrements it.
 *   2. Results come back in INPUT order regardless of which job finishes first — a caller
 *      building two same-indexed arrays (route.ts's out[]/ledgers[] are exactly this) breaks the
 *      moment this drifts.
 */

function trackedJob(state: { inFlight: number; maxInFlight: number }, delayMs: number) {
  return async (item: number) => {
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    state.inFlight--;
    return item;
  };
}

test('concurrency is bounded at batchSize — not sequential, not unbounded', async () => {
  const state = { inFlight: 0, maxInFlight: 0 };
  const items = Array.from({ length: 23 }, (_, i) => i); // batches of 10, 10, 3 at batchSize 10
  await runInBatches(items, 10, trackedJob(state, 5));
  assert.equal(state.maxInFlight, 10, 'the largest batch (10) should be the peak, not 1 and not 23');
});

test('results preserve input order even when jobs finish out of order', async () => {
  // Later items resolve FASTER than earlier ones — if runInBatches collected by completion order
  // instead of input order, this would come back scrambled.
  const delays = [40, 10, 30, 0, 20];
  const results = await runInBatches(delays, 5, (delayMs) => new Promise<number>((resolve) => {
    setTimeout(() => resolve(delayMs), delayMs);
  }));
  assert.deepEqual(results, delays);
});

test('order and completeness hold across a batch boundary with an uneven final batch', async () => {
  const items = Array.from({ length: 13 }, (_, i) => i); // batchSize 5 -> batches of 5, 5, 3
  const results = await runInBatches(items, 5, async (i) => {
    await new Promise((resolve) => setTimeout(resolve, (items.length - i) % 3)); // scramble finish order
    return i * 10;
  });
  assert.deepEqual(results, items.map((i) => i * 10));
});

test('fn receives the true index into the original array, not a per-batch offset', async () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const seen: number[] = [];
  await runInBatches(items, 2, async (item, index) => { seen.push(index); return item; });
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
});

test('an empty array resolves to an empty array without calling fn', async () => {
  let calls = 0;
  const results = await runInBatches([], 10, async () => { calls++; return null; });
  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});
