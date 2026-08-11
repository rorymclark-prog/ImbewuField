import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import './hybrid-composite-registration.cases.ts';
import { blendProtectedPixels, countProtectedPixelMismatches, maskEditableFraction, precisionAtlasContextPixels, shouldUseModelChrome } from '../lib/image-producer.ts';
import { buildFinishedSheetPolishPrompt, buildLockedBackgroundPrompt, buildLockedIllustrationPrompt, buildSatelliteOverlayPrompt, buildSectorRestylePrompt, buildSectorSheetPolishPrompt, isModelChromeStyle, buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, STYLE_LINES, SHEET_NO } from '../lib/producer-prompt.ts';
import { ELEMENT_CATALOG } from '../lib/design-elements.ts';
import { isDifferentBuild } from '../lib/pwa-update.ts';
import { preserveCanvasNavigation, type DesignCanvasState } from '../lib/design-canvas.ts';
import { exactModelInputMarks, hasConflictingRenderAuthority, lockedProtectMaskOptionsForStyle, polishModelInputMarks, RENDERED_DRIVEWAY_EDGE, renderAuthorityFlagsForStyle, renderPolicyForStyle, styleSupportsGroundSource } from '../lib/render-policy.ts';
import { buildItemMaskFeatherLayers } from '../lib/protect-mask-feather.ts';
import { contextElementNames } from '../lib/overlay-elements.ts';
import { lineInFilter, REFERENCE_SHEET_LABEL } from '../lib/glossy-filters.ts';
import { EARTHWORKS_ROUTE_STYLE, WATER_LEGEND_SECTION_ORDER, pairedWaterDestinationCanopyIds, waterFeaturePresentationDimensions, waterFeaturePresentationScale, waterLegendSectionForFeature, waterLegendSectionForRoute, waterRouteLegendEntries, waterRoutesWithVisualBridges, waterRouteStyleFor, earthworksRouteStyleFor } from '../lib/water-cartography.ts';
import { authenticateApiRequest, MAX_API_BODY_BYTES, oversizedApiBodyResponse } from '../lib/api-auth.ts';
import './generate-report-sections.test.ts';

function px(r: number, g: number, b: number, a: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

function canvasState(step: DesignCanvasState['step'], rev: number): DesignCanvasState {
  return {
    siteId: 'site-1',
    frame: { centerLng: 30, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    step,
    items: [],
    zones: [],
    lines: [],
    rev,
    updatedAt: '2026-07-19T00:00:00.000Z',
  };
}

test('maskEditableFraction reports how much of the sheet the model may repaint', () => {
  // Two pixels: one editable (alpha 0), one protected (alpha 255).
  const half = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255]);
  assert.equal(maskEditableFraction(half), 0.5);

  // The production failure: a fully opaque mask leaves nothing editable, so restoring against it
  // would return the untouched satellite composite instead of the render.
  const allProtected = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(maskEditableFraction(allProtected), 0);

  const allEditable = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(maskEditableFraction(allEditable), 1);
  assert.equal(maskEditableFraction(new Uint8ClampedArray([])), 0);
});

test('blendProtectedPixels keeps the model output where the mask is transparent', () => {
  const source = px(10, 20, 30, 255);
  const model = px(90, 80, 70, 255);
  const mask = px(255, 255, 255, 0);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), Array.from(model));
});

test('blendProtectedPixels restores the source where the mask is opaque', () => {
  const source = px(10, 20, 30, 255);
  const model = px(90, 80, 70, 255);
  const mask = px(255, 255, 255, 255);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), Array.from(source));
});

test('blendProtectedPixels blends partially protected edges', () => {
  const source = px(200, 100, 0, 255);
  const model = px(0, 0, 200, 255);
  const mask = px(255, 255, 255, 128);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), [100, 50, 100, 255]);
});

test('geometry lock verifies every fully protected pixel byte-for-byte', () => {
  const source = new Uint8ClampedArray([
    10, 20, 30, 255,
    40, 50, 60, 255,
    70, 80, 90, 255,
  ]);
  const model = new Uint8ClampedArray([
    200, 201, 202, 255,
    203, 204, 205, 255,
    206, 207, 208, 255,
  ]);
  const mask = new Uint8ClampedArray([
    255, 255, 255, 255,
    255, 255, 255, 0,
    255, 255, 255, 255,
  ]);

  const restored = blendProtectedPixels(source, model, mask);

  assert.equal(countProtectedPixelMismatches(source, restored, mask), 0);
  restored[8] += 1;
  assert.equal(countProtectedPixelMismatches(source, restored, mask), 1);
});

test('pixel protection helpers reject partial RGBA pixels instead of reading missing channels', () => {
  const partial = new Uint8ClampedArray([10, 20, 30]);
  assert.throws(
    () => blendProtectedPixels(partial, partial, partial),
    /whole RGBA pixels/,
  );
  assert.throws(
    () => maskEditableFraction(partial),
    /whole RGBA pixels/,
  );
  assert.throws(
    () => countProtectedPixelMismatches(partial, partial, partial),
    /whole RGBA pixels/,
  );
});

test('geometry lock always overrides free-form model chrome', () => {
  assert.equal(shouldUseModelChrome(true, true), false);
  assert.equal(shouldUseModelChrome(false, true), false);
  assert.equal(shouldUseModelChrome(true, false), true);
  assert.equal(shouldUseModelChrome(false, false), false);
});

test('Reference Blueprint and painted styles keep geometry and sheet chrome app-owned', () => {
  for (const style of ['precision_atlas', 'extension_blueprint', 'field_ledger', 'homestead_storybook', 'karoo_folk', 'chatgpt_atlas', 'master_atlas'] as const) {
    assert.deepEqual(renderPolicyForStyle(style), {
      authority: 'app',
      modelChrome: false,
      exactGeometry: true,
      useStyleReference: style === 'precision_atlas',
    });
  }
});

test('Satellite Overlay remains the explicit reversible model-authored style', () => {
  assert.deepEqual(renderPolicyForStyle('satellite_overlay'), {
    authority: 'model',
    modelChrome: true,
    exactGeometry: false,
    useStyleReference: false,
  });
});

test('style-derived queue flags have exactly one render authority', () => {
  for (const style of ['precision_atlas', 'extension_blueprint', 'field_ledger', 'homestead_storybook', 'karoo_folk', 'chatgpt_atlas', 'master_atlas', 'satellite_overlay'] as const) {
    const flags = renderAuthorityFlagsForStyle(style);
    assert.equal(hasConflictingRenderAuthority(flags), false, style);
    assert.notEqual(flags.showcase, flags.geometryLock, style);
  }
  assert.deepEqual(renderAuthorityFlagsForStyle('precision_atlas'), { showcase: false, geometryLock: true });
  assert.deepEqual(renderAuthorityFlagsForStyle('satellite_overlay'), { showcase: true, geometryLock: false });
  assert.equal(hasConflictingRenderAuthority({ showcase: true, geometryLock: true }), true);
});

