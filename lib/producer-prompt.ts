// The image-producer prompt builder — extracted so BOTH the /api/image-producer route (synchronous
// Gemini path) and the CLIENT (which builds the prompt to hand to the background render queue, see
// lib/render-jobs.ts + functions/) use the identical prompt. Pure function, no server deps.

// groundRegister is the ONE authority for the ground content/context/absent split, shared with
// drawBlueprintGround and groundRows in components/design/DesignGlossy.tsx — see that function's
// doc in lib/glossy-filters.ts. Importing the pure lib here (not the React component) keeps this
// file server-safe.
import { groundRegister } from '@/lib/glossy-filters';

export type StylePreset =
  | 'precision_atlas'
  | 'satellite_overlay'
  | 'field_ledger'
  | 'homestead_storybook'
  | 'extension_blueprint'
  | 'karoo_folk'
  | 'chatgpt_atlas'
  | 'master_atlas';

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
  const waterArtDirection = /water/i.test(layerLabel)
    ? [
        `WATER BACKGROUND ROLE: this pass creates only the polished landscape artwork beneath a professional Water, Greywater & Irrigation plan. The app adds every saved tank, tap, basin, pond, pipe, greywater route, drip route, leader, label and legend afterwards at measured positions. Do not paint, anticipate, duplicate or reinterpret that technical layer.`,
        `TONAL HIERARCHY: use a deep dark-green illustrated forest context beyond the property, with a moderate olive/moss property interior. Keep the whole sheet high-contrast, moody and editorial from directly overhead; do not brighten or pale the land relative to the source.`,
        `MATERIAL SEPARATION: distinguish mown lawn, rough veld, bare soil, tilled ground, planted beds and paving through layered watercolor-and-gouache texture with fine dry-brush grain. Keep the driveway quiet, flat and charcoal, with no bright border, kerb, raised edge, hatch, shadow or roof-like treatment.`,
        `SOURCE LOCK: preserve the exact top-down source crop, scale, aspect ratio, camera position and geometry. Invent nothing: add no trees, beds, tanks, ponds, paths, fences, buildings or other features not already visible. Add no technical overlays, symbols, text or sheet furniture; the app adds them afterwards.`,
      ].join('\n\n')
    : '';
  return [
    STYLE_LINES[stylePreset],
    `TASK: turn this whole aerial photograph into one finished hand-illustrated ${layer} map sheet. Paint edge to edge — every corner of the image becomes artwork, including the land beyond the property boundary.`,
    waterArtDirection,
    // Same gap, same fix as buildSectorRestylePrompt's paintWhatIsThere (see its comment): no
    // vocabulary for paved ground meant a concrete slab beside a building had nowhere to go except
    // "more roof". This is the Geometry Lock path — the most-used of the three AI-illustration
    // prompts in this file that each independently describe ground texture — so the gap here is
    // the highest-impact of the three to have missed.
    `PAINT WHAT IS THERE: illustrate the real landscape the photo already shows — existing trees and shrubs as drawn canopies, hedges and treelines, mown lawn, rough veld, bare and tilled soil, tracks and driveways, paved ground (patios, concrete slabs, hard standing) as flat light-grey paving — never roofed, never the driveway's tar-black — and every building as its full roof seen from directly above. Neighbouring plots are painted in the same hand as the rest of the sheet, never left as raw photograph.`,
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
    'STYLE — Satellite Overlay: the real aerial photograph stays the map, and a crisp printed graphic overlay is drawn on top of it. This is a known genre — the annotated satellite overlay used for irrigation schemes, park interpretive maps and resort site plans. The dark green satellite imagery, real roofs, real tree canopies, real shadows and real ground textures all remain photographic and sharp; the only drawn artwork is the overlay layer — small semi-3D pictorial icons with soft drop shadows, a bone-white post-and-wire boundary fence with small round posts, near-black tar surfaces, bright blue dotted irrigation runs, white ALL-CAPS labels on thin white leader lines with small arrowheads, and a cream legend panel with dark editorial type down the right side, all inside a dark rounded-corner sheet frame. Fixed palette over the photographic base: chartreuse #B4E000, tank blue #2F6FB5, water blue #2E9BFF, earth brown #7A5230, foliage green #4E8B3A, near-black tar #12140F, cream panel #F6F1E4, titling charcoal #1E2418, white lettering. Vector-clean linework and even drop shadows throughout: hard-edged flat vector graphics floating over raw lens imagery — every pixel that is not overlay is the satellite photograph exactly as supplied, native grain, native colour, straight from the sensor.' + PLAN_SET_ANCHOR_PHOTO,
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
  // Deliberately a different texture AND palette axis from precision_atlas (watercolor wash, greens)
  // and extension_blueprint (flat technical ink, olive/sage): engraved crosshatch shading instead of
  // painted washes, and a graphite/indigo ground with a single brass accent instead of any green-led
  // palette — the "capital campaign / board memo" register, not "garden portrait" or "site plan".
  master_atlas:
    'STYLE — Master Atlas: a formal engraved masterplan in the register of a capital-campaign document or a historic land-grant survey, rendered clean and modern. Ground and vegetation are built from fine engraved crosshatch and stipple shading — never a painted wash — with precise contour hachures describing every slope, and a restrained single-weight ink border enclosing the sheet like a cartouche. Fixed palette, deliberately not green-led: graphite charcoal linework, deep indigo-grey ground tones, cool slate roofs, warm bone-white paper, and one disciplined brass-gold accent reserved for water infrastructure and the north arrow/scale device only. Labels sit in a restrained small-caps engraver\'s serif. The result reads as the most formal and authoritative sheet in the set — built to be bound into a funder\'s or board\'s masterplan document — never lush, never watercolor, never casual, never a satellite filter.' + PLAN_SET_ANCHOR,
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
  // NEAR-BLACK TAR, not "grey strip". This whole function was still describing the driveway as
  // grey, the exact colour rule 8-era code called the ROOF (#3C4247/#3B3A3E) before that got fixed
  // on the composite (DesignGlossy.tsx TAR = '#12140F') — so this function kept telling the model
  // to look for a grey shape while the actual pixels handed to it were near-black, and a model
  // hunting for "grey" over a photograph full of shadow and shade has nothing reliable to lock
  // onto. Say the real colour.
  driveway: 'the near-black tarred strip is the existing driveway — a plain tar access track of exactly its traced shape, empty of vehicles, kept flat and dark; never lawn, never a raised slab, never the same colour as a roof',
  fence: 'a dusty-violet line is a farm fence of posts and wire along exactly that path',
  path: 'a gold dashed line is a walking path along exactly that route',
  swale: 'a light-blue dashed line is a swale — a planted water-harvesting ditch on contour',
  pipe: 'a dark-blue line is a buried water-pipe route, shown as a subtle trench line',
  drip: 'a green dashed line is a drip-irrigation line',
  windbreak: 'a deep-green line is a windbreak hedge of dense shrubs and trees',
  // ADDED — these four had NO entry anywhere in this function, ever. buildShowcasePrompt is the
  // function every default style actually calls (DesignGlossy.tsx:5773/5863); the earthwork-not-
  // plant tree-basin fix and the greywater-line work this session (commits 79b1e78, 4f153f5,
  // 16d5ac8) only ever touched OVERLAY_ICONS below, which belongs to the SEPARATE Satellite
  // Overlay-only buildSatelliteOverlayPrompt. A farmer on any other style got a tree-basin or
  // banana-circle marker with zero drawing instruction attached, and the model fell back to the
  // generic "a plant in a pot" it would guess for an unexplained brown circle. Same story for
  // greywater: no basin description, no line colour explained, so a real greywater system a
  // farmer drew came out as nothing at all. Text mirrors OVERLAY_ICONS' already-fixed language —
  // this is propagating an existing fix to the path that was missing it, not new invention.
  tree_basin: 'a small brown circular marker about 2 m across is a tree basin — draw ONLY the earthwork: a low raised mound of bare soil at the centre, ringed by a doughnut-shaped mulched moat, clear dry ground between mound and mulch. It carries NO plant of its own — never a tree or shrub standing in it',
  banana_circle: 'a larger brown circular marker about 3.5 m across is a banana circle — a sunken mulch-filled pit about 2 m across, ringed by a raised earth bund, four or five broad paddle-shaped banana leaves fanning out over the rim. Opposite silhouette to a tree basin: this is a SUNKEN pit, a tree basin is a RAISED mound',
  mulch_bank: 'a hatched rectangular Vetiver Bank marker is a compact block of upright blue-green vetiver tussocks filling exactly that rectangle and no larger, never a band running along the boundary or another line',
  greywater_basin: 'a small brown circular marker about 1.5 m across is a greywater or infiltration basin — a gravel-filled sump with a visible inlet pipe entering one side and low reeds around the rim only, no plant of its own',
  greywater_line: 'a violet dashed line is a greywater line — redraw it along exactly its traced route, feeding only the basin(s) it actually reaches; add no branch, fitting or basin that is not already marked. Discharges below mulch, never onto edible leaves',
  zones: 'the large coloured bands are the permaculture zones (Zone 0–5) — paint each as a soft translucent tinted wash laid over the illustrated land, keeping the land, buildings and lighting beneath them in the style’s own palette and neutral daylight, never tinted warm by the band colours',
} as const;

