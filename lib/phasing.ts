// Implementation & phasing — the rules engine behind plan-set sheet 07.
//
// PURE and DETERMINISTIC by design: same design in → same plan out, every time. No I/O, no DOM,
// no randomness, no clock, no model. That is the whole product argument (docs/PLAN-SET-SPEC.md,
// "Sheet 07"): a generative model can DRAW a phasing sheet beautifully but cannot GUARANTEE that
// the phases match the design or that the order is sound. We hold the true geometry and the
// permaculture rules, so we can — and we own the result outright.
//
// The sequence is not a taste call. It is the permaculture Scale of Permanence (Yeomans /
// keyline, see docs/DESIGN-TAXONOMY.md), which orders work most-permanent first:
//
//   Climate → Landform → Water → Access → Earthworks → Structures → Fences → Soil → Trees
//
// made concrete as six build phases:
//
//   1 Verify, Set Out & Make Safe   — you cannot build off a plan you have not pegged on site
//   2 Safe Access & Water Spine     — barrow routes and the main line, before anything buries them
//   3 Earthworks & Soil             — land shaping while machinery can still reach the ground
//   4 Beds, Drip & Working Infra    — the daily-work fabric, on ground that now holds water
//   5 Perennials & Guilds           — trees last of the plantings; they need water already proven
//   6 Small Livestock & Commission  — animals only onto a site that is fenced, shaded and watered
//
// A phase is emitted ONLY if the design actually contains its elements (rule: never invent work
// the farmer has not planned). The two bookends are the exception and are documented at their
// emit sites — set-out and commissioning are gates on every build, not element phases.
//
// This module deliberately has no browser dependency so it is unit-testable as a plain function:
// its only imports are the pure catalog/biome data modules and types.

import type { DesignCanvasState, LineShape, PlacedItem } from '@/lib/design-canvas';
import type { ElementCategory } from '@/lib/design-elements';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { BIOMES } from '@/lib/biome';

// Structurally identical to DesignGlossyProps['refLayers']. Declared here rather than imported
// so lib/ never depends on components/ — DesignGlossy imports THIS module, and the reverse edge
// would be a cycle.
export interface PhasingRefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean;
}

/** What the app knows about the place. Both fields optional: an unknown site must degrade to
 *  generic-but-still-correct advice, never to a guess dressed up as local knowledge. */
export interface PhasingSite {
  biome?: string;
  rainfallMm?: number;
}

export type PhaseKey = 'setout' | 'access_water' | 'earthworks' | 'beds' | 'perennials' | 'livestock';

export interface Phase {
  /** 1-based position in the EMITTED plan (not the PhaseKey's fixed position) — a design with no
   *  earthworks numbers its beds phase 3, because that is the third thing that gets built. */
  n: number;
  key: PhaseKey;
  title: string;
  colour: string;
  /** Human range, e.g. "Weeks 3–6". The final phase is open-ended ("Month 3+"). */
  weekRange: string;
  weekStart: number;
  weekEnd: number;
  /** 3–5 imperative bullets, derived from what is actually placed. */
  tasks: string[];
  /** The gate that must pass before the next phase starts, already lettered ("Hold Point B: …"). */
  holdPoint: string;
  /** Ids of the design objects this phase builds — BOTH PlacedItem.id and LineShape.id. They share
   *  one id space in DesignCanvasState and both are things you go and build, so the sheet resolves
   *  either to a position when it places the phase pin. Empty for the two bookend phases. */
  itemIds: string[];
}

export interface PhasePlan {
  phases: Phase[];
  /** The Scale-of-Permanence sequence made concrete for THIS design — short nouns, in order. */
  criticalOrder: string[];
  /** Site-specific constraints derived from what is present (driveway, bank, water, animals…). */
  siteRules: string[];
}

/** One exact, app-owned numbered pin on the implementation map.
 *
 * `itemIds` records the work represented by the pin. It is deliberately part of the pure result:
 * tests can prove that every buildable object is represented exactly once without inspecting
 * pixels, while the renderer only needs `x` and `y`.
 */
export interface PhasePinPosition {
  x: number;
  y: number;
  itemIds: string[];
}

/** A truthful work anchor paired with the phase number that will be printed beside it. */
export interface NumberedPhasePinAnchor extends PhasePinPosition {
  phaseKey: PhaseKey;
  phaseNumber: number;
}

/** A display-safe numbered pin. `anchorX/Y` remain the exact work location; `x/y` are the
 * nearby badge centre, offset so the badge does not erase the feature it is explaining. */
export interface PlacedPhasePin extends NumberedPhasePinAnchor {
  anchorX: number;
  anchorY: number;
}

/** Resolve a phase to exact map-pin positions.
 *
 * Kept in the rules module rather than buried in the canvas renderer so the implementation-map
 * placement contract is deterministic and testable without a browser. `mapAspect` is the rendered
 * map width / height: normalised x and y are not equal screen distances on a landscape sheet.
 *
 * A phase can contain work in several disconnected places (a tank at the building and a path at
 * the beds, for example). One global centroid can therefore land on nothing at all. We instead
 * cluster nearby work (connected areas for bed blocks; diameter-limited groups elsewhere) and
 * put one pin on each cluster's MEDOID — an actual item or route midpoint — so a marker never
 * floats in the empty average between unrelated work.
 */
