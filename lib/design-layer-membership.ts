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
  type DesignLayerKey,
  type ElementCategory,
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
