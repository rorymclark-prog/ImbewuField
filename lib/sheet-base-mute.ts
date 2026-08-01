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
  // purely locational — it tells the farmer WHERE on his farm he is looking, and nothing else on
  // these sheets comes from it. Pushed back hard so hatched zones, cream-cased canopies, brown
  // earthworks and blue pipework are unmistakably the figure and the ground is the ground.
  design: { filter: 'saturate(0.3) brightness(1.14) contrast(0.86)', veil: 'rgba(246, 241, 227, 0.44)' },
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
