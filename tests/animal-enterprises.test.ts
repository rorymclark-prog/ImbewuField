import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import {
  ANIMAL_ENTERPRISES,
  ANIMAL_LABEL,
  ELEMENT_HOUSING,
  HOUSING_ANIMALS,
  buildAnimalAvailability,
  cleanAnimalSeasonChoices,
  cleanChoices,
  enterprisesFor,
  enterprisesForHousing,
  isFoodProduct,
  formatAmountRange,
  animalReferenceQualifier,
  loadAnimalSeasonChoices,
  loadEnterpriseChoices,
  loadIncludeAnimals,
  resetSampleAnimalChoices,
  saveAnimalSeasonChoices,
  saveEnterpriseChoices,
  placedAnimalGroups,
  sourcedProductMonths,
  type AnimalKind,
  type HousingKind,
} from '@/lib/animal-enterprises';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { ANIMAL_ART, ANIMAL_ART_ROOT } from '@/lib/animal-art';
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

test('every animal kind has at least one enterprise, filed under its own name', () => {
  for (const kind of Object.keys(ANIMAL_LABEL) as AnimalKind[]) {
    assert.ok(enterprisesFor(kind).length > 0, `no ${kind} enterprise`);
  }
  for (const e of records) {
    assert.ok(e.enterpriseId.startsWith(e.animal === 'bee' ? 'bee' : e.animal), `${e.enterpriseId} is filed under ${e.animal}`);
    assert.ok(['eggs', 'meat', 'milk', 'honey', 'fish', 'wool'].includes(e.product), `${e.enterpriseId}: product ${e.product}`);
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
  for (const defId of Object.keys(ELEMENT_HOUSING)) assert.ok(ELEMENTS_BY_ID[defId], `${defId} is not a design element`);
  // A kraal holds cattle, sheep or goats, so it offers all three and waits for the farmer.
  const kraal = enterprisesForHousing('kraal');
  assert.ok(kraal.length > 1, 'a kraal must offer a choice');
  assert.ok(kraal.every((e) => ['cattle', 'sheep', 'goat'].includes(e.animal)), 'a kraal holds only cattle, sheep or goats');
  // A pond offers only fish, and never assumes it holds any.
  assert.ok(enterprisesForHousing('pond').every((e) => e.animal === 'fish'));
  const groups = placedAnimalGroups([{ defId: 'kraal', status: 'existing' }, { defId: 'pond_small', status: 'existing' }]);
  assert.ok(buildAnimalAvailability(groups, {}, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], false).every((slot) => slot.length === 0));
  // Every housing's animals exist.
  for (const [housing, animals] of Object.entries(HOUSING_ANIMALS)) {
    for (const a of animals) assert.ok(a in ANIMAL_LABEL, `${housing}: ${a}`);
  }
});

test('a saved choice must fit its housing', () => {
  const kraalPick = enterprisesForHousing('kraal')[0];
  const fishPick = enterprisesForHousing('pond')[0];
  const raw: Record<string, string> = { chicken: 'chicken-layer', kraal: kraalPick?.enterpriseId ?? '', pond: kraalPick?.enterpriseId ?? '', nonsense: 'chicken-layer' };
  const clean = cleanChoices(raw);
  assert.equal(clean.chicken, 'chicken-layer', 'saves from before housing kinds stay valid');
  if (kraalPick) assert.equal(clean.kraal, kraalPick.enterpriseId);
  assert.equal(clean.pond, undefined, 'a kraal enterprise cannot be what a pond is for');
  assert.equal((clean as Record<string, string>).nonsense, undefined);
  if (fishPick) assert.equal(cleanChoices({ pond: fishPick.enterpriseId }).pond, fishPick.enterpriseId);
});

test('wool is never on the food chart', () => {
  const wool = records.filter((e) => !isFoodProduct(e.product));
  assert.ok(wool.every((e) => e.product === 'wool'));
  const groups = placedAnimalGroups([{ defId: 'kraal', status: 'existing' }]);
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const e of wool) {
    const housing = (Object.keys(HOUSING_ANIMALS) as HousingKind[]).find((h) => h === 'kraal' && HOUSING_ANIMALS[h].includes(e.animal));
    if (!housing) continue;
    assert.ok(buildAnimalAvailability(groups, { kraal: e.enterpriseId }, all, false).every((slot) => slot.length === 0), `${e.enterpriseId} reached the chart`);
  }
});

