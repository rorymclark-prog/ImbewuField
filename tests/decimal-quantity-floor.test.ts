import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECIMAL_QUANTITY_FLOOR_MAX_FACTORS,
  DECIMAL_QUANTITY_FLOOR_MAX_WORK,
  decimalQuantityProduct,
  floorDecimalQuantityRatio,
  floorExactDecimalQuantityRatio,
} from '../lib/farm-records.ts';
import { INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES } from '../lib/length-units.ts';

// Engineering arithmetic controls only. None of these values recommends a
// crop density, measures a real bed or supplies an authenticated unit receipt.
test('a decimal whole-count boundary does not lose one through binary multiplication', () => {
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [0.58, 100] }), {
    status: 'ready', whole: 58, hasFraction: false,
  });
});

test('a genuinely subinteger declared product never rounds up before flooring', () => {
  // 75 * 13333333333333333 / 10^18 = 999999999999999975 / 10^18.
  // Both ordinary multiplication and the Number-returning decimal product
  // round that value up to 1; an exact whole-count operation must return 0.
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [0.75, 1.3333333333333333] }), {
    status: 'ready', whole: 0, hasFraction: true,
  });
  assert.equal(decimalQuantityProduct([0.75, 1.3333333333333333]), 1,
    'the existing product retains its Number-returning contract');
});

test('a real fractional remainder stays below its boundary without an epsilon', () => {
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [0.58, 99.99999999999999] }), {
    status: 'ready', whole: 57, hasFraction: true,
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [0.9999999999999999] }), {
    status: 'ready', whole: 0, hasFraction: true,
  });
});

test('declared source factors and divisors cancel without rounding a reciprocal density first', () => {
  const squareFoot = INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES;
  for (const [area, density, whole] of [[11, 5, 55], [2.5, 1.2, 3], [1, 13, 13]] as const) {
    assert.deepEqual(floorDecimalQuantityRatio({ factors: [area, squareFoot, density], divisors: [squareFoot] }), {
      status: 'ready', whole, hasFraction: false,
    });
  }
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [1], divisors: [3] }), {
    status: 'ready', whole: 0, hasFraction: true,
  });
});

test('rounded canonical numbers never acquire guessed source-unit history', () => {
  // These explicit canonical decimal factors multiply to less than 3. Only a
  // separate, validated source receipt could supply the original 1.2/ft² ratio.
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [0.2322576, 12.916692500051665] }), {
    status: 'ready', whole: 2, hasFraction: true,
  });
});

test('safe whole counts are checked after exact division, including large intermediate values', () => {
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [Number.MAX_SAFE_INTEGER] }), {
    status: 'ready', whole: Number.MAX_SAFE_INTEGER, hasFraction: false,
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [Number.MAX_SAFE_INTEGER, 2], divisors: [2] }), {
    status: 'ready', whole: Number.MAX_SAFE_INTEGER, hasFraction: false,
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [Number.MAX_SAFE_INTEGER, 2] }), {
    status: 'held', reason: 'unsafe-whole-count',
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [1e308, 1e308], divisors: [1e308, 1e308] }), {
    status: 'ready', whole: 1, hasFraction: false,
  });
});

test('tiny positive ratios floor to zero with a remainder rather than losing a measurement to floating underflow', () => {
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [Number.MIN_VALUE, Number.MIN_VALUE] }), {
    status: 'ready', whole: 0, hasFraction: true,
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [1e-8, 3e-8] }), {
    status: 'ready', whole: 0, hasFraction: true,
  });
  for (const zero of [0, -0]) assert.deepEqual(floorDecimalQuantityRatio({ factors: [zero, 1e308] }), {
    status: 'ready', whole: 0, hasFraction: false,
  });
});

test('unknown or invalid operands cannot become a known zero through a zero factor', () => {
  for (const invalid of [NaN, Infinity, -Infinity, -1, null, undefined, '', '1']) {
    assert.deepEqual(floorDecimalQuantityRatio({ factors: [0, invalid] } as never), {
      status: 'held', reason: 'invalid-factor',
    });
    assert.deepEqual(floorDecimalQuantityRatio({ factors: [0], divisors: [invalid] } as never), {
      status: 'held', reason: 'invalid-divisor',
    });
  }
  for (const zero of [0, -0]) assert.deepEqual(floorDecimalQuantityRatio({ factors: [0], divisors: [zero] }), {
    status: 'held', reason: 'invalid-divisor',
  });
});