export function buildPhasePinPositions(
  phase: Pick<Phase, 'key' | 'itemIds'>,
  state: Pick<DesignCanvasState, 'items' | 'lines'>,
  refLayers: PhasingRefLayers,
  mapAspect: number,
): PhasePinPosition[] {
  interface WorkPoint {
    id: string;
    x: number;
    y: number;
  }

  // In units of the rendered map's height. At the standard 3:2 map aspect this is roughly
  // 16% of the short edge: close bed rows read as one work area, while tank/route, orchard and
  // infrastructure groups on opposite terraces remain visibly distinct.
  const clusterSpan = 0.16;
  const aspect = Number.isFinite(mapAspect) && mapAspect > 0 ? mapAspect : 1;
  const clusterSpanInHeightUnits = clusterSpan * Math.min(1, aspect);
  const pointKey = (point: WorkPoint) =>
    `${point.id}\u0000${point.x.toFixed(12)}\u0000${point.y.toFixed(12)}`;
  const comparePoints = (a: WorkPoint, b: WorkPoint) =>
    a.x - b.x || a.y - b.y || pointKey(a).localeCompare(pointKey(b));
  const distance = (a: WorkPoint, b: WorkPoint) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);

  const centroid = (points: Array<[number, number]>): [number, number] | null => {
    if (!points.length) return null;
    return [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
  };
  const isFinitePoint = (point: [number, number]) =>
    Number.isFinite(point[0]) && Number.isFinite(point[1]);
  const clipSegmentToMap = (
    start: [number, number],
    end: [number, number],
  ): [[number, number], [number, number]] | null => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    let enter = 0;
    let leave = 1;
    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) <= Number.EPSILON) return q >= 0;
      const ratio = q / p;
      if (p < 0) {
        if (ratio > leave) return false;
        enter = Math.max(enter, ratio);
      } else {
        if (ratio < enter) return false;
        leave = Math.min(leave, ratio);
      }
      return enter <= leave;
    };
    if (
      !clip(-dx, start[0])
      || !clip(dx, 1 - start[0])
      || !clip(-dy, start[1])
      || !clip(dy, 1 - start[1])
    ) return null;
    return [
      [start[0] + dx * enter, start[1] + dy * enter],
      [start[0] + dx * leave, start[1] + dy * leave],
    ];
  };
  const routeMidpoint = (points: Array<[number, number]>): [number, number] | null => {
    // Boundary-presentation cropping intentionally maps geometry outside the unit square. The
    // canvas clips those portions, so measure the midpoint of the VISIBLE route rather than
    // rejecting the whole factual line because its transformed endpoints sit beyond the frame.
    if (points.length < 2 || !points.every(isFinitePoint)) return null;
    const visibleSegments: Array<{
      start: [number, number];
      end: [number, number];
      length: number;
    }> = [];
    let total = 0;
    for (let index = 1; index < points.length; index++) {
      const clipped = clipSegmentToMap(points[index - 1], points[index]);
      if (!clipped) continue;
      const length = Math.hypot(
        (clipped[1][0] - clipped[0][0]) * aspect,
        clipped[1][1] - clipped[0][1],
      );
      if (!(length > 0)) continue;
      visibleSegments.push({ start: clipped[0], end: clipped[1], length });
      total += length;
    }
    if (!(total > 0)) return null;
    let remaining = total / 2;
    for (const segment of visibleSegments) {
      if (remaining <= segment.length) {
        const t = remaining / segment.length;
        return [
          segment.start[0] + (segment.end[0] - segment.start[0]) * t,
          segment.start[1] + (segment.end[1] - segment.start[1]) * t,
        ];
      }
      remaining -= segment.length;
    }
    return visibleSegments.at(-1)?.end ?? null;
  };

  const requestedIds = new Set(phase.itemIds);
  const candidatesById = new Map<string, WorkPoint[]>();
  const addCandidate = (candidate: WorkPoint) => {
    const existing = candidatesById.get(candidate.id);
    if (existing) existing.push(candidate);
    else candidatesById.set(candidate.id, [candidate]);
  };
  for (const item of state.items) {
    if (!requestedIds.has(item.id) || !isBuildableItem(item)) continue;
    addCandidate({ id: item.id, x: item.x, y: item.y });
  }
  for (const line of state.lines) {
    if (!requestedIds.has(line.id)) continue;
    const point = routeMidpoint(line.points);
    if (point) addCandidate({ id: line.id, x: point[0], y: point[1] });
  }

  const work: WorkPoint[] = [];
  for (const id of [...new Set(phase.itemIds)].sort()) {
    const candidates = candidatesById.get(id) ?? [];
    // Items and lines share one id space. More than one match is corrupt/ambiguous saved state:
    // omitting it is safer and deterministic; Map last-write-wins would move a factual phase pin
    // merely because an array happened to be loaded in a different order.
    if (candidates.length === 1) work.push(candidates[0]);
  }
  work.sort(comparePoints);

  if (work.length) {
    // Beds are a built AREA: adjacent rows in a two-dimensional block should remain one phase
    // marker even when the block's opposite corners are farther apart than the link radius. Other
    // phases use a deterministic diameter limit (maximum pairwise distance), which prevents the
    // classic chain where five trees spaced along a whole boundary collapse into one marker merely
    // because each tree is close to its immediate neighbour.
    let clusters: WorkPoint[][];
    const clusterKey = (cluster: WorkPoint[]) =>
      cluster.map(pointKey).sort().join('\u0001');

    if (phase.key === 'beds') {
      const remaining = new Set(work.map((_, index) => index));
      clusters = [];
      for (let start = 0; start < work.length; start++) {
        if (!remaining.has(start)) continue;
        const memberIndexes: number[] = [];
        const queue = [start];
        remaining.delete(start);
        while (queue.length) {
          const current = queue.shift();
          if (current === undefined) break;
          memberIndexes.push(current);
          for (const candidate of [...remaining].sort((a, b) => a - b)) {
            if (distance(work[current], work[candidate]) > clusterSpanInHeightUnits) continue;
            remaining.delete(candidate);
            queue.push(candidate);
          }
        }
        clusters.push(memberIndexes.map((index) => work[index]).sort(comparePoints));
      }
    } else {
      // Greedy diameter-limited insertion is O(n²): for each point, all existing members are
      // visited at most once. The prior repeatedly-merged complete-link implementation was O(n³)
      // and froze the sheet for 5–25 seconds on dense orchard designs.
      clusters = [];
      for (const point of work) {
        let bestIndex = -1;
        let bestMaximum = Number.POSITIVE_INFINITY;
        let bestKey = '';
        for (let index = 0; index < clusters.length; index++) {
          let maximum = 0;
          let eligible = true;
          for (const peer of clusters[index]) {
            maximum = Math.max(maximum, distance(point, peer));
            if (maximum > clusterSpanInHeightUnits) {
              eligible = false;
              break;
            }
          }
          if (!eligible) continue;
          const key = clusterKey(clusters[index]);
          if (
            maximum < bestMaximum - 1e-12
            || (Math.abs(maximum - bestMaximum) <= 1e-12 && key < bestKey)
          ) {
            bestIndex = index;
            bestMaximum = maximum;
            bestKey = key;
          }
        }
        if (bestIndex === -1) {
          clusters.push([point]);
        } else {
          clusters[bestIndex].push(point);
          clusters[bestIndex].sort(comparePoints);
        }
        clusters.sort((a, b) => clusterKey(a).localeCompare(clusterKey(b)));
      }
    }

    const pins = clusters.map((cluster): PhasePinPosition => {
      // Medoid = member with the smallest total squared distance to its cluster peers. Unlike a
      // centroid, this is guaranteed to be an actual, labelled piece of work.
      const medoid = [...cluster].sort((a, b) => {
        const cost = (candidate: WorkPoint) =>
          cluster.reduce((sum, peer) => {
            const d = distance(candidate, peer);
            return sum + d * d;
          }, 0);
        return cost(a) - cost(b) || pointKey(a).localeCompare(pointKey(b));
      })[0];
      return {
        x: medoid.x,
        y: medoid.y,
        itemIds: cluster.map(({ id }) => id).sort(),
      };
    });
    return pins.sort((a, b) =>
      a.x - b.x || a.y - b.y || a.itemIds.join('\u0000').localeCompare(b.itemIds.join('\u0000')),
    );
  }

  const usableRing = (points: Array<[number, number]>): Array<[number, number]> => {
    if (points.length < 3 || !points.every(isNormalisedPoint)) return [];
    const open = [...points];
    const first = open[0];
    const last = open.at(-1);
    if (last && first[0] === last[0] && first[1] === last[1]) open.pop();
    if (new Set(open.map(([x, y]) => `${x}\u0000${y}`)).size < 3) return [];
    const twiceArea = open.reduce((sum, [x, y], index) => {
      const [nextX, nextY] = open[(index + 1) % open.length];
      return sum + x * nextY - nextX * y;
    }, 0);
    return Math.abs(twiceArea) > 1e-12 ? open : [];
  };
  const usableRoute = (points: Array<[number, number]>): Array<[number, number]> => {
    if (points.length < 2 || !points.every(isNormalisedPoint)) return [];
    const [x0, y0] = points[0];
    return points.some(([x, y]) => x !== x0 || y !== y0) ? points : [];
  };
  const houseRing = usableRing(refLayers.house);
  const house = centroid(houseRing);
  const driveway = usableRoute(refLayers.driveway);
  const gate = driveway[0] ?? null;
  const boundary = usableRing(refLayers.boundary);
  const box = boundary.length
    ? {
        x0: Math.min(...boundary.map(([x]) => x)),
        y0: Math.min(...boundary.map(([, y]) => y)),
        x1: Math.max(...boundary.map(([x]) => x)),
        y1: Math.max(...boundary.map(([, y]) => y)),
      }
    : null;
  const northwest: [number, number] = box
    ? [box.x0 + (box.x1 - box.x0) * 0.28, box.y0 + (box.y1 - box.y0) * 0.28]
    : [0.4, 0.4];
  const southeast: [number, number] = box
    ? [box.x0 + (box.x1 - box.x0) * 0.72, box.y0 + (box.y1 - box.y0) * 0.72]
    : [0.6, 0.6];
  // Fallbacks represent the two genuine no-object bookend gates only. If a content phase named
  // object ids but none resolved safely (corrupt duplicate/malformed geometry), inventing a pin at
  // the house would hide that failure and falsely mark unrelated ground.
  if (phase.itemIds.length > 0) return [];
  if (phase.key !== 'setout' && phase.key !== 'livestock') return [];
  const fallback = phase.key === 'setout' ? gate ?? northwest : house ?? southeast;
  return [{ x: fallback[0], y: fallback[1], itemIds: [] }];
}

