// Design Studio — one answer to “which layer owns this saved shape?”.
//
// The canvas uses these memberships for visibility; the Layers panel uses the same memberships
// for its CAD/GIS-style select-all control. Keeping both on one authority prevents a dangerous
// split where a farmer sees an object on one layer but the layer tick selects a different set.

import {
  groundFeatureLayer,
  type DesignCanvasState,
  type LineShape,
  type ZoneShape,
} from '@/lib/design-canvas';
import {
  ELEMENTS_BY_ID,
  GROUND_FEATURES,
  plantingGroupFor,
  ZONE_DEFS,
  type DesignLayerKey,
  type ElementCategory,
  type PlantingGroup,
} from '@/lib/design-elements';
import { ownedByCurrentStep } from '@/lib/glossy-filters';

const CATEGORY_LAYER: Record<ElementCategory, DesignLayerKey> = {
  water: 'water',
  earthworks: 'earthworks',
  growing: 'planting',
  structure: 'structures',
  animal: 'animals',
  access: 'access',
};

const LINE_LAYER: Record<LineShape['kind'], DesignLayerKey> = {
  swale: 'water',
  pipe: 'water',
  drip: 'water',
  greywater: 'water',
  fence: 'structures',
  path: 'access',
  bedpath: 'planting',
  windbreak: 'planting',
};

const LINE_ALSO_LAYERS: Partial<Record<LineShape['kind'], DesignLayerKey[]>> = {
  swale: ['earthworks'],
};

// Planting has enough different marks that its parent eye is not enough once a plan is underway.
// These are display-only groups: they never alter geometry, and use the same membership answers
// as the canvas so a child tick cannot silently target a different set from its parent layer.
export type PlantingSublayer = PlantingGroup | 'windbreaks' | 'staple_garden';

/** Water's map-control groups. One shared mapping keeps the canvas, its child eyes and child
 * selectors talking about exactly the same saved marks. */
export type WaterInfrastructureLayer = 'storage' | 'tapPoints' | 'pipes' | 'drip' | 'swales';

export function waterInfrastructureForElement(defId: string): WaterInfrastructureLayer | null {
  if (defId === 'tap_point') return 'tapPoints';
  if (defId === 'rain_barrel' || defId.startsWith('jojo_')) return 'storage';
  return null;
}

export function waterInfrastructureForLine(kind: LineShape['kind']): WaterInfrastructureLayer | null {
  if (kind === 'pipe' || kind === 'greywater') return 'pipes';
  if (kind === 'drip') return 'drip';
  if (kind === 'swale') return 'swales';
  return null;
}

export const PLANTING_SUBLAYER_LABEL: Record<PlantingSublayer, string> = {
  beds: 'Beds & strips',
  indigenous_fruit: 'Indigenous fruit',
  fruit_nut: 'Fruit & nut trees',
  other_trees: 'Shade & other trees',
  windbreaks: 'Windbreaks',
  staple_garden: 'Staple garden',
};

export const PLANTING_SUBLAYER_ORDER: readonly PlantingSublayer[] = [
  'beds',
  'indigenous_fruit',
  'fruit_nut',
  'other_trees',
  'windbreaks',
  'staple_garden',
];

export function itemLayerKeys(defId: string): DesignLayerKey[] {
  const def = ELEMENTS_BY_ID[defId];
  if (!def) return [];
  return [...new Set([CATEGORY_LAYER[def.category], ...(def.alsoLayers ?? [])])];
}

export function lineLayerKeys(kind: LineShape['kind']): DesignLayerKey[] {
  return [LINE_LAYER[kind], ...(LINE_ALSO_LAYERS[kind] ?? [])];
}

export function zoneLayerKey(zone: Pick<ZoneShape, 'feature'>): DesignLayerKey {
  return zone.feature ? groundFeatureLayer(zone.feature) : 'zones';
}

/** The fine-grained Planting switch that owns a placed element, if it has one. */
export function plantingSublayerForElement(defId: string): PlantingSublayer | null {
  const def = ELEMENTS_BY_ID[defId];
  if (!def || !itemLayerKeys(defId).includes('planting')) return null;
  return plantingGroupFor(def);
}

/** Bed paths stay with beds; a drawn shelterbelt is its own readable group. */
export function plantingSublayerForLine(kind: LineShape['kind']): PlantingSublayer | null {
  if (kind === 'bedpath') return 'beds';
  if (kind === 'windbreak') return 'windbreaks';
  return null;
}

/** The staple garden is the one farmer-drawn ground area that belongs to Planting. */
export function plantingSublayerForZone(zone: Pick<ZoneShape, 'feature'>): PlantingSublayer | null {
  return zone.feature === 'staple_garden' ? 'staple_garden' : null;
}

// Water and Planting each already have a useful farmer-facing grouping above. Every other
// functional layer needs the same child-eye affordance, but should only expose marks that are
// actually in this plan. This keeps a small plan legible without pretending a never-placed shed
// or access path is something the farmer can hide.
export type LayerElementVisibilityKey = `item:${string}` | `line:${LineShape['kind']}` | `zone:${string}`;

export type LayerElementChild = {
  key: LayerElementVisibilityKey;
  label: string;
  count: number;
};

function isSpecialChildLayer(layer: DesignLayerKey): boolean {
  return layer === 'water' || layer === 'planting';
}

