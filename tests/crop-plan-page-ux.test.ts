import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { cropByKey } from '@/lib/crop-catalog';
import {
  bedOverlapFraction,
  bedOverlapWarning,
  benchmarkAreaConflictBedLabels,
  benchmarkAreaConflictDetails,
  occupiedMonthsForPlanting,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { IDEAL_PLAN_COPY } from '@/lib/crop-plan-ideal';
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
  assert.deepEqual(whole.clashes.map((clash) => clash.cropName), whole.cropNames);
  assert.ok(
    whole.clashes.every((clash) => clash.months.length > 0),
    'the farmer is told WHICH months clash, not just a percentage',
  );

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

test('a record whose crop months cannot be derived is not turned into an overlap warning', () => {
  // Same rule bedOverlapFraction has held since the legacy-record work: the app
  // cannot prove that ground is busy, so it must not claim a percentage for it.
  // Kale carried this fixture until 2026-08-23 (timing now verified); with no
  // timing-unverified crop left in the catalog, the underivable-months branch
  // is reached through a record whose crop cannot be resolved at all.
  const legacyOnly: Planting[] = [{ id: 'legacy-row', bedId: 'bed-1', cropKey: 'retired-crop', sowMonth: 4 }];
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

test('a crop that shares no month with anything is NOT listed under the same-ground headline', () => {
  // The first cut of this list returned every planting on a flagged bed. The
  // sentence above it tells the farmer these crops are on the same ground at
  // the same time, so a crop growing alone in its own season was accused of a
  // clash it is not part of — and handed an "Open ›" button to "fix" it.
  const plantings: Planting[] = [
    { id: 'carrots', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 },
    { id: 'beetroot', bedId: 'bed-1', cropKey: 'beetroot', sowMonth: 3, areaFraction: 1 },
    // Aug-Oct: shares no month with the Mar-Jul pair above it.
    { id: 'beans', bedId: 'bed-1', cropKey: 'green-beans', sowMonth: 8, areaFraction: 1 },
  ];
  assert.deepEqual(
    benchmarkAreaConflictBedLabels(plantings, BEDS, 1),
    ['Bed 1'],
    'the fixture must actually be a conflict, or this test proves nothing',
  );
  const [bed] = benchmarkAreaConflictDetails(plantings, BEDS, 1);
  assert.deepEqual(
    bed.plantings.map((row) => row.plantingId).sort(),
    ['beetroot', 'carrots'],
    'only the two crops standing on the same months belong under a same-ground headline',
  );
  assert.ok(bed.plantings.every((row) => row.reason === 'overlap'));
});

test('a bed flagged for an unusable share names that crop, and says that is the reason', () => {
  // benchmarkAreaConflictBedLabels flags a bed for a SINGLE planting whose
  // share is not a usable fraction. Nothing overlaps; the row must not be
  // dressed as an overlap, and the screen reads its reason to write the line.
  const plantings: Planting[] = [
    { id: 'over', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1.5 },
  ];
  assert.deepEqual(benchmarkAreaConflictBedLabels(plantings, BEDS, 1), ['Bed 1']);
  const [bed] = benchmarkAreaConflictDetails(plantings, BEDS, 1);
  assert.deepEqual(bed.plantings.map((row) => [row.plantingId, row.reason]), [['over', 'invalid-share']]);
});

test('a record whose crop months cannot be derived is never listed with an empty span', () => {
  // A row with no derivable occupied months (an unresolvable crop key — the
  // role timing-unverified kale played until 2026-08-23) used to print as a
  // row with a blank month span under a headline claiming a same-time
  // collision.
  const plantings: Planting[] = [
    { id: 'legacy', bedId: 'bed-1', cropKey: 'retired-crop', sowMonth: 3, areaFraction: 1 },
    { id: 'carrots', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 },
    { id: 'beetroot', bedId: 'bed-1', cropKey: 'beetroot', sowMonth: 3, areaFraction: 1 },
  ];
  const [bed] = benchmarkAreaConflictDetails(plantings, BEDS, 1);
  assert.deepEqual(bed.plantings.map((row) => row.plantingId).sort(), ['beetroot', 'carrots']);
  assert.ok(
    bed.plantings.every((row) => row.months.length > 0),
    'an overlap row with no months is a row the app cannot justify printing',
  );
});

test('two beds sharing a label: only the overbooked one is listed', () => {
  // Bed labels are farmer-typed and need not be unique. Selecting the detail
  // beds by label listed an innocent bed's crops under the red headline.
  const twins: PlanBed[] = [
    { id: 'bed-1', label: 'Bed 1', areaM2: 10 },
    { id: 'bed-2', label: 'Bed 1', areaM2: 10 },
  ];
  const plantings: Planting[] = [
    { id: 'a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 },
    { id: 'b', bedId: 'bed-1', cropKey: 'beetroot', sowMonth: 3, areaFraction: 1 },
    { id: 'innocent', bedId: 'bed-2', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 },
  ];
  const details = benchmarkAreaConflictDetails(plantings, twins, 1);
  assert.deepEqual(details.map((bed) => bed.bedId), ['bed-1']);
  assert.deepEqual(details[0].plantings.map((row) => row.plantingId).sort(), ['a', 'b']);
});

test('the overlap warning names each crop\'s OWN clashing months, never a pooled span', () => {
  // A union across crops reads as one span and can be wider than any real
  // clash: dry beans meet the new crop from Dec, cabbage only from Jan, and
  // "Cabbage and Dry beans in Dec–Feb" is a sentence the farmer cannot check
  // against the chart above it.
  const plantings: Planting[] = [
    { id: 'first', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
    { id: 'second', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 12, areaFraction: 0.25 },
  ];
  const warning = bedOverlapWarning('bed-1', 12, 2, 1, plantings);
  assert.ok(warning);
  const byCrop = new Map(warning.clashes.map((clash) => [clash.cropName, clash.months]));
  assert.deepEqual(byCrop.get('Cabbage'), [1, 2], 'cabbage does not meet this planting in December');
  assert.deepEqual(byCrop.get('Dry beans (sugar beans)'), [12, 1, 2]);
  // Structural, not fixture-bound: no crop may be shown a month it does not
  // actually hold at the same time as the new planting.
  for (const { cropName, months } of warning.clashes) {
    const owners = plantings.filter((planting) => cropByKey(planting.cropKey)?.name === cropName);
    const held = new Set(owners.flatMap((planting) => occupiedMonthsForPlanting(planting)));
    assert.ok(months.every((month) => held.has(month)), `${cropName} is shown a month it does not hold`);
  }
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

test('a site with no dry season gets no "three driest months" finding', () => {
  // "Its three driest months" reads as a finding about the site. On a flat
  // record the three named would be an artefact of the month tie-break, so the
  // page must print nothing rather than an arbitrary trio dressed as a finding.
  assert.deepEqual(driestMonths(Array<number>(12).fill(90), 3), [], 'twelve equal months are not a dry season');
  assert.deepEqual(driestMonths(Array<number>(12).fill(0), 3), [], 'an all-zero record is not a finding either');
  assert.deepEqual(
    driestMonths([90, 90.2, 90.4, 90.1, 90.3, 90.5, 90.6, 90.1, 90.2, 90.3, 90.4, 90.5], 3),
    [],
    'a sub-millimetre spread across the whole year is flat',
  );
  // A real dry season still reads normally.
  assert.equal(driestMonths([120, 110, 90, 40, 20, 8, 6, 14, 35, 80, 130, 140], 3).length, 3);
});

// ── The page wiring ─────────────────────────────────────────────────────────

test('the overlap warning is rendered outside the fraction-picker branch', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /bedOverlapWarning\(/, 'the page must compute a warning, not just a bare percentage');

  // The old bug in one line: the warning JSX lived between the fraction presets
  // and the closing fragment of the `allowBedSharing || fraction < 1` branch.
  const branchAt = page.indexOf('allowBedSharing || fraction < 1');
  const warnAt = page.indexOf('is already carrying');
  const elseAt = page.indexOf('Split this bed (intercrop or stagger a succession)?');
  assert.ok(branchAt > 0 && warnAt > 0 && elseAt > 0);
  assert.ok(
    warnAt > elseAt,
    'the overlap warning is back inside the fraction branch — the default whole-bed add sees nothing again',
  );
});

test('the overlap warning leads with words and keeps the percentage secondary', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const at = page.indexOf('is already carrying');
  const sentence = page.slice(at, at + 900);
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
  const block = page.slice(at, at + 3800);
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
  const cardAt = page.indexOf('function DisclosureCard(');
  assert.ok(cardAt > 0, 'the shared collapsed-by-default card is gone');
  // Anchored to DisclosureCard's own body, not a proximity match that any
  // other `useState(false)` on this 3,000-line page could satisfy.
  const cardBody = page.slice(cardAt, page.indexOf('\n}\n', cardAt));
  assert.match(cardBody, /const \[open, setOpen\] = useState\(false\)/, 'DisclosureCard must start closed');
  assert.match(cardBody, /aria-expanded=\{open\}/, 'the collapse must be announced to a screen reader');
  assert.match(cardBody, /\{open && </, 'the body must actually be gated on open');
  // The honesty CLAIM stays on screen even while the method is collapsed.
  const proveAt = page.indexOf('🔎 What the planner can prove');
  assert.match(
    page.slice(proveAt, proveAt + 700),
    /summary="Every yield figure and date here is either from a published source or labelled as an estimate/,
    'the always-visible summary must carry the honesty claim itself, not just name the topic',
  );

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
  // Anchored to the card itself rather than grepping the whole file.
  const at = page.indexOf('🌱 Seeds &amp; seedlings');
  assert.ok(at > 0, 'the buying card is gone; rewrite this test rather than deleting it');
  const card = page.slice(at, at + 4000);
  assert.doesNotMatch(card, /seedBoqForPlan/, 'the aggregate BOQ must not still feed the card');
  assert.match(card, /buyingSchedule\.slice\(0, VISIBLE_BUYING_MONTHS\)/, 'months past the near horizon collapse behind a disclosure');
  // The caveat footnote stays: it is what keeps the quantities honest.
  assert.match(card, /they are not guaranteed buy quantities/);

  // Two sentences that have to hold for every plan that reaches them.
  // buildBuyingSchedule drops empty months, so the first block is frequently
  // NOT the current month; and its window is a ROLLING twelve months from now,
  // which crosses the year seam for any plan opened after about March.
  assert.doesNotMatch(card, /starting with this month/, 'the first block is often a later month');
  assert.doesNotMatch(card, />Later in the year \(/, 'a rolling 12-month window is not "this year"');
  assert.match(card, /Later in the next 12 months \(/);
});

test('a staple plot is never called a bed by the overlap warning', () => {
  // The warning was hoisted out of the fraction branch, which is the `isPlot ?`
  // else-arm — so it newly reached staple plots and called the plot a "bed"
  // three times, four lines under the modal's own "there are no half-shares
  // here" plot copy. "+ crop" is unconditional on every row, so two whole-plot
  // crops in the same months is reachable and worth warning about; it just has
  // to be worded for a plot.
  const page = source('../app/facilitator/crops/page.tsx');
  const at = page.indexOf('is already carrying');
  assert.ok(at > 0);
  const sentence = page.slice(at - 400, at + 900);
  assert.match(sentence, /isPlot \? 'plot' : 'bed'/, 'the warning must name a plot a plot');
  // The bed-share arithmetic is meaningless on a plot that has no half-shares.
  assert.match(sentence, /isPlot \? null : \(/, 'the % of the bed line must be suppressed on a plot');
  assert.match(sentence, /a staple plot grows one field crop at a time/);

  // And the note under it must not point at a space check that did not render.
  const noteAt = page.indexOf('has a legacy crop whose finish timing is not verified');
  assert.ok(noteAt > 0);
  const note = page.slice(noteAt - 300, noteAt + 700);
  assert.match(note, /overlapWarning\s*\n?\s*\?/, 'the "space check above" reference must be conditional on it rendering');
});

// ── The whole-year plan wiring (2026-08-20) ─────────────────────────────────
//
// The feature's engine and copy live in lib/crop-plan-ideal.ts and are truth-
// tested there; these assert the page actually consumes them — the bug class
// where a lib ships and the component quietly keeps its own hardcoded story.

test('the timing question sits between the rhythm question and the climate card, built from lib copy', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const rhythmAt = page.indexOf('How do you want your harvests spread out?');
  const timingAt = page.indexOf('IDEAL_PLAN_COPY.timingHeading');
  const climateAt = page.indexOf('Climate used automatically');
  assert.ok(rhythmAt > 0 && timingAt > 0 && climateAt > 0, 'all three blocks must exist');
  assert.ok(rhythmAt < timingAt && timingAt < climateAt,
    'the timing question renders after the rhythm question and before the climate card');
  // The option labels come from lib, never re-typed here: a hardcoded copy is
  // a sentence the voice lint and the truth gates cannot see.
  assert.match(page, /IDEAL_PLAN_COPY\.fromNowLabel/);
  assert.match(page, /IDEAL_PLAN_COPY\.idealLabel/);
  assert.ok(!page.includes("'Best whole-year plan'") && !page.includes('"Best whole-year plan"'),
    'the ideal label must not be duplicated as a page literal');
  assert.ok(!page.includes("'Start from this month'") && !page.includes('"Start from this month"'),
    'the from-now label must not be duplicated as a page literal');
});

test('the whole-year branch runs from the REAL current month and the busy state guards the sweep', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /suggestIdealYearPlan\(answers, pattern, beds, plantings, currentMonth, new Date\(\)\.getFullYear\(\)\)/,
    'the sweep must receive the device month and year, never synthetic ones — the year dates the one-time starters\' `once` stamps');
  assert.match(page, /generating \? IDEAL_PLAN_COPY\.busyLabel/,
    'the Suggest button must show the busy label while the sweep runs');
  assert.match(page, /blockers\.length === 0 && !generating/,
    'the generating flag must gate the button against a double tap');
});

test('the whole-year review card is gated on ideal metadata and speaks only lib sentences', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /idealMeta && \(\(\) => \{/,
    'the review card renders only in whole-year mode — from-now review stays pixel-identical');
  for (const key of [
    'sameAsTodayLine', 'chosenLine', 'startNowLine', 'rampInLine',
    'residualGapLine', 'transitionGapLine', 'fewBigNote', 'commercialNote',
    'starterLine', 'starterBadge',
  ]) {
    assert.ok(page.includes(`IDEAL_PLAN_COPY.${key}`), `the card must render IDEAL_PLAN_COPY.${key}`);
  }
});

test('choosing whole-year over a non-empty plan surfaces the add-only hint, and reopening resets the mode', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /planTiming === 'idealYear' && hasCurrentPlantings/,
    'the add-only hint shows exactly when the whole-year mode would plan around existing rows');
  assert.match(page, /IDEAL_PLAN_COPY\.fullPlanHint/);
  const openBody = page.slice(page.indexOf('function openAutoSuggest'), page.indexOf('function chooseGoal'));
  // Resets to the DEFAULT, which is now the whole-year plan — the assertion is
  // that reopening clears whatever the last run left, not which mode wins.
  for (const reset of ["setAPlanTiming('idealYear')", 'setIdealMeta(null)', 'setAutoGenerating(false)']) {
    assert.ok(openBody.includes(reset), `openAutoSuggest must reset the whole-year state: ${reset}`);
  }
});

// ── The nursery-gap fix (2026-08-20): three surfaces, one commit ────────────
//
// Fixing tasksForPlan but not the page leaves the task list saying
// "transplant" while the Gantt's 🪴 marker is gone — the same disappearance,
// one surface over. These pin the wiring the lib-level fix depends on.

test('the Gantt transplant marker never drifts out of sync with the task list', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(
    page,
    /crop\.transplant && \(!planting\.existing \|\| planting\.inNursery\)/,
    'BEFORE this fix: crop.transplant && !planting.existing — the 🪴 marker vanished a month before the task did',
  );
});

test('the "already growing" pill and tooltip speak nursery wording for a settled starter still in the nursery', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const pillAt = page.indexOf('Already growing');
  assert.ok(pillAt > 0, 'the already-growing pill is gone; rewrite this test rather than deleting it');
  const pillBlock = page.slice(pillAt - 200, pillAt + 50);
  assert.match(
    pillBlock,
    /planting\.inNursery \? 'Trays sown — not yet planted out' : 'Already growing'/,
    'the pill text must read "Already growing" only when the row is not still in the nursery',
  );

  const tooltipAt = page.indexOf('· already growing');
  assert.ok(tooltipAt > 0);
  const tooltipLine = page.slice(tooltipAt - 200, tooltipAt + 50);
  assert.match(
    tooltipLine,
    /planting\.inNursery \? ' · trays sown, not yet planted out' : planting\.existing \? ' · already growing' : ''/,
    'the Gantt tooltip must not call a nursery cohort "already growing"',
  );
});

// ── The whole-year plan becomes the default (2026-08-21) ────────────────────
//
// It was opt-in behind the timing toggle, defaulting to 'fromNow', so the
// better plan was one most farmers never saw. Making it the default puts a
// TRANSITION year in front of them by default too — and a first year that is
// still filling up reads as a broken plan unless the card says otherwise.
// Measured across 288 test farms: 58% of the months carrying no sowing job had
// no bed even a quarter free, so "nothing to sow" is usually "everything is
// already growing". These pin that the framing ships with the default.

test('the whole-year plan is the default mode, and reopening returns to it', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.match(page, /useState<PlanTiming>\('idealYear'\)/,
    'the plan-timing state must default to the whole-year plan');
  assert.ok(!page.includes("setAPlanTiming('fromNow')"),
    'nothing may reset the mode back to from-now, or reopening would undo the default');
});

test('the review card names both years before it says anything else', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  for (const key of ['twoYearHeading', 'twoYearLine', 'fullBedsLine']) {
    assert.ok(page.includes(`IDEAL_PLAN_COPY.${key}`), `the review card must render ${key}`);
  }
  // Order matters: the farmer reads why the first year is thin BEFORE reading
  // which starting month won, or the thin year is the first thing they judge.
  const twoYear = page.indexOf('IDEAL_PLAN_COPY.twoYearLine');
  const chosen = page.indexOf('IDEAL_PLAN_COPY.chosenLine');
  assert.ok(twoYear > 0 && chosen > twoYear,
    'the two-year framing must come before the chosen-month line');
});

