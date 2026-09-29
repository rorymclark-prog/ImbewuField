// Winter coverage regression — the "beds 5-9 rest all May-Aug" hole. Root causes fixed on
// 2026-08-04: backfillWinterGaps refused to commit any sowing >5 months out (a guaranteed no-op
// run Jun-Sep), and fillRemainingGaps spent the shoulder months on quick crops before winter was
// attempted, foreclosing the only long bridgers. The engine is deterministic, so these are exact.
//
// Same afternoon, the owner's next complaint proved coverage alone was not the goal: "september
// is hardly anything and there is no new planting for jun july... i am tired of not seeing a
// full ideal planting!". Coverage had been achieved by every bed bridging winter from the SAME
// early sow month — so the sow-month scarcity tally (SowCounts) now staggers the passes, and the
// tests below pin the audited outcome rather than an invented monthly-food promise: use every
// source-backed sowing opportunity that fits, never double-book mapped area, and disclose the
// winter rest that remains when the farmer's exact crop list has no legal crop for that slot.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autoSuggestPlan,
  isStandardBedFraction,
  plannedCohortReachesMonth,
  planningWeightBenchmarkScore,
  type AutoSuggestAnswers,
} from '../lib/crop-autosuggest.ts';
import { buildFieldUtilizationByMonth, buildFoodAvailability, isSpaceHungry, occupiedMonthsForPlanting, type PlanBed } from '../lib/crop-plan.ts';
import { cropByKey, CROPS, hasAutomaticPlanningBasis, hasVerifiedFieldPlan, hasVerifiedSchedule } from '../lib/crop-catalog.ts';
import { foodGroupOf, rotationFamilyOf } from '../lib/crop-groups.ts';
import { isStapleCrop } from '../lib/staple-crops.ts';

/** `AutoSuggestResult.notes` became `{ kind, bedIds?, text }[]` in the Notes
 * Engine v2 change. These assertions are about the farmer-visible sentence, so
 * they read `.text` and are otherwise unchanged. */
const noteText = (r: { notes: readonly { text: string }[] }): string[] => r.notes.map((note) => note.text);


