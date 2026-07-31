import type { MapRefLayers } from '@/lib/base-layers';
import type { DesignCanvasState } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  INTEGRATED_LEGEND_FAMILIES,
  EXACT_DRIVEWAY_LEGEND_TEXT,
  exactSheetElementLegendGroups,
  exactSheetGroundLegendGroups,
  exactSheetLineLegendGroups,
  exactSheetZoneLegendGroups,
  isContextElement,
  type ExactElementLegendGroup,
  type ExactPlanSheetKey,
  type GlossyLayerFilter,
} from '@/lib/glossy-filters';

export interface OverlayLegendContentGroup {
  kind: 'element' | 'line' | 'zone' | 'ground' | 'driveway';
  text: string;
  count?: number;
}

export interface OverlayElementsText {
  elements: string;
  fabric: string;
  served: string;
  /**
   * Designed-item rows named to the model. Kept structured so agreement tests do not have to
   * reverse-engineer commas, section headings, place suffixes or multiplication signs.
   */
  legendElementGroups: ExactElementLegendGroup[];
  /** Every content row, including routes, zones, traced ground and the masterplan driveway. */
  legendContentGroups: OverlayLegendContentGroup[];
  /** Borrowed fixtures named for orientation, never owned or legended by this sheet. */
  contextElementGroups: ExactElementLegendGroup[];
}

// Earthworks (05) is a model-authored sheet now too (full AI support, same as Water/Planting) —
// omitting it here silently starved buildShowcasePrompt/the Full Treatment prompt of any factual
// inventory, so the model would have had to invent swales/berms/terraces instead of being told
// what the farmer actually placed. Without this, `overlayElementsText(sheet: 'earthworks')` fell
// through to the "three exact sheets never use this" empty-inventory branch below, which is the
// wrong branch for a sheet that DOES take AI Hybrid/Full Treatment.
const OVERLAY_FILTERS = new Set<ExactPlanSheetKey>([
  'zones',
  'water',
  'earthworks',
  'planting',
  'structures',
  'all',
]);

const SECTION: Record<string, string> = {
  water: 'WATER',
  // Earthworks items now print their own EARTHWORKS legend section (berm/terrace/half_moon), not
  // WATER — matching the sheet split in lib/glossy-filters.ts. The two earthworks-category items
  // that stay on the Water sheet (greywater_basin, infiltration_basin) are exempted below via
  // SECTION_BY_ID, which is checked before this category fallback, so this default only applies to
  // items that actually moved.
  earthworks: 'EARTHWORKS',
  growing: 'PLANTING',
  structure: 'INFRASTRUCTURE',
  animal: 'INFRASTRUCTURE',
  access: 'INFRASTRUCTURE',
};

const SECTION_BY_ID: Record<string, string> = {
  banana_circle: 'PLANTING',
  tree_basin: 'PLANTING',
  mulch_bank: 'PLANTING',
  keyhole_bed: 'PLANTING',
  herb_spiral: 'PLANTING',
  raised_bed: 'PLANTING',
  greywater_basin: 'WATER',
  infiltration_basin: 'WATER',
};

function clean(label: string): string {
  return label.replace(/[,|»]/g, '').trim();
}

function groundNames(
  state: DesignCanvasState,
  refLayers: MapRefLayers,
): string[] {
  return exactSheetGroundLegendGroups(state, refLayers, 'all')
    .map((group) => clean(group.text))
    .filter(Boolean);
}

function contextElementNames(state: DesignCanvasState, filter: GlossyLayerFilter): string[] {
  if (filter !== 'water') return [];
  const counts = new Map<string, number>();
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !isContextElement(def, filter)) continue;
    const name = clean(def.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => `${name}${count > 1 ? ` ×${count}` : ''}`);
}

function contextElementGroups(
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
): ExactElementLegendGroup[] {
  if (filter !== 'water') return [];
  const groups = new Map<string, ExactElementLegendGroup>();
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !isContextElement(def, filter)) continue;
    const group = groups.get(def.name) ?? { text: def.name, count: 0, defId: def.id };
    group.count += 1;
    groups.set(def.name, group);
  }
  return [...groups.values()];
}

function itemSection(group: ExactElementLegendGroup, filter: GlossyLayerFilter): string {
  if (filter === 'all') {
    return INTEGRATED_LEGEND_FAMILIES.find((family) => family.text === group.text)?.section
      ?? 'INFRASTRUCTURE';
  }
  const def = ELEMENTS_BY_ID[group.defId];
  if (!def) return 'INFRASTRUCTURE';
  if (filter === 'water' && (def.id === 'banana_circle' || def.id === 'tree_basin')) return 'WATER';
  return SECTION_BY_ID[def.id] ?? SECTION[def.category] ?? 'INFRASTRUCTURE';
}

