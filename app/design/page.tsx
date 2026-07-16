'use client';

// Design Studio — phone-first page where a farmer places elements at true real-world
// scale, draws zone polygons/lines, is guided by an AI advisor, and ends with a strict
// AI "glossy" render of exactly what they built. NEW file only — does not modify any
// existing route or component.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Position } from 'geojson';
import { ArrowLeft, Compass, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lightbulb, SlidersHorizontal, Image as ImageIcon, Sprout, X } from 'lucide-react';
import { loadPlaces, resolveColor, type SavedPlace } from '@/lib/saved-places';

import type { LocationData } from '@/lib/types';
import {
  designSiteIdFromLocation,
  loadDesignStudioState,
  mergeFarmShapesIntoDesignState,
  type DesignLayer,
} from '@/lib/design-studio';
import { readLocalFarmShapes, MAP_STATE_EVENT } from '@/lib/map-sync';
import { pushDesignCanvas, reconcileDesignCanvas, subscribeDesignCanvasLive } from '@/lib/design-canvas-sync';
import { useAuth } from '@/lib/auth';
import {
  computeCanvasFrame,
  fetchImageAsDataUrl,
  loadCanvasState,
  saveCanvasState,
  migrateStateToFrame,
  newId,
  pointInRing,
  DESIGN_CANVAS_CHANGED_EVENT,
  type CanvasFrame,
  type DesignCanvasState,
  type DetectSuggestion,
  type GroundFeatureKind,
  type PlacedItem,
  type WizardStep,
  type ZoneShape,
} from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';
import { loadSiteElements, type SiteElementType } from '@/lib/site-elements';
import type { LineShape } from '@/lib/design-canvas';
import {
  suggestZones,
  suggestZonesFromPlan,
  suggestFromAutoDesignPlan,
  suggestWater,
  suggestStructures,
  suggestPlanting,
  type ZonePlan,
  type AutoDesignPlan,
  type AutoDesignAnswers,
} from '@/lib/design-suggest';
import { stripDataUrl } from '@/lib/ai-render-client';
import DesignCanvas, { type TracedLayer } from '@/components/design/DesignCanvas';
import DesignPalette, { type DesignMode } from '@/components/design/DesignPalette';
import DesignWizard, { STEP_ORDER, STEP_LABELS } from '@/components/design/DesignWizard';
import { STUDIO_AREA_FOR, type AddActionId } from '@/lib/add-actions';
import type { GlossyLayerFilter } from '@/components/design/DesignGlossy';
import StepGuide from '@/components/design/StepGuide';
import type { SubStepArm } from '@/lib/design-substeps';
import DesignAdvisor from '@/components/design/DesignAdvisor';
import AutoDesignSheet from '@/components/design/AutoDesignSheet';
import AdvancedToolsSheet, { type AdvancedAction } from '@/components/design/AdvancedToolsSheet';
import { zoneAdviceFromSuggestions, type ZoneAdvicePin } from '@/components/design/zone-advice';
import SpeakButton from '@/components/SpeakButton';

const DESIGN_MODE_KEY = 'imbewu_design_mode';

