'use client';

// Shared site-progress helper — the single source of truth for "how far along is
// THIS site". DataPanel, the NextStepCoach, and the home Continue card all read
// their per-site completion inputs from here, so the ~55 m saved-place / ~2 km
// boundary / surveySiteId conventions can never drift apart (cross-site bleed).
//
// The gather logic is lifted verbatim from the original DataPanel completionInputs
// memo (per-site scoping added in onboarding Phase A). Everything is a synchronous
// localStorage read; the hook subscribes to the same change events the app already
// dispatches so progress refreshes without a reload.

import { useEffect, useState } from 'react';
import { loadPlaces } from '@/lib/saved-places';
import { loadSurvey, type SiteSurvey } from '@/lib/site-survey';
import { loadCanvasState } from '@/lib/design-canvas';
import { loadCropPlan } from '@/lib/crop-plan';
import { readLocalFarmShapes } from '@/lib/map-sync';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import {
  computeCompletionScore,
  deriveSiteStage,
  type CompletionScoreInputs,
  type CompletionScoreResult,
  type SiteStage,
  type CompletionStepKey,
} from '@/lib/completion-score';
import type { LocationData } from '@/lib/types';

export interface Coords { lat: number; lon: number }

export const SURVEY_TOTAL_FIELDS = 10;

/** The 10 survey-completeness checks — same set the report scores against. */
export function surveyFilledCount(s: SiteSurvey | null): number {
  if (!s) return 0;
  const checks = [
    !!s.adults,
    (s.goals?.length ?? 0) > 0,
    (s.waterSource?.length ?? 0) > 0,
    (s.waterStorage?.length ?? 0) > 0,
    s.roofMainM2 != null,
    !!s.landPrepMethod,
    !!s.soilCondition,
    !!s.hasFencing,
    (s.existingCrops?.length ?? 0) > 0,
    !!s.farmingPractice,
  ];
  return checks.filter(Boolean).length;
}

/** A saved place exists within ~55 m (±0.0005°) of these coords — per-site "located". */
export function savedPlaceAtCoords(c: Coords): boolean {
  return loadPlaces().some(
    (p) => Math.abs(p.lat - c.lat) < 0.0005 && Math.abs(p.lon - c.lon) < 0.0005,
  );
}

/** A non-water polygon whose first vertex lies within ~2 km (±0.02°) of these coords.
 *  Drawn shapes are stored user-globally, so this scoping is what stops one farm's
 *  boundary from crediting every site. */
export function boundaryNearCoords(c: Coords): boolean {
  const fc = readLocalFarmShapes();
  return !!fc?.features?.some((f) => {
    if (f.properties?.featureType === 'water') return false;
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon') return false;
    const ring = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates[0]
      : f.geometry.coordinates[0]?.[0];
    const pt = ring?.[0];
    return Array.isArray(pt)
      && Math.abs(pt[0] - c.lon) < 0.02
      && Math.abs(pt[1] - c.lat) < 0.02;
  });
}

/** Pure synchronous gather — every read is localStorage. `assumeSaved` covers the
 *  instant after a Save tap, before loadPlaces() reflects the new place. */
export function gatherSiteInputs(c: Coords, opts?: { assumeSaved?: boolean }): CompletionScoreInputs {
  const surveySiteId = designSiteIdFromLocation({ lat: c.lat, lon: c.lon } as LocationData);
  const survey = loadSurvey(surveySiteId);
  const canvas = loadCanvasState(surveySiteId);
  const zoneCount = canvas?.zones.length ?? 0;
  const elementCount = canvas?.items.length ?? 0;
  return {
    hasSite: !!opts?.assumeSaved || savedPlaceAtCoords(c),
    boundaryPointCount: boundaryNearCoords(c) ? 3 : 0,
    surveyFilledFields: surveyFilledCount(survey),
    surveyTotalFields: SURVEY_TOTAL_FIELDS,
    zoneCount,
    elementCount,
    hasCropPlan: (zoneCount > 0 || elementCount > 0) && loadCropPlan().plantings.length > 0,
  };
}

export interface SiteProgress {
  inputs: CompletionScoreInputs;
  score: CompletionScoreResult;
  stage: SiteStage;
  pct: number;
  /** First step in score.steps with !done, else null (all complete). Keyed off the
   *  STEP list, not the stage — a farmer can survey before tracing, so the next
   *  action is the first genuinely-missing step, whatever order it was reached in. */
  nextStep: CompletionStepKey | null;
}