/** Offset numbered badges from their exact anchors and resolve cross-phase collisions.
 *
 * The short leader preserves factual location while keeping small tanks, compost bays and route
 * fittings visible. Layout is global across phases: resolving each phase independently can put two
 * same-sized discs on the same coordinate and let the later phase erase the earlier one.
 */
export function layoutPhasePinPositions(
  anchors: NumberedPhasePinAnchor[],
  mapAspect: number,
  pinRadiusInHeightUnits: number,
): PlacedPhasePin[] {
  const aspect = Number.isFinite(mapAspect) && mapAspect > 0 ? mapAspect : 1;
  const radius = Number.isFinite(pinRadiusInHeightUnits) && pinRadiusInHeightUnits > 0
    ? pinRadiusInHeightUnits
    : 0.02;
  const radiusX = radius / aspect;
  const marginX = radiusX + 0.002 / aspect;
  const marginY = radius + 0.002;
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const key = (anchor: NumberedPhasePinAnchor) =>
    [
      anchor.x.toFixed(12),
      anchor.y.toFixed(12),
      String(anchor.phaseNumber).padStart(3, '0'),
      anchor.phaseKey,
      [...anchor.itemIds].sort().join('\u0000'),
    ].join('\u0001');
  const ordered = anchors
    .filter((anchor) => isNormalisedPoint([anchor.x, anchor.y]))
    .map((anchor) => ({ ...anchor, itemIds: [...anchor.itemIds].sort() }))
    .sort((a, b) => key(a).localeCompare(key(b)));
  const placed: PlacedPhasePin[] = [];
  const directions: Array<[number, number]> = [
    [Math.SQRT1_2, -Math.SQRT1_2],
    [-Math.SQRT1_2, -Math.SQRT1_2],
    [Math.SQRT1_2, Math.SQRT1_2],
    [-Math.SQRT1_2, Math.SQRT1_2],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 1],
    [Math.cos(Math.PI / 8), -Math.sin(Math.PI / 8)],
    [-Math.cos(Math.PI / 8), -Math.sin(Math.PI / 8)],
    [Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)],
    [-Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)],
    [Math.sin(Math.PI / 8), -Math.cos(Math.PI / 8)],
    [-Math.sin(Math.PI / 8), -Math.cos(Math.PI / 8)],
    [Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
    [-Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
  ];
  // Ring spacing itself exceeds one badge diameter. This matters at a map corner, where clamping
  // collapses several outward-facing directions onto the same edge and six emitted phases can
  // otherwise exhaust the near ring.
  const rings = [2.45, 4.9, 7.35, 9.8, 12.25];

  for (const anchor of ordered) {
    let chosen: { x: number; y: number } | null = null;
    let fallback: { x: number; y: number; score: number; order: number } | null = null;
    const seenCandidates = new Set<string>();
    let order = 0;
    for (const ring of rings) {
      for (const [dx, dy] of directions) {
        const candidate = {
          x: Math.min(1 - marginX, Math.max(marginX, anchor.x + dx * ring * radius / aspect)),
          y: Math.min(1 - marginY, Math.max(marginY, anchor.y + dy * ring * radius)),
        };
        const candidateKey = `${candidate.x.toFixed(12)}\u0000${candidate.y.toFixed(12)}`;
        if (seenCandidates.has(candidateKey)) continue;
        seenCandidates.add(candidateKey);
        const anchorClearance = Math.min(
          ...ordered.map((other) => distance(candidate, other)),
        );
        const badgeClearance = placed.length
          ? Math.min(...placed.map((other) => distance(candidate, other)))
          : Number.POSITIVE_INFINITY;
        const clearsTargets = anchorClearance >= radius * 1.55;
        const clearsBadges = badgeClearance >= radius * 2.2;
        if (clearsTargets && clearsBadges) {
          chosen = candidate;
          break;
        }
        const score =
          Math.max(0, radius * 1.55 - anchorClearance) * 10
          + Math.max(0, radius * 2.2 - badgeClearance)
          + ring * radius * 0.001;
        if (
          fallback === null
          || score < fallback.score - 1e-12
          || (Math.abs(score - fallback.score) <= 1e-12 && order < fallback.order)
        ) fallback = { ...candidate, score, order };
        order += 1;
      }
      if (chosen) break;
    }
    const position = chosen ?? fallback ?? { x: anchor.x, y: anchor.y };
    placed.push({
      ...anchor,
      anchorX: anchor.x,
      anchorY: anchor.y,
      x: position.x,
      y: position.y,
    });
  }

  return placed;
}

