import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindSiteContext, coordinateSiteIdForPlace, createSiteCountryContext, normaliseSiteCountryContext,
  resolveSiteCountryContext, sitePlanningSupport, type SiteCountryContext,
} from '@/lib/international/site-context';

const at = '2026-11-02T12:00:00.000Z';
const savedAt = '2026-11-01T12:00:00.000Z';
const siteId = 'site:0.00000,0.00000';
const context = (countryCode = 'ZA', patch: Partial<SiteCountryContext> = {}) => ({
  version: 1 as const, siteId, countryCode, jurisdictionReference: null, agriculturalRegionReference: null,
  provenance: 'grower-confirmed' as const, confirmedAt: at, ...patch,
});
// A stored confirmation names the exact saved place it describes (id, revision, creation stamp).
const base = (id: string) => ({ placeId: id, revision: 100, savedAt });
const place = (id: string, siteCountryContext?: unknown) => ({ id, lat: 0, lon: 0, savedAt, updatedAt: 100, siteCountryContext });
const confirmed = (id: string, value?: unknown) =>
  place(id, value === undefined ? undefined : { ...(value as object), base: base(id) });

test('legacy places remain country-unknown rather than inheriting a country from coordinates', () => {
  const result = resolveSiteCountryContext([place('legacy')], siteId);
  assert.equal(result.status, 'unknown');
  assert.equal(result.context, null);
  assert.deepEqual(result.placeIds, ['legacy']);
  assert.equal(sitePlanningSupport(result).allowAutoPlanning, false);
});

test('country confirmation is explicit and independent of language, formatting and geography', () => {
  assert.equal(createSiteCountryContext({ siteId, countryCode: 'ZA', confirmed: false }, at), null);
  const result = createSiteCountryContext({ siteId, countryCode: ' ke ', confirmed: true,
    jurisdictionReference: '  Grower jurisdiction  ', agriculturalRegionReference: ' Grower region ' }, at);
  assert.deepEqual(result, context('KE', { jurisdictionReference: 'Grower jurisdiction', agriculturalRegionReference: 'Grower region' }));
  const withInferredFields = normaliseSiteCountryContext({ ...context('BR'), language: 'en', latitude: 0,
    productionPlanSupported: true, localAgronomyApproved: true, reviewer: 'invented' });
  assert.deepEqual(withInferredFields, context('BR'));
});

test('foreign references and user-authored approval flags cannot enable the South African planner', () => {
  for (const code of ['KE', 'GB', 'US', 'BR', 'FR', 'AA']) {
    const result = resolveSiteCountryContext([confirmed('reference', { ...context(code), productionPlanSupported: true })], siteId);
    const support = sitePlanningSupport(result);
    assert.equal(result.status, 'confirmed', code);
    assert.equal(support.allowAutoPlanning, false, code);
    assert.equal(support.southAfricanFallbackAllowed, false, code);
    assert.equal(support.localAgronomyApproved, false, code);
  }
});

test('a confirmed South African site retains its existing planner without claiming an agronomy review', () => {
  const support = sitePlanningSupport(resolveSiteCountryContext([confirmed('confirmed', context())], siteId));
  assert.equal(support.allowAutoPlanning, true);
  assert.equal(support.status, 'existing-south-african-planner');
  assert.equal(support.localAgronomyApproved, false);
});

test('malformed optional context remains unknown and invalid confirmation cannot masquerade as approval', () => {
  for (const value of [null, [], true, {}, { ...context(), version: 2 }, { ...context(), provenance: 'inferred' },
    { ...context(), countryCode: 'South Africa' }, { ...context(), countryCode: 'za' },
    { ...context(), siteId: 'site:0,0' }, { ...context(), siteId: undefined },
    { ...context(), confirmedAt: '2026-02-30T00:00:00.000Z' }, { ...context(), confirmedAt: 'yesterday' },
    { ...context(), agriculturalRegionReference: 0 }, { ...context(), jurisdictionReference: 'x'.repeat(161) },
    { ...context(), jurisdictionReference: 'hidden\ntext' }]) {
    assert.equal(normaliseSiteCountryContext(value), null);
    const result = resolveSiteCountryContext([place('corrupt', value)], siteId);
    assert.equal(result.status, 'unknown');
    assert.equal(sitePlanningSupport(result).allowAutoPlanning, false);
  }
});

