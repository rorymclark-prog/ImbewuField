'use client';
import { useEffect, useRef, useState } from 'react';

/** Coordinates stay behind a one-tap control; never locate anyone on page load. */
export default function VenueLocation({ latitude, longitude, sample, venue = '', recordKind = 'session', onChange }: {
  latitude: number | null; longitude: number | null; sample: boolean;
  venue?: string; recordKind?: 'session' | 'visit';
  onChange: (point: { latitude: number | null; longitude: number | null }) => void;
}) {
  const request = useRef(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [showMap, setShowMap] = useState(false);
  useEffect(() => () => { request.current++; }, []);
  function locate() {
    const token = ++request.current;
    setMessage('');
    if (sample) {
      onChange({ latitude: -27.726231, longitude: 31.963044 });
      setMessage(`Venue location added. Save the ${recordKind} to keep it.`);
      return;
    }
    if (!navigator.geolocation) { setMessage('Location is unavailable on this device. You can still save the place name and photos.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (token !== request.current) return;
      setBusy(false);
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setMessage('No usable location was returned. Please try again.'); return; }
      onChange({ latitude, longitude });
      setMessage(`Location added${Number.isFinite(accuracy) ? ` · device reports approximately ${Math.round(accuracy)} m accuracy` : ''}. Save the ${recordKind} to keep it.`);
    }, error => {
      if (token !== request.current) return;
      setBusy(false);
      setMessage(error.code === 1 ? 'Location permission was declined. Allow location for this site in your browser settings, then try again. Your entry is still here.' : 'Could not get your location. Try again outside or near a window. Your entry is still here.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  const hasLocation = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180;
  const query = hasLocation ? `${latitude},${longitude}` : venue.trim();
  return <section style={{ padding: 16, marginBlock: 16, border: '1px solid #b4c6b6', borderRadius: 16, background: '#f3f7f1' }}>
    <h3>Venue & directions</h3><p>At the venue? Tap GPS to add the location to this {recordKind}.</p>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><button type="button" disabled={busy} onClick={locate}>{busy ? 'Finding location…' : sample ? 'Use venue location' : hasLocation ? 'Update GPS location' : 'Use my GPS location'}</button>
    {hasLocation&&<button type="button" aria-expanded={showMap} onClick={()=>setShowMap(!showMap)}>{showMap?'Hide map':'View map here'}</button>}
    {query&&<><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" style={{padding:10,fontWeight:600}}>Google Maps ↗</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" style={{padding:10,fontWeight:600}}>Directions ↗</a></>}</div>
    {hasLocation && <><p>Location attached · {latitude!.toFixed(5)}, {longitude!.toFixed(5)}</p>{showMap&&<iframe title={`Map of ${venue||'training venue'}`} loading="lazy" referrerPolicy="no-referrer" src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`} style={{width:'100%',height:260,border:'1px solid #b4c6b6',borderRadius:12}}/>}<button type="button" onClick={() => { request.current++; setBusy(false); setShowMap(false); setMessage(''); onChange({ latitude: null, longitude: null }); }}>Remove location</button></>}
    <p role="status" style={{ fontSize: 14 }}>{message}</p>
  </section>;
}
