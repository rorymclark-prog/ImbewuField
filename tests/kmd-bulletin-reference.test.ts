import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// This coordinator-authored contract comes from separately checked public source
// receipts. Expected metadata must not be reconstructed from the provider itself.
const contractBytes = readFileSync(new URL('../docs/international/KMD-KIAMBU-LINK-CONTRACT.json', import.meta.url));
assert.equal(createHash('sha256').update(contractBytes).digest('hex'),
  '11084aec92c7d15425085f6f7976b21a79546c9c63a092063c86b0a497245dfc');
const contract = JSON.parse(contractBytes.toString('utf8')) as { reference: Record<string, unknown> };

function guardRuntime() {
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
  const originalDate = Date;
  replace('Date', { value: new Proxy(originalDate, {
    apply() { activity.push('Date()'); throw Error('Unexpected clock read'); },
    construct() { activity.push('new Date'); throw Error('Unexpected clock read'); },
    get(_target, key) { activity.push(`Date.${String(key)}`); throw Error('Unexpected clock read'); },
  }), writable: true });
  return {
    activity,
    inspect() {
      for (const [key, descriptor] of installed) {
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), descriptor,
          `Provider must not replace the guarded ${key} global`);
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

// Install BEFORE the first actual provider import. A caught import-time fetch
// must still fail here, rather than disappear in a later beforeEach reset.
const importGuard = guardRuntime();
let provider: typeof import('../lib/international/providers/kmd-bulletin-reference.ts');
try {
  provider = await import('../lib/international/providers/kmd-bulletin-reference.ts');
  await Promise.resolve();
  importGuard.inspect();
  assert.deepEqual(importGuard.activity, [], 'Import must perform no network, storage, DOM or clock access');
} finally { importGuard.restore(); }

// Not executed: the coordinator's typecheck must also reject mutation through
// the public API, independently of runtime Object.freeze protection.
function readonlyTypeContract(result: ReturnType<typeof provider.resolveKmdBulletinReference>) {
  // @ts-expect-error Published result discrimination is readonly.
  result.status = result.status;
  if (result.status === 'reference') {
    // @ts-expect-error Reference metadata is readonly.
    result.reference.countyLabel = result.reference.countyLabel;
    // @ts-expect-error Nested calendar evidence is readonly.
    result.reference.advertisedCalendarWindow.startDate = result.reference.advertisedCalendarWindow.startDate;
    // @ts-expect-error Nested receipt evidence is readonly.
    result.reference.htmlReceipt.sha256 = result.reference.htmlReceipt.sha256;
  }
  // @ts-expect-error County choices are a readonly collection.
  provider.KMD_COUNTY_CHOICES[0] = provider.KMD_COUNTY_CHOICES[0];
  // @ts-expect-error County choice labels are readonly.
  provider.KMD_COUNTY_CHOICES[0].label = provider.KMD_COUNTY_CHOICES[0].label;
}
void readonlyTypeContract;

function reference() {
  const result = provider.resolveKmdBulletinReference('KE', 'kiambu');
  assert.equal(result.status, 'reference');
  if (result.status !== 'reference') throw Error('Explicit verified selection must resolve');
  return result;
}
function assertDeepFrozen(value: unknown) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    assert.ok('value' in descriptor, 'Published metadata must be data, not executable accessors');
    assertDeepFrozen(descriptor.value);
  }
}
function assertExactOwnData(actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected);
  if (expected === null || typeof expected !== 'object') return;
  assert.ok(actual !== null && typeof actual === 'object');
  assert.deepEqual(Reflect.ownKeys(actual).map(String).sort(), Reflect.ownKeys(expected).map(String).sort(),
    'Non-enumerable or symbol metadata must not expose extra source contents');
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  for (const key of Reflect.ownKeys(expected)) {
    const descriptor = descriptors[key as keyof typeof descriptors];
    assert.ok(descriptor && 'value' in descriptor);
    assertExactOwnData(descriptor.value, Reflect.get(expected, key));
  }
}

