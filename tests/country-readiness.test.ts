import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCountryReadiness } from '@/lib/international/countries/readiness';

test('a pilot country and translated interface cannot masquerade as reviewed local farming support', () => {
  const result = evaluateCountryReadiness({ countryCode: 'KE', agriculturalRegionId: 'unknown', interfaceLanguage: 'sw' }, '2026-11-01');
  assert.equal(result.status, 'reference-only');
  assert.equal(result.localReviewComplete, false);
  assert.equal(result.productionPlanSupported, false);
  assert.equal(result.southAfricanFallbackAllowed, false);
  assert.ok(result.gaps.length > 0);
});

import { COUNTRY_PROFILES, COUNTRY_RESEARCH_QUEUE, EUROPE_RESEARCH_NOTE } from '@/lib/international/countries/registry';
import { sourceEvidenceState } from '@/lib/international/countries/readiness';
import { EVIDENCE_CATEGORIES, type CountryProfile } from '@/lib/international/countries/types';

const AS_OF = '2026-11-01';
function reviewedFixture(): CountryProfile {
  const profile = structuredClone(COUNTRY_PROFILES[0]);
  profile.regions = [{ id: 'test-region', name: 'Synthetic test review scope', definitionSourceId: profile.sources[0].id, status: 'reviewed' }];
  profile.sources = profile.sources.map((source) => ({ ...source, publishedOn: '2026-10-01', accessedOn: AS_OF,
    reviewDueOn: '2026-12-01', verification: 'content-read' }));
  profile.agronomyReview = { status: 'reviewed', regionId: 'test-region', reviewedOn: '2026-10-20', validThrough: '2026-12-01',
    reviewer: 'Synthetic reviewer for a test only', sourceIds: profile.sources.map((source) => source.id) };
  return profile;
}

test('unsupported countries and Europe cannot acquire a South African or nearby-country fallback', () => {
  for (const countryCode of ['ZZ', 'EU', 'ZA', '__proto__']) {
    const result = evaluateCountryReadiness({ countryCode, interfaceLanguage: 'en' }, AS_OF);
    assert.equal(result.status, 'unsupported-country'); assert.equal(result.country, null);
    assert.equal(result.productionPlanSupported, false); assert.equal(result.southAfricanFallbackAllowed, false);
  }
});

test('all engineering pilots preserve separate evidence roles and remain unreviewed', () => {
  assert.deepEqual(COUNTRY_PROFILES.map((profile) => profile.code), ['KE', 'GB', 'US', 'BR']);
  for (const profile of COUNTRY_PROFILES) {
    assert.equal(profile.stage, 'engineering-pilot'); assert.equal(profile.agronomyReview.status, 'not-reviewed');
    for (const category of EVIDENCE_CATEGORIES) assert.ok(profile.sources.some((source) => source.category === category));
    for (const source of profile.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.equal(source.accessedOn, source.id === 'ke-isric-sotwis' ? '2026-11-03' : AS_OF);
      assert.ok(source.verifiedClaim && source.limitations && source.missingDataBehavior);
      assert.ok(['known', 'unknown'].includes(source.licence.status));
    }
    assert.equal(evaluateCountryReadiness({ countryCode: profile.code }, AS_OF).productionPlanSupported, false);
  }
  assert.ok(COUNTRY_PROFILES.some((profile) => profile.sources.some((source) => source.verification === 'unavailable')));
});

test('a dated positive review control is recognized without enabling an unimplemented international crop engine', () => {
  const profile = reviewedFixture(); const original = JSON.stringify(profile);
  const result = evaluateCountryReadiness({ countryCode: 'ke', agriculturalRegionId: 'test-region', interfaceLanguage: 'pt' }, AS_OF, [profile]);
  assert.equal(result.localReviewComplete, true); assert.equal(result.status, 'reviewed-evidence-only');
  assert.equal(result.productionPlanSupported, false); assert.equal(result.southAfricanFallbackAllowed, false);
  assert.equal(result.interfaceLanguage, 'pt'); assert.equal(JSON.stringify(profile), original);
});

