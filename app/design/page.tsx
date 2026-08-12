'use client';

// Design Studio — phone-first page where a farmer places elements at true real-world
// scale, draws zone polygons/lines, is guided by an AI advisor, and ends with a strict
// AI "glossy" render of exactly what they built. NEW file only — does not modify any
// existing route or component.

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Position } from 'geojson';
import { ArrowLeft, Compass, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, Image as ImageIcon, Sprout, X, Printer, Lock } from 'lucide-react';
import { CRASH_LOOP_SETTLE_MS, designSafeMode, exitSafeMode, markPageSettled } from '@/lib/crash-loop';
import { loadPlaces, resolveColor, type SavedPlace } from '@/lib/saved-places';

import type { LocationData } from '@/lib/types';
import type { SectorSite } from '@/lib/sector';
import { resolveRegion } from '@/lib/regional-wind';
import { regionalPrevailingPick, type LocalWindObservation } from '@/lib/local-wind';
import {
  designSiteIdFromLocation,
  loadDesignStudioState,
  mergeFarmShapesIntoDesignState,
  type DesignLayer,
} from '@/lib/design-studio';
import { readLocalFarmShapes, MAP_STATE_EVENT } from '@/lib/map-sync';
import { pickWinner, pushDesignCanvas, reconcileDesignCanvas, subscribeDesignCanvasLive } from '@/lib/design-canvas-sync';
import { useAuth } from '@/lib/auth';
import {
  computeCanvasFrame,
  contentCountOf,
  fetchImageAsDataUrl,
  loadCanvasState,
  projectorForFrame,
  saveCanvasNavigation,
  preserveCanvasNavigation,
  saveCanvasState,
  CanvasSaveError,
  migrateStateToFrame,
  newId,
  normaliseRotation,
  DESIGN_CANVAS_CHANGED_EVENT,
  type CanvasFrame,
  type DesignCanvasState,
  type ElementStatus,
  type GroundFeatureKind,
  type PlacedItem,
  type WizardStep,
  type ZoneShape,
  scaledMPerPx,
  zoneOfSelection,
  MIN_SCALE_FACTOR,
  MAX_SCALE_FACTOR,
  clampBaseNudge,
  clampBaseOpacity,
  clampBaseRotation,
  clampBaseScale,
  customBaseMPerPx,
  basePhotoControls,
  activeBaseMPerPx,
  designBaseMode,
  setDesignBaseMode,
  bakeBaseAlignment,
  MAX_BASE_ROTATION,
  MIN_BASE_SCALE,
  MAX_BASE_SCALE,
  DEFAULT_AREA_FILL,
  normaliseAreaFill,
  parseSwaleWidthM,
  type AreaFillStyle,
} from '@/lib/design-canvas';
import { type BaseAlignment } from '@/lib/base-photo-align';
import ChromeHandle from '@/components/design/ChromeHandle';
import {
  BOTTOM_STOPS, TOP_STOPS, CHROME_PREF_KEY, bottomVisibility, topVisibility,
  persistableChrome, restoreStop, DISMISSED_KEY, restoreDismissed,
  type BottomStop, type TopStop, type ChromePref, type DismissibleBand,
} from '@/lib/design-chrome';
import { layoutBedBlock, normaliseBedBlockSpec, MIN_BED_COUNT, MAX_BED_COUNT, type BedBlockPlacement, type BedBlockSpec } from '@/lib/bed-block';
import { dripLinesForBeds, bedDripSummary } from '@/lib/bed-drip';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';
import { tidyOutline, tidyOutlineSummary, type TidyOutlineResult } from '@/lib/tidy-outline';
import { squareUp, squareUpSummary, type SquareUpResult } from '@/lib/square-up';
import { type SnapRingKind } from '@/lib/snap-edges';
import {
  snapSelectedRings,
  snapSelectedRingsSummary,
  type BulkSnapResult,
  type BulkSnapRing,
} from '@/lib/bulk-snap-edges';
import {
  alignAndDistribute,
  alignAndDistributeSummary,
  type AlignInputItem,
  type AlignItemsResult,
} from '@/lib/align-items';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_DEFS, type DesignLayerState, type ElementCategory } from '@/lib/design-elements';
import { biomeKeyForName } from '@/lib/biome';
import { loadSiteElements, type SiteElementType } from '@/lib/site-elements';
import type { LineShape } from '@/lib/design-canvas';
import { suggestZones } from '@/lib/design-suggest';
import { resolveBaseLayers, type MapRefLayers } from '@/lib/base-layers';
import { fetchBasemapForFrame } from '@/lib/basemap-imagery';
import DesignCanvas, { type TracedLayer } from '@/components/design/DesignCanvas';
import DesignPalette, {
  type DesignMode,
  type WaterInfrastructureOpacity,
  type WaterInfrastructureVisibility,
} from '@/components/design/DesignPalette';
import DesignWizard, { STEP_ORDER, STEP_LABELS } from '@/components/design/DesignWizard';
import CardsStepper from '@/components/design/CardsStepper';
import { uiVersion, UI_VERSION_EVENT } from '@/lib/ui-version';
import { STUDIO_AREA_FOR, type AddActionId } from '@/lib/add-actions';
import type { GlossyLayerFilter } from '@/components/design/DesignGlossy';
import StepGuide from '@/components/design/StepGuide';
import type { SubStepArm } from '@/lib/design-substeps';
import DesignAdvisor from '@/components/design/DesignAdvisor';
import BasePhotoImport, { type BasePhotoApplyResult } from '@/components/design/BasePhotoImport';
import { zoneAdviceFromSuggestions, type ZoneAdvicePin } from '@/components/design/zone-advice';
import SpeakButton from '@/components/SpeakButton';
import LessonLink from '@/components/design/LessonLink';
import { usePhoneViewport } from '@/lib/use-phone-viewport';

// One nudge step, as a fraction of the frame. Small on purpose: this is for closing a
// few-metre georeferencing gap, and a farmer who wants to move the photo further should
// re-import it rather than walk it across the map a step at a time.
const BASE_NUDGE_STEP = 0.002;

// One turn step, degrees. Half a degree is about the finest a farmer can judge by eye against
// satellite features, and it keeps the whole ±MAX_BASE_ROTATION range reachable in a sane number
// of taps.
const BASE_ROTATE_STEP = 0.5;

// One size step, as a multiplier. Compounding rather than adding keeps a tap the same PERCEIVED
// change whether the photo is currently large or small.
const BASE_SCALE_STEP = 1.01;

// These are view controls, not plan data. A facilitator can fade a busy water system while
// explaining it without moving, changing, or hiding the farmer's saved geometry on return.
const DEFAULT_WATER_INFRASTRUCTURE_VISIBILITY: WaterInfrastructureVisibility = {
  storage: true,
  tapPoints: true,
  pipes: true,
  drip: true,
  swales: true,
};
const DEFAULT_WATER_INFRASTRUCTURE_OPACITY: WaterInfrastructureOpacity = {
  storage: 1,
  tapPoints: 1,
  pipes: 1,
  drip: 1,
  swales: 1,
};

function waterInfrastructureForElement(defId: string | null): keyof WaterInfrastructureVisibility | null {
  if (!defId) return null;
  if (defId === 'tap_point') return 'tapPoints';
  if (defId === 'rain_barrel' || defId.startsWith('jojo_')) return 'storage';
  return null;
}

function waterInfrastructureForLine(kind: LineShape['kind']): keyof WaterInfrastructureVisibility | null {
  if (kind === 'pipe' || kind === 'greywater') return 'pipes';
  if (kind === 'drip') return 'drip';
  if (kind === 'swale') return 'swales';
  return null;
}

// PRESS AND HOLD on any of these controls to keep adjusting, accelerating as you go (Rory: "when
// i hold down with the mouse on these arrows it must go without having to click repeatedly for
// rapid adjustment also quicker than normal"). Tuned so a single held press can cross the whole
// useful range in a couple of seconds while a short press is still exactly one step.
const HOLD_FIRST_DELAY_MS = 380;
const HOLD_START_INTERVAL_MS = 110;
const HOLD_MIN_INTERVAL_MS = 28;
const HOLD_RAMP_MS = 1200;

// Shared look for every one-step control in the base-photo bar. `touchAction: none` is what lets
// a press-and-hold on a phone repeat instead of being stolen by the page scroller.
const STEP_BTN: CSSProperties = {
  minWidth: 26,
  minHeight: 26,
  border: '1px solid rgba(192,122,30,0.4)',
  borderRadius: 6,
  background: '#FFFDF7',
  color: '#C07A1E',
  cursor: 'pointer',
  fontSize: 10,
  lineHeight: 1,
  padding: 0,
  touchAction: 'none',
  userSelect: 'none',
};

const DESIGN_MODE_KEY = 'imbewu_design_mode';
const GEOMETRY_LOCK_KEY = 'imbewu_geometry_lock';

function readStoredDesignMode(): DesignMode {
  if (typeof window === 'undefined') return 'guided';
  try {
    const raw = window.localStorage.getItem(DESIGN_MODE_KEY);
    return raw === 'pro' ? 'pro' : 'guided';
  } catch {
    return 'guided';
  }
}

function readStoredGeometryLock(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GEOMETRY_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

const PAPER = '#FFFEFA';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const DARK = '#0B120B';

const AREA_FILL_PREF_KEY = 'imbewu_design_area_fill_v1';

/** How far Snap will reach when its normal, deliberately-short reach finds nothing. Four metres
 *  is a gap a farmer can see on screen and judge for themselves — and it is only ever applied
 *  behind a preview they have to confirm. */
const SNAP_REACH_M = 4;

const MAX_UNDO = 25;

/**
 * The × that closes ONE band of the bottom stack. Quiet by default and only firm on hover, because
 * it sits inside rows whose real controls it must never outrank — and it is always paired with the
 * "N hidden" chip beside the handle, which is the way back.
 */
function SectionClose({ onClick, what }: { onClick: () => void; what: string }) {
  const title = `Hide ${what} — bring it back with “hidden” next to the handle`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, flexShrink: 0,
        border: 'none', background: 'transparent', borderRadius: 8,
        color: DARK, opacity: 0.4, cursor: 'pointer', padding: 0,
      }}
    >
      <X size={14} />
    </button>
  );
}

// Module-level flag set around this page's own saveCanvasState calls, so its own writes
// (handleChange/handleUndo/setStep/migration) don't bounce back through
// DESIGN_CANVAS_CHANGED_EVENT and re-trigger a full refresh (incl. satellite refetch) of a
// page that already has the latest state in memory. Only genuinely external saves (another
// tab, the main map) should cause a refresh.
let selfSaveInProgress = false;

function withSelfSaveFlag<T>(fn: () => T): T {
  selfSaveInProgress = true;
  try {
    return fn();
  } finally {
    // Cleared on a microtask delay, not synchronously — saveCanvasState dispatches the
    // event synchronously, but React state updates and the event listener callback can
    // still be queued behind it; a same-tick clear would race the event.
    Promise.resolve().then(() => {
      selfSaveInProgress = false;
    });
  }
}

// Every local save also pushes to the cloud (lib/design-canvas-sync.ts) — fire-and-forget,
// no-ops when signed out or offline, so this is safe to call unconditionally from every
// call site that used to just call saveCanvasState directly.
// Returns the STAMPED state (fresh updatedAt + bumped rev) on success, or null when the design
// could NOT be persisted locally (device storage full) so the caller can tell the farmer instead
// of showing a lying "Saved". A silent failure here is what let a design's zones vanish: the save
// no-opped, the header still said Saved, and the next page load quietly served the last snapshot
// that DID fit.
// CALLERS MUST KEEP THE RETURNED STATE (that's why it isn't a boolean): rev is counted forward
// from the state handed in, so feeding React the pre-stamp object would re-derive every later
// save from the same base and pin rev at base+1 forever — a counter that never counts, silently
// demoting cloud sync back to the wall-clock tie-break it is meant to replace.
function persistCanvasState(state: DesignCanvasState): DesignCanvasState | null {
  // Push the RESTAMPED state saveCanvasState just wrote locally, not the pre-stamp `state` —
  // otherwise the cloud gets a stale updatedAt/rev and a real edit can lose the merge race.
  try {
    const stamped = withSelfSaveFlag(() => saveCanvasState(state));
    pushDesignCanvas(stamped).catch(() => {});
    return stamped;
  } catch (e) {
    if (e instanceof CanvasSaveError) return null;
    throw e;
  }
}

// Auto-focus: on a step change, which ELEMENT layers to show. Context layers (references, ground,
// labels, contours) are NOT touched here — they stay as the farmer set them. Line kinds follow
// their functional layer (LINE_LAYER in DesignCanvas), so focusing 'water' also shows drip/pipe/
// swale automatically. Base = trace-only (all element layers off); Review/Glossy = everything on.
const ELEMENT_LAYER_KEYS = ['water', 'earthworks', 'zones', 'planting', 'structures', 'access', 'animals'] as const;
// Element layers are always set; the context layers `sector`/`references` are only present in the
// return when a step actively FORCES them (today just the Sector step). Steps that omit them
// leave `a.sector`/`a.references` untouched through the spread in setStep — the same "preserve what
// the farmer toggled" rule contours already follow (see page.tsx guided-mode reset).
type StepFocus = Record<(typeof ELEMENT_LAYER_KEYS)[number], boolean> & Partial<Record<'sector' | 'references', boolean>>;
// PLACE-THEN-VANISH GUARD. An element with `alsoSteps` is OFFERED on a step outside its own
// category — Banana Circle is category 'earthworks' but alsoSteps: ['planting'], so it appears in
// the Planting palette. If that step then focuses layers OFF for its category, tapping the chip
// places a real item that disappears the instant it lands, which reads exactly like the app
// placing the wrong thing.
// Derived from the catalog rather than hand-listed so adding `alsoSteps` to a new element can
// never silently reintroduce this. (The Water step's hardcoded 'earthworks' below predates this
// and is now redundant, but is kept explicit for readability.)
const CATEGORY_TO_LAYER: Record<ElementCategory, (typeof ELEMENT_LAYER_KEYS)[number]> = {
  water: 'water',
  earthworks: 'earthworks',
  growing: 'planting',
  structure: 'structures',
  animal: 'animals',
  access: 'access',
};
function layersOfferedVia(step: WizardStep): string[] {
  return ELEMENT_CATALOG.filter((d) => d.alsoSteps?.includes(step as 'water' | 'planting' | 'structures')).map(
    (d) => CATEGORY_TO_LAYER[d.category],
  );
}
function applyStepFocus(step: WizardStep): StepFocus {
  const on = (keys: readonly string[]) => {
    const all = [...keys, ...layersOfferedVia(step)];
    return Object.fromEntries(ELEMENT_LAYER_KEYS.map((k) => [k, all.includes(k)])) as Record<
      (typeof ELEMENT_LAYER_KEYS)[number],
      boolean
    >;
  };
  switch (step) {
    case 'sector':
      // Analysis-before-design reveal: nothing to draw, so all element layers OFF (like Base),
      // but force the Sector energies overlay + site references ON so the farmer immediately SEES the
      // sun/wind/fire/water. Only the Sector step returns `sector`, so once past it the value is
      // preserved across steps (design WITH the energies) until the farmer toggles it off.
      return { ...on([]), sector: true, references: true };
    case 'water':
      return on(['water', 'earthworks']);
    // Earthworks focuses its own layer. Water keeps 'earthworks' on as well, because the Water
    // palette still offers earthworks chips (categoriesForStep) and a step must never switch off
    // the layer its own chips draw onto — see the PLACE-THEN-VANISH GUARD above.
    case 'earthworks':
      // PLANTING IS ON HERE TOO, because half the earth-moving on a smallholding is planting work.
      // A raised bed is built, a tree is a pit somebody digs, and both were placed on the Planting
      // step — so with only the earthworks layer lit, a farmer arriving at Earthworks saw swales
      // and an empty field, with no sign of the beds they had just drawn. Rory: "the raised beds
      // ... should appear here, auto generated from when i inserted them in planting."
      //
      // This is the step-level twin of the sheet-level answer: lib/glossy-filters.ts already gives
      // beds, basins, keyhole beds and herb spirals a second, factual home on sheet 05. The canvas
      // has to agree with the sheet, or the step shows one thing and its own printed output shows
      // another.
      return on(['earthworks', 'planting']);
    case 'zones':
      return on(['zones']);
    case 'planting':
      return on(['planting']);
    case 'structures':
      return on(['structures', 'access', 'animals']);
    case 'base':
      return on([]);
    case 'review':
    case 'glossy':
    default:
      return on(ELEMENT_LAYER_KEYS);
  }
}

// Pre-seed mapping: existing traced site-element types → Design Studio catalog defIds.
const SITE_ELEMENT_TO_DEF: Record<SiteElementType, string> = {
  jojo_tank: 'jojo_5000',
  tap: 'tap_point',
  borehole: 'borehole',
  pond_dam: 'pond_small',
  compost: 'compost_bay',
  beehive: 'beehive',
  nursery: 'nursery_table',
  tree: 'tree_indigenous',
  gate: 'gate',
};

function ringFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? [];
  return [];
}

function lineFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'LineString') return geom.coordinates ?? [];
  if (geom.type === 'MultiLineString') return geom.coordinates[0] ?? [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  return [];
}