test('loading the curated links performs no automatic runtime work, including caught import-time accesses', () => {
  assert.deepEqual(importGuard.activity, []);
});

test('only the explicitly selected Kenyan county resolves, without borrowing another country or normalizing a lookalike', () => {
  for (const country of ['GB', 'US', 'BR', 'ZA', 'OTHER', '', 'ke', 'Ke', ' KE', 'KE ', 'ＫＥ', 'K\u0415', 'KE\0', 'KE\n']) {
    assert.deepEqual(provider.resolveKmdBulletinReference(country, 'kiambu'),
      { status: 'unavailable', reason: 'unsupported-country' });
  }
  for (const county of [undefined, null, '']) {
    assert.deepEqual(provider.resolveKmdBulletinReference('KE', county),
      { status: 'unavailable', reason: 'county-not-selected' });
  }
  for (const county of ['Kiambu', 'KIAMBU', ' kiambu', 'kiambu ', 'kiambu\n', 'kiambu\0', 'kіambu', 'kirinyaga',
    'Nairobi', 'https://meteo.go.ke/our-products/county-forecasts/', 'kiambu-county']) {
    assert.deepEqual(provider.resolveKmdBulletinReference('KE', county),
      { status: 'unavailable', reason: 'county-not-verified' });
  }
  assert.deepEqual(reference(), { status: 'reference', reference: contract.reference });
});

test('non-string inputs and hostile getters cannot execute coercion, inspect private fields or supply a default county', () => {
  let inspections = 0;
  const hostile = new Proxy({}, {
    get() { inspections++; throw Error('Input getter'); },
    getOwnPropertyDescriptor() { inspections++; throw Error('Input descriptor'); },
    ownKeys() { inspections++; throw Error('Input keys'); },
    getPrototypeOf() { inspections++; throw Error('Input prototype'); },
    has() { inspections++; throw Error('Input membership'); },
  });
  const coercible = {
    get countryCode() { inspections++; return 'KE'; },
    get countyId() { inspections++; return 'kiambu'; },
    [Symbol.toPrimitive]() { inspections++; return 'kiambu'; },
    toString() { inspections++; return 'KE'; },
    valueOf() { inspections++; return 'kiambu'; },
  };
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const values: unknown[] = [undefined, null, false, true, 0, 1, NaN, Infinity, BigInt(1), Symbol('KE'), [], ['kiambu'],
    {}, new String('kiambu'), () => 'kiambu', coercible, hostile, revoked.proxy];
  for (const value of values) {
    assert.deepEqual(provider.resolveKmdBulletinReference(value, hostile),
      { status: 'unavailable', reason: 'unsupported-country' });
    assert.deepEqual(provider.resolveKmdBulletinReference('KE', value),
      { status: 'unavailable', reason: value === null || value === undefined ? 'county-not-selected' : 'county-not-verified' });
  }
  assert.equal(inspections, 0);
});

test('the published reference exactly matches independently verified links, calendar labels and both retrieval receipts', () => {
  const result = reference();
  assertExactOwnData(result, { status: 'reference', reference: contract.reference });
  assert.deepEqual(result.reference.advertisedCalendarWindow, {
    startDate: '2026-11-03', endDate: '2026-11-09', basis: 'source-heading', timezone: 'UNKNOWN', boundarySemantics: 'not-established',
  });
  assert.equal(result.reference.htmlReceipt.sha256, '3762b097c120c7e31ad7146a95465c69a879d0c1f085af72cc3d8f95dad93f6a');
  assert.equal(result.reference.pdfReceipt.sha256, '6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9');
  for (const key of ['officialIndexUrl', 'officialSearchUrl', 'officialPageUrl', 'documentUrl', 'historicalPageUrl', 'historicalDocumentUrl'] as const) {
    const link = new URL(result.reference[key]);
    assert.equal(link.protocol, 'https:'); assert.equal(link.hostname, 'meteo.go.ke');
    assert.equal(link.username, ''); assert.equal(link.password, ''); assert.equal(link.port, ''); assert.equal(link.hash, '');
  }
});

