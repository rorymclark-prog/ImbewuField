// The image-producer prompt builder — extracted so BOTH the /api/image-producer route (synchronous
// Gemini path) and the CLIENT (which builds the prompt to hand to the background render queue, see
// lib/render-jobs.ts + functions/) use the identical prompt. Pure function, no server deps.

export type StylePreset =
  | 'precision_atlas'
  | 'satellite_overlay'
  | 'field_ledger'
  | 'homestead_storybook'
  | 'extension_blueprint'
  | 'karoo_folk'
  | 'chatgpt_atlas';

/**
 * Styles where the MODEL draws the labels and the legend, not the browser.
 *
 * Satellite Overlay is the only one: its whole point is a photographic map under a printed graphic
 * overlay, and the legend swatches have to be the same pictorial icons drawn on the map — which the
 * deterministic legend (coloured dots) cannot produce. Selecting it therefore has to win over both
 * the Geometry Lock and the AI-legend toggles, which otherwise route to the browser-drawn chrome.
 */
export function isModelChromeStyle(style: StylePreset): boolean {
  return style === 'satellite_overlay';
}

// STYLE_LINES lives further down (with the showcase-prompt rewrite) since both the strict
// buildProducerPrompt below and the showcase prompts share the one definition.

// What each coloured placeholder marker on the input composite should become. Module-scoped so both
// the strict buildProducerPrompt and the illustrated buildShowcasePrompt share the one legend.
const FEATURE_LEGEND =
  `a green rectangle marker → a tidy vegetable bed full of cabbages and leafy greens; a small cylinder/drum marker → a green cylindrical JoJo water tank; a hive marker → a striped beehive; a tree marker → a fruit tree with a full canopy; a hut/shed marker → that building; ` +
  `a grey/tan tinted polygon area → a real driveway surface (gravel or paving) exactly that shape and size, empty of vehicles; a warm-tan tinted polygon area → a paved outdoor patio exactly that shape and size; a blue tinted polygon area → a real dam or pond of open water exactly that shape and size; ` +
  // Line features — drawn into every composite but previously never explained (audit find):
  `a dusty-violet line → a real farm fence following exactly that path (posts + wire); a gold dashed line → a walking path of exactly that route; a light-blue dashed line → a swale (on-contour water-harvesting ditch with a planted berm) along exactly that line; a dark-blue line → a buried water pipe route (show as a subtle trench-line); a green dashed line → a drip-irrigation line along the beds it crosses; a deep-green line → a windbreak hedge of dense shrubs/trees along exactly that line. `;

function geometryLockTail(): string {
  return (
    'FINAL RULE: the source composite geometry is final. ' +
    'Preserve every boundary, roof, driveway, road, line, zone edge, label anchor and marker exactly where it already is. ' +
    'Repaint only the unprotected background around those features.'
  );
}

/**
 * Geometry Lock's illustration pass — paint the WHOLE sheet, invent nothing.
 *
 * Replaces buildLockedBackgroundPrompt as the locked default. That prompt asked the model to
 * "texture the land continuously without inventing individual trees, beds, ponds, paths or
 * structures" and only inside the plot, which produced exactly what it asked for: a flat green
 * patch clipped into an untouched satellite photo — visibly worse than the deterministic sheet.
 *
 * The fix is not to let the model design more, it is to let it PAINT more. Everything already
 * visible in the photo (existing trees, hedges, lawns, roofs, tracks, neighbouring plots) becomes
 * illustration; nothing that is not already there gets added. The browser still owns every label,
 * legend, north arrow and design overlay, so accuracy is unaffected by the wider brief.
 */
export function buildLockedIllustrationPrompt(
  layerLabel: string,
  stylePreset: StylePreset,
): string {
  const layer = layerLabel.toUpperCase();
  return [
    STYLE_LINES[stylePreset],
    `TASK: turn this whole aerial photograph into one finished hand-illustrated ${layer} map sheet. Paint edge to edge — every corner of the image becomes artwork, including the land beyond the property boundary.`,
    `PAINT WHAT IS THERE: illustrate the real landscape the photo already shows — existing trees and shrubs as drawn canopies, hedges and treelines, mown lawn, rough veld, bare and tilled soil, tracks and driveways, and every building as its full roof seen from directly above. Neighbouring plots are painted in the same hand as the rest of the sheet, never left as raw photograph.`,
    `INVENT NOTHING: add no tree, bed, tank, pond, path, fence, hedge or building that is not already visible in the photograph. Where the ground is open it stays open — illustrated, but empty. Do not decorate, do not fill space, do not tidy the site.`,
    `KEEP THE GEOMETRY: every roof outline, driveway edge, boundary and treeline keeps exactly the shape, size and position the photo shows. Never crop, shrink, rotate, straighten, cover or plant over any part of a roof.`,
    `VIEW AND FRAMING: flat orthographic top-down, north-up plan only. Keep exactly the source crop, scale, aspect ratio and camera position. No oblique view, perspective tilt, 3D camera, horizon, isometric view, rotation, zoom, recentering or reframing.`,
    `NO SHEET FURNITURE: no writing, numbers, title, legend, key, panel, border, compass, north arrow, scale bar, pin, icon or emoji anywhere in the image. The app draws all of those afterwards.`,
    `FINAL CHECK: the entire frame is illustrated with no photographic patches left; every roof and boundary sits exactly where the photo put it; nothing has been added that was not already there; there is no text anywhere.`,
  ].join('\n\n');
}