type ShowcaseMarkerKey = keyof typeof M;

const SHOWCASE_MARKERS_BY_SHEET: Record<ShowcaseSheetKind, ShowcaseMarkerKey[]> = {
  all: ['bed', 'tree', 'windbreak', 'tank', 'dam', 'swale', 'pipe', 'drip', 'building', 'hive', 'patio', 'fence', 'path', 'driveway', 'tree_basin', 'banana_circle', 'mulch_bank', 'greywater_basin', 'greywater_line', 'zones'],
  zones: ['zones', 'driveway'],
  water: ['tank', 'dam', 'swale', 'pipe', 'drip', 'driveway', 'tree_basin', 'banana_circle', 'greywater_basin', 'greywater_line'],
  planting: ['bed', 'tree', 'windbreak', 'driveway', 'tree_basin', 'banana_circle', 'mulch_bank'],
  structures: ['building', 'hive', 'patio', 'fence', 'path', 'driveway'],
};

const SHOWCASE_MARKER_MATCH: Record<ShowcaseMarkerKey, RegExp> = {
  bed: /bed|vegetable garden|veg garden/i,
  tree: /\btree\b|orchard|fruit/i,
  windbreak: /windbreak|hedge/i,
  tank: /tank|jojo|rain barrel/i,
  dam: /\bdam\b|\bpond\b/i,
  swale: /swale/i,
  pipe: /\bpipe\b/i,
  drip: /drip|irrigation line/i,
  building: /\bbuilding\b|\bhouse\b|\bshed\b|\bhut\b|\bbarn\b|shade house|greenhouse/i,
  hive: /hive/i,
  patio: /patio|paving|courtyard/i,
  fence: /fence/i,
  path: /path|walkway/i,
  driveway: /driveway|access track/i,
  tree_basin: /tree basin/i,
  banana_circle: /banana circle/i,
  mulch_bank: /mulch bank|vetiver bank/i,
  greywater_basin: /greywater basin|infiltration basin/i,
  greywater_line: /greywater line/i,
  zones: /\bzone\s*[0-5]\b|permaculture zone/i,
};

function showcaseMarkerGlossary(sheetKind: ShowcaseSheetKind, elementsText: string): string {
  return SHOWCASE_MARKERS_BY_SHEET[sheetKind]
    .filter((key) => SHOWCASE_MARKER_MATCH[key].test(elementsText))
    .map((key) => M[key])
    .join('; ');
}

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
  const markerGlossary = showcaseMarkerGlossary(sheetKind, elementsText);
  const noInvent =
    `NO INVENT: the feature list below is complete. Do not add any road, roof, tree, bed, pond, path, pipe, irrigation run, greywater run, label, shadow or other feature that is not already marked or visible in the source image. If a feature is absent from the list, it must be absent from the artwork and legend.`;
  const waterSections = [
    /tank|jojo|rain barrel/i.test(elementsText) ? 'RAINWATER' : '',
    /\bpipe\b|drip|irrigation|tap|borehole|\bpond\b|\bdam\b|swale/i.test(elementsText) ? 'IRRIGATION' : '',
    /greywater/i.test(elementsText) ? 'FILTERED GREYWATER' : '',
  ].filter(Boolean);
  const waterRule = sheetKind === 'water'
    ? `WATER SHEET: make only the saved water features the hero. The complete allowed contents are exactly: ${elementsText}. ${waterSections.length ? `Use grouped legend sections only for ${waterSections.join(', ')} and NOTES; omit every empty section.` : 'Do not create any water-system legend section.'} Never add a connection, branch, fitting, valve, pump, filter, outlet, basin, pipe or route that is not explicitly marked.`
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
    `DRAW: each coloured marker on the photo is a placeholder. Paint the real thing in its place, same spot, same size and same count. Marker glossary for this sheet only: ${markerGlossary || 'no additional marker types'}. This sheet's complete feature list is: ${elementsText}. Ground with no marker stays open lawn or veld, unchanged.`,
    markerCleanup,
    `LABELS AND PANELS: in the corner with the least map content, place a clean paper title block reading "${title}" as the largest lettering on the sheet, a tidy legend for the feature types, and a small north arrow. Label up to six important features in small elegant lettering beside them, using exactly these spellings: ${labels}. These are the only words anywhere on the sheet, all horizontal and print-legible.`,
    singleLayer,
    geometryLockTail(),
  ].filter(Boolean).join('\n\n');
}