test('structures are grouped by animal and counted as structures, not animals', () => {
  const groups = placedAnimalGroups([
    { defId: 'chicken_coop', status: 'existing' },
    { defId: 'chicken_tractor', status: 'proposed' },
    { defId: 'chicken_coop' }, // legacy: no status = existing
    { defId: 'beehive', status: 'proposed' },
    { defId: 'pig_pen', status: 'existing' },
    { defId: 'veg_bed' },
  ]);
  const expected: [HousingKind, number, number][] = [['chicken', 2, 1], ['bee', 0, 1]];
  if (enterprisesForHousing('pig').length) expected.push(['pig', 1, 0]);
  assert.deepEqual(groups.map((g) => [g.housing, g.existing, g.proposed]), expected);
});

test('choosing layers does not promise all-year eggs and locally confirmed months count standing housing from today', () => {
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

  // Commercial source conditions do not establish productive hens or their local months.
  assert.ok(buildAnimalAvailability(groups, { chicken: 'chicken-layer' }, all, false).every((slot) => slot.length === 0));
  const m = 9;
  const seasons = { chicken: { enterpriseId: 'chicken-layer', months: [m] } };
  const established = buildAnimalAvailability(groups, { chicken: 'chicken-layer' }, [m, 10], false, seasons);
  const fromToday = buildAnimalAvailability(groups, { chicken: 'chicken-layer' }, [m, 10], true, seasons);
  assert.equal(established[0][0].structures, 2);
  assert.equal(fromToday[0][0].structures, 1);
  assert.equal(established[0][0].product, layer.product);
  assert.deepEqual(established[1], [], 'local confirmation does not expand to a commercial all-year reference');
  // Only proposed coops: nothing from today.
  const planned = placedAnimalGroups([{ defId: 'chicken_coop', status: 'proposed' }]);
  assert.deepEqual(buildAnimalAvailability(planned, { chicken: 'chicken-layer' }, [m], true, seasons), [[]]);
  assert.deepEqual(buildAnimalAvailability(groups, { chicken: 'chicken-indigenous' }, [m], true, seasons), [[]], 'changing purpose must not inherit the previous enterprise dates');
});

test('saved animal seasons reject mismatched housing, unknown enterprises and invalid month values', () => {
  assert.deepEqual(cleanAnimalSeasonChoices({ chicken: { enterpriseId: 'chicken-layer', months: [0, 9, 9, 13, '10', 10] }, bee: { enterpriseId: 'chicken-layer', months: [1] }, missing: { enterpriseId: 'bees', months: [1] }, constructor: { enterpriseId: 'bees', months: [1] } }), { chicken: { enterpriseId: 'chicken-layer', months: [9, 10] } });
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

test('small per-animal amounts keep their size instead of rounding to 0.1', () => {
  assert.equal(formatAmountRange([0.11, 0.11]), '0.11');
  assert.equal(formatAmountRange([0.083, 0.083]), '0.083');
  assert.equal(formatAmountRange([0.22, 0.22]), '0.22');
  assert.equal(formatAmountRange([4.57, 4.71]), '4.6–4.7');
  assert.equal(formatAmountRange([407.1, 428.6]), '407.1–428.6');
  assert.equal(formatAmountRange([16, 17]), '16–17');
});

test('animal art: every picture belongs to an enterprise, exists, and is a 256×256 transparent icon', () => {
  const dir = new URL(`../public${ANIMAL_ART_ROOT}/`, import.meta.url);
  for (const [id, url] of Object.entries(ANIMAL_ART)) {
    assert.ok(ANIMAL_ENTERPRISES[id], `${id}: animal art for an enterprise that does not exist`);
    assert.equal(url, `${ANIMAL_ART_ROOT}/${id}.png`, `${id}: file must be named after the enterprise`);
    const { width, height, data } = PNG.sync.read(readFileSync(new URL(`${id}.png`, dir)));
    assert.deepEqual([width, height], [256, 256], `${id}: deployed art is 256×256`);
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.equal(data[(y * width + x) * 4 + 3], 0, `${id}: corner (${x},${y}) is not transparent`);
    }
  }
  // A PNG on disk with no mapping is a picture nobody sees.
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
      assert.ok(ANIMAL_ART[file.replace(/\.png$/, '')], `${file}: on disk but not in lib/animal-art.ts`);
    }
  }
});

