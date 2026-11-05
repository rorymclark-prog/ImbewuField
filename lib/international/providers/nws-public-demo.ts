import { detachJsonData } from '@/lib/lossless-json';
import { COUNTRY_CLIMATE_DEMOS } from './nasa-reference';
import { decodeNwsReference, type NwsReferenceProvenance, type NwsReferenceResult } from './nws-reference';

/** SERVER-INTENDED: the same-origin server action owns this request, including its real
 * identifying User-Agent. This is not a client-side header spoof or farm forecast. */
export const NWS_PUBLIC_DEMO_LIMITS = Object.freeze({ totalTimeoutMs: 12_000, responseBytes: 65_536,
  description: 'Software bounds: 12 seconds total, 64 KiB per response, two requests maximum, no retries.' });
const USER_AGENT = 'ImbewuField/1.0 (https://imbewufield.vercel.app)';
const ORIGIN = 'https://api.weather.gov';
type Stage = 'selection' | 'point' | 'forecast' | 'decode';
export type NwsPublicDemoFailure = 'unsupported-demo' | 'invalid-options' | 'timeout' | 'network-error'
  | 'rate-limited' | 'http-error' | 'malformed-response' | 'response-too-large';
type Failure = { status: 'failed'; reason: NwsPublicDemoFailure; stage: Stage; provenance: NwsReferenceProvenance;
  httpStatus?: number; retryAfterSeconds?: number | null; decoderReason?: string };
export type NwsPublicDemoResult = Exclude<NwsReferenceResult, { status: 'failed' }> | Failure;
export interface NwsPublicDemoOptions { fetcher?: typeof fetch; now?: () => Date; timeoutMs?: number }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function own(value: Record<string, unknown>, key: string): unknown {
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (field && !Object.hasOwn(field, 'value')) throw Error('Unsafe data field');
  return field?.value;
}

function forecastMapping(value: unknown): URL | null {
  const point = detachJsonData(value);
  if (!record(point) || own(point, 'type') !== 'Feature') return null;
  const geometry = own(point, 'geometry'), properties = own(point, 'properties');
  if (!record(geometry) || own(geometry, 'type') !== 'Point' || !record(properties)) return null;
  const coordinates = own(geometry, 'coordinates'), demo = COUNTRY_CLIMATE_DEMOS.US;
  if (!Array.isArray(coordinates) || coordinates.length !== 2
    || coordinates[0] !== demo.longitude || coordinates[1] !== demo.latitude) return null;
  const gridId = own(properties, 'gridId'), x = own(properties, 'gridX'), y = own(properties, 'gridY');
  const endpoint = own(properties, 'forecast');
  if (typeof gridId !== 'string' || !/^[A-Z0-9]{3}$/.test(gridId)
    || typeof x !== 'number' || !Number.isSafeInteger(x) || x < 0
    || typeof y !== 'number' || !Number.isSafeInteger(y) || y < 0 || typeof endpoint !== 'string') return null;
  // Exact spelling also rejects explicit default ports and URL normalization
  // tricks, before any returned URL can become a second network destination.
  const expected = `${ORIGIN}/gridpoints/${gridId}/${x},${y}/forecast`;
  if (endpoint !== expected) return null;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'api.weather.gov' || url.port || url.username || url.password || url.search || url.hash) return null;
  url.searchParams.set('units', 'si');
  return url;
}

/** Only the existing fixed US public demonstration is supported. A decoded
 * response and its receipt do not authenticate farm geography or approve advice. */