// Sheet numbers MUST match the canonical 8-map package in docs/PLAN-SET-SPEC.md, which is what
// DesignPrint.tsx PRINT_LAYERS renders. They used to be a private 01..05 run starting at the
// whole-design sheet, and EVERY ONE collided with a different print sheet: AI "02 — ZONES PLAN"
// against printed 02 Sector Analysis, AI "03 — WATER PLAN" against printed 03 Zones, and so on. A
// farmer who rendered the AI sheets and also exported the print set got two different pages
// claiming the same number, which makes referring to a sheet by number useless.
// (Analysis precedes design in the canonical order: 01 Base, 02 Sector, then the design sheets.)
export const SHEET_NO: Record<ShowcaseSheetKind, string> = {
  zones: '03', water: '04', planting: '05', structures: '06', all: '07',
};

// One icon description per marker type. The composite hands the model flat coloured placeholder
// shapes; each line says what finished graphic replaces that shape. Written as "marker → icon" so
// the mapping is unambiguous.
const OVERLAY_ICONS: Record<string, string> = {
  tank:      'a small drum/cylinder marker → a blue cylindrical JoJo water tank seen from a high top-down angle, ribbed body, darker lid disc, soft shadow to the lower-right',
  tap:       'a small tap/valve marker → a plain garden tap on its own, drawn small and low-key: just the spout and handle, no post, no plinth and no concrete base pad',
  dam:       'a blue area marker → a pond of exactly that shape and size: deep-blue water, a ring of grey stone edging, two or three small lily pads',
  basin:     'a greywater or infiltration basin marker → a gravel-filled circular sump with a visible inlet pipe entering one side and low reeds around the rim only',
  banana:    'a banana-circle marker → a sunken pit about 2 m across filled with dark mulch and ringed by a raised earth bund, with four or five broad paddle-shaped banana leaves fanning out over the rim',
  // "along exactly that line" was the ghost-hedge bug. Vetiver Bank (mulch_bank) is shape 'rect',
  // 2x2 m by default — it has NO line. So this clause ordered a continuous band along a line that
  // does not exist in the image, while rule 5 simultaneously demanded the icon stay the size of its
  // marker. The only long line on a planting composite is the property boundary, which the prompt
  // itself describes as a green line with regular perpendicular ticks — i.e. exactly the convention
  // for a planted row. Result: a vetiver hedge along the west fence, on render after render.
  // Every icon spec must now describe the MARKER SHAPE it replaces, never a line the marker is not.
  mulch:     'a hatched rectangular grass-bank marker → a compact block of upright blue-green vetiver tussocks filling exactly that rectangle and no larger, cut low at one end to show it is harvested. It is a block on its own marker, never a band running along the fence or any other line',
  vetiver_row: 'a vetiver-row marker → single-file separate grass clumps with visible gaps between them, not a continuous band',
  // MOUND AND MOAT, not a dish with a tree in it. This said "a shallow saucer … sitting under the
  // canopy it serves", i.e. the tree standing IN the depression — which is the arrangement that
  // rots a collar. Avocado in particular is the South African Phytophthora case and is planted on
  // a MOUND; pawpaw collapses to collar rot in a wet basin. The element's own farmer-facing tip
  // (design-elements.ts) has always said "a mulch-filled RING around a fruit tree" — the drawing
  // instruction was the half that was wrong, so the app described the safe thing and drew the
  // unsafe one. The water prompt already routes greywater here, which only works with this
  // geometry: water enters the moat, away from the trunk.
  tree_basin: 'a tree-basin marker → the EARTHWORK only: a low raised mound of bare prepared soil at the centre, ringed by a doughnut-shaped mulched moat — a shallow annular trench of dark mulch held by a low outer soil berm — with clear dry ground between the mulch and the mound. THE MOUND CARRIES NO PLANT OF ITS OWN: any tree that belongs here has its own separate marker, and a basin marker on its own is prepared ground waiting to be planted. Whatever is planted here later sits ON the mound, never down in a dip. Opposite silhouette to a banana circle: that is a SUNKEN pit with plants around its rim, this is a RAISED bare mound with the mulch ring around it',
  coop:      'a chicken-tractor marker → a small A-frame ark on skids about 2 m long, timber ends and chicken-wire sloping sides, two small wheels at one end. It is a movable hen house, NOT a tractor and not any kind of vehicle',
  nursery:   'a nursery-table marker → a waist-high slatted timber bench carrying rows of small black seedling trays under light shade cloth',
  compost:   'a compost-bay marker → three adjacent open-topped timber-slat bays in a row, the left one heaped with dark brown compost',
  // Same defect as `mulch` above: pollinator_strip is rect 1x5 m, a narrow RECTANGLE, not a line.
  // "following exactly that line" sent the strips off along the boundary too — which is why the
  // pollinator labels came out sitting just off the fence.
  pollinator: 'a narrow rectangular marker → a strip of low mixed wildflowers, yellow, white and mauve dots over grey-green foliage, filling exactly that rectangle and no larger, never extended along the fence or any other line',
  borehole:  'a borehole marker → a small blue concentric-circle target with a grey collar ring',
  bed:       'a green rectangle marker → a vegetable bed: brown tilled soil in parallel strips with regular rows of small green plants',
  tree:      'a tree marker → a canopy seen from above with a soft shadow to the lower-right, drawn to its species where the label names one: moringa feathery and pale, avocado dark glossy and dense, macadamia dense mid-green, citrus small round bright green flecked with orange fruit, mango broad and dark, pawpaw a crown of big lobed leaves on a bare stem',
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
  all:        ['bed', 'tree', 'windbreak', 'tank', 'tap', 'dam', 'basin', 'tree_basin', 'banana', 'mulch', 'vetiver_row', 'borehole', 'swale', 'pipe', 'drip', 'building', 'hive', 'coop', 'nursery', 'compost', 'pollinator', 'patio', 'fence', 'path'],
  zones:      ['building', 'path', 'fence'],
  water:      ['tank', 'tap', 'dam', 'basin', 'tree_basin', 'banana', 'mulch', 'borehole', 'swale', 'pipe', 'drip'],
  planting:   ['bed', 'tree', 'windbreak', 'mulch', 'vetiver_row', 'banana', 'tree_basin', 'pollinator'],
  structures: ['building', 'hive', 'coop', 'nursery', 'compost', 'patio', 'fence', 'path'],
};

