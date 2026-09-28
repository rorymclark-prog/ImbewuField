import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ANIMAL_ENTERPRISES,
  ANIMAL_LABEL,
  ELEMENT_ANIMAL,
  buildAnimalAvailability,
  enterprisesFor,
  placedAnimalGroups,
  sourcedProductMonths,
  type AnimalKind,
} from '@/lib/animal-enterprises';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { enterpriseFromDossier, loadDossiers } from '../scripts/build-animal-enterprises.mjs';

const records = Object.values(ANIMAL_ENTERPRISES);
const RANGES = ['outputPerAnimal', 'weeksToFirstProduct', 'productiveLifeYears', 'feedKgPerDay', 'waterLPerDay', 'spaceM2'] as const;

test('the generated table is exactly what the dossiers say', () => {
  // lib/animal-enterprises-data.ts is generated; a hand edit there would put a value in the app
  // that no dossier — and so no checked quote — stands behind.
  const dossiers = loadDossiers();
  assert.equal(records.length, dossiers.length, 're-run node scripts/build-animal-enterprises.mjs');
  for (const d of dossiers) {
    assert.deepEqual(ANIMAL_ENTERPRISES[d.enterpriseId], enterpriseFromDossier(d), `${d.enterpriseId} drifted from its dossier`);
  }
});

test('the first build covers chickens, goats, bees, rabbits and ducks', () => {
  for (const kind of Object.keys(ANIMAL_LABEL) as AnimalKind[]) {
    assert.ok(enterprisesFor(kind).length > 0, `no ${kind} enterprise`);
  }
  for (const e of records) {
    assert.ok(e.enterpriseId.startsWith(e.animal === 'bee' ? 'bee' : e.animal), `${e.enterpriseId} is filed under ${e.animal}`);
    assert.ok(['eggs', 'meat', 'milk', 'honey'].includes(e.product), `${e.enterpriseId}: product ${e.product}`);
    assert.ok(e.outputUnit.trim() && e.animalUnit.trim(), `${e.enterpriseId}: units`);
  }
});

test('every value carries a quote and a primary-source URL', () => {
  // The research brief ruled out feed companies, hatcheries, magazines and encyclopaedias; these
  // hosts are the ones a web search surfaces first, so they are the ones that would slip in.
  const banned = /wikipedia\.org|blogspot\.|wordpress\.com|medium\.com|pinterest\.|facebook\.com|youtube\.com|farmersweekly\.co\.za|africanfarming\.net/i;
  const citations = records.flatMap((e) => [
    ...e.windows.map((w) => ({ at: `${e.enterpriseId} ${w.region}`, c: w.source })),
    ...RANGES.flatMap((k) => (e[k] ? [{ at: `${e.enterpriseId} ${k}`, c: e[k]!.source }] : [])),
    ...(e.seasonalPattern ? [{ at: `${e.enterpriseId} seasonalPattern`, c: e.seasonalPattern.source }] : []),
    ...e.welfare.map((p, i) => ({ at: `${e.enterpriseId} welfare ${i}`, c: p.source })),
    ...e.legal.map((p, i) => ({ at: `${e.enterpriseId} legal ${i}`, c: p.source })),
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
  for (const e of records) {
    for (const w of e.windows) {
      assert.ok(w.months.length > 0, `${e.enterpriseId} ${w.region}: empty window`);
      for (const m of w.months) assert.ok(Number.isInteger(m) && m >= 1 && m <= 12, `${e.enterpriseId}: month ${m}`);
      assert.equal(new Set(w.months).size, w.months.length, `${e.enterpriseId} ${w.region}: repeated month`);
    }
    for (const k of RANGES) {
      const r = e[k];
      if (!r) continue;
      const [min, max] = r.value;
      assert.ok(Number.isFinite(min) && Number.isFinite(max) && min >= 0 && min <= max, `${e.enterpriseId} ${k}: [${min}, ${max}]`);
    }
    for (const p of [...e.welfare, ...e.legal]) assert.ok(p.point.trim().length > 0, `${e.enterpriseId}: empty point`);
  }
});

test('element shortcuts point at real elements, and ambiguous housing is not guessed at', () => {
  for (const defId of Object.keys(ELEMENT_ANIMAL)) assert.ok(ELEMENTS_BY_ID[defId], `${defId} is not a design element`);
  // A kraal holds cattle, goats or sheep; a pig pen has no dossier yet.
  assert.equal(ELEMENT_ANIMAL.kraal, undefined);
  assert.equal(ELEMENT_ANIMAL.pig_pen, undefined);
});

test('structures are grouped by animal and counted as structures, not animals', () => {
  const groups = placedAnimalGroups([
    { defId: 'chicken_coop', status: 'existing' },
    { defId: 'chicken_tractor', status: 'proposed' },
    { defId: 'chicken_coop' }, // legacy: no status = existing
    { defId: 'beehive', status: 'proposed' },
    { defId: 'kraal', status: 'existing' },
    { defId: 'veg_bed' },
  ]);
  assert.deepEqual(groups.map((g) => [g.animal, g.existing, g.proposed]), [['chicken', 2, 1], ['bee', 0, 1]]);
});

test('the availability row shows only what the farmer said they keep, and standing structures from today', () => {
  const layer = ANIMAL_ENTERPRISES['chicken-layer'];
  assert.ok(layer, 'chicken-layer dossier missing');
  const groups = placedAnimalGroups([
    { defId: 'chicken_coop', status: 'existing' },
    { defId: 'chicken_coop', status: 'proposed' },
    { defId: 'goat_pen', status: 'existing' },
  ]);
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  // Nothing chosen: no row at all, rather than a guess at what a coop is for.
  assert.ok(buildAnimalAvailability(groups, {}, all, false).every((slot) => slot.length === 0));
  // A choice filed under the wrong animal is ignored.
  assert.ok(buildAnimalAvailability(groups, { goat: 'chicken-layer' }, all, false).every((slot) => slot.length === 0));

  const months = sourcedProductMonths(layer);
  if (months.length === 0) return; // unsourced months: nothing to chart, which is the rule
  const m = months[0];
  const established = buildAnimalAvailability(groups, { chicken: 'chicken-layer' }, [m], false);
  const fromToday = buildAnimalAvailability(groups, { chicken: 'chicken-layer' }, [m], true);
  assert.equal(established[0][0].structures, 2);
  assert.equal(fromToday[0][0].structures, 1);
  assert.equal(established[0][0].product, layer.product);
  // Only proposed coops: nothing from today.
  const planned = placedAnimalGroups([{ defId: 'chicken_coop', status: 'proposed' }]);
  assert.deepEqual(buildAnimalAvailability(planned, { chicken: 'chicken-layer' }, [m], true), [[]]);
});

test('animals never reach a per-m² figure', () => {
  // lib/produce-scope.ts: the Production score divides by vegetable-bed area. Eggs and honey do
  // not come off a bed, so the animal table stays out of the modules that compute bed yield/value.
  for (const file of ['lib/crop-plan.ts', 'lib/plan-value.ts', 'lib/crop-yield.ts']) {
    let src = '';
    try { src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); } catch { continue; }
    assert.doesNotMatch(src, /animal-enterprises/, `${file} must not read animal enterprises`);
  }
});
