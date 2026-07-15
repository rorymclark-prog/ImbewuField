'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface Props { coords: { lat: number; lon: number } | null }

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const keyOf = (c: { lat: number; lon: number }) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;

function getCached(key: string): string | null {
  try {
    const raw = localStorage.getItem(`imbewu_area_${key}`);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw) as { text: string; ts: number };
    if (Date.now() - ts > TTL_MS) return null;
    return text;
  } catch { return null; }
}
function setCached(key: string, text: string) {
  try { localStorage.setItem(`imbewu_area_${key}`, JSON.stringify({ text, ts: Date.now() })); } catch { /* quota */ }
}

function renderMarkdown(text: string) {
  const sections = text.split(/(?=^## )/m).filter((s) => s.trim());
  if (!sections.length) return <p className="text-xs font-display" style={{ color: '#20190F' }}>{text}</p>;
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const lines = section.split('\n');
        const heading = lines[0].replace(/^## /, '');
        const body = lines.slice(1).join('\n').trim();
        return (
          <div key={i}>
            <h3 className="font-display font-semibold text-sm mb-2 pb-1.5 flex items-center gap-2"
                style={{ color: '#C07A1E', borderBottom: '1px solid #E2D8C4' }}>
              {heading}
            </h3>
            <div className="space-y-1.5">
              {body.split('\n').map((line, j) => {
                if (!line.trim()) return null;
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return (
                    <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                      <span className="flex-shrink-0 mt-0.5 text-xs" style={{ color: '#1F4D2B' }}>-</span>
                      <span>{line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '')}</span>
                    </div>
                  );
                }
                return (
                  <p key={j} className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AreaPanel({ coords }: Props) {
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  async function load(c: { lat: number; lon: number }, force = false) {
    const k = keyOf(c);
    if (!force) {
      const hit = getCached(k);
      if (hit) { setProfile(hit); setLoading(false); return; }
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(''); setProfile(''); setLoading(true);
    try {
      const res = await fetch('/api/area-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: c.lat, lon: c.lon }), signal: ac.signal,
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setProfile(text);
      }
      if (text.trim()) { setCached(k, text); setLastUpdated(Date.now()); }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  }

  // Auto-load when coordinates change — hits localStorage cache first
  useEffect(() => {
    if (!coords) return;
    const k = keyOf(coords);
    const hit = getCached(k);
    if (hit) { setProfile(hit); setLoading(false); return; }
    load(coords);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lon]);

  if (!coords) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-xs font-display" style={{ color: '#5C5040' }}>Tap a place on the map first</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
            Area &amp; community
          </div>
          {lastUpdated && !loading && (
            <div className="text-xs font-mono mt-0.5" style={{ color: '#9A8C70' }}>
              Cached · refreshes in {Math.max(0, 7 - Math.floor((Date.now() - lastUpdated) / 86400000))}d
            </div>
          )}
        </div>
        <button
          onClick={() => load(coords, true)} disabled={loading}
          className="px-2.5 py-1 rounded-lg text-xs font-display font-semibold flex items-center gap-1.5"
          style={loading
            ? { background: '#FFFEFA', color: '#5C5040', cursor: 'wait', border: '1px solid #E2D8C4' }
            : { background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.4)', color: '#C07A1E' }}>
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Loading...</>
            : <><RefreshCw size={14} /> Refresh</>}
        </button>
      </div>

      {error && (
        <div className="text-xs font-mono px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(212,110,66,0.1)', border: '1px solid rgba(212,110,66,0.3)', color: 'var(--orange)' }}>
          {error} — tap Refresh to retry.
        </div>
      )}

      {loading && !profile && (
        <div className="space-y-2.5 animate-pulse">
          {[60, 95, 80, 100, 70, 90, 55].map((w, i) => (
            <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: '#FFFEFA' }} />
          ))}
        </div>
      )}

      {profile && (
        <div>
          {renderMarkdown(profile)}
          {loading && <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse ml-0.5" style={{ background: '#C07A1E' }} />}
          <p className="text-xs font-mono mt-4 pt-2" style={{ color: '#5C5040', opacity: 0.6, borderTop: '1px solid #E2D8C4' }}>
            AI research · OSM + Overpass POI data · verify locally · tap Refresh to update
          </p>
        </div>
      )}
    </div>
  );
}
