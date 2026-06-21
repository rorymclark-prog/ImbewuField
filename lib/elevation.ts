import type { ElevationData } from './types';
import { aspectLabel } from './biome';

export async function fetchElevation(lat: number, lon: number): Promise<ElevationData> {
  // Sample center + N + E for slope/aspect calculation
  const d = 0.01; // ~1km offset
  const locations = [
    `${lat.toFixed(4)},${lon.toFixed(4)}`,
    `${(lat + d).toFixed(4)},${lon.toFixed(4)}`,
    `${lat.toFixed(4)},${(lon + d).toFixed(4)}`,
  ].join('|');

  const res = await fetch(
    `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`OpenTopoData error: ${res.status}`);
  const data = await res.json();

  const elev = (i: number): number => data.results[i]?.elevation ?? 0;
  const elevC = elev(0);
  const elevN = elev(1);
  const elevE = elev(2);

  // Meters per degree at this latitude
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
  const dy = d * mPerDegLat;
  const dx = d * mPerDegLon;

  const dzDx = (elevE - elevC) / dx;
  const dzDy = (elevN - elevC) / dy;
  const slopeRad = Math.atan(Math.sqrt(dzDx ** 2 + dzDy ** 2));
  const slopeDeg = parseFloat((slopeRad * 180 / Math.PI).toFixed(1));
  const slopePct = parseFloat((Math.tan(slopeRad) * 100).toFixed(1));

  // Aspect: degrees clockwise from North
  let aspectDeg = Math.atan2(dzDx, dzDy) * 180 / Math.PI;
  if (aspectDeg < 0) aspectDeg += 360;
  aspectDeg = parseFloat(aspectDeg.toFixed(0));

  return {
    elevation: Math.round(elevC),
    slopeDeg,
    slopePct,
    aspectDeg,
    aspectLabel: aspectLabel(aspectDeg),
  };
}
