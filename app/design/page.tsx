'use client';

// Design Studio — phone-first page where a farmer places elements at true real-world
// scale, draws zone polygons/lines, is guided by an AI advisor, and ends with a strict
// AI "glossy" render of exactly what they built. NEW file only — does not modify any
// existing route or component.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Position } from 'geojson';
import { ArrowLeft, Compass, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, Image as ImageIcon, Sprout, X, Printer, Lock } from 'lucide-react';
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
  type GroundFeatureKind,
  type PlacedItem,
  type WizardStep,
  type ZoneShape,
} from '@/lib/design-canvas';
import { tidyOutline, tidyOutlineSummary, type TidyOutlineResult } from '@/lib/tidy-outline';
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
import { ELEMENT_CATALOG, ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_DEFS, type ElementCategory } from '@/lib/design-elements';
import { loadSiteElements, type SiteElementType } from '@/lib/site-elements';
import type { LineShape } from '@/lib/design-canvas';
import { suggestZones } from '@/lib/design-suggest';
import { resolveBaseLayers, type MapRefLayers } from '@/lib/base-layers';
import { fetchBasemapForFrame } from '@/lib/basemap-imagery';
import DesignCanvas, { type TracedLayer } from '@/components/design/DesignCanvas';
import DesignPalette, { type DesignMode } from '@/components/design/DesignPalette';
import DesignWizard, { STEP_ORDER, STEP_LABELS } from '@/components/design/DesignWizard';
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

const MAX_UNDO = 25;

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

