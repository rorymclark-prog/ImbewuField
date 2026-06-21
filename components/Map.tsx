'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import ReactMapGL, {
  Source, Layer, Marker, NavigationControl, ScaleControl,
  type MapRef, type MapMouseEvent, type LayerProps,
} from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import turfArea from '@turf/area';
import turfLength from '@turf/length';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { SiteData, WaterData } from '@/lib/types';
import { loadPlaces, type SavedPlace } from '@/lib/saved-places';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Touch / coarse-pointer device? On phones a "tap to add a corner" fires at the end of
// every pan, dropping stray corners — so on touch the ONLY way to add a corner is the
// big ＋ button (drops at the crosshair). Desktop mice keep click-to-place.
const IS_COARSE = typeof window !== 'undefined' &&
  ((window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

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
}

export default function PermaMap({ onLocationSelect, selectedLocation, loading, onMapCapture, onSiteDrawn, onWaterDrawn, onCaptureClick, jumpTo, onJumpComplete, onDrawingChange }: Props) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [style, setStyle] = useState<'satellite-streets-v12' | 'outdoors-v12'>('satellite-streets-v12');
  // Default to Mapbox satellite — consistent coverage everywhere. Esri ("HD") is sharper
  // in some rural spots but has DATA GAPS that render an opaque "Map data not yet available"
  // grey tile, so it's opt-in via the HD toggle, not the default.
  const [hdImagery, setHdImagery] = useState(false);
  const [contours, setContours] = useState(true);
  const [terrain3d, setTerrain3d] = useState(true);
  const [zoom, setZoom] = useState(5.2);
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
  const [hoverElevation, setHoverElevation] = useState<number | null>(null);
  const [savedPins, setSavedPins] = useState<SavedPlace[]>([]);
  // ── Reticle EDIT: edit an existing shape with the SAME "move the map under the
  // crosshair" motion used for drawing — no tiny dot-dragging. Tap a corner to lift it
  // onto the crosshair, move the map, tap Place to drop it. ──
  const [editPin, setEditPin] = useState<null | { id: string; type: 'site' | 'water' }>(null);
  const [editPoints, setEditPoints] = useState<[number, number][]>([]); // working ring (open — no closing dup)
  const [selCorner, setSelCorner] = useState<number | null>(null);      // index currently lifted onto the crosshair
  const editOriginal = useRef<[number, number][] | null>(null);          // snapshot for Cancel

  // Saved-place pins: load + keep in sync with the Places tab
  useEffect(() => {
    const refresh = () => setSavedPins(loadPlaces());
    refresh();
    window.addEventListener('permamap-places-changed', refresh);
    return () => window.removeEventListener('permamap-places-changed', refresh);
  }, []);

  const MIN_ZOOM = 4;
  const MAX_ZOOM = 20; // Esri imagery tops out at z19; allow 1 level of overzoom (soft, not blank). Past this = useless blur.

  const WATER_AVG_DEPTH = 1.5; // m — assumed average depth for capacity estimate

  // Recompute site + water stats from ALL drawn features of each type (summed), propagate up.
  // SITE = sum across ALL site polygons (multiple parcels supported).
  // WATER = sum across all water-storage polygons.
  const recompute = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const all = draw.getAll();
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

    // Colour by featureType: water = blue, site/boundary = emerald
    const fillColor = ['case', ['==', ['get', 'user_featureType'], 'water'], '#5B9ED4', '#48A864'] as unknown as string;
    const strokeColor = ['case', ['==', ['get', 'user_featureType'], 'water'], '#7FC4F0', '#5DCF80'] as unknown as string;

    // Touch screens need much bigger, easier-to-grab corner dots than a mouse. On a phone
    // a finger covers ~44px, so tiny 8px vertices are nearly impossible to drag accurately —
    // this was the #1 complaint vs Google Earth. Bump the visual size AND the invisible
    // hit area (touchBuffer) so a roughly-aimed tap still grabs the nearest corner.
    const vtxRadius = IS_COARSE ? 13 : 8;       // draggable corner dots
    const midRadius = IS_COARSE ? 10 : 7;       // "add a corner here" mid-dots

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      // How close a click/tap must land to grab a vertex. Defaults (2 / 25) are too tight
      // for fingers — widen the touch buffer so corners are easy to catch on a phone.
      clickBuffer: 4,
      touchBuffer: 40,
      styles: [
        { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': fillColor, 'fill-opacity': 0.18 } },
        { id: 'gl-draw-polygon-stroke-active', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2.5, 'line-dasharray': [2, 1] } },
        { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2, 'line-dasharray': [2, 1] } },
        { id: 'gl-draw-point', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': vtxRadius, 'circle-color': strokeColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } },
        { id: 'gl-draw-point-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': midRadius, 'circle-color': fillColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0.85 } },
        { id: 'gl-draw-polygon-fill-static', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'fill-color': fillColor, 'fill-opacity': 0.14 } },
        { id: 'gl-draw-polygon-stroke-static', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'line-color': strokeColor, 'line-width': 2 } },
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

    // Clear editingFeatureId whenever we leave direct_select.
    map.on('draw.modechange', (e: { mode: string }) => {
      if (e.mode !== 'direct_select') setEditingFeatureId(null);
      // Entering direct_select: wait for selectionchange (fired by onSetup after setSelected runs)
    });

    // selectionchange fires after direct_select.onSetup calls setSelected — reliably after modechange.
    map.on('draw.selectionchange', () => {
      if (draw.getMode() === 'direct_select') {
        const ids = draw.getSelectedIds();
        if (ids.length > 0) setEditingFeatureId(ids[0]);
      }
    });

    return draw;
  }, [recompute]);

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
    // Make sure mapbox-gl-draw isn't holding an in-progress polygon
    if (draw) try { draw.changeMode('simple_select'); } catch {}
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

  const undoPin = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const cancelPinDraw = useCallback(() => {
    setPinDraw(null);
    setDraftPoints([]);
    unlockRotation();
  }, [unlockRotation]);

  const finishPinDraw = useCallback(() => {
    const draw = ensureDraw();
    if (!draw || draftPoints.length < 3) return;
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
    try { draw.delete(featureId); } catch {}
    const map = mapRef.current?.getMap();
    if (map) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 200 });
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); } catch {}
      // Centre the view on the shape so its corners are on-screen and reachable
      const lngs = ring.map((c) => c[0]); const lats = ring.map((c) => c[1]);
      const ctr: [number, number] = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
      map.easeTo({ center: ctr, duration: 300 });
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

  // Tap a corner: lift it onto the crosshair (select) — or, if already lifted, drop it (deselect).
  const toggleCorner = useCallback((i: number) => {
    setSelCorner((cur) => {
      if (cur === i) return null;            // tapping the lifted corner again drops it
      // Snap the map so the crosshair sits on the corner we just picked up
      const map = mapRef.current?.getMap();
      setEditPoints((pts) => {
        const p = pts[i];
        if (map && p) map.easeTo({ center: p, duration: 250 });
        return pts;
      });
      return i;
    });
  }, []);

  // Drop the lifted corner where it currently sits (under the crosshair)
  const placeCorner = useCallback(() => setSelCorner(null), []);

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
    if (id != null) draw.setFeatureProperty(id, 'featureType', edit.type);
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
        if (id != null) draw.setFeatureProperty(id, 'featureType', edit.type);
      } catch {}
    }
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

  // Tell the parent when reticle drawing is active (so it can hide the mobile "Results" FAB)
  useEffect(() => { onDrawingChange?.(pinDraw !== null || editPin !== null); }, [pinDraw, editPin, onDrawingChange]);

  // Reset the Cancel-confirm whenever a draw session ends
  useEffect(() => { if (!pinDraw) setCancelArmed(false); }, [pinDraw]);

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
  }, [onLocationSelect, activeDraw, editingFeatureId, pinDraw, editPin]);

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
  const getSiteFeatures = useCallback((): Array<{ id: string; areaHa: number }> => {
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
      }));
  }, []);

  // We track siteFeatures as a derived list rebuilt whenever siteStats changes
  const [siteFeatures, setSiteFeatures] = useState<Array<{ id: string; areaHa: number }>>([]);
  useEffect(() => {
    setSiteFeatures(getSiteFeatures());
  }, [siteStats, getSiteFeatures]);

  // Per-water-store list (id + capacity) so each can be edited/deleted individually
  const getWaterFeatures = useCallback((): Array<{ id: string; estVolumeKL: number }> => {
    const draw = drawRef.current;
    if (!draw) return [];
    return draw.getAll().features
      .filter((f: GeoJSON.Feature) =>
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.featureType === 'water' && f.id != null)
      .map((f: GeoJSON.Feature) => ({ id: String(f.id), estVolumeKL: Math.round(turfArea(f) * WATER_AVG_DEPTH) }));
  }, []);
  const [waterFeatures, setWaterFeatures] = useState<Array<{ id: string; estVolumeKL: number }>>([]);
  useEffect(() => { setWaterFeatures(getWaterFeatures()); }, [waterStats, getWaterFeatures]);

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
          // Defer out of render phase (react-map-gl can fire onMove mid-render) + coalesce to 1/frame
          const { longitude, latitude } = e.viewState;
          movePending.current = true;
          requestAnimationFrame(() => {
            movePending.current = false;
            setMapCenter([longitude, latitude]);
            // While editing, a lifted corner tracks the crosshair (map centre, pitch locked to 0)
            if (editPin && selCorner != null) {
              setEditPoints((pts) => {
                if (selCorner >= pts.length) return pts;
                const next = pts.slice();
                next[selCorner] = [longitude, latitude];
                return next;
              });
            }
          });
        }}
        cursor={(pinDraw || editPin) ? 'grab' : !activeDraw ? (loading ? 'wait' : 'crosshair') : 'default'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass />
        <ScaleControl position="bottom-right" maxWidth={120} unit="metric" />
        <Source id="mapbox-dem" {...terrainSource} />


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
              }}
              title={p.name}
              className="flex flex-col items-center group"
              style={{ cursor: 'pointer', transform: 'translateY(2px)' }}
            >
              <span className="px-1.5 py-0.5 rounded text-xs font-display font-medium whitespace-nowrap mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(6,16,10,0.9)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}>
                ★ {p.name}
              </span>
              <span style={{ fontSize: 20, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))', lineHeight: 1 }}>📍</span>
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

        {/* Edit mode: big tappable corner handles. Tap one to lift it onto the crosshair;
            the lifted corner is hidden here (it rides the crosshair instead). */}
        {editPin && editPoints.map((p, i) => (
          selCorner === i ? null : (
            <Marker key={i} longitude={p[0]} latitude={p[1]} anchor="center">
              <button
                onClick={(e) => { e.stopPropagation(); toggleCorner(i); }}
                aria-label={`Corner ${i + 1}`}
                style={{
                  width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: draftColor, border: '2.5px solid #fff', color: '#06160a',
                  fontSize: 12, fontWeight: 700, lineHeight: 1,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.55)',
                }}>
                {i + 1}
              </button>
            </Marker>
          )
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

      {/* ── Reticle crosshair (fixed at map centre while drawing OR editing) ── */}
      {(pinDraw || editPin) && (
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
          {/* Top hint */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: `1px solid ${draftStroke}66`, backdropFilter: 'blur(8px)' }}>
            <span className="text-xs font-display" style={{ color: draftStroke }}>
              {draftPoints.length === 0
                ? (IS_COARSE
                    ? `Move the map so the crosshair sits on a ${pinDraw === 'water' ? 'water-edge' : 'boundary'} corner, then tap ＋ Add point`
                    : `Click each ${pinDraw === 'water' ? 'water-edge' : 'boundary'} corner on the map — or centre the crosshair and tap ＋`)
                : draftPoints.length < 3
                ? `${draftPoints.length} corner${draftPoints.length > 1 ? 's' : ''} · ${IS_COARSE ? 'keep adding corners' : 'keep clicking corners'} — need at least 3`
                : `${draftPoints.length} corners · tap ✓ Finish when the shape is closed`}
            </span>
          </div>

          {/* Bottom controls — FIXED to the visible viewport (iOS Safari 100vh extends
              below the toolbar, so an absolute bottom bar lands off-screen). */}
          <div className="fixed left-1/2 -translate-x-1/2 flex items-stretch gap-2"
            style={{ bottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 45, width: 'min(440px, calc(100vw - 24px))' }}>
            <button
              onClick={() => {
                if (draftPoints.length >= 3 && !cancelArmed) { setCancelArmed(true); setTimeout(() => setCancelArmed(false), 3000); return; }
                cancelPinDraw();
              }}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={cancelArmed
                ? { flex: '0 0 72px', padding: '10px 0', background: 'rgba(212,110,66,0.9)', border: '1px solid rgba(212,110,66,0.7)', color: '#fff' }
                : { flex: '0 0 64px', padding: '10px 0', background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>✗</span>
              <span style={{ fontSize: 10, marginTop: 2 }}>{cancelArmed ? 'Discard?' : 'Cancel'}</span>
            </button>

            <button onClick={undoPin} disabled={draftPoints.length === 0}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 0 64px', padding: '10px 0', opacity: draftPoints.length === 0 ? 0.4 : 1,
                background: 'rgba(22,37,20,0.75)', border: '1px solid rgba(58,104,48,0.5)', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>↶</span>
              <span style={{ fontSize: 10, marginTop: 2 }}>Undo</span>
            </button>

            {/* Primary: drop a corner under the crosshair */}
            <button onClick={addPin}
              className="flex items-center justify-center gap-2 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={{ flex: 1, padding: '10px 0', background: draftColor, color: '#06160a',
                boxShadow: `0 6px 20px ${draftColor}66`, fontSize: 16 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span> Add point
            </button>

            <button onClick={finishPinDraw} disabled={draftPoints.length < 3}
              className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
              style={{ flex: '0 0 72px', padding: '10px 0', opacity: draftPoints.length < 3 ? 0.4 : 1,
                background: draftPoints.length < 3 ? 'rgba(22,37,20,0.75)' : 'rgba(72,168,100,0.92)',
                border: '1px solid rgba(72,168,100,0.6)', color: draftPoints.length < 3 ? 'var(--text-muted)' : '#06160a' }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>✓</span>
              <span style={{ fontSize: 10, marginTop: 2 }}>Finish</span>
            </button>
          </div>
        </>
      )}

      {/* ── Reticle EDIT action bar (same crosshair motion as drawing) ── */}
      {editPin && (
        <>
          {/* Top hint */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: `1px solid ${draftStroke}66`, backdropFilter: 'blur(8px)' }}>
            <span className="text-xs font-display" style={{ color: draftStroke }}>
              {selCorner == null
                ? `Tap a numbered corner to pick it up${editAreaHa != null ? ` · ${editAreaHa} ha` : ''}`
                : `Move the map so the crosshair is where you want corner ${selCorner + 1}, then tap ✓ Place`}
            </span>
          </div>

          <div className="fixed left-1/2 -translate-x-1/2 flex items-stretch gap-2"
            style={{ bottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 45, width: 'min(460px, calc(100vw - 24px))' }}>
            {selCorner == null ? (
              <>
                {/* Done / Cancel / Add-corner when nothing is lifted */}
                <button onClick={cancelReticleEdit}
                  className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
                  style={{ flex: '0 0 64px', padding: '10px 0', background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>✗</span>
                  <span style={{ fontSize: 10, marginTop: 2 }}>Cancel</span>
                </button>
                <button onClick={addEditCorner}
                  className="flex items-center justify-center gap-2 rounded-2xl font-display font-bold transition-all active:scale-95"
                  style={{ flex: 1, padding: '10px 0', background: 'rgba(22,37,20,0.85)', border: `1px solid ${draftStroke}99`, color: draftStroke, fontSize: 15 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span> Add corner
                </button>
                <button onClick={finishReticleEdit}
                  className="flex flex-col items-center justify-center rounded-2xl font-display font-bold transition-all active:scale-95"
                  style={{ flex: '0 0 80px', padding: '10px 0', background: 'rgba(72,168,100,0.92)', border: '1px solid rgba(72,168,100,0.6)', color: '#06160a' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>✓</span>
                  <span style={{ fontSize: 10, marginTop: 2 }}>Done</span>
                </button>
              </>
            ) : (
              <>
                {/* A corner is lifted: Remove it, or Place it at the crosshair */}
                <button onClick={removeEditCorner} disabled={editPoints.length <= 3}
                  className="flex flex-col items-center justify-center rounded-2xl font-display transition-all active:scale-95"
                  style={{ flex: '0 0 72px', padding: '10px 0', opacity: editPoints.length <= 3 ? 0.4 : 1,
                    background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)' }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🗑</span>
                  <span style={{ fontSize: 10, marginTop: 2 }}>Remove</span>
                </button>
                <button onClick={placeCorner}
                  className="flex items-center justify-center gap-2 rounded-2xl font-display font-bold transition-all active:scale-95"
                  style={{ flex: 1, padding: '10px 0', background: draftColor, color: '#06160a',
                    boxShadow: `0 6px 20px ${draftColor}66`, fontSize: 16 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>✓</span> Place corner {selCorner + 1}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Unified toolbar ────────────────────── */}
      {/*
        On mobile: constrained to screen width minus a small right margin so the
        zoom slider (right:12px, width ~36px) doesn't overlap. We cap at calc(100vw - 56px).
        On desktop: max-width 380px keeps the original appearance.
      */}
      <div
        className="absolute top-3 left-3 flex flex-col gap-2 p-2.5 rounded-xl"
        style={{
          zIndex: 10,
          background: 'rgba(6,16,10,0.92)',
          border: '1px solid rgba(58,104,48,0.5)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          maxWidth: 'min(380px, calc(100vw - 60px))',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Search row */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="flex gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); setSearchResult(''); }}
            placeholder="Town or -33.9, 18.4"
            className="flex-1 text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none min-w-0"
            style={{
              background: 'rgba(22,37,20,0.8)',
              border: `1px solid ${searchError ? 'rgba(212,110,66,0.7)' : 'rgba(58,104,48,0.6)'}`,
              color: 'var(--text-primary)',
              fontSize: 16,
            }}
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex-shrink-0"
            style={{
              background: searching ? 'rgba(22,37,20,0.6)' : 'rgba(72,168,100,0.25)',
              border: '1px solid rgba(72,168,100,0.5)',
              color: searching ? 'var(--text-muted)' : 'var(--emerald-bright)',
              minHeight: 36,
              minWidth: 44,
            }}
          >
            {searching ? '⟳' : '↵'}
          </button>
        </form>
        {searchError && <p className="text-xs font-mono" style={{ color: 'var(--orange)', marginTop: -4 }}>{searchError}</p>}
        {searchResult && <p className="text-xs font-mono truncate" style={{ color: 'var(--teal)', marginTop: -4 }}>↳ {searchResult}</p>}

        {/* Map style row — wraps on narrow screens */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(140,192,100,0.45)', marginBottom: 5 }}>
            Map view
          </div>
          <div className="flex gap-1.5 flex-wrap">
          {(['satellite-streets-v12', 'outdoors-v12'] as const).map((s, i) => (
            <button key={s} onClick={() => setStyle(s)}
              className="py-1 px-2 rounded-lg text-xs font-mono font-medium transition-all"
              style={{
                ...(style === s
                  ? { background: 'rgba(72,168,100,0.22)', border: '1px solid rgba(72,168,100,0.55)', color: 'var(--emerald-bright)' }
                  : { background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.3)', color: 'var(--text-muted)' }),
                minHeight: 32,
              }}>
              {['🛰 Sat', '⛰ Topo'][i]}
            </button>
          ))}
          <button onClick={() => setHdImagery(!hdImagery)}
            title="Switch to Esri high-res imagery — often sharper than the default when zoomed in"
            className="py-1 px-2 rounded-lg text-xs font-mono font-medium transition-all"
            style={{
              ...(hdImagery
                ? { background: 'rgba(91,158,212,0.22)', border: '1px solid rgba(91,158,212,0.55)', color: 'var(--blue)' }
                : { background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.3)', color: 'var(--text-muted)' }),
              minHeight: 32,
            }}>
            ✦ HD
          </button>
          <button onClick={() => setContours(!contours)}
            className="py-1 px-2 rounded-lg text-xs font-mono transition-all"
            style={{
              ...(contours
                ? { background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(72,168,100,0.5)', color: 'var(--text-secondary)' }
                : { background: 'rgba(22,37,20,0.3)', border: '1px solid rgba(58,104,48,0.25)', color: 'var(--text-muted)' }),
              minHeight: 32,
            }}>
            ~ Ctr
          </button>
          <button
            onClick={() => {
              const next = !terrain3d;
              setTerrain3d(next);
              if (!next) mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 400 });
            }}
            title={terrain3d ? '3D terrain on — switch off for closer top-down zoom' : '3D terrain off (flat)'}
            className="py-1 px-2 rounded-lg text-xs font-mono transition-all"
            style={{
              ...(terrain3d
                ? { background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(72,168,100,0.5)', color: 'var(--text-secondary)' }
                : { background: 'rgba(22,37,20,0.3)', border: '1px solid rgba(58,104,48,0.25)', color: 'var(--text-muted)' }),
              minHeight: 32,
            }}>
            ⛰ 3D
          </button>
          </div>
        </div>

        {/* thin separator */}
        <div style={{ height: 1, background: 'rgba(58,104,48,0.3)' }} />

        {/* Actions row — always wraps */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(140,192,100,0.45)', marginBottom: 5 }}>
            Tools
          </div>
          <div className="flex gap-1.5 flex-wrap">
          {/* My location */}
          <button onClick={goToMyLocation} disabled={locating}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
            style={{
              background: 'rgba(77,173,160,0.18)', border: '1px solid rgba(77,173,160,0.5)',
              color: locating ? 'var(--text-muted)' : 'var(--teal)',
              minHeight: 32,
            }}>
            {locating ? <span className="animate-spin inline-block">⟳</span> : '📍'} Locate
          </button>

          {/* Drawing in progress */}
          {activeDraw && (
            <>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono"
                style={activeDraw === 'water'
                  ? { background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.55)', color: 'var(--blue)', minHeight: 32 }
                  : { background: 'rgba(72,168,100,0.18)', border: '1px solid rgba(72,168,100,0.55)', color: 'var(--emerald-bright)', minHeight: 32 }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: activeDraw === 'water' ? 'var(--blue)' : 'var(--emerald-bright)' }} />
                {activeDraw === 'water' ? '💧' : '✏'} click points · dbl-click to finish · Esc to cancel
              </div>
              <button onClick={cancelDraw}
                className="px-2 py-1 rounded-lg text-xs font-mono transition-all"
                style={{ background: 'rgba(212,110,66,0.15)', border: '1px solid rgba(212,110,66,0.4)', color: 'var(--orange)', minHeight: 32 }}>
                ✗ Cancel
              </button>
            </>
          )}

          {/* Vertex editing */}
          {editingFeatureId && !activeDraw && (
            <>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-display"
                style={{ background: 'rgba(212,168,83,0.18)', border: '1px solid rgba(212,168,83,0.55)', color: 'var(--gold)', minHeight: 32 }}>
                ↔ Drag a big dot to move a corner · drag a faint mid-dot to add one · pinch to zoom in for accuracy
              </div>
              <button onClick={() => requestDelete(editingFeatureId)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={pendingDelete === editingFeatureId
                  ? { background: 'rgba(212,110,66,0.9)', border: '1px solid rgba(212,110,66,0.7)', color: '#fff', minHeight: 32 }
                  : { background: 'rgba(212,110,66,0.16)', border: '1px solid rgba(212,110,66,0.5)', color: 'var(--orange)', minHeight: 32 }}>
                {pendingDelete === editingFeatureId ? '🗑 Tap again to delete' : '🗑 Delete shape'}
              </button>
              <button onClick={finishEditing}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: 'rgba(72,168,100,0.9)', border: '1px solid rgba(72,168,100,0.6)', color: '#06160a', minHeight: 32 }}>
                ✓ Done
              </button>
            </>
          )}

          {/* ── Site / Land parcel section ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && (
            <>
              {siteStats ? (
                <div className="w-full flex flex-col gap-1">
                  {/* Totals summary row */}
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono"
                    style={{ background: 'rgba(72,168,100,0.18)', border: '1px solid rgba(72,168,100,0.45)', color: 'var(--text-secondary)', minHeight: 32 }}>
                    <span style={{ color: 'var(--emerald-bright)' }}>
                      ⬟ {(siteStats.count ?? 1) > 1 ? `${siteStats.count} parcels · ` : ''}{siteStats.areaHa} ha
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      ({siteStats.areaM2.toLocaleString()} m²)
                    </span>
                    <span>·</span>
                    <span>{siteStats.perimeterM}m perimeter</span>
                    {/* ＋ Add another land parcel */}
                    <button
                      onClick={() => startPinDraw('site')}
                      className="ml-auto font-bold"
                      style={{ color: 'var(--emerald-bright)', fontSize: 14 }}
                      title="Draw another land parcel"
                    >＋</button>
                    {/* Clear all site polygons */}
                    <button
                      onClick={() => clearType('site')}
                      style={{ color: 'var(--text-muted)' }}
                      title="Clear all land parcels"
                    >✕</button>
                  </div>
                  {/* Per-parcel rows — edit or delete each one */}
                  {siteFeatures.map((sf, idx) => (
                    <div key={sf.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-display"
                      style={{ background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.25)', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--emerald-bright)' }}>Parcel {idx + 1}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{sf.areaHa} ha</span>
                      <button onClick={() => startReticleEdit(sf.id, 'site')}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md font-semibold"
                        style={{ background: 'rgba(212,168,83,0.16)', border: '1px solid rgba(212,168,83,0.4)', color: 'var(--gold)' }}
                        title="Edit this parcel's corners">✎ Edit</button>
                      <button onClick={() => requestDelete(sf.id)}
                        className="flex items-center px-2 py-1 rounded-md font-semibold"
                        style={pendingDelete === sf.id
                          ? { background: 'rgba(212,110,66,0.9)', border: '1px solid rgba(212,110,66,0.7)', color: '#fff' }
                          : { background: 'rgba(212,110,66,0.14)', border: '1px solid rgba(212,110,66,0.4)', color: 'var(--orange)' }}
                        title="Delete this parcel">{pendingDelete === sf.id ? 'Sure?' : '🗑'}</button>
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={() => startPinDraw('site')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
                  style={{ background: 'rgba(212,168,83,0.18)', border: '1px solid rgba(212,168,83,0.5)', color: 'var(--gold)', minHeight: 32 }}>
                  ✏ Boundary
                </button>
              )}
            </>
          )}

          {/* ── Water storage section ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && (waterStats ? (
            <div className="w-full flex flex-col gap-1">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono"
                style={{ background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.45)', color: 'var(--text-secondary)', minHeight: 32 }}>
                <span style={{ color: 'var(--blue)' }}>
                  💧 {waterStats.count} store{waterStats.count !== 1 ? 's' : ''} · ~{waterStats.estVolumeKL.toLocaleString()} kL
                </span>
                <button onClick={() => startPinDraw('water')} className="ml-auto font-bold" style={{ color: 'var(--blue)', fontSize: 14 }} title="Add another water store">＋</button>
                <button onClick={() => clearType('water')} style={{ color: 'var(--text-muted)' }} title="Clear all water stores">✕</button>
              </div>
              {/* Per-store rows — edit or delete each one */}
              {waterFeatures.map((wf, idx) => (
                <div key={wf.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-display"
                  style={{ background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.25)', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--blue)' }}>Store {idx + 1}</span>
                  <span style={{ color: 'var(--text-muted)' }}>~{wf.estVolumeKL.toLocaleString()} kL</span>
                  <button onClick={() => startReticleEdit(wf.id, 'water')}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md font-semibold"
                    style={{ background: 'rgba(212,168,83,0.16)', border: '1px solid rgba(212,168,83,0.4)', color: 'var(--gold)' }}
                    title="Edit this store's corners">✎ Edit</button>
                  <button onClick={() => requestDelete(wf.id)}
                    className="flex items-center px-2 py-1 rounded-md font-semibold"
                    style={pendingDelete === wf.id
                      ? { background: 'rgba(212,110,66,0.9)', border: '1px solid rgba(212,110,66,0.7)', color: '#fff' }
                      : { background: 'rgba(212,110,66,0.14)', border: '1px solid rgba(212,110,66,0.4)', color: 'var(--orange)' }}
                    title="Delete this store">{pendingDelete === wf.id ? 'Sure?' : '🗑'}</button>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => startPinDraw('water')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
              style={{ background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.5)', color: 'var(--blue)', minHeight: 32 }}>
              💧 Water
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
              style={{ background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.5)', color: 'var(--blue)', minHeight: 32 }}>
              📸 AI
            </button>
          )}
          </div>
        </div>

        {/* Elevation readout */}
        {hoverElevation !== null && (
          <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(58,104,48,0.3)' }}>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>▲ elev</span>
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--emerald-bright)' }}>
              {hoverElevation}m
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>asl</span>
          </div>
        )}
      </div>

      {/* ── Zoom control — big +/− buttons + a non-interactive fill bar.
           (A rotated range input is undraggable on touch, the device farmers use.) ── */}
      <div
        className="absolute flex flex-col items-center gap-2 select-none"
        style={{
          right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(6,16,10,0.92)', border: '1px solid rgba(58,104,48,0.5)',
          borderRadius: 16, padding: '10px 7px', boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          zIndex: 5,
        }}
      >
        <button
          onClick={() => mapRef.current?.zoomTo(Math.min(MAX_ZOOM, zoom + 1), { duration: 300 })}
          className="rounded-lg flex items-center justify-center font-mono leading-none transition-all active:scale-90"
          style={{ width: 40, height: 40, fontSize: 22, background: 'rgba(22,37,20,0.7)', border: '1px solid rgba(58,104,48,0.5)', color: 'var(--emerald-bright)' }}
          title="Zoom in" aria-label="Zoom in"
        >+</button>

        {/* Vertical fill bar — shows current zoom, not draggable */}
        <div className="relative rounded-full overflow-hidden" style={{ width: 5, height: 90, background: 'rgba(22,37,20,0.8)' }}>
          <div className="absolute left-0 right-0 bottom-0 rounded-full" style={{
            height: `${Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100)}%`,
            background: '#5DCF80',
          }} />
        </div>

        <button
          onClick={() => mapRef.current?.zoomTo(Math.max(MIN_ZOOM, zoom - 1), { duration: 300 })}
          className="rounded-lg flex items-center justify-center font-mono leading-none transition-all active:scale-90"
          style={{ width: 40, height: 40, fontSize: 22, background: 'rgba(22,37,20,0.7)', border: '1px solid rgba(58,104,48,0.5)', color: 'var(--emerald-bright)' }}
          title="Zoom out" aria-label="Zoom out"
        >−</button>

        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
          z{zoom.toFixed(1)}
        </span>
      </div>

      {/* ── First-tap / click hint ──────────────── */}
      {!selectedLocation && !activeDraw && !pinDraw && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            zIndex: 15,
            bottom: 72,
            background: 'rgba(6,16,10,0.82)',
            border: '1px solid rgba(72,168,100,0.3)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
              style={{ background: 'var(--emerald-bright)' }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--emerald-bright)' }} />
          </span>
          <span className="text-xs font-display font-medium" style={{ color: 'var(--emerald-bright)' }}>
            Tap your area or search a town
          </span>
        </div>
      )}
    </div>
  );
}
