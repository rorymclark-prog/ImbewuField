'use client';

import { useRef, useState, useCallback, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import ReactMapGL, {
  Source, Layer, Marker, Popup, ScaleControl,
  type MapRef, type MapMouseEvent, type LayerProps,
} from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import turfArea from '@turf/area';
import turfLength from '@turf/length';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { SiteData, WaterData, LocationData } from '@/lib/types';
import { loadPlaces, savePlace, deletePlace, updatePlacePosition, generateId, PLACE_LABELS, placeColor, resolveColor, type SavedPlace, type PlaceLabel } from '@/lib/saved-places';
import { loadWaterPoints, saveWaterPoint, deleteWaterPoint, generateWaterPointId, WATER_POINT_CATEGORIES, categoryColor, type WaterPoint } from '@/lib/water-points';
import { loadSiteElements, saveSiteElement, deleteSiteElement, getElementMeta, ELEMENT_TYPES, reconcileSiteElements, subscribeSiteElementsLive, type SiteElement, type SiteElementType } from '@/lib/site-elements';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import { DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { buildDesignOverlay, type DesignOverlay } from '@/lib/design-overlay';
import { MapPin, Trash2, Loader2, ChevronUp, ChevronDown, ChevronRight, Layers, AlertTriangle, LocateFixed, PenLine, Droplets, Bookmark, Check, X, Search, CornerDownLeft, Mountain, Box, Hand, Home, Sprout, PenTool, Plus, Minus, HelpCircle, Undo2, Pipette, Share2, Move, Square, Grid, Printer } from 'lucide-react';
import { saveSharedSite, loadSharedSite } from '@/lib/site-share';
import SpeakButton from './SpeakButton';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { getFirebase } from '@/lib/firebase/init';
import { subscribeUserMapData, pushShapes } from '@/lib/user-sync';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Drawn parcels + water are persisted here so a refresh never loses the farmer's
// work (was the #1 complaint — "20 minutes of drawing gone on refresh").
const FARM_KEY = 'imbewu_farm_shapes';

// Per-parcel colour palette — each new parcel gets the next entry, cycling if > 6.
// Even-index entries hatch at 45°, odd at 135° so adjacent parcels are always distinct.
const ROLE_COLOR: Record<string, string> = {
  farmer: '#1F4D2B', mentor: '#235E86', student: '#C07A1E',
  ngo: '#6B35A0', funder: '#B83A18', admin: '#5C5040',
};

export interface PeopleMarker {
  id: string;
  lat: number;
  lon: number;
  name: string;
  role: string;
  photoUrl?: string | null;
}

const LAND_PALETTE = [
  { r:  46, g: 107, b:  58, a: 200, edge: '#9BE66B' },  // 0 bright green   45°
  { r: 160, g: 116, b:  36, a: 200, edge: '#D4A830' },  // 1 amber/ochre    135°
  { r: 130, g:  65, b:  30, a: 200, edge: '#C07838' },  // 2 sienna/brown    45°
  { r:  72, g: 136, b:  72, a: 200, edge: '#6CC86C' },  // 3 sage green     135°
  { r: 130, g: 172, b:  40, a: 200, edge: '#A8D820' },  // 4 lime            45°
  { r:  90, g:  58, b: 138, a: 200, edge: '#9870D4' },  // 5 lavender       135°
] as const;
const WATER_PALETTE = [
  { r:  35, g:  94, b: 134, a: 220, edge: '#5BB4EC' },  // 0 sky blue        45°
  { r:  28, g: 136, b: 126, a: 220, edge: '#38B8AC' },  // 1 teal           135°
  { r:  40, g:  76, b: 174, a: 220, edge: '#5090E0' },  // 2 deep blue       45°
] as const;
// Helper: hatch angle alternates by index (even = 45°, odd = 135°)
function hatchOn(x: number, y: number, sz: number, idx: number): boolean {
  return idx % 2 === 0 ? (x + y) % sz < 2 : (sz + x - y) % sz < 2;
}

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

// ── Fine (5m minor / 25m major) contours — server-generated geojson isolines from
// /api/contours, swapped in above FINE_CONTOUR_MIN_ZOOM in place of the fixed-10m
// Mapbox vector tileset above. Same styling, no `source-layer` (geojson sources don't
// have one) and reading from the 'contours-fine' source instead of 'contours'.
const FINE_CONTOUR_MIN_ZOOM = 15;
const contourFineMinor: LayerProps = {
  id: 'contour-fine-minor', type: 'line', source: 'contours-fine',
  filter: ['==', ['get', 'index'], 0],
  paint: {
    'line-color': '#7aaa50',
    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 15, 1.2],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.6, 15, 0.85],
  },
};
const contourFineMajor: LayerProps = {
  id: 'contour-fine-major', type: 'line', source: 'contours-fine',
  filter: ['==', ['get', 'index'], 1],
  paint: {
    'line-color': '#b8d470',
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 15, 2],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 10, 0.7, 15, 1],
  },
};
const contourFineLabel: LayerProps = {
  id: 'contour-fine-label', type: 'symbol', source: 'contours-fine',
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
const contourFineLabelMinor: LayerProps = {
  id: 'contour-fine-label-minor', type: 'symbol', source: 'contours-fine',
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

// ── Design-on-map overlay layers (read-only). Data-driven colours/widths come from each
// feature's properties (see lib/design-overlay.ts). Split by geometry type + a `dashed`
// flag because Mapbox line-dasharray isn't data-driven per feature. ──
const designFillLayer: LayerProps = {
  id: 'design-fill', type: 'fill',
  filter: ['==', ['geometry-type'], 'Polygon'],
  paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': 0.28 },
};
const designOutlineLayer: LayerProps = {
  id: 'design-outline', type: 'line',
  filter: ['==', ['geometry-type'], 'Polygon'],
  layout: { 'line-join': 'round' },
  paint: { 'line-color': ['get', 'stroke'], 'line-width': 2, 'line-opacity': 0.9 },
};
const designLineSolidLayer: LayerProps = {
  id: 'design-line-solid', type: 'line',
  filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'dashed'], true]],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': ['get', 'stroke'], 'line-width': ['get', 'width'], 'line-opacity': 0.95 },
};
const designLineDashedLayer: LayerProps = {
  id: 'design-line-dashed', type: 'line',
  filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'dashed'], true]],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': ['get', 'stroke'], 'line-width': ['get', 'width'], 'line-opacity': 0.95, 'line-dasharray': [2, 2] },
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
  onPlaceSelect?: (info: { name: string; id: string } | null) => void;
  people?: PeopleMarker[];
  showPeople?: boolean;
  onTogglePeople?: () => void;
  // Design-on-map overlay (read-only): when true, the current site's saved Design Studio
  // design is drawn over the satellite. onDesignPresenceChange reports whether a design
  // exists for this site so the parent can enable/disable its "Design" toggle.
  showDesign?: boolean;
  onDesignPresenceChange?: (present: boolean) => void;
  // Guided pin mode (onboarding): show a single instruction bar telling a novice to search
  // their town or tap their home, in place of the "Find your land" pill. Self-retires the
  // instant a pin exists (parent passes `guided && !selected`).
  guided?: boolean;
}

// Placement-time prompt vocabularies for the site element sheet — common
// JoJo tank sizes (SA market) and common SA fruit tree species. "Banana
// (single plant)" is kept distinct from a guild-planting banana circle
// concept (that's a FacilitatorCanvas-only element) — this just names the
// species at a single 🌳 tree marker.
const TANK_SIZE_OPTIONS_L = [750, 1000, 2500, 5000, 10000];
const TREE_SPECIES_OPTIONS = ['Mango', 'Avocado', 'Lemon', 'Orange', 'Guava', 'Banana (single plant)', 'Mulberry', 'Pawpaw', 'Peach'];