test('calendar references never masquerade as current forecasts, crop approval or copied PDF contents', () => {
  const value = reference().reference;
  assert.equal(value.referenceOnly, true); assert.equal(value.runtimeMode, 'external-links-only');
  assert.equal(value.verifiedFreshness, 'not-assessed'); assert.equal(value.latestBulletin, 'not-established');
  assert.equal(value.reuseLicence, 'UNKNOWN'); assert.equal(value.apiContract, 'UNKNOWN'); assert.equal(value.publishedAt, 'UNKNOWN');
  // Complete key equality also refuses extra forecasts, coordinates, signatures,
  // contacts, raw documents or readiness flags, rather than policing one phrase.
  assert.deepEqual(Object.keys(value).sort(), Object.keys(contract.reference).sort());
});

test('choices, every evidence object and every unavailable result are deeply immutable', () => {
  assertExactOwnData(provider.KMD_COUNTY_CHOICES, [{ id: 'kiambu', label: 'Kiambu' }]);
  const results = [reference(), provider.resolveKmdBulletinReference('US', 'kiambu'),
    provider.resolveKmdBulletinReference('KE', ''), provider.resolveKmdBulletinReference('KE', 'other')];
  assertDeepFrozen(provider.KMD_COUNTY_CHOICES);
  for (const result of results) assertDeepFrozen(result);
});

test('caller mutation attempts cannot alter a later reference or silently choose a different county', () => {
  const before = JSON.stringify(reference());
  const result = reference();
  assert.equal(Reflect.set(result.reference, 'countyId', 'other'), false);
  assert.equal(Reflect.set(result.reference.advertisedCalendarWindow, 'startDate', '2099-01-01'), false);
  assert.equal(Reflect.set(result.reference.htmlReceipt, 'sha256', 'tampered'), false);
  assert.equal(Reflect.set(result.reference.pdfReceipt, 'bytes', 0), false);
  assert.equal(Reflect.deleteProperty(result.reference, 'referenceOnly'), false);
  assert.equal(Reflect.defineProperty(result, 'status', { value: 'available' }), false);
  assert.equal(Reflect.set(provider.KMD_COUNTY_CHOICES, '0', { id: 'other', label: 'Other' }), false);
  assert.equal(Reflect.set(provider.KMD_COUNTY_CHOICES[0], 'label', 'Other'), false);
  assert.equal(JSON.stringify(reference()), before);
  assert.deepEqual(provider.KMD_COUNTY_CHOICES, [{ id: 'kiambu', label: 'Kiambu' }]);
});

test('resolving references and refusals never reads a clock, network or browser storage', () => {
  const guarded = guardRuntime();
  try {
    for (let index = 0; index < 3; index++) {
      assert.deepEqual(reference(), { status: 'reference', reference: contract.reference });
      provider.resolveKmdBulletinReference('KE', '');
      provider.resolveKmdBulletinReference('KE', 'other');
      provider.resolveKmdBulletinReference('US', 'kiambu');
    }
    guarded.inspect();
    assert.deepEqual(guarded.activity, []);
  } finally { guarded.restore(); }
});

test('the runtime guard detects swallowed side effects instead of treating caught exceptions as purity', () => {
  const guarded = guardRuntime();
  try {
    for (const key of ['fetch', 'window', 'localStorage', 'sessionStorage', 'performance', 'Date']) {
      try {
        if (key === 'Date') Date.now();
        else Reflect.get(globalThis, key);
      } catch { /* Deliberately caught: import-time code must not hide an access this way. */ }
    }
    assert.deepEqual(guarded.activity, ['fetch', 'window', 'localStorage', 'sessionStorage', 'performance', 'Date.now']);
    assert.throws(() => assert.deepEqual(guarded.activity, []), assert.AssertionError);
  } finally { guarded.restore(); }
});
