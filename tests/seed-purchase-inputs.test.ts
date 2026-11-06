import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { parseSeedPurchaseCountInput, type SeedPurchaseCountInput, type SeedPurchaseCountKind } from '../lib/seed-purchase-inputs.ts';

// Raw editor-boundary fixtures only: these strings do not establish nursery
// demand, physical stock, a pack recommendation, source approval or a purchase.
const keys = ['status', 'rawText', 'value', 'reason'];
const kinds: readonly SeedPurchaseCountKind[] = ['allocation', 'pack'];
function exact(actual: SeedPurchaseCountInput, expected: SeedPurchaseCountInput) {
  assert.equal(Object.isFrozen(actual), true);
  assert.deepEqual(Reflect.ownKeys(actual), keys, 'the public result has exactly four enumerable fields in contract order');
  for (const name of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, name); assert.ok(descriptor);
    assert.equal(descriptor.enumerable, true); assert.ok('value' in descriptor);
    assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false);
  }
  assert.ok(['ready', 'unknown', 'invalid'].includes(actual.status));
  assert.ok(actual.rawText === null || typeof actual.rawText === 'string');
  assert.ok(actual.value === null || Number.isSafeInteger(actual.value) && actual.value >= 0 && !Object.is(actual.value, -0));
  assert.ok(actual.reason === null || ['whole-count-required', 'outside-safe-integer-range', 'positive-pack-size-required', 'unsupported-count-kind'].includes(actual.reason));
  assert.deepEqual(actual, expected);
}
const ready = (rawText: string, value: number): SeedPurchaseCountInput => ({ status: 'ready', rawText, value, reason: null });
const invalid = (rawText: string | null, reason: SeedPurchaseCountInput['reason'] = 'whole-count-required'): SeedPurchaseCountInput =>
  ({ status: 'invalid', rawText, value: null, reason });

test('a raw blank is unknown in either field while exact original whitespace remains available to the editor', () => {
  for (const raw of ['', ' ', '\t\r\n', '\u00a0\u2009\u202f']) for (const kind of kinds) {
    exact(parseSeedPurchaseCountInput(raw, kind), { status: 'unknown', rawText: raw, value: null, reason: null });
  }
  // Null/undefined are malformed editor values, unlike primitive blank text.
  // The separate numeric helper's unknown-count policy must not coerce them here.
  for (const raw of [null, undefined]) for (const kind of kinds) exact(parseSeedPurchaseCountInput(raw, kind), invalid(null));
});

test('an explicit allocation zero is ready but an explicit zero pack size is invalid, never blank or defaulted', () => {
  for (const raw of ['0', '00', ' 0000 ', '\t0\n']) {
    exact(parseSeedPurchaseCountInput(raw, 'allocation'), ready(raw, 0));
    exact(parseSeedPurchaseCountInput(raw, 'pack'), invalid(raw, 'positive-pack-size-required'));
  }
  for (const kind of kinds) exact(parseSeedPurchaseCountInput(0, kind), invalid(null));
});

test('safe integer digit strings retain leading zeros and outer whitespace without changing their mathematical count', () => {
  const values = [1, 2, 9, 10, 99, 2 ** 26 - 1, 2 ** 32 - 1, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER];
  for (const value of values) for (const raw of [String(value), `000${value}`, ` \t000${value}\n\u00a0`]) for (const kind of kinds) {
    const result = parseSeedPurchaseCountInput(raw, kind); exact(result, ready(raw, value));
    assert.equal(BigInt(result.value!), BigInt(raw.trim()), 'the accepted count equals its original integer, not a rounded replacement');
  }
  const padded = `${'0'.repeat(4096)}1`;
  for (const kind of kinds) exact(parseSeedPurchaseCountInput(padded, kind), ready(padded, 1));
});

test('MAX_SAFE_INTEGER is admitted exactly while larger and huge integers never become a rounded valid count', () => {
  for (const kind of kinds) {
    const max = String(Number.MAX_SAFE_INTEGER);
    exact(parseSeedPurchaseCountInput(max, kind), ready(max, Number.MAX_SAFE_INTEGER));
    for (const raw of ['9007199254740992', '9007199254740993', '0009007199254740993', '18446744073709551615', '9'.repeat(4096)]) {
      exact(parseSeedPurchaseCountInput(raw, kind), invalid(raw, 'outside-safe-integer-range'));
    }
  }
});

const notWhole = ['+1', '-1', '+0', '-0', '1.0', '0.000', '.0', '1,0', '1,000', '1.000', '1e3', '1E0',
  '0x10', '1_000', '1 000', '1\t0', '1\n0', '1\u00a0000', 'Infinity', 'NaN', '１', '١٢', '१२', '⁰', '12\u200b'];
for (const raw of notWhole) test(`${JSON.stringify(raw)} cannot acquire a whole-count meaning through decimal, separator or Unicode normalization`, () => {
  for (const kind of kinds) exact(parseSeedPurchaseCountInput(raw, kind), invalid(raw));
});

const notStrings: readonly [string, unknown][] = [['number', 12], ['negative zero number', -0], ['fraction number', 1.5],
  ['NaN', NaN], ['infinity', Infinity], ['boolean', false], ['array', [1]], ['empty array', []], ['object', {}],
  ['null-prototype object', Object.create(null)], ['function', () => '1'], ['symbol', Symbol('seed-count')],
  ['bigint', BigInt(1)], ['boxed string', new String('12')], ['boxed number', new Number(12)]];
