import assert from 'node:assert/strict';
import test from 'node:test';
import { readCountryEvidenceSelection, savedCountryEvidenceHref } from '../lib/international/countries/navigation.ts';
import { COUNTRY_PROFILES, countryProfile } from '../lib/international/countries/registry.ts';
import { evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';
import { bindSiteContext, createSiteCountryContext, normaliseSiteCountryContext, resolveSiteCountryContext, sitePlanningSupport,
  type SiteContextPlace, type SiteContextResolution } from '../lib/international/site-context.ts';

const siteId = 'site:0.00000,0.00000', stamp = '2026-11-06T12:00:00.000Z';
function place(countryCode = 'GB', id = 'private-country-place'): SiteContextPlace {
  const row: SiteContextPlace = { id, lat: 0, lon: 0, savedAt: stamp, updatedAt: 42 };
  const context = createSiteCountryContext({ siteId, countryCode, confirmed: true,
    jurisdictionReference: 'Private jurisdiction', agriculturalRegionReference: 'Private entered region' }, stamp);
  assert.ok(context); row.siteCountryContext = bindSiteContext(context, row); return row;
}
function resolved(countryCode = 'GB') {
  const result = resolveSiteCountryContext([place(countryCode)], siteId);
  assert.equal(result.status, 'confirmed'); assert.ok(result.context); return result;
}
function exact(value: ReturnType<typeof readCountryEvidenceSelection>, expected: {
  kind: 'default' | 'pilot' | 'unsupported' | 'invalid'; code: string; requestedCountryCode: string | null;
}) {
  assert.deepEqual(value, expected); assert.deepEqual(Object.keys(value).sort(), ['code', 'kind', 'requestedCountryCode']);
  assert.equal(Object.isFrozen(value), true);
}

test('only an absent country hint preserves bare-page Kenya; all four exact dossier codes use the existing registry', () => {
  exact(readCountryEvidenceSelection(undefined), { kind: 'default', code: 'KE', requestedCountryCode: null });
  assert.deepEqual(COUNTRY_PROFILES.map(profile => profile.code), ['KE', 'GB', 'US', 'BR']);
  for (const code of ['KE', 'GB', 'US', 'BR']) {
    assert.equal(countryProfile(code)?.code, code);
    exact(readCountryEvidenceSelection(code), { kind: 'pilot', code, requestedCountryCode: code });
  }
});

test('South Africa, unreviewed countries and UK remain explicit unsupported hints, never neighbouring-country or alias fallbacks', () => {
  for (const code of ['ZA', 'ZZ', 'UK', 'ID', 'IN', 'BD']) {
    assert.equal(countryProfile(code), undefined);
    exact(readCountryEvidenceSelection(code), { kind: 'unsupported', code: 'OTHER', requestedCountryCode: code });
    const readiness = evaluateCountryReadiness({ countryCode: code }, '2026-11-06');
    assert.equal(readiness.status, 'unsupported-country'); assert.equal(readiness.country, null);
    assert.equal(readiness.productionPlanSupported, false); assert.equal(readiness.southAfricanFallbackAllowed, false);
  }
});

test('null, lowercase, whitespace, repeated queries and nonprimitive hints cannot be coerced into a pilot selection', () => {
  const values: unknown[] = [null, '', 'gb', 'ke', ' GB', 'GB ', 'GB\n', 'G', 'GBR', 'OTHER', '12', 'G1', 'ＧＢ',
    'GB?site=private', ['GB'], ['GB', 'US'], [], 0, 1, false, true, NaN, Infinity, BigInt(1), Symbol('GB'), {}, new String('GB'), () => 'GB'];
  for (const value of values) exact(readCountryEvidenceSelection(value), { kind: 'invalid', code: 'OTHER', requestedCountryCode: null });
  let reads = 0;
  const unsafe = { get country() { reads++; throw Error('Do not read private query objects'); },
    toString() { reads++; return 'GB'; }, valueOf() { reads++; return 'GB'; }, [Symbol.toPrimitive]() { reads++; return 'GB'; } };
  const proxy = new Proxy(unsafe, { get() { reads++; throw Error('No proxy reads'); }, ownKeys() { reads++; throw Error('No proxy enumeration'); },
    getOwnPropertyDescriptor() { reads++; throw Error('No descriptor reads'); }, getPrototypeOf() { reads++; throw Error('No prototype reads'); } });
  const callable = new Proxy(() => 'GB', { get() { reads++; throw Error('No callable proxy reads'); }, apply() { reads++; return 'GB'; } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const value of [unsafe, proxy, callable, revoked.proxy]) exact(readCountryEvidenceSelection(value), { kind: 'invalid', code: 'OTHER', requestedCountryCode: null });
  assert.equal(reads, 0);
});

test('navigation hints never approve an agricultural region or enable production advice for any pilot', () => {
  for (const code of ['KE', 'GB', 'US', 'BR']) {
    const selection = readCountryEvidenceSelection(code), readiness = evaluateCountryReadiness({ countryCode: selection.code,
      agriculturalRegionId: 'Private entered region', interfaceLanguage: 'en' }, '2026-11-06');
    assert.equal(readiness.country?.code, code); assert.equal(readiness.region, null); assert.equal(readiness.localReviewComplete, false);
    assert.equal(readiness.productionPlanSupported, false); assert.equal(readiness.southAfricanFallbackAllowed, false);
    assert.ok(readiness.gaps.length > 0);
  }
});

test('a genuinely resolved saved context creates only a country hint, not public site, place, region or coordinate metadata', () => {
  for (const code of ['KE', 'GB', 'US', 'BR', 'ZA', 'ZZ', 'UK']) {
    const resolution = resolved(code), before = JSON.stringify(resolution), href = savedCountryEvidenceHref(resolution);
    assert.equal(href, `/international?country=${code}`);
    const url = new URL(href!, 'https://example.test');
    assert.equal(url.pathname, '/international'); assert.deepEqual([...url.searchParams.entries()], [['country', code]]); assert.equal(url.hash, '');
    assert.doesNotMatch(href!, /private|Private|site|region|jurisdiction|0\.00000|place|actor|confirmedAt/);
    assert.equal(JSON.stringify(resolution), before); assert.equal(Object.isFrozen(resolution), false);
    assert.ok(normaliseSiteCountryContext(resolution.context));
    if (code !== 'ZA') assert.equal(sitePlanningSupport(resolution).allowAutoPlanning, false);
  }
});

test('unknown, conflicted, missing and mismatched saved identities produce no country link even when a plausible context is present', () => {
  const confirmed = resolved();
  const unknownPlace = { ...place(), siteCountryContext: undefined };
  const actual = [resolveSiteCountryContext([unknownPlace], siteId), resolveSiteCountryContext([], siteId),
    resolveSiteCountryContext([place('GB', 'private-a'), place('US', 'private-b')], siteId)];
  assert.deepEqual(actual.map(value => value.status), ['unknown', 'missing-site', 'conflict']);
  for (const resolution of actual) assert.equal(savedCountryEvidenceHref(resolution), null);
  const damaged: SiteContextResolution[] = [
    ...(['unknown', 'conflict', 'missing-site'] as const).map(status => ({ ...confirmed, status })),
    { ...confirmed, siteId: null }, { ...confirmed, context: null },
    { ...confirmed, context: { ...confirmed.context!, siteId: 'site:1.00000,1.00000' } },
  ];
  for (const resolution of damaged) assert.equal(savedCountryEvidenceHref(resolution), null);
  for (const code of ['', 'gb', 'GB ', 'UK\n', 'GBR', '__proto__']) {
    assert.equal(savedCountryEvidenceHref({ ...confirmed, context: { ...confirmed.context!, countryCode: code } }), null);
  }
  let coercions = 0;
  const notACode = { toString() { coercions++; return 'GB'; }, [Symbol.toPrimitive]() { coercions++; return 'GB'; } };
  assert.equal(savedCountryEvidenceHref({ ...confirmed, context: { ...confirmed.context!, countryCode: notACode as unknown as string } }), null);
  assert.equal(coercions, 0);
});