export async function fetchCountryNwsPublicDemo(code: string, options: NwsPublicDemoOptions = {}): Promise<NwsPublicDemoResult> {
  let provenance: NwsReferenceProvenance = { providerId: 'nws-forecast-reference', fetchedAt: '', endpoint: '',
    demoPlace: code === 'US' ? COUNTRY_CLIMATE_DEMOS.US.label : '', referenceOnly: true };
  let stage: Stage = 'selection';
  const failed = (reason: NwsPublicDemoFailure, extra: Partial<Pick<Failure, 'httpStatus' | 'retryAfterSeconds' | 'decoderReason'>> = {}): Failure =>
    ({ status: 'failed', reason, stage, provenance: { ...provenance }, ...extra });
  if (code !== 'US') return failed('unsupported-demo');
  let fetcher: typeof fetch, clock: () => Date, timeoutMs: number;
  try {
    if (!record(options)) return failed('invalid-options');
    const suppliedFetcher = own(options as Record<string, unknown>, 'fetcher');
    const suppliedClock = own(options as Record<string, unknown>, 'now');
    const suppliedTimeout = own(options as Record<string, unknown>, 'timeoutMs');
    if (suppliedFetcher !== undefined && typeof suppliedFetcher !== 'function'
      || suppliedClock !== undefined && typeof suppliedClock !== 'function'
      || suppliedTimeout !== undefined && (typeof suppliedTimeout !== 'number' || !Number.isFinite(suppliedTimeout) || suppliedTimeout <= 0)) return failed('invalid-options');
    fetcher = (suppliedFetcher ?? fetch) as typeof fetch;
    clock = (suppliedClock ?? (() => new Date())) as () => Date;
    timeoutMs = Math.max(1, Math.min(NWS_PUBLIC_DEMO_LIMITS.totalTimeoutMs, (suppliedTimeout as number | undefined) ?? NWS_PUBLIC_DEMO_LIMITS.totalTimeoutMs));
  } catch { return failed('invalid-options'); }
  const controller = new AbortController();
  const monotonicNow = performance.now.bind(performance), deadline = monotonicNow() + timeoutMs;
  let timedOut = false, activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout>;
  const cancelBody = (response: Response) => { try { void response.body?.cancel().catch(() => {}); } catch { /* Failure stays bounded even if cancellation is unavailable. */ } };
  const stopForTimeout = () => {
    if (timedOut) return;
    timedOut = true; controller.abort();
    try { void activeReader?.cancel().catch(() => {}); } catch { /* Never wait for a provider to acknowledge cancellation. */ }
  };
  const expired = () => {
    // Promise continuations can beat a delayed timer after synchronous work.
    // Retrieval timestamps are caller-supplied receipt data, never this deadline.
    if (!timedOut && monotonicNow() >= deadline) stopForTimeout();
    return timedOut;
  };
  const timeout = new Promise<Failure>(resolve => {
    timer = setTimeout(() => {
      stopForTimeout();
      resolve(failed('timeout'));
    }, timeoutMs);
  });
  async function readJson(endpoint: string, nextStage: 'point' | 'forecast'): Promise<{ status: 'decoded'; value: unknown } | Failure> {
    stage = nextStage; provenance = { ...provenance, endpoint, fetchedAt: '' };
    if (expired()) return failed('timeout');
    let response: Response;
    try {
      response = await fetcher(endpoint, { signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/geo+json, application/json', 'User-Agent': USER_AGENT } });
    } catch { return failed(expired() ? 'timeout' : 'network-error'); }
    if (expired()) { cancelBody(response); return failed('timeout'); }
    try {
      if (response.status === 429) {
        const raw = response.headers.get('retry-after'), seconds = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
        cancelBody(response);
        return failed('rate-limited', { httpStatus: 429, retryAfterSeconds: Number.isSafeInteger(seconds) ? seconds : null });
      }
      if (!response.ok || response.redirected) { cancelBody(response); return failed('http-error', { httpStatus: response.status }); }
      if (response.url && response.url !== endpoint) { cancelBody(response); return failed('malformed-response'); }
      const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (mime !== 'application/geo+json' && mime !== 'application/json') { cancelBody(response); return failed('malformed-response'); }
      const length = response.headers.get('content-length');
      if (length !== null && /^\d+$/.test(length) && Number(length) > NWS_PUBLIC_DEMO_LIMITS.responseBytes) {
        cancelBody(response); return failed('response-too-large');
      }
      if (!response.body) return failed('malformed-response');
      const reader = response.body.getReader(); activeReader = reader;
      const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        while (!expired()) {
          let part: ReadableStreamReadResult<Uint8Array>;
          try { part = await reader.read(); } catch { return failed(expired() ? 'timeout' : 'network-error'); }
          if (expired()) return failed('timeout');
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > NWS_PUBLIC_DEMO_LIMITS.responseBytes) {
            try { void reader.cancel().catch(() => {}); } catch { /* The byte bound does not depend on successful cancellation. */ }
            return failed('response-too-large');
          }
          chunks.push(part.value);
        }
        if (expired()) return failed('timeout');
        const body = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        let value: unknown;
        try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
        catch { return failed(expired() ? 'timeout' : 'malformed-response'); }
        if (expired()) return failed('timeout');
        try { provenance = { ...provenance, fetchedAt: Date.prototype.toISOString.call(clock()) }; }
        catch { return failed(expired() ? 'timeout' : 'invalid-options'); }
        if (expired()) return failed('timeout');
        return { status: 'decoded', value };
      } finally {
        if (activeReader === reader) activeReader = null;
        try { reader.releaseLock(); } catch { /* A timed-out read must not hold delivery open. */ }
      }
    } catch { cancelBody(response); return failed('malformed-response'); }
  }
  async function request(): Promise<NwsPublicDemoResult> {
    const demo = COUNTRY_CLIMATE_DEMOS.US;
    const point = await readJson(`${ORIGIN}/points/${demo.latitude},${demo.longitude}`, 'point');
    if (expired()) return failed('timeout');
    if (point.status === 'failed') return point;
    let mapping: URL | null;
    try { mapping = forecastMapping(point.value); } catch { mapping = null; }
    if (expired()) return failed('timeout');
    if (!mapping) return failed('malformed-response');
    const forecast = await readJson(mapping.href, 'forecast');
    if (expired()) return failed('timeout');
    if (forecast.status === 'failed') return forecast;
    stage = 'decode';
    try {
      const decoded = decodeNwsReference(forecast.value, provenance);
      if (expired()) return failed('timeout');
      return decoded.status === 'failed' ? failed('malformed-response', { decoderReason: decoded.reason }) : decoded;
    } catch { return failed(expired() ? 'timeout' : 'malformed-response'); }
  }
  // Fetch and body streams can ignore AbortSignal. Race the entire two-step
  // operation and prevent a late point response from starting a forecast request.
  try {
    const result = await Promise.race([request(), timeout]);
    return expired() ? failed('timeout') : result;
  }
  finally { clearTimeout(timer!); }
}
