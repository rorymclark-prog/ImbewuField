// Design Studio — per-layer glossy filter helpers, extracted VERBATIM out of
// components/design/DesignGlossy.tsx so the pure layer-membership logic is unit-testable
// without pulling in the whole (5,000+ line) React component. Comments preserved as-is.

import { statusOf, type DesignCanvasState, type ElementStatus, type GroundFeatureKind, type LineShape, type WizardStep } from '@/lib/design-canvas';
import {
  CATEGORY_STEP,
  ELEMENTS_BY_ID,
  GROUND_FEATURES,
  ZONE_DEFS,
  type DesignElementDef,
  type ElementCategory,
} from '@/lib/design-elements';
import type { MapRefLayers } from '@/lib/base-layers';
import { PLANTING_ROUTE_STYLE } from '@/lib/planting-cartography';
import { EARTHWORKS_ROUTE_STYLE, WATER_ROUTE_STYLE } from '@/lib/water-cartography';

// Per-layer glossy: 'all' = the whole design; the others render just one theme (with the
// base map + ground context always kept so the picture is legible). Only the drawn marks in
// the chosen layer are locked; everything else is repainted as background.
export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'earthworks' | 'planting' | 'structures';

/** Formal titles shared by every deterministic-chrome render path. Keep these separate from the
 * short tab labels: the Water tab should stay compact, while its printed sheet needs to say what
 * the plan actually contains. */
export const REFERENCE_SHEET_LABEL: Record<GlossyLayerFilter, string> = {
  zones: 'Permaculture zone map',
  water: 'Water, greywater & irrigation',
  earthworks: 'Earthworks & contour setting-out',
  planting: 'Planting & agroforestry',
  structures: 'Small livestock & infrastructure',
  all: 'Final integrated masterplan',
};

/** The eight exact plan sheets do not all use saved design items the same way. A legend is an
 * index of FULL-STRENGTH content, not of every faint orientation mark: sheets 03, 04, 06 and 08
 * deliberately retain muted context so a farmer can locate the subject without claiming that
 * context as the sheet's own content. Keeping that distinction explicit prevents a test from
 * making a known mismatch "pass" through an undocumented exemption. */
export type ExactPlanSheetKey =
  | 'base'
  | 'sector'
  | 'zones'
  | 'water'
  | 'earthworks'
  | 'planting'
  | 'structures'
  | 'all'
  | 'implementation';

export type ExactElementRegister = 'content' | 'context' | 'absent';
export type SheetElementNaming = 'individual' | 'grouped';

/** Full-strength is deliberately a hard boundary. Anything painted below this opacity is context
 * and must remain visually subordinate; if a future renderer raises it to 1, it also takes on the
 * obligation to give that element family a legend row. */
export const EXACT_FULL_STRENGTH_ALPHA = 1;
export const EXACT_CONTEXT_ALPHA = {
  // The zone bands are the whole subject of sheet 03 and they are translucent themselves, so the
  // element ghosts underneath stay very quiet or the sheet becomes two competing layers.
  zones: 0.2,
  water: 0.72,
  /**
   * Raised from 0.24. Rory, on sheet 07: "plantings trees are barely visible again … maybe make
   * the plants and other elements not translucent."
   *
   * He is right, and the old number was hard to defend beside its neighbours: the water sheet
   * showed the same kind of orientation context at 0.72 while structures showed it at 0.24, for
   * the same job. At 0.24 over a muted aerial a tree canopy is a smudge — it fails even as
   * context, because context you cannot see does not orient anyone.
   *
   * NOT raised to 1, deliberately, and the constant above says why: full strength carries the
   * obligation of a legend row, and a legend listing every tree on the structures sheet would be
   * claiming them as this sheet's content when the sheet is about the compost bay and the path.
   * 0.55 is plainly visible and just as plainly subordinate to the full-strength marks beside it.
   */
  structures: 0.55,
  implementation: 0.88,
} as const;

/** Main-map access track spelling shared by the AI content list and the exact masterplan legend. */
export const EXACT_DRIVEWAY_LEGEND_TEXT = 'Tarred driveway';

/**
 * One naming rule for both on-map callouts and legend inventory.
 *
 * Layer sheets teach a specific system, so each callout keeps the same element/species identity
 * as its legend row. Only the integrated masterplan may trade that detail for grouped editorial
 * callouts; its legend is grouped by the same whole-farm families below.
 */
export function sheetElementNaming(sheet: ExactPlanSheetKey): SheetElementNaming {
  return sheet === 'all' ? 'grouped' : 'individual';
}

export function exactSheetElementRegister(
  def: Pick<DesignElementDef, 'category' | 'id' | 'name'>,
  sheet: ExactPlanSheetKey,
): ExactElementRegister {
  if (sheet === 'base' || sheet === 'sector') return 'absent';
  if (sheet === 'zones' || sheet === 'implementation') return 'context';
  if (sheet === 'all' || itemInFilter(def.category, sheet, def.id)) return 'content';
  if (sheet === 'water' && isContextElement(def, sheet)) return 'context';
  if (sheet === 'structures' && itemInFilter(def.category, 'planting', def.id)) return 'context';
  return 'absent';
}