test('Satellite Overlay cannot spend a render on paper that contradicts its photo contract', () => {
  assert.equal(styleSupportsGroundSource('satellite_overlay', 'paper'), false);
  assert.equal(styleSupportsGroundSource('satellite_overlay', 'photo'), true);
  assert.equal(styleSupportsGroundSource('photo_plan', 'paper'), true,
    'Photo Plan has a real paper feature-treatment route; only Satellite Overlay requires the photo');

  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.ok((glossy.match(/if \(!styleSupportsGroundSource\(/g) ?? []).length >= 4,
    'every synchronous and queued paid entry point must refuse the impossible paper route');
  assert.match(glossy, /disabled=\{loading !== null \|\| unavailableForUnderlay\}/,
    'the impossible choice must be disabled before the farmer reaches the paid button');
});

test('exact style inputs contain no editor glyphs or model-interpreted design marks', () => {
  for (const filter of ['all', 'zones', 'water', 'planting', 'structures'] as const) {
    assert.deepEqual(exactModelInputMarks(filter), {
      showToolGlyphs: false,
      showDrivewayEdge: false,
      showDesignLines: false,
      showDesignItems: false,
      showHouseMark: false,
      showDrivewayMark: false,
    });
  }
});

test('every app-owned AI style sends bounded guides without losing per-feature identity', () => {
  for (const filter of ['all', 'zones', 'water', 'planting', 'structures'] as const) {
    assert.deepEqual(polishModelInputMarks('photo_plan', filter, 'photo'), {
      showToolGlyphs: true,
      showDrivewayEdge: false,
      showDesignLines: true,
      showDesignItems: true,
      showHouseMark: false,
      showDrivewayMark: false,
      itemGuideStyle: 'registration',
    });
  }
  assert.deepEqual(polishModelInputMarks('precision_atlas', 'planting', 'paper'), {
    showToolGlyphs: true,
    showDrivewayEdge: false,
    showDesignLines: true,
    showDesignItems: true,
    showHouseMark: true,
    showDrivewayMark: true,
    itemGuideStyle: 'registration',
  }, 'plain paper keeps the factual structure marks that have no photograph beneath them');
  assert.deepEqual(polishModelInputMarks('precision_atlas', 'planting', 'photo'), {
    showToolGlyphs: true,
    showDrivewayEdge: false,
    showDesignLines: true,
    showDesignItems: true,
    showHouseMark: true,
    showDrivewayMark: true,
    itemGuideStyle: 'registration',
  }, 'a painted map keeps the identity cue for same-colour features and repaints structures');
});

test('the source contract decides whether Geometry Lock restores ground or paints one continuous map', () => {
  const photo = lockedProtectMaskOptionsForStyle('photo_plan', 'planting', 'photo');
  assert.equal(photo.protectUnmarkedGround, true);
  assert.equal(photo.protectOutside, true);
  const aerialPixel = px(118, 92, 61, 255);
  const paintedPixel = px(48, 77, 55, 255);
  assert.deepEqual(
    blendProtectedPixels(aerialPixel, paintedPixel, px(0, 0, 0, photo.protectUnmarkedGround ? 255 : 0)),
    aerialPixel,
    'ordinary Photo Plan ground remains the real aerial pixel',
  );

  const paper = lockedProtectMaskOptionsForStyle('precision_atlas', 'planting', 'paper');
  assert.equal(paper.protectUnmarkedGround, true, 'plain white paper stays untouched between features');
  assert.equal(paper.protectOutside, true);

  for (const style of ['precision_atlas', 'field_ledger', 'homestead_storybook', 'extension_blueprint', 'chatgpt_atlas', 'karoo_folk', 'master_atlas'] as const) {
    const paint = lockedProtectMaskOptionsForStyle(style, 'planting', 'photo');
    assert.equal(paint.protectUnmarkedGround, false, `${style} must not paste AI islands into raw aerial ground`);
    assert.equal(paint.protectOutside, false, `${style} promises one edge-to-edge painted map`);
    assert.equal(paint.protectBoundary, false,
      'painted ground must not gain a raw-aerial boundary seam; the app redraws the saved fence');
    assert.equal(paint.protectHouse, true, 'the saved building footprint remains app-owned');
    assert.equal(paint.protectDriveway, true, 'the saved access geometry remains app-owned');
    assert.deepEqual(
      blendProtectedPixels(aerialPixel, paintedPixel, px(0, 0, 0, paint.protectUnmarkedGround ? 255 : 0)),
      paintedPixel,
      `${style} must retain model artwork on ordinary unmarked ground`,
    );
  }
});

test('polish input marks do not change the exact input policy', () => {
  assert.deepEqual(exactModelInputMarks('water'), {
    showToolGlyphs: false,
    showDrivewayEdge: false,
    showDesignLines: false,
    showDesignItems: false,
    showHouseMark: false,
    showDrivewayMark: false,
  });
});

test('rendered driveways have no decorative border on any sheet', () => {
  assert.equal(RENDERED_DRIVEWAY_EDGE, false);
});

test('source-preserving Geometry Lock item holes blend inside the existing edit bound', () => {
  const layers = buildItemMaskFeatherLayers(170, 85);
  assert.ok(layers.length >= 8, 'a single opaque cut leaves the circular pasted-on seams seen in Photo Plan');
  assert.deepEqual(layers[0], { width: 170, height: 85, eraseAlpha: 1 / layers.length });
  assert.equal(layers.at(-1)?.eraseAlpha, 1, 'the item centre remains fully editable');
  assert.ok((layers.at(-1)?.width ?? 0) >= 129 && (layers.at(-1)?.width ?? 0) <= 131,
    'the fully editable core stays at the existing 1.3× footprint allowance');

  const protectionAtX = (xFromCentre: number) => layers.reduce((alpha, layer) => {
    if (Math.abs(xFromCentre) > layer.width / 2) return alpha;
    return alpha * (1 - layer.eraseAlpha);
  }, 1);
  assert.equal(protectionAtX(86), 1, 'far ground remains byte-protected');
  assert.equal(protectionAtX(0), 0, 'the saved feature centre remains fully editable');
  const transition = [66, 70, 74, 78, 82].map(protectionAtX);
  assert.ok(transition.every((alpha) => alpha > 0 && alpha < 1));
  assert.ok(transition.every((alpha, i) => i === 0 || alpha > transition[i - 1]),
    'protection increases monotonically from the feature to the real photograph');
  assert.ok(new Set(transition.map((alpha) => alpha.toFixed(4))).size >= 4);

  assert.throws(() => buildItemMaskFeatherLayers(0, 10), /finite and positive/);
  assert.throws(() => buildItemMaskFeatherLayers(10, Number.NaN), /finite and positive/);

  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.match(glossy, /for \(const layer of buildItemMaskFeatherLayers\(w, h\)\)/,
    'the production mask must consume the feather layers; testing an unused helper protects nothing');
});

test('every editable Water context guide is named to the model without becoming Water content', () => {
  const state = canvasState('water', 1);
  state.items = [
    { id: 'bed-a', defId: 'raised_bed', x: 0.2, y: 0.3 },
    { id: 'bed-b', defId: 'raised_bed', x: 0.4, y: 0.3 },
  ];
  assert.deepEqual(contextElementNames(state, 'water'), ['Raised Bed ×2']);
  assert.deepEqual(contextElementNames(state, 'planting'), []);

  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.match(glossy, /const context = contextElementNames\(state, filter\);[\s\S]*CONTEXT ONLY/,
    'drawn Water context must reach the locked prompt register instead of becoming an unnamed editable mark');
});

test('the locked feature register maps each visible identity glyph to its saved feature name', () => {
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.match(glossy, /`\$\{g\.icon\} \$\{name\}\$\{g\.n > 1/,
    'same-colour footprints need the catalog glyph-to-name mapping in the authoritative register');
  assert.doesNotMatch(glossy, /producerElementsText\([^\n]*!(?:geometryLock|lockActive)/,
    'a locked caller must not silently strip the identity mapping while still drawing its glyph');
});

test('render-only Water cleanup bridges only tiny aligned gaps of the same route type', () => {
  const frame = { imgW: 1000, imgH: 1000, mPerPx: 0.1 };
  const routes = waterRoutesWithVisualBridges([
    { id: 'pipe-a', kind: 'pipe', points: [[0.1, 0.2], [0.2, 0.2]] },
    { id: 'pipe-b', kind: 'pipe', points: [[0.202, 0.2], [0.3, 0.2]] },
    { id: 'greywater-near', kind: 'greywater', points: [[0.202, 0.201], [0.3, 0.201]] },
  ], frame);
  const bridges = routes.filter((route) => route.visualBridge);
  assert.equal(bridges.length, 1);
  assert.equal(bridges[0].kind, 'pipe');
  assert.deepEqual(bridges[0].points, [[0.2, 0.2], [0.202, 0.2]]);
});

test('a swale keeps its saved ground width through render prep, so a sheet can draw the real earthwork', () => {
  // WHY THIS EXISTS. drawWaterRoutes paints the swale on the masterplan and the phasing sheet (09)
  // with drawSwaleCrossSection, which sizes the ditch and the spoil berm from the SAVED width.
  // This mapper used to rebuild each route as { id, kind, points } and silently dropped widthM, so
  // every swale on those sheets fell back to the 5.6px pixel-weight default — the "thin brown
  // line" Rory reported on sheet 09. Nothing failed to make that visible: the legend still listed
  // the swale, the geometry was untouched, and the sheet simply drew a dug channel too small to
  // read as something you dig. A dropped optional field is invisible to every other test here.
  const frame = { imgW: 1000, imgH: 1000, mPerPx: 0.1 };
  const routes = waterRoutesWithVisualBridges([
    { id: 'swale-1', kind: 'swale', points: [[0.1, 0.3], [0.6, 0.32]], widthM: 1.8 },
  ], frame);
  assert.equal(routes.find((route) => route.id === 'swale-1')?.widthM, 1.8);
});

test('render-only Water cleanup leaves large and side-by-side gaps untouched', () => {
  const frame = { imgW: 1000, imgH: 1000, mPerPx: 0.1 };
  const routes = waterRoutesWithVisualBridges([
    { id: 'drip-a', kind: 'drip', points: [[0.1, 0.2], [0.2, 0.2]] },
    { id: 'drip-parallel', kind: 'drip', points: [[0.1, 0.202], [0.2, 0.202]] },
    { id: 'pipe-unrelated-a', kind: 'pipe', points: [[0.1, 0.3], [0.2, 0.3]] },
    { id: 'pipe-unrelated-b', kind: 'pipe', points: [[0.204, 0.3], [0.3, 0.3]] },
    { id: 'pipe-far-a', kind: 'pipe', points: [[0.1, 0.4], [0.2, 0.4]] },
    { id: 'pipe-far-b', kind: 'pipe', points: [[0.21, 0.4], [0.3, 0.4]] },
  ], frame);
  assert.equal(routes.filter((route) => route.visualBridge).length, 0);
});

test('Water routes and small fittings stay legible over illustrated ground', () => {
  assert.ok((waterRouteStyleFor('pipe')?.width ?? 0) >= 6);
  assert.ok((waterRouteStyleFor('greywater')?.width ?? 0) >= 5);
  assert.ok((waterRouteStyleFor('drip')?.width ?? 0) >= 4);
  assert.deepEqual(waterRouteStyleFor('pipe')?.dash, [], 'the buried main stays continuous at phone scale');
  assert.equal(new Set(['pipe', 'greywater', 'drip'].map((kind) => waterRouteStyleFor(kind as 'pipe' | 'greywater' | 'drip')?.color)).size, 3);
  assert.equal(waterFeaturePresentationScale('jojo_5000l'), 2.1);
  assert.equal(waterFeaturePresentationScale('tap_point'), 1.7);
  assert.equal(waterFeaturePresentationScale('greywater_basin'), 1.45);
  assert.equal(waterFeaturePresentationScale('pond_small'), 1.35);
  assert.equal(waterFeaturePresentationScale('veg_bed'), 1);
  const tank = waterFeaturePresentationDimensions('jojo_5000', 9, 9, 1595);
  assert.ok(tank.width >= 1595 * 0.0195);
  assert.equal(tank.width, tank.height);
  const basin = waterFeaturePresentationDimensions('tree_basin', 10, 8, 1595);
  assert.equal(Math.round((basin.width / basin.height) * 1000), 1250);
  assert.ok(basin.height >= 1595 * 0.0195);
  assert.deepEqual(
    waterFeaturePresentationDimensions('veg_bed', 60, 12, 1595),
    { width: 60, height: 12, scale: 1 },
  );
});

test('Earthworks-only swales read as brown cut-and-fill while Water remains blue', () => {
  const earthworks = earthworksRouteStyleFor('swale');
  assert.ok(earthworks);
  assert.equal(earthworks, EARTHWORKS_ROUTE_STYLE.swale);
  assert.equal(earthworks.color, '#A9743F');
  assert.equal(earthworks.casing, '#5B3A22');
  assert.deepEqual(earthworks.dash, []);
  assert.equal(earthworksRouteStyleFor('pipe'), undefined);

  // The old assertion here was `earthworks.color !== waterRouteStyleFor('swale').color` — it
  // required the two swale styles to DIFFER, which is backwards now. The Water sheet no longer
  // draws swales at all (lineInFilter says they belong to sheet 05, and drawWaterRoutes finally
  // asks). The water entry survives only because the Whole-design sheet legends every water line
  // kind from that table, so what matters is that the masterplan uses the SAME earth tone as
  // sheet 05 rather than reproducing the pipe-blue confusion Rory reported.
  const waterSwale = waterRouteStyleFor('swale');
  assert.ok(waterSwale);
  assert.equal(waterSwale.color, earthworks.color, 'one swale colour across every sheet that names it');
  assert.ok(waterSwale.dash.length > 0, 'dashed, so it can never read as a continuous pressurised pipe');
  assert.equal(lineInFilter('swale', 'water'), false, 'the Water sheet does not carry swales');
  assert.equal(lineInFilter('swale', 'earthworks'), true, 'sheet 05 does');
});

test('Water context only borrows saved tree canopies paired with saved tree basins', () => {
  const frame = { imgW: 1000, imgH: 600, mPerPx: 0.1 };
  const state = {
    items: [
      { id: 'basin-a', defId: 'tree_basin', x: 0.2, y: 0.5 },
      { id: 'tree-a', defId: 'tree_mango', x: 0.205, y: 0.5 },
      { id: 'basin-b', defId: 'tree_basin', x: 0.5, y: 0.5 },
      { id: 'tree-b', defId: 'tree_avocado', x: 0.51, y: 0.5 },
      { id: 'tree-distant', defId: 'tree_citrus', x: 0.8, y: 0.5 },
      { id: 'bed-near-basin', defId: 'raised_bed', x: 0.5, y: 0.5 },
    ],
  };
  assert.deepEqual(
    [...pairedWaterDestinationCanopyIds(state, frame)].sort(),
    ['tree-a', 'tree-b'],
  );
});

test('Water sheet chrome uses one formal title and factual subsystem order', () => {
  assert.equal(REFERENCE_SHEET_LABEL.water, 'Water, greywater & irrigation');
  assert.deepEqual(WATER_LEGEND_SECTION_ORDER, [
    'RAINWATER',
    'IRRIGATION',
    'FILTERED GREYWATER',
    'WATER EARTHWORKS',
  ]);
  assert.equal(waterLegendSectionForFeature('jojo_5000'), 'RAINWATER');
  assert.equal(waterLegendSectionForFeature('tap_point'), 'IRRIGATION');
  assert.equal(waterLegendSectionForFeature('banana_circle'), 'FILTERED GREYWATER');
  assert.equal(waterLegendSectionForFeature('pond_small'), 'WATER EARTHWORKS');
  assert.equal(waterLegendSectionForRoute('pipe'), 'IRRIGATION');
  assert.equal(waterLegendSectionForRoute('greywater'), 'FILTERED GREYWATER');
  assert.equal(waterLegendSectionForRoute('swale'), 'WATER EARTHWORKS');
  assert.equal(waterRouteStyleFor('pipe')?.label, 'Buried water pipe');
  assert.equal(waterRouteStyleFor('drip')?.label, 'Drip header and laterals');
  assert.equal(waterRouteStyleFor('drip')?.color, '#238ACB');
});

test('masterplan legend keeps blue pipe, blue drip and purple greywater distinct', () => {
  const entries = waterRouteLegendEntries([
    { id: 'pipe-1', kind: 'pipe', points: [[0.1, 0.1], [0.2, 0.2]] },
    { id: 'drip-1', kind: 'drip', points: [[0.3, 0.1], [0.3, 0.2]] },
    { id: 'drip-2', kind: 'drip', points: [[0.4, 0.1], [0.4, 0.2]] },
    { id: 'greywater-1', kind: 'greywater', points: [[0.5, 0.1], [0.5, 0.2]] },
  ]);
  assert.deepEqual(entries.map(({ kind, color, label, count }) => ({ kind, color, label, count })), [
    { kind: 'pipe', color: '#087CB8', label: 'Buried water pipe', count: 1 },
    { kind: 'drip', color: '#238ACB', label: 'Drip header and laterals', count: 2 },
    { kind: 'greywater', color: '#8A43B3', label: 'Filtered greywater line', count: 1 },
  ]);
});

test('remote design content cannot force the open tab back to a stale wizard step', () => {
  const local = canvasState('water', 2);
  const remote = { ...canvasState('planting', 5), items: [{ id: 'tank', defId: 'jojo_5000l', x: 0.4, y: 0.3 }] };

  const merged = preserveCanvasNavigation(remote, local);

  assert.equal(merged.step, 'water');
  assert.equal(merged.rev, 5);
  assert.equal(merged.items.length, 1);
  assert.equal(remote.step, 'planting');
});

test('Precision Atlas context treatment lightens and calms satellite pixels without moving data', () => {
  const source = px(20, 80, 30, 255);
  const treated = precisionAtlasContextPixels(source);
  const sourceMean = (source[0] + source[1] + source[2]) / 3;
  const treatedMean = (treated[0] + treated[1] + treated[2]) / 3;
  const sourceChroma = Math.max(source[0], source[1], source[2]) - Math.min(source[0], source[1], source[2]);
  const treatedChroma = Math.max(treated[0], treated[1], treated[2]) - Math.min(treated[0], treated[1], treated[2]);

  assert.equal(treated.length, source.length);
  assert.equal(treated[3], source[3]);
  assert.ok(treatedMean > sourceMean);
  assert.ok(treatedChroma < sourceChroma);
  assert.deepEqual(Array.from(source), [20, 80, 30, 255]);
});

test('update notifier detects a newly deployed build without false first-load prompts', () => {
  assert.equal(isDifferentBuild('5b9982b', '7abc123'), true);
  assert.equal(isDifferentBuild('5b9982b', '5b9982b'), false);
  assert.equal(isDifferentBuild(null, '7abc123'), false);
  assert.equal(isDifferentBuild('5b9982b', null), false);
});

test('buildProducerPrompt keeps the style anchor first and the geometry lock last', () => {
  const prompt = buildProducerPrompt(
    'Zones',
    'extension_blueprint',
    'green rectangles are vegetable beds',
    'full',
    false,
    'Site brief text',
  );

  assert.ok(prompt.startsWith(STYLE_LINES.extension_blueprint));
  assert.ok(prompt.includes('TASK: edit this satellite photo of a real South African smallholding'));
  assert.ok(prompt.includes('HOUSE RULE: keep the house whole and fully visible'));
  assert.ok(prompt.includes('FINAL RULE: the source composite geometry is final.'));
  assert.ok(prompt.includes('flat orthographic top-down plan only'));
  assert.ok(prompt.includes('produce edge-to-edge map artwork at exactly the source crop'));
  assert.ok(prompt.includes('Do not add a title block, legend panel, paper border'));
  assert.ok(prompt.includes('Do not copy any emoji, map pin, tool icon, badge'));
  assert.ok(!prompt.includes('clean right-hand title/legend panel'));
});

test('locked illustration prompt paints the whole sheet without inventing features', () => {
  const p = buildLockedIllustrationPrompt(
    'Water',
    'precision_atlas',
    'JoJo Tank 5000L ×2, Greywater line ×3',
    'One fixed whole-site brief',
  );
  assert.ok(p.startsWith(STYLE_LINES.precision_atlas), 'style leads so a length clamp can never cut it');
  // The flat-patch failure: the old locked prompt painted ground only, inside the plot only.
  assert.match(p, /edge to edge/i);
  assert.match(p, /beyond the property boundary/i);
  assert.match(p, /INVENT NOTHING/);
  // Labels, legend and north arrow are the browser's job — the model must not draw text.
  assert.match(p, /no writing, numbers, title, legend/i);
  assert.match(p, /WATER FEATURE ROLE/);
  assert.match(p, /deep dark-green illustrated forest context/);
  assert.match(p, /moderate olive\/moss property interior/);
  assert.match(p, /high-contrast, moody and editorial/);
  assert.doesNotMatch(p, /15-20% brighter/);
  assert.match(p, /JoJo Tank 5000L ×2, Greywater line ×3/);
  assert.match(p, /WHOLE-SITE CONSISTENCY BRIEF: One fixed whole-site brief/);
  assert.match(p, /same centre, count, rotation and footprint/);
  assert.match(p, /Keep buried water pipe blue, filtered-greywater routes purple/);
  assert.match(p, /app reinforces the measured routes, leaders, labels and legend afterwards/i);
  assert.match(p, /no bright border, kerb, raised edge, hatch, shadow or roof-like treatment/);
  assert.doesNotMatch(p, /texture the land continuously/);
  assert.doesNotMatch(buildLockedIllustrationPrompt('Planting', 'precision_atlas'), /WATER FEATURE ROLE/);
});

test('locked Water prompt delegates features and map furniture to deterministic drawing', () => {
  const prompt = buildLockedBackgroundPrompt('Water', 'precision_atlas');

  assert.ok(prompt.startsWith(STYLE_LINES.precision_atlas));
  assert.ok(prompt.includes('premium WATER map-art background'));
  assert.ok(prompt.includes('visibly repaint every editable lawn, veld and soil pixel'));
  assert.ok(prompt.includes('not a faint tint, filter or lightly softened satellite photo'));
  assert.ok(prompt.includes('Leave no raw, dark or photographic satellite texture'));
  assert.ok(prompt.includes('restores clean source geometry'));
  assert.ok(prompt.includes('redraws the exact traced structures'));
  assert.ok(prompt.includes('design infrastructure deterministically after this artwork pass'));
  assert.ok(prompt.includes('flat orthographic top-down'));
  assert.ok(prompt.includes('add no objects or infrastructure'));
  assert.ok(prompt.includes('map-tool symbols, emoji, pins'));
  assert.ok(prompt.includes('protected geometry is unchanged'));
  assert.ok(!prompt.includes('JoJo'));
  assert.ok(!prompt.includes('Tap Point'));
  assert.ok(!prompt.includes('Small Pond'));
  assert.ok(STYLE_LINES.precision_atlas.includes('never a dark satellite filter'));
  assert.ok(STYLE_LINES.precision_atlas.includes('never oblique or isometric'));
  assert.ok(!STYLE_LINES.extension_blueprint.includes('slight isometric'));
});

test('buildShowcasePrompt includes the title, labels and panel instructions', () => {
  const prompt = buildShowcasePrompt(
    'Zones',
    'extension_blueprint',
    'Zone 1, Zone 2',
    'Carl and Sandys Place',
    'zones',
  );

  assert.ok(prompt.includes('title block reading'));
  assert.ok(prompt.includes('LABELS AND PANELS:'));
  assert.ok(prompt.includes('Do not copy any emoji, map pin, tool icon, badge'));
  assert.ok(prompt.includes('small north arrow'));
  assert.ok(prompt.includes('FINAL RULE: the source composite geometry is final.'));
});

// buildShowcasePrompt is the function every default (non-Satellite-Overlay) style actually calls
// (DesignGlossy.tsx:5773/5863). Its own marker vocabulary (M/LEGEND_BY_SHEET) is a SEPARATE object
// from OVERLAY_ICONS, which is Satellite-Overlay-only — a real Water sheet render (Rory: "no
// driveway no tree basins no greywater why!?") showed tree basins and banana circles drawn as a
// generic potted plant and greywater entirely absent, because this function's own vocabulary had
// never had entries added for them at all, ever, on any style. Locking that in here so a future
// element-vocabulary fix to OVERLAY_ICONS can't again land in only one of the two functions.
test('the water sheet marker glossary describes only saved integrated features', () => {
  const prompt = buildShowcasePrompt('Water', 'precision_atlas', 'Tree Basin (×10), Banana Circle (×3)', 'Carl and Sandys Home', 'water');
  assert.match(prompt, /tree basin/i);
  assert.match(prompt, /banana circle/i);
  // The earthwork-not-plant invariant, ported from OVERLAY_ICONS' own fixed language.
  assert.match(prompt, /carries NO plant of its own/);
  assert.match(prompt, /SUNKEN pit/);
  assert.doesNotMatch(prompt, /compact block of upright blue-green vetiver tussocks/);
  assert.doesNotMatch(prompt, /solid violet line is a greywater line/);
  assert.doesNotMatch(prompt, /dark-blue line is a buried water-pipe route/);
  // The driveway colour must match what drawMarks actually paints (TAR, near-black) — not the
  // stale "grey strip" wording that described the pre-fix composite. It is included only when
  // the saved feature list includes the driveway.
  const withDriveway = buildShowcasePrompt('Water', 'precision_atlas', 'Tarred driveway', 'Carl and Sandys Home', 'water');
  assert.doesNotMatch(withDriveway, /grey strip/i);
  assert.match(withDriveway, /near-black tarred strip/i);
});

test('Reference Blueprint never briefs an absent Water route or empty subsystem', () => {
  const tanksOnly = buildShowcasePrompt('Water', 'precision_atlas', 'JoJo Tank 5000L ×2', 'Carl and Sandys Home', 'water');
  assert.match(tanksOnly, /RAINWATER/);
  assert.doesNotMatch(tanksOnly, /IRRIGATION/);
  assert.doesNotMatch(tanksOnly, /FILTERED GREYWATER/);
  assert.doesNotMatch(tanksOnly, /dark-blue line is a buried water-pipe route/);
  assert.doesNotMatch(tanksOnly, /solid violet line is a greywater line/);

  const routed = buildShowcasePrompt('Water', 'precision_atlas', 'Buried pipe, Greywater line, Drip irrigation line ×3', 'Carl and Sandys Home', 'water');
  assert.match(routed, /IRRIGATION/);
  assert.match(routed, /FILTERED GREYWATER/);
  assert.match(routed, /dark-blue line is a buried water-pipe route/);
  assert.match(routed, /solid violet line is a greywater line/);
  assert.match(routed, /bright-blue solid line with sparse emitter dots is a drip-irrigation line/);
  assert.match(routed, /If a feature is absent from the list, it must be absent/);
});

test('Satellite Overlay gives a Planting-sheet Vetiver Bank its exact marker vocabulary', () => {
  const prompt = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting', stylePreset: 'satellite_overlay',
    elementsText: 'Vetiver Bank', placeName: 'Carl and Sandys Place', sheetKind: 'planting',
  });
  const icons = prompt.split('ICON LANGUAGE')[1].split('\n')[0];
  assert.match(icons, /compact block of upright blue-green vetiver tussocks/);
  assert.match(icons, /never a band running along the fence/);
});

test('Satellite Overlay hybrid carries the structure register — structures are painted right the first pass', () => {
  const register = '"Classroom" (western part of the site) is the largest roofed building on the site. "Concrete Slab" (central part of the site) is flat paving at ground level — bare concrete open to the sky, with NO roof and NO walls.';
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Structures', stylePreset: 'satellite_overlay',
    elementsText: 'Shade House', sheetKind: 'structures',
    structureRegister: register,
  });
  // The register text is embedded verbatim: the model reads what each traced rectangle IS.
  assert.ok(p.includes(register));
  // The three disciplines that failed on real renders: merged roofs, roofed slabs, and real
  // photographed buildings amplified into landmarks.
  assert.match(p, /NEVER merge two neighbouring structures/);
  assert.match(p, /stays fully open to the sky/);
  assert.match(p, /exactly where and exactly as large as the photograph shows it/);

  // No register → no STRUCTURE REGISTER section, and no orphaned heading.
  for (const structureRegister of [undefined, '', '   ']) {
    const bare = buildSatelliteOverlayPrompt({
      layerLabel: 'Structures', stylePreset: 'satellite_overlay',
      elementsText: 'Shade House', sheetKind: 'structures',
      structureRegister,
    });
    assert.ok(!bare.includes('STRUCTURE REGISTER'), 'no register given, no register section');
  }
});

test('legacy prompt remains available for rollback and A/B comparison', () => {
  const legacyProducer = buildProducerPromptLegacy(
    'Zones',
    'extension_blueprint',
    'green rectangles are vegetable beds',
    'full',
    false,
    'Site brief text',
  );
  const legacyShowcase = buildShowcasePromptLegacy(
    'Zones',
    'extension_blueprint',
    'Zone 1, Zone 2',
    'Carl and Sandys Place',
    'Site brief text',
  );

  assert.ok(legacyProducer.includes('ABSOLUTELY NO WRITING'));
  assert.ok(legacyProducer.includes('PAINT THE WHOLE PLOT'));
  assert.ok(legacyShowcase.includes('EXACT GEOMETRY, NON-NEGOTIABLE'));
  assert.ok(legacyShowcase.includes('CARTOGRAPHY — THIS SHEET MUST INCLUDE'));
});

test('chatgpt atlas style is wired through the prompt builder', () => {
  const prompt = buildProducerPrompt(
    'Water',
    'chatgpt_atlas',
    'blue area is a pond',
    'full',
    false,
    'Site brief text',
  );

  assert.ok(prompt.includes('STYLE — ChatGPT Atlas'));
  assert.ok(prompt.includes('premium printed design sheet'));
  assert.ok(prompt.includes('NO INVENT:'));
});

test('master atlas style is wired through the prompt builder', () => {
  const prompt = buildProducerPrompt(
    'Water',
    'master_atlas',
    'blue area is a pond',
    'full',
    false,
    'Site brief text',
  );

  assert.ok(prompt.includes('STYLE — Master Atlas'));
  assert.ok(prompt.includes('engraved crosshatch'));
  assert.ok(prompt.includes('NO INVENT:'));
});

test('master atlas is distinct in texture and palette from precision atlas and extension blueprint', () => {
  assert.ok(STYLE_LINES.master_atlas.includes('never a painted wash'));
  assert.ok(STYLE_LINES.master_atlas.includes('never watercolor'));
  assert.ok(!/watercolor (wash|terrain)/i.test(STYLE_LINES.master_atlas));
});

test('satellite overlay style keeps the photo, letters its own sheet, and drops editor emoji', () => {
  assert.equal(isModelChromeStyle('satellite_overlay'), true);
  assert.equal(isModelChromeStyle('precision_atlas'), false);
  // This style has to beat BOTH toggles: Geometry Lock on, AI-legend off, still model chrome.
  assert.equal(shouldUseModelChrome(false, true, true), true);
  assert.equal(shouldUseModelChrome(true, true, false), false);

  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: '⛽ JoJo Tank 5000L ×2, 🚰 Tap Point ×4, 🐸 Small Pond',
    placeName: 'Carl and Sandys Place',
    sheetKind: 'water',
  });
  assert.ok(p.startsWith(STYLE_LINES.satellite_overlay), 'style leads so a length clamp cannot cut it');
  // 04, not 03: sheet numbers now come from the canonical plan set (docs/PLAN-SET-SPEC.md), where
  // Water is 04 and 03 is Zones. The old private 01..05 run collided with a different print sheet
  // at every single number.
  assert.match(p, /04 — WATER PLAN/);
  // The one rule this style exists for: the boundary divides a clean redrawn plan from its
  // photographic context. Keeping the photo EVERYWHERE was the earlier reading and looked flat.
  assert.match(p, /THE BOUNDARY DIVIDES THE SHEET IN TWO/);
  assert.match(p, /INSIDE the boundary the land is REDRAWN CLEAN/);
  assert.match(p, /OUTSIDE the boundary the supplied photograph stays exactly as it is/);
  // Editor glyphs are stripped: they identify markers in the IMAGE, but a model told to "spell
  // exactly" would letter them onto the sheet.
  // Section-number agnostic on purpose: the numbering shifts whenever a rule is added, and a test
  // that breaks on renumbering teaches nothing.
  const elementsSection = p.split("ELEMENTS AND EXACT SPELLINGS:")[1].split('\n')[0];
  assert.doesNotMatch(elementsSection, /[\u{1F300}-\u{1FAFF}]/u);
  // The layout is pre-composed into the input, so the prompt must not ask for a 78/22 split.
  assert.doesNotMatch(p, /left ~78%/);
  assert.match(p, /ALREADY IN PLACE/);
  // Water sheet must not be told how to draw beds or trees it cannot contain.
  assert.doesNotMatch(p, /rounded green canopy disc/);
  assert.ok(p.length < 16000, `prompt ${p.length} must fit the worker's PROMPT_MAX`);
});

test('overlay icon vocabulary matches element NAMES, not headings or place suffixes', () => {
  // The grouped legend format introduced substring collisions that reached real sheets:
  // "MacaDAMia Tree" fired the pond icon, the literal heading "INFRASTRUCTURE" and the suffix
  // "Tap Point (House)" both fired the building icon, and "Tree Basin" fired the greywater basin.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Full design',
    stylePreset: 'satellite_overlay',
    elementsText:
      'INFRASTRUCTURE » Chicken Tractor, Nursery Table, Compost Bay (3-bin) | '
      + 'PLANTING » Macadamia Tree, Pollinator Strip ×3, Tree Basin (Cleared / other) ×5, Banana Circle ×2, Vetiver Bank | '
      + 'WATER » Tap Point (House), Tap Point (Patio / Paving)',
    placeName: 'Carl and Sandys Place',
    sheetKind: 'all',
  });
  const icons = p.split('ICON LANGUAGE')[1].split('\n')[0];

  // Collisions that must NOT fire — nothing here is a pond, a shed or a patio.
  assert.doesNotMatch(icons, /lily pads/, 'Macadamia must not summon the pond icon');
  assert.doesNotMatch(icons, /leave the real roof/, 'headings and place suffixes are not buildings');
  assert.doesNotMatch(icons, /paved patio/, 'a tap placed on paving is not a patio element');

  // The four elements that reached real sheets with no icon spec at all.
  assert.match(icons, /A-frame ark/, 'chicken tractor');
  assert.match(icons, /seedling trays/, 'nursery table');
  assert.match(icons, /timber-slat bays/, 'compost bay');
  assert.match(icons, /mixed wildflowers/, 'pollinator strip');

  // Confusable pairs must differ by SILHOUETTE, not species.
  // Tree basin vs banana circle used to be told apart by "no leaf rosette of its own". The tree
  // basin is now correctly a MOUND with the tree on top, so the discriminator is the silhouette —
  // which is the stronger distinction anyway: one is sunken with plants on the rim, the other is
  // raised with mulch around it.
  assert.match(icons, /Opposite silhouette to a banana circle/, 'tree basin is distinct from a banana circle');
  assert.match(icons, /SUNKEN pit with plants around its rim, this is a RAISED bare mound/);
  assert.match(icons, /raised earth bund/, 'banana circle keeps its own description');
});

test('drip runs are counted from the drawn lines, not from the beds', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'Vegetable Bed ×8, Drip irrigation line ×3',
    placeName: 'X', sheetKind: 'water',
  });
  assert.match(p, /exactly as many runs as there are bright-blue drawn lines/);
  // The old wording promised one run per BED, which turned 3 lines into 8 runs on a real sheet.
  assert.doesNotMatch(p, /one run down each bed/);
});