// Superseded by buildLockedIllustrationPrompt above; kept for an instant call-site rollback.
// Withholds all markers and repaints only the editable open ground.
export function buildLockedBackgroundPrompt(
  layerLabel: string,
  stylePreset: StylePreset,
): string {
  const layer = layerLabel.toUpperCase();
  return [
    STYLE_LINES[stylePreset],
    `GOAL: make a complete, premium ${layer} map-art background. Change only the editable open-ground region; keep every protected source feature unchanged.`,
    `FULL RESTYLE: visibly repaint every editable lawn, veld and soil pixel into rich hand-painted cartography. This must be a decisive illustration pass, not a faint tint, filter or lightly softened satellite photo. Leave no raw, dark or photographic satellite texture in the editable region.`,
    `GROUND TREATMENT: use layered watercolor-and-gouache washes, fine dry-brush grain, varied sage and olive greens, warm buff soil, cool blue-green undertones and crisp tonal separation around protected roofs and access surfaces. Keep open ground open: texture the land continuously without inventing individual trees, beds, ponds, paths or structures.`,
    `CHANGE/PRESERVE CONTRACT: change only the open ground. Do not redraw, reinterpret, extend, split or duplicate any roof or driveway. The app restores clean source geometry and redraws the exact traced structures, access surfaces and design infrastructure deterministically after this artwork pass.`,
    `VIEW AND FRAMING: flat orthographic top-down, north-up plan only. Keep exactly the source crop, scale, aspect ratio and camera position. No oblique view, perspective tilt, 3D camera, horizon, isometric view, rotation, zoom, crop, recentering or reframing.`,
    `BACKGROUND ONLY: add no objects or infrastructure and no decorative icons, map-tool symbols, emoji, pins, callouts, writing, title, legend, panel, border, compass, scale bar or labels.`,
    `FINAL CHECK: the editable land is richly and fully illustrated; protected geometry is unchanged; nothing new has been added; the source framing is unchanged.`,
  ].join('\n\n');
}

// The producer illustrates the marked elements beautifully and recognisably, in place, inventing
// nothing new. The composite the model receives has the farmer's placed elements drawn as coloured
// markers; elementsText names what each is so the model draws it as the real thing.
export function buildProducerPrompt(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  mapKind: 'base' | 'full' = 'full',
  retry = false,
  designBrief = '',
): string {
  const isLayerMap = !!layerLabel && layerLabel !== 'Full design';
  const titleLabel = layerLabel ? ` (${layerLabel})` : '';
  const task = mapKind === 'base'
    ? `TASK: edit this satellite photo of a real South African smallholding into a faithful illustrated base map${titleLabel}. Draw the site exactly as it exists today, using the photo as the geometry source.`
    : `TASK: edit this satellite photo of a real South African smallholding${titleLabel} into a faithful illustrated site map.`;
  const layerFocus = isLayerMap
    ? `LAYER FOCUS: this is the ${layerLabel!.toUpperCase()} sheet. Make that layer the clearest thing on the page. The rest of the site stays a calm supporting background in the same style.`
    : `LAYER FOCUS: paint the whole property as one complete illustrated map, with the real site layout preserved from the source image.`;
  const keepExact =
    `KEEP EXACT: preserve the source framing, scale, crop and north-up orientation. Keep the property boundary, driveway, road, roofs and all marked features in the same pixels and the same counts.`;
  const viewRule =
    `VIEW: flat orthographic top-down plan only. No oblique shot, no perspective tilt, no 3D camera, no horizon, no isometric view.`;
  // This is the artwork pass only. The app adds the title, legend, north arrow and scale after
  // generation. Asking the model for those here made it shrink/reframe the source map, then the
  // deterministic compositor added a second panel around an already-reframed image.
  const layoutRule =
    `CANVAS: produce edge-to-edge map artwork at exactly the source crop, scale and orientation. ` +
    `Do not add a title block, legend panel, paper border, north arrow, scale bar or outer margin. ` +
    `Do not rotate, zoom, shrink, crop, recenter or reframe the property. Use the selected style's palette and brushwork only; the app adds all sheet furniture afterwards.`;
  const noInvent =
    `NO INVENT: do not add any roads, roofs, trees, beds, ponds, paths, labels, shadows or other features that are not already marked or visible in the source image.`;
  const drawBlock =
    `DRAW: ${FEATURE_LEGEND}${elementsText ? `The marked features for this sheet are: ${elementsText}. ` : ''}` +
    `Paint each marked feature as a clear, recognisable illustration, and only the features that are already marked.`;
  const markerCleanup =
    `MARKER CLEANUP: coloured footprints are temporary placement guides, not finished artwork. ` +
    `Replace them with the named real feature. Do not copy any emoji, map pin, tool icon, badge, ` +
    `selection handle or other editor symbol into the output.`;
  const textRule =
    `NO TEXT in the painted artwork itself: no captions, banners, signage, numbers or compass rose inside the illustration. Labels are added separately after rendering.`;
  const buildingRule =
    `BUILDINGS: paint each building as its full roof seen from directly above, and only the buildings named in the marked-feature list.`;
  const houseRule =
    `HOUSE RULE: keep the house whole and fully visible. Do not crop, clip, cut off or push the roof off the sheet.`;
  const styleRule = isLayerMap
    ? `STYLE NOTE: keep the open ground quiet and natural so the ${layerLabel} layer reads clearly. Use muted grass, veld and soil textures around the marked features.`
    : `STYLE NOTE: paint the whole plot as a finished illustrated landscape with living land, visible ground texture and crisp property edges.`;
  const waterRule = /water/i.test(layerLabel ?? '')
    ? `WATER SHEET: make the water network the hero. Use a crisp editorial plan-sheet composition with clear callouts and grouped legend sections for RAINWATER, IRRIGATION, FILTERED GREYWATER and NOTES. Show only tanks, taps, pumps, filters, overflow basins, swales, pipes and drip lines that are already marked or visible; do not invent extra water systems or extra water-related landforms.`
    : '';

  const briefBlock = designBrief
    ? `\n\n=== MASTER DESIGN BRIEF — EVERY SHEET SHARES THIS ONE DESIGN ===\n` +
      `This site has ONE permaculture design. Every sheet in this plan set (base map, zones, water, planting, structures, whole design) depicts THIS SAME design from a different angle, so every sheet must agree about where things are and what they are. The placements below were measured from the real site and are final: do not re-imagine, re-arrange, re-position, resize, rename or re-invent any of them, and never move anything between sheets. Compass directions are relative to the plot and north is the top of the image.\n` +
      `${designBrief}\n` +
      `HOW TO USE THIS BRIEF: it is reference, not a drawing list. It exists so this sheet agrees with its sibling sheets — nothing more. Draw only this sheet's own layer, exactly as instructed above: anything named in this brief that is not in this sheet's marked-features list belongs to a different sheet and must not be drawn here.\n` +
      `=== END MASTER DESIGN BRIEF ===`
    : '';

  // STYLE leads, so if a downstream length clamp ever bites, the one line the model most needs
  // (the art style) is never the part that gets cut. (This was the truncation bug: a 2 000-char
  // worker clamp on a ~4 500-char prompt dropped the trailing STYLE line entirely.)
  const retryBlock = retry
    ? `IMPORTANT: the previous attempt left the plot blank or overly plain. This attempt should paint every editable area as living land.`
    : '';

  return [
    STYLE_LINES[stylePreset],
    task,
    layerFocus,
    keepExact,
    viewRule,
    layoutRule,
    noInvent,
    waterRule,
    drawBlock,
    markerCleanup,
    textRule,
    buildingRule,
    houseRule,
    styleRule,
    retryBlock,
    briefBlock,
    geometryLockTail(),
  ].filter(Boolean).join('\n\n');
}