const NINE_BEDS: PlanBed[] = Array.from({ length: 9 }, (_, i) => ({
  id: `bed-${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3,
}));

// Ubhejane's real staple ground: four ~21 m² plots traced as staple-garden zones.
const FOUR_PLOTS: PlanBed[] = Array.from({ length: 4 }, (_, i) => ({
  id: `zone-staple-${i + 1}`, label: `Plot ${i + 1}`, areaM2: 21, minDimM: 3.5, kind: 'plot' as const,
}));

const FAMILY: AutoSuggestAnswers = {
  goal: 'family',
  householdSize: 'medium',
  groups: ['staple_grain', 'legume', 'leafy_green', 'root_tuber', 'allium_aromatic', 'fruiting_veg'],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
  reliableIrrigation: true,
} as AutoSuggestAnswers;

test('auto-suggest refuses to invent a production plan without irrigation or the site\'s own climate', () => {
  // No siteMonthlyRainMm/TempC here, so no rain-fed plan either
  // (tests/crop-climate-gate.test.ts covers the rain-fed path).
  for (const reliableIrrigation of [undefined, false]) {
    const result = autoSuggestPlan(
      { ...FAMILY, reliableIrrigation },
      'mild-frost',
      NINE_BEDS,
      [],
      8,
    );
    assert.deepEqual(result.plantings, []);
    assert.deepEqual(result.laterThisYear, []);
    assert.match(noteText(result).join(' '), /reliable irrigation was not confirmed/i);
    assert.match(noteText(result).join(' '), /packs successive crop cycles.*rainfall label.*does not prove/i);
  }
});

test('any crop without a verified schedule stays selectable for review but cannot enter auto-suggest', () => {
  // Kale was the last such crop; its duration and spacing were sourced on
  // 2026-08-23 (see the kale test below), so this sweep matches nothing
  // today. It stays as a live guard: any future crop that ships without a
  // verified duration or field-establishment basis is swept up automatically
  // — it must remain a readable named record, never enter a new schedule,
  // and its refusal must say why rather than dead-end the farmer.
  const unscheduled = CROPS.filter((crop) => !hasVerifiedSchedule(crop));
  for (const crop of unscheduled) {
    assert.ok(crop.name.trim() && crop.note.trim(), `${crop.key} is no longer readable as a named record`);
    assert.equal(hasAutomaticPlanningBasis(crop), false, `${crop.key} can still drive automatic planning`);

    const result = autoSuggestPlan({
      ...FAMILY,
      cropKeys: [crop.key],
      groups: [],
    }, 'mild-frost', [NINE_BEDS[0], FOUR_PLOTS[0]], [], 8);
    assert.deepEqual(result.plantings, [], `${crop.key} entered a new automatic schedule`);
    assert.deepEqual(result.laterThisYear, [], `${crop.key} was offered as a later automatic schedule`);
    assert.match(noteText(result).join(' '), /duration or field-establishment basis/i);
    assert.doesNotMatch(noteText(result).join(' '), /widen.*(?:group|selection)/i);
  }
});

test('tomatoes have a verified household-garden basis and can be selected explicitly', () => {
  const tomato = cropByKey('tomatoes');
  assert.ok(tomato);
  assert.equal(hasAutomaticPlanningBasis(tomato), true);
  const result = autoSuggestPlan({ ...FAMILY, cropKeys: ['tomatoes'], groups: [] }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.some((planting) => planting.cropKey === 'tomatoes'));
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'tomatoes'));
});

test('amadumbe can be scheduled from verified timing and spacing without inventing a yield', () => {
  // A missing kg benchmark is a reason to leave the yield/value charts blank,
  // not a reason to grey out a culturally important crop whose field calendar
  // and spacing are sourced. The previous UI conflated ranking evidence with
  // scheduling evidence and made Amadumbe impossible to choose.
  const amadumbe = cropByKey('amadumbe');
  assert.ok(amadumbe);
  assert.equal(hasVerifiedFieldPlan(amadumbe), true);
  assert.equal(hasAutomaticPlanningBasis(amadumbe), false);
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['amadumbe'],
    groups: [],
    allowMixedCropsInBed: true,
  }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.length > 0, 'Amadumbe remained impossible to schedule');
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'amadumbe'));
  assert.match(noteText(result).join(' '), /No supported food-yield benchmark.*kilograms and value remain blank/i);
});

test('kale schedules and carries kilograms from its fully sourced basis', () => {
  // The Ubhejane Creche plan selected kale explicitly and the engine refused
  // it for months as a no-schedule legacy record. Duration and spacing were
  // sourced first (Kirchhoffs: 40x40cm, 100-120 days; Starke Ayres: 55-60-day
  // maturity), which let a selected kale place the way amadumbe does. Its
  // kilograms followed on 2026-08-23 from international extension sources
  // (KALRO/MOALF Kenya, Oregon State, Oklahoma State — no SA figure has ever
  // been published), so kale now clears the full planning basis rather than
  // the timing-only half.
  const kale = cropByKey('kale');
  assert.ok(kale);
  assert.equal(hasVerifiedFieldPlan(kale), true, 'kale duration/spacing verification regressed');
  assert.equal(hasAutomaticPlanningBasis(kale), true, 'kale lost the sourced yield basis');
  assert.equal(kale.yieldKgPerM2, 1.5, 'the kale planning yield moved without a source note');
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['kale'],
    groups: [],
  }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.length > 0, 'explicitly selected kale was still refused a schedule');
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'kale'));
  assert.doesNotMatch(
    noteText(result).join(' '),
    /Kale.*not placed automatically/i,
    'kale must no longer carry the no-schedule warning',
  );
  assert.doesNotMatch(
    noteText(result).join(' '),
    /No supported food-yield benchmark/i,
    'kale carries a sourced benchmark now, so the blank-kilograms note must not fire for it',
  );
});

test('a chosen, verified, non-vine crop that loses every placement pass gets an honest "did not fit" note, not silence', () => {
  // A real client's plan (Ubhejane Creche, 2026-08-21 audit) selected Peppers,
  // Amadumbe, Groundnuts and Peas -- all fully verified, none of them a vine --
  // and every one of them vanished from the printed plan with NOTHING saying
  // why: not the catalog-gap note (they have real schedules), not the vine note
  // (they are not space-hungry), and not even the app's own "later this year"
  // panel, which never reaches the PDF export. One crowded 9m2 bed reproduces
  // the same squeeze here: some of these crops will lose every ranked pass to
  // the others, and the loser MUST now say so.
  const crowded = ['peppers', 'amadumbe', 'groundnuts', 'peas', 'beetroot', 'cabbage', 'carrots', 'onions'];
  for (const key of crowded) assert.ok(cropByKey(key), `${key} disappeared from the catalog`);

  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: crowded,
    groups: [],
  }, 'mild-frost', [NINE_BEDS[0]], [], 8);

  const placedKeys = new Set(result.plantings.map((p) => p.cropKey));
  const text = noteText(result).join(' ');
  let checked = 0;
  for (const key of crowded) {
    const crop = cropByKey(key);
    assert.ok(crop, `${key} disappeared from the catalog`);
    if (placedKeys.has(key)) continue; // won a slot -- nothing to explain
    if (!hasVerifiedSchedule(crop)) continue; // owned by the catalog-gap note
    if (isSpaceHungry(crop)) continue; // owned by the vine-sprawl note
    checked += 1;
    assert.match(
      text,
      new RegExp(`${crop.name.replace(/[()]/g, '\\$&')}.*(?:was|were) chosen but didn't fit anywhere in this plan`, 'i'),
      `${crop.name} was chosen, verified and not a vine, but ended with zero plantings and no note explaining why`,
    );
  }
  assert.ok(checked > 0, 'this fixture placed every explicit crop -- tighten it so the new note actually gets exercised');
});

