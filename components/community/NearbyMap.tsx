'use client';

import { useState } from 'react';
import ReactMapGL, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CommunityProfile } from '@/lib/db/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface Props {
  people: CommunityProfile[];
  onOpenProfile: (uid: string) => void;
}

// Read-only, deliberately separate from the big stateful components/Map.tsx
// (a heavily interactive land-design/drawing tool) — lower regression risk,
// and this view only ever needs coarse pins + a popup.
export default function NearbyMap({ people, onOpenProfile }: Props) {
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const pins = people.filter((p) => typeof p.coarse_lat === 'number' && typeof p.coarse_lon === 'number');
  const active = pins.find((p) => p.uid === activeUid) ?? null;

  const center = pins.length
    ? { lat: pins.reduce((s, p) => s + (p.coarse_lat ?? 0), 0) / pins.length, lon: pins.reduce((s, p) => s + (p.coarse_lon ?? 0), 0) / pins.length }
    : { lat: -28.5, lon: 24.7 }; // South Africa centroid fallback

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <ReactMapGL
        mapboxAccessToken={TOKEN}
        initialViewState={{ latitude: center.lat, longitude: center.lon, zoom: pins.length ? 9 : 5 }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        style={{ width: '100%', height: '100%' }}
      >
        {pins.map((p) => (
          <Marker
            key={p.uid}
            latitude={p.coarse_lat as number}
            longitude={p.coarse_lon as number}
            anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); setActiveUid(p.uid); }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                border: '2.5px solid #1F4D2B', background: '#1F4D2B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {p.photos?.[0]
                  ? <img src={p.photos[0]} alt={p.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#F7F2E9', fontWeight: 700, fontSize: 14 }}>{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
            </div>
          </Marker>
        ))}

        {active && (
          <Popup
            latitude={active.coarse_lat as number}
            longitude={active.coarse_lon as number}
            anchor="top"
            onClose={() => setActiveUid(null)}
            closeButton
            closeOnClick={false}
          >
            <div style={{ minWidth: 160, padding: 2 }}>
              <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{active.display_name}</div>
              <div className="font-sans" style={{ fontSize: 11, color: '#5C5040', marginTop: 2 }}>{active.area_text}</div>
              <button
                onClick={() => onOpenProfile(active.uid)}
                className="font-sans font-semibold"
                style={{
                  marginTop: 8, background: '#1F4D2B', color: '#F7F2E9', border: 'none',
                  borderRadius: 100, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                }}
              >
                View profile
              </button>
            </div>
          </Popup>
        )}
      </ReactMapGL>
    </div>
  );
}