// Legacy prompt retained for a clean rollback / A-B comparison. Keep this callable so the UI can
// flip the rewritten prompt off without changing the rest of the render path.
export function buildProducerPromptLegacy(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  mapKind: 'base' | 'full' = 'full',
  retry = false,
  designBrief = '',
): string {
  const noWrite =
    `ABSOLUTELY NO WRITING: the output image must contain ZERO text, letters, words, labels, captions, numbers, legends, banners, signage, compass rose or watermark — not on features, not in corners, nowhere. If you are about to draw any glyph, do not. (Labels are added separately afterwards.) `;
  const noInvent =
    `DO NOT INVENT: draw only what is already visible or marked — no extra gardens, beds, paths, ponds, trees, buildings, fences, vehicles, animals, people or decorations. `;
  const orient =
    `Keep the crop, scale and orientation identical (top of image is north); make the property boundary the crispest line.`;
  const fillIt =
    `PAINT THE WHOLE PLOT: illustrate the ENTIRE area inside the property boundary as a complete, richly hand-painted garden map — the ground (grass, veld, soil, cultivated earth), every building, existing trees and shrubs, and paths. NEVER leave any area blank, white, plain, empty or unpainted — even if only a few features are marked, the whole plot must be a finished, beautiful illustration that matches the real photo's layout. `;
  const roofs =
    `BUILDINGS ARE ROOFS: paint the main house as its roof seen from directly above, matching the exact roof outline and colour visible in the photo — never as a floor plan, never with interior walls, never as a plain white shape. ` +
    `STRICT BUILDING RULE — READ THIS TWICE: paint ONLY the main house's roof, plus any building explicitly marked in the list below. Do NOT paint a second building, shed, carport, garage or any other outbuilding ANYWHERE on the plot, even if a shape near the driveway, a gate, a shadow or a tree canopy looks roof-like to you — those are ALWAYS ground, vegetation or hardstanding, never a structure, unless that exact structure is named in the marked-features list. When in doubt, it is not a building. `;

  const task = mapKind === 'base'
    ? `\nTASK: repaint this satellite photo of a REAL South African smallholding as a beautiful illustrated BASE MAP of the land exactly as it is today${layerLabel ? ' (the ' + layerLabel + ')' : ''}. Paint what the photo actually shows — the main house, existing trees and vegetation, lawn, bare ground, paths and driveway — plus exactly the marked existing features, and no other buildings (see the strict building rule below). `
    : `\nTASK: turn this satellite photo of a REAL South African smallholding${layerLabel ? ' (the ' + layerLabel + ')' : ''} into a beautiful illustrated site map. `;

  const isLayerMap = !!layerLabel && layerLabel !== 'Full design';
  const layerFocus = isLayerMap
    ? `SINGLE-LAYER SHEET — READ CAREFULLY: this is the ${layerLabel!.toUpperCase()} sheet of a plan set and must communicate ONLY the ${layerLabel} layer. Every other layer has its own sheet. Do NOT illustrate vegetable beds, crop rows, orchards, flower borders, livestock, tanks or structures unless that exact element is named in the marked-features list below. Existing vegetation stays as plain, flat, muted canopy/ground — never elaborated into a designed garden. `
    : '';

  const fillItCalm =
    `PAINT THE WHOLE PLOT, BUT CALMLY: illustrate the ENTIRE area inside the property boundary — never leave any area blank, white, plain or unpainted — but keep it a QUIET BASE: plain grass, veld, bare soil and existing tree canopies in flat, muted, low-contrast tones, matching the real photo's layout. The ${layerLabel} content must be the only thing that stands out. `;

  const rules =
    (retry ? `IMPORTANT — YOUR PREVIOUS ATTEMPT FAILED: it left the plot blank / plain white. That is unacceptable. Every part of the plot must be painted as living land this time. ` : '') +
    noWrite + noInvent +
    task +
    layerFocus +
    (isLayerMap ? fillItCalm : fillIt) + roofs +
    `Redraw EACH marked feature as an attractive, instantly-recognisable illustration exactly where it is marked and at the same count — ` +
    FEATURE_LEGEND +
    (elementsText ? `The marked features are: ${elementsText}. ` : '') +
    `Keep the main house, driveway, road and the property boundary exactly in their true position, shape and size; ` +
    `the driveway is a simple access track of the exact traced shape — do NOT turn it into a loop, roundabout, circular drive or turning circle, and do not add extra branches to it; ${orient}`;

  const briefBlock = designBrief
    ? `\n\n=== MASTER DESIGN BRIEF — EVERY SHEET SHARES THIS ONE DESIGN ===\n` +
      `This site has ONE permaculture design. Every sheet in this plan set (base map, zones, water, planting, structures, whole design) depicts THIS SAME design from a different angle, so every sheet MUST agree with every other about WHERE everything is and WHAT it is. The placements below were measured from the real site and are FINAL: do not re-imagine, re-arrange, re-position, resize, rename or re-invent any of them, and never move anything between sheets. Compass directions are relative to the plot and north is the top of the image.\n` +
      `${designBrief}\n` +
      `HOW TO USE THIS BRIEF: it is REFERENCE, not a drawing list. It exists so that this sheet agrees with its sibling sheets — nothing more. You must still draw ONLY this sheet's own layer, exactly as instructed above: anything named in this brief that is NOT in this sheet's marked-features list belongs to a different sheet and must NOT be drawn here.\n` +
      `=== END MASTER DESIGN BRIEF ===`
    : '';

  // STYLE leads, so if a downstream length clamp ever bites, the one line the model most needs
  // (the art style) is never the part that gets cut. (This was the truncation bug: a 2 000-char
  // worker clamp on a ~4 500-char prompt dropped the trailing STYLE line entirely.)
  return `${STYLE_LINES[stylePreset]}\n\n${rules}${briefBlock}`;
}

