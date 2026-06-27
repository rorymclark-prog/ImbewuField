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

  // Pre-fill name from biome/coords when location changes (skip while the save form is open)
  useEffect(() => {
    if (locationData && coords && !saving) {
      setName(locationData.biome.name !== 'Outside South Africa'
        ? `${locationData.biome.name} site`
        : `${Math.abs(coords.lat).toFixed(3)}°S ${coords.lon.toFixed(3)}°E`
      );
      setSaved(false);
    }
  }, [locationData, coords, saving]);

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
      <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
        Saved Places
      </div>

      {/* Save current location */}
      {coords && locationData ? (
        saving ? (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.20)' }}>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Place name..."
              className="w-full text-xs font-display rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F' }}
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)..."
              rows={2}
              className="w-full text-xs font-display rounded-lg px-2.5 py-1.5 outline-none resize-none"
              style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F' }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
                style={{ background: 'rgba(31,77,43,0.14)', border: '1px solid rgba(31,77,43,0.28)', color: '#2D6B3C' }}
              >
                Save
              </button>
              <button
                onClick={() => setSaving(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#5C5040' }}
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
              ? { background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.14)', color: '#5C5040' }
              : { background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.20)', color: '#2D6B3C' }
            }
          >
            {saved ? 'Saved' : 'Save this location'}
          </button>
        )
      ) : (
        <p className="text-xs font-display text-center" style={{ color: '#5C5040' }}>
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
                style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: dotColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-xs font-display font-semibold truncate" style={{ color: '#20190F' }}>
                        {place.name}
                      </span>
                      <span className="text-xs font-mono flex-shrink-0" style={{ color: '#5C5040', opacity: 0.7 }}>
                        {timeAgo(place.savedAt)}
                      </span>
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#5C5040' }}>
                      {place.biome} · {place.elevation}m · {place.rainfall}mm
                    </div>
                    {place.notes && (
                      <div className="text-xs font-display mt-1 leading-relaxed" style={{ color: '#5C5040', opacity: 0.8 }}>
                        {place.notes}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onJumpTo(place.lat, place.lon)}
                        className="flex-1 py-1 rounded-lg text-xs font-display font-medium transition-all"
                        style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.20)', color: '#2D6B3C' }}
                      >
                        Go to
                      </button>
                      <button
                        onClick={() => handleDelete(place.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
                        style={{ background: 'transparent', border: '1px solid #E2D8C4', color: '#5C5040' }}
                      >
                        Remove
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
          <p className="text-xs font-display" style={{ color: '#5C5040' }}>No saved places yet</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: '#5C5040', opacity: 0.6 }}>
            Analyse a location then save it here
          </p>
        </div>
      )}
    </div>
  );
}
