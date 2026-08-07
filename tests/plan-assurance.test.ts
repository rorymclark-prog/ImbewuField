// What we promise the farmer about how far to trust a generated plan, pinned.
//
// This text is the only thing standing between "REVISE — AGRONOMIC APPROVAL
// WITHHELD" and a farmer spending money on a document nobody qualified has
// read. It is also the kind of copy that gets quietly softened in a hurry, or
// dropped when a layout is rewritten, so each promise below is asserted rather
// than trusted.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ASSURANCE_TITLE, ASSURANCE_PARAGRAPHS, ASSURANCE_ONE_LINE,
  SOIL_CAUTION, SOIL_TEST_INVITE,
} from '@/lib/plan-assurance';
import { pdfSafe } from '@/lib/crop-export-pdf';

const CROP_PLAN_SCREEN = readFileSync(
  new URL('../app/facilitator/crops/page.tsx', import.meta.url),
  'utf8',
);

test('the plan says plainly that no agronomist has checked it', () => {
  const all = ASSURANCE_PARAGRAPHS.join(' ').toLowerCase();
  assert.match(all, /agronomist/, 'the word agronomist never appears — the central caveat is missing');
  assert.match(
    `${all} ${ASSURANCE_ONE_LINE.toLowerCase()}`,
    /no agronomist has checked|not checked by an agronomist/,
    'nowhere does it state the plan is unchecked — a hedge is not a disclosure',
  );
});

test('every caution names something the farmer can actually do', () => {
  const all = ASSURANCE_PARAGRAPHS.join(' ').toLowerCase();
  // The two actions that convert a disclaimer into advice. An extension officer
  // is free and in nearly every SA farming district; an agronomist is neither,
  // which is why "consult a professional" on its own reads as "you're on your
  // own" to the smallholder this app is for.
  assert.match(all, /extension officer/, 'never points at the extension officer — the one expert a smallholder can actually reach');
  assert.match(all, /soil test/, 'never tells the farmer a soil test is how to know their own soil');
  assert.match(all, /record|write down/, 'never asks the farmer to record actuals, which is how the next plan improves');
});

test('the assurance is not so frightening that nobody would act on it', () => {
  // A plan nobody dares use has failed differently. There must be a reason to
  // proceed, not only reasons to doubt.
  const all = ASSURANCE_PARAGRAPHS.join(' ').toLowerCase();
  assert.match(all, /starting point|good faith|carefully/, 'gives no reason to trust it at all');
  assert.ok(ASSURANCE_PARAGRAPHS.length >= 4, 'too short to carry both the caution and the reason to proceed');
  for (const p of ASSURANCE_PARAGRAPHS) {
    assert.ok(p.trim().length > 40, `a one-clause paragraph is a hedge, not a disclosure: "${p}"`);
  }
});

test('the assurance survives the PDF character filter intact', () => {
  // jsPDF's built-in fonts are WinAnsi: anything above U+00FF is DROPPED, not
  // substituted. A curly quote or an em dash in this copy would silently lose
  // characters from the one paragraph that must read cleanly.
  for (const p of [...ASSURANCE_PARAGRAPHS, ASSURANCE_ONE_LINE, ASSURANCE_TITLE]) {
    const safe = pdfSafe(p);
    assert.ok(safe.length > 0, 'a line vanished entirely under pdfSafe');
    // Allow the documented transliterations (em dash -> hyphen etc.) but catch
    // a wholesale loss, which is what an emoji or a non-Latin glyph would cause.
    assert.ok(
      safe.length >= p.length - 12,
      `pdfSafe dropped ${p.length - safe.length} characters from: "${p.slice(0, 60)}..."`,
    );
  }
});

