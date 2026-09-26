'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n-context';

/** Coordinates stay behind a one-tap control; never locate anyone on page load. */
export default function VenueLocation({ latitude, longitude, sample, venue = '', recordKind = 'session', onChange }: {
  latitude: number | null; longitude: number | null; sample: boolean;
  venue?: string; recordKind?: 'session' | 'visit';
  onChange: (point: { latitude: number | null; longitude: number | null }) => void;
}) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? `${zu} · ${en}` : en;
  const recordLabel = recordKind === 'visit' ? 'lokuvakasha' : 'leseshini';
  const request = useRef(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [showMap, setShowMap] = useState(false);
  useEffect(() => () => { request.current++; }, []);
  function locate() {
    const token = ++request.current;
    setMessage('');
    if (sample) {
      onChange({ latitude: -27.726231, longitude: 31.963044 });
      setMessage(ui(`Venue location added. Save the ${recordKind} to keep it.`, `Indawo yomhlangano ifakiwe. Gcina irekhodi ${recordLabel} ukuze ihlale ikhona.`));
      return;
    }
    if (!navigator.geolocation) { setMessage(ui('Location is unavailable on this device. You can still save the place name and photos.', 'Indawo ayitholakali kule divayisi. Usengagcina igama lendawo nezithombe.')); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (token !== request.current) return;
      setBusy(false);
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setMessage(ui('No usable location was returned. Please try again.', 'Akutholakalanga indawo esebenzisekayo. Zama futhi.')); return; }
      onChange({ latitude, longitude });
      const accuracyNote = Number.isFinite(accuracy) ? ` · device reports approximately ${Math.round(accuracy)} m accuracy` : '';
      const accuracyDraft = Number.isFinite(accuracy) ? ` · idivayisi ibika ukunemba okulinganiselwa kumamitha angu-${Math.round(accuracy)}` : '';
      setMessage(ui(`Location added${accuracyNote}. Save the ${recordKind} to keep it.`, `Indawo ifakiwe${accuracyDraft}. Gcina irekhodi ${recordLabel} ukuze ihlale ikhona.`));
    }, error => {
      if (token !== request.current) return;
      setBusy(false);
      setMessage(ui(error.code === 1 ? 'Location permission was declined. Allow location for this site in your browser settings, then try again. Your entry is still here.' : 'Could not get your location. Try again outside or near a window. Your entry is still here.', error.code === 1 ? 'Imvume yendawo inqatshiwe. Vumela le sayithi ithole indawo kuzilungiselelo zesiphequluli, bese uzama futhi. Okufakile kusekhona.' : 'Ayikwazanga ukuthola indawo yakho. Zama ngaphandle noma eduze kwefasitela. Okufakile kusekhona.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  const hasLocation = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180;
  const query = hasLocation ? `${latitude},${longitude}` : venue.trim();
  return <section style={{ padding: 16, marginBlock: 16, border: '1px solid #b4c6b6', borderRadius: 16, background: '#f3f7f1' }}>
    <h3>{ui('Venue & directions', 'Indawo yomhlangano nezikhombisi-ndlela')}</h3><p>{ui(`At the venue? Tap GPS to add the location to this ${recordKind}.`, `Ufike endaweni? Thepha i-GPS ukuze ufake indawo kuleli rekhodi ${recordLabel}.`)}</p>
    <p>{ui('GPS is read only after you tap. The location becomes part of this record when you save it; remove it here before saving to leave it out.', 'I-GPS ifundwa kuphela uma uyithepha. Indawo iba yingxenye yaleli rekhodi uma uligcina; yisuse lapha ngaphambi kokugcina ukuze ingafakwa.')}</p>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><button type="button" disabled={busy} onClick={locate}>{busy ? ui('Finding location…', 'Kufunwa indawo…') : sample ? ui('Use venue location', 'Sebenzisa indawo yomhlangano') : hasLocation ? ui('Update GPS location', 'Buyekeza indawo ye-GPS') : ui('Use my GPS location', 'Sebenzisa indawo yami ye-GPS')}</button>
    {hasLocation&&<button type="button" aria-expanded={showMap} onClick={()=>setShowMap(!showMap)}>{showMap?ui('Hide map','Fihla imephu'):ui('View map here','Buka imephu lapha')}</button>}
    {query&&<><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" style={{padding:10,fontWeight:600}}>{ui('Google Maps ↗','I-Google Maps ↗')}</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" style={{padding:10,fontWeight:600}}>{ui('Directions ↗','Izikhombisi-ndlela ↗')}</a></>}</div>
    {hasLocation && <><p>{ui('Location attached', 'Indawo ifakiwe')} · {latitude!.toFixed(5)}, {longitude!.toFixed(5)}</p>{showMap&&<iframe title={ui(`Map of ${venue||'training venue'}`, `Imephu yendawo ethi ${venue||'training venue'}`)} loading="lazy" referrerPolicy="no-referrer" src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`} style={{width:'100%',height:260,border:'1px solid #b4c6b6',borderRadius:12}}/>}<button type="button" onClick={() => { request.current++; setBusy(false); setShowMap(false); setMessage(''); onChange({ latitude: null, longitude: null }); }}>{ui('Remove location','Susa indawo')}</button></>}
    <p role="status" style={{ fontSize: 14 }}>{message}</p>
  </section>;
}
