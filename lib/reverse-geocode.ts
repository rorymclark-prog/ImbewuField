// Reverse-geocode coordinates → South African administrative area
// (local municipality / district municipality / province) via OSM Nominatim.
export interface AdminArea {
  municipality: string | null;
  district: string | null;
  province: string | null;
  suburb: string | null;      // neighbourhood / suburb within city
  road: string | null;        // street / road for hyper-local context
  nearestTown: string | null; // nearest named settlement
  label: string | null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<AdminArea | null> {
  try {
    // Use zoom=16 for suburb-level precision
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'User-Agent': 'ImbewuField/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const suburb = a.suburb ?? a.quarter ?? a.neighbourhood ?? a.hamlet ?? null;
    const municipality = a.city ?? a.town ?? a.municipality ?? null;
    const district = a.county ?? a.state_district ?? a.district ?? null;
    const province = a.state ?? null;
    const road = a.road ?? null;
    const nearestTown = a.city ?? a.town ?? a.village ?? null;
    if (!municipality && !district && !province) return null;
    const label = [suburb, municipality, province].filter(Boolean).join(', ') || j.display_name || null;
    return { municipality, district, province, suburb, road, nearestTown, label };
  } catch {
    return null;
  }
}