test('the soil caution is harshest exactly where the data is weakest', () => {
  // Ranked: a lab result is the only one that measured this ground; 'estimate'
  // means no soil data existed for the point at all and is the same seven
  // numbers anywhere on Earth. The warning must scale with that, and the
  // strongest wording must sit on 'estimate' — the case that spent months
  // masquerading as a real reading.
  assert.match(SOIL_CAUTION.estimate, /NOT A READING/, 'the fallback case must say outright that it is not a reading');
  assert.match(SOIL_CAUTION.estimate.toLowerCase(), /do not spend money/, 'the fallback must warn against spending on it');
  assert.match(SOIL_CAUTION.soilgrids.toLowerCase(), /wider than your field|district/, 'the model case must say it reads a wide area');

  // And the lab case must NOT nag. Telling a farmer who has just uploaded a
  // soil test to go and get a soil test would read as ignoring them.
  assert.doesNotMatch(
    SOIL_CAUTION.lab.toLowerCase(),
    /a soil test is the only way to know/,
    'do not tell a farmer to get a soil test when they have already given us one',
  );
  assert.match(SOIL_CAUTION.lab.toLowerCase(), /overrides|most reliable/, 'the lab case must say it outranks the model');
});

test('the soil-test invite explains what uploading actually changes', () => {
  // "Upload a soil test" with no stated consequence is a chore. The reason to
  // do it is that the numbers get rebuilt from their ground.
  assert.match(SOIL_TEST_INVITE.toLowerCase(), /upload/, 'no call to action');
  assert.match(
    SOIL_TEST_INVITE.toLowerCase(),
    /rebuilt|instead of a global model|your real numbers/,
    'never says what changes if they do it',
  );
});

test('removing a crop cannot silently recommend an unchosen replacement', () => {
  assert.doesNotMatch(
    CROP_PLAN_SCREEN,
    /suggestSubstituteCrop|Replace with .* instead|onReplace|substitute=/,
    'the saved plan does not retain the farmer whitelist, so it cannot choose a safe substitute',
  );
  assert.match(
    CROP_PLAN_SCREEN,
    /To choose another crop yourself, cancel and use Edit\./,
    'the screen must point back to the manual crop picker instead of inventing a replacement',
  );
});

test('auto-suggest derives climate from the mapped site instead of asking the farmer to guess', () => {
  // Rory's field test caught the broken assumption: farmers may not know
  // whether a label such as "summer rain · light frost" describes them, while
  // the app already has their mapped location and rainfall-region data.
  assert.match(
    CROP_PLAN_SCREEN,
    /const pattern:\s*RainPattern\s*=\s*mapPattern/,
    'the mapped climate must be the planning authority',
  );
  assert.match(
    CROP_PLAN_SCREEN,
    /rainPattern:\s*pattern/,
    'accepting suggestions must save the automatically derived climate with the plan',
  );
  assert.doesNotMatch(
    CROP_PLAN_SCREEN,
    /Confirm this garden's climate|onPattern\(|CLIMATE_OPTIONS/,
    'the farmer is still being asked to classify rainfall or frost themselves',
  );
  assert.match(
    CROP_PLAN_SCREEN,
    /Climate used automatically/,
    'the hidden decision must still be visible and explainable',
  );
});

test('auto-suggest exposes the requested standard bed sections instead of forcing whole beds', () => {
  assert.match(
    CROP_PLAN_SCREEN,
    /aAllowMixedCropsInBed[^\n]*useState\(true\)/,
    'section packing is not default-on despite the farmer asking for full, half, third and quarter beds',
  );
  assert.match(CROP_PLAN_SCREEN, /Divide beds into crop sections/);
  assert.match(CROP_PLAN_SCREEN, /allowMixedCropsInBed:\s*aAllowMixedCropsInBed/);
});

test('the on-screen task list keeps next-year work in its real cohort', () => {
  assert.match(
    CROP_PLAN_SCREEN,
    /taskMonthsFromNow\(task, currentMonth\) === i/,
    'looking ahead must group by real distance from today, not month name alone',
  );
  assert.doesNotMatch(
    CROP_PLAN_SCREEN,
    /allTasks\.filter\(\(task\) => task\.month === m\)/,
    'month-only grouping aliases next-year tasks into this year',
  );
});
