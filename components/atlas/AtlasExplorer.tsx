'use client';

/**
 * Atlas — global garden explorer. A world map: tap (or search) any point on
 * Earth, and the app's existing global data layer (/api/location-data) answers
 * with climate, rainfall, soil-with-provenance, terrain, and — for South
 * African points — the SANBI/BRU layers.
 *
 * Deliberately a SEPARATE, read-only map from components/Map.tsx, the same
 * call NearbyMap.tsx made: that component is a heavily stateful land-design
 * tool tuned to one farm; this one only ever needs "fly, tap, marker". Token
 * handling is the app's existing pattern (NEXT_PUBLIC_MAPBOX_TOKEN), and the
 * geocoder is the same Mapbox places API components/Map.tsx already uses —
 * minus its country=ZA restriction, because the whole point of the Atlas is
 * everywhere else.
 *
 * Mobile-first: the result panel is a bottom sheet over the map on small
 * screens and a right-hand column on md+.
 */

import { useCallback, useRef, useState } from 'react';
import ReactMapGL, { Marker, type MapRef, type MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, X, Loader2, Earth } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import AtlasPanel from './AtlasPanel';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface Suggestion { name: string; lat: number; lon: number }

type FetchState =
  | { status: 'idle' }
  | { status: 'loading'; lat: number; lon: number; placeName?: string }
  | { status: 'ready'; data: LocationData; placeName?: string }
  | { status: 'error'; lat: number; lon: number; placeName?: string };

