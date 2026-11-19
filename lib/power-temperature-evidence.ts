import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { powerMonthlyTemperatureReceipt, type PowerMonthlyTemperatureReceipt } from './climate-temperature';
import { detachJsonData } from './lossless-json';

/** Hash of the retained JSON representation, not the original HTTP wire bytes
 * or a provider signature. Replays verify it before deriving the metric again. */
export interface PowerTemperatureSnapshot {
  readonly version: 1;
  readonly responseJson: string;
  readonly responseJsonSha256: string;
  readonly endpoint: string;
}
const digest = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
const pointValid = (p: { latitude: number; longitude: number }) => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
  && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;

export function createPowerTemperatureSnapshot(value: unknown, endpoint: string): PowerTemperatureSnapshot | null {
  try {
    const responseJson = JSON.stringify(detachJsonData(value));
    // A storage/validation bound, not a provider limit or crop threshold.
    if (responseJson.length > 131072) return null;
    return Object.freeze({ version: 1, responseJson, responseJsonSha256: digest(responseJson), endpoint });
  } catch { return null; }
}

/** A persisted object loses Object.freeze and TypeScript guarantees. Decode the
 * source response again; never upgrade an old display array into observations. */
export function readPowerTemperatureEvidence(receiptValue: unknown, snapshotValue: unknown,
  sitePoint: { latitude: number; longitude: number }): {
    readonly receipt: PowerMonthlyTemperatureReceipt; readonly snapshot: PowerTemperatureSnapshot;
  } | null {
  try {
    if (!pointValid(sitePoint)) return null;
    const receipt = detachJsonData(receiptValue) as PowerMonthlyTemperatureReceipt;
    const snapshot = detachJsonData(snapshotValue) as PowerTemperatureSnapshot;
    if (!snapshot || Object.keys(snapshot).sort().join(',') !== 'endpoint,responseJson,responseJsonSha256,version'
      || snapshot.version !== 1 || typeof snapshot.responseJson !== 'string' || snapshot.responseJson.length > 131072
      || !/^[a-f0-9]{64}$/.test(snapshot.responseJsonSha256)
      || digest(snapshot.responseJson) !== snapshot.responseJsonSha256 || typeof snapshot.endpoint !== 'string'
      || snapshot.endpoint.length > 2000) return null;
    const queryPoint = { latitude: Number(sitePoint.latitude.toFixed(4)), longitude: Number(sitePoint.longitude.toFixed(4)) };
    const url = new URL(snapshot.endpoint);
    const coordinate = (key: string) => {
      const value = url.searchParams.get(key);
      return value && /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
    };
    if (url.origin !== 'https://power.larc.nasa.gov' || url.pathname !== '/api/temporal/climatology/point'
      || url.hash || url.username || url.password || url.searchParams.get('format') !== 'JSON'
      || url.searchParams.get('community') !== 'AG'
      || !url.searchParams.get('parameters')?.split(',').includes('T2M')
      || !['latitude', 'longitude', 'parameters', 'community', 'format'].every(key => url.searchParams.getAll(key).length === 1)
      || coordinate('latitude') !== queryPoint.latitude || coordinate('longitude') !== queryPoint.longitude) return null;
    const decoded = powerMonthlyTemperatureReceipt(JSON.parse(snapshot.responseJson), queryPoint, receipt?.receivedAt);
    if (!decoded || JSON.stringify(decoded) !== JSON.stringify(receipt)) return null;
    return Object.freeze({ receipt: decoded, snapshot: Object.freeze(snapshot) });
  } catch { return null; }
}