/**
 * The same three-state register elements have, for LINES.
 *
 * WHY LINES NEEDED ONE. Elements could already be 'content' on their own sheet and 'context' on a
 * neighbouring one — that is how planting shows up as quiet ghosts under the Structures sheet.
 * Lines only ever had a boolean: lineInFilter says yes or no, and a swale that is not 'yes' on the
 * Water sheet is simply not drawn there.
 *
 * That boolean is why the Water sheet has no swale on it. Rory, twice: "we should have arrows in
 * the swales and show swales too?" and "theres no swale arrows? or swale?" — and he is right that
 * it belongs. The first attempt at this simply added 'swale' to lineInFilter's water case and broke
 * four tests enforcing "no line kind is owned by two steps — double ownership makes focus dimming
 * meaningless", which is load-bearing for the Design Studio's step focus. Relaxing that rule to get
 * a swale onto one sheet would have been trading a real invariant for a drawing.
 *
 * So ownership is untouched: lineInFilter still says the swale belongs to Earthworks and nowhere
 * else, and every one of those tests still passes. This adds the SECOND question next to it — not
 * "does this sheet own the line" but "should this sheet show it, quietly, because you cannot read
 * this sheet without it". Water is exactly that case: the swale is where the runoff on sheet 04 is
 * going, so a Water sheet without it draws arrows pointing at nothing.
 *
 * And because context sits below EXACT_FULL_STRENGTH_ALPHA, it carries no legend-row obligation —
 * which is what kept the earlier attempt honest-but-broken and this one honest-and-drawable.
 */
export function exactSheetLineRegister(kind: string, sheet: ExactPlanSheetKey): ExactElementRegister {
  if (sheet === 'base' || sheet === 'sector') return 'absent';
  if (sheet === 'zones' || sheet === 'implementation') return 'context';
  if (sheet === 'all' || lineInFilter(kind, sheet)) return 'content';
  // A swale is the destination of the Water sheet's own overland-flow arrows. Shown as the
  // earthwork it is (see drawSwaleCrossSection) and never as another blue plumbing line, which is
  // the confusion that got it removed from this sheet in the first place.
  if (sheet === 'water' && kind === 'swale') return 'context';
  return 'absent';
}

export type IntegratedLegendSection = 'WATER' | 'PLANTING' | 'INFRASTRUCTURE';

/** Families used by the integrated-sheet legend. An item may intentionally belong to more than
 * one family under today's editorial taxonomy, so this remains an ordered list of predicates
 * rather than a one-family lookup. The agreement test checks that every full-strength item hits at
 * least one family and that each family's printed count equals its matching markers. */
export const INTEGRATED_LEGEND_FAMILIES: ReadonlyArray<{
  text: string;
  swatch: string;
  section: IntegratedLegendSection;
  matches: (def: DesignElementDef) => boolean;
}> = [
  {
    text: 'Water storage & fittings', swatch: '#3F879C', section: 'WATER',
    matches: (def) => def.category === 'water' && !/pond|basin/i.test(def.name),
  },
  {
    text: 'Ponds, basins & water earthworks', swatch: '#6E9DA5', section: 'WATER',
    matches: (def) =>
      (sheetForElement(def.category, def.id) === 'water' && def.category === 'earthworks')
      || (sheetsForElement(def.category, def.id).includes('water') && /pond|basin|banana circle/i.test(def.name)),
  },
  {
    // THE EARTHWORKS SPLIT'S OWN LEGEND FAMILY. The family above used to catch every
    // earthworks-category element, because sheetForElement sent them all to 'water'. The moment
    // swale, contour berm, terrace and half-moon moved to their own sheet, that clause stopped
    // matching them and they matched NO family at all — so on the integrated masterplan they were
    // still drawn at full strength with zero legend representation. A mark on the map that the
    // legend cannot account for is the exact failure legend-map-agreement exists to catch, and it
    // caught this. Keyed off the SHEET rather than the category so it cannot drift from
    // sheetForElement the way a hand-listed defId set would.
    text: 'Land-shaping earthworks', swatch: '#A9743F', section: 'WATER',
    matches: (def) => sheetForElement(def.category, def.id) === 'earthworks',
  },
  {
    text: 'Production beds & crops', swatch: '#6E7F45', section: 'PLANTING',
    matches: (def) =>
      sheetForElement(def.category, def.id) === 'planting'
      && !(def.category === 'growing' && def.shape === 'circle'),
  },
  {
    text: 'Orchard & support trees', swatch: '#426044', section: 'PLANTING',
    matches: (def) => def.category === 'growing' && def.shape === 'circle',
  },
  {
    text: 'Structures & work areas', swatch: '#806645', section: 'INFRASTRUCTURE',
    matches: (def) => def.category === 'structure' || def.category === 'access',
  },
  {
    text: 'Livestock & apiary', swatch: '#C98A2C', section: 'INFRASTRUCTURE',
    matches: (def) => def.category === 'animal',
  },
];

export interface ExactElementLegendGroup {
  text: string;
  count: number;
  defId: string;
  /**
   * Whether these are already standing or are being proposed.
   *
   * THE FARMER HAS ALWAYS BEEN ABLE TO SET THIS AND NOTHING HAS EVER READ IT. `statusOf` had zero
   * callers in the whole repo: a farmer could mark their existing tank as existing and the plan set
   * would list it beside the four they are asking a funder to buy, indistinguishable. That is not a
   * cosmetic gap — the single most important thing a plan says is which parts of it do not exist
   * yet, and a legend that cannot say so overstates the proposal every time.
   *
   * Items are grouped by name AND status, so three existing tanks and one proposed tank are two
   * rows rather than "Tank x4".
   */
  status: ElementStatus;
}

export interface ExactLineLegendGroup {
  text: string;
  count: number;
  lineKind?: LineShape['kind'];
}

/**
 * Splits swales by the widths the farmer actually stated, rather than collapsing different
 * earthworks into one vague count. An omitted width remains omitted: the cartographic band has a
 * legibility treatment, but that paint decision is not a construction dimension and must never
 * reach a printed legend as one.
 */
