import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
import { sourceEvidenceState, sourceEvidencePresentationLabel } from '@/lib/international/countries/readiness';
import { EVIDENCE_CATEGORIES, type CountryProfile, type CountrySource } from '@/lib/international/countries/types';

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
      // Source checks occur on different days. Require a real receipt date rather than the initial dossier date.
      assert.match(source.accessedOn ?? '', /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(`${source.accessedOn}T00:00:00Z`).toISOString().slice(0, 10), source.accessedOn);
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


test('Brazil exposes the checked catalogue link without treating soil documentation as site approval', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/international/pilots/brazil-redape-catalogue-receipt.json', import.meta.url), 'utf8'));
  const checkedOn = receipt.completedAt.slice(0, 10);
  const brazil = evaluateCountryReadiness({ countryCode: 'BR', agriculturalRegionId: 'Campinas', interfaceLanguage: 'pt-BR' }, checkedOn);
  const soils = brazil.evidence.find(entry => entry.category === 'soils')!;
  const source = soils.sources.find(entry => entry.id === 'br-embrapa-soils')!;
  assert.equal(source.url, receipt.requestedUrl);
  assert.equal(source.accessedOn, checkedOn);
  assert.equal(source.verification, 'content-read');
  assert.equal(source.publishedOn, null);
  assert.equal(sourceEvidenceState(source, checkedOn), 'undated');
  assert.equal(soils.availableCount, 0);
  assert.equal(source.units.status, 'unknown');
  assert.equal(source.updateCadence.status, 'unknown');
  assert.ok(source.licence.status === 'known' && /CC BY-NC 4\.0.*commercial reuse/.test(source.licence.value));
  assert.equal(brazil.region, null);
  assert.equal(brazil.localReviewComplete, false);
  assert.equal(brazil.productionPlanSupported, false);
  assert.equal(brazil.southAfricanFallbackAllowed, false);
  for (const countryCode of ['GB', 'KE', 'US', 'OTHER']) {
    const review = evaluateCountryReadiness({ countryCode }, checkedOn);
    assert.ok(review.evidence.every(entry => entry.sources.every(item => item.url !== receipt.requestedUrl)));
  }
});

test('the Campinas office directory remains Brazil background and cannot satisfy local extension review', () => {
  const date = '2026-11-03';
  const result = evaluateCountryReadiness({ countryCode: 'BR' }, date);
  const extension = result.evidence.find(entry => entry.category === 'agricultural-extension')!;
  const source = extension.sources.find(candidate => candidate.id === 'br-extension-cati-campinas')!;
  assert.equal(source.url, 'https://cati.sp.gov.br/portal/institucional/enderecos/cati-regional-de-campinas');
  assert.equal(source.publishedOn, null);
  assert.equal(source.licence.status, 'unknown');
  assert.equal(extension.availableCount, 0);
  assert.equal(result.productionPlanSupported, false);
  for (const countryCode of ['KE', 'GB', 'US']) {
    assert.ok(evaluateCountryReadiness({ countryCode }, date).evidence
      .every(entry => entry.sources.every(candidate => candidate.id !== source.id)));
  }

  const profile = reviewedFixture();
  profile.sources = profile.sources.filter(candidate => candidate.category !== 'agricultural-extension');
  const dated = { ...source, publishedOn: date };
  profile.sources.push(dated);
  profile.agronomyReview.sourceIds = profile.sources.map(candidate => candidate.id);
  const context = { countryCode: profile.code, agriculturalRegionId: 'test-region' };
  assert.equal(sourceEvidenceState(dated, date), 'background-reference');
  assert.equal(evaluateCountryReadiness(context, date, [profile]).localReviewComplete, false);
  // Positive control. The same otherwise complete fixture passes if the reference qualifies.
  delete dated.backgroundOnly;
  assert.equal(evaluateCountryReadiness(context, date, [profile]).localReviewComplete, true);
});

test('sourceEvidencePresentationLabel maps canonical states to exact human labels without altering readiness or masking background status', () => {
  const base = reviewedFixture().sources[0];

  // 1. Available reference => 'Dated source reference'
  const available: CountrySource = { ...base, publishedOn: AS_OF, accessedOn: AS_OF, reviewDueOn: null, verification: 'content-read' };
  delete available.backgroundOnly;
  assert.equal(sourceEvidenceState(available, AS_OF), 'available-reference');
  assert.equal(sourceEvidencePresentationLabel(available, AS_OF), 'Dated source reference');

  // 2. Background reference (dated) => 'Dated source reference'
  const backgroundDated: CountrySource = { ...available, backgroundOnly: true };
  assert.equal(sourceEvidenceState(backgroundDated, AS_OF), 'background-reference');
  assert.equal(sourceEvidencePresentationLabel(backgroundDated, AS_OF), 'Dated source reference');

  // 3. Missing verification => 'Source evidence missing'
  const missing: CountrySource = { ...available, verification: 'unavailable' };
  assert.equal(sourceEvidenceState(missing, AS_OF), 'missing');
  assert.equal(sourceEvidencePresentationLabel(missing, AS_OF), 'Source evidence missing');

  // 4. Stale/overdue review => 'Source review overdue'
  const stale: CountrySource = { ...available, reviewDueOn: '2026-10-31' };
  assert.equal(sourceEvidenceState(stale, AS_OF), 'stale');
  assert.equal(sourceEvidencePresentationLabel(stale, AS_OF), 'Source review overdue');

  // 5. Undated publication => 'Source date unverified'
  const undated: CountrySource = { ...available, publishedOn: null };
  assert.equal(sourceEvidenceState(undated, AS_OF), 'undated');
  assert.equal(sourceEvidencePresentationLabel(undated, AS_OF), 'Source date unverified');

  // Background qualifier must not mask missing, stale or undated states
  const backgroundMissing: CountrySource = { ...missing, backgroundOnly: true };
  assert.equal(sourceEvidenceState(backgroundMissing, AS_OF), 'missing');
  assert.equal(sourceEvidencePresentationLabel(backgroundMissing, AS_OF), 'Source evidence missing');

  const backgroundStale: CountrySource = { ...stale, backgroundOnly: true };
  assert.equal(sourceEvidenceState(backgroundStale, AS_OF), 'stale');
  assert.equal(sourceEvidencePresentationLabel(backgroundStale, AS_OF), 'Source review overdue');

  const backgroundUndated: CountrySource = { ...undated, backgroundOnly: true };
  assert.equal(sourceEvidenceState(backgroundUndated, AS_OF), 'undated');
  assert.equal(sourceEvidencePresentationLabel(backgroundUndated, AS_OF), 'Source date unverified');

  // Throws RangeError on invalid date
  assert.throws(() => sourceEvidencePresentationLabel(available, 'invalid-date'), RangeError);
});