// Illustrated "showcase" prompt — let gpt-image-2 produce a frame-worthy illustrated site plan
// that draws its OWN tidy legend + a few selective labels, instead of the strict no-text pipeline
// that burns our labels on afterwards.
//
// REWRITTEN 2026-07-18 (Fable audit, wf_98da8bd6-d7e) after Rory's own direct-ChatGPT results
// ("a simple prompt") consistently beat this app's output. The audit's diagnosis: the assembled
// prompt had grown to ~5,900 chars (style directive only 4.4% of it) — 15 NEVERs/11 DO-NOTs whose
// forbidden nouns ("shed, carport, garage", "Zone 0/1/2…") plausibly PRIMED the exact bugs they
// were trying to prevent (negation backfire), the full FEATURE_LEGEND + design brief were pasted
// into every sheet describing features that sheet doesn't have (an image model can't honour
// "reference only, do not draw"), and geometry was policed in three redundant paragraphs even
// though the /v1/images/edits COMPOSITE INPUT is what actually anchors geometry (it's processed at
// gpt-image-2's fixed high fidelity — see functions/src/index.ts). Positive-only, per-sheet-filtered
// instructions replace all of that: absence beats negation, and each sheet's marker legend now only
// ever names markers that CAN exist on that sheet (mirrors itemInFilter/lineInFilter below), so a
// non-Zones sheet structurally cannot be told about zones — no counter-rule needed.
export type ShowcaseSheetKind = 'all' | 'zones' | 'water' | 'planting' | 'structures';

// Shared plan-set anchor, appended to every style. This is the cross-sheet CONSISTENCY fix: the 5
// sheets of one batch are 5 independent, stateless OpenAI calls (no seed, no shared reference image
// on this endpoint) sharing only this text — so it carries the one thing text CAN pin reliably,
// colour temperature, plus an explicit anti-drift instruction. (The Zones sheet in particular used
// to read warmer/more orange than its siblings — its composite is dominated by red/orange/gold zone
// fills, which pulled the model's own white balance; the M.zones line below addresses that directly.)
const PLAN_SET_ANCHOR =
  ' This sheet is one page of a five-sheet plan set painted in one sitting with one fixed palette: identical colour temperature, paper tone, line weight and brushwork on every sheet. Flat even midday daylight, neutral white balance — no golden-hour warmth, no orange cast, no vignette.';

// The photographic sibling of PLAN_SET_ANCHOR. The painted anchor above mandates "painted in one
// sitting … brushwork", and it sits in the strongest (final) position of the style line — appending
// it to a keep-the-photograph style would argue directly against that style's one essential rule.
const PLAN_SET_ANCHOR_PHOTO =
  ' PLAN SET: this sheet belongs to one set printed in one sitting — identical line weight, identical icon design, identical panel tone and identical lettering on every sheet. Neutral daylight, no warm or orange cast, no vignette, no filter.';

// Every style MUST render the ground as living land — a style that swaps the plot for "paper" or
// blank white is exactly the satellite-disappears failure. Named colours (not just mood words) give
// the model something concrete to hold constant across the 5 independent calls of one batch.
export const STYLE_LINES: Record<StylePreset, string> = {
  precision_atlas:
    'STYLE — Precision Atlas: premium flat orthographic landscape cartography with the lush hand-painted finish of a commissioned garden masterplan. Use layered transparent watercolor washes plus controlled gouache detail, fine dry-brush ground grain, disciplined ink edges and strong figure-ground clarity. Fixed palette: deep slate roofs, layered sage and olive land, cool blue-green accents, warm buff soil, charcoal linework and parchment cream. The result is richly illustrated and print-ready, never a dark satellite filter, never photorealistic, never oblique or isometric.' + PLAN_SET_ANCHOR,
  // The only style that KEEPS the aerial photograph. Everything else here repaints it away, so this
  // entry gets the photographic plan-set anchor, never the painted one.
  satellite_overlay:
    'STYLE — Satellite Overlay: the real aerial photograph stays the map, and a crisp printed graphic overlay is drawn on top of it. This is a known genre — the annotated satellite overlay used for irrigation schemes, park interpretive maps and resort site plans. The dark green satellite imagery, real roofs, real tree canopies, real shadows and real ground textures all remain photographic and sharp; the only drawn artwork is the overlay layer — small semi-3D pictorial icons with soft drop shadows, a bright yellow-green surveyed boundary line with regular perpendicular tick marks, near-black tar surfaces, bright blue dotted irrigation runs, white ALL-CAPS labels on thin white leader lines with small arrowheads, and a cream legend panel with dark editorial type down the right side, all inside a dark rounded-corner sheet frame. Fixed palette over the photographic base: chartreuse #B4E000, tank blue #2F6FB5, water blue #2E9BFF, earth brown #7A5230, foliage green #4E8B3A, near-black tar #12140F, cream panel #F6F1E4, titling charcoal #1E2418, white lettering. Vector-clean linework and even drop shadows throughout: hard-edged flat vector graphics floating over raw lens imagery — every pixel that is not overlay is the satellite photograph exactly as supplied, native grain, native colour, straight from the sensor.' + PLAN_SET_ANCHOR_PHOTO,
  field_ledger:
    'STYLE — Field Ledger: a hand-inked site plan — fine dark sepia pen linework over rich watercolour, warm credible surveyor character. Fixed palette: sage-green lawn, olive veld, warm buff soil, slate-grey roofs, muted terracotta accents, off-white paper panels. The ground is always painted as living land with visible lawn/veld/soil texture.' + PLAN_SET_ANCHOR,
  homestead_storybook:
    'STYLE — Homestead Storybook: a saturated gouache picture-book garden map, rounded beds bursting with vegetables, canopy-textured fruit trees, whimsical but legible. Fixed palette: leaf green, warm ochre, terracotta, cream, denim-blue water, charcoal linework.' + PLAN_SET_ANCHOR,
  extension_blueprint:
    'STYLE — Extension Blueprint: a polished flat orthographic technical site plan with disciplined ink linework, subtle hand-painted terrain texture, strong figure-ground contrast and high legibility at small print size. Fixed palette: deep slate roofs, layered olive and sage vegetation, cool blue-green water accents, warm buff soil, charcoal linework and off-white paper. The ground remains richly textured living land, never blank white, while every structure stays directly top-down with no perspective or isometric distortion.' + PLAN_SET_ANCHOR,
  karoo_folk:
    'STYLE — Karoo Folk Map: a bold naive folk-art farm map, flattened bird’s-eye view, decorative South African folk-pattern textures, charming handmade brushwork. Fixed palette: barn red, cobalt blue, sunflower yellow, pine green, whitewash cream.' + PLAN_SET_ANCHOR,
  chatgpt_atlas:
    'STYLE — ChatGPT Atlas: polished editorial cartography with a hand-painted feel, crisp plan-sheet composition, soft watercolor terrain washes, disciplined ink linework, cream paper border, and highly legible labels. Fixed palette: olive greens, muted blue-greys, warm ochre, parchment cream, charcoal text. The map reads like a premium printed design sheet from the direct ChatGPT examples.' + PLAN_SET_ANCHOR,
};

