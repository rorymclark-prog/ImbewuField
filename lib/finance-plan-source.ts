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
import { CROP_PLAN_CHANGED_EVENT, loadCropPlan, readRawCropPlanReceipt } from '@/lib/crop-plan';
import { DESIGN_CANVAS_CHANGED_EVENT, loadCanvasState } from '@/lib/design-canvas';
import * as canvasReceipts from '@/lib/design-canvas';
import { bedsFromDesignCanvas } from '@/lib/design-beds-bridge';
import { bedsFromDesign } from '@/lib/harvest-reconciliation';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import * as facilitatorReceipts from '@/lib/facilitator-design';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import { coordinateSiteIdForPlace } from '@/lib/international/site-context';
import { resolvePlanningSupport } from '@/lib/international/planning-support';
import { workspacePlanningIdForDesign } from '@/lib/international/workspace-context';
import { hasGrowerCycleMarker, isProvenForeignGrowerCycle } from '@/lib/international/grower-cycle';
import { projectGrowerCycles } from '@/lib/international/grower-cycle-projection';
import { inspectGrowerWorkflowSource } from '@/lib/international/grower-workflow-source';

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
  /** Saved allocations remain usable for measured metrics; forecasts have a separate gate. */
  forecastPlantings?: Planting[];
  forecastAvailable?: boolean;
  forecastReason?: string;
  withheldPlantingCount?: number;
  siteId?: string | null;
  workspaceId?: string | null;
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
function loadFinanceBedContext() {
  const places = loadPlaces();
  const main = resolveMainSite(places);
  let studioBeds: PlanBed[] = [];
  const mappedSources: Array<{ origin: string; beds: PlanBed[] }> = [];
  const visitedSites = new Set<string>();
  try {
    for (const place of places) {
      const siteId = coordinateSiteIdForPlace(place);
      if (!siteId || visitedSites.has(siteId)) continue;
      visitedSites.add(siteId);
      const beds = bedsFromDesignCanvas(loadCanvasState(siteId));
      mappedSources.push({ origin: `studio:${siteId}`, beds });
      if (main && siteId === coordinateSiteIdForPlace(main)) studioBeds = beds;
    }
  } catch { /* an unreadable canvas must not take the legacy fallback down with it */ }

  let legacyBeds: PlanBed[] = [];
  let legacyDesign: ReturnType<typeof loadFacilitatorState> = null;
  try {
    legacyDesign = loadFacilitatorState();
    legacyBeds = bedsFromDesign(legacyDesign);
  } catch { /* likewise */ }

  const chosen = chooseFinanceBeds(studioBeds, legacyBeds);
  const legacySiteId = legacyDesign?.bgSite ? coordinateSiteIdForPlace(legacyDesign.bgSite) ?? 'invalid-mapped-site' : null;
  const siteId = chosen.origin === 'studio' ? main ? coordinateSiteIdForPlace(main) : null
    : legacySiteId;
  const workspaceId = siteId ? null : chosen.origin === 'facilitator'
    ? workspacePlanningIdForDesign(legacyDesign) : 'virtual-bed';
  const sources = [...mappedSources, { origin: `facilitator:${legacySiteId ?? workspacePlanningIdForDesign(legacyDesign) ?? 'invalid-workspace'}`, beds: legacyBeds.filter(bed => !bed.id.startsWith('virtual-bed')) }];
  const ids = new Map<string, string[]>();
  for (const source of sources) for (const bed of source.beds) ids.set(bed.id, [...(ids.get(bed.id) ?? []), source.origin]);
  const ambiguousBedIds = new Set([...ids].filter(([, origins]) => origins.length > 1).map(([id]) => id));
  return { ...chosen, siteId, workspaceId, ambiguousBedIds, places };
}

export function loadFinanceBeds(): { beds: PlanBed[]; origin: FinanceBedOrigin } {
  const { beds, origin } = loadFinanceBedContext();
  return { beds, origin };
}

const areaOf = (beds: readonly PlanBed[]): number => beds.reduce((sum, b) => sum + (b.areaM2 || 0), 0);

/** Foreign exclusion requires the authored source, not a display normalizer's
 * replacement dimensions. Held beds still name current land and must prevent a
 * same-bed foreign claim from escaping the uncertainty gate. */
