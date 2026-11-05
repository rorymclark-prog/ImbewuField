import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInmetAlertReference } from '../lib/international/providers/inmet-alert-reference.ts';

const expected = {
  providerId: 'inmet-weather-alert-links', countryCode: 'BR',
  portalUrl: 'https://portal.inmet.gov.br/', alertsAppUrl: 'https://avisos.inmet.gov.br/',
  rssFeedUrl: 'https://apiprevmet3.inmet.gov.br/avisos/rss', reviewedOn: '2026-11-05',
  reviewBasis: 'official-primary-page-text-and-links', runtimeMode: 'external-links-only', referenceOnly: true,
  feedPayloadInspected: false, directFetchOutcome: 'connection-reset', feedSchema: 'UNKNOWN', feedTimestamps: 'UNKNOWN',
  geographicCoverage: 'UNKNOWN', updateCadence: 'UNKNOWN', authentication: 'UNKNOWN', reuseLicence: 'UNKNOWN',
  verifiedFreshness: 'not-assessed',
};

test('Brazil receives only the exact reviewed official links and bounded source facts', () => {
  const result = resolveInmetAlertReference('BR'); assert.equal(result.status, 'reference');
  if (result.status !== 'reference') throw Error('Brazil reference unavailable');
  assert.deepEqual(result, { status: 'reference', reference: expected });
  assert.equal(Object.keys(result.reference).length, 18);
  for (const field of ['portalUrl', 'alertsAppUrl', 'rssFeedUrl'] as const) {
    const parsed: URL = new URL(result.reference[field]);
    assert.equal(parsed.protocol, 'https:'); assert.equal(parsed.username, ''); assert.equal(parsed.password, '');
    assert.equal(parsed.search, ''); assert.equal(parsed.hash, '');
  }
});

test('country selection is exact and never trims, coerces or infers Brazil from another value', () => {
  const unavailable = { status: 'unavailable', reason: 'unsupported-country' };
  for (const value of [undefined, null, false, true, 0, 1, NaN, Infinity, BigInt(1), '', 'br', 'Br', ' BR', 'BR ', 'BR\n',
    'BRA', 'GB', 'US', 'KE', 'ZA', 'IN', ['BR'], { countryCode: 'BR' }, new String('BR'), Symbol('BR'), () => 'BR']) {
    const result = resolveInmetAlertReference(value);
    assert.deepEqual(result, unavailable); assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.hasOwn(result, 'reference'), false);
  }
  assert.equal(resolveInmetAlertReference('BR').status, 'reference', 'unsupported calls do not poison later exact selection');
});

test('hostile country objects, getters, coercion hooks and revoked proxies are not inspected', () => {
  let calls = 0;
  const forbidden = () => { calls++; throw Error('country value must not be inspected'); };
  const object = Object.defineProperties({}, {
    countryCode: { enumerable: true, get: forbidden }, toString: { get: forbidden },
    valueOf: { get: forbidden }, [Symbol.toPrimitive]: { get: forbidden },
  });
  const proxy = new Proxy({}, { get: forbidden, getPrototypeOf: forbidden, ownKeys: forbidden,
    getOwnPropertyDescriptor: forbidden, has: forbidden });
  const callable = new Proxy(() => 'BR', { get: forbidden, apply: forbidden });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const value of [object, proxy, callable, revoked.proxy]) {
    assert.deepEqual(resolveInmetAlertReference(value), { status: 'unavailable', reason: 'unsupported-country' });
  }
  assert.equal(calls, 0);
});

test('the flat reference and both result variants cannot be edited, extended or reused with substituted URLs', () => {
  const result = resolveInmetAlertReference('BR'); assert.equal(result.status, 'reference');
  if (result.status !== 'reference') throw Error('Brazil reference unavailable');
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.reference), true);
  assert.ok(Object.values(result.reference).every(value => value === null || typeof value !== 'object' && typeof value !== 'function'));
  assert.equal(Reflect.set(result.reference, 'portalUrl', 'https://example.invalid/'), false);
  assert.equal(Reflect.set(result.reference, 'countryCode', 'GB'), false);
  assert.equal(Reflect.defineProperty(result.reference, 'alertCount', { value: 0 }), false);
  assert.equal(Reflect.deleteProperty(result.reference, 'feedPayloadInspected'), false);
  assert.equal(Reflect.set(result, 'reference', {}), false); assert.equal(Reflect.set(result, 'status', 'available'), false);
  const unavailable = resolveInmetAlertReference('GB'); assert.equal(Object.isFrozen(unavailable), true);
  assert.equal(Reflect.set(unavailable, 'reason', 'no-alerts'), false);
  assert.deepEqual(resolveInmetAlertReference('BR'), { status: 'reference', reference: expected });
});

test('reviewed portal text remains distinct from uninspected feed payload and failed direct fetches', () => {
  const result = resolveInmetAlertReference('BR'); assert.equal(result.status, 'reference');
  if (result.status !== 'reference') throw Error('Brazil reference unavailable');
  const reference = result.reference;
  assert.equal(reference.reviewBasis, 'official-primary-page-text-and-links');
  assert.equal(reference.reviewedOn, '2026-11-05');
  assert.equal(reference.feedPayloadInspected, false); assert.equal(reference.directFetchOutcome, 'connection-reset');
  for (const field of ['feedSchema', 'feedTimestamps', 'geographicCoverage', 'updateCadence', 'authentication', 'reuseLicence'] as const)
    assert.equal(reference[field], 'UNKNOWN');
  assert.equal(reference.verifiedFreshness, 'not-assessed'); assert.equal(reference.runtimeMode, 'external-links-only');
  assert.equal(reference.referenceOnly, true);
  for (const fabricated of ['bodySha256', 'httpStatus', 'lastUpdated', 'fetchedAt', 'alertCount', 'noAlerts', 'providerDown',
    'readiness', 'coordinates', 'stationId', 'profile', 'warning']) assert.equal(Object.hasOwn(reference, fabricated), false, fabricated);
});

test('a fresh module evaluation and repeated resolution use no browser storage, fetch, credentials or clock', async () => {
  // These are runtime boundary traps, not a substitute implementation. A fresh
  // module URL also exercises initialization rather than only a cached export.
  const keys = ['fetch', 'window', 'localStorage', 'sessionStorage', 'navigator', 'XMLHttpRequest', 'WebSocket', 'Date'] as const;
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let calls = 0;
  const forbidden = () => { calls++; throw Error('link reference must not perform I/O or consult a clock'); };
  const clock = new Proxy(Date, { construct: forbidden, apply: forbidden, get: forbidden });
  const url = new URL('../lib/international/providers/inmet-alert-reference.ts?no-io-contract', import.meta.url);
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, key === 'Date'
      ? { configurable: true, value: clock } : { configurable: true, get: forbidden });
    const actual = await import(url.href) as typeof import('../lib/international/providers/inmet-alert-reference.ts');
    assert.equal(actual.resolveInmetAlertReference('BR').status, 'reference');
    assert.equal(actual.resolveInmetAlertReference('ZA').status, 'unavailable');
    assert.deepEqual(actual.resolveInmetAlertReference('BR'), { status: 'reference', reference: expected });
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
  assert.equal(calls, 0);
});
