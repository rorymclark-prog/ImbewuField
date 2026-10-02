import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poultryGuidance } from '@/lib/animal-enterprises';
import type { PoultryManagement, SiteProductionConditions } from '@/lib/site-survey';

const caredFor: PoultryManagement = { purpose: 'eggs', drinkingWater: 'always', feeding: 'balanced-feed', nightProtection: 'enclosed' };

test('a coop and an enterprise choice do not supply unanswered poultry survey facts', () => {
  const guide = poultryGuidance(undefined, undefined, 'chicken-layer');
  assert.equal(guide.purpose, 'unknown');
  assert.equal(guide.recordedBreed, null);
  assert.equal(guide.recordedLayingHens, null);
  assert.equal(guide.status, 'needs-confirmation');
  assert.match(guide.missing.join(' '), /eggs, meat or both/);
  assert.match(guide.missing.join(' '), /drinking water/);
  assert.match(guide.missing.join(' '), /feed/);
  assert.match(guide.missing.join(' '), /protected at night/);
  assert.equal(guide.selectedEnterprise?.id, 'chicken-layer');
  assert.match(guide.localCheck, /promises no output or dates/);
});

test('recorded local care gaps stay visible rather than recommending a hardy breed as a substitute', () => {
  const guide = poultryGuidance({ purpose: 'both', drinkingWater: 'sometimes', feeding: 'mostly-scavenging', nightProtection: 'none' }, { frost: 'no' });
  assert.equal(guide.status, 'care-needs-attention');
  assert.match(guide.attention.join(' '), /reliable clean drinking water/);
  assert.match(guide.attention.join(' '), /laying hens/);
  assert.match(guide.attention.join(' '), /night protection/);
  assert.ok(guide.options.some((option) => option.name === 'Naked Neck'));
  assert.match(guide.localCheck, /not a final breed recommendation/);
});

test('confirmed survey management remains a local-review shortlist without production math', () => {
  const guide = poultryGuidance({ ...caredFor, recordedBreed: 'Farmer’s local birds', layingHens: 7 }, { frost: 'no' });
  assert.equal(guide.status, 'review-locally');
  assert.deepEqual(guide.missing, []);
  assert.equal(guide.recordedBreed, 'Farmer’s local birds');
  assert.equal(guide.recordedLayingHens, 7);
  const keys = Object.keys(guide).join(' ');
  assert.doesNotMatch(keys, /yield|forecast|output|months/i);
  assert.deepEqual(poultryGuidance({ ...caredFor, layingHens: 0 }, { frost: 'no' }).recordedLayingHens, 0);
  assert.equal(poultryGuidance({ ...caredFor, layingHens: 2.5 }).recordedLayingHens, null);
});

test('reported purpose changes relevant commercial systems without choosing a breed or altering the survey', () => {
  const profile: PoultryManagement = { ...caredFor, purpose: 'meat' };
  const before = structuredClone(profile);
  const guide = poultryGuidance(profile, { frost: 'no' }, 'chicken-layer');
  assert.deepEqual(profile, before);
  assert.equal(guide.purpose, 'meat');
  assert.equal(guide.recordedBreed, null);
  assert.ok(guide.options.some((option) => option.id === 'commercial-broilers'));
  assert.ok(!guide.options.some((option) => option.id === 'commercial-layers'));
  assert.match(guide.attention.join(' '), /purpose differ/);
  const eggs = poultryGuidance(caredFor, { frost: 'no' });
  assert.ok(eggs.options.some((option) => option.id === 'commercial-layers'));
  assert.ok(!eggs.options.some((option) => option.id === 'commercial-broilers'));
  assert.equal(poultryGuidance(caredFor, undefined, 'bee-honey').selectedEnterprise, null);
});

test('regional guidance uses reported conditions without inventing hot weather, drinking water or a province winner', () => {
  const conditions: SiteProductionConditions = { frost: 'yes', frostMonths: [6, 7], drainage: 'stays-wet', drySeasonWater: 'rain-only' };
  const guide = poultryGuidance(undefined, conditions);
  const notes = guide.climateNotes.map((point) => point.text).join(' ');
  assert.match(notes, /You reported frost/);
  assert.match(notes, /You reported wet ground/);
  assert.match(notes, /Check drinking water separately/);
  assert.match(notes, /heat at this site has not been confirmed/);
  assert.match(notes, /within provinces/);
  assert.match(guide.missing.join(' '), /clean drinking water/);
  const unobserved = poultryGuidance(undefined, { frost: 'unknown', drainage: 'unknown' });
  assert.ok(!unobserved.climateNotes.some((point) => /You reported frost|You reported wet ground/.test(point.text)));
});

test('every breed and care claim points to primary research or South African extension', () => {
  const guide = poultryGuidance();
  const breeds = guide.options.filter((option) => option.kind === 'breed');
  assert.deepEqual(breeds.map((option) => option.name), ['Potchefstroom Koekoek', 'Venda', 'Ovambo', 'Naked Neck']);
  assert.match(breeds[0].detail, /managed ARC trial/);
  assert.match(breeds[0].detail, /do not predict this farm/);
  const sources = [...guide.sources, ...guide.options.map((option) => option.source), ...guide.careNotes.map((point) => point.source), ...guide.climateNotes.map((point) => point.source)];
  for (const source of sources) {
    assert.ok(source.doc.trim());
    assert.ok(['www.arc.agric.za', 'www.fao.org', 'sapoultry.co.za', 'www.scielo.org.za', 'www.frontiersin.org'].includes(new URL(source.url).hostname), source.url);
  }
  assert.match(guide.localCheck, /supplier availability/);
  assert.ok(!guide.options.some((option) => /stock available|best for|best breed|guarantee/i.test(option.detail)));
});
