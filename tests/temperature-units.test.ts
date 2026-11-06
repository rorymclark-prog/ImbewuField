import assert from 'node:assert/strict';
import test from 'node:test';
import { TEMPERATURE_DISPLAY_UNITS, isTemperatureDisplayUnit, kelvinToDisplayTemperature } from '../lib/temperature-units.ts';

// Reference points are arithmetic examples from the supplied NIST exact scale
// equations, not weather bounds, crop thresholds or source-quality acceptance.
function approximately(actual: number | null, expected: number): void {
  assert.equal(typeof actual, 'number');
  if (actual === null) throw Error('Known finite reference point became unknown');
  assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} differs from independent scale reference ${expected}`);
}
test('supported display units are the exact immutable explicit primitive codes', () => {
  assert.deepEqual(TEMPERATURE_DISPLAY_UNITS, ['K', 'C', 'F']); assert.ok(Object.isFrozen(TEMPERATURE_DISPLAY_UNITS));
  for (const unit of ['K', 'C', 'F']) assert.equal(isTemperatureDisplayUnit(unit), true);
  assert.throws(() => (TEMPERATURE_DISPLAY_UNITS as unknown as string[]).push('OTHER'), TypeError);
});
for (const unit of [undefined, null, '', 'k', 'c', 'f', 'Kelvin', 'Celsius', 'Fahrenheit', '°C', '°F', ' K', 'C ', 'F\n', '\u212a', 0, false, BigInt(0), Symbol('K'), ['K'], new String('K')]) {
  test('unsupported unit ' + String(typeof unit === 'symbol' ? 'symbol' : unit) + ' never selects a default or coerces input', () => {
    assert.equal(isTemperatureDisplayUnit(unit), false); assert.equal(kelvinToDisplayTemperature(273.15, unit), null);
  });
}
test('273.15 source kelvin is zero Celsius and 32 Fahrenheit without altering source kelvin', () => {
  assert.equal(kelvinToDisplayTemperature(273.15, 'K'), 273.15);
  assert.equal(kelvinToDisplayTemperature(273.15, 'C'), 0);
  assert.equal(kelvinToDisplayTemperature(273.15, 'F'), 32);
});
for (const [kelvin, celsius, fahrenheit] of [[233.15, -40, -40], [253.15, -20, -4], [373.15, 100, 212], [310.15, 37, 98.6]]) {
  test('independent arithmetic scale reference ' + kelvin + ' K gives ' + celsius + ' C and ' + fahrenheit + ' F', () => {
    approximately(kelvinToDisplayTemperature(kelvin, 'C'), celsius);
    approximately(kelvinToDisplayTemperature(kelvin, 'F'), fahrenheit);
  });
}
test('known source zero remains a number and cannot be confused with missing input', () => {
  assert.ok(Object.is(kelvinToDisplayTemperature(0, 'K'), 0));
  approximately(kelvinToDisplayTemperature(0, 'C'), -273.15);
  approximately(kelvinToDisplayTemperature(0, 'F'), -459.67);
  assert.equal(kelvinToDisplayTemperature(null, 'K'), null); assert.equal(kelvinToDisplayTemperature(undefined, 'C'), null);
});
test('kelvin identity preserves signed zero, subnormal precision and extreme finite primitive values', () => {
  for (const input of [-0, 0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, 273.150001]) {
    assert.ok(Object.is(kelvinToDisplayTemperature(input, 'K'), input));
  }
});
test('the display arithmetic does not fabricate a plausible-weather or nonnegative-kelvin filter', () => {
  assert.equal(kelvinToDisplayTemperature(-10, 'K'), -10);
  approximately(kelvinToDisplayTemperature(-10, 'C'), -283.15);
  approximately(kelvinToDisplayTemperature(-10, 'F'), -477.67);
  assert.ok(Number.isFinite(kelvinToDisplayTemperature(Number.MAX_VALUE, 'C')));
});
test('finite input whose Fahrenheit arithmetic overflows is unknown rather than Infinity or a clamped value', () => {
  assert.equal(kelvinToDisplayTemperature(Number.MAX_VALUE, 'F'), null);
  assert.equal(kelvinToDisplayTemperature(-Number.MAX_VALUE, 'F'), null);
  const finite = kelvinToDisplayTemperature(Number.MAX_VALUE / 2, 'F');
  assert.equal(typeof finite, 'number'); assert.ok(Number.isFinite(finite)); assert.ok(finite! > Number.MAX_VALUE / 2);
});
test('fractional conversion remains unrounded for the consumer to format', () => {
  const celsius = kelvinToDisplayTemperature(273.151, 'C'), fahrenheit = kelvinToDisplayTemperature(273.151, 'F');
  approximately(celsius, 0.001); approximately(fahrenheit, 32.0018);
  assert.notEqual(celsius, 0); assert.notEqual(celsius, 0.001, 'binary arithmetic is preserved rather than rounded to three places');
  assert.notEqual(fahrenheit, 32); assert.notEqual(fahrenheit, 32.002);
});
test('missing, nonfinite and nonnumeric source values never become zero or invoke numeric coercion', () => {
  for (const input of [null, undefined, NaN, Infinity, -Infinity, '', '0', '273.15', false, true, BigInt(0), Symbol('value'), [], [273.15], new Number(273.15)]) {
    for (const unit of ['K', 'C', 'F']) assert.equal(kelvinToDisplayTemperature(input, unit), null);
  }
});
test('unsafe source or unit objects cause no getters, reflection or coercion and are left unchanged', () => {
  let calls = 0;
  const unsafe = Object.defineProperties({}, {
    valueOf: { get() { calls++; throw Error('value getter'); } },
    toString: { get() { calls++; throw Error('string getter'); } },
    [Symbol.toPrimitive]: { get() { calls++; throw Error('primitive getter'); } },
  });
  const descriptor = Object.getOwnPropertyDescriptors(unsafe);
  const proxy = new Proxy({}, {
    get() { calls++; throw Error('proxy get'); }, ownKeys() { calls++; throw Error('proxy keys'); },
    getOwnPropertyDescriptor() { calls++; throw Error('proxy descriptor'); }, getPrototypeOf() { calls++; throw Error('proxy prototype'); },
  });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const input of [unsafe, proxy, revoked.proxy]) {
    assert.equal(isTemperatureDisplayUnit(input), false);
    assert.equal(kelvinToDisplayTemperature(input, 'C'), null);
    assert.equal(kelvinToDisplayTemperature(273.15, input), null);
    assert.equal(kelvinToDisplayTemperature(input, input), null);
  }
  assert.equal(calls, 0); assert.deepEqual(Object.getOwnPropertyDescriptors(unsafe), descriptor);
});
