/**
 * Render-only cartography metadata for the Structures Reference Blueprint.
 *
 * This module is intentionally bounded to IDs that exist in `design-elements.ts`. It does not
 * create, rename, reposition, or resize saved items; callers may use the scale only when painting
 * a finished sheet so small, real features remain legible at print size.
 */

export type StructuresLegendSection =
  | 'SITE ACCESS & SERVICE'
  | 'COMPOST & NURSERY'
  | 'LIVESTOCK & APIARY'
  | 'PROTECTED GROWING';

export const STRUCTURES_LEGEND_SECTION_ORDER: readonly StructuresLegendSection[] = [
  'SITE ACCESS & SERVICE',
  'COMPOST & NURSERY',
  'LIVESTOCK & APIARY',
  'PROTECTED GROWING',
];

export type StructuresFeatureSymbol =
  | 'compost'
  | 'beehive'
  | 'chicken-tractor'
  | 'nursery'
  | 'shade'
  | 'gate'
  | 'tap'
  | 'washline';

export interface StructuresFeatureVisual {
  section: StructuresLegendSection;
  symbol: StructuresFeatureSymbol;
  presentationScale: number;
}

const FEATURE_VISUALS: Readonly<Record<string, StructuresFeatureVisual>> = {
  compost_bay: {
    section: 'COMPOST & NURSERY',
    symbol: 'compost',
    presentationScale: 1.2,
  },
  nursery_table: {
    section: 'COMPOST & NURSERY',
    symbol: 'nursery',
    presentationScale: 1.2,
  },
  beehive: {
    section: 'LIVESTOCK & APIARY',
    symbol: 'beehive',
    presentationScale: 1.45,
  },
  chicken_coop: {
    section: 'LIVESTOCK & APIARY',
    symbol: 'chicken-tractor',
    presentationScale: 1.15,
  },
  chicken_tractor: {
    section: 'LIVESTOCK & APIARY',
    symbol: 'chicken-tractor',
    presentationScale: 1.25,
  },
  shade_house: {
    section: 'PROTECTED GROWING',
    symbol: 'shade',
    presentationScale: 1.08,
  },
  greenhouse_tunnel: {
    section: 'PROTECTED GROWING',
    symbol: 'shade',
    presentationScale: 1.08,
  },
  gate: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'gate',
    presentationScale: 1.15,
  },
  tap_point: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'tap',
    presentationScale: 1.35,
  },
  washline: {
    section: 'SITE ACCESS & SERVICE',
    symbol: 'washline',
    presentationScale: 1.1,
  },
};

/** Returns the editorial legend section for a canonical catalog ID, or null for unknown IDs. */
export function structuresLegendSectionForFeature(id: string): StructuresLegendSection | null {
  return FEATURE_VISUALS[id]?.section ?? null;
}

/** Returns the bounded visual treatment for a canonical catalog ID, or null for unknown IDs. */
export function structuresFeatureVisualFor(id: string): StructuresFeatureVisual | null {
  const visual = FEATURE_VISUALS[id];
  return visual ? { ...visual } : null;
}

/**
 * Print-scale emphasis for small structures and service points. The caller keeps the saved
 * centre, footprint, and rotation unchanged; this value is for presentation only.
 */
export function structuresFeaturePresentationScale(id: string): number {
  return FEATURE_VISUALS[id]?.presentationScale ?? 1;
}

export function structuresFeatureSymbolFor(id: string): StructuresFeatureSymbol | null {
  return FEATURE_VISUALS[id]?.symbol ?? null;
}

