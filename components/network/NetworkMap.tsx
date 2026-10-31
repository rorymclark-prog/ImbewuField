'use client';

/**
 * NetworkMap — the funder portfolio map.
 *
 * A map of every farmer site in the portfolio, zoomable from a provincial
 * overview (KwaZulu-Natal) down to an individual homestead plot. Clicking a
 * pin selects that farmer and opens the detail panel.
 *
 * ── WHAT THE PINS ENCODE (and why only these) ───────────────────────────────
 * Every visual channel here is driven by a field that CANNOT be null:
 *
 *   colour → NetworkFarmer.status      ('thriving' | 'establishing' | 'support')
 *   area   → NetworkFarmer.plotSizeM2  (circle AREA ∝ m², so diameter ∝ √m²)
 *   ring   → attentionFlags(row).length > 0
 *
 * Both `status` and `plotSizeM2` are portfolio metadata that every row carries.
 * Production, income and progress are DELIBERATELY not encoded in the pin:
 * they are nullable (`null` = "this viewer may not read it"), and a null
 * rendered as a small or pale pin would silently read as "this farmer grew
 * nothing" — the exact misreading lib/network.ts warns about. Those figures
 * appear as numbers in the panel, where "no data" can say so in words.
 *
 * ── SECURITY: THIS VIEW IS DEMO-ONLY, AND THAT IS NOT AN OVERSIGHT ──────────
 * It renders DEMO_NETWORK (lib/network-demo.ts) and nothing else. There is no
 * Firestore read in this file, deliberately.
 *
 * A funder in org A cannot read a farmer in org B under the rules as deployed:
 * gardens and the money collections are all scoped to `sameOrg()`, so a real
 * cross-account read here would either be denied at runtime (a broken demo) or,
 * if it ever succeeded, be a data breach. Before this view may show one real
 * user's data to another, ALL of the following must be true:
 *
 *   1. An explicit funder↔garden GRANT model exists (e.g. `funder_org_ids` on
 *      Garden, or a `/grants` join walked server-side). Never client-inferred.
 *   2. A server-side gate (route handler / Cloud Function using firebase-admin)
 *      verifies the caller's ID token, loads their profile, asserts
 *      role ∈ {funder, ngo, admin} AND that the grant covers this farmer, and
 *      returns only the derived projection — never raw docs. Note that
 *      lib/api-auth.ts is log-only unless REQUIRE_API_AUTH=1 and performs no
 *      role or org check, so it is not sufficient on its own.
 *   3. firestore.rules is updated to match, with a case in
 *      tests/firestore-rules.test.ts, and deployed by a human.
 *   4. The farmer has consented (NetworkFarmer.consent) to a funder seeing
 *      their books, and consent is revocable.
 *   5. Coordinates: `coordPrecision: 'exact'` is a HOMESTEAD coordinate and is
 *      org-internal. This portfolio layer is org-internal (funder/NGO staff),
 *      so exact is correct HERE — but it must never be handed to a
 *      farmer-facing surface without coarsenFarmerLocation() first, and these
 *      pins must never share a layer or a source with the exchange pins.
 *      Mixing the two de-anonymises farmers who opted into the exchange only.
 *
 * Separately, and independent of this file: firestore.rules:254 allows ANY
 * account with role ngo|funder|admin — in ANY organisation — to read EVERY
 * survey_responses doc, with no org scoping. That is a live cross-tenant leak
 * on exactly the data this view wants to show, and it must be fixed before a
 * real funder account is issued. Rules are not agent-deployable; see the result
 * notes for the owner.
 *
 * Idioms match the app's existing maps: token/import convention and the
 * fly-to-select from components/atlas/AtlasExplorer.tsx, the marker +
 * stopPropagation click from components/community/NearbyMap.tsx, and the
 * status palette from components/NgoDashboard.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMapGL, {
  Marker,
  NavigationControl,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Maximize2, Info, MapPinOff, Plus, Minus } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { useLanguage } from '@/lib/i18n';
import { inlineText, isInlineDraftLang } from '@/lib/xh-inline';
import {
  attentionFlags,
  networkBounds,
  rollupBy,
  type NetworkFarmerSummary,
} from '@/lib/network';
import { DEMO_NETWORK_NOTICE, demoFarmerById } from '@/lib/network-demo';
import FarmerPanel from './FarmerPanel';
import { NETWORK_STATUS_COLOR } from './status-colors';
import type { GardenStatus } from '@/lib/db/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

/* Status palette — shared with the /network list (components/network/status-colors.ts) so the
 * map and the list never disagree about what "thriving" looks like. */