// Only describe icons this sheet can actually contain. Describing an icon the sheet has no marker
// for is how a prompt talks a model into drawing one.
const ICON_MATCH: Record<string, RegExp> = {
  tank: /tank|jojo/i, tap: /tap|standpipe|faucet/i, dam: /\bdam\b|\bpond\b/i, // anchored: unanchored, this fired on "Maca-dam-ia Tree"
  basin: /greywater|grey water|infiltration/i, tree_basin: /tree basin/i, banana: /banana/i, mulch: /mulch bank|vetiver bank/i,
  borehole: /borehole|well/i, bed: /bed|garden|veg/i, tree: /tree|orchard|fruit/i,
  hive: /hive/i, coop: /chicken tractor|chicken coop/i, nursery: /nursery/i, compost: /compost|worm farm/i, pollinator: /pollinator/i, vetiver_row: /vetiver row/i, building: /\bshed\b|\bhut\b|\bbarn\b|shade house|greenhouse/i,
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
  fabric?: string;
  served?: string;
  /** Which water subsystems the design actually contains. Absent means none are described. */
  systems?: { rainwater: boolean; irrigation: boolean; greywater: boolean; greywaterLine?: boolean };
  placeName?: string;
  sheetKind: ShowcaseSheetKind;
}): string {
  const { layerLabel, stylePreset, elementsText, fabric = '', served = '', systems, placeName, sheetKind } = args;
  const sheetNumber = SHEET_NO[sheetKind] ?? '01';
  const title = `${sheetNumber} — ${(layerLabel || 'SITE').toUpperCase()} PLAN`;

  // NEVER BRIEF THE MODEL ON NOTHING. Rule 7 below tells the model the element list is "the
  // COMPLETE contents of this sheet", so an empty list is not a harmless no-op — it is a positive
  // assertion that the sheet is empty, made to a model that can plainly see marks on the supplied
  // photograph. Faced with that contradiction it resolves it by inventing content and lettering a
  // confident legend for it, which is exactly how a farmer got a "ZONES PLAN" carrying fabricated
  // jojo tanks, swales and veg beds. Refusing costs a render; shipping a fabricated plan costs
  // trust, and the farmer may build from it.
  if (!elementsText.trim()) {
    throw new Error(
      `Refusing to render the ${sheetKind} sheet: it has no elements to describe, and a sheet built from an empty brief is invented, not drawn.`,
    );
  }

  const keys = ICON_KEYS_BY_SHEET[sheetKind] ?? ICON_KEYS_BY_SHEET.all;
  // Match against the bare element NAMES. The grouped headings and the place suffixes are not
  // element names and matching them produced real damage: "INFRASTRUCTURE" fired the building
  // icon, "Tap Point (House)" fired it again, "Tap Point (Patio / Paving)" fired the patio icon,
  // and "MacaDAMia Tree" fired the pond icon.
  const matchText = elementsText.replace(/[A-Z ]+\u00bb\s*/g, '').replace(/\s*\([^)]*\)/g, '');
  const present = keys.filter((k) => ICON_MATCH[k]?.test(matchText));
  // No fallback to the full list: describing an icon this sheet has no marker for is how a prompt
  // talks a model into drawing one.
  const iconSpec = present.map((k) => OVERLAY_ICONS[k]).join('; ');

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
  // ONLY THE SUBSYSTEMS THE FARMER ACTUALLY DREW. This used to fire on every water sheet and order
  // the model to draw the full schematic — gutters, first-flush filter, pump, buried main, drip
  // headers, isolation and flush valves, a pressure regulator, outdoor taps, a greywater diverter,
  // a violet subsurface greywater line and its inspection points — whether or not any of it was in
  // the design. That is a standing instruction to INVENT plumbing, and it is where the extra taps
  // came from (Rory: "i think it invented a tap").
  //
  // Rory's rule that "the greywater half is never omitted from a water plan" is still right — but
  // the place to honour it is the ADVISOR, telling him he has no greywater yet, not the renderer
  // drawing him a greywater system he does not have. A plan that shows pipes nobody laid is worse
  // than a plan that shows the gap.
  const systemNote = (heading: string, present: boolean, body: string) =>
    present ? `${heading} (${body})` : '';
  const groups = [
    systemNote('RAINWATER', !!systems?.rainwater, 'the tanks and their linked plumbing exactly as marked'),
    systemNote('IRRIGATION', !!systems?.irrigation, 'the buried main, the drip runs lying along the beds, and the taps — every one of them already drawn on the photograph'),
    systemNote('FILTERED GREYWATER', !!systems?.greywater,
      // The LINE half is conditional on a line actually being drawn. Describing "the subsurface greywater line drawn as a violet dashed run" whenever a greywater BASIN exists
      // told the model a run was there when the farmer had drawn none — so it invented one, and
      // ran it wherever it liked. The basin is real; the route is his to draw.
      systems?.greywaterLine
        ? 'the violet dashed run already traced on the photograph and every basin it feeds — redraw it along exactly the line it is on, and add no branch that is not drawn. Greywater discharges below mulch, never onto edible leaves'
        : 'the basins already marked, drawn as the sunken gravel sumps they are. NO greywater pipe, line or run is drawn anywhere on this sheet — none has been laid yet. Greywater discharges below mulch, never onto edible leaves'),
  ].filter(Boolean);
  const waterSystems = sheetKind === 'water' && groups.length
    ? `\n\nWATER SHEET — GROUP WHAT IS THERE. Group this sheet, on the map and in the legend, under these headings and no others: ${groups.join('; ')}. Add no fitting, valve, regulator, filter, tap, pipe or line that is not already marked on the photograph — a heading not listed here does not exist on this farm yet, and an empty one is never filled in.`
    : '';

  // The driveway is CONTEXT, not a designed feature. It was being drawn as a solid near-black
  // polygon with a caption on every layer sheet, which made an access track compete with the actual
  // design work. It now stays as the photograph already shows it — quiet grey — and only earns a
  // label on the whole-design sheet, where the site's fabric is the subject.
  const drivewayRule = sheetKind === 'all'
    ? 'The driveway is existing site fabric, not a designed feature: the near-black #12140F shape on the ground is the ACCESS TRACK, not a building — leave it as the photograph already shows it, a quiet tar surface at ground level, kept clear of plantings, with no bold outline and no dark fill laid over it. It is FLAT GROUND and nothing else: a surface painted onto the earth, with no thickness, no raised edge, no side walls, no drop shadow and no shadow cast onto the land around it. It is never a slab, platform, deck, plinth or roof, and it is never shaded as though it stood above the ground. On this sheet only, give it one small white caption reading "TARRED DRIVEWAY".'
    : 'The driveway is existing site fabric, not a designed feature: the near-black #12140F shape on the ground is the ACCESS TRACK, not a building — leave it as the photograph already shows it, a quiet tar surface at ground level, kept clear of plantings, with no bold outline, no dark fill and no label of its own — it is background here. It is FLAT GROUND and nothing else: a surface painted onto the earth, with no thickness, no raised edge, no side walls, no drop shadow and no shadow cast onto the land around it. It is never a slab, platform, deck, plinth or roof, and it is never shaded as though it stood above the ground.';

  // ZONE BANDS. The composite paints the permaculture effort-zones as large translucent washes with
  // a numbered badge each — and this prompt had NO concept of them. Rule 1 orders the interior
  // "REDRAWN CLEAN … mown lawn as an even mid-green", rule 2's whitelist has no band in it, rule 5
  // declares every coloured shape a placement guide for one element, and rule 14 forbids any
  // lettering other than labels and legend rows. So on the Zones sheet the model erased the washes,
  // deleted the badges, and — obeying rule 5 to the letter — turned each band into an invented
  // pictorial element, then lettered a confident legend for infrastructure the farmer never placed.
  // That is the "why is zones so bad" bug: the model was following instructions.
  const zoneBands = sheetKind === 'zones' || sheetKind === 'all'
    ? `\n\nZONE BANDS — LARGE TRANSLUCENT AREAS, NOT MARKERS. The big soft-edged coloured areas already on the photograph are the permaculture effort-zones (Zone 0 nearest the house out to Zone 5 wildest). They are AREAS OF LAND, not placement guides: each one is redrawn as a soft translucent tinted wash lying over the clean redrawn ground, keeping its exact outline and its exact colour, so the ground, roofs and planting stay fully readable through it. A zone band NEVER becomes a pictorial icon, a tank, a bed, a pond or any other object, and nothing is invented inside one. Each band keeps its round number badge — the numeral drawn in white on a filled disc in the band's own colour, at the same spot — and that numeral is permitted lettering.${sheetKind === 'zones' ? ' THIS SHEET IS ABOUT THE ZONES THEMSELVES: the bands and their badges are the entire subject, the legend lists one row per zone with its number, name and colour swatch, and no other element, icon, tank, bed, tree or structure is added anywhere on the map.' : ''}`
    : '';

  // EXISTING SITE FABRIC — traced ground (lawn, orchard, veg garden, patio, cleared, driveway,
  // house) the composite now paints as a low-alpha wash (DesignGlossy.tsx drawMarks). Same failure
  // mode zoneBands exists to prevent: undescribed, rule 1 orders it "REDRAWN CLEAN" and rule 5 reads
  // it as a placement marker for one invented element. `fabricIsContent` decides whether this sheet's
  // subject includes existing ground (all/planting/structures) or only needs it as orientation
  // context (water/zones). Deferring to groundRegister — the single authority shared with
  // drawBlueprintGround's alpha and groundRows' legend gate (EARTHWORKS-CONTEXT-PLAN Phase 2) — is
  // what makes it structurally impossible for this prompt wording to drift from what the composite
  // actually draws. Any non-boundary kind answers for the whole `fabric` string here: `fabric` is
  // built from groundRows, which never includes the boundary (a drawn LINE, not a ground wash — see
  // groundRegister's 'absent' case), so every kind that reaches this string shares one register.
  const fabricIsContent = groundRegister('lawn', sheetKind) === 'content';
  const siteFabric = fabric.trim()
    ? `\n\nEXISTING SITE FABRIC — WHAT IS ALREADY THERE, NOT PART OF THIS DESIGN. The large, soft-edged, low-opacity tinted areas already on the photograph are ground the farmer has traced and named: ${fabric}. They are AREAS OF EXISTING GROUND, never placement markers: redraw each one as the real surface it already is, in place, keeping its exact outline — lawn as even mown grass, orchard and veg garden as the planting already visible in the photograph there, patio and paving as a clean flat slab, cleared ground as bare earth, driveway as the quiet grey tar rule 9 describes, house as the roof rule 8 describes, terrace bank / level change as a hatched, textured retained riser face — visibly distinct from the flat platforms either side of it, never flattened into the same lawn it retains. Nothing is invented inside one and no pictorial icon is placed on one. ADD NO NEW PLANTING ANYWHERE: existing site fabric is redrawn, never grown — no extra trees, canopies, shrubs, hedges or beds appear on or around it, and the open lawn between these areas stays open lawn.${fabricIsContent ? ' Give each one a small white caption naming it, and one legend row each under an EXISTING heading.' : ' On this sheet they carry no caption and no legend row of their own — they are context only, there so the reader can place this layer on the real site.'}`
    : '';

  // WHAT THIS LAYER SERVES. Separate from siteFabric because the two want opposite treatment: ground
  // (lawn, patio, yard) is silent under rule 10, while the beds and basins an irrigation system
  // feeds must be NAMED or the farmer is reading unexplained shapes on his own plan. The
  // already-marked / one-for-one / add-none wording is load-bearing: an earlier version named these
  // with no such guard and the render came back with invented tree canopies and banana palms,
  // because "Tree Basin" contains "tree". Naming is only safe while this clause travels with it.
  const servedClause = served.trim()
    ? `\n\nWHAT THIS SYSTEM SERVES — NAMED, BUT NOT PART OF IT. Small faint outlines are already marked on the photograph for the beds and basins this layer waters: ${served}. Every one of them is ALREADY THERE — redraw exactly what is marked, one for one, at the marked size, and ADD NONE. The marker count is the count: no extra bed, basin, tree, canopy, palm or shrub appears anywhere on this sheet, and the open lawn between them stays open lawn. Give each a small white caption naming it exactly as written above, and one legend row each under a heading reading EXISTING. They are what this system waters, not part of the system itself, so they are what this layer connects to, never part of it, and they never take one of this sheet's own system headings.`
    : '';

  // Generalises the zoneBands-only exemption below into a list naming whichever translucent-area
  // classes are actually present on THIS sheet. A single zoneBands-keyed ternary would silently miss
  // fabric on sheets (water, structures) where zoneBands is empty, and vice versa.
  const exemptAreas = [
    zoneBands ? 'the large soft translucent zone bands' : '',
    siteFabric ? 'the existing site fabric areas' : '',
  ].filter(Boolean);
  const rule5Exemption = exemptAreas.length
    ? ` — this rule covers those element markers ONLY, and never ${exemptAreas.join(' or ')}, which are areas of land, not markers for one element`
    : '';

  // ROUTES ARE A WATER-SHEET THING. lineInFilter puts swale, pipe and drip on the water layer
  // ONLY, so on Planting and Structures this sentence described green dashed runs, a navy pipe and
  // a swale that are not in the composite at all — and rule 7's absent-assertion means the model
  // resolves that by inventing them. That is the same shape as every invention bug this file has
  // already shipped: naming what is not drawn.
  const routeRule = sheetKind === 'water' || sheetKind === 'all'
    ? ` — redraw each one along exactly the line it is already on, and add no connection that is not already drawn: the green dashed lines are the drip-irrigation runs — there are exactly as many runs as there are green dashed lines and not one more; redraw each along exactly the line it is already on, as a slim run of small evenly spaced #2E9BFF dots, quieter and thinner than the boundary; a bed with no green line on it gets no run; the dark-blue line is the buried pipe, redrawn as a thinner solid navy line; the light-blue dashed line is a swale, redrawn as a slim channel with a green planted berm on its downhill side; the violet #8E44AD dashed line is the subsurface GREYWATER run, redrawn as a slim violet dashed line — it is buried, so it is never a channel, never open water and never planted along.`
    : '';

  // Every element becomes a literal legend row. Enumerating the rows as CONTENT — rather than
  // describing what a row should look like — is what stops elements silently vanishing from the
  // sheet (a placed Small Pond was dropped from both map and legend on a real render).
  // The element list may arrive grouped as "WATER » a, b | PLANTING » c" (see overlayElementsText).
  // A flat 30-row key is unreadable on the whole-design sheet; the reference masterplan groups its
  // legend and that is what makes it scannable.
  /** Collapse place-suffixed variants into ONE legend row carrying the total.
   *
   *  The place suffix ("Tap Point (Lawn)", "Tap Point (House)") exists so a farmer can tell four
   *  identical taps apart ON THE MAP, where the leader line points at one of them — that is what it
   *  is for and it stays there. In the LEGEND it is dead weight: three rows saying Tap Point, each
   *  with an icon, for one kind of fitting. (Rory: "i dont want 3 separate tap lines on the legend
   *  thats just not inteligent and wast of space.") The panel is the scarcest space on the sheet and
   *  the rows it drops are real species and features. */
  const collapseRows = (list: string[]): string[] => {
    const total = new Map<string, number>();
    for (const raw of list) {
      const t = raw.trim();
      if (!t) continue;
      const m = t.match(/^(.*?)\s*\u00d7\s*(\d+)$/);
      const bare = (m ? m[1] : t).replace(/\s*\([^)]*\)\s*$/, '').trim();
      total.set(bare, (total.get(bare) ?? 0) + (m ? Number(m[2]) : 1));
    }
    return [...total.entries()].map(([name, n]) => `\u2014 ${name} (\u00d7${n})`);
  };
  const legendRows = elementNames.includes('\u00bb')
    ? elementNames
        .split('|')
        .map((g) => g.trim())
        .filter(Boolean)
        .map((g) => {
          const [heading, list] = g.split('\u00bb');
          const rows = collapseRows((list ?? '').split(','));
          return `${heading.trim()}\n${rows.join('\n')}`;
        })
        .join('\n')
    : collapseRows(elementNames.split(',')).join('\n');

  // Labels on the MAP never carry the section machinery — only the element names.
  const mapNames = elementNames.replace(/\s*\|\s*/g, ', ').replace(/[A-Z ]+\u00bb\s*/g, '').trim();

  // Suppressed entirely when nothing matched. On a Zones sheet the element list carries zone names
  // only, so `present` is empty and this rule rendered as the literal fragment
  // "6. ICON LANGUAGE ... : ." — a numbered instruction with no content, on every zones render.
  const iconRule = iconSpec
    ? `6. ICON LANGUAGE — small, crisp, semi-3D, clean saturated graphics with simple shading: ${iconSpec}.`
    : '6. ICON LANGUAGE — small, crisp, semi-3D, clean saturated graphics with simple shading, consistent across the sheet.';

  const body = `TASK: this is sheet "${title}"${placeName ? ` for ${placeName}` : ''}. You are editing a real satellite photograph of a South African smallholding on which the farmer's design is already marked as flat coloured placeholder shapes. Deliver one landscape plan sheet whose map is that same photograph with a crisp graphic overlay drawn on top of it.

1. THE RULE ABOVE ALL OTHERS — THE BOUNDARY DIVIDES THE SHEET IN TWO. The property boundary is the edge between a finished drawing and its context, and that contrast is the whole look.

INSIDE the boundary the land is REDRAWN CLEAN, as a finished plan: mown lawn as an even, softly textured mid-green (#7E9C5C), bare and tilled ground as warm brown, paths and paving as clean flat surfaces, and every roof as crisp flat planes with its ridges and hips in slate grey (#3C4247). Keep every shape exactly where the photograph puts it — the same roof outline, the same tracks, the same tree positions and canopy sizes — but render them cleanly and evenly, with the photographic noise, blotching, harsh shadow and camera grain gone. It should read as a drawing of this exact place, not a photograph of it.

REDRAWN CLEAN MEANS TIDIED, NEVER ERASED. Every hard surface already in the photograph — the access track, the parking area, paving, paths, concrete, gravel — stays a hard surface of the same shape, in the same place, at the same width, redrawn crisply. A driveway is never repainted as lawn, never planted over and never narrowed. Draw grass ONLY where the photograph already shows grass. (This rule exists because "redrawn clean" was read as licence to green over the driveway inside the fence, so a farmer's access track vanished from his own plan.)

OUTSIDE the boundary the supplied photograph stays exactly as it is — real, soft, slightly darker, untouched to the very edges of the sheet. Neighbouring roofs, trees and tracks keep their photographic texture and their haze. This is context, and it recedes.

The boundary line itself is the crisp seam between the two.

2. WHAT YOU DRAW, AND ONLY THIS: (1) a pictorial icon in place of each coloured placeholder marker, (2) the boundary line, (3) the irrigation lines, (4) white labels with leader lines, (5) the cream legend panel, (6) a north arrow and a scale bar${zoneBands ? ', (7) the translucent permaculture zone bands and their number badges (see the ZONE BANDS rule below)' : ''}${siteFabric ? `, (${zoneBands ? 8 : 7}) the existing traced ground areas (see the EXISTING SITE FABRIC rule below)` : ''}. Beyond those, inside the boundary is the clean redrawn ground of rule 1, and outside it is untouched photograph. There is no dark tar surface to add anywhere on this sheet: the access track is already in the photograph and stays exactly as rule 9 describes it.

3. THE SHEET LAYOUT IS ALREADY IN PLACE in the supplied image: the photographic map on the left, a blank cream panel down the right. Fill the panel, overlay the map, and leave the photograph exactly where it sits — nothing is resized, shifted or re-cropped to make room.

4. THE MARKERS ARE THE WHOLE DESIGN, AND THERE ARE EXACTLY AS MANY AS THERE ARE. Trees are the one thing that gets over-drawn: a plan of a real smallholding has FEWER trees than a picture of a garden, and the empty lawn between them is the point. Draw one canopy per tree marker and not one more — no filler trees along the boundary, no shrubs to balance a corner, no planting in the open grass. The same holds for every other element.

5. THE COLOURED MARKERS ARE PLACEMENT GUIDES. Each small, hard-edged coloured shape already on the photograph marks where one designed element goes${rule5Exemption}. Replace each marker with one finished pictorial icon in exactly the same spot, at the same size, in the same quantity, at a gentle three-quarter overhead angle in map-icon style, with a soft grey drop shadow so it lifts off the photo. Every icon reads instantly at postcard size and casts the same soft shadow in the same direction. Keep each icon to the size of the marker it replaces: a tank, pond or banana circle is metres across and draws large, while a tap, valve, inspection point or borehole is a small fitting a hand's width across and draws small. Small fittings never grow into landmarks. Ground with no marker keeps its untouched photograph and gets nothing. The open lawn is mown grass and stays mown grass; bare ground stays bare. A finished sheet has exactly as many plants, beds and structures as the photograph and the markers already show — the empty parts of this farm are empty on purpose, and showing them empty is what makes the plan truthful.

${iconRule}

7. THIS SHEET'S ELEMENTS AND EXACT SPELLINGS: ${mapNames}. The WATER / PLANTING / INFRASTRUCTURE headings are a printing order for the legend panel only. They say nothing about where anything sits and they are not a drawing order: never move an element to stand near others from its own legend section — each icon goes on its own marker and nowhere else. That list is the COMPLETE set of DESIGNED ELEMENTS on this ${(layerLabel || 'site').toUpperCase()} sheet — no other tank, bed, tree, structure or fitting is added anywhere, and the other layers of the plan set carry everything else. It is not the whole of what the sheet SHOWS: the existing ground, the boundary fence and anything named under the rules below are also on this sheet, and each is governed by its own rule. Nothing outside that list and those rules is drawn. Each marker on the photograph carries a small printed glyph identifying it; the finished pictorial icon replaces the whole marker, glyph included. The "×N" counts are the exact number of that icon to place: one marker, one icon — the marker count is the icon count.

8. THE ROOF AND THE ACCESS TRACK ARE DIFFERENT THINGS, AND THEY ARE DIFFERENT COLOURS. Slate grey #3C4247 is ROOF; near-black #12140F is TAR ON THE GROUND. Never draw one in the other's colour and never give the near-black shape a ridge, a hip, a pitched plane or a shadow. The pale grey shape with the white outline is the ROOF of the house: it has ridges, hips and pitched planes, it casts a shadow, and it keeps every edge and every wing exactly as photographed. It is a building, and no part of it is ever paved, darkened or turned into road surface. The access track is separate, flat, at ground level, and lies where the photograph already shows it. They never merge and they never swap.

9. LINES DRAWN OVER THE PHOTO. Property boundary: the bright chartreuse #B4E000 ring around the plot is the PROPERTY BOUNDARY — a surveyed fence line, never a hedge, windbreak, planted row or band of vegetation, and nothing is planted along it that does not have its own marker. Redraw it as a real post-and-wire farm fence: a thin taut bone-white #EDE7D9 wire with small round bone posts set at regular intervals along its full length. Posts are circles, never ticks, dashes or leaves, and nothing grows on the wire. ${drivewayRule}${routeRule}${waterSystems}${zoneBands}${siteFabric}${servedClause}

10. LABELS — YOU DRAW THEM. Label every marked element in small white uppercase sans-serif, even in size, horizontal, sitting on open photographic ground clear of the icons, joined to its icon by a hairline white leader line ending in a small filled white arrowhead. Where several identical items sit together, use one grouped label carrying the count: "2 × JOJO TANKS 5000L EACH", "2 × BANANA CIRCLES". Where the same element type appears in separate parts of the site, label each one plainly with its own name and let its leader line show which it is. Spell every label exactly as the element list gives it, in caps. LABEL THE DESIGN, NOT THE SITE: the only things that get a label are the elements named in the list above — the things the farmer has DESIGNED. Everything that was already on the land carries no label at all: no caption on the house or any roof, none on the driveway, paving, patio, yard, lawn or existing planting, none on the boundary fence, and none on any neighbouring property. A plan sheet is read by looking for what is new; captioning the things a farmer walks past every day buries it.

11. LEGEND PANEL — YOU DRAW IT TOO. On the cream right-hand panel, in dark #1E2418 type: the title "${title}" as the largest lettering on the sheet${placeName ? `, and beneath it "${placeName}" in smaller grey lettering` : ''}. Then a single left-aligned, evenly spaced column with one row per element TYPE present on the map: on the left a LARGE version of that element's own pictorial icon — the identical icon drawn on the map, at legend size — then the element name in dark sentence case, then its count in round brackets on the same line. Render EXACTLY these rows, every one of them, in this order, each led by that element's own icon. A line in CAPITALS with no icon is a SECTION HEADING — set it in small bold capitals above the rows beneath it, with a little space before it, exactly as the reference plan sets WATER, PLANTING and INFRASTRUCTURE:\n${legendRows}\nEvery row listed here also appears on the map: if it is in this list, it is on the sheet. Line features show a short specimen of the line itself as their swatch; the driveway row shows a plain near-black swatch. Rows and counts come from the element list above and agree exactly with what is drawn on the map. The panel's complete contents, top to bottom: the title, the subtitle, the icon rows listed above — then plain cream to the bottom edge.

12. SHEET FURNITURE: a small white north arrow with a white "N" above it in the top-right of the map area, and a plain white-and-black divided scale bar at the bottom-left reading "20 m".

13. VIEW: the output camera is the input camera — flat orthographic top-down, north-up, same crop, same scale, same aspect.

14. WORDS ON THE SHEET: the only lettering anywhere is the element labels, the driveway caption, the legend rows, the title, the subtitle, "N"${zoneBands ? ', the zone number badges' : ''}${fabricIsContent && siteFabric ? ', the existing-fabric captions' : ''} and "20 m". All spelled exactly as given, all horizontal, all print-legible.

FINAL CHECK, in order of importance: (1) inside the boundary the land is cleanly redrawn — even green lawn, crisp roof planes, no photographic grain or blotching — while outside the boundary is untouched photograph, and the boundary is the visible seam between them; (2) every legend row begins with the same pictorial icon used on the map, drawn larger — the tank row shows the little blue tank, the pond row shows the little pond; (3) every marker has become exactly one icon in its original spot, and there is not a single NEW tree, shrub or bed on the sheet that has no marker under it — trees already visible in the photograph, and the existing traced areas named above, stay exactly as they are; (4) boundary ticked chartreuse, drip runs as blue dots along the routes already traced, driveway near-black; (5) title, subtitle, north arrow and "20 m" scale bar present; (6) every word matches the spellings given above.`;

  return `${STYLE_LINES[stylePreset]}\n\n${body}`;
}