test('every catalog element has a unique glyph', () => {
  // The composite marks each element with its emoji, and the prompt tells the model that glyph is
  // what identifies the marker. Where two elements shared one, the model had literally no signal
  // to tell them apart — a chicken tractor carried a farm-tractor emoji and was duly drawn as a
  // vehicle on the driveway; banana circles and banana clumps were interchangeable.
  const byIcon = new Map<string, string[]>();
  for (const def of ELEMENT_CATALOG) byIcon.set(def.icon, [...(byIcon.get(def.icon) ?? []), def.id]);
  const dupes = [...byIcon.entries()].filter(([, ids]) => ids.length > 1);
  assert.deepEqual(dupes, [], `elements sharing a glyph: ${dupes.map(([i, ids]) => `${i} → ${ids.join('/')}`).join('; ')}`);
});

// ── The Zones sheet ───────────────────────────────────────────────────────────
// A rendered "02 — ZONES PLAN" reached a farmer with NO zones on it and a legend of invented jojo
// tanks, swales, banana circles and veg beds. The overlay prompt had no concept of a zone band:
// rule 1 orders the interior repainted clean, rule 2's whitelist omitted bands, rule 5 declared
// every coloured shape a placement guide for one element, and rule 14 banned the number badges. The
// model was obeying instructions.