const STATUS = NETWORK_STATUS_COLOR;

/* Below this zoom the map shows one bubble per district municipality; above it,
 * one pin per farmer site. This is the "provincial overview → individual site"
 * transition, done with real rollups (named districts, real aggregates) rather
 * than Mapbox point clustering, which could only ever show a count. */
const SITE_ZOOM = 7.6;

// dark-03/staff-12: these five were literal hexes — a hard-coded paper slab and ink that stayed
// bright-paper-on-dark no matter the theme/mode, because a named const assigned a hex literal
// still IS a hex literal everywhere it is used. Pointing them at the existing theme tokens makes
// every call site below follow the theme automatically, with no call site edited.
const INK = 'var(--text-primary)';
const INK_SOFT = 'var(--text-secondary)';
const INK_MUTED = 'var(--text-muted)';
const LINE = 'var(--border)';
const PAPER = 'var(--bg-1)';
const PANEL = 'var(--bg-1)';
const ATTENTION = 'var(--orange)';

/** Space-grouped thousands (SA convention), locale-independent so SSR and the
 *  client never disagree. Only the legend needs it — every figure with a
 *  "no data" state is formatted by FarmerPanel.format.ts. */
function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ── pin geometry ───────────────────────────────────────────────────────── */
const PIN_MIN = 16;
const PIN_MAX = 36;

/** Diameter such that circle AREA is proportional to plot area. */
function pinDiameter(m2: number, minM2: number, maxM2: number): number {
  if (!(maxM2 > minM2)) return (PIN_MIN + PIN_MAX) / 2;
  const t =
    (Math.sqrt(Math.max(m2, 0)) - Math.sqrt(minM2)) /
    (Math.sqrt(maxM2) - Math.sqrt(minM2));
  return PIN_MIN + Math.min(Math.max(t, 0), 1) * (PIN_MAX - PIN_MIN);
}