// Per-sheet marker legends — POSITIVE ONLY. Each sheet's prompt names only the markers that can
// exist on that sheet (mirrors itemInFilter/lineInFilter in DesignGlossy.tsx), so absent features
// are never primed and zone entries can never leak onto a non-Zones sheet — by construction, not by
// telling the model "never do X" (the thing the audit found backfires).
const M = {
  bed: 'green rectangles are vegetable beds full of cabbages and leafy greens',
  tank: 'a small drum marker is a green cylindrical JoJo water tank',
  hive: 'a hive marker is a striped beehive',
  tree: 'a tree marker is a fruit tree with a full canopy',
  building: 'a hut or shed marker is that building',
  dam: 'a blue area is a dam or pond of open water, exactly that shape',
  patio: 'a warm-tan area is a paved outdoor patio, exactly that shape',
  driveway: 'the grey strip is the existing driveway — a plain tar access track of exactly its traced shape, empty of vehicles',
  fence: 'a dusty-violet line is a farm fence of posts and wire along exactly that path',
  path: 'a gold dashed line is a walking path along exactly that route',
  swale: 'a light-blue dashed line is a swale — a planted water-harvesting ditch on contour',
  pipe: 'a dark-blue line is a buried water-pipe route, shown as a subtle trench line',
  drip: 'a green dashed line is a drip-irrigation line',
  windbreak: 'a deep-green line is a windbreak hedge of dense shrubs and trees',
  zones: 'the large coloured bands are the permaculture zones (Zone 0–5) — paint each as a soft translucent tinted wash laid over the illustrated land, keeping the land, buildings and lighting beneath them in the style’s own palette and neutral daylight, never tinted warm by the band colours',
} as const;

const LEGEND_BY_SHEET: Record<ShowcaseSheetKind, string> = {
  all: [M.bed, M.tree, M.windbreak, M.tank, M.dam, M.swale, M.pipe, M.drip, M.building, M.hive, M.patio, M.fence, M.path, M.driveway, M.zones].join('; '),
  zones: [M.zones, M.driveway].join('; '),
  water: [M.tank, M.dam, M.swale, M.pipe, M.drip, M.driveway].join('; '),
  planting: [M.bed, M.tree, M.windbreak, M.driveway].join('; '),
  structures: [M.building, M.hive, M.patio, M.fence, M.path, M.driveway].join('; '),
};

export function buildShowcasePrompt(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  placeName = '',
  sheetKind: ShowcaseSheetKind = 'all',
): string {
  const title = `${(layerLabel ?? 'Site plan').toUpperCase()}${placeName ? ' — ' + placeName : ''}`;
  const singleLayer = sheetKind !== 'all'
    ? `SHEET FOCUS: this sheet shows one layer of the plan. The named features are the stars, while the rest of the plot stays a quiet softly painted base of lawn, veld and existing buildings in the same style.`
    : `SHEET FOCUS: this is the full plan sheet, so all named features are shown together and the whole site reads as one coherent illustrated map.`;
  const labels = `${elementsText}${placeName ? '; ' + placeName : ''}`;
  const noInvent =
    `NO INVENT: do not add any roads, roofs, trees, beds, ponds, paths, labels, shadows or other features that are not already marked or visible in the source image.`;
  const waterRule = sheetKind === 'water'
    ? `WATER SHEET: make the water network the hero. Use a crisp editorial plan-sheet composition with clear callouts and grouped legend sections for RAINWATER, IRRIGATION, FILTERED GREYWATER and NOTES. Show only tanks, taps, pumps, filters, overflow basins, swales, pipes and drip lines that are already marked or visible; do not invent extra water systems or extra water-related landforms.`
    : '';
  const markerCleanup =
    `MARKER CLEANUP: coloured footprints are temporary placement guides, not finished artwork. ` +
    `Replace them with the named real feature. Do not copy any emoji, map pin, tool icon, badge, ` +
    `selection handle or other editor symbol into the output.`;
  return [
    STYLE_LINES[stylePreset],
    `TASK: edit this satellite photo of a real South African smallholding into a beautiful hand-illustrated site plan sheet titled "${title}".`,
    `KEEP EXACT: stay faithful to the photo and preserve the original framing, boundary, driveway, roof outlines, scale and north-up orientation. Draw the illustration inside the site exactly where the source image places it.`,
    `VIEW: flat orthographic top-down plan only. No oblique shot, no perspective tilt, no 3D camera, no horizon, no isometric view.`,
    `LAYOUT: use a landscape plan sheet with the map filling the left side and a clean right-hand title/legend panel on the right, like the direct-ChatGPT plan sheets.`,
    noInvent,
    waterRule,
    `DRAW: each coloured marker on the photo is a placeholder. Paint the real thing in its place, same spot, same size and same count: ${LEGEND_BY_SHEET[sheetKind]}. This sheet's features are: ${elementsText}. Ground with no marker stays open lawn or veld, unchanged.`,
    markerCleanup,
    `LABELS AND PANELS: in the corner with the least map content, place a clean paper title block reading "${title}" as the largest lettering on the sheet, a tidy legend for the feature types, and a small north arrow. Label up to six important features in small elegant lettering beside them, using exactly these spellings: ${labels}. These are the only words anywhere on the sheet, all horizontal and print-legible.`,
    singleLayer,
    geometryLockTail(),
  ].filter(Boolean).join('\n\n');
}

