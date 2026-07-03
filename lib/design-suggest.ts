// Design Studio — Tier-1 auto-suggest generators.
//
// Pure, deterministic, instant geometry-driven suggestions for the four wizard steps
// (zones / water / structures / planting). No React, no network, no randomness.
// Every generator returns DetectSuggestion[] (status:'pending', from lib/design-canvas.ts)
// and every point/ring produced here is guaranteed inside the plot boundary.

import { newId, pointInRing, type DetectSuggestion } from '@/lib/design-canvas';

type Ring = Array<[number, number]>;
type Pt = [number, number];

// ── Small geometry helpers ────────────────────────────────────────────────────

function centroid(ring: Ring): Pt {
  if (ring.length === 0) return [0.5, 0.5];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

// Scales every vertex of `ring` toward `centre` by factor f (0 = at centre, 1 = unchanged).
function scaleRingToward(ring: Ring, centre: Pt, f: number): Ring {
  return ring.map(([x, y]) => [centre[0] + f * (x - centre[0]), centre[1] + f * (y - centre[1])]);
}

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

// Nudge a point toward `target` until it lands inside `boundary` (or give up after a few steps).
function nudgeInside(pt: Pt, target: Pt, boundary: Ring): Pt {
  if (boundary.length < 3 || pointInRing(pt, boundary)) return pt;
  let cur: Pt = pt;
  for (let i = 1; i <= 8; i++) {
    const f = i / 8;
    const candidate: Pt = [cur[0] + (target[0] - cur[0]) * f, cur[1] + (target[1] - cur[1]) * f];
    if (pointInRing(candidate, boundary)) return candidate;
  }
  return target;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Metres → normalised delta helpers (respect the frame's non-square aspect).
function metresToNormFactory(mPerPx: number, imgW: number, imgH: number) {
  return {
    dxNorm: (m: number) => m / (mPerPx * imgW),
    dyNorm: (m: number) => m / (mPerPx * imgH),
  };
}

function houseCentre(boundary: Ring, house: Ring): Pt {
  if (house.length >= 3) return centroid(house);
  const c = centroid(boundary);
  return centroid(scaleRingToward(boundary, c, 0.3));
}

// ── suggestZones ───────────────────────────────────────────────────────────────

export function suggestZones(boundary: Ring, house: Ring): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);

  const out: DetectSuggestion[] = [];

  if (house.length >= 3) {
    out.push({
      id: newId(),
      kind: 'zone',
      zone: 0,
      points: house,
      note: 'The home',
      status: 'pending',
    });
  }

  const bands: Array<{ zone: 1 | 2 | 3 | 4; f: number; note: string }> = [
    { zone: 1, f: 0.3, note: 'Daily-use ring around the home' },
    { zone: 2, f: 0.52, note: 'Veg beds & intensive care' },
    { zone: 3, f: 0.74, note: 'Orchard / food forest' },
    { zone: 4, f: 0.9, note: 'Low-care & support' },
  ];

  for (const band of bands) {
    out.push({
      id: newId(),
      kind: 'zone',
      zone: band.zone,
      points: scaleRingToward(boundary, h, band.f),
      note: band.note,
      status: 'pending',
    });
  }

  out.push({
    id: newId(),
    kind: 'zone',
    zone: 5,
    points: boundary,
    note: 'Wild edge & buffer',
    status: 'pending',
  });

  return out;
}

// ── suggestWater ────────────────────────────────────────────────────────────────

export function suggestWater(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const bCentre = centroid(boundary);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  if (house.length >= 3) {
    // Two house vertices furthest apart.
    let best: [number, number] = [0, 1];
    let bestD = -Infinity;
    for (let i = 0; i < house.length; i++) {
      for (let j = i + 1; j < house.length; j++) {
        const d = dist2(house[i], house[j]);
        if (d > bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    const hc = centroid(house);
    for (const idx of best) {
      const corner = house[idx];
      const dirX = corner[0] - hc[0];
      const dirY = corner[1] - hc[1];
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const outward: Pt = [
        corner[0] + (dirX / len) * dxNorm(2),
        corner[1] + (dirY / len) * dyNorm(2),
      ];
      const pt = nudgeInside(outward, h, boundary);
      out.push({
        id: newId(),
        kind: 'water_tank',
        points: [pt],
        sizeM: 1.8,
        note: '5000 L JoJo at the gutter corner',
        status: 'pending',
      });
    }
  }

  // Greywater basin: 6 m from house centre, away from boundary centroid (toward the more open side).
  {
    let dirX = h[0] - bCentre[0];
    let dirY = h[1] - bCentre[1];
    let len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (!Number.isFinite(len) || len < 1e-9) {
      dirX = 1;
      dirY = 0;
      len = 1;
    }
    const raw: Pt = [h[0] + (dirX / len) * dxNorm(6), h[1] + (dirY / len) * dyNorm(6)];
    const pt = nudgeInside(raw, h, boundary);
    out.push({
      id: newId(),
      kind: 'greywater',
      points: [pt],
      sizeM: 1.5,
      note: 'Greywater mulch basin on the low side',
      status: 'pending',
    });
  }

  // Swale: horizontal chord 60% of the way from h to boundary centroid.
  {
    const targetY = h[1] + (bCentre[1] - h[1]) * 0.6;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const [xi, yi] = boundary[i];
      const [xj, yj] = boundary[j];
      const crosses = (yi <= targetY && yj >= targetY) || (yj <= targetY && yi >= targetY);
      if (crosses && Math.abs(yj - yi) > 1e-9) {
        const t = (targetY - yi) / (yj - yi);
        const x = xi + t * (xj - xi);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX) && maxX > minX) {
      const pts: Ring = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const x = minX + (maxX - minX) * t;
        const raw: Pt = [x, targetY];
        pts.push(nudgeInside(raw, h, boundary));
      }
      out.push({
        id: newId(),
        kind: 'swale',
        points: pts,
        note: 'Swale on contour — check levels on the ground',
        status: 'pending',
      });
    }
  }

  return out;
}

// ── suggestStructures ────────────────────────────────────────────────────────────

export function suggestStructures(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const bCentre = centroid(boundary);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  let dirX = bCentre[0] - h[0];
  let dirY = bCentre[1] - h[1];
  let len = Math.sqrt(dirX * dirX + dirY * dirY);
  if (!Number.isFinite(len) || len < 1e-9) {
    dirX = 1;
    dirY = 0;
    len = 1;
  }
  const ux = dirX / len;
  const uy = dirY / len;

  // Compost: 5 m from house toward boundary centroid.
  const compostRaw: Pt = [h[0] + ux * dxNorm(5), h[1] + uy * dyNorm(5)];
  const compost = nudgeInside(compostRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'compost',
    points: [compost],
    note: 'Compost within a wheelbarrow run of the kitchen',
    status: 'pending',
  });

  // Nursery: 4 m beside the compost point (perpendicular offset).
  const perpX = -uy;
  const perpY = ux;
  const nurseryRaw: Pt = [compost[0] + perpX * dxNorm(4), compost[1] + perpY * dyNorm(4)];
  const nursery = nudgeInside(nurseryRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'nursery',
    points: [nursery],
    note: 'Nursery table beside the compost',
    status: 'pending',
  });

  // Beehive: furthest boundary vertex from h, pulled 8% toward h.
  if (boundary.length >= 3) {
    let far = boundary[0];
    let farD = -Infinity;
    for (const p of boundary) {
      const d = dist2(p, h);
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    const beehiveRaw: Pt = [far[0] + (h[0] - far[0]) * 0.08, far[1] + (h[1] - far[1]) * 0.08];
    const beehive = nudgeInside(beehiveRaw, h, boundary);
    out.push({
      id: newId(),
      kind: 'beehive',
      points: [beehive],
      note: 'Beehive on the quiet far edge — flight path away from paths',
      status: 'pending',
    });
  }

  return out;
}

// ── suggestPlanting ──────────────────────────────────────────────────────────────

export function suggestPlanting(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  // Three trees in an arc SOUTH of the house (y increases southward) — the sun travels
  // through the northern sky here, so a canopy south of the beds can't shade them.
  const dyM = 10;
  for (const dxM of [-8, 0, 8]) {
    const raw: Pt = [h[0] + dxNorm(dxM), h[1] + dyNorm(dyM)];
    const pt = nudgeInside(raw, h, boundary);
    out.push({
      id: newId(),
      kind: 'tree',
      points: [pt],
      sizeM: 5,
      note: 'Fruit tree — south side, sun stays clear of the beds',
      status: 'pending',
    });
  }

  // Veg bed 6 m east of the house.
  const vegRaw: Pt = [h[0] + dxNorm(6), h[1]];
  const veg = nudgeInside(vegRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'veg_bed',
    points: [veg],
    note: 'Veg bed close to the kitchen',
    status: 'pending',
  });

  return out;
}