function financeOwnScope(selected: ReturnType<typeof loadFinanceBedContext>) {
  const currentBedIds = new Set(selected.beds.map(bed => bed.id));
  try {
    const raw = selected.origin === 'studio' && selected.siteId && typeof canvasReceipts.readCanvasSourceReceipt === 'function'
      ? canvasReceipts.readCanvasSourceReceipt(selected.siteId)
      : selected.origin === 'facilitator' && typeof facilitatorReceipts.readFacilitatorSourceReceipt === 'function'
        ? facilitatorReceipts.readFacilitatorSourceReceipt() : null;
    if (!raw || raw.status !== 'ready') return { scope: null, currentBedIds };
    const inspected = inspectGrowerWorkflowSource({ kind: selected.origin === 'studio' ? 'studio-canvas' : 'facilitator-local',
      sourceId: selected.origin === 'studio' ? selected.siteId! : 'local', raw: raw.raw, sourceRevision: raw.revision });
    if (inspected.status !== 'inspected') return { scope: null, currentBedIds };
    for (const bed of inspected.beds) currentBedIds.add(bed.id);
    for (const bed of inspected.heldBeds) currentBedIds.add(bed.bedId);
    return { scope: inspected.scope, currentBedIds };
  } catch { return { scope: null, currentBedIds }; }
}

/** Measured books keep their own records and currencies. Only catalogue-derived
 * future harvests and comparisons depend on a confirmed planning reference. */
export function loadFinancePlanSource(): FinancePlanSource {
  const selected = loadFinanceBedContext();
  const plan = loadCropPlan();
  const support = resolvePlanningSupport({ places: selected.places, siteId: selected.siteId,
    workspaceId: selected.workspaceId, workspaceReferences: plan.workspaceReferences });
  const bedIds = new Set(selected.beds.map(bed => bed.id));
  const selectedPlantings = plan.plantings.filter(planting => planting && bedIds.has(planting.bedId));
  // A global planting has no source-site field. Picking the main site when two
  // designs reuse its bed id would silently lend one farm's plan to another.
  const plantings = selectedPlantings.filter(planting => !selected.ambiguousBedIds.has(planting.bedId));
  const ambiguous = selectedPlantings.length - plantings.length;
  // Filtering by current bed first erased orphan own markers and let the graph
  // describe a nonempty book as empty (or a legacy subset as the complete plan).
  // The shared raw receipt/projector retain every authored occurrence instead.
  const receipt = readRawCropPlanReceipt();
  const raw = receipt.status === 'ready' && receipt.raw && typeof receipt.raw === 'object' && !Array.isArray(receipt.raw)
    ? receipt.raw as { version?: unknown; plantings?: unknown } : null;
  const rows = raw?.version === 1 && Array.isArray(raw.plantings) ? raw.plantings as unknown[] : null;
  const ownHeld = new Set<number>(), unreadableRows = new Set<number>();
  if (rows) {
    const projection = projectGrowerCycles(rows, null);
    const ambiguousRows = new Set(projection.heldRows.filter(row => row.reasons.includes('ambiguous-planting-id')).map(row => row.rowIndex));
    for (const held of projection.heldRows) if (held.rowIndex !== null && held.reasons.includes('invalid-row')) unreadableRows.add(held.rowIndex);
    const hasOwn = rows.some(hasGrowerCycleMarker);
    const proof = hasOwn ? financeOwnScope(selected) : null;
    rows.forEach((row, index) => {
      if (hasGrowerCycleMarker(row) && (!proof || ambiguousRows.has(index)
        || !isProvenForeignGrowerCycle(row, proof.scope, proof.currentBedIds))) ownHeld.add(index);
    });
  }
  const unreadable = rows === null || unreadableRows.size > 0;
  const forecastAvailable = !unreadable && ownHeld.size === 0 && support.allowCataloguePlanning && selected.origin !== 'none' && ambiguous === 0;
  const forecastReason = unreadable ? 'Saved crop-plan evidence is missing or cannot be fully read. Review the saved records before using a finance forecast; recorded picking and sales remain available.'
    : ownHeld.size ? 'Own dated or unresolved crop records need their checked source and estimates. A complete catalogue finance forecast is unavailable; recorded picking and sales remain available. Review the Task Planner.'
      : ambiguous ? 'A saved planting has a bed identifier used by more than one design. Its planning source must be resolved before a finance forecast can be shown.'
    : !support.allowCataloguePlanning ? support.reason
      : selected.origin === 'none' ? 'Finance forecasts need measured growing beds. A virtual reference bed is not mapped land.' : support.reason;
  const relevantCount = rows?.filter((row, index) => ownHeld.has(index) || unreadableRows.has(index)
    || row && typeof row === 'object' && !Array.isArray(row) && bedIds.has((row as { bedId?: string }).bedId!)).length;
  return { beds: selected.beds, origin: selected.origin, plantings, areaM2: areaOf(selected.beds), loaded: true,
    siteId: selected.siteId, workspaceId: selected.workspaceId,
    forecastPlantings: forecastAvailable ? plantings : [], forecastAvailable, forecastReason,
    ...(relevantCount === undefined ? {} : { withheldPlantingCount: forecastAvailable ? 0 : relevantCount }) };
}

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
      setState(loadFinancePlanSource());
    };
    refresh();
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    window.addEventListener('permamap-places-changed', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
      window.removeEventListener('permamap-places-changed', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return state;
}