test('same-coordinate aliases must all agree, regardless of their array order or confirmation date', () => {
  for (const aliases of [[confirmed('a', context()), confirmed('b', context('KE'))],
    [confirmed('a', context()), confirmed('b')],
    [confirmed('a', context()), confirmed('b', context('ZA', { agriculturalRegionReference: 'different' }))]]) {
    for (const ordered of [aliases, aliases.toReversed()]) {
      const result = resolveSiteCountryContext(ordered, siteId);
      assert.equal(result.status, 'conflict');
      assert.equal(result.context, null);
      assert.equal(sitePlanningSupport(result).allowAutoPlanning, false);
    }
  }
  const same = resolveSiteCountryContext([confirmed('a', context()),
    confirmed('b', context('ZA', { confirmedAt: '2026-11-02T13:00:00.000Z' }))], siteId);
  assert.equal(same.status, 'confirmed');
  assert.equal(same.context?.confirmedAt, '2026-11-02T13:00:00.000Z');
});

test('country context is matched to the exact canonical site, never a nearby site or arbitrary query value', () => {
  for (const id of ['site:0,0', 'site:0.00001,0.00000', 'design:local', '__proto__', null]) {
    assert.equal(resolveSiteCountryContext([confirmed('one', context())], id).status, 'missing-site');
  }
  assert.equal(coordinateSiteIdForPlace({ lat: 0, lon: 0.000004 }), siteId);
  assert.equal(coordinateSiteIdForPlace({ lat: 91, lon: 0 }), null);
  assert.equal(coordinateSiteIdForPlace({ lat: 0, lon: Number.NaN }), null);
});

test('moving a confirmed pin cannot carry its old country approval into a different canonical site', () => {
  const old = confirmed('moving', context());
  const moved = { ...old, lat: 1 };
  const result = resolveSiteCountryContext([moved], 'site:1.00000,0.00000');
  assert.equal(result.status, 'unknown');
  assert.equal(result.context, null);
  assert.equal(sitePlanningSupport(result).allowAutoPlanning, false);
  assert.equal(sitePlanningSupport({ siteId: 'site:1.00000,0.00000', status: 'confirmed', context: context(), placeIds: ['moving'] }).allowAutoPlanning, false);
});

test('a context with no base binding, or a binding to another place identity, is never approval', () => {
  // The form's transient context carries no base; storing it unbound must not approve the planner.
  const unbound = resolveSiteCountryContext([place('p', context())], siteId);
  assert.equal(unbound.status, 'unknown');
  assert.equal(sitePlanningSupport(unbound).allowAutoPlanning, false);
  const wrongBases = [{ ...base('p'), placeId: 'other' }, { ...base('p'), revision: 300 },
    { ...base('p'), savedAt: '2026-11-02T09:00:00.000Z' }];
  for (const wrong of wrongBases) {
    const result = resolveSiteCountryContext([place('p', { ...context(), base: wrong })], siteId);
    assert.equal(result.status, 'unknown', JSON.stringify(wrong));
    assert.equal(sitePlanningSupport(result).allowAutoPlanning, false);
  }
  assert.equal(resolveSiteCountryContext([place('p', { ...context(), base: base('p') })], siteId).status, 'confirmed');
});

test('base binding is kept, damaged binding is not silently dropped, and binding needs a real place identity', () => {
  assert.deepEqual(normaliseSiteCountryContext({ ...context(), base: base('p') }), { ...context(), base: base('p') });
  for (const damaged of [null, 'p', [], {}, { ...base('p'), placeId: '' }, { ...base('p'), revision: -1 },
    { ...base('p'), revision: Number.NaN }, { ...base('p'), revision: '100' }, { ...base('p'), savedAt: 5 }]) {
    assert.equal(normaliseSiteCountryContext({ ...context(), base: damaged }), null, JSON.stringify(damaged));
  }
  assert.deepEqual(bindSiteContext(context(), { id: 'p', updatedAt: 100, savedAt })?.base, base('p'));
  assert.equal(bindSiteContext(context(), { id: 'p', updatedAt: 100 }), null);
  // Legacy rows: revision falls back to the creation stamp.
  assert.equal(bindSiteContext(context(), { id: 'p', savedAt })?.base?.revision, Date.parse(savedAt));
});