/**
 * Sector Analysis — restyle-only. The sheet's whole content is bearing-typed (wind, fire, water,
 * frost — see lib/sector.ts SectorModel): a model-drawn arrow is a coin-flip on both angle and sense
 * (bearingToUnitVector's docblock: wind blows FROM its label, so its arrow travels the OPPOSITE way),
 * and the farmer's next action off this sheet is literally "put the windbreak/firebreak on this
 * side" — the one place in the app a wrong angle has physical consequences. So unlike every other
 * sheet, this prompt is NOT built from elementsText/legend/icon machinery: there is nothing here for
 * the model to enumerate, and buildSatelliteOverlayPrompt would refuse on the empty list anyway
 * (the rule at :462-466 above). The model restyles the ground/roof/driveway fabric only; the app
 * composites the real, measured compass ring, wedges and arrows on top afterwards (see
 * buildSectorOverlayImage / drawSectorAnalysis in DesignGlossy.tsx). RENDER-INVESTIGATION.md
 * 'sector-ai' §1-2 has the full reasoning: reusing buildSatelliteOverlayPrompt or buildShowcasePrompt
 * was considered and rejected on this file, both because their entire contract is "draw what's
 * named in this list" (nothing is named here) and because both instruct the model to letter its own
 * labels/legend — exactly what a sector sheet must never do.
 */
