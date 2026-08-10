import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COMPOSED_SHEET_ASPECT_MARGIN,
  SHEET_CHROME_ELEMENTS,
  modelInputCarriesChrome,
  paidPolishNeedsChromePass,
} from '@/lib/sheet-chrome-pass';
import { AI_INPUT_WIDTH } from '@/lib/sheet-scale';
import { calculateStyleSheetSize } from '@/lib/reference-presentation';
import { fullTreatmentProtectPolicy } from '@/lib/locked-polish-flow';

// CHROME IS DRAWN AFTER THE AI PASS, ALWAYS.
//
// The sheet that forced this: "Planting · Photo Plan · AI polished · Geometry locked", a paid Full
// Treatment render, delivered with NO plant labels, NO legend panel, no title block, no north
// arrow and no scale bar — and the property boundary sitting on it as a hard vector line stamped
// over ground the model had completely repainted.
//
// Two failures, one picture. The second paid pass was handed the ALREADY-COMPOSED sheet, and an
// image model cannot reproduce 9px type, so it erased every label and repainted the legend. And
// the app's own re-draw of that chrome was conditional on a comparison — uploaded input SIZE
// against map size — that the upload pipeline guarantees will fail: capForAiInput uniformly
// downscales every AI-bound bitmap to AI_INPUT_WIDTH.
//
// Both halves are asserted here: the model never receives chrome, and the app always draws it.

const DESIGN_GLOSSY_SOURCE = readFileSync(
  new URL('../components/design/DesignGlossy.tsx', import.meta.url),
  'utf8',
);

