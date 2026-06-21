// Reverse-geocode coordinates → South African administrative area
// (local municipality / district municipality / province) via OSM Nominatim.
export interface AdminArea {
  municipality: string | null;
  district: string | null;
  province: string | null;
  label: string | null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<AdminArea | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`,
      { headers: { 'User-Agent': 'ImbewuField/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const municipality = a.municipality ?? a.city ?? a.town ?? a.village ?? a.suburb ?? null;
    const district = a.county ?? a.state_district ?? a.district ?? null;
    const province = a.state ?? null;
    if (!municipality && !district && !province) return null;
    const label = [municipality, district, province].filter(Boolean).join(', ') || j.display_name || null;
    return { municipality, district, province, label };
  } catch {
    return null;
  }
}
