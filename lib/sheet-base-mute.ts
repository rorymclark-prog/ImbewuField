import type { GlossyLayerFilter } from '@/lib/glossy-filters';

/**
 * How far back the aerial photograph is pushed underneath each plan sheet.
 *
 * WHY THIS EXISTS. Rory, looking at the planting sheet over a high-detail drone photo: "just
 * having a raw map in the background, especially the detailed drone photo, can be very
 * distracting ... maybe dim everything in the boundary right back depending on the layer."
 *
 * He is describing standard practice, and it has a name. A thematic map series mutes its base:
 * the reference imagery is desaturated and lightened toward the paper tone so that the drawn,
 * meaningful content is the only thing on the sheet carrying strong colour. Soil surveys, planning
 * overlays and every GIS "basemap muting" preset do the same thing for the same reason — a
 * full-strength aerial and a thematic symbol set are two competing figure layers, and the reader
 * cannot hold both.
 *
 * This file went in because the treatment was being decided per render function, so sheet 02 had
 * a considered desaturate-and-lighten pass while sheets 03–09 got an 18% BLACK veil — which is
 * the opposite move. Darkening a subtropical aerial makes dense foliage darker and busier, and it
 * is a large part of why placed trees, hatched zones and brown earthworks all read as faint over
 * their own ground.
 *
 * NOTHING HERE MOVES A PIXEL. Saturation and lightness only: the photograph stays a faithful,
 * correctly georeferenced record of the site, which is what makes it admissible on a plan at all.
 */
export type SheetBaseMute = 'site' | 'analysis' | 'design';

export interface SheetBaseMuteStyle {
  /** Canvas filter applied while drawing the photo. Empty string when no filter is wanted. */
  filter: string;
  /** Paper-toned veil laid over the photo afterwards. */
  veil: string;
}

export const SHEET_BASE_MUTE_STYLE: Readonly<Record<SheetBaseMute, SheetBaseMuteStyle>> = {
  // THE SITE SHEET'S SUBJECT IS THE PHOTOGRAPH. It is the record of what is on the ground today,
  // so muting it hard would be muting the content. Only enough lift to keep boundary, labels and
  // existing-item symbols legible over it.
  site: { filter: 'saturate(0.86) brightness(1.04)', veil: 'rgba(244, 238, 222, 0.12)' },
  // Sector: thin coloured arrows, arcs and dotted lines over dark bush — the case that first
  // needed this. These are the values that sheet already shipped with and Rory accepted.
  analysis: { filter: 'saturate(0.42) brightness(0.96) contrast(0.9)', veil: 'rgba(238, 234, 218, 0.2)' },
  // Zones, Water, Earthworks, Planting, Structures, Whole design, Phasing. The photo here is
  // locational: it tells the farmer WHERE on their farm they are looking. It must recede behind
  // the drawn design — and it must still be a photograph of their farm.
  //
  // THE FIRST ATTEMPT AT THIS OVERSHOT, and the overshoot is instructive. Pushed to saturate(0.3),
  // brightness(1.14) and a 44% veil, the aerial went to a flat grey: the design read beautifully
  // and the site underneath it disappeared — roofs, tree canopies and worked ground all bleached
  // to the same tone. Rory: "things are looking a lot better BUT ... I can [not] see much now,
  // which is also not good."
  //
  // Both failures are real and they pull opposite ways: a full-strength drone photo drowns the
  // plan, a bleached one stops being evidence. These values sit between them — colour clearly
  // drained so nothing on the photo competes with a zone or a canopy for "brightest thing on the
  // sheet", but enough contrast left that a farmer can still recognise their own yard under the
  // drawing. If this needs to move again, move it a step at a time and look at a real sheet.
  design: { filter: 'saturate(0.52) brightness(1.05) contrast(0.95)', veil: 'rgba(246, 241, 227, 0.26)' },
};

/**
 * How a traced BUILDING is pushed back — which is a different problem from the ground it sits on.
 *
 * A building on a design sheet is not painted; it is a cutout of the SAME photograph as the base,
 * restored so the roof stays sharp while everything around it is muted. That is the right idea and
 * it had a hole in it: the base got a filter AND a paper veil, the cutout got the filter only. On a
 * site whose roofs photograph dark — corrugated iron in shadow, which is most of rural KwaZulu-Natal
 * — the result is a black slab sitting in a pale sheet, the loudest thing on a page where it is
 * only context. On the Zones sheet it was reading as the subject.
 *
 * Two changes close it. The veil now applies to the cutout as well, so the building lands in the
 * same tonal world as its ground rather than beside it. And the brightness lift is larger than the
 * base's, because the failure is asymmetric: a light roof that goes slightly lighter still reads,
 * a dark roof that stays dark becomes a hole. Saturation stays higher than the ground's so the
 * building is still the most DEFINITE object on the sheet — which was the original intent — it just
 * is not the darkest one any more.
 *
 * Still photograph, still nothing moved: brightness and saturation only.
 */
export const SHEET_STRUCTURE_MUTE_STYLE: SheetBaseMuteStyle = {
  filter: 'saturate(0.7) brightness(1.2) contrast(0.92)',
  veil: 'rgba(246, 241, 227, 0.2)',
};

export interface PlainHardSurfacePaint {
  houseFill: string;
  houseStroke: string;
  tarFill: string;
  tarEdge: string;
}

/**
 * HOW HARD SURFACES ARE DRAWN WHEN THERE IS NO PHOTOGRAPH UNDER THEM.
 *
 * On the photo underlays a building is a cutout of the aerial and the driveway is near-solid tar,
 * and both are fine there: they sit on a busy photograph, and a near-solid mark is what it takes to
 * be seen at all. On the plain-paper underlay the same paint is the loudest thing on the page. Rory,
 * on the first plain planting sheet: "can you mute the driveways and other infrastructure like
 * house etc" — and on a PLANTING sheet he is plainly right, because the house and the driveway are
 * not what that sheet is about.
 *
 * It is also the drawing convention. On an ink plan a building is an outline with a light tone
 * inside it, and a carriageway is two edges with a wash between — a solid black slab is what you
 * draw when the building IS the subject, which is sheet 07 and nothing else.
 *
 * The keyline stays strong while the fill drops right back. That is the part worth keeping if these
 * numbers ever move: what makes a house read on paper is its EDGE, not its tone, so muting the fill
 * costs nothing and muting the outline would lose the building altogether.
 */
export const PLAIN_HARD_SURFACE_PAINT: Readonly<PlainHardSurfacePaint> = {
  houseFill: 'rgba(96,104,98,0.20)',
  houseStroke: 'rgba(34,42,36,0.82)',
  tarFill: 'rgba(96,104,98,0.24)',
  // Tar has no kerb drawn on these sheets, so its own edge is the only thing giving it a shape.
  tarEdge: 'rgba(34,42,36,0.55)',
};

/**
 * Which mute a finished sheet takes.
 *
 * Two sheets pass their level explicitly rather than a filter, because neither is an AI-rendered
 * design layer and so neither has a GlossyLayerFilter of its own: the Site sheet ('site') and the
 * Sector sheet ('analysis'). Everything that DOES have a filter is a design layer, and every
 * design layer wants the same strong mute — the distinction that matters is which sheet, not
 * which filter, which is why this stays a one-liner rather than growing a case per layer.
 */
export function sheetBaseMuteFor(_filter: GlossyLayerFilter): SheetBaseMute {
  return 'design';
}
