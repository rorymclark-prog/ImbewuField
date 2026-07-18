// The image-producer prompt builder — extracted so BOTH the /api/image-producer route (synchronous
// Gemini path) and the CLIENT (which builds the prompt to hand to the background render queue, see
// lib/render-jobs.ts + functions/) use the identical prompt. Pure function, no server deps.

export type StylePreset = 'field_ledger' | 'homestead_storybook' | 'extension_blueprint' | 'karoo_folk';

// STYLE_LINES lives further down (with the showcase-prompt rewrite) since both the strict
// buildProducerPrompt below and the showcase prompts share the one definition.

// What each coloured placeholder marker on the input composite should become. Module-scoped so both
// the strict buildProducerPrompt and the illustrated buildShowcasePrompt share the one legend.
const FEATURE_LEGEND =
  `a green rectangle marker → a tidy vegetable bed full of cabbages and leafy greens; a small cylinder/drum marker → a green cylindrical JoJo water tank; a hive marker → a striped beehive; a tree marker → a fruit tree with a full canopy; a hut/shed marker → that building; ` +
  `a grey/tan tinted polygon area → a real driveway surface (gravel or paving) exactly that shape and size, empty of vehicles; a warm-tan tinted polygon area → a paved outdoor patio exactly that shape and size; a blue tinted polygon area → a real dam or pond of open water exactly that shape and size; ` +
  // Line features — drawn into every composite but previously never explained (audit find):
  `a dusty-violet line → a real farm fence following exactly that path (posts + wire); a gold dashed line → a walking path of exactly that route; a light-blue dashed line → a swale (on-contour water-harvesting ditch with a planted berm) along exactly that line; a dark-blue line → a buried water pipe route (show as a subtle trench-line); a green dashed line → a drip-irrigation line along the beds it crosses; a deep-green line → a windbreak hedge of dense shrubs/trees along exactly that line. `;

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

// Every style MUST render the ground as living land — a style that swaps the plot for "paper" or
// blank white is exactly the satellite-disappears failure. Named colours (not just mood words) give
// the model something concrete to hold constant across the 5 independent calls of one batch.
export const STYLE_LINES: Record<StylePreset, string> = {
  field_ledger:
    'STYLE — Field Ledger: a hand-inked site plan — fine dark sepia pen linework over rich watercolour, warm credible surveyor character. Fixed palette: sage-green lawn, olive veld, warm buff soil, slate-grey roofs, muted terracotta accents, off-white paper panels. The ground is always painted as living land with visible lawn/veld/soil texture.' + PLAN_SET_ANCHOR,
  homestead_storybook:
    'STYLE — Homestead Storybook: a saturated gouache picture-book garden map, rounded beds bursting with vegetables, canopy-textured fruit trees, whimsical but legible. Fixed palette: leaf green, warm ochre, terracotta, cream, denim-blue water, charcoal linework.' + PLAN_SET_ANCHOR,
  extension_blueprint:
    'STYLE — Extension Blueprint: a clean technical site plan with slight isometric character on structures, thin consistent linework, high legibility at small print size. Fixed palette: slate blue, sage green, buff soil, warm grey, off-white paper — the ground is always softly tinted living land (sage lawn, buff soil, olive veld), never blank white.' + PLAN_SET_ANCHOR,
  karoo_folk:
    'STYLE — Karoo Folk Map: a bold naive folk-art farm map, flattened bird’s-eye view, decorative South African folk-pattern textures, charming handmade brushwork. Fixed palette: barn red, cobalt blue, sunflower yellow, pine green, whitewash cream.' + PLAN_SET_ANCHOR,
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
    ? `\n\nThis sheet shows one layer of the plan: the features listed above are the stars — render them rich and detailed. The rest of the plot stays a quiet, softly painted base of lawn, veld and the existing buildings in the same style.`
    : '';
  return `${STYLE_LINES[stylePreset]}

Turn this satellite photo of a real South African smallholding into a beautiful hand-illustrated site plan sheet titled "${title}".

You are RENDERING an existing plan, not designing a new one — stay faithful to the photo. Illustrate the land inside the property boundary in the style above, keeping the ground exactly as the photo shows it: open lawn stays open lawn, grass stays grass, bare soil stays bare soil. Paint each building as its FULL roof seen from directly above, keeping the exact roof outline — never crop, shrink, cover or plant over any part of a roof. Everything outside the boundary stays the untouched original photograph; the boundary line, every roof and the driveway keep exactly the shape, size and position the photo shows; top of the image is north.

Each coloured marker on the photo is a placeholder — paint the real thing in its place, same spot, same size, same count: ${LEGEND_BY_SHEET[sheetKind]}. This sheet's features are: ${elementsText}. Every tree, bed, tank and feature you paint sits on one of these markers — ground with no marker stays open lawn or veld, unchanged. Add nothing that is not marked: no extra trees, beds, ponds or paths of your own.${singleLayer}

In the corner with the least map content, on clean paper panels in the same style: a title block reading "${title}" — the largest lettering on the sheet — a small legend listing each of this sheet's feature types with a colour swatch beside its name, and a small north arrow. Label up to six of the most important features in small elegant lettering placed beside them, using exactly these spellings: ${elementsText}${placeName ? '; ' + placeName : ''}. These are the only words anywhere on the sheet, all horizontal and print-legible.`;
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
