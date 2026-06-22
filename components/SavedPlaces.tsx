'use client';

import { useState, useEffect } from 'react';
import { loadPlaces, savePlace, deletePlace, generateId, type SavedPlace } from '@/lib/saved-places';
import type { LocationData } from '@/lib/types';

interface Props {
  locationData: LocationData | null;
  coords: { lat: number; lon: number } | null;
  onJumpTo: (lat: number, lon: number) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function SavedPlaces({ locationData, coords, onJumpTo }: Props) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPlaces(loadPlaces()); }, []);

  // Pre-fill name from biome/coords when location changes
  useEffect(() => {
    if (locationData && coords) {
      setName(locationData.biome.name !== 'Outside South Africa'
        ? `${locationData.biome.name} site`
        : `${Math.abs(coords.lat).toFixed(3)}°S ${coords.lon.toFixed(3)}°E`
      );
      setSaved(false);
    }
  }, [locationData, coords]);

  function handleSave() {
    if (!coords || !locationData || !name.trim()) return;
    const place: SavedPlace = {
      id: generateId(),
      name: name.trim(),
      lat: coords.lat,
      lon: coords.lon,
      biome: locationData.biome.name,
      rainfall: locationData.rainfall.annual,
      elevation: locationData.elevation.elevation,
      savedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };
    setPlaces(savePlace(place));
    setSaving(false);
    setSaved(true);
    setNotes('');
  }

  function handleDelete(id: string) {
    setPlaces(deletePlace(id));
  }

  const BIOME_COLORS: Record<string, string> = {
    'Savanna': '#8B9D5E', 'Grassland': '#6BA84F', 'Fynbos': '#C8974A',
    'Succulent Karoo': '#D07850', 'Nama-Karoo': '#B89040', 'Desert': '#C8A842',
    'Albany Thicket': '#5A8B4A', 'Indian Ocean Coastal Belt': '#3A9A7A', 'Forest': '#2D7A5C',
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Saved Places
      </div>

      {/* Save current location */}
      {coords && locationData ? (
        saving ? (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(72,168,100,0.08)', border: '1px solid rgba(72,168,100,0.3)' }}>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Place name…"
              className="dark-input w-full text-xs font-display rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: 'rgba(22,37,20,0.8)', border: '1px solid rgba(58,104,48,0.6)', color: '#e8f0e6' }}
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)…"
              rows={2}
              className="dark-input w-full text-xs font-display rounded-lg px-2.5 py-1.5 outline-none resize-none"
              style={{ background: 'rgba(22,37,20,0.8)', border: '1px solid rgba(58,104,48,0.4)', color: '#dce8da' }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: 'rgba(72,168,100,0.22)', border: '1px solid rgba(72,168,100,0.5)', color: 'var(--emerald-bright)' }}
              >
                ★ Save
              </button>
              <button
                onClick={() => setSaving(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setSaving(true); setSaved(false); }}
            className="w-full py-2 rounded-xl text-xs font-display font-medium flex items-center justify-center gap-2 transition-all"
            style={saved
              ? { background: 'rgba(72,168,100,0.1)', border: '1px solid rgba(72,168,100,0.25)', color: 'var(--text-muted)' }
              : { background: 'rgba(72,168,100,0.12)', border: '1px solid rgba(72,168,100,0.35)', color: 'var(--emerald-bright)' }
            }
          >
            {saved ? '✓ Saved' : '★ Save this location'}
          </button>
        )
      ) : (
        <p className="text-xs font-display text-center" style={{ color: 'var(--text-muted)' }}>
          Select a location on the map first
        </p>
      )}

      {/* Saved places list */}
      {places.length > 0 ? (
        <div className="space-y-1.5">
          {places.map(place => {
            const dotColor = BIOME_COLORS[place.biome] ?? '#6BA84F';
            return (
              <div
                key={place.id}
                className="rounded-xl p-3 transition-all group"
                style={{ background: 'rgba(22,37,20,0.5)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: dotColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-xs font-display font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {place.name}
                      </span>
                      <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        {timeAgo(place.savedAt)}
                      </span>
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {place.biome} · {place.elevation}m · {place.rainfall}mm
                    </div>
                    {place.notes && (
                      <div className="text-xs font-display mt-1 leading-relaxed" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                        {place.notes}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onJumpTo(place.lat, place.lon)}
                        className="flex-1 py-1 rounded-lg text-xs font-display font-medium transition-all"
                        style={{ background: 'rgba(72,168,100,0.15)', border: '1px solid rgba(72,168,100,0.3)', color: 'var(--emerald-bright)' }}
                      >
                        → Go to
                      </button>
                      <button
                        onClick={() => handleDelete(place.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">☆</div>
          <p className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>No saved places yet</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
            Analyse a location then save it here
          </p>
        </div>
      )}
    </div>
  );
}