test('commercial first eggs are sourced as egg onset, not inferred from the earlier receiving age of pullets', () => {
  const first = ANIMAL_ENTERPRISES['chicken-layer'].weeksToFirstProduct;
  assert.ok(first);
  assert.match(first.source.quote, /first eggs/i);
  const sourcedAge = Number(first.source.quote.match(/at (\d+) weeks of age/)?.[1]);
  assert.ok(Number.isFinite(sourcedAge));
  assert.deepEqual(first.value, [sourcedAge, sourcedAge]);
  assert.match(first.note ?? '', /bird age from hatch/i);
  assert.match(first.note ?? '', /receiving\/housing age, not evidence of first eggs/);
});


test('an animal reference keeps dry matter, indoor housing and life-stage meanings beside its number', () => {
  const dairy = ANIMAL_ENTERPRISES['cattle-dairy'];
  assert.match(dairy.feedKgPerDay?.note ?? '', /Dry-matter.*lactating/i);
  assert.match(animalReferenceQualifier(dairy, 'feedKgPerDay') ?? '', /Dry-matter.*lactating.*not.*fresh feed/i);
  const layer = ANIMAL_ENTERPRISES['chicken-layer'];
  assert.match(layer.spaceM2?.source.quote ?? '', /houses[\s\S]*perching/);
  assert.match(animalReferenceQualifier(layer, 'spaceM2') ?? '', /Indoor.*perches.*not outdoor/i);
  assert.match(animalReferenceQualifier(layer, 'weeksToFirstProduct') ?? '', /from hatch.*not time after buying/i);
  assert.match(animalReferenceQualifier(layer, 'outputPerAnimal') ?? '', /laying-cycle.*not eggs per year/i);
  assert.match(animalReferenceQualifier(ANIMAL_ENTERPRISES.rabbit, 'productiveLifeYears') ?? '', /French intensive.*not.*backyard/i);
  assert.match(animalReferenceQualifier(ANIMAL_ENTERPRISES['cattle-beef'], 'outputPerAnimal') ?? '', /Live calf weaning weight.*not meat weight/i);
  for (const enterprise of records) {
    for (const field of RANGES) {
      if (!enterprise[field]) assert.equal(animalReferenceQualifier(enterprise, field), undefined,
        `${enterprise.enterpriseId}: an absent source cannot acquire a reference qualifier`);
    }
  }
});

test('processor supply guidance does not promise year-round milk from every cow or smallholder herd', () => {
  const dairy = ANIMAL_ENTERPRISES['cattle-dairy'];
  assert.match(dairy.seasonalPattern?.source.quote ?? '', /processors require a year-round even milk/);
  assert.match(dairy.seasonalPattern?.text ?? '', /Commercial dairy processors/);
  assert.match(dairy.seasonalPattern?.text ?? '', /herd supply reference, not year-round milk from each cow/);
  assert.match(dairy.seasonalPattern?.text ?? '', /Confirm.*calving and milking months/);
  assert.doesNotMatch(dairy.seasonalPattern?.text ?? '', /seasonal.*not viable.*SA dairy farmers|milk is produced continuously all year/i);
});

test('every numeric animal card exposes its full source conditions as well as the concise qualifier', () => {
  const component = readFileSync(new URL('../components/crops/AnimalEnterprisesCard.tsx', import.meta.url), 'utf8');
  for (const field of RANGES) {
    assert.ok(component.includes(`qualifier={animalReferenceQualifier(e, '${field}')}`), `${field}: essential conditions disappeared from the fact`);
    assert.ok(component.includes(`note={e.${field}?.note}`), `${field}: the source calculation and scope disappeared`);
  }
  assert.match(component, /Where this number comes from/);
  assert.match(component, /Check the age, system and units/);
});

