import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The coordinator's source contract is independent of the decoder implementation.
// All response bodies below are synthetic source-shaped fixtures, not farm data.
const contractBytes = readFileSync(new URL('../docs/international/EA-RAINFALL-REFERENCE-CONTRACT.json', import.meta.url));
assert.equal(createHash('sha256').update(contractBytes).digest('hex'),
  '7fbbd63d878d4289cd99954f20c67c5415a577729134de36587ac0841f6c5757');
const contract = JSON.parse(contractBytes.toString('utf8')) as { provider: Record<string, string> };

function runtimeGuard() {
  const activity: string[] = [];
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const installed = new Map<string, PropertyDescriptor>();
  function replace(key: string, descriptor: PropertyDescriptor) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
    installed.set(key, Object.getOwnPropertyDescriptor(globalThis, key)!);
  }
  for (const key of ['fetch', 'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'performance']) {
    replace(key, { get() { activity.push(key); throw Error(`Unexpected runtime access: ${key}`); } });
  }
  replace('Date', { writable: true, value: new Proxy(Date, {
    apply() { activity.push('Date()'); throw Error('Clock read'); },
    construct() { activity.push('new Date'); throw Error('Clock read'); },
    get(_target, key) { activity.push(`Date.${String(key)}`); throw Error('Clock read'); },
  }) });
  return {
    activity,
    inspect() {
      for (const [key, descriptor] of installed) {
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), descriptor,
          `Decoder must not replace the guarded ${key} global`);
      }
    },
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

// A caught import-time access must fail BEFORE any later test can reset evidence.
const importGuard = runtimeGuard();
let model: typeof import('../lib/international/providers/ea-rainfall-reference.ts');
try {
  model = await import('../lib/international/providers/ea-rainfall-reference.ts');
  await Promise.resolve();
  importGuard.inspect();
  assert.deepEqual(importGuard.activity, [], 'Import must not use network, browser storage, DOM or a clock');
} finally { importGuard.restore(); }

// Never executed: root typechecking must retain the public readonly contract,
// separately from the static provider's runtime freeze.
function readonlyTypeContract(result: ReturnType<typeof model.decodeEaRainfallReference>) {
  // @ts-expect-error Provider metadata is readonly.
  model.EA_RAINFALL_REFERENCE_PROVIDER.endpoint = model.EA_RAINFALL_REFERENCE_PROVIDER.endpoint;
  // @ts-expect-error Provenance is readonly.
  result.provenance.fetchedAt = result.provenance.fetchedAt;
  // @ts-expect-error Sample limits are readonly.
  result.sample.completeCoverage = result.sample.completeCoverage;
  if (result.status === 'available' || result.status === 'partial') {
    // @ts-expect-error Decoded measurement projection is readonly.
    result.reading.rainfallMm = result.reading.rainfallMm;
  }
}
void readonlyTypeContract;

