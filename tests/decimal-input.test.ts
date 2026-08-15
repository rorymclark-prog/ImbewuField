import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDecimalInput } from '../lib/decimal-input.ts';

/*
 * The regression this guards: a farmer on a comma-decimal Android keyboard types
 * "12,5" into a listing price or a harvest weight. A native type="number" input
 * either drops the comma keystroke (so "12,5" lands as "125") or reports "" for
 * the whole field — either way the farmer sees no error and the wrong number, or
 * no number, is what gets saved. components/exchange/NewListingForm.tsx and
 * components/MyRecords.tsx both parse through this function instead.
 */

test('reads a comma decimal the same as a point decimal', () => {
  assert.equal(parseDecimalInput('12,5'), 12.5);
  assert.equal(parseDecimalInput('12.5'), 12.5);
});

test('trims surrounding whitespace', () => {
  assert.equal(parseDecimalInput('  6,5  '), 6.5);
});

test('a whole number with no separator still parses', () => {
  assert.equal(parseDecimalInput('80'), 80);
});

test('an empty or non-numeric string is NaN, not a silently wrong number', () => {
  assert.ok(Number.isNaN(parseDecimalInput('')));
  assert.ok(Number.isNaN(parseDecimalInput('   ')));
  assert.ok(Number.isNaN(parseDecimalInput('abc')));
});

test('only the first comma is treated as the decimal separator', () => {
  // Guards against a thousands-grouped typo ("1,200,5") being misread as a
  // plausible-looking number instead of failing validation.
  assert.equal(parseDecimalInput('1,200,5'), 1.2);
});
