'use client';
import { useEffect, useRef, useState } from 'react';

/** Coordinates stay behind a one-tap control; never locate anyone on page load. */
export default function VenueLocation({ latitude, longitude, sample, onChange }: {
  latitude: number | null; longitude: number | null; sample: boolean;
  onChange: (point: { latitude: number | null; longitude: number | null }) => void;
}) {
  const request = useRef(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => () => { request.current++; }, []);
  function locate() {
    const token = ++request.current;
    setMessage('');
    if (sample) {
      onChange({ latitude: -27.726231, longitude: 31.963044 });
      setMessage('Example location added. Your real location was not requested.');
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
      setMessage(`Location added${Number.isFinite(accuracy) ? ` · device reports approximately ${Math.round(accuracy)} m accuracy` : ''}. Save the session to keep it.`);
    }, error => {
      if (token !== request.current) return;
      setBusy(false);
      setMessage(error.code === 1 ? 'Location permission was declined. Allow location for this site in your browser settings, then try again. Your entry is still here.' : 'Could not get your location. Try again outside or near a window. Your entry is still here.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  const hasLocation = latitude !== null && longitude !== null;
  return <section style={{ padding: 16, marginBlock: 16, border: '1px solid #b4c6b6', borderRadius: 16, background: '#f3f7f1' }}>
    <h3>Place location</h3><p>At the venue? Add this device’s current location. No coordinates to type.</p>
    <button type="button" disabled={busy} onClick={locate}>{busy ? 'Finding location…' : sample ? 'Add example location (sample)' : hasLocation ? 'Update from my current location' : 'Use my current location'}</button>
    {hasLocation && <><p>✓ Location attached to this entry</p><button type="button" onClick={() => { request.current++; setBusy(false); setMessage(''); onChange({ latitude: null, longitude: null }); }}>Remove location</button></>}
    <p role="status" style={{ fontSize: 14 }}>{message}</p>
  </section>;
}
