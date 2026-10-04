import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECIES } from '@/lib/species-catalog';
import {
  ELEMENT_SPECIES,
  PERENNIAL_HARVEST,
  buildTreeAvailability,
  cleanTreeSeasonChoices,
  formatMonthSpan,
  formatRange,
  perennialHarvestFor,
  placedTreeGroups,
  sourcedSeasonMonths,
  speciesIdForPlaced,
  treePickingByMonth,
  treePickingPhrase,
  unidentifiedPlantGroups,
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

test('locally confirmed seasons count standing trees from today and preserve proposed plants in the repeated design', () => {
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

  // The audit found an eleven-month avocado season made by unioning different regions. This
  // fixture represents one farmer-confirmed window; the national union must never choose it.
  const choices = { 'persea-americana': { months: [8, 9, 10, 11, 12], bearing: true } };
  const season = choices['persea-americana'].months;
  const off = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !season.includes(m));
  const inSeason = season[0];
  const months = off === undefined ? [inSeason] : [inSeason, off];
  assert.ok(buildTreeAvailability(groups, months, false).every((m) => m.length === 0));
  const established = buildTreeAvailability(groups, months, false, choices);
  const fromToday = buildTreeAvailability(groups, months, true, choices);
  assert.equal(established[0][0].trees, 3);
  assert.equal(fromToday[0][0].trees, 2);
  if (off !== undefined) assert.deepEqual(established[1], []);

  // Only proposed trees: nothing from today.
  const young = placedTreeGroups([{ defId: 'tree_avocado', status: 'proposed' }]);
  assert.deepEqual(buildTreeAvailability(young, [inSeason], true, choices), [[]]);
});

