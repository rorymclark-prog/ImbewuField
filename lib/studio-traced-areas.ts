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

/**
 * Plan area of the main building's roof as traced in the Design Studio, in m². Zero when no house
 * ring exists — the caller then keeps whatever it had, so an empty Studio never erases a figure.
 *
 * Plan area is the right quantity: rain falls vertically, so a pitched roof harvests exactly its
 * footprint. This is the same ring lib/water-system.ts measures for the Water sheet's harvest
 * block, which is the point — the two numbers are now the same number.
 */
export function studioRoofAreaM2(state: DesignCanvasState | null | undefined): number {
  if (!state) return 0;
  const ring = largestStudioRing(state, 'house');
  if (!ring) return 0;
  const { wMetres, hMetres } = metreExtent(state);
  if (!(wMetres > 0) || !(hMetres > 0)) return 0;
  const area = ringAreaM2(ring, wMetres, hMetres);
  return Number.isFinite(area) && area > 0 ? area : 0;
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