export default function AtlasExplorer() {
  const mapRef = useRef<MapRef>(null);
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow response landing after the user tapped elsewhere.
  const requestSeq = useRef(0);

  const selectPoint = useCallback(async (lat: number, lon: number, placeName?: string) => {
    const seq = ++requestSeq.current;
    setState({ status: 'loading', lat, lon, placeName });
    try {
      const res = await fetch(`/api/location-data?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LocationData;
      if (requestSeq.current !== seq) return;
      setState({ status: 'ready', data, placeName });
    } catch {
      if (requestSeq.current !== seq) return;
      setState({ status: 'error', lat, lon, placeName });
    }
  }, []);

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const { lat, lng } = e.lngLat;
    selectPoint(lat, lng);
  }, [selectPoint]);

  // ── Global place search (Mapbox geocoding, same API Map.tsx uses) ──────
  const fetchSuggestions = useCallback((q: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const trimmed = q.trim();
    if (trimmed.length < 3 || /^-?\d/.test(trimmed)) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json` +
          `?access_token=${TOKEN}&autocomplete=true&limit=5&language=en` +
          `&types=country,region,district,place,locality,neighborhood,poi`
        );
        const json = await res.json();
        const list: Suggestion[] = (json.features ?? []).map(
          (f: { place_name?: string; text?: string; center: [number, number] }) => ({
            name: f.place_name ?? f.text ?? '',
            lon: f.center[0], lat: f.center[1],
          }),
        );
        setSuggestions(list);
      } catch { setSuggestions([]); }
    }, 250);
  }, []);

  const chooseSuggestion = useCallback((s: Suggestion) => {
    setSuggestions([]);
    setQuery(s.name.split(',').slice(0, 2).join(','));
    mapRef.current?.flyTo({ center: [s.lon, s.lat], zoom: 9, duration: 1800 });
    selectPoint(s.lat, s.lon, s.name.split(',').slice(0, 2).join(','));
  }, [selectPoint]);

  const close = useCallback(() => {
    requestSeq.current++;
    setState({ status: 'idle' });
  }, []);

  const sel =
    state.status === 'ready' ? { lat: state.data.lat, lon: state.data.lon }
    : state.status === 'loading' || state.status === 'error' ? { lat: state.lat, lon: state.lon }
    : null;
  const panelOpen = state.status !== 'idle';

  return (
    <div className="flex-1 flex overflow-hidden relative min-h-0">

      {/* ── Map ── */}
      <div className="flex-1 relative min-w-0">
        <ReactMapGL
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          initialViewState={{ latitude: 8, longitude: 22, zoom: 1.4 }}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          projection={{ name: 'globe' }}
          style={{ width: '100%', height: '100%' }}
          onClick={onMapClick}
          cursor="crosshair"
        >
          {sel && (
            <Marker latitude={sel.lat} longitude={sel.lon} anchor="center">
              <div style={{ position: 'relative', width: 18, height: 18 }}>
                <div className="animate-ping-slow" style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(31,77,43,0.35)',
                }} />
                <div style={{
                  position: 'absolute', inset: 3, borderRadius: '50%',
                  background: '#1F4D2B', border: '2px solid #F7F2E9',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }} />
              </div>
            </Marker>
          )}
        </ReactMapGL>

        {/* Search overlay */}
        <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[340px] z-10">
          <div
            className="flex items-center gap-2 px-3"
            style={{
              background: '#FFFEFA', border: '1px solid #E2D8C4', borderRadius: 12,
              height: 42, boxShadow: '0 4px 16px rgba(32,25,15,0.12)',
            }}
          >
            <Search size={15} style={{ color: '#8C7A62', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
              placeholder="Search anywhere on Earth…"
              className="flex-1 font-sans bg-transparent outline-none"
              style={{ fontSize: 13.5, color: '#20190F', border: 'none' }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSuggestions([]); }}
                aria-label="Clear search"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#8C7A62', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {suggestions.length > 0 && (
            <div
              className="mt-1.5 overflow-hidden"
              style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', borderRadius: 12, boxShadow: '0 8px 32px rgba(32,25,15,0.16)' }}
            >
              {suggestions.map((s) => (
                <button
                  key={`${s.lat},${s.lon},${s.name}`}
                  onClick={() => chooseSuggestion(s)}
                  className="w-full text-left px-3 py-2.5 font-sans"
                  style={{
                    fontSize: 13, color: '#20190F', background: 'none',
                    border: 'none', borderBottom: '1px solid rgba(226,216,196,0.5)', cursor: 'pointer',
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* First-run hint */}
        {state.status === 'idle' && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2.5"
            style={{
              background: 'rgba(255,254,250,0.94)', border: '1px solid #E2D8C4',
              borderRadius: 999, boxShadow: '0 4px 16px rgba(32,25,15,0.14)', whiteSpace: 'nowrap',
            }}
          >
            <Earth size={15} style={{ color: '#1F4D2B' }} />
            <span className="font-display" style={{ fontSize: 13.5, color: '#20190F' }}>
              Tap anywhere on Earth to read its climate, rain and soil
            </span>
          </div>
        )}
      </div>

      {/* ── Result panel: bottom sheet (mobile) / right column (md+) ── */}
      {panelOpen && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl shadow-float max-h-[62dvh] md:static md:z-auto md:w-[420px] md:flex-shrink-0 md:rounded-none md:border-l md:max-h-none md:shadow-none"
          style={{
            background: '#F4EFE4',
            borderColor: '#E2D8C4',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Sheet chrome */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 flex-shrink-0">
            <div className="md:hidden mx-auto absolute left-1/2 -translate-x-1/2 top-2" style={{ width: 40, height: 4, borderRadius: 2, background: '#D5C9AE' }} />
            <span className="font-sans font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#8C7A62', marginTop: 6 }}>
              This point
            </span>
            <button
              onClick={close}
              aria-label="Close panel"
              style={{
                background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', borderRadius: 8,
                padding: 6, cursor: 'pointer', color: '#5C5040', display: 'flex', marginTop: 4,
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 pb-5 pt-1" style={{ minHeight: 0 }}>
            {state.status === 'loading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
                <span className="font-display" style={{ fontSize: 13.5, color: '#5C5040' }}>
                  Reading climate, rain and soil for this point…
                </span>
              </div>
            )}
            {state.status === 'error' && (
              <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
                <span className="font-display" style={{ fontSize: 14, color: '#20190F' }}>
                  Could not fetch data for this point.
                </span>
                <button
                  onClick={() => selectPoint(state.lat, state.lon, state.placeName)}
                  className="font-display font-semibold"
                  style={{
                    background: '#1F4D2B', color: '#F7F2E9', border: 'none', borderRadius: 999,
                    padding: '8px 18px', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {state.status === 'ready' && <AtlasPanel data={state.data} placeName={state.placeName} />}
          </div>
        </div>
      )}
    </div>
  );
}
