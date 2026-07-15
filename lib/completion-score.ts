// Pure scoring function for the "how complete is this site" gamified score
// shown on the report dashboard. No I/O — callers load whatever state they
// have (saved places, survey, design canvas, crop plan) and pass in plain
// booleans/counts. See CompletionScore.tsx for the matching UI.

/** Stage keys, in the order they appear on a farmer's journey through the app. */
export type CompletionStepKey =
  | 'located'
  | 'boundary'
  | 'survey'
  | 'design'
  | 'cropPlan';

export interface CompletionStep {
  key: CompletionStepKey;
  label: string;
  /** true once the step is fully done (pct === 100) */
  done: boolean;
  /** 0-100, this step's own completion — independent of its weight in the overall score */
  pct: number;
}

export interface CompletionScoreResult {
  /** 0-100 weighted overall completion across all 5 steps */
  overallPct: number;
  steps: CompletionStep[];
}

/** The furthest lifecycle stage a site has reached — drives what the report shows
 *  and the guided "next step". Ordered: scout → saved → traced → designed → planned. */
export type SiteStage = 'scout' | 'saved' | 'traced' | 'designed' | 'planned';

/**
 * Already-loaded inputs the caller must gather before calling
 * {@link computeCompletionScore}. Every field is a plain boolean or count —
 * this function does no localStorage/Firestore reads itself, so it stays
 * trivially testable and the wiring at the call site is a one-line mapping
 * from each lib's loaded state.
 */
export interface CompletionScoreInputs {
  /** A site/place has been saved or pinned (e.g. saved-places.ts loadPlaces().length > 0). */
  hasSite: boolean;

  /** Number of vertices in the traced farm boundary polygon, if any (0 if none traced).
   *  Source: design-studio DesignLayer with layerType 'property_boundary', or a raw
   *  farm-shapes polygon from map-sync — count its ring's points. */
  boundaryPointCount: number;

  /** Count of SiteSurvey fields the farmer has actually filled in (non-empty / non-default). */
  surveyFilledFields: number;
  /** Total number of fields tracked for survey completeness (denominator for the ratio above). */
  surveyTotalFields: number;

  /** Number of ZoneShape entries placed in the Design Studio canvas (design-canvas.ts). */
  zoneCount: number;
  /** Number of PlacedItem entries (elements/icons) placed in the Design Studio canvas. */
  elementCount: number;

  /** A crop plan has at least one planting saved (crop-plan.ts loadCropPlan().plantings.length > 0). */
  hasCropPlan: boolean;
}

// Weights reflect how much each stage unlocks downstream value, not how long
// it takes the farmer to do it. Locating a site and tracing a boundary are
// prerequisites for everything else, so they're weighted lightly on their
// own; survey + design + crop plan are the substantive planning work and
// carry most of the score. Weights sum to 100.
const WEIGHTS: Record<CompletionStepKey, number> = {
  located: 10,
  boundary: 15,
  survey: 25,
  design: 25,
  cropPlan: 25,
};

const LABELS: Record<CompletionStepKey, string> = {
  located: 'Site located',
  boundary: 'Boundary traced',
  survey: 'Site survey filled',
  design: 'Design done',
  cropPlan: 'Crop plan done',
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Compute the 5-stage completion score for a site. Pure function — pass in
 * already-loaded booleans/counts, get back an overall % and a per-step
 * breakdown suitable for rendering directly.
 */
export function computeCompletionScore(inputs: CompletionScoreInputs): CompletionScoreResult {
  const locatedPct = inputs.hasSite ? 100 : 0;

  // A boundary needs at least 3 points to be a real polygon; treat 1-2 as a
  // partial start (e.g. the farmer began tracing but didn't close the shape).
  const boundaryPct = inputs.boundaryPointCount >= 3
    ? 100
    : clampPct((inputs.boundaryPointCount / 3) * 100);

  const surveyPct = inputs.surveyTotalFields > 0
    ? clampPct((inputs.surveyFilledFields / inputs.surveyTotalFields) * 100)
    : 0;

  // Design is "done" once there's at least one zone AND one placed element —
  // a bare zone ring with nothing planted, or a stray icon with no zones,
  // both read as partial rather than complete.
  const hasZones = inputs.zoneCount > 0;
  const hasElements = inputs.elementCount > 0;
  const designPct = hasZones && hasElements
    ? 100
    : (hasZones || hasElements ? 50 : 0);

  const cropPlanPct = inputs.hasCropPlan ? 100 : 0;

  const steps: CompletionStep[] = [
    { key: 'located', label: LABELS.located, done: locatedPct === 100, pct: locatedPct },
    { key: 'boundary', label: LABELS.boundary, done: boundaryPct === 100, pct: boundaryPct },
    { key: 'survey', label: LABELS.survey, done: surveyPct === 100, pct: surveyPct },
    { key: 'design', label: LABELS.design, done: designPct === 100, pct: designPct },
    { key: 'cropPlan', label: LABELS.cropPlan, done: cropPlanPct === 100, pct: cropPlanPct },
  ];

  const totalWeight = steps.reduce((sum, s) => sum + WEIGHTS[s.key], 0);
  const weightedSum = steps.reduce((sum, s) => sum + WEIGHTS[s.key] * s.pct, 0);
  const overallPct = totalWeight > 0 ? clampPct(weightedSum / totalWeight) : 0;

  return { overallPct, steps };
}

/**
 * The furthest lifecycle stage a site has reached, from its completion inputs.
 * Used to gate what the report shows (a fresh scouting pin is `scout` and must not
 * display another site's parcels/weather/crop plan) and to drive the guided next
 * step. Returns the MAX stage reached — because a farmer can fill the survey before
 * tracing, card visibility should still key off the specific input where it matters
 * (e.g. only show "Your land" when a boundary is actually traced near this site).
 */
export function deriveSiteStage(inputs: CompletionScoreInputs): SiteStage {
  const hasDesign = inputs.zoneCount > 0 || inputs.elementCount > 0;
  if (inputs.hasCropPlan && hasDesign) return 'planned';
  if (hasDesign || inputs.surveyFilledFields > 0) return 'designed';
  if (inputs.boundaryPointCount >= 3) return 'traced';
  if (inputs.hasSite) return 'saved';
  return 'scout';
}