const SHEET_NO: Record<ShowcaseSheetKind, string> = {
  all: '01', zones: '02', water: '03', planting: '04', structures: '05',
};

// One icon description per marker type. The composite hands the model flat coloured placeholder
// shapes; each line says what finished graphic replaces that shape. Written as "marker → icon" so
// the mapping is unambiguous.
const OVERLAY_ICONS: Record<string, string> = {
  tank:      'a small drum/cylinder marker → a blue cylindrical JoJo water tank seen from a high top-down angle, ribbed body, darker lid disc, soft shadow to the lower-right',
  tap:       'a small tap/valve marker → a blue-grey faucet on a short post with a concrete base pad',
  dam:       'a blue area marker → a pond of exactly that shape and size: deep-blue water, a ring of grey stone edging, two or three small lily pads',
  basin:     'a greywater/basin marker → a circular planted rosette of green leaves inside a brown earth ring',
  banana:    'a banana-circle marker → a circular pit ringed in brown earth with a rosette of broad green banana leaves radiating from the centre',
  mulch:     'a mulch-bank marker → a crescent-shaped band of green-over-brown mulch following exactly that arc',
  borehole:  'a borehole marker → a small blue concentric-circle target with a grey collar ring',
  bed:       'a green rectangle marker → a vegetable bed: brown tilled soil in parallel strips with regular rows of small green plants',
  tree:      'a tree marker → a rounded green canopy disc with a soft shadow offset to the lower-right',
  hive:      'a hive marker → a small stacked striped beehive box',
  building:  'a hut or shed marker → leave the real roof from the photograph exactly as it is and outline it only',
  patio:     'a warm-tan area marker → a paved patio of exactly that shape, laid in a regular slab pattern',
  fence:     'a dusty-violet line → a fence line: a thin dark line with small regular posts',
  path:      'a gold dashed line → a walking path: a warm buff strip with soft edges',
  swale:     'a light-blue dashed line → a swale: a slim on-contour channel with a green planted berm on its downhill side',
  pipe:      'a dark-blue line → a buried pipe: a thin solid navy line',
  drip:      'a green dashed line → a drip-irrigation run: a bright #2E9BFF line with small evenly spaced dots along it',
  windbreak: 'a deep-green line → a windbreak: a dense row of small green canopy discs',
};

const ICON_KEYS_BY_SHEET: Record<ShowcaseSheetKind, string[]> = {
  all:        ['bed', 'tree', 'windbreak', 'tank', 'tap', 'dam', 'basin', 'banana', 'mulch', 'borehole', 'swale', 'pipe', 'drip', 'building', 'hive', 'patio', 'fence', 'path'],
  zones:      ['building', 'path', 'fence'],
  water:      ['tank', 'tap', 'dam', 'basin', 'banana', 'mulch', 'borehole', 'swale', 'pipe', 'drip'],
  planting:   ['bed', 'tree', 'windbreak', 'mulch', 'banana'],
  structures: ['building', 'hive', 'patio', 'fence', 'path'],
};

// Only describe icons this sheet can actually contain. Describing an icon the sheet has no marker
// for is how a prompt talks a model into drawing one.
const ICON_MATCH: Record<string, RegExp> = {
  tank: /tank|jojo/i, tap: /tap|standpipe|faucet/i, dam: /dam|pond/i,
  basin: /basin|greywater|grey water/i, banana: /banana/i, mulch: /mulch/i,
  borehole: /borehole|well/i, bed: /bed|garden|veg/i, tree: /tree|orchard|fruit/i,
  hive: /hive|bee/i, building: /house|shed|hut|barn|building|structure/i,
  patio: /patio|paving|courtyard/i, fence: /fence/i, path: /path|walkway/i,
  swale: /swale/i, pipe: /pipe/i, drip: /drip|irrigation/i, windbreak: /windbreak|hedge/i,
};

/**
 * Satellite Overlay — the only prompt that KEEPS the aerial photograph.
 *
 * Separate from buildShowcasePrompt because that one's body hard-codes "hand-illustrated" and
 * "paint the real thing in its place", which is the exact opposite of this style's one essential
 * rule. The model letters this sheet itself: labels, legend, title, north arrow and scale bar all
 * come from the model, because the legend swatches must be the same pictorial icons it draws on
 * the map — something the browser's coloured-dot legend cannot produce.
 */