function swaleLegendGroups(lines: LineShape[], label: string): ExactLineLegendGroup[] {
  const groups = new Map<number | undefined, number>();
  for (const line of lines) {
    const widthM = Number.isFinite(line.widthM) && (line.widthM as number) > 0 ? line.widthM : undefined;
    groups.set(widthM, (groups.get(widthM) ?? 0) + 1);
  }
  return [...groups.entries()].map(([widthM, count]) => ({
    text: widthM == null ? label : `${label} — ${String(widthM)} m wide`,
    count,
    lineKind: 'swale',
  }));
}

export interface ExactZoneLegendGroup {
  text: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ExactGroundLegendGroup {
  text: string;
  color: string;
  feature: GroundFeatureKind;
}

/** The exact renderer's item legend inventory, kept pure so the all-eight-sheet agreement check
 * runs without a browser or React. `sheetLegendRows` consumes this same inventory; map membership
 * remains independently owned by exactSheetElementRegister/itemInFilter, which is what lets the
 * test catch a full-strength marker whose legend family is missing. */
export function exactSheetElementLegendGroups(
  state: DesignCanvasState,
  sheet: ExactPlanSheetKey,
): ExactElementLegendGroup[] {
  if (sheet === 'base' || sheet === 'sector' || sheet === 'zones' || sheet === 'implementation') return [];

  const content = state.items.filter((item) => {
    const def = ELEMENTS_BY_ID[item.defId];
    return Boolean(def && exactSheetElementRegister(def, sheet) === 'content');
  });

  // PROPOSED FIRST, THEN EXISTING. A plan is read to find out what is being asked for; what is
  // already standing is the context for that. Within each status the original ordering is kept, so
  // this only ever splits a row in two — it never reshuffles a sheet's inventory.
  const byStatus = (items: typeof content, status: ElementStatus) =>
    items.filter((item) => statusOf(item) === status);

  if (sheetElementNaming(sheet) === 'grouped') {
    const groups: ExactElementLegendGroup[] = [];
    for (const status of ['proposed', 'existing'] as const) {
      const slice = byStatus(content, status);
      for (const family of INTEGRATED_LEGEND_FAMILIES) {
        const matches = slice.filter((item) => family.matches(ELEMENTS_BY_ID[item.defId]));
        if (matches.length) {
          groups.push({ text: family.text, count: matches.length, defId: matches[0].defId, status });
        }
      }
    }
    return groups;
  }

  const groups = new Map<string, ExactElementLegendGroup>();
  for (const status of ['proposed', 'existing'] as const) {
    for (const item of byStatus(content, status)) {
      const def = ELEMENTS_BY_ID[item.defId];
      const key = `${status}:${def.name}`;
      const group = groups.get(key) ?? { text: def.name, count: 0, defId: def.id, status };
      group.count += 1;
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

/** Line rows shared by the AI inventory and exact legend. This includes the masterplan's deliberate
 * editorial grouping; rebuilding individual route names in the prompt made its legend describe a
 * different sheet even when both paths counted the same saved lines. */
export function exactSheetLineLegendGroups(
  state: Pick<DesignCanvasState, 'lines'>,
  sheet: ExactPlanSheetKey,
): ExactLineLegendGroup[] {
  if (
    sheet === 'base'
    || sheet === 'sector'
    || sheet === 'zones'
    || sheet === 'implementation'
  ) return [];

  if (sheet === 'all') {
    const groups: ExactLineLegendGroup[] = [];
    // 'bedpath' counts with the access family: the masterplan draws it (lineInFilter admits it on
    // 'all'), and a mark on the sheet with no legend key is this module's own definition of a bug.
    const accessCount = state.lines.filter((line) =>
      line.points.length >= 2
      && (line.kind === 'path' || line.kind === 'bedpath' || line.kind === 'fence' || line.kind === 'windbreak')).length;
    if (accessCount) groups.push({ text: 'Paths, fences & windbreaks', count: accessCount });
    for (const kind of ['swale', 'pipe', 'drip', 'greywater'] as const) {
      const lines = state.lines.filter((line) => line.kind === kind && line.points.length >= 2);
      if (!lines.length) continue;
      if (kind === 'swale') {
        groups.push(...swaleLegendGroups(lines, WATER_ROUTE_STYLE.swale.label));
      } else {
        groups.push({ text: WATER_ROUTE_STYLE[kind].label, count: lines.length, lineKind: kind });
      }
    }
    return groups;
  }

  const groups: ExactLineLegendGroup[] = [];
  for (const kind of ['swale', 'fence', 'path', 'bedpath', 'pipe', 'drip', 'windbreak', 'greywater'] as const) {
    // A Water-sheet swale is quiet orientation context, but a stated width is a factual
    // earthwork measurement a farmer needs while reading the runoff sheet. List that one
    // context mark without assigning the swale's Design Studio ownership away from Earthworks.
    if (!lineInFilter(kind, sheet) && !(sheet === 'water' && kind === 'swale')) continue;
    const lines = state.lines.filter((line) => line.kind === kind && line.points.length >= 2);
    if (!lines.length) continue;
    const text = sheet === 'earthworks'
      ? EARTHWORKS_ROUTE_STYLE[kind as keyof typeof EARTHWORKS_ROUTE_STYLE]?.label
      : sheet === 'water'
      ? WATER_ROUTE_STYLE[kind as keyof typeof WATER_ROUTE_STYLE]?.label
      : sheet === 'planting'
        ? PLANTING_ROUTE_STYLE[kind as keyof typeof PLANTING_ROUTE_STYLE]?.label
        : undefined;
    if (kind === 'swale') {
      groups.push(...swaleLegendGroups(lines, text ?? 'Swale'));
      continue;
    }
    groups.push({
      text: text ?? kind.charAt(0).toUpperCase() + kind.slice(1),
      count: lines.length,
      lineKind: kind,
    });
  }
  return groups;
}

export function exactSheetZoneLegendGroups(
  state: Pick<DesignCanvasState, 'zones'>,
  sheet: ExactPlanSheetKey,
): ExactZoneLegendGroup[] {
  if (sheet !== 'zones') return [];
  const seen = new Set<number>();
  const groups: ExactZoneLegendGroup[] = [];
  for (const zone of [...state.zones].sort((left, right) => left.zone - right.zone)) {
    if (zone.feature || zone.points.length < 3 || seen.has(zone.zone)) continue;
    seen.add(zone.zone);
    groups.push({
      text: `Zone ${zone.zone} — ${ZONE_DEFS[zone.zone].label}`,
      zone: zone.zone,
    });
  }
  return groups;
}

// EARTHWORKS IS NOW ITS OWN SHEET (05). It used to fold into 'water', and the note here recorded
// the two prerequisites for splitting it out: an API-side RenderLayer plus a layerTheme prompt
// block, because FILTER_TO_LAYER maps a GlossyLayerFilter onto the API's RenderLayer union and an
// UNMAPPED filter falls through to the full-design theme — the bug that made the AI invent ponds
// and orchards on a layer map. Both now exist (app/api/ai-render/route.ts), so the fold is gone.
//
// Why separate, in Rory's words: "is this traditional for permaculture to have a separate layer".
// It is. Earthworks is a SETTING-OUT drawing — contour, level, cut and fill — built first and with
// different plant (a machine or a team with an A-frame) from everything that follows. Water is a
// services drawing: tanks, pipes, taps, routes. Reading them off one sheet is what made a swale
// print in irrigation blue instead of cut-and-fill brown.
//
// The split is LAND-SHAPING ONLY (Rory's call). Swale, contour berm, terrace and half-moon move to
// Earthworks. Greywater and infiltration basins STAY on Water: a farmer reads them as the end of
// the greywater run, not as civil works. The five planting beds keep their existing overrides
// below. 'structures' still folds to 'overall'.
// PER-ELEMENT OVERRIDES, because filing by CATEGORY is the wrong grain. 'earthworks' is a build
// category — how the ground is shaped — and it mixes two things a farmer reads on different sheets:
// water-shaping (swale berms, infiltration and greywater basins, contour berms) and PLANTING beds
// that merely happen to be earth-shaped. Filing the whole category under 'water' put a farmer's
// raised beds, keyhole bed, herb spiral, banana circles and tree basins on the WATER PLAN and left
// them off the PLANTING PLAN entirely — he placed a banana circle from the Planting step and then
// could not find it on the planting sheet.
//
// overlayElementsText already knew this and patched it downstream with a SECTION_BY_ID table, which
// changed the legend HEADING but not which sheet the element was drawn on — hence a sheet titled
// WATER PLAN carrying a legend section headed PLANTING. This is that same knowledge applied one
// level up, where it decides the sheet instead of the caption.
// Vetiver Bank needs no entry — it is already category 'growing'. greywater_basin and
// infiltration_basin need none either: they are the only 'earthworks' elements that stay on Water,
// which is what the category now falls through to... except the category's DEFAULT is Earthworks
// (see sheetForElement), so they are listed explicitly here instead. Everything is now on this
// table by name, which is the honest state of affairs for a category this mixed.
const SHEET_OVERRIDE: Record<string, GlossyLayerFilter> = {
  // Earth-shaped PLANTING beds — built by hand, filled with compost, planted at once.
  banana_circle: 'planting',
  tree_basin: 'planting',
  raised_bed: 'planting',
  keyhole_bed: 'planting',
  herb_spiral: 'planting',
  // The two basins a farmer reads as the END OF A WATER RUN rather than as civil works. Dug, yes,
  // but a greywater basin without the greywater line that feeds it is meaningless, and that line
  // lives on the Water sheet.
  greywater_basin: 'water',
  infiltration_basin: 'water',
};

type ElementLayerSheet = Exclude<GlossyLayerFilter, 'all' | 'zones'>;

// Some real systems belong on more than one output sheet. Keep one PRIMARY sheet above so editing,
// palette ownership and plan-set ordering remain unambiguous, then opt only the integrated feature
// into the additional sheet where it is also factual content. This is intentionally an allow-list:
// broad category overlap would put every planting bed on Water and recreate the clutter this module
// was extracted to prevent.
const ADDITIONAL_SHEETS: Readonly<Record<string, readonly ElementLayerSheet[]>> = {
  banana_circle: ['water', 'earthworks'], // planted guild, greywater sink, and a dug basin
  tree_basin: ['water', 'earthworks'], // planting earthwork and runoff/greywater sink
  // EVERY ONE OF THESE IS DUG, so every one of them belongs on the setting-out sheet.
  //
  // Sheet 05 was showing swales and nothing else, which made it look like a farm whose only
  // earthwork is a ditch — when the same farm has beds to build up, basins to dig and a spiral to
  // shape, all of them ground the farmer moves with a spade before anything is planted. Rory:
  // "where the raised bed for vegetables? ... we need to include tree basins? also greywater
  // basins." Their PRIMARY sheet is unchanged, so nothing moves in the palette, in editing
  // ownership or in the counts on Planting and Water — this only adds the factual second
  // appearance on the sheet that says what to dig, which is what this allow-list is for.
  // veg_bed AND raised_bed both: "where the raised bed for vegetables?" is a question about the
  // bed a farmer actually has, and on most saved designs that is a veg_bed. Building a bed is
  // ground work — you mark it out, dig the path either side and heap the soil — whichever of the
  // two names it was placed under.
  veg_bed: ['earthworks'],
  raised_bed: ['earthworks'],
  keyhole_bed: ['earthworks'],
  herb_spiral: ['earthworks'],
  greywater_basin: ['earthworks'],
  infiltration_basin: ['earthworks'],
};

/** Which PRIMARY layer sheet an element belongs on. Additional factual appearances are returned by
 *  sheetsForElement below; keeping the primary answer singular preserves existing editing rules. */
export function sheetForElement(category: string, defId?: string): ElementLayerSheet | null {
  if (defId && SHEET_OVERRIDE[defId]) return SHEET_OVERRIDE[defId] as ElementLayerSheet;
  switch (category) {
    case 'water':
      return 'water';
    // Land-shaping is its own sheet now (05). The two basins that read as water infrastructure
    // rather than civil works are pulled back to Water by SHEET_OVERRIDE above.
    case 'earthworks':
      return 'earthworks';
    case 'growing':
      return 'planting';
    case 'structure':
    case 'animal':
    case 'access':
      return 'structures';
    default:
      return null;
  }
}

/** Every layer sheet where this element is factual CONTENT, primary first. */
export function sheetsForElement(category: string, defId?: string): readonly ElementLayerSheet[] {
  const primary = sheetForElement(category, defId);
  if (!primary) return [];
  const additional = defId ? ADDITIONAL_SHEETS[defId] ?? [] : [];
  return [primary, ...additional.filter((sheet) => sheet !== primary)];
}

/** Does this element belong on `filter` as CONTEXT — shown so the sheet reads, never counted as its
 *  content? Only Water needs it: irrigation lines mean nothing without the beds and basins they
 *  water, and those live on the Planting sheet. Kept here beside sheetForElement so the membership
 *  rules stay in one file. */
export function isContextElement(
  def: { category: string; id: string; name: string },
  filter: GlossyLayerFilter,
): boolean {
  if (filter !== 'water') return false;
  if (itemInFilter(def.category, filter, def.id)) return false;
  if (sheetForElement(def.category, def.id) !== 'planting') return false;
  return /bed|basin|circle|spiral/i.test(def.name);
}

export function itemInFilter(category: string, filter: GlossyLayerFilter, defId?: string): boolean {
  if (filter === 'all') return true;
  // Zones carries no elements — the effort-zone bands are its entire content.
  if (filter === 'zones') return false;
  return sheetsForElement(category, defId).includes(filter);
}

/**
 * Semantic bottom-to-top order for placed map features.
 *
 * Footprint size alone cannot decide map depth: a 2 m tree basin is smaller than its mature
 * canopy, but the basin is on the ground and must be painted FIRST so the canopy sits above it.
 * The returned number is deliberately independent of sheet membership and item coordinates, so
 * Water, Planting and the integrated masterplan cannot silently disagree about the same overlap.
 *
 * Within each rank callers order by footprint size via compareCartographicPaint below. Routes are
 * painted separately beneath this item stack.
 */
export function cartographicItemPaintRank(def: DesignElementDef): number {
  if (def.category === 'earthworks') return 0; // basins, beds and other ground treatments
  if (def.category === 'access') return 1;
  if (def.category === 'water' || def.category === 'structure' || def.category === 'animal') return 2;
  if (def.category === 'growing' && def.shape === 'rect') return 3; // beds, strips and living banks
  if (def.category === 'growing' && def.shape === 'circle') return 4; // tree canopy is physically highest
  return 2;
}

export interface CartographicPaintEntry {
  def: DesignElementDef;
  /** Footprint area in any one consistent unit — only ever compared within a rank. */
  area: number;
  id: string;
}

/**
 * THE single paint-order comparator for placed items — rank first, then size, and the size
 * direction depends on WHICH rank.
 *
 * Every ground register keeps largest-first, so a small feature nested on a big one stays visible
 * (a tap on a pad, a barrel beside a tank). Canopies are the one register where largest-first is
 * upside down: painting the big crown first put every smaller crown ON TOP of it, and with the
 * near-opaque canopy art a pawpaw read as sitting on a mango's leaves rather than under them.
 * Rory, twice: "bigger trees should always be above smaller" and then, after the dashed-edge
 * signal alone failed to carry it, "small trees still above big trees". Overhead physics wins:
 * within the canopy rank the SMALLEST crown paints first and the largest last, so the taller
 * canopy occludes what stands under its edge — exactly what an aerial photograph shows. Basins
 * and ground systems keep their lower rank, so nothing on the ground rises above a canopy.
 *
 * Ties break on id so the same saved design always produces the same sheet.
 */
export function compareCartographicPaint(a: CartographicPaintEntry, b: CartographicPaintEntry): number {
  const rankA = cartographicItemPaintRank(a.def);
  const rankB = cartographicItemPaintRank(b.def);
  if (rankA !== rankB) return rankA - rankB;
  const canopyRank = a.def.category === 'growing' && a.def.shape === 'circle';
  const bySize = canopyRank ? a.area - b.area : b.area - a.area;
  return bySize || a.id.localeCompare(b.id);
}

export function lineInFilter(kind: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      // Swale is NOT here — it is the one line kind that is dug rather than plumbed, and it moved
      // with the rest of the land-shaping to sheet 05.
      //
      // This predicate was correct all along; the DRAWING did not follow it. drawWaterRoutes kept
      // painting swales on the Water sheet in pipe-blue, so the finished sheet carried a labelled
      // line that this function had already decided was not part of it — hence no legend row for
      // it, breaking the "nothing drawn without a legend row" rule these sheets are built on.
      // Rory found the symptom rather than the cause: "straight away the swale with blue pipe is
      // off, i have told you several times before it cant be a blue pipe looking path its
      // confusin." One half of a deliberate move had simply never been applied.
      return kind === 'pipe' || kind === 'drip' || kind === 'greywater';
    // THE SWALE IS A LINE, NOT AN ELEMENT — the half of the earthworks split that sheetForElement
    // cannot reach. Elements (berm, terrace, half-moon) route by category; a swale is a LineShape
    // and routes only through here. Missing it meant layerContentCount('earthworks') read 0 on a
    // farm whose earthworks are entirely swales, so the sheet would refuse to render as empty, and
    // no swale could ever appear in the Earthworks legend — the sheet would have shipped broken
    // for the single most common earthwork there is.
    case 'earthworks':
      return kind === 'swale';
    case 'planting':
      // A bed path is part of the veg garden it separates — same reasoning that put the KIND on
      // the planting LAYER (lib/design-canvas.ts). Missing here, every bed path a farmer placed
      // rendered permanently at LOCKED_OPACITY and could never be selected: lineInFilter takes a
      // plain string, so the Record<LineShape['kind'],…> pattern that names every other map for
      // a new kind is blind to this one. tests/line-kind-coverage.test.ts now guards it instead.
      return kind === 'windbreak' || kind === 'bedpath'; // a windbreak is a planted row → Planting sheet, not Structures
    case 'structures':
      return kind === 'fence' || kind === 'path';
    default:
      return false;
  }
}

export function zonesInFilter(filter: GlossyLayerFilter): boolean {
  return filter === 'all' || filter === 'zones';
}

export type GroundRegister = 'content' | 'context' | 'absent';

/** THE single authority for where a traced GROUND feature — house, patio, driveway, lawn,
 *  veg_garden, orchard, cleared, or boundary — sits on a given sheet. Before this there were
 *  THREE hand-rolled copies of the same idea, none of them in charge and none agreeing with the
 *  others: producer-prompt.ts's `fabricIsContent` ternary (caption+legend wording for the AI
 *  path), drawBlueprintGround's fill (which took no `filter` at all, so an orchard wash painted
 *  at the IDENTICAL alpha on the Water sheet as on Planting — a "context register" with no
 *  visual difference), and groundRows' legend-row gate (decided ad hoc by which sheets bothered
 *  to call it). All three, plus layerContentCount below, now defer to this.
 *
 *  - 'content': this sheet's own subject — captioned (AI path), legended and counted
 *    (layerContentCount), drawn at full strength. Whole-design, Planting and Structures read as
 *    "what's really there", so a farmer's traced orchard or veg garden belongs beside his placed
 *    trees and beds — and a design that is ONLY that traced ground, no trees placed yet, still has
 *    real content and must not be refused.
 *  - 'context': drawn quieter so the sheet still orients (a Water plan needs the paving a pipe
 *    runs under; a Zones plan needs the yard the effort-zones are measured from) but never
 *    captioned, never legended, and never counted — an orchard traced for context must not
 *    entitle a farmer to a Water or Zones sheet he has not actually drawn.
 *  - 'absent': the boundary only. It is drawn as a dedicated LINE (drawBlueprintBoundary on the
 *    exact path, rule 9's fence description on the AI path), never as a ground-fill wash, on
 *    every sheet — so it has no content/context register of its own to pick. */
export function groundRegister(kind: GroundFeatureKind, filter: GlossyLayerFilter): GroundRegister {
  if (kind === 'boundary') return 'absent';
  // THE STAPLE GARDEN IS DESIGNED PLANTING, NOT SITE FABRIC — and that is the whole reason it may
  // not ride the same rule as a lawn or a patio. Every other ground ring is something the farmer
  // RECORDS about the site, so drawing it quietly on a Water or Zones sheet genuinely orients the
  // reader: the pipe runs under that paving whether or not this sheet is about paving. A quarter
  // hectare of mielies the farmer has not planted yet orients nobody — it is a proposal, and on an
  // analysis sheet it reads as a fact about the ground. Rory has now reported it twice on two
  // different sheets: "why is staple gardens polygons in here?" (Site) and "again the staple garden
  // polygons are here, get rid of these things" (Water).
  //
  // So it is content exactly where the design it belongs to is the subject, and absent elsewhere.
  // groundFeatureLayer in lib/design-canvas.ts already answers "whose ring is this" with 'planting'
  // for this one feature; this is the same answer expressed in sheet terms, and the two must agree.
  if (kind === 'staple_garden') return filter === 'all' || filter === 'planting' ? 'content' : 'absent';
  // HARD STANDING IS A SITE RECORD, NOT PLAN CONTENT. A concrete slab, a paved yard or a cleared
  // apron is something the farmer traces to record what is already there — it appears on sheet 01,
  // where the subject is the site as it exists, and it is named there. On a design sheet it is a
  // large pale hatched polygon sitting across the middle of the drawing carrying no decision, and
  // Rory has now asked for it off four separate sheets in one evening: "get rid of this stubborn
  // slab polygon", "stray polygons again here, please remove the slab".
  //
  // The Site sheet does NOT come through this predicate — buildBlueprintBaseMap vets its rings with
  // existingSiteGroundRings and passes siteRecord to drawBlueprintGround — so making these absent
  // here removes them from the design sheets without touching the one sheet they belong on.
  if (kind === 'patio' || kind === 'cleared') return 'absent';
  return filter === 'all' || filter === 'planting' || filter === 'structures' ? 'content' : 'context';
}

/**
 * Traced ground that may be named on a sheet, shared by the map-label and legend paths.
 *
 * Context remains drawable through drawBlueprintGround, but it never reaches this content-only
 * selector. Main-map house/driveway geometry also owns its own dedicated rendering, so matching
 * Studio rings stay out of both labels and legend rows rather than being named twice.
 */
export function groundContentRingsForSheet(
  state: Pick<DesignCanvasState, 'zones'>,
  refLayers: Pick<MapRefLayers, 'house' | 'driveway'> | undefined,
  filter: GlossyLayerFilter,
): DesignCanvasState['zones'] {
  const houseCovered = (refLayers?.house.length ?? 0) >= 3;
  const drivewayCovered = (refLayers?.driveway.length ?? 0) >= 2;
  return state.zones.filter((zone) => {
    if (!zone.feature || zone.points.length < 3) return false;
    if (zone.feature === 'house' && houseCovered) return false;
    if (zone.feature === 'driveway' && drivewayCovered) return false;
    return groundRegister(zone.feature, filter) === 'content';
  });
}

function exactLegendRingArea(points: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(area / 2);
}

function legendGroupsFromRings(rings: DesignCanvasState['zones']): ExactGroundLegendGroup[] {
  return rings
    .sort((left, right) => exactLegendRingArea(right.points) - exactLegendRingArea(left.points))
    .map((zone) => ({
      text: zone.name ?? GROUND_FEATURES[zone.feature!].label,
      color: GROUND_FEATURES[zone.feature!].color,
      feature: zone.feature!,
    }))
    .filter((row, index, all) => all.findIndex((candidate) => candidate.text === row.text) === index);
}

/** Named ground rows shared by the prompt fabric channel and the exact legend. Context callers may
 * request `all` to name everything the model must preserve; only callers using the current sheet
 * key are entitled to print these as content rows. */
export function exactSheetGroundLegendGroups(
  state: Pick<DesignCanvasState, 'zones'>,
  refLayers: Pick<MapRefLayers, 'house' | 'driveway'> | undefined,
  sheet: GlossyLayerFilter,
): ExactGroundLegendGroup[] {
  return legendGroupsFromRings(groundContentRingsForSheet(state, refLayers, sheet));
}

/**
 * Ground rings that belong on the SITE/BASE sheet — "what's already here" — as distinct from a
 * design-layer sheet's CONTENT under groundRegister.
 *
 * Those are not the same question, and conflating them is exactly the confusion Rory named: "we
 * need to sort out once and for all the difference between existing and base map ... it will
 * confuse rural farmers." buildBlueprintBaseMap had no sheet key of its own (GlossyLayerFilter has
 * no 'base' member — Base isn't an AI-rendered design layer) and reused 'all' to mean "show every
 * ground ring" — but 'all' means "the whole FINISHED DESIGN", and under that reading staple_garden
 * reads as content too, because groundRegister resolves every non-boundary feature to 'content' on
 * 'all'. That is how a plot the farmer has not planted yet, and will only design once they reach
 * Planting, ended up printed as fact on the Site sheet's legend — "staple garden ... came under
 * base map in map generation."
 *
 * The Base sheet's real question is narrower: only what a farmer RECORDS about the site as it
 * exists TODAY, and staple_garden is the one ground feature that is DESIGNED, not recorded (see
 * its own doc comment in lib/design-canvas.ts). ownedByCurrentStep('base', ...) already answers
 * exactly that split — it is the wizard's own "which step may edit this" authority — so reusing it
 * here means this answer can never drift from the one the canvas itself already enforces. */
export function existingSiteGroundRings(
  state: Pick<DesignCanvasState, 'zones'>,
  refLayers: Pick<MapRefLayers, 'house' | 'driveway'> | undefined,
): DesignCanvasState['zones'] {
  const houseCovered = (refLayers?.house.length ?? 0) >= 3;
  const drivewayCovered = (refLayers?.driveway.length ?? 0) >= 2;
  return state.zones.filter((zone) => {
    if (!zone.feature || zone.points.length < 3) return false;
    if (zone.feature === 'house' && houseCovered) return false;
    if (zone.feature === 'driveway' && drivewayCovered) return false;
    return ownedByCurrentStep('base', { kind: 'zone', feature: zone.feature });
  });
}

/** Discrete placed things the farmer says are already on the farm. Unlike ground rings, these are
 * point/footprint facts: a tank, tree or shed belongs on the Site sheet without becoming a ground
 * wash. Undefined keeps its pre-status meaning (proposed) for older saved designs. */
export function existingSiteItems(
  state: Pick<DesignCanvasState, 'items'>,
): DesignCanvasState['items'] {
  return state.items.filter((item) => item.status === 'existing');
}

/** Legend-group twin of existingSiteGroundRings — same rows exactSheetGroundLegendGroups would
 *  build, for the ring set the Base sheet is actually entitled to name. */
export function existingSiteGroundLegendGroups(
  state: Pick<DesignCanvasState, 'zones'>,
  refLayers: Pick<MapRefLayers, 'house' | 'driveway'> | undefined,
): ExactGroundLegendGroup[] {
  return legendGroupsFromRings(existingSiteGroundRings(state, refLayers));
}

// How many REAL things the farmer has drawn on this layer. A layer map with zero content is always
// wrong — either that layer hasn't been drawn yet, or something upstream dropped it. Either way we
// must never render it silently and let the AI invent the layer (Rory: "it should be retrieving my
// zones layer which is detailed — no guessing"). Callers refuse + explain instead.
export function layerContentCount(
  state: DesignCanvasState,
  refLayers: MapRefLayers,
  filter: GlossyLayerFilter,
): number {
  let n = 0;
  if (zonesInFilter(filter)) n += state.zones.filter((z) => !z.feature && z.points.length >= 3).length;
  n += state.items.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return !!def && itemInFilter(def.category, filter, def.id);
  }).length;
  n += state.lines.filter((l) => lineInFilter(l.kind, filter) && l.points.length >= 2).length;
  // Traced GROUND only counts here where groundRegister says it is this sheet's CONTENT — see
  // that function's doc for why the content/context/absent split matters in both directions.
  // groundRegister('boundary', filter) is always 'absent', so the boundary ring never double-
  // counts against the dedicated refLayers.boundary check below.
  n += state.zones.filter((z) => z.feature && z.points.length >= 3 && groundRegister(z.feature, filter) === 'content').length;
  // The whole-design map also stands up on the traced base alone.
  if (filter === 'all' && refLayers.boundary.length >= 3) n += 1;
  return n;
}

/** Which WIZARD STEP a canvas shape is interactively "owned" by — the answer DesignCanvas.tsx
 *  needs to "should pointer-down on this shape start editing it right now, or should it render
 *  as inert, read-only context for whatever the CURRENT step is actually drawing?" (Rory: "its
 *  very annoying when i am trying to draw the zones and i touch the boundary etc and its starts
 *  editing" — tapping near a boundary vertex while adjusting a zone on the Zones step grabbed
 *  the boundary instead, because nothing gated shapes by step at all, only by `tool`.)
 *
 *  Reuses this file's existing membership answers where the QUESTION actually matches —
 *  lineInFilter and the ground-feature-vs-plain-zone split both already answer "which step" —
 *  but items need CATEGORY_STEP (lib/design-elements.ts), NOT sheetForElement: sheetForElement
 *  answers "which OUTPUT SHEET does this print on", and SHEET_OVERRIDE deliberately makes that
 *  differ from "which step placed it" for a raised bed/keyhole bed/herb spiral/tree basin (all
 *  category 'earthworks', placed from the Water step, but printed on the Planting sheet). An
 *  earlier version of this function used sheetForElement for items and that conflation locked
 *  those four elements the instant they were placed, in the very step that placed them
 *  (adversarial review, 2026-07-21) — exactly the kind of drifted-second-copy bug this whole
 *  function exists to avoid, just one layer deeper than expected.
 *
 *  - A ground feature (a ZoneShape with `.feature` set — boundary/house/patio/…) belongs to
 *    'base', where the farmer traces it.
 *  - A zone ring with NO `.feature` (a plain permaculture effort-zone 0-5) belongs to 'zones'.
 *  - Lines follow lineInFilter against whichever of 'water'/'planting'/'structures' the current
 *    step is. Items follow CATEGORY_STEP the same way — the one place both this function and
 *    DesignPalette.tsx's categoriesForStep (which categories a step's palette even offers) read
 *    the category→step answer from, so the two can't silently disagree again.
 *  - 'sector' has no shapes of its own (it's a derived overlay, nothing is ever drawn there)
 *    and 'review'/'glossy' are read-only summary steps — every shape falls through every
 *    branch below and is foreign, so EVERYTHING renders locked. That's the deliberately safer
 *    (more locked) reading for an ambiguous case, not a special-cased default. */
export function ownedByCurrentStep(
  step: WizardStep,
  subject:
    | { kind: 'zone'; feature?: GroundFeatureKind }
    | { kind: 'line'; lineKind: LineShape['kind'] }
    | { kind: 'item'; category: string; defId?: string },
): boolean {
  switch (subject.kind) {
    case 'zone':
      if (!subject.feature) return step === 'zones';
      // Every OTHER ground feature (house/patio/driveway/lawn/veg_garden/orchard/cleared/
      // terrace_bank) is "what's already here" — recorded once on Base, then read-only context
      // everywhere else. staple_garden is the one feature a farmer DESIGNS rather than records
      // (see its own comment in lib/design-canvas.ts), placed from its chip on the Planting step —
      // so treating it as Base-owned rendered it dimmed and non-interactive the instant it was
      // drawn, on the very step that drew it. Same bug class this function's own comments already
      // document for raised beds and Banana Circles (adversarial review, 2026-07-21/2026-08-01).
      if (subject.feature === 'staple_garden') return step === 'planting';
      return step === 'base';
    case 'line':
      // 'earthworks' is a step AND a sheet filter, and lineInFilter already files a swale under
      // it — so a swale is editable from the step that exists to dig it, as well as from Water.
      if (step !== 'water' && step !== 'earthworks' && step !== 'planting' && step !== 'structures') return false;
      return lineInFilter(subject.lineKind, step);
    case 'item':
      // The Earthworks step OFFERS the earthworks category without owning it in CATEGORY_STEP
      // (see categoriesForStep) — so it must claim editing rights explicitly, or every berm and
      // terrace would render dimmed and untouchable on the step that placed it. That is the
      // place-then-vanish bug this function's comments below already document twice.
      if (step === 'earthworks') return subject.category === 'earthworks';
      if (step !== 'water' && step !== 'planting' && step !== 'structures') return false;
      // NOT sheetForElement — that answers "which OUTPUT SHEET does this print on", a different
      // question. A raised bed/keyhole bed/herb spiral/tree basin is category 'earthworks'
      // (placed from the Water step's palette) but SHEET_OVERRIDE'd onto the Planting sheet; an
      // earlier version of this function used sheetForElement here and it rendered those four
      // elements locked the instant they were placed, in the very step that placed them
      // (adversarial review, 2026-07-21). CATEGORY_STEP is the "which step placed/edits this"
      // answer, shared with DesignPalette.tsx's categoriesForStep so the two can't drift apart.
      if (CATEGORY_STEP[subject.category as ElementCategory] === step) return true;
      // The SAME bug, one layer deeper: a def can ALSO be offered from a second step via
      // alsoSteps (DesignPalette.tsx's stepCatalog honours it when building the palette — a
      // Banana Circle is category 'earthworks' [owner: water] but alsoSteps: ['planting'], "it
      // is a crop as much as a pit"). Without this check, placing one from the Planting step
      // locked it the instant it was placed, in the very step that placed it — a farmer had a
      // few-second window to hit Delete before it became a dimmed, untouchable ghost until they
      // switched to Water (adversarial review of commit c590ac1 caught this live in production).
      if (subject.defId) {
        const def = ELEMENTS_BY_ID[subject.defId];
        if (def?.alsoSteps?.includes(step as 'water' | 'planting' | 'structures')) return true;
      }
      return false;
  }
}