test('the zones sheet tells the model that bands are areas, not element markers', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Zones',
    stylePreset: 'satellite_overlay',
    elementsText: 'Zone 1 — Daily care, Zone 2 — Regular tending, Zone 4 — Woodlot',
    placeName: 'Carl and Sandys Place',
    sheetKind: 'zones',
  });
  assert.match(p, /ZONE BANDS/, 'the zones sheet must carry the zone-band rule');
  assert.match(p, /NEVER becomes a pictorial icon/, 'rule 5 must be explicitly overridden for bands');
  assert.match(p, /number badge/, 'the numerals must be permitted lettering');
  // Item (7), not (8): the whitelist lost "the tar driveway fill" once that clause was found to be
  // ordering a near-black region the model could not locate — so it painted the house instead.
  assert.match(p, /\(7\) the translucent permaculture zone bands/, 'bands must be on the draw whitelist');
  assert.doesNotMatch(p, /the tar driveway fill/, 'nothing to add — the access track is already in the photograph');
  assert.match(p, /no other element, icon, tank, bed, tree or structure is added/, 'zones sheet must forbid invented elements');
  assert.match(p, /03 — ZONES PLAN/, 'canonical plan-set number');
});

test('element sheets are NOT given the zone-band rule', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2',
    sheetKind: 'water',
  });
  assert.doesNotMatch(p, /ZONE BANDS/, 'a water sheet has no bands drawn on it and must not describe any');
});

test('an empty element list is refused, never sent', () => {
  // Rule 7 asserts the list is "the COMPLETE contents of this sheet". An empty list is therefore a
  // positive claim that the sheet is empty, made to a model that can see marks on the photograph —
  // it resolves the contradiction by inventing content. Refusing costs a render; shipping a
  // fabricated plan costs trust, and the farmer may build from it.
  assert.throws(
    () => buildSatelliteOverlayPrompt({ layerLabel: 'Zones', stylePreset: 'satellite_overlay', elementsText: '', sheetKind: 'zones' }),
    /no elements to describe/,
  );
  assert.throws(
    () => buildSatelliteOverlayPrompt({ layerLabel: 'Water', stylePreset: 'satellite_overlay', elementsText: '   ', sheetKind: 'water' }),
    /no elements to describe/,
  );
});

test('every AI sheet number matches the canonical plan set, none collide', () => {
  // Originally all=01 zones=02 water=03 planting=04 structures=05 — and every one of those numbers
  // was a DIFFERENT sheet in the printed set (02 is Sector Analysis, not Zones). Renumbered once to
  // zones=03 water=04 planting=05 structures=06 all=07, then again when Earthworks became its own
  // sheet (05, docs/PLAN-SET-SPEC.md) and everything from Planting on shifted up by one.
  assert.deepEqual(SHEET_NO, { zones: '03', water: '04', earthworks: '05', planting: '06', structures: '07', all: '08' });
  assert.equal(new Set(Object.values(SHEET_NO)).size, Object.keys(SHEET_NO).length, 'numbers must be unique');
});