test('maize and dry beans now use source-backed staple schedules, while oats is a timed cover without fake plant spacing', () => {
  for (const key of ['maize', 'dry-beans']) {
    const crop = cropByKey(key)!;
    assert.equal(hasVerifiedFieldPlan(crop), true);
    assert.equal(hasAutomaticPlanningBasis(crop), true);
  }
  const oats = cropByKey('oats')!;
  assert.equal(hasVerifiedFieldPlan(oats), false, 'broadcast oats must not acquire a fake row grid');
  assert.equal(hasVerifiedSchedule(oats), true, 'the KZN autumn-to-soft-dough cover schedule should be usable');

  const result = autoSuggestPlan({ ...FAMILY, cropKeys: ['maize'], groups: [] }, 'mild-frost', [NINE_BEDS[0], FOUR_PLOTS[0]], [], 8);
  assert.ok(result.plantings.some((planting) => planting.cropKey === 'maize' && planting.bedId === FOUR_PLOTS[0].id));
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'maize'));
});

test('the recommended family plan limits long per-bed harvest gaps and does not let garlic dominate', () => {
  const beds = [...NINE_BEDS, ...FOUR_PLOTS];
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: undefined,
    allowMixedCropsInBed: true,
  }, 'mild-frost', beds, [], 8);

  const wholeFarm = buildFoodAvailability(result.plantings, beds);
  for (let month = 1; month <= 12; month++) {
    assert.ok(wholeFarm[month].some((item) => item.status === 'fresh'), `the whole farm has no fresh crop in month ${month}`);
  }

  // 2026-08-19 recalibration with the rotation-gate fix. The old per-bed
  // floor of 7 fresh months was measured against plans that BROKE rotation:
  // at the pre-fix baseline this exact fixture packed same-family courses
  // overlapping in one bed — Bed 5 broccoli over cabbage (Brassicaceae),
  // Bed 6 peppers over tomatoes (Solanaceae), Bed 7 broad beans over green
  // beans and Bed 8 broad beans over peas (both Fabaceae). Those illegal
  // sixth courses were what pushed several beds past 7 fresh months. With
  // the gate closed the engine still fills every bed (5-6 legal courses
  // each) and the whole farm still picks fresh in all 12 months (asserted
  // above), but per-bed spread has an honest ceiling: floor 5, and the nine
  // beds together must keep at least 60 fresh bed-months (62 today) so the
  // aggregate cannot quietly decay back to the pre-2026-08-04 winter hole.
  let totalFreshBedMonths = 0;
  for (const bed of NINE_BEDS) {
    const own = result.plantings.filter((planting) => planting.bedId === bed.id);
    const fresh = buildFoodAvailability(own, [bed]);
    let longest = 0;
    let run = 0;
    let freshMonths = 0;
    for (let offset = 0; offset < 12; offset++) {
      const month = ((8 - 1 + offset) % 12) + 1;
      if (fresh[month].some((item) => item.status === 'fresh')) {
        freshMonths++;
        run = 0;
      } else {
        longest = Math.max(longest, ++run);
      }
    }
    totalFreshBedMonths += freshMonths;
    assert.ok(freshMonths >= 5, `${bed.label} has fresh picking in only ${freshMonths}/12 months`);
    assert.ok(longest <= 4, `${bed.label} has a ${longest}-month harvest gap`);
  }
  assert.ok(totalFreshBedMonths >= 60,
    `only ${totalFreshBedMonths} fresh bed-months across the nine beds (floor 60)`);

  const counts = result.plantings.reduce((acc, planting) => {
    acc.set(planting.cropKey, (acc.get(planting.cropKey) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  assert.ok((counts.get('garlic') ?? 0) <= 2, `garlic still dominates with ${counts.get('garlic')} cohorts`);
  assert.ok(result.plantings.some((planting) => planting.cropKey === 'maize' && planting.bedId.startsWith('zone-staple-')));
});

test('a garden-wide spread cap keeps one crop off most of the shared beds (2026-09-28 Ubhejane audit)', () => {
  // Ubhejane's real 9-bed + 4-plot mild-frost farm, mixed-crop-list style (the
  // audited plan itself chose these twelve crops). Before the cap, the widest
  // sow windows (cabbage, carrots, lettuce -- all legal in almost every month
  // of the year, so every pass reaches for them whenever nothing narrower
  // fits) filled cabbage into all 9 shared beds and carrots into all 9, with
  // lettuce close behind at 8 -- a garden that is a brassica monoculture with
  // extra steps. gardenSpreadCapFor(beds) = ceil(9 shared beds / 2) = 5, and
  // every placement/closing pass in the pipeline now respects that ceiling
  // UNLESS respecting it would leave a fillable slot bare (no invented crop
  // can fill it, so the cap yields rather than starving a month) -- which is
  // why the audited ceiling below is 7, not 5: the three wide-window crops
  // are still sometimes the only legal candidate left once the other two are
  // already capped. That fallback-adjusted 7 is still a real cut from 9/9/8.
  const beds = [...NINE_BEDS, ...FOUR_PLOTS];
  const cropKeys = ['cabbage', 'lettuce', 'maize', 'potato', 'dry-beans', 'oats', 'broad-beans',
    'butternut', 'carrots', 'onions', 'tomatoes', 'green-beans'];
  const tempC = [26, 25, 24, 21, 18, 15, 14, 16, 19, 22, 24, 26]; // mild-frost KZN-ish normals
  const result = autoSuggestPlan({
    ...FAMILY, cropKeys, groups: [], allowMixedCropsInBed: true, siteMonthlyTempC: tempC,
  }, 'mild-frost', beds, [], 1);

  const bedsUsedBy = (cropKey: string) =>
    new Set(result.plantings.filter((p) => p.cropKey === cropKey).map((p) => p.bedId)).size;
  for (const key of ['cabbage', 'lettuce', 'carrots']) {
    assert.ok(bedsUsedBy(key) <= 7, `${key} still reached ${bedsUsedBy(key)} of ${NINE_BEDS.length} shared beds (cap-with-fallback ceiling is 7)`);
  }

  // Staple plots: the two that already had a second, real catalog crop with a
  // compatible sow window before the cap work (Plot 1 butternut + broad
  // beans, Plot 3 maize + broad beans) must still get both -- the cap must
  // not touch plot logic (plots bypass it entirely).
  const plantingsOn = (bedId: string) => result.plantings.filter((p) => p.bedId === bedId).map((p) => p.cropKey);
  assert.deepEqual(new Set(plantingsOn(FOUR_PLOTS[0].id)), new Set(['butternut', 'broad-beans']));
  assert.deepEqual(new Set(plantingsOn(FOUR_PLOTS[2].id)), new Set(['maize', 'broad-beans']));

  // Plot 2 (dry beans only) and Plot 4 (potato only) are DELIBERATELY left
  // single-crop here: dry beans' Jan sow (soonest legal, correctly preferred
  // by the plot ordering) leaves too short a window before its own May
  // harvest for either winter cover crop's Apr/May sow, and potato's Aug sow
  // occupies through December, which overlaps every legal sow month of both
  // covers regardless of which of potato's own legal months is chosen given
  // their real 6-7 month field spans (holdSpanMonths). No catalog crop closes
  // either gap without inventing a schedule, so this is pinned as a known,
  // explained limit rather than silently left to drift.
  assert.deepEqual(plantingsOn(FOUR_PLOTS[1].id), ['dry-beans']);
  assert.deepEqual(plantingsOn(FOUR_PLOTS[3].id), ['potato']);
});

test('planSuccession reaches for a cooler legal sow month before a hotter one when both are ok (2026-09-28 heat-preference audit)', () => {
  // Lettuce is legal (ECOCROP absoluteMax 30) every month of a mild-frost
  // year, so with no site temperatures the engine has no reason to prefer
  // any one month and 'few-big' (cap 1) just takes the soonest: nowMonth 1.
  const beds = Array.from({ length: 6 }, (_, i) => ({ id: `hb-${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3 }));
  const noTemps = autoSuggestPlan({
    ...FAMILY, cropKeys: ['lettuce'], groups: [], rhythm: 'few-big', allowMixedCropsInBed: true,
  }, 'mild-frost', beds, [], 1);
  assert.ok(noTemps.plantings.length > 0, 'fixture: lettuce must place with no site temps');
  assert.ok(noTemps.plantings.every((p) => p.sowMonth === 1), 'fixture: with no heat data the soonest month (Jan) is chosen');

  // A hot mild-frost site (Jan/Feb mid-20s, ECOCROP optimum 21) makes Jan and
  // Feb sowings grow into their hottest stretch. optimalMax is advisory, not
  // exclusionary (tests/crop-climate-gate.test.ts covers that split), so both
  // months stay legal -- but planSuccession's cooler-first reorder must now
  // reach past them for a non-flagged month while one is available.
  const tempC = [26, 25, 24, 21, 18, 15, 14, 16, 19, 22, 24, 26];
  const withTemps = autoSuggestPlan({
    ...FAMILY, cropKeys: ['lettuce'], groups: [], rhythm: 'few-big', allowMixedCropsInBed: true, siteMonthlyTempC: tempC,
  }, 'mild-frost', beds, [], 1);
  assert.ok(withTemps.plantings.length > 0, 'a heat-aware site must still get a lettuce schedule');
  assert.ok(
    withTemps.plantings.every((p) => p.sowMonth !== 1 && p.sowMonth !== 2),
    `a hot Jan/Feb must be passed over while a cooler legal month exists: got ${withTemps.plantings.map((p) => p.sowMonth)}`,
  );
});

test('automatic vegetable plantings use only full, half, third or quarter beds', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['tomatoes', 'swiss-chard', 'lettuce', 'carrots', 'green-beans'],
    groups: [],
  }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => isStandardBedFraction(planting.areaFraction)));
});

test('exact crop choices remain a strict whitelist on veg beds and staple plots', () => {
  const bed = NINE_BEDS[0];
  const plot = FOUR_PLOTS[0];
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['cabbage'],
    groups: ['fruiting_veg'], // stale category state must not override the exact choice
  }, 'mild-frost', [bed, plot], [], 8);

  assert.ok(result.plantings.some((planting) => planting.bedId === bed.id));
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'cabbage'));
  assert.ok(
    result.plantings.every((planting) => planting.bedId !== plot.id),
    'a non-staple exact choice must leave the plot unplanned, not trigger a catalog fallback',
  );
});

test('an exact staple choice does not gain an unchosen winter cover', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['groundnuts'],
    rhythm: 'few-big',
  }, 'mild-frost', [FOUR_PLOTS[0]], [], 8);

  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'groundnuts'));
});

test('no-mixing mode never strands a virtual bed with a fractional tail reservation', () => {
  const bed: PlanBed = { id: 'virtual', label: 'Virtual bed', areaM2: 10, minDimM: 1.2 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['cabbage', 'carrots', 'green-beans'],
    allowMixedCropsInBed: false,
    rotateCrops: true,
  }, 'mild-frost', [bed], [], 8);

  assert.ok(result.plantings.length > 0, 'the only mapped bed was left unplanned');
  assert.ok(
    result.plantings.every((planting) => planting.areaFraction === undefined),
    `no-mixing plan stranded the bed with ${result.plantings
      .map((planting) => `${planting.cropKey} ${(planting.areaFraction ?? 1) * 100}%`)
      .join(', ')}`,
  );
  assert.ok(
    result.plantings.some((planting) => planting.sowMonth === 8),
    'a far-out tail reservation pre-empted a supported crop that can start now',
  );
});

test('an exact crop rest explanation names the whitelist instead of promising group widening', () => {
  const bed: PlanBed = { id: 'home', label: 'Home bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['green-beans'],
    rotateCrops: false,
  }, 'winter', [bed], [], 11);
  const restNote = noteText(result).find((note) => note.includes('no new sowing')) ?? '';

  assert.match(restNote, /chosen crops \(Green beans\)/);
  assert.match(restNote, /verified schedule/i);
  assert.doesNotMatch(restNote, /outside your selected groups|widen your selection/i);
});

test('a future September cohort cannot claim the January that occurs before it', () => {
  const cabbage = cropByKey('cabbage')!;
  assert.ok(
    occupiedMonthsForPlanting({ cropKey: cabbage.key, sowMonth: 9 }).includes(1),
    'fixture must wrap through January when reduced to month names',
  );
  assert.equal(
    plannedCohortReachesMonth(11, 9, cabbage, 1),
    false,
    'September +10 was folded backward and treated as reaching January +2',
  );
});

test('one-off existing cabbage does not repeat annually and block next September green beans', () => {
  const bed: PlanBed = { id: 'home', label: 'Home bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['green-beans'],
    rhythm: 'few-big',
    allowMixedCropsInBed: false,
    rotateCrops: true,
  }, 'mild-frost', [bed], [{
    id: 'observed-cabbage',
    bedId: bed.id,
    cropKey: 'cabbage',
    sowMonth: 8,
    existing: true,
  }], 11);

  assert.deepEqual(
    result.plantings.map((planting) => ({
      cropKey: planting.cropKey,
      sowMonth: planting.sowMonth,
      areaFraction: planting.areaFraction,
    })),
    [{ cropKey: 'green-beans', sowMonth: 9, areaFraction: undefined }],
  );
});

test('commercial ranking compares sourced conservative yield per crop cycle, not an invented annual rate', () => {
  const butternut = cropByKey('butternut')!;
  const pumpkin = cropByKey('pumpkin')!;
  assert.notEqual(butternut.daysToHarvest, pumpkin.daysToHarvest);
  assert.equal(butternut.yieldKgPerM2, pumpkin.yieldKgPerM2);
  assert.equal(planningWeightBenchmarkScore(butternut), planningWeightBenchmarkScore(pumpkin));
});

test('an August plan under mild-frost covers winter on every bed — Ubhejane’s exact shape', () => {
  // Bed-by-bed uninterrupted occupancy requires overlapping crop cohorts in
  // some beds. Make that farmer choice explicit; default no-mixing mode may
  // honestly leave a short rotation gap rather than invent intercropping.
  const res = autoSuggestPlan(
    { ...FAMILY, allowMixedCropsInBed: true },
    'mild-frost',
    NINE_BEDS,
    [],
    8,
  );
  for (const bed of NINE_BEDS) {
    const months = new Set(
      res.plantings
        .filter((p) => p.bedId === bed.id)
        .flatMap((p) => occupiedMonthsForPlanting(p)),
    );
    // Jun and Jul were the permanent hole. KZN DARD's light-frost windows include
    // source-backed winter options such as cabbage, beetroot, lettuce, peas and
    // broccoli, so an empty winter under confirmed irrigation is an engine regression.
    assert.ok(months.has(6), `${bed.label} has nothing growing in June`);
    assert.ok(months.has(7), `${bed.label} has nothing growing in July`);
  }
});

test('the winter bridger commits far-out sowings instead of narrating a rest it could fix', () => {
  const res = autoSuggestPlan(
    { ...FAMILY, allowMixedCropsInBed: true },
    'mild-frost',
    NINE_BEDS,
    [],
    8,
  );
  for (const note of noteText(res)) {
    assert.doesNotMatch(note, /too far out to plant now/, 'the dropped-bridge note was removed with the gate');
    // A "rests over winter" claim while the same result plants that very stretch was the
    // self-contradiction class — reportStillRestingBeds, computed against FINAL occupancy,
    // is the only voice allowed to say "rests", and after the fixes it should have no
    // winter rest to report under this profile.
    assert.doesNotMatch(note, /rests? (all|over|in) .*(Jun|Jul)/i, `contradictory or stale rest note: "${note}"`);
    // Same rule against the grouped replacement wording, so the gate above did
    // not go quiet when "still rests in ..." stopped being emitted.
    assert.doesNotMatch(note, /no new sowing:.*(Jun|Jul)/i, `contradictory or stale gap note: "${note}"`);
  }
});

test('winter production stays source-backed and every resting bed is disclosed without a sowing quota', () => {
  // "No new planting in June/July" originally exposed genuinely bare beds.
  // Once conservative crop durations are used, a bed can be fully productive
  // through winter from an earlier source-backed sowing. Requiring a new sowing
  // in each named month would now be the bug: it rewards calendar decoration,
  // not land use, and can double-book a crop that is still in the ground.
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const m of [6, 7]) {
    const active = res.plantings.filter((planting) => occupiedMonthsForPlanting(planting).includes(m));
    const activeBedIds = new Set(active.map((planting) => planting.bedId));
    assert.ok(activeBedIds.size > 0, `month ${m} has no mapped-bed production`);
    assert.ok(
      active.every((planting) => hasAutomaticPlanningBasis(cropByKey(planting.cropKey)!)),
      `month ${m} is covered by a crop without complete automatic-planning evidence`,
    );
    for (const bed of NINE_BEDS.filter((candidate) => !activeBedIds.has(candidate.id))) {
      assert.ok(
        noteText(res).some((note) => note.includes('no new sowing') && note.includes(`${bed.label} (`)),
        `${bed.label}'s month ${m} rest is hidden from the farmer`,
      );
    }
  }
});

test('an established year uses mapped land every month without calling occupancy a harvest', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  // Conservative upper durations keep land occupied for longer, but an occupied
  // growing month is not automatically a fresh-food month. This pins the real
  // production objective — use the mapped area — without inventing storage or
  // moving a harvest merely to make all twelve chart columns non-empty.
  const utilization = buildFieldUtilizationByMonth(res.plantings, NINE_BEDS);
  for (let m = 1; m <= 12; m++) {
    assert.ok(
      utilization[m] > 0,
      `month ${m} leaves all mapped veg-bed area idle in the established year`,
    );
  }
});

test('staple plots use every supported field-crop group before repeating one at full area', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', [...NINE_BEDS, ...FOUR_PLOTS], [], 8);
  const firstGroupByPlot: string[] = [];
  for (const plot of FOUR_PLOTS) {
    const onPlot = res.plantings.filter((p) => p.bedId === plot.id);
    assert.ok(onPlot.length > 0, `${plot.label} got no planting at all`);
    for (const p of onPlot) {
      assert.equal(p.areaFraction, undefined, `${plot.label} got a fractional planting — a plot takes one crop at FULL area`);
    }
    const firstCrop = CROPS.find((c) => c.key === onPlot[0].cropKey)!;
    firstGroupByPlot.push(foodGroupOf(firstCrop));
  }
  // The optimiser must exhaust the source-backed staple groups before
  // repeating one; it must not manufacture a fifth field course merely to
  // fill four labels.
  const supportedGroups = new Set(
    CROPS.filter((crop) => isStapleCrop(crop) && hasAutomaticPlanningBasis(crop)).map(foodGroupOf),
  );
  assert.deepEqual(
    new Set(firstGroupByPlot),
    supportedGroups,
    `plots opened on [${firstGroupByPlot.join(', ')}] instead of every supported staple group`,
  );
});

test('a supplied prior crop record prevents an immediate same-family repeat when an alternative fits', () => {
  const plot = FOUR_PLOTS[0];
  const priorGroundnuts = [{
    id: 'prior-groundnuts', bedId: plot.id, cropKey: 'groundnuts', sowMonth: 10, existing: true,
  }];
  const choices: AutoSuggestAnswers = {
    ...FAMILY,
    cropKeys: ['sweet-potato', 'groundnuts'],
    rhythm: 'few-big',
  };
  const withRotation = autoSuggestPlan({ ...choices, rotateCrops: true }, 'mild-frost', [plot], priorGroundnuts, 8);
  const withoutRotation = autoSuggestPlan({ ...choices, rotateCrops: false }, 'mild-frost', [plot], priorGroundnuts, 8);

  assert.equal(withRotation.plantings[0]?.cropKey, 'sweet-potato');
  assert.equal(withoutRotation.plantings[0]?.cropKey, 'groundnuts');
  assert.notEqual(
    rotationFamilyOf(cropByKey(withRotation.plantings[0].cropKey)!),
    rotationFamilyOf(cropByKey('groundnuts')!),
  );
});

test('real green-bean history outranks a synthetic previous-year copy of a future proposal', () => {
  const bed: PlanBed = { id: 'stress-bed', label: 'Stress bed', areaM2: 4, minDimM: 0.8 };
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'summer', [bed], [{
    id: 'existing-green-beans',
    bedId: bed.id,
    cropKey: 'green-beans',
    sowMonth: 4,
    existing: true,
  }], 11);

  const first = [...result.plantings]
    .sort((a, b) => ((a.sowMonth - 11 + 12) % 12) - ((b.sowMonth - 11 + 12) % 12))[0];
  assert.ok(first, 'a different-family crop should remain available after the supplied history');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('green-beans')!),
    'a future proposal copied to -12 shadowed the real prior green-bean course',
  );
});