const receipt = 'synthetic retrieval receipt +00:00';
const reported = '2026-11-05T03:17:00+02:30';
type Source = { meta: Record<string, unknown>; items: unknown[]; [key: string]: unknown };
function source(): Source {
  return {
    '@context': 'https://environment.data.gov.uk/flood-monitoring/meta/context.jsonld',
    meta: { publisher: 'Environment Agency', limit: 1, hasFormat: ['synthetic format'] },
    items: [{
      '@id': 'https://arbitrary.invalid/synthetic-reading', dateTime: reported, value: 0,
      measure: {
        '@id': 'https://arbitrary.invalid/synthetic-measure', parameter: 'rainfall', unitName: 'mm', period: 900,
        valueType: 'total', station: 'synthetic-station', stationReference: 'synthetic-station-id',
      },
    }],
  };
}
const row = (value: Source) => value.items[0] as Record<string, unknown>;
const measure = (value: Source) => row(value).measure as Record<string, unknown>;
function common(fetchedAt: string | null = receipt) {
  return {
    provenance: { providerId: 'ea-rainfall-public-reference', endpoint: contract.provider.endpoint, fetchedAt, referenceOnly: true },
    sample: { scope: 'bounded-public-network-sample', itemLimit: 1, completeCoverage: false,
      currentness: 'not-assessed', quality: 'unknown', timeBoundary: 'unknown' },
  };
}
function reading(rainfallMm: number | null = 0, reportedAt: string | null = reported) {
  return { reportedAt, rainfallMm, periodSeconds: 900, units: 'mm', valueType: 'total' };
}
function exact(actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected);
  if (expected === null || typeof expected !== 'object') return;
  assert.ok(actual !== null && typeof actual === 'object');
  assert.deepEqual(Reflect.ownKeys(actual).map(String).sort(), Reflect.ownKeys(expected).map(String).sort(),
    'Even hidden metadata must not leak additional source fields');
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  for (const key of Reflect.ownKeys(expected)) {
    const descriptor = descriptors[key as keyof typeof descriptors];
    assert.ok(descriptor && 'value' in descriptor, 'Output must not contain executable accessors');
    exact(descriptor.value, Reflect.get(expected, key));
  }
}
function failure(payload: unknown, reason: 'invalid-provenance' | 'malformed-response' | 'unsupported-measurement', fetchedAt?: unknown) {
  const supplied = arguments.length < 3 ? receipt : fetchedAt;
  const result = model.decodeEaRainfallReference(payload, supplied);
  exact(result, { status: 'failed', reason, ...common(reason === 'invalid-provenance' ? null : supplied as string) });
  return result;
}

test('the static public provider matches the independently frozen source contract and is immutable', () => {
  exact(model.EA_RAINFALL_REFERENCE_PROVIDER, contract.provider);
  assert.equal(Object.isFrozen(model.EA_RAINFALL_REFERENCE_PROVIDER), true);
  const before = JSON.stringify(model.EA_RAINFALL_REFERENCE_PROVIDER);
  assert.equal(Reflect.set(model.EA_RAINFALL_REFERENCE_PROVIDER, 'endpoint', 'https://arbitrary.invalid/'), false);
  assert.equal(Reflect.deleteProperty(model.EA_RAINFALL_REFERENCE_PROVIDER, 'coverage'), false);
  assert.equal(JSON.stringify(model.EA_RAINFALL_REFERENCE_PROVIDER), before);
  assert.deepEqual(importGuard.activity, []);
});

test('a genuine source zero is a reading, while omitted value remains unknown rather than invented zero', () => {
  const original = source();
  exact(model.decodeEaRainfallReference(original, receipt), { status: 'available', ...common(), reading: reading() });
  const missing = source(); delete row(missing).value;
  exact(model.decodeEaRainfallReference(missing, receipt), { status: 'partial', ...common(), reading: reading(null) });
  const fractional = source(); row(fractional).value = 0.125;
  exact(model.decodeEaRainfallReference(fractional, receipt), { status: 'available', ...common(), reading: reading(0.125) });
});

test('an empty bounded response is unavailable and never becomes zero, a cached reading or a malformed-row salvage', () => {
  model.decodeEaRainfallReference(source(), receipt);
  const empty = source(); empty.items = [];
  exact(model.decodeEaRainfallReference(empty, receipt), { status: 'unavailable', reason: 'no-reading', ...common() });
  for (const badItems of [null, {}, '', 0, [null], [[]], [0], ['reading'], [false]]) {
    const payload = source(); payload.items = badItems as unknown[];
    failure(payload, 'malformed-response');
  }
  const multiple = source(); multiple.items.push({ ...row(multiple), value: 4 });
  failure(multiple, 'malformed-response');
  const malformedSibling = source(); malformedSibling.items.push(null);
  failure(malformedSibling, 'malformed-response');
});

test('a missing or wrong root, metadata object, exact software limit or items array is held without truncation', () => {
  for (const payload of [undefined, null, false, 1, 'response', [], {}, { items: [] }, { meta: { limit: 1 } }]) {
    failure(payload, 'malformed-response');
  }
  for (const meta of [null, [], '', 1, {}, { limit: '1' }, { limit: 0 }, { limit: 2 }, { limit: null }, { limit: true }]) {
    const payload = source(); payload.meta = meta as Record<string, unknown>;
    failure(payload, 'malformed-response');
  }
});

