export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  biome: string;
  rainfall: number;
  elevation: number;
  savedAt: string; // ISO date
  notes?: string;
}

const KEY = 'permamap_saved_places';

export function loadPlaces(): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permamap-places-changed'));
}

export function savePlace(place: SavedPlace): SavedPlace[] {
  const places = loadPlaces().filter(p => p.id !== place.id);
  const updated = [place, ...places];
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  return updated;
}

export function deletePlace(id: string): SavedPlace[] {
  const updated = loadPlaces().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  return updated;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