/**
 * The factual inventory handed to Satellite Overlay.
 *
 * Designed items come directly from exactSheetElementLegendGroups: the AI prompt and the exact
 * legend therefore share sheet membership, naming mode and counts instead of independently
 * rebuilding the same list. Existing ground and borrowed Water-sheet fixtures remain separate
 * context channels because they must stay visible without becoming this sheet's designed content.
 *
 * The three exact sheets that never use Satellite Overlay return an empty inventory deliberately;
 * including them makes the all-nine-sheet agreement contract explicit rather than silently
 * testing only the six model-authored sheets (zones/water/earthworks/planting/structures/all —
 * Earthworks joined this list once it became its own sheet with full AI support).
 */
export function overlayElementsText(
  state: DesignCanvasState,
  refLayers: MapRefLayers,
  sheet: ExactPlanSheetKey = 'all',
): OverlayElementsText {
  if (!OVERLAY_FILTERS.has(sheet)) {
    return {
      elements: '',
      fabric: '',
      served: '',
      legendElementGroups: [],
      legendContentGroups: [],
      contextElementGroups: [],
    };
  }

  const filter = sheet as GlossyLayerFilter;
  const legendElementGroups = exactSheetElementLegendGroups(state, sheet);
  const lineGroups = exactSheetLineLegendGroups(state, sheet);
  const zoneGroups = exactSheetZoneLegendGroups(state, sheet);
  const groundGroups = exactSheetGroundLegendGroups(state, refLayers, filter);
  const legendContentGroups: OverlayLegendContentGroup[] = [
    ...legendElementGroups.map((group) => ({
      kind: 'element' as const,
      text: group.text,
      count: group.count,
    })),
    ...lineGroups.map((group) => ({
      kind: 'line' as const,
      text: group.text,
      count: group.count,
    })),
    ...zoneGroups.map((group) => ({
      kind: 'zone' as const,
      text: group.text,
    })),
    ...groundGroups.map((group) => ({
      kind: 'ground' as const,
      text: group.text,
    })),
    ...(refLayers.driveway.length >= 2 && filter === 'all'
      ? [{ kind: 'driveway' as const, text: EXACT_DRIVEWAY_LEGEND_TEXT }]
      : []),
  ];
  const parts: string[] = [];
  const sectionOf = new Map<string, string>();

  for (const group of legendElementGroups) {
    const name = clean(group.text);
    parts.push(`${name} ×${group.count}`);
    sectionOf.set(name, itemSection(group, filter));
  }

  for (const group of zoneGroups) {
    parts.push(group.text);
    sectionOf.set(group.text, 'ZONES');
  }

  for (const group of lineGroups) {
    const name = group.text;
    parts.push(`${name} ×${group.count}`);
    const kind = group.lineKind;
    sectionOf.set(
      name,
      kind === 'windbreak'
        ? 'PLANTING'
        : kind === 'swale' || kind === 'pipe' || kind === 'drip' || kind === 'greywater'
          ? 'WATER'
          : 'INFRASTRUCTURE',
    );
  }

  if (refLayers.driveway.length >= 2 && filter === 'all') {
    parts.push(EXACT_DRIVEWAY_LEGEND_TEXT);
    sectionOf.set(EXACT_DRIVEWAY_LEGEND_TEXT, 'INFRASTRUCTURE');
  }

  const groups = new Map<string, string[]>();
  for (const part of parts) {
    const bare = part.replace(/ ×\d+$/, '');
    const section = sectionOf.get(bare) ?? 'PLANTING';
    groups.set(section, [...(groups.get(section) ?? []), part]);
  }
  const elements = groups.size < 2
    ? parts.join(', ')
    : [...groups.entries()]
        .map(([section, rows]) => `${section} » ${rows.join(', ')}`)
        .join(' | ');

  const fabricParts = groundNames(state, refLayers);
  if (refLayers.driveway.length >= 2 && filter !== 'all') {
    fabricParts.push(EXACT_DRIVEWAY_LEGEND_TEXT);
  }

  return {
    elements,
    fabric: fabricParts.join(', '),
    served: contextElementNames(state, filter).join(', '),
    legendElementGroups,
    legendContentGroups,
    contextElementGroups: contextElementGroups(state, filter),
  };
}
