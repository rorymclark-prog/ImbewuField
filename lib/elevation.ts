import type { ElevationData } from './types';
import { aspectLabel } from '@/lib/biome';

const SAMPLE_RADIUS_M = 60;
const METRES_PER_LATITUDE_DEGREE = 111320;
const REQUIRED_SAMPLE_COUNT = 5;

function requireFiniteElevations(
  elevations: { center: number; north: number; south: number; east: number; west: number },
): void {
  if (Object.values(elevations).some((elevation) => !Number.isFinite(elevation))) {
    throw new Error('Invalid elevation samples');
  }
}

function wrapLongitude(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

export function deriveElevationData(
  elevations: { center: number; north: number; south: number; east: number; west: number },
): ElevationData {
  requireFiniteElevations(elevations);

  const dzDx = (elevations.east - elevations.west) / (SAMPLE_RADIUS_M * 2);
  const dzDy = (elevations.north - elevations.south) / (SAMPLE_RADIUS_M * 2);
  const gradient = Math.sqrt(dzDx ** 2 + dzDy ** 2);
  const slopeRad = Math.atan(gradient);
  const slopeDeg = parseFloat((slopeRad * 180 / Math.PI).toFixed(1));
  const slopePct = parseFloat((Math.tan(slopeRad) * 100).toFixed(1));

  // SRTM is useful local evidence, but it is not a site survey. A sub-metre total change across
  // the sample is too close to DEM noise to support a directional arrow at all.
  const totalRelief = Math.max(
    elevations.north,
    elevations.south,
    elevations.east,
    elevations.west,
  ) - Math.min(
    elevations.north,
    elevations.south,
    elevations.east,
    elevations.west,
  );
  const directionConfidence = totalRelief >= 1
    ? 'site-local-indicative'
    : 'unconfirmed';
  let aspectDeg = 0;
  let downhillLabel = '—';
  if (directionConfidence === 'site-local-indicative') {
    aspectDeg = Math.atan2(-dzDx, -dzDy) * 180 / Math.PI;
    if (aspectDeg < 0) aspectDeg += 360;
    aspectDeg = parseFloat(aspectDeg.toFixed(0));
    downhillLabel = aspectLabel(aspectDeg);
  }

  return {
    elevation: Math.round(elevations.center),
    slopeDeg,
    slopePct,
    aspectDeg,
    aspectLabel: downhillLabel,
    sampleBaselineM: SAMPLE_RADIUS_M * 2,
    directionConfidence,
  };
}

export async function fetchElevation(lat: number, lon: number): Promise<ElevationData> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Invalid elevation coordinates');
  }

  // A local five-point central difference follows the property-scale terrain much more closely
  // than the former centre/N/E sample taken roughly one kilometre apart.
  const dLat = SAMPLE_RADIUS_M / METRES_PER_LATITUDE_DEGREE;
  if (lat + dLat > 90 || lat - dLat < -90) {
    throw new Error('Elevation sampling unavailable at this latitude');
  }
  const dLon = SAMPLE_RADIUS_M / (
    METRES_PER_LATITUDE_DEGREE * Math.max(0.1, Math.cos(lat * Math.PI / 180))
  );
  const eastLon = wrapLongitude(lon + dLon);
  const westLon = wrapLongitude(lon - dLon);
  const locations = [
    `${lat.toFixed(6)},${lon.toFixed(6)}`,
    `${(lat + dLat).toFixed(6)},${lon.toFixed(6)}`,
    `${(lat - dLat).toFixed(6)},${lon.toFixed(6)}`,
    `${lat.toFixed(6)},${eastLon.toFixed(6)}`,
    `${lat.toFixed(6)},${westLon.toFixed(6)}`,
  ].join('|');

  const res = await fetch(
    `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`,
    { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) } as RequestInit
  );

  if (!res.ok) throw new Error(`OpenTopoData error: ${res.status}`);
  const data: unknown = await res.json();
  const results = (
    typeof data === 'object'
    && data !== null
    && 'results' in data
    && Array.isArray(data.results)
  ) ? data.results : null;
  if (
    !results
    || results.length !== REQUIRED_SAMPLE_COUNT
    || results.some((result) => (
      typeof result !== 'object'
      || result === null
      || !('elevation' in result)
      || typeof result.elevation !== 'number'
      || !Number.isFinite(result.elevation)
    ))
  ) {
    throw new Error('Incomplete OpenTopoData elevation data');
  }

  const elev = (i: number): number => (results[i] as { elevation: number }).elevation;
  return deriveElevationData({
    center: elev(0),
    north: elev(1),
    south: elev(2),
    east: elev(3),
    west: elev(4),
  });
}
