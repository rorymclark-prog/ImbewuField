// Canonical coordinate-derived site key used by Design Studio and every per-site store.
// The exact five-decimal shape matches designSiteIdFromLocation(); validating it at storage
// boundaries prevents malformed values from creating orphan local keys or Firestore documents.
const COORDINATE_SITE_ID_RE = /^site:(-?\d+\.\d{5}),(-?\d+\.\d{5})$/;

export function canonicalCoordinateSiteId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = COORDINATE_SITE_ID_RE.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  return value === `site:${lat.toFixed(5)},${lon.toFixed(5)}` ? value : null;
}

export function coordinateSiteIdParts(siteId: string): { lat: number; lon: number } | null {
  const canonical = canonicalCoordinateSiteId(siteId);
  if (!canonical) return null;
  const match = COORDINATE_SITE_ID_RE.exec(canonical)!;
  return { lat: Number(match[1]), lon: Number(match[2]) };
}