function withAnimalStorage(store: object, run: () => void, sample = false): void {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    ...store, sessionStorage: { getItem: () => sample ? '1' : null },
  } });
  try { run(); } finally {
    bindMountedAccountLocalStorageUid(null);
    resetSampleAnimalChoices();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('animal choices and local months report whether the device actually stored them', () => {
  const rows = new Map<string, string>();
  withAnimalStorage({ localStorage: {
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => rows.set(key, value),
  } }, () => {
    bindMountedAccountLocalStorageUid('farmer-a');
    assert.equal(saveEnterpriseChoices('farm-a', { chicken: 'chicken-layer', bee: 'bees' }), true);
    assert.equal(saveAnimalSeasonChoices('farm-a', { chicken: { enterpriseId: 'chicken-layer', months: [6, 9] } }), true);
    assert.equal(saveEnterpriseChoices('farm-b', { chicken: 'chicken-indigenous' }), true);
    assert.deepEqual(loadEnterpriseChoices('farm-a'), { chicken: 'chicken-layer', bee: 'bees' });
    assert.deepEqual(loadAnimalSeasonChoices('farm-a'), { chicken: { enterpriseId: 'chicken-layer', months: [6, 9] } });
    assert.deepEqual(loadAnimalSeasonChoices('farm-b'), {});
    bindMountedAccountLocalStorageUid('farmer-b');
    assert.deepEqual(loadEnterpriseChoices('farm-a'), {});
    assert.deepEqual(loadAnimalSeasonChoices('farm-a'), {});
    bindMountedAccountLocalStorageUid('farmer-a');
    assert.deepEqual(loadEnterpriseChoices('farm-b'), { chicken: 'chicken-indigenous' });
  });
});

test('blocked, full or corrupt device storage cannot silently claim that animal production dates were saved', () => {
  const choices = { chicken: 'chicken-layer' } as const;
  const months = { chicken: { enterpriseId: 'chicken-layer', months: [6] } };
  const stores = [
    { localStorage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } },
    { localStorage: { getItem: () => '{broken', setItem: () => assert.fail('corrupt stored data must not be overwritten') } },
  ];
  for (const store of stores) withAnimalStorage(store, () => {
    assert.equal(saveEnterpriseChoices('farm-a', choices), false);
    assert.equal(saveAnimalSeasonChoices('farm-a', months), false);
  });
  const blockedWindow = { sessionStorage: { getItem: () => null } };
  Object.defineProperty(blockedWindow, 'localStorage', { enumerable: true, get: () => { throw new Error('security policy'); } });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: blockedWindow });
  try {
    assert.equal(saveEnterpriseChoices('farm-a', choices), false);
    assert.equal(saveAnimalSeasonChoices('farm-a', months), false);
    assert.deepEqual(loadEnterpriseChoices('farm-a'), {});
    assert.deepEqual(loadAnimalSeasonChoices('farm-a'), {});
    assert.equal(loadIncludeAnimals(), true);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('sample animal choices return success without writing real device storage', () => {
  withAnimalStorage({ localStorage: {
    getItem: () => assert.fail('sample must not read real storage'),
    setItem: () => assert.fail('sample must not write real storage'),
  } }, () => {
    assert.equal(saveEnterpriseChoices('sample-farm', { bee: 'bees' }), true);
    assert.equal(saveAnimalSeasonChoices('sample-farm', { bee: { enterpriseId: 'bees', months: [3] } }), true);
    assert.deepEqual(loadEnterpriseChoices('sample-farm'), { bee: 'bees' });
    assert.deepEqual(loadAnimalSeasonChoices('sample-farm'), { bee: { enterpriseId: 'bees', months: [3] } });
  }, true);
});


test('bee purchases use the amended certificate period and protect playground siting without inventing a local distance', () => {
  const bees = ANIMAL_ENTERPRISES.bees;
  const legal = bees.legal.map(point => point.point).join(' ');
  assert.match(legal, /Registration lasts 24 months.*renewed when it expires/);
  assert.match(legal, /valid registration certificate/);
  assert.doesNotMatch(legal, /annually|each year|1 January|31 March/,
    'the old annual rule in the original 2013 text and dated registration form was amended in 2019');
  const amended = bees.legal.filter(point => /registration|certificate/i.test(point.point));
  assert.ok(amended.every(point => /2019/.test(point.source.doc) && /Consolidated/.test(point.source.url)),
    'the registration instructions must rest on the consolidated law, not the earlier form');
  const siting = bees.welfare.find(point => /playgrounds/.test(point.point));
  assert.ok(siting);
  assert.match(siting.source.url, /^https:\/\/www\.fao\.org\//);
  assert.match(siting.source.quote, /playgrounds.*fresh water.*fairly dry/);
  assert.doesNotMatch(siting.point, /\d|metres|meters/,
    'an African manual is not a universal South African legal distance or an approval of this farm location');
});
