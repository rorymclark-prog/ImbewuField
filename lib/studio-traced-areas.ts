// ── Areas the farmer already traced in the Design Studio, in true m² ─────────────────────────
//
// The site questionnaire asks a farmer to type in a roof area it could already measure. The
// auto-fill for that field has existed for a long time (SiteSurveySheet's AutoFillNote), but it
// reads computeTracedAreaTotals, which sums DesignLayer records built ONLY from main-map shapes
// plus the legacy design-studio blob — it has never been able to see DesignCanvasState, where a
// roof traced at /design actually lives. Same farm, same roof: the Water sheet sizes a tank off
// the Studio ring while the questionnaire shows an empty box.
//
// This module closes that gap WITHOUT materialising anything. An area is a pure function of the
// saved ring and the frame's ground scale, so there is no second copy of the geometry to keep in
// step and none of the dual-master clobber risk that writing rings back into the shapes store
// would carry.
//
// Two rules it must not break:
// - The house ring is chosen by base-layers' own largestStudioRing, never a local re-derivation.
//   A second opinion about which ring is "the house" is how one farm ends up with two roof areas.
// - scaleFactor is honoured, because the farmer's own measurement of a known wall outranks the
//   projection — the same precedence design-studio-report.ts and the sheets already use.
//
// PURE MODULE — no react, no window, no storage. The caller loads the state.

import { largestStudioRing } from '@/lib/base-layers';
import { authoritativeHouseFootprints } from '@/lib/house-footprints';
import type { DesignCanvasState } from '@/lib/design-canvas';

/** Shoelace area of a normalised ring, evaluated in metre space. */
function ringAreaM2(points: ReadonlyArray<readonly [number, number]>, wMetres: number, hMetres: number): number {
  if (points.length < 3) return 0;
  let twice = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    twice += (points[j][0] * wMetres) * (points[i][1] * hMetres)
      - (points[i][0] * wMetres) * (points[j][1] * hMetres);
  }
  return Math.abs(twice) / 2;
}

/** Ground metres per normalised unit on each axis, with the farmer's scale correction applied. */
function metreExtent(state: DesignCanvasState): { wMetres: number; hMetres: number } {
  const scale = state.scaleFactor && Number.isFinite(state.scaleFactor) && state.scaleFactor > 0
    ? state.scaleFactor
    : 1;
  const mPerPx = state.frame.mPerPx * scale;
  return { wMetres: state.frame.imgW * mPerPx, hMetres: state.frame.imgH * mPerPx };
}

export interface StudioRoofAreas {
  /** The largest building footprint — the questionnaire's "main building". */
  mainM2: number;
  /** Every OTHER building footprint, summed — the store room, the shed, the barn. */
  secondaryM2: number;
}

/**
 * Plan areas of the buildings' roofs as traced in the Design Studio, in m². Zeros when no house
 * ring exists — the caller then keeps whatever it had, so an empty Studio never erases a figure.
 *
 * Plan area is the right quantity: rain falls vertically, so a pitched roof harvests exactly its
 * footprint. The ring list comes from authoritativeHouseFootprints — the one answer every sheet
 * already agrees on for WHICH rings are buildings — so a farm with a main building and a store
 * room (Ubhejane: two roofs) reports both, split exactly the way the questionnaire asks for them:
 * largest ring is the main building, everything else sums into "Secondary roofs".
 */
export function studioRoofAreasM2(state: DesignCanvasState | null | undefined): StudioRoofAreas {
  if (!state) return { mainM2: 0, secondaryM2: 0 };
  const { wMetres, hMetres } = metreExtent(state);
  if (!(wMetres > 0) || !(hMetres > 0)) return { mainM2: 0, secondaryM2: 0 };
  const areas = authoritativeHouseFootprints(state, { house: [] })
    .map((ring) => ringAreaM2(ring, wMetres, hMetres))
    .filter((area) => Number.isFinite(area) && area > 0)
    .sort((a, b) => b - a);
  if (areas.length === 0) return { mainM2: 0, secondaryM2: 0 };
  const [mainM2, ...rest] = areas;
  return { mainM2, secondaryM2: rest.reduce((sum, area) => sum + area, 0) };
}

/** The main building's roof alone — see studioRoofAreasM2. */
export function studioRoofAreaM2(state: DesignCanvasState | null | undefined): number {
  return studioRoofAreasM2(state).mainM2;
}

export interface StudioBoundaryMetrics {
  areaM2: number;
  perimeterM: number;
  /** Vertex count of the traced ring — what the "Boundary traced" checklist scores. */
  vertexCount: number;
}

/**
 * The Studio-traced property boundary, measured. Null when there is no usable ring, so callers
 * keep their map-shapes answer untouched — this is a second SOURCE for the same facts, never a
 * replacement. The ring choice is base-layers' largestStudioRing, the same rule every sheet
 * renders with; the "Boundary traced" checklist, the "Your land" card and the plan sheets must
 * all be talking about the same ring or the farmer sees three different farms.
 */
export function studioBoundaryMetrics(state: DesignCanvasState | null | undefined): StudioBoundaryMetrics | null {
  if (!state) return null;
  const ring = largestStudioRing(state, 'boundary');
  if (!ring || ring.length < 3) return null;
  const { wMetres, hMetres } = metreExtent(state);
  if (!(wMetres > 0) || !(hMetres > 0)) return null;
  const areaM2 = ringAreaM2(ring, wMetres, hMetres);
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null;
  let perimeterM = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    perimeterM += Math.hypot(
      (ring[i][0] - ring[j][0]) * wMetres,
      (ring[i][1] - ring[j][1]) * hMetres,
    );
  }
  return { areaM2, perimeterM, vertexCount: ring.length };
}

/**
 * What the questionnaire should show for "Main building roof area".
 *
 * Studio wins when it has a ring, matching resolveBaseLayers' precedence everywhere else in the
 * app: a farmer who re-traced their roof in the Studio meant the newer ring, and the sheets have
 * already switched to it. Falling back to the legacy total keeps map-only farmers exactly where
 * they were.
 */
export function surveyRoofAreaM2(studioState: DesignCanvasState | null | undefined, legacyRoofM2: number): number {
  const studio = studioRoofAreaM2(studioState);
  if (studio > 0) return studio;
  return Number.isFinite(legacyRoofM2) && legacyRoofM2 > 0 ? legacyRoofM2 : 0;
}