export interface NetworkMapProps {
  /** Already filtered by the caller. Demo rows only — see the header. */
  rows: NetworkFarmerSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function NetworkMap({ rows, selectedId, onSelect }: NetworkMapProps) {
  const { lang } = useLanguage();
  const isiZulu = lang === 'zu';
  const baseCopy = isiZulu
    ? {
        thriving: 'Iyachuma', establishing: 'Iyasungulwa', support: 'Idinga ukwesekwa',
        zoomIn: 'Sondeza ngaphakathi', zoomOut: 'Sondeza ngaphandle',
        districtHint: 'Amasayithi aqoqwe ngezifunda — sondeza ukuze ubone isayithi ngalinye',
        fitAll: 'Bonisa wonke amasayithi', fitAllAria: 'Bonisa wonke amasayithi emephini',
        legend: 'Incazelo yezimpawu', colourStatus: 'UMBALA — isimo sesayithi',
        sizeArea: 'USAYIZI — indawo yesiza', ringAttention: 'IRINGI — idinga ukunakwa',
        attention: 'Ayisebenzi, ingaphansi kohlelo, noma yenza ukulahlekelwa',
        pinExplanation: 'Izimpawu zibonisa isimo nosayizi wesiza kuphela. Isivuno, imali engenayo nenqubekelaphambili kuboniswa kuphaneli; uma ingekho idatha, kuyashiwo.',
        farmer: 'Umlimi', closeFarmer: 'Vala iphaneli yomlimi',
        sourceLanguageNotice: 'Ezinye izincazelo zemininingwane yomlimi ngezansi zingase zisaboniswe ngesiNgisi. Amagama nobufakazi obufakiwe kuboniswa njengoba kuqoshwe.',
        // sdesk-08/desk-10/nav-14: new copy, pending first-language review — English stands in
        // for isiZulu here too rather than an unreviewed machine sentence (see this object's own
        // sourceLanguageNotice for the same convention).
        mapUnsupportedTitle: 'The map cannot open on this device',
        mapUnsupportedMessage: 'Farmer details still work from the list — open a farmer to see their panel.',
      }
    : {
        thriving: 'Thriving', establishing: 'Establishing', support: 'Needs support',
        zoomIn: 'Zoom in', zoomOut: 'Zoom out',
        districtHint: 'Grouped by district — zoom in for individual sites',
        fitAll: 'Fit all', fitAllAria: 'Zoom out to the whole portfolio',
        legend: 'Legend', colourStatus: 'COLOUR — site status',
        sizeArea: 'SIZE — plot area', ringAttention: 'RING — needs attention',
        attention: 'Dormant, under plan, or loss-making',
        pinExplanation: 'Pins show status and plot size only — both recorded for every site. Harvest, income and progress are in the panel, where “no data” can be said in words.',
        farmer: 'Farmer', closeFarmer: 'Close farmer panel',
        sourceLanguageNotice: 'Some farmer-detail descriptions may remain in English. Submitted names and evidence are shown as recorded.',
        mapUnsupportedTitle: 'The map cannot open on this device',
        mapUnsupportedMessage: 'Farmer details still work from the list — open a farmer to see their panel.',
      };
  // isiXhosa reads the English strings above through its drafts (keyed by the exact English).
  const copy = isInlineDraftLang(lang)
    ? (Object.fromEntries(Object.entries(baseCopy).map(([key, english]) => [key, inlineText(lang, english)])) as typeof baseCopy)
    : baseCopy;
  const mapRef = useRef<MapRef>(null);
  // sdesk-08/desk-10/nav-14: no WebGL used to leave this area a flat beige (light) or solid
  // black (dark) slab, with the zoom/legend controls still drawn as if a map were there. Checked
  // once — the capability does not change mid-session — same pattern as components/Map.tsx and
  // AtlasExplorer.tsx.
  const [mapSupported, setMapSupported] = useState(true);
  useEffect(() => {
    try { if (!mapboxgl.supported()) setMapSupported(false); }
    catch { setMapSupported(false); }
  }, []);
  const [zoom, setZoom] = useState(6.2);
  const [hoverId, setHoverId] = useState<string | null>(null);
  /* Collapsed by default on a phone, where the expanded card would cover most
   * of the map; open on a laptop, which is where the funder demo happens.
   * Safe to read `window` in the initialiser: this component is always mounted
   * via a dynamic import with `ssr: false`. */
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  );

  const localizeNavigationControls = useCallback(() => {
    const container = mapRef.current?.getMap().getContainer();
    if (!container) return;
    const zoomIn = container.querySelector<HTMLButtonElement>('.mapboxgl-ctrl-zoom-in');
    const zoomOut = container.querySelector<HTMLButtonElement>('.mapboxgl-ctrl-zoom-out');
    if (zoomIn) {
      zoomIn.setAttribute('aria-label', copy.zoomIn);
      zoomIn.title = copy.zoomIn;
    }
    if (zoomOut) {
      zoomOut.setAttribute('aria-label', copy.zoomOut);
      zoomOut.title = copy.zoomOut;
    }
  }, [copy.zoomIn, copy.zoomOut]);

  useEffect(() => {
    localizeNavigationControls();
  }, [localizeNavigationControls]);

  const selected = useMemo(
    () => rows.find((r) => r.farmer.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const bounds = useMemo(() => networkBounds(rows), [rows]);
  const districts = useMemo(() => rollupBy(rows, 'municipality'), [rows]);

  const [minM2, maxM2] = useMemo(() => {
    if (!rows.length) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r.farmer.plotSizeM2);
      hi = Math.max(hi, r.farmer.plotSizeM2);
    }
    return [lo, hi];
  }, [rows]);