export function buildSatelliteOverlayPrompt(args: {
  layerLabel: string;
  stylePreset: StylePreset;
  elementsText: string;
  placeName?: string;
  sheetKind: ShowcaseSheetKind;
}): string {
  const { layerLabel, stylePreset, elementsText, placeName, sheetKind } = args;
  const sheetNumber = SHEET_NO[sheetKind] ?? '01';
  const title = `${sheetNumber} — ${(layerLabel || 'SITE').toUpperCase()} PLAN`;

  const keys = ICON_KEYS_BY_SHEET[sheetKind] ?? ICON_KEYS_BY_SHEET.all;
  const present = keys.filter((k) => ICON_MATCH[k]?.test(elementsText));
  const iconSpec = (present.length ? present : keys).map((k) => OVERLAY_ICONS[k]).join('; ');

  // Strip the editor glyphs before they reach the prompt. They still do their identifying work in
  // the input IMAGE, where they are drawn onto each marker — but this sheet's labels are lettered
  // by the model, and an emoji sitting in the text it is told to "spell exactly" is an invitation
  // to letter it onto the sheet. Nothing here needs them.
  const elementNames = elementsText
    .replace(/[\p{Extended_Pictographic}️⃣]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();

  // The reference sheet reads as three named subsystems, and Rory's standing rule is that the
  // greywater half is never left off a water plan — it is the part farmers actually get wrong.
  const waterSystems = sheetKind === 'water'
    ? `\n\nWATER SHEET — THREE SUBSYSTEMS, ALL THREE SHOWN. Group everything on this sheet, on the map and in the legend, under three headings: RAINWATER (roof gutters and downpipes, first-flush/leaf filter, the linked tanks, pump and filter, overflow infiltration basin), IRRIGATION (the buried main, drip headers and laterals lying along the beds, isolation and flush valves, pressure regulator, outdoor taps), and FILTERED GREYWATER (the diverter and filter off the house, the subsurface greywater line drawn as a violet dashed run, inspection and flush points along it, and every basin it feeds — run it to the banana circles first, which are the ideal greywater destination, then on to the tree basins and any greywater basin). The greywater half is never omitted: wherever the design places a greywater basin, a banana circle or a tree basin, show the violet greywater line that feeds it running from the house to those basins, and give FILTERED GREYWATER its own legend section. Greywater discharges below mulch, never onto edible leaves.`
    : '';

  // Every element becomes a literal legend row. Enumerating the rows as CONTENT — rather than
  // describing what a row should look like — is what stops elements silently vanishing from the
  // sheet (a placed Small Pond was dropped from both map and legend on a real render).
  const legendRows = elementNames
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^(.*?)\s*\u00d7\s*(\d+)$/);
      return m ? `\u2014 ${m[1].trim()} (\u00d7${m[2]})` : `\u2014 ${t} (\u00d71)`;
    })
    .join('\n');

  const body = `TASK: this is sheet "${title}"${placeName ? ` for ${placeName}` : ''}. You are editing a real satellite photograph of a South African smallholding on which the farmer's design is already marked as flat coloured placeholder shapes. Deliver one landscape plan sheet whose map is that same photograph with a crisp graphic overlay drawn on top of it.

1. THE RULE ABOVE ALL OTHERS — KEEP THE PHOTOGRAPH. The supplied aerial imagery remains the map background across the entire map area, corner to corner, inside and outside the property boundary, at full sharpness: real roof sheeting, real tree crowns, real dirt tracks, real shadows, real colour, real grain. Work like someone drawing on tracing paper laid over a print — the print shows through everywhere. Every square metre with no overlay element on it is finished the moment you leave it alone: it ships as raw photograph, native grain, native colour. The contrast between untouched photo and crisp graphics is the whole look.

2. WHAT YOU DRAW, AND ONLY THIS: (1) a pictorial icon in place of each coloured placeholder marker, (2) the boundary line, (3) the tar driveway fill, (4) the irrigation lines, (5) white labels with leader lines, (6) the cream legend panel, (7) a north arrow and a scale bar. Everything else in the frame is untouched photograph.

3. THE SHEET LAYOUT IS ALREADY IN PLACE in the supplied image: the photographic map on the left, a blank cream panel down the right. Fill the panel, overlay the map, and leave the photograph exactly where it sits — nothing is resized, shifted or re-cropped to make room.

4. THE COLOURED MARKERS ARE PLACEMENT GUIDES. Each coloured shape already on the photograph marks where one designed element goes. Replace each marker with one finished pictorial icon in exactly the same spot, at the same size, in the same quantity, at a gentle three-quarter overhead angle in map-icon style, with a soft grey drop shadow so it lifts off the photo. Every icon reads instantly at postcard size and casts the same soft shadow in the same direction. Ground with no marker keeps its untouched photograph and gets nothing. The open lawn is mown grass and stays mown grass; bare ground stays bare. A finished sheet has exactly as many plants, beds and structures as the photograph and the markers already show — the empty parts of this farm are empty on purpose, and showing them empty is what makes the plan truthful.

5. ICON LANGUAGE — small, crisp, semi-3D, clean saturated graphics with simple shading: ${iconSpec}.

6. THIS SHEET'S ELEMENTS AND EXACT SPELLINGS: ${elementNames}. Each marker on the photograph carries a small printed glyph identifying it; the finished pictorial icon replaces the whole marker, glyph included. The "×N" counts are the exact number of that icon to place: one marker, one icon — the marker count is the icon count.

7. THE TWO DARK SHAPES ARE DIFFERENT THINGS. The building is a roof: it has ridges, hips and pitched planes, it casts a shadow, and it keeps every edge and every wing exactly as photographed. The driveway is flat ground: a smooth tar surface at ground level. They never merge, and no part of a roof becomes road surface.

8. LINES DRAWN OVER THE PHOTO. Property boundary: a bright chartreuse #B4E000 line with short perpendicular tick marks at regular intervals along its full length, both sides, like a surveyed fence line — the boldest, crispest line on the sheet. Tarred driveway: a solid near-black #12140F polygon of exactly its real traced shape, captioned "TARRED DRIVEWAY" in small white caps beside it. Irrigation and routes are already traced on the photograph, each in its own colour — redraw each one along exactly the line it is already on, and add no connection that is not already drawn: the green dashed lines are the drip-irrigation runs, redrawn as runs of small bright #2E9BFF dots that lie along the vegetable beds themselves — one run down each bed, on the growing rows, never along a walking path or between the beds; the dark-blue line is the buried pipe, redrawn as a thinner solid navy line; the light-blue dashed line is a swale, redrawn as a slim channel with a green planted berm on its downhill side.${waterSystems}

9. LABELS — YOU DRAW THEM. Label every marked element in small white uppercase sans-serif, even in size, horizontal, sitting on open photographic ground clear of the icons, joined to its icon by a hairline white leader line ending in a small filled white arrowhead. Where several identical items sit together, use one grouped label carrying the count: "2 × JOJO TANKS 5000L EACH", "2 × BANANA CIRCLES". Where the same element type appears in separate parts of the site, label each one plainly with its own name and let its leader line show which it is. Spell every label exactly as the element list gives it, in caps.

10. LEGEND PANEL — YOU DRAW IT TOO. On the cream right-hand panel, in dark #1E2418 type: the title "${title}" as the largest lettering on the sheet${placeName ? `, and beneath it "${placeName}" in smaller grey lettering` : ''}. Then a single left-aligned, evenly spaced column with one row per element TYPE present on the map: on the left a LARGE version of that element's own pictorial icon — the identical icon drawn on the map, at legend size — then the element name in dark sentence case, then its count in round brackets on the same line. Render EXACTLY these rows, every one of them, in this order, each led by that element's own icon:\n${legendRows}\nEvery row listed here also appears on the map: if it is in this list, it is on the sheet. Line features show a short specimen of the line itself as their swatch; the driveway row shows a plain near-black swatch. Rows and counts come from the element list above and agree exactly with what is drawn on the map. The panel's complete contents, top to bottom: the title, the subtitle, the icon rows listed above — then plain cream to the bottom edge.

11. SHEET FURNITURE: a small white north arrow with a white "N" above it in the top-right of the map area, and a plain white-and-black divided scale bar at the bottom-left reading "20 m".

12. FIDELITY: every drawn element sits on a marker or a traced line from the input, and everything the photograph shows — roofs, tracks, trees, boundary — keeps its photographed position, shape and size. One marker, one icon.

13. VIEW: the output camera is the input camera — flat orthographic top-down, north-up, same crop, same scale, same aspect.

14. WORDS ON THE SHEET: the only lettering anywhere is the element labels, the driveway caption, the legend rows, the title, the subtitle, "N" and "20 m". All spelled exactly as given, all horizontal, all print-legible.

FINAL CHECK, in order of importance: (1) the map area is still unmistakably the supplied satellite photograph — raw, sharp, grainy, photographic under the graphics; (2) every legend row begins with the same pictorial icon used on the map, drawn larger — the tank row shows the little blue tank, the pond row shows the little pond; (3) every marker has become exactly one shadowed icon in its original spot; (4) boundary ticked chartreuse, drip runs as blue dots along the routes already traced, driveway near-black; (5) title, subtitle, north arrow and "20 m" scale bar present; (6) every word matches the spellings given above.`;

  return `${STYLE_LINES[stylePreset]}\n\n${body}`;
}

