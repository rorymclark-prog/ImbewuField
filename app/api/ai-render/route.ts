import { NextRequest, NextResponse } from 'next/server';
import { middayFromLat } from '@/lib/sector';

// Gemini image generation can take 10-60s — Vercel max.
export const maxDuration = 60;

const GEMINI_MODELS = {
  'flash': 'gemini-3.1-flash-image',
  'pro':   'gemini-3-pro-image',
  'pro-preview': 'gemini-3-pro-image-preview',
} as const;
type GeminiModel = keyof typeof GEMINI_MODELS;

type RenderLayer = 'overall' | 'base' | 'sector' | 'zone' | 'water' | 'opportunity' | 'planting' | 'implementation';

interface SurveyCtx {
  siteType?: string;
  adults?: string;
  goals?: string[];
  waterSource?: string[];
  waterStorage?: string[];
  existingCrops?: string[];
  livestock?: string[];
  otherInfra?: string[];
  soilCondition?: string;
  hasFencing?: string;
  farmingPractice?: string;
  challenges?: string[];
  notes?: string;
}

interface MapCriteria {
  mustInclude?: string[];
  mustAvoid?: string[];
  labelPolicy?: string[];
  composition?: string[];
}

interface RenderContext {
  placeName?: string;
  address?: string;
  layer?: RenderLayer;
  strictMap?: boolean;
  mapCriteria?: MapCriteria;
  // Signed latitude (negative south) — lets the prompt say which side the noon sun is actually on
  // instead of hardcoding "north" (false inside the tropics; SECTOR-MODEL-SPEC §0.2). Optional:
  // when absent, the prompt falls back to the old "north" assumption, correct for the vast
  // majority of South African sites.
  lat?: number;
  biome?: string;
  rainfallMm?: number;
  rainfallPattern?: string;
  soilTexture?: string;
  soilPh?: number;
  slopeDeg?: number;
  aspectLabel?: string;
  minTemp?: number;
  maxTemp?: number;
  zones?: Array<{ n: number; title: string; items?: string[] }>;
  polygons?: Array<{ name: string; type?: string; area?: string }>;
  survey?: SurveyCtx;
  designBrief?: {
    zones: Array<{ n: number; title: string; where: string; contents: string }>;
    water: string[];
    access: string[];
  };
  placedElements?: Array<{ type: string; label: string; note?: string; locationHint: string }>;
}

// §0.2 shared helper use: `sunSide` is 'N' unless a real latitude places the site inside the
// tropics (|lat| < 23.4359°, e.g. northernmost SA ≈ -22.13°), where it can honestly be 'S' or
// 'mixed'. Defaults to the old "north" assumption when no latitude is supplied — correct for the
// large majority of South African sites this app serves.
function sunSideFromLat(latDeg?: number): 'N' | 'S' | 'mixed' {
  return latDeg != null && Number.isFinite(latDeg) ? middayFromLat(latDeg) : 'N';
}