test('an avocado reference never extends a locally confirmed season, and unproductive plants do not promise food', () => {
  const groups = placedTreeGroups([{ defId: 'tree_avocado', status: 'existing' }]);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.deepEqual(buildTreeAvailability(groups, months, true).map((m) => m.length), months.map(() => 0));
  const choices = { 'persea-americana': { months: [8, 9], bearing: true } };
  assert.deepEqual(buildTreeAvailability(groups, months, true, choices).map((m) => m.length), [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.ok(buildTreeAvailability(groups, months, true, { 'persea-americana': { months: [8, 9], bearing: false } }).every((m) => m.length === 0));
});

test('each banana circle contributes three planted bananas without changing the design or inventing seasons', () => {
  const items = [{ defId: 'banana_clump', status: 'existing' as const, x: 10, y: 20 }, { defId: 'banana_circle', status: 'proposed' as const, x: 33, y: 44, widthM: 7, rotation: 23 }];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.deepEqual(items, before, 'count assumption must not alter saved geometry');
  assert.equal(groups[0].existing, 1);
  assert.equal(groups[0].proposed, 3);
  assert.equal(groups.length, 1, 'circles and individual bananas share one product');
  assert.equal(groups[0].harvest.speciesId, 'musa-acuminata-aaa-group');
  assert.equal(sourcedSeasonMonths(groups[0].harvest).length, 0, 'do not invent an all-year banana season');
  assert.equal(speciesIdForPlaced(items[1]), 'musa-acuminata-aaa-group', 'Rory explicitly defines a circle as three bananas');
  assert.deepEqual(unidentifiedPlantGroups(items), []);
  assert.deepEqual(unidentifiedPlantGroups([{ defId: 'banana_circle', speciesId: 'musa-acuminata-aaa-group' }]), []);
  assert.equal(unidentifiedPlantGroups([{ defId: 'banana_circle', speciesId: 'unsupported-id' }]).length, 1, 'an unavailable harvest record must not erase the design layout');
});

test('mapped food species without a harvest dossier remain counted and permit only confirmed local dates without invented yields', () => {
  const apple = SPECIES.find(species => species.id === 'malus-domestica');
  assert.ok(apple && apple.uses.includes('food') && apple.nemba === 'none');
  assert.equal(perennialHarvestFor(apple.id), null, 'the fixture must exercise a genuinely missing harvest dossier');
  const items = [
    { defId: 'tree_other', speciesId: apple.id, status: 'existing' as const },
    { defId: 'tree_apple', speciesId: apple.id },
    { defId: 'tree_other', speciesId: apple.id, status: 'proposed' as const },
    { defId: 'tree_other', speciesId: 'morus-nigra', status: 'proposed' as const },
    { defId: 'tree_avocado', status: 'existing' as const },
  ];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.equal(groups.length, 3, 'unknown research must not erase known catalogue food plants');
  assert.deepEqual(unidentifiedPlantGroups(items), [], 'an identified permitted food plant uses the same month-confirmation authority');
  const group = groups.find(entry => entry.harvest.speciesId === apple.id);
  assert.ok(group?.referenceMissing);
  assert.deepEqual([group.existing, group.proposed, group.harvest.name], [2, 1, apple.commonName]);
  assert.deepEqual(group.harvest.windows, []);
  for (const key of ['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits', 'pollination'] as const) assert.equal(group.harvest[key], null);
  assert.deepEqual(buildTreeAvailability(groups, [1, 6, 12], true), [[], [], []]);
  const choices = cleanTreeSeasonChoices({ [apple.id]: { bearing: true, months: [6, 6, 13, 0] }, 'morus-nigra': { bearing: true, months: [6] } });
  assert.deepEqual(choices[apple.id], { bearing: true, months: [6] });
  const locallyConfirmed = buildTreeAvailability(groups, [1, 6, 12], true, choices);
  assert.deepEqual(locallyConfirmed[1], [{ speciesId: apple.id, name: apple.commonName, trees: 2 }]);
  assert.deepEqual(locallyConfirmed[0], []);
  assert.deepEqual(locallyConfirmed[2], []);
  assert.equal(treePickingByMonth(groups, [6], choices)[0][0].name, apple.commonName);
  assert.equal(locallyConfirmed[1].some(entry => entry.speciesId === 'morus-nigra'), false, 'proposed-only plants have no current picking jobs even with dates supplied');
  assert.deepEqual(items, before, 'reading an inventory must not change map geometry or status');
});

test('generic fruit elements retain their names while restricted mapped food remains inventory without gaining production dates', () => {
  const ornamental = SPECIES.find(species => !species.uses.includes('food') && species.nemba === 'none');
  const restricted = SPECIES.find(species => species.nemba !== 'none');
  assert.ok(ornamental && restricted);
  const items = [
    { defId: 'tree_pear' }, { defId: 'tree_plum', status: 'proposed' as const },
    { defId: 'tree_olive' }, { defId: 'tree_citrus' },
    { defId: 'tree_other' }, { defId: 'tree_indigenous' }, { defId: 'tree_basin' },
    { defId: 'tree_apple', speciesId: ornamental.id },
    { defId: 'tree_other', speciesId: restricted.id },
  ];
  const groups = unidentifiedPlantGroups(items);
  assert.deepEqual(groups.map(group => group.label).sort(), [...['tree_pear', 'tree_plum', 'tree_olive', 'tree_citrus'].map(id => ELEMENTS_BY_ID[id].name), restricted.commonName].sort());
  assert.ok(groups.filter(group => !group.legalCheck).every(group => group.speciesId === undefined), 'generic element names do not prove a botanical identity');
  assert.equal(groups.find(group => group.defId === 'tree_plum')?.proposed, 1);
  assert.match(groups.find(group => group.speciesId === restricted.id)?.legalCheck ?? '', new RegExp(`NEMBA ${restricted.nemba}`));
  assert.equal(placedTreeGroups(items).some(group => group.harvest.speciesId === restricted.id), false);
  assert.deepEqual(cleanTreeSeasonChoices({ [restricted.id]: { bearing: true, months: [1] } }), {});
  const aliased = cleanTreeSeasonChoices({ 'dovyalis-caffra': { bearing: true, months: [12, 1] } });
  assert.deepEqual(aliased, { 'dovyalis-afra': { bearing: true, months: [1, 12] } }, 'retired catalogue IDs must use the current stored observation key');
});

test('saved local seasons discard invalid months and unknown species without assuming productive plants', () => {
  const clean = cleanTreeSeasonChoices({ 'persea-americana': { months: [8, 8, 0, 13, '9', 9], bearing: 'true' }, missing: { months: [1], bearing: true }, constructor: { months: [1], bearing: true } });
  assert.deepEqual(clean, { 'persea-americana': { months: [8, 9], bearing: false } });
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

test('the crop plan\'s pick lines require local confirmation and keep proposed plants out of current jobs', () => {
  const raspberry = PERENNIAL_HARVEST['rubus-idaeus'];
  assert.ok(raspberry, 'raspberry dossier missing');
  const groups = placedTreeGroups([
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' },
  ]);
  // KZN DARD: "1st week November to late January".
  const choices = { 'rubus-idaeus': { months: [11, 12, 1], bearing: true } };
  assert.ok(treePickingByMonth(groups, [10, 11, 12, 1, 2]).every((slot) => slot.length === 0));
  const lines = treePickingByMonth(groups, [10, 11, 12, 1, 2], choices);
  assert.deepEqual(lines.map((slot) => slot.length), [0, 1, 1, 1, 0]);
  assert.equal(lines[1][0].trees, 2, 'a proposed cane is not picking this year');
  assert.equal(treePickingPhrase(lines[1][0]), 'Pick Raspberry (2) — confirmed local months Nov–Jan');
  assert.deepEqual(treePickingByMonth(placedTreeGroups([{ defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' }]), [11], choices), [[]]);
});

test('berries and moringa: harvest records only for what a primary source gave', () => {
  // Rory, 2026-09-29: "what about berries and other food forest crops can we add them to the design
  // studio etc? what about moringa". Blackberry is not here: NEMBA category 2.
  for (const id of ['fragaria-x-ananassa', 'vaccinium-corymbosum', 'rubus-idaeus', 'passiflora-edulis', 'physalis-peruviana']) {
    assert.ok(PERENNIAL_HARVEST[id]?.windows.length, `${id} has no sourced window`);
  }
  assert.equal(PERENNIAL_HARVEST['rubus-fruticosus'], undefined);
  // Cape gooseberry's only SA months are one Stellenbosch tunnel trial's picking dates; its
  // "120 days after transplanting" is not a years-to-first-crop figure.
  assert.deepEqual(PERENNIAL_HARVEST['physalis-peruviana'].windows.map((w) => w.months), [[10, 11, 12, 1]]);
  assert.equal(PERENNIAL_HARVEST['physalis-peruviana'].yearsToFirstCrop, null);
  // Moringa: first leaves 6-12 months after planting (North West DARD). The only sourced months
  // are that guide's pod months ("Fruits production mainly occurs in March and April."); leaf
  // harvest has no SA calendar, so the window names pods rather than borrowing one.
  const moringa = PERENNIAL_HARVEST['moringa-oleifera'];
  assert.ok(moringa);
  assert.deepEqual(moringa.yearsToFirstCrop?.value, [0.5, 1]);
  assert.equal(moringa.product, 'leaves and pods');
  assert.deepEqual(moringa.windows.map((w) => w.months), [[3, 4]]);
  assert.match(moringa.windows[0].region, /pods/);
  // Mulberry: no SA primary source gave fruiting months, so no record at all.
  assert.equal(PERENNIAL_HARVEST['morus-nigra'], undefined);
  assert.equal(speciesIdForPlaced({ defId: 'tree_moringa' }), 'moringa-oleifera');
  // Blueberry's chill figure is in hours, which the chill-units field must not carry.
  assert.equal(PERENNIAL_HARVEST['vaccinium-corymbosum'].chillUnits, null);
});
