'use client';

// Design Studio — phone-first page where a farmer places elements at true real-world
// scale, draws zone polygons/lines, is guided by an AI advisor, and ends with a strict
// AI "glossy" render of exactly what they built. NEW file only — does not modify any
// existing route or component.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Position } from 'geojson';
import { ArrowLeft, Compass, MapPin } from 'lucide-react';
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
  type PlacedItem,
  type WizardStep,
  type ZoneShape,
} from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';
import { loadSiteElements, type SiteElementType } from '@/lib/site-elements';
import type { LineShape } from '@/lib/design-canvas';
import { suggestZones, suggestWater, suggestStructures, suggestPlanting } from '@/lib/design-suggest';
import { stripDataUrl } from '@/lib/ai-render-client';
import DesignCanvas from '@/components/design/DesignCanvas';
import DesignPalette, { type DesignMode } from '@/components/design/DesignPalette';
import DesignWizard from '@/components/design/DesignWizard';
import DesignAdvisor from '@/components/design/DesignAdvisor';

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
  const [houseXY, setHouseXY] = useState<[number, number] | null>(null);
  const [frame, setFrame] = useState<CanvasFrame | null>(null);
  const [canvasState, setCanvasState] = useState<DesignCanvasState | null>(null);
  const [saved, setSaved] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'place' | 'zone' | 'line'>('select');
  const [placeDefId, setPlaceDefId] = useState<string | null>(null);
  const [zoneDraw, setZoneDraw] = useState<0 | 1 | 2 | 3 | 4 | 5>(1);
  const [lineKind, setLineKind] = useState<LineShape['kind']>('swale');
  const [activeLayers, setActiveLayers] = useState({
    water: true,
    zones: true,
    planting: true,
    structures: true,
    lines: true,
  });

  // Item edit sheet — the item currently being edited via DesignCanvas's onEditItem.
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Auto-detect — AI suggestions awaiting farmer review.
  const [suggestions, setSuggestions] = useState<DetectSuggestion[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

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

  // Delete whatever is selected (item, zone or line) — used by the palette's Delete button.
  const onDeleteSelected = selectedId
    ? () => {
        const id = selectedId;
        setSelectedId(null);
        handleChange((prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.id !== id),
          zones: prev.zones.filter((z) => z.id !== id),
          lines: prev.lines.filter((l) => l.id !== id),
          updatedAt: new Date().toISOString(),
        }));
      }
    : null;

  // Step navigation must NOT push an undo entry — otherwise Undo bounces the farmer
  // between wizard steps instead of reverting their last content edit (item/zone/line
  // change). Saves + persists like handleChange, just skips the undoStack push.
  const setStep = useCallback((step: WizardStep) => {
    setCanvasState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, step, updatedAt: new Date().toISOString() };
      persistCanvasState(next);
      return next;
    });
  }, []);

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

  // Per-step suggest: 'base' keeps the existing AI vision detect; the other four steps
  // use the instant local geometry generators from lib/design-suggest.ts.
  const handleSuggest = useCallback(() => {
    if (!canvasState) return;
    if (canvasState.step === 'base') {
      handleVisionDetect();
      return;
    }
    if (refLayers.boundary.length < 3) {
      setDetectError('Trace your boundary on the main map first.');
      return;
    }
    setDetectError(null);
    let next: DetectSuggestion[] = [];
    switch (canvasState.step) {
      case 'zones':
        next = suggestZones(refLayers.boundary, refLayers.house);
        break;
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
    setSuggestions((prev) => [...prev.filter((s) => s.status !== 'pending'), ...next]);
  }, [canvasState, refLayers, frame, handleVisionDetect]);

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
          title={designMode === 'pro' ? 'Pro: full catalog, jump any step' : 'Guided: palette filtered to this step'}
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

      {/* Canvas (middle) */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
              lineKind={lineKind}
              activeLayers={activeLayers}
              refLayers={refLayers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              suggestions={suggestions}
              onEditItem={setEditItemId}
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

      {/* Palette (docked bottom) */}
      {canvasState && canvasState.step !== 'glossy' && (
        <DesignPalette
          step={canvasState.step}
          mode={designMode}
          tool={tool}
          setTool={setTool}
          placeDefId={placeDefId}
          setPlaceDefId={setPlaceDefId}
          zoneDraw={zoneDraw}
          setZoneDraw={setZoneDraw}
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
            if (selectedId === id) setSelectedId(null);
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
