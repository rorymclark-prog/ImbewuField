'use client';

// ONE set of beds for the whole Finance screen.
//
// THE BUG THIS EXISTS TO CLOSE. The Finance page ran two bed authorities side by
// side, in adjacent cards:
//
//   FarmMetrics           bedsFromDesignCanvas(<main site's Design Studio canvas>)
//   HarvestReconciliation bedsFromDesign(loadFacilitatorState())   ← the LEGACY canvas
//
// On the sample farm that is 128 m² against 44 m², so the two cards reported
// production densities of 0.641 and 1.865 kg/m² — a factor of three — with no
// hint on screen that they were measuring different land. Neither number was
// wrong for the beds it was given; the screen was wrong for asking two different
// questions and printing both answers as facts about one farm.
//
// The fix is not "make HarvestReconciliation call the other function": it is to
// make the question have one answer on this screen. Everything on /finances now
// takes its beds from here.
//
// THE ORDER MATTERS AND MIRRORS THE CROP PLANNER. app/facilitator/crops/page.tsx
// prefers the Design Studio canvas and falls back to the legacy facilitator
// design, so a farmer's finance figures describe the same land their crop plan
// does. Any other order would let the two screens disagree again, one layer down.

import { useEffect, useState } from 'react';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { CROP_PLAN_CHANGED_EVENT, loadCropPlan } from '@/lib/crop-plan';
import { DESIGN_CANVAS_CHANGED_EVENT, loadCanvasState } from '@/lib/design-canvas';
import { bedsFromDesignCanvas, canvasSiteIdForPlace } from '@/lib/design-beds-bridge';
import { bedsFromDesign } from '@/lib/harvest-reconciliation';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';

/**
 * Where the beds came from. A screen can print this, and more importantly a
 * reader of a bug report can tell which land a figure was about.
 *  - 'studio'      the main saved place's Design Studio canvas (the current app)
 *  - 'facilitator' the legacy facilitator canvas (older designs still in use)
 *  - 'none'        no mapped growing area anywhere
 */
export type FinanceBedOrigin = 'studio' | 'facilitator' | 'none';

export interface FinancePlanSource {
  beds: PlanBed[];
  origin: FinanceBedOrigin;
  plantings: Planting[];
  /** Total mapped growing area, m². Zero when origin is 'none'. */
  areaM2: number;
  /** False until the first client-side read has happened — do not print a zero before this. */
  loaded: boolean;
}

/**
 * Pure half: choose between the two candidate bed sets. Separated from the
 * loading so the precedence itself is testable without storage or a DOM.
 *
 * A LEGACY SET OF EXACTLY ONE VIRTUAL BED IS NOT A DESIGN. bedsFromDesign()
 * returns a single 10 m² placeholder when a facilitator design has no beds at
 * all, which is right for the planner (you can still sketch a plan on it) and
 * wrong here: dividing real harvest kilograms by an imaginary 10 m² prints a
 * density for land that does not exist.
 */
export function chooseFinanceBeds(
  studioBeds: readonly PlanBed[],
  legacyBeds: readonly PlanBed[],
): { beds: PlanBed[]; origin: FinanceBedOrigin } {
  if (studioBeds.length > 0) return { beds: [...studioBeds], origin: 'studio' };
  const realLegacy = legacyBeds.filter((b) => !b.id.startsWith('virtual-bed'));
  if (realLegacy.length > 0) return { beds: realLegacy, origin: 'facilitator' };
  return { beds: [], origin: 'none' };
}

/** Read both candidate sets and choose. Safe to call on the client only. */
export function loadFinanceBeds(): { beds: PlanBed[]; origin: FinanceBedOrigin } {
  let studioBeds: PlanBed[] = [];
  try {
    const main = resolveMainSite(loadPlaces());
    if (main) studioBeds = bedsFromDesignCanvas(loadCanvasState(canvasSiteIdForPlace(main)));
  } catch { /* an unreadable canvas must not take the legacy fallback down with it */ }

  let legacyBeds: PlanBed[] = [];
  try {
    legacyBeds = bedsFromDesign(loadFacilitatorState());
  } catch { /* likewise */ }

  return chooseFinanceBeds(studioBeds, legacyBeds);
}

const areaOf = (beds: readonly PlanBed[]): number => beds.reduce((sum, b) => sum + (b.areaM2 || 0), 0);

/**
 * The hook every Finance card uses. Re-reads on the same two events the cards
 * used to listen to individually, so editing a bed in the Studio still updates
 * the whole screen at once — and now updates all of it to the same thing.
 */
export function useFinancePlanSource(): FinancePlanSource {
  const [state, setState] = useState<FinancePlanSource>({
    beds: [], origin: 'none', plantings: [], areaM2: 0, loaded: false,
  });

  useEffect(() => {
    const refresh = () => {
      const { beds, origin } = loadFinanceBeds();
      let plantings: Planting[] = [];
      try {
        plantings = loadCropPlan().plantings;
      } catch { /* a corrupt plan still leaves the bed figures usable */ }
      setState({ beds, origin, plantings, areaM2: areaOf(beds), loaded: true });
    };
    refresh();
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    };
  }, []);

  return state;
}
