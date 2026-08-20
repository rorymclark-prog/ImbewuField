// Per-site rainfall pattern for the crop planner — from the site's OWN monthly
// climate, not from a city 255 km away.
//
// THE BUG THIS FIXES. The crops page resolved its RainPattern through
// lib/water-calc.ts's nearestRainfall(): seven hardcoded reference points, no
// distance cap, and no Zululand/lowveld point at all. The demo farm's real
// Mkuze-valley coordinates (-27.73, 31.96 — frost-free lowveld) snapped to
// "Durban / KZN coast & hinterland" 255 km away and inherited its mild-frost
// profile, so every crop's sow window was the wrong region's window. Measured
// against live NASA POWER data for those coordinates (2026-08-19): coldest
// month mean 16.8 °C, 80% of rain in the summer half-year → 'summer', not
// 'mild-frost'.
//
// The machinery that gets this right already shipped for the Atlas explorer:
// lib/koppen-global.ts's classifyKoppen() + rainPatternFor() derive the same
// four RainPattern values from twelve monthly temperature/rain pairs. This
// module is the bridge that lets the PLANNER use it: it reads the very same
// LocationData that /api/location-data returns (and that app/farmer + /design
// already cache per site in localStorage), derives the pattern, and refuses to
// answer when the data is not genuinely the site's own.
//
// nearestRainfall() stays in place as the EXPLICIT fallback — no coordinates,
// API down, offline with an empty cache — and the UI says which of the two the
// farmer is looking at. A fallback that is labelled is honest; one that is
// silent was the bug.

import type { RainPattern } from '@/lib/crop-catalog';
import { classifyKoppen, rainPatternFor } from '@/lib/koppen-global';

export interface SiteClimate {
  /** The planner's rainfall pattern, derived from this site's own monthly climate. */
  pattern: RainPattern;
  /** Annual rainfall (mm/yr) summed from the site's monthly normals. */
  annualMm: number;
  /** Monthly rainfall normals, mm, Jan..Dec — for water calcs that want the shape. */
  monthlyRainMm: number[];
  /** Köppen-Geiger code for the site (e.g. 'Cfa') — provenance detail, shown as modelled. */
  koppen: string;
  /** Which satellite dataset the rainfall came from (see lib/nasa-power.ts). */
  rainfallSource: 'nasa-power' | 'open-meteo';
}

const twelveFinite = (values: unknown): values is number[] =>
  Array.isArray(values) && values.length === 12 && values.every((v) => typeof v === 'number' && Number.isFinite(v));

/**
 * Derive the site's RainPattern from a LocationData-shaped payload.
 *
 * Returns null — meaning "use the nearestRainfall fallback" — unless the
 * payload is demonstrably a real per-site reading:
 *
 *  - `rainfall.rainfallSource` must name a real dataset. /api/location-data's
 *    NASA-outage fallback substitutes twelve months of 50 mm and DOES NOT set
 *    this field (neither do pre-field cache entries), so its absence is the
 *    reliable signature of data that was never fetched for this site. Deriving
 *    a "per-site" pattern from that constant would re-create the original bug
 *    with better-sounding provenance.
 *  - twelve finite monthly rain totals (each >= 0) and twelve finite monthly
 *    temperatures, which are what classifyKoppen actually needs.
 *
 * The Köppen class is recomputed here from the monthly numbers rather than
 * trusted from the payload: classifyKoppen is pure, tested, and cheap, and a
 * cached `climate.koppen` string may predate classifier fixes.
 */
export function siteClimateFromLocationData(data: unknown, lat: number): SiteClimate | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof data !== 'object' || data === null) return null;
  const rainfall = (data as { rainfall?: unknown }).rainfall;
  const climate = (data as { climate?: unknown }).climate;
  if (typeof rainfall !== 'object' || rainfall === null) return null;
  if (typeof climate !== 'object' || climate === null) return null;

  const rainfallSource = (rainfall as { rainfallSource?: unknown }).rainfallSource;
  if (rainfallSource !== 'nasa-power' && rainfallSource !== 'open-meteo') return null;

  const monthlyRainMm = (rainfall as { monthly?: unknown }).monthly;
  const tempC = (climate as { monthlyTemp?: unknown }).monthlyTemp;
  if (!twelveFinite(monthlyRainMm) || monthlyRainMm.some((v) => v < 0)) return null;
  if (!twelveFinite(tempC)) return null;

  const monthly = { tempC, precipMm: monthlyRainMm, lat };
  const koppen = classifyKoppen(monthly);
  if (koppen.code === '?') return null;

  return {
    pattern: rainPatternFor(monthly, koppen),
    annualMm: Math.round(monthlyRainMm.reduce((sum, v) => sum + v, 0)),
    monthlyRainMm,
    koppen: koppen.code,
    rainfallSource,
  };
}