test('a fictional previous-year cabbage copy cannot license peas after real green beans', () => {
  const beds: PlanBed[] = Array.from({ length: 3 }, (_, index) => ({
    id: `rotation-stress-${index + 1}`,
    label: `Rotation stress ${index + 1}`,
    areaM2: 4,
    minDimM: index === 0 ? 0.8 : index === 1 ? 1.2 : 3,
  }));
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    groups: [],
    cropKeys: undefined,
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'winter', beds, [{
    id: 'existing-green-beans',
    bedId: beds[0].id,
    cropKey: 'green-beans',
    sowMonth: 9,
    existing: true,
  }], 4);

  const first = result.plantings
    .filter((planting) => planting.bedId === beds[0].id)
    .sort((a, b) => ((a.sowMonth - 4 + 12) % 12) - ((b.sowMonth - 4 + 12) % 12))[0];
  assert.ok(first, 'the bed should take a legal different-family crop');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('green-beans')!),
    'peas repeated the supplied bean family after a synthetic cabbage copy hid the real predecessor',
  );
});

test('rotation follows the crop still holding the bed, not an older row with a nearer wrapped month number', () => {
  const bed = NINE_BEDS[0];
  const suppliedRows = [
    // Last year's cabbage is long finished. The March carrots still hold the
    // bed through July, and a July cabbage tray enters the bed in August.
    // Rotation must therefore follow the carrots, not let the older cabbage
    // row shadow the crop that is the candidate's chronological predecessor.
    { id: 'old-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 8, existing: true },
    { id: 'active-carrots', bedId: bed.id, cropKey: 'carrots', sowMonth: 3, existing: true },
  ];
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['cabbage', 'carrots'],
    rhythm: 'steady',
    allowVinesInBeds: true,
    rotateCrops: true,
  }, 'mild-frost', [bed], suppliedRows, 7);

  const first = result.plantings[0];
  assert.ok(first, 'the active carrots should leave a legal next crop slot');
  assert.equal(first.cropKey, 'cabbage');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('carrots')!),
  );
});