function layerTheme(layer: RenderLayer, latDeg?: number): string {
  const sunSide = sunSideFromLat(latDeg);
  const sunSideWord = sunSide === 'N' ? 'NORTH' : sunSide === 'S' ? 'SOUTH' : 'NORTH in winter / SOUTH in summer';
  switch (layer) {
    case 'base':
      return `MAP TYPE: EXISTING SITE MAP — "What is here now?"

Show ONLY what already exists on the site before any design. This is the truth map.

INCLUDE:
• Property boundary (green outline, no fill)
• House / roof footprint with label
• Driveway and access — find it in IMAGE 2 (satellite) if not traced
• Surrounding road
• Existing vegetable garden (orange border, no fill, labelled)
• Existing trees and tree belts
• Lawn / open areas
• Hard surfaces, patio, parking if visible
• Water tanks / ponds / taps if visible
• Fence or gate if visible
• North arrow (top-right, inside boundary)
• Scale bar (bottom-left, inside boundary)

DO NOT INCLUDE:
• Zone badges (0–5)
• Design arrows or recommendations
• Proposed features of any kind
• Water-flow indicators unless a channel is physically visible
• Decorative permaculture elements

VISUAL RULE: This must be the cleanest, most accurate map. Use solid lines for existing features, very thin outlines, minimal colour. Let the satellite show through.`;

    case 'sector':
      return `MAP TYPE: SECTOR ANALYSIS MAP — "What forces affect this site?"

Show what enters the property from OUTSIDE the boundary. Use bold arrows originating outside the green boundary pointing inward.

INCLUDE:
• Property boundary + house + driveway as base (no fill)
• SUN: This site is in South Africa — the strongest useful sun passes through the ${sunSideWord}. Show a large sun arc passing through the ${sunSideWord}. Summer sun = high arc, strong; winter sun = lower arc, weaker. Draw as a clean inset diagram in a corner — NOT distorted across the property.
• PREVAILING WIND: large arrow with label (use biome/climate data provided). Summer wind vs winter wind if different.
• STORM WIND: if applicable, separate arrow
• WATER IN / OUT: where runoff enters and exits the boundary (follow slope direction)
• FIRE RISK: if vegetation density / dry season suggests it, arrow from risk direction
• NOISE / DUST: from adjacent road or neighbours
• PRIVACY / VIEW: issues from neighbours or road
• FROST POCKET: if slope drains cold air to a low point

DO NOT:
• Place the sun arc randomly across the property (it belongs as a corner inset)
• Add zone badges, planting details, or design recommendations
• Obscure the driveway

VISUAL RULE: All sector forces = large, bold coloured arrows entering from outside the boundary. Keep property features as thin grey outlines only.`;

    case 'zone':
      return `MAP TYPE: PERMACULTURE ZONE MAP — "Where should things go by frequency of use?"

THIS IS A TINT-AND-LABEL JOB ON THE REAL PHOTO. Keep the real satellite image — the real house, real trees, real driveway, real ground — fully visible. You are laying translucent colour washes and badges ON TOP of the real photo. You are NOT painting a new landscape, NOT planting an orchard, NOT drawing rows of trees.

Lay 6 SEE-THROUGH colour washes over the real ground, organised by management frequency outward from the house:
• Zone 0 — the real house roof (light tint + pill "Zone 0 — House")
• Zone 1 — Daily use: the ring of ground right around the house
• Zone 2 — Intensive: the existing vegetable-garden ground
• Zone 3 — Orchard / food forest: open sunny ground on the north / north-east side (just TINT this ground — do NOT draw trees on it)
• Zone 4 — Low-care / managed: further-out ground
• Zone 5 — Wild edge / buffer: the existing tree-belt ground at the boundary

Each zone = a translucent coloured region (the real photo shows through it) + ONE numbered badge (0–5) + ONE short name pill. Thin dashed lines where zones meet. Mark the driveway and main path.

DO NOT:
• Repaint or replace the satellite photo with an illustration
• Draw rows or grids of identical trees, or plant an orchard — keep the REAL trees from the photo
• Use heavy opaque fills — every wash must be see-through
• Add a colour legend or key — label zones directly with their pills
• Move a zone off the real feature it sits on

VISUAL RULE: The output must still read as the REAL aerial photo, with coloured zone washes + badges added on top. Nothing invented.`;

    case 'water':
      return `MAP TYPE: WATER MAP — "Where does water come from, go, and need to be stored?"

This is a detailed WATER INFRASTRUCTURE map. Show ALL of the following INSIDE the property boundary only:

INCLUDE:
• RAINWATER HARVESTING: JoJo tank icons (green cylindrical tank, common in South Africa) next to house gutters — label capacity e.g. "5 000 L JoJo". Show downpipe → tank flow with a small blue arrow.
• GREYWATER: dashed grey line from house → greywater mulch basin or constructed wetland nearby. Label "Greywater → mulch basin".
• DRIP IRRIGATION: fine dashed blue lines running across vegetable garden beds. Small tap-point markers (⊕) at each connection. Label "Drip irrigation".
• TAP POINTS: small ⊕ marker at house and garden tap locations.
• SURFACE RUNOFF: bold blue arrows showing water flowing downhill following the visible slope. Arrows INSIDE the boundary ONLY.
• SWALES ON CONTOUR: dashed blue lines running ACROSS the slope (not downhill). Label "Swale on contour — slow, spread, sink".
• DAM / POND: if visible or suitable at lowest point, mark with a blue water body icon.
• INFILTRATION BASIN: small basin symbol at the base of swales.
• Bottom note: "Water law: consult DWS before storing >100 kL"

DO NOT:
• Show zone badges (0–5) — suppress them entirely
• Send overflow arrows toward the house foundations
• Draw swales running downhill
• Annotate anything outside the green boundary

VISUAL RULE: Blue dominates. Mute all non-water features to very soft grey outlines only. Water movement must be easy to read at a glance.`;

    case 'opportunity':
      return `MAP TYPE: OPPORTUNITY MAP — "Where are the best upgrades?"

Show the HIGHEST-VALUE design moves on this specific site. Do NOT show everything — only the top opportunities with the biggest return.

INCLUDE:
• Best compost station location (near garden, shaded, accessible)
• Nursery / seedling table location (sheltered, near water)
• Rainwater tank upgrade or addition opportunity
• Tank overflow improvement route
• Banana circle or wet-productive zone (near greywater outlet if suitable)
• Orchard opportunity zone (north-facing open ground)
• Food forest edge opportunity (sunny boundary edge)
• Pollinator strip location (along vegetable beds)
• Windbreak planting opportunity (exposed boundary)
• Mulch bank / chop-and-drop species placement
• Chicken / animal system opportunity if layout allows
• Market garden expansion area

PRIORITY SYMBOLS:
⭐ Do First (0–3 months) — highest impact, lowest cost
★ Do Next (3–6 months) — builds on what was done first
○ Later (6 months+) — valuable but not urgent

DO NOT:
• Show too many opportunities — choose the best 8–12
• Make the map feel like a shopping list
• Ignore access, existing features, or water

VISUAL RULE: Large numbered opportunity circles with colours by phase (orange = first, green = next, blue = later). Label each opportunity on the spot with a small pill — NO side legend or key.`;

    case 'planting':
      return `MAP TYPE: PLANTING DESIGN MAP — "What should be planted where?"

Show PLANT GROUPS in the right locations — not individual crop names crowded on the map. Use top-view icons and label each group with a small pill ON the planting itself (e.g. "Orchard: citrus, mango"). NO side legend — labels sit on the map.

INCLUDE (in the correct spatial locations):
• Kitchen herbs near the house (label: "Herbs: basil, coriander, chives...")
• Vegetables in existing/intensive beds (label "Veg beds")
• Fruit trees in orchard zone to the NORTH (label: "Orchard: citrus, mango, avocado, indigenous fruit by biome")
• Food forest edge — layered system at sunny boundary (label: "Food forest: canopy + understorey + groundcover")
• Bananas or wet-loving plants near greywater outlet / moist low point
• Drought-tolerant plants on dry western or south-facing edges
• Support species where soil needs building first (pigeon pea, comfrey, vetiver)
• Windbreak trees on exposed boundaries (label "Windbreak")
• Pollinator strips alongside vegetable beds
• Mulch bank / chop-and-drop species near production area
• Indigenous biodiversity buffer in Zone 5 / tree belt edge

USE ICONS for each group (herbs, vegetables, fruit trees, bananas/wet crops, support species, pollinators, windbreak, food forest, mulch bank, indigenous buffer).

DO NOT:
• Write every individual crop name directly on the map
• Place high-water crops in dry areas
• Place daily herbs far from the house
• Ignore existing tree belts or structures
• Plant on, or cover, the driveway — keep the traced access track clear and visible
• Plant on the house roof — planting goes on open ground only

VISUAL RULE: Map shows top-view plant groups on the real photo, each with a small on-feature label pill. NO side legend, NO key.`;

    case 'implementation':
      return `MAP TYPE: IMPLEMENTATION / PHASING MAP — "Where do I start?"

Turn the design into numbered action points on the ground. Show WHAT to do and WHERE to do it, in the right order.

INCLUDE numbered action pins at their REAL LOCATIONS on the site:

PHASE 1 — 0 to 30 days (ORANGE pins):
① Fix water movement — improve downpipes, redirect overflow
② Mulch all existing beds deeply
③ Set compost system in place (3-bin or circle)
④ Mark and define main access paths

PHASE 2 — 1 to 3 months (GREEN pins):
⑤ Improve and expand vegetable beds
⑥ Start nursery — seedling table and shade structure
⑦ Plant kitchen herb garden near house
⑧ Install or upgrade first rainwater tank + overflow

PHASE 3 — 3 to 6 months (BLUE pins):
⑨ Plant support species (pigeon pea, comfrey, vetiver)
⑩ Plant windbreak on exposed boundary
⑪ Establish pollinator strips along veg beds
⑫ Prepare orchard ground (mulch, compost, soil-building)

PHASE 4 — 6 to 12 months (TEAL pins):
⑬ Plant fruit trees in orchard zone
⑭ Establish food forest edge planting
⑮ Improve irrigation to vegetable beds
⑯ Add animal system if suitable

PHASE 5 — Year 2+ (PURPLE pins):
⑰ Expand orchard
⑱ Expand market garden production
⑲ Add value-adding / enterprise systems

Connect pins in sequence with a dotted line.

DO NOT:
• Show every task — only the key ground-level actions
• Place pins outside the property boundary

VISUAL RULE: Large coloured numbered circles. The farmer must know where to walk first thing tomorrow.`;

    default: // 'overall' — full design map
      return `MAP TYPE: FULL PERMACULTURE DESIGN MAP — "What does the whole design become?"

This is the POSTER MAP — beautiful, accurate, readable. Combine all design layers in one balanced composition.

INCLUDE:
• Property boundary (clear green outline)
• House / Zone 0 (roof shape, solid, labelled)
• Driveway and main access spine
• Existing vegetable garden
• Zone 1 daily-use area around house
• Zone 2 regular-use production
• Zone 3 orchard / food forest (${sunSideWord}-facing ground)
• Zone 4 low-care managed production
• Zone 5 wild / biodiversity buffer (existing tree belt)
• Water catchment: JoJo tanks, swales, overflow route
• Main walking paths between zones
• Compost station
• Nursery / seedling area
• Windbreak planting
• Plant group labels (food forest, orchard, herbs, veg, windbreak)
• Pollinator strips
• North arrow
• Scale bar
• Zone numbers labelled with on-map pills (NO side legend or key)
• Sun-sector inset in a corner: ${sunSideWord.toLowerCase()} = strongest useful sun, east = sunrise, west = sunset, summer = high arc, winter = lower arc

DO NOT:
• List every individual crop or crop name on the map
• Include every calculation or data figure
• Add every risk or monthly task
• Overcrowd the map

VISUAL RULE: This is the poster map. Accurate AND beautiful. The kind a paid landscape designer hands a client. Zones as semi-transparent washes. Water features in soft blue. Food forest in rich green. Let the satellite show through everywhere.`;
  }
}