// Distinct on the dark blueprint scrim, and borrowed from the palette the other sheets already
// use, so a phase colour never fights the house style: chalk (survey string), water blue, soil
// ochre, drip green, canopy green, and one magenta that appears nowhere else on the plan set.
const PHASE_COLOUR: Record<PhaseKey, string> = {
  setout: '#E8E2D4',
  access_water: '#4EA6D8',
  earthworks: '#C07A1E',
  beds: '#7FD46B',
  perennials: '#2F7A4A',
  livestock: '#C879C0',
};

// Fixed build order. buildPhasePlan walks this array and skips any phase with nothing in it.
const PHASE_ORDER: PhaseKey[] = ['setout', 'access_water', 'earthworks', 'beds', 'perennials', 'livestock'];

// ── Which phase builds which element ─────────────────────────────────────────────────────────
// Category alone is too coarse here, exactly as it is for the species colours on sheets 04/05:
// 'earthworks' holds both a contour berm (phase 3, machinery) and a herb spiral (phase 4, hands),
// and 'structure' holds both a nursery table (phase 4) and a chicken kraal (phase 6, livestock).
// So: category gives the default, and a short override table names the elements whose BUILD order
// differs from their catalog drawer. Defaulting by category (rather than listing all 67 elements)
// also means a new catalog entry lands in a sensible phase instead of silently vanishing.
function phaseForCategory(category: ElementCategory): PhaseKey {
  switch (category) {
    case 'water':
      return 'access_water'; // tanks, taps, pumps — the spine
    case 'access':
      return 'access_water'; // gates and paths open the site up
    case 'earthworks':
      return 'earthworks';
    case 'structure':
      return 'beds'; // sheds, compost, nursery — the working fabric
    case 'growing':
      return 'perennials';
    case 'animal':
      return 'livestock';
  }
}