function centroidOf(ring: Array<[number, number]>): [number, number] | null {
  if (ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

interface RefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  // True when the driveway was traced as an AREA (polygon) rather than a track (line) — it's
  // then filled as a tar surface instead of outlined (outlining a polygon looked like a maze).
  drivewayClosed?: boolean;
}

interface SiteCtx {
  windFromSummer?: string;
  slopeDeg?: number;
  aspectLabel?: string;
  rainfallMm?: number;
  biome?: string;
  // Whole-site average slope (%) — feeds the terrace-method advisory tip (lib/design-rules.ts),
  // same value glossySite.elevation.slopePct below carries for the Sector sheet.
  slopePct?: number;
}

function freshState(siteId: string, frame: Omit<CanvasFrame, 'satDataUrl'>): DesignCanvasState {
  return {
    siteId,
    frame,
    items: [],
    zones: [],
    lines: [],
    step: 'base',
    updatedAt: new Date().toISOString(),
  };
}

function locationDataCacheKey(lat: number, lon: number): string {
  return `imbewu_loc_v3_${lat.toFixed(5)}_${lon.toFixed(5)}`;
}

function readCachedLocationData(lat: number, lon: number): LocationData | null {
  if (typeof window === 'undefined') return null;
  try {
    // v2: bump the version when the location-data shape gains a field (e.g. BRU zones) so
    // already-analysed sites refetch instead of serving a stale pre-field cache. Keep the
    // key in sync with app/farmer/page.tsx.
    const raw = localStorage.getItem(locationDataCacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocationData) : null;
  } catch {
    return null;
  }
}

function cacheLocationData(lat: number, lon: number, data: LocationData): void {
  try {
    localStorage.setItem(locationDataCacheKey(lat, lon), JSON.stringify(data));
  } catch {
    // The live result still feeds this page when device storage is unavailable.
  }
}

function EmptyState() {
  // Saved places double as direct entry points: pick one and the studio fetches its
  // satellite straight away — no need to open the site on the main map first.
  // Loaded in an effect (not a useState initializer) so SSR HTML and hydration match.
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  useEffect(() => {
    try { setPlaces(loadPlaces()); } catch { /* localStorage unavailable */ }
  }, []);
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: PAPER,
        color: DARK,
        textAlign: 'center',
      }}
    >
      <Compass size={40} color={GREEN} />
      {places.length > 0 ? (
        <>
          <p style={{ fontSize: 16, maxWidth: 340, lineHeight: 1.5, fontWeight: 600 }}>
            Pick a saved place to start designing
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 380 }}>
            {places.map((p) => (
              <Link
                key={p.id}
                href={`/design?lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  minHeight: 48,
                  borderRadius: 14,
                  background: '#FFFFFF',
                  border: '1px solid #E2D8C4',
                  color: DARK,
                  textDecoration: 'none',
                  textAlign: 'left',
                }}
              >
                <MapPin size={18} color={resolveColor(p)} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  {p.biome && (
                    <span style={{ display: 'block', fontSize: 11.5, color: '#94876F' }}>{p.biome}</span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: GREEN, fontWeight: 600, flexShrink: 0 }}>Design →</span>
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: '#94876F', maxWidth: 340 }}>
            Tip: sites with a traced boundary get a perfectly-fitted satellite view.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 16, maxWidth: 320, lineHeight: 1.5 }}>
          Open a site on the map first, then tap Design Studio — or save a place and it will appear here.
        </p>
      )}
      <Link
        href="/farmer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          minHeight: 44,
          borderRadius: 999,
          background: GREEN,
          color: PAPER,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <ArrowLeft size={18} />
        Back to map
      </Link>
    </div>
  );
}

function DesignStudioInner() {
  const { user, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const latRaw = params.get('lat');
  const lonRaw = params.get('lon');
  // Number(null) === 0 — a missing param must NOT masquerade as latitude 0 / longitude 0
  // (it skipped the saved-places picker and filed the design under site:0.00000,0.00000).
  const lat = latRaw === null || latRaw === '' ? NaN : Number(latRaw);
  const lon = lonRaw === null || lonRaw === '' ? NaN : Number(lonRaw);
  const hasSite = Number.isFinite(lat) && Number.isFinite(lon);

  // Saved-place name for the header — resolved in an effect (localStorage), never during
  // render: SSR has no localStorage, so a render-time read hydration-mismatches the header.
  const [placeName, setPlaceName] = useState<string | null>(null);
  useEffect(() => {
    if (!hasSite) return;
    try {
      const match = loadPlaces().find(
        (p) => Math.abs(p.lat - lat) < 5e-5 && Math.abs(p.lon - lon) < 5e-5,
      );
      setPlaceName(match?.name ?? null);
    } catch {
      setPlaceName(null);
    }
  }, [hasSite, lat, lon]);

  // GUIDED/PRO mode — read from localStorage in an effect (SSR has no localStorage, so a
  // render-time read would hydration-mismatch), defaulting to 'guided'.
  const [designMode, setDesignMode] = useState<DesignMode>('guided');
  useEffect(() => {
    setDesignMode(readStoredDesignMode());
  }, []);
  const toggleDesignMode = useCallback(() => {
    setDesignMode((prev) => {
      const next: DesignMode = prev === 'pro' ? 'guided' : 'pro';
      try {
        window.localStorage.setItem(DESIGN_MODE_KEY, next);
      } catch {
        /* localStorage unavailable */
      }
      return next;
    });
  }, []);

  // Geometry Lock — off by default, but persisted when the farmer turns it on for testing.
  const [geometryLock, setGeometryLock] = useState(false);
  useEffect(() => {
    setGeometryLock(readStoredGeometryLock());
  }, []);
  const toggleGeometryLock = useCallback(() => {
    setGeometryLock((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(GEOMETRY_LOCK_KEY, next ? '1' : '0');
      } catch {
        /* localStorage unavailable */
      }
      return next;
    });
  }, []);

  // SAFE MODE — see lib/crash-loop.ts. Resolved once per page load, and BEFORE the base-image
  // effect below runs, because that effect is the heavy one: on a design with an imported photo it
  // downloads the drone image and the satellite underlay as data URLs and supersamples both into a
  // bake canvas, every single load. When iOS kills the page for that, the reload does it again —
  // the loop behind Rory's "A problem repeatedly occurred" screen. After three loads that never
  // settled, this load skips the photo pixels and keeps everything else.
  const safeMode = useMemo(() => designSafeMode(), []);
  // Rendered only after mount: the server has no storage to read, so painting the banner during
  // the first render would be a hydration mismatch.
  const [safeModeVisible, setSafeModeVisible] = useState(false);
  useEffect(() => {
    setSafeModeVisible(safeMode.active);
    // THE PAGE SURVIVED. A load that reaches this timer without being killed is not part of a
    // crash loop, so the streak is retired — which is also what lets safe mode switch itself off
    // again once the farmer's phone can cope.
    // The SAME per-farm key the decision was read from — clearing the shared one would leave this
    // farm's streak climbing forever, and safe mode would latch on and never let go.
    const settled = window.setTimeout(() => markPageSettled(window.localStorage, safeMode.key), CRASH_LOOP_SETTLE_MS);
    return () => window.clearTimeout(settled);
  }, [safeMode.active, safeMode.key]);

  const [buildInfo, setBuildInfo] = useState<{ branch?: string | null; sha?: string | null; repoRoot?: string | null; source?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/build-info', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBuildInfo(data);
      })
      .catch(() => {
        if (!cancelled) setBuildInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [layers, setLayers] = useState<DesignLayer[]>([]);
  const [refLayers, setRefLayers] = useState<RefLayers>({ boundary: [], house: [], driveway: [] });
  // Everything the farmer traced near this site (except the boundary), classified + projected
  // into this frame — rendered as tappable, adoptable shapes in the canvas so nothing has to
  // be re-drawn. Phase 1 of docs/ONE-SURFACE-PLAN.md.
  const [tracedLayers, setTracedLayers] = useState<TracedLayer[]>([]);
  const [houseXY, setHouseXY] = useState<[number, number] | null>(null);
  const [frame, setFrame] = useState<CanvasFrame | null>(null);
  const [canvasState, setCanvasState] = useState<DesignCanvasState | null>(null);
  // "Import your own photo" (Base step) — which Storage URL's bytes are currently loaded into
  // frame.satDataUrl, so the effects below never refetch a custom photo they've already fetched,
  // and never confuse it with the satellite tile's own data URL (which has no URL to compare).
  const loadedCustomBaseUrlRef = useRef<string | null>(null);
  // Tracked separately from the photo: the underlay is keyed on the frame the satellite was
  // fetched FOR, so panning to a new frame refetches it while re-importing the same photo does not.
  const loadedUnderlayKeyRef = useRef<string | null>(null);
  // WHICH BASE THE FARMER CURRENTLY WANTS, as a generation counter. The satellite and the photo
  // are fetched independently and neither cancels the other, so on a slow rural connection a
  // farmer tapping Satellite → My photo (the toggle exists to be flipped) could have the loser's
  // response land LAST and write its image over the winner's — leaving satellite pixels being
  // measured with the drone photo's metres-per-pixel. Every area, spacing, tank size, yield and
  // price on the canvas and on all eight sheets would then be silently wrong, and it survives a
  // refresh. Every async write of the base image captures this and refuses to write if it moved.
  const baseRequestRef = useRef(0);
  // The farmer's photo as it was imported, BEFORE any in-place alignment. Alignment is baked into
  // frame.satDataUrl (bakeBaseAlignment) so every plan sheet paints the same aligned pixels the
  // Studio does — which means each nudge or rotation must re-bake from this pristine copy, never
  // from the previously-baked image, or the transforms would stack and the photo would walk away.
  const customBaseSourceRef = useRef<{ url: string; dataUrl: string } | null>(null);
  // Bumped whenever the ref above is filled. The bytes stay in a ref (they are large, and putting
  // them in state would re-render the whole Studio on every load), but the bake effect has to
  // know they ARRIVED — a ref assignment is invisible to a dependency array, so without this
  // counter a farmer who taps the angle button before the download lands gets an alignment that
  // saves and never paints.
  const [customBaseSourceRev, setCustomBaseSourceRev] = useState(0);
  const [showPhotoImport, setShowPhotoImport] = useState(false);
  const [saved, setSaved] = useState(true);

  // Multi-select: Shift/Cmd+tap adds to the selection; a plain tap replaces it. Edit/resize/
  // rotate handles only appear on a SINGLE selection; a group just gets highlight rings and
  // can be deleted together (Rory's "command-select for multiple + delete" ask).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  // Tidy outline (lib/tidy-outline.ts) preview — set only while previewing a pending tidy of the
  // single selected zone/line; `id` pins the preview to that ONE shape so a selection change or a
  // remote edit that removes it can be detected and the stale preview dropped (see the effect
  // below). Never written to directly outside onTidySelected/onConfirmTidy/onCancelTidy/this
  // cleanup effect.
  const [tidyPreview, setTidyPreview] = useState<{ id: string; kind: 'zone' | 'line'; result: TidyOutlineResult; squared?: SquareUpResult | null } | null>(null);
  useEffect(() => {
    if (!tidyPreview) return;
    const stillSelected = selectedId === tidyPreview.id;
    const stillExists = canvasState
      ? tidyPreview.kind === 'zone'
        ? canvasState.zones.some((z) => z.id === tidyPreview.id)
        : canvasState.lines.some((l) => l.id === tidyPreview.id)
      : false;
    if (!stillSelected || !stillExists) setTidyPreview(null);
  }, [tidyPreview, selectedId, canvasState]);

  // Batch Snap preview — pinned to the exact selected ring set. The pure orchestrator keeps each
  // vetoed ring byte-identical while letting other safe rings move, and confirmation still enters
  // the normal history path once for the whole batch.
  const [snapPreview, setSnapPreview] = useState<{ ids: string[]; result: BulkSnapResult; reached?: boolean } | null>(null);
  useEffect(() => {
    if (!snapPreview) return;
    const selectedSet = new Set(selectedIds);
    const stillSelected = selectedIds.length === snapPreview.ids.length
      && snapPreview.ids.every((id) => selectedSet.has(id));
    const stillExists = canvasState
      ? snapPreview.ids.every((id) => canvasState.zones.some((z) => z.id === id))
      : false;
    if (!stillSelected || !stillExists) setSnapPreview(null);
  }, [snapPreview, selectedIds, canvasState]);

  // Clean up (lib/align-items.ts) preview — set only while previewing a pending "clean up" of a
  // MULTI-selection of 2+ placed items. `ids` pins the preview to the
  // EXACT SET of items it was computed against, same "id-pinned, dropped on staleness" shape as
  // tidyPreview/snapPreview above: adding, removing, or losing any one member of the group (a
  // selection change, or a remote edit deleting one of them) drops the stale preview rather than
  // confirming a partial or outdated result. Never written to directly outside
  // onCleanupSelected/onConfirmCleanup/onCancelCleanup/this cleanup effect.
  const [cleanupPreview, setCleanupPreview] = useState<{ ids: string[]; result: AlignItemsResult } | null>(null);
  useEffect(() => {
    if (!cleanupPreview) return;
    const stillSelected =
      selectedIds.length === cleanupPreview.ids.length && cleanupPreview.ids.every((id) => selectedIds.includes(id));
    const stillExists = canvasState ? cleanupPreview.ids.every((id) => canvasState.items.some((it) => it.id === id)) : false;
    if (!stillSelected || !stillExists) setCleanupPreview(null);
  }, [cleanupPreview, selectedIds, canvasState]);

  const handleSelect = useCallback((id: string | null, additive?: boolean) => {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return [id];
    });
  }, []);
  // Marquee (drag-rectangle multi-select) release — DesignCanvas already did the geometry (which
  // ids the rect caught); this just applies them to selection state the same way handleSelect
  // does for a single id. additive=true (Shift/Cmd held) UNIONS onto the existing selection —
  // dragging a second marquee while holding Shift keeps building one selection, and re-catching
  // an already-selected id is a harmless no-op (Set dedupes). additive=false REPLACES it,
  // including with an empty array when the marquee caught nothing (a deliberate "start fresh"
  // drag over empty ground clears whatever was selected, same as a plain background tap does).
  const handleSelectMany = useCallback((ids: string[], additive: boolean) => {
    setSelectedIds((prev) => (additive ? Array.from(new Set([...prev, ...ids])) : ids));
  }, []);
  // Touch multi-select mode (phones have no Shift/Cmd) — a plain tap adds while this is on.
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [tool, setTool] = useState<'select' | 'place' | 'zone' | 'line'>('select');
  // Arming a draw/place tool clears any lingering selection — otherwise the previously
  // committed shape keeps its editing handles (vertex grips + delete ✕) live on top of the
  // drawing surface, and a tap meant to drop the first corner of a NEW zone lands on the old
  // zone's ✕ and deletes it instead. Reverting to 'select' (e.g. right after Finish) keeps
  // the selection, so the just-drawn shape stays immediately editable.
  const handleSetTool = useCallback((t: 'select' | 'place' | 'zone' | 'line') => {
    setTool(t);
    // Picking any tool cancels a pending block — including the placement tool, since arming the
    // block re-arms it explicitly straight after. Without this the block would stay live under
    // an unrelated tool and steal the next tap.
    setBedBlockArmed(false);
    if (t !== 'select') {
      setSelectedIds([]);
      setMultiSelectMode(false);
    }
  }, []);
  const [placeDefId, setPlaceDefId] = useState<string | null>(null);
  const [placeSpeciesId, setPlaceSpeciesId] = useState<string | null>(null);
  const [zoneDraw, setZoneDraw] = useState<0 | 1 | 2 | 3 | 4 | 5>(1);
  // Armed ground-feature label (house/patio/…) for the shared polygon-draw tool; null = the
  // zone tool draws a plain permaculture effort-zone.
  const [areaFeature, setAreaFeature] = useState<GroundFeatureKind | null>(null);
  const [lineKind, setLineKind] = useState<LineShape['kind']>('swale');
  // Every element layer MUST default to true: the Pro catalog filter and the canvas both gate
  // on these, so a key defaulting to false (or missing) silently hides that category's elements
  // from the palette AND the map.
  const [activeLayers, setActiveLayers] = useState<DesignLayerState>({
    water: true,
    earthworks: true,
    zones: true,
    planting: true,
    structures: true,
    access: true,
    animals: true,
    ground: true,
    references: true,
    boundary: true, // the property fence — on by default, but now removable on its own
    labels: true,
    symbols: true,
    contours: false, // opt-in overlay (approximate, from slope + aspect)
    sector: false, // opt-in overlay (deterministic sun/wind/fire/water/frost energies, from lib/sector)
  });
  const [waterInfrastructureVisibility, setWaterInfrastructureVisibility] = useState<WaterInfrastructureVisibility>(
    DEFAULT_WATER_INFRASTRUCTURE_VISIBILITY,
  );
  const [waterInfrastructureOpacity, setWaterInfrastructureOpacity] = useState<WaterInfrastructureOpacity>(
    DEFAULT_WATER_INFRASTRUCTURE_OPACITY,
  );
  useEffect(() => {
    const key = waterInfrastructureForElement(placeDefId);
    if (!key) return;
    setActiveLayers((layers) => (layers.water ? layers : { ...layers, water: true }));
    setWaterInfrastructureVisibility((layers) => (layers[key] ? layers : { ...layers, [key]: true }));
  }, [placeDefId]);
  useEffect(() => {
    if (tool !== 'line') return;
    const key = waterInfrastructureForLine(lineKind);
    if (!key) return;
    setActiveLayers((layers) => (layers.water ? layers : { ...layers, water: true }));
    setWaterInfrastructureVisibility((layers) => (layers[key] ? layers : { ...layers, [key]: true }));
  }, [lineKind, tool]);
  // Icon + label size, as a multiplier. Presentation only: it changes how large symbols are
  // DRAWN and never touches a stored coordinate, so sliding it cannot move anyone's design.
  const [mapTextScale, setMapTextScale] = useState(1);
  // HOW TRACED SURFACES ARE FILLED — hatch or flat tint, and how strongly. Persisted, unlike the
  // symbol-size slider beside it, because it is the kind of preference a farmer sets once for how
  // they like to read their own map; and unlike a hidden panel, a fill you cannot see is visible
  // on screen as soon as you look at it, so there is nothing to be confused about on return.
  const [areaFill, setAreaFill] = useState<{ style: AreaFillStyle; opacity: number; plantOpacity: number }>(DEFAULT_AREA_FILL);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AREA_FILL_PREF_KEY);
      if (raw) setAreaFill(normaliseAreaFill(JSON.parse(raw)));
    } catch { /* a corrupt preference is not worth a broken Studio */ }
  }, []);
  const changeAreaFill = useCallback((next: { style: AreaFillStyle; opacity: number; plantOpacity: number }) => {
    const clean = normaliseAreaFill(next);
    setAreaFill(clean);
    try { window.localStorage.setItem(AREA_FILL_PREF_KEY, JSON.stringify(clean)); } catch { /* non-fatal */ }
  }, []);
  // Bed-block placement. The spec is what the farmer typed; `armed` is whether the next canvas
  // tap drops the block's corner. Defaults are a standard market-garden bed: 3 m long, 1.2 m
  // across (reachable from either side), 0.5 m paths.
  const [bedBlockSpec, setBedBlockSpec] = useState<BedBlockSpec>(
    () => normaliseBedBlockSpec({ bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5, count: 4 }),
  );
  const [bedBlockArmed, setBedBlockArmed] = useState(false);
  // Switching INTO guided restores every layer — a first-timer should never land in guided
  // with a layer invisibly hidden. Layer toggles now exist in guided too, but this reset is
  // still the safe default on mode switch.
  //
  // `boundary` is preserved rather than reset, alongside contours and sector. What the reset
  // protects against is an ELEMENT layer being off: those also filter the palette, so a hidden
  // one takes the farmer's tools away and leaves them hunting. The fence is a pure reference
  // overlay with no palette effect, so turning it off is a deliberate presentation choice —
  // and switching modes putting it back is just the fence returning uninvited.
  useEffect(() => {
    if (designMode === 'guided') {
      setActiveLayers((a) => ({ water: true, earthworks: true, zones: true, planting: true, structures: true, access: true, animals: true, ground: true, references: true, boundary: a.boundary, labels: true, symbols: true, contours: a.contours, sector: a.sector }));
    }
  }, [designMode]);

  // Item edit sheet — the item currently being edited via DesignCanvas's onEditItem.
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const [detectError, setDetectError] = useState<string | null>(null);
  /** What the last 'Drip all beds' tap did — neutral, not an error, and it must always say
   *  something, because a button that appears to do nothing reads as broken. */
  const [dripNote, setDripNote] = useState<string | null>(null);

  // Copy/paste clipboard for selected shapes (Cmd/Ctrl+C / +V). Ref, not state — it never needs
  // to trigger a render, and paste reads it synchronously.
  const clipboard = useRef<{ items: PlacedItem[]; zones: ZoneShape[]; lines: LineShape[] }>({ items: [], zones: [], lines: [] });

  // Collapse the top chrome (auto-design bar + wizard) into a slim strip so the canvas
  // gets the full screen — the design surface was cramped into ~half the height.
  // THE TWO LADDERS. Replaces a single boolean that could only hide the wizard: the farmer can now
  // take each edge down in stages and, at the last stop, all the way to just the map — with the
  // least essential band going first (see bottomVisibility). `hidden` is never persisted, so the
  // Studio can never reopen with no visible tools.
  const [topStop, setTopStop] = useState<TopStop>('full');
  const [bottomStop, setBottomStop] = useState<BottomStop>('full');
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHROME_PREF_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<ChromePref>;
      setTopStop(restoreStop(saved.top, TOP_STOPS, 'full'));
      setBottomStop(restoreStop(saved.bottom, BOTTOM_STOPS, 'full'));
    } catch { /* a corrupt preference is not worth a broken Studio */ }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(CHROME_PREF_KEY, JSON.stringify(persistableChrome({ top: topStop, bottom: bottomStop })));
    } catch { /* storage full is already surfaced by the design save path */ }
  }, [topStop, bottomStop]);
  // CLOSING ONE SECTION. The ladder is coarse by design — it sheds in a fixed order — which is
  // wrong when only one band is in the way ("the option to collapse specific sections… i cant
  // work with the map adjustment tools without the huge tool section underneath"). Each band's ×
  // lands here. This one persists, because the count chip beside the handle always offers it back.
  const [dismissed, setDismissed] = useState<DismissibleBand[]>([]);
  useEffect(() => {
    try { setDismissed(restoreDismissed(window.localStorage.getItem(DISMISSED_KEY))); }
    catch { /* a corrupt preference is not worth a broken Studio */ }
  }, []);
  const hideSection = useCallback((band: DismissibleBand) => {
    setDismissed((prev) => {
      if (prev.includes(band)) return prev;
      const next = [...prev, band];
      try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* non-fatal */ }
      return next;
    });
  }, []);
  const showAllSections = useCallback(() => {
    setDismissed([]);
    try { window.localStorage.removeItem(DISMISSED_KEY); } catch { /* non-fatal */ }
  }, []);

  const topShow = topVisibility(topStop);
  const rawBottomShow = bottomVisibility(bottomStop);
  const bottomShow = {
    ...rawBottomShow,
    droneTools: rawBottomShow.droneTools && !dismissed.includes('droneTools'),
    droneEntry: rawBottomShow.droneEntry && !dismissed.includes('droneTools'),
    shortcuts: rawBottomShow.shortcuts && !dismissed.includes('shortcuts'),
    stepBar: rawBottomShow.stepBar && !dismissed.includes('stepGuide'),
  };
  // Kept so the existing phone auto-collapse effect and every other read still work unchanged.
  const chromeCollapsed = !topShow.wizard;
  // THE UI VERSION, read reactively — presentation only, per lib/ui-version.ts's boundary. In
  // 'cards' the slim chrome bar carries the 2.0 numbered stepper (every step visible and
  // tappable) instead of the prev/next mini-nav; nothing about step semantics changes, it is
  // the same setStep the arrows call.
  const [cardsUi, setCardsUi] = useState(false);
  useEffect(() => {
    const sync = () => setCardsUi(uiVersion() === 'cards');
    sync();
    window.addEventListener(UI_VERSION_EVENT, sync);
    return () => window.removeEventListener(UI_VERSION_EVENT, sync);
  }, []);
  const setChromeCollapsed = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    setTopStop((prev) => {
      const want = typeof v === 'function' ? v(prev !== 'full') : v;
      // One-directional by contract: the auto-collapse may fold the wizard away, never restore it
      // mid-drawing, and never take the header with it.
      return want ? (prev === 'full' ? 'slim' : prev) : 'full';
    });
  }, []);
  // Phone-only: auto-collapse the instant the farmer starts actually interacting with the
  // canvas (a real drag, or a map scroll/zoom) — see the effect below, wired to canvasWrapRef.
  // Deliberately one-directional (only ever sets chromeCollapsed(true), never false): restoring
  // is the farmer's own tap on the existing "Show steps" control in the slim bar. Auto-restoring
  // when the gesture ends would flicker the chrome mid-drawing, which is the one thing the spec
  // for this explicitly rules out.
  const isPhone = usePhoneViewport();
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isPhone) return;
    const el = canvasWrapRef.current;
    if (!el) return;
    const DRAG_THRESHOLD_PX = 6;
    let pending: { x: number; y: number; pointerId: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pending || pending.pointerId !== e.pointerId) return;
      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        setChromeCollapsed(true);
        pending = null; // fire once per gesture, not on every subsequent pointermove
      }
    };
    const onPointerEnd = () => {
      pending = null;
    };
    // Map scroll/zoom (wheel on desktop trackpads/mice that happen to be under the phone
    // breakpoint, e.g. a narrowed browser window; touch pinch-zoom goes through pointerdown/move
    // above instead) — collapses immediately, no drag distance to clear.
    const onWheel = () => setChromeCollapsed(true);
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerEnd, { passive: true });
    el.addEventListener('pointercancel', onPointerEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [isPhone]);
  const [printOpen, setPrintOpen] = useState(false);
  // Set when a local save genuinely failed (device storage full). Must be shown — a silent
  // failure here is how a design's zones went missing while the header still said "Saved".
  const [saveError, setSaveError] = useState<string | null>(null);
  // Per-layer glossy preview overlay: when non-null, show the strict glossy render scoped to
  // this layer over the studio, without leaving the current step. null = closed.
  const [previewFilter, setPreviewFilter] = useState<GlossyLayerFilter | null>(null);
  // Zone ADVICE (the guidance half of the hybrid): Lima's spatial suggestions shown as short
  // text advice the farmer taps to ARM a zone chip and then draws themselves — never committed.
  const [zoneAdvice, setZoneAdvice] = useState<ZoneAdvicePin[]>([]);

  const undoStack = useRef<DesignCanvasState[]>([]);
  const redoStack = useRef<DesignCanvasState[]>([]);
  // False until we know what (if anything) the cloud holds for this site — i.e. until the
  // reconcile below has settled, or we've established there is no cloud to reconcile with
  // (signed out). Gates AUTOMATIC persists only; a farmer's own edits are never gated. See
  // persistMigration in the frame effect for why.
  const cloudSettled = useRef(false);
  const siteId = useMemo(
    () => designSiteIdFromLocation(hasSite ? ({ lat, lon } as LocationData) : null),
    [hasSite, lat, lon],
  );

  const site: SiteCtx | null = useMemo(() => {
    if (!locationData) return null;
    return {
      windFromSummer: locationData.climate?.windFromSummer,
      slopeDeg: locationData.elevation?.slopeDeg,
      aspectLabel: locationData.elevation?.aspectLabel,
      rainfallMm: locationData.rainfall?.annual,
      biome: locationData.biome?.name,
      slopePct: locationData.elevation?.slopePct,
    };
  }, [locationData]);

  // Full sector context (slope + climate) for the deterministic Sector sheet (plan-set 02). A
  // superset of {biome, rainfallMm}, so it also feeds buildPhasePlan/buildDesignBrief unchanged.
  const glossySite: SectorSite | null = useMemo(() => {
    if (!locationData) return null;
    return {
      biome: locationData.biome?.name,
      rainfallMm: locationData.rainfall?.annual,
      monthlyRainfallMm: locationData.rainfall?.monthly,
      rainfallPattern: locationData.rainfall?.pattern ?? locationData.biome?.rainfallPattern,
      elevation: locationData.elevation
        ? {
            slopeDeg: locationData.elevation.slopeDeg,
            slopePct: locationData.elevation.slopePct,
            aspectDeg: locationData.elevation.aspectDeg,
            aspectLabel: locationData.elevation.aspectLabel,
            sampleBaselineM: locationData.elevation.sampleBaselineM,
            directionConfidence: locationData.elevation.directionConfidence,
          }
        : undefined,
      climate: locationData.climate
        ? {
            windFromSummer: locationData.climate.windFromSummer,
            windFromWinter: locationData.climate.windFromWinter,
            windSpeed: locationData.climate.windSpeed,
            minTemp: locationData.climate.minTemp,
            maxTemp: locationData.climate.maxTemp,
          }
        : undefined,
    };
  }, [locationData]);

  // Direct Design Studio links must analyse their own coordinates. Previously this page only
  // consumed a cache populated by the main map, so a newly-opened property silently rendered a
  // generic regional Sector sheet with no slope/aspect. Show cached data immediately, then always
  // refresh it in the background so every property's sun, terrain and climate evidence is its own.
  useEffect(() => {
    if (!hasSite) return;
    let cancelled = false;
    const controller = new AbortController();
    setLocationData(readCachedLocationData(lat, lon));

    fetch(`/api/location-data?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Location analysis failed (${res.status})`);
        return res.json() as Promise<LocationData>;
      })
      .then((data) => {
        if (cancelled) return;
        cacheLocationData(lat, lon, data);
        setLocationData(data);
      })
      .catch(() => {
        // Keep the cached result, if any. The Sector sheet's evidence status explicitly lists
        // anything missing instead of inventing a slope or climate direction.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasSite, lat, lon]);

  // Load traced layers + build the canvas frame.
  useEffect(() => {
    if (!hasSite) return;

    // Tracks the frame centre/zoom the satellite was last fetched for, so a refresh only
    // clears/refetches the (large, flicker-prone) satellite image when the frame actually
    // moved — not on every DESIGN_CANVAS_CHANGED_EVENT (e.g. a farmer dragging an item).
    let lastFetchedFrame: { centerLng: number; centerLat: number; zoom: number } | null = null;

    const refresh = (evt?: Event) => {
      // Ignore change events this page itself caused (its own saveCanvasState calls) —
      // this page's state is already current, so re-running the full refresh (incl.
      // re-deriving refLayers/frame and possibly refetching the satellite) is pure
      // self-inflicted flicker.
      if (evt?.type === DESIGN_CANVAS_CHANGED_EVENT && selfSaveInProgress) return;

      const saved0 = loadDesignStudioState(siteId);
      const mergedAll = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), saved0, siteId);
      // The main map stores traced shapes GLOBALLY, so mergedAll can contain another
      // site's geometry. Keep only layers near THIS site (~2 km) — otherwise a far-away
      // site inherits a foreign boundary and the satellite fits to the wrong ground.
      const NEAR_DEG = 0.02;
      const nearLayers = mergedAll.layers.filter((l) => {
        const c = ringFromGeometry(l.geometry)[0] ?? lineFromGeometry(l.geometry)[0];
        if (!c) return false;
        return Math.abs(c[1] - lat) < NEAR_DEG && Math.abs(c[0] - lon) < NEAR_DEG;
      });
      const merged = { ...mergedAll, layers: nearLayers };
      setLayers(merged.layers);

      let boundaryLayer =
        merged.layers.find((l) => l.layerType === 'property_boundary' && l.approved) ??
        merged.layers.find((l) => l.layerType === 'property_boundary');
      if (!boundaryLayer) {
        // The merge classifies the GLOBALLY-largest shape as property_boundary — which may
        // belong to another site and get dropped by the near-site filter above. Promote the
        // largest NEAR land polygon so this site still has a working boundary (fit, refs,
        // suggestions) instead of erroring "trace your boundary first".
        boundaryLayer = [...merged.layers]
          .filter((l) => l.layerType !== 'water_body' && ringFromGeometry(l.geometry).length >= 3)
          .sort((a, b) => b.areaM2 - a.areaM2)[0];
      }
      const houseLayer =
        merged.layers.find((l) => (l.layerType === 'roof' || l.layerType === 'structure') && l.approved) ??
        merged.layers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
      const driveLayer =
        merged.layers.find((l) => l.layerType === 'access' && l.approved) ??
        merged.layers.find((l) => l.layerType === 'access');

      const { frame: frameNoImg, url, project } = computeCanvasFrame(merged.layers, lat, lon);

      const boundaryRing = ringFromGeometry(boundaryLayer?.geometry).map((c) => project(c));
      const houseRing = ringFromGeometry(houseLayer?.geometry).map((c) => project(c));
      const driveIsArea = driveLayer?.geometry?.type === 'Polygon' || driveLayer?.geometry?.type === 'MultiPolygon';
      const driveLine = driveLayer
        ? (driveIsArea ? ringFromGeometry(driveLayer.geometry) : lineFromGeometry(driveLayer.geometry)).map((c) => project(c))
        : [];

      // Map-only base layers, projected into this frame — unchanged from before resolveBaseLayers
      // existed. Do NOT setRefLayers from this alone: a farmer who traced house/driveway/boundary
      // as a Studio ZoneShape (GroundFeatureKind) instead of on the main map needs those rings to
      // win, and the only place that state (canvasState.zones, post-migration) is known is inside
      // the setCanvasState resolution below — so resolveBaseLayers is called from each of its
      // branches instead of here. A farmer with no Studio base rings gets this object back
      // untouched (resolveBaseLayers's map fallback), so nothing changes for them.
      const mapRefLayers: MapRefLayers = {
        boundary: boundaryRing,
        house: houseRing,
        driveway: driveLine,
        drivewayClosed: driveIsArea,
      };

      // Build the tappable/adoptable traced layers: every near-site classified layer EXCEPT
      // the one used as the boundary fence (which stays a non-adopted reference). Access
      // shapes become polylines UNLESS the traced source is itself an AREA (a paved driveway
      // polygon), in which case they stay a polygon so adoption can produce a driveway ground
      // feature instead of a path; everything else a polygon (adopt → zone/item).
      // Geometry is projected here with the same project() the satellite fit uses, so the
      // adopted normalised coords line up pixel-for-pixel — no redraw, no drift.
      const boundaryFeatureId = boundaryLayer?.featureId;
      const traced: TracedLayer[] = [];
      for (const l of merged.layers) {
        if (boundaryFeatureId && l.featureId === boundaryFeatureId) continue;
        const isAccess = l.layerType === 'access';
        // A traced access shape can be a genuine polyline (a gate, a track) OR an AREA (a paved
        // driveway polygon) — the same test driveIsArea uses above for refLayers.driveway. Losing
        // this distinction here (the old `render = isAccess ? 'line' : 'polygon'`, which forced
        // EVERY access shape to 'line' regardless of its geometry) is why adopting a polygon
        // driveway always produced a walking-path LineShape — DesignCanvas.adoptTracedLayer had no
        // way left to tell the two apart (docs/RENDER-INVESTIGATION-2026-07-20.md, studio-only).
        const isAccessArea = isAccess && (l.geometry?.type === 'Polygon' || l.geometry?.type === 'MultiPolygon');
        const rawCoords = isAccess
          ? (isAccessArea ? ringFromGeometry(l.geometry) : lineFromGeometry(l.geometry))
          : ringFromGeometry(l.geometry);
        if (rawCoords.length === 0) continue;
        const points = rawCoords.map((c) => project(c));
        const render: TracedLayer['render'] = isAccess && !isAccessArea ? 'line' : 'polygon';
        if (render === 'polygon' && points.length < 3) continue;
        if (render === 'line' && points.length < 2) continue;
        traced.push({
          featureId: l.featureId,
          name: l.name,
          layerType: l.layerType,
          color: l.color,
          render,
          points,
        });
      }
      setTracedLayers(traced);

      // A previously-saved "import your own photo" base (lib/design-canvas.ts CustomBaseImage)
      // overrides both the satellite tile AND its GPS-derived mPerPx. Read directly here — rather
      // than waiting for the setCanvasState resolution below — so a fresh page load (or another
      // tab/device's refresh) shows the farmer's own photo immediately instead of flashing the
      // satellite tile in first. A farmer who never uploads a photo gets undefined/null here and
      // every branch below behaves exactly as it did before this feature existed.
      const savedForBase = loadCanvasState(siteId);
      const savedBaseMode = designBaseMode(savedForBase);
      const customBase = savedBaseMode === 'photo' ? (savedForBase?.customBase ?? null) : null;
      // The farmer's own scale correction rides on top of whichever base is in play, so it must be
      // re-applied every time the frame is rebuilt — otherwise a reload silently reverts him to the
      // projection's metres, which is the very number he corrected.
      const savedScale = savedForBase?.scaleFactor;
      const withScale = <T extends { mPerPx: number }>(f: T): T => ({ ...f, mPerPx: scaledMPerPx(f.mPerPx, savedScale) });
      // A CUSTOM BASE CARRIES ITS OWN SCALE AND MUST NOT INHERIT THE SATELLITE'S CORRECTION.
      // scaleFactor is the farmer's correction to the SATELLITE's metres — measured against
      // satellite pixels. customBase.mPerPx comes from their two-point calibration on the drone
      // photo itself, which is already the truth for that image. Multiplying one by the other
      // scaled the photo by a number with nothing to do with it. Worse, the two code paths
      // disagreed: loadCustomBase set mPerPx raw while the branches below set it scaled, so the
      // photo's scale depended on whether the image fetch resolved before or after the frame
      // update — the same import could land at two different sizes on two loads, and no amount
      // of re-importing would settle it (Rory: "i couldnt adjust it once inserted").
      const baseMPerPx = (f: typeof frameNoImg) => activeBaseMPerPx(
        savedForBase,
        scaledMPerPx(f.mPerPx, savedScale),
      );
      const loadCustomBase = (targetFrame: typeof frameNoImg) => {
        if (!customBase) return;
        if (loadedCustomBaseUrlRef.current === customBase.url) return;
        const token = baseRequestRef.current;
        fetchImageAsDataUrl(customBase.url)
          .then((dataUrl) => {
            // The farmer switched base while this was in flight. Writing now would put these
            // pixels under the OTHER base's metres-per-pixel — see baseRequestRef.
            if (baseRequestRef.current !== token) return;
            // Keep the UNALIGNED original: every later nudge or rotation re-bakes from this, so
            // adjusting is a local redraw rather than a download, and repeated adjustments can
            // never compound one bake on top of the last. The alignment itself is applied by the
            // bake effect, which this bump wakes.
            customBaseSourceRef.current = { url: customBase.url, dataUrl };
            setCustomBaseSourceRev((r) => r + 1);
            loadedCustomBaseUrlRef.current = customBase.url;
            // mPerPx and the pixels are written TOGETHER, always. Splitting them is how a base
            // ends up measured by the other base's scale.
            setFrame((prev) => (prev ? { ...prev, satDataUrl: dataUrl, mPerPx: customBaseMPerPx(customBase) } : prev));
          })
          .catch(() => {
            if (baseRequestRef.current !== token) return;
            setFrame((prev) => (prev ? { ...prev, satDataUrl: null } : prev));
          });
      };
      // The satellite is fetched EVEN WHEN the farmer is on their own photo, and kept beside it as
      // the underlay. That is what gives a nudge something to be relative to: previously the photo
      // REPLACED the satellite, so "switch to satellite" read as "throw my photo away" and there
      // was no second image to line the first one up against.
      // Through fetchBasemapForFrame for the same reason the main path uses it — a provider branch
      // that skips it serves the wrong imagery silently.
      const loadUnderlay = (targetFrame: typeof frameNoImg) => {
        if (!customBase || !url) return;
        const key = `${targetFrame.centerLng},${targetFrame.centerLat},${targetFrame.zoom}`;
        if (loadedUnderlayKeyRef.current === key) return;
        fetchBasemapForFrame(targetFrame, url, fetchImageAsDataUrl)
          .then((dataUrl) => {
            loadedUnderlayKeyRef.current = key;
            setFrame((prev) => (prev ? { ...prev, underlayDataUrl: dataUrl } : prev));
          })
          // Esri can legitimately refuse (no ArcGIS key). Fall back to the Mapbox still — the
          // same two-step revertToSatellite uses — because an aligner with no backdrop is the
          // "no satellite underlay" complaint verbatim. Only the final failure stays silent:
          // the photo still works exactly as before, so it must not surface as a farmer error.
          .catch(() => {
            fetchImageAsDataUrl(url)
              .then((dataUrl) => {
                loadedUnderlayKeyRef.current = key;
                setFrame((prev) => (prev ? { ...prev, underlayDataUrl: dataUrl } : prev));
              })
              .catch(() => {});
          });
      };

      // Only touch the satellite (clear + refetch) when the frame centre/zoom actually
      // changed — otherwise keep whatever is already loaded and just update the non-image
      // frame fields, so an unrelated refresh (e.g. an external canvas-state change) can't
      // flash the satellite out and back in.
      const frameMoved =
        !lastFetchedFrame ||
        lastFetchedFrame.centerLng !== frameNoImg.centerLng ||
        lastFetchedFrame.centerLat !== frameNoImg.centerLat ||
        lastFetchedFrame.zoom !== frameNoImg.zoom;

      // SAFE MODE: THE DESIGN WITHOUT THE PIXELS (lib/crash-loop.ts). Skips the drone-photo
      // download, the satellite underlay and the supersampled bake — the three allocations that
      // make opening this page expensive — while every point the farmer drew loads normally.
      //
      // The metres come from activeBaseMPerPx, NOT from the blank branch below. Blank derives its
      // scale from the satellite projection, and handing a photo-based farm the satellite's metres
      // would silently rescale every area, spacing, tank size and price on the canvas and on all
      // nine sheets — the exact failure the base-request guard above exists to prevent. Safe mode
      // must cost the farmer their photograph for one load and nothing else.
      //
      // AN `else if` CHAIN, NOT AN EARLY RETURN. Everything below this block — the frame
      // migration and the setCanvasState that loads the farmer's zones, items and lines — must
      // still run. Returning here would open safe mode on an EMPTY design, which reads as "the
      // app lost my farm" and would be a far worse bug than the crash it is trying to survive.
      if (safeMode.active) {
        lastFetchedFrame = { centerLng: frameNoImg.centerLng, centerLat: frameNoImg.centerLat, zoom: frameNoImg.zoom };
        const metres = activeBaseMPerPx(savedForBase, withScale(frameNoImg).mPerPx);
        setFrame({ ...frameNoImg, mPerPx: metres, satDataUrl: null, underlayDataUrl: null });
      } else if (frameMoved) {
        lastFetchedFrame = { centerLng: frameNoImg.centerLng, centerLat: frameNoImg.centerLat, zoom: frameNoImg.zoom };
        if (savedBaseMode === 'blank') {
          // Blank is the printed-plan ground: no satellite or drone pixels, but the exact m/px
          // the farmer was using stays with the drawing. Never let this branch fall through to a
          // newly computed satellite frame — that would make the same visible beds measure anew.
          setFrame({ ...frameNoImg, mPerPx: baseMPerPx(frameNoImg), satDataUrl: null, underlayDataUrl: null });
        } else if (customBase) {
          setFrame((prev) => ({
            ...frameNoImg,
            mPerPx: customBaseMPerPx(customBase),
            satDataUrl: prev?.satDataUrl ?? null,
            underlayDataUrl: prev?.underlayDataUrl ?? null,
          }));
          loadCustomBase(frameNoImg);
          loadUnderlay(frameNoImg);
        } else {
          setFrame(withScale({ ...frameNoImg, satDataUrl: null }));
          if (url) {
            // Through fetchBasemapForFrame, not fetchImageAsDataUrl directly — see that function
            // for why. This is the surface the farmer actually uses; a provider branch that skips
            // it is a provider branch that does nothing.
            fetchBasemapForFrame(frameNoImg, url, fetchImageAsDataUrl)
              .then((dataUrl) => setFrame(withScale({ ...frameNoImg, satDataUrl: dataUrl })))
              .catch(() => setFrame(withScale({ ...frameNoImg, satDataUrl: null })));
          }
        }
      } else {
        if (savedBaseMode === 'blank') {
          setFrame({ ...frameNoImg, mPerPx: baseMPerPx(frameNoImg), satDataUrl: null, underlayDataUrl: null });
        } else {
          setFrame((prev) => ({
            ...frameNoImg,
            mPerPx: baseMPerPx(frameNoImg),
            satDataUrl: prev?.satDataUrl ?? null,
            underlayDataUrl: prev?.underlayDataUrl ?? null,
          }));
          loadCustomBase(frameNoImg);
          loadUnderlay(frameNoImg);
        }
      }

      // A frame migration is DERIVED, not authored: it fires on its own whenever the satellite
      // frame is recomputed (e.g. the farm shapes arriving a moment after the page seeded), with
      // NO user action behind it. persistCanvasState restamps updatedAt and counts rev forward,
      // so auto-persisting one hands an automatic write the credentials of a real edit — enough
      // to out-rank, and erase, a good cloud copy. Two rules, both load-bearing:
      //
      //  1. Zero content never persists. On a browser with no local snapshot refresh() seeds
      //     `zones: []`; the frame then recomputes and this empty migration was auto-persisted
      //     with updatedAt=NOW, which can beat the async reconcile and push EMPTY to the cloud.
      //     An empty automatic push has nothing to save and everything to lose.
      //  2. Nothing persists until reconcile has settled. Rule 1 alone is NOT enough: the seed is
      //     not always empty (loadSiteElements pre-seeds items), and a seed carrying two tanks
      //     clears rule 1 while still out-ranking the farmer's real cloud design. Until we have
      //     seen what the cloud holds, this device has no standing to claim it is newest.
      //
      // Declining costs nothing: the migration still applies IN MEMORY, and the farmer's next
      // real edit persists it (handleChange counts rev forward from the migrated state). A
      // migration is re-derived from the saved geometry on the next load anyway.
      const persistMigration = (s: DesignCanvasState): DesignCanvasState => {
        if (contentCountOf(s) === 0 || !cloudSettled.current) return s;
        return persistCanvasState(s) ?? s;
      };

      // Canvas state: load existing, or seed fresh from traced site elements on first visit.
      setCanvasState((prev) => {
        const existing = loadCanvasState(siteId);
        if (existing) {
          const migrated = migrateStateToFrame(existing, frameNoImg, project);
          // resolveBaseLayers reads migrated.zones — the Studio's own ZoneShape rings, already
          // re-normalised into this frame — so a Studio boundary/house/driveway wins here exactly
          // as it will later when DesignGlossy/DesignPrint/phasing/water-system/producer-labels
          // read this same refLayers state.
          const resolved = resolveBaseLayers(migrated, mapRefLayers);
          setRefLayers(resolved);
          setHouseXY(centroidOf(resolved.house));
          // Keep the stamped copy (bumped rev) when a migration was actually persisted; fall back
          // to the unstamped one if the save failed or was declined above, so the page still
          // shows the design either way.
          if (migrated !== existing) return persistMigration(migrated);
          return migrated;
        }
        if (prev && prev.siteId === siteId) {
          const migratedPrev = migrateStateToFrame(prev, frameNoImg, project);
          const resolved = resolveBaseLayers(migratedPrev, mapRefLayers);
          setRefLayers(resolved);
          setHouseXY(centroidOf(resolved.house));
          if (migratedPrev !== prev) return persistMigration(migratedPrev);
          return migratedPrev;
        }

        const fresh = freshState(siteId, frameNoImg);
        const siteElements = loadSiteElements(siteId);
        const items: PlacedItem[] = [];
        for (const el of siteElements) {
          const defId = SITE_ELEMENT_TO_DEF[el.type];
          if (!defId || !ELEMENTS_BY_ID[defId]) continue;
          const [x, y] = project([el.lon, el.lat]);
          items.push({ id: newId(), defId, x, y, label: el.label, note: el.note, status: 'proposed' });
        }
        const freshWithItems = { ...fresh, items };
        // fresh.zones is always [] (freshState seeds no zones — see freshState above), so this
        // resolves to mapRefLayers verbatim (source 'map'/'none' only). Still routed through
        // resolveBaseLayers rather than set directly, so first-visit and every later visit agree
        // on how a slot is decided.
        setRefLayers(resolveBaseLayers(freshWithItems, mapRefLayers));
        setHouseXY(centroidOf(houseRing));
        return freshWithItems;
      });
    };

    refresh();
    window.addEventListener(MAP_STATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(MAP_STATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSite, lat, lon, siteId]);

  // Cloud sync for this site's canvas state — a SEPARATE effect (own deps, own lifecycle)
  // from the frame/refresh effect above, so a sync hiccup can never affect satellite fitting
  // or vice versa. Reconcile once per site (merges + applies any newer remote state, which
  // surfaces here via the DESIGN_CANVAS_CHANGED_EVENT listener above — no direct state
  // update needed), then keep listening live while this device has the site open. No-ops
  // entirely when signed out; localStorage-only behaviour is unchanged.
  useEffect(() => {
    const uid = user?.uid;
    // Auth is still resolving: we do not yet know whether a cloud copy exists, so the gate stays
    // SHUT. Treating "not signed in yet" as "no cloud" would reopen the very race being fixed —
    // uid arrives a tick later and the automatic write we just allowed pushes after all.
    if (authLoading) {
      cloudSettled.current = false;
      return;
    }
    if (!uid || !hasSite) {
      // Genuinely signed out / no site: no cloud copy is coming, so nothing is waiting on one.
      // Without this the gate would stay shut forever and local-only farmers would silently stop
      // getting their frame migrations saved.
      cloudSettled.current = true;
      return;
    }
    cloudSettled.current = false;
    let cancelled = false;

    reconcileDesignCanvas(siteId)
      .then((winner) => {
        if (cancelled || !winner || winner.siteId !== siteId) return;
        // USE THE WINNER. reconcile's own applyRemoteCanvasState → change-event → refresh() path
        // is the normal way this lands, but it has two holes: on a quota-starved device the
        // localStorage write silently fails and refresh() re-reads the STALE snapshot, and a
        // concurrent self-save suppresses the refresh entirely. Both leave the open page showing
        // a copy the cloud already ruled against — i.e. the rescue never arrives. Dropping the
        // return value was what made those holes unrecoverable.
        setCanvasState((prev) => {
          // Nothing seeded yet: the frame effect is about to read this straight out of
          // localStorage (reconcile already wrote it) and migrate it properly. Don't race it
          // with an unmigrated copy.
          if (!prev || prev.siteId !== siteId) return prev;
          if (prev === winner) return prev;
          // Same rule reconcile/push/the live listener use — the page is a fourth party to the
          // same race and must not out-rank them with its own private test. In particular this
          // is what stops a slow reconcile from clobbering edits the farmer made while it was in
          // flight (those carry a higher rev and win here).
          if (pickWinner(prev, winner) !== winner) return prev;
          // The winner was fitted to whatever frame its own device computed. Re-normalise it into
          // the frame THIS page is rendering, or the geometry lands in the wrong place. No-ops
          // (returns `winner` unchanged) when the frames match, which is the common case.
          return preserveCanvasNavigation(
            migrateStateToFrame(winner, prev.frame, projectorForFrame(prev.frame)),
            prev,
          );
        });
      })
      .catch(() => {})
      // Settled either way: a reconcile that FAILED must not hold the gate shut forever, or an
      // offline farmer would lose their migrations to a promise that never resolves.
      .finally(() => {
        if (!cancelled) cloudSettled.current = true;
      });

    const unsubscribe = subscribeDesignCanvasLive(siteId);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authLoading, user?.uid, hasSite, siteId]);

  // Persist canvas state on change (with undo history), and re-run the advisor.
  const handleChange = useCallback(
    (updater: (prev: DesignCanvasState) => DesignCanvasState) => {
      setSaved(false);
      setCanvasState((prev) => {
        if (!prev) return prev;
        undoStack.current = [...undoStack.current, prev].slice(-MAX_UNDO);
        // A genuinely new edit invalidates whatever future we might have redone back to —
        // standard undo/redo semantics. Without this, undo → edit → redo would silently
        // resurrect a stale future state the farmer never asked for.
        redoStack.current = [];
        const next = updater(prev);
        const stamped = persistCanvasState(next);
        setSaved(!!stamped);
        setSaveError(stamped ? null : 'Storage full — your design is NOT being saved. Free up space, then re-open.');
        // Hold the STAMPED state so the next edit counts rev up from what was actually saved.
        return stamped ?? next;
      });
    },
    [],
  );

  // "Import your own photo" (Base step) — apply the farmer's calibrated photo as the base image
  // right away (no need to wait for the refresh effect's round trip), and persist it so it
  // survives a reload / follows to another device. Every existing tool (tracing, placed
  // elements, every plan sheet) only ever reads frame.satDataUrl + frame.mPerPx, so nothing else
  // needs to change for this to "just work" as the new base.
  const applyCustomBase = useCallback(
    (result: BasePhotoApplyResult) => {
      loadedCustomBaseUrlRef.current = result.url;
      loadedUnderlayKeyRef.current = null; // refetch the satellite to line the new photo up against
      // A freshly-imported photo arrives already aligned by the aligner itself, so its in-place
      // alignment starts at zero — and the preview IS the pristine original the re-bakes work from.
      customBaseSourceRef.current = { url: result.url, dataUrl: result.previewDataUrl };
      // FIT THE PHOTO TO THE DESIGN'S GROUND SCALE, don't redefine the ground scale from the photo.
      //
      // The two-point calibration says how many metres one baked pixel of THIS photo is worth. It
      // used to be written straight into the frame's metres-per-pixel — which silently redefined
      // what the whole frame measures. The design is stored in normalised 0..1 frame coordinates,
      // so it kept its pixels and changed its METRES: import a photo framed wider than the
      // satellite and the farm suddenly sat as a small patch in the middle of it (Rory, twice:
      // "still a problem inserting a photo out of scale!").
      //
      // The frame's ground meaning belongs to the satellite — Web-Mercator ground resolution,
      // times whatever correction the farmer measured with the ruler. So the calibration is used
      // to work out how much to ENLARGE the photo so its features match that scale, and the
      // frame's metres never move. The design keeps its ground correspondence, and the photo
      // arrives the right size against it.
      const { frame: satelliteFrame } = computeCanvasFrame(layers, lat, lon);
      const referenceMPerPx = scaledMPerPx(satelliteFrame.mPerPx, canvasState?.scaleFactor);
      const fitScale = Number.isFinite(referenceMPerPx) && referenceMPerPx > 0
        ? clampBaseScale(result.mPerPx / referenceMPerPx)
        : 1;
      handleChange((prev) => ({
        ...prev,
        baseMode: 'photo',
        useCustomBase: true,
        customBase: {
          url: result.url,
          mPerPx: result.mPerPx,
          uploadedAt: new Date().toISOString(),
          dx: 0,
          dy: 0,
          rotationDeg: 0,
          scale: fitScale,
        },
      }));
      // The frame keeps the ground scale the design was drawn against — customBaseMPerPx folds
      // the fit back out, so this equals referenceMPerPx whenever the fit was not clamped.
      setFrame((prev) => (prev
        ? {
          ...prev,
          mPerPx: customBaseMPerPx({ mPerPx: result.mPerPx, scale: fitScale }),
          satDataUrl: result.previewDataUrl,
        }
        : prev));
      setShowPhotoImport(false);
    },
    [handleChange, layers, lat, lon, canvasState?.scaleFactor],
  );

  // Paint-time alignment of the farmer's photo over the satellite. These write ONLY the display
  // fields on customBase — no item, zone, line or metre moves, which is what makes it safe to
  // offer as a free-hand nudge at all (see CustomBaseImage in lib/design-canvas.ts).
  //
  // THE BAKE IS DERIVED FROM THE SAVED ALIGNMENT, NEVER FIRED AT IT. The first cut re-baked
  // imperatively from the click handlers, which quietly made the handlers the only route to a
  // correct image — so every OTHER way the alignment can change left the saved value and the
  // painted pixels describing different things, with the eight plan sheets shipping whatever the
  // last imperative bake happened to leave behind:
  //   · undo/redo restored a different alignment and never repainted (before the bake existed,
  //     undo worked, because the canvas painted straight off customBase);
  //   · a cloud reconcile applying another device's alignment did the same;
  //   · a tap made before the photo finished downloading persisted the new angle against a bake
  //     that silently no-opped, and the late download then painted the OLD angle over it.
  // Keying an effect on the alignment itself makes all of that unrepresentable: whatever the
  // state says, the pixels follow, no matter who changed it.
  const [holdAlign, setHoldAlign] = useState<BaseAlignment | null>(null);
  const holdAlignRef = useRef<BaseAlignment | null>(null);
  const bakeTokenRef = useRef(0);
  useEffect(() => {
    const photo = designBaseMode(canvasState) === 'photo' ? canvasState?.customBase : null;
    if (!photo || !frame) return;
    const source = customBaseSourceRef.current;
    // The pristine original has not arrived yet. Whoever fetches it bumps customBaseSourceRev,
    // which re-runs this effect — baking from anything other than the original would stack one
    // transform on the last and walk the photo off the map.
    if (!source || source.url !== photo.url) return;
    // Bakes of different alignments take wildly different times: a zero alignment returns on the
    // next microtask while a rotation decodes and re-encodes a full-frame PNG. Without a
    // generation guard, "nudge too far, nudge back" lands the OUT bake last and ships pixels the
    // farmer already corrected.
    const token = bakeTokenRef.current + 1;
    bakeTokenRef.current = token;
    // While a button is held, the transient value is the one the farmer is watching — it has not
    // been persisted yet (see holdAlign), but it must still be what they SEE.
    const align = holdAlign ?? photo;
    bakeBaseAlignment(source.dataUrl, align, frame.imgW, frame.imgH, frame.underlayDataUrl)
      .then((baked) => {
        if (bakeTokenRef.current !== token) return;
        // RETURNING `prev` UNCHANGED IS LOAD-BEARING, not an optimisation. React bails out of a
        // state update that returns the identical object; handing back a fresh one every time
        // would re-fire this very effect, which would bake again — a loop that encodes a
        // full-frame PNG on every pass until the tab runs out of memory. That is exactly what
        // happened: Chrome killed the page with RESULT_CODE_HUNG.
        setFrame((prev) => (prev && prev.satDataUrl !== baked ? { ...prev, satDataUrl: baked } : prev));
      })
      // A failed bake leaves the previous image on screen, which is the last state the farmer
      // approved — strictly better than blanking their base over a redraw.
      .catch(() => {});
    // DEPEND ON THE FIELDS THIS BAKE READS, NEVER ON `frame` ITSELF. The effect writes to frame,
    // so depending on the whole object makes it its own trigger — the second half of the loop
    // above. Every field the bake actually uses is listed individually.
  }, [
    canvasState?.baseMode,
    canvasState?.useCustomBase,
    canvasState?.customBase,
    holdAlign,
    customBaseSourceRev,
    frame?.imgW,
    frame?.imgH,
    frame?.underlayDataUrl,
  ]);

  // The frame's metres must follow the SIZE the farmer is currently looking at, mid-gesture
  // included — otherwise the scale bar and every measurement lag a held resize by a whole
  // gesture and read as broken.
  useEffect(() => {
    const photo = designBaseMode(canvasState) === 'photo' ? canvasState?.customBase : null;
    if (!photo || !holdAlign) return;
    const live = customBaseMPerPx({ mPerPx: photo.mPerPx, scale: holdAlign.scale });
    setFrame((prev) => (prev && prev.mPerPx !== live ? { ...prev, mPerPx: live } : prev));
  }, [canvasState?.baseMode, canvasState?.useCustomBase, canvasState?.customBase, holdAlign]);

  // THE LIVE VALUE WHILE A BUTTON IS HELD DOWN. A held arrow fires many times a second, and
  // every one of those ticks going through handleChange would mean a localStorage write, a cloud
  // push and an UNDO ENTRY each — a two-second press would bury the farmer's real edit history
  // under fifty nudges and leave Undo useless. So a gesture accumulates here, un-persisted, and
  // commits exactly once when the button is released: one adjustment, one undo entry.

  const committedAlign = useCallback((): BaseAlignment => {
    const b = canvasState?.customBase;
    return {
      dx: b?.dx ?? 0,
      dy: b?.dy ?? 0,
      rotationDeg: b?.rotationDeg ?? 0,
      scale: b?.scale ?? 1,
    };
  }, [canvasState?.customBase]);

  // One step of any in-place control. Clamps, then updates only the transient value — the bake
  // effect repaints from it, so the farmer sees each step land without a single write to disk.
  const stepAlign = useCallback((patch: (a: BaseAlignment) => BaseAlignment) => {
    if (!canvasState?.customBase) return;
    const next = patch(holdAlignRef.current ?? committedAlign());
    const clamped: BaseAlignment = {
      dx: clampBaseNudge(next.dx),
      dy: clampBaseNudge(next.dy),
      rotationDeg: clampBaseRotation(next.rotationDeg),
      scale: clampBaseScale(next.scale),
    };
    holdAlignRef.current = clamped;
    setHoldAlign(clamped);
  }, [canvasState?.customBase, committedAlign]);

  // End of gesture: persist what the farmer arrived at, as a single edit.
  const commitAlign = useCallback(() => {
    const final = holdAlignRef.current;
    if (!final) return;
    holdAlignRef.current = null;
    setHoldAlign(null);
    handleChange((prev) => (prev.customBase
      ? { ...prev, customBase: { ...prev.customBase, ...final } }
      : prev));
  }, [handleChange]);

  const nudgeBase = useCallback((ddx: number, ddy: number) => {
    stepAlign((a) => ({ ...a, dx: (a.dx ?? 0) + ddx, dy: (a.dy ?? 0) + ddy }));
  }, [stepAlign]);

  // Resizing the photo IS a scale correction, so it deliberately moves the metres with it —
  // customBaseMPerPx folds `scale` into the frame's metres-per-pixel, which is what stops the
  // app measuring a picture at a size it is not being drawn at. A farmer whose calibration came
  // out too small can shrink the photo until its features sit on the satellite underneath, and
  // the areas and yields follow the correction instead of contradicting it.
  const scaleBase = useCallback((factor: number) => {
    stepAlign((a) => ({ ...a, scale: (a.scale ?? 1) * factor }));
  }, [stepAlign]);

  // Turning the photo, in place, without touching a single measurement — rotation preserves
  // distance, which is exactly why this control can exist where a scale handle never will.
  const rotateBase = useCallback((ddeg: number) => {
    stepAlign((a) => ({ ...a, rotationDeg: (a.rotationDeg ?? 0) + ddeg }));
  }, [stepAlign]);

  // PRESS AND HOLD. One tap is one step (the tick fires immediately); keeping the button down
  // starts repeating after a short delay and accelerates, so crossing the whole useful range is
  // a press rather than fifty clicks.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    commitAlign();
  }, [commitAlign]);

  const startHold = useCallback((tick: () => void) => {
    if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    tick();
    const startedAt = performance.now();
    const schedule = (delay: number) => {
      holdTimerRef.current = setTimeout(() => {
        tick();
        const held = performance.now() - startedAt - HOLD_FIRST_DELAY_MS;
        const ramp = Math.min(1, Math.max(0, held / HOLD_RAMP_MS));
        schedule(HOLD_START_INTERVAL_MS + (HOLD_MIN_INTERVAL_MS - HOLD_START_INTERVAL_MS) * ramp);
      }, delay);
    };
    schedule(HOLD_FIRST_DELAY_MS);
  }, []);

  // A pointer released outside the button, a cancelled gesture, or an unmount must still stop the
  // repeat and save — otherwise the timer runs on against a control the farmer has let go of.
  useEffect(() => () => {
    if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
  }, []);

  // Bound to pointer events rather than onClick: onClick only fires on release, so a held button
  // would sit dead until let go. Leaving and cancelling both end the gesture, so dragging off a
  // button stops it rather than leaving it running.
  const holdProps = useCallback((tick: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // Capture keeps the repeat alive if the finger slides slightly off the button, but it
      // THROWS for a pointer id the browser doesn't consider active. Letting that escape would
      // abort the handler before the repeat ever starts — the control would look dead.
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      startHold(tick);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
  }), [startHold, stopHold]);

  // What the controls READ OUT. Mid-gesture this is the un-persisted value, so the degrees and
  // the percentage track the photo while a button is held instead of lagging a whole gesture.
  const liveAlign: BaseAlignment = holdAlign ?? committedAlign();

  // Opacity is the one adjustment that stays a live paint rather than being baked: it exists to
  // see the satellite THROUGH the photo while lining the two up, and a half-transparent photo is
  // a working state, never something a delivered sheet should inherit.
  const setBaseOpacity = useCallback((v: number) => {
    handleChange((prev) => (prev.customBase
      ? { ...prev, customBase: { ...prev.customBase, opacity: clampBaseOpacity(v) } }
      : prev));
  }, [handleChange]);

  const resetBaseAlign = useCallback(() => {
    handleChange((prev) => (prev.customBase
      ? { ...prev, customBase: { ...prev.customBase, dx: 0, dy: 0, rotationDeg: 0, scale: 1, opacity: 1 } }
      : prev));
  }, [handleChange]);

  // Switch back to the real satellite view — the farmer's uploaded photo stays saved
  // (customBase is left untouched; only the useCustomBase flag flips), so switching back to
  // "your photo" later needs no re-upload or re-calibration.
  const revertToSatellite = useCallback(() => {
    // Claim the base: any photo fetch already in flight now belongs to a base the farmer has
    // moved on from, and must not write its image (or its scale) when it lands.
    const token = baseRequestRef.current + 1;
    baseRequestRef.current = token;
    // The photo is no longer painted, so the loaded-photo marker must not claim it is — otherwise
    // switching back finds the fetch "already done" and never repaints.
    loadedCustomBaseUrlRef.current = null;
    handleChange((prev) => ({ ...prev, baseMode: 'satellite', useCustomBase: false }));
    const { frame: freshFrame, url: satUrl } = computeCanvasFrame(layers, lat, lon);
    // Re-apply the farmer's ruler calibration. Reverting used to hand back the raw projection
    // metres, silently discarding the correction they measured on their own wall — so switching
    // away from a photo and back gave a satellite at a different scale than the one they left
    // (Rory: "when i asked to revert it gave the previous models satlite"). Every other place
    // that rebuilds the frame already re-applies this; this one was the gap.
    const revertMPerPx = scaledMPerPx(freshFrame.mPerPx, canvasState?.scaleFactor);
    setFrame((prev) => (prev ? { ...prev, mPerPx: revertMPerPx, satDataUrl: null, underlayDataUrl: null } : prev));
    if (satUrl) {
      // THROUGH fetchBasemapForFrame, never fetchImageAsDataUrl directly. That function is the one
      // place that decides who serves the photo, and its own doc warns that a second provider
      // branch somewhere else is how the wrong provider ships twice. This was that second branch:
      // reverting always fetched the Mapbox still regardless of the configured provider, so a
      // farmer on Esri who switched away from their drone photo and back got Mapbox imagery and no
      // indication why (Rory: "it gave the previous models satlite not even esris new one").
      // Both writes below carry the satellite's own metres, so a late arrival can never leave one
      // base's pixels under the other's scale — and both bail entirely if the farmer has since
      // switched back to their photo.
      const applySatellite = (dataUrl: string) => {
        if (baseRequestRef.current !== token) return;
        setFrame((prev) => (prev ? { ...prev, satDataUrl: dataUrl, mPerPx: revertMPerPx } : prev));
      };
      fetchBasemapForFrame(freshFrame, satUrl, fetchImageAsDataUrl)
        .then(applySatellite)
        // Esri can legitimately refuse (no ArcGIS key configured). Falling back to the Mapbox
        // still keeps a revert working rather than leaving the farmer on a blank canvas.
        .catch(() => {
          fetchImageAsDataUrl(satUrl)
            .then(applySatellite)
            .catch(() => {});
        });
    }
  }, [handleChange, layers, lat, lon, canvasState?.scaleFactor]);

  // Blank is not an empty canvas. It is the same design on the paper ground used by the printed
  // sheets, with no photograph beneath it. Save the live scale before removing the pixels: on a
  // calibrated drone base that number is the farmer's measurement, not a value we may recreate
  // from Web Mercator after the fact.
  const useBlankBase = useCallback(() => {
    const mPerPx = frame?.mPerPx;
    if (!Number.isFinite(mPerPx) || !mPerPx || mPerPx <= 0) return;
    baseRequestRef.current += 1;
    handleChange((prev) => setDesignBaseMode(prev, 'blank', mPerPx));
    setFrame((prev) => (prev
      ? { ...prev, mPerPx, satDataUrl: null, underlayDataUrl: null }
      : prev));
  }, [frame?.mPerPx, handleChange]);

  // The other half of revertToSatellite, which never existed. Reverting keeps `customBase` on
  // purpose — the whole point is that the photo comes back without a re-upload or a
  // re-calibration — but nothing in the UI could turn it back on, so "Switch to satellite view"
  // was a one-way door and the only route back was a from-scratch import: re-pick the file,
  // re-align it, re-measure the wall (Rory: "i still cant toggle on satelite or drone once the
  // dorne is added"). See basePhotoControls in lib/design-canvas.ts for the invariant.
  //
  // Toggling normally costs no download: the satellite currently painted as the base IS the
  // underlay the photo wants behind it, so it moves across in memory instead of being refetched.
  const restoreCustomBase = useCallback(() => {
    const saved = canvasState?.customBase;
    if (!saved) return;
    // Claim the base, so a satellite fetch still in flight from a just-tapped "Satellite" cannot
    // land afterwards and paint the tile while these photo metres are in force.
    const token = baseRequestRef.current + 1;
    baseRequestRef.current = token;
    handleChange((prev) => ({ ...prev, baseMode: 'photo', useCustomBase: true }));
    loadedCustomBaseUrlRef.current = null;
    // Reverting cleared the underlay; if the toggle was flipped before its refetch landed there
    // is nothing to hand across, and the key must be cleared or loadUnderlay decides it already
    // fetched this frame and never runs — leaving the farmer aligning against a blank backdrop.
    setFrame((prev) => {
      const carried = prev?.underlayDataUrl ?? prev?.satDataUrl ?? null;
      if (!carried) loadedUnderlayKeyRef.current = null;
      return prev ? { ...prev, mPerPx: customBaseMPerPx(saved), underlayDataUrl: carried } : prev;
    });
    fetchImageAsDataUrl(saved.url)
      .then((dataUrl) => {
        if (baseRequestRef.current !== token) return;
        // The pristine original goes in the ref; the bake effect applies the farmer's saved
        // alignment, so a photo that comes back comes back exactly as they left it.
        customBaseSourceRef.current = { url: saved.url, dataUrl };
        setCustomBaseSourceRev((r) => r + 1);
        loadedCustomBaseUrlRef.current = saved.url;
        setFrame((prev) => (prev ? { ...prev, satDataUrl: dataUrl, mPerPx: customBaseMPerPx(saved) } : prev));
      })
      // A photo that will not load must not leave the farmer on a satellite image being MEASURED
      // with the photo's metres-per-pixel — that is a silently wrong scale on every area and
      // yield. Going all the way back is the only consistent state, and revertToSatellite already
      // restores the projection metres and the right imagery provider.
      .catch(() => {
        if (baseRequestRef.current !== token) return;
        revertToSatellite();
      });
  }, [canvasState?.customBase, handleChange, revertToSatellite]);

  // Remove the photo from the design and go back to the satellite for good (Rory: "i just need a
  // delete drone photo button now"). Distinct from the Satellite toggle, which deliberately KEEPS
  // the photo so it can come back — this is the way to say "I am finished with that photo".
  //
  // It forgets the reference, not the uploaded file: the image stays in Storage, where it costs
  // nothing and cannot be lost by a mis-tap. Nothing about the DESIGN is touched — no item, zone,
  // line or metre — because the frame's ground scale never belonged to the photo in the first
  // place (see applyCustomBase), so the farm keeps its size on the satellite exactly as drawn.
  const deleteCustomBase = useCallback(() => {
    if (typeof window !== 'undefined'
      && !window.confirm('Remove your photo and go back to the satellite view?\n\nYour design is not affected.')) return;
    customBaseSourceRef.current = null;
    revertToSatellite();
    handleChange((prev) => ({ ...prev, customBase: null }));
  }, [handleChange, revertToSatellite]);

  const handleUndo = useCallback(() => {
    setSaved(false);
    setCanvasState((prev) => {
      const popped = undoStack.current.pop();
      if (!popped || !prev) {
        setSaved(true);
        return prev;
      }
      // Stash what we're undoing FROM so redo can bring it back — this is the only place
      // the pre-undo state is available; once we restore `popped` below it's gone otherwise.
      redoStack.current = [...redoStack.current, prev].slice(-MAX_UNDO);
      // An undo restores OLD CONTENT but is itself a NEW edit, so it must count rev forward from
      // where we are now (`prev`) — not from the stale rev the popped snapshot was saved with.
      // Bumping the popped rev instead makes consecutive undos emit DESCENDING revs (…13, 12,
      // 11…): the cloud copy would then out-rank each undo, reject the push, and the live
      // listener would apply the cloud copy straight back over it — an undo that visibly undoes
      // itself. Restoring content is never a reason to move the counter backwards.
      const stamped = persistCanvasState({ ...popped, rev: prev.rev });
      setSaved(true);
      return stamped ?? popped;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setSaved(false);
    setCanvasState((prev) => {
      const popped = redoStack.current.pop();
      if (!popped || !prev) {
        setSaved(true);
        return prev;
      }
      // Mirror of handleUndo: put the pre-redo state back on the undo stack so undo can
      // reverse this redo, same as any other edit.
      undoStack.current = [...undoStack.current, prev].slice(-MAX_UNDO);
      // Same rev reasoning as handleUndo: a redo is itself a NEW edit and must count rev
      // forward from `prev`, not from the stale rev the popped (redone) snapshot was saved
      // with — otherwise consecutive redos emit descending revs, the cloud copy out-ranks
      // them, and the live listener silently reverts the redo the farmer just asked for.
      const stamped = persistCanvasState({ ...popped, rev: prev.rev });
      setSaved(true);
      return stamped ?? popped;
    });
  }, []);

  // Delete whatever is selected (one or many items/zones/lines) — palette Delete + keyboard.
  const onDeleteSelected = selectedIds.length
    ? () => {
        const ids = new Set(selectedIds);
        setSelectedIds([]);
        handleChange((prev) => ({
          ...prev,
          items: prev.items.filter((i) => !ids.has(i.id)),
          zones: prev.zones.filter((z) => !ids.has(z.id)),
          lines: prev.lines.filter((l) => !ids.has(l.id)),
          updatedAt: new Date().toISOString(),
        }));
      }
    : null;

  // Duplicate whatever is selected (one or many items/zones/lines) — palette Duplicate button +
  // Cmd/Ctrl+D. Rory (on his phone, resizing a veg bed): "no easy way to duplicate a sized
  // element ... perhaps a copy and paste button?" This is the one-step version of the existing
  // Cmd/Ctrl+C -> Cmd/Ctrl+V clipboard flow below (same nudge-and-select pattern) but doesn't
  // touch `clipboard.current` — a farmer mid-workflow shouldn't have Duplicate silently clobber
  // whatever they last explicitly copied. Every override the original carries (wM/hM/rot on an
  // item, a zone's points/name/levelM, a line's points/name) survives verbatim via the spread —
  // that IS the point: duplicating a SIZED element, not the catalog default.
  // Selection can only ever contain shapes owned by the current step (setStep clears selectedIds
  // on every step change, and the canvas' own pointer-level guards refuse to select a foreign-step
  // shape in the first place — see ownedByCurrentStep), so no separate ownership re-check is
  // needed here; the Duplicate button is enabled/disabled purely off selectedIds, same as Delete.
  // What a bed block is made of. veg_bed is the standard growing bed in the catalog (1.2 x 3 m),
// and the block overrides wM/hM per item anyway — this just picks the icon, colour, name and
// agronomy rules every placed bed inherits.
const BED_BLOCK_DEF_ID = 'veg_bed';
const DUPLICATE_OFFSET = 0.03; // normalised; same nudge Cmd/Ctrl+V already uses below
  const onDuplicateSelected = selectedIds.length && canvasState
    ? () => {
        const ids = new Set(selectedIds);
        const offsetPt = (p: [number, number]): [number, number] => [
          Math.min(0.98, p[0] + DUPLICATE_OFFSET),
          Math.min(0.98, p[1] + DUPLICATE_OFFSET),
        ];
        const newItems: PlacedItem[] = canvasState.items
          .filter((it) => ids.has(it.id))
          .map((it) => ({ ...it, id: newId(), x: Math.min(0.98, it.x + DUPLICATE_OFFSET), y: Math.min(0.98, it.y + DUPLICATE_OFFSET), status: 'proposed' as const }));
        const newZones: ZoneShape[] = canvasState.zones
          .filter((z) => ids.has(z.id))
          .map((z) => ({ ...z, id: newId(), points: z.points.map(offsetPt) }));
        const newLines: LineShape[] = canvasState.lines
          .filter((l) => ids.has(l.id))
          .map((l) => ({ ...l, id: newId(), points: l.points.map(offsetPt) }));
        if (!newItems.length && !newZones.length && !newLines.length) return;
        handleChange((prev) => ({
          ...prev,
          items: [...prev.items, ...newItems],
          zones: [...prev.zones, ...newZones],
          lines: [...prev.lines, ...newLines],
          updatedAt: new Date().toISOString(),
        }));
        setSelectedIds([...newItems.map((i) => i.id), ...newZones.map((z) => z.id), ...newLines.map((l) => l.id)]);
      }
    : null;

  // Angle field (palette) for the selected item — only when exactly one item is selected (not a
  // zone/line, and not a multi-selection: selectedId is already null for both of those) AND its
  // def is rect-shaped, mirroring onDuplicateSelected/onDeleteSelected's null-means-hide
  // convention. Commits through handleChange, the SAME onChange/undo path the canvas's own
  // drag-rotate handle (endDragRotate in DesignCanvas.tsx) uses, so typing an angle and dragging
  // the rotate knob are two doors into one commit — one undo entry either way.
  // Now a GROUP control (Rory: "perhaps we can have a group angle and a group width/height?"):
  // applies to EVERY selected rect-shaped item, so a marquee'd row of beds turns together —
  // single selection is just the one-member case. Circles stay excluded (rotation-invariant).
  // Shows the first member's angle; committing aligns the whole group, which is the point.
  // Which zone the current selection IS, so the chip row shows what the farmer is holding
  // and not only what the draw tool will paint next. Rules (and the reasons each null is a
  // null) live with the helper in lib/design-canvas.ts, where they're unit-tested.
  const selectedZone = useMemo(
    () => (canvasState ? zoneOfSelection(canvasState.zones, selectedIds) : null),
    [canvasState, selectedIds],
  );

  /**
   * WHAT YOU HAVE SELECTED, SAID BACK TO YOU IN THE TOOL BAR.
   *
   * Rory: "if i select a polygon it doesnt highlight what it is in the tool bar — again, any
   * element no matter what, polygon tree irrigation etc, if selected must be highlighted in the
   * tool bar." Zone rings already did this (selectedZone lights its number chip); ground features,
   * lines and placed elements did not, so tapping a shape told you it was selected but never what
   * it WAS — and on a map of twenty grey polygons that is the only question you are asking.
   *
   * Deliberately a HIGHLIGHT and not an arming. Arming the tool would change what your next tap on
   * the map does — tapping a tree to identify it would leave you loaded to plant another one. The
   * chip lights so you can read it; tapping that chip still arms it, exactly as before.
   *
   * Single selection only: with three things selected there is no "what is it" to answer, and
   * lighting three chips at once would say something untrue about what a tap would do.
   */
  const selectedIdentity = useMemo(() => {
    if (!canvasState || selectedIds.length !== 1) return null;
    const id = selectedIds[0];
    const zone = canvasState.zones.find((z) => z.id === id);
    if (zone) return { feature: zone.feature ?? null, lineKind: null, defId: null };
    const line = canvasState.lines.find((l) => l.id === id);
    if (line) return { feature: null, lineKind: line.kind, defId: null };
    const item = canvasState.items.find((i) => i.id === id);
    if (item) return { feature: null, lineKind: null, defId: item.defId };
    return null;
  }, [canvasState, selectedIds]);

  /**
   * DRIP DOWN EVERY BED, IN ONE TAP.
   *
   * Rory: "when it comes to drip on veg beds i want to be able to auto click a button and auto drip
   * irrigation is pasted neatly down the centre of each bed, then we add the main pipe etc."
   *
   * The laterals are mechanical — one line down the middle of each bed, identical every time, and
   * a chore to draw twenty of. The mainline is a route across the farm past everything else, which
   * only the farmer can choose; guessing it would run a pipe through the house. So this does the
   * chore and stops, and the summary says so.
   */
  const dripBeds = useMemo(() => {
    if (!canvasState) return [];
    return canvasState.items.flatMap((item) => {
      if (!(BED_DEF_IDS as readonly string[]).includes(item.defId)) return [];
      const def = ELEMENTS_BY_ID[item.defId];
      if (!def) return [];
      return [{
        id: item.id,
        x: item.x,
        y: item.y,
        wM: item.wM ?? def.wM,
        hM: item.hM ?? def.hM,
        rot: item.rot,
        round: def.shape !== 'rect',
        label: item.label,
      }];
    });
  }, [canvasState]);

  const onDripAllBeds = frame && canvasState && dripBeds.length > 0
    ? () => {
        const existing = canvasState.lines.filter((l) => l.kind === 'drip').map((l) => ({ points: l.points }));
        const result = dripLinesForBeds(dripBeds, existing, frame);
        setDripNote(bedDripSummary(result));
        if (!result.changed) return;
        // Drip rides the Water layer. Forcing it on is not a nicety: this app has shipped the
        // "created, saved, and invisible because the step that made it had its layer off" bug
        // more than once, and a farmer who presses a button and sees nothing concludes it is
        // broken rather than hidden.
        setActiveLayers((prev) => (prev.water ? prev : { ...prev, water: true }));
        setWaterInfrastructureVisibility((prev) => (prev.drip ? prev : { ...prev, drip: true }));
        handleChange((prev) => ({
          ...prev,
          // ONE commit for every bed, so twenty laterals cost one undo rather than twenty.
          lines: [
            ...prev.lines,
            ...result.lines.map((line) => ({ id: newId(), kind: 'drip' as const, points: [...line.points] })),
          ],
          updatedAt: new Date().toISOString(),
        }));
      }
    : null;

  // Commit a whole block in ONE handleChange, so seven beds cost one undo, not seven — the same
  // single-commit rule the group angle and group size controls follow.
  const onPlaceBedBlock = useCallback((
    placements: BedBlockPlacement[],
    paths: Array<Array<[number, number]>> = [],
  ) => {
    if (!placements.length) return;
    handleChange((prev) => ({
      ...prev,
      // The paths ride in the SAME commit as the beds. Splitting them would make undo take the
      // beds and leave their paths behind, which is worse than either half.
      lines: [
        ...prev.lines,
        ...paths.map((points) => ({ id: newId(), kind: 'bedpath' as const, points })),
      ],
      items: [
        ...prev.items,
        ...placements.map((b) => ({
          id: newId(),
          defId: BED_BLOCK_DEF_ID,
          x: b.x,
          y: b.y,
          wM: b.wM,
          hM: b.hM,
          status: 'proposed' as const,
          // Spread rather than assign: rot is deliberately absent at natural orientation, and
          // writing `rot: undefined` would put an explicit undefined into the saved JSON.
          ...(b.rot != null ? { rot: b.rot } : {}),
        })),
      ],
    }));
    setBedBlockArmed(false);
  }, [handleChange]);

  const bedBlockControl = useMemo(
    () => ({
      spec: bedBlockSpec,
      armed: bedBlockArmed,
      onSpecChange: (next: Partial<BedBlockSpec>) =>
        setBedBlockSpec((prev) => normaliseBedBlockSpec({ ...prev, ...next })),
      onArm: () => {
        // Arm as a PLACEMENT tool with no element chosen: every drag/edit handler in the canvas
        // already bails on `tool !== 'select'`, so this one line disables item dragging, vertex
        // editing and the marquee for the duration without any of them knowing this mode exists.
        handleSetTool('place');
        setPlaceDefId(null);
        setBedBlockArmed(true);
      },
      onCancel: () => setBedBlockArmed(false),
    }),
    [bedBlockSpec, bedBlockArmed, handleSetTool],
  );

  const selectedRectItems = canvasState
    ? canvasState.items.filter(
        (it) => (selectedIds.includes(it.id) || it.id === selectedId) && ELEMENTS_BY_ID[it.defId]?.shape === 'rect',
      )
    : [];
  const angleControl = selectedRectItems.length
    ? {
        deg: selectedRectItems[0].rot ?? 0,
        onRotate: (deg: number) => {
          const ids = new Set(selectedRectItems.map((it) => it.id));
          handleChange((prev) => ({
            ...prev,
            items: prev.items.map((it) => (ids.has(it.id) ? { ...it, rot: normaliseRotation(deg) } : it)),
            updatedAt: new Date().toISOString(),
          }));
        },
      }
    : null;

  // Size control (palette) — scale EVERY selected placed item about its own centre. Born from a
  // live editing session (Rory: "i want to be able to resize all these beds all at once but i
  // cant"): the drag grips resize one item, so a row of seven duplicated beds meant seven
  // identical drags. Positions never move — each bed grows or shrinks in place, so the row's
  // spacing (the layout work he was mid-way through) survives. Same 0.3–40 m bounds as the
  // drag-resize path (DesignCanvas startDragResize), same handleChange funnel, so one tap is
  // exactly one undo entry. Zones/lines riding along in the selection are left untouched — a
  // ring's size is its traced points, and "10% bigger" on a traced shape is a different feature.
  const selectedItemIdSet = canvasState
    ? new Set(selectedIds.filter((id) => canvasState.items.some((it) => it.id === id)))
    : new Set<string>();
  const selectedItems = canvasState ? canvasState.items.filter((it) => selectedItemIdSet.has(it.id)) : [];
  // Common committed value across the selection, or null when mixed — the palette field then
  // shows a '—' placeholder and only overwrites when the farmer actually types a number.
  const commonDim = (dim: 'wM' | 'hM'): number | null => {
    const vals = selectedItems
      .map((it) => it[dim] ?? ELEMENTS_BY_ID[it.defId]?.[dim])
      .filter((v): v is number => Number.isFinite(v));
    if (!vals.length) return null;
    return vals.every((v) => Math.abs(v - vals[0]) < 0.005) ? vals[0] : null;
  };
  const sizeControl = selectedItemIdSet.size
    ? {
        onScale: (factor: number) => {
          handleChange((prev) => ({
            ...prev,
            items: prev.items.map((it) => {
              if (!selectedItemIdSet.has(it.id)) return it;
              const def = ELEMENTS_BY_ID[it.defId];
              const wM = it.wM ?? def?.wM;
              const hM = it.hM ?? def?.hM;
              if (!Number.isFinite(wM) || !Number.isFinite(hM)) return it;
              const scaled = (v: number) => Math.min(40, Math.max(0.3, v * factor));
              return { ...it, wM: scaled(wM as number), hM: scaled(hM as number) };
            }),
            updatedAt: new Date().toISOString(),
          }));
        },
        // Exact W/H in metres for the whole selection (Rory, after ± landed: "it rezises one way
        // how do we do the width now? … with beds we need to be specific" → "perhaps we can have
        // a group angle and a group width/height?"). A circle has one size, so either field sets
        // its diameter; rects take the dimension typed. Same bounds and undo funnel as ±.
        onSetDim: (dim: 'wM' | 'hM', value: number) => {
          if (!Number.isFinite(value)) return;
          const v = Math.min(40, Math.max(0.3, value));
          handleChange((prev) => ({
            ...prev,
            items: prev.items.map((it) => {
              if (!selectedItemIdSet.has(it.id)) return it;
              const def = ELEMENTS_BY_ID[it.defId];
              if (def?.shape === 'circle') return { ...it, wM: v, hM: v };
              return { ...it, [dim]: v };
            }),
            updatedAt: new Date().toISOString(),
          }));
        },
        wM: commonDim('wM'),
        hM: commonDim('hM'),
      }
    : null;

  // SCALE CALIBRATION — the farmer's ground truth beats the projection. He measures a length he
  // knows with the canvas ruler, states what it really is, and every metre in the app follows:
  // item footprints, areas, spacings, tank sizing and every plan sheet all read through mPerPx.
  // Applied to the live frame immediately (no reload round-trip, exactly like applyCustomBase)
  // AND persisted as a multiplier so it survives reloads and follows to his other devices.
  // Geometry is untouched — saved points are normalised to the frame; only the metres they are
  // worth change, which is the thing in dispute.
  const onCalibrateScale = useCallback(
    (measuredM: number, trueM: number) => {
      if (!Number.isFinite(measuredM) || !Number.isFinite(trueM) || measuredM <= 0 || trueM <= 0) return;
      const factor = trueM / measuredM;
      handleChange((prev) => {
        // ON A CUSTOM BASE the correction belongs to the PHOTO's own calibration, not to
        // scaleFactor — scaleFactor is the satellite's correction and the custom-base frame
        // path ignores it BY DESIGN. Writing it here anyway produced the cruellest possible
        // behaviour: setFrame below patched the display instantly (looked fixed), then this
        // very save re-ran the frame effect, which recomputed mPerPx from the untouched
        // customBase.mPerPx — the act of saving the correction reverted it on screen
        // (Rory: "look what it did to the scale i inserted at the right scale").
        if (designBaseMode(prev) === 'photo' && prev.customBase) {
          const corrected = prev.customBase.mPerPx * factor;
          if (!Number.isFinite(corrected) || corrected <= 0) return prev;
          return {
            ...prev,
            customBase: { ...prev.customBase, mPerPx: corrected },
            updatedAt: new Date().toISOString(),
          };
        }
        const next = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, (prev.scaleFactor ?? 1) * factor));
        return { ...prev, scaleFactor: next, updatedAt: new Date().toISOString() };
      });
      setFrame((prev) => (prev ? { ...prev, mPerPx: scaledMPerPx(prev.mPerPx, factor) } : prev));
    },
    [handleChange],
  );

  // Wind control (palette, Sector step) — the farmer's confirm/override for the regional wind
  // used to phrase the "prevailing wind" question (lib/local-wind.ts's own policy note on why
  // summer_cooling, not the fire/berg wind, is what "prevailing" asks about). Independent of
  // DesignCanvas's own sectorModel (computed there for the overlay/dataNotes chip) — this needs
  // only the named-wind table, not the full sun/water/frost derivation, so resolveRegion is the
  // lighter, more direct call. Reads `glossySite` (the full SectorSite, incl. rainfallPattern —
  // the SAME object already passed to DesignCanvas as `sectorSite`), not the leaner local `site`
  // (SiteCtx) which has no rainfallPattern at all. null regional is a valid, honest outcome (no
  // regional table for this area) the control itself still renders for — see DesignPalette's
  // windControl doc comment.
  const regionalWind = useMemo(() => {
    if (lat == null || !Number.isFinite(lat)) return null;
    const region = resolveRegion(lat, lon, glossySite?.biome, glossySite?.rainfallPattern);
    return regionalPrevailingPick(region.namedWind);
  }, [lat, lon, glossySite?.biome, glossySite?.rainfallPattern]);
  const windControl = canvasState
    ? {
        regional: regionalWind,
        observation: canvasState.localWind ?? null,
        onSet: (observation: LocalWindObservation | null) => {
          handleChange((prev) => ({ ...prev, localWind: observation ?? undefined, updatedAt: new Date().toISOString() }));
        },
      }
    : null;

  // Tidy outline (lib/tidy-outline.ts) — offered only when exactly one ZONE or LINE is selected
  // (selectedId is already null for both "nothing selected" and "multiple selected" — see
  // selectedItemForAngle's doc comment above for the same convention; a placed item has no
  // ring/polyline to tidy, so it is excluded the same way angleControl excludes zones/lines).
  const selectedZoneForTidy = selectedId ? canvasState?.zones.find((z) => z.id === selectedId) ?? null : null;
  const selectedLineForTidy = selectedZoneForTidy ? null : selectedId ? canvasState?.lines.find((l) => l.id === selectedId) ?? null : null;

  // A swale's length is a readout of the line the farmer already traced, never a replacement
  // geometry. The width field is deliberately optional too: only a width the farmer enters is
  // saved and later printed. A drawing legibility floor may help a narrow mark be seen, but it
  // must never turn into a claimed construction dimension.
  const swaleControl = selectedLineForTidy?.kind === 'swale' && frame
    ? {
        widthM: selectedLineForTidy.widthM,
        lengthM: selectedLineForTidy.points.slice(1).reduce((total, point, index) => {
          const previous = selectedLineForTidy.points[index];
          return total + Math.hypot(
            (point[0] - previous[0]) * frame.imgW,
            (point[1] - previous[1]) * frame.imgH,
          ) * frame.mPerPx;
        }, 0),
        onSetWidth: (raw: string) => {
          const widthM = parseSwaleWidthM(raw);
          if (widthM === null) return false;
          if (widthM === selectedLineForTidy.widthM) return true;
          handleChange((prev) => ({
            ...prev,
            // Keep every traced point byte-for-byte as drawn. This control changes the stated
            // disturbed-ground width for presentation, not the farmer's mapped earthwork route.
            lines: prev.lines.map((line) => line.id === selectedLineForTidy.id ? { ...line, widthM } : line),
            updatedAt: new Date().toISOString(),
          }));
          return true;
        },
      }
    : null;
  // Tapping Tidy only COMPUTES and OPENS a preview — it never itself edits the design. See
  // DesignCanvas's tidyPreview prop for the overlay + confirm/cancel panel this feeds.
  const onTidySelected = (selectedZoneForTidy || selectedLineForTidy) && frame
    ? () => {
        const kind: 'zone' | 'line' = selectedZoneForTidy ? 'zone' : 'line';
        const shapePoints = selectedZoneForTidy ? selectedZoneForTidy.points : selectedLineForTidy!.points;
        const tidied = tidyOutline(shapePoints, { frame, closed: kind === 'zone' });
        // …AND THEN SQUARE IT (Rory: "i think tidy option should also work on making something
        // square — it's difficult to get things square or rectangular by inserting points").
        // One button, two operations, in the order that makes both work: dropping the redundant
        // points first means the squaring sees the walls the farmer meant rather than a wall
        // broken into three near-collinear fragments that each snap somewhere slightly different.
        //
        // Only rings, and only rings that were ALREADY nearly rectilinear — squareUp declines a
        // contour or an organic boundary itself, so a swale can be tidied without being flattened
        // into a polygon of right angles. Everything squareUp does is bounded and reversible, and
        // it hands back the array it was given when it declines, so this composes safely.
        const base = tidied.changed ? tidied.points : shapePoints;
        const squared = kind === 'zone' ? squareUp(base, { frame }) : null;
        const result = squared?.changed
          ? {
              ...tidied,
              points: squared.points,
              changed: true,
              // The farmer sees both halves of what one tap did, in the order it happened.
              reason: tidied.reason,
              maxMovedM: Math.max(tidied.maxMovedM, squared.maxMovedM),
            }
          : tidied;
        setSnapPreview(null); // only one pending preview action at a time
        setTidyPreview({ id: selectedId!, kind, result, squared: squared?.changed ? squared : null });
      }
    : null;
  // Confirm commits through handleChange — the SAME onChange/undo path every other edit in this
  // file uses (Delete/Duplicate/the Angle field/the drag handles all funnel through it too) — so
  // this is exactly ONE undo entry, and undo restores the pre-tidy points verbatim like any other
  // edit. Only offered when the preview actually changed something (result.changed); "nothing to
  // change" previews show no Confirm button at all (see DesignCanvas's canConfirm).
  const onConfirmTidy = tidyPreview && tidyPreview.result.changed
    ? () => {
        const preview = tidyPreview;
        handleChange((prev) => ({
          ...prev,
          zones: preview.kind === 'zone'
            ? prev.zones.map((z) => (z.id === preview.id ? { ...z, points: preview.result.points } : z))
            : prev.zones,
          lines: preview.kind === 'line'
            ? prev.lines.map((l) => (l.id === preview.id ? { ...l, points: preview.result.points } : l))
            : prev.lines,
          updatedAt: new Date().toISOString(),
        }));
        setTidyPreview(null);
      }
    : null;
  // Cancel changes nothing — just drops the preview. No handleChange call, so no undo entry is
  // created (there is nothing to undo: the design was never touched).
  const onCancelTidy = tidyPreview ? () => setTidyPreview(null) : null;

  // Snap every selected ring in one preview. Mixed selections (items or lines) disable the action;
  // a boundary may be part of a ring selection but is explicitly reported unchanged. The
  // single-ring engine remains the safety authority for every movable member.
  const selectedZonesForSnap: ZoneShape[] = selectedIds.length > 0 && canvasState
    ? selectedIds
        .map((id) => canvasState.zones.find((zone) => zone.id === id))
        .filter((zone): zone is ZoneShape => !!zone)
    : [];
  const snapSelectionIsRings = selectedZonesForSnap.length === selectedIds.length;
  const snapSelectionHasMovableRing = selectedZonesForSnap.some((zone) => zone.feature !== 'boundary');
  const toBulkSnapRing = (zone: ZoneShape): BulkSnapRing => ({
    id: zone.id,
    label: zone.name ?? (zone.feature ? GROUND_FEATURES[zone.feature].label : `Zone ${zone.zone}`),
    kind: (zone.feature ?? 'zone') as SnapRingKind,
    points: zone.points,
  });
  // Tapping Snap computes only. The original design stays untouched until the single Confirm.
  const onSnapSelected = snapSelectionIsRings && snapSelectionHasMovableRing && frame && canvasState
    ? () => {
        const rings = selectedZonesForSnap.map(toBulkSnapRing);
        const all = canvasState.zones.map(toBulkSnapRing);
        const near = snapSelectedRings(rings, all, { frame });
        // REACHING FURTHER, ON PURPOSE (Rory: "ok it doesnt work if its to far").
        //
        // The default reach is deliberately short — 1.5 m on a plain zone ring, 0.5 m on traced
        // ground — because two shapes traced 3 m apart were traced that way by a real finger and
        // closing that silently would be the app editing the farm. But refusing and saying nothing
        // useful is its own failure: the gap the farmer wants closed is usually the one just
        // outside the default, and "nothing happened" gives them nowhere to go.
        //
        // So when the short reach finds nothing, try a long one. If THAT finds something it is
        // offered as a normal preview with the distance named in the sentence, and it still only
        // happens on the farmer's confirm tap. Nothing is snapped further than they can see.
        const reached = near.changed
          ? null
          : snapSelectedRings(rings, all, { frame, toleranceM: SNAP_REACH_M });
        const result = near.changed ? near : (reached?.changed ? reached : near);
        setTidyPreview(null); // only one pending preview action at a time
        setCleanupPreview(null);
        setSnapPreview({ ids: [...selectedIds], result, reached: !near.changed && !!reached?.changed });
      }
    : null;
  // Confirm commits through handleChange — the SAME onChange/undo path onConfirmTidy (and every
  // other edit in this file) uses, so this is exactly ONE undo entry and undo restores the
  // pre-snap points verbatim like any other edit.
  const onConfirmSnap = snapPreview?.result.changed
    ? () => {
        const preview = snapPreview;
        const updates = new Map(preview.result.updates.map((update) => [update.id, update.points]));
        handleChange((prev) => ({
          ...prev,
          zones: prev.zones.map((zone) => {
            const points = updates.get(zone.id);
            return points ? { ...zone, points } : zone;
          }),
          updatedAt: new Date().toISOString(),
        }));
        setSnapPreview(null);
      }
    : null;
  // Cancel changes nothing — just drops the preview, same as onCancelTidy.
  const onCancelSnap = snapPreview ? () => setSnapPreview(null) : null;

  // Clean up (lib/align-items.ts) — offered only when 2+ PLACED ITEMS are selected and nothing
  // else is mixed into the selection (a zone or line caught in the same multi-select means there
  // is no group of PlacedItems to straighten, so this stays hidden — mirrors
  // selectedZoneForTidy/selectedZoneForSnap's "wrong shape kind => null" convention). Deliberately
  // NOT gated to exactly one item like Tidy/Snap — see lib/align-items.ts's module doc for why
  // this action is the one deliberately scoped to a group.
  const selectedItemsForCleanup: PlacedItem[] = selectedIds.length >= 2 && canvasState
    ? selectedIds.map((id) => canvasState.items.find((it) => it.id === id)).filter((it): it is PlacedItem => !!it)
    : [];
  // Tapping Clean up only COMPUTES and OPENS a preview — it never itself edits the design, same
  // as Tidy/Snap. See DesignCanvas's cleanupPreview prop for the overlay + confirm/cancel panel
  // this feeds.
  const onCleanupSelected =
    selectedItemsForCleanup.length === selectedIds.length && selectedItemsForCleanup.length >= 2 && frame
      ? () => {
          const inputItems: AlignInputItem[] = selectedItemsForCleanup.map((it) => ({
            id: it.id,
            x: it.x,
            y: it.y,
            rot: it.rot,
            shape: (ELEMENTS_BY_ID[it.defId]?.shape ?? 'rect') as 'rect' | 'circle',
          }));
          const result = alignAndDistribute(inputItems, { frame });
          setTidyPreview(null); // only one pending preview action at a time
          setSnapPreview(null);
          setCleanupPreview({ ids: selectedIds, result });
        }
      : null;
  // Confirm commits through handleChange — the SAME onChange/undo path every other edit in this
  // file uses, so this is exactly ONE undo entry and undo restores every pre-cleanup position AND
  // rotation verbatim, like any other edit. Only offered when the preview actually changed
  // something (result.changed); "nothing to change" previews show no Confirm button at all (see
  // DesignCanvas's canConfirm).
  const onConfirmCleanup = cleanupPreview && cleanupPreview.result.changed
    ? () => {
        const preview = cleanupPreview;
        const byId = new Map(preview.result.items.map((it) => [it.id, it]));
        handleChange((prev) => ({
          ...prev,
          items: prev.items.map((it) => {
            const aligned = byId.get(it.id);
            return aligned ? { ...it, x: aligned.x, y: aligned.y, rot: aligned.rot } : it;
          }),
          updatedAt: new Date().toISOString(),
        }));
        setCleanupPreview(null);
      }
    : null;
  // Cancel changes nothing — just drops the preview, same as onCancelTidy/onCancelSnap.
  const onCancelCleanup = cleanupPreview ? () => setCleanupPreview(null) : null;

  // Desktop keyboard shortcuts for the canvas (power-user / facilitator convenience; phones
  // don't have these keys). Cmd/Ctrl+Z = undo · Delete/Backspace = delete the selected
  // element · Escape = deselect. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (undoStack.current.length > 0) { e.preventDefault(); handleUndo(); }
        return;
      }
      // Redo: Cmd/Ctrl+Shift+Z (standard on both Mac and Windows), plus Ctrl+Y for the
      // non-Mac convention — mirrors the modifier-key detection undo already uses above.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) {
        if (redoStack.current.length > 0) { e.preventDefault(); handleRedo(); }
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        if (redoStack.current.length > 0) { e.preventDefault(); handleRedo(); }
        return;
      }
      // Cmd/Ctrl+C — copy selected placed items, polygons AND lines to the clipboard.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
        const sel = new Set(selectedIds);
        const copied = {
          items: (canvasState?.items ?? []).filter((it) => sel.has(it.id)),
          zones: (canvasState?.zones ?? []).filter((z) => sel.has(z.id)),
          lines: (canvasState?.lines ?? []).filter((l) => sel.has(l.id)),
        };
        if (copied.items.length || copied.zones.length || copied.lines.length) {
          e.preventDefault();
          clipboard.current = copied;
        }
        return;
      }
      // Cmd/Ctrl+V — paste copies, nudged down-right, and select the new ones.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        const clip = clipboard.current;
        if (!clip.items.length && !clip.zones.length && !clip.lines.length) return;
        e.preventDefault();
        const offsetPt = (p: [number, number]): [number, number] => [
          Math.min(0.98, p[0] + 0.03),
          Math.min(0.98, p[1] + 0.03),
        ];
        const pastedItems: PlacedItem[] = clip.items.map((it) => ({
          ...it,
          id: newId(),
          x: Math.min(0.98, it.x + 0.03),
          y: Math.min(0.98, it.y + 0.03),
          status: 'proposed',
        }));
        const pastedZones: ZoneShape[] = clip.zones.map((z) => ({ ...z, id: newId(), points: z.points.map(offsetPt) }));
        const pastedLines: LineShape[] = clip.lines.map((l) => ({ ...l, id: newId(), points: l.points.map(offsetPt) }));
        handleChange((prev) => ({
          ...prev,
          items: [...prev.items, ...pastedItems],
          zones: [...prev.zones, ...pastedZones],
          lines: [...prev.lines, ...pastedLines],
          updatedAt: new Date().toISOString(),
        }));
        setSelectedIds([...pastedItems.map((p) => p.id), ...pastedZones.map((z) => z.id), ...pastedLines.map((l) => l.id)]);
        return;
      }
      // Cmd/Ctrl+D — duplicate the current selection in place (nudged), mirroring the palette's
      // Duplicate button. Reuses onDuplicateSelected so both paths run the exact same logic.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        if (onDuplicateSelected) {
          e.preventDefault();
          onDuplicateSelected();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length && onDeleteSelected) {
        e.preventDefault();
        onDeleteSelected();
        return;
      }
      if (e.key === 'Escape' && selectedIds.length) setSelectedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, onDeleteSelected, onDuplicateSelected, selectedIds, canvasState, handleChange]);

  // Step navigation must NOT push an undo entry — otherwise Undo bounces the farmer
  // between wizard steps instead of reverting their last content edit (item/zone/line
  // change). It must ALSO not count as an edit: see saveCanvasNavigation below.
  const setStep = useCallback((step: WizardStep) => {
    // The ground-feature chips live only on the Base step; clear any armed feature on a step
    // change so a still-armed 'house' can't silently stamp a plain zone drawn on another step.
    setAreaFeature(null);
    // Zone advice pins are only meaningful on the zones step — clear them on any step change.
    setZoneAdvice([]);
    // A shape selected before switching steps must not stay selected once its step locks it —
    // otherwise Delete/Backspace (app/design/page.tsx's keyboard handler acts on selectedIds
    // unconditionally) can still remove a shape the canvas is visibly rendering as inert/locked
    // context, the one gap step-locking's own pointer-level guards don't cover (adversarial
    // review of the step-locking feature, 2026-07-21).
    setSelectedIds([]);
    // AUTO-FOCUS the step's own layer (Rory: "when we move to a layer, switch that layer on and
    // the others off"). Only the ELEMENT layers are focused; context layers (references, ground/
    // Existing, labels, contours) are left exactly as the farmer set them — you always need the
    // satellite + existing site to place against. Fires once per explicit step tap (not on
    // re-render or remote sync), so a manual toggle mid-step is never stomped until the next tap.
    setActiveLayers((a) => ({ ...a, ...applyStepFocus(step) }));
    // Water's detailed switches are for explaining an already-dense drawing, never a way to
    // strand the next thing a farmer places. Returning to the Water step restores every
    // sublayer before its placement tools are offered.
    if (step === 'water') setWaterInfrastructureVisibility(DEFAULT_WATER_INFRASTRUCTURE_VISIBILITY);
    setCanvasState((prev) => {
      if (!prev) return prev;
      // NAVIGATION IS NOT AN EDIT. This used to go through persistCanvasState, which restamps
      // updatedAt AND counts rev forward — the two fields cloud sync ranks copies by. That is
      // what weaponises a stale snapshot: a device holding an out-of-date copy could promote it
      // to "newest" just by TAPPING A STEP, then win the merge and clobber a good cloud copy,
      // with the farmer never having touched their design. Same class of bug as the one that
      // already destroyed a user's zones.
      //
      // Chosen over dropping `step` from the synced payload because that is the bigger change:
      // step lives inside DesignCanvasState, which is stored/pushed/merged as ONE blob, so
      // excluding it would mean teaching push, reconcile AND the live listener to merge a single
      // field specially — three sync paths to keep in agreement, on working code we cannot
      // click-test. Writing the step through verbatim leaves the counters saying exactly what
      // they said before the tap, which is the truth, and touches one call site.
      const next = { ...prev, step };
      withSelfSaveFlag(() => saveCanvasNavigation(next));
      return next;
    });
  }, []);

  // Step-by-step guide "Do this" → arm the matching palette tool for the current micro-task.
  const armSubStep = useCallback((arm: SubStepArm) => {
    if (!arm) return;
    switch (arm.kind) {
      case 'place':
        setAreaFeature(null);
        setPlaceDefId(arm.defId);
        handleSetTool('place');
        break;
      case 'line':
        setLineKind(arm.lineKind);
        handleSetTool('line');
        break;
      case 'zone':
        setAreaFeature(null);
        setZoneDraw(arm.zone);
        handleSetTool('zone');
        break;
      case 'area':
        setAreaFeature(arm.feature);
        handleSetTool('zone');
        break;
    }
  }, [handleSetTool]);

  // One-shot: a "+ Add → Lawn / Veg garden / New bed" tap on the farmer map deep-links here
  // as /design?add=<id>. Arm the matching ground-feature area tool on the Base step so the
  // farmer lands ready to draw the thing they picked (the discoverability handoff).
  const addParamHandled = useRef(false);
  useEffect(() => {
    if (addParamHandled.current || !canvasState) return;
    const add = params.get('add') as AddActionId | null;
    if (!add) return;
    addParamHandled.current = true;
    const feature = STUDIO_AREA_FOR[add];
    if (!feature) return;
    setStep('base');            // clears any armed feature…
    setAreaFeature(feature);    // …so set the picked one AFTER
    handleSetTool('zone');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasState]);

  // One-shot: the "Just beds & trees" quick start deep-links here as /design?simple=1 — drop
  // the farmer straight onto the Planting step in Guided mode (skip the water/zones planning
  // they said they don't want). The step guide then walks trees → beds → "Plan my crops".
  const simpleHandled = useRef(false);
  useEffect(() => {
    if (simpleHandled.current || !canvasState) return;
    if (params.get('simple') !== '1') return;
    simpleHandled.current = true;
    setDesignMode('guided');
    setStep('planting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasState]);

  // Arm a zone chip so the FARMER draws it — the tap-a-pin half of the guidance hybrid.
  // Never commits geometry.
  const armZoneFromAdvice = useCallback(
    (zone: 0 | 1 | 2 | 3 | 4 | 5) => {
      setZoneDraw(zone);
      setAreaFeature(null);
      handleSetTool('zone');
    },
    [handleSetTool],
  );

  // "Where do my zones go?" — run the INSTANT deterministic zone planner (no network) and
  // convert its rings to advice pins. Nothing lands in canvasState.zones.
  const runZoneAdvice = useCallback(() => {
    if (!canvasState || !frame) return;
    if (refLayers.boundary.length < 3) {
      setDetectError('Trace your boundary on the main map first.');
      return;
    }
    setDetectError(null);
    const structures = canvasState.items
      .filter((i) => ELEMENTS_BY_ID[i.defId]?.category === 'structure')
      .map((i) => ({ x: i.x, y: i.y, wM: i.wM ?? ELEMENTS_BY_ID[i.defId].wM, hM: i.hM ?? ELEMENTS_BY_ID[i.defId].hM }));
    const existingVeg = canvasState.items
      .filter((i) => {
        const def = ELEMENTS_BY_ID[i.defId];
        // 'earthworks' as well as 'growing': the intensive beds this planner keys off (keyhole
        // bed, herb spiral, banana circle, mulch bank) are earthworks now, and dropping them
        // would quietly stop the zone rings being pulled toward the farmer's real growing spots.
        return (def?.category === 'growing' || def?.category === 'earthworks')
          && !!def.zoneRec?.some((z) => z === 1 || z === 2);
      })
      .map((i) => ({ x: i.x, y: i.y }));
    const zoneOpts = {
      frame: { imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx },
      driveway: refLayers.driveway,
      site,
      structures,
      existingVeg,
    };
    setZoneAdvice(zoneAdviceFromSuggestions(suggestZones(refLayers.boundary, refLayers.house, zoneOpts)));
  }, [canvasState, frame, refLayers, site]);

  const editItem = editItemId ? canvasState?.items.find((i) => i.id === editItemId) ?? null : null;

  if (!hasSite) return <EmptyState />;

  // Saved-place name (effect-resolved) with coordinates as the fallback.
  const siteName = placeName ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        color: DARK,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderBottom: `1px solid rgba(11,18,11,0.12)`,
          background: PAPER,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Link
          href="/farmer"
          aria-label="Back to map"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(31,77,43,0.08)',
            color: GREEN,
          }}
        >
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, flexShrink: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Design Studio</span>
          <span style={{ fontSize: 12, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteName}</span>
        </div>
        <span style={{ flexShrink: 0, display: isPhone ? 'none' : undefined }}>
          <LessonLink id="design:overview" label="Learn" />
        </span>
        <button
          type="button"
          onClick={toggleDesignMode}
          aria-label={`Switch to ${designMode === 'pro' ? 'Guided' : 'Pro'} mode`}
          aria-pressed={designMode === 'pro'}
          title={designMode === 'pro' ? 'Pro — full designer: every tool, jump any step' : 'Guided — simple step-by-step, one focus at a time'}
          style={{
            marginLeft: 'auto',
            display: isPhone ? 'none' : 'flex',
            alignItems: 'center',
            minHeight: 32,
            padding: '0 4px',
            borderRadius: 999,
            border: `1px solid ${GREEN}`,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 700,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              background: designMode === 'guided' ? GREEN : 'transparent',
              color: designMode === 'guided' ? PAPER : GREEN,
            }}
          >
            Guided
          </span>
          <span
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              background: designMode === 'pro' ? GREEN : 'transparent',
              color: designMode === 'pro' ? PAPER : GREEN,
            }}
          >
            Pro
          </span>
        </button>
        {/* RETIRED — the Geometry Lock chip. It is jargon, it confused its own author, and the
            recommended Satellite Overlay style ignores it entirely (see isModelChromeStyle). Render
            behaviour belongs to the chosen STYLE, not to a header switch. */}
        {canvasState && frame && (
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            aria-label="Print / Export plan set"
            title="Print / Export — export your exact maps as a PDF plan set or PNGs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 32,
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${GREEN}`,
              background: 'transparent',
              color: GREEN,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <Printer size={15} /> Print
          </button>
        )}
        {buildInfo?.sha && !isPhone && (
          <div
            title={`Build source: ${buildInfo.source ?? 'unknown'}${buildInfo.branch ? ` · branch ${buildInfo.branch}` : ''}${buildInfo.repoRoot ? ` · ${buildInfo.repoRoot}` : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 32,
              padding: '0 10px',
              borderRadius: 999,
              border: '1px solid rgba(31,77,43,0.2)',
              background: 'rgba(31,77,43,0.04)',
              color: GREEN,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
            }}
          >
            Build {buildInfo.sha}
          </div>
        )}
        <div
          title={saveError ?? undefined}
          style={{
            display: isPhone ? 'none' : undefined,
            fontSize: 12,
            opacity: saveError ? 1 : 0.6,
            fontWeight: saveError ? 800 : 400,
            color: saveError ? '#B3261E' : undefined,
            maxWidth: 130,
            lineHeight: 1.15,
          }}
        >
          {saveError ? '⚠ NOT saved — storage full' : saved ? 'Saved' : 'Saving…'}
        </div>
      </header>

      {/* SAFE MODE (lib/crash-loop.ts). Amber, not red: nothing is broken and nothing is lost —
          the farmer's whole design is on screen and every measurement is its real value. Only the
          background photograph is missing, and only for this load. The button puts it back. */}
      {safeModeVisible && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '8px 14px',
            background: '#FDF4E3',
            borderBottom: '1px solid #E8D5A8',
            color: DARK,
            fontSize: 12.5,
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {safeMode.reason === 'requested'
              ? 'Light mode — your design is here, without the background photo.'
              : 'The app kept closing on this design, so it opened without the background photo. Everything you drew is here, and your measurements are unchanged.'}
          </span>
          <button
            type="button"
            onClick={exitSafeMode}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 9,
              border: '1px solid #C79A3C',
              background: '#FFFFFF',
              color: DARK,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Try the photo again
          </button>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          style={{
            padding: '8px 14px',
            background: '#FDECEA',
            borderBottom: '1px solid #F3B4AE',
            color: '#7A1C15',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {saveError} Your cached glossy renders are the usual culprit — they’ve been cleared
          automatically; if this persists, clear this site’s data.
        </div>
      )}

      {printOpen && canvasState && frame && (
        <DesignPrintLazy
          state={canvasState}
          frame={frame}
          refLayers={refLayers}
          site={glossySite}
          placeName={placeName ?? siteName}
          onClose={() => setPrintOpen(false)}
        />
      )}

      {!chromeCollapsed && (
      <>
      {/* Auto-design is no longer a hero bar — it lives in the quiet Advanced (beta) sheet
          reached from the slim chrome row below. Guidance (wizard + advisor + zone advice)
          is the first-class path now. */}

      {/* Wizard (top) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <div style={isPhone ? undefined : { position: 'fixed', top: 76, left: 12, width: 208, maxHeight: 'calc(100dvh - 88px)', overflowY: 'auto', zIndex: 15 }}>
          <DesignWizard
            step={canvasState.step}
            setStep={setStep}
            state={canvasState}
            refLayersPresent={{
              boundary: refLayers.boundary.length > 2,
              house: refLayers.house.length > 2,
            }}
            mode={designMode}
          />
        </div>
      )}
      {detectError && (
        <div
          style={{
            margin: '0 14px',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(181,58,58,0.12)',
            color: '#B53A3A',
            fontSize: 12.5,
          }}
        >
          {detectError}
        </div>
      )}
      </>
      )}

      {/* Slim chrome toggle — reclaim canvas height (the design surface was cramped into
          ~half the screen). Collapsed: a one-line step nav + "Show steps"; expanded: a
          quiet "More space" that folds the auto-design bar + wizard away. */}
      {canvasState && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px', minHeight: 34, borderBottom: chromeCollapsed ? '1px solid #E2D8C4' : 'none' }}>
          {cardsUi && (
            // The StepGuide bubble floats over the top-left of the map, and this bar sits level
            // with its first ~50px — so while the guide is up, the strip starts to its right
            // rather than running underneath it. Same condition as the guide's own mount below.
            <div style={{ display: 'flex', minWidth: 0, flex: '1 1 auto', paddingLeft: bottomShow.stepBar && canvasState.step !== 'glossy' && canvasState.step !== 'review' ? 252 : 0 }}>
              <CardsStepper step={canvasState.step} onStep={setStep} />
            </div>
          )}
          {!cardsUi && chromeCollapsed && (() => {
            const idx = STEP_ORDER.indexOf(canvasState.step);
            const navBtn = (disabled: boolean): React.CSSProperties => ({
              width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA',
              color: disabled ? '#C9BFAD' : GREEN, cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1, flexShrink: 0, padding: 0,
            });
            return (
              <>
                <button type="button" aria-label="Previous step" disabled={idx <= 0} onClick={() => idx > 0 && setStep(STEP_ORDER[idx - 1])} style={navBtn(idx <= 0)}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>
                  {STEP_LABELS[canvasState.step]}
                  <span style={{ color: '#9A8268', fontWeight: 500 }}> · {idx + 1}/{STEP_ORDER.length}</span>
                </span>
                <button type="button" aria-label="Next step" disabled={idx >= STEP_ORDER.length - 1} onClick={() => idx < STEP_ORDER.length - 1 && setStep(STEP_ORDER[idx + 1])} style={navBtn(idx >= STEP_ORDER.length - 1)}>
                  <ChevronRight size={16} />
                </button>
              </>
            );
          })()}
          {canvasState.step !== 'glossy' && (
            <button
              type="button"
              onClick={() =>
                setPreviewFilter(
                  canvasState.step === 'water'
                    ? 'water'
                    : canvasState.step === 'earthworks'
                    ? 'earthworks'
                    : canvasState.step === 'zones'
                      ? 'zones'
                      : canvasState.step === 'planting'
                        ? 'planting'
                        : canvasState.step === 'structures'
                          ? 'structures'
                          : 'all',
                )
              }
              aria-label="Preview map and choose a plan sheet"
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: OCHRE, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 44, padding: '0 4px' }}
            >
              <ImageIcon size={15} /> Preview map
            </button>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {/* THE TOP HANDLE. Was a two-state "More space" toggle, which could reclaim the wizard
                and nothing else — there was no way to get to just the map. Now a ladder: full →
                slim → hidden, one tap at a time, wrapping back. */}
            <ChromeHandle
              stop={topStop}
              stops={TOP_STOPS}
              onChange={setTopStop}
              invert
              label="Show or hide the steps and header"
            />
          </span>
          <button
            type="button"
            onClick={() => setTopStop((c) => (c === 'full' ? 'slim' : 'full'))}
            style={{ display: 'none' }}
          >
            {chromeCollapsed ? <><ChevronDown size={15} /> Show steps</> : <><ChevronUp size={15} /> More space</>}
          </button>
        </div>
      )}

      {/* Canvas (middle). minHeight floor (not 0) so the map can never be squeezed to a sliver
          on a phone by the tool chrome below it — it always keeps ~45% of the screen.
          canvasWrapRef feeds the phone-only auto-collapse-top-chrome-on-drag effect above. */}
      <div
        ref={canvasWrapRef}
        style={{
          flex: 1,
          position: 'relative',
          minHeight: canvasState?.step === 'glossy' ? 'calc(100dvh - 132px)' : '45dvh',
          marginLeft: isPhone || canvasState?.step === 'glossy' ? 0 : 232,
          marginRight: isPhone || canvasState?.step === 'glossy' ? 0 : 328,
        }}
      >
        {canvasState && frame && canvasState.step === 'glossy' ? (
          <DesignGlossyLazy
            state={canvasState}
            frame={frame}
            refLayers={refLayers}
            site={glossySite}
            placeName={siteName}
            geometryLock={geometryLock}
            onGeometryLockChange={setGeometryLock}
            onImportPhoto={() => setShowPhotoImport(true)}
          />
        ) : canvasState && frame ? (
          <>
            <DesignCanvas
              frame={frame}
              state={canvasState}
              onChange={(next) => handleChange(() => next)}
              tool={tool}
              placeDefId={placeDefId}
              placeSpeciesId={placeSpeciesId}
              zoneDraw={zoneDraw}
              areaFeature={areaFeature}
              lineKind={lineKind}
              activeLayers={activeLayers}
              waterInfrastructure={{ visibility: waterInfrastructureVisibility, opacity: waterInfrastructureOpacity }}
              mapTextScale={mapTextScale}
              areaFill={areaFill}
              baseAlign={designBaseMode(canvasState) === 'photo' ? (canvasState?.customBase ?? null) : null}
              bedBlock={bedBlockArmed ? { spec: bedBlockSpec, defId: BED_BLOCK_DEF_ID } : null}
              onPlaceBedBlock={onPlaceBedBlock}
              onToggleSiteReferences={() => setActiveLayers((a) => ({ ...a, references: !a.references }))}
              onToggleSector={() => setActiveLayers((a) => ({ ...a, sector: !a.sector }))}
              // Satellite → drone photo → blank, on the canvas itself. These are the same three
              // handlers as the Base step, so blank cannot acquire a second, divergent scale rule.
              basePhoto={
                basePhotoControls(canvasState).canToggle
                  ? {
                      mode: designBaseMode(canvasState),
                      hasPhoto: basePhotoControls(canvasState).hasPhoto,
                      onSelect: (mode) => {
                        if (mode === 'photo') restoreCustomBase();
                        else if (mode === 'blank') useBlankBase();
                        else revertToSatellite();
                      },
                    }
                  : null
              }
              slopeDeg={locationData?.elevation?.slopeDeg}
              aspectDeg={locationData?.elevation?.aspectDeg}
              sectorSite={glossySite}
              lat={lat}
              refLayers={refLayers}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectMany={handleSelectMany}
              additiveSelect={multiSelectMode}
              onToggleAdditive={() => setMultiSelectMode((m) => !m)}
              onCalibrateScale={onCalibrateScale}
              onEditItem={setEditItemId}
              onToolChange={handleSetTool}
              tracedLayers={tracedLayers}
              tidyPreview={
                tidyPreview
                  ? {
                      kind: tidyPreview.kind,
                      tidiedPoints: tidyPreview.result.points,
                      // Both halves, in the order they happened, so "Tidy" never does something
                      // the sentence under it did not mention.
                      summary: [
                        tidyPreview.result.removed > 0 ? tidyOutlineSummary(tidyPreview.result) : null,
                        tidyPreview.squared ? squareUpSummary(tidyPreview.squared) : null,
                      ].filter(Boolean).join(' ') || tidyOutlineSummary(tidyPreview.result),
                      canConfirm: tidyPreview.result.changed,
                    }
                  : null
              }
              onConfirmTidy={onConfirmTidy ?? undefined}
              onCancelTidy={onCancelTidy ?? undefined}
              snapPreview={
                snapPreview
                  ? {
                      rings: snapPreview.result.updates.map(({ id, points }) => ({ id, points })),
                      summary: snapPreview.reached
                        ? `Nothing was within the usual reach, so this reaches up to ${SNAP_REACH_M} m. ${snapSelectedRingsSummary(snapPreview.result)}`
                        : snapSelectedRingsSummary(snapPreview.result),
                      canConfirm: snapPreview.result.changed,
                    }
                  : null
              }
              onConfirmSnap={onConfirmSnap ?? undefined}
              onCancelSnap={onCancelSnap ?? undefined}
              cleanupPreview={
                cleanupPreview
                  ? {
                      items: cleanupPreview.result.items,
                      summary: alignAndDistributeSummary(cleanupPreview.result),
                      canConfirm: cleanupPreview.result.changed,
                    }
                  : null
              }
              onConfirmCleanup={onConfirmCleanup ?? undefined}
              onCancelCleanup={onCancelCleanup ?? undefined}
            />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: DARK,
              opacity: 0.6,
            }}
          >
            Loading site…
          </div>
        )}

        {/* Advisor (Lima) — rendered INSIDE the canvas container so it anchors to the canvas's
            bottom-left, which sits directly above the status bar + element palette. It can never
            overlap those bottom bars, and taps outside it dismiss it. */}
        {bottomShow.advisor && canvasState && canvasState.step !== 'glossy' && (
          <DesignAdvisor
            state={canvasState}
            site={site}
            houseXY={houseXY}
            lastChangeId={canvasState.updatedAt}
          />
        )}
      </div>

      {/* Import your own photo — Base step only. Lets a farmer use a drone/aerial photo of their
          own land as the base to draw on, instead of the fetched satellite tile. See
          components/design/BasePhotoImport.tsx and CustomBaseImage (lib/design-canvas.ts). */}
      {(bottomShow.droneTools || bottomShow.droneEntry) && canvasState && canvasState.step === 'base' && (
        <div style={{ padding: '6px 12px 0' }}>
          {basePhotoControls(canvasState).canToggle ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                minHeight: 40,
                padding: '6px 12px',
                borderRadius: 12,
                border: '1px solid rgba(192,122,30,0.35)',
                background: 'rgba(192,122,30,0.08)',
                fontSize: 12.5,
                color: DARK,
              }}
            >
              <ImageIcon size={15} style={{ flexShrink: 0, color: OCHRE }} />
              {/* Three honest grounds for the same plan. Blank is the paper version: it removes
                  only imagery and carries the active m/px with it, so a farmer can compare their
                  working map with the sheet without their areas silently changing. */}
              <span style={{ display: 'inline-flex', borderRadius: 9, overflow: 'hidden', border: `1px solid ${OCHRE}`, flexShrink: 0 }}>
                {([['Satellite', 'satellite'], ['My photo', 'photo'], ['Blank', 'blank']] as const)
                  .filter(([, mode]) => mode !== 'photo' || basePhotoControls(canvasState).hasPhoto)
                  .map(([label, mode]) => {
                  const on = designBaseMode(canvasState) === mode;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (mode === 'photo') restoreCustomBase();
                        else if (mode === 'blank') useBlankBase();
                        else revertToSatellite();
                      }}
                      style={{
                        minHeight: 30, padding: '4px 11px', border: 'none', cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 700,
                        background: on ? OCHRE : PAPER, color: on ? PAPER : OCHRE,
                      }}
                    >
                      {label}
                    </button>
                  );
                  })}
              </span>
              {/* MICRO-ADJUSTMENT, in place, on the real map — not in a dialog. A drone shot and a
                  satellite tile disagree by a few metres and a few degrees more often than not
                  (different day, different heading, different georeferencing), and that only shows
                  up later, at full size, with the design already drawn on top. Move and TURN, never
                  resize: mPerPx came from the farmer's own two-point calibration on these pixels,
                  so a scale handle here would quietly restate every area and every yield on the
                  plan, while rotation cannot — turning an image does not change what a pixel is
                  worth on the ground. */}
              {bottomShow.droneTools && designBaseMode(canvasState) === 'photo' && canvasState.customBase && (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    {([
                      ['◀', -BASE_NUDGE_STEP, 0, 'Nudge photo west'],
                      ['▲', 0, -BASE_NUDGE_STEP, 'Nudge photo north'],
                      ['▼', 0, BASE_NUDGE_STEP, 'Nudge photo south'],
                      ['▶', BASE_NUDGE_STEP, 0, 'Nudge photo east'],
                    ] as const).map(([glyph, ddx, ddy, label]) => (
                      <button key={glyph} type="button" title={`${label} — hold to keep going`} aria-label={label}
                        {...holdProps(() => nudgeBase(ddx, ddy))} style={STEP_BTN}
                      >
                        {glyph}
                      </button>
                    ))}
                  </span>
                  {/* THE ANGLE ADJUSTER (Rory: "this is good we just need a angle adjuster"). The
                      running total is shown because a farmer squaring a photo by eye needs to know
                      how far they have turned it and how to get back to square. */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }} title={`Turn your photo to square it with the satellite (±${MAX_BASE_ROTATION}°)`}>
                    {([
                      ['↺', -BASE_ROTATE_STEP, 'Turn photo anticlockwise'],
                      ['↻', BASE_ROTATE_STEP, 'Turn photo clockwise'],
                    ] as const).map(([glyph, ddeg, label]) => (
                      <button key={glyph} type="button" title={`${label} — hold to keep turning`} aria-label={label}
                        {...holdProps(() => rotateBase(ddeg))} style={{ ...STEP_BTN, fontSize: 13 }}
                      >
                        {glyph}
                      </button>
                    ))}
                    <span style={{ fontSize: 11, opacity: 0.75, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {(liveAlign.rotationDeg ?? 0).toFixed(1)}°
                    </span>
                  </span>
                  {/* THE SIZE ADJUSTER (Rory: "i want to be able to adjust the size for micro
                      adjustments once inserted but we have to get the scaling right"). Unlike the
                      nudge and the angle, this one DOES move the metres — resizing a photo until
                      its features sit on the satellite underneath is a scale correction, and the
                      frame's metres-per-pixel is derived from it (customBaseMPerPx) so the app can
                      never measure the picture at a size it is not drawn at. Fade the photo with
                      See through while doing it and the two can be matched feature by feature. */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }} title="Resize your photo to match the satellite underneath. This is a SCALE correction — your measurements follow it.">
                    {([
                      ['−', 1 / BASE_SCALE_STEP, 'Make photo smaller'],
                      ['+', BASE_SCALE_STEP, 'Make photo bigger'],
                    ] as const).map(([glyph, factor, label]) => (
                      <button key={glyph} type="button" title={`${label} — hold to keep resizing`} aria-label={label}
                        {...holdProps(() => scaleBase(factor))} style={{ ...STEP_BTN, fontSize: 13 }}
                      >
                        {glyph}
                      </button>
                    ))}
                    {/* A SLIDER AS WELL AS THE STEPPERS (Rory: "i want a slider to increase the
                        size of the drone photo for micro adjustments to fit the satellite").
                        Matching a photo to satellite features is a continuous judgement made by
                        eye — you overshoot, come back, and settle — and that is a drag, not a
                        count of taps. The steppers stay for the last fine increment, where a
                        slider's pixel is coarser than one press. Both write through the same
                        clamped path, so the two can never disagree. */}
                    <input
                      type="range"
                      aria-label="Photo size"
                      min={MIN_BASE_SCALE}
                      max={MAX_BASE_SCALE}
                      step={0.01}
                      value={liveAlign.scale ?? 1}
                      onChange={(e) => stepAlign((a) => ({ ...a, scale: Number(e.target.value) }))}
                      onPointerUp={commitAlign}
                      onKeyUp={commitAlign}
                      onBlur={commitAlign}
                      style={{ width: 96 }}
                    />
                    <span style={{ fontSize: 11, opacity: 0.75, minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round((liveAlign.scale ?? 1) * 100)}%
                    </span>
                  </span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }} title="Fade your photo to see the satellite underneath while you line them up">
                    <span style={{ fontSize: 11, opacity: 0.75 }}>See through</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={canvasState.customBase.opacity ?? 1}
                      onChange={(e) => setBaseOpacity(Number(e.target.value))}
                      style={{ width: 74 }}
                    />
                  </label>
                  {(canvasState.customBase.dx || canvasState.customBase.dy
                    || canvasState.customBase.rotationDeg
                    || (canvasState.customBase.opacity ?? 1) !== 1) && (
                    <button
                      type="button"
                      onClick={resetBaseAlign}
                      title="Put the photo back where it was imported — square, in place, fully opaque"
                      style={{ border: 'none', background: 'transparent', color: DARK, opacity: 0.65, fontWeight: 600, cursor: 'pointer', fontSize: 11.5, padding: '4px 4px' }}
                    >
                      Reset
                    </button>
                  )}
                </>
              )}
              <span style={{ flex: 1, minWidth: 0 }} />
              {/* Adjusting used to mean living with whatever the first pass produced. This reopens
                  the aligner, where the photo can be moved, resized and faded against the
                  satellite before being re-applied. */}
              <button
                type="button"
                onClick={() => setShowPhotoImport(true)}
                style={{ border: 'none', background: 'transparent', color: OCHRE, fontWeight: 700, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px' }}
              >
                {designBaseMode(canvasState) === 'photo'
                  ? 'Adjust photo'
                  : basePhotoControls(canvasState).hasPhoto ? 'Use a different photo' : 'Use your own aerial photo'}
              </button>
              {/* Destructive, so it is quiet, last in the row, and asks first. */}
              {basePhotoControls(canvasState).hasPhoto && (
                <button
                  type="button"
                  onClick={deleteCustomBase}
                  title="Remove your photo and go back to the satellite. Your design is not affected."
                  style={{ border: 'none', background: 'transparent', color: '#B53A3A', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px' }}
                >
                  Remove photo
                </button>
              )}
              {/* Hides the STRIP, not the photo — "Remove photo" beside it is the one that
                  touches the design, which is why that one is red and asks first and this one is
                  a grey ×. */}
              <SectionClose onClick={() => hideSection('droneTools')} what="the photo controls" />
            </div>
          ) : (
            /* Was a dashed, small-text row sitting in a stack of similar-looking dashed hint rows,
               so it read as a tip rather than a control — Rory asked for a way to import a drone
               photo while looking straight at the button for it. Solid fill, a real label, and
               the question moved to a subtitle. The copy now names Google Earth as well as a
               drone: rural-SA Mapbox/Esri imagery is often blurry (which is what sends a farmer
               looking for a better base in the first place), and nothing here cares where the
               aerial came from. Hardcoded English matches the rest of this row today; the whole
               row still needs an i18n key. */
            <button
              type="button"
              onClick={() => setShowPhotoImport(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 14px', borderRadius: 12, border: `1px solid ${OCHRE}`, background: 'rgba(192,122,30,0.12)', color: OCHRE, cursor: 'pointer', textAlign: 'left' }}
            >
              <ImageIcon size={18} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.3 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>Use your own aerial photo</span>
                <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>A drone shot or a Google Earth capture — sharper than this satellite view. Line it up and set the scale.</span>
              </span>
              <ChevronRight size={18} style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      )}

      {showPhotoImport && (
        <BasePhotoImport
          onApply={applyCustomBase}
          onClose={() => setShowPhotoImport(false)}
          // The TRUE satellite as the backdrop. On a custom base frame.satDataUrl IS the farmer's
          // photo, so passing it here made the aligner show the photo as its own reference —
          // "line your photo up against your photo" (Rory: "theres no satelite underlay"). The
          // real satellite rides in frame.underlayDataUrl while a custom base is active.
          satDataUrl={canvasState?.useCustomBase ? frame?.underlayDataUrl ?? null : frame?.satDataUrl ?? null}
          // Adjusting reopens ON the farmer's photo with its calibrated scale carried, instead of
          // on a file picker (Rory: "i click adjust photo and it goes to add a new photo").
          //
          // THE PRISTINE ORIGINAL, never frame.satDataUrl. satDataUrl is the BAKED image: it has
          // the nudge and the angle already burned in, and (until the backdrop fill) transparent
          // gaps where the photo no longer covered the frame. Handing that back to the aligner
          // re-applied the alignment on top of itself on the next Use, and the aligner exports
          // JPEG — a format with no alpha — so those gaps would have been composited to solid
          // BLACK and uploaded to Storage as the farmer's new permanent base photo.
          initialPhotoDataUrl={canvasState?.useCustomBase
            ? (customBaseSourceRef.current?.url === canvasState.customBase?.url
              ? customBaseSourceRef.current?.dataUrl ?? null
              : null)
            : null}
          initialMPerPx={canvasState?.useCustomBase ? canvasState.customBase?.mPerPx ?? null : null}
        />
      )}

      {/* "Just beds & trees" quick path — for the farmer who doesn't want the full permaculture
          plan. Offered on the first (Base) step; jumps straight to Planting. */}
      {bottomShow.shortcuts && canvasState && canvasState.step === 'base' && designMode === 'guided' && (
        <div style={{ padding: '6px 12px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => { setDesignMode('guided'); setStep('planting'); }}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 12px', borderRadius: 12, border: '1px dashed rgba(31,77,43,0.4)', background: 'transparent', color: GREEN, cursor: 'pointer', textAlign: 'left', fontSize: 12.5 }}
          >
            <Sprout size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 800 }}>Just want beds &amp; trees?</span> Skip ahead — place them, then plan your crops.
            </span>
            <ChevronRight size={16} style={{ flexShrink: 0 }} />
          </button>
          <SectionClose onClick={() => hideSection('shortcuts')} what="the skip-ahead offer" />
        </div>
      )}

      {/* DRIP DOWN EVERY BED — the Water step's one-tap chore button. Lives here, not on Planting,
          because this is where a farmer is thinking about water, and it is deliberately a plain
          labelled row rather than another glyph in the crowded tool strip. */}
      {bottomShow.shortcuts && canvasState && canvasState.step === 'water' && onDripAllBeds && (
        <div style={{ padding: '6px 12px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onDripAllBeds}
            style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 14px', borderRadius: 12, border: `1px solid ${OCHRE}`, background: 'rgba(192,122,30,0.10)', color: GREEN, cursor: 'pointer', textAlign: 'left', fontSize: 12.5, flexShrink: 0 }}
          >
            <span aria-hidden>💧</span>
            <span><span style={{ fontWeight: 800 }}>Drip all beds</span> — one line down the centre of each</span>
          </button>
          {dripNote && (
            <span style={{ fontSize: 11.5, color: DARK, opacity: 0.75, flex: 1, minWidth: 0 }}>{dripNote}</span>
          )}
        </div>
      )}

      {/* Step-by-step guide — the walked micro-task checklist for the current step, with a
          "Do this" that arms the right tool and a "Why this matters" lesson. */}
      {/* bottomShow.stepBar was computed and then never read — the guide was the one band the
          ladder promised to fold and didn't. It is on the ladder now, and carries its own ×. */}
      {bottomShow.stepBar && canvasState && canvasState.step !== 'glossy' && canvasState.step !== 'review' && (
        <StepGuide
          onHide={() => hideSection('stepGuide')}
          step={canvasState.step}
          state={canvasState}
          ctx={{ hasBoundary: refLayers.boundary.length >= 3, hasHouse: refLayers.house.length >= 3 }}
          mode={designMode}
          onArm={armSubStep}
          monthlyRainfallMm={locationData?.rainfall?.monthly}
          onDailyWaterUseLChange={(dailyWaterUseL) => {
            handleChange((prev) => ({
              ...prev,
              dailyWaterUseL,
              updatedAt: new Date().toISOString(),
            }));
          }}
          onNextStep={() => {
            const i = STEP_ORDER.indexOf(canvasState.step);
            if (i >= 0 && i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
          }}
          planCropsHref={`/facilitator/crops?canvasSite=${encodeURIComponent(canvasState.siteId)}&auto=1`}
        />
      )}

      {/* Zone ADVICE (guided mode, zones step) — the guidance half of the hybrid. Lima's
          spatial suggestions as short text advice; tap a row to ARM that zone chip and draw
          it yourself. Nothing is committed to the canvas. */}
      {canvasState && canvasState.step === 'zones' && designMode === 'guided' && (
        <div style={{ padding: '8px 14px 0' }}>
          {zoneAdvice.length === 0 ? (
            <button
              type="button"
              onClick={runZoneAdvice}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                minHeight: 48,
                borderRadius: 12,
                border: `1.5px solid ${GREEN}`,
                background: 'transparent',
                color: GREEN,
                fontWeight: 700,
                fontSize: 14.5,
                cursor: 'pointer',
              }}
            >
              <Lightbulb size={18} /> Where do my zones go?
            </button>
          ) : (
            <div
              style={{
                border: `1px solid ${GOLD}`,
                borderRadius: 12,
                background: 'rgba(31,77,43,0.04)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Lightbulb size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35, color: DARK }}>
                  Lima marked where each zone would work well. Tap a zone, then draw it yourself.
                </span>
                <SpeakButton
                  text="Lima marked where each zone would work well. Tap a zone, then draw it yourself."
                  size={16}
                  color={GREEN}
                />
                <button
                  type="button"
                  onClick={() => setZoneAdvice([])}
                  aria-label="Hide advice"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    minHeight: 32,
                    padding: '0 6px',
                    background: 'transparent',
                    border: 'none',
                    color: '#8A7C63',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={13} /> Hide
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {zoneAdvice.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => armZoneFromAdvice(pin.zone)}
                    title={pin.note}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      maxWidth: '100%',
                      minHeight: 44,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: zoneDraw === pin.zone && tool === 'zone' ? `2px solid ${GREEN}` : '1px solid #E2D8C4',
                      background: '#FFFFFF',
                      color: DARK,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: ZONE_DEFS[pin.zone].color,
                        border: '1px solid rgba(11,18,11,0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#FFFFFF',
                      }}
                    >
                      {pin.zone}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pin.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* THE WAY BACK. `hidden` must never be a dead end: with both edges down there would
          otherwise be no control on screen at all, and a canvas tap places an element rather than
          restoring chrome — so tapping the map to get out would silently edit the design. These
          rails are small, always present when their edge is hidden, and carry the same handle. */}
      {!topShow.stepNav && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 4px)', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
          <span style={{ pointerEvents: 'auto', background: PAPER, borderRadius: 999, padding: '0 12px', boxShadow: '0 4px 14px -6px rgba(0,0,0,0.35)', border: '1px solid #E2D8C4' }}>
            <ChromeHandle stop={topStop} stops={TOP_STOPS} onChange={setTopStop} invert label="Show the steps again" />
          </span>
        </div>
      )}
      {!bottomShow.tools && (
        <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
          <span style={{ pointerEvents: 'auto', background: PAPER, borderRadius: 999, padding: '0 12px', boxShadow: '0 4px 14px -6px rgba(0,0,0,0.35)', border: '1px solid #E2D8C4' }}>
            <ChromeHandle stop={bottomStop} stops={BOTTOM_STOPS} onChange={setBottomStop} label="Show the tools again" />
          </span>
        </div>
      )}

      {/* Palette (docked bottom). bottomShow.tools is the last rung: without this gate the ladder's
          `hidden` still left the whole tool row on screen, so "just the map" was never actually
          reachable — the rail above is what brings it back.
          `!previewFilter` because the palette's floating mode portals itself to <body> at
          zIndex 900, ABOVE this page's Preview map overlay (zIndex 60) — so a parked Elements
          panel followed the farmer onto the preview screen and sat over the sheet buttons. The
          docked strip is covered by the opaque overlay anyway; only the portal escaped it.
          Unmounting is safe: floating mode and position live in localStorage, not in the
          component, so the panel comes back exactly where it was parked. */}
      {bottomShow.tools && canvasState && canvasState.step !== 'glossy' && !previewFilter && (
        <DesignPalette
          bottomStop={bottomStop}
          onBottomStopChange={setBottomStop}
          hiddenSections={{ count: dismissed.length, onRestore: showAllSections }}
          step={canvasState.step}
          mode={designMode}
          tool={tool}
          setTool={handleSetTool}
          placeDefId={placeDefId}
          setPlaceDefId={setPlaceDefId}
          placeSpeciesId={placeSpeciesId}
          setPlaceSpeciesId={setPlaceSpeciesId}
          zoneDraw={zoneDraw}
          setZoneDraw={setZoneDraw}
          selectedZone={selectedZone}
          areaFeature={areaFeature}
          setAreaFeature={setAreaFeature}
          lineKind={lineKind}
          setLineKind={setLineKind}
          activeLayers={activeLayers}
          waterInfrastructure={{
            visibility: waterInfrastructureVisibility,
            opacity: waterInfrastructureOpacity,
            onVisibilityChange: setWaterInfrastructureVisibility,
            onOpacityChange: setWaterInfrastructureOpacity,
          }}
          desktopAside={!isPhone}
          textScaleControl={{ value: mapTextScale, onChange: setMapTextScale }}
          selectedIdentity={selectedIdentity}
          areaFillControl={{ value: areaFill, onChange: changeAreaFill }}
          bedBlockControl={bedBlockControl}
          setActiveLayers={setActiveLayers}
          onUndo={handleUndo}
          canUndo={undoStack.current.length > 0}
          onRedo={handleRedo}
          canRedo={redoStack.current.length > 0}
          onDeleteSelected={onDeleteSelected}
          onDuplicateSelected={onDuplicateSelected}
          onTidySelected={onTidySelected}
          onSnapSelected={onSnapSelected}
          onCleanupSelected={onCleanupSelected}
          angleControl={angleControl}
          sizeControl={sizeControl}
          swaleControl={swaleControl}
          windControl={windControl}
          // The biome NAME, never the registry key — the palette needs the name for
          // biomeClimates() and converts to a key itself for SpeciesPicker. Passing the key here
          // made biomeClimates fall through to "unknown biome, don't filter", which put temperate
          // apple/pear/plum/olive chips on a subtropical coast.
          siteBiome={site?.biome}
        />
      )}

      {/* Per-layer glossy preview overlay — opened by "Preview map" on any design step, so the
          farmer can generate a beautiful single-layer map without leaving their place in the flow. */}
      {canvasState && frame && previewFilter && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: PAPER, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #E2D8C4', flexShrink: 0 }}>
            <ImageIcon size={18} color={OCHRE} />
            <span style={{ fontWeight: 800, color: GREEN, fontSize: 15 }}>Preview map</span>
            <button
              type="button"
              onClick={() => setPreviewFilter(null)}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: GREEN, fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 40, padding: '0 6px' }}
            >
              <X size={18} /> Close
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <DesignGlossyLazy
              state={canvasState}
              frame={frame}
              refLayers={refLayers}
              site={glossySite}
              placeName={siteName}
              geometryLock={geometryLock}
              onGeometryLockChange={setGeometryLock}
              initialFilter={previewFilter}
              onImportPhoto={() => setShowPhotoImport(true)}
            />
          </div>
        </div>
      )}

      {/* Item edit sheet */}
      {editItem && (
        <ItemEditSheet
          item={editItem}
          onCancel={() => setEditItemId(null)}
          onDelete={() => {
            const id = editItem.id;
            setEditItemId(null);
            handleChange((prev) => ({
              ...prev,
              items: prev.items.filter((i) => i.id !== id),
              updatedAt: new Date().toISOString(),
            }));
            setSelectedIds((prev) => prev.filter((x) => x !== id));
          }}
          onSave={(patch) => {
            const id = editItem.id;
            handleChange((prev) => ({
              ...prev,
              items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
              updatedAt: new Date().toISOString(),
            }));
            setEditItemId(null);
          }}
        />
      )}
    </div>
  );
}

interface ItemEditPatch {
  label?: string;
  note?: string;
  status?: ElementStatus;
  wM?: number;
  hM?: number;
  rot?: number;
}

function ItemEditSheet({
  item,
  onCancel,
  onDelete,
  onSave,
}: {
  item: PlacedItem;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (patch: ItemEditPatch) => void;
}) {
  const def = ELEMENTS_BY_ID[item.defId];
  const isRect = def?.shape === 'rect';
  const [label, setLabel] = useState(item.label ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [status, setStatus] = useState<ElementStatus>(item.status === 'existing' ? 'existing' : 'proposed');
  const [wM, setWM] = useState(String(item.wM ?? def?.wM ?? 1));
  const [hM, setHM] = useState(String(item.hM ?? def?.hM ?? 1));
  const [rot, setRot] = useState(String(Math.round(item.rot ?? 0)));

  function handleSave() {
    const parsedW = parseFloat(wM);
    const parsedH = parseFloat(hM);
    const patch: ItemEditPatch = {
      label: label.trim() ? label.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      status,
    };
    if (Number.isFinite(parsedW) && parsedW > 0) {
      patch.wM = parsedW;
      patch.hM = isRect ? (Number.isFinite(parsedH) && parsedH > 0 ? parsedH : parsedW) : parsedW;
    }
    if (isRect) {
      const parsedRot = parseFloat(rot);
      if (Number.isFinite(parsedRot)) patch.rot = ((parsedRot % 360) + 360) % 360;
    }
    onSave(patch);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(11,18,11,0.45)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: PAPER,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '16px 18px calc(18px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{def?.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: DARK }}>{def?.name ?? 'Item'}</span>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={def?.name}
            style={{
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid rgba(11,18,11,0.2)',
              padding: '0 12px',
              fontSize: 14,
              background: '#FFFFFF',
              color: DARK,
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 5000 L"
            style={{
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid rgba(11,18,11,0.2)',
              padding: '0 12px',
              fontSize: 14,
              background: '#FFFFFF',
              color: DARK,
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ElementStatus)}
            style={{
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid rgba(11,18,11,0.2)',
              padding: '0 12px',
              fontSize: 14,
              background: '#FFFFFF',
              color: DARK,
            }}
          >
            <option value="proposed">Part of my design</option>
            <option value="existing">Already here</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
            {isRect ? 'Width (m)' : 'Size (m)'}
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={wM}
              onChange={(e) => setWM(e.target.value)}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(11,18,11,0.2)',
                padding: '0 12px',
                fontSize: 14,
                background: '#FFFFFF',
                color: DARK,
              }}
            />
          </label>
          {isRect && (
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
              Height (m)
              <input
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                value={hM}
                onChange={(e) => setHM(e.target.value)}
                style={{
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1px solid rgba(11,18,11,0.2)',
                  padding: '0 12px',
                  fontSize: 14,
                  background: '#FFFFFF',
                  color: DARK,
                }}
              />
            </label>
          )}
        </div>

        {isRect && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: DARK }}>
            Angle (degrees)
            <input
              type="number"
              inputMode="decimal"
              step={1}
              value={rot}
              onChange={(e) => setRot(e.target.value)}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(11,18,11,0.2)',
                padding: '0 12px',
                fontSize: 14,
                background: '#FFFFFF',
                color: DARK,
              }}
            />
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              border: 'none',
              background: GREEN,
              color: PAPER,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid #B53A3A',
              background: 'transparent',
              color: '#B53A3A',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid rgba(11,18,11,0.2)',
              background: 'transparent',
              color: DARK,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// DesignGlossy is heavy (canvas compositing + AI client) — lazy-load it only when the
// farmer reaches the glossy step.
function DesignGlossyLazy(props: {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: RefLayers;
  site: SectorSite | null;
  placeName?: string;
  geometryLock?: boolean;
  onGeometryLockChange?: Dispatch<SetStateAction<boolean>>;
  initialFilter?: GlossyLayerFilter;
  onImportPhoto?: () => void;
}) {
  const [Comp, setComp] = useState<React.ComponentType<typeof props> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('@/components/design/DesignGlossy').then((mod) => {
      if (!cancelled) setComp(() => mod.default as React.ComponentType<typeof props>);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Comp) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Loading glossy render…
      </div>
    );
  }
  return <Comp {...props} />;
}

// DesignPrint (the plan-set composer) pulls in jsPDF — lazy-load it only when the farmer
// opens Print / Export.
function DesignPrintLazy(props: {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: RefLayers;
  site: SectorSite | null;
  placeName?: string;
  onClose: () => void;
}) {
  const [Comp, setComp] = useState<React.ComponentType<typeof props> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('@/components/design/DesignPrint').then((mod) => {
      if (!cancelled) setComp(() => mod.default as React.ComponentType<typeof props>);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Comp) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,12,8,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PAPER, fontWeight: 700 }}>
        Loading Print / Export…
      </div>
    );
  }
  return <Comp {...props} />;
}

export default function DesignStudioPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: PAPER }} />}>
      <DesignStudioInner />
    </Suspense>
  );
}
