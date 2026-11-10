import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatDerivedMassKilograms, formatMassKilograms } from '../lib/mass-units.ts';

test('derived totals round to one decimal from 1 up', () => {
  assert.equal(formatDerivedMassKilograms(260.714286, 'kg'), '260.7');
  assert.equal(formatDerivedMassKilograms(212.714286, 'kg'), '212.7');
  assert.equal(formatDerivedMassKilograms(5, 'kg'), '5');
});
test('derived totals below 1 keep up to three trimmed decimals, never zero', () => {
  assert.equal(formatDerivedMassKilograms(0.04, 'kg'), '0.04');
  assert.equal(formatDerivedMassKilograms(0.714286, 'kg'), '0.714');
  assert.equal(formatDerivedMassKilograms(0.0004, 'kg'), '<0.001');
  assert.equal(formatDerivedMassKilograms(Number.MIN_VALUE, 'kg'), '<0.001');
});
test('zero is "0" and unusable input is null, not a number', () => {
  assert.equal(formatDerivedMassKilograms(0, 'kg'), '0');
  for (const bad of [Number.NaN, Infinity, -Infinity, -1]) assert.equal(formatDerivedMassKilograms(bad, 'kg'), null);
});
test('pounds are converted before formatting', () => {
  assert.equal(formatDerivedMassKilograms(260.714286, 'lb'), '574.8');
  assert.equal(formatDerivedMassKilograms(0.0004, 'lb'), '<0.001');
});
test('the exact entry formatter is untouched', () => {
  assert.equal(formatMassKilograms(260.714286, 'kg'), '260.714286');
});
test('panel keeps the exact formatter for typed values and the derived one for totals', () => {
  const source = readFileSync(new URL('../components/crops/HarvestTargetsPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /\$\{amount\(target\.weeklyKg, massUnit\)\}\/week/);
  assert.match(source, /formatMassKilograms\(a\.target\.kgPerUnit, massUnit\)/);
  assert.match(source, /equivalent \(\$\{derivedAmount\(kg, massUnit\)\}\)`\s*: derivedAmount\(kg, massUnit\)/);
  assert.match(source, /Benchmark before your allowance: \{derivedAmount\(a\.grossCycleKg/);
});
