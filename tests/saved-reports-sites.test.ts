import test from 'node:test';
import assert from 'node:assert/strict';

// groupReportsBySite() is THE single answer to "which site does this report belong to" — see the
// header comment on it in lib/saved-reports.ts. This tests the pure function directly (no
// localStorage harness needed — grouping takes already-loaded arrays), covering the cases the
// picker UI (components/report/SavedReportsList.tsx) actually branches on: none, one, several,
// an orphan report matching no saved place, and two reports for the same place.

import { groupReportsBySite, UNSAVED_SITE_KEY, type SavedReport } from '../lib/saved-reports.ts';
import type { SavedPlace } from '../lib/saved-places.ts';
import type { LocationData } from '../lib/types.ts';

const KRE_CRECHE = { lat: -28.62800, lon: 29.89100 }; // 5dp — the designSiteIdFromLocation grain
const RIVER_FIELD = { lat: -25.75000, lon: 28.19000 };
const UNSAVED_SPOT = { lat: -27.72600, lon: 31.96300 }; // matches no SavedPlace below

function loc(coords: { lat: number; lon: number }): LocationData {
  return { lat: coords.lat, lon: coords.lon } as LocationData;
}

function place(id: string, name: string, coords: { lat: number; lon: number }, overrides: Partial<SavedPlace> = {}): SavedPlace {
  return {
    id, name, lat: coords.lat, lon: coords.lon,
    biome: 'Grassland', rainfall: 700, elevation: 1200,
    savedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    ...overrides,
  };
}

function report(id: string, coords: { lat: number; lon: number }, savedAt: string, overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id, name: `Grassland · ${savedAt.slice(0, 10)}`, savedAt, lang: 'en',
    report: `# ${id}`, location: loc(coords),
    ...overrides,
  };
}

test('no places: every report lands in one "not saved as a site" group', () => {
  const reports = [
    report('r1', UNSAVED_SPOT, '2026-08-01T10:00:00.000Z'),
    report('r2', RIVER_FIELD, '2026-08-02T10:00:00.000Z'),
  ];
  const groups = groupReportsBySite(reports, []);
  assert.equal(groups.length, 1, 'no saved places → exactly one catch-all group, not one per orphan coordinate');
  assert.equal(groups[0].siteId, UNSAVED_SITE_KEY);
  assert.equal(groups[0].place, null);
  assert.equal(groups[0].reports.length, 2, 'no report is dropped for lacking a saved place');
});

test('one place with reports: a single group, no picker needed', () => {
  const places = [place('p1', 'Ubhejane Crèche', KRE_CRECHE)];
  const reports = [
    report('r1', KRE_CRECHE, '2026-08-01T10:00:00.000Z'),
    report('r2', KRE_CRECHE, '2026-08-04T10:00:00.000Z'),
  ];
  const groups = groupReportsBySite(reports, places);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].place?.name, 'Ubhejane Crèche');
  assert.equal(groups[0].reports.length, 2);
  // Newest report first within the group.
  assert.deepEqual(groups[0].reports.map((r) => r.id), ['r2', 'r1']);
});

test('several places: one group per site, newest-group-first, correctly counted', () => {
  const places = [
    place('p1', 'Ubhejane Crèche', KRE_CRECHE),
    place('p2', 'River Field', RIVER_FIELD),
  ];
  const reports = [
    report('r1', KRE_CRECHE, '2026-08-01T10:00:00.000Z'),
    report('r2', RIVER_FIELD, '2026-08-10T10:00:00.000Z'),
    report('r3', KRE_CRECHE, '2026-08-05T10:00:00.000Z'),
  ];
  const groups = groupReportsBySite(reports, places);
  assert.equal(groups.length, 2, 'more than one saved site → more than one group');
  // River Field's newest report (Aug 10) is newer than Crèche's (Aug 5) — its group sorts first.
  assert.equal(groups[0].place?.name, 'River Field');
  assert.equal(groups[0].reports.length, 1);
  assert.equal(groups[1].place?.name, 'Ubhejane Crèche');
  assert.equal(groups[1].reports.length, 2);
  assert.deepEqual(groups[1].reports.map((r) => r.id), ['r3', 'r1']);
});

test('a report whose coordinates match no saved place still surfaces, under the unsaved bucket', () => {
  const places = [place('p1', 'Ubhejane Crèche', KRE_CRECHE)];
  const reports = [
    report('r1', KRE_CRECHE, '2026-08-01T10:00:00.000Z'),
    report('r2', UNSAVED_SPOT, '2026-08-02T10:00:00.000Z'),
  ];
  const groups = groupReportsBySite(reports, places);
  assert.equal(groups.length, 2);
  const unsaved = groups.find((g) => g.siteId === UNSAVED_SITE_KEY);
  assert.ok(unsaved, 'the orphan report must not be dropped');
  assert.equal(unsaved?.place, null);
  assert.deepEqual(unsaved?.reports.map((r) => r.id), ['r2']);
  const known = groups.find((g) => g.place?.name === 'Ubhejane Crèche');
  assert.deepEqual(known?.reports.map((r) => r.id), ['r1']);
});

test('two reports for the same place group together, not as two sites', () => {
  const places = [place('p1', 'Ubhejane Crèche', KRE_CRECHE)];
  const reports = [
    report('r1', KRE_CRECHE, '2026-08-01T10:00:00.000Z'),
    report('r2', KRE_CRECHE, '2026-08-01T15:00:00.000Z'), // same day, different time
  ];
  const groups = groupReportsBySite(reports, places);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].reports.length, 2);
  assert.deepEqual(groups[0].reports.map((r) => r.id), ['r2', 'r1'], 'newest saved (15:00) sorts first');
});

test('a place a few metres off the exact stored coordinate does not match — same rounding grain as designSiteIdFromLocation', () => {
  // 5dp rounding (~1.1m) is the grain the rest of the app keys sites by (survey/design/crop
  // stores). Two spots that round to different 5dp keys are, correctly, different sites.
  const places = [place('p1', 'Ubhejane Crèche', KRE_CRECHE)];
  const farReport = report('r1', { lat: KRE_CRECHE.lat + 0.01, lon: KRE_CRECHE.lon }, '2026-08-01T10:00:00.000Z');
  const groups = groupReportsBySite([farReport], places);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].place, null, 'a coordinate ~1.1km off the saved place must not silently match it');
});
