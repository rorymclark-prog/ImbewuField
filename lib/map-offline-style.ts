import type { StyleSpecification } from 'mapbox-gl';
// A usable drawing surface has no dependency on a remote style, sprite or tile.
// Coordinates and saved geometry are still real; this is explicitly not satellite imagery.
export const OFFLINE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'Offline drawing canvas',
  sources: {},
  layers: [{ id: 'offline-background', type: 'background', paint: { 'background-color': '#e8eddf' } }],
};