test('empty and malformed requests do not default a missing measurement to one', () => {
  for (const input of [null, undefined, [], {}, { divisors: [1] }, { factors: [] }]) {
    assert.deepEqual(floorDecimalQuantityRatio(input as never), { status: 'held', reason: 'missing-factors' });
  }
  for (const factors of [null, undefined, {}, '1']) assert.deepEqual(floorDecimalQuantityRatio({ factors } as never), {
    status: 'held', reason: 'invalid-factor',
  });
  for (const divisors of [null, {}, '1']) assert.deepEqual(floorDecimalQuantityRatio({ factors: [1], divisors } as never), {
    status: 'held', reason: 'invalid-divisor',
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [2], divisors: [] }), { status: 'ready', whole: 2, hasFraction: false });
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [2], divisors: undefined }), { status: 'ready', whole: 2, hasFraction: false });
});

test('holes, inherited array entries and getters are not supplied numeric evidence', () => {
  const sparse = new Array<number>(2); sparse[0] = 0;
  const inherited = new Array<number>(2); inherited[0] = 0;
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 1: 1 }));
  let getters = 0;
  const getter = [0, 1]; Object.defineProperty(getter, 1, { get() { ++getters; return 1; } });
  for (const factors of [sparse, inherited, getter]) {
    assert.deepEqual(floorDecimalQuantityRatio({ factors }), { status: 'held', reason: 'invalid-factor' });
  }
  for (const divisors of [sparse, inherited, getter]) {
    assert.deepEqual(floorDecimalQuantityRatio({ factors: [0], divisors }), { status: 'held', reason: 'invalid-divisor' });
  }
  const input = { get factors() { ++getters; return [1]; } };
  assert.deepEqual(floorDecimalQuantityRatio(input), { status: 'held', reason: 'invalid-factor' });
  assert.equal(getters, 0);
});

test('the documented software budget holds before large arithmetic and never rewrites its factors', () => {
  const factors = Object.freeze(Array<number>(DECIMAL_QUANTITY_FLOOR_MAX_FACTORS).fill(1));
  assert.deepEqual(floorDecimalQuantityRatio({ factors }), { status: 'ready', whole: 1, hasFraction: false });
  assert.deepEqual(floorDecimalQuantityRatio({ factors, divisors: [1] }), { status: 'held', reason: 'work-limit' });
  const numerator = Object.freeze([0.58, 100]), denominator = Object.freeze([1]);
  const before = JSON.stringify([numerator, denominator]);
  assert.deepEqual(floorDecimalQuantityRatio({ factors: numerator, divisors: denominator }), { status: 'ready', whole: 58, hasFraction: false });
  assert.equal(JSON.stringify([numerator, denominator]), before);
});

test('a changing array length cannot expand work after the software budget was checked', () => {
  let lengthReads = 0;
  const factors = new Proxy([1], {
    get(target, key, receiver) {
      if (key === 'length') return ++lengthReads === 1 ? 1 : Number.MAX_SAFE_INTEGER;
      return Reflect.get(target, key, receiver);
    },
  });
  assert.deepEqual(floorDecimalQuantityRatio({ factors }), { status: 'ready', whole: 1, hasFraction: false });
  assert.equal(lengthReads, 1);
});

test('exact source coefficients keep digits that Number.toString cannot preserve', () => {
  const below = { digits: BigInt('999999999999999999'), exponent: -18 };
  const above = { digits: BigInt('1000000000000000001'), exponent: -18 };
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [below] }), { status: 'ready', whole: 0, hasFraction: true });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [above] }), { status: 'ready', whole: 1, hasFraction: true });
  // Declaring the already-rounded Number is a different input contract. The
  // numeric facade must not pretend it still knows the original lexical digits.
  assert.deepEqual(floorDecimalQuantityRatio({ factors: [Number('0.999999999999999999')] }), {
    status: 'ready', whole: 1, hasFraction: false,
  });
});

test('exact decimal source ratios share the integer quotient authority without a reciprocal Number', () => {
  const squareFoot = { digits: BigInt(9290304), exponent: -8 };
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [
    { digits: BigInt(25), exponent: -1 }, squareFoot, { digits: BigInt(12), exponent: -1 },
  ], divisors: [squareFoot] }), { status: 'ready', whole: 3, hasFraction: false });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [
    { digits: BigInt(75), exponent: -2 }, { digits: BigInt('13333333333333333'), exponent: -16 },
  ] }), { status: 'ready', whole: 0, hasFraction: true });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [
    { digits: BigInt(Number.MAX_SAFE_INTEGER), exponent: 0 }, { digits: BigInt(2), exponent: 0 },
  ], divisors: [{ digits: BigInt(2), exponent: 0 }] }), { status: 'ready', whole: Number.MAX_SAFE_INTEGER, hasFraction: false });
});