const PHASE_OVERRIDE: Record<string, PhaseKey> = {
  // Dug, not plumbed — a pond or dam is an excavation and belongs with the earthworks plant.
  pond_small: 'earthworks',
  dam: 'earthworks',
  // Minor earthworks that are really BEDS: built by hand, filled with compost, planted at once.
  raised_bed: 'beds',
  keyhole_bed: 'beds',
  herb_spiral: 'beds',
  banana_circle: 'beds',
  // A veg bed is annual ground, not a perennial — it goes in with the beds and drip.
  veg_bed: 'beds',
  // Vetiver is not a crop, it is the bank's reinforcement: it goes into the earthworks as they
  // are built, because a finished bank left bare is the thing that washes away. This is the
  // reference plan set's own phase 3, "Vetiver Bank & Soil Building".
  vetiver_row: 'earthworks',
  // Livestock housing — no animal arrives before its shelter, so these ride with phase 6.
  chicken_coop: 'livestock',
  chicken_tractor: 'livestock',
  kraal: 'livestock',
};

function phaseForItem(item: PlacedItem): PhaseKey | null {
  const def = ELEMENTS_BY_ID[item.defId];
  if (!def) return null; // an item whose def has left the catalog: skip, never guess a phase
  return PHASE_OVERRIDE[def.id] ?? phaseForCategory(def.category);
}

// Line kinds map straight to phases. Two calls worth naming:
//  • fence → 'beds', not 'livestock': the Scale of Permanence puts fences/subdivision BEFORE soil
//    and trees, and routing them via livestock would conjure a livestock phase out of a design
//    that has a fence and no animals.
//  • windbreak → 'perennials': a windbreak is a tree row. It is planted, not erected.
const PHASE_BY_LINE_KIND: Record<LineShape['kind'], PhaseKey> = {
  path: 'access_water',
  pipe: 'access_water',
  // Greywater is plumbing off the house, laid with the rest of the water reticulation — and it
  // must be in the ground before the basins it feeds are worth digging.
  greywater: 'access_water',
  swale: 'earthworks',
  drip: 'beds',
  fence: 'beds',
  windbreak: 'perennials',
};

// ── Rainfall season ──────────────────────────────────────────────────────────────────────────
// Planting is the one phase whose timing is set by the sky, not by the sequence — "plant into dry
// soil" is the classic way to lose a year of trees. site.biome carries the biome NAME (see
// app/design/page.tsx: `biome: locationData.biome?.name`), and lib/biome.ts already holds the
// authoritative rainfallPattern per biome, so the season is a lookup, not a guess. An unknown
// biome degrades to generic wording rather than asserting a month it cannot know.
function rainWindow(site: PhasingSite | null | undefined): string {
  const name = site?.biome?.trim().toLowerCase();
  const biome = name ? Object.values(BIOMES).find((b) => b.name.toLowerCase() === name) : undefined;
  switch (biome?.rainfallPattern) {
    case 'summer':
      return 'at the onset of the summer rains (Oct–Nov)';
    case 'winter':
      return 'at the break of the winter rains (Apr–May)';
    case 'year-round':
      return 'into the main rains, not into a dry spell';
    default:
      return 'at the onset of the reliable rains';
  }
}

function rainfallMm(site: PhasingSite | null | undefined): number | null {
  const mm = site?.rainfallMm;
  return typeof mm === 'number' && Number.isFinite(mm) && mm > 0 ? Math.round(mm) : null;
}

// ── Inventory ────────────────────────────────────────────────────────────────────────────────

interface Inventory {
  /** Ids (items + lines) per phase, in a stable order. */
  ids: Record<PhaseKey, string[]>;
  /** How many objects each phase builds — drives both "emit?" and the week range. */
  units: Record<PhaseKey, number>;
  /** defId → count placed. */
  counts: Record<string, number>;
  lineKinds: Set<LineShape['kind']>;
  total: number;
}

function emptyByPhase<T>(make: () => T): Record<PhaseKey, T> {
  return {
    setout: make(),
    access_water: make(),
    earthworks: make(),
    beds: make(),
    perennials: make(),
    livestock: make(),
  };
}

function isNormalisedPoint(point: [number, number]): boolean {
  return Number.isFinite(point[0])
    && Number.isFinite(point[1])
    && point[0] >= 0
    && point[0] <= 1
    && point[1] >= 0
    && point[1] <= 1;
}

function isBuildableItem(item: PlacedItem): boolean {
  return isNormalisedPoint([item.x, item.y]);
}

function isBuildableLine(line: LineShape): boolean {
  if (line.points.length < 2 || !line.points.every(isNormalisedPoint)) return false;
  const [x0, y0] = line.points[0];
  return line.points.some(([x, y]) => x !== x0 || y !== y0);
}

function takeInventory(state: DesignCanvasState): Inventory {
  const ids = emptyByPhase<string[]>(() => []);
  const counts: Record<string, number> = {};
  const lineKinds = new Set<LineShape['kind']>();

  // Sorted by id so the plan is byte-identical across renders regardless of placement order —
  // determinism is the product promise (same design in, same sheet out).
  for (const item of [...state.items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isBuildableItem(item)) continue;
    const key = phaseForItem(item);
    if (!key) continue;
    ids[key].push(item.id);
    counts[item.defId] = (counts[item.defId] ?? 0) + 1;
  }
  for (const line of [...state.lines].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isBuildableLine(line)) continue; // a half-drawn or malformed line is not work
    lineKinds.add(line.kind);
    ids[PHASE_BY_LINE_KIND[line.kind]].push(line.id);
  }

  const units = emptyByPhase<number>(() => 0);
  let total = 0;
  for (const key of PHASE_ORDER) {
    units[key] = ids[key].length;
    total += units[key];
  }
  return { ids, units, counts, lineKinds, total };
}

const has = (inv: Inventory, ...defIds: string[]) => defIds.some((id) => (inv.counts[id] ?? 0) > 0);
const hasAny = (inv: Inventory, prefix: string) =>
  Object.keys(inv.counts).some((id) => id.startsWith(prefix) && inv.counts[id] > 0);
