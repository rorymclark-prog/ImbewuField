import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { farmCalendarOffer, farmCalendarOfferNote, farmCalendarOfferText } from '@/lib/calendar-page-farm-calendar';
import { siteClimateFromLocationData, type SiteClimate } from '@/lib/site-climate';
import { SOWING_CALENDAR_LABEL, SOWING_CALENDAR_LABEL_ZU } from '@/lib/sowing-calendar-label';

// CP-097: the calendar page, the Atlas and the planner name the four sowing calendars
// the same way, and the calendar page offers "this farm's calendar" only as an explicit
// pick, never as a default and never from a regional fallback.

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/sa-climate-sites-2026-11-10.json', import.meta.url), 'utf8')).sites;
const siteNamed = (name: string): SiteClimate => {
  const s = FIXTURE.find((row: { name: string }) => row.name === name);
  assert.ok(s, `fixture is missing ${name}`);
  const climate = siteClimateFromLocationData({
    rainfall: { rainfallSource: s.rainfallSource, monthly: s.monthlyRainMm },
    climate: { monthlyTemp: s.monthlyTempC, monthlyTempCoverage: { source: 'nasa-power', status: 'complete' }, minTemp: s.recordMinC, minTempSource: 'nasa-power' },
  }, s.lat);
  assert.ok(climate);
  return climate;
};

test('nothing known: no farm calendar is offered', () => {
  assert.equal(farmCalendarOffer({ chosen: null, sample: null, site: null, observedFrost: 'no' }), null);
});

test('the grower\'s choice wins over the sample and the site; the sample wins over the site', () => {
  const site = siteNamed('Mbombela');
  assert.deepEqual(farmCalendarOffer({ chosen: 'winter', sample: 'all-year', site, observedFrost: undefined }), { pattern: 'winter', basis: 'grower-choice' });
  assert.deepEqual(farmCalendarOffer({ chosen: null, sample: 'all-year', site, observedFrost: undefined }), { pattern: 'all-year', basis: 'sample-farm' });
});

test('the site\'s own records, and the grower\'s frost answer where the site is a close call', () => {
  const site = siteNamed('Mbombela');
  assert.ok(site.warmerNeighbour);
  assert.deepEqual(farmCalendarOffer({ chosen: null, sample: null, site, observedFrost: 'unknown' }), { pattern: 'mild-frost', basis: 'site-climate' });
  assert.deepEqual(farmCalendarOffer({ chosen: null, sample: null, site, observedFrost: 'no' }), { pattern: 'all-year', basis: 'grower-frost' });
});

test('the option names the calendar; the line under it says whose call it was', () => {
  // The option used to carry both ("... (from this site's climate records)"). In a browser at
  // 390 px the closed select cut it off after "(from", so the reason moved to its own line.
  assert.equal(farmCalendarOfferText({ pattern: 'summer', basis: 'grower-choice' }), "This farm's crop plan: Winter frost");
  assert.equal(farmCalendarOfferText({ pattern: 'all-year', basis: 'site-climate' }), "This farm's crop plan: Hot area, no frost");
  for (const pattern of ['summer', 'mild-frost', 'all-year', 'winter'] as const) {
    assert.ok(farmCalendarOfferText({ pattern, basis: 'site-climate' }).length <= 42, `${pattern}: must fit a phone's closed select`);
  }
  assert.equal(farmCalendarOfferNote({ pattern: 'summer', basis: 'grower-choice' }), 'This farm\'s crop plan uses the "Winter frost" calendar (chosen by you).');
  assert.equal(farmCalendarOfferNote({ pattern: 'mild-frost', basis: 'site-climate' }), 'This farm\'s crop plan uses the "Light frost at most" calendar (from this site\'s climate records).');
  assert.equal(farmCalendarOfferNote({ pattern: 'all-year', basis: 'grower-frost' }), 'This farm\'s crop plan uses the "Hot area, no frost" calendar (from this site\'s climate records and your frost answer).');
  assert.equal(farmCalendarOfferNote({ pattern: 'winter', basis: 'sample-farm' }), 'This farm\'s crop plan uses the "Winter rainfall" calendar (set for the sample farm).');
});

test('every calendar has an English and an isiZulu name', () => {
  for (const key of ['summer', 'mild-frost', 'all-year', 'winter'] as const) {
    assert.ok(SOWING_CALENDAR_LABEL[key]);
    assert.ok(SOWING_CALENDAR_LABEL_ZU[key]);
  }
});

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the calendar page and the Atlas use the shared names, not their own', () => {
  const calendar = read('app/calendar/page.tsx');
  const atlas = read('components/atlas/AtlasPanel.tsx');
  for (const [name, src] of [['calendar page', calendar], ['atlas', atlas]] as const) {
    assert.match(src, /from '@\/lib\/sowing-calendar-label'/, `${name} must import the shared names`);
    assert.doesNotMatch(src, /Summer-rainfall pattern/, name);
    assert.doesNotMatch(src, /'Summer rainfall'/, name);
    assert.doesNotMatch(src, /const (RAIN_PATTERN_LABELS|PATTERN_LABEL|PATTERN_LABEL_ZU)\b/, name);
  }
});

test('the calendar page reads this device only: no climate fetch', () => {
  const calendar = read('app/calendar/page.tsx');
  assert.doesNotMatch(calendar, /resolveSiteClimate/);
  assert.doesNotMatch(calendar, /location-data/);
  assert.match(calendar, /loadCachedSiteClimate/);
});
