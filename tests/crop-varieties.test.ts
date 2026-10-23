import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { CROP_VARIETY_DATA } from '@/lib/crop-varieties-data';
import { varietiesForSite } from '@/lib/crop-varieties';
import { cropByKey } from '@/lib/crop-catalog';
import { isGrowingZoneId } from '@/lib/growing-zones';
import { isOutsideSource, loadDossiers, varietiesFromDossier } from '../scripts/build-crop-varieties.mjs';

test('the generated variety table is exactly what the dossiers say', () => {
  // lib/crop-varieties-data.ts is generated; a hand edit there would show a cultivar no dossier
  // — and so no quoted source — stands behind.
  for (const d of loadDossiers()) {
    const rec = varietiesFromDossier(d);
    const empty = rec.varieties.length === 0 && Object.keys(rec.zoneAdvice).length === 0;
    if (empty) assert.equal(CROP_VARIETY_DATA[d.key], undefined, `${d.key}: re-run node scripts/build-crop-varieties.mjs`);
    else assert.deepEqual(CROP_VARIETY_DATA[d.key], rec, `${d.key} drifted from its dossier: re-run node scripts/build-crop-varieties.mjs`);
  }
});

test('every crop with varieties is a catalog crop', () => {
  for (const key of Object.keys(CROP_VARIETY_DATA)) assert.ok(cropByKey(key), `${key} is not in lib/crop-catalog.ts`);
});

test('every cultivar and zone note carries an outside source, and only real zone ids', () => {
  for (const [key, rec] of Object.entries(CROP_VARIETY_DATA)) {
    for (const v of rec.varieties) {
      assert.ok(v.sources.length > 0, `${key}/${v.name} has no source`);
      for (const s of v.sources) {
        assert.ok(isOutsideSource(s), `${key}/${v.name} cites the app itself: ${s.doc}`);
        assert.doesNotMatch(s.doc, /fetched|verbatim|snippet|JS-rendered/i, `${key}/${v.name}: researcher note shown as the source name`);
      }
      for (const z of v.zones) assert.ok(isGrowingZoneId(z), `${key}/${v.name} names unknown zone ${z}`);
    }
    for (const [zone, a] of Object.entries(rec.zoneAdvice)) {
      assert.ok(isGrowingZoneId(zone), `${key} advises unknown zone ${zone}`);
      assert.ok(a && a.sources.length > 0, `${key}/${zone} advice has no source`);
    }
  }
});

test('a climate shortlist preserves every research option without claiming that inferred groups are local trials', () => {
  const zones = ['highveld', 'midlands-mistbelt'] as const;
  for (const [key, rec] of Object.entries(CROP_VARIETY_DATA)) {
    const site = varietiesForSite(key, zones);
    assert.equal(site.forYourArea.length + site.others.length, rec.varieties.length, key);
    for (const v of site.forYourArea) assert.ok(v.zones.some((z) => (zones as readonly string[]).includes(z)), `${key}/${v.name}`);
    for (const v of site.others) assert.ok(!v.zones.some((z) => (zones as readonly string[]).includes(z)), `${key}/${v.name}`);
  }
  assert.deepEqual(varietiesForSite('not-a-crop', zones), { forYourArea: [], others: [], advice: [] });
});

test('the picker does not present inferred climate groupings or breeding labels as farm validation', () => {
  // Broccoli's dossier explicitly says its zone spread is inferred; green beans are
  // grouped nationally without a regional trial. A source link does not validate that fit.
  const component = readFileSync('components/crops/VarietyGuidance.tsx', 'utf8');
  assert.match(component, /Shortlist for areas like yours/);
  assert.match(component, /Some matches are inferred, rather than tested locally/);
  assert.match(component, /sowing season, soil, water and current availability/);
  assert.match(component, /No site climate is confirmed/);
  assert.doesNotMatch(component, /Named for:|Your area, from|None of the sources named a variety for your area/);
  // Some dossiers infer OP/hybrid status from a name; others are clonal crops.
  // Neither supports the earlier blanket promise that seed can be saved.
  assert.doesNotMatch(component, /seed can be saved|v\.type ===/);
  // The historical summaries can exaggerate a source (Scarlet Nantes says
  // "cool-season only" while its bulletin says "best suited") or mix crop timings.
  // Keep names and references available without printing those summaries as instructions.
  assert.doesNotMatch(component, /\{v\.(season|traits|maturity|bestFor|note)\}|\{advice\.text\}/);
  assert.match(component, /Confirm this option against the current packet or supplier guide/);
});

test('the crop picker shows the sourced guidance, not only the catalog advice', () => {
  const page = readFileSync('app/facilitator/crops/page.tsx', 'utf8');
  assert.match(page, /<VarietyGuidance crop=\{crop\} zones=\{growingZones\} \/>/);
  // A reference city 200 km away is not the site: zones come from the site climate only.
  assert.match(page, /siteClimate && hasSiteCoords \? growingZonesForClimate\(/);
});
