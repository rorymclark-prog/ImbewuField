import type { ElevationData } from './types';
import { aspectLabel } from '@/lib/biome';

const SAMPLE_RADIUS_M = 60;

export function deriveElevationData(
  elevations: { center: number; north: number; south: number; east: number; west: number },
): ElevationData {
  const dzDx = (elevations.east - elevations.west) / (SAMPLE_RADIUS_M * 2);
  const dzDy = (elevations.north - elevations.south) / (SAMPLE_RADIUS_M * 2);
  const gradient = Math.sqrt(dzDx ** 2 + dzDy ** 2);
  const slopeRad = Math.atan(gradient);
  const slopeDeg = parseFloat((slopeRad * 180 / Math.PI).toFixed(1));
  const slopePct = parseFloat((Math.tan(slopeRad) * 100).toFixed(1));

  let aspectDeg = Math.atan2(-dzDx, -dzDy) * 180 / Math.PI;
  if (aspectDeg < 0) aspectDeg += 360;
  aspectDeg = parseFloat(aspectDeg.toFixed(0));

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

  return {
    elevation: Math.round(elevations.center),
    slopeDeg,
    slopePct,
    aspectDeg,
    aspectLabel: aspectLabel(aspectDeg),
    sampleBaselineM: SAMPLE_RADIUS_M * 2,
    directionConfidence,
  };
}

export async function fetchElevation(lat: number, lon: number): Promise<ElevationData> {
  // A local five-point central difference follows the property-scale terrain much more closely
  // than the former centre/N/E sample taken roughly one kilometre apart.
  const dLat = SAMPLE_RADIUS_M / 111320;
  const dLon = SAMPLE_RADIUS_M / (111320 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  const locations = [
    `${lat.toFixed(6)},${lon.toFixed(6)}`,
    `${(lat + dLat).toFixed(6)},${lon.toFixed(6)}`,
    `${(lat - dLat).toFixed(6)},${lon.toFixed(6)}`,
    `${lat.toFixed(6)},${(lon + dLon).toFixed(6)}`,
    `${lat.toFixed(6)},${(lon - dLon).toFixed(6)}`,
  ].join('|');

  const res = await fetch(
    `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`,
    { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) } as RequestInit
  );

  if (!res.ok) throw new Error(`OpenTopoData error: ${res.status}`);
  const data = await res.json();

  const elev = (i: number): number => data.results[i]?.elevation ?? 0;
  return deriveElevationData({
    center: elev(0),
    north: elev(1),
    south: elev(2),
    east: elev(3),
    west: elev(4),
  });
}