test('the two-year copy promises a second year and never calls the first one complete', () => {
  assert.match(IDEAL_PLAN_COPY.twoYearLine, /two years/i);
  assert.match(IDEAL_PLAN_COPY.twoYearLine, /work towards/i);
  // The honest claim: the FIRST year is thin, not the plan. And the second is
  // described as repeating, which is what the engine actually builds.
  assert.match(IDEAL_PLAN_COPY.twoYearLine, /thin/i);
  assert.match(IDEAL_PLAN_COPY.twoYearLine, /repeating/i);
  // Never a promise that no month is empty — that claim is measurably false.
  assert.doesNotMatch(IDEAL_PLAN_COPY.twoYearLine, /every month|no gaps|never empty/i);
  assert.doesNotMatch(IDEAL_PLAN_COPY.fullBedsLine, /every month|no gaps|never empty/i);
});

test('both years are named on the grid axis, not only in the caption below it', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  assert.ok(page.includes('IDEAL_PLAN_COPY.yearOneBand'), 'year one must be named on the axis');
  assert.ok(page.includes('IDEAL_PLAN_COPY.yearTwoBand'), 'year two must be named on the axis');
  // The band must ride the mirrored-scroll region, not sit outside it, or it
  // stays put while the months pan and ends up labelling the wrong columns.
  const scrollRegion = page.indexOf('ref={monthHeaderScrollRef}');
  const band = page.indexOf('IDEAL_PLAN_COPY.yearOneBand');
  const months = page.indexOf('{MONTHS_SHORT[m - 1]}', scrollRegion);
  assert.ok(scrollRegion > 0 && band > scrollRegion && band < months,
    'the year band belongs inside the scrolled header, above the month labels');
  // Widths come from DISPLAY_MONTHS. A hardcoded second 12 would mislabel the
  // axis the moment the window is widened or narrowed.
  assert.match(page, /flex: DISPLAY_MONTHS - 12/,
    'the year-two band must span the remainder of the window, not a fixed 12');
});