const hasWaterInfrastructure = (inv: Inventory) =>
  inv.lineKinds.has('pipe') ||
  inv.lineKinds.has('greywater') ||
  hasAny(inv, 'jojo_') ||
  has(
    inv,
    'rain_barrel',
    'borehole',
    'tap_point',
    'pump_filter',
    'first_flush',
    'water_trough',
    'water_trough2',
  );

// ── Week ranges ──────────────────────────────────────────────────────────────────────────────
// Durations scale with the amount of work — a plan with one tank and a plan with four tanks, a
// pump and 60 m of trench are not the same fortnight. Each phase has a floor (its irreducible
// set-up) plus a per-unit increment, capped so a big design does not produce a comic 40-week bar.
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function durationWeeks(key: PhaseKey, inv: Inventory): number {
  const u = inv.units[key];
  switch (key) {
    case 'setout':
      return inv.total > 30 ? 2 : 1; // pegging out a big design is genuinely a second week
    case 'access_water':
      return clamp(2 + Math.ceil(u / 4), 2, 6);
    case 'earthworks':
      return clamp(2 + Math.ceil(u / 3), 2, 8); // slowest per unit: machinery, levels, weather
    case 'beds':
      return clamp(2 + Math.ceil(u / 5), 2, 8);
    case 'perennials':
      return clamp(3 + Math.ceil(u / 6), 3, 10);
    case 'livestock':
      return clamp(3 + Math.ceil(u / 3), 3, 6);
  }
}

/** Phases overlap by a week: the hold point gates the END of a phase, so the next phase's early
 *  work (setting out, ordering, delivery) legitimately starts while the last one is being snagged.
 *  This is what the reference plan set does (2: 1–4, 3: 3–6, 4: 4–8) rather than a strict relay. */
function nextStart(prevStart: number, prevEnd: number): number {
  return Math.max(prevEnd - 1, prevStart + 1);
}

function formatWeeks(start: number, end: number): string {
  // "Week 0–1" reads right for a single week; "Weeks 3–6" for a span. Mirrors the reference sheet.
  return `${end - start <= 1 ? 'Week' : 'Weeks'} ${start}–${end}`;
}

/** The last phase is open-ended — livestock arrive and the site is run in, it does not "finish".
 *  Months read better than a week number that far out (the reference says "Month 3+"). */
function formatOpenEnd(start: number): string {
  return `Month ${Math.max(2, Math.round(start / 4.34))}+`;
}

// ── Tasks ────────────────────────────────────────────────────────────────────────────────────
// Every bullet below is imperative, and is emitted only when the thing it talks about is actually
// on the plan. `pick` keeps the always-true bullets first so trimming to 3 never strips the spine
// of the phase — the sheet renderer may show fewer bullets than we generate (see buildPhasePlan's
// contract), so ORDER here is a priority order.
function pick(...bullets: Array<string | false | null | undefined>): string[] {
  return bullets.filter((b): b is string => typeof b === 'string' && b.length > 0);
}

function tasksFor(
  key: PhaseKey,
  inv: Inventory,
  refLayers: PhasingRefLayers,
  site: PhasingSite | null | undefined,
): string[] {
  const mm = rainfallMm(site);
  switch (key) {
    case 'setout':
      return pick(
        refLayers.boundary.length >= 3 &&
          'Walk the boundary and peg every corner against the traced line before anything else.',
        'Set out each element with pegs and string at its plan size — check the spacing on the ground, not on the screen.',
        'Confirm buried services (water, power, septic) with the owner and mark them on the ground.',
        refLayers.house.length >= 3 && 'Mark a no-dig strip around the house footings and the tank stand.',
        refLayers.driveway.length >= 2 && 'Agree where materials and spoil may be stacked — not on the driveway.',
      );
    case 'access_water':
      return pick(
        inv.lineKinds.has('path') && 'Cut and compact the paths so every work area is reachable with a barrow.',
        hasAny(inv, 'jojo_') || has(inv, 'rain_barrel')
          ? 'Set every tank on a level, compacted base before you plumb it — a full tank cannot be moved.'
          : null,
        inv.lineKinds.has('pipe') &&
          'Trench and lay the main line, keeping it clear of the driveway wheel tracks and future tree pits.',
        has(inv, 'borehole', 'tap_point') && 'Connect the supply point and prove flow before anything downstream is built.',
        has(inv, 'first_flush') && 'Fit the first-flush diverter and screen every tank inlet against light and mosquitoes.',
        has(inv, 'pump_filter') && 'Install the pump and filter and label the isolating valve.',
        has(inv, 'gate') && 'Hang the gates and check they swing clear of the finished path level.',
      );
    case 'earthworks':
      return pick(
        'Peg the contour with an A-frame or water level before you cut anything — eyeballed levels are how swales become drains.',
        inv.lineKinds.has('swale') && 'Dig the swales on true contour and spread the spoil onto the downhill berm.',
        has(inv, 'berm', 'terrace') &&
          'Build the bank in compacted layers and plant it the same week — a finished bank left bare is what washes away.',
        has(inv, 'vetiver_row') && 'Plant the vetiver into the bank as it is finished, tight enough to knit into a hedge.',
        has(inv, 'tree_basin', 'greywater_basin', 'infiltration_basin', 'half_moon') &&
          'Shape every basin to HOLD water — rim level, floor flat, and the inflow rougher than the outflow.',
        has(inv, 'pond_small', 'dam') && 'Cut the spillway before the wall goes up, never after.',
        has(inv, 'mulch_bank') && 'Sheet-mulch and compost the growing ground now, while machinery can still reach it.',
      );
    case 'beds':
      return pick(
        has(inv, 'raised_bed', 'veg_bed', 'keyhole_bed', 'herb_spiral', 'banana_circle') &&
          'Build the beds at their plan size and fill with compost — no bed wider than two arm-lengths.',
        inv.lineKinds.has('drip') &&
          'Run the drip from the tank or manifold and pressure-test every emitter BEFORE any mulch goes over the line.',
        has(inv, 'shed', 'greenhouse_tunnel', 'shade_house') && 'Erect the structures on a level, drained pad.',
        has(inv, 'compost_bay', 'worm_farm') && 'Site the compost bays within barrow distance of both the kitchen and the beds.',
        inv.lineKinds.has('fence') && 'Strain the internal fences now — they are far harder to run once the beds are planted.',
        has(inv, 'nursery_table') && 'Set up the nursery first: it has to be growing before the planting phase needs it.',
      );
    case 'perennials':
      return pick(
        `Plant ${rainWindow(site)} — never into dry soil.`,
        'Dig the tree pits at the pegged positions and backfill with compost and topsoil.',
        'Mulch every tree thick and wide, and keep the mulch off the stem.',
        inv.lineKinds.has('windbreak') && 'Plant the windbreak first and let it get away before the crop trees go in behind it.',
        has(inv, 'spekboom_hedge', 'pollinator_strip') && 'Plant the hedge and strip lines once the canopy trees are pegged and in.',
        'Stake and guard the young trees against wind and browsing.',
        mm !== null && mm < 500
          ? `Water in by hand every tree at planting — ~${mm} mm a year will not establish a tree on its own.`
          : mm !== null && `Plan the first two summers' watering: ~${mm} mm a year does not establish trees unaided.`,
      );
    case 'livestock': {
      // This phase is a bookend, so it is emitted even on a design with no animals — in which case
      // it is commissioning only, and must not talk about stock that is not coming.
      const stock = inv.units.livestock > 0;
      return pick(
        stock && 'Finish the housing — predator-proof mesh, shade and dry bedding — before any animal arrives.',
        stock &&
          has(inv, 'water_trough', 'water_trough2') &&
          'Prove water to every trough and check it daily for the first week.',
        stock && 'Bring stock in small numbers first and watch the ground for over-grazing.',
        stock && has(inv, 'beehive') && 'Face the hives away from paths and the house door.',
        !stock && 'Snag the build against this sheet: every hold point signed, every leak found and fixed.',
        'Walk the owner through the valves, the drip zones and every hold point on this sheet.',
        'Photograph each element against this sheet as the as-built record.',
      );
    }
  }
}

