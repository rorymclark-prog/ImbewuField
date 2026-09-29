import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECIES } from '@/lib/species-catalog';
import {
  ELEMENT_SPECIES,
  PERENNIAL_HARVEST,
  buildTreeAvailability,
  formatMonthSpan,
  formatRange,
  perennialHarvestFor,
  placedTreeGroups,
  sourcedSeasonMonths,
  speciesIdForPlaced,
  treePickingByMonth,
  treePickingPhrase,
} from '@/lib/perennial-harvest';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { harvestFromDossier, loadDossiers } from '../scripts/build-perennial-harvest.mjs';

const speciesIds = new Set(SPECIES.map((s) => s.id));
const records = Object.values(PERENNIAL_HARVEST);

test('the generated table is exactly what the dossiers say', () => {
  // lib/perennial-harvest-data.ts is generated; a hand edit there would put a value in the app
  // that no dossier — and so no checked quote — stands behind.
  const dossiers = loadDossiers();
  assert.equal(records.length, dossiers.length, 're-run node scripts/build-perennial-harvest.mjs');
  for (const d of dossiers) {
    assert.deepEqual(PERENNIAL_HARVEST[d.speciesId], harvestFromDossier(d), `${d.speciesId} drifted from its dossier`);
  }
});

test('every harvest record names a live catalogue species', () => {
  for (const h of records) assert.ok(speciesIds.has(h.speciesId), `${h.speciesId} is not in SPECIES`);
});

