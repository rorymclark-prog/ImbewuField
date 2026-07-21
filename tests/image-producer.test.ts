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
  // Post-and-wire, not ticks: a ticked line on a map full of planting reads as a row of somethings
  // along the fence, which is half of why a phantom hedge kept appearing there.
  assert.match(p, /round bone posts/);
  assert.match(p, /Posts are circles, never ticks/);
  assert.doesNotMatch(p, /perpendicular tick marks/);
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
  // line exists. Describing "the violet dashed run" whenever a basin exists told the model a run was
  // there when the farmer had drawn none — so it invented one and routed it wherever it liked.
  const basinOnly = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: true, irrigation: true, greywater: true } });
  assert.match(basinOnly, /FILTERED GREYWATER/);
  assert.match(basinOnly, /NO greywater pipe, line or run is drawn anywhere on this sheet/);
  assert.doesNotMatch(basinOnly, /violet dashed run already traced/);
  // The mulch-discharge rule is about the basins, not the line, so it survives either way.
  assert.match(basinOnly, /never onto edible leaves/);
  // With a run actually drawn, it is described — and only then.
  const withRun = buildSatelliteOverlayPrompt({ ...base, systems: { rainwater: true, irrigation: true, greywater: true, greywaterLine: true } });
  assert.match(withRun, /violet dashed run already traced/);
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