/**
 * The site-analysis localStorage cache key. Key format and version MUST match
 * app/farmer/page.tsx and app/design/page.tsx (tests/location-cache-version.test.ts
 * polices that all readers and writers agree) — 5 dp, and bump the version
 * everywhere at once whenever the endpoint would answer differently.
 */
export function locationDataCacheKey(lat: number, lon: number): string {
  return `imbewu_loc_v4_${lat.toFixed(5)}_${lon.toFixed(5)}`;
}

/**
 * Cache-only read: the pattern for a site somebody has already analysed on
 * this device. Synchronous and safe offline — this is what keeps the planner's
 * per-site climate working in the PWA with no signal, exactly like the sector
 * card and tank calculator that read the same cache.
 */
export function loadCachedSiteClimate(lat: number, lon: number): SiteClimate | null {
  if (typeof window === 'undefined') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const raw = localStorage.getItem(locationDataCacheKey(lat, lon));
    if (!raw) return null;
    return siteClimateFromLocationData(JSON.parse(raw), lat);
  } catch {
    return null;
  }
}

/**
 * Cache-first resolve. On a cache miss it calls /api/location-data and, when
 * the response carries a real per-site reading, stores the WHOLE payload under
 * the shared cache key — the same write app/farmer/page.tsx makes — so the
 * next open (or the farmer/design pages) get it offline for free.
 *
 * Returns null on any failure; the caller keeps the labelled nearestRainfall
 * fallback. A response whose reading is NOT per-site (NASA outage fallback) is
 * deliberately not cached: caching it would pin the fallback into every later
 * session until the version bumps.
 */
export async function resolveSiteClimate(lat: number, lon: number): Promise<SiteClimate | null> {
  const cached = loadCachedSiteClimate(lat, lon);
  if (cached) return cached;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  try {
    const res = await fetch(`/api/location-data?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const derived = siteClimateFromLocationData(json, lat);
    if (derived) {
      try {
        localStorage.setItem(locationDataCacheKey(lat, lon), JSON.stringify(json));
      } catch { /* quota exceeded — the live answer still stands for this session */ }
    }
    return derived;
  } catch {
    return null;
  }
}

/** One month of the site's own rainfall normals. */
export interface DriestMonth {
  /** 1-12. */
  month: number;
  rainMm: number;
}

/**
 * The site's driest calendar months, returned in calendar order.
 *
 * Descriptive only: this is the satellite rainfall record for the point, not a
 * water requirement. Nothing here models evaporation, soil or crop demand — it
 * exists so the planner can show the farmer WHICH months its "reliable
 * irrigation" question is really about, in that site's own numbers.
 *
 * Returns [] unless all twelve monthly totals are finite, for the same reason
 * siteClimateFromLocationData refuses partial data.
 *
 * Also returns [] when the twelve totals are FLAT — all equal, all zero, or
 * spread by less than a millimetre across the whole year. "Its three driest
 * months" reads as a finding about the site; on a flat record the three months
 * named would be an artefact of the month tie-break, so the honest output is
 * nothing at all rather than an arbitrary trio presented as a finding.
 */
const FLAT_RAINFALL_SPREAD_MM = 1;

export function driestMonths(monthlyRainMm: number[], count = 3): DriestMonth[] {
  if (!twelveFinite(monthlyRainMm)) return [];
  if (Math.max(...monthlyRainMm) - Math.min(...monthlyRainMm) < FLAT_RAINFALL_SPREAD_MM) return [];
  return monthlyRainMm
    .map((rainMm, index) => ({ month: index + 1, rainMm }))
    // Ties resolve by month so the same site always prints the same months.
    .sort((a, b) => a.rainMm - b.rainMm || a.month - b.month)
    .slice(0, Math.max(0, count))
    .sort((a, b) => a.month - b.month);
}
