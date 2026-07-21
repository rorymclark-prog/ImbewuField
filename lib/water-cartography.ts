import type { LineShape } from '@/lib/design-canvas';

export interface WaterRouteStyle {
  color: string;
  dash: number[];
  width: number;
}

export type WaterRouteKind = Extract<LineShape['kind'], 'swale' | 'pipe' | 'drip' | 'greywater'>;

/** One drawing registry for every line kind assigned to the Water sheet. */
export const WATER_ROUTE_STYLE: Record<WaterRouteKind, WaterRouteStyle> = {
  swale: { color: '#4EA6D8', dash: [], width: 4.5 },
  pipe: { color: '#245E85', dash: [14, 6], width: 4 },
  drip: { color: '#4E8B3B', dash: [3, 8], width: 3.5 },
  greywater: { color: '#8E44AD', dash: [10, 6], width: 4 },
};

export function waterRouteStyleFor(kind: LineShape['kind']): WaterRouteStyle | undefined {
  return WATER_ROUTE_STYLE[kind as WaterRouteKind];
}