test('the year-band names match how the grid actually repeats', () => {
  // The grid holds ONE annual cycle and redraws it (recurringPlanPlantings),
  // so "every year after" is a description of the data model, not a promise.
  assert.match(IDEAL_PLAN_COPY.yearOneBand, /year one/i);
  assert.match(IDEAL_PLAN_COPY.yearTwoBand, /year two/i);
  assert.match(IDEAL_PLAN_COPY.yearTwoBand, /every year after/i);
  for (const band of [IDEAL_PLAN_COPY.yearOneBand, IDEAL_PLAN_COPY.yearTwoBand]) {
    assert.ok(band.length <= 52, `a band label sits over 12 columns: ${band}`);
  }
});

// ── The Production score comparison bands (2026-08-22) ──────────────────────
//
// Nobody publishes smallholder production value in R/m² — the bands shown
// under "How does this compare to other growers?" are DERIVED (published SA
// yields × typical retail prices). Shipping them without saying so would be
// exactly the invented authority docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md
// bans, so the caveat is pinned to the block: whoever trims the copy has to
// meet this test's reasoning first.
test('the comparison bands never ship without their derivation caveat', () => {
  const page = source('../app/facilitator/crops/page.tsx');
  const bands = page.indexOf('How does this compare to other growers?');
  assert.ok(bands > 0, 'the comparison block must exist');
  const caveat = page.indexOf('not a published statistic', bands);
  assert.ok(caveat > bands, 'the bands must state they are derived, not published');
  assert.match(page.slice(bands, bands + 4000), /not targets/i,
    'orientation bands must disclaim being targets or promises');
  // Rory's ask was specifically about irrigation as the driver; the
  // pulls-it-down list must lead with water, because in SA dryland context it
  // IS the biggest lever — burying it under softer causes would misrank them.
  const pullsDown = page.indexOf('What pulls the figure down', bands);
  assert.ok(pullsDown > bands, 'the value-drivers list must exist alongside the bands');
  const water = page.indexOf('Water that fails in the dry months', pullsDown);
  const nextDriver = page.indexOf('Ground standing bare', pullsDown);
  assert.ok(water > pullsDown && water < nextDriver, 'water must be the FIRST driver named');
});