/** Shared next-step copy keys, so the NextStepCoach and the home Continue card
 *  name each step identically (single source of truth for the guided journey).
 *  'located' is excluded — a scout pin uses the Save-this-site hero, not the coach,
 *  and a resolved main site is by definition already located. */
export const STEP_COPY: Record<
  Exclude<CompletionStepKey, 'located'>,
  { titleKey: string; bodyKey: string; ctaKey: string }
> = {
  boundary: { titleKey: 'coachStepBoundaryTitle', bodyKey: 'coachStepBoundaryBody', ctaKey: 'coachStepBoundaryCta' },
  survey: { titleKey: 'coachStepSurveyTitle', bodyKey: 'coachStepSurveyBody', ctaKey: 'coachStepSurveyCta' },
  design: { titleKey: 'coachStepDesignTitle', bodyKey: 'coachStepDesignBody', ctaKey: 'coachStepDesignCta' },
  cropPlan: { titleKey: 'coachStepCropTitle', bodyKey: 'coachStepCropBody', ctaKey: 'coachStepCropCta' },
};

export function getSiteProgress(c: Coords, opts?: { assumeSaved?: boolean }): SiteProgress {
  const inputs = gatherSiteInputs(c, opts);
  const score = computeCompletionScore(inputs);
  const firstIncomplete = score.steps.find((s) => !s.done);
  return {
    inputs,
    score,
    stage: deriveSiteStage(inputs),
    pct: score.overallPct,
    nextStep: firstIncomplete ? firstIncomplete.key : null,
  };
}

/** The store-change events that can move a site's progress. */
const PROGRESS_EVENTS = [
  'permamap-places-changed',
  'imbewu-surveys-changed',
  'imbewu-design-canvas-changed', // DESIGN_CANVAS_CHANGED_EVENT
  'imbewu-map-state-changed',     // MAP_STATE_EVENT (drawn shapes)
];

/** Recompute on mount + whenever any underlying store changes. Returns null until
 *  mounted (hydration-safe: first client render matches SSR) or when coords is null. */
export function useSiteProgress(c: Coords | null): SiteProgress | null {
  const [progress, setProgress] = useState<SiteProgress | null>(null);
  const lat = c?.lat;
  const lon = c?.lon;
  useEffect(() => {
    if (lat == null || lon == null) { setProgress(null); return; }
    const refresh = () => setProgress(getSiteProgress({ lat, lon }));
    refresh();
    PROGRESS_EVENTS.forEach((ev) => window.addEventListener(ev, refresh));
    return () => PROGRESS_EVENTS.forEach((ev) => window.removeEventListener(ev, refresh));
  }, [lat, lon]);
  return progress;
}

// ── Guided-mode state (the "Guide me" experience) ─────────────────────────────
// Versioned key; any unknown/corrupt shape falls back to defaults so a stale PWA
// client can never get wedged.

export const GUIDED_MODE_KEY = 'imbewu_guided_mode_v1';
export const GUIDED_CHANGED_EVENT = 'imbewu-guided-changed';
const DISMISS_RETIRE_AT = 3;

export interface GuidedModeState {
  enabled: boolean;   // Settings "Guide me" toggle
  dismissals: number; // cumulative coach X-taps
  retired: boolean;   // auto-graduated (all steps done, or DISMISS_RETIRE_AT dismissals)
}

const GUIDED_DEFAULT: GuidedModeState = { enabled: true, dismissals: 0, retired: false };

export function getGuidedState(): GuidedModeState {
  if (typeof window === 'undefined') return GUIDED_DEFAULT;
  try {
    const raw = window.localStorage.getItem(GUIDED_MODE_KEY);
    if (!raw) return GUIDED_DEFAULT;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return GUIDED_DEFAULT;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : GUIDED_DEFAULT.enabled,
      dismissals: Number.isFinite(parsed.dismissals) ? parsed.dismissals : 0,
      retired: typeof parsed.retired === 'boolean' ? parsed.retired : false,
    };
  } catch {
    return GUIDED_DEFAULT;
  }
}

export function setGuidedState(patch: Partial<GuidedModeState>): void {
  if (typeof window === 'undefined') return;
  const next = { ...getGuidedState(), ...patch };
  try {
    window.localStorage.setItem(GUIDED_MODE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(GUIDED_CHANGED_EVENT));
  } catch {
    /* quota / private mode — guidance is best-effort */
  }
}

/** Record a coach dismissal, auto-retiring once the threshold is reached. */
export function recordCoachDismissal(): void {
  const n = getGuidedState().dismissals + 1;
  setGuidedState({ dismissals: n, retired: n >= DISMISS_RETIRE_AT });
}