  const fitAll = useCallback(
    (duration = 900) => {
      if (!bounds || !mapRef.current) return;
      mapRef.current.fitBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        { padding: { top: 70, bottom: 90, left: 60, right: 60 }, duration, maxZoom: 11 },
      );
    },
    [bounds],
  );

  /* Re-frame when the visible portfolio changes (e.g. a district filter), but
   * never yank the camera away from a farmer the user just opened. */
  const boundsKey = bounds
    ? `${rows.length}:${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`
    : `${rows.length}:none`;
  useEffect(() => {
    if (selectedId) return;
    fitAll();
  }, [boundsKey, selectedId, fitAll]);

  const focusSelected = useCallback((duration: number) => {
    const map = mapRef.current;
    if (!selected || !map) return;
    map.flyTo({
      center: [selected.farmer.lon, selected.farmer.lat],
      /* 12, not 15. These sites are in deep rural KZN, where the vector basemap
       * has almost nothing to draw past ~z13 — flying closer lands the demo on
       * a featureless grey rectangle. At 12 the site sits in legible context:
       * its town, the district roads, the terrain it farms. (Satellite would
       * show real field edges but degrades badly here — see the mapStyle note.) */
      zoom: 12,
      duration,
    });
  }, [selected]);

  /* Fly to the selected farmer — the zoom-in the portfolio view exists for. */
  useEffect(() => {
    focusSelected(1500);
  }, [focusSelected]);

  const showSites = zoom >= SITE_ZOOM;

  const maxDistrictCount = useMemo(
    () => districts.reduce((m, d) => Math.max(m, d.farmerCount), 0),
    [districts],
  );

  return (
    <div className="flex-1 flex overflow-hidden relative min-h-0">
      {/* ── Map ── */}
      <div
        className="flex-1 relative min-w-0"
        role="region"
        aria-label={isiZulu ? 'Imephu yamasayithi abalimi' : inlineText(lang, 'Farmer sites map')}
      >
        {mapSupported ? (
        <>
        <ReactMapGL
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          initialViewState={{ latitude: -28.6, longitude: 30.9, zoom: 6.2 }}
          /* outdoors-v12, as components/community/NearbyMap.tsx uses. Not
           * satellite: lib/basemap-imagery.ts documents that Mapbox satellite
           * over rural KZN degrades as you zoom in (z14 55.7 kB → z20 12.3 kB —
           * one coarse image upsampled), so the drill-in money shot would be a
           * red-brown smear. Vector terrain stays legible at every zoom and
           * carries the warm palette. */
          mapStyle="mapbox://styles/mapbox/outdoors-v12"
          style={{ width: '100%', height: '100%' }}
          onMove={(e: ViewStateChangeEvent) => setZoom(e.viewState.zoom)}
          /* If a farmer is already selected when the map finishes loading —
           * a deep link, or a click that beat the tiles — frame THEM. Fitting
           * the whole portfolio here would silently undo the selection and
           * drop the funder back to the provincial view mid-demo. */
          onLoad={() => {
            localizeNavigationControls();
            if (selected) focusSelected(0);
            else fitAll(0);
          }}
          onClick={() => onSelect(null)}
          cursor="default"
        >
          <NavigationControl position="top-right" showCompass={false} />

          {/* District municipality bubbles — the zoomed-out overview */}
          {!showSites &&
            districts.map((d) => {
              if (!d.centroid) return null;
              const size = pinDiameter(d.farmerCount, 1, Math.max(maxDistrictCount, 2)) + 6;
              return (
                <Marker
                  key={`district-${d.key}`}
                  latitude={d.centroid.lat}
                  longitude={d.centroid.lon}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    mapRef.current?.flyTo({
                      center: [d.centroid!.lon, d.centroid!.lat],
                      zoom: 9.2,
                      duration: 1300,
                    });
                  }}
                >
                  <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        background: 'rgba(31,77,43,0.90)',
                        border: '2.5px solid var(--on-forest)',
                        boxShadow: '0 3px 12px rgba(32,25,15,0.32)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--on-forest)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                      className="font-sans"
                    >
                      {d.farmerCount}
                    </div>
                    <span
                      className="font-display font-semibold"
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: INK,
                        background: 'color-mix(in srgb, var(--bg-1) 92%, transparent)',
                        border: `1px solid ${LINE}`,
                        borderRadius: 999,
                        padding: '1.5px 7px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.key}
                    </span>
                  </div>
                </Marker>
              );
            })}

          {/* Individual farmer sites */}
          {showSites &&
            rows.map((row) => {
              const { farmer } = row;
              const isSel = farmer.id === selectedId;
              const isHover = farmer.id === hoverId;
              const flags = attentionFlags(row);
              const needsAttention = flags.length > 0;
              const urgent = flags.some((f) => f.severity === 'urgent');
              const d = pinDiameter(farmer.plotSizeM2, minM2, maxM2) * (isSel ? 1.25 : 1);
              const colour = STATUS[farmer.status];

              return (
                <Marker
                  key={farmer.id}
                  latitude={farmer.lat}
                  longitude={farmer.lon}
                  anchor="center"
                  onClick={(e) => {
                    /* Required, or the map's own onClick immediately clears the
                     * selection — the gotcha NearbyMap.tsx documents. */
                    e.originalEvent.stopPropagation();
                    onSelect(farmer.id);
                  }}
                >
                  <div
                    onMouseEnter={() => setHoverId(farmer.id)}
                    onMouseLeave={() => setHoverId((c) => (c === farmer.id ? null : c))}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      title={`${farmer.name} · ${farmer.siteName}`}
                      style={{
                        width: d,
                        height: d,
                        borderRadius: '50%',
                        background: colour,
                        border: needsAttention
                          ? `3px solid ${urgent ? ATTENTION : '#E8B04B'}`
                          : '2.5px solid var(--on-forest)',
                        boxShadow: isSel
                          ? '0 0 0 4px rgba(31,77,43,0.22), 0 4px 14px rgba(32,25,15,0.38)'
                          : '0 2px 8px rgba(32,25,15,0.30)',
                        transition: 'width 140ms ease, height 140ms ease',
                      }}
                    />
                    {(isSel || isHover) && (
                      <span
                        className="font-display font-semibold"
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: INK,
                          background: 'color-mix(in srgb, var(--bg-1) 95%, transparent)',
                          border: `1px solid ${LINE}`,
                          borderRadius: 999,
                          padding: '2px 8px',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 8px rgba(32,25,15,0.16)',
                          pointerEvents: 'none',
                        }}
                      >
                        {farmer.name}
                      </span>
                    )}
                  </div>
                </Marker>
              );
            })}
        </ReactMapGL>

        {/* Zoom-level hint */}
        {!showSites && rows.length > 0 && (
          <div
            /* Second row on a phone — the "Fit all" button owns the top-left
             * corner and the two collide at 375px. */
            /* The isiZulu hint is ~70 characters: nowrap at 390px pushed it past the map's
             * right edge and gave the whole page a horizontal scroll. Let it wrap on a phone
             * and keep the single line from the sm breakpoint. */
            className="absolute top-14 sm:top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3.5 py-2 max-w-[calc(100%-24px)] sm:whitespace-nowrap"
            style={{
              background: 'color-mix(in srgb, var(--bg-1) 94%, transparent)',
              border: `1px solid ${LINE}`,
              borderRadius: 999,
              boxShadow: '0 4px 16px rgba(32,25,15,0.14)',
            }}
          >
            <Info size={14} style={{ color: 'var(--color-forest-800)', flexShrink: 0 }} />
            <span className="font-display" style={{ fontSize: 12.5, color: INK }}>
              {copy.districtHint}
            </span>
          </div>
        )}

        {/* Fit-to-portfolio */}
        <button
          onClick={() => {
            onSelect(null);
            fitAll();
          }}
          aria-label={copy.fitAllAria}
          className="absolute z-10 flex items-center gap-1.5 px-3 py-2 font-display font-semibold"
          style={{
            top: 12,
            left: 12,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            fontSize: 12.5,
            color: INK,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(32,25,15,0.12)',
          }}
        >
          <Maximize2 size={13} style={{ color: INK_SOFT }} />
          {copy.fitAll}
        </button>

        {/* ── Legend: says exactly what the pins encode ── */}
        <div
          className="absolute z-10"
          style={{
            /* staff-03/dark-03: used to be anchored low on the left, clear of the global
             * ChatWidget FAB's resting band only while collapsed — opening it grew the panel
             * upward (bottom-anchored) straight into that band. Top-right, below the
             * NavigationControl's zoom buttons, grows downward instead, so it can never land
             * on the FAB at any expansion height, on any route that mounts it there.
             * w22-08: the FAB now parks bottom-RIGHT on desktop, under this legend; the
             * isiZulu legend at 1024×768 grew down onto it. The height stops at the clearance
             * ChatWidget publishes (0 when the FAB is hidden) and the legend scrolls inside. */
            top: 100,
            right: 12,
            maxHeight: 'calc(100% - 100px - var(--lima-fab-clearance, 0px))',
            overflowY: 'auto',
            background: 'color-mix(in srgb, var(--bg-1) 96%, transparent)',
            border: `1px solid ${LINE}`,
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(32,25,15,0.14)',
            maxWidth: 236,
          }}
        >
          <button
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            aria-controls="network-map-legend"
            className="w-full flex items-center justify-between px-3 py-2 font-sans font-bold uppercase"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              letterSpacing: '0.1em',
              color: INK_MUTED,
            }}
          >
            <span>{copy.legend}</span>
            {legendOpen ? <Minus size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          </button>

          {legendOpen && (
            <div id="network-map-legend" className="px-3 pb-3" style={{ borderTop: `1px solid ${LINE}` }}>
              <div className="font-sans" style={{ fontSize: 12, color: INK_MUTED, margin: '8px 0 5px' }}>
                {copy.colourStatus}
              </div>
              {(Object.keys(STATUS) as GardenStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: STATUS[s],
                      border: '1.5px solid var(--on-forest)',
                      flexShrink: 0,
                    }}
                  />
                  <span className="font-sans" style={{ fontSize: 12, color: INK_SOFT }}>
                    {copy[s]}
                  </span>
                </div>
              ))}

              <div className="font-sans" style={{ fontSize: 12, color: INK_MUTED, margin: '9px 0 5px' }}>
                {copy.sizeArea}
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{ width: 10, height: 10, borderRadius: '50%', background: INK_SOFT, flexShrink: 0 }}
                />
                <span
                  style={{ width: 19, height: 19, borderRadius: '50%', background: INK_SOFT, flexShrink: 0 }}
                />
                <span className="font-sans" style={{ fontSize: 12, color: INK_SOFT }}>
                  {group(minM2)}–{group(maxM2)} m²
                </span>
              </div>

              <div className="font-sans" style={{ fontSize: 12, color: INK_MUTED, margin: '9px 0 5px' }}>
                {copy.ringAttention}
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: 'var(--color-forest-800)',
                    border: `3px solid ${ATTENTION}`,
                    flexShrink: 0,
                  }}
                />
                <span className="font-sans" style={{ fontSize: 12, color: INK_SOFT }}>
                  {copy.attention}
                </span>
              </div>

              <p
                className="font-sans"
                style={{ fontSize: 12, color: INK_MUTED, marginTop: 9, lineHeight: 1.45 }}
              >
                {copy.pinExplanation}
              </p>
            </div>
          )}
        </div>
        </>
        ) : (
          // sdesk-08/desk-10/nav-14: the farmer list this map sits beside still works without
          // a rendered globe, so point there rather than drawing zoom/legend controls over
          // nothing.
          <EmptyState
            className="h-full"
            icon={MapPinOff}
            title={copy.mapUnsupportedTitle}
            message={copy.mapUnsupportedMessage}
          />
        )}
      </div>

      {/* ── Detail panel: bottom sheet (mobile) / right column (md+) ── */}
      {selected && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl shadow-float max-h-[68dvh] md:static md:z-auto md:w-[400px] md:flex-shrink-0 md:rounded-none md:border-l md:max-h-none md:shadow-none"
          style={{
            background: PANEL,
            borderColor: LINE,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 flex-shrink-0">
            <div
              className="md:hidden absolute left-1/2 -translate-x-1/2 top-2"
              style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }}
            />
            <span
              className="font-sans font-bold uppercase"
              style={{ fontSize: 12, letterSpacing: '0.1em', color: INK_MUTED, marginTop: 6 }}
            >
              {copy.farmer}
            </span>
            <button
              onClick={() => onSelect(null)}
              aria-label={copy.closeFarmer}
              style={{
                background: 'rgba(32,25,15,0.06)',
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: 6,
                cursor: 'pointer',
                color: INK_SOFT,
                display: 'flex',
                marginTop: 4,
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 pb-5 pt-1" style={{ minHeight: 0 }}>
            {(isiZulu || isInlineDraftLang(lang)) && (
              <p className="font-sans text-xs mb-2" lang={lang} role="note">
                {copy.sourceLanguageNotice}
              </p>
            )}
            {/* variant="embedded": this component already supplies the sheet
             * chrome, close button and scroll container. Passing `sources`
             * unlocks the panel's month-by-month strip. */}
            <FarmerPanel
              farmer={selected.farmer}
              summary={selected}
              sources={demoFarmerById(selected.farmer.id)?.sources ?? null}
              onClose={() => onSelect(null)}
              onViewOnMap={() => focusSelected(1500)}
              demoNotice={DEMO_NETWORK_NOTICE}
              variant="embedded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
