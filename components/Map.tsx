'use client';

import { useRef, useState, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import ReactMapGL, {
  Source, Layer, Marker, ScaleControl,
  type MapRef, type MapMouseEvent, type LayerProps,
} from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import turfArea from '@turf/area';
import turfLength from '@turf/length';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { SiteData, WaterData, LocationData } from '@/lib/types';
import { loadPlaces, savePlace, deletePlace, generateId, PLACE_LABELS, placeColor, type SavedPlace, type PlaceLabel } from '@/lib/saved-places';
import { MapPin, Trash2, Loader2, ChevronUp, ChevronDown, Layers, AlertTriangle, LocateFixed, PenLine, Droplets, Bookmark, Check, X, Search, CornerDownLeft, Mountain, Box, Hand, Sprout, PenTool, Plus, HelpCircle, Undo2 } from 'lucide-react';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Drawn parcels + water are persisted here so a refresh never loses the farmer's
// work (was the #1 complaint — "20 minutes of drawing gone on refresh").
const FARM_KEY = 'imbewu_farm_shapes';

// A "static" MapboxDraw mode: features are DISPLAYED but completely non-interactive
// (no select, no vertex-drag). We switch into it while reticle-drawing/editing so
// panning the map can't accidentally grab and move an existing boundary/water shape.
const StaticMode = {
  onSetup(this: { setActionableState?: () => void }) {
    this.setActionableState?.();
    return {};
  },
  toDisplayFeatures(_state: unknown, geojson: unknown, display: (g: unknown) => void) {
    display(geojson);
  },
};

// Touch / coarse-pointer device? On phones a "tap to add a corner" fires at the end of
// every pan, dropping stray corners — so on touch the ONLY way to add a corner is the
// big ＋ button (drops at the crosshair). Desktop mice keep click-to-place.
const IS_COARSE = typeof window !== 'undefined' &&
  ((window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

// Touch-friendly control height (bumped ~⅓): big tap targets on phones, compact on desktop.
const TOUCH_H = IS_COARSE ? 56 : 40;
const TOUCH_FS = IS_COARSE ? 18 : 15; // button font-size

const terrainSource = { type: 'raster-dem' as const, url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 };

// Minor contours (10m interval) — fade in at zoom 12, fully visible at 14
const contourMinor: LayerProps = {
  id: 'contour-minor', type: 'line', source: 'contours', 'source-layer': 'contour',
  filter: ['==', ['get', 'index'], 0],
  paint: {
    'line-color': '#7aaa50',
    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 15, 1.2],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.6, 15, 0.85],
  },
};
// Major contours (50m/100m interval)
const contourMajor: LayerProps = {
  id: 'contour-major', type: 'line', source: 'contours', 'source-layer': 'contour',
  filter: ['==', ['get', 'index'], 1],
  paint: {
    'line-color': '#b8d470',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 15, 2],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 10, 0.7, 15, 1],
  },
};
// Labels on major contours — appear earlier; minor labels at zoom 14+
const contourLabel: LayerProps = {
  id: 'contour-label', type: 'symbol', source: 'contours', 'source-layer': 'contour',
  filter: ['==', ['get', 'index'], 1], minzoom: 10,
  layout: {
    'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
    'symbol-placement': 'line',
    'text-font': ['DIN Offc Pro Regular', 'Arial Unicode MS Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 12],
    'text-letter-spacing': 0.05,
    'symbol-spacing': 300,
  },
  paint: { 'text-color': '#d4e8a0', 'text-halo-color': '#0a150a', 'text-halo-width': 2 },
};
// Minor contour labels at high zoom
const contourLabelMinor: LayerProps = {
  id: 'contour-label-minor', type: 'symbol', source: 'contours', 'source-layer': 'contour',
  filter: ['==', ['get', 'index'], 0], minzoom: 14,
  layout: {
    'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
    'symbol-placement': 'line',
    'text-font': ['DIN Offc Pro Regular', 'Arial Unicode MS Regular'],
    'text-size': 9,
    'text-letter-spacing': 0.03,
    'symbol-spacing': 400,
  },
  paint: { 'text-color': '#8ab860', 'text-halo-color': '#0a150a', 'text-halo-width': 1.5 },
};

interface Props {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedLocation: { lat: number; lon: number } | null;
  loading: boolean;
  onMapCapture?: (base64: string) => void;
  onSiteDrawn?: (site: SiteData | null) => void;
  onWaterDrawn?: (water: WaterData | null) => void;
  onCaptureClick?: () => void;
  jumpTo?: { lat: number; lon: number } | null;
  onJumpComplete?: () => void;
  onDrawingChange?: (active: boolean) => void;
  locationData?: LocationData | null;
  onPlaceSelect?: (name: string | null) => void;
}

export default function PermaMap({ onLocationSelect, selectedLocation, loading, onMapCapture, onSiteDrawn, onWaterDrawn, onCaptureClick, jumpTo, onJumpComplete, onDrawingChange, locationData, onPlaceSelect }: Props) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [style, setStyle] = useState<'satellite-streets-v12' | 'outdoors-v12'>('satellite-streets-v12');
  // Default to Mapbox satellite — consistent coverage everywhere. Esri ("HD") is sharper
  // in some rural spots but has DATA GAPS that render an opaque "Map data not yet available"
  // grey tile, so it's opt-in via the HD toggle, not the default.
  const [hdImagery, setHdImagery] = useState(false);
  const [contours, setContours] = useState(true);
  const [terrain3d, setTerrain3d] = useState(false);  // flat by default — 3D can block close-zoom needed to draw boundaries
  const [show3dWarning, setShow3dWarning] = useState(false);
  const [placeSaved, setPlaceSaved] = useState(false);  // "✓ Saved" feedback for the Save-place tool
  const [zoom, setZoom] = useState(5.2);
  // Boundary-edit engine: 'native' = Mapbox's built-in mapbox-gl-draw vertex editing;
  // 'custom' = big press-and-drag numbered handles. Toggleable so they can be compared.
  const [editEngine, setEditEngine] = useState<'native' | 'custom'>('custom');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('imbewu-edit-engine') : null;
    if (saved === 'native' || saved === 'custom') setEditEngine(saved);
  }, []);
  const chooseEngine = useCallback((e: 'native' | 'custom') => {
    setEditEngine(e);
    try { window.localStorage.setItem('imbewu-edit-engine', e); } catch {}
  }, []);
  // Map-view toggles (Sat/Topo/HD/Contours/3D) live behind a "Layers" expander so the
  // toolbar stays uncluttered on phones — collapsed by default.
  const [layersOpen, setLayersOpen] = useState(false);
  const drawTypeRef = useRef<'site' | 'water'>('site');
  const [activeDraw, setActiveDraw] = useState<null | 'site' | 'water'>(null); // currently drawing
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  // ── Google-Earth-style "drop a pin under the crosshair" drawing (phone-friendly) ──
  const [pinDraw, setPinDraw] = useState<null | 'site' | 'water'>(null);   // reticle-draw active for this type
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);  // committed [lng,lat] corners
  const [mapCenter, setMapCenter] = useState<[number, number]>([25, -29]); // live centre = reticle position (drives reprojection)
  const movePending = useRef(false); // coalesce reticle reprojection to one update per animation frame
  const [siteStats, setSiteStats] = useState<SiteData | null>(null);
  const [waterStats, setWaterStats] = useState<WaterData | null>(null);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // Search autofill: live suggestions as the user types (Mapbox geocoding)
  type Place = { name: string; lon: number; lat: number };
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Recent searches — shown when the (empty) search box is focused
  const [recents, setRecents] = useState<Place[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  useEffect(() => {
    try { const r = JSON.parse(localStorage.getItem('imbewu-recent-searches') ?? '[]'); if (Array.isArray(r)) setRecents(r); } catch {}
  }, []);
  const pushRecent = useCallback((p: Place) => {
    setRecents((prev) => {
      const next = [p, ...prev.filter((q) => q.name !== p.name)].slice(0, 6);
      try { localStorage.setItem('imbewu-recent-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  // Hillshade / terrain relief overlay — shows hills, valleys & slope direction across the map
  const [hillshade, setHillshade] = useState(false);
  const [hoverElevation, setHoverElevation] = useState<number | null>(null);
  const [savedPins, setSavedPins] = useState<SavedPlace[]>([]);
  const [placesOpen, setPlacesOpen] = useState(false); // quick-jump "Places" list in the toolbar
  const [showLabels, setShowLabels] = useState(true);  // show place names on the map (toggle in Places)
  const [toolbarMin, setToolbarMin] = useState(true);  // start collapsed so the map is clear on arrival; tap "☰ Tools" to open
  // ── Reticle EDIT: edit an existing shape with the SAME "move the map under the
  // crosshair" motion used for drawing — no tiny dot-dragging. Tap a corner to lift it
  // onto the crosshair, move the map, tap Place to drop it. ──
  const [editPin, setEditPin] = useState<null | { id: string; type: 'site' | 'water' }>(null);
  const [editPoints, setEditPoints] = useState<[number, number][]>([]); // working ring (open — no closing dup)
  const [selCorner, setSelCorner] = useState<number | null>(null);      // index currently lifted onto the crosshair
  const editOriginal = useRef<[number, number][] | null>(null);          // snapshot for Cancel
  const editNameRef = useRef<{ name?: string; category?: string } | null>(null); // name/category snapshot across edit
  const nativeEditBackupRef = useRef<GeoJSON.Feature | null>(null);      // snapshot for native-edit Undo

  // Saved-place pins: load + keep in sync with the Places tab
  useEffect(() => {
    const refresh = () => setSavedPins(loadPlaces());
    refresh();
    window.addEventListener('permamap-places-changed', refresh);
    return () => window.removeEventListener('permamap-places-changed', refresh);
  }, []);

  // Save the currently selected point as a place (right from the map tools).
  // Save place = drop a pin at the spot, then name it + pick a label (sets colour).
  // editingPlaceId: when non-null, the naming sheet is editing an existing saved place.
  const [namingPlace, setNamingPlace] = useState<{ lat: number; lon: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeLabel, setPlaceLabel] = useState<PlaceLabel>('field');
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);

  const saveCurrentPlace = useCallback(() => {
    if (!selectedLocation) return;
    setEditingPlaceId(null);
    setNamingPlace({ lat: selectedLocation.lat, lon: selectedLocation.lon });
    setPlaceName(locationData?.biome?.name ?? '');
    setPlaceLabel('field');
  }, [selectedLocation, locationData]);

  // Open the naming sheet to edit an existing saved place (rename/recolour)
  const startEditPlace = useCallback((p: SavedPlace) => {
    setEditingPlaceId(p.id);
    setNamingPlace({ lat: p.lat, lon: p.lon });
    setPlaceName(p.name);
    setPlaceLabel(p.label ?? 'field');
  }, []);

  const confirmSavePlace = useCallback(() => {
    if (!namingPlace) return;
    const existingId = editingPlaceId;
    const existing = existingId ? savedPins.find((p) => p.id === existingId) : null;
    savePlace({
      id: existingId ?? generateId(),
      name: placeName.trim() || 'My place',
      lat: namingPlace.lat, lon: namingPlace.lon,
      biome: existing?.biome ?? locationData?.biome?.name ?? '',
      rainfall: existing?.rainfall ?? locationData?.rainfall?.annual ?? 0,
      elevation: existing?.elevation ?? locationData?.elevation?.elevation ?? 0,
      label: placeLabel,
      savedAt: existing?.savedAt ?? new Date().toISOString(),
    });
    setSavedPins(loadPlaces());
    setEditingPlaceId(null);
    setNamingPlace(null);
    if (!existingId) { setPlaceSaved(true); setTimeout(() => setPlaceSaved(false), 2500); }
  }, [namingPlace, placeName, placeLabel, locationData, editingPlaceId, savedPins]);

  // Lima coach-marks — a quick guide that auto-shows the first time the tools
  // panel is opened, and reopens any time via the "?" in the panel header.
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSeen = useRef(false);
  useEffect(() => {
    try { guideSeen.current = !!localStorage.getItem('imbewu_map_tips_seen'); } catch { /* ignore */ }
  }, []);
  const openPanel = useCallback(() => {
    setToolbarMin(false);
    if (!guideSeen.current) { setGuideOpen(true); guideSeen.current = true; try { localStorage.setItem('imbewu_map_tips_seen', '1'); } catch { /* ignore */ } }
  }, []);

  const MIN_ZOOM = 4;
  const MAX_ZOOM = 24; // Max mapbox allows — zoom right in for small-plot design. Beyond ~z19
  // the satellite imagery is upscaled (soft, no new detail) but zoom still works for placing corners.

  const WATER_AVG_DEPTH = 1.5; // m — assumed average depth for capacity estimate

  // Recompute site + water stats from ALL drawn features of each type (summed), propagate up.
  // SITE = sum across ALL site polygons (multiple parcels supported).
  // WATER = sum across all water-storage polygons.
  const recompute = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const all = draw.getAll();
    // Persist every shape change so a page refresh never loses the farmer's drawing.
    // Skip while tearing down (unmount) or before restore has run — either path could
    // overwrite the saved collection with a partial/empty in-memory store.
    if (!tearingDownRef.current && restoredRef.current) {
      try { localStorage.setItem(FARM_KEY, JSON.stringify(all)); } catch { /* quota / private mode */ }
    }
    const polygons = all.features.filter(
      (f: GeoJSON.Feature) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    );
    const sitePolys = polygons.filter((f: GeoJSON.Feature) => f.properties?.featureType !== 'water');
    const waterPolys = polygons.filter((f: GeoJSON.Feature) => f.properties?.featureType === 'water');

    // Site = SUM of all land parcels drawn
    if (sitePolys.length) {
      const totalAreaM2 = sitePolys.reduce((sum: number, f: GeoJSON.Feature) => sum + turfArea(f), 0);
      // Sum perimeters across all parcels
      const totalPerimeterKm = sitePolys.reduce((sum: number, f: GeoJSON.Feature) => {
        try { return sum + turfLength(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, { units: 'kilometers' }); }
        catch { return sum; }
      }, 0);
      const site: SiteData = {
        areaM2: Math.round(totalAreaM2),
        areaHa: Math.round((totalAreaM2 / 10000) * 100) / 100,
        perimeterM: Math.round(totalPerimeterKm * 1000),
        perimeterKm: Math.round(totalPerimeterKm * 100) / 100,
        count: sitePolys.length,
        features: sitePolys.map((f: GeoJSON.Feature) => ({
          name: f.properties?.name as string | undefined,
          category: f.properties?.category as string | undefined,
          areaHa: Math.round((turfArea(f) / 10000) * 100) / 100,
        })),
      };
      setSiteStats(site);
      onSiteDrawn?.(site);
    } else {
      setSiteStats(null);
      onSiteDrawn?.(null);
    }

    // Water = sum of all water-storage polygons
    if (waterPolys.length) {
      const areaM2 = waterPolys.reduce((sum: number, f: GeoJSON.Feature) => sum + turfArea(f), 0);
      const water: WaterData = {
        count: waterPolys.length,
        areaM2: Math.round(areaM2),
        estVolumeKL: Math.round(areaM2 * WATER_AVG_DEPTH),
        avgDepthM: WATER_AVG_DEPTH,
        features: waterPolys.map((f: GeoJSON.Feature) => ({
          name: f.properties?.name as string | undefined,
          category: f.properties?.category as string | undefined,
          estVolumeKL: Math.round(turfArea(f) * WATER_AVG_DEPTH),
        })),
      };
      setWaterStats(water);
      onWaterDrawn?.(water);
    } else {
      setWaterStats(null);
      onWaterDrawn?.(null);
    }
  }, [onSiteDrawn, onWaterDrawn]);

  // Lazily create the single MapboxDraw instance (handles both feature types via featureType prop)
  const ensureDraw = useCallback((): MapboxDraw | null => {
    const map = mapRef.current?.getMap();
    if (!map) return null;
    if (drawRef.current) return drawRef.current;
    // A remount (StrictMode double-invoke, route unmount/remount) needs a fresh
    // teardown flag so this new instance can persist shapes again.
    tearingDownRef.current = false;

    // Colour by featureType: water = blue, site/boundary = emerald
    const strokeColor = ['case', ['==', ['get', 'user_featureType'], 'water'], '#7FC4F0', '#5DCF80'] as unknown as string;

    // Touch screens need much bigger, easier-to-grab corner dots than a mouse. On a phone
    // a finger covers ~44px, so tiny 8px vertices are nearly impossible to drag accurately —
    // this was the #1 complaint vs Google Earth. Bump the visual size AND the invisible
    // hit area (touchBuffer) so a roughly-aimed tap still grabs the nearest corner.
    const vtxRadius = IS_COARSE ? 13 : 8;       // draggable corner dots
    const midRadius = IS_COARSE ? 10 : 7;       // "add a corner here" mid-dots

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      userProperties: true, // required: exposes user_featureType to style filter expressions
      modes: { ...MapboxDraw.modes, static: StaticMode as unknown as typeof MapboxDraw.modes.simple_select },
      // How close a click/tap must land to grab a vertex. Defaults (2 / 25) are too tight
      // for fingers — widen the touch buffer so corners are easy to catch on a phone.
      clickBuffer: 4,
      touchBuffer: 40,
      // Fills are SPLIT by type and ordered land-then-water so the blue water fill always
      // paints ON TOP of the green boundary (you can see the colour difference even where
      // a dam sits inside a parcel). Water uses a higher opacity so it reads clearly.
      styles: [
        { id: 'gl-draw-polygon-fill-site', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], ['!=', 'user_featureType', 'water']], paint: { 'fill-color': '#48A864', 'fill-opacity': 0.18 } },
        { id: 'gl-draw-polygon-fill-site-static', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static'], ['!=', 'user_featureType', 'water']], paint: { 'fill-color': '#48A864', 'fill-opacity': 0.16 } },
        { id: 'gl-draw-polygon-fill-water', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static'], ['==', 'user_featureType', 'water']], paint: { 'fill-color': '#5B9ED4', 'fill-opacity': 0.42 } },
        { id: 'gl-draw-polygon-fill-water-static', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static'], ['==', 'user_featureType', 'water']], paint: { 'fill-color': '#5B9ED4', 'fill-opacity': 0.4 } },
        { id: 'gl-draw-polygon-stroke-active', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2.5, 'line-dasharray': [2, 1] } },
        { id: 'gl-draw-polygon-stroke-static', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2 } },
        { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2, 'line-dasharray': [2, 1] } },
        { id: 'gl-draw-point', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': vtxRadius, 'circle-color': strokeColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } },
        { id: 'gl-draw-point-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': midRadius, 'circle-color': strokeColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0.85 } },
      ],
    });

    map.addControl(draw as unknown as mapboxgl.IControl);
    drawRef.current = draw;

    // Tag each newly created polygon with the type that was being drawn, then switch to vertex-edit mode
    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const type = drawTypeRef.current;
      let createdId: string | null = null;
      e.features.forEach((f) => {
        if (f.id != null) {
          draw.setFeatureProperty(String(f.id), 'featureType', type);
          createdId = String(f.id);
        }
      });
      setActiveDraw(null);
      recompute();
      // Drop into direct_select so the user can drag vertices immediately
      if (createdId) {
        const id = createdId;
        setTimeout(() => {
          try { draw.changeMode('direct_select', { featureId: id }); } catch {}
          setEditingFeatureId(id);
        }, 120);
      }
    });
    map.on('draw.update', recompute);
    map.on('draw.delete', recompute);

    // Track native entry/exit of direct_select so the edit bar appears even when the
    // user taps a shape directly (without going through our Edit button).
    map.on('draw.modechange', (e: { mode: string }) => {
      if (e.mode === 'direct_select') {
        // Use a short delay: selectionchange fires after modechange, so getSelectedIds()
        // isn't populated yet at the moment this event fires.
        setTimeout(() => {
          const ids = draw.getSelectedIds();
          if (ids.length > 0) {
            const f = draw.get(ids[0]);
            nativeEditBackupRef.current = f ? (JSON.parse(JSON.stringify(f)) as GeoJSON.Feature) : null;
            setEditingFeatureId(ids[0]);
          }
        }, 60);
      } else {
        setEditingFeatureId(null);
      }
    });

    return draw;
  }, [recompute]);

  // Restore persisted parcels + water once the map is ready (survives refresh).
  const restoredRef = useRef(false);
  // True while tearing down on unmount: deleteAll() fires draw.delete → recompute,
  // and we must NOT let that persist an empty collection (it would wipe saved shapes
  // every time the user navigates away from the map).
  const tearingDownRef = useRef(false);
  const restoreShapes = useCallback(() => {
    if (restoredRef.current) return;
    const draw = ensureDraw();
    if (!draw) return;
    try {
      const raw = localStorage.getItem(FARM_KEY);
      if (raw) {
        const fc = JSON.parse(raw);
        if (fc?.features?.length) { draw.set(fc); recompute(); }
      }
    } catch { /* ignore corrupt/blocked storage */ }
    restoredRef.current = true;
  }, [ensureDraw, recompute]);

  // Poll for the map being ready, then restore saved shapes once. More reliable than
  // onLoad (which can miss when the style is cached or the page bounces during nav).
  useEffect(() => {
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const map = mapRef.current?.getMap();
      // The app's contour/terrain/hillshade sources keep isStyleLoaded() perpetually
      // false, so don't gate on it — once the map exists and has had a beat to settle
      // (≈1s), the draw control can be added and shapes restored.
      if (map && (map.isStyleLoaded() || tries >= 5)) { restoreShapes(); clearInterval(iv); }
      else if (tries > 50) clearInterval(iv); // ~10s safety cap
    }, 200);
    return () => clearInterval(iv);
  }, [restoreShapes]);

  // cancelDraw: reliably exits an in-progress polygon draw.
  // Calling draw.changeMode('simple_select') while in draw_polygon discards any
  // incomplete polygon (mapbox-gl-draw cleans it up automatically when < 3 vertices
  // are placed; with ≥ 3 it just closes the draw without completing). Either way
  // the tool turns off and the user is unstuck.
  const cancelDraw = useCallback(() => {
    const draw = drawRef.current;
    if (draw) {
      try { draw.changeMode('simple_select'); } catch {}
    }
    setActiveDraw(null);
    // NOTE: setDraftPt intentionally NOT called — it does not exist in this component.
  }, []);

  const finishEditing = useCallback(() => {
    const draw = drawRef.current;
    if (draw) try { draw.changeMode('simple_select'); } catch {}
    setEditingFeatureId(null);
  }, []);

  // ── Reticle drawing: pan/zoom the map under a fixed crosshair, tap ＋ to drop a corner ──
  const startPinDraw = useCallback((type: 'site' | 'water') => {
    const draw = ensureDraw();
    // Lock every existing parcel/water shape (static mode) so panning under the
    // crosshair can't accidentally select or drag one — fixes "drawing water moved
    // my boundary". The new shape is drawn as the reticle overlay, not in the draw store.
    if (draw) try { draw.changeMode('static'); } catch {}
    const map = mapRef.current?.getMap();
    if (map) {
      const c = map.getCenter(); setMapCenter([c.lng, c.lat]);
      // Force a clean top-down view + lock rotation/tilt so the crosshair always equals
      // the true drop point and the farmer can't accidentally tilt mid-draw.
      map.easeTo({ pitch: 0, bearing: 0, duration: 200 });
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); } catch {}
    }
    drawTypeRef.current = type;
    setActiveDraw(null);
    setEditingFeatureId(null);
    setDraftPoints([]);
    setPinDraw(type);
  }, [ensureDraw]);

  // Re-enable map rotation after a reticle-draw session ends
  const unlockRotation = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) try { map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); } catch {}
  }, []);

  // Append a corner, deduping a tap that lands on the previous corner (zero-length edge)
  const pushCorner = (prev: [number, number][], lng: number, lat: number): [number, number][] => {
    const last = prev[prev.length - 1];
    if (last && Math.abs(last[0] - lng) < 1e-7 && Math.abs(last[1] - lat) < 1e-7) return prev;
    return [...prev, [lng, lat]];
  };

  const addPin = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Drop at the exact crosshair pixel (screen centre), not getCenter() — they can
    // diverge under terrain/tilt. This guarantees the dot lands under the crosshair.
    const cont = map.getContainer();
    const p = map.unproject([cont.clientWidth / 2, cont.clientHeight / 2]);
    setDraftPoints((prev) => pushCorner(prev, p.lng, p.lat));
  }, []);

  // "Walk it with GPS": drop a corner at the farmer's actual position. They stand
  // on each corner of the land, tap, and walk to the next — no map-panning needed.
  const [gpsAdding, setGpsAdding] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const gpsErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showGpsError = useCallback((msg: string) => {
    setGpsError(msg);
    if (gpsErrTimer.current) clearTimeout(gpsErrTimer.current);
    gpsErrTimer.current = setTimeout(() => setGpsError(''), 2000);
  }, []);
  const addPinFromGPS = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showGpsError('GPS not available on this device.');
      return;
    }
    setGpsAdding(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        setDraftPoints((prev) => pushCorner(prev, lng, lat));
        const map = mapRef.current?.getMap();
        if (map) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 18), duration: 600 });
        setGpsAdding(false);
      },
      () => { setGpsAdding(false); showGpsError('Could not get your location — allow GPS and try outside.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [showGpsError]);

  const undoPin = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const cancelPinDraw = useCallback(() => {
    // Release the static lock placed on existing shapes when drawing started.
    try { drawRef.current?.changeMode('simple_select'); } catch {}
    setPinDraw(null);
    setDraftPoints([]);
    unlockRotation();
  }, [unlockRotation]);

  const finishPinDraw = useCallback(() => {
    const draw = ensureDraw();
    if (!draw || draftPoints.length < 3) return;
    // Leave static lock so the freshly-added shape (and the others) are editable again.
    try { draw.changeMode('simple_select'); } catch {}
    const type = drawTypeRef.current;
    const ring = [...draftPoints, draftPoints[0]]; // close the ring
    const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
    let id: string | null = null;
    try { const ids = draw.add(feature); id = ids?.[0] ?? null; } catch { id = null; }
    if (id != null) {
      draw.setFeatureProperty(id, 'featureType', type);
    }
    setPinDraw(null);
    setDraftPoints([]);
    unlockRotation();
    recompute();
    // Immediately let the farmer name + categorise what they just drew.
    if (id != null) openShapeNaming(id, type);
    // Leave the finished shape placed. Refining is done via "✎ Edit", which uses the
    // same crosshair motion as drawing — no tiny-dot dragging.
  }, [ensureDraw, draftPoints, recompute, unlockRotation]);

  // ── Reticle EDIT helpers ──────────────────────────────────────────────────
  // Read the live crosshair (screen-centre) position as [lng, lat].
  const crosshairLngLat = useCallback((): [number, number] | null => {
    const map = mapRef.current?.getMap();
    if (!map) return null;
    const cont = map.getContainer();
    const p = map.unproject([cont.clientWidth / 2, cont.clientHeight / 2]);
    return [p.lng, p.lat];
  }, []);

  // Enter reticle-edit for an existing polygon: pull its corners into editPoints and
  // render our own overlay (we remove it from MapboxDraw while editing, re-add on Done).
  const startReticleEdit = useCallback((featureId: string, type: 'site' | 'water') => {
    const draw = ensureDraw();
    if (!draw) return;
    const f = draw.get(featureId) as GeoJSON.Feature<GeoJSON.Polygon> | undefined;
    if (!f || f.geometry?.type !== 'Polygon') return;
    const ring = (f.geometry.coordinates[0] as [number, number][]).map((c) => [c[0], c[1]] as [number, number]);
    // Drop the closing duplicate vertex so we edit an open ring
    if (ring.length > 1) {
      const a = ring[0], b = ring[ring.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) ring.pop();
    }
    editOriginal.current = ring.map((c) => [c[0], c[1]] as [number, number]);
    editNameRef.current = { name: f.properties?.name as string | undefined, category: f.properties?.category as string | undefined };
    try { draw.delete(featureId); } catch {}
    const map = mapRef.current?.getMap();
    if (map) {
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); } catch {}
      // Zoom to FIT the whole shape (flat, top-down) so every corner handle is on-screen
      // and reachable — a big parcel previously left corners off the edge of the map.
      const lngs = ring.map((c) => c[0]); const lats = ring.map((c) => c[1]);
      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
      try {
        map.fitBounds([sw, ne], { padding: { top: 90, bottom: 140, left: 60, right: 60 }, pitch: 0, bearing: 0, duration: 400, maxZoom: 21 });
      } catch {
        map.easeTo({ center: [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2], pitch: 0, bearing: 0, duration: 300 });
      }
    }
    drawTypeRef.current = type;
    setActiveDraw(null);
    setPinDraw(null);
    setEditingFeatureId(null);
    setDraftPoints([]);
    setEditPoints(ring);
    setSelCorner(null);
    setEditPin({ id: featureId, type });
  }, [ensureDraw]);

  // Enter Mapbox's NATIVE built-in editing (mapbox-gl-draw direct_select): drag vertices,
  // native midpoints to add a corner, native delete. Uses the enlarged dots + touchBuffer.
  const startNativeEdit = useCallback((featureId: string) => {
    const draw = ensureDraw();
    if (!draw) return;
    const f = draw.get(featureId);
    nativeEditBackupRef.current = f ? (JSON.parse(JSON.stringify(f)) as GeoJSON.Feature) : null;
    setEditPin(null); setEditPoints([]); setSelCorner(null);
    setActiveDraw(null); setPinDraw(null);
    try { draw.changeMode('direct_select', { featureId }); } catch {}
    setEditingFeatureId(featureId);
  }, [ensureDraw]);

  // Router: the ✎ Edit buttons call this; it picks the chosen engine.
  const startEdit = useCallback((featureId: string, type: 'site' | 'water') => {
    if (editEngine === 'native') startNativeEdit(featureId);
    else startReticleEdit(featureId, type);
  }, [editEngine, startNativeEdit, startReticleEdit]);

  // Custom-engine corner dragging via raw pointer events — grabs INSTANTLY (no
  // tap-and-hold delay that the library's built-in marker drag has on touch).
  // Quick tap (down+up, no move) just selects the corner; press+move drags it.
  const dragRef = useRef<{ i: number; pointerId: number } | null>(null);
  const onCornerPointerDown = useCallback((i: number, e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelCorner(i);
    dragRef.current = { i, pointerId: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }, []);
  const onCornerPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const rect = map.getContainer().getBoundingClientRect();
    const ll = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    setEditPoints((pts) => { const n = pts.slice(); n[d.i] = [ll.lng, ll.lat]; return n; });
  }, []);
  const onCornerPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
    }
  }, []);

  // Insert a new corner at the crosshair, on the longest edge, and lift it for positioning
  const addEditCorner = useCallback(() => {
    const at = crosshairLngLat();
    if (!at) return;
    setEditPoints((pts) => {
      if (pts.length < 2) { setSelCorner(pts.length); return [...pts, at]; }
      // find the edge whose midpoint is nearest the crosshair → insert there
      let best = 0, bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const d = (mx - at[0]) ** 2 + (my - at[1]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      const next = [...pts.slice(0, best + 1), at, ...pts.slice(best + 1)];
      setSelCorner(best + 1);
      return next;
    });
  }, [crosshairLngLat]);

  // Remove the lifted corner (kept ≥3 so it stays a polygon)
  const removeEditCorner = useCallback(() => {
    setEditPoints((pts) => {
      if (selCorner == null || pts.length <= 3) return pts;
      return pts.filter((_, i) => i !== selCorner);
    });
    setSelCorner(null);
  }, [selCorner]);

  // Commit the edited ring back into MapboxDraw and recompute stats
  const finishReticleEdit = useCallback(() => {
    const draw = ensureDraw();
    const edit = editPin;
    if (!draw || !edit || editPoints.length < 3) return;
    const ring = [...editPoints.map((c) => [c[0], c[1]]), [editPoints[0][0], editPoints[0][1]]];
    const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
    let id: string | null = null;
    try { const ids = draw.add(feature); id = ids?.[0] ?? null; } catch { id = null; }
    if (id != null) {
      draw.setFeatureProperty(id, 'featureType', edit.type);
      const snap = editNameRef.current;
      if (snap?.name) draw.setFeatureProperty(id, 'name', snap.name);
      if (snap?.category) draw.setFeatureProperty(id, 'category', snap.category);
    }
    editNameRef.current = null;
    setEditPin(null);
    setEditPoints([]);
    setSelCorner(null);
    editOriginal.current = null;
    unlockRotation();
    recompute();
  }, [ensureDraw, editPin, editPoints, recompute, unlockRotation]);

  // Abandon edits — restore the original shape unchanged
  const cancelReticleEdit = useCallback(() => {
    const draw = ensureDraw();
    const edit = editPin;
    const orig = editOriginal.current;
    if (draw && edit && orig && orig.length >= 3) {
      const ring = [...orig.map((c) => [c[0], c[1]]), [orig[0][0], orig[0][1]]];
      try {
        const ids = draw.add({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } } as GeoJSON.Feature<GeoJSON.Polygon>);
        const id = ids?.[0];
        if (id != null) {
          draw.setFeatureProperty(id, 'featureType', edit.type);
          const snap = editNameRef.current;
          if (snap?.name) draw.setFeatureProperty(id, 'name', snap.name);
          if (snap?.category) draw.setFeatureProperty(id, 'category', snap.category);
        }
      } catch {}
    }
    editNameRef.current = null;
    setEditPin(null);
    setEditPoints([]);
    setSelCorner(null);
    editOriginal.current = null;
    unlockRotation();
    recompute();
  }, [ensureDraw, editPin, recompute, unlockRotation]);

  // Remove only the polygons of one type
  const clearType = useCallback((type: 'site' | 'water') => {
    const draw = drawRef.current;
    if (!draw) return;
    const all = draw.getAll();
    all.features.forEach((f: GeoJSON.Feature) => {
      const ftype = f.properties?.featureType === 'water' ? 'water' : 'site';
      if (ftype === type && f.id != null) draw.delete(String(f.id));
    });
    setEditingFeatureId(null);
    recompute();
  }, [recompute]);

  // Full teardown (used on unmount)
  const clearDraw = useCallback(() => {
    const map = mapRef.current?.getMap();
    const draw = drawRef.current;
    if (!map || !draw) return;
    tearingDownRef.current = true; // don't let the deleteAll below wipe persisted shapes
    draw.deleteAll();
    map.removeControl(draw as unknown as mapboxgl.IControl);
    drawRef.current = null;
    setSiteStats(null);
    setWaterStats(null);
    onSiteDrawn?.(null);
    onWaterDrawn?.(null);
    setActiveDraw(null);
  }, [onSiteDrawn, onWaterDrawn]);

  // Keep the latest edit-cancel reachable from the (once-registered) Escape handler.
  const cancelEditRef = useRef(cancelReticleEdit);
  cancelEditRef.current = cancelReticleEdit;
  const editPinRef = useRef(editPin);
  editPinRef.current = editPin;

  // Escape key cancels an in-progress draw (fix 2: Escape-to-cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel reticle-edit if active (restores the original shape)
        if (editPinRef.current) cancelEditRef.current();
        // Cancel reticle-draw if active
        setPinDraw((prev) => { if (prev !== null) setDraftPoints([]); return prev !== null ? null : prev; });
        // Cancel draw mode if active
        setActiveDraw((prev) => {
          if (prev !== null) {
            const draw = drawRef.current;
            if (draw) try { draw.changeMode('simple_select'); } catch {}
            return null;
          }
          return prev;
        });
        // Also exit editing mode
        setEditingFeatureId((prev) => {
          if (prev !== null) {
            const draw = drawRef.current;
            if (draw) try { draw.changeMode('simple_select'); } catch {}
            return null;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [searchResult, setSearchResult] = useState('');

  const handleSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResult('');

    // 1. Try parsing as coordinates: "-33.9, 18.4" / "33°55'S 18°26'E"
    const coordSimple = q.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
    const coordDMS = q.match(/^(\d+\.?\d*)[°\s]+(\d*\.?\d*)?['\s]*([NSns])[,\s]+(\d+\.?\d*)[°\s]+(\d*\.?\d*)?['\s]*([EWew])$/);
    if (coordSimple) {
      const lat = parseFloat(coordSimple[1]);
      const lon = parseFloat(coordSimple[2]);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 1600 });
        onLocationSelect(lat, lon);
        setSearching(false);
        return;
      }
    }
    if (coordDMS) {
      let lat = parseFloat(coordDMS[1]) + (parseFloat(coordDMS[2] || '0') / 60);
      let lon = parseFloat(coordDMS[4]) + (parseFloat(coordDMS[5] || '0') / 60);
      if (coordDMS[3].toUpperCase() === 'S') lat = -lat;
      if (coordDMS[6].toUpperCase() === 'W') lon = -lon;
      mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 1600 });
      onLocationSelect(lat, lon);
      setSearching(false);
      return;
    }

    const flyAndSelect = (lat: number, lon: number, name: string) => {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 1600 });
      onLocationSelect(lat, lon);
      setSearchResult(name);
      pushRecent({ name, lon, lat });
    };

    // 2. Nominatim first — OSM has far better coverage of SA game reserves, farms, nature areas
    try {
      let place = null;
      for (const params of [
        `countrycodes=za`,                        // SA only
        `countrycodes=za,ls,sz,bw,na,mz,zw`,     // SA + immediate neighbours
        `viewbox=15,-35,33,-22&bounded=1`,        // hard SA bbox fallback
      ]) {
        const nmRes = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0&${params}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'ImbewuField/1.0' } }
        );
        const nmJson = await nmRes.json();
        if (nmJson[0]) { place = nmJson[0]; break; }
      }
      if (place) {
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        flyAndSelect(lat, lon, place.display_name?.split(',').slice(0, 2).join(',') ?? q);
        setSearching(false);
        return;
      }
    } catch { /* fall through to Mapbox */ }

    // 3. Mapbox fallback — better for urban addresses, street numbers
    try {
      const mbRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?access_token=${TOKEN}&limit=3&language=en` +
        `&country=ZA` + // restrict to South Africa
        `&proximity=25,-29` + // centre-of-SA tie-breaking
        `&types=poi,place,locality,district,region,address,neighborhood`
      );
      const mbJson = await mbRes.json();
      const mbFeature = mbJson.features?.[0];
      if (mbFeature) {
        const [lon, lat] = mbFeature.center as [number, number];
        flyAndSelect(lat, lon, mbFeature.place_name ?? mbFeature.text);
        setSearching(false);
        return;
      }
    } catch { /* fall through */ }

    setSearchError('Not found — try adding "South Africa"');
    setSearching(false);
  }, [onLocationSelect]);

  // ── Autofill: debounced place suggestions while typing (Mapbox geocoding) ──
  const fetchSuggestions = useCallback((q: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const query = q.trim();
    // Don't suggest for very short or coordinate-looking input
    if (query.length < 3 || /^-?\d/.test(query)) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${TOKEN}&autocomplete=true&limit=5&language=en&country=ZA&proximity=25,-29` +
          `&types=place,locality,district,region,address,neighborhood,poi`
        );
        const json = await res.json();
        const list = (json.features ?? []).map((f: { place_name?: string; text?: string; center: [number, number] }) => ({
          name: f.place_name ?? f.text ?? '',
          lon: f.center[0], lat: f.center[1],
        }));
        setSuggestions(list);
      } catch { setSuggestions([]); }
    }, 250);
  }, []);

  const selectSuggestion = useCallback((s: { name: string; lon: number; lat: number }) => {
    setSearchQuery(s.name.split(',').slice(0, 2).join(','));
    setSuggestions([]);
    setShowRecents(false);
    setSearchError('');
    pushRecent({ name: s.name.split(',').slice(0, 2).join(','), lon: s.lon, lat: s.lat });
    mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: 14, duration: 1600 });
    onLocationSelect(s.lat, s.lon);
  }, [onLocationSelect, pushRecent]);

  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        mapRef.current?.flyTo({ center: [lon, lat], zoom: 13, duration: 1800 });
        onLocationSelect(lat, lon);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, [onLocationSelect]);

  // Fly to saved place
  useEffect(() => {
    if (!jumpTo) return;
    mapRef.current?.flyTo({ center: [jumpTo.lon, jumpTo.lat], zoom: 13, duration: 1600 });
    onJumpComplete?.();
  }, [jumpTo, onJumpComplete]);

  // Cleanup on unmount
  useEffect(() => () => { clearDraw(); }, [clearDraw]);

  // Repaint the map when the PWA is resumed from background or the page is shown
  // (standalone home-screen apps suspend the WebGL canvas → blank until resized).
  useEffect(() => {
    const repaint = () => { try { mapRef.current?.getMap()?.resize(); } catch {} };
    const onVis = () => { if (document.visibilityState === 'visible') repaint(); };
    window.addEventListener('pageshow', repaint);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pageshow', repaint);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Tell the parent when reticle drawing is active (so it can hide the mobile "Results" FAB).
  // Also broadcast globally so the Lima FAB (rendered in the root layout) can step aside.
  useEffect(() => {
    const active = pinDraw !== null || editPin !== null;
    onDrawingChange?.(active);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-drawing', { detail: active }));
    // On unmount (e.g. navigating away mid-draw), tell the world drawing stopped
    // so the persistent Lima FAB (in the root layout) doesn't stay hidden forever.
    return () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-drawing', { detail: false }));
    };
  }, [pinDraw, editPin, onDrawingChange]);

  // Reset the Cancel-confirm whenever a draw session ends
  useEffect(() => { if (!pinDraw) setCancelArmed(false); }, [pinDraw]);

  // Fade out the top instruction banner after 6 s so it doesn't block the view
  const [hintFaded, setHintFaded] = useState(false);
  const hintFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (hintFadeTimer.current) clearTimeout(hintFadeTimer.current);
    if (pinDraw) {
      setHintFaded(false);
      hintFadeTimer.current = setTimeout(() => setHintFaded(true), 6000);
    } else {
      setHintFaded(false);
    }
    return () => { if (hintFadeTimer.current) clearTimeout(hintFadeTimer.current); };
  }, [pinDraw]);

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      const elev = (map as unknown as { queryTerrainElevation: (c: [number, number]) => number | null })
        .queryTerrainElevation([e.lngLat.lng, e.lngLat.lat]);
      setHoverElevation(elev !== null ? Math.round(elev) : null);
    } catch {
      setHoverElevation(null);
    }
  }, []);

  const handleClick = useCallback((e: MapMouseEvent) => {
    if (pinDraw) {
      // Touch: only the ＋ button adds a corner — a map "click" also fires at the end of
      // a pan gesture, so click-to-add would scatter stray corners while panning.
      if (IS_COARSE) return;
      setDraftPoints((prev) => pushCorner(prev, e.lngLat.lng, e.lngLat.lat));
      return;
    }
    if (activeDraw || editingFeatureId || editPin) return;
    // A tap on the map ANALYSES that point (NASA/soil/topo). Editing a drawn shape is done
    // via its ✎ Edit button — NOT by tapping the map, otherwise a tap inside the boundary
    // would re-enter vertex-edit and the farmer could never analyse the inside of their land.
    onLocationSelect(e.lngLat.lat, e.lngLat.lng);
    onPlaceSelect?.(null);
  }, [onLocationSelect, onPlaceSelect, activeDraw, editingFeatureId, pinDraw, editPin]);

  // Reticle colours — shared by draw (pinDraw) and edit (editPin)
  const reticleType = pinDraw ?? editPin?.type ?? null;
  const draftColor = reticleType === 'water' ? '#5B9ED4' : '#48A864';
  const draftStroke = reticleType === 'water' ? '#7FC4F0' : '#5DCF80';
  // Project committed corners to screen pixels for the SVG preview overlay.
  // mapCenter changes on every map move → component re-renders → these recompute, staying in sync.
  // A screen-space SVG (not a GL source) works with 3D terrain on — no draping crash.
  void mapCenter;
  const map = mapRef.current?.getMap();
  const container = map?.getContainer();
  const draftScreen: [number, number][] = (pinDraw && map)
    ? draftPoints.map((p) => { const q = map.project(p as [number, number]); return [q.x, q.y]; })
    : [];
  const reticleScreen: [number, number] = container
    ? [container.clientWidth / 2, container.clientHeight / 2]
    : [0, 0];
  // Edit overlay: project the working ring to screen pixels (closed outline, terrain-safe SVG)
  const editScreen: Array<{ x: number; y: number; i: number }> = (editPin && map)
    ? editPoints.map((p, i) => { const q = map.project(p as [number, number]); return { x: q.x, y: q.y, i }; })
    : [];
  // Live area readout while editing (m² / ha)
  const editAreaHa = (editPin && editPoints.length >= 3)
    ? Math.round((turfArea({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...editPoints, editPoints[0]]] } }) / 10000) * 100) / 100
    : null;

  // Helper: get all site polygons with their IDs for per-shape edit buttons
  const getSiteFeatures = useCallback((): Array<{ id: string; areaHa: number; name?: string; category?: string }> => {
    const draw = drawRef.current;
    if (!draw) return [];
    const all = draw.getAll();
    return all.features
      .filter((f: GeoJSON.Feature) =>
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.featureType !== 'water' &&
        f.id != null
      )
      .map((f: GeoJSON.Feature) => ({
        id: String(f.id),
        areaHa: Math.round((turfArea(f) / 10000) * 100) / 100,
        name: f.properties?.name as string | undefined,
        category: f.properties?.category as string | undefined,
      }));
  }, []);

  // We track siteFeatures as a derived list rebuilt whenever siteStats changes
  const [siteFeatures, setSiteFeatures] = useState<Array<{ id: string; areaHa: number; name?: string; category?: string }>>([]);
  useEffect(() => {
    setSiteFeatures(getSiteFeatures());
  }, [siteStats, getSiteFeatures]);

  // Per-water-store list (id + capacity) so each can be edited/deleted individually
  const getWaterFeatures = useCallback((): Array<{ id: string; estVolumeKL: number; name?: string; category?: string }> => {
    const draw = drawRef.current;
    if (!draw) return [];
    return draw.getAll().features
      .filter((f: GeoJSON.Feature) =>
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.featureType === 'water' && f.id != null)
      .map((f: GeoJSON.Feature) => ({
        id: String(f.id), estVolumeKL: Math.round(turfArea(f) * WATER_AVG_DEPTH),
        name: f.properties?.name as string | undefined,
        category: f.properties?.category as string | undefined,
      }));
  }, []);
  const [waterFeatures, setWaterFeatures] = useState<Array<{ id: string; estVolumeKL: number; name?: string; category?: string }>>([]);
  useEffect(() => { setWaterFeatures(getWaterFeatures()); }, [waterStats, getWaterFeatures]);

  // ── Name & categorise a drawn parcel / water store (opens after drawing, and any
  // time via the row's name). Stored on the feature so it persists + shows in lists. ──
  const SHAPE_CATEGORIES: Record<'site' | 'water', string[]> = {
    site: ['Home plot', 'Field', 'Orchard', 'Grazing', 'Other'],
    water: ['Dam', 'Tank', 'Reservoir', 'Borehole', 'Other'],
  };
  const [shapeNaming, setShapeNaming] = useState<{ id: string; type: 'site' | 'water' } | null>(null);
  const [shapeName, setShapeName] = useState('');
  const [shapeCategory, setShapeCategory] = useState('');
  const openShapeNaming = useCallback((id: string, type: 'site' | 'water', overrideName?: string, overrideCat?: string) => {
    const draw = drawRef.current;
    const f = draw?.get(id);
    setShapeName(overrideName !== undefined ? overrideName : (f?.properties?.name as string) ?? '');
    setShapeCategory(overrideCat !== undefined ? overrideCat : (f?.properties?.category as string) ?? '');
    setShapeNaming({ id, type });
  }, []);
  const confirmShapeNaming = useCallback(() => {
    if (!shapeNaming) return;
    const draw = drawRef.current;
    if (draw) {
      try {
        draw.setFeatureProperty(shapeNaming.id, 'name', shapeName.trim() || undefined);
        draw.setFeatureProperty(shapeNaming.id, 'category', shapeCategory || undefined);
      } catch { /* feature may be gone */ }
    }
    setShapeNaming(null);
    recompute();
    setSiteFeatures(getSiteFeatures());
    setWaterFeatures(getWaterFeatures());
  }, [shapeNaming, shapeName, shapeCategory, recompute, getSiteFeatures, getWaterFeatures]);

  // Delete a single drawn feature by id (one parcel / one water store)
  const deleteFeature = useCallback((featureId: string) => {
    const draw = drawRef.current;
    if (!draw) return;
    try { draw.delete(featureId); } catch {}
    setEditingFeatureId((prev) => (prev === featureId ? null : prev));
    setPendingDelete(null);
    recompute();
  }, [recompute]);

  // Two-tap delete: first tap arms (button shows "Sure?"), second tap within 3.5s deletes.
  // Stops an accidental 🗑 from wiping a boundary the farmer spent minutes drawing.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancel needs a confirm once ≥3 corners exist (so an accidental tap doesn't bin the work)
  const [cancelArmed, setCancelArmed] = useState(false);
  const requestDelete = useCallback((featureId: string) => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    setPendingDelete((cur) => {
      if (cur === featureId) { deleteFeature(featureId); return null; }
      pendingTimer.current = setTimeout(() => setPendingDelete(null), 3500);
      return featureId;
    });
  }, [deleteFeature]);

  return (
    <div className="relative w-full h-full">
      <ReactMapGL
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: 25, latitude: -29, zoom: 5.2 }}
        mapStyle={`mapbox://styles/mapbox/${style}`}
        terrain={terrain3d ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        dragRotate={false}
        touchPitch={false}
        onLoad={(e) => {
          try { e.target.touchZoomRotate.disableRotation(); } catch {}
          // iOS "Add to Home Screen" launches the map before the container has its
          // final size, leaving a blank canvas — force a couple of resizes to repaint.
          const m = e.target;
          m.resize();
          setTimeout(() => m.resize(), 250);
          setTimeout(() => m.resize(), 800);
        }}
        preserveDrawingBuffer
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverElevation(null)}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onMove={(e) => {
          if ((!pinDraw && !editPin) || movePending.current) return;
          // Defer out of render phase (react-map-gl can fire onMove mid-render) + coalesce to 1/frame.
          // Keeps the draft/edit SVG overlay reprojected as the map pans. Corners move by dragging
          // their markers directly, so nothing tracks the map centre here.
          const { longitude, latitude } = e.viewState;
          movePending.current = true;
          requestAnimationFrame(() => { movePending.current = false; setMapCenter([longitude, latitude]); });
        }}
        cursor={pinDraw ? 'grab' : !activeDraw ? (loading ? 'wait' : 'crosshair') : 'default'}
        style={{ width: '100%', height: '100%' }}
      >
        <ScaleControl position="bottom-right" maxWidth={120} unit="metric" />
        <Source id="mapbox-dem" {...terrainSource} />

        {/* Hillshade relief — shades hills/valleys so slope shape & direction read at a glance */}
        {hillshade && (
          <Source id="hillshade-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14}>
            <Layer id="hillshade-layer" type="hillshade"
              paint={{ 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#08120a', 'hillshade-highlight-color': '#eef3df', 'hillshade-accent-color': '#1a2e16' }} />
          </Source>
        )}

        {/* Esri World Imagery — alternative high-res satellite (often sharper than Maxar in rural areas) */}
        {hdImagery && (
          <Source
            id="esri-imagery"
            type="raster"
            tiles={['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']}
            tileSize={256}
            maxzoom={18}
            attribution="Imagery © Esri, Maxar, Earthstar Geographics"
          >
            <Layer id="esri-imagery-layer" type="raster" paint={{ 'raster-resampling': 'linear' }} />
          </Source>
        )}

        {contours && (
          <Source id="contours" type="vector" url="mapbox://mapbox.mapbox-terrain-v2">
            <Layer {...contourMinor} />
            <Layer {...contourMajor} />
            <Layer {...contourLabel} />
            <Layer {...contourLabelMinor} />
          </Source>
        )}

        {/* Saved-place pins — click to fly in */}
        {!activeDraw && savedPins.map((p) => (
          <Marker key={p.id} longitude={p.lon} latitude={p.lat} anchor="bottom">
            <button
              onClick={(e) => {
                e.stopPropagation();
                mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 16, duration: 1400 });
                onLocationSelect(p.lat, p.lon);
                onPlaceSelect?.(p.name);
              }}
              title={p.name}
              className="flex flex-col items-center group"
              style={{ cursor: 'pointer', transform: 'translateY(2px)' }}
            >
              <span className={`px-1.5 py-0.5 rounded text-xs font-display font-medium whitespace-nowrap mb-0.5 transition-opacity ${showLabels ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{ background: 'rgba(6,16,10,0.9)', border: '1px solid var(--border-bright)', color: placeColor(p.label) }}>
                {p.name}
              </span>
              <MapPin size={22} style={{ color: placeColor(p.label), fill: placeColor(p.label), filter: 'drop-shadow(0 1px 2px rgba(32,25,15,0.4))' }} />
            </button>
          </Marker>
        ))}

        {selectedLocation && !activeDraw && (
          <Marker longitude={selectedLocation.lon} latitude={selectedLocation.lat} anchor="bottom">
            <div className="relative">
              {loading && <div className="absolute -inset-3 rounded-full border-2 border-accent-green animate-ping opacity-60" />}
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
            </div>
          </Marker>
        )}

        {/* Committed corner dots as native Markers — they lock to the ground and never
            drift while panning (an SVG overlay lagged a frame behind the map). */}
        {pinDraw && draftPoints.map((p, i) => (
          <Marker key={i} longitude={p[0]} latitude={p[1]} anchor="center">
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: draftStroke, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.55)' }} />
          </Marker>
        ))}

        {/* Custom-engine edit: big corner handles — grab and drag INSTANTLY (raw pointer
            events, no hold delay). Quick tap selects (gold ring) for the 🗑 Remove button. */}
        {editPin && editPoints.map((p, i) => (
          <Marker key={i} longitude={p[0]} latitude={p[1]} anchor="center">
            <div
              onPointerDown={(e) => onCornerPointerDown(i, e)}
              onPointerMove={onCornerPointerMove}
              onPointerUp={onCornerPointerUp}
              onPointerCancel={onCornerPointerUp}
              aria-label={`Corner ${i + 1}`}
              style={{
                width: 40, height: 40, borderRadius: '50%', cursor: 'grab',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: draftColor, color: '#06160a',
                border: selCorner === i ? '3px solid var(--gold)' : '3px solid #fff',
                fontSize: 15, fontWeight: 800, lineHeight: 1, touchAction: 'none',
                boxShadow: selCorner === i ? '0 0 0 3px rgba(212,168,83,0.4), 0 2px 8px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.6)',
              }}>
              {i + 1}
            </div>
          </Marker>
        ))}
      </ReactMapGL>

      {/* ── Reticle-draw preview overlay (screen-space SVG — terrain-safe, no GL source) ── */}
      {pinDraw && (
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 7 }}>
          {draftScreen.length >= 2 && (
            <polygon
              points={[...draftScreen, reticleScreen].map(([x, y]) => `${x},${y}`).join(' ')}
              fill={draftColor} fillOpacity={0.2} stroke="none" />
          )}
          {draftScreen.length >= 1 && (
            <polyline
              points={[...draftScreen, reticleScreen].map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none" stroke={draftStroke} strokeWidth={2.5} strokeDasharray="6 4" strokeLinejoin="round" />
          )}
        </svg>
      )}

      {/* ── Edit overlay: closed outline of the working ring (terrain-safe screen SVG) ── */}
      {editPin && editScreen.length >= 2 && (
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 7 }}>
          <polygon
            points={editScreen.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill={draftColor} fillOpacity={0.18} stroke={draftStroke} strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
      )}

      {/* ── Reticle crosshair (fixed at map centre while drawing) ── */}
      {pinDraw && (
        <div className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)', zIndex: 8 }}>
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
            <circle cx="27" cy="27" r="20" stroke={draftStroke} strokeWidth="2" opacity="0.5" />
            <circle cx="27" cy="27" r="3.5" fill={draftStroke} stroke="#fff" strokeWidth="1.5" />
            <line x1="27" y1="2" x2="27" y2="14" stroke={draftStroke} strokeWidth="2" />
            <line x1="27" y1="40" x2="27" y2="52" stroke={draftStroke} strokeWidth="2" />
            <line x1="2" y1="27" x2="14" y2="27" stroke={draftStroke} strokeWidth="2" />
            <line x1="40" y1="27" x2="52" y2="27" stroke={draftStroke} strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* ── Reticle-draw action bar (phone-first, big touch targets) ── */}
      {pinDraw && (
        <>
          {/* Top hint — fades after 6 s so it stops blocking the view */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: `1px solid ${draftStroke}66`, backdropFilter: 'blur(8px)',
              opacity: hintFaded ? 0 : 1, transition: 'opacity 1s' }}>
            <span className="font-display" style={{ fontSize: 12, color: draftStroke }}>
              {draftPoints.length === 0
                ? `Mark each corner of your ${pinDraw === 'water' ? 'water store' : 'land'} — tap the map, or centre the crosshair and tap Add corner`
                : draftPoints.length < 3
                ? `${draftPoints.length} corner${draftPoints.length > 1 ? 's' : ''} marked — add ${3 - draftPoints.length} more, then tap Finish`
                : `${draftPoints.length} corners marked — tap Finish to close the shape`}
            </span>
          </div>

          {/* GPS error (e.g. permission denied) */}
          {gpsError && (
            <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
              style={{ top: 56, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
                background: 'rgba(28,14,10,0.92)', border: '1px solid rgba(212,110,66,0.6)', backdropFilter: 'blur(8px)' }}>
              <span className="text-xs font-sans" style={{ color: 'var(--orange)' }}>{gpsError}</span>
            </div>
          )}

          {/* Bottom controls — FIXED to the visible viewport (iOS Safari 100vh extends
              below the toolbar, so an absolute bottom bar lands off-screen). */}
          <div className="fixed left-1/2 -translate-x-1/2 flex items-stretch gap-1.5"
            style={{ bottom: 'calc(78px + env(safe-area-inset-bottom))', zIndex: 45, width: 'min(440px, calc(100vw - 20px))' }}>
            <button
              onClick={() => {
                if (draftPoints.length >= 3 && !cancelArmed) { setCancelArmed(true); setTimeout(() => setCancelArmed(false), 3000); return; }
                cancelPinDraw();
              }}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={cancelArmed
                ? { flex: '0 1 52px', minWidth: 0, padding: '9px 0', background: 'rgba(212,110,66,0.95)', border: '1.5px solid rgba(212,110,66,0.9)', color: '#fff' }
                : { flex: '0 1 52px', minWidth: 0, padding: '9px 0', background: 'rgba(28,14,10,0.94)', border: '1.5px solid rgba(212,110,66,0.85)', color: 'var(--orange)' }}>
              <X size={17} />
              <span style={{ fontSize: 12.5, marginTop: 3 }}>{cancelArmed ? 'Discard?' : 'Cancel'}</span>
            </button>

            <button onClick={undoPin} disabled={draftPoints.length === 0}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 1 44px', minWidth: 0, padding: '9px 0', opacity: draftPoints.length === 0 ? 0.45 : 1,
                background: 'rgba(10,18,12,0.94)', border: '1.5px solid rgba(58,104,48,0.7)', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>↶</span>
              <span style={{ fontSize: 12.5, marginTop: 3 }}>Undo</span>
            </button>

            {/* Walk it with GPS — drop a corner at the farmer's actual position */}
            <button onClick={addPinFromGPS} disabled={gpsAdding}
              title="Stand on a corner of your land and tap to drop it here"
              className="flex flex-col items-center justify-center rounded-2xl font-sans transition-all active:scale-95"
              style={{ flex: '0 1 44px', minWidth: 0, padding: '9px 0', cursor: gpsAdding ? 'wait' : 'pointer',
                background: 'rgba(10,18,12,0.94)', border: '1.5px solid rgba(168,216,138,0.6)', color: '#A8D88A' }}>
              {gpsAdding ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}
              <span style={{ fontSize: 12, marginTop: 3, fontWeight: 600 }}>GPS</span>
            </button>

            {/* Primary: drop a corner under the crosshair. Label ellipsizes (never spills
                onto Finish) on very narrow phones; full text shows from ~360px up. */}
            <button onClick={addPin}
              className="flex items-center justify-center gap-1.5 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden', padding: '13px 8px', background: draftColor, color: '#06160a',
                boxShadow: `0 6px 20px ${draftColor}66`, fontSize: 13 }}>
              <Plus size={20} strokeWidth={2.4} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add corner</span>
            </button>

            <button onClick={finishPinDraw} disabled={draftPoints.length < 3}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 1 56px', minWidth: 0, padding: '9px 0', opacity: draftPoints.length < 3 ? 0.5 : 1,
                background: draftPoints.length < 3 ? 'rgba(22,37,20,0.7)' : '#1F4D2B',
                border: '1.5px solid rgba(31,77,43,0.6)', color: draftPoints.length < 3 ? 'rgba(232,240,230,0.4)' : '#F7F2E9' }}>
              <Check size={17} />
              <span style={{ fontSize: 12, marginTop: 3 }}>Finish</span>
            </button>
          </div>
        </>
      )}

      {/* ── Custom-engine EDIT action bar (press & drag the corners) ── */}
      {editPin && (
        <>
          {/* Top hint */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: `1px solid ${draftStroke}66`, backdropFilter: 'blur(8px)' }}>
            <span className="font-display" style={{ fontSize: 12, color: draftStroke }}>
              {selCorner == null
                ? `Drag a corner to move it${editAreaHa != null ? ` · ${editAreaHa} ha` : ''}`
                : `Corner ${selCorner + 1} selected — drag or Remove · ${editAreaHa ?? ''} ha`}
            </span>
          </div>

          <div className="fixed left-1/2 -translate-x-1/2 flex items-stretch gap-1.5"
            style={{ bottom: 'calc(78px + env(safe-area-inset-bottom))', zIndex: 45, width: 'min(480px, calc(100vw - 20px))' }}>
            <button onClick={cancelReticleEdit}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 1 50px', minWidth: 0, padding: '9px 0', background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)' }}>
              <X size={17} />
              <span style={{ fontSize: 11, marginTop: 3 }}>Cancel</span>
            </button>
            <button onClick={removeEditCorner} disabled={selCorner == null || editPoints.length <= 3}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 1 50px', minWidth: 0, padding: '9px 0', opacity: (selCorner == null || editPoints.length <= 3) ? 0.4 : 1,
                background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)' }}>
              <Trash2 size={15} />
              <span style={{ fontSize: 11, marginTop: 3 }}>Remove</span>
            </button>
            <button onClick={() => openShapeNaming(editPin.id, editPin.type, editNameRef.current?.name, editNameRef.current?.category)}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 1 50px', minWidth: 0, padding: '9px 0', background: 'rgba(22,37,20,0.85)', border: `1px solid ${draftStroke}66`, color: draftStroke }}>
              <PenLine size={15} />
              <span style={{ fontSize: 11, marginTop: 3 }}>Rename</span>
            </button>
            <button onClick={addEditCorner}
              className="flex items-center justify-center gap-1 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden', padding: '10px 6px', background: 'rgba(22,37,20,0.85)', border: `1px solid ${draftStroke}99`, color: draftStroke, fontSize: 12 }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>＋</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add corner</span>
            </button>
            <button onClick={finishReticleEdit}
              className="flex flex-col items-center justify-center rounded-2xl font-display font-bold transition-all active:scale-95"
              style={{ flex: '0 1 50px', minWidth: 0, padding: '9px 0', background: '#1F4D2B', border: '1px solid rgba(31,77,43,0.6)', color: '#F7F2E9' }}>
              <Check size={17} />
              <span style={{ fontSize: 11, marginTop: 3 }}>Done</span>
            </button>
          </div>
        </>
      )}

      {/* ── Unified toolbar ────────────────────── */}
      {/*
        On mobile: constrained to screen width minus a small right margin so the
        zoom slider (right:12px, width ~36px) doesn't overlap. We cap at calc(100vw - 56px).
        On desktop: max-width 380px keeps the original appearance.
        Hidden entirely while drawing/editing so it can't overlap the instruction
        banner or crowd the map — the bottom action bar is all you need then.
      */}
      {!pinDraw && !editPin && !activeDraw && toolbarMin && (
        <button
          onClick={openPanel}
          aria-label="Show map tools"
          className="absolute top-3 left-3 flex items-center font-sans transition-all active:scale-95"
          style={{
            zIndex: 10, height: 48, padding: '0 16px', gap: 9, borderRadius: 14,
            background: 'rgba(22,30,18,0.86)', border: '1px solid rgba(234,243,226,0.12)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 24px -10px rgba(0,0,0,0.5)',
            color: '#F7F2E9', fontSize: 14.5, fontWeight: 600,
          }}
        >
          <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8, background: '#1F4D2B', color: '#A8D88A' }}><Sprout size={15} strokeWidth={1.7} /></span>
          Find your land
        </button>
      )}

      {!pinDraw && !editPin && !activeDraw && !toolbarMin && (
      <div
        className="absolute top-3 left-3 flex flex-col gap-2.5 rounded-2xl"
        style={{
          zIndex: 10,
          background: 'rgba(22,30,18,0.86)',
          border: '1px solid rgba(234,243,226,0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 18px 50px -16px rgba(0,0,0,0.6)',
          maxWidth: 'min(340px, calc(100vw - 60px))',
          width: '100%',
          padding: 16,
          boxSizing: 'border-box',
          // Never taller than the map — scroll inside the panel so nothing spills off-screen.
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Header — brand + collapse */}
        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: '#1F4D2B', color: '#A8D88A' }}>
              <Sprout size={17} strokeWidth={1.7} />
            </div>
            <span className="font-display" style={{ fontWeight: 600, fontSize: 17, color: '#F7F2E9' }}>Find your land</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Lima quick-guide — reopen the coach-marks any time */}
            <button
              onClick={() => setGuideOpen(true)}
              aria-label="Lima's quick guide"
              title="How the map tools work"
              className="flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{ width: 26, height: 26, background: 'rgba(168,216,138,0.14)', border: '1px solid rgba(168,216,138,0.3)', color: '#A8D88A', cursor: 'pointer' }}
            >
              <HelpCircle size={15} strokeWidth={1.9} />
            </button>
            <button
              onClick={() => setToolbarMin(true)}
              aria-label="Hide map tools"
              className="flex items-center gap-1 transition-all active:scale-95"
              style={{ background: 'transparent', border: 'none', color: 'rgba(234,243,226,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Hide <ChevronUp size={14} />
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="relative">
        <form onSubmit={(e) => { e.preventDefault(); setSuggestions([]); handleSearch(searchQuery); }}
          className="flex items-center gap-2.5"
          style={{ height: 50, padding: '0 8px 0 15px', borderRadius: 13,
            background: 'rgba(247,242,233,0.1)',
            border: `1px solid ${searchError ? 'rgba(212,110,66,0.7)' : 'rgba(234,243,226,0.18)'}` }}>
          <Search size={19} style={{ color: 'rgba(234,243,226,0.55)', flexShrink: 0 }} strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { const v = e.target.value; setSearchQuery(v); setSearchError(''); setSearchResult(''); setShowRecents(false); fetchSuggestions(v); }}
            onFocus={() => { if (!searchQuery.trim() && recents.length) setShowRecents(true); }}
            onBlur={() => setTimeout(() => { setSuggestions([]); setShowRecents(false); }, 150)}
            placeholder="Search town or address"
            className="map-search-input flex-1 font-sans outline-none min-w-0"
            style={{ background: 'transparent', border: 'none', color: '#e8f0e6', fontSize: 15 }}
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            aria-label="Search"
            className="flex items-center justify-center transition-all flex-shrink-0 active:scale-95"
            style={{ width: 34, height: 34, borderRadius: 9, border: 'none',
              background: searching || !searchQuery.trim() ? 'rgba(46,107,58,0.5)' : '#2E6B3A',
              color: '#fff', cursor: searchQuery.trim() ? 'pointer' : 'default' }}
          >
            {searching ? <Loader2 size={16} className="animate-spin" /> : <CornerDownLeft size={17} strokeWidth={2.2} />}
          </button>
        </form>
        {/* Autofill dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 rounded-lg overflow-hidden z-50"
            style={{ top: 'calc(100% + 4px)', background: 'rgba(6,16,10,0.97)', border: '1px solid rgba(58,104,48,0.6)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
            {suggestions.map((s, i) => (
              <button key={i}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                className="flex items-start gap-2 w-full text-left transition-all"
                style={{ padding: '12px', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(58,104,48,0.25)' : 'none',
                  background: 'transparent', color: '#dce8da', fontSize: 16, lineHeight: 1.3 }}>
                <MapPin size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
        {/* Recent searches — shown when the empty search box is focused */}
        {showRecents && suggestions.length === 0 && recents.length > 0 && (
          <div className="absolute left-0 right-0 rounded-lg overflow-hidden z-50"
            style={{ top: 'calc(100% + 4px)', background: 'rgba(6,16,10,0.97)', border: '1px solid rgba(58,104,48,0.6)', boxShadow: '0 8px 28px rgba(0,0,0,0.55)' }}>
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(232,240,230,0.55)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(58,104,48,0.25)' }}>Recent</div>
            {recents.map((r, i) => (
              <button key={i}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(r); }}
                className="flex items-center gap-2 w-full text-left transition-all"
                style={{ padding: '12px', borderBottom: i < recents.length - 1 ? '1px solid rgba(58,104,48,0.25)' : 'none',
                  background: 'transparent', color: '#dce8da', fontSize: 16, lineHeight: 1.3 }}>
                <MapPin size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
        </div>
        {searchError && <p className="text-xs font-mono" style={{ color: 'var(--orange)', marginTop: -4 }}>{searchError}</p>}
        {searchResult && <p className="text-xs font-mono truncate" style={{ color: 'var(--teal)', marginTop: -4 }}>↳ {searchResult}</p>}

        {/* Layers expander — keeps the rarely-changed map-view toggles tucked away
            so the toolbar isn't a wall of tiny buttons on a phone. */}
        <button onClick={() => setLayersOpen((o) => !o)}
          className="flex items-center justify-between font-sans transition-all"
          style={{ background: 'rgba(247,242,233,0.1)', border: '1px solid rgba(234,243,226,0.18)',
            borderRadius: 13, color: '#EAF3E2', height: 48, fontSize: 14.5, fontWeight: 600, padding: '0 15px' }}>
          <span className="flex items-center gap-2.5 min-w-0">
            <Layers size={19} strokeWidth={1.8} style={{ color: '#A8D88A', flexShrink: 0 }} />
            {/* Collapsed: summarise the active layers (e.g. "Satellite · Contours") */}
            <span className="truncate">{layersOpen ? 'Map layers' : [
              style === 'satellite-streets-v12' ? 'Satellite' : 'Topo',
              hdImagery ? 'HD' : null, contours ? 'Contours' : null,
              hillshade ? 'Relief' : null, terrain3d ? '3D' : null,
            ].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronDown size={16} style={{ color: 'rgba(234,243,226,0.6)', flexShrink: 0, transition: 'transform 0.2s', transform: layersOpen ? 'rotate(180deg)' : 'none' }} />
        </button>

        {layersOpen && (() => {
          // One consistent chip treatment for every layer toggle — green when on,
          // calm paper-tint when off (replaces the old clashing teal/ochre/blue).
          const chip = (on: boolean): React.CSSProperties => ({
            ...(on
              ? { background: 'rgba(168,216,138,0.16)', border: '1px solid rgba(168,216,138,0.45)', color: '#A8D88A' }
              : { background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#EAF3E2' }),
            borderRadius: 9, height: 40, padding: '0 13px', fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          });
          return (
          <div className="flex gap-1.5 flex-wrap font-sans">
            {(['satellite-streets-v12', 'outdoors-v12'] as const).map((s, i) => (
              <button key={s} onClick={() => setStyle(s)} className="transition-all" style={chip(style === s)}>
                {style === s && <Check size={13} strokeWidth={2.4} />}{['Satellite', 'Topo'][i]}
              </button>
            ))}
            <button onClick={() => setHdImagery(!hdImagery)}
              title="Switch to Esri high-res imagery — often sharper than the default when zoomed in"
              className="transition-all" style={chip(hdImagery)}>
              {hdImagery && <Check size={13} strokeWidth={2.4} />}HD
            </button>
            <button onClick={() => setContours(!contours)} className="transition-all" style={chip(contours)}>
              {contours && <Check size={13} strokeWidth={2.4} />}Contours
            </button>
            <button onClick={() => setHillshade(!hillshade)}
              title="Hillshade relief — shades slopes so hills, valleys and the direction land faces are visible"
              className="transition-all" style={chip(hillshade)}>
              <Mountain size={13} strokeWidth={1.9} />Relief
            </button>
            <button
              onClick={() => {
                const next = !terrain3d;
                setTerrain3d(next);
                if (!next) {
                  setShow3dWarning(false);
                  mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 400 });
                } else {
                  setShow3dWarning(true);
                  setTimeout(() => setShow3dWarning(false), 7000);
                }
              }}
              title={terrain3d ? '3D terrain on — switch off for closer top-down zoom' : '3D terrain off (flat)'}
              className="transition-all" style={chip(terrain3d)}>
              <Box size={13} strokeWidth={1.9} />3D
            </button>
          </div>
          );
        })()}

        {/* Heads-up: 3D tilts the map and can stop you zooming in close enough to draw */}
        {layersOpen && show3dWarning && (
          <div className="rounded-lg font-mono"
            style={{ background: 'rgba(212,168,83,0.14)', border: '1px solid rgba(212,168,83,0.45)',
              color: 'var(--gold)', fontSize: TOUCH_FS - 2, padding: '8px 12px', lineHeight: 1.45 }}>
            <AlertTriangle size={13} className="inline mr-1" /> In 3D you may not be able to zoom in close enough to draw boundaries or water. Turn 3D off for that.
          </div>
        )}

        {layersOpen && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.45)', marginBottom: 8, paddingLeft: 2 }}>
              Edit tool · try both
            </div>
            <div className="flex gap-2">
              {([['custom', 'Big handles', Hand], ['native', 'Mapbox tool', PenTool]] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => chooseEngine(key)}
                  className="flex-1 flex items-center justify-center gap-2 font-sans transition-all"
                  style={{
                    ...(editEngine === key
                      ? { background: 'rgba(168,216,138,0.14)', border: '1px solid rgba(168,216,138,0.4)', color: '#A8D88A' }
                      : { background: 'rgba(247,242,233,0.07)', border: '1px solid rgba(234,243,226,0.16)', color: '#EAF3E2' }),
                    borderRadius: 11, minHeight: 44, fontSize: 13, fontWeight: 600,
                  }}>
                  <Icon size={16} strokeWidth={1.8} />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* thin separator */}
        <div style={{ height: 1, background: 'rgba(234,243,226,0.1)' }} />

        {/* Actions row — always wraps */}
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.45)', marginBottom: 10, paddingLeft: 2 }}>
            Tools
          </div>
          <div className="flex gap-1.5 flex-wrap font-sans">
          {/* My location */}
          <button onClick={goToMyLocation} disabled={locating}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: 'rgba(247,242,233,0.07)', border: '1px solid rgba(234,243,226,0.16)',
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600,
              color: locating ? 'rgba(234,243,226,0.5)' : '#EAF3E2',
            }}>
            {locating ? <Loader2 size={18} className="animate-spin" style={{ color: '#A8D88A' }} /> : <LocateFixed size={19} strokeWidth={1.8} style={{ color: '#A8D88A' }} />} Locate me
          </button>

          {/* Save the current spot as a place */}
          <button onClick={saveCurrentPlace} disabled={!selectedLocation}
            title={selectedLocation ? 'Save this spot to your Places' : 'Tap a spot on the map first'}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: placeSaved ? 'rgba(168,216,138,0.16)' : 'rgba(247,242,233,0.07)',
              border: `1px solid ${placeSaved ? 'rgba(168,216,138,0.4)' : 'rgba(234,243,226,0.16)'}`,
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600,
              color: placeSaved ? '#A8D88A' : '#EAF3E2', opacity: selectedLocation ? 1 : 0.5,
            }}>
            {placeSaved ? <Check size={18} strokeWidth={2.2} style={{ color: '#A8D88A' }} /> : <Bookmark size={18} strokeWidth={1.8} style={{ color: '#A8D88A' }} />}{placeSaved ? 'Saved' : 'Save place'}
          </button>

          {/* Quick-jump to a saved place */}
          <button onClick={() => setPlacesOpen((o) => !o)}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: placesOpen ? 'rgba(168,216,138,0.16)' : 'rgba(247,242,233,0.07)',
              border: `1px solid ${placesOpen ? 'rgba(168,216,138,0.4)' : 'rgba(234,243,226,0.16)'}`,
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600, color: '#EAF3E2',
            }}>
            <MapPin size={19} strokeWidth={1.8} style={{ color: '#A8D88A' }} /> Places
            {savedPins.length ? <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1205', background: '#A8D88A', borderRadius: 999, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{savedPins.length}</span> : null}
          </button>

          {/* Saved-places quick list — tap one to fly there; trash to delete */}
          {placesOpen && (
            <div className="w-full flex flex-col gap-1" style={{ marginTop: 2 }}>
              {savedPins.length === 0 ? (
                <div className="px-3 py-2 rounded-lg font-sans"
                  style={{ background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.3)', color: 'var(--text-muted)', fontSize: 13 }}>
                  No saved places yet — tap a spot, then save it above.
                </div>
              ) : (
                <>
                  {/* Show labels on the map — toggle */}
                  <button onClick={() => setShowLabels((v) => !v)}
                    className="flex items-center gap-2 px-3 rounded-lg font-sans transition-all"
                    style={{ background: 'rgba(247,242,233,0.05)', border: '1px solid rgba(234,243,226,0.14)', color: 'var(--text-secondary)', minHeight: 38, fontSize: 13 }}>
                    <span className="flex-1 text-left">Show names on map</span>
                    <span className="flex items-center rounded-full transition-all flex-shrink-0"
                      style={{ width: 38, height: 22, padding: 2, background: showLabels ? '#1F4D2B' : 'rgba(234,243,226,0.18)', justifyContent: showLabels ? 'flex-end' : 'flex-start' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block' }} />
                    </span>
                  </button>

                  {savedPins.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 rounded-lg overflow-hidden"
                      style={{ background: 'rgba(22,37,20,0.6)', border: '1px solid rgba(212,168,83,0.3)', minHeight: 40 }}>
                      {/* Colour dot — tap to edit name/colour */}
                      <button
                        onClick={() => startEditPlace(p)}
                        title="Edit name or colour"
                        className="flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                        style={{ width: 36, minHeight: 40, background: 'transparent', border: 'none', borderRight: '1px solid rgba(234,243,226,0.1)', cursor: 'pointer' }}>
                        <span style={{ width: 13, height: 13, borderRadius: '50%', background: placeColor(p.label), boxShadow: '0 0 0 2px rgba(6,16,10,0.5), 0 0 0 3.5px rgba(255,255,255,0.2)' }} />
                      </button>
                      <button
                        onClick={() => {
                          mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 15, duration: 1400 });
                          onLocationSelect(p.lat, p.lon);
                          onPlaceSelect?.(p.name);
                          setPlacesOpen(false);
                        }}
                        className="flex-1 flex items-center gap-1.5 pr-1 font-sans text-left transition-all min-w-0"
                        style={{ color: 'var(--text-secondary)', minHeight: 40, fontSize: 13 }}>
                        <span className="flex-1 min-w-0" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.elevation}m</span>
                      </button>
                      <button
                        onClick={() => { deletePlace(p.id); setSavedPins(loadPlaces()); }}
                        aria-label={`Delete ${p.name}`} title="Delete this place"
                        className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                        style={{ width: 38, minHeight: 40, background: 'transparent', border: 'none', borderLeft: '1px solid rgba(212,110,66,0.25)', color: 'rgba(212,110,66,0.85)', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Drawing in progress */}
          {activeDraw && (
            <>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono"
                style={activeDraw === 'water'
                  ? { background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.55)', color: '#235E86', minHeight: 32 }
                  : { background: 'rgba(31,77,43,0.18)', border: '1px solid rgba(31,77,43,0.55)', color: '#2D6B3C', minHeight: 32 }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: activeDraw === 'water' ? '#235E86' : '#2D6B3C' }} />
                {activeDraw === 'water' ? 'Water' : 'Boundary'} · click points · dbl-click to finish · Esc to cancel
              </div>
              <button onClick={cancelDraw}
                className="px-2 py-1 rounded-lg text-xs font-mono transition-all"
                style={{ background: 'rgba(212,110,66,0.15)', border: '1px solid rgba(212,110,66,0.4)', color: 'var(--orange)', minHeight: 32 }}>
                <X size={13} className="inline mr-1" />Cancel
              </button>
            </>
          )}

          {/* Vertex editing */}
          {editingFeatureId && !activeDraw && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-display"
                style={{ background: 'rgba(212,168,83,0.14)', border: '1px solid rgba(212,168,83,0.4)', color: 'var(--gold)', minHeight: 32, fontSize: 11 }}>
                Drag dots to reshape · mid-dot adds a corner
              </div>
              <button onClick={() => {
                  const draw = drawRef.current;
                  const backup = nativeEditBackupRef.current;
                  if (!draw || !backup) return;
                  const id = backup.id as string;
                  try {
                    draw.delete(id);
                    draw.add(backup);
                    draw.changeMode('direct_select', { featureId: id });
                    setEditingFeatureId(id);
                  } catch { /* ignore */ }
                  recompute();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: 'rgba(91,158,212,0.12)', border: '1px solid rgba(91,158,212,0.35)', color: '#7FC4F0', minHeight: 32, opacity: nativeEditBackupRef.current ? 1 : 0.4 }}>
                <Undo2 size={12} className="inline mr-1" />Undo
              </button>
              <button onClick={() => {
                  const f = drawRef.current?.get(editingFeatureId);
                  const type = f?.properties?.featureType === 'water' ? 'water' : 'site';
                  openShapeNaming(editingFeatureId, type);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: 'rgba(168,216,138,0.12)', border: '1px solid rgba(168,216,138,0.35)', color: '#A8D88A', minHeight: 32 }}>
                <PenLine size={12} className="inline mr-1" />Rename
              </button>
              <button onClick={() => requestDelete(editingFeatureId)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={pendingDelete === editingFeatureId
                  ? { background: 'rgba(212,110,66,0.9)', border: '1px solid rgba(212,110,66,0.7)', color: '#fff', minHeight: 32 }
                  : { background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)', minHeight: 32 }}>
                <Trash2 size={12} className="inline mr-1" />{pendingDelete === editingFeatureId ? 'Confirm delete' : 'Delete'}
              </button>
              <button onClick={finishEditing}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: '#1F4D2B', border: '1px solid rgba(31,77,43,0.6)', color: '#F7F2E9', minHeight: 32 }}>
                <Check size={12} className="inline mr-1" />Save
              </button>
            </>
          )}

          {/* ── Site / Land parcel section ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && (
            <>
              {siteStats ? (
                <div className="w-full flex flex-col gap-1.5">
                  {/* Section label */}
                  <div className="flex items-center justify-between" style={{ paddingLeft: 2 }}>
                    <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                      Your land · {siteStats.count ?? 1} parcel{(siteStats.count ?? 1) !== 1 ? 's' : ''}
                    </span>
                    <span className="font-sans" style={{ fontSize: 12, color: 'rgba(234,243,226,0.5)' }}>{siteStats.areaHa} ha total</span>
                  </div>
                  {/* Per-parcel rows — named, with labelled buttons */}
                  {siteFeatures.map((sf, idx) => (
                    <div key={sf.id} className="flex items-center gap-2 px-3 py-2 rounded-xl font-sans"
                      style={{ background: 'rgba(247,242,233,0.06)', border: '1px solid rgba(234,243,226,0.14)' }}>
                      <button onClick={() => openShapeNaming(sf.id, 'site')} className="flex-1 min-w-0 text-left" title="Tap to rename / categorise" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <div className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 600, color: '#EAF3E2' }}>
                          <span className="truncate">{sf.name || `Parcel ${idx + 1}`}</span>
                          <PenLine size={11} style={{ color: 'rgba(234,243,226,0.4)', flexShrink: 0 }} />
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(234,243,226,0.55)' }}>{sf.category ? `${sf.category} · ` : ''}{sf.areaHa} ha</div>
                      </button>
                      <button onClick={() => startEdit(sf.id, 'site')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-sans font-semibold"
                        style={{ fontSize: 13, background: 'rgba(168,216,138,0.14)', border: '1px solid rgba(168,216,138,0.35)', color: '#A8D88A' }}>
                        <PenLine size={13} />Edit shape</button>
                      <button onClick={() => requestDelete(sf.id)}
                        className="flex items-center justify-center rounded-lg font-sans font-semibold flex-shrink-0"
                        style={pendingDelete === sf.id
                          ? { padding: '0 8px', height: 32, fontSize: 12, background: '#C0492A', border: '1px solid #C0492A', color: '#fff' }
                          : { width: 32, height: 32, background: 'rgba(192,73,42,0.14)', border: '1px solid rgba(192,73,42,0.4)', color: '#D4926A' }}
                        title="Delete parcel">{pendingDelete === sf.id ? 'Sure?' : <Trash2 size={14} />}</button>
                    </div>
                  ))}
                  {/* + Add another parcel — dashed, explicit */}
                  <button onClick={() => startPinDraw('site')}
                    className="w-full flex items-center justify-center gap-2 font-sans font-semibold active:scale-95"
                    style={{ fontSize: 14, height: 44, borderRadius: 12, background: 'transparent', border: '1.5px dashed rgba(192,122,30,0.55)', color: '#C07A1E', cursor: 'pointer' }}>
                    <Plus size={15} />Add another parcel
                  </button>
                </div>
              ) : (
                <button onClick={() => startPinDraw('site')}
                  className="w-full flex items-center justify-center gap-2 font-sans transition-all active:scale-95"
                  style={{ height: 52, borderRadius: 14, border: 'none', background: '#C07A1E', color: '#1a1205', fontSize: 15, fontWeight: 800, boxShadow: '0 6px 16px -6px rgba(192,122,30,0.7)', cursor: 'pointer' }}>
                  <PenTool size={19} strokeWidth={2} />Draw land boundary
                </button>
              )}
            </>
          )}

          {/* ── Water storage section ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && (waterStats ? (
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex items-center justify-between" style={{ paddingLeft: 2 }}>
                <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                  Water storage · {waterStats.count} store{waterStats.count !== 1 ? 's' : ''}
                </span>
                <span className="font-sans" style={{ fontSize: 12, color: 'rgba(234,243,226,0.5)' }}>~{waterStats.estVolumeKL.toLocaleString()} kL total</span>
              </div>
              {/* Per-store rows */}
              {waterFeatures.map((wf, idx) => (
                <div key={wf.id} className="flex items-center gap-2 px-3 py-2 rounded-xl font-sans"
                  style={{ background: 'rgba(247,242,233,0.06)', border: '1px solid rgba(234,243,226,0.14)' }}>
                  <button onClick={() => openShapeNaming(wf.id, 'water')} className="flex-1 min-w-0 text-left" title="Tap to rename / categorise" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 600, color: '#EAF3E2' }}>
                      <span className="truncate">{wf.name || `Store ${idx + 1}`}</span>
                      <PenLine size={11} style={{ color: 'rgba(234,243,226,0.4)', flexShrink: 0 }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(234,243,226,0.55)' }}>{wf.category ? `${wf.category} · ` : ''}~{wf.estVolumeKL.toLocaleString()} kL</div>
                  </button>
                  <button onClick={() => startEdit(wf.id, 'water')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-sans font-semibold"
                    style={{ fontSize: 13, background: 'rgba(143,199,232,0.16)', border: '1px solid rgba(143,199,232,0.4)', color: '#8FC7E8' }}>
                    <PenLine size={13} />Edit</button>
                  <button onClick={() => requestDelete(wf.id)}
                    className="flex items-center justify-center rounded-lg font-sans font-semibold flex-shrink-0"
                    style={pendingDelete === wf.id
                      ? { padding: '0 8px', height: 32, fontSize: 12, background: '#C0492A', border: '1px solid #C0492A', color: '#fff' }
                      : { width: 32, height: 32, background: 'rgba(192,73,42,0.14)', border: '1px solid rgba(192,73,42,0.4)', color: '#D4926A' }}
                    title="Delete store">{pendingDelete === wf.id ? 'Sure?' : <Trash2 size={14} />}</button>
                </div>
              ))}
              {/* + Add another water store — solid blue, explicit */}
              <button onClick={() => startPinDraw('water')}
                className="w-full flex items-center justify-center gap-2 font-sans font-semibold active:scale-95"
                style={{ fontSize: 14, height: 44, borderRadius: 12, background: '#235E86', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <Plus size={15} />Add another water store
              </button>
            </div>
          ) : (
            <button onClick={() => startPinDraw('water')}
              className="w-full flex items-center justify-center gap-2 font-sans transition-all active:scale-95"
              style={{ height: 52, borderRadius: 14, border: 'none', background: '#235E86', color: '#fff', fontSize: 15, fontWeight: 800, boxShadow: '0 6px 16px -6px rgba(35,94,134,0.6)', cursor: 'pointer' }}>
              <Droplets size={19} strokeWidth={2} />Draw water storage
            </button>
          ))}

          {/* Capture */}
          {onMapCapture && selectedLocation && (
            <button
              onClick={() => {
                const canvas = mapRef.current?.getCanvas();
                if (!canvas) return;
                try { onMapCapture(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]); }
                catch { onMapCapture(canvas.toDataURL().split(',')[1]); }
                onCaptureClick?.();
              }}
              className="flex items-center gap-2 font-sans transition-all active:scale-95"
              style={{ background: 'rgba(247,242,233,0.07)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600, color: '#EAF3E2' }}>
              <Sprout size={18} strokeWidth={1.8} style={{ color: '#A8D88A' }} />Ask Lima
            </button>
          )}
          </div>
        </div>

        {/* Elevation readout */}
        {hoverElevation !== null && (
          <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(234,243,226,0.1)' }}>
            <Mountain size={12} style={{ color: 'rgba(234,243,226,0.5)' }} />
            <span className="text-xs font-sans" style={{ color: 'rgba(234,243,226,0.55)' }}>elev</span>
            <span className="text-xs font-sans font-semibold" style={{ color: '#A8D88A' }}>
              {hoverElevation}m
            </span>
            <span className="text-xs font-sans" style={{ color: 'rgba(234,243,226,0.4)' }}>asl</span>
          </div>
        )}
      </div>
      )}

      {/* ── Zoom control — big +/− buttons + a non-interactive fill bar, bottom-right
           above the Details button. (A rotated range input is undraggable on touch.) ── */}
      <div
        className="absolute flex flex-col items-center gap-1.5 select-none"
        style={{
          right: 12, bottom: 'calc(96px + env(safe-area-inset-bottom))',
          background: 'rgba(22,30,18,0.86)', border: '1px solid rgba(234,243,226,0.12)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16, padding: '8px 6px', boxShadow: '0 8px 24px -10px rgba(0,0,0,0.5)',
          zIndex: 5,
        }}
      >
        <button
          onClick={() => mapRef.current?.zoomTo(Math.min(MAX_ZOOM, zoom + 1), { duration: 300 })}
          className="rounded-lg flex items-center justify-center leading-none transition-all active:scale-90"
          style={{ width: 40, height: 40, fontSize: 22, background: 'transparent', border: 'none', color: '#EAF3E2' }}
          title="Zoom in" aria-label="Zoom in"
        >+</button>

        {/* Vertical fill bar — shows current zoom, not draggable */}
        <div className="relative rounded-full overflow-hidden" style={{ width: 5, height: 84, background: 'rgba(234,243,226,0.14)' }}>
          <div className="absolute left-0 right-0 bottom-0 rounded-full" style={{
            height: `${Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100)}%`,
            background: '#A8D88A',
          }} />
        </div>

        <button
          onClick={() => mapRef.current?.zoomTo(Math.max(MIN_ZOOM, zoom - 1), { duration: 300 })}
          className="rounded-lg flex items-center justify-center leading-none transition-all active:scale-90"
          style={{ width: 40, height: 40, fontSize: 22, background: 'transparent', border: 'none', color: '#EAF3E2' }}
          title="Zoom out" aria-label="Zoom out"
        >−</button>

        <span className="text-xs font-sans font-semibold" style={{ color: 'rgba(234,243,226,0.6)' }}>
          z{zoom.toFixed(1)}
        </span>
      </div>

      {/* ── First-tap / click hint ──────────────── */}
      {!selectedLocation && !activeDraw && !pinDraw && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2.5 rounded-full"
          style={{
            zIndex: 15,
            bottom: 72, padding: '11px 18px',
            background: 'rgba(22,30,18,0.86)',
            border: '1px solid rgba(234,243,226,0.14)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px -10px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
              style={{ background: '#A8D88A' }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#A8D88A' }} />
          </span>
          <span className="font-display italic" style={{ fontSize: 15, fontWeight: 500, color: '#EAF3E2' }}>
            Tap your area or search a town
          </span>
        </div>
      )}

      {/* ── Save-place naming sheet — name it + pick a label (sets the pin colour) ── */}
      {namingPlace && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setNamingPlace(null)} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[71] w-full"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} style={{ color: placeColor(placeLabel) }} />
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{editingPlaceId ? 'Edit place' : 'Save this place'}</span>
              </div>
              <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} autoFocus
                placeholder="Name it — e.g. Home plot"
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-3"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="text-xs font-sans uppercase tracking-wider mb-2" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>Label</div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PLACE_LABELS.map((l) => {
                  const on = placeLabel === l.v;
                  return (
                    <button key={l.v} onClick={() => setPlaceLabel(l.v)}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold transition-all"
                      style={{ fontSize: 12, background: on ? l.color : 'rgba(226,216,196,0.4)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? l.color : '#E2D8C4'}`, cursor: 'pointer' }}>
                      <MapPin size={16} style={{ color: on ? '#fff' : l.color }} />{l.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNamingPlace(null)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={confirmSavePlace}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#1F4D2B', border: 'none', color: '#F7F2E9', cursor: 'pointer' }}>
                  <Check size={15} />Save place
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Name & categorise a drawn parcel / water store ── */}
      {shapeNaming && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShapeNaming(null)} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[71] w-full"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                {shapeNaming.type === 'water'
                  ? <Droplets size={16} style={{ color: '#235E86' }} />
                  : <PenTool size={16} style={{ color: '#1F4D2B' }} />}
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                  Name your {shapeNaming.type === 'water' ? 'water store' : 'land'}
                </span>
              </div>
              <input value={shapeName} onChange={(e) => setShapeName(e.target.value)} autoFocus
                placeholder={shapeNaming.type === 'water' ? 'e.g. Main dam' : 'e.g. Home plot'}
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-3"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="text-xs font-sans uppercase tracking-wider mb-2" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>What is it?</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {SHAPE_CATEGORIES[shapeNaming.type].map((c) => {
                  const on = shapeCategory === c;
                  const accent = shapeNaming.type === 'water' ? '#235E86' : '#1F4D2B';
                  return (
                    <button key={c} onClick={() => setShapeCategory(on ? '' : c)}
                      className="px-3 py-2 rounded-xl font-sans font-semibold transition-all"
                      style={{ fontSize: 13, background: on ? accent : 'rgba(226,216,196,0.4)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? accent : '#E2D8C4'}`, cursor: 'pointer' }}>
                      {c}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShapeNaming(null)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Skip
                </button>
                <button onClick={confirmShapeNaming}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#1F4D2B', border: 'none', color: '#F7F2E9', cursor: 'pointer' }}>
                  <Check size={15} />Save name
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Lima's quick guide (coach-marks) — plain-language tool tips ── */}
      {guideOpen && (
        <>
          <div className="fixed inset-0 z-[72]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setGuideOpen(false)} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[73] w-full px-3"
            style={{ top: '50%', transform: 'translate(-50%, -50%)', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-5 font-sans" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 12px 40px rgba(32,25,15,0.28)' }}>
              {/* Lima header */}
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: '#1F4D2B' }}>
                  <Sprout size={20} style={{ color: '#A8D88A' }} strokeWidth={1.7} />
                </div>
                <div>
                  <div className="font-display italic font-semibold" style={{ fontSize: 16, color: '#20190F', lineHeight: 1.1 }}>Lima</div>
                  <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Your map guide</div>
                </div>
              </div>
              <p className="font-sans mb-3" style={{ fontSize: 13.5, color: '#5C5040', lineHeight: 1.5 }}>
                Here&rsquo;s the map in a few taps — you can reopen this any time with the <strong>?</strong> button.
              </p>

              {/* Tool tips */}
              <div className="space-y-2.5 mb-4">
                {([
                  [Search, 'Find your land', 'Search a town, or tap the map — I read its climate, soil and water.'],
                  [PenTool, 'Draw land boundary', 'Mark each corner of your plot, or tap GPS to walk it. I measure the area.'],
                  [Droplets, 'Draw water storage', 'Outline your dam or tank so I can work out your rainwater.'],
                  [MapPin, 'Save place', 'Drop a coloured pin and name it — Home, Field or Water.'],
                  [Layers, 'Map layers', 'Switch satellite / topo and toggle contours & relief.'],
                ] as const).map(([Icon, title, desc], i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{ width: 30, height: 30, background: 'rgba(31,77,43,0.08)' }}>
                      <Icon size={16} style={{ color: '#1F4D2B' }} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F', lineHeight: 1.2 }}>{title}</div>
                      <div className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.4 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setGuideOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-sans font-semibold"
                style={{ fontSize: 15, background: '#1F4D2B', border: 'none', color: '#F7F2E9', cursor: 'pointer' }}>
                <Check size={15} />Got it
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