// Kept for one release as an instant rollback (call-site flip, no worker redeploy — the prompt is
// built client-side). Delete once the rewrite above is verified against real renders. See the audit
// doc for the before/after comparison plan.
export function buildShowcasePromptLegacy(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  placeName = '',
  designBrief = '',
): string {
  const isZonesSheet = /zone/i.test(layerLabel ?? '');
  const title = `${(layerLabel ?? 'Site plan').toUpperCase()}${placeName ? ' — ' + placeName : ''}`;
  return `${STYLE_LINES[stylePreset]}

TASK: transform this satellite photo of a REAL South African smallholding into a finished, frame-worthy ILLUSTRATED SITE PLAN sheet titled "${title}" — the kind of beautiful hand-crafted map that opens a professional permaculture design report.

INSIDE THE BOUNDARY ONLY: repaint everything INSIDE the property boundary as illustration in the style above — ground, buildings, trees, beds, all of it. Everything OUTSIDE the boundary line stays the ORIGINAL PHOTOGRAPH, untouched — do not repaint, restyle, recolour or redraw ANY pixel beyond the boundary. The finished sheet reads as a painted plan set into the real aerial photo. (The legend panel and title block are the only things allowed to sit over the photographic margin, as clean paper panels.)

EXACT GEOMETRY, NON-NEGOTIABLE: the property boundary is the crispest line on the map. The main house and every building keep their EXACT roof footprint from the photo — same outline, same wings, same angles, same proportions, only re-rendered in the style; if unsure, trace the photo's roof edges. The driveway keeps its exact traced shape (never a loop or roundabout). Every marked feature stays in its TRUE position, shape, size and count. Top of the image is north. Do not invent features: no extra buildings, ponds, beds, paths or decorations beyond the photo and the marked list.

THE COLOURED MARKERS ARE PLACEHOLDERS, NOT ART — replace each with the real thing, beautifully drawn: ${FEATURE_LEGEND}The marked features are: ${elementsText}.
${layerLabel && layerLabel !== 'Full design' ? `
THIS IS A SINGLE-LAYER SHEET (${layerLabel}): its marked features are the STARS — render them rich and detailed. Everything else inside the boundary stays a quiet, muted base (plain lawn/veld, the buildings, nothing more) so this layer reads clearly. Do NOT decorate the rest of the plot into a full designed garden on this sheet.
` : ''}
CARTOGRAPHY — THIS SHEET MUST INCLUDE, drawn in the same illustration style:
• A TITLE BLOCK in one top corner reading exactly "${title}" — the sheet's name, clearly the largest lettering on the page.
• A tidy rectangular LEGEND panel in the corner with the least map content: a small colour swatch or miniature icon beside each feature type's name, neatly aligned in a single column on a lightly-tinted panel with a fine border. ${isZonesSheet ? 'This is the ZONES sheet, so the legend lists the zone bands (Zone 0–5) with their colours, plus the physical features.' : 'The legend lists ONLY physical features from the marked list — NEVER permaculture zone numbers, zone colour bands or "Zone 0/1/2…" entries; zones belong on the Zones sheet, not this one.'}
• SELECTIVE LABELS: label only the most important features — at most 6 to 8 — in small, elegant, perfectly legible lettering placed beside (never on top of) the feature. Everything else is identified by the legend alone.
• Use EXACTLY these spellings for the legend and labels: ${elementsText}${placeName ? '; ' + placeName : ''}. No other words anywhere on the image beyond these and the title block.
• A small NORTH ARROW near the legend.
All lettering must be horizontal, correctly spelled, high-contrast and print-legible.${designBrief ? `

=== MASTER DESIGN BRIEF — every sheet of this plan set shares this ONE design; placements are FINAL, reference only ===
${designBrief}
=== END BRIEF ===` : ''}`;
}
