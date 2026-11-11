import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { reviewSeedPurchaseCounts, type SeedPurchaseCountsReview } from '../lib/seed-purchase-counts.ts';

// Synthetic whole-count arithmetic only. These counts neither calculate gross
// seed demand nor recommend stock, losses, pack sizes, purchases or crop inputs.
const max = Number.MAX_SAFE_INTEGER;
const fields = ['status', 'neededSeeds', 'packsNeeded', 'plannedPackSeeds'] as const;
const statuses = new Set(['complete', 'unknown', 'invalid', 'overflow']);
function shape(actual: SeedPurchaseCountsReview) {
  assert.equal(Object.isFrozen(actual), true);
  assert.deepEqual(Reflect.ownKeys(actual).sort(), [...fields].sort());
  assert.ok(statuses.has(actual.status));
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key); assert.ok(descriptor);
    assert.equal(descriptor.enumerable, true); assert.equal(descriptor.configurable, false);
    assert.ok('value' in descriptor); assert.equal(descriptor.writable, false);
  }
  for (const value of [actual.neededSeeds, actual.packsNeeded, actual.plannedPackSeeds]) {
    assert.ok(value === null || typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0);
    assert.equal(Object.is(value, -0), false, 'valid negative-zero input still yields ordinary integer counts');
  }
}
function equal(actual: SeedPurchaseCountsReview, expected: SeedPurchaseCountsReview) {
  shape(actual); assert.deepEqual(actual, expected);
}
const unknown = { status: 'unknown' as const, neededSeeds: null, packsNeeded: null, plannedPackSeeds: null };
const invalid = { status: 'invalid' as const, neededSeeds: null, packsNeeded: null, plannedPackSeeds: null };

test('missing required or allocated evidence stays unknown even beside an explicit zero', () => {
  for (const missing of [null, undefined]) {
    for (const known of [0, -0, 1, max]) for (const pack of [null, undefined, 1, max]) {
      equal(reviewSeedPurchaseCounts(missing, known, pack), unknown);
      equal(reviewSeedPurchaseCounts(known, missing, pack), unknown);
    }
    equal(reviewSeedPurchaseCounts(missing, missing, null), unknown);
    equal(reviewSeedPurchaseCounts(missing, missing, 1), unknown);
  }
});

test('an unknown pack count retains an exactly known deficit without inventing a pack or a completed review', () => {
  for (const pack of [null, undefined]) for (const [required, allocated, needed] of [
    [10, 3, 7], [0, 0, 0], [0, max, 0], [10, 11, 0], [max, 0, max], [max, max - 1, 1],
  ]) {
    equal(reviewSeedPurchaseCounts(required, allocated, pack), {
      status: 'unknown', neededSeeds: needed, packsNeeded: null, plannedPackSeeds: null,
    });
  }
});

const invalidInputs: readonly [string, unknown][] = [
  ['blank string', ''], ['whitespace string', ' '], ['numeral string', '1'], ['zero string', '0'],
  ['boolean true', true], ['boolean false', false], ['plain object', {}], ['null-prototype object', Object.create(null)],
  ['array', [1]], ['empty array', []], ['function', () => 1], ['symbol', Symbol('count')],
  ['bigint', BigInt(1)], ['boxed number', new Number(1)], ['boxed boolean', new Boolean(false)],
  ['NaN', NaN], ['positive infinity', Infinity], ['negative infinity', -Infinity], ['fraction', 0.5],
  ['tiny fraction', Number.MIN_VALUE], ['negative count', -1], ['unsafe count', max + 1],
];
for (const [description, value] of invalidInputs) {
  test(`${description} is invalid without coercion in every argument and outranks missing evidence`, () => {
    for (const position of [0, 1, 2]) {
      const known: unknown[] = [5, 2, 3]; known[position] = value;
      equal(reviewSeedPurchaseCounts(known[0], known[1], known[2]), invalid);
      const missing: unknown[] = [null, undefined, null]; missing[position] = value;
      equal(reviewSeedPurchaseCounts(missing[0], missing[1], missing[2]), invalid);
    }
  });
}

test('an invalid pack count cannot be hidden by zero demand or unknown allocation', () => {
  for (const pack of [0, -0, -1, NaN, '1']) {
    equal(reviewSeedPurchaseCounts(0, 0, pack), invalid);
    equal(reviewSeedPurchaseCounts(0, undefined, pack), invalid);
    equal(reviewSeedPurchaseCounts(undefined, null, pack), invalid);
  }
});

test('hostile object properties and conversion hooks execute zero times and input evidence is untouched', () => {
  const calls = { getter: 0, valueOf: 0, toString: 0, primitive: 0, proxy: 0 };
  const object = {
    valueOf() { calls.valueOf++; throw Error('No numeric coercion'); },
    toString() { calls.toString++; throw Error('No diagnostic coercion'); },
    [Symbol.toPrimitive]() { calls.primitive++; throw Error('No primitive coercion'); },
  };
  Object.defineProperty(object, 'count', { enumerable: true, get() { calls.getter++; throw Error('No property reads'); } });
  const before = Object.getOwnPropertyDescriptors(object), array = [3, 4], originalArray = [...array];
  const proxy = new Proxy({}, {
    get() { calls.proxy++; throw Error('No object inspection'); },
    getOwnPropertyDescriptor() { calls.proxy++; throw Error('No descriptor inspection'); },
    getPrototypeOf() { calls.proxy++; throw Error('No prototype inspection'); },
    ownKeys() { calls.proxy++; throw Error('No key inspection'); },
  });
  for (const value of [object, proxy, array]) for (const position of [0, 1, 2]) {
    const args: unknown[] = [5, 2, 3]; args[position] = value;
    equal(reviewSeedPurchaseCounts(args[0], args[1], args[2]), invalid);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(object), before);
  assert.deepEqual(array, originalArray);
  assert.deepEqual(calls, { getter: 0, valueOf: 0, toString: 0, primitive: 0, proxy: 0 });
});