test('each required measurement field must match the checked rainfall unit and accumulation contract exactly', () => {
  const variants: Record<string, unknown[]> = {
    parameter: [null, '', 'Rainfall', 'rainfall ', 'level', 0, false, []],
    unitName: [null, '', 'MM', 'm', 'mm ', 0, false, {}],
    period: [null, 0, 15, 899, 901, '900', false, []],
    valueType: [null, '', 'Total', 'instantaneous', 'total ', 0, false, {}],
  };
  for (const [field, values] of Object.entries(variants)) {
    const absent = source(); delete measure(absent)[field];
    failure(absent, 'unsupported-measurement');
    for (const value of values) {
      const payload = source(); measure(payload)[field] = value;
      failure(payload, 'unsupported-measurement');
    }
  }
  for (const value of [null, [], '', 0, false]) {
    const payload = source(); row(payload).measure = value;
    failure(payload, 'unsupported-measurement');
  }
  const absent = source(); delete row(absent).measure;
  failure(absent, 'unsupported-measurement');
});

test('present null, wrong types, negative or nonfinite rainfall are malformed rather than missing observations', () => {
  for (const value of [null, undefined, '', '0', '0.125', true, false, -0.125, -1, NaN, Infinity, -Infinity, {}, []]) {
    const payload = source(); row(payload).value = value;
    failure(payload, 'malformed-response');
  }
});

test('reported text and retrieval text remain opaque independent evidence, with no timestamp parsing or conversion', () => {
  const payload = source();
  exact(model.decodeEaRainfallReference(payload, receipt), { status: 'available', ...common(), reading: reading() });
  for (const text of ['not-a-calendar', '2026-99-71T99:88:00+88:88', 'source text\nwith an internal line', 'x'.repeat(100)]) {
    const item = source(); row(item).dateTime = text;
    exact(model.decodeEaRainfallReference(item, receipt), { status: 'available', ...common(), reading: reading(0, text) });
    exact(model.decodeEaRainfallReference(source(), text), { status: 'available', ...common(text), reading: reading() });
  }
  const withoutTime = source(); delete row(withoutTime).dateTime;
  exact(model.decodeEaRainfallReference(withoutTime, receipt), { status: 'partial', ...common(), reading: reading(0, null) });
  delete row(withoutTime).value;
  exact(model.decodeEaRainfallReference(withoutTime, receipt), { status: 'partial', ...common(), reading: reading(null, null) });
});

test('present invalid reported text is malformed, while invalid receipt text has its own null provenance refusal', () => {
  const invalid: unknown[] = [null, undefined, '', ' ', '\n', ' source', 'source ', 'x'.repeat(101), 0, true, [], {}, Symbol('time')];
  for (const value of invalid) {
    const payload = source(); row(payload).dateTime = value;
    failure(payload, 'malformed-response');
    failure(source(), 'invalid-provenance', value);
  }
});

test('descriptor detachment refuses root, nested, ignored-extra and array-index getters without executing any', () => {
  let calls = 0;
  const getter = { enumerable: true, configurable: true, get() { calls++; throw Error('Caller getter'); } };
  const fixtures: unknown[] = [];
  for (const field of ['meta', 'items']) {
    const payload = source(); Object.defineProperty(payload, field, getter); fixtures.push(payload);
  }
  for (const field of ['value', 'dateTime', 'measure', 'ignoredPrivateMetadata']) {
    const payload = source(); Object.defineProperty(row(payload), field, getter); fixtures.push(payload);
  }
  const nested = source(); Object.defineProperty(measure(nested), 'parameter', getter); fixtures.push(nested);
  const index = source(); Object.defineProperty(index.items, '0', getter); fixtures.push(index);
  for (const payload of fixtures) failure(payload, 'malformed-response');
  assert.equal(calls, 0);
  const receiptObject = { get toString() { calls++; throw Error('Receipt coercion'); } };
  failure(source(), 'invalid-provenance', receiptObject);
  assert.equal(calls, 0);
});

