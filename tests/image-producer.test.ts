import test from 'node:test';
import assert from 'node:assert/strict';

import { blendProtectedPixels, countProtectedPixelMismatches, maskEditableFraction, precisionAtlasContextPixels, shouldUseModelChrome } from '../lib/image-producer.ts';
import { buildLockedBackgroundPrompt, buildLockedIllustrationPrompt, buildSatelliteOverlayPrompt, buildSectorRestylePrompt, isModelChromeStyle, buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, STYLE_LINES, SHEET_NO } from '../lib/producer-prompt.ts';
import { ELEMENT_CATALOG } from '../lib/design-elements.ts';
import { isDifferentBuild } from '../lib/pwa-update.ts';
import { preserveCanvasNavigation, type DesignCanvasState } from '../lib/design-canvas.ts';

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

test('geometry lock always overrides free-form model chrome', () => {
  assert.equal(shouldUseModelChrome(true, true), false);
  assert.equal(shouldUseModelChrome(false, true), false);
  assert.equal(shouldUseModelChrome(true, false), true);
  assert.equal(shouldUseModelChrome(false, false), false);
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
  const p = buildLockedIllustrationPrompt('Water', 'precision_atlas');
  assert.ok(p.startsWith(STYLE_LINES.precision_atlas), 'style leads so a length clamp can never cut it');
  // The flat-patch failure: the old locked prompt painted ground only, inside the plot only.
  assert.match(p, /edge to edge/i);
  assert.match(p, /beyond the property boundary/i);
  assert.match(p, /INVENT NOTHING/);
  // Labels, legend and north arrow are the browser's job — the model must not draw text.
  assert.match(p, /no writing, numbers, title, legend/i);
  assert.doesNotMatch(p, /texture the land continuously/);
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
  assert.match(icons, /no leaf rosette of its own/, 'tree basin is distinct from a banana circle');
  assert.match(icons, /raised earth bund/, 'banana circle keeps its own description');
});

test('drip runs are counted from the drawn lines, not from the beds', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water', stylePreset: 'satellite_overlay',
    elementsText: 'Vegetable Bed ×8, Drip irrigation line ×3',
    placeName: 'X', sheetKind: 'water',
  });
  assert.match(p, /exactly as many runs as there are green dashed lines/);
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
  // Previously all=01 zones=02 water=03 planting=04 structures=05 — and every one of those numbers
  // was a DIFFERENT sheet in the printed set (02 is Sector Analysis, not Zones).
  assert.deepEqual(SHEET_NO, { zones: '03', water: '04', planting: '05', structures: '06', all: '07' });
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
});

test('the house is described as a pale roof, so tar can never be painted onto it', () => {
  const p = buildSatelliteOverlayPrompt({
    layerLabel: 'Water',
    stylePreset: 'satellite_overlay',
    elementsText: 'JoJo Tank 5000L ×2',
    sheetKind: 'water',
  });
  assert.match(p, /pale grey shape with the white outline is the ROOF/);
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
  // Boundary/roof/driveway geometry must still be pinned exactly, same as every other style.
  assert.match(p, /KEEP EXACT/);
  assert.match(p, /boundary/i);
  assert.match(p, /roof/i);
  assert.match(p, /driveway/i);
});