test('every value carries a quote and a primary-source URL', () => {
  // The research brief ruled out nurseries, blogs and encyclopaedias; these hosts are the ones a
  // web search surfaces first, so they are the ones that would slip in.
  const banned = /wikipedia\.org|blogspot\.|wordpress\.com|medium\.com|pinterest\.|facebook\.com|youtube\.com/i;
  const citations = records.flatMap((h) => [
    ...h.windows.map((w) => ({ at: `${h.speciesId} ${w.region}`, c: w.source })),
    ...(['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits'] as const)
      .flatMap((k) => (h[k] ? [{ at: `${h.speciesId} ${k}`, c: h[k]!.source }] : [])),
    ...(h.pollination ? [{ at: `${h.speciesId} pollination`, c: h.pollination.source }] : []),
  ]);
  assert.ok(citations.length > 0);
  for (const { at, c } of citations) {
    assert.ok(c.quote.trim().length >= 12, `${at}: no quote`);
    assert.match(c.url, /^https?:\/\//, `${at}: no URL`);
    assert.doesNotMatch(c.url, banned, `${at}: ${c.url} is not a primary source`);
    assert.ok(c.doc.trim(), `${at}: no document name`);
  }
});

test('months and ranges are well formed', () => {
  for (const h of records) {
    for (const w of h.windows) {
      assert.ok(w.months.length > 0, `${h.speciesId} ${w.region}: empty window`);
      for (const m of w.months) assert.ok(Number.isInteger(m) && m >= 1 && m <= 12, `${h.speciesId}: month ${m}`);
      assert.equal(new Set(w.months).size, w.months.length, `${h.speciesId} ${w.region}: repeated month`);
    }
    for (const k of ['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits'] as const) {
      const r = h[k];
      if (!r) continue;
      const [min, max] = r.value;
      assert.ok(Number.isFinite(min) && Number.isFinite(max) && min >= 0 && min <= max, `${h.speciesId} ${k}: [${min}, ${max}]`);
    }
    if (h.yearsToFirstCrop && h.yearsToFullBearing) {
      assert.ok(h.yearsToFirstCrop.value[0] <= h.yearsToFullBearing.value[1], `${h.speciesId}: full bearing before first crop`);
    }
  }
});

test('a retired species id still finds its harvest', () => {
  const kei = perennialHarvestFor('dovyalis-afra');
  assert.equal(perennialHarvestFor('dovyalis-caffra'), kei);
  assert.equal(perennialHarvestFor('not-a-species'), null);
  assert.equal(perennialHarvestFor(undefined), null);
});

test('element shortcuts point at real elements and real species', () => {
  for (const [defId, speciesId] of Object.entries(ELEMENT_SPECIES)) {
    assert.ok(ELEMENTS_BY_ID[defId], `${defId} is not a design element`);
    assert.ok(speciesIds.has(speciesId), `${defId} → ${speciesId} is not in SPECIES`);
  }
  // A picked species beats the element it was placed as.
  assert.equal(speciesIdForPlaced({ defId: 'tree_mango', speciesId: 'persea-americana' }), 'persea-americana');
  assert.equal(speciesIdForPlaced({ defId: 'tree_mango' }), 'mangifera-indica');
  assert.equal(speciesIdForPlaced({ defId: 'tree_other', speciesId: 'dovyalis-caffra' }), 'dovyalis-afra');
  // Ambiguous elements are not guessed at.
  assert.equal(speciesIdForPlaced({ defId: 'tree_citrus' }), null);
  assert.equal(speciesIdForPlaced({ defId: 'tree_plum' }), null);
});

test('month spans read the way a farmer says them', () => {
  assert.equal(formatMonthSpan([2, 3, 4, 5, 6, 7, 8, 9, 10]), 'Feb–Oct');
  assert.equal(formatMonthSpan([11, 12, 1]), 'Nov–Jan');
  assert.equal(formatMonthSpan([12, 3, 4]), 'Mar–Apr, Dec');
  assert.equal(formatMonthSpan([5]), 'May');
  assert.equal(formatMonthSpan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'All year');
  assert.equal(formatMonthSpan([]), '');
  assert.equal(formatRange([2, 3]), '2–3');
  assert.equal(formatRange([5, 5]), '5');
  assert.equal(formatRange([100, 112.5]), '100–112.5');
});

test('the chart counts standing trees only from today, and the whole design for an established year', () => {
  const avocado = PERENNIAL_HARVEST['persea-americana'];
  assert.ok(avocado, 'avocado dossier missing');
  const groups = placedTreeGroups([
    { defId: 'tree_avocado', status: 'existing' },
    { defId: 'tree_other', speciesId: 'persea-americana', status: 'proposed' },
    { defId: 'tree_other', speciesId: 'persea-americana' }, // legacy: no status = existing
    { defId: 'veg_bed' },
    { defId: 'tree_citrus' },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual([groups[0].existing, groups[0].proposed], [2, 1]);

  const season = sourcedSeasonMonths(avocado);
  const off = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !season.includes(m));
  const inSeason = season[0];
  const months = off === undefined ? [inSeason] : [inSeason, off];
  const established = buildTreeAvailability(groups, months, false);
  const fromToday = buildTreeAvailability(groups, months, true);
  assert.equal(established[0][0].trees, 3);
  assert.equal(fromToday[0][0].trees, 2);
  if (off !== undefined) assert.deepEqual(established[1], []);

  // Only proposed trees: nothing from today.
  const young = placedTreeGroups([{ defId: 'tree_avocado', status: 'proposed' }]);
  assert.deepEqual(buildTreeAvailability(young, [inSeason], true), [[]]);
});

test('trees never reach a per-m² figure', () => {
  // lib/produce-scope.ts: the Production score divides by vegetable-bed area, so tree fruit must
  // stay out of it whatever the orchard switch says. Keep the harvest table out of the modules
  // that compute bed yields and value.
  for (const file of ['lib/crop-plan.ts', 'lib/plan-value.ts', 'lib/crop-yield.ts']) {
    let src = '';
    try { src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); } catch { continue; }
    assert.doesNotMatch(src, /perennial-harvest/, `${file} must not read tree harvests`);
  }
});

test('the crop plan\'s pick lines: standing trees only, one per in-season month, with the SA season', () => {
  const raspberry = PERENNIAL_HARVEST['rubus-idaeus'];
  assert.ok(raspberry, 'raspberry dossier missing');
  const groups = placedTreeGroups([
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' },
  ]);
  // KZN DARD: "1st week November to late January".
  const lines = treePickingByMonth(groups, [10, 11, 12, 1, 2]);
  assert.deepEqual(lines.map((slot) => slot.length), [0, 1, 1, 1, 0]);
  assert.equal(lines[1][0].trees, 2, 'a proposed cane is not picking this year');
  assert.equal(treePickingPhrase(lines[1][0]), 'Pick Raspberry (2) — SA season Nov–Jan');
  assert.deepEqual(treePickingByMonth(placedTreeGroups([{ defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' }]), [11]), [[]]);
});

test('berries and moringa: harvest records only for what a primary source gave', () => {
  // Rory, 2026-09-29: "what about berries and other food forest crops can we add them to the design
  // studio etc? what about moringa". Blackberry is not here: NEMBA category 2.
  for (const id of ['fragaria-x-ananassa', 'vaccinium-corymbosum', 'rubus-idaeus', 'passiflora-edulis']) {
    assert.ok(PERENNIAL_HARVEST[id]?.windows.length, `${id} has no sourced window`);
  }
  assert.equal(PERENNIAL_HARVEST['rubus-fruticosus'], undefined);
  // Moringa: first leaves 6-12 months after planting (North West DARD), but no sourced SA months,
  // so it stays off the month chart and out of the pick lines rather than borrowing another
  // country's calendar.
  const moringa = PERENNIAL_HARVEST['moringa-oleifera'];
  assert.ok(moringa);
  assert.deepEqual(moringa.yearsToFirstCrop?.value, [0.5, 1]);
  assert.equal(moringa.product, 'leaves');
  assert.equal(speciesIdForPlaced({ defId: 'tree_moringa' }), 'moringa-oleifera');
  // Blueberry's chill figure is in hours, which the chill-units field must not carry.
  assert.equal(PERENNIAL_HARVEST['vaccinium-corymbosum'].chillUnits, null);
});