test('unknown regions, missing categories and expired or undated reviews fail the positive review control', () => {
  const changes: Array<(profile: CountryProfile) => void> = [
    (p) => { p.regions[0].status = 'reference-only'; },
    (p) => { p.regions[0].definitionSourceId = 'other-country-source'; },
    (p) => { p.sources = p.sources.filter((s) => s.category !== 'plant-legality'); },
    (p) => { p.sources[0].verification = 'snippet-only'; },
    (p) => { p.sources[0].publishedOn = null; },
    (p) => { p.sources[0].reviewDueOn = '2026-10-31'; },
    (p) => { p.agronomyReview.validThrough = '2026-10-31'; },
    (p) => { p.agronomyReview.reviewedOn = null; },
    (p) => { p.agronomyReview.reviewedOn = '2026-12-01'; },
    (p) => { p.agronomyReview.reviewedOn = '2026-02-30'; },
    (p) => { p.agronomyReview.sourceIds = ['not-this-country']; },
    (p) => { p.agronomyReview.reviewer = ' '; },
  ];
  for (const change of changes) {
    const profile = reviewedFixture(); change(profile);
    assert.equal(evaluateCountryReadiness({ countryCode: 'KE', agriculturalRegionId: 'test-region' }, AS_OF, [profile]).localReviewComplete, false);
  }
  assert.equal(evaluateCountryReadiness({ countryCode: 'KE', agriculturalRegionId: 'unknown' }, AS_OF, [reviewedFixture()]).localReviewComplete, false);
});

test('source presence, stale evidence and unknown publication dates retain different states', () => {
  const source = reviewedFixture().sources[0];
  assert.equal(sourceEvidenceState(source, AS_OF), 'available-reference');
  assert.equal(sourceEvidenceState({ ...source, verification: 'unavailable' }, AS_OF), 'missing');
  assert.equal(sourceEvidenceState({ ...source, publishedOn: null }, AS_OF), 'undated');
  assert.equal(sourceEvidenceState({ ...source, accessedOn: '2026-02-30' }, AS_OF), 'undated');
  assert.equal(sourceEvidenceState({ ...source, reviewDueOn: '2026-10-31' }, AS_OF), 'stale');
  assert.throws(() => sourceEvidenceState(source, 'not-a-date'), RangeError);
  assert.throws(() => evaluateCountryReadiness({ countryCode: 'KE' }, '2026-02-30'), RangeError);
});

test('the wider research queue is distinct from verified pilot dossiers and Europe is not one jurisdiction', () => {
  const names = COUNTRY_RESEARCH_QUEUE.flatMap((group) => [...group.countries]);
  for (const name of ['Uganda', 'Tanzania', 'Rwanda', 'Ethiopia', 'India', 'Nepal', 'Bangladesh', 'Indonesia', 'Colombia', 'Peru', 'Mexico', 'Canada', 'Australia', 'New Zealand']) {
    assert.ok(names.includes(name as typeof names[number]));
    assert.equal(COUNTRY_PROFILES.some((profile) => profile.name === name), false);
  }
  assert.match(EUROPE_RESEARCH_NOTE, /not a country/); assert.match(EUROPE_RESEARCH_NOTE, /national and subnational/);
});


test('page modification metadata never supplies a missing publication date', () => {
  const apHis = COUNTRY_PROFILES.find(profile => profile.code === 'US')!.sources.find(source => source.id === 'us-aphis')!;
  assert.equal(apHis.publishedOn, null);
  assert.equal(apHis.lastModifiedOn, '2026-10-02');
  assert.equal(sourceEvidenceState(apHis, AS_OF), 'undated');
  const source = reviewedFixture().sources[0];
  assert.equal(sourceEvidenceState({ ...source, publishedOn: null, lastModifiedOn: AS_OF }, AS_OF), 'undated');
  assert.equal(sourceEvidenceState({ ...source, lastModifiedOn: null }, AS_OF), 'available-reference');
});

test('Kenya’s historical soils catalogue appears in the dossier without satisfying local soil readiness', () => {
  const date = '2026-11-03';
  const context = { countryCode: 'KE', agriculturalRegionId: 'test-region' };
  const reference = evaluateCountryReadiness(context, date);
  const soils = reference.evidence.find(entry => entry.category === 'soils')!;
  const historical = soils.sources.find(source => source.id === 'ke-isric-sotwis')!;
  assert.equal(historical.publishedOn, '2004-02-01');
  assert.equal(sourceEvidenceState(historical, date), 'background-reference');
  assert.equal(soils.availableCount, 0);
  assert.ok(reference.gaps.includes('Current verified soils reference evidence is missing.'));

  const profile = reviewedFixture();
  profile.sources = profile.sources.filter(source => source.category !== 'soils').concat(historical);
  profile.agronomyReview.sourceIds = profile.sources.map(source => source.id);
  assert.equal(evaluateCountryReadiness(context, date, [profile]).localReviewComplete, false);

  // A complete set of other evidence still cannot use historical soil context as the region definition.
  profile.sources.push({ ...profile.sources[0], id: 'current-soils', category: 'soils' });
  profile.agronomyReview.sourceIds.push('current-soils');
  assert.equal(evaluateCountryReadiness(context, date, [profile]).localReviewComplete, true);
  profile.regions[0].definitionSourceId = historical.id;
  assert.equal(evaluateCountryReadiness(context, date, [profile]).localReviewComplete, false);
});