export function buildSectorRestylePrompt(stylePreset: StylePreset, placeName?: string): string {
  // EDGE TO EDGE, borrowed verbatim in spirit from buildLockedIllustrationPrompt, which is the one
  // restyle prompt with a track record. Without it the first AI sector sheet came back as a
  // part-painted region on raw photograph. On this sheet the surrounding land especially must be
  // painted: the fire approach, the prevailing wind and the downhill water all arrive from beyond
  // the fence, so a boundary-shaped patch of artwork is both ugly and analytically wrong.
  const edgeToEdge =
    `PAINT EDGE TO EDGE: every corner of the image becomes artwork, including the land beyond the property boundary. Neighbouring plots, roofs, trees and tracks are painted in the same hand as the rest of the sheet — never left as raw photograph, never faded out, never framed. No part of the output is a photographic patch.`;
  // BUILDINGS ARE TEXTURE, NOT GEOMETRY THE APP RELIES ON. This clause used to ask for every
  // building's "full roof seen from directly above" with no qualifier — a crisp, hard-edged model
  // house that then ghosts under our own vector house once composeSectorSheet draws the TRUE
  // house/driveway/boundary from refLayers on top of whatever this returns. So: paint any building
  // as quiet, low-key roof colour sitting IN the ground fabric, never the sharpest thing in frame.
  // PAVED GROUND NEEDS ITS OWN WORDS, SEPARATE FROM "BUILDING". Rory, looking at a render where a
  // concrete slab beside a building came back looking like part of the building: "if the labeling
  // was given to image generator it would have picked up concrete slab and not building! it got
  // things confused." He was right about the mechanism — this clause used to give the model
  // texture vocabulary for buildings, driveways, lawn, veld and soil, but NOTHING for paving,
  // patios or a bare concrete slab. A grey, flat, hard-edged area next to a building has nowhere
  // else to go in that vocabulary except "more building" — the model isn't confused, it is
  // literally uninstructed. Adding "paved ground" as its own named texture, explicitly NOT roofed
  // and NOT the driveway's tar, gives it somewhere correct to put that area.
  const paintWhatIsThere =
    `PAINT WHAT IS THERE: illustrate the real landscape the photo already shows — existing trees and shrubs as drawn canopies, hedges and treelines, mown lawn, rough veld, bare and tilled soil, tracks and driveways, and paved ground (patios, concrete slabs, hard standing) as flat light-grey paving — never roofed, never given a ridge or pitch, and never the tar-black of the driveway; it reads as ground you can walk on, not a structure. Render any building as a quiet, low-key roof colour sitting in the ground fabric — not a sharp, high-contrast structure, not the star of the composition; its exact outline is drawn separately afterwards. Keep the land legible: this is the background a farmer reads their sun, wind and fire lines against, so it must stay crisp and varied, never a flat wash.`;
  // RESTYLE ONLY, not KEEP EXACT. The old wording asked the model to hold the boundary/roof/
  // driveway "in exactly their photographed shape, position and scale" — a registration promise
  // gpt-image-2 cannot keep (it reframes the whole scene) and one the app no longer asks it to
  // keep, because it no longer trusts it: composeSectorSheet draws the true house, driveway and
  // boundary from refLayers on top of this image, at measured coordinates, regardless of what the
  // model returns. The only thing that still matters is that the overall crop stays roughly the
  // same scene, since a wildly different crop still looks wrong sitting under our overlay.
  const restyleOnly =
    `RESTYLE ONLY: this is a ground-texture pass, not a survey. Keep the same north-up, flat orthographic top-down view and roughly the same crop and scale as the source photograph — no oblique view, no perspective tilt, no 3D camera, no zoom or recentering. The property boundary, every roof and the driveway will be drawn separately afterwards, at measured positions, directly over this artwork — so their exact outline, position and scale here do not matter and are not graded; only the overall scene and crop do.`;
  const noInvent =
    `NO INVENT: add no tree, bed, tank, pond, path, fence, hedge or building that is not already visible in the source photograph. Where the ground is open it stays open.`;
  const noAnalysis =
    `DO NOT DRAW THE ANALYSIS: draw no arrows, arcs, wedges, compass letters (N/E/S/W), bearing text, distance rings, or any sun, wind, fire, water or frost annotation. Draw no callouts, no legend panel, no title block, no north arrow, no scale bar and no lettering of any kind, anywhere on the sheet. This sheet is a restyle of the ground only — the app draws all of the sun/wind/fire/water/frost analysis afterwards from the site's real measured data, never from anything guessed off this image.`;
  const body = [
    `TASK: turn this whole aerial photograph of a real South African smallholding${placeName ? ` (${placeName})` : ''} into one finished illustrated map, edge to edge, in the style below. This is the background of a sector-analysis sheet; the sun, wind, fire, water and frost analysis is drawn by the app afterwards from measured site data, on top of this artwork.`,
    edgeToEdge,
    paintWhatIsThere,
    restyleOnly,
    noInvent,
    noAnalysis,
    `FINAL CHECK: the entire frame is illustrated with no photographic patches left and no hard edge anywhere; no building is drawn sharper or bolder than the ground around it; nothing has been added that was not already there; there is no text, arrow or arc anywhere.`,
    // Deliberately NOT geometryLockTail(): that tail asks the model to preserve boundary/roof/
    // driveway position exactly — the registration promise this prompt just dropped, and this path
    // sends no protect mask to enforce or restore it from (see finishSectorSheet's docblock). Re-
    // adding it would silently reinstate the promise the rest of this function just removed.
  ].join('\n\n');
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