test('known allocation reduces only this plan deficit, clamps at zero and buys the minimum whole packs', () => {
  for (const [required, allocated, pack, needed, packs, planned] of [
    [13, 3, 4, 10, 3, 12], [12, 0, 4, 12, 3, 12], [1, 0, 4, 1, 1, 4],
    [3, 10, 4, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0, max, max, 0, 0, 0],
    [-0, -0, 1, 0, 0, 0], [max, max - 1, max, 1, 1, max], [max, 0, max, max, 1, max],
  ]) equal(reviewSeedPurchaseCounts(required, allocated, pack), {
    status: 'complete', neededSeeds: needed, packsNeeded: packs, plannedPackSeeds: planned,
  });
});

test('a safe deficit and safe pack count remain readable when only the planned pack product overflows', () => {
  const expectedPacks = Number((BigInt(max) / BigInt(2)) + BigInt(1));
  equal(reviewSeedPurchaseCounts(max, 0, 2), {
    status: 'overflow', neededSeeds: max, packsNeeded: expectedPacks, plannedPackSeeds: null,
  });
  equal(reviewSeedPurchaseCounts(max, 0, max - 1), {
    status: 'overflow', neededSeeds: max, packsNeeded: 2, plannedPackSeeds: null,
  });
  equal(reviewSeedPurchaseCounts(max, 0, 1), {
    status: 'complete', neededSeeds: max, packsNeeded: max, plannedPackSeeds: max,
  });
});

test('finite synthetic integer boundaries match an independent quotient-and-remainder oracle and minimum-pack law', () => {
  const counts = [0, 1, 2, 3, 7, 16, 17, 2 ** 26 - 1, 2 ** 26, 2 ** 26 + 1, 2 ** 32 - 1, 2 ** 32 + 1, max - 2, max - 1, max];
  const sizes = [1, 2, 3, 7, 16, 17, 2 ** 26 - 1, 2 ** 26 + 1, 2 ** 32 - 1, max - 1, max];
  const zero = BigInt(0), one = BigInt(1), limit = BigInt(max), seen = new Set<string>();
  for (const required of counts) for (const allocated of counts) for (const size of sizes) {
    const demand = BigInt(required), allocation = BigInt(allocated), pack = BigInt(size);
    const needed = demand > allocation ? demand - allocation : zero;
    // The oracle divides first and uses its remainder, avoiding a mirrored
    // (needed + pack - 1) numerator or any floating-point ceiling comparison.
    const packs = needed / pack + (needed % pack === zero ? zero : one), planned = packs * pack;
    const expected: SeedPurchaseCountsReview = { status: planned > limit ? 'overflow' : 'complete',
      neededSeeds: Number(needed), packsNeeded: Number(packs), plannedPackSeeds: planned > limit ? null : Number(planned) };
    const actual = reviewSeedPurchaseCounts(required, allocated, size); equal(actual, expected); seen.add(actual.status);
    assert.ok(packs * pack >= needed);
    assert.ok(packs === zero || (packs - one) * pack < needed, 'one fewer pack must not cover the explicit deficit');
  }
  assert.deepEqual([...seen].sort(), ['complete', 'overflow']);
});

test('every status returns only the frozen four-field arithmetic result and cannot gain a caller-authored grant', () => {
  for (const args of [[1, 0, 1], [undefined, 0, 1], [0, 0, 0], [max, 0, 2]]) {
    const result = reviewSeedPurchaseCounts(args[0], args[1], args[2]); shape(result);
    assert.throws(() => Object.assign(result, { actorApproved: true }), TypeError);
    assert.equal(Object.hasOwn(result, 'actorApproved'), false); shape(result);
  }
});

test('isolated native evaluation of the actual helper has no import-time or call-time clocks, randomness, dependencies or I/O', () => {
  const source = readFileSync(new URL('../lib/seed-purchase-counts.ts', import.meta.url), 'utf8');
  // Native stripping is instrumentation for this isolated purity check only;
  // the ordinary arithmetic cases above execute the real exported module.
  const stripped = stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: 'seed-purchase-counts.ts' })
    .replace(/^export\s+(?=function\s+reviewSeedPurchaseCounts\b)/m, '');
  const effects: string[] = [];
  const deny = (name: string) => () => { effects.push(name); throw Error(`Unexpected helper side effect: ${name}`); };
  const math = Object.create(Math); Object.defineProperty(math, 'random', { value: deny('random') });
  const clock = new Proxy(Date, { apply: deny('clock'), construct: deny('clock'),
    get(target, key) { return key === 'now' ? deny('clock') : Reflect.get(target, key); } });
  const sandbox: Record<string, unknown> = { Math: math, Date: clock, require: deny('dependency'), fetch: deny('network'),
    setTimeout: deny('timer'), setInterval: deny('timer') };
  for (const key of ['window', 'localStorage', 'sessionStorage', 'document', 'navigator', 'process', 'console']) {
    Object.defineProperty(sandbox, key, { get: deny(key), configurable: true });
  }
  runInNewContext(`${stripped}\nglobalThis.__review = reviewSeedPurchaseCounts;`, sandbox, { timeout: 1000 });
  const review = sandbox.__review as typeof reviewSeedPurchaseCounts;
  assert.equal(typeof review, 'function');
  const result = review(13, 3, 4); shape(result);
  assert.equal(result.status, 'complete'); assert.equal(result.neededSeeds, 10);
  assert.equal(result.packsNeeded, 3); assert.equal(result.plannedPackSeeds, 12);
  assert.deepEqual(effects, []);
});