test('rotation checks chronological neighbours even when planner passes generate months out of order', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'large',
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'],
    groups: [],
    rotateCrops: true,
  }, 'summer', NINE_BEDS, [], 11);

  const violations: string[] = [];
  for (const bed of NINE_BEDS) {
    const chronological = result.plantings
      .filter((planting) => planting.bedId === bed.id)
      .sort((a, b) => ((a.sowMonth - 11 + 12) % 12) - ((b.sowMonth - 11 + 12) % 12))
      .filter((planting, index, all) => index === 0 || planting.cropKey !== all[index - 1].cropKey);
    for (let index = 1; index < chronological.length; index++) {
      const previous = cropByKey(chronological[index - 1].cropKey)!;
      const current = cropByKey(chronological[index].cropKey)!;
      if (rotationFamilyOf(previous) === rotationFamilyOf(current)) {
        violations.push(`${bed.label}: ${previous.key} -> ${current.key}`);
      }
    }
  }

  assert.deepEqual(violations, [], `same-family chronological transitions: ${violations.join(', ')}`);
});

test('an exact one-family choice falls back truthfully instead of returning an unexplained empty plan', () => {
  const bed = NINE_BEDS[0];
  const prior = [{
    id: 'finished-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 1, existing: true,
  }];
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['broccoli'],
    groups: [],
    rotateCrops: true,
  }, 'mild-frost', [bed], prior, 8);

  assert.ok(result.plantings.length > 0, 'rotation silently vetoed the only exact crop choice');
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'broccoli'));
  assert.match(noteText(result).join(' '), /every exact crop.*Cabbage family.*kept your chosen crop/i);
});