// ── Icon specs must describe the MARKER SHAPE, never a line the marker is not ──
// The ghost-hedge bug: OVERLAY_ICONS.mulch said "ONE dense continuous band … along exactly that
// line" for Vetiver Bank, whose marker is a 2x2 m RECTANGLE with no line anywhere. Rule 5
// simultaneously demands the icon stay the size of its marker. The only long line on a planting
// composite is the property boundary — which the prompt itself describes as a green line with
// regular perpendicular ticks, i.e. the drawing convention for a planted row. A vetiver hedge
// appeared along the west fence on render after render. pollinator_strip (rect 1x5) had the
// identical "following exactly that line" wording, which is why its labels drifted to the fence too.
test('no icon spec sends a rectangular element off along a line', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting',
    stylePreset: 'satellite_overlay',
    elementsText: 'Vetiver Bank, Pollinator Strip ×3, Vetiver Row, Spekboom Hedge',
    sheetKind: 'planting',
  });
  // The icon vocabulary section only — the boundary rule legitimately says "along its full length".
  const icons = p.slice(p.indexOf('6. ICON LANGUAGE'), p.indexOf('7. THIS SHEET'));
  assert.doesNotMatch(icons, /along exactly that line/, 'a rect marker has no line to run along');
  assert.doesNotMatch(icons, /following exactly that line/, 'a rect marker has no line to follow');
  assert.match(icons, /filling exactly that rectangle/, 'specs must name the marker shape');
});

test('the boundary is positively identified as a fence, not a planted row', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting',
    stylePreset: 'satellite_overlay',
    elementsText: 'Vetiver Bank',
    sheetKind: 'planting',
  });
  assert.match(p, /never a hedge, windbreak, planted row or band of vegetation/);
  // The composite now strokes the ring in this exact colour, so image and brief agree. Previously
  // the composite drew #8CEB6A — the same green family as the planting fills.
  assert.match(p, /#B4E000/);
  // Post-and-wire, not ticks: a ticked line on a map full of planting reads as a row of somethings
  // along the fence, which is half of why a phantom hedge kept appearing there.
  assert.match(p, /round bone posts/);
  assert.match(p, /Posts are circles, never ticks/);
  assert.doesNotMatch(p, /perpendicular tick marks/);
});

test('the house is the photographed roof inside an outline, never a grey slab', () => {
  // The composite used to fill each house footprint with #8A8D91 at 65% and this prompt described
  // that slab as "the pale grey shape … is the ROOF", expecting the model to convert it. It never
  // did — the same prompt tells it every unmarked pixel is the photograph as supplied, so it read
  // the slab as photograph and left it — and buildProtectMask restored the footprint byte-for-word
  // afterwards regardless. Rory saw three flat grey rectangles where his buildings are, on every
  // render including the paid one.
  //
  // The fill is gone; only the outline is drawn, so the real photographed roof shows through. This
  // asserts the prompt no longer promises the model a grey shape it will not find, while keeping
  // the tar separation that the pale-roof wording originally existed to protect.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2',
    sheetKind: 'water',
  });
  assert.match(p, /white outline encloses the ROOF/);
  assert.match(p, /photograph inside that outline IS the real roof/);
  assert.doesNotMatch(p, /pale grey shape/, 'nothing paints a grey shape over the roof any more');
  assert.match(p, /no part of it is ever paved, darkened or turned into road surface/);
});

// A model-drawn bearing is a coin-flip on both angle and sense (docs/RENDER-INVESTIGATION-2026-07-20.md
// 'sector-ai' finding 4), so this prompt must never let the model draw the analysis — only restyle
// the ground fabric the deterministic overlay is composited onto afterwards.
test('the sector restyle prompt forbids the analysis and carries no marker/legend/element-list language', () => {
  const p = buildSectorRestylePrompt('precision_atlas', 'Some Farm');
  assert.match(p, /DO NOT DRAW THE ANALYSIS/);
  assert.match(p, /no arrows, arcs, wedges, compass letters/);
  assert.match(p, /no legend panel, no title block, no north arrow, no scale bar/);
  assert.doesNotMatch(p, /element list/i);
  assert.doesNotMatch(p, /marked feature/i);
  assert.doesNotMatch(p, /legend row/i);
  // composeSectorSheet draws the true boundary/roof/driveway from refLayers over this image, so
  // this prompt must NOT promise the model will hold them at exact position/scale — that promise
  // is what 967c345 found the model breaking. It should say the opposite: their exact geometry is
  // drawn separately and does not matter here.
  assert.match(p, /RESTYLE ONLY/);
  assert.match(p, /drawn separately afterwards, at measured positions/);
  assert.match(p, /do not matter and are not graded/);
  assert.doesNotMatch(p, /KEEP EXACT/);
  assert.doesNotMatch(p, /in exactly their photographed shape, position and scale/);
});

// The registration bug this whole rewrite exists to prevent: geometryLockTail() promises the
// model will hold the boundary/roof/driveway position exactly, which is the one thing this prompt
// must NOT ask for (there is no protect mask on this path to enforce or restore it from).
test('the sector restyle never appends the geometry-lock tail', () => {
  const p = buildSectorRestylePrompt('precision_atlas', 'Some Farm');
  assert.doesNotMatch(p, /the source composite geometry is final/i);
});

// ── Sector restyle ────────────────────────────────────────────────────────────
// The first AI sector sheet came back as a hard-edged illustrated quad — the boundary polygon —
// floating on untouched dark photograph. Two causes: finishSectorSheet clipped the model's paint to
// the boundary, and this prompt never asked for edge-to-edge coverage. On a sector sheet the land
// BEYOND the fence is part of the analysis: fire, wind and downhill water all arrive from outside.
test('the sector restyle paints the whole frame, not just inside the fence', () => {
  const p = buildSectorRestylePrompt('precision_atlas', 'Carl and Sandys Home');
  assert.match(p, /PAINT EDGE TO EDGE/);
  assert.match(p, /beyond the property boundary/);
  assert.match(p, /never left as raw photograph/);
  assert.match(p, /no photographic patches left and no hard edge anywhere/);
});

test('the sector restyle still refuses to draw any analysis', () => {
  const p = buildSectorRestylePrompt('precision_atlas');
  // The whole safety argument for an AI sector sheet: a bearing drawn 30 degrees off puts a
  // windbreak on the wrong side of a field, so the model must never draw one.
  assert.match(p, /DO NOT DRAW THE ANALYSIS/);
  for (const banned of ['arrows', 'arcs', 'wedges', 'north arrow', 'scale bar']) {
    assert.ok(p.includes(banned), `must forbid ${banned}`);
  }
  assert.match(p, /no lettering of any kind/);
});

test('the paid sector polish uses the complete exact sheet as its visual blueprint', () => {
  const p = buildSectorSheetPolishPrompt('master_atlas', 'Some Farm');
  assert.match(p, /COMPLETE, already-correct Sector Analysis/);
  assert.match(p, /PRESERVE CONTENT/);
  assert.match(p, /same position/);
  assert.match(p, /same directions/);
  assert.match(p, /same labels and same legend/);
  assert.match(p, /visibly more polished/);
  assert.match(p, /Some Farm/);
  assert.match(p, /formal engraved masterplan/i);
});

// ── The paid second pass ───────────────────────────────────────────────────────
// Rory, after paying for Full Treatment: the polished sheet was indistinguishable from the free
// Hybrid it was built on. An audit of the render path found the cause in this prompt rather than
// in the mask, the stages or the opacity work that had all been tried before it.
//
// The polish pass was rechained in ed8da18 to feed on the HYBRID instead of the exact sheet — and
// this prompt was never updated. It still opened by calling its input "COMPLETE, already-correct",
// then spent five of eight paragraphs on preservation, and its single differentiating sentence
// asked for something "more refined than the supplied exact sheet" — an image the model had not
// been given for two days. Against an input that already looks acceptable, returning a near-copy
// was the COMPLIANT answer. The model was doing as it was told.
//
// These assertions therefore check the prompt's JOB, not its wording. The previous version pinned
// fourteen exact phrases, which meant the text could stay wrong for two days while the suite stayed
// green — a snapshot test on a prompt records what someone typed, not whether it works.
test('the paid second pass is told it received a DRAFT, and that copying it is a failure', () => {
  const p = buildFinishedSheetPolishPrompt('Water', 'chatgpt_atlas', 'Some Farm');

  // 1. It must describe its real input. Calling a first-pass AI render "complete" or
  //    "already-correct" invites the model to leave it alone.
  assert.match(p, /FIRST-PASS AI render|draft, not a finished sheet/i);
  assert.doesNotMatch(p, /COMPLETE, already-correct/, 'the input is a draft, not a finished sheet');

  // 2. It must not reference the exact sheet — the polish pass has not seen one since ed8da18.
  assert.doesNotMatch(p, /than the supplied exact sheet/, 'the model is given the hybrid, not the exact sheet');

  // 3. The anti-copy instruction is the whole point of the rewrite.
  assert.match(p, /RETURNING THE SUPPLIED IMAGE UNCHANGED IS A FAILED RESULT/);
  assert.match(p, /global filter|grain, warmth or vignette/i, 'a filter pass must be named as failure too');

  // 4. It must say what specifically to improve. "Polish" alone is not actionable for an image
  //    model; naming materials, line weight and lighting is.
  assert.match(p, /material/i);
  assert.match(p, /line weight/i);
  assert.match(p, /shadow|lighting|lit/i);

  // 5. Geometry still may not move — the point was never to let it redesign the farm.
  assert.match(p, /move none of them|WHAT MUST NOT MOVE/);
  assert.match(p, /Invent nothing/i);
  // The polish input is now the Hybrid's MAP, text-free — no page, no panel, no legend. The prior
  // page contract forced this prompt to demand "WRITE NOTHING" and "keep the supplied labels
  // verbatim" at once, and the first flagship render obeyed both: it erased every map label and
  // repainted the legend. So the authority claim names the map alone, and the prompt must also
  // forbid ALL text — the app draws title, legend, codes and callouts afterwards from saved data.
  assert.match(
    p,
    /supplied map is authoritative/i,
    'the supplied map must be treated as the exhaustive factual inventory',
  );
  assert.match(
    p,
    /WRITE NOTHING/,
    'the model may not draw a glyph of text — labels and legend are burned back deterministically',
  );
  assert.doesNotMatch(
    p,
    /keep the supplied title|legend entries with their exact spellings|Fill the legend panel/i,
    'no instruction may ask the model to preserve or draw text — that is the contradiction that erased the flagship labels',
  );
  assert.match(
    p,
    /do not turn.*roof.*driveway.*tank|never reinterpret.*roof.*driveway.*tank/i,
    'dark roof and access pixels must not be hallucinated into new tanks or structures',
  );
  assert.match(
    p,
    /growing bed, not bare soil|visibly planted/i,
    'marked vegetable beds must render as planted crops, never empty soil (Rory, judging the first v93 render)',
  );
  // The NEMBA species concern was "the model writes a species name the design never chose". With
  // a text-free input and WRITE NOTHING in force, the model cannot name anything at all — the
  // guard moved from a per-paragraph clause to the contract itself (asserted above).

  // 6. Preservation must not swamp the ask. The old prompt was five parts preservation to one part
  //    instruction; that ratio is what made a copy compliant.
  const paragraphs = p.split('\n\n');
  const preservation = paragraphs.filter((s) => /preserve|must not|keep the|invent nothing/i.test(s)).length;
  assert.ok(preservation <= paragraphs.length / 2, `preservation dominates the prompt (${preservation}/${paragraphs.length})`);

  assert.match(p, /Some Farm/);
  assert.match(p, /polished editorial cartography/i);
});