// ── Hold points ──────────────────────────────────────────────────────────────────────────────
// A hold point is a GATE, not a reminder: work stops until it passes. Each one is placed where a
// mistake becomes expensive or invisible — after backfilling, after mulching, after stock arrive.
// The letter is assigned at emit time from the phase's position, so a plan that skips earthworks
// still reads A, B, C, D with no gap.
const HOLD_POINT: Record<PhaseKey, string> = {
  setout:
    'Boundary pegs, marked services and the set-out agreed with the owner on site before any ground is broken.',
  access_water: 'Pressure and leak test the main line before backfilling any trench.',
  earthworks: 'Levels re-checked along every swale and bank, and the bank planted, before the first big rain.',
  beds: 'Run the drip at working pressure and check every emitter before mulching over the lines.',
  perennials: 'Water tested and reaching every planting pit before the first tree goes in the ground.',
  livestock: 'Fences, shade and water proven for a full week before stock arrive.',
};

function holdLetter(n: number): string {
  return String.fromCharCode(64 + n); // 1 → 'A'
}

function holdPointFor(key: PhaseKey, inv: Inventory): string {
  // Commissioning-only variant: with no stock coming, the gate is the as-built record, not a fence.
  if (key === 'livestock' && inv.units.livestock === 0)
    return 'Every earlier hold point signed off and the as-built record handed over before the job is closed.';
  return HOLD_POINT[key];
}

// ── Titles ───────────────────────────────────────────────────────────────────────────────────
function titleFor(key: PhaseKey, inv: Inventory): string {
  switch (key) {
    case 'setout':
      return 'Verify, Set Out & Make Safe';
    case 'access_water': {
      // Name only what is there: "Safe Access & Water Spine" on a plan with no paths is a lie.
      const access = inv.lineKinds.has('path') || has(inv, 'gate');
      const water = inv.lineKinds.has('pipe') || hasAny(inv, 'jojo_') ||
        has(inv, 'rain_barrel', 'borehole', 'tap_point', 'pump_filter', 'first_flush', 'water_trough');
      if (access && water) return 'Safe Access & Water Spine';
      return access ? 'Safe Access' : 'Water Spine';
    }
    case 'earthworks':
      return has(inv, 'vetiver_row') ? 'Vetiver Bank & Soil Building' : 'Earthworks & Soil Building';
    case 'beds':
      return 'Beds, Drip & Working Infrastructure';
    case 'perennials':
      return 'Perennials & Guilds';
    case 'livestock':
      return inv.units.livestock > 0 ? 'Small Livestock & Commissioning' : 'Commissioning & Handover';
  }
}