test('a completed crop followed next month is a new rotation course, not an overlapping cohort', () => {
  const bed = NINE_BEDS[0];
  const prior = [{
    // With the conservative 1-3 month nursery range and audited 125-day upper
    // field duration, a November cabbage tray reserves the bed through July.
    // August carrots therefore
    // begin in the immediately following month, not as an overlapping cohort.
    id: 'finished-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 11, existing: true,
  }];
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['cabbage', 'carrots'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'mild-frost', [bed], prior, 8);

  const planned = result.plantings.filter((planting) => !planting.existing);
  assert.ok(planned.length > 0, 'rotation discarded every legal different-family choice');
  assert.equal(
    planned[0].cropKey,
    'carrots',
    'the just-finished cabbage course was followed immediately by the same botanical family',
  );
});

test('commercial concentration does not invent a universal plants-across cutoff for a narrow hand bed', () => {
  const beds: PlanBed[] = [
    { id: 'narrow', label: 'Narrow bed', areaM2: 9, minDimM: 0.8 },
    { id: 'wide', label: 'Wide bed', areaM2: 9, minDimM: 3 },
  ];
  const result = autoSuggestPlan({
    goal: 'commercial',
    focusCropCount: 2,
    cropKeys: ['cabbage', 'carrots'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: false,
    allowVinesInBeds: false,
    reliableIrrigation: true,
    allowMixedCropsInBed: false,
  }, 'mild-frost', beds, [], 1);

  assert.ok(
    result.plantings.some((planting) => planting.bedId === 'narrow' && planting.cropKey === 'cabbage'),
    'a legitimate single-row cabbage bed was rejected by an invented two-plants-across rule',
  );
  assert.ok(result.plantings.some((planting) => planting.bedId === 'wide'));
  assert.doesNotMatch(noteText(result).join(' '), /too narrow|measured width/i);
});

test('few big harvests re-sows a crop after its harvest ends instead of leaving the ground bare', () => {
  // Before 2026-09-27 few-big placed ONE cohort per crop and stopped, so an
  // August plan on nine beds used 53.7% of bed-months. Follow-on rounds now
  // add each crop's next big sowing once its previous one is harvested.
  const res = autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [], rhythm: 'few-big',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'summer', NINE_BEDS, [], 8);
  const use = buildFieldUtilizationByMonth(res.plantings, NINE_BEDS, 8, 12);
  const mean = use.reduce((sum, value) => sum + value, 0) / use.length;
  assert.ok(mean >= 0.7, `few-big bed-month use fell to ${(mean * 100).toFixed(1)}%`);
  const sowsOf = (key: string) => new Set(res.plantings.filter((p) => p.cropKey === key).map((p) => p.sowMonth));
  assert.deepEqual([...sowsOf('green-beans')].sort((a, b) => a - b), [9, 12]);
  assert.deepEqual([...sowsOf('carrots')].sort((a, b) => a - b), [2, 8]);
  assert.ok(noteText(res).some((text) => /next sowing starts only after that harvest ends/.test(text)));
});

