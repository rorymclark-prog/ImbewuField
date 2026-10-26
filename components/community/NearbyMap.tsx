'use client';

import { useRef,useState } from 'react';
import { X } from 'lucide-react';
import ReactMapGL, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CommunityProfile } from '@/lib/db/types';
import { useLanguage } from '@/lib/i18n';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface Props {
  people: CommunityProfile[];
  onOpenProfile: (uid: string) => void;
}

// Read-only, deliberately separate from the big stateful components/Map.tsx
// (a heavily interactive land-design/drawing tool) — lower regression risk,
// and this view only ever needs coarse pins + a popup.
export default function NearbyMap({ people, onOpenProfile }: Props) {
  const { t,lang } = useLanguage();
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const trigger=useRef<HTMLButtonElement|null>(null);
  const closePopup=()=>{setActiveUid(null);trigger.current?.focus();};
  const pins = people.filter((p) => typeof p.coarse_lat === 'number' && typeof p.coarse_lon === 'number');
  const active = pins.find((p) => p.uid === activeUid) ?? null;

  const center = pins.length
    ? { lat: pins.reduce((s, p) => s + (p.coarse_lat ?? 0), 0) / pins.length, lon: pins.reduce((s, p) => s + (p.coarse_lon ?? 0), 0) / pins.length }
    : { lat: -28.5, lon: 24.7 }; // South Africa centroid fallback

  return (
    <div lang={lang} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}>
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
          >
            {/* A pin is a map control; the global photo viewer must not capture its image click. */}
            <button type="button" aria-label={`${t('communityMapViewProfile')}: ${p.display_name}`} onClick={e=>{e.stopPropagation();trigger.current=e.currentTarget;setActiveUid(p.uid);}} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer',padding:3,border:'none',background:'transparent' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                border: '2.5px solid var(--brand)', background: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {p.photos?.[0]
                  ? <img src={p.photos[0]} alt={p.display_name} lang="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--on-forest)', fontWeight: 700, fontSize: 14 }}>{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
            </button>
          </Marker>
        ))}

        {active && (
          <Popup
            latitude={active.coarse_lat as number}
            longitude={active.coarse_lon as number}
            anchor="top"
            onClose={closePopup}
            closeButton={false}
            closeOnClick={false}
          >
            <div style={{ minWidth: 160, padding: 2 }}><button type="button" aria-label={t('profileClose')} onClick={closePopup} style={{display:'flex',marginLeft:'auto',alignItems:'center',justifyContent:'center',width:44,height:44,border:'none',background:'transparent',color:'var(--text)',cursor:'pointer'}}><X size={18} aria-hidden/></button>
              <div lang="" className="font-display font-semibold" style={{ fontSize: 13, color: 'var(--text)' }}>{active.display_name}</div>
              <div lang="" className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{active.area_text}</div>
              <button
                onClick={() => onOpenProfile(active.uid)}
                className="font-sans font-semibold"
                style={{
                  minHeight:44, marginTop: 8, background: 'var(--color-forest-800)', color: 'var(--on-forest-800)', border: 'none',
                  borderRadius: 100, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                }}
              >
                {t('communityMapViewProfile')}
              </button>
            </div>
          </Popup>
        )}
      </ReactMapGL>
    </div>
  );
}