for (const [name, raw] of notStrings) test(`${name} is invalid without being stringified or converted`, () => {
  for (const kind of kinds) exact(parseSeedPurchaseCountInput(raw, kind), invalid(null));
});

test('unsupported count kinds have precedence over blanks, malformed values and out-of-range text', () => {
  const wrongKinds: unknown[] = [undefined, null, '', 'Allocation', 'PACK', ' allocation ', 'pack ', 'other', 0, false, {}, [],
    Symbol('kind'), BigInt(1), new String('allocation'), () => 'allocation'];
  for (const kind of wrongKinds) for (const raw of ['', '  ', '0', '9007199254740993', null, undefined, 0]) {
    exact(parseSeedPurchaseCountInput(raw, kind as SeedPurchaseCountKind), invalid(typeof raw === 'string' ? raw : null, 'unsupported-count-kind'));
  }
});

test('raw and kind objects, accessors, proxies and conversion hooks are not read or mutated', () => {
  const calls = { getter: 0, valueOf: 0, toString: 0, primitive: 0, proxy: 0 };
  const object = {
    valueOf() { calls.valueOf++; throw Error('No numeric coercion'); },
    toString() { calls.toString++; throw Error('No diagnostic coercion'); },
    [Symbol.toPrimitive]() { calls.primitive++; throw Error('No primitive coercion'); },
  };
  Object.defineProperty(object, 'trim', { enumerable: true, get() { calls.getter++; throw Error('No object trim read'); } });
  const descriptors = Object.getOwnPropertyDescriptors(object);
  const proxy = new Proxy({}, {
    get() { calls.proxy++; throw Error('No property read'); },
    getPrototypeOf() { calls.proxy++; throw Error('No prototype read'); },
    getOwnPropertyDescriptor() { calls.proxy++; throw Error('No descriptor read'); },
    ownKeys() { calls.proxy++; throw Error('No key read'); },
  });
  for (const raw of [object, proxy]) {
    for (const kind of kinds) exact(parseSeedPurchaseCountInput(raw, kind), invalid(null));
    exact(parseSeedPurchaseCountInput(raw, object as unknown as SeedPurchaseCountKind), invalid(null, 'unsupported-count-kind'));
  }
  const functionKind = () => { calls.primitive++; throw Error('No kind function evaluation'); };
  for (const kind of [object, proxy, functionKind]) {
    exact(parseSeedPurchaseCountInput(' 0012 ', kind as unknown as SeedPurchaseCountKind), invalid(' 0012 ', 'unsupported-count-kind'));
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(object), descriptors);
  assert.deepEqual(calls, { getter: 0, valueOf: 0, toString: 0, primitive: 0, proxy: 0 });
});

test('all statuses are immutable four-field results with no source, stock or plan permission attached', () => {
  for (const result of [parseSeedPurchaseCountInput('1', 'allocation'), parseSeedPurchaseCountInput('', 'allocation'), parseSeedPurchaseCountInput('0', 'pack')]) {
    assert.equal(Object.isFrozen(result), true); assert.deepEqual(Object.keys(result), keys);
    assert.throws(() => Object.assign(result, { sourceVerified: true }), TypeError);
    assert.equal(Object.hasOwn(result, 'sourceVerified'), false);
  }
});

test('digit-gated text delegates to the existing exact decimal authority and never overrides an authority rejection', async () => {
  const key = '__seedPurchaseInputsExactAuthorityTrace', previous = Object.getOwnPropertyDescriptor(globalThis, key);
  const trace = { calls: [] as string[], refuse: false };
  Object.defineProperty(globalThis, key, { configurable: true, value: trace });
  const adapter = new URL('../lib/seed-purchase-inputs.ts', import.meta.url).href + '?exact-authority-contract';
  const authority = new URL('../lib/length-units.ts', import.meta.url).href;
  // This wrapper calls the real existing parser. Its one deliberate refusal
  // proves the adapter respects that authority rather than re-parsing a value.
  const wrapper = `import {parseExactUnitDecimal as actual} from ${JSON.stringify(authority)};
    export function parseExactUnitDecimal(text){const trace=globalThis[${JSON.stringify(key)}];trace.calls.push(text);
      const result=actual(text);return trace.refuse?{status:'invalid',reason:'decimal-representation-loss'}:result;}`;
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === adapter && ['./length-units', './length-units.ts'].includes(specifier)) {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(wrapper) };
    }
    return next(specifier, context);
  } });
  try {
    const { parseSeedPurchaseCountInput: parse } = await import(adapter) as typeof import('../lib/seed-purchase-inputs.ts');
    exact(parse(' \t00012\n', 'allocation'), ready(' \t00012\n', 12));
    exact(parse('0', 'pack'), invalid('0', 'positive-pack-size-required'));
    assert.deepEqual(trace.calls, ['00012', '0']);
    for (const raw of ['1.0', '1,000', '']) parse(raw, 'allocation');
    parse(12, 'allocation'); parse('12', 'unsupported' as SeedPurchaseCountKind);
    assert.deepEqual(trace.calls, ['00012', '0'], 'malformed, blank and unsupported input cannot bypass the first gates');
    trace.refuse = true;
    exact(parse('7', 'allocation'), invalid('7', 'outside-safe-integer-range'));
    assert.deepEqual(trace.calls, ['00012', '0', '7']);
  } finally {
    hook.deregister();
    if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key);
  }
});