test('the polish pass structure register separates roofed buildings from flat ground', () => {
  const register =
    '"Classroom" (western part of the site) is the largest roofed building on the site — draw exactly one roof on its exact footprint. "Concrete Slab" (central part of the site) is flat paving at ground level — bare concrete open to the sky, with NO roof and NO walls.';
  const p = buildFinishedSheetPolishPrompt('Planting & Agroforestry', 'chatgpt_atlas', 'Some Farm', register);

  assert.match(p, /STRUCTURE REGISTER/);
  assert.ok(p.includes(register), 'the computed register must be embedded verbatim');
  assert.match(
    p,
    /never merge neighbouring structures under one shared roof/i,
    'the giant shared roof over slab + buildings was the exact production failure',
  );
  assert.match(
    p,
    /stays fully open to the sky/i,
    'flat surfaces must be told to stay unroofed, not merely unmoved',
  );
});

test('the polish prompt without a register carries no empty STRUCTURE REGISTER section', () => {
  for (const register of [undefined, '', '   ']) {
    const p = buildFinishedSheetPolishPrompt('Water', 'chatgpt_atlas', 'Some Farm', register);
    assert.ok(!p.includes('STRUCTURE REGISTER'), `register=${JSON.stringify(register)}`);
  }
});

test('the access track is described as flat ground, never a slab or a roof', () => {
  // It came back drawn as a raised, roof-like plane beside the house (Rory: "makes the driveway
  // like a roof"). "At ground level" was not enough — the model needed the negatives.
  for (const kind of ['all', 'water'] as const) {
    const p = buildSatelliteOverlayPrompt({
      layerLabel: 'Water', stylePreset: 'satellite_overlay',
      elementsText: 'JoJo Tank 5000L ×2', sheetKind: kind,
    });
    assert.match(p, /FLAT GROUND and nothing else/);
    assert.match(p, /no thickness, no raised edge, no side walls, no drop shadow/);
    assert.match(p, /never a slab, platform, deck, plinth or roof/);
  }
});

test('GROUND stays silent, but what the system SERVES is named', () => {
  // Two channels on purpose. Ground the farmer walks past every day (lawn, patio, yard) carries no
  // caption — captioning it buries the design. The beds and basins the irrigation feeds are the
  // opposite: unnamed, they are unexplained shapes on his own plan ("why doesnt it include all the
  // right elements"). Folding both into one string would force one rule on both.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2',
    fabric: 'Lawn, Patio / Paving',
    served: 'Vegetable Bed ×8, Banana Circle ×2',
    sheetKind: 'water',
  });
  // Ground: silent.
  assert.match(p, /LABEL THE DESIGN, NOT THE SITE/);
  assert.match(p, /none on the driveway, paving, patio, yard, lawn or existing planting/);
  assert.match(p, /no caption and no legend row of their own/);
  // Served: named, captioned, and given its own EXISTING legend heading.
  assert.match(p, /WHAT THIS SYSTEM SERVES/);
  assert.match(p, /Vegetable Bed ×8, Banana Circle ×2/);
  assert.match(p, /legend row each under a heading reading EXISTING/);
  // ...and never counted as this layer's own system.
  // Reworded: RAINWATER / IRRIGATION / GREYWATER are headings that exist only on the Water sheet,
  // so naming them here was wrong the moment this clause could reach any other sheet.
  assert.match(p, /never part of it, and they never take one of this sheet's own system headings/);
});

test('naming what the system serves always carries the add-none guard', () => {
  // Naming these without it produced invented tree canopies and banana palms, because "Tree Basin"
  // contains "tree". The name and the guard must never be separated.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2', served: 'Tree Basin ×5, Banana Circle ×2', sheetKind: 'water',
  });
  assert.match(p, /ALREADY THERE/);
  assert.match(p, /redraw exactly what is marked, one for one/);
  assert.match(p, /ADD NONE/);
  assert.match(p, /no extra bed, basin, tree, canopy, palm or shrub appears anywhere/);
});

test('a sheet with nothing to serve says nothing about it', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting', stylePreset: 'satellite_overlay',
    elementsText: 'Mango Tree', sheetKind: 'planting',
  });
  assert.doesNotMatch(p, /WHAT THIS SYSTEM SERVES/);
});

// ── Phase 1: the prompt must not name what the composite does not contain ─────
test('irrigation routes are described only where they can exist', () => {
  // lineInFilter puts swale/pipe/drip on the WATER layer only. Describing them on Planting or
  // Structures named lines that are not in the composite — and rule 7's absent-assertion means the
  // model resolves that by inventing them. Same shape as every invention bug this file has shipped.
  const on = (k: 'water' | 'all' | 'planting' | 'structures') =>
    buildSatelliteOverlayPrompt({ layerLabel: 'X', stylePreset: 'satellite_overlay', elementsText: 'JoJo Tank 5000L', sheetKind: k });
  assert.match(on('water'), /drip-irrigation runs/);
  assert.match(on('all'), /drip-irrigation runs/);
  assert.doesNotMatch(on('planting'), /drip-irrigation runs/);
  assert.doesNotMatch(on('structures'), /drip-irrigation runs/);
  // The boundary rule lives in the same numbered item and must survive on every sheet.
  for (const k of ['water', 'all', 'planting', 'structures'] as const) {
    assert.match(on(k), /PROPERTY BOUNDARY/);
  }
});

test('rule 7 no longer asserts that ground and served items are absent', () => {
  // It said the element list was "the COMPLETE contents of this sheet" while siteFabric and the
  // served clause, in the same prompt, named more drawable things. The model was told they were
  // both present and absent.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L', fabric: 'Lawn', served: 'Vegetable Bed ×8', sheetKind: 'water',
  });
  assert.doesNotMatch(p, /COMPLETE contents of this/);
  assert.match(p, /COMPLETE set of DESIGNED ELEMENTS/);
  assert.match(p, /It is not the whole of what the sheet SHOWS/);
});

test('the icon rule never renders as an empty numbered fragment', () => {
  // On a Zones sheet nothing matches the icon vocabulary, and rule 6 came out as
  // "6. ICON LANGUAGE ... : ." — a numbered instruction with no content, on every zones render.
  const zones = buildSatelliteOverlayPrompt({
    layerLabel: 'Zones', stylePreset: 'satellite_overlay',
    elementsText: 'Zone 1 — Daily care', sheetKind: 'zones',
  });
  assert.doesNotMatch(zones, /shading: \./);
  assert.match(zones, /6\. ICON LANGUAGE/);
});

// ── Tree basin geometry ──────────────────────────────────────────────────────
// The app used to DESCRIBE the safe arrangement to the farmer and DRAW the unsafe one: the tip said
// "a mulch-filled ring around a fruit tree", the icon spec said "a shallow saucer … sitting under
// the canopy it serves" — i.e. the tree standing in the dip. That is how a collar rots, and
// avocado, pawpaw and macadamia are the local Phytophthora-susceptible cases. The water prompt
// already routes greywater to tree basins, which is only safe with the mound-and-moat geometry.
test('a tree basin is drawn as a mound with a moat, never a tree in a dish', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'Tree Basin ×5', sheetKind: 'water',
  });
  const icons = p.slice(p.indexOf('6. ICON LANGUAGE'), p.indexOf('7. THIS SHEET'));
  assert.match(icons, /low raised mound of bare prepared soil at the centre/);
  // The earthwork draws NO plant of its own. The first version of this spec said "with the tree
  // standing ON TOP of it", so ten basins placed without trees came back as ten invented plants —
  // the one-marker-one-icon rule broken by the very spec meant to fix the geometry.
  assert.match(icons, /THE MOUND CARRIES NO PLANT OF ITS OWN/);
  assert.match(icons, /has its own separate marker/);
  assert.match(icons, /doughnut-shaped mulched moat|annular trench/);
  assert.match(icons, /never down in a dip/);
  assert.doesNotMatch(icons, /shallow saucer/);
});

test('the farmer-facing tip and the drawing instruction agree on the geometry', () => {
  const def = ELEMENT_CATALOG.find((d) => d.id === 'tree_basin')!;
  // Both must carry the mound. They disagreed for a long time and nothing caught it, because a tip
  // and a prompt string live in different files and are never compared.
  assert.match(def.tip ?? '', /mound/i, 'the tip must tell the farmer to plant on a mound');
  assert.match(def.tip ?? '', /moat|ring/i);
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay', elementsText: 'Tree Basin', sheetKind: 'water',
  });
  assert.match(p, /mound/i);
});

// ── The two ways a water sheet used to invent things ─────────────────────────
test('the driveway is NAMED on every sheet, not just the masterplan', () => {
  // The bug that erased it over and over: the composite DRAWS the access track on layer sheets,
  // but it was named only when filter === 'all'. Rule 7 says nothing outside the list and the
  // rules is drawn — so drawn-and-unnamed is the one state guaranteed to be erased. Every fix
  // before this one went into the drawing instead of the naming.
  const layer = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2', fabric: 'Lawn, Tarred driveway', sheetKind: 'water',
  });
  assert.match(layer, /Tarred driveway/);
  // …but as FABRIC, so it takes no caption and no legend row beside the actual design work.
  assert.match(layer, /no caption and no legend row of their own/);
});

test('only the water subsystems that exist are described', () => {
  const base = { layerLabel: 'Water', stylePreset: 'satellite_overlay' as const, elementsText: 'JoJo Tank 5000L ×2', sheetKind: 'water' as const };
  // Tanks only: no irrigation heading, and above all no greywater main to invent.
  const tanksOnly = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: true, irrigation: false, greywater: false } });
  assert.match(tanksOnly, /RAINWATER/);
  assert.doesNotMatch(tanksOnly, /IRRIGATION/);
  assert.doesNotMatch(tanksOnly, /FILTERED GREYWATER/);
  assert.doesNotMatch(tanksOnly, /pressure regulator/);
  assert.match(tanksOnly, /Add no fitting, valve, regulator, filter, tap, pipe or line that is not already marked/);
  // A greywater BASIN with no run drawn: the heading appears, but the prompt says outright that no
  // line exists. Describing "the violet run" whenever a basin exists told the model a run was
  // there when the farmer had drawn none — so it invented one and routed it wherever it liked.
  const basinOnly = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: true, irrigation: true, greywater: true } });
  assert.match(basinOnly, /FILTERED GREYWATER/);
  assert.match(basinOnly, /NO greywater pipe, line or run is drawn anywhere on this sheet/);
  assert.doesNotMatch(basinOnly, /solid violet run already traced/);
  // The mulch-discharge rule is about the basins, not the line, so it survives either way.
  assert.match(basinOnly, /never onto edible leaves/);
  // With a run actually drawn, it is described — and only then.
  const withRun = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: true, irrigation: true, greywater: true, greywaterLine: true } });
  assert.match(withRun, /solid violet run already traced/);
  assert.match(withRun, /add no branch that is not drawn/);
  assert.match(withRun, /never onto edible leaves/);
  // None at all: the whole clause disappears rather than shipping empty headings.
  const none = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: false, irrigation: false, greywater: false } });
  assert.doesNotMatch(none, /WATER SHEET — GROUP WHAT IS THERE/);
});

test('tar and roof are named as different colours, so one cannot be drawn as the other', () => {
  // The driveway kept coming back as a ROOF. The mechanism was in the picture, not the wording:
  // the composite drew tar at #3B3A3E while rule 1 names #3C4247 as the colour of every roof —
  // the same colour to within a rounding error. Three commits of "flat, no thickness, never a
  // slab" could not beat a slate-grey polygon sitting next to a house.
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L', sheetKind: 'water',
  });
  assert.match(p, /Slate grey #3C4247 is ROOF; near-black #12140F is TAR ON THE GROUND/);
  assert.match(p, /never give the near-black shape a ridge, a hip, a pitched plane or a shadow/);
  // The access track is identified by the colour the composite actually paints it.
  assert.match(p, /near-black #12140F shape on the ground is the ACCESS TRACK, not a building/);
});

