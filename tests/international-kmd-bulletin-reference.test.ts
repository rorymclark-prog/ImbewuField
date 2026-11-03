import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { KMD_BULLETIN_COUNTIES, resolveKmdBulletinReference } from '../lib/international/providers/kmd-bulletin-reference.ts';

const receipt = JSON.parse(readFileSync(new URL('../docs/international/pilots/kenya-kiambu-dated-bulletin-receipts.json', import.meta.url), 'utf8'));
function selected() {
  const result = resolveKmdBulletinReference('KE', 'kiambu');
  assert.equal(result.status, 'available'); return result.reference;
}

test('an explicit supported country and county select only the curated Kiambu reference', () => {
  const result = selected();
  assert.equal(result.countryCode, 'KE'); assert.equal(result.countyId, 'kiambu'); assert.equal(result.countyLabel, 'Kiambu');
  assert.deepEqual(KMD_BULLETIN_COUNTIES, [{ id: 'kiambu', label: 'Kiambu' }]);
  assert.deepEqual(resolveKmdBulletinReference('KE', ''), { status: 'unavailable', reason: 'county-not-selected' });
});

test('county names, unverified counties and missing selection never borrow the Kiambu bulletin', () => {
  for (const county of ['kirinyaga', 'nairobi', 'Kiambu', 'KIAMBU', ' kiambu', 'kiambu ', ' ', '__proto__', 'constructor']) {
    assert.deepEqual(resolveKmdBulletinReference('KE', county), { status: 'unavailable', reason: 'county-not-verified' }, county);
  }
  assert.deepEqual(resolveKmdBulletinReference('KE', undefined as unknown as string), { status: 'unavailable', reason: 'county-not-verified' });
});

test('country aliases or another country cannot receive Kenya county options through the resolver', () => {
  for (const country of ['ZA', 'GB', 'US', 'BR', 'KE ', 'ke', 'Kenya', '', '__proto__']) {
    for (const county of ['kiambu', '']) assert.deepEqual(resolveKmdBulletinReference(country, county), { status: 'unavailable', reason: 'unsupported-country' }, country);
  }
});

test('official page and PDF identities bind the actual independent coordinator receipts rather than a generic or neighbouring county page', () => {
  const result = selected(), html = receipt.receipts.find((row: { kind: string }) => row.kind === 'html'), pdf = receipt.receipts.find((row: { kind: string }) => row.kind === 'pdf');
  assert.ok(html && pdf); assert.equal(html.httpStatus, 200); assert.equal(pdf.httpStatus, 200); assert.equal(html.curlExit, 0); assert.equal(pdf.curlExit, 0);
  assert.equal(html.bytes, 89606); assert.equal(html.sha256, '6edf203352719ab3cee09974e29c15a0a1ad16623e4e557619fe6582f3d40acf');
  assert.equal(pdf.bytes, 738997); assert.equal(pdf.sha256, '6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9');
  assert.equal(result.officialPageUrl, html.requestedUrl); assert.equal(result.officialPageUrl, html.effectiveUrl);
  assert.equal(result.documentUrl, pdf.requestedUrl); assert.equal(result.documentUrl, pdf.effectiveUrl);
  assert.equal(result.indexUrl, 'https://meteo.go.ke/our-products/county-forecasts/');
  for (const link of [result.officialPageUrl, result.documentUrl, result.indexUrl]) {
    const parsed = new URL(link); assert.equal(parsed.protocol, 'https:'); assert.equal(parsed.hostname, 'meteo.go.ke');
    assert.equal(parsed.search, ''); assert.equal(parsed.hash, '');
  }
  assert.equal(result.authority, 'Kenya Meteorological Department');
});

test('advertised dates and PDF retrieval time retain their actual receipt provenance without becoming validity instants or freshness claims', () => {
  const result = selected(), pdf = receipt.receipts.find((row: { kind: string }) => row.kind === 'pdf');
  assert.deepEqual(result.advertisedWindow, receipt.review.advertisedCalendarDates);
  assert.deepEqual(result.advertisedWindow, { start: '2026-11-03', end: '2026-11-09' });
  assert.equal(result.checkedAtUtc, pdf.fetchedAtUtc);
  assert.equal(result.timezone, receipt.review.timeZone); assert.equal(result.timezone, 'UNKNOWN');
  assert.equal(result.verifiedFreshness, receipt.review.verifiedFreshness); assert.equal(result.verifiedFreshness, 'not-assessed');
  assert.equal(result.licence, receipt.review.licence); assert.equal(result.licence, 'UNKNOWN');
  assert.equal(result.referenceOnly, true); assert.equal(result.productionPlanSupported, false);
  assert.equal(receipt.review.productionPlanSupported, false); assert.equal(receipt.review.cropPlanningApproval, false);
  for (const absent of ['validFromUtc', 'validUntilUtc', 'isCurrent', 'isExpired', 'forecast', 'measurements', 'cropPlanningApproval', 'apiEndpoint', 'coordinates']) assert.equal(Object.hasOwn(result, absent), false, absent);
});

test('resolution is immutable and cannot escalate approval or mutate another caller’s advertised dates', () => {
  const reference = selected(), result = resolveKmdBulletinReference('KE', 'kiambu'), unavailable = resolveKmdBulletinReference('KE', '');
  assert.ok(Object.isFrozen(reference)); assert.ok(Object.isFrozen(reference.advertisedWindow)); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(unavailable));
  assert.ok(Object.isFrozen(KMD_BULLETIN_COUNTIES)); assert.ok(Object.isFrozen(KMD_BULLETIN_COUNTIES[0]));
  assert.throws(() => { (reference as unknown as { productionPlanSupported: boolean }).productionPlanSupported = true; }, TypeError);
  assert.throws(() => { (reference.advertisedWindow as unknown as { start: string }).start = '2027-01-01'; }, TypeError);
  assert.equal(selected().productionPlanSupported, false); assert.equal(selected().advertisedWindow.start, '2026-11-03');
});

test('selection has no fetch, persistence, event or current-clock dependency', () => {
  const keys = ['fetch', 'localStorage', 'sessionStorage', 'window', 'Date'] as const;
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let attempts = 0;
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, get() { ++attempts; throw Error('Static reference attempted IO'); } });
  try {
    for (const args of [['KE', 'kiambu'], ['KE', ''], ['KE', 'kirinyaga'], ['ZA', 'kiambu']] as const) resolveKmdBulletinReference(args[0], args[1]);
    assert.equal(attempts, 0);
  } finally {
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