// Auto-focus: on a step change, which ELEMENT layers to show. Context layers (baseMap, ground,
// labels, contours) are NOT touched here — they stay as the farmer set them. Line kinds follow
// their functional layer (LINE_LAYER in DesignCanvas), so focusing 'water' also shows drip/pipe/
// swale automatically. Base = trace-only (all element layers off); Review/Glossy = everything on.
const ELEMENT_LAYER_KEYS = ['water', 'earthworks', 'zones', 'planting', 'structures', 'access', 'animals'] as const;
// Element layers are always set; the context layers `sector`/`baseMap` are only present in the
// return when a step actively FORCES them (today just the Sector step). Steps that omit them
// leave `a.sector`/`a.baseMap` untouched through the spread in setStep — the same "preserve what
// the farmer toggled" rule contours already follow (see page.tsx guided-mode reset).
type StepFocus = Record<(typeof ELEMENT_LAYER_KEYS)[number], boolean> & Partial<Record<'sector' | 'baseMap', boolean>>;
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
      // but force the Sector energies overlay + satellite ON so the farmer immediately SEES the
      // sun/wind/fire/water. Only the Sector step returns `sector`, so once past it the value is
      // preserved across steps (design WITH the energies) until the farmer toggles it off.
      return { ...on([]), sector: true, baseMap: true };
    case 'water':
      return on(['water', 'earthworks']);
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
  const [tidyPreview, setTidyPreview] = useState<{ id: string; kind: 'zone' | 'line'; result: TidyOutlineResult } | null>(null);
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
  const [snapPreview, setSnapPreview] = useState<{ ids: string[]; result: BulkSnapResult } | null>(null);
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
    if (t !== 'select') {
      setSelectedIds([]);
      setMultiSelectMode(false);
    }
  }, []);
  const [placeDefId, setPlaceDefId] = useState<string | null>(null);
  const [zoneDraw, setZoneDraw] = useState<0 | 1 | 2 | 3 | 4 | 5>(1);
  // Armed ground-feature label (house/patio/…) for the shared polygon-draw tool; null = the
  // zone tool draws a plain permaculture effort-zone.
  const [areaFeature, setAreaFeature] = useState<GroundFeatureKind | null>(null);
  const [lineKind, setLineKind] = useState<LineShape['kind']>('swale');
  // Every element layer MUST default to true: the Pro catalog filter and the canvas both gate
  // on these, so a key defaulting to false (or missing) silently hides that category's elements
  // from the palette AND the map.
  const [activeLayers, setActiveLayers] = useState({
    water: true,
    earthworks: true,
    zones: true,
    planting: true,
    structures: true,
    access: true,
    animals: true,
    ground: true,
    baseMap: true,
    labels: true,
    symbols: true,
    contours: false, // opt-in overlay (approximate, from slope + aspect)
    sector: false, // opt-in overlay (deterministic sun/wind/fire/water/frost energies, from lib/sector)
  });
  // Switching INTO guided restores every layer — a first-timer should never land in guided
  // with a layer invisibly hidden. Layer toggles now exist in guided too, but this reset is
  // still the safe default on mode switch.
  useEffect(() => {
    if (designMode === 'guided') {
      setActiveLayers((a) => ({ water: true, earthworks: true, zones: true, planting: true, structures: true, access: true, animals: true, ground: true, baseMap: true, labels: true, symbols: true, contours: a.contours, sector: a.sector }));
    }
  }, [designMode]);

  // Item edit sheet — the item currently being edited via DesignCanvas's onEditItem.
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const [detectError, setDetectError] = useState<string | null>(null);

  // Copy/paste clipboard for selected shapes (Cmd/Ctrl+C / +V). Ref, not state — it never needs
  // to trigger a render, and paste reads it synchronously.
  const clipboard = useRef<{ items: PlacedItem[]; zones: ZoneShape[]; lines: LineShape[] }>({ items: [], zones: [], lines: [] });

  // Collapse the top chrome (auto-design bar + wizard) into a slim strip so the canvas
  // gets the full screen — the design surface was cramped into ~half the height.
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
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
      const customBase = savedForBase?.useCustomBase ? (savedForBase.customBase ?? null) : null;
      const loadCustomBase = (targetFrame: typeof frameNoImg) => {
        if (!customBase) return;
        if (loadedCustomBaseUrlRef.current === customBase.url) return;
        fetchImageAsDataUrl(customBase.url)
          .then((dataUrl) => {
            loadedCustomBaseUrlRef.current = customBase.url;
            setFrame((prev) => (prev ? { ...prev, satDataUrl: dataUrl, mPerPx: customBase.mPerPx } : prev));
          })
          .catch(() => setFrame((prev) => (prev ? { ...prev, satDataUrl: null } : prev)));
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

      if (frameMoved) {
        lastFetchedFrame = { centerLng: frameNoImg.centerLng, centerLat: frameNoImg.centerLat, zoom: frameNoImg.zoom };
        if (customBase) {
          setFrame((prev) => ({ ...frameNoImg, mPerPx: customBase.mPerPx, satDataUrl: prev?.satDataUrl ?? null }));
          loadCustomBase(frameNoImg);
        } else {
          setFrame({ ...frameNoImg, satDataUrl: null });
          if (url) {
            // Through fetchBasemapForFrame, not fetchImageAsDataUrl directly — see that function
            // for why. This is the surface the farmer actually uses; a provider branch that skips
            // it is a provider branch that does nothing.
            fetchBasemapForFrame(frameNoImg, url, fetchImageAsDataUrl)
              .then((dataUrl) => setFrame({ ...frameNoImg, satDataUrl: dataUrl }))
              .catch(() => setFrame({ ...frameNoImg, satDataUrl: null }));
          }
        }
      } else {
        setFrame((prev) => ({
          ...frameNoImg,
          mPerPx: customBase ? customBase.mPerPx : frameNoImg.mPerPx,
          satDataUrl: prev?.satDataUrl ?? null,
        }));
        loadCustomBase(frameNoImg);
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
          items.push({ id: newId(), defId, x, y, label: el.label, note: el.note });
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
      handleChange((prev) => ({
        ...prev,
        useCustomBase: true,
        customBase: { url: result.url, mPerPx: result.mPerPx, uploadedAt: new Date().toISOString() },
      }));
      setFrame((prev) => (prev ? { ...prev, mPerPx: result.mPerPx, satDataUrl: result.previewDataUrl } : prev));
      setShowPhotoImport(false);
    },
    [handleChange],
  );

  // Switch back to the real satellite view — the farmer's uploaded photo stays saved
  // (customBase is left untouched; only the useCustomBase flag flips), so switching back to
  // "your photo" later needs no re-upload or re-calibration.
  const revertToSatellite = useCallback(() => {
    handleChange((prev) => ({ ...prev, useCustomBase: false }));
    const { frame: freshFrame, url: satUrl } = computeCanvasFrame(layers, lat, lon);
    setFrame((prev) => (prev ? { ...prev, mPerPx: freshFrame.mPerPx, satDataUrl: null } : prev));
    if (satUrl) {
      fetchImageAsDataUrl(satUrl)
        .then((dataUrl) => setFrame((prev) => (prev ? { ...prev, satDataUrl: dataUrl } : prev)))
        .catch(() => {});
    }
  }, [handleChange, layers, lat, lon]);

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
          .map((it) => ({ ...it, id: newId(), x: Math.min(0.98, it.x + DUPLICATE_OFFSET), y: Math.min(0.98, it.y + DUPLICATE_OFFSET) }));
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
  const selectedItemForAngle = selectedId ? canvasState?.items.find((it) => it.id === selectedId) ?? null : null;
  const angleControl =
    selectedItemForAngle && ELEMENTS_BY_ID[selectedItemForAngle.defId]?.shape === 'rect'
      ? {
          deg: selectedItemForAngle.rot ?? 0,
          onRotate: (deg: number) => {
            const id = selectedItemForAngle.id;
            handleChange((prev) => ({
              ...prev,
              items: prev.items.map((it) => (it.id === id ? { ...it, rot: normaliseRotation(deg) } : it)),
              updatedAt: new Date().toISOString(),
            }));
          },
        }
      : null;

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
  // Tapping Tidy only COMPUTES and OPENS a preview — it never itself edits the design. See
  // DesignCanvas's tidyPreview prop for the overlay + confirm/cancel panel this feeds.
  const onTidySelected = (selectedZoneForTidy || selectedLineForTidy) && frame
    ? () => {
        const kind: 'zone' | 'line' = selectedZoneForTidy ? 'zone' : 'line';
        const shapePoints = selectedZoneForTidy ? selectedZoneForTidy.points : selectedLineForTidy!.points;
        const result = tidyOutline(shapePoints, { frame, closed: kind === 'zone' });
        setSnapPreview(null); // only one pending preview action at a time
        setTidyPreview({ id: selectedId!, kind, result });
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
        const result = snapSelectedRings(
          selectedZonesForSnap.map(toBulkSnapRing),
          canvasState.zones.map(toBulkSnapRing),
          { frame },
        );
        setTidyPreview(null); // only one pending preview action at a time
        setCleanupPreview(null);
        setSnapPreview({ ids: [...selectedIds], result });
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
    // the others off"). Only the ELEMENT layers are focused; context layers (baseMap, ground/
    // Existing, labels, contours) are left exactly as the farmer set them — you always need the
    // satellite + existing site to place against. Fires once per explicit step tap (not on
    // re-render or remote sync), so a manual toggle mid-step is never stomped until the next tap.
    setActiveLayers((a) => ({ ...a, ...applyStepFocus(step) }));
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
        <span style={{ flexShrink: 0 }}>
          <LessonLink id="design:overview" label="Learn" />
        </span>
        <button
          type="button"
          onClick={toggleDesignMode}
          aria-label={`Switch to ${designMode === 'pro' ? 'Guided' : 'Pro'} mode`}
          title={designMode === 'pro' ? 'Pro — full designer: every tool, jump any step' : 'Guided — simple step-by-step, one focus at a time'}
          style={{
            marginLeft: 'auto',
            display: 'flex',
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
        {buildInfo?.sha && (
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
      {canvasState && (
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
          {chromeCollapsed && (() => {
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
                    : canvasState.step === 'zones'
                      ? 'zones'
                      : canvasState.step === 'planting'
                        ? 'planting'
                        : canvasState.step === 'structures'
                          ? 'structures'
                          : 'all',
                )
              }
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: OCHRE, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 34, padding: '0 4px' }}
            >
              <ImageIcon size={15} /> Preview map
            </button>
          )}
          <button
            type="button"
            onClick={() => setChromeCollapsed((c) => !c)}
            style={{ marginLeft: canvasState.step !== 'glossy' ? 'auto' : 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 34, padding: '0 4px' }}
          >
            {chromeCollapsed ? <><ChevronDown size={15} /> Show steps</> : <><ChevronUp size={15} /> More space</>}
          </button>
        </div>
      )}

      {/* Canvas (middle). minHeight floor (not 0) so the map can never be squeezed to a sliver
          on a phone by the tool chrome below it — it always keeps ~45% of the screen.
          canvasWrapRef feeds the phone-only auto-collapse-top-chrome-on-drag effect above. */}
      <div ref={canvasWrapRef} style={{ flex: 1, position: 'relative', minHeight: '45dvh' }}>
        {canvasState && frame && canvasState.step === 'glossy' ? (
          <DesignGlossyLazy
            state={canvasState}
            frame={frame}
            refLayers={refLayers}
            site={glossySite}
            placeName={siteName}
            geometryLock={geometryLock}
            onGeometryLockChange={setGeometryLock}
          />
        ) : canvasState && frame ? (
          <>
            <DesignCanvas
              frame={frame}
              state={canvasState}
              onChange={(next) => handleChange(() => next)}
              tool={tool}
              placeDefId={placeDefId}
              zoneDraw={zoneDraw}
              areaFeature={areaFeature}
              lineKind={lineKind}
              activeLayers={activeLayers}
              onToggleBaseMap={() => setActiveLayers((a) => ({ ...a, baseMap: !a.baseMap }))}
              onToggleSector={() => setActiveLayers((a) => ({ ...a, sector: !a.sector }))}
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
              onEditItem={setEditItemId}
              onToolChange={handleSetTool}
              tracedLayers={tracedLayers}
              tidyPreview={
                tidyPreview
                  ? {
                      kind: tidyPreview.kind,
                      tidiedPoints: tidyPreview.result.points,
                      summary: tidyOutlineSummary(tidyPreview.result),
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
                      summary: snapSelectedRingsSummary(snapPreview.result),
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
        {canvasState && canvasState.step !== 'glossy' && (
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
      {canvasState && canvasState.step === 'base' && (
        <div style={{ padding: '6px 12px 0' }}>
          {canvasState.useCustomBase && canvasState.customBase ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
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
              <span style={{ flex: 1 }}>Using your own photo as the base.</span>
              <button
                type="button"
                onClick={revertToSatellite}
                style={{ border: 'none', background: 'transparent', color: GREEN, fontWeight: 700, cursor: 'pointer', fontSize: 12.5, padding: '4px 6px' }}
              >
                Switch to satellite view
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPhotoImport(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 12px', borderRadius: 12, border: '1px dashed rgba(192,122,30,0.4)', background: 'transparent', color: OCHRE, cursor: 'pointer', textAlign: 'left', fontSize: 12.5 }}
            >
              <ImageIcon size={15} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 800 }}>Have a drone photo of your land?</span> Import it and draw on top instead of the satellite view.
              </span>
              <ChevronRight size={16} style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      )}

      {showPhotoImport && (
        <BasePhotoImport onApply={applyCustomBase} onClose={() => setShowPhotoImport(false)} />
      )}

      {/* "Just beds & trees" quick path — for the farmer who doesn't want the full permaculture
          plan. Offered on the first (Base) step; jumps straight to Planting. */}
      {canvasState && canvasState.step === 'base' && designMode === 'guided' && (
        <div style={{ padding: '6px 12px 0' }}>
          <button
            type="button"
            onClick={() => { setDesignMode('guided'); setStep('planting'); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 12px', borderRadius: 12, border: '1px dashed rgba(31,77,43,0.4)', background: 'transparent', color: GREEN, cursor: 'pointer', textAlign: 'left', fontSize: 12.5 }}
          >
            <Sprout size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 800 }}>Just want beds &amp; trees?</span> Skip ahead — place them, then plan your crops.
            </span>
            <ChevronRight size={16} style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}

      {/* Step-by-step guide — the walked micro-task checklist for the current step, with a
          "Do this" that arms the right tool and a "Why this matters" lesson. */}
      {canvasState && canvasState.step !== 'glossy' && canvasState.step !== 'review' && (
        <StepGuide
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

      {/* Palette (docked bottom) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <DesignPalette
          step={canvasState.step}
          mode={designMode}
          tool={tool}
          setTool={handleSetTool}
          placeDefId={placeDefId}
          setPlaceDefId={setPlaceDefId}
          zoneDraw={zoneDraw}
          setZoneDraw={setZoneDraw}
          areaFeature={areaFeature}
          setAreaFeature={setAreaFeature}
          lineKind={lineKind}
          setLineKind={setLineKind}
          activeLayers={activeLayers}
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
          windControl={windControl}
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
  const [wM, setWM] = useState(String(item.wM ?? def?.wM ?? 1));
  const [hM, setHM] = useState(String(item.hM ?? def?.hM ?? 1));
  const [rot, setRot] = useState(String(Math.round(item.rot ?? 0)));

  function handleSave() {
    const parsedW = parseFloat(wM);
    const parsedH = parseFloat(hM);
    const patch: ItemEditPatch = {
      label: label.trim() ? label.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
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