test('unsafe structures and reflection failures are held without invoking serialization hooks or mutating the caller', () => {
  let hooks = 0;
  const cyclic = source(); cyclic.loop = cyclic;
  const callback = source(); callback.ignored = () => { hooks++; return {}; };
  const hook = source(); hook.toJSON = () => { hooks++; return {}; };
  const throwing = new Proxy({}, { ownKeys() { throw Error('Reflection refused'); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const sparse = source(); sparse.items = new Array(1);
  for (const payload of [cyclic, callback, hook, throwing, revoked.proxy, sparse]) failure(payload, 'malformed-response');
  assert.equal(hooks, 0);
  const intact = source(); const before = JSON.stringify(intact);
  model.decodeEaRainfallReference(intact, receipt);
  assert.equal(JSON.stringify(intact), before);
});

test('the safe projection excludes arbitrary URLs, station, location, quality claims and supplied fake provenance', () => {
  const payload = source();
  payload.provenance = { endpoint: 'https://arbitrary.invalid/private', fetchedAt: 'fake', referenceOnly: false };
  payload.sample = { completeCoverage: true, currentness: 'current', quality: 'approved' };
  row(payload).station = { label: 'synthetic private station', location: 'synthetic private location' };
  row(payload).location = { latitude: 12, longitude: 34 };
  row(payload).url = 'https://arbitrary.invalid/private';
  measure(payload).quality = 'invented quality';
  exact(model.decodeEaRainfallReference(payload, receipt), { status: 'available', ...common(), reading: reading() });
});

test('no output object aliases caller input, a later result or shared static provider metadata', () => {
  const payload = source(); const before = JSON.stringify(payload);
  const first = model.decodeEaRainfallReference(payload, receipt);
  const second = model.decodeEaRainfallReference(payload, receipt);
  assert.notEqual(first, second); assert.notEqual(first.provenance, second.provenance); assert.notEqual(first.sample, second.sample);
  if (first.status !== 'available' || second.status !== 'available') throw Error('Fixture must decode');
  assert.notEqual(first.reading, second.reading); assert.notEqual(first.reading, row(payload));
  Reflect.set(first.reading, 'rainfallMm', 99);
  Reflect.set(first.provenance, 'endpoint', 'https://arbitrary.invalid/');
  Reflect.set(first.sample, 'completeCoverage', true);
  exact(second, { status: 'available', ...common(), reading: reading() });
  exact(model.decodeEaRainfallReference(payload, receipt), { status: 'available', ...common(), reading: reading() });
  exact(model.EA_RAINFALL_REFERENCE_PROVIDER, contract.provider);
  assert.equal(JSON.stringify(payload), before);
  row(payload).value = 7; row(payload).dateTime = 'changed source';
  measure(payload).parameter = 'changed parameter';
  exact(second, { status: 'available', ...common(), reading: reading() });
});

test('every result branch works under network, storage and clock denial with no automatic runtime access', () => {
  const guarded = runtimeGuard();
  try {
    exact(model.decodeEaRainfallReference(source(), receipt), { status: 'available', ...common(), reading: reading() });
    const partial = source(); delete row(partial).value;
    exact(model.decodeEaRainfallReference(partial, receipt), { status: 'partial', ...common(), reading: reading(null) });
    const empty = source(); empty.items = [];
    exact(model.decodeEaRainfallReference(empty, receipt), { status: 'unavailable', reason: 'no-reading', ...common() });
    failure({}, 'malformed-response');
    failure(source(), 'invalid-provenance', '');
    const unsupported = source(); measure(unsupported).unitName = 'm'; failure(unsupported, 'unsupported-measurement');
    guarded.inspect(); assert.deepEqual(guarded.activity, []);
  } finally { guarded.restore(); }
});

test('the runtime guard fails even when forbidden accesses are caught internally', () => {
  const guarded = runtimeGuard();
  try {
    for (const key of ['fetch', 'window', 'localStorage', 'sessionStorage', 'performance', 'Date']) {
      try { if (key === 'Date') Date.now(); else Reflect.get(globalThis, key); } catch { /* Deliberate swallowed access. */ }
    }
    assert.deepEqual(guarded.activity, ['fetch', 'window', 'localStorage', 'sessionStorage', 'performance', 'Date.now']);
    assert.throws(() => assert.deepEqual(guarded.activity, []), assert.AssertionError);
  } finally { guarded.restore(); }
});
