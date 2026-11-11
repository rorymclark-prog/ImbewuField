import assert from 'node:assert/strict';
import test from 'node:test';
import { decimalQuantityProduct, exactDecimalQuantityProduct, DECIMAL_QUANTITY_FLOOR_MAX_FACTORS } from '../lib/farm-records.ts';
import { parseLengthDecimal, parseExactUnitDecimal } from '../lib/length-units.ts';
import { AVOIRDUPOIS_POUND_IN_KILOGRAMS, massToKilograms, readMassQuantityEntry } from '../lib/mass-units.ts';

test('authored pound requests hold decimal product loss while older numeric conversions retain their rounded contract', () => {
  const factors = [10.1234567890123, AVOIRDUPOIS_POUND_IN_KILOGRAMS];
  assert.equal(decimalQuantityProduct(factors), 4.591922757520679);
  assert.equal(massToKilograms(factors[0], 'lb'), 4.591922757520679);
  assert.deepEqual(exactDecimalQuantityProduct(factors), { status: 'held', reason: 'decimal-representation-loss' });
  assert.deepEqual(readMassQuantityEntry({ unit: 'lb', text: '10.1234567890123' }),
    { status: 'held', reason: 'decimal-representation-loss' });
  for (const text of ['1', '0.1', '10']) {
    const read = readMassQuantityEntry({ unit: 'lb', text });
    assert.equal(read.status, 'provided');
    if (read.status === 'provided') assert.equal(read.kilograms, decimalQuantityProduct([Number(text), AVOIRDUPOIS_POUND_IN_KILOGRAMS]));
  }
});

test('exact text validation precedes Number rounding without changing the existing decimal parser', () => {
  const text = '9007199254740990.5';
  assert.equal(parseLengthDecimal(text).status, 'ready', 'older numeric draft behaviour remains compatible');
  assert.deepEqual(parseExactUnitDecimal(text), { status: 'invalid', reason: 'decimal-representation-loss' });
  for (const input of [' +000,50 ', '.5', '0.500000000000000000', '000.500', '000,500']) {
    assert.deepEqual(parseExactUnitDecimal(input), { status: 'ready', value: 0.5 });
    assert.deepEqual(readMassQuantityEntry({ unit: 'kg', text: input }),
      { status: 'provided', entry: { unit: 'kg', text: input }, kilograms: 0.5 });
  }
  for (const input of ['1e3', '1,000.5', 'Infinity', 'NaN', '-0', '-0.000']) {
    assert.equal(readMassQuantityEntry({ unit: 'kg', text: input }).status, 'held', input);
  }
});

test('blank mass and explicit zero remain different supplied evidence and malformed presence cannot masquerade as either', () => {
  for (const unit of ['kg', 'lb'] as const) {
    assert.deepEqual(readMassQuantityEntry({ unit, text: '  ' }), { status: 'missing', entry: { unit, text: '  ' } });
    assert.deepEqual(readMassQuantityEntry({ unit, text: '0' }), { status: 'provided', entry: { unit, text: '0' }, kilograms: 0 });
  }
  for (const value of [null, undefined, false, {}, { unit: 'oz', text: '1' }, { unit: 'lb', text: undefined },
    { unit: 'lb', text: '1', extra: undefined }, Object.create({ unit: 'lb', text: '1' })]) {
    assert.equal(readMassQuantityEntry(value).status, 'held');
  }
  let calls = 0;
  const accessor = { unit: 'lb' };
  Object.defineProperty(accessor, 'text', { enumerable: true, get() { calls++; return '1'; } });
  assert.equal(readMassQuantityEntry(accessor).status, 'held');
  assert.equal(calls, 0);
});

test('strict decimal product rejects underflow, overflow, factor holes and accessors without reading them', () => {
  for (const factors of [[Number.MAX_VALUE, 2], [Number.MIN_VALUE, 0.1]]) {
    assert.deepEqual(exactDecimalQuantityProduct(factors), { status: 'held', reason: 'outside-finite-range' });
  }
  assert.deepEqual(exactDecimalQuantityProduct(new Array(1)), { status: 'held', reason: 'invalid-factor' });
  assert.deepEqual(exactDecimalQuantityProduct(Array.from({ length: DECIMAL_QUANTITY_FLOOR_MAX_FACTORS + 1 }, () => 1)),
    { status: 'held', reason: 'work-limit' });
  let calls = 0;
  const factors = [1];
  Object.defineProperty(factors, 0, { get() { calls++; return 1; } });
  assert.deepEqual(exactDecimalQuantityProduct(factors), { status: 'held', reason: 'invalid-factor' });
  assert.equal(calls, 0);
});
