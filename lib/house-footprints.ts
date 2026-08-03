/**
 * WHICH TRACED RINGS ARE BUILDINGS — the one answer every sheet must agree on.
 *
 * A farm's buildings reach the renderer by two different routes, for historical reasons. A project
 * that traced its house on the MAP carries it in `refLayers.house`; a project that drew it in the
 * Design Studio carries it as a ground-feature `ZoneShape` with `feature: 'house'`. Both are real
 * and both must be drawn, so every pass that cares about buildings — protect masks, cutters, the
 * house overlay, the plain-paper vector draw — asks this function rather than picking one route.
 *
 * WHY IT LIVES HERE AND NOT IN THE RENDERER. It used to sit inside DesignGlossy.tsx, which no test
 * imports (the component pulls in canvas and React, so it is only ever source-grepped). That left
 * the rule deciding WHICH BUILDINGS EXIST covered by regexes rather than by arithmetic — and the
 * duplicate below is precisely the kind of defect a regex cannot see. It is pure geometry with no
 * canvas dependency, so it belongs where it can be measured.
 */

import type { DesignCanvasState } from '@/lib/design-canvas';

export interface HouseFootprintRefLayers {
  house: Array<[number, number]>;
}

/**
 * Every distinct building footprint on the site, in normalised [0..1] coordinates.
 *
 * THE SAME BUILDING ARRIVES TWICE. `resolveBaseLayers` PROMOTES the largest Studio house zone into
 * `refLayers.house` (lib/base-layers.ts) and hands back that zone's own points array — so the loop
 * below then finds the very same ring again among the zones. That was harmless for years because
 * every caller built a MASK, and painting a shape into a mask twice is the same mask. It stopped
 * being harmless the moment a caller FILLED: a translucent house fill drawn twice compounds, so the
 * main building lands near 36% where the paint says 20% and reads as a different material from the
 * store room beside it.
 */
export function authoritativeHouseFootprints(
  state: Pick<DesignCanvasState, 'zones'>,
  refLayers: HouseFootprintRefLayers,
): Array<Array<[number, number]>> {
  const footprints: Array<Array<[number, number]>> = [];
  if (refLayers.house.length >= 3) footprints.push(refLayers.house);
  for (const zone of state.zones) {
    if (zone.feature === 'house' && zone.points.length >= 3) footprints.push(zone.points);
  }
  const kept: Array<Array<[number, number]>> = [];
  for (const ring of footprints) {
    if (kept.some((other) => sameFootprint(other, ring))) continue;
    kept.push(ring);
  }
  return kept;
}

/**
 * Two traced rings are THE SAME BUILDING.
 *
 * This is a duplicate test, not a proximity test. A promoted ring and the zone it was promoted from
 * are identical — same points, same order — so the tolerance only has to survive floating-point
 * round-tripping, and is kept far too small to fold two genuinely adjacent structures (a house and
 * the store room built against its wall) into one. Compared by VALUE rather than by reference
 * because the promotion returns the array by reference today, and a correctness argument that rests
 * on that is one refactor away from silently breaking.
 */
export function sameFootprint(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const centroid = (ring: Array<[number, number]>): [number, number] => {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return [sx / ring.length, sy / ring.length];
  };
  const [ax, ay] = centroid(a);
  const [bx, by] = centroid(b);
  return Math.hypot(ax - bx, ay - by) < 1e-4;
}