test('malformed coefficient and exponent values hold without treating supplied zero as permission', () => {
  const zero = { digits: BigInt(0), exponent: 0 };
  const invalid = [null, undefined, {}, { digits: 1, exponent: 0 }, { digits: BigInt(-1), exponent: 0 },
    { digits: BigInt(1), exponent: NaN }, { digits: BigInt(1), exponent: Infinity },
    { digits: BigInt(1), exponent: 0.5 }, { digits: BigInt(1), exponent: Number.MAX_SAFE_INTEGER + 1 }];
  for (const value of invalid) {
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero, value] } as never), { status: 'held', reason: 'invalid-factor' });
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: [value] } as never), { status: 'held', reason: 'invalid-divisor' });
  }
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: [zero] }), { status: 'held', reason: 'invalid-divisor' });
});

test('huge exact exponents and coefficient work hold before exponentiation or multiplication', () => {
  const one = { digits: BigInt(1), exponent: 0 }, zero = { digits: BigInt(0), exponent: 0 };
  for (const exponent of [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    const factor = { digits: BigInt(1), exponent };
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [factor] }), { status: 'held', reason: 'work-limit' });
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: [factor] }), { status: 'held', reason: 'work-limit' });
  }
  const huge = { digits: BigInt(10) ** BigInt(DECIMAL_QUANTITY_FLOOR_MAX_WORK), exponent: 0 };
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [huge] }), { status: 'held', reason: 'work-limit' });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: [huge] }), { status: 'held', reason: 'work-limit' });
  const halfBudget = { digits: BigInt(1), exponent: -(DECIMAL_QUANTITY_FLOOR_MAX_WORK / 2) };
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [halfBudget], divisors: [halfBudget] }), {
    status: 'held', reason: 'work-limit',
  });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [one], divisors: [] }), { status: 'ready', whole: 1, hasFraction: false });
});

test('exact coefficient inputs reject holes, inherited fields and accessors without invoking getters', () => {
  const zero = { digits: BigInt(0), exponent: 0 }, sparse = new Array<{ digits: bigint; exponent: number }>(1);
  let getters = 0;
  const digitsGetter = { get digits() { ++getters; return BigInt(1); }, exponent: 0 };
  const exponentGetter = { digits: BigInt(1), get exponent() { ++getters; return 0; } };
  for (const value of [digitsGetter, exponentGetter, Object.create({ digits: BigInt(1), exponent: 0 })]) {
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [value] }), { status: 'held', reason: 'invalid-factor' });
    assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: [value] }), { status: 'held', reason: 'invalid-divisor' });
  }
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: sparse }), { status: 'held', reason: 'invalid-factor' });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: [zero], divisors: sparse }), { status: 'held', reason: 'invalid-divisor' });
  const rows = [zero]; Object.defineProperty(rows, 0, { get() { ++getters; return zero; } });
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors: rows }), { status: 'held', reason: 'invalid-factor' });
  assert.equal(getters, 0);
});

test('exact coefficients are detached once and never mutated or re-read during arithmetic', () => {
  const first = { digits: BigInt(3), exponent: 0 };
  const later = new Proxy({ digits: BigInt(2), exponent: 0 }, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'digits') first.digits = BigInt(99);
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const result = floorExactDecimalQuantityRatio({ factors: [first, later] });
  assert.deepEqual(result, { status: 'ready', whole: 6, hasFraction: false });
  first.digits = BigInt(100);
  assert.deepEqual(result, { status: 'ready', whole: 6, hasFraction: false });
  const coefficient = Object.freeze({ digits: BigInt(58), exponent: -2 });
  const factors = Object.freeze([coefficient, Object.freeze({ digits: BigInt(100), exponent: 0 })]);
  assert.deepEqual(floorExactDecimalQuantityRatio({ factors }), { status: 'ready', whole: 58, hasFraction: false });
  assert.equal(coefficient.digits, BigInt(58)); assert.equal(coefficient.exponent, -2);
});