function readStoredDesignMode(): DesignMode {
  if (typeof window === 'undefined') return 'guided';
  try {
    const raw = window.localStorage.getItem(DESIGN_MODE_KEY);
    return raw === 'pro' ? 'pro' : 'guided';
  } catch {
    return 'guided';
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
function persistCanvasState(state: DesignCanvasState): void {
  // Push the RESTAMPED state saveCanvasState just wrote locally, not the pre-stamp `state` —
  // otherwise the cloud gets a stale updatedAt and a real edit can lose the last-write-wins race.
  const stamped = withSelfSaveFlag(() => saveCanvasState(state));
  pushDesignCanvas(stamped).catch(() => {});
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

// Normalised-ring bbox centroid + metre extent (imgW/imgH aspect-aware), clamped to a
// sane building footprint range — used to convert a detected building ring into a shed.
function ringBboxM(
  points: Array<[number, number]>,
  frame: { imgW: number; imgH: number; mPerPx: number },
): { center: [number, number]; wM: number; hM: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const wM = Math.min(20, Math.max(2, (maxX - minX) * frame.imgW * frame.mPerPx));
  const hM = Math.min(20, Math.max(2, (maxY - minY) * frame.imgH * frame.mPerPx));
  return { center: [(minX + maxX) / 2, (minY + maxY) / 2], wM, hM };
}

const SUGGESTION_ICON: Record<DetectSuggestion['kind'], string> = {
  tree: '🌳',
  building: '🏠',
  water_tank: '🛢',
  pond: '🌊',
  veg_area: '🥬',
  driveway: '🛣',
  zone: '🎯',
  greywater: '♻️',
  compost: '♻️',
  beehive: '🐝',
  veg_bed: '🥬',
  nursery: '🌱',
  swale: '🌊',
};

// Zone suggestions get their real zone colour dot instead of the generic 🎯 icon.
function suggestionIconFor(s: DetectSuggestion): string {
  if (s.kind === 'zone' && s.zone !== undefined && ZONE_DEFS[s.zone]) {
    return ZONE_DEFS[s.zone].color;
  }
  return SUGGESTION_ICON[s.kind];
}

interface RefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
}

interface SiteCtx {
  windFromSummer?: string;
  slopeDeg?: number;
  aspectLabel?: string;
  rainfallMm?: number;
  biome?: string;
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

function readCachedLocationData(lat: number, lon: number): LocationData | null {
  if (typeof window === 'undefined') return null;
  try {
    // v2: bump the version when the location-data shape gains a field (e.g. BRU zones) so
    // already-analysed sites refetch instead of serving a stale pre-field cache. Keep the
    // key in sync with app/farmer/page.tsx.
    const cacheKey = `imbewu_loc_v2_${lat.toFixed(5)}_${lon.toFixed(5)}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocationData) : null;
  } catch {
    return null;
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
  const { user } = useAuth();
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
  const [saved, setSaved] = useState(true);

  // Multi-select: Shift/Cmd+tap adds to the selection; a plain tap replaces it. Edit/resize/
  // rotate handles only appear on a SINGLE selection; a group just gets highlight rings and
  // can be deleted together (Rory's "command-select for multiple + delete" ask).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
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
  const [activeLayers, setActiveLayers] = useState({
    water: true,
    zones: true,
    planting: true,
    structures: true,
    lines: true,
    ground: true,
    baseMap: true,
  });
  // Switching INTO guided restores every layer — a first-timer should never land in guided
  // with a layer invisibly hidden. Layer toggles now exist in guided too, but this reset is
  // still the safe default on mode switch.
  useEffect(() => {
    if (designMode === 'guided') {
      setActiveLayers({ water: true, zones: true, planting: true, structures: true, lines: true, ground: true, baseMap: true });
    }
  }, [designMode]);

  // Item edit sheet — the item currently being edited via DesignCanvas's onEditItem.
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Auto-detect — AI suggestions awaiting farmer review.
  const [suggestions, setSuggestions] = useState<DetectSuggestion[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // AI Auto-Design — one action designs the whole farm. 'questions' shows the lightweight
  // sheet; 'running' drives the "Designing your farm…" overlay. Answers are all optional.
  const [autoDesignPhase, setAutoDesignPhase] = useState<'idle' | 'questions' | 'running'>('idle');
  const [autoAnswers, setAutoAnswers] = useState<AutoDesignAnswers>({});
  // Collapse the top chrome (auto-design bar + wizard) into a slim strip so the canvas
  // gets the full screen — the design surface was cramped into ~half the height.
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  // Per-layer glossy preview overlay: when non-null, show the strict glossy render scoped to
  // this layer over the studio, without leaving the current step. null = closed.
  const [previewFilter, setPreviewFilter] = useState<GlossyLayerFilter | null>(null);
  // Advanced (beta) sheet — the quiet home for the demoted auto-draw / auto-design tools.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Zone ADVICE (the guidance half of the hybrid): Lima's spatial suggestions shown as short
  // text advice the farmer taps to ARM a zone chip and then draws themselves — never committed.
  const [zoneAdvice, setZoneAdvice] = useState<ZoneAdvicePin[]>([]);

  const undoStack = useRef<DesignCanvasState[]>([]);
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
    };
  }, [locationData]);

  // Load location data cache + traced layers + build the canvas frame.
  useEffect(() => {
    if (!hasSite) return;
    setLocationData(readCachedLocationData(lat, lon));

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
      const driveLine = driveLayer
        ? (driveLayer.geometry?.type === 'Polygon' || driveLayer.geometry?.type === 'MultiPolygon'
            ? ringFromGeometry(driveLayer.geometry)
            : lineFromGeometry(driveLayer.geometry)
          ).map((c) => project(c))
        : [];

      setRefLayers({ boundary: boundaryRing, house: houseRing, driveway: driveLine });
      setHouseXY(centroidOf(houseRing));

      // Build the tappable/adoptable traced layers: every near-site classified layer EXCEPT
      // the one used as the boundary fence (which stays a non-adopted reference). Access
      // shapes become polylines (adopt → path); everything else a polygon (adopt → zone/item).
      // Geometry is projected here with the same project() the satellite fit uses, so the
      // adopted normalised coords line up pixel-for-pixel — no redraw, no drift.
      const boundaryFeatureId = boundaryLayer?.featureId;
      const traced: TracedLayer[] = [];
      for (const l of merged.layers) {
        if (boundaryFeatureId && l.featureId === boundaryFeatureId) continue;
        const isAccess = l.layerType === 'access';
        const rawCoords = isAccess
          ? (l.geometry?.type === 'Polygon' || l.geometry?.type === 'MultiPolygon'
              ? ringFromGeometry(l.geometry)
              : lineFromGeometry(l.geometry))
          : ringFromGeometry(l.geometry);
        if (rawCoords.length === 0) continue;
        const points = rawCoords.map((c) => project(c));
        const render: TracedLayer['render'] = isAccess ? 'line' : 'polygon';
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
        setFrame({ ...frameNoImg, satDataUrl: null });
        if (url) {
          fetchImageAsDataUrl(url)
            .then((dataUrl) => setFrame({ ...frameNoImg, satDataUrl: dataUrl }))
            .catch(() => setFrame({ ...frameNoImg, satDataUrl: null }));
        }
      } else {
        setFrame((prev) => ({ ...frameNoImg, satDataUrl: prev?.satDataUrl ?? null }));
      }

      // Canvas state: load existing, or seed fresh from traced site elements on first visit.
      setCanvasState((prev) => {
        const existing = loadCanvasState(siteId);
        if (existing) {
          const migrated = migrateStateToFrame(existing, frameNoImg, project);
          if (migrated !== existing) persistCanvasState(migrated);
          return migrated;
        }
        if (prev && prev.siteId === siteId) {
          const migratedPrev = migrateStateToFrame(prev, frameNoImg, project);
          if (migratedPrev !== prev) persistCanvasState(migratedPrev);
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
        return { ...fresh, items };
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
    if (!uid || !hasSite) return;
    reconcileDesignCanvas(siteId).catch(() => {});
    return subscribeDesignCanvasLive(siteId);
  }, [user?.uid, hasSite, siteId]);

  // Persist canvas state on change (with undo history), and re-run the advisor.
  const handleChange = useCallback(
    (updater: (prev: DesignCanvasState) => DesignCanvasState) => {
      setSaved(false);
      setCanvasState((prev) => {
        if (!prev) return prev;
        undoStack.current = [...undoStack.current, prev].slice(-MAX_UNDO);
        const next = updater(prev);
        persistCanvasState(next);
        setSaved(true);
        return next;
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setSaved(false);
    setCanvasState((prev) => {
      const popped = undoStack.current.pop();
      if (!popped || !prev) {
        setSaved(true);
        return prev;
      }
      persistCanvasState(popped);
      setSaved(true);
      return popped;
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
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length && onDeleteSelected) {
        e.preventDefault();
        onDeleteSelected();
        return;
      }
      if (e.key === 'Escape' && selectedIds.length) setSelectedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, onDeleteSelected, selectedIds]);

  // Step navigation must NOT push an undo entry — otherwise Undo bounces the farmer
  // between wizard steps instead of reverting their last content edit (item/zone/line
  // change). Saves + persists like handleChange, just skips the undoStack push.
  const setStep = useCallback((step: WizardStep) => {
    // The ground-feature chips live only on the Base step; clear any armed feature on a step
    // change so a still-armed 'house' can't silently stamp a plain zone drawn on another step.
    setAreaFeature(null);
    // Zone advice pins are only meaningful on the zones step — clear them on any step change.
    setZoneAdvice([]);
    setCanvasState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, step, updatedAt: new Date().toISOString() };
      persistCanvasState(next);
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

  const handleVisionDetect = useCallback(async () => {
    if (!frame?.satDataUrl) {
      setDetectError('Satellite image not loaded yet — wait a moment and try again.');
      return;
    }
    setDetectError(null);
    setDetecting(true);
    try {
      const res = await fetch('/api/design-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: stripDataUrl(frame.satDataUrl),
          imgW: frame.imgW,
          imgH: frame.imgH,
          mPerPx: frame.mPerPx,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetectError(typeof data?.error === 'string' ? data.error : 'Auto-detect failed — please try again.');
        return;
      }
      const rawFeatures = Array.isArray(data?.features) ? data.features : [];
      const next: DetectSuggestion[] = rawFeatures.map(
        (f: { kind: DetectSuggestion['kind']; points: Array<[number, number]>; sizeM?: number; note?: string }) => ({
          id: newId(),
          kind: f.kind,
          points: f.points,
          sizeM: f.sizeM,
          note: f.note,
          status: 'pending' as const,
        }),
      );
      setSuggestions((prev) => [...prev.filter((s) => s.status !== 'pending'), ...next]);
    } catch {
      setDetectError('Auto-detect failed — please try again.');
    } finally {
      setDetecting(false);
    }
  }, [frame]);

  // Per-step suggest: 'base' keeps the existing AI vision detect; 'zones' uses the HYBRID
  // AI-vision planner (reason over the satellite → clean geometry) with a deterministic
  // fallback; the remaining steps use the instant local geometry generators.
  //
  // Takes `step` as an argument (not `canvasState.step`) so the Advanced sheet can run any
  // step's generator regardless of the wizard's current step. The Pro-mode pill passes the
  // current step via `handleSuggest` below.
  const runSuggestForStep = useCallback(async (step: WizardStep) => {
    if (!canvasState) return;
    if (step === 'base') {
      handleVisionDetect();
      return;
    }
    if (refLayers.boundary.length < 3) {
      setDetectError('Trace your boundary on the main map first.');
      return;
    }
    setDetectError(null);

    const mergePending = (next: DetectSuggestion[]) =>
      setSuggestions((prev) => [...prev.filter((s) => s.status !== 'pending'), ...next]);

    if (step === 'zones') {
      if (!frame) return;
      // Only ACCEPTED placements count as ground truth here — raw pending vision-detect
      // suggestions are unconfirmed and would let a false-positive distort the zone plan.
      const structures = canvasState.items
        .filter((i) => ELEMENTS_BY_ID[i.defId]?.category === 'structure')
        .map((i) => ({ x: i.x, y: i.y, wM: i.wM ?? ELEMENTS_BY_ID[i.defId].wM, hM: i.hM ?? ELEMENTS_BY_ID[i.defId].hM }));
      // Only close-in annual veg (zoneRec includes 1 or 2) may anchor Zone 2. An orchard
      // tree (zoneRec [3]) placed far from the house must NOT drag Zone 2 across the plot to
      // reach it — it belongs in Zone 3. Items with no zone hint are left out (conservative).
      const existingVeg = canvasState.items
        .filter((i) => {
          const def = ELEMENTS_BY_ID[i.defId];
          return def?.category === 'growing' && !!def.zoneRec?.some((z) => z === 1 || z === 2);
        })
        .map((i) => ({ x: i.x, y: i.y }));
      const zoneOpts = {
        frame: { imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx },
        driveway: refLayers.driveway,
        site,
        structures,
        existingVeg,
      };
      const deterministic = () => suggestZones(refLayers.boundary, refLayers.house, zoneOpts);

      // No satellite loaded → the AI has nothing to look at; use the deterministic plan.
      if (!frame.satDataUrl) {
        mergePending(deterministic());
        return;
      }

      setDetecting(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch('/api/suggest-zones-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: stripDataUrl(frame.satDataUrl),
            imgW: frame.imgW,
            imgH: frame.imgH,
            mPerPx: frame.mPerPx,
            boundary: refLayers.boundary,
            house: refLayers.house,
            driveway: refLayers.driveway,
            slopeDeg: site?.slopeDeg,
            aspectLabel: site?.aspectLabel,
            rainfallMm: site?.rainfallMm,
            biome: site?.biome,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('suggest-zones-ai failed');
        const data = await res.json();
        const plan: ZonePlan | null = data && Array.isArray(data.zones) ? (data as ZonePlan) : null;
        const aiZones = plan ? suggestZonesFromPlan(refLayers.boundary, refLayers.house, zoneOpts, plan) : [];
        // Any AI hiccup (empty/garbled plan, geometry that clipped to nothing) still leaves
        // the farmer with a usable suggestion via the deterministic path.
        mergePending(aiZones.length > 0 ? aiZones : deterministic());
      } catch {
        mergePending(deterministic());
      } finally {
        clearTimeout(timeout);
        setDetecting(false);
      }
      return;
    }

    let next: DetectSuggestion[] = [];
    switch (step) {
      case 'water':
        if (!frame) return;
        next = suggestWater(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH);
        break;
      case 'structures':
        if (!frame) return;
        next = suggestStructures(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH);
        break;
      case 'planting':
        if (!frame) return;
        next = suggestPlanting(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH);
        break;
      default:
        return;
    }
    mergePending(next);
  }, [canvasState, refLayers, frame, site, handleVisionDetect]);

  // Open the Auto-Design questionnaire sheet (guarded on a traced boundary, same as suggest).
  // Declared before runAdvancedAction, which depends on it.
  const openAutoDesign = useCallback(() => {
    if (refLayers.boundary.length < 3) {
      setDetectError('Trace your boundary on the main map first.');
      return;
    }
    setDetectError(null);
    setAutoDesignPhase('questions');
  }, [refLayers.boundary.length]);

  // Pro-mode compact pill: run the suggest generator for whatever step is showing.
  const handleSuggest = useCallback(() => {
    if (canvasState) runSuggestForStep(canvasState.step);
  }, [canvasState, runSuggestForStep]);

  // Advanced (beta) sheet actions — decoupled from the current wizard step by design.
  const runAdvancedAction = useCallback(
    (action: AdvancedAction) => {
      setAdvancedOpen(false);
      if (action === 'detect') {
        handleVisionDetect();
        return;
      }
      if (action === 'autoDesign') {
        openAutoDesign();
        return;
      }
      runSuggestForStep(action); // 'zones' | 'water' | 'planting' | 'structures'
    },
    [handleVisionDetect, openAutoDesign, runSuggestForStep],
  );

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
        return def?.category === 'growing' && !!def.zoneRec?.some((z) => z === 1 || z === 2);
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

  // Run the whole-farm AI Auto-Design. ONE vision call returns intent → code makes geometry
  // (suggestFromAutoDesignPlan) → everything lands as PENDING suggestions. Any failure path
  // (no key/502, timeout, no satellite, empty plan, geometry clipped to nothing) falls back to
  // the full deterministic suite so the farmer always gets a complete farm design.
  const runAutoDesign = useCallback(async (answersOverride?: AutoDesignAnswers) => {
    // Take answers as an arg so "Skip" can pass {} synchronously — a setAutoAnswers({})
    // right before calling would not have landed in state yet (stale-closure trap).
    const answers = answersOverride ?? autoAnswers;
    if (!canvasState || !frame) return;
    if (refLayers.boundary.length < 3) {
      setAutoDesignPhase('idle');
      setDetectError('Trace your boundary on the main map first.');
      return;
    }
    setDetectError(null);
    setAutoDesignPhase('running');

    const structures = canvasState.items
      .filter((i) => ELEMENTS_BY_ID[i.defId]?.category === 'structure')
      .map((i) => ({ x: i.x, y: i.y, wM: i.wM ?? ELEMENTS_BY_ID[i.defId].wM, hM: i.hM ?? ELEMENTS_BY_ID[i.defId].hM }));
    const existingVeg = canvasState.items
      .filter((i) => {
        const def = ELEMENTS_BY_ID[i.defId];
        return def?.category === 'growing' && !!def.zoneRec?.some((z) => z === 1 || z === 2);
      })
      .map((i) => ({ x: i.x, y: i.y }));
    const zoneOpts = {
      frame: { imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx },
      driveway: refLayers.driveway,
      site,
      structures,
      existingVeg,
    };

    const mergePending = (next: DetectSuggestion[]) =>
      setSuggestions((prev) => [...prev.filter((s) => s.status !== 'pending'), ...next]);

    // Full deterministic whole-farm suite — the guaranteed fallback (and offline path).
    const deterministic = (): DetectSuggestion[] => [
      ...suggestZones(refLayers.boundary, refLayers.house, zoneOpts),
      ...suggestWater(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH),
      ...suggestStructures(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH),
      ...suggestPlanting(refLayers.boundary, refLayers.house, frame.mPerPx, frame.imgW, frame.imgH),
    ];

    // No satellite → the AI has nothing to look at; use the deterministic plan immediately.
    if (!frame.satDataUrl) {
      mergePending(deterministic());
      setAutoDesignPhase('idle');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch('/api/auto-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: stripDataUrl(frame.satDataUrl),
          imgW: frame.imgW,
          imgH: frame.imgH,
          mPerPx: frame.mPerPx,
          boundary: refLayers.boundary,
          house: refLayers.house,
          driveway: refLayers.driveway,
          slopeDeg: site?.slopeDeg,
          aspectLabel: site?.aspectLabel,
          windFromSummer: site?.windFromSummer,
          rainfallMm: site?.rainfallMm,
          biome: site?.biome,
          goal: answers.goal,
          people: answers.people,
          accessSide: answers.accessSide,
          waterSource: answers.waterSource,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('auto-design failed');
      const data = await res.json();
      const plan: AutoDesignPlan | null = data && Array.isArray(data.zones) ? (data as AutoDesignPlan) : null;
      const aiSuggestions = plan
        ? suggestFromAutoDesignPlan(refLayers.boundary, refLayers.house, zoneOpts, plan, answers)
        : [];
      mergePending(aiSuggestions.length > 0 ? aiSuggestions : deterministic());
    } catch {
      mergePending(deterministic());
    } finally {
      clearTimeout(timeout);
      setAutoDesignPhase('idle');
    }
  }, [canvasState, frame, refLayers, site, autoAnswers]);

  // Pure per-suggestion state transform, shared by acceptSuggestion (one undo entry) and
  // acceptAllSuggestions (folded into a single undo entry) — see below.
  const applySuggestion = useCallback(
    (prev: DesignCanvasState, suggestion: DetectSuggestion, frameArg: CanvasFrame): { next: DesignCanvasState; rejectedInstead: boolean } => {
      const point0 = suggestion.points[0];
      switch (suggestion.kind) {
        case 'tree': {
          if (!point0) break;
          const item: PlacedItem = {
            id: newId(),
            defId: 'tree_indigenous',
            x: point0[0],
            y: point0[1],
            wM: suggestion.sizeM ?? 6,
            hM: suggestion.sizeM ?? 6,
          };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'water_tank': {
          if (!point0) break;
          const item: PlacedItem = {
            id: newId(),
            defId: 'jojo_5000',
            x: point0[0],
            y: point0[1],
            ...(suggestion.sizeM ? { wM: suggestion.sizeM, hM: suggestion.sizeM } : {}),
          };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'pond': {
          if (!point0) break;
          const item: PlacedItem = {
            id: newId(),
            defId: 'pond_small',
            x: point0[0],
            y: point0[1],
            ...(suggestion.sizeM ? { wM: suggestion.sizeM, hM: suggestion.sizeM } : {}),
          };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'building': {
          if (suggestion.points.length === 0) break;
          const { center, wM, hM } = ringBboxM(suggestion.points, frameArg);
          if (pointInRing(center, refLayers.house)) {
            return { next: prev, rejectedInstead: true };
          }
          const item: PlacedItem = { id: newId(), defId: 'shed', x: center[0], y: center[1], wM, hM };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'veg_area': {
          if (suggestion.points.length < 3) break;
          const zone: ZoneShape = { id: newId(), zone: 2, points: suggestion.points };
          return { next: { ...prev, zones: [...prev.zones, zone], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'driveway': {
          if (suggestion.points.length < 2) break;
          const line: LineShape = { id: newId(), kind: 'path', points: suggestion.points };
          return { next: { ...prev, lines: [...prev.lines, line], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'zone': {
          if (suggestion.points.length < 3) break;
          const zone: ZoneShape = { id: newId(), zone: suggestion.zone ?? 2, points: suggestion.points };
          return { next: { ...prev, zones: [...prev.zones, zone], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'greywater': {
          if (!point0) break;
          const item: PlacedItem = { id: newId(), defId: 'greywater_basin', x: point0[0], y: point0[1] };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'compost': {
          if (!point0) break;
          const item: PlacedItem = { id: newId(), defId: 'compost_bay', x: point0[0], y: point0[1] };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'beehive': {
          if (!point0) break;
          const item: PlacedItem = { id: newId(), defId: 'beehive', x: point0[0], y: point0[1] };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'veg_bed': {
          if (!point0) break;
          const item: PlacedItem = { id: newId(), defId: 'veg_bed', x: point0[0], y: point0[1] };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'nursery': {
          if (!point0) break;
          const item: PlacedItem = { id: newId(), defId: 'nursery_table', x: point0[0], y: point0[1] };
          return { next: { ...prev, items: [...prev.items, item], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
        case 'swale': {
          if (suggestion.points.length < 2) break;
          const line: LineShape = { id: newId(), kind: 'swale', points: suggestion.points };
          return { next: { ...prev, lines: [...prev.lines, line], updatedAt: new Date().toISOString() }, rejectedInstead: false };
        }
      }
      return { next: prev, rejectedInstead: false };
    },
    [refLayers.house],
  );

  const acceptSuggestion = useCallback(
    (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      if (!suggestion || !frame) return;

      let rejectedInstead = false;

      handleChange((prev) => {
        const result = applySuggestion(prev, suggestion, frame);
        rejectedInstead = result.rejectedInstead;
        return result.next;
      });

      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: rejectedInstead ? 'rejected' : 'accepted' } : s)),
      );
    },
    [suggestions, frame, applySuggestion, handleChange],
  );

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'rejected' } : s)));
  }, []);

  // Applies every pending suggestion inside a SINGLE handleChange call, so accepting a
  // batch of AI suggestions produces one undo entry (undo reverts the whole batch), not
  // one entry per suggestion.
  const acceptAllSuggestions = useCallback(() => {
    const pending = suggestions.filter((s) => s.status === 'pending');
    if (pending.length === 0 || !frame) return;

    const outcomes = new Map<string, boolean>(); // id -> rejectedInstead

    handleChange((prev) => {
      let acc = prev;
      for (const s of pending) {
        const result = applySuggestion(acc, s, frame);
        outcomes.set(s.id, result.rejectedInstead);
        acc = result.next;
      }
      return acc;
    });

    setSuggestions((prev) =>
      prev.map((s) => (outcomes.has(s.id) ? { ...s, status: outcomes.get(s.id) ? 'rejected' : 'accepted' } : s)),
    );
  }, [suggestions, frame, applySuggestion, handleChange]);

  const dismissAllSuggestions = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' } : s)));
  }, []);

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const editItem = editItemId ? canvasState?.items.find((i) => i.id === editItemId) ?? null : null;

  if (!hasSite) return <EmptyState />;

  // Saved-place name (effect-resolved) with coordinates as the fallback.
  const siteName = placeName ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return (
    <div
      style={{
        minHeight: '100dvh',
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
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Design Studio</span>
          <span style={{ fontSize: 12, opacity: 0.65 }}>{siteName}</span>
        </div>
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
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          {saved ? 'Saved' : 'Saving…'}
        </div>
      </header>

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
          onAutoDetect={handleSuggest}
          detecting={detecting}
          suggestionsCount={pendingSuggestions.length}
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
          {canvasState.step !== 'glossy' && (
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 34, padding: '0 4px' }}
            >
              <SlidersHorizontal size={15} /> Advanced
            </button>
          )}
          <button
            type="button"
            onClick={() => setChromeCollapsed((c) => !c)}
            style={{ marginLeft: canvasState.step !== 'glossy' ? 0 : 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 34, padding: '0 4px' }}
          >
            {chromeCollapsed ? <><ChevronDown size={15} /> Show steps</> : <><ChevronUp size={15} /> More space</>}
          </button>
        </div>
      )}

      {/* Canvas (middle). minHeight floor (not 0) so the map can never be squeezed to a sliver
          on a phone by the tool chrome below it — it always keeps ~45% of the screen. */}
      <div style={{ flex: 1, position: 'relative', minHeight: '45dvh' }}>
        {canvasState && frame && canvasState.step === 'glossy' ? (
          <DesignGlossyLazy
            state={canvasState}
            frame={frame}
            refLayers={refLayers}
            site={site ? { biome: site.biome, rainfallMm: site.rainfallMm } : null}
            placeName={siteName}
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
              refLayers={refLayers}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              additiveSelect={multiSelectMode}
              onToggleAdditive={() => setMultiSelectMode((m) => !m)}
              suggestions={suggestions}
              onEditItem={setEditItemId}
              onToolChange={handleSetTool}
              tracedLayers={tracedLayers}
            />
            {pendingSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 260,
                  maxHeight: '40%',
                  overflowY: 'auto',
                  background: 'rgba(255,254,250,0.97)',
                  border: `1px solid ${GOLD}`,
                  borderRadius: 14,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  zIndex: 15,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(11,18,11,0.1)',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>AI suggestions</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={acceptAllSuggestions}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: GREEN,
                        background: 'transparent',
                        border: `1px solid ${GREEN}`,
                        borderRadius: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      Accept all
                    </button>
                    <button
                      type="button"
                      onClick={dismissAllSuggestions}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#B53A3A',
                        background: 'transparent',
                        border: '1px solid #B53A3A',
                        borderRadius: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss all
                    </button>
                  </div>
                </div>
                {pendingSuggestions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderBottom: '1px solid rgba(11,18,11,0.06)',
                    }}
                  >
                    {s.kind === 'zone' && s.zone !== undefined && ZONE_DEFS[s.zone] ? (
                      <span
                        aria-hidden
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: ZONE_DEFS[s.zone].color,
                          border: '1px solid rgba(11,18,11,0.25)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{suggestionIconFor(s)}</span>
                    )}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.note ?? s.kind}
                    </span>
                    <button
                      type="button"
                      aria-label="Accept suggestion"
                      onClick={() => acceptSuggestion(s.id)}
                      style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: '50%',
                        border: 'none',
                        background: GREEN,
                        color: PAPER,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      aria-label="Reject suggestion"
                      onClick={() => rejectSuggestion(s.id)}
                      style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#B53A3A',
                        color: PAPER,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      ✗
                    </button>
                  </div>
                ))}
              </div>
            )}
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
      </div>

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
          onDeleteSelected={onDeleteSelected}
        />
      )}

      {/* Advisor (floating) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <DesignAdvisor
          state={canvasState}
          site={site}
          houseXY={houseXY}
          lastChangeId={canvasState.updatedAt}
        />
      )}

      {/* Advanced (beta) tools sheet — the quiet home for auto-draw / auto-design. */}
      {canvasState && (
        <AdvancedToolsSheet
          open={advancedOpen}
          step={canvasState.step}
          detecting={detecting}
          onClose={() => setAdvancedOpen(false)}
          onRun={runAdvancedAction}
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
              site={site ? { biome: site.biome, rainfallMm: site.rainfallMm } : null}
              placeName={siteName}
              initialFilter={previewFilter}
            />
          </div>
        </div>
      )}

      {/* AI Auto-Design questionnaire sheet */}
      <AutoDesignSheet
        open={autoDesignPhase === 'questions'}
        answers={autoAnswers}
        onChange={(patch) => setAutoAnswers((prev) => ({ ...prev, ...patch }))}
        onSubmit={() => runAutoDesign()}
        onSkip={() => {
          setAutoAnswers({});
          runAutoDesign({}); // pass empty explicitly — don't rely on the setState landing first
        }}
        onClose={() => setAutoDesignPhase('idle')}
      />

      {/* "Designing your farm…" overlay while the whole-farm plan is running */}
      {autoDesignPhase === 'running' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: 'rgba(11,18,11,0.55)',
            color: PAPER,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: `3px solid ${GOLD}`,
              borderTopColor: 'transparent',
              animation: 'imbewu-spin 0.9s linear infinite',
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 16 }}>Designing your farm…</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, maxWidth: 260 }}>
            Reading your satellite photo and drafting zones, veg, water and a wind belt for review.
          </div>
          <style>{`@keyframes imbewu-spin { to { transform: rotate(360deg); } }`}</style>
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
  site: { biome?: string; rainfallMm?: number } | null;
  placeName?: string;
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

export default function DesignStudioPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: PAPER }} />}>
      <DesignStudioInner />
    </Suspense>
  );
}