// ── Critical order ───────────────────────────────────────────────────────────────────────────
// The Scale of Permanence made concrete for THIS design: short nouns, in build order, naming only
// what exists. This is the list a farmer reads when they are about to do things out of order.
function buildCriticalOrder(inv: Inventory, refLayers: PhasingRefLayers): string[] {
  const out: string[] = ['Survey & set out'];
  if (inv.lineKinds.has('path') || has(inv, 'gate') || refLayers.driveway.length >= 2) out.push('Safe access');
  if (inv.lineKinds.has('pipe') || hasAny(inv, 'jojo_') || has(inv, 'rain_barrel', 'borehole', 'tap_point', 'pump_filter'))
    out.push('Main water line');
  if (inv.lineKinds.has('swale')) out.push('Swales on contour');
  if (has(inv, 'berm', 'terrace', 'vetiver_row')) out.push(has(inv, 'vetiver_row') ? 'Bank & vetiver' : 'Bank');
  if (has(inv, 'pond_small', 'dam', 'infiltration_basin', 'greywater_basin', 'tree_basin', 'half_moon'))
    out.push('Basins & storage');
  if (inv.units.beds > 0) out.push(inv.lineKinds.has('drip') ? 'Beds & drip' : 'Beds & structures');
  if (inv.units.perennials > 0) out.push('Trees & guilds');
  if (inv.units.livestock > 0) out.push('Livestock');
  out.push('Commissioning & handover');
  return out;
}

// ── Site rules ───────────────────────────────────────────────────────────────────────────────
// Constraints, not tips: each one is a thing that must NOT happen, derived from something the
// design actually contains. Nothing generic — a rule about a bank on a site with no bank is noise,
// and noise is what makes a rules box get ignored.
function buildSiteRules(inv: Inventory, refLayers: PhasingRefLayers, site: PhasingSite | null | undefined): string[] {
  const rules: string[] = [];
  const mm = rainfallMm(site);

  if (refLayers.driveway.length >= 2)
    rules.push('Keep the driveway open at all times — no spoil, pipe or materials stored on it.');
  if (refLayers.house.length >= 3) rules.push('No excavation within 1 m of the house footings or a tank stand.');
  if (has(inv, 'terrace', 'berm'))
    rules.push('Never excavate the FACE of a bank or terrace — cut from above, never undercut it.');
  if (inv.lineKinds.has('pipe') && refLayers.driveway.length >= 2)
    rules.push('Sleeve any pipe that crosses the driveway or a path before it is backfilled.');
  if (hasWaterInfrastructure(inv))
    rules.push('Test the water before it goes onto food beds or into a trough.');
  if (has(inv, 'greywater_basin'))
    rules.push('Greywater goes to basins and fruit trees only — never onto leaf crops.');
  if (inv.lineKinds.has('swale') || has(inv, 'pond_small', 'dam', 'infiltration_basin', 'half_moon'))
    rules.push('Barrier or backfill every open excavation at the end of each working day.');
  if (inv.units.livestock > 0)
    rules.push('No animals on site until fences, shade and water are signed off.');
  if (refLayers.boundary.length >= 3)
    rules.push('Work inside the pegged boundary — agree anything on the line with the neighbour first.');
  const plantingPlanned = inv.units.beds > 0 || inv.units.perennials > 0;
  if (mm !== null && mm < 500 && plantingPlanned) {
    const prerequisites = [
      hasWaterInfrastructure(inv) ? 'water spine' : null,
      inv.units.earthworks > 0 ? 'earthworks' : null,
    ].filter((part): part is string => part !== null);
    rules.push(
      prerequisites.length
        ? `Water is the constraint here (~${mm} mm/yr): ${prerequisites.join(' and ')} finish before planting starts.`
        : `Water is the constraint here (~${mm} mm/yr): confirm an establishment-water source before planting starts.`,
    );
  }
  rules.push('Confirm every dimension on site — the plan is the intent, the ground is the truth.');
  return rules;
}

// ── The engine ───────────────────────────────────────────────────────────────────────────────

/** Build the implementation & phasing plan for a design.
 *
 *  Contract:
 *   • Pure and deterministic — same (state, refLayers, site) → identical PhasePlan, always.
 *   • Returns NO phases when nothing has been placed. There is nothing to phase on an empty
 *     design, and a two-bookend sheet ("set out, then hand over") would be a worse answer than
 *     the caller's "draw your design first" refusal. Callers should treat phases.length === 0 as
 *     "no content on this layer" (see layerContentCount in DesignGlossy).
 *   • `tasks` are a PRIORITY order, longest-first-truthiest-first: a renderer short of room should
 *     take the first N, never a sample.
 */
export function buildPhasePlan(
  state: DesignCanvasState,
  refLayers: PhasingRefLayers,
  site?: PhasingSite | null,
): PhasePlan {
  const inv = takeInventory(state);
  // Nothing placed → nothing to phase. A traced boundary alone is a site, not a build.
  if (inv.total === 0) return { phases: [], criticalOrder: [], siteRules: [] };

  const phases: Phase[] = [];
  let start = 0;
  let end = 0;

  for (const key of PHASE_ORDER) {
    // The two bookends are gates, not element phases: every build starts by pegging out the plan
    // and ends by proving and handing over what was built, whatever is on it. The four middle
    // phases are strictly content-driven — no earthworks placed, no earthworks phase.
    const isBookend = key === 'setout' || key === 'livestock';
    if (!isBookend && inv.units[key] === 0) continue;

    const n = phases.length + 1;
    const d = durationWeeks(key, inv);
    start = n === 1 ? 0 : nextStart(start, end);
    end = start + d;
    const isLast = key === 'livestock'; // always the final phase in PHASE_ORDER
    phases.push({
      n,
      key,
      title: titleFor(key, inv),
      colour: PHASE_COLOUR[key],
      weekRange: isLast ? formatOpenEnd(start) : formatWeeks(start, end),
      weekStart: start,
      weekEnd: end,
      tasks: tasksFor(key, inv, refLayers, site),
      holdPoint: `Hold Point ${holdLetter(n)}: ${holdPointFor(key, inv)}`,
      itemIds: inv.ids[key],
    });
  }

  return { phases, criticalOrder: buildCriticalOrder(inv, refLayers), siteRules: buildSiteRules(inv, refLayers, site) };
}