/** Body of a `const <name> = useCallback(...)` up to the closing `}, [deps]);` at that indent. */
function callbackBody(name: string): string {
  const start = DESIGN_GLOSSY_SOURCE.indexOf(`const ${name} = useCallback(`);
  assert.notEqual(start, -1, `${name} not found — this test needs updating, not deleting`);
  const end = DESIGN_GLOSSY_SOURCE.indexOf('\n  }, [', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return DESIGN_GLOSSY_SOURCE.slice(start, end);
}

function functionBody(signature: string, endMarker: string): string {
  const start = DESIGN_GLOSSY_SOURCE.indexOf(signature);
  assert.notEqual(start, -1, `${signature} not found — this test needs updating, not deleting`);
  const end = DESIGN_GLOSSY_SOURCE.indexOf(endMarker, start);
  assert.ok(end > start, `could not find the end of ${signature}`);
  return DESIGN_GLOSSY_SOURCE.slice(start, end);
}

// ── The regression itself ────────────────────────────────────────────────────────────────────

test('a downscaled map upload is never mistaken for a composed page', () => {
  // THE EXACT SHIPPED FAILURE. A High-quality sheet draws its map at frame.imgW (960) x SCALE 3 =
  // 2880px, and the upload is capped to AI_INPUT_WIDTH (1920). The old guard compared those two
  // numbers, found 960px of disagreement, concluded "legacy composed-page input", and skipped the
  // chrome pass on every single paid polish. The ratio is untouched by the cap, which is why the
  // decision is made on the ratio.
  const mapW = 2880;
  const mapH = 1400;
  const uploadedW = AI_INPUT_WIDTH;
  const uploadedH = Math.round(mapH * (AI_INPUT_WIDTH / mapW));

  assert.notEqual(uploadedW, mapW, 'this test is meaningless if the upload is not downscaled');
  assert.equal(modelInputCarriesChrome(uploadedW, uploadedH, mapW, mapH), false);
});

test('a real composed page IS recognised, at every map shape the sheet builder produces', () => {
  // A composed sheet is [gutter][map][gutter][legend]; the legend alone is 30% of the
  // gutter-inclusive canvas with a 360px floor. Ask the real size calculator rather than assuming.
  for (const [mapW, mapH] of [[2880, 1400], [1920, 1920], [1200, 2400], [600, 500]] as const) {
    const sheet = calculateStyleSheetSize(mapW, mapH);
    assert.equal(
      modelInputCarriesChrome(sheet.W, sheet.H, mapW, mapH),
      true,
      `a composed ${mapW}x${mapH} sheet must be recognised as carrying chrome`,
    );
    // And downscaling that page for upload must not change the answer either.
    const scale = AI_INPUT_WIDTH / sheet.W;
    if (scale < 1) {
      assert.equal(
        modelInputCarriesChrome(AI_INPUT_WIDTH, Math.round(sheet.H * scale), mapW, mapH),
        true,
        'the page verdict must survive the upload cap too',
      );
    }
  }
});

test('the aspect margin sits clear of both cases it separates', () => {
  // Map-only measures 1.00x the map aspect; the narrowest composed page the size calculator can
  // produce is well above the margin. If a layout change ever closes that gap, this fails here
  // rather than on a farmer's paid sheet.
  const narrowest = Math.min(
    ...[[2880, 1400], [1920, 1920], [1200, 2400], [600, 500]].map(([mapW, mapH]) => {
      const sheet = calculateStyleSheetSize(mapW, mapH);
      return (sheet.W / sheet.H) / (mapW / mapH);
    }),
  );
  assert.ok(COMPOSED_SHEET_ASPECT_MARGIN > 1, 'map-only artwork must fall below the margin');
  assert.ok(
    narrowest > COMPOSED_SHEET_ASPECT_MARGIN,
    `the narrowest composed sheet (${narrowest.toFixed(3)}x) must stay above the margin`,
  );
});

test('an unmeasurable input assumes the current map-only contract', () => {
  const cases: Array<[number, number, number, number]> = [
    [0, 0, 100, 100],
    [Number.NaN, 10, 100, 100],
    [10, 10, 0, 100],
  ];
  for (const [a, b, c, d] of cases) {
    assert.equal(modelInputCarriesChrome(a, b, c, d), false);
  }
});

// ── Who runs the chrome pass ─────────────────────────────────────────────────────────────────

test('the chrome pass is decided by the committed stage, not by what happens to be fetchable', () => {
  assert.equal(
    paidPolishNeedsChromePass({ resultKind: 'ai-polished', geometryLock: false, modelChromeStyle: false }),
    true,
    'a paid polish always gets the app chrome drawn back over it',
  );
  // A missing protect mask, a failed input fetch and a mismatched image size were each, at some
  // point, enough to skip the chrome pass. None of them is an input to this decision any more —
  // there is nowhere left to put them.
  assert.equal(
    paidPolishNeedsChromePass({ resultKind: 'hybrid', geometryLock: true, modelChromeStyle: false }),
    false,
    'the Hybrid tier composes its chrome further along its own path',
  );
  assert.equal(
    paidPolishNeedsChromePass({ resultKind: 'ai-polished', geometryLock: false, modelChromeStyle: true }),
    false,
    'Satellite Overlay is commissioned to draw its own legend — recomposing would nest a sheet in a sheet',
  );
  assert.equal(
    paidPolishNeedsChromePass({ resultKind: undefined, geometryLock: false, modelChromeStyle: false }),
    false,
    'an unstaged legacy job is not a paid polish',
  );
});

// ── The output always carries the app's legend rows and label chips ──────────────────────────

test('the chrome pass draws every app-owned element over the model art', () => {
  const pass = functionBody(
    'async function composeSheetChromeOverMapArt(',
    '\n  return { sheet, mapArt };',
  );

  // Boundary stroke — drawn here, in the same pass as everything else, rather than byte-restored
  // alone onto repainted ground.
  assert.match(pass, /drawBlueprintBoundary\(ctx, refLayers\.boundary/);
  // Plant labels, leaders and the gutter layout: burnExactLabelLayer is the exact sheet's own
  // label block (drawGroundAreaNames + drawPlantMarks + sheetGutterLayout), so a paid sheet's
  // names are the exact sheet's names.
  assert.match(pass, /await burnExactLabelLayer\(mapArt, state, frame, refLayers, filter, W, H, labelMode\)/);
  // Legend panel, title block, north arrow, scale bar — and the gutter callouts the label planner
  // just laid out.
  assert.match(pass, /await composeStyleSheet\(\s*labelled\.map,/);
  assert.match(pass, /gutterLayout: labelled\.gutterLayout/);
  assert.match(pass, /labelMode,/);

  // The legend rows are DERIVED, never carried over from the model's picture: composeStyleSheet
  // falls back to sheetLegendRows for any caller that does not supply its own, and this caller
  // deliberately does not.
  assert.doesNotMatch(pass, /legendRows:/);
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /\.\.\.\(options\.legendRows \?\? sheetLegendRows\(state, refLayers, filter/,
    'composeStyleSheet must still derive legend rows from the saved design when none are supplied',
  );

  // Every element named in the contract has an owner in this pipeline.
  assert.deepEqual([...SHEET_CHROME_ELEMENTS], [
    'boundary-stroke',
    'plant-labels',
    'label-gutters',
    'legend-panel',
    'title-block',
    'north-arrow',
    'scale-bar',
  ]);
});

test('nothing can stop the chrome pass running on a paid polish', () => {
  const finisher = callbackBody('finishStyledSheet');
  const branchStart = finisher.indexOf('if (paidPolishNeedsChromePass({');
  assert.ok(branchStart > 0, 'the polish branch must be gated on the committed stage alone');
  const branch = finisher.slice(branchStart, finisher.indexOf('\n      // The model input and every exact overlay'));

  // The three old guards, each of which shipped a chrome-less paid sheet when it fired.
  assert.doesNotMatch(branch, /Math\.abs\(src\.width/, 'a size comparison must never gate the chrome pass');
  assert.doesNotMatch(branch, /restoreProtectedPixels\(/, 'the polish tier restores nothing');
  assert.doesNotMatch(
    branch,
    /if \(showcase && !locked && protectMask && sourceImage\)/,
    'a missing mask or a failed input fetch must not decide whether a sheet gets its legend',
  );

  // Both exits from the branch compose chrome. The catch path is the one that used to return the
  // bare source map, which is a map with no legend and no labels on it.
  const exits = branch.match(/return\s+\w+\.sheet;/g) ?? [];
  assert.equal(exits.length, 2, 'every exit from the polish branch must return a composed sheet');
  assert.match(branch, /catch \(err\)[\s\S]*composeSheetChromeOverMapArt\(/);

  // And the raw "ship what the model returned" exit is now closed to the polish stage.
  assert.match(
    finisher,
    /if \(showcase && !locked && !polishStage\) return restoredImage;/,
    'only the model-authored showcase tier may ship a model page without app chrome',
  );
});

test('the paid-difference gate scores map against map, so the chrome cannot flatter it', () => {
  // The chrome pass publishes the model art it composed around. Scoring the composed PAGE against
  // the map the model was given would count this app's own gutters, legend and title as the
  // model's work — a verbatim copy would then pass as "redrawn", and the gate would certify the
  // exact failure it exists to catch.
  assert.match(DESIGN_GLOSSY_SOURCE, /polishedMapRef\.current = composed\.mapArt;/);
  assert.match(DESIGN_GLOSSY_SOURCE, /polishedMapRef\.current = fallback\.mapArt;/);
  assert.match(DESIGN_GLOSSY_SOURCE, /if \(isPolishedResult\) polishedMapRef\.current = factualModelImage;/);
  assert.match(DESIGN_GLOSSY_SOURCE, /const polishedArtifact = polishedMapRef\.current \?\? finalSheet;/);
});

test('the polish protect mask still marks only the app-owned boundary corridor', () => {
  // Nothing is byte-restored on this tier any more; the boundary is redrawn as chrome instead. The
  // mask stays because the difference gate needs to know which pixels the farmer sees the app's
  // version of — and it must not grow, because every protected pixel is a pixel the model is no
  // longer asked to have changed.
  const policy = fullTreatmentProtectPolicy();
  assert.equal(policy.protectBoundary, true);
  for (const key of ['protectOutside', 'protectDriveway', 'protectHouse', 'protectLines', 'protectItems', 'protectUnmarkedGround'] as const) {
    assert.equal(policy[key], false, `${key} must stay editable — protecting it would weaken the gate`);
  }
});

// ── The model input excludes chrome, on every paid path ──────────────────────────────────────

test('the design-layer polish uploads the Hybrid MAP, never the Hybrid page', () => {
  const flow = callbackBody('generateOneViaQueue');
  assert.match(
    flow,
    /const polishSource = fullSheetPolish \? hybridMapForPolishRef\.current : null;/,
    'the polish input is the stashed map, keyed by filter',
  );
  assert.match(flow, /const exactSheetInput = fullSheetPolish && polishSource \? polishSource\.map : null;/);
  // hybridResultRef holds the composed PAGE. It may be consumed (so a stale sheet cannot leak into
  // a later render) but it must never become an upload.
  assert.doesNotMatch(
    flow,
    /compositeDataUrl: hybridResultRef/,
    'the composed page must never be uploaded to the model',
  );
  // And the stash is filled from the pre-label map, not from a finished sheet.
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /if \(locked\) hybridMapForPolishRef\.current = \{ key: f, map: final \};/,
  );
});

test('Sector and Existing Site upload the map column, at both paid stages', () => {
  const flow = callbackBody('generateSectorViaQueue');
  assert.match(
    flow,
    /const hybridMapInput = hybridInput\s*\n\s*\? await cropStyleSheetToMap\(hybridInput, mapWidth, mapHeight\)/,
    'the finished Hybrid page must be cut back to its map column before it is sent anywhere',
  );
  assert.match(flow, /compositeDataUrl: composite,/);
  assert.doesNotMatch(
    flow,
    /const composite = hybridInput\s*$/m,
    'the raw composed page must not become the composite',
  );
});

test('Phasing uploads the map column, and the schedule panel is not in the image at all', () => {
  const flow = callbackBody('generatePhasingViaQueue');
  assert.match(flow, /const compositeDataUrl = await cropSheetRegion\(/);
  assert.match(flow, /phasingMapColumn/, 'the crop must be the map column, by name');
  // Defence in depth: the panel is blanked as well as cropped away, so two independent steps have
  // to be wrong before a real date reaches a model.
  assert.match(flow, /blankPhasingPanel\(/);
  // A sheet-shaped mask over a map-shaped input would have frozen the right-hand quarter of the
  // MAP and hidden it from the difference gate.
  assert.match(flow, /const protectMaskDataUrl: string \| undefined = undefined;/);
  assert.doesNotMatch(DESIGN_GLOSSY_SOURCE, /function buildPhasingProtectMask\(/);
});

test('no paid path can rebuild a page-shaped protect mask', () => {
  // extendProtectMaskToStyleSheet existed only to widen a map mask onto a composed page. There is
  // no composed page in any paid pipeline any more, and its geometry (map at x=0, no gutters) was
  // one gutter out from every sheet composeStyleSheet has ever produced.
  assert.doesNotMatch(DESIGN_GLOSSY_SOURCE, /async function extendProtectMaskToStyleSheet\(/);
  assert.doesNotMatch(DESIGN_GLOSSY_SOURCE, /extendProtectMaskToStyleSheet\(/);
});

test('a change to what a paid sheet looks like bumps the recipe token', () => {
  // The last-render display effect re-serves whatever localStorage holds for this key on mount, so
  // without a bump the farmer (and Rory, checking the fix) sees the PRE-fix picture — the chrome-
  // less Full Treatment this whole change exists to stop re-serving — without rendering anything.
  assert.match(DESIGN_GLOSSY_SOURCE, /\+ ':r3'/, 'the r-token must move when the sheet changes');
  assert.doesNotMatch(DESIGN_GLOSSY_SOURCE, /\+ ':r[12]'/);
  // PLAN_VERSION must NOT move with it: bumping that re-keys the gallery and takes paid renders
  // away from farmers who already have them.
  assert.match(
    DESIGN_GLOSSY_SOURCE,
    /PLAN_VERSION stays untouched/,
    'the r-token contract must keep saying why it is not a PLAN_VERSION bump',
  );
});