test('one tar colour ships everywhere', async () => {
  // Three shipped simultaneously: #3B3A3E drawn, #2A2A2E in legend swatches, #12140F stated in the
  // prompt palette. A farmer cannot match a legend swatch to a shape that is not that colour.
  const { GROUND_FEATURES } = await import('../lib/design-elements.ts');
  assert.equal(GROUND_FEATURES.driveway.color, '#12140F');
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay', elementsText: 'JoJo Tank 5000L', sheetKind: 'water',
  });
  assert.match(p, /near-black tar #12140F/); // the style line's palette
});

test('the legend collapses place-suffixed variants into one row', () => {
  // The suffix ("Tap Point (Lawn)", "Tap Point (House)") exists so a farmer can tell four identical
  // taps apart ON THE MAP, where a leader points at one of them. In the legend it is dead weight —
  // three icon rows for one kind of fitting, in the scarcest space on the sheet, pushing out real
  // species. (Rory: "i dont want 3 separate tap lines on the legend".)
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'Tap Point (Lawn) ×2, Tap Point (Patio / Paving), Tap Point (House), JoJo Tank 5000L ×2',
    sheetKind: 'water',
  });
  // One row, carrying the total of all four.
  assert.match(p, /— Tap Point \(×4\)/);
  assert.doesNotMatch(p, /— Tap Point \(Lawn\)/);
  // …but the MAP labels keep the suffix, which is the whole reason it exists.
  assert.match(p, /Tap Point \(Lawn\)/);
});

// ── A drawn map label never carries a quantity ────────────────────────────────────────────────
//
// Rory ran a paid Full Treatment on the Water sheet and got seven vegetable beds captioned
// "VEGETABLE BED ×1" through "VEGETABLE BED ×7". Nothing invented them — the element list really
// does say "VEGETABLE BED ×7", because rule 7 needs that count to know how many icons to draw.
// Rule 10 then said "spell every label exactly as the element list gives it" and demonstrated
// "2 × JOJO TANKS 5000L EACH", so the model was told, twice, that a number belongs in a label. With
// seven markers and one string carrying a 7, enumerating them is the only coherent reading.
//
// These pin the separation rather than the wording: the count list and the label list are now two
// different strings, and the label list may not contain a digit-bearing quantity.
test('the map-label list is the element list with every quantity stripped', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: '🌱 Vegetable Bed ×7, ⛽ JoJo Tank 2500L, 🚰 Tap Point ×6',
    placeName: 'Ubhejane Creche',
    sheetKind: 'water',
  });

  // Rule 7 still gets the counts — they are how the model knows to draw seven beds, not one.
  const rule7 = p.split("THIS SHEET'S ELEMENTS AND EXACT SPELLINGS:")[1].split('\n')[0];
  assert.match(rule7, /Vegetable Bed ×7/i, 'rule 7 lost the count it needs to draw the right number');

  // Rule 10's allowed spellings carry the same names with no quantity attached.
  const rule10 = p.split('THESE ARE THE ONLY SPELLINGS')[1].split('\n')[0];
  assert.match(rule10, /Vegetable Bed/i);
  assert.match(rule10, /Tap Point/i);
  assert.doesNotMatch(rule10, /×\s*\d/, 'a quantity reached the list of allowed label spellings');
});

test('nothing in the prompt shows a count being lettered onto the sheet', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: '🌱 Vegetable Bed ×7, ⛽ JoJo Tank 5000L ×2',
    placeName: 'Ubhejane Creche',
    sheetKind: 'water',
  });
  const labelRule = p.split('10. LABELS')[1].split(/\n\d{2}\./)[0];

  // The worked example used to be "2 × JOJO TANKS 5000L EACH" — a quantity in quotes, inside the
  // rule that draws labels. Any quoted example of that shape teaches the behaviour back in.
  assert.doesNotMatch(labelRule, /"\s*\d+\s*×/, 'rule 10 demonstrates a count inside a label again');
  assert.doesNotMatch(labelRule, /×\s*\d+\s*[A-Z]/, 'rule 10 shows a quantity attached to a name');
});

test('Water context inventory counts never become served-fixture caption spellings', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L',
    served: 'Vegetable Bed ×7, Tree Basin ×2',
    sheetKind: 'water',
  });
  const servedRule = p.split('WHAT THIS SYSTEM SERVES')[1].split('\n')[0];

  assert.match(servedRule, /Vegetable Bed ×7, Tree Basin ×2/, 'the inventory lost its marker counts');
  assert.match(servedRule, /plain names, with no number or count added: Vegetable Bed, Tree Basin/);
  assert.doesNotMatch(servedRule, /caption naming it exactly as written above/);
});

test('Zones keep full zone names in the legend and only number badges on the map', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Zones',
    stylePreset: 'satellite_overlay',
    elementsText: 'Zone 1 — Daily use, Zone 3 — Orchard / food forest',
    sheetKind: 'zones',
  });
  const labelRule = p.split('10. LABELS')[1].split('\n')[0];
  const legendRule = p.split('11. LEGEND PANEL')[1].split('12. SHEET FURNITURE')[0];

  assert.match(labelRule, /NO ELEMENT LABELS/);
  assert.match(labelRule, /only the saved zone numeral/);
  assert.doesNotMatch(labelRule, /Zone 1 — Daily use|Zone 3 — Orchard/);
  assert.match(legendRule, /Zone 1 — Daily use/);
  assert.match(legendRule, /Zone 3 — Orchard \/ food forest/);
});

// PHOTO PLAN — the two properties that are the entire point of this style.
//
// It exists because a paid Master Atlas render came back as an invented engraved landscape with the
// farm nowhere in it. Master Atlas was obeying its own prompt; the problem was that repainting the
// ground stopped being a good trade the moment real Esri imagery landed underneath. The reference
// sheets Rory holds up as the standard all keep the photograph and illustrate only the design.
//
// So this style must (a) forbid touching the ground, and (b) forbid the model writing ANY text,
// because our deterministic labels, counts and legend are burned on afterwards from the saved
// design. A model that letters the sheet will collide with them and will be wrong — that is the
// difference between this and satellite_overlay, which hands lettering to the model on purpose.

test('photo_plan forbids restyling the ground the farmer actually has', () => {
  const s = STYLE_LINES.photo_plan;
  for (const forbidden of ['stylise', 'filter', 'wash', 'engrave', 'hatch', 'blur', 'relight', 're-colour']) {
    assert.ok(s.includes(forbidden), `photo_plan must forbid "${forbidden}" on the ground`);
  }
  assert.match(s, /photograph IS the map/i);
  assert.match(s, /do not extend or invent terrain/i);
});

test('photo_plan tells the model to write nothing, because we letter the sheet', () => {
  const s = STYLE_LINES.photo_plan;
  assert.match(s, /WRITE NOTHING/);
  for (const chrome of ['No labels', 'no legend', 'no title', 'no scale bar', 'no north arrow']) {
    assert.ok(s.includes(chrome), `photo_plan must exclude ${chrome}`);
  }
  // The load-bearing assertion: our chrome only survives if this is NOT a model-chrome style.
  assert.equal(isModelChromeStyle('photo_plan'), false,
    'photo_plan must keep the deterministic labels/legend — that is what separates it from satellite_overlay');
  assert.equal(isModelChromeStyle('satellite_overlay'), true,
    'satellite_overlay deliberately does hand lettering to the model');
});

test('both photographic styles take the photo anchor, and every other style does not', () => {
  // Repainting styles get the painted plan-set anchor; the two that keep the photograph must not,
  // or the model is told to paint the ground in the same breath as being told to preserve it.
  const photographic: Array<keyof typeof STYLE_LINES> = ['photo_plan', 'satellite_overlay'];
  for (const k of photographic) {
    assert.match(STYLE_LINES[k], /photograph/i, `${k} should be built around the photograph`);
  }
  assert.ok(STYLE_LINES.master_atlas.includes('never a satellite filter'),
    'master_atlas still deliberately replaces the photo — this is the style photo_plan answers');
});

test('AI prompt injects tree canopy instructions when speciesCrownForm and label are present', () => {
  const items: import('../lib/design-canvas.ts').PlacedItem[] = [
    { id: '1', defId: 'shade_tree', x: 0.5, y: 0.5, label: 'Tree A', speciesCrownForm: 'dome-shaped' },
    { id: '2', defId: 'shade_tree', x: 0.6, y: 0.6, label: 'Tree B' }
  ];
  const p = buildShowcasePrompt(
    'Planting',
    'master_atlas',
    'shade tree',
    '',
    'all',
    items
  );
  assert.match(p, /The tree marked 'Tree A' is a dome-shaped canopy tree/);
  assert.doesNotMatch(p, /Tree B/);

  const pSat = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting',
    stylePreset: 'satellite_overlay',
    elementsText: 'shade tree',
    sheetKind: 'all',
    items
  });
  assert.match(pSat, /The tree marked 'Tree A' is a dome-shaped canopy tree/);
  assert.doesNotMatch(pSat, /Tree B/);
});

// ── The hybrid's missing marker glossary, and the bed wording that kept missing it ──────────────
//
// Rory, after weeks of paid hybrids: "the veg beds still look like a hedge and don't have
// vegetables". buildLockedIllustrationPrompt — Geometry Lock, the most-used AI path in the app —
// named every placed feature and described NONE of them, while its own PAINT WHAT IS THERE clause
// offered "hedges and treelines" as one of the few concrete green textures it did describe. Every
// other prompt path in producer-prompt.ts carries a marker glossary; the repeated fixes to the bed
// wording had all landed in those tables only. These guard both halves.

test('the Geometry Lock hybrid tells the model what a vegetable bed looks like', () => {
  const p = buildLockedIllustrationPrompt('Planting', 'precision_atlas', '🥬 Vegetable Bed ×9');
  assert.match(p, /WHAT THE MARKERS ARE:/);
  assert.match(p, /PLANTED vegetable bed in full growth/);
  // The observed failure, not a paraphrase of it: a row of beds collapsing into one green band.
  assert.match(p, /never merged into one continuous green band, hedge, shrub row or treeline/);
});

test('the hybrid glossary is per-sheet, and silent when the sheet has no such marker', () => {
  const water = buildLockedIllustrationPrompt('Water', 'precision_atlas', 'JoJo Tank 2500L ×2');
  assert.match(water, /JoJo water tank/);
  assert.doesNotMatch(water, /PLANTED vegetable bed/);
  // An unrecognised label must fall back to the WIDEST glossary, never to none — going without one
  // is the exact failure this mapper exists to fix.
  const odd = buildLockedIllustrationPrompt('Some New Sheet', 'precision_atlas', 'Vegetable Bed ×3');
  assert.match(odd, /PLANTED vegetable bed in full growth/);
});

test('every prompt path that can name a vegetable bed describes it as planted, not as bare ground', () => {
  const bedText = '🥬 Vegetable Bed ×9';
  const paths: Array<[string, string]> = [
    ['locked hybrid', buildLockedIllustrationPrompt('Planting', 'precision_atlas', bedText)],
    ['showcase', buildShowcasePrompt('Planting', 'precision_atlas', bedText, 'Ubhejane', 'planting')],
    ['producer', buildProducerPrompt('Planting', 'precision_atlas', bedText, 'full')],
    ['satellite overlay', buildSatelliteOverlayPrompt({
      layerLabel: 'Planting', stylePreset: 'satellite_overlay', elementsText: bedText, sheetKind: 'planting',
    })],
  ];
  for (const [name, prompt] of paths) {
    assert.match(prompt, /PLANTED vegetable bed/, `${name} must say the bed is planted`);
    assert.match(prompt, /never bare or freshly tilled ground/, `${name} must rule out an empty seedbed`);
    assert.match(prompt, /hedge/, `${name} must rule out the hedge reading`);
  }
});

// ── The staple garden ───────────────────────────────────────────────────────────────────────────
//
// A traced AREA, not a placed element, so it reaches the model through the register (painted
// styles) or the fabric channel (Satellite Overlay) rather than as a marker to replace. Rory:
// "when ai or hybrid rendering it needs to show maize and beans etc growing."

