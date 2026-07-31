// Verbal STRUCTURE REGISTER for the paid polish pass: what each traced built/ground feature IS
// (a roofed building vs a flat ground surface) and roughly where it sits in the frame.
//
// Why it exists: buildFinishedSheetPolishPrompt's geometry rules say what may not MOVE, and
// SOURCE INVENTORY says nothing NEW may appear, but nothing ever said what each rectangle IS.
// The model saw an unlabelled cluster of rectangles near farm buildings and guessed "roofs":
// Rory's first two v93 Full Treatments came back with the concrete slab rendered as a huge
// corrugated gable roof and the driveway as a third dark-roofed building.
//
// Every sentence here is computed from the farmer's own traced rings — names, kinds, relative
// sizes and compass positions. No dimensions, counts or species are invented.
import { compassWord, plotBox } from '@/lib/producer-labels';
import type { GroundFeatureKind, ZoneShape } from '@/lib/design-canvas';

export interface StructureRegisterRefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean;
}

// Flat (never-roofed) kinds: fallback display name + how the surface must read. house is the
// only roofed kind; boundary is handled by the byte-locked ring, never listed here.
const FLAT_WHAT: Partial<Record<GroundFeatureKind, [fallbackName: string, what: string]>> = {
  patio: ['The paved slab', 'flat paving at ground level — bare concrete open to the sky, with NO roof and NO walls'],
  driveway: ['The driveway', 'a vehicle track on the ground — a dark tar or gravel surface, never a roof'],
  lawn: ['The lawn', 'open mown ground, kept open'],
  cleared: ['The cleared area', 'open cleared ground, kept open'],
  veg_garden: ['The existing vegetable garden', 'a ground-level planted garden with nothing built over it'],
  orchard: ['The existing orchard', 'existing orchard trees on open ground'],
  staple_garden: ['The staple garden', 'an open field of standing maize with beans and pumpkin through it — a crop growing on the ground, never a structure and never a roof'],
  terrace_bank: ['The terrace bank', 'a graded earth bank between two ground levels, not a wall and not a building'],
};

function centroid(points: Array<[number, number]>): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
}

function ringArea(points: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(area) / 2;
}

export function structureRegisterText(
  state: { zones: ZoneShape[] },
  refLayers: StructureRegisterRefLayers,
): string {
  const box =
    refLayers.boundary.length >= 3 ? plotBox(refLayers.boundary) : { x0: 0, y0: 0, x1: 1, y1: 1 };
  const where = (points: Array<[number, number]>): string => {
    const [cx, cy] = centroid(points);
    return `${compassWord(cx, cy, box).toLowerCase()} part of the site`;
  };

  const roofed: Array<{ name: string; points: Array<[number, number]>; area: number }> = [];
  const flat: string[] = [];

  for (const zone of state.zones) {
    if (!zone.feature || zone.feature === 'boundary' || zone.points.length < 3) continue;
    const customName = zone.name?.trim();
    if (zone.feature === 'house') {
      roofed.push({
        name: customName || 'Farm building',
        points: zone.points,
        area: ringArea(zone.points),
      });
      continue;
    }
    const entry = FLAT_WHAT[zone.feature];
    if (!entry) continue;
    const [fallbackName, what] = entry;
    flat.push(`"${customName || fallbackName}" (${where(zone.points)}) is ${what}.`);
  }

  // The main-map house ring is a building too — unless a Studio ring is the same building traced
  // twice (centroids nearly coincide), in which case the named Studio ring already covers it.
  if (refLayers.house.length >= 3) {
    const [hx, hy] = centroid(refLayers.house);
    const alreadyListed = roofed.some(({ points }) => {
      const [cx, cy] = centroid(points);
      return Math.hypot(cx - hx, cy - hy) < 0.05;
    });
    if (!alreadyListed) {
      roofed.push({
        name: 'The main farm building',
        points: refLayers.house,
        area: ringArea(refLayers.house),
      });
    }
  }

  roofed.sort((a, b) => b.area - a.area);
  const roofedLines = roofed.map(({ name, points }, i) => {
    const kindPhrase =
      roofed.length > 1
        ? i === 0
          ? 'the largest roofed building on the site'
          : `a roofed building, smaller than "${roofed[0].name}"`
        : 'a roofed building';
    return `"${name}" (${where(points)}) is ${kindPhrase} — draw exactly one roof on its exact footprint.`;
  });

  // A driveway traced only as a main-map reference (no Studio ring) still needs its identity
  // stated — it was one of the two features the model roofed.
  const hasDrivewayRing = state.zones.some(
    (zone) => zone.feature === 'driveway' && zone.points.length >= 3,
  );
  if (!hasDrivewayRing && refLayers.driveway.length >= 2) {
    const [, what] = FLAT_WHAT.driveway!;
    flat.push(`"The driveway" (${where(refLayers.driveway)}) is ${what}.`);
  }

  return [...roofedLines, ...flat].join(' ');
}