export default function PermaMap({ onLocationSelect, selectedLocation, loading, onMapCapture, onSiteDrawn, onWaterDrawn, onCaptureClick, jumpTo, onJumpComplete, onDrawingChange, locationData, onPlaceSelect, people, showPeople, onTogglePeople, showDesign, onDesignPresenceChange, guided }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [style, setStyle] = useState<'satellite-streets-v12' | 'outdoors-v12'>('satellite-streets-v12');
  // Default to Mapbox satellite — consistent coverage everywhere. Esri ("HD") is sharper
  // in some rural spots but has DATA GAPS that render an opaque "Map data not yet available"
  // grey tile, so it's opt-in via the HD toggle, not the default.
  const [hdImagery, setHdImagery] = useState(false);
  const [contours, setContours] = useState(true);
  // Fine (5m) contour geojson fetched from /api/contours once zoomed past FINE_CONTOUR_MIN_ZOOM.
  // null = not loaded yet / fetch failed → render falls back to the fixed-10m vector 'contours' source.
  const [fineContours, setFineContours] = useState<GeoJSON.FeatureCollection | null>(null);
  const fineContourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [activePin, setActivePin] = useState<string | null>(null);
  const [movingPin, setMovingPin] = useState<string | null>(null);
  const [customPlaceColor, setCustomPlaceColor] = useState('');
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([]);
  const [waterPointNaming, setWaterPointNaming] = useState<WaterPoint | null>(null);
  const [wpName, setWpName] = useState('');
  const [wpCategory, setWpCategory] = useState('');
  const [droppingWaterPoint, setDroppingWaterPoint] = useState(false);
  // ── Site Elements palette: same reticle-drop UX as water points, one marker per tap ──
  const [siteElements, setSiteElements] = useState<SiteElement[]>([]);
  const [droppingElement, setDroppingElement] = useState<SiteElementType | null>(null); // armed type, reticle-drop active
  const [elementEditing, setElementEditing] = useState<SiteElement | null>(null); // element open in the rename/note sheet
  const [elName, setElName] = useState('');
  const [elNote, setElNote] = useState('');
  // Structured fields — capacity for jojo_tank, species+count for tree. Seeded
  // from the element whenever the sheet opens (see the two setElementEditing
  // call sites below), same pattern as elName/elNote.
  const [elLitres, setElLitres] = useState<number | undefined>(undefined);
  const [elSpecies, setElSpecies] = useState('');
  const [elCount, setElCount] = useState(1);
  const [elTankCustomOpen, setElTankCustomOpen] = useState(false);
  const [elTreeCustomOpen, setElTreeCustomOpen] = useState(false);
  const [pendingDeleteElement, setPendingDeleteElement] = useState<string | null>(null);
  const pendingElementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareState, setShareState] = useState<'idle'|'saving'|'copied'|'error'>('idle');
  const [placesOpen, setPlacesOpen] = useState(false);
  const [sectionParcels, setSectionParcels] = useState(false);
  const [sectionWater, setSectionWater] = useState(false);
  const [sectionElements, setSectionElements] = useState(false);
  const [showShapeLabels, setShowShapeLabels] = useState(false);
  const [showPlaceLabels, setShowPlaceLabels] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);  // all drawn polygon boundaries + hatching
  const [showHatch, setShowHatch] = useState(true);         // hatch fill pattern only
  const [toolbarMin, setToolbarMin] = useState(true);  // start collapsed so the map is clear on arrival; tap "☰ Tools" to open
  // ── Reticle EDIT: edit an existing shape with the SAME "move the map under the
  // crosshair" motion used for drawing — no tiny dot-dragging. Tap a corner to lift it
  // onto the crosshair, move the map, tap Place to drop it. ──
  const [editPin, setEditPin] = useState<null | { id: string; type: 'site' | 'water' }>(null);
  const [editPoints, setEditPoints] = useState<[number, number][]>([]); // working ring (open — no closing dup)
  const [selCorner, setSelCorner] = useState<number | null>(null);      // index currently lifted onto the crosshair
  const editOriginal = useRef<[number, number][] | null>(null);          // snapshot for Cancel
  const editNameRef = useRef<{ name?: string; category?: string; hatchIdx?: number; placeId?: string; siteId?: string } | null>(null); // snapshot across edit
  const nativeEditBackupRef = useRef<GeoJSON.Feature | null>(null);      // snapshot for native-edit Undo

  // Saved-place pins: load + keep in sync with the Places tab
  useEffect(() => {
    const refresh = () => setSavedPins(loadPlaces());
    refresh();
    window.addEventListener('permamap-places-changed', refresh);
    return () => window.removeEventListener('permamap-places-changed', refresh);
  }, []);

  // Water infrastructure points: load + keep in sync
  useEffect(() => {
    const refresh = () => setWaterPoints(loadWaterPoints());
    refresh();
    window.addEventListener('imbewu-water-points-changed', refresh);
    return () => window.removeEventListener('imbewu-water-points-changed', refresh);
  }, []);

  // Site elements (JoJo tanks, taps, beehives, etc): load + keep in sync, keyed per site
  const siteIdForElements = useMemo(() => designSiteIdFromLocation(locationData ?? null), [locationData]);
  useEffect(() => {
    const refresh = () => setSiteElements(loadSiteElements(siteIdForElements));
    refresh();
    window.addEventListener('imbewu-site-elements-changed', refresh);
    return () => window.removeEventListener('imbewu-site-elements-changed', refresh);
  }, [siteIdForElements]);

  // Cross-device sync for site elements. site-elements.ts used to be push-only (no pull
  // path), so a JoJo tank/beehive added on one device never reached another. Reconcile
  // local+remote once per (user, site) then subscribe for realtime remote writes; both
  // fire 'imbewu-site-elements-changed', which the loader effect above already listens
  // for → the element appears without a reload. Keyed on siteId too: the Firestore doc
  // is per-site (site_elements_{siteId}), so switching sites must re-reconcile/re-subscribe.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    reconcileSiteElements(uid, siteIdForElements).catch(() => {});
    const unsub = subscribeSiteElementsLive(uid, siteIdForElements);
    return () => unsub();
  }, [user?.uid, siteIdForElements]);

  // The draw.create handler is registered once inside ensureDraw (which only ever runs
  // once per map instance), so it can't close over siteIdForElements directly — that
  // value would go stale the first time the farmer switches sites without a reload.
  // This ref is the one source of truth the handler reads at tag time.
  const activeSiteIdRef = useRef(siteIdForElements);
  useEffect(() => { activeSiteIdRef.current = siteIdForElements; }, [siteIdForElements]);

  // ── Design-on-map overlay (read-only) ──────────────────────────────────────────
  // The current site's saved Design Studio design, projected onto the live map. Keyed per
  // site (same siteId as site elements) and refreshed on the same change event the Studio
  // dispatches, so a design edited in the Studio shows up here without a reload. null when
  // this site has no saved design — the parent uses that to disable its Design toggle.
  const [designOverlay, setDesignOverlay] = useState<DesignOverlay | null>(null);
  useEffect(() => {
    const refresh = () => setDesignOverlay(buildDesignOverlay(siteIdForElements));
    refresh();
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [siteIdForElements]);

  const designPresent = !!designOverlay;
  useEffect(() => { onDesignPresenceChange?.(designPresent); }, [designPresent, onDesignPresenceChange]);

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
    setCustomPlaceColor(p.color ?? '');
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
      color: customPlaceColor || undefined,
      savedAt: existing?.savedAt ?? new Date().toISOString(),
    });
    setSavedPins(loadPlaces());
    setEditingPlaceId(null);
    setNamingPlace(null);
    if (!existingId) { setPlaceSaved(true); setTimeout(() => setPlaceSaved(false), 2500); }
  }, [namingPlace, placeName, placeLabel, customPlaceColor, locationData, editingPlaceId, savedPins]);

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
    // applyingRemoteRef: true while we paint a Firestore-sourced shape onto the map.
    // Skip persist+push then, or we'd echo the remote write straight back and loop.
    if (!tearingDownRef.current && restoredRef.current && !applyingRemoteRef.current) {
      try { localStorage.setItem(FARM_KEY, JSON.stringify(all)); } catch { /* quota / private mode */ }
      // Push only after the initial reconcile, so a local draw can't clobber the merge.
      const uid = getFirebase()?.auth?.currentUser?.uid;
      if (uid && mergeReadyRef.current) pushShapes(uid, all).catch(() => {});
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

    // Generate 8×8 diagonal hatch sprites — one per palette entry, alternating 45°/135°.
    // Must be added before map.addControl so fill-pattern references are valid when layers attach.
    if (!map.hasImage('imbewu-hatch-land-0')) {
      const mkSprite = (r: number, g: number, b: number, a: number, idx: number) => {
        const sz = 8; const d = new Uint8ClampedArray(sz * sz * 4);
        for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
          const on = hatchOn(x, y, sz, idx); const i = (y * sz + x) * 4;
          d[i] = on ? r : 0; d[i+1] = on ? g : 0; d[i+2] = on ? b : 0; d[i+3] = on ? a : 0;
        }
        return { width: sz, height: sz, data: d };
      };
      LAND_PALETTE.forEach((p, i) => map.addImage(`imbewu-hatch-land-${i}`,  mkSprite(p.r, p.g, p.b, p.a, i)));
      WATER_PALETTE.forEach((p, i) => map.addImage(`imbewu-hatch-water-${i}`, mkSprite(p.r, p.g, p.b, p.a, i)));
    }

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
      // Polygon style: dark casing + diagonal hatch fill + bright edge + white vertex handles.
      // Layers render in array order (first = bottom). Land/water split so blue always paints
      // on top of green where a water feature overlaps a land parcel.
      styles: [
        // Dark casing — thick under-stroke that survives on any satellite background colour
        { id: 'gl-draw-poly-casing-land',  type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'user_featureType', 'water']], layout: { 'line-join': 'round' }, paint: { 'line-color': '#0d1f12', 'line-width': 9 } },
        { id: 'gl-draw-poly-casing-water', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'user_featureType', 'water']], layout: { 'line-join': 'round' }, paint: { 'line-color': '#071422', 'line-width': 9 } },
        // Diagonal hatch fill — colour + angle varies per feature via hatchIdx user property.
        // fill-color: transparent is required; without it Mapbox applies a default black fill behind the pattern
        { id: 'gl-draw-poly-fill-land', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'user_featureType', 'water']],
          paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-pattern': ['match', ['%', ['number', ['get', 'user_hatchIdx'], 0], LAND_PALETTE.length],
            0, 'imbewu-hatch-land-0', 1, 'imbewu-hatch-land-1', 2, 'imbewu-hatch-land-2',
            3, 'imbewu-hatch-land-3', 4, 'imbewu-hatch-land-4', 'imbewu-hatch-land-5'] } as object },
        { id: 'gl-draw-poly-fill-water', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'user_featureType', 'water']],
          paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-pattern': ['match', ['%', ['number', ['get', 'user_hatchIdx'], 0], WATER_PALETTE.length],
            0, 'imbewu-hatch-water-0', 1, 'imbewu-hatch-water-1', 'imbewu-hatch-water-2'] } as object },
        // Bright edge — colour matches the hatch palette entry for that feature
        { id: 'gl-draw-poly-stroke-land', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'user_featureType', 'water']],
          layout: { 'line-join': 'round' }, paint: { 'line-width': 3.5,
            'line-color': ['match', ['%', ['number', ['get', 'user_hatchIdx'], 0], LAND_PALETTE.length],
              0, '#9BE66B', 1, '#D4A830', 2, '#C07838', 3, '#6CC86C', 4, '#A8D820', '#9870D4'] } },
        { id: 'gl-draw-poly-stroke-water', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'user_featureType', 'water']],
          layout: { 'line-join': 'round' }, paint: { 'line-width': 3.5,
            'line-color': ['match', ['%', ['number', ['get', 'user_hatchIdx'], 0], WATER_PALETTE.length],
              0, '#5BB4EC', 1, '#38B8AC', '#5090E0'] } },
        // In-progress line while adding corners
        { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': '#9BE66B', 'line-width': 2.5 } },
        // Vertex handles — white dots with dark-green stroke (larger on touch devices)
        { id: 'gl-draw-point',          type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],   paint: { 'circle-radius': vtxRadius, 'circle-color': '#fff', 'circle-stroke-color': '#2E6B3A', 'circle-stroke-width': 2.5 } },
        { id: 'gl-draw-point-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': midRadius, 'circle-color': '#fff', 'circle-stroke-color': '#2E6B3A', 'circle-stroke-width': 2,   'circle-opacity': 0.85 } },
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
          const fid = String(f.id);
          draw.setFeatureProperty(fid, 'featureType', type);
          // Assign the next palette slot based on how many features of this type already exist
          const existingCount = draw.getAll().features.filter((feat: GeoJSON.Feature) =>
            (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon') &&
            (type === 'water' ? feat.properties?.featureType === 'water' : feat.properties?.featureType !== 'water') &&
            feat.id !== f.id
          ).length;
          draw.setFeatureProperty(fid, 'hatchIdx', existingCount);
          draw.setFeatureProperty(fid, 'siteId', activeSiteIdRef.current);
          createdId = fid;
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
          // Don't activate native editing while a custom reticle edit is active — a stray
          // tap on a background polygon while dragging a corner would otherwise switch to
          // native direct_select and show midpoint dots that look like new corners.
          if (editPinRef.current) return;
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
  // True while painting a Firestore-sourced shape onto the map — suppresses the
  // persist+push inside recompute so a remote change doesn't echo back into a loop.
  const applyingRemoteRef = useRef(false);
  // Flips true once the initial local↔remote reconcile finishes — gates shape pushes
  // so a local draw during the reconcile window can't clobber the merged result.
  const mergeReadyRef = useRef(false);
  // Set when a live remote shape update arrives while the user is mid-edit; flushed when
  // they finish so we don't yank a feature out from under an in-progress vertex drag.
  const pendingRemoteRedrawRef = useRef(false);
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

  // Force the drawn shapes to match localStorage RIGHT NOW (used when a live Firestore
  // update arrives from another browser). Unlike restoreShapes this isn't one-shot.
  // draw.set() does NOT fire draw.* events, so the applyingRemoteRef guard stays valid
  // for the synchronous recompute() that follows.
  const redrawShapesFromStorage = useCallback(() => {
    const draw = ensureDraw();
    if (!draw) return; // map not ready — the restore poller will pick up localStorage
    // Don't yank the draw store out from under an in-progress edit/draw — defer until done.
    // Includes reticle-draw (pinDraw) and reticle-edit (editPin): those use 'static' mode
    // internally so the native mode check alone would miss them.
    let mode = ''; try { mode = draw.getMode(); } catch {}
    if (mode === 'direct_select' || mode === 'draw_polygon' || editingFeatureId || pinDraw || editPin) {
      pendingRemoteRedrawRef.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(FARM_KEY);
      const fc = raw ? JSON.parse(raw) : null;
      applyingRemoteRef.current = true;
      draw.set(fc?.features ? fc : { type: 'FeatureCollection', features: [] });
      restoredRef.current = true;
      recompute();
    } catch { /* ignore */ }
    finally { applyingRemoteRef.current = false; }
  }, [ensureDraw, recompute, editingFeatureId, pinDraw, editPin]);

  // When the user finishes ALL editing sessions, flush any remote shape update we deferred.
  useEffect(() => {
    if (!editingFeatureId && !pinDraw && !editPin && pendingRemoteRedrawRef.current) {
      pendingRemoteRedrawRef.current = false;
      redrawShapesFromStorage();
    }
  }, [editingFeatureId, pinDraw, editPin, redrawShapesFromStorage]);

  // Stable handle to the latest redraw callback, so the sync subscription can depend on
  // uid alone and not re-subscribe (re-reconcile) every time the callback identity changes.
  const redrawRef = useRef(redrawShapesFromStorage);
  redrawRef.current = redrawShapesFromStorage;

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

  // Fine (5m) contours: debounced fetch to /api/contours for the current viewport, once
  // zoomed past FINE_CONTOUR_MIN_ZOOM (farm-scale). Falls back silently to the fixed-10m
  // Mapbox vector contours (still mounted in JSX below) on any error or while loading —
  // this whole feature is additive/revertible behind the existing `contours` toggle.
  useEffect(() => {
    if (!contours) { setFineContours(null); return; }
    let cancelled = false;
    let attachedMap: mapboxgl.Map | null = null;
    let moveHandler: (() => void) | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const requestFineContours = (map: mapboxgl.Map) => {
      if (fineContourTimer.current) clearTimeout(fineContourTimer.current);
      fineContourTimer.current = setTimeout(async () => {
        if (cancelled) return;
        if (map.getZoom() < FINE_CONTOUR_MIN_ZOOM) { setFineContours(null); return; }
        const b = map.getBounds();
        if (!b) return;
        try {
          const url = `/api/contours?minLon=${b.getWest()}&minLat=${b.getSouth()}&maxLon=${b.getEast()}&maxLat=${b.getNorth()}&interval=5&major=25`;
          const res = await fetch(url);
          if (!res.ok) { if (!cancelled) setFineContours(null); return; }
          const json = await res.json();
          if (!cancelled) setFineContours(json);
        } catch {
          if (!cancelled) setFineContours(null);
        }
      }, 500);
    };

    let tries = 0;
    pollId = setInterval(() => {
      tries += 1;
      const map = mapRef.current?.getMap();
      if (map) {
        attachedMap = map;
        moveHandler = () => requestFineContours(map);
        map.on('moveend', moveHandler);
        requestFineContours(map);
        if (pollId) clearInterval(pollId);
      } else if (tries > 50) {
        if (pollId) clearInterval(pollId);
      }
    }, 200);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (fineContourTimer.current) clearTimeout(fineContourTimer.current);
      if (attachedMap && moveHandler) attachedMap.off('moveend', moveHandler);
    };
  }, [contours]);

  // Live cross-device sync: while signed in, subscribe to the user's Firestore docs.
  // A save in ANY browser pushes here in realtime → localStorage updates → pins, water
  // points and drawn shapes refresh without a reload. Also does a one-time merge of
  // local + remote on connect so existing data from any device is unified.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    mergeReadyRef.current = false;
    const unsub = subscribeUserMapData(uid, {
      onPlaces: () => window.dispatchEvent(new CustomEvent('permamap-places-changed')),
      onWater:  () => window.dispatchEvent(new CustomEvent('imbewu-water-points-changed')),
      onShapes: () => redrawRef.current(),
      onMergeDone: () => {
        mergeReadyRef.current = true;
        // Flush from the reconciled localStorage set, NOT draw.getAll() — a deferred
        // mid-edit redraw means the draw store may still hold un-merged in-memory shapes.
        try {
          const raw = localStorage.getItem(FARM_KEY);
          const fc = raw ? JSON.parse(raw) : null;
          if (fc?.features?.length) pushShapes(uid, fc).catch(() => {});
        } catch { /* ignore */ }
      },
    });
    return () => { mergeReadyRef.current = false; unsub(); };
  }, [user?.uid]);

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

  // The NextStepCoach fires 'imbewu-arm-draw' to send a farmer straight into boundary
  // tracing from the report ("Trace now"). Arming the draw collapses the sheet via the
  // parent's drawing effect, so one tap lands them on the map with the reticle up.
  useEffect(() => {
    const arm = (e: Event) => startPinDraw((e as CustomEvent).detail === 'water' ? 'water' : 'site');
    window.addEventListener('imbewu-arm-draw', arm);
    return () => window.removeEventListener('imbewu-arm-draw', arm);
  }, [startPinDraw]);

  // The shared "+ Add" sheet (spec §2.3) arms a point element (tree/tank/tap) the same way
  // the elements palette does — reticle-drop. Guarded by ELEMENT_TYPES so a bogus detail is
  // a no-op. Opens the tools panel so the reticle drop-bar has its usual chrome around it.
  useEffect(() => {
    const armEl = (e: Event) => {
      const type = (e as CustomEvent).detail as SiteElementType;
      if (ELEMENT_TYPES.includes(type)) { setToolbarMin(false); setDroppingElement(type); }
    };
    window.addEventListener('imbewu-arm-element', armEl);
    return () => window.removeEventListener('imbewu-arm-element', armEl);
  }, []);

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
      const existingCount = draw.getAll().features.filter((feat: GeoJSON.Feature) =>
        (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon') &&
        (type === 'water' ? feat.properties?.featureType === 'water' : feat.properties?.featureType !== 'water') &&
        feat.id !== id
      ).length;
      draw.setFeatureProperty(id, 'hatchIdx', existingCount);
      draw.setFeatureProperty(id, 'siteId', activeSiteIdRef.current);
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
    editNameRef.current = { name: f.properties?.name as string | undefined, category: f.properties?.category as string | undefined, hatchIdx: f.properties?.hatchIdx as number | undefined, placeId: f.properties?.placeId as string | undefined, siteId: f.properties?.siteId as string | undefined };
    try { draw.delete(featureId); } catch {}
    // Lock remaining shapes so tapping them doesn't accidentally activate a different layer
    try { draw.changeMode('static'); } catch {}
    const map = mapRef.current?.getMap();
    if (map) {
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); map.dragPan.disable(); } catch {}
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
    // Prevent the map from receiving move events and panning while we're dragging a corner.
    e.stopPropagation();
    e.preventDefault();
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

  // Insert a new corner adjacent to the selected one (if any), else nearest the crosshair.
  // The new corner is placed at the midpoint of the edge after the selected corner so the
  // user can immediately drag it to the right position.
  const addEditCorner = useCallback(() => {
    setEditPoints((pts) => {
      if (pts.length < 2) {
        const at = crosshairLngLat();
        if (!at) return pts;
        setSelCorner(pts.length);
        return [...pts, at];
      }
      // If a corner is selected, insert on the edge AFTER it (between selCorner and selCorner+1).
      // Snap to the current selCorner value via a ref-safe read inside the updater closure.
      const sel = selCornerRef.current;
      let insertAfter: number;
      let newPt: [number, number];
      if (sel !== null) {
        insertAfter = sel;
        const a = pts[sel];
        const b = pts[(sel + 1) % pts.length];
        newPt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      } else {
        // No selection — fall back to edge nearest the crosshair
        const at = crosshairLngLat();
        if (!at) return pts;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          const d = (mx - at[0]) ** 2 + (my - at[1]) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
        insertAfter = best;
        newPt = at;
      }
      const next = [...pts.slice(0, insertAfter + 1), newPt, ...pts.slice(insertAfter + 1)];
      setSelCorner(insertAfter + 1);
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
      if (snap?.hatchIdx != null) draw.setFeatureProperty(id, 'hatchIdx', snap.hatchIdx);
      if (snap?.placeId) draw.setFeatureProperty(id, 'placeId', snap.placeId); // keep parcel↔place link across edits
      // Preserve the shape's original siteId across edits; a legacy untagged shape gets
      // stamped with the currently active site the moment it's next edited.
      draw.setFeatureProperty(id, 'siteId', snap?.siteId ?? activeSiteIdRef.current);
    }
    editNameRef.current = null;
    setEditPin(null);
    setEditPoints([]);
    setSelCorner(null);
    editOriginal.current = null;
    unlockRotation();
    const mapInst = mapRef.current?.getMap();
    if (mapInst) try { mapInst.dragPan.enable(); draw.changeMode('simple_select'); } catch {}
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
          if (snap?.hatchIdx != null) draw.setFeatureProperty(id, 'hatchIdx', snap.hatchIdx);
          if (snap?.placeId) draw.setFeatureProperty(id, 'placeId', snap.placeId); // keep parcel↔place link across edits
          draw.setFeatureProperty(id, 'siteId', snap?.siteId ?? activeSiteIdRef.current);
        }
      } catch {}
    }
    editNameRef.current = null;
    setEditPin(null);
    setEditPoints([]);
    setSelCorner(null);
    editOriginal.current = null;
    unlockRotation();
    const mapInst2 = mapRef.current?.getMap();
    if (mapInst2 && draw) try { mapInst2.dragPan.enable(); draw.changeMode('simple_select'); } catch {}
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
  // Stable ref so addEditCorner's setEditPoints updater can read the current selCorner
  // without needing it as a dependency (which would recreate the callback every tap).
  const selCornerRef = useRef(selCorner);
  selCornerRef.current = selCorner;
  // Keep cancelPinDraw reachable from the Escape handler so Escape restores draw mode + rotation.
  const cancelPinDrawRef = useRef(cancelPinDraw);
  cancelPinDrawRef.current = cancelPinDraw;

  // Escape key cancels an in-progress draw (fix 2: Escape-to-cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel reticle-edit if active (restores the original shape)
        if (editPinRef.current) cancelEditRef.current();
        // Cancel reticle-draw if active — route through ref so we get changeMode + unlockRotation
        setPinDraw((prev) => { if (prev !== null) cancelPinDrawRef.current(); return prev !== null ? null : prev; });
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

  const handleShare = async () => {
    const draw = drawRef.current
    const mapInst = mapRef.current
    if (!draw || !mapInst) return
    setShareState('saving')
    try {
      const center = mapInst.getCenter()
      const code = await saveSharedSite({
        geojson: draw.getAll() as GeoJSON.FeatureCollection,
        places: loadPlaces(),
        waterPoints: loadWaterPoints(),
        mapCenter: [center.lng, center.lat],
        mapZoom: mapInst.getZoom(),
      })
      const url = `${window.location.origin}/farmer?share=${code}`
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 3000)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 2500)
    }
  }

  const handleSharePlace = async (place: SavedPlace) => {
    const draw = drawRef.current;
    const mapInst = mapRef.current;
    if (!draw || !mapInst) return;
    setPlaceShareId(place.id);
    setPlaceShareStatus('saving');
    try {
      const allFeatures = draw.getAll().features.filter(
        (f) => (f.properties?.placeId === place.id)
      );
      const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: allFeatures };
      const waterPoints = loadWaterPoints().filter(() => true); // include all for now
      const center = mapInst.getCenter();
      const code = await saveSharedSite({
        geojson,
        places: [place],
        waterPoints,
        mapCenter: [center.lng, center.lat],
        mapZoom: mapInst.getZoom(),
        label: place.name,
      });
      const url = `${window.location.origin}/farmer?share=${code}`;
      await navigator.clipboard.writeText(url);
      setPlaceShareStatus('copied');
      setTimeout(() => { setPlaceShareId(null); setPlaceShareStatus('idle'); }, 3000);
    } catch {
      setPlaceShareStatus('error');
      setTimeout(() => { setPlaceShareId(null); setPlaceShareStatus('idle'); }, 2500);
    }
  };

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

  // Sync draw layer visibility with the Shapes (showFeatures) and Hatching (showHatch) toggles.
  // Hide via layout `visibility` (definitive — a hidden layer draws nothing), and CRUCIALLY
  // re-apply on Draw's own `draw.render` event: MapboxDraw re-renders its layers on every
  // store change / mode change and resets their state, which is why earlier paint/filter
  // approaches "didn't work" — nothing was re-applying after Draw's render. We also re-apply
  // on `styledata` (basemap/style switches re-add the draw layers).
  useEffect(() => {
    const rawMap = mapRef.current?.getMap();
    if (!rawMap) return;
    const apply = () => {
      const borders = showFeatures ? 'visible' : 'none';
      const fill = (showFeatures && showHatch) ? 'visible' : 'none';
      try {
        // MapboxDraw renders each style layer into TWO real layers (`<id>.cold` / `<id>.hot`),
        // so getLayer('gl-draw-poly-fill-land') is null — the prior bug that made every toggle
        // attempt a silent no-op. Scan the live style and match by prefix to catch both.
        const layers = rawMap.getStyle()?.layers ?? [];
        for (const layer of layers) {
          const id = layer.id;
          if (!id.startsWith('gl-draw-poly-')) continue;
          rawMap.setLayoutProperty(id, 'visibility', id.includes('poly-fill') ? fill : borders);
        }
      } catch { /* layers not ready yet — draw.render/styledata will retry */ }
    };
    apply();
    rawMap.on('styledata', apply);
    rawMap.on('draw.render', apply);
    return () => { rawMap.off('styledata', apply); rawMap.off('draw.render', apply); };
  }, [showFeatures, showHatch]);

  // Print a clean BASE MAP for the farmer to sketch on by hand: satellite + contours +
  // boundary/house OUTLINES, with the hatch fill removed (the fill makes a busy print).
  // Hatch fill layers are hidden directly for the capture, then restored to the live state.
  const printBaseMap = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const fillIds = (map.getStyle()?.layers ?? [])
      .filter((l) => l.id.startsWith('gl-draw-poly-') && l.id.includes('poly-fill'))
      .map((l) => l.id);
    fillIds.forEach((id) => { try { map.setLayoutProperty(id, 'visibility', 'none'); } catch {} });
    map.once('idle', () => {
      let dataUrl = '';
      try { dataUrl = map.getCanvas().toDataURL('image/png'); } catch {}
      const restore = (showFeatures && showHatch) ? 'visible' : 'none';
      fillIds.forEach((id) => { try { map.setLayoutProperty(id, 'visibility', restore); } catch {} });
      if (!dataUrl) return;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!doctype html><html><head><title>ImbewuField — base map</title>`
        + `<style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}`
        + `body{margin:0;font-family:Georgia,serif;color:#20190f}`
        + `h1{font-size:16px;margin:0 0 4px}.s{font-size:11px;color:#6b5a42;margin:0 0 8px}`
        + `img{width:100%;height:auto;border:1px solid #d8cdb6;border-radius:6px}</style></head>`
        + `<body><h1>Site base map</h1>`
        + `<div class="s">Print and sketch your design by hand — beds, paths, trees, water, compost. Drawn to scale; contours show the slope.</div>`
        + `<img src="${dataUrl}" onload="setTimeout(function(){window.print();},300)"/></body></html>`);
      w.document.close();
    });
    map.triggerRepaint();
  }, [showFeatures, showHatch]);

  // Tell the parent when reticle drawing is active (so it can hide the mobile "Results" FAB).
  // Also broadcast globally so the Lima FAB (rendered in the root layout) can step aside.
  useEffect(() => {
    // Reticle boundary/water draw, ring edit, OR point-element drop — all put a
    // bottom-anchored action bar up, so bottom FABs (Results, + Add) must step aside.
    const active = pinDraw !== null || editPin !== null || droppingElement !== null;
    onDrawingChange?.(active);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-drawing', { detail: active }));
    // On unmount (e.g. navigating away mid-draw), tell the world drawing stopped
    // so the persistent Lima FAB (in the root layout) doesn't stay hidden forever.
    return () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-drawing', { detail: false }));
    };
  }, [pinDraw, editPin, droppingElement, onDrawingChange]);

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

  // Restore a shared site from the ?share=<code> URL param once the map is ready.
  // Uses the same polling approach as restoreShapes — mapRef is safe to read inside effects.
  const shareRestored = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('share');
    if (!code) return;
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const mapInst = mapRef.current?.getMap();
      if (mapInst && (mapInst.isStyleLoaded() || tries >= 5)) {
        clearInterval(iv);
        if (shareRestored.current) return;
        shareRestored.current = true;
        loadSharedSite(code).then((data) => {
          if (!data) return;
          const draw = drawRef.current;
          if (draw) {
            draw.set(data.geojson);
            restoredRef.current = true;
            recompute();
          }
          // Canonical key/event used by lib/saved-places.ts — the old 'imbewu_places' was a
          // dead key, so shared places never loaded.
          localStorage.setItem('permamap_saved_places', JSON.stringify(data.places));
          window.dispatchEvent(new CustomEvent('permamap-places-changed'));
          localStorage.setItem('imbewu_water_points', JSON.stringify(data.waterPoints));
          window.dispatchEvent(new CustomEvent('imbewu-water-points-changed'));
          setSavedPins(loadPlaces());
          mapInst.flyTo({ center: data.mapCenter as [number, number], zoom: data.mapZoom });
          history.replaceState(null, '', window.location.pathname);
        }).catch(() => {/* silent on share-load fail */});
      } else if (tries > 50) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, []);

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
    setActivePin(null);
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
  const getSiteFeatures = useCallback((): Array<{ id: string; areaHa: number; name?: string; category?: string; centroid: [number, number] | null; bbox: [number, number, number, number]; placeId?: string; hatchIdx: number }> => {
    const draw = drawRef.current;
    if (!draw) return [];
    const all = draw.getAll();
    return all.features
      .filter((f: GeoJSON.Feature) =>
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.featureType !== 'water' &&
        f.id != null
      )
      .map((f: GeoJSON.Feature) => {
        const ring = (f.geometry as GeoJSON.Polygon).coordinates?.[0] ?? [];
        const n = ring.length;
        const centroid: [number, number] | null = n > 0
          ? [ring.reduce((s, c) => s + c[0], 0) / n, ring.reduce((s, c) => s + c[1], 0) / n]
          : null;
        const lons = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
        const bbox: [number, number, number, number] = n > 0
          ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
          : [0, 0, 0, 0];
        return {
          id: String(f.id),
          areaHa: Math.round((turfArea(f) / 10000) * 100) / 100,
          name: f.properties?.name as string | undefined,
          category: f.properties?.category as string | undefined,
          centroid, bbox,
          placeId: f.properties?.placeId as string | undefined,
          hatchIdx: (f.properties?.hatchIdx as number) ?? 0,
        };
      });
  }, []);

  // We track siteFeatures as a derived list rebuilt whenever siteStats changes
  const [siteFeatures, setSiteFeatures] = useState<Array<{ id: string; areaHa: number; name?: string; category?: string; centroid: [number, number] | null; bbox: [number, number, number, number]; placeId?: string; hatchIdx: number }>>([]);
  useEffect(() => {
    setSiteFeatures(getSiteFeatures());
  }, [siteStats, getSiteFeatures]);

  // Per-water-store list (id + capacity) so each can be edited/deleted individually
  const getWaterFeatures = useCallback((): Array<{ id: string; estVolumeKL: number; name?: string; category?: string; centroid: [number, number] | null; bbox: [number, number, number, number]; placeId?: string; hatchIdx: number }> => {
    const draw = drawRef.current;
    if (!draw) return [];
    return draw.getAll().features
      .filter((f: GeoJSON.Feature) =>
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.featureType === 'water' && f.id != null)
      .map((f: GeoJSON.Feature) => {
        const ring = (f.geometry as GeoJSON.Polygon).coordinates?.[0] ?? [];
        const n = ring.length;
        const centroid: [number, number] | null = n > 0
          ? [ring.reduce((s, c) => s + c[0], 0) / n, ring.reduce((s, c) => s + c[1], 0) / n]
          : null;
        const lons = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
        const bbox: [number, number, number, number] = n > 0
          ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
          : [0, 0, 0, 0];
        return {
          id: String(f.id), estVolumeKL: Math.round(turfArea(f) * WATER_AVG_DEPTH),
          name: f.properties?.name as string | undefined,
          category: f.properties?.category as string | undefined,
          centroid, bbox,
          placeId: f.properties?.placeId as string | undefined,
          hatchIdx: (f.properties?.hatchIdx as number) ?? 0,
        };
      });
  }, []);
  const [waterFeatures, setWaterFeatures] = useState<Array<{ id: string; estVolumeKL: number; name?: string; category?: string; centroid: [number, number] | null; bbox: [number, number, number, number]; placeId?: string; hatchIdx: number }>>([]);
  useEffect(() => { setWaterFeatures(getWaterFeatures()); }, [waterStats, getWaterFeatures]);

  // Set of place IDs that have at least one drawn feature (site or water)
  const pinsWithFeatures = useMemo(() => new Set([
    ...siteFeatures.flatMap(sf => sf.placeId ? [sf.placeId] : []),
    ...waterFeatures.flatMap(wf => wf.placeId ? [wf.placeId] : []),
  ]), [siteFeatures, waterFeatures]);

  // ── Name & categorise a drawn parcel / water store (opens after drawing, and any
  // time via the row's name). Stored on the feature so it persists + shows in lists. ──
  const SHAPE_CATEGORIES: Record<'site' | 'water', string[]> = {
    site: ['Home plot', 'Vegetable garden', 'Staple crop plot', 'Field', 'Orchard', 'Grazing', 'Other'],
    // 'Dam / pond' was missing — every other water category (Roof/Swale/Contour
    // bank/Road run-off/Earthwork) got silently reclassified as a dam/pond
    // downstream anyway (lib/design-studio.ts's classifyFeature short-circuited
    // ALL water-tool shapes to 'water_body' regardless of category — fixed
    // alongside this), so there was no explicit way to say "this really is one".
    water: ['Dam / pond', 'Roof', 'Swale', 'Contour bank', 'Road run-off', 'Earthwork', 'Other'],
  };
  const [shapeNaming, setShapeNaming] = useState<{ id: string; type: 'site' | 'water' } | null>(null);
  const [shapeName, setShapeName] = useState('');
  const [shapeCategory, setShapeCategory] = useState('');
  const [shapeNamePlaceId, setShapeNamePlaceId] = useState<string | null>(null);
  const [placeShareId, setPlaceShareId] = useState<string | null>(null);
  const [placeShareStatus, setPlaceShareStatus] = useState<'idle'|'saving'|'copied'|'error'>('idle');
  const openShapeNaming = useCallback((id: string, type: 'site' | 'water', overrideName?: string, overrideCat?: string) => {
    const draw = drawRef.current;
    const f = draw?.get(id);
    setShapeName(overrideName !== undefined ? overrideName : (f?.properties?.name as string) ?? '');
    setShapeCategory(overrideCat !== undefined ? overrideCat : (f?.properties?.category as string) ?? '');
    setShapeNamePlaceId((f?.properties?.placeId as string) ?? null);
    setShapeNaming({ id, type });
  }, []);
  const confirmShapeNaming = useCallback(() => {
    if (!shapeNaming) return;
    const draw = drawRef.current;
    if (draw) {
      try {
        draw.setFeatureProperty(shapeNaming.id, 'name', shapeName.trim() || undefined);
        draw.setFeatureProperty(shapeNaming.id, 'category', shapeCategory || undefined);
        draw.setFeatureProperty(shapeNaming.id, 'placeId', shapeNamePlaceId ?? undefined);
      } catch { /* feature may be gone */ }
    }
    setShapeNaming(null);
    recompute();
    setSiteFeatures(getSiteFeatures());
    setWaterFeatures(getWaterFeatures());
  }, [shapeNaming, shapeName, shapeCategory, shapeNamePlaceId, recompute, getSiteFeatures, getWaterFeatures]);

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

  // Two-tap delete for a placed site element — mirrors requestDelete/pendingDelete above,
  // scoped separately since elements live outside the mapbox-gl-draw feature store.
  const requestDeleteElement = useCallback((id: string) => {
    if (pendingElementTimer.current) clearTimeout(pendingElementTimer.current);
    setPendingDeleteElement((cur) => {
      if (cur === id) {
        deleteSiteElement(siteIdForElements, id);
        setSiteElements(loadSiteElements(siteIdForElements));
        setElementEditing((e) => (e?.id === id ? null : e));
        return null;
      }
      pendingElementTimer.current = setTimeout(() => setPendingDeleteElement(null), 3500);
      return id;
    });
  }, [siteIdForElements]);

  // Opens the element sheet, seeding both the free-text fields and the
  // structured capacity/species/count fields from whatever the element
  // already has — shared by the marker tap, the drop-list edit button, and
  // the "Place here" placement flow below, so all three stay in sync.
  const openElementEditor = (el: SiteElement) => {
    setElementEditing(el);
    setElName(el.label ?? '');
    setElNote(el.note ?? '');
    setElLitres(el.litres);
    setElSpecies(el.species ?? '');
    setElCount(el.count ?? 1);
    setElTankCustomOpen(false);
    setElTreeCustomOpen(false);
  };

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

        {/* Below FINE_CONTOUR_MIN_ZOOM, or whenever the fine fetch hasn't produced data yet
            (still loading / errored / bbox too large), keep the fixed-10m Mapbox vector
            contours as the always-available fallback. */}
        {contours && (zoom < FINE_CONTOUR_MIN_ZOOM || !fineContours) && (
          <Source id="contours" type="vector" url="mapbox://mapbox.mapbox-terrain-v2">
            <Layer {...contourMinor} />
            <Layer {...contourMajor} />
            <Layer {...contourLabel} />
            <Layer {...contourLabelMinor} />
          </Source>
        )}

        {/* Fine (5m minor / 25m major) contours — site-scale, generated server-side from the
            terrain-RGB DEM. Swapped in above FINE_CONTOUR_MIN_ZOOM once the fetch succeeds. */}
        {contours && zoom >= FINE_CONTOUR_MIN_ZOOM && fineContours && (
          <Source id="contours-fine" type="geojson" data={fineContours}>
            <Layer {...contourFineMinor} />
            <Layer {...contourFineMajor} />
            <Layer {...contourFineLabel} />
            <Layer {...contourFineLabelMinor} />
          </Source>
        )}

        {/* ── Design-on-map overlay (READ-ONLY) — the farmer's saved Design Studio design
            drawn over the satellite. Non-interactive: not in interactiveLayerIds, so it
            never intercepts a location-select tap. react-map-gl removes the source/layers
            automatically when hidden or on unmount. ── */}
        {showDesign && designOverlay && (
          <Source id="design-overlay" type="geojson" data={designOverlay.collection}>
            <Layer {...designFillLayer} />
            <Layer {...designOutlineLayer} />
            <Layer {...designLineSolidLayer} />
            <Layer {...designLineDashedLayer} />
          </Source>
        )}

        {/* Design element markers (read-only) — emoji footprints from the saved design.
            pointer-events off so a tap falls through to the map (location select). */}
        {showDesign && designOverlay && designOverlay.items.map((it) => (
          <Marker key={`design-${it.id}`} longitude={it.lng} latitude={it.lat} anchor="center">
            <div
              title={it.label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}
            >
              <div className="flex items-center justify-center rounded-full"
                style={{ width: 26, height: 26, background: it.color, border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(6,16,10,0.5)', fontSize: 13, lineHeight: 1 }}>
                <span aria-hidden="true">{it.icon}</span>
              </div>
            </div>
          </Marker>
        ))}

        {/* Water infrastructure point markers */}
        {!activeDraw && waterPoints.map((wp) => (
          <Marker key={wp.id} longitude={wp.lon} latitude={wp.lat} anchor="center">
            <button
              onClick={(e) => { e.stopPropagation(); setWaterPointNaming(wp); setWpName(wp.name); setWpCategory(wp.category); }}
              title={wp.name || wp.category || 'Water point'}
              className="flex flex-col items-center group"
              style={{ cursor: 'pointer' }}
            >
              <span className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-xs font-display font-medium whitespace-nowrap mb-0.5"
                style={{ background: 'rgba(6,16,10,0.9)', border: '1px solid rgba(91,158,212,0.5)', color: '#8FC7E8', transition: 'opacity 0.15s' }}>
                {wp.name || wp.category || 'Water point'}
              </span>
              <div className="flex items-center justify-center rounded-full"
                style={{ width: 20, height: 20, background: categoryColor(wp.category), border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(6,16,10,0.5)' }}>
                <Droplets size={10} style={{ color: '#fff' }} />
              </div>
            </button>
          </Marker>
        ))}

        {/* Site element markers (JoJo tanks, taps, beehives, etc) */}
        {!activeDraw && siteElements.map((el) => {
          const meta = getElementMeta(el.type);
          const display = el.label || meta.label;
          return (
            <Marker key={el.id} longitude={el.lon} latitude={el.lat} anchor="center">
              <button
                onClick={(e) => { e.stopPropagation(); openElementEditor(el); }}
                title={`${display}${el.note ? ` — ${el.note}` : ''}`}
                className="flex flex-col items-center group"
                style={{ cursor: 'pointer', padding: 6 }}
              >
                <span className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-xs font-display font-medium whitespace-nowrap mb-0.5"
                  style={{ background: 'rgba(6,16,10,0.9)', border: `1px solid ${meta.color}80`, color: meta.color, transition: 'opacity 0.15s' }}>
                  {display}{el.note ? ` — ${el.note}` : ''}
                </span>
                <div className="flex items-center justify-center rounded-full"
                  style={{ width: 28, height: 28, background: meta.color, border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(6,16,10,0.5)', fontSize: 14, lineHeight: 1 }}>
                  <span aria-hidden="true">{meta.icon}</span>
                </div>
              </button>
            </Marker>
          );
        })}

        {/* ── "Move pin" drag bar — shown when movingPin is active ── */}
        {movingPin && (() => {
          const p = savedPins.find(pin => pin.id === movingPin);
          if (!p) return null;
          return (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 font-sans z-[25]"
              style={{ bottom: 'calc(72px + env(safe-area-inset-bottom) + 12px)', background: 'rgba(16,22,14,0.9)', backdropFilter: 'blur(14px)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '10px 14px' }}>
              <Move size={16} style={{ color: 'rgba(234,243,226,0.55)', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EAF3E2' }}>Drag <span style={{ color: resolveColor(p) }}>{p.name}</span> to new spot</span>
              <button onClick={() => setMovingPin(null)}
                className="flex items-center justify-center active:scale-90 transition-all"
                style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(247,242,233,0.12)', border: '1px solid rgba(234,243,226,0.18)', cursor: 'pointer' }}>
                <Check size={14} style={{ color: '#9BE66B' }} />
              </button>
            </div>
          );
        })()}

        {/* Saved-place pins — click to fly in */}
        {!activeDraw && savedPins.map((p) => (
          <Marker
            key={p.id} longitude={p.lon} latitude={p.lat} anchor="bottom"
            draggable={movingPin === p.id}
            onDragEnd={(e) => {
              updatePlacePosition(p.id, e.lngLat.lat, e.lngLat.lng);
              setSavedPins(loadPlaces());
              setMovingPin(null);
            }}
          >
            <div className="flex flex-col items-center group" style={{ transform: 'translateY(2px)' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (movingPin) return;
                  mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 17, duration: 900 });
                  onLocationSelect(p.lat, p.lon);
                  onPlaceSelect?.({ name: p.name, id: p.id });
                }}
                className={`px-2 py-1 rounded-lg text-xs font-display font-bold whitespace-nowrap mb-1 transition-opacity ${(showPlaceLabels && !(showFeatures && pinsWithFeatures.has(p.id))) || activePin === p.id || movingPin === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{ background: 'rgba(6,16,10,0.92)', border: `1.5px solid ${resolveColor(p)}`, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', cursor: 'pointer' }}>
                {p.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (movingPin) return; setActivePin(prev => prev === p.id ? null : p.id); }}
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}>
                <MapPin size={activePin === p.id ? 26 : 22}
                  style={{
                    color: resolveColor(p), fill: resolveColor(p),
                    filter: activePin === p.id
                      ? `drop-shadow(0 0 6px ${resolveColor(p)}99) drop-shadow(0 1px 2px rgba(32,25,15,0.4))`
                      : movingPin === p.id
                      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.5)) drop-shadow(0 1px 2px rgba(32,25,15,0.4))'
                      : 'drop-shadow(0 1px 2px rgba(32,25,15,0.4))',
                    transition: 'all 0.15s',
                  }} />
              </button>
            </div>
          </Marker>
        ))}

        {/* ── People face-photo markers ── */}
        {showPeople && (people ?? []).map(p => (
          <Marker key={p.id} latitude={p.lat} longitude={p.lon} anchor="bottom">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                border: `2.5px solid ${ROLE_COLOR[p.role] ?? '#5C5040'}`,
                background: ROLE_COLOR[p.role] ?? '#5C5040',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {p.photoUrl
                  ? <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'white', fontWeight: 700, fontSize: 15, fontFamily: 'system-ui' }}>
                      {(p.name?.[0] ?? '?').toUpperCase()}
                    </span>
                }
              </div>
              <div style={{
                background: 'rgba(20,20,20,0.78)', color: 'white',
                fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 600,
                padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap', maxWidth: 72,
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{p.name}</div>
            </div>
          </Marker>
        ))}

        {/* ── Tap-action Popup for active place pin ── */}
        {activePin && !movingPin && (() => {
          const p = savedPins.find(pin => pin.id === activePin);
          if (!p) return null;
          return (
            <Popup
              longitude={p.lon} latitude={p.lat}
              anchor="bottom" offset={50}
              closeButton={false} closeOnClick={false}
              onClose={() => setActivePin(null)}
              style={{ padding: 0, background: 'transparent', boxShadow: 'none' }}
            >
              <div className="flex items-center font-sans" style={{ background: '#E4DCC6', border: '1px solid rgba(32,25,15,0.1)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => { mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 17, duration: 900 }); onLocationSelect(p.lat, p.lon); onPlaceSelect?.({ name: p.name, id: p.id }); setActivePin(null); }}
                  className="flex items-center gap-1.5 active:bg-stone-100 transition-colors"
                  style={{ padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#20190F', fontSize: 13, fontWeight: 600 }}>
                  <LocateFixed size={14} style={{ color: '#1F4D2B' }} />Go to
                </button>
                <div style={{ width: 1, height: 32, background: 'rgba(32,25,15,0.08)' }} />
                <button
                  onClick={() => { startEditPlace(p); setActivePin(null); }}
                  className="flex items-center gap-1.5 active:bg-stone-100 transition-colors"
                  style={{ padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#20190F', fontSize: 13, fontWeight: 600 }}>
                  <PenLine size={14} style={{ color: '#1F4D2B' }} />Edit
                </button>
                <div style={{ width: 1, height: 32, background: 'rgba(32,25,15,0.08)' }} />
                <button
                  onClick={() => { setMovingPin(p.id); setActivePin(null); }}
                  className="flex items-center gap-1.5 active:bg-stone-100 transition-colors"
                  style={{ padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#20190F', fontSize: 13, fontWeight: 600 }}>
                  <Move size={14} style={{ color: '#1F4D2B' }} />Move
                </button>
                <div style={{ width: 1, height: 32, background: 'rgba(32,25,15,0.08)' }} />
                <button
                  onClick={() => { deletePlace(p.id); setSavedPins(loadPlaces()); setActivePin(null); }}
                  className="flex items-center gap-1.5 active:bg-red-50 transition-colors"
                  style={{ padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#C0492A', fontSize: 13, fontWeight: 600 }}>
                  <Trash2 size={14} />Delete
                </button>
                <div style={{ width: 1, height: 32, background: 'rgba(32,25,15,0.08)' }} />
                <button
                  onClick={() => handleSharePlace(p)}
                  disabled={placeShareId === p.id && placeShareStatus === 'saving'}
                  className="flex items-center gap-1.5 active:bg-stone-100 transition-colors relative"
                  style={{ padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: placeShareId === p.id && placeShareStatus === 'copied' ? '#1F4D2B' : '#20190F', fontSize: 13, fontWeight: 600 }}>
                  {placeShareId === p.id && placeShareStatus === 'saving'
                    ? <Loader2 size={14} className="animate-spin" style={{ color: '#20190F' }} />
                    : <Share2 size={14} style={{ color: placeShareId === p.id && placeShareStatus === 'copied' ? '#1F4D2B' : '#20190F' }} />}
                  {placeShareId === p.id && placeShareStatus === 'copied' ? 'Copied!' : 'Share'}
                </button>
              </div>
            </Popup>
          );
        })()}

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
                ? `Mark each corner of your ${pinDraw === 'water' ? 'harvesting area' : 'land'} — tap the map, or centre the crosshair and tap Add corner`
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

      {/* ── Water point drop mode: crosshair + Place here ── */}
      {droppingWaterPoint && (
        <>
          {/* Top hint */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: '1px solid rgba(35,94,134,0.5)', backdropFilter: 'blur(8px)' }}>
            <span className="font-display" style={{ fontSize: 12, color: '#8FC7E8' }}>
              Pan to the location, then tap Place here
            </span>
          </div>
          {/* Blue crosshair */}
          <div className="absolute left-1/2 top-1/2 pointer-events-none"
            style={{ transform: 'translate(-50%, -50%)', zIndex: 8 }}>
            <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="20" stroke="#5B9ED4" strokeWidth="2" opacity="0.5" />
              <circle cx="27" cy="27" r="3.5" fill="#5B9ED4" stroke="#fff" strokeWidth="1.5" />
              <line x1="27" y1="2" x2="27" y2="14" stroke="#5B9ED4" strokeWidth="2" />
              <line x1="27" y1="40" x2="27" y2="52" stroke="#5B9ED4" strokeWidth="2" />
              <line x1="2" y1="27" x2="14" y2="27" stroke="#5B9ED4" strokeWidth="2" />
              <line x1="40" y1="27" x2="52" y2="27" stroke="#5B9ED4" strokeWidth="2" />
            </svg>
          </div>
          {/* Action bar */}
          <div className="absolute left-0 right-0 flex gap-2 px-3"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom) + 12px)', zIndex: 30 }}>
            <button onClick={() => setDroppingWaterPoint(false)}
              className="flex items-center justify-center gap-1.5 font-sans font-semibold"
              style={{ flex: '0 0 auto', minWidth: 72, padding: '10px 14px', borderRadius: 13, background: 'rgba(6,16,10,0.88)', border: '1px solid rgba(234,243,226,0.16)', color: '#EAF3E2', fontSize: 14, cursor: 'pointer' }}>
              <X size={15} />Cancel
            </button>
            <button onClick={() => {
              const map = mapRef.current?.getMap();
              if (!map) return;
              const center = map.getCenter();
              const newPoint: WaterPoint = {
                id: generateWaterPointId(),
                name: '',
                category: '',
                lat: center.lat,
                lon: center.lng,
                createdAt: new Date().toISOString(),
              };
              saveWaterPoint(newPoint);
              setDroppingWaterPoint(false);
              setWaterPointNaming(newPoint);
              setWpName('');
              setWpCategory('');
            }}
              className="flex-1 flex items-center justify-center gap-2 font-sans font-bold"
              style={{ height: 48, borderRadius: 13, background: '#235E86', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
              <MapPin size={17} />Place here
            </button>
          </div>
        </>
      )}

      {/* ── Site element drop mode: crosshair + Place here (mirrors water point drop mode exactly) ── */}
      {droppingElement && (
        <>
          {/* Top hint */}
          <div className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center pointer-events-none"
            style={{ top: 14, zIndex: 20, maxWidth: 'calc(100vw - 24px)',
              background: 'rgba(6,16,10,0.88)', border: `1px solid ${getElementMeta(droppingElement).color}80`, backdropFilter: 'blur(8px)' }}>
            <span className="font-display" style={{ fontSize: 12, color: getElementMeta(droppingElement).color }}>
              Pan to the location, then tap Place here
            </span>
          </div>
          {/* Crosshair, tinted to the element's accent colour */}
          <div className="absolute left-1/2 top-1/2 pointer-events-none"
            style={{ transform: 'translate(-50%, -50%)', zIndex: 8 }}>
            <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="20" stroke={getElementMeta(droppingElement).color} strokeWidth="2" opacity="0.5" />
              <circle cx="27" cy="27" r="3.5" fill={getElementMeta(droppingElement).color} stroke="#fff" strokeWidth="1.5" />
              <line x1="27" y1="2" x2="27" y2="14" stroke={getElementMeta(droppingElement).color} strokeWidth="2" />
              <line x1="27" y1="40" x2="27" y2="52" stroke={getElementMeta(droppingElement).color} strokeWidth="2" />
              <line x1="2" y1="27" x2="14" y2="27" stroke={getElementMeta(droppingElement).color} strokeWidth="2" />
              <line x1="40" y1="27" x2="52" y2="27" stroke={getElementMeta(droppingElement).color} strokeWidth="2" />
            </svg>
          </div>
          {/* Action bar */}
          <div className="absolute left-0 right-0 flex gap-2 px-3"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom) + 12px)', zIndex: 30 }}>
            <button onClick={() => setDroppingElement(null)}
              className="flex items-center justify-center gap-1.5 font-sans font-semibold"
              style={{ flex: '0 0 auto', minWidth: 72, padding: '10px 14px', borderRadius: 13, background: 'rgba(6,16,10,0.88)', border: '1px solid rgba(234,243,226,0.16)', color: '#EAF3E2', fontSize: 14, cursor: 'pointer' }}>
              <X size={15} />Cancel
            </button>
            <button onClick={() => {
              const map = mapRef.current?.getMap();
              if (!map || !droppingElement) return;
              const center = map.getCenter();
              const newElement: SiteElement = {
                id: generateId(),
                type: droppingElement,
                lat: center.lat,
                lon: center.lng,
                createdAt: new Date().toISOString(),
              };
              saveSiteElement(siteIdForElements, newElement);
              setSiteElements(loadSiteElements(siteIdForElements));
              setDroppingElement(null);
              setElementEditing(newElement);
              setElName('');
              setElNote('');
              setElLitres(droppingElement === 'jojo_tank' ? 5000 : undefined);
              setElSpecies('');
              setElCount(1);
              setElTankCustomOpen(false);
              setElTreeCustomOpen(false);
            }}
              className="flex-1 flex items-center justify-center gap-2 font-sans font-bold"
              style={{ height: 48, borderRadius: 13, background: getElementMeta(droppingElement).color, border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
              <MapPin size={17} />Place here
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
      {/* Guided pin instruction bar (onboarding) — replaces the Tools pill for a novice:
          one instruction + Search / Use-my-location. Self-retires when a pin is dropped
          (parent passes `guided && !selected`). */}
      {guided && toolbarMin && !pinDraw && !editPin && !activeDraw && (
        <div
          className="absolute font-sans"
          style={{
            top: 12, left: 12, right: 12, zIndex: 10,
            background: 'rgba(22,30,18,0.86)', border: '1px solid rgba(234,243,226,0.12)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 24px -10px rgba(0,0,0,0.5)', borderRadius: 14, padding: '12px 14px',
          }}
        >
          <div className="flex items-start gap-2.5" style={{ marginBottom: 10 }}>
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 8, background: '#1F4D2B', color: '#A8D88A' }}>
              <Sprout size={15} strokeWidth={1.7} />
            </span>
            <span style={{ color: '#F7F2E9', fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{t('guidedBarSearch')}</span>
            <SpeakButton text={t('guidedBarSearch')} color="#F7F2E9" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setToolbarMin(false);
                requestAnimationFrame(() => (document.querySelector('.map-search-input') as HTMLInputElement | null)?.focus());
              }}
              className="flex-1 flex items-center justify-center gap-1.5 active:scale-95"
              style={{ minHeight: 44, borderRadius: 11, border: '1px solid rgba(234,243,226,0.18)', background: 'rgba(234,243,226,0.10)', color: '#F7F2E9', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <Search size={16} /> {t('searchPlaceholder')}
            </button>
            <button
              onClick={goToMyLocation}
              className="flex-1 flex items-center justify-center gap-1.5 active:scale-95"
              style={{ minHeight: 44, borderRadius: 11, border: '1px solid rgba(234,243,226,0.18)', background: 'rgba(234,243,226,0.10)', color: '#F7F2E9', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <LocateFixed size={16} /> {t('guidedBarLocate')}
            </button>
          </div>
        </div>
      )}

      {!pinDraw && !editPin && !activeDraw && toolbarMin && !guided && (
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
          {t('toolbarMinButton')}
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
            <span className="font-display" style={{ fontWeight: 600, fontSize: 17, color: '#F7F2E9' }}>{t('toolbarHeader')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Share this site — saves draw + places + water, copies URL */}
            <button
              onClick={handleShare}
              disabled={shareState === 'saving'}
              title="Share this site"
              className="flex items-center justify-center flex-shrink-0 relative transition-all active:scale-90"
              style={{
                width: 38, height: 38, borderRadius: 11,
                background: 'rgba(247,242,233,0.08)',
                border: '1px solid rgba(234,243,226,0.16)',
                cursor: shareState === 'saving' ? 'default' : 'pointer',
              }}
            >
              {shareState === 'saving'
                ? <Loader2 size={15} className="animate-spin" style={{ color: 'rgba(234,243,226,0.55)' }} />
                : <Share2 size={15} style={{ color: shareState === 'copied' ? '#9BE66B' : 'rgba(234,243,226,0.55)' }} />}
              {shareState === 'copied' && (
                <span className="absolute pointer-events-none font-sans font-bold whitespace-nowrap"
                  style={{
                    top: 44, right: 0,
                    background: '#E4DCC6', color: '#20190F',
                    fontSize: 12, borderRadius: 8, padding: '5px 10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35)', zIndex: 20,
                  }}>
                  Link copied!
                </span>
              )}
              {shareState === 'error' && (
                <span className="absolute pointer-events-none font-sans font-bold whitespace-nowrap"
                  style={{
                    top: 44, right: 0,
                    background: '#E4DCC6', color: '#C0492A',
                    fontSize: 12, borderRadius: 8, padding: '5px 10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35)', zIndex: 20,
                  }}>
                  Share failed
                </span>
              )}
            </button>
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
              {t('toolbarHideButton')} <ChevronUp size={14} />
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="relative">
        <form onSubmit={(e) => { e.preventDefault(); setSuggestions([]); handleSearch(searchQuery); }}
          className="flex items-center gap-2.5"
          style={{ height: 50, padding: '0 8px 0 15px', borderRadius: 13,
            background: 'rgba(247,242,233,0.1)',
            border: `1px solid ${searchError ? 'rgba(212,110,66,0.7)' : 'rgba(234,243,226,0.16)'}` }}>
          <Search size={19} style={{ color: 'rgba(234,243,226,0.55)', flexShrink: 0 }} strokeWidth={2} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { const v = e.target.value; setSearchQuery(v); setSearchError(''); setSearchResult(''); setShowRecents(false); fetchSuggestions(v); }}
            onFocus={() => { if (!searchQuery.trim() && recents.length) setShowRecents(true); }}
            onBlur={() => setTimeout(() => { setSuggestions([]); setShowRecents(false); }, 150)}
            placeholder={t('searchPlaceholder')}
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
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(232,240,230,0.55)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(58,104,48,0.25)' }}>{t('recentSearchesHeader')}</div>
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
          style={{ background: 'rgba(247,242,233,0.1)', border: '1px solid rgba(234,243,226,0.16)',
            borderRadius: 13, color: '#EAF3E2', height: 48, fontSize: 14.5, fontWeight: 600, padding: '0 15px' }}>
          <span className="flex items-center gap-2.5 min-w-0">
            <Layers size={19} strokeWidth={1.8} style={{ color: '#A8D88A', flexShrink: 0 }} />
            {/* Collapsed: summarise the active layers (e.g. "Satellite · Contours") */}
            <span className="truncate">{layersOpen ? t('layersButtonOpen') : [
              style === 'satellite-streets-v12' ? t('layerToggleSatellite') : t('layerToggleTopo'),
              hdImagery ? t('layerToggleHD') : null, contours ? t('layerToggleContours') : null,
              hillshade ? t('layerToggleRelief') : null, terrain3d ? t('layerToggle3D') : null,
            ].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronDown size={16} style={{ color: 'rgba(234,243,226,0.6)', flexShrink: 0, transition: 'transform 0.2s', transform: layersOpen ? 'rotate(180deg)' : 'none' }} />
        </button>

        {layersOpen && (() => {
          // One consistent chip treatment for every layer toggle — green when on,
          // calm paper-tint when off (replaces the old clashing teal/ochre/blue).
          const chip = (on: boolean): React.CSSProperties => ({
            ...(on
              ? { background: 'rgba(168,216,138,0.32)', border: '1.5px solid rgba(168,216,138,0.7)', color: '#A8D88A' }
              : { background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#EAF3E2' }),
            borderRadius: 9, height: 40, padding: '0 13px', fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          });
          return (
          <div className="flex gap-1.5 flex-wrap font-sans">
            {(['satellite-streets-v12', 'outdoors-v12'] as const).map((s, i) => (
              <button key={s} onClick={() => setStyle(s)} className="transition-all" style={chip(style === s)}>
                {style === s && <Check size={13} strokeWidth={2.4} />}{[t('layerToggleSatellite'), t('layerToggleTopo')][i]}
              </button>
            ))}
            <button onClick={() => setHdImagery(!hdImagery)}
              title="Switch to Esri high-res imagery — often sharper than the default when zoomed in"
              className="transition-all" style={chip(hdImagery)}>
              {hdImagery && <Check size={13} strokeWidth={2.4} />}{t('layerToggleHD')}
            </button>
            <button onClick={() => setContours(!contours)} className="transition-all" style={chip(contours)}>
              {contours && <Check size={13} strokeWidth={2.4} />}{t('layerToggleContours')}
            </button>
            <button onClick={() => setHillshade(!hillshade)}
              title="Hillshade relief — shades slopes so hills, valleys and the direction land faces are visible"
              className="transition-all" style={chip(hillshade)}>
              <Mountain size={13} strokeWidth={1.9} />{t('layerToggleRelief')}
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
              <Box size={13} strokeWidth={1.9} />{t('layerToggle3D')}
            </button>
          </div>
          );
        })()}

        {/* Heads-up: 3D tilts the map and can stop you zooming in close enough to draw */}
        {layersOpen && show3dWarning && (
          <div className="rounded-lg font-mono"
            style={{ background: 'rgba(212,168,83,0.14)', border: '1px solid rgba(212,168,83,0.45)',
              color: 'var(--gold)', fontSize: TOUCH_FS - 2, padding: '8px 12px', lineHeight: 1.45 }}>
            <AlertTriangle size={13} className="inline mr-1" /> {t('threeDWarning')}
          </div>
        )}

        {layersOpen && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.45)', marginBottom: 8, paddingLeft: 2 }}>
              {t('editToolSectionLabel')}
            </div>
            <div className="flex gap-2">
              {([['custom', t('editEngineBigHandles'), Hand], ['native', t('editEngineMapboxTool'), PenTool]] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => chooseEngine(key)}
                  className="flex-1 flex items-center justify-center gap-2 font-sans transition-all"
                  style={{
                    ...(editEngine === key
                      ? { background: 'rgba(168,216,138,0.32)', border: '1.5px solid rgba(168,216,138,0.7)', color: '#A8D88A' }
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
            {t('toolsSectionLabel')}
          </div>
          <div className="flex gap-1.5 flex-wrap font-sans">
          {/* Add to my map — the shared "+ Add" door (spec §2.3). Farmer page hosts the sheet;
              this row just asks it to open. Loud (Gold) so it reads as the primary action. */}
          <button onClick={() => window.dispatchEvent(new CustomEvent('imbewu-open-add'))}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: '#F7C97E', border: '1px solid #E0A94A',
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 700,
              color: '#3A2A12', cursor: 'pointer',
            }}>
            <Plus size={19} strokeWidth={2.2} style={{ color: '#3A2A12' }} /> {t('addToolsPanelRow')}
          </button>

          {/* My location */}
          <button onClick={goToMyLocation} disabled={locating}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: 'rgba(247,242,233,0.07)', border: '1px solid rgba(234,243,226,0.16)',
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600,
              color: locating ? 'rgba(234,243,226,0.5)' : '#EAF3E2',
            }}>
            {locating ? <Loader2 size={18} className="animate-spin" style={{ color: '#A8D88A' }} /> : <LocateFixed size={19} strokeWidth={1.8} style={{ color: '#A8D88A' }} />} {t('locateMeButton')}
          </button>

          {/* Save the current spot as a place */}
          <button onClick={saveCurrentPlace} disabled={!selectedLocation}
            title={selectedLocation ? 'Save this spot to your Places' : 'Tap a spot on the map first'}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: placeSaved ? 'rgba(168,216,138,0.32)' : 'rgba(247,242,233,0.07)',
              border: `1.5px solid ${placeSaved ? 'rgba(168,216,138,0.7)' : 'rgba(234,243,226,0.16)'}`,
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600,
              color: placeSaved ? '#A8D88A' : '#EAF3E2', opacity: selectedLocation ? 1 : 0.5,
            }}>
            {placeSaved ? <Check size={18} strokeWidth={2.2} style={{ color: '#A8D88A' }} /> : <Bookmark size={18} strokeWidth={1.8} style={{ color: '#A8D88A' }} />}{placeSaved ? t('savePlaceConfirmedButton') : t('savePlaceButton')}
          </button>

          {/* Print a clean base map (no hatch) for the farmer to sketch on by hand */}
          <button onClick={printBaseMap}
            title="Print a clean base map (boundary, house outlines + contours, no hatching) to sketch your design on by hand"
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: 'rgba(247,242,233,0.07)', border: '1px solid rgba(234,243,226,0.16)',
              borderRadius: 13, height: 48, padding: '0 15px', fontSize: 14.5, fontWeight: 600, color: '#EAF3E2',
            }}>
            <Printer size={18} strokeWidth={1.8} style={{ color: '#A8D88A' }} /> {t('printBaseMapButton')}
          </button>

          {/* ── Places section — collapsible ── */}
          <div className="w-full">
            <button
              onClick={() => setPlacesOpen((o) => !o)}
              className="w-full flex items-center justify-between active:opacity-70 transition-all"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 2px' }}>
              <div className="flex items-center gap-1.5">
                <ChevronDown size={13} style={{ color: 'rgba(234,243,226,0.4)', transition: 'transform 0.2s', transform: placesOpen ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
                <span className="font-sans" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                  {t('placesSectionLabel')}{savedPins.length ? ` · ${savedPins.length}` : ''}
                </span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowPlaceLabels((v) => !v); }}
                className="flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                <MapPin size={11} style={{ color: showPlaceLabels ? '#9BE66B' : 'rgba(234,243,226,0.3)' }} />
                <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: showPlaceLabels ? '#EAF3E2' : 'rgba(234,243,226,0.3)' }}>{t('placesLabelsToggle')}</span>
                <span className="flex items-center rounded-full flex-shrink-0"
                  style={{ width: 26, height: 15, padding: 2, background: showPlaceLabels ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showPlaceLabels ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: showPlaceLabels ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                </span>
              </button>
            </button>
            {placesOpen && (
              <div className="w-full flex flex-col gap-1 mt-1.5">
                {savedPins.length === 0 ? (
                  <div className="px-3 py-2 rounded-lg font-sans"
                    style={{ background: 'rgba(22,37,20,0.5)', border: '1px solid rgba(58,104,48,0.3)', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('noSavedPlacesMessage')}
                  </div>
                ) : savedPins.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 font-sans"
                    style={{ background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '10px 10px 10px 12px' }}>
                    <button onClick={() => startEditPlace(p)} title="Edit name or colour"
                      className="flex items-center justify-center flex-shrink-0 active:scale-90 transition-all rounded-[9px]"
                      style={{ width: 36, height: 36, background: placeColor(p.label), cursor: 'pointer', border: 'none' }}>
                      <MapPin size={16} strokeWidth={2} style={{ color: '#fff' }} />
                    </button>
                    <button
                      onClick={() => {
                        mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 15, duration: 1400 });
                        onLocationSelect(p.lat, p.lon);
                        onPlaceSelect?.({ name: p.name, id: p.id });
                        setPlacesOpen(false);
                        setSectionParcels(true);
                      }}
                      className="flex-1 min-w-0 text-left transition-all"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <div className="truncate" style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: 'rgba(234,243,226,0.55)' }}>{p.elevation} m elev.</div>
                    </button>
                    <button onClick={() => startEditPlace(p)} title="Edit name or colour"
                      className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                      style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}>
                      <PenLine size={15} style={{ color: 'rgba(234,243,226,0.55)' }} />
                    </button>
                    <button onClick={() => { deletePlace(p.id); setSavedPins(loadPlaces()); }}
                      aria-label={`Delete ${p.name}`} title="Delete this place"
                      className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                      style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}>
                      <Trash2 size={15} style={{ color: 'rgba(224,150,130,0.85)' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drawing in progress */}
          {activeDraw && (
            <>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-sans"
                style={activeDraw === 'water'
                  ? { background: 'rgba(91,158,212,0.18)', border: '1px solid rgba(91,158,212,0.55)', color: '#235E86', minHeight: 32 }
                  : { background: 'rgba(31,77,43,0.18)', border: '1px solid rgba(31,77,43,0.55)', color: '#2D6B3C', minHeight: 32 }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: activeDraw === 'water' ? '#235E86' : '#2D6B3C' }} />
                {activeDraw === 'water' ? 'Water' : 'Boundary'} · click points · dbl-click to finish · Esc to cancel
              </div>
              <button onClick={cancelDraw}
                className="px-2 py-1 rounded-lg text-xs font-display transition-all"
                style={{ background: 'rgba(212,110,66,0.15)', border: '1px solid rgba(212,110,66,0.4)', color: 'var(--orange)', minHeight: 32 }}>
                <X size={13} className="inline mr-1" />Cancel
              </button>
            </>
          )}

          {/* Vertex editing */}
          {editingFeatureId && !activeDraw && (
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-sans"
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

          {/* ── Site / Land parcel section — collapsible ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && (
            <div className="w-full">
              <button
                onClick={() => setSectionParcels((o) => !o)}
                className="w-full flex items-center justify-between active:opacity-70 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 2px' }}>
                <div className="flex items-center gap-1.5">
                  <ChevronDown size={13} style={{ color: 'rgba(234,243,226,0.4)', transition: 'transform 0.2s', transform: sectionParcels ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
                  <span className="font-sans" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                    {t('parcelsSectionLabel')}{siteStats ? ` · ${siteStats.count ?? 1}` : ''}
                  </span>
                  {siteStats && <span className="font-sans" style={{ fontSize: 11.5, color: 'rgba(234,243,226,0.4)' }}>{siteStats.areaHa} ha</span>}
                </div>
              </button>
              {/* Toggle row — sits below section header, wraps on narrow panels */}
              <div className="flex flex-wrap items-center gap-0.5 pl-4 pb-1">
                <button onClick={() => setShowFeatures((v) => !v)}
                  className="flex items-center gap-1 active:scale-95 transition-all"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                  <Square size={10} style={{ color: showFeatures ? '#9BE66B' : 'rgba(234,243,226,0.3)' }} />
                  <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: showFeatures ? '#EAF3E2' : 'rgba(234,243,226,0.3)' }}>{t('labelsShapesToggle')}</span>
                  <span className="flex items-center rounded-full flex-shrink-0"
                    style={{ width: 22, height: 13, padding: 2, background: showFeatures ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showFeatures ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: showFeatures ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                  </span>
                </button>
                {showFeatures && (
                  <button onClick={() => setShowHatch((v) => !v)}
                    className="flex items-center gap-1 active:scale-95 transition-all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                    <Grid size={10} style={{ color: showHatch ? '#9BE66B' : 'rgba(234,243,226,0.3)' }} />
                    <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: showHatch ? '#EAF3E2' : 'rgba(234,243,226,0.3)' }}>{t('labelsHatchToggle')}</span>
                    <span className="flex items-center rounded-full flex-shrink-0"
                      style={{ width: 22, height: 13, padding: 2, background: showHatch ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showHatch ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: showHatch ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                    </span>
                  </button>
                )}
                {showFeatures && (
                  <button onClick={() => setShowShapeLabels((v) => !v)}
                    className="flex items-center gap-1 active:scale-95 transition-all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                    <Layers size={10} style={{ color: showShapeLabels ? '#9BE66B' : 'rgba(234,243,226,0.3)' }} />
                    <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: showShapeLabels ? '#EAF3E2' : 'rgba(234,243,226,0.3)' }}>{t('parcelsLabelsToggle')}</span>
                    <span className="flex items-center rounded-full flex-shrink-0"
                      style={{ width: 22, height: 13, padding: 2, background: showShapeLabels ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showShapeLabels ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: showShapeLabels ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                    </span>
                  </button>
                )}
              </div>
              {sectionParcels && (
                <>
                  {siteStats ? (
                    <div className="w-full flex flex-col gap-1.5 mt-1.5">
                      {siteFeatures.map((sf, idx) => (
                        <div key={sf.id} className="flex items-center gap-3 font-sans"
                          style={{ background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '13px 13px 13px 15px' }}>
                          <div className="flex-shrink-0 rounded-[4px]" style={{ width: 10, height: 34, background: LAND_PALETTE[sf.hatchIdx % LAND_PALETTE.length].edge }} />
                          <button onClick={() => openShapeNaming(sf.id, 'site')} className="flex-1 min-w-0 text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <div className="flex items-center gap-1.5" style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                              <span className="truncate">{sf.name || `${t('parcelDefaultName')} ${idx + 1}`}</span>
                              <PenLine size={13} style={{ color: 'rgba(234,243,226,0.4)', flexShrink: 0 }} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12.5, color: 'rgba(234,243,226,0.55)' }}>
                              <span>{sf.category ? `${sf.category} · ` : ''}{t('parcelLandLabel')} · {sf.areaHa} ha</span>
                              {sf.placeId && (() => { const pl = savedPins.find(p => p.id === sf.placeId); return pl ? <span style={{ fontSize: 10.5, fontWeight: 700, color: resolveColor(pl), background: `${resolveColor(pl)}22`, borderRadius: 6, padding: '1px 6px', border: `1px solid ${resolveColor(pl)}44` }}>{pl.name}</span> : null; })()}
                            </div>
                          </button>
                          <button onClick={() => startEdit(sf.id, 'site')}
                            className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                            style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}
                            title="Edit shape"><PenLine size={15} style={{ color: '#A8D88A' }} /></button>
                          <button onClick={() => requestDelete(sf.id)}
                            className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                            style={pendingDelete === sf.id
                              ? { width: 'auto', padding: '0 10px', height: 38, borderRadius: 11, background: '#C0492A', border: '1px solid #C0492A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
                              : { width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}
                            title="Delete parcel">{pendingDelete === sf.id ? 'Sure?' : <Trash2 size={15} style={{ color: 'rgba(224,150,130,0.85)' }} />}</button>
                        </div>
                      ))}
                      <button onClick={() => startPinDraw('site')}
                        className="w-full flex items-center justify-center gap-2 font-sans font-bold active:scale-95"
                        style={{ fontSize: 14.5, height: 48, borderRadius: 13, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#A8D88A', cursor: 'pointer' }}>
                        <Plus size={17} />{t('parcelAddButton')}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5">
                      <button onClick={() => startPinDraw('site')}
                        className="w-full flex items-center justify-center gap-2 font-sans transition-all active:scale-95"
                        style={{ height: 52, borderRadius: 14, border: 'none', background: '#C07A1E', color: '#1a1205', fontSize: 15, fontWeight: 800, boxShadow: '0 6px 16px -6px rgba(192,122,30,0.7)', cursor: 'pointer' }}>
                        <PenTool size={19} strokeWidth={2} />{t('drawLandBoundaryButton')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Water harvesting — collapsible ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && !droppingWaterPoint && !droppingElement && (
            <div className="w-full">
              <button
                onClick={() => setSectionWater((o) => !o)}
                className="w-full flex items-center justify-between active:opacity-70 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 2px' }}>
                <div className="flex items-center gap-1.5">
                  <ChevronDown size={13} style={{ color: 'rgba(234,243,226,0.4)', transition: 'transform 0.2s', transform: sectionWater ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
                  <span className="font-sans" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                    {t('waterSectionLabel')}{waterStats ? ` · ${waterStats.count}` : ''}
                  </span>
                  {waterStats && <span className="font-sans" style={{ fontSize: 11.5, color: 'rgba(234,243,226,0.4)' }}>~{waterStats.estVolumeKL.toLocaleString()} kL</span>}
                </div>
              </button>
              {sectionWater && (
                <>
                  {waterStats ? (
                    <div className="w-full flex flex-col gap-1.5 mt-1.5">
                      {waterFeatures.map((wf, idx) => (
                        <div key={wf.id} className="flex items-center gap-3 font-sans"
                          style={{ background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '13px 13px 13px 15px' }}>
                          <div className="flex-shrink-0 rounded-[4px]" style={{ width: 10, height: 34, background: WATER_PALETTE[wf.hatchIdx % WATER_PALETTE.length].edge }} />
                          <button onClick={() => openShapeNaming(wf.id, 'water')} className="flex-1 min-w-0 text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <div className="flex items-center gap-1.5" style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                              <span className="truncate">{wf.name || `${t('waterAreaDefaultName')} ${idx + 1}`}</span>
                              <PenLine size={13} style={{ color: 'rgba(234,243,226,0.4)', flexShrink: 0 }} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12.5, color: 'rgba(234,243,226,0.55)' }}>
                              <span>{wf.category ? `${wf.category} · ` : ''}~{wf.estVolumeKL.toLocaleString()} kL</span>
                              {wf.placeId && (() => { const pl = savedPins.find(p => p.id === wf.placeId); return pl ? <span style={{ fontSize: 10.5, fontWeight: 700, color: resolveColor(pl), background: `${resolveColor(pl)}22`, borderRadius: 6, padding: '1px 6px', border: `1px solid ${resolveColor(pl)}44` }}>{pl.name}</span> : null; })()}
                            </div>
                          </button>
                          <button onClick={() => startEdit(wf.id, 'water')}
                            className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                            style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}
                            title="Edit shape"><PenLine size={15} style={{ color: '#7CC6F2' }} /></button>
                          <button onClick={() => requestDelete(wf.id)}
                            className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                            style={pendingDelete === wf.id
                              ? { width: 'auto', padding: '0 10px', height: 38, borderRadius: 11, background: '#C0492A', border: '1px solid #C0492A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
                              : { width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}
                            title="Delete area">{pendingDelete === wf.id ? 'Sure?' : <Trash2 size={15} style={{ color: 'rgba(224,150,130,0.85)' }} />}</button>
                        </div>
                      ))}
                      {/* Water infrastructure points */}
                      {waterPoints.length > 0 && (
                        <div>
                          <div className="font-sans mb-1.5" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.4)', paddingLeft: 2 }}>{t('waterInfrastructureSectionLabel')}</div>
                          {waterPoints.map((wp) => (
                            <div key={wp.id} className="flex items-center gap-3 font-sans mb-1.5"
                              style={{ background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '10px 13px 10px 15px' }}>
                              <div className="flex-shrink-0 rounded-full" style={{ width: 10, height: 10, background: categoryColor(wp.category) }} />
                              <div className="flex-1 min-w-0">
                                <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: '#EAF3E2' }}>{wp.name || wp.category || t('waterPointAddButton')}</div>
                                {wp.category && wp.name && <div style={{ fontSize: 12, color: 'rgba(234,243,226,0.5)' }}>{wp.category}</div>}
                              </div>
                              <button onClick={() => { setWaterPointNaming(wp); setWpName(wp.name); setWpCategory(wp.category); }}
                                className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                                style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}>
                                <PenLine size={15} style={{ color: '#7CC6F2' }} />
                              </button>
                              <button onClick={() => { deleteWaterPoint(wp.id); setWaterPoints(loadWaterPoints()); }}
                                className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                                style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}>
                                <Trash2 size={15} style={{ color: 'rgba(224,150,130,0.85)' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => startPinDraw('water')}
                          className="flex-1 flex items-center justify-center gap-2 font-sans font-bold active:scale-95"
                          style={{ fontSize: 14, height: 48, borderRadius: 13, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#7CC6F2', cursor: 'pointer' }}>
                          <Plus size={16} />{t('waterAreaAddButton')}
                        </button>
                        <button onClick={() => setDroppingWaterPoint(true)}
                          className="flex-1 flex items-center justify-center gap-2 font-sans font-bold active:scale-95"
                          style={{ fontSize: 14, height: 48, borderRadius: 13, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#7CC6F2', cursor: 'pointer' }}>
                          <Pipette size={16} />{t('waterPointAddButton')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={() => startPinDraw('water')}
                        className="flex-1 flex items-center justify-center gap-2 font-sans font-bold transition-all active:scale-95"
                        style={{ height: 48, borderRadius: 13, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#7CC6F2', fontSize: 14, cursor: 'pointer' }}>
                        <Droplets size={16} strokeWidth={2} />{t('waterAreaAddButton')}
                      </button>
                      <button onClick={() => setDroppingWaterPoint(true)}
                        className="flex-1 flex items-center justify-center gap-2 font-sans font-bold active:scale-95"
                        style={{ height: 48, borderRadius: 13, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', color: '#7CC6F2', fontSize: 14, cursor: 'pointer' }}>
                        <Pipette size={16} />{t('waterPointAddButton')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Site Elements — collapsible palette of placeable infrastructure icons ── */}
          {!activeDraw && !editingFeatureId && !pinDraw && !editPin && !droppingWaterPoint && !droppingElement && (
            <div className="w-full">
              <button
                onClick={() => setSectionElements((o) => !o)}
                className="w-full flex items-center justify-between active:opacity-70 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 2px' }}>
                <div className="flex items-center gap-1.5">
                  <ChevronDown size={13} style={{ color: 'rgba(234,243,226,0.4)', transition: 'transform 0.2s', transform: sectionElements ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
                  <span className="font-sans" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,243,226,0.5)' }}>
                    Site Elements{siteElements.length ? ` · ${siteElements.length}` : ''}
                  </span>
                </div>
              </button>
              {sectionElements && (
                <div className="w-full flex flex-col gap-1.5 mt-1.5">
                  {/* Palette — tap an icon to arm reticle-drop mode for that element type */}
                  <div className="flex flex-wrap gap-1.5">
                    {ELEMENT_TYPES.map((type) => {
                      const meta = getElementMeta(type);
                      return (
                        <button key={type} onClick={() => setDroppingElement(type)}
                          title={meta.label}
                          className="flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                          style={{ width: 60, height: 56, borderRadius: 13, background: 'rgba(247,242,233,0.07)', border: `1px solid ${meta.color}55`, cursor: 'pointer' }}>
                          <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">{meta.icon}</span>
                          <span className="font-sans text-center px-0.5" style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(234,243,226,0.65)', lineHeight: 1.15 }}>
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Placed elements list */}
                  {siteElements.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      {siteElements.map((el) => {
                        const meta = getElementMeta(el.type);
                        return (
                          <div key={el.id} className="flex items-center gap-3 font-sans"
                            style={{ background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', borderRadius: 14, padding: '10px 10px 10px 12px' }}>
                            <button onClick={() => openElementEditor(el)}
                              title="Edit name or note"
                              className="flex items-center justify-center flex-shrink-0 active:scale-90 transition-all rounded-[9px]"
                              style={{ width: 36, height: 36, background: meta.color, cursor: 'pointer', border: 'none', fontSize: 16 }}>
                              <span aria-hidden="true">{meta.icon}</span>
                            </button>
                            <button
                              onClick={() => openElementEditor(el)}
                              className="flex-1 min-w-0 text-left transition-all"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <div className="truncate" style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{el.label || meta.label}</div>
                              {(() => {
                                const detail = el.type === 'jojo_tank' && el.litres
                                  ? `${el.litres.toLocaleString()} L`
                                  : el.type === 'tree' && el.species
                                    ? `${el.species}${el.count && el.count > 1 ? ` ×${el.count}` : ''}`
                                    : el.note;
                                return detail ? <div className="truncate" style={{ fontSize: 12.5, color: 'rgba(234,243,226,0.55)' }}>{detail}</div> : null;
                              })()}
                            </button>
                            <button onClick={() => requestDeleteElement(el.id)}
                              aria-label={`Delete ${el.label || meta.label}`} title="Delete this element"
                              className="flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                              style={pendingDeleteElement === el.id
                                ? { width: 'auto', padding: '0 10px', height: 38, borderRadius: 11, background: '#C0492A', border: '1px solid #C0492A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
                                : { width: 38, height: 38, borderRadius: 11, background: 'rgba(247,242,233,0.08)', border: '1px solid rgba(234,243,226,0.16)', cursor: 'pointer' }}>
                              {pendingDeleteElement === el.id ? 'Sure?' : <Trash2 size={15} style={{ color: 'rgba(224,150,130,0.85)' }} />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              className="flex items-center gap-[11px] w-full font-sans transition-all active:scale-[0.98]"
              style={{ background: 'rgba(22,30,18,0.86)', backdropFilter: 'blur(16px)', border: '1px solid rgba(168,216,138,0.28)', borderRadius: 15, padding: '9px 14px 9px 9px', boxShadow: '0 14px 36px -12px rgba(0,0,0,0.6)', cursor: 'pointer' }}>
              <div className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 42, height: 42, background: '#2E6B3A' }}>
                <Sprout size={18} strokeWidth={1.8} style={{ color: '#CDEBB6' }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#EAF3E2', lineHeight: 1.25 }}>{t('askLimaButton')}</div>
                <div style={{ fontSize: 12, color: 'rgba(234,243,226,0.5)', lineHeight: 1.3 }}>{t('askLimaSubtitle')}</div>
              </div>
              <ChevronRight size={18} style={{ color: 'rgba(234,243,226,0.4)', flexShrink: 0 }} />
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
          title={t('zoomInTitle')} aria-label={t('zoomInAriaLabel')}
        >+</button>

        {/* Vertical fill bar — shows current zoom, not draggable */}
        <div className="relative rounded-full overflow-hidden" style={{ width: 5, height: 84, background: 'rgba(234,243,226,0.16)' }}>
          <div className="absolute left-0 right-0 bottom-0 rounded-full" style={{
            height: `${Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100)}%`,
            background: '#A8D88A',
          }} />
        </div>

        <button
          onClick={() => mapRef.current?.zoomTo(Math.max(MIN_ZOOM, zoom - 1), { duration: 300 })}
          className="rounded-lg flex items-center justify-center leading-none transition-all active:scale-90"
          style={{ width: 40, height: 40, fontSize: 22, background: 'transparent', border: 'none', color: '#EAF3E2' }}
          title={t('zoomOutTitle')} aria-label={t('zoomOutAriaLabel')}
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
            border: '1px solid rgba(234,243,226,0.16)',
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
            {t('firstTapHint')}
          </span>
        </div>
      )}

      {/* ── Labels pill — visible when panel is minimised (section headers carry toggles when panel is open) ── */}
      {toolbarMin && !pinDraw && !editPin && (siteFeatures.length > 0 || waterFeatures.length > 0 || savedPins.length > 0) && (
        <div className="absolute flex items-center gap-1 font-sans transition-all"
          style={{ top: 14, right: 14, zIndex: 10, background: 'rgba(16,22,14,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: 999, padding: '5px 8px 5px 11px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(234,243,226,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 2 }}>{t('labelsPillHeader')}</span>
          {(siteFeatures.length > 0 || waterFeatures.length > 0) && (<>
            {/* Shapes — show/hide all drawn polygon boundaries + hatching */}
            <button onClick={() => setShowFeatures((v) => !v)}
              className="flex items-center gap-1 active:scale-95 transition-all"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>
              <Square size={11} style={{ color: showFeatures ? '#9BE66B' : 'rgba(234,243,226,0.35)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: showFeatures ? '#EAF3E2' : 'rgba(234,243,226,0.35)' }}>{t('labelsShapesToggle')}</span>
              <span className="flex items-center rounded-full flex-shrink-0"
                style={{ width: 26, height: 15, padding: 2, background: showFeatures ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showFeatures ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: showFeatures ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
              </span>
            </button>
            {/* Hatching — show/hide fill pattern while keeping border lines */}
            {showFeatures && (
              <button onClick={() => setShowHatch((v) => !v)}
                className="flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>
                <Grid size={11} style={{ color: showHatch ? '#9BE66B' : 'rgba(234,243,226,0.35)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: showHatch ? '#EAF3E2' : 'rgba(234,243,226,0.35)' }}>{t('labelsHatchToggle')}</span>
                <span className="flex items-center rounded-full flex-shrink-0"
                  style={{ width: 26, height: 15, padding: 2, background: showHatch ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showHatch ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: showHatch ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                </span>
              </button>
            )}
            {/* Labels chip — only shown when shapes are visible */}
            {showFeatures && (
              <button onClick={() => setShowShapeLabels((v) => !v)}
                className="flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>
                <Layers size={11} style={{ color: showShapeLabels ? '#9BE66B' : 'rgba(234,243,226,0.35)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: showShapeLabels ? '#EAF3E2' : 'rgba(234,243,226,0.35)' }}>{t('labelsParcelsAndWaterToggle')}</span>
                <span className="flex items-center rounded-full flex-shrink-0"
                  style={{ width: 26, height: 15, padding: 2, background: showShapeLabels ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showShapeLabels ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: showShapeLabels ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                </span>
              </button>
            )}
          </>)}
          {savedPins.length > 0 && (
            <>
              {(siteFeatures.length > 0 || waterFeatures.length > 0) && <div style={{ width: 1, height: 18, background: 'rgba(234,243,226,0.1)' }} />}
              <button onClick={() => setShowPlaceLabels((v) => !v)}
                className="flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>
                <MapPin size={11} style={{ color: showPlaceLabels ? '#9BE66B' : 'rgba(234,243,226,0.35)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: showPlaceLabels ? '#EAF3E2' : 'rgba(234,243,226,0.35)' }}>{t('labelsPlacesToggle')}</span>
                <span className="flex items-center rounded-full flex-shrink-0"
                  style={{ width: 26, height: 15, padding: 2, background: showPlaceLabels ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showPlaceLabels ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: showPlaceLabels ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                </span>
              </button>
            </>
          )}
          {people && people.length > 0 && onTogglePeople && (
            <>
              <div style={{ width: 1, height: 18, background: 'rgba(234,243,226,0.1)' }} />
              <button onClick={onTogglePeople}
                className="flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>
                <Sprout size={11} style={{ color: showPeople ? '#9BE66B' : 'rgba(234,243,226,0.35)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: showPeople ? '#EAF3E2' : 'rgba(234,243,226,0.35)' }}>{t('labelsPeopleToggle')}</span>
                <span className="flex items-center rounded-full flex-shrink-0"
                  style={{ width: 26, height: 15, padding: 2, background: showPeople ? '#1F4D2B' : 'rgba(234,243,226,0.12)', justifyContent: showPeople ? 'flex-end' : 'flex-start', transition: 'all 0.2s' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: showPeople ? '#9BE66B' : 'rgba(234,243,226,0.5)', display: 'block', transition: 'all 0.2s' }} />
                </span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Floating shape chips — placed outside the GLOBAL site bbox, plus optional place-name bubble ── */}
      {showFeatures && !pinDraw && !editPin && map && (() => {
        const CHIP_W = 160, CHIP_H = 34, PAD = 10;
        const container = map.getContainer();
        const CW = container?.clientWidth ?? 800;
        const CH = container?.clientHeight ?? 600;

        // Global bbox across all site + water features
        let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
        const allFeatureBboxes = [
          ...siteFeatures.filter(sf => sf.centroid).map(sf => sf.bbox),
          ...waterFeatures.filter(wf => wf.centroid).map(wf => wf.bbox),
        ];
        for (const bb of allFeatureBboxes) {
          const sw = map.project([bb[0], bb[1]]);
          const ne = map.project([bb[2], bb[3]]);
          gMinX = Math.min(gMinX, sw.x, ne.x);
          gMaxX = Math.max(gMaxX, sw.x, ne.x);
          gMinY = Math.min(gMinY, sw.y, ne.y);
          gMaxY = Math.max(gMaxY, sw.y, ne.y);
        }
        if (!isFinite(gMinX)) return null; // no features

        // Build a unified list of chips with computed positions
        const chips: Array<{
          id: string; type: 'land' | 'water';
          cx: number; cy: number;       // chip centre (screen px)
          anchorX: number; anchorY: number;  // polygon centroid (screen px)
          inside: boolean;              // always false now
          label: string; sub: string;
        }> = [];

        const placeChip = (
          centroid: [number, number],
          _bbox: [number, number, number, number],
          type: 'land' | 'water',
          id: string, label: string, sub: string,
        ) => {
          const cp = map.project(centroid);
          // Find nearest edge of the GLOBAL bbox and push chip there
          const edges = [
            { dist: gMaxX - cp.x, cx: gMaxX + PAD + CHIP_W / 2, cy: cp.y },
            { dist: cp.x - gMinX, cx: gMinX - PAD - CHIP_W / 2, cy: cp.y },
            { dist: cp.y - gMinY, cx: cp.x,                      cy: gMinY - PAD - CHIP_H / 2 },
            { dist: gMaxY - cp.y, cx: cp.x,                      cy: gMaxY + PAD + CHIP_H / 2 },
          ].sort((a, b) => a.dist - b.dist);

          let cx = cp.x, cy = cp.y;
          for (const e of edges) {
            if (e.cx + CHIP_W / 2 < CW - 8 && e.cx - CHIP_W / 2 > 8 && e.cy + CHIP_H / 2 < CH - 60 && e.cy - CHIP_H / 2 > 8) {
              cx = e.cx; cy = e.cy; break;
            }
          }
          chips.push({ id, type, cx, cy, anchorX: cp.x, anchorY: cp.y, inside: false, label, sub });
        };

        for (const sf of siteFeatures) {
          if (sf.centroid) placeChip(sf.centroid, sf.bbox, 'land', sf.id, sf.name || 'Parcel', `${sf.areaHa} ha`);
        }
        for (const wf of waterFeatures) {
          if (wf.centroid) placeChip(wf.centroid, wf.bbox, 'water', wf.id, wf.name || 'Water', `${wf.estVolumeKL.toLocaleString()} kL`);
        }

        // Overlap resolution — push colliding chips apart vertically (3 passes)
        chips.sort((a, b) => a.cy - b.cy);
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 0; i < chips.length - 1; i++) {
            const a = chips[i], b = chips[i + 1];
            if (Math.abs(a.cx - b.cx) < CHIP_W + 6) {
              const gap = b.cy - a.cy;
              const needed = CHIP_H + 6;
              if (gap < needed) {
                const push = (needed - gap) / 2 + 1;
                a.cy -= push;
                b.cy += push;
              }
            }
          }
        }

        return (
          <>
            {/* Place-name bubble — outside the site to the right (or left if right is off-screen) */}
            {showPlaceLabels && (() => {
              const NAME_W = 196, NAME_H = 34;
              const pinsWithSite = savedPins.filter(p =>
                siteFeatures.some(sf => sf.placeId === p.id) || waterFeatures.some(wf => wf.placeId === p.id)
              );
              return pinsWithSite.map(p => {
                // right-side preferred; fall back to left if it would clip the viewport
                const rightX = gMaxX + PAD + NAME_W / 2;
                const leftX  = gMinX - PAD - NAME_W / 2;
                const pnX = (rightX + NAME_W / 2 < CW - 8) ? rightX : leftX;
                const pnY = gMinY + NAME_H / 2 + PAD;
                return (
                  // MUST stay clickable: this overlay is the VISIBLE place label when a place
                  // has linked features (the Marker label is hidden then). Clicking it zooms to
                  // the place + loads its report. Do NOT re-add `pointer-events-none` here —
                  // that silently breaks "tap the place label to open it" (a recurring regression).
                  <button key={`pname-${p.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (movingPin) return;
                      mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 17, duration: 900 });
                      onLocationSelect(p.lat, p.lon);
                      onPlaceSelect?.({ name: p.name, id: p.id });
                    }}
                    className="absolute select-none font-display font-bold whitespace-nowrap"
                    style={{
                      left: pnX,
                      top: pnY,
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(6,16,10,0.90)',
                      border: `1.5px solid ${resolveColor(p)}`,
                      borderRadius: 10,
                      padding: '4px 12px',
                      fontSize: 13,
                      color: '#fff',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                      zIndex: 8,
                      cursor: 'pointer',
                    }}>
                    {p.name}
                  </button>
                );
              });
            })()}

            {/* SVG leader lines + chip divs — only when showShapeLabels is on */}
            {showShapeLabels && (<>
              {/* SVG leader lines (always outside now) */}
              <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 6 }}>
                {chips.map(c => (
                  <g key={c.id}>
                    <line
                      x1={c.anchorX} y1={c.anchorY} x2={c.cx} y2={c.cy}
                      stroke={c.type === 'land' ? 'rgba(155,230,107,0.5)' : 'rgba(124,198,242,0.5)'}
                      strokeWidth="1.5" strokeDasharray="3 3"
                    />
                    <circle cx={c.anchorX} cy={c.anchorY} r="4"
                      fill={c.type === 'land' ? '#9BE66B' : '#7CC6F2'} stroke="#0d1f12" strokeWidth="1.5" />
                  </g>
                ))}
              </svg>

              {/* Chip divs */}
              {chips.map(c => (
                <div key={c.id} className="absolute pointer-events-none select-none flex items-center gap-1.5"
                  style={{
                    left: c.cx, top: c.cy, transform: 'translate(-50%,-50%)',
                    background: c.type === 'land' ? '#1F4D2B' : '#235E86',
                    border: `1.5px solid ${c.type === 'land' ? '#9BE66B' : '#7CC6F2'}`,
                    borderRadius: 999, padding: '5px 12px 5px 5px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
                    zIndex: 7, whiteSpace: 'nowrap',
                  }}>
                  <span className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: 24, height: 24, background: c.type === 'land' ? 'rgba(46,107,58,0.9)' : 'rgba(27,74,120,0.9)' }}>
                    {c.type === 'land'
                      ? <Home size={13} strokeWidth={2} style={{ color: '#9BE66B' }} />
                      : <Droplets size={13} strokeWidth={2} style={{ color: '#7CC6F2' }} />}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{c.label}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 3 }}>{c.sub}</span>
                </div>
            ))}
            </>)}
          </>
        );
      })()}

      {/* ── Save-place naming sheet — name it + pick a label (sets the pin colour) ── */}
      {namingPlace && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setNamingPlace(null)} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[71] w-full"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} style={{ color: resolveColor({ label: placeLabel, color: customPlaceColor || undefined }) }} />
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{editingPlaceId ? t('savePlaceSheetTitleEdit') : t('savePlaceSheetTitleNew')}</span>
              </div>
              <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} autoFocus
                placeholder="Name it — e.g. Home plot"
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-3"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="text-xs font-sans uppercase tracking-wider mb-2" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>Label</div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PLACE_LABELS.map((l) => {
                  const on = placeLabel === l.v && !customPlaceColor;
                  return (
                    <button key={l.v} onClick={() => { setPlaceLabel(l.v); setCustomPlaceColor(''); }}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold transition-all"
                      style={{ fontSize: 12, background: on ? l.color : 'rgba(226,216,196,0.4)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? l.color : '#E2D8C4'}`, cursor: 'pointer' }}>
                      <MapPin size={16} style={{ color: on ? '#fff' : l.color }} />{l.name}
                    </button>
                  );
                })}
              </div>
              {/* Custom pin colour */}
              <div className="flex items-center gap-2 mb-4">
                <span style={{ fontSize: 12, color: '#8C7A62', fontWeight: 600 }}>Custom colour</span>
                <label className="flex items-center gap-2 flex-1 rounded-xl cursor-pointer transition-all"
                  style={{ padding: '6px 10px', background: customPlaceColor ? `${customPlaceColor}22` : 'rgba(226,216,196,0.3)', border: `1.5px solid ${customPlaceColor || '#E2D8C4'}` }}>
                  <input type="color" value={customPlaceColor || placeColor(placeLabel)} onChange={(e) => setCustomPlaceColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer" style={{ border: 'none', background: 'transparent', padding: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: customPlaceColor ? '#20190F' : '#8C7A62' }}>
                    {customPlaceColor ? customPlaceColor.toUpperCase() : 'Pick a colour'}
                  </span>
                  {customPlaceColor && (
                    <button onClick={(e) => { e.preventDefault(); setCustomPlaceColor(''); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62', fontSize: 18, lineHeight: 1 }}>×</button>
                  )}
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNamingPlace(null)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={confirmSavePlace}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#1F4D2B', border: 'none', color: '#F7F2E9', cursor: 'pointer' }}>
                  <Check size={15} />{t('savePlaceConfirmButton')}
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
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                {shapeNaming.type === 'water'
                  ? <Droplets size={16} style={{ color: '#235E86' }} />
                  : <PenTool size={16} style={{ color: '#1F4D2B' }} />}
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                  Name your {shapeNaming.type === 'water' ? 'harvesting area' : 'land'}
                </span>
              </div>
              <input value={shapeName} onChange={(e) => setShapeName(e.target.value)} autoFocus
                placeholder={shapeNaming.type === 'water' ? 'e.g. Main roof, North swale' : 'e.g. Home plot'}
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
              {savedPins.length > 0 && (
                <>
                  <div className="text-xs font-sans uppercase tracking-wider mb-2" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>Link to place (optional)</div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {savedPins.map((pin) => {
                      const on = shapeNamePlaceId === pin.id;
                      return (
                        <button key={pin.id} onClick={() => setShapeNamePlaceId(on ? null : pin.id)}
                          className="flex items-center gap-1.5 rounded-full font-sans font-semibold transition-all"
                          style={{ fontSize: 12.5, padding: '5px 12px 5px 8px', background: on ? resolveColor(pin) : 'rgba(226,216,196,0.4)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? resolveColor(pin) : '#E2D8C4'}`, cursor: 'pointer' }}>
                          <MapPin size={12} style={{ color: on ? '#fff' : resolveColor(pin) }} />
                          {pin.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShapeNaming(null)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
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

      {/* ── Water infrastructure point naming sheet ── */}
      {waterPointNaming && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setWaterPointNaming(null)} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[71] w-full"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Pipette size={16} style={{ color: '#235E86' }} />
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                  Name your water point
                </span>
              </div>
              <input value={wpName} onChange={(e) => setWpName(e.target.value)} autoFocus
                placeholder="e.g. Main borehole, North dam"
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-3"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="text-xs font-sans uppercase tracking-wider mb-2" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>What type?</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {WATER_POINT_CATEGORIES.map((c) => {
                  const on = wpCategory === c.v;
                  return (
                    <button key={c.v} onClick={() => setWpCategory(on ? '' : c.v)}
                      className="px-3 py-2 rounded-xl font-sans font-semibold transition-all"
                      style={{ fontSize: 13, background: on ? c.color : 'rgba(226,216,196,0.4)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? c.color : '#E2D8C4'}`, cursor: 'pointer' }}>
                      {c.v}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  deleteWaterPoint(waterPointNaming.id);
                  setWaterPoints(loadWaterPoints());
                  setWaterPointNaming(null);
                }}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#C0492A', cursor: 'pointer' }}>
                  Delete
                </button>
                <button onClick={() => setWaterPointNaming(null)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Skip
                </button>
                <button onClick={() => {
                  const updated: WaterPoint = { ...waterPointNaming, name: wpName.trim(), category: wpCategory as WaterPoint['category'] };
                  saveWaterPoint(updated);
                  setWaterPoints(loadWaterPoints());
                  setWaterPointNaming(null);
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#235E86', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Check size={15} />Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Site element rename/note sheet (mirrors the water point naming sheet) ── */}
      {elementEditing && (
        <>
          <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(6,16,10,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => { setElementEditing(null); setPendingDeleteElement(null); }} aria-hidden="true" />
          <div className="fixed left-1/2 -translate-x-1/2 z-[71] w-full"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', maxWidth: 'min(420px, calc(100vw - 24px))' }}>
            <div className="rounded-2xl p-4 font-sans" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 -4px 24px rgba(32,25,15,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">{getElementMeta(elementEditing.type).icon}</span>
                <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                  {getElementMeta(elementEditing.type).label}
                </span>
              </div>
              <input value={elName} onChange={(e) => setElName(e.target.value)} autoFocus
                placeholder={`e.g. ${getElementMeta(elementEditing.type).label}`}
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-3"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />

              {elementEditing.type === 'jojo_tank' && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {TANK_SIZE_OPTIONS_L.map((l) => (
                      <button key={l} type="button" onClick={() => { setElLitres(l); setElTankCustomOpen(false); }}
                        className="px-3 py-1.5 rounded-full font-sans font-semibold"
                        style={elLitres === l ? { fontSize: 13, background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff', cursor: 'pointer' } : { fontSize: 13, background: '#fff', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                        {l.toLocaleString()} L
                      </button>
                    ))}
                    <button type="button" onClick={() => setElTankCustomOpen((o) => !o)}
                      className="px-3 py-1.5 rounded-full font-sans font-semibold"
                      style={elTankCustomOpen ? { fontSize: 13, background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff', cursor: 'pointer' } : { fontSize: 13, background: '#fff', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                      Custom
                    </button>
                  </div>
                  {elTankCustomOpen && (
                    <input type="number" min={0} step={100} value={elLitres ?? ''}
                      onChange={(e) => setElLitres(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder="litres" autoFocus
                      className="w-full font-sans rounded-xl px-3 py-2 outline-none"
                      style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
                  )}
                </div>
              )}

              {elementEditing.type === 'tree' && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {TREE_SPECIES_OPTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => { setElSpecies(s); setElTreeCustomOpen(false); }}
                        className="px-3 py-1.5 rounded-full font-sans font-semibold"
                        style={elSpecies === s ? { fontSize: 13, background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff', cursor: 'pointer' } : { fontSize: 13, background: '#fff', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                        {s}
                      </button>
                    ))}
                    <button type="button" onClick={() => { setElTreeCustomOpen((o) => !o); setElSpecies(''); }}
                      className="px-3 py-1.5 rounded-full font-sans font-semibold"
                      style={elTreeCustomOpen ? { fontSize: 13, background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff', cursor: 'pointer' } : { fontSize: 13, background: '#fff', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                      Other
                    </button>
                  </div>
                  {elTreeCustomOpen && (
                    <input type="text" value={elSpecies} onChange={(e) => setElSpecies(e.target.value)}
                      placeholder="species name" autoFocus
                      className="w-full font-sans rounded-xl px-3 py-2 outline-none mb-1.5"
                      style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
                  )}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="font-sans" style={{ fontSize: 13, color: '#9A8268' }}>how many</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setElCount((c) => Math.max(1, c - 1))}
                        className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: '#FFFEFA', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                        <Minus size={14} />
                      </button>
                      <span className="font-sans font-semibold w-6 text-center" style={{ fontSize: 15, color: '#20190F' }}>{elCount}</span>
                      <button type="button" onClick={() => setElCount((c) => c + 1)}
                        className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: '#FFFEFA', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input value={elNote} onChange={(e) => setElNote(e.target.value)}
                placeholder="Note — e.g. leaking, needs new tap"
                className="w-full font-sans rounded-xl px-3 py-2.5 outline-none mb-4"
                style={{ fontSize: 15, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="flex gap-2">
                <button onClick={() => requestDeleteElement(elementEditing.id)}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={pendingDeleteElement === elementEditing.id
                    ? { fontSize: 14, background: '#C0492A', border: '1px solid #C0492A', color: '#fff', cursor: 'pointer' }
                    : { fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#C0492A', cursor: 'pointer' }}>
                  {pendingDeleteElement === elementEditing.id ? 'Sure?' : 'Delete'}
                </button>
                <button onClick={() => { setElementEditing(null); setPendingDeleteElement(null); }}
                  className="px-4 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Skip
                </button>
                <button onClick={() => {
                  const updated: SiteElement = {
                    ...elementEditing,
                    label: elName.trim() || undefined,
                    note: elNote.trim() || undefined,
                    litres: elementEditing.type === 'jojo_tank' ? elLitres : elementEditing.litres,
                    species: elementEditing.type === 'tree' ? (elSpecies.trim() || undefined) : elementEditing.species,
                    count: elementEditing.type === 'tree' ? elCount : elementEditing.count,
                  };
                  saveSiteElement(siteIdForElements, updated);
                  setSiteElements(loadSiteElements(siteIdForElements));
                  setElementEditing(null);
                  setPendingDeleteElement(null);
                }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-sans font-semibold" style={{ fontSize: 14, background: getElementMeta(elementEditing.type).color, border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <Check size={15} />Save
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
            <div className="rounded-2xl p-5 font-sans" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 12px 40px rgba(32,25,15,0.28)' }}>
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
                  [Droplets, 'Draw harvesting area', 'Outline your roof, swale or earthwork — I calculate how much rain it collects.'],
                  [Pipette, 'Add water point', 'Drop a pin on a borehole, spring, dam or tank — marks infrastructure on the map.'],
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