test('a staple garden is rendered as a standing maize/bean/pumpkin crop on every AI path', () => {
  const register = 'Staple garden (maize & beans), 🥬 Vegetable Bed ×4';
  const paths: Array<[string, string]> = [
    ['locked hybrid', buildLockedIllustrationPrompt('Planting', 'precision_atlas', register)],
    ['showcase', buildShowcasePrompt('Planting', 'precision_atlas', register, 'Ubhejane', 'planting')],
    ['producer', buildProducerPrompt('Planting', 'precision_atlas', register, 'full')],
    ['satellite overlay', buildSatelliteOverlayPrompt({
      layerLabel: 'Planting', stylePreset: 'satellite_overlay', elementsText: register, sheetKind: 'planting',
    })],
  ];
  for (const [name, prompt] of paths) {
    assert.match(prompt, /maize/i, `${name} must name the maize`);
    assert.match(prompt, /bean/i, `${name} must name the beans`);
    assert.match(prompt, /pumpkin/i, `${name} must name the pumpkin`);
    // The failure mode for a large plain polygon is being painted away as grass.
    assert.match(prompt, /never (mown )?lawn/i, `${name} must rule out painting the plot as lawn`);
  }
});

test('a sheet with no staple garden is never told to draw one', () => {
  const p = buildLockedIllustrationPrompt('Planting', 'precision_atlas', '🥬 Vegetable Bed ×9, Mango Tree');
  assert.doesNotMatch(p, /maize/i);
  // The bed match must not fire on "Staple garden" either — it once did, via a bare /garden/
  // alternative, handing a maize field the planted-vegetable-bed description as well as its own.
  const stapleOnly = buildSatelliteOverlayPrompt({
    layerLabel: 'Planting', stylePreset: 'satellite_overlay',
    elementsText: 'Staple garden (maize & beans)', sheetKind: 'planting',
  });
  assert.match(stapleOnly, /maize/i);
  assert.doesNotMatch(stapleOnly, /PLANTED vegetable bed/);
});

// ── Geometry Lock's photo-preserving styles must not fight their own STYLE_LINES ────────────────
//
// Rory, on a "Full design · Photo Plan · AI hybrid" result: "look how the vegetation from the base
// image shine through — it muddies the image." STYLE_LINES.photo_plan (checked above, in
// isolation) forbids repainting the ground "under any circumstances" — but buildLockedIllustrationPrompt
// used to append "turn this into one hand-illustrated map, paint edge to edge... existing trees and
// shrubs as drawn canopies" right after it, in the SAME prompt. A model asked to both preserve and
// repaint every non-design pixel does a bit of both, which is exactly the muddy half-painted
// canopy over still-visible real bush Rory saw. This is the composed-prompt regression the two
// STYLE_LINES-only tests above could not catch — buildSectorRestylePrompt already had the same fix
// (isPhotoPreservingStyle), and this checks the app's most-used AI path finally matches it.

test('the Geometry Lock hybrid never tells a photo-preserving style to repaint the ground', () => {
  const photoPlan = buildLockedIllustrationPrompt('Planting', 'photo_plan', '🥬 Vegetable Bed ×9');
  for (const paintWord of ['paint edge to edge', 'drawn canopies', 'hand-illustrated']) {
    assert.doesNotMatch(photoPlan, new RegExp(paintWord, 'i'));
  }
  assert.match(photoPlan, /stays the real photographed pixels/i);
  assert.match(photoPlan, /Do not repaint, illustrate, stylise/i);
  // The one thing it IS allowed to add. Growth stage is deliberately not pinned here: Photo Plan
  // now asks for a restrained photomontage, while the painted styles keep their lush/full brief.
  assert.match(photoPlan, /PLANTED vegetable bed/);

  const satOverlay = buildLockedIllustrationPrompt('Planting', 'satellite_overlay', '🥬 Vegetable Bed ×9');
  assert.doesNotMatch(satOverlay, /paint edge to edge/i);
  assert.match(satOverlay, /stays the real photographed pixels/i);
});

test('Photo Plan asks for a restrained photomontage, not a mature-canopy sprite collage', () => {
  const prompt = buildLockedIllustrationPrompt(
    'Planting',
    'photo_plan',
    'Vegetable Bed ×9, Mango Tree ×4, Banana Clump ×5',
  );

  assert.match(prompt, /photorealistic top-down landscape visualisation/i);
  assert.match(prompt, /remove every guide footprint/i);
  assert.match(prompt, /clear photographed ground between neighbouring features/i);
  assert.doesNotMatch(prompt, /full painted canopies|in full growth/i);

  const paper = buildLockedIllustrationPrompt('Planting', 'photo_plan', 'Vegetable Bed ×9', '', 'paper');
  assert.doesNotMatch(paper, /photorealistic top-down landscape visualisation/i,
    'plain paper keeps its botanical-drawing contract');
  assert.match(paper, /remove every guide footprint/i,
    'temporary registration marks must disappear on paper too');
});

test('a painted style gets one edge-to-edge illustration and removes the shared temporary guides', () => {
  const p = buildLockedIllustrationPrompt('Planting', 'precision_atlas', '🥬 Vegetable Bed ×9');
  assert.match(p, /paint edge to edge/i);
  assert.match(p, /PAINT WHAT IS THERE/);
  assert.match(p, /remove every guide footprint, registration mark and identity glyph/i);
  assert.match(p, /one continuous edge-to-edge illustration/i);
  assert.doesNotMatch(p, /stays the real photographed pixels/i);
});

test('the water sheet\'s MATERIAL SEPARATION clause is also style-gated, not just the ground clause', () => {
  // waterArtDirection's "layered watercolor-and-gouache texture" line was a second, independent
  // place the same contradiction could reappear for a Water sheet specifically.
  const waterPhoto = buildLockedIllustrationPrompt('Water', 'photo_plan', 'JoJo Tank 2500L ×2');
  assert.doesNotMatch(waterPhoto, /watercolor-and-gouache/i);
  const waterPainted = buildLockedIllustrationPrompt('Water', 'precision_atlas', 'JoJo Tank 2500L ×2');
  assert.match(waterPainted, /watercolor-and-gouache/i);
});

// ── The exact sheet must be CHOSEN by the filter, not by a ladder of comparisons ────────────────
//
// renderDesignMap used to pick its builder with `filter === 'zones' ? … : 'water' ? … : else
// buildBlueprintWholeMap`. There was no earthworks rung, so selecting Earthworks fell all the way
// through and rendered the masterplan — a sheet captioned "Earthworks map" with "08 — FINAL
// INTEGRATED MASTERPLAN" printed inside it. Rory: "earth works is showing final master plan
// sheet". The defect is the SHAPE, not the missing rung: a ladder whose last step is a real sheet
// can only fail silently, and buildBlueprintEarthworksMap had existed the whole time. Both exact
// paths now pass the filter straight through, so a seventh filter cannot repeat this.
test('both exact render paths pass the filter through instead of enumerating sheets', () => {
  const src = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.match(
    src,
    // Trailing arguments keep getting appended after placeName — `site` for the Water sheet's
    // harvest block, then `labelMode` for codes-vs-names. Matched loosely on purpose: the property
    // this guards is that `filter` is PASSED THROUGH in that position and never re-derived here,
    // and a test that breaks every time an unrelated argument is added stops guarding it and starts
    // just being edited.
    /const composite = await buildReferenceBlueprintMap\(state, frame, refLayers, filter, placeName[^)]*\)/,
    'the single-sheet exact render must pass `filter`, not re-derive the sheet',
  );
  assert.doesNotMatch(
    src,
    /filter === 'zones'\s*\n?\s*\?\s*await buildBlueprintZoneMap/,
    'the per-filter ladder is back — a filter it forgets becomes the masterplan',
  );
  // The exact-ALL batch had its own hand-kept copy of the sheet list, which is how it shipped a
  // "complete" plan set with no sheet 05 in it at all.
  assert.doesNotMatch(src, /\{ f: 'zones', no: '03'/, 'the exact-all batch is hand-listing sheets again');
});

test('paid API auth returns the uid from a verified bearer token', async () => {
  const req = new Request('https://example.test/api/paid', {
    headers: { Authorization: 'Bearer signed-token' },
  });
  const result = await authenticateApiRequest(req, '/api/paid', async (token) => {
    assert.equal(token, 'signed-token');
    return { uid: 'farmer-123' };
  });
  assert.equal(result.uid, 'farmer-123');
  assert.equal(result.response, undefined);
});

test('paid API auth is log-only by default when the verifier rejects a token', async () => {
  const previous = process.env.REQUIRE_API_AUTH;
  delete process.env.REQUIRE_API_AUTH;
  try {
    const req = new Request('https://example.test/api/paid', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    const result = await authenticateApiRequest(req, '/api/paid', async () => {
      throw new Error('bad signature');
    });
    assert.equal(result.uid, null);
    assert.equal(result.response, undefined);
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_API_AUTH;
    else process.env.REQUIRE_API_AUTH = previous;
  }
});

test('oversized paid API bodies are rejected before parsing', () => {
  const req = new Request('https://example.test/api/paid', {
    headers: { 'content-length': String(MAX_API_BODY_BYTES + 1) },
  });
  assert.equal(oversizedApiBodyResponse(req, '/api/paid')?.status, 413);
});

// ── Difference measurement runs small ─────────────────────────────────────────
//
// measureRenderDifference used to rasterise three full-sheet images into three canvases plus
// three RGBA buffers (~60 MB alive at once) inside the render-completion path — the same path iOS
// was killing for memory. The report is fractions and means, resolution-independent statistics,
// and every image gets the IDENTICAL downscale, so a model that returned its input still scores
// as an exact copy. These tests pin the size the comparison actually runs at.

test('the difference measurement caps its raster at MEASURE_MAX_DIMENSION', async () => {
  const { MEASURE_MAX_DIMENSION, measureCompareSize } = await import('../lib/image-producer.ts');
  // Under the cap: compared at native size — no needless resampling of small images.
  assert.deepEqual(measureCompareSize(800, 600), { width: 800, height: 600 });
  // The real case: a High-quality sheet master. Proportional, longest side at the cap.
  const sheet = measureCompareSize(2730, 1930);
  assert.equal(Math.max(sheet.width, sheet.height), MEASURE_MAX_DIMENSION);
  assert.ok(Math.abs(sheet.width / sheet.height - 2730 / 1930) < 0.01, 'aspect must survive the cap');
  // Degenerate inputs never produce a 0-sized canvas (getImageData throws on those).
  assert.deepEqual(measureCompareSize(0, 0), { width: 1, height: 1 });
  // The cap itself: small enough to matter on a phone, big enough that a visible redraw
  // cannot vanish into resampling.
  assert.ok(MEASURE_MAX_DIMENSION >= 512 && MEASURE_MAX_DIMENSION <= 1920);
});

test('every pixel-extraction canvas in the producer is released, not leaked', () => {
  const src = readFileSync(new URL('../lib/image-producer.ts', import.meta.url), 'utf8');
  // No one-shot canvas may hand back its data URL while keeping its buffer alive until GC.
  assert.doesNotMatch(src, /return canvas\.toDataURL\(/,
    'a one-shot canvas is leaking its backing store — use drainCanvasToDataUrl');
  assert.doesNotMatch(src, /return outCanvas\.toDataURL\(/,
    'the restore output canvas is leaking its backing store — use drainCanvasToDataUrl');
  // Each getImageData extraction is followed by a synchronous release: the RGBA copy is what the
  // caller keeps; the canvas that produced it is scratch and must not wait for GC on a phone.
  const extractions = src.match(/getImageData\(0, 0, [^)]*\)\.data;\n\s*releaseCanvas\(/g) ?? [];
  assert.ok(extractions.length >= 3,
    `expected the measure/restore/blank-detector scratch canvases to be released; found ${extractions.length}`);
});
