import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  bedOverlapFraction,
  bedOverlapWarning,
  benchmarkAreaConflictBedLabels,
  benchmarkAreaConflictDetails,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { driestMonths } from '@/lib/site-climate';

// THE PLAN PAGE'S UX HONESTY GAPS (audit, 19 Aug 2026).
//
// Four of them were the same shape: the app knew something the farmer needed
// and never said it out loud.
//
//  - the bed-overlap check ran only in the branch that draws the fraction
//    picker, so the DEFAULT whole-bed add — the one most farmers take — got no
//    capacity feedback at all, and the collision only surfaced later as a red
//    "Resolve overlapping bed space" that named no crops;
//  - that red state named beds, never the plantings standing on them;
//  - "Suggest a plan" disabled itself with no visible reason;
//  - resolveSiteClimate returned twelve months of the site's own rainfall and
//    the page used exactly one field of it.
//
// The behavioural half of that lives in lib and is tested here directly. The
// wiring half is a page composition, so it is asserted against the source: a
// string test is weaker than a render, but it is strictly stronger than the
// nothing that let the whole-bed branch ship without a warning.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 10 },
  { id: 'bed-2', label: 'Bed 2', areaM2: 10 },
];

// ── The overlap check, for the share the picker actually defaults to ────────

test('a whole-bed planting onto occupied ground raises the same warning a fractional one does', () => {
  const plantings: Planting[] = [
    { id: 'first', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
    { id: 'second', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 12, areaFraction: 0.25 },
  ];

  // The regression: fraction === 1 is the default add, and it used to be the
  // one path with no warning behind it.
  const whole = bedOverlapWarning('bed-1', 12, 2, 1, plantings);
  assert.ok(whole, 'a whole-bed add onto 75% committed ground must warn');
  assert.equal(whole.committedFraction, 0.75);
  assert.equal(whole.totalFraction, 1.75);
  assert.deepEqual(whole.cropNames, ['Cabbage', 'Dry beans (sugar beans)']);
  assert.ok(whole.overlapMonths.length > 0, 'the farmer is told WHICH months clash, not just a percentage');

  // Same computation, same numbers, as the fraction picker's own path.
  const half = bedOverlapWarning('bed-1', 12, 2, 0.5, plantings);
  assert.ok(half, '0.75 + 0.5 is more than the bed');
  assert.equal(half.committedFraction, whole.committedFraction);
  assert.deepEqual(half.cropNames, whole.cropNames);
  // And a share that exactly fills the bed is not an overlap.
  assert.equal(bedOverlapWarning('bed-1', 12, 2, 0.25, plantings), null, '0.75 + 0.25 fits');
});

test('the warning and the numeric fraction cannot disagree about which crops are in the way', () => {
  const plantings: Planting[] = [
    { id: 'first', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
    { id: 'second', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 12, areaFraction: 0.25 },
    { id: 'other-bed', bedId: 'bed-2', cropKey: 'cabbage', sowMonth: 12, areaFraction: 1 },
  ];
  const warning = bedOverlapWarning('bed-1', 12, 2, 1, plantings);
  assert.ok(warning);
  assert.equal(warning.committedFraction, bedOverlapFraction('bed-1', 12, 2, plantings));

  // Excluding the edited planting must move both together.
  const edited = bedOverlapWarning('bed-1', 12, 2, 1, plantings, 'first');
  assert.ok(edited);
  assert.equal(edited.committedFraction, bedOverlapFraction('bed-1', 12, 2, plantings, 'first'));
  assert.deepEqual(edited.cropNames, ['Cabbage']);
});

test('a bed that can carry the planting raises nothing at all', () => {
  const plantings: Planting[] = [
    { id: 'first', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
  ];
  assert.equal(bedOverlapWarning('bed-1', 12, 2, 0.5, plantings), null, 'exactly one bed is not an overlap');
  assert.equal(bedOverlapWarning('bed-1', 9, 10, 1, plantings), null, 'months that do not meet are not an overlap');
  assert.equal(bedOverlapWarning('bed-2', 12, 2, 1, plantings), null, 'another bed is not this bed');
});

test('an unverified-timing legacy crop is not turned into an overlap warning', () => {
  // Same rule bedOverlapFraction has held since the legacy-record work: the app
  // cannot prove that ground is busy, so it must not claim a percentage for it.
  // bedHasUnverifiedTiming is the separate, honest message for that case.
  const legacyOnly: Planting[] = [{ id: 'legacy-kale', bedId: 'bed-1', cropKey: 'kale', sowMonth: 4 }];
  assert.equal(bedOverlapWarning('bed-1', 4, 8, 1, legacyOnly), null);
});

// ── Naming the crops behind the red benchmark state ─────────────────────────

test('the area-conflict detail names the plantings on each bed the labels flag', () => {
  const nowMonth = 1;
  // Two whole-bed crops with overlapping windows on one bed: exactly the state
  // that blanks the kg headline.
  const plantings: Planting[] = [
    { id: 'a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 },
    { id: 'b', bedId: 'bed-1', cropKey: 'beetroot', sowMonth: 3, areaFraction: 1 },
    { id: 'c', bedId: 'bed-2', cropKey: 'beetroot', sowMonth: 3, areaFraction: 1 },
  ];
  const labels = benchmarkAreaConflictBedLabels(plantings, BEDS, nowMonth);
  assert.deepEqual(labels, ['Bed 1'], 'the fixture must actually be a conflict, or this test proves nothing');

  const details = benchmarkAreaConflictDetails(plantings, BEDS, nowMonth);
  assert.deepEqual(details.map((d) => d.bedLabel), labels, 'details and labels must agree on WHICH beds');

  const [bed] = details;
  assert.deepEqual(
    bed.plantings.map((p) => p.plantingId).sort(),
    ['a', 'b'],
    'both crops standing on the bed are named, so the farmer knows what to choose between',
  );
  for (const row of bed.plantings) {
    assert.ok(row.cropName.length > 0 && row.cropName !== row.cropKey, 'a farmer reads crop names, not keys');
    assert.ok(row.months.length > 0, 'each conflicting planting states the months it holds the bed');
    assert.ok(row.months.every((m) => m >= 1 && m <= 12));
  }
});

test('no conflict means no detail list', () => {
  const plantings: Planting[] = [{ id: 'a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 }];
  assert.deepEqual(benchmarkAreaConflictDetails(plantings, BEDS, 1), []);
});

// ── The site's own driest months ────────────────────────────────────────────

test('driest months are the site\'s three lowest, in calendar order, or nothing', () => {
  const rain = [120, 110, 90, 40, 20, 8, 6, 14, 35, 80, 130, 140];
  assert.deepEqual(
    driestMonths(rain, 3),
    [{ month: 6, rainMm: 8 }, { month: 7, rainMm: 6 }, { month: 8, rainMm: 14 }],
    'Jun/Jul/Aug are the driest and must print in calendar order, not sorted by millimetres',
  );
  // Partial or absent data must not be dressed up as a site reading — the same
  // refusal siteClimateFromLocationData makes.
  assert.deepEqual(driestMonths(rain.slice(0, 11), 3), []);
  assert.deepEqual(driestMonths([...rain.slice(0, 11), Number.NaN], 3), []);
});

// ── The page wiring ─────────────────────────────────────────────────────────

test('the overlap warning is rendered outside the fraction-picker branch', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /bedOverlapWarning\(/, 'the page must compute a warning, not just a bare percentage');

  // The old bug in one line: the warning JSX lived between the fraction presets
  // and the closing fragment of the `allowBedSharing || fraction < 1` branch.
  const branchAt = page.indexOf('allowBedSharing || fraction < 1');
  const warnAt = page.indexOf('This bed is already carrying');
  const elseAt = page.indexOf('Split this bed (intercrop or stagger a succession)?');
  assert.ok(branchAt > 0 && warnAt > 0 && elseAt > 0);
  assert.ok(
    warnAt > elseAt,
    'the overlap warning is back inside the fraction branch — the default whole-bed add sees nothing again',
  );
});

test('the overlap warning leads with words and keeps the percentage secondary', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const at = page.indexOf('This bed is already carrying');
  const sentence = page.slice(at, at + 700);
  assert.match(sentence, /compete for the same ground/, 'the farmer is told what happens, not just a total');
  assert.match(sentence, /Still allowed/, 'this stays a warning, never a block');
  // The arithmetic is in brackets, after the plain sentence.
  assert.ok(
    sentence.indexOf('% of the bed') > sentence.indexOf('compete for the same ground'),
    'percentage arithmetic must not lead this message',
  );
});

test('the red benchmark state names the conflicting plantings and can open each one', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  // The JSX itself, not the prose about it in a comment above.
  const at = page.indexOf('>Resolve overlapping bed space<');
  assert.ok(at > 0, 'the red state is gone; rewrite this test rather than deleting it');
  const block = page.slice(at, at + 2600);
  assert.match(block, /areaConflictDetails\.map/, 'the conflicting plantings must be listed, not only the bed labels');
  assert.match(block, /setActivePlanting\(planting\)/, 'each row opens the planting sheet the page already has');
});

test('a disabled "Suggest a plan" says why, without softening the irrigation gate', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const at = page.indexOf('✨ Suggest a plan');
  assert.ok(at > 0);
  const block = page.slice(at - 1800, at + 900);
  assert.match(block, /Turn on “Reliable irrigation for every crop cycle” above/);
  assert.match(block, /Pick at least one crop above/);
  // The default itself is an honesty gate and must stay off: the fix is to say
  // what to tap, never to pre-tick the claim that a farm has water.
  assert.match(page, /aReliableIrrigation, setAReliableIrrigation\] = useState\(false\)/);
});

test('the two long reference cards open on demand, with nothing deleted', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /function DisclosureCard\(/, 'the shared collapsed-by-default card is gone');
  assert.match(page, /useState\(false\);[\s\S]{0,600}aria-expanded=\{open\}/, 'DisclosureCard must start closed');

  for (const title of ['🔎 What the planner can prove', '🔄 Rotate by botanical family']) {
    const at = page.indexOf(title);
    assert.ok(at > 0, `${title} is gone`);
    assert.match(page.slice(at - 200, at + 200), /DisclosureCard/, `${title} is expanded again`);
  }
  // Zero text deleted: the sentences that carry the honesty claims are still there.
  assert.match(page, /Yield points use the conservative end of published commercial KZN benchmarks/);
  assert.match(page, /Food groups describe what a household eats/);
});

test('the on-screen buying card is the dated calendar, not the flat aggregate', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /buildBuyingSchedule\(plantings, beds, currentMonth\)/);
  assert.doesNotMatch(page, /seedBoqForPlan/, 'the aggregate BOQ must not still feed the card');
  assert.match(page, /VISIBLE_BUYING_MONTHS/, 'months past the near horizon collapse behind a disclosure');
  // The caveat footnote stays: it is what keeps the quantities honest.
  assert.match(page, /they are not guaranteed buy quantities/);
});