test('a crop the farmer picked by name is placed, or the plan says truthfully why not', () => {
  // Rory, 2026-09-29: "i selected pumpkin theres no pumkin or amadumbe or peanuts bambara".
  const beds: PlanBed[] = Array.from({ length: 6 }, (_, i) => ({ id: `pk-${i}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 1.4 }));
  const cropKeys = ['pumpkin', 'amadumbe', 'groundnuts', 'bambara-groundnut', 'cabbage', 'carrots'];
  const run = (pattern: 'summer' | 'mild-frost') => autoSuggestPlan({
    goal: 'family', groups: [], cropKeys, rhythm: 'steady', rotateCrops: true,
    allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
  }, pattern, beds, [], 9);
  for (const pattern of ['summer', 'mild-frost'] as const) {
    const result = run(pattern);
    const placed = new Set(result.plantings.map((p) => p.cropKey));
    // Ticking pumpkin is the opt-in the vine toggle asks for; the review note still names its bed.
    assert.ok(placed.has('pumpkin'), `${pattern}: pumpkin was chosen by name and not placed`);
    assert.ok(result.notes.some((n) => /Pumpkin gets Bed \d to itself/.test(n.text)));
    assert.ok(!result.notes.some((n) => /Pumpkin wants? more room to sprawl/.test(n.text)));
    assert.ok(placed.has('groundnuts'), `${pattern}: groundnuts not placed`);
    // Whatever is left out has no month on this calendar, and is not blamed on full beds.
    for (const key of cropKeys.filter((k) => !placed.has(k))) {
      const crop = cropByKey(key)!;
      assert.deepEqual(crop.sowMonths[pattern], [], `${pattern}: ${key} had months but was left out`);
      const note = result.notes.find((n) => n.unplacedCropKeys?.includes(key));
      assert.ok(note && /no sowing month/.test(note.text) && !/didn't fit/.test(note.text), `${pattern}: ${key} note: ${note?.text}`);
    }
  }
  // A vine nobody asked for still waits for the toggle.
  const broad = autoSuggestPlan({
    goal: 'family', groups: ['fruiting_veg'], rhythm: 'steady', rotateCrops: true,
    allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
  }, 'summer', beds, [], 9);
  assert.ok(!broad.plantings.some((p) => isSpaceHungry(cropByKey(p.cropKey)!)));
});