/** The element-type eye that owns a normal placed item, excluding Water and Planting's groups. */
export function layerElementKeyForItem(defId: string): LayerElementVisibilityKey | null {
  const layer = itemLayerKeys(defId)[0];
  return layer && !isSpecialChildLayer(layer) ? `item:${defId}` : null;
}

/** The element-type eye that owns a normal drawn line, excluding Water and Planting's groups. */
export function layerElementKeyForLine(kind: LineShape['kind']): LayerElementVisibilityKey | null {
  const layer = lineLayerKeys(kind)[0];
  return layer && !isSpecialChildLayer(layer) ? `line:${kind}` : null;
}

/** The element-type eye that owns an effort zone or an existing ground feature. */
export function layerElementKeyForZone(zone: Pick<ZoneShape, 'zone' | 'feature'>): LayerElementVisibilityKey | null {
  const layer = zoneLayerKey(zone);
  if (isSpecialChildLayer(layer)) return null;
  return `zone:${zone.feature ?? String(zone.zone)}`;
}

function lineLabel(kind: LineShape['kind']): string {
  const labels: Record<LineShape['kind'], string> = {
    swale: 'Swale', pipe: 'Pipe', drip: 'Drip irrigation', greywater: 'Greywater route',
    fence: 'Fence', path: 'Path', bedpath: 'Bed path', windbreak: 'Windbreak',
  };
  return labels[kind];
}

/**
 * The expandable child matrix for all functional layers other than the specialised Water and
 * Planting matrices. It groups identical saved marks and returns their current count; its keys
 * are also used by the canvas, so a child eye can never refer to a different set of marks.
 */
export function layerElementChildren(
  state: DesignCanvasState,
  layer: DesignLayerKey,
): LayerElementChild[] {
  if (isSpecialChildLayer(layer)) return [];
  const children = new Map<LayerElementVisibilityKey, LayerElementChild>();
  const add = (key: LayerElementVisibilityKey | null, label: string, belongs: boolean) => {
    if (!key || !belongs) return;
    const existing = children.get(key);
    children.set(key, existing ? { ...existing, count: existing.count + 1 } : { key, label, count: 1 });
  };

  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    add(layerElementKeyForItem(item.defId), def?.name ?? 'Unknown item', itemLayerKeys(item.defId)[0] === layer);
  }
  for (const line of state.lines) {
    add(layerElementKeyForLine(line.kind), lineLabel(line.kind), lineLayerKeys(line.kind)[0] === layer);
  }
  for (const zone of state.zones) {
    const label = zone.feature ? GROUND_FEATURES[zone.feature].label : ZONE_DEFS[zone.zone].label;
    add(layerElementKeyForZone(zone), label, zoneLayerKey(zone) === layer);
  }

  return [...children.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * IDs the layer tick is allowed to select on the current wizard step.
 *
 * Reference imagery, boundary traces, labels, symbols, contours and sector energies are display
 * layers, not saved editable objects, so they honestly return an empty list. Shapes owned by a
 * different wizard step stay locked exactly as they do on the canvas; a bulk action must never
 * bypass that safety rule merely because it started in the Layers panel.
 */
export function selectableIdsForLayer(
  state: DesignCanvasState,
  layer: DesignLayerKey,
): string[] {
  const ids: string[] = [];

  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !itemLayerKeys(item.defId).includes(layer)) continue;
    if (ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: item.defId })) {
      ids.push(item.id);
    }
  }

  for (const zone of state.zones) {
    if (zoneLayerKey(zone) !== layer) continue;
    if (ownedByCurrentStep(state.step, { kind: 'zone', feature: zone.feature })) ids.push(zone.id);
  }

  for (const line of state.lines) {
    if (!lineLayerKeys(line.kind).includes(layer)) continue;
    if (ownedByCurrentStep(state.step, { kind: 'line', lineKind: line.kind })) ids.push(line.id);
  }

  return ids;
}

/**
 * IDs a child selector may select on the current wizard step.
 *
 * This starts with selectableIdsForLayer, rather than scanning the state independently, so a
 * sublayer tick cannot select context from a different step just because its parent can paint it.
 */
export function selectableIdsForLayerChild(
  state: DesignCanvasState,
  layer: DesignLayerKey,
  child: WaterInfrastructureLayer | PlantingSublayer | LayerElementVisibilityKey,
): string[] {
  const selectable = new Set(selectableIdsForLayer(state, layer));
  const ids: string[] = [];
  const add = (id: string, belongs: boolean) => {
    if (belongs && selectable.has(id)) ids.push(id);
  };

  for (const item of state.items) {
    const key = layer === 'water'
      ? waterInfrastructureForElement(item.defId)
      : layer === 'planting'
        ? plantingSublayerForElement(item.defId)
        : layerElementKeyForItem(item.defId);
    add(item.id, key === child);
  }
  for (const line of state.lines) {
    const key = layer === 'water'
      ? waterInfrastructureForLine(line.kind)
      : layer === 'planting'
        ? plantingSublayerForLine(line.kind)
        : layerElementKeyForLine(line.kind);
    add(line.id, key === child);
  }
  for (const zone of state.zones) {
    const key = layer === 'planting'
      ? plantingSublayerForZone(zone)
      : layerElementKeyForZone(zone);
    add(zone.id, key === child);
  }
  return ids;
}