function buildPrompt(ctx: RenderContext): string {
  const layer = ctx.layer ?? 'overall';
  const zoneLines = (ctx.zones ?? [])
    .map((z) => `  • Zone ${z.n}: ${z.title}${z.items?.length ? ` (${z.items.slice(0, 3).join(', ')})` : ''}`)
    .join('\n');
  const polyLines = (ctx.polygons ?? [])
    .map((p) => `  • ${p.name}${p.type ? ` [${p.type}]` : ''}${p.area ? ` — ${p.area}` : ''}`)
    .join('\n');
  const s = ctx.survey;
  const surveyLines = s
    ? [
        s.adults ? `Household: ${s.adults}` : '',
        s.goals?.length ? `Goals: ${s.goals.join(', ')}` : '',
        s.waterSource?.length ? `Water sources: ${s.waterSource.join(', ')}` : '',
        s.waterStorage?.length ? `Water storage: ${s.waterStorage.join(', ')}` : '',
        s.existingCrops?.length ? `Existing crops: ${s.existingCrops.join(', ')}` : '',
        s.livestock?.length ? `Livestock: ${s.livestock.join(', ')}` : '',
        s.otherInfra?.length ? `Existing infrastructure: ${s.otherInfra.join(', ')}` : '',
        s.soilCondition ? `Soil (farmer-assessed): ${s.soilCondition}` : '',
        s.hasFencing ? `Fencing: ${s.hasFencing}` : '',
        s.farmingPractice ? `Practice: ${s.farmingPractice}` : '',
        s.challenges?.length ? `Challenges: ${s.challenges.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n  ')
    : '';
  const siteFigs = [
    ctx.biome,
    ctx.rainfallMm ? `${ctx.rainfallMm} mm/yr${ctx.rainfallPattern ? ` (${ctx.rainfallPattern})` : ''}` : '',
    ctx.soilTexture ? `${ctx.soilTexture} soil` : '',
    ctx.soilPh ? `pH ${ctx.soilPh}` : '',
    ctx.slopeDeg != null ? `slope ${ctx.slopeDeg}°` : '',
    ctx.aspectLabel ? `faces ${ctx.aspectLabel}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const showZones = layer !== 'water' && layer !== 'sector' && layer !== 'base';

  // Did the farmer trace a driveway / access route? If so, it's a locked feature.
  const hasDriveway = (ctx.polygons ?? []).some(
    (p) => p.type === 'access' || /drive|access|track|road|gate|entrance/i.test(p.name ?? ''),
  );
  const drivewayRule = hasDriveway
    ? `\n═══ CRITICAL RULE #3 — THE FARMER TRACED THE DRIVEWAY ═══
A driveway / vehicle access route HAS BEEN TRACED by the farmer — it is the dashed access line in IMAGE 1. You MUST render it as a clear, continuous dashed vehicle track running from the road/gate to the house, in its traced position. Keep it COMPLETELY CLEAR — no trees, beds, plantings, washes, or labels on top of the driveway. It is a hard surface, not plantable ground. Do not omit it, do not move it.\n`
    : `\nACCESS: If a vehicle track is visible in the satellite (IMAGE 2), mark it as a subtle dashed access line from the road to the house, inside the boundary. Keep it clear of plantings.\n`;

  // The SHARED design brief — identical block on every DESIGN map so they all agree.
  // EXCLUDED from 'base' (Existing Site): that map must show only what exists today,
  // never the proposed design — injecting the brief would corrupt the baseline.
  const brief = layer === 'base' ? undefined : ctx.designBrief;
  const briefBlock = brief
    ? `\n═══ MASTER DESIGN BRIEF — ALL MAPS SHARE THIS ONE DESIGN ═══
This site has ONE permaculture design. Every map (zones, planting, water, phasing, opportunities…) shows the SAME design from a different angle — so they MUST agree on WHERE everything is. Use these exact placements; do NOT invent new positions or move elements between maps.

ZONES (placement is fixed):
${brief.zones.map((z) => `• ${z.title} — ${z.where}. Contains: ${z.contents}.`).join('\n')}

WATER (same on every map that shows water):
${brief.water.map((w) => `• ${w}`).join('\n')}

ACCESS (same on every map):
${brief.access.map((a) => `• ${a}`).join('\n')}

Whatever this specific map emphasises, keep all of the above in the SAME positions it has on the other maps. The orchard is always in the same place; the vegetable beds are always in the same place; the tanks are always in the same place.\n`
    : '';

  // Sun/azimuth diagram belongs ONLY on the sector (Sun & Wind) map. On every other map it
  // was leaking a sun compass into the corner (e.g. on the zones map). Forbid it elsewhere.
  // §0.2: the peak side is computed from the site's real latitude (middayFromLat), not hardcoded
  // "north" — false inside the tropics, where the two solstices can disagree (`sunSide==='mixed'`).
  const sunSideForRule = sunSideFromLat(ctx.lat);
  const sunSideRuleWord = sunSideForRule === 'N' ? 'NORTH' : sunSideForRule === 'S' ? 'SOUTH' : 'NORTH in winter / SOUTH in summer';
  const sunRule = layer === 'sector'
    ? `SOUTHERN HEMISPHERE SUN RULE:
This property is in South Africa. The ${sunSideRuleWord} side receives the strongest useful solar energy.
• Do NOT draw a sun arc randomly across the property map.
• Place a clean sun-sector inset diagram in a corner only.
  - ${sunSideRuleWord} face = strongest useful sun exposure
  - East = sunrise, West = sunset
  - Summer sun = high arc, strong and hot
  - Winter sun = lower arc, weaker`
    : `SUN: Do NOT draw any sun arc, compass, azimuth, or solar inset diagram anywhere on this map — that belongs only on the Sun & Wind (sector) map.`;

  // Farmer-placed point features (tanks, taps, boreholes, etc.) — same 'base' exclusion as
  // designBrief: the existing-site map shows only what's physically there today, not plans.
  const placedElements = layer === 'base' ? undefined : ctx.placedElements;
  const placedElementsBlock = placedElements?.length
    ? `\n═══ FARMER-PLACED ELEMENTS — KEEP EXACTLY WHERE SHOWN ═══
These are REAL features the farmer has already placed on the site. They MUST appear at their approximate position below — do NOT invent them elsewhere, do NOT omit any of them, and do NOT move them to a "better" spot.
${placedElements.map((e) => `• ${e.label}${e.note ? ` (${e.note})` : ''} — ${e.locationHint}`).join('\n')}\n`
    : '';

  return `You are a professional permaculture cartographer creating a presentation-quality map for "${ctx.placeName ?? 'a South African farm'}".

TWO REFERENCE IMAGES:
• IMAGE 1 (app map): The authoritative geometry reference. Use it for the exact property boundary shape, house/roof outline, vegetable garden position, and all traced polygon locations and proportions. These positions are FIXED — do not move, rotate, or rescale them.
• IMAGE 2 (satellite): The visual reference. Use it for the real driveway and vehicle track, actual roof shape and colour, surrounding roads, neighbouring buildings, tree canopy texture, garden and lawn appearance, and overall landscape character.

CRITICAL — GEOMETRY RULES:
• THIS IS PHOTO ANNOTATION, NOT A NEW PAINTING. The real satellite photo is the base layer and its real house, real trees, real driveway and real ground MUST remain clearly visible in the output. Add your design elements ON TOP of the real photo. Do NOT replace the scene with an illustrated/painted landscape, and do NOT invent buildings, trees, beds, or features that are not in the photos.
• Keep north exactly as shown. Do NOT rotate the property.
• Preserve all relative positions, shapes, proportions, and scales from IMAGE 1.
• Do not invent a new house shape, move the driveway, or change the boundary.
• Do not invent new roads, ponds, buildings, beds, or paths — unless clearly labelled PROPOSED.
• Existing features = solid lines. Proposed features = dashed lines or lighter transparent fills.
• The final map may be redrawn and visually improved, but geometry must remain faithful to the two reference images.

═══ CRITICAL RULE #1 — ABSOLUTELY NO LEGEND, KEY, OR TITLE PANEL ═══
Do NOT draw ANY of the following anywhere in the image: a legend, a key, a colour key, a zone-colour list, a side panel, an info panel, a notes box, a title card, or a vertical strip down any edge. The app adds the title separately. If you feel the urge to add a legend — DO NOT. Instead, label features by writing the name DIRECTLY ON the feature itself as a small pill (e.g. a pill reading "Zone 3 — Orchard" sitting on the orchard). On-map labels ONLY. A legend panel will RUIN the output — leave it out entirely.

═══ CRITICAL RULE #2 — EVERYTHING STAYS INSIDE THE GREEN LINE ═══
The GREEN outline in IMAGE 1 is the PROPERTY BOUNDARY. EVERY zone colour, tree, bed, planting, arrow, icon and label MUST stay STRICTLY INSIDE the green line. Do NOT let any coloured zone, tree row, or planting cross or spill past the green boundary. The land OUTSIDE the green line belongs to neighbours — render it as the plain untouched satellite photo with NOTHING drawn on it: no colour, no trees, no labels, no marks.
${drivewayRule}

OVERLAY SHAPES (positions are locked from farmer tracing):
• GREEN outline = PROPERTY BOUNDARY — keep as thin green border, NO fill.
• ORANGE/YELLOW area = VEGETABLE GARDEN — thin orange border, small icon only, NO heavy fill.
• DASHED line = DRIVEWAY — keep as dashed line, NO fill. If no dashed driveway is visible, find the vehicle track in IMAGE 2 and mark it with a subtle dashed line inside the boundary.
• BLUE area = HOUSE ROOF — thin blue outline, NO fill. Real roof is visible in IMAGE 2.

CRITICAL — THIS IS A TOP-DOWN MAP, NOT AN ILLUSTRATION:
• Draw EVERYTHING in plan view (bird's-eye, looking straight down) — exactly like a satellite photo or an architect's site plan.
• Trees and shrubs = circular canopy blobs seen FROM ABOVE (a green disc, not a side-view tree with a trunk). Vegetable beds = rectangles of rows seen from above. Tanks = circles. NEVER draw side-view / elevation / perspective objects (no standing trees, no 3D houses, no leaning plants).
• The HOUSE ROOF is a building. NEVER place plants, beds, trees, crops, icons, or planting labels ON TOP OF the roof. The roof stays clean — only the roof itself (and roof-water items like gutters/downpipe arrows) may sit there. All planting goes on the OPEN GROUND around the house.
• Keep every plant, bed and feature on real open ground inside the boundary — never on the roof, never on the driveway, never outside the green line.

${sunRule}

${briefBlock}
${placedElementsBlock}
${layerTheme(layer, ctx.lat)}
${showZones && zoneLines ? `\nPERMACULTURE ZONES (use these as placement guides):\n${zoneLines}` : ''}
${polyLines ? `\nSURVEYED POLYGONS (geometry reference):\n${polyLines}` : ''}
${surveyLines ? `\nSITE CONTEXT (farmer survey):\n  ${surveyLines}` : ''}
SITE DATA: ${siteFigs || 'South Africa'}

OUTPUT RULES:
• NO LEGEND, NO KEY, NO TITLE CARD, NO SIDE PANEL anywhere (see CRITICAL RULE #1). On-map labels only.
• Everything stays inside the green boundary (see CRITICAL RULE #2).
• COMPOSITION: CENTRE the property in the frame and zoom so it fills most of the canvas. Do NOT leave a blank, dark, or empty strip/margin on any side. No reserved label column or gutter.
• LABELS sit DIRECTLY ON or immediately touching their feature. Do NOT herd all labels into a column down one edge with long leader lines — keep each label next to the thing it names. Short text, small dark pill, BOLD, no two labels stacked in one spot.
• DO add: small north arrow (top-right, inside boundary), scale bar (bottom-left, inside boundary).
• Satellite photo = dominant visual layer. Annotations sit lightly and clearly on top.
• Strong visual hierarchy. Clean, professional result — the kind a paid designer hands a client.
• Output a single image that fills the ENTIRE square canvas edge to edge — the map reaches all four edges, no border, no panel, no empty space.`;
}

function buildStrictMapTouchupPrompt(basePrompt: string, ctx: RenderContext): string {
  const criteria = ctx.mapCriteria;
  const list = (items?: string[]) => (items?.length ? items.map((item) => `- ${item}`).join('\n') : '');

  const criteriaBlock = criteria
    ? [
        'SPECIFIC MAP CRITERIA',
        criteria.mustInclude?.length ? `MUST INCLUDE\n${list(criteria.mustInclude)}` : '',
        criteria.mustAvoid?.length ? `MUST AVOID\n${list(criteria.mustAvoid)}` : '',
        criteria.labelPolicy?.length ? `LABEL POLICY\n${list(criteria.labelPolicy)}` : '',
        criteria.composition?.length ? `COMPOSITION\n${list(criteria.composition)}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  return [
    'STRICT MAP EDIT MODE',
    'This is a cartographic edit, not a redesign. Preserve the traced geometry, north-up orientation, and the real satellite base exactly.',
    'Only repaint the editable background. Do not invent features, labels, legends, title cards, side panels, borders, 3D perspective, or decorative elements.',
    'Keep every locked boundary, roof, driveway, road, tree, bed, and line exactly where the mask and source image place it.',
    criteriaBlock,
    'BASE INSTRUCTION',
    basePrompt.trim(),
    'FINAL RULE — GEOMETRY LOCK',
    'If anything above could be read as permission to redraw, move, resize or restyle a drawn feature, it is not. The farmer-drawn geometry in the source image is final. Repaint the background only, keep the same framing and aspect as the source, and leave every locked pixel in place.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function callGemini(
  key: string,
  imageBase64: string,
  satBase64: string | null,
  photos: string[],
  prompt: string,
  model: GeminiModel = 'flash',
): Promise<NextResponse> {
  const modelId = GEMINI_MODELS[model] ?? GEMINI_MODELS.flash;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
    // The composite is PNG (see buildComposite); the satellite/photos remain JPEG.
    { inline_data: { mime_type: 'image/png', data: imageBase64 } },
    ...(satBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: satBase64 } }] : []),
    ...photos.map((d) => ({ inline_data: { mime_type: 'image/jpeg', data: d } })),
  ];
  const geminiBody = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['image', 'text'] },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Gemini error ${res.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json(
      { error: 'Gemini returned non-JSON response.', detail: raw.slice(0, 400) },
      { status: 502 },
    );
  }
  let out: string | null = null;
  for (const c of (data as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[] }).candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      const inl = p.inlineData ?? p.inline_data;
      if (inl?.data) out = inl.data;
    }
  }
  if (!out) {
    return NextResponse.json(
      { error: 'Gemini returned no image.', detail: JSON.stringify(data).slice(0, 400) },
      { status: 502 },
    );
  }
  return NextResponse.json({ image: `data:image/png;base64,${out}` });
}

async function callOpenAI(
  key: string,
  imageBase64: string,
  satBase64: string | null,
  prompt: string,
): Promise<NextResponse> {
  const form = new FormData();
  form.append('model', 'gpt-image-1'); // gpt-image-2 edits exceed Vercel Hobby's 60s cap (504) — reverted to the fast one
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', '1024x1024');
  // gpt-image-2 processes EVERY reference image at high fidelity → two images blew past
  // Vercel's 60s limit (504). Send only the composite + medium quality to stay in budget.
  form.append('quality', 'medium');

  // Single reference: the composite (satellite + geometry overlay already baked in).
  const compositeBuffer = Buffer.from(imageBase64, 'base64');
  form.append('image[]', new Blob([compositeBuffer], { type: 'image/jpeg' }), 'composite.jpg');
  void satBase64; // intentionally unused for gpt-image-2 (kept in signature for the API shape)

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `OpenAI error ${res.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json(
      { error: 'OpenAI returned non-JSON response.', detail: raw.slice(0, 400) },
      { status: 502 },
    );
  }

  const b64 = (data as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  if (!b64) {
    return NextResponse.json(
      { error: 'OpenAI returned no image.', detail: JSON.stringify(data).slice(0, 400) },
      { status: 502 },
    );
  }
  return NextResponse.json({ image: `data:image/png;base64,${b64}` });
}

// Flux (fal.ai) img2img at HIGH strength: the satellite is a loose compositional guide
// and the model GENERATES the design from this prompt (low strength just echoed the photo
// back). Design-rich + descriptive — Flux prefers description over instructions.
function buildFluxPrompt(ctx: RenderContext): string {
  const layer = ctx.layer ?? 'overall';
  const focus: Record<string, string> = {
    base: 'a clean existing-site map labelling only what is there now (house, driveway, garden, trees)',
    sector: 'bold sun/wind/water arrows entering from outside the boundary, plus a corner sun-path inset diagram',
    zone: 'permaculture ZONES 0–5 drawn as soft semi-transparent coloured washes (Zone 0 house, 1 daily-use ring, 2 veg beds, 3 orchard on the north side, 4 low-care, 5 wild edge) each with a numbered badge',
    water: 'a water plan — green JoJo rainwater tanks by the house, blue swale lines on contour, drip-irrigation lines across the veg beds, blue runoff arrows, a greywater mulch basin',
    opportunity: 'numbered priority circles marking the best upgrades — compost, nursery, orchard, windbreak, banana circle',
    planting: 'planting groups as neat TOP-VIEW symbols (canopy circles for fruit trees, rows for veg beds, clusters for herbs) with small labels — orchard, food forest, herbs, support species, windbreak, pollinator strip',
    implementation: 'numbered phased action points (1,2,3…) placed across the site and joined by a dotted path',
    overall: 'a complete permaculture master plan — zones as colour washes, orchard/food forest to the north, veg beds, water tanks & swales, windbreak, paths',
  };
  const site = [ctx.biome, ctx.rainfallMm ? `${ctx.rainfallMm} mm/yr` : '', ctx.soilTexture ? `${ctx.soilTexture} soil` : '']
    .filter(Boolean)
    .join(', ');
  const brief = ctx.designBrief;
  const layout = brief && layer !== 'base'
    ? ` Lay out: ${brief.zones.map((z) => `${z.title} ${z.where}`).join('; ')}. Water: ${brief.water.join('; ')}. Access: ${brief.access.join('; ')}.`
    : '';
  const placedLine = ctx.placedElements?.length
    ? ` Placed elements: ${ctx.placedElements.map((e) => `${e.label} (${e.locationHint})`).join('; ')}.`
    : '';
  return `A richly detailed, hand-illustrated TOP-DOWN permaculture DESIGN map of "${ctx.placeName ?? 'a South African farm'}"${site ? ` (${site})` : ''}, painted over the aerial photo. Show ${focus[layer] ?? focus.overall}.${layout}${placedLine} Style: professional illustrated GIS cartography — soft earth-tone palette, semi-transparent coloured overlays, top-view plant symbols, clean white labels on small dark pills, north up, subtle north arrow and scale bar. This must look like a designed permaculture plan, NOT a plain satellite photo. Keep the house, property boundary, driveway and existing garden in their current positions and proportions. No legend panel, no title card, no border, nothing outside the property.`;
}

async function callFal(
  key: string,
  imageBase64: string,
  prompt: string,
): Promise<NextResponse> {
  // Synchronous endpoint returns the image directly (no queue polling needed in <60s).
  const body = {
    prompt,
    image_url: `data:image/jpeg;base64,${imageBase64}`,
    strength: 0.85, // HIGH: satellite is a loose guide, model generates the design (low strength just echoed the photo). Boundary held by the hard clip.
    num_inference_steps: 34,
    guidance_scale: 3.5,
    image_size: { width: 1024, height: 896 }, // ~ satellite-area aspect (684:600)
    num_images: 1,
    enable_safety_checker: true,
  };
  let res: Response;
  try {
    res = await fetch('https://fal.run/fal-ai/flux-general/image-to-image', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `fal.ai error ${res.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json(
      { error: 'fal.ai returned non-JSON response.', detail: raw.slice(0, 400) },
      { status: 502 },
    );
  }
  const imgUrl = (data as { images?: { url?: string }[] }).images?.[0]?.url;
  if (!imgUrl) {
    return NextResponse.json(
      { error: 'fal.ai returned no image.', detail: JSON.stringify(data).slice(0, 400) },
      { status: 502 },
    );
  }
  // Fetch the result and inline it as a data URL (taint-free for download/export).
  try {
    const imgRes = await fetch(imgUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get('content-type') ?? 'image/jpeg';
    return NextResponse.json({ image: `data:${mime};base64,${buf.toString('base64')}` });
  } catch {
    // Fall back to the direct URL if inlining fails.
    return NextResponse.json({ image: imgUrl });
  }
}

// gpt-image-2 via fal's QUEUE (async): edits exceed Vercel's 60s cap, so we submit to the
// queue and return the status/response URLs — the client polls /api/ai-render/poll until
// done. The slow generation runs on fal, so no single request ever hits the timeout.
async function submitFalGptQueue(
  key: string,
  imageBase64: string,
  prompt: string,
  maskBase64: string | null,
): Promise<NextResponse> {
  const body: Record<string, unknown> = {
    prompt,
    image_urls: [`data:image/png;base64,${imageBase64}`],
    // High quality: the 60s-cap rationale on the sync path does NOT apply here — this is the
    // async fal queue (submit + poll), so generation runs off-request. High keeps the thin
    // geometry lines crisp so the model tracks the drawn shapes. PNG in/out avoids JPEG ringing
    // along those lines. See docs/GLOSSY-PROMPT-AUDIT.md §2.4.
    quality: 'high',
    image_size: 'auto',
    num_images: 1,
    output_format: 'png',
  };
  // Mask (OpenAI convention: transparent = editable) protects the house/driveway so only
  // the open ground is repainted. PNG, same dims as the composite.
  if (maskBase64) body.mask_url = `data:image/png;base64,${maskBase64}`;
  let res: Response;
  try {
    res = await fetch('https://queue.fal.run/openai/gpt-image-2/edit', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json({ error: `fal.ai submit error ${res.status}`, detail: detail.slice(0, 400) }, { status: 502 });
  }
  let data: { request_id?: string; status_url?: string; response_url?: string };
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json({ error: 'fal.ai submit returned non-JSON.', detail: raw.slice(0, 400) }, { status: 502 });
  }
  if (!data.status_url || !data.response_url) {
    return NextResponse.json({ error: 'fal.ai submit gave no status/response URL.', detail: JSON.stringify(data).slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ pending: true, statusUrl: data.status_url, responseUrl: data.response_url });
}

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; satBase64?: string; maskBase64?: string; photos?: string[]; context?: RenderContext; provider?: 'gemini' | 'openai' | 'fal' | 'falgpt'; geminiModel?: GeminiModel; touchupPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const stripDataUrl = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');
  const imageBase64 = stripDataUrl(body.imageBase64 ?? '');
  if (!imageBase64) {
    return NextResponse.json({ error: 'No composite image supplied.' }, { status: 400 });
  }
  const satBase64 = body.satBase64 ? stripDataUrl(body.satBase64) : null;
  const maskBase64 = body.maskBase64 ? stripDataUrl(body.maskBase64) : null;
  const photos = (body.photos ?? []).slice(0, 3).map(stripDataUrl).filter(Boolean);
  const prompt = buildPrompt(body.context ?? {});
  const provider = body.provider ?? 'gemini';
  const geminiModel: GeminiModel = (body.geminiModel && body.geminiModel in GEMINI_MODELS) ? body.geminiModel : 'flash';

  if (provider === 'openai') {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured on the server. Add it with: vercel env add OPENAI_API_KEY production' },
        { status: 500 },
      );
    }
    return callOpenAI(openaiKey, imageBase64, satBase64, prompt);
  }

  if (provider === 'fal') {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY is not configured on the server. Add it with: vercel env add FAL_KEY production' },
        { status: 500 },
      );
    }
    return callFal(falKey, imageBase64, buildFluxPrompt(body.context ?? {}));
  }

  if (provider === 'falgpt') {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY is not configured on the server. Add it with: vercel env add FAL_KEY production' },
        { status: 500 },
      );
    }
    const touchupPrompt = body.touchupPrompt?.trim();
    if (touchupPrompt) {
      const wrappedPrompt = body.context?.strictMap
        ? buildStrictMapTouchupPrompt(touchupPrompt, body.context ?? {})
        : `Make ONLY this specific change to the highlighted (transparent) region of the image; leave every other pixel exactly as it is: ${touchupPrompt}`;
      return submitFalGptQueue(falKey, imageBase64, wrappedPrompt, maskBase64);
    }
    return submitFalGptQueue(
      falKey,
      imageBase64,
      body.context?.strictMap ? buildStrictMapTouchupPrompt(prompt, body.context ?? {}) : prompt,
      maskBase64,
    );
  }

  // Default: Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }
  return callGemini(geminiKey, imageBase64, satBase64, photos, prompt, geminiModel);
}
