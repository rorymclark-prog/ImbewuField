import { decodeEaRainfallReference, EA_RAINFALL_REFERENCE_PROVIDER, type EaRainfallReferenceResult } from './ea-rainfall-reference';

/** These are application bounds for a single public example, not provider quotas. */
export const EA_RAINFALL_PUBLIC_DEMO_LIMITS = Object.freeze({ totalTimeoutMs: 12_000, responseBytes: 65_536,
  description: 'One request, 12 seconds total, 64 KiB, no automatic retries.' });
type Stage = 'selection' | 'request' | 'decode';
export type EaRainfallPublicDemoFailure = 'unsupported-demo' | 'invalid-options' | 'timeout' | 'network-error'
  | 'rate-limited' | 'http-error' | 'malformed-response' | 'response-too-large';
type Failure = { status: 'failed'; reason: EaRainfallPublicDemoFailure; stage: Stage;
  provenance: { providerId: 'ea-rainfall-public-reference'; endpoint: string; fetchedAt: string | null; referenceOnly: true };
  httpStatus?: number; retryAfterSeconds?: number | null };
export type EaRainfallPublicDemoResult = EaRainfallReferenceResult | Failure;
export interface EaRainfallPublicDemoOptions { fetcher?: typeof fetch; now?: () => Date; timeoutMs?: number }

function own(value: object, key: string): unknown {
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (field && !Object.hasOwn(field, 'value')) throw Error('Unsafe option');
  return field?.value;
}

/** GB selects the workspace example, not a coverage assertion. No site, station,
 * account or farm coordinates can become a request parameter. */
export async function fetchCountryEaRainfallPublicDemo(code: string, options: EaRainfallPublicDemoOptions = {}): Promise<EaRainfallPublicDemoResult> {
  let stage: Stage = 'selection';
  let fetchedAt: string | null = null;
  const endpoint = EA_RAINFALL_REFERENCE_PROVIDER.endpoint;
  const failed = (reason: EaRainfallPublicDemoFailure, extra: Partial<Pick<Failure, 'httpStatus' | 'retryAfterSeconds'>> = {}): Failure =>
    ({ status: 'failed', reason, stage, provenance: { providerId: 'ea-rainfall-public-reference', endpoint, fetchedAt, referenceOnly: true }, ...extra });
  if (code !== 'GB') return failed('unsupported-demo');
  let fetcher: typeof fetch, clock: () => Date, timeoutMs: number;
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return failed('invalid-options');
    const suppliedFetcher = own(options, 'fetcher'), suppliedClock = own(options, 'now'), suppliedTimeout = own(options, 'timeoutMs');
    if (suppliedFetcher !== undefined && typeof suppliedFetcher !== 'function'
      || suppliedClock !== undefined && typeof suppliedClock !== 'function'
      || suppliedTimeout !== undefined && (typeof suppliedTimeout !== 'number' || !Number.isFinite(suppliedTimeout) || suppliedTimeout <= 0)) return failed('invalid-options');
    fetcher = (suppliedFetcher ?? fetch) as typeof fetch;
    clock = (suppliedClock ?? (() => new Date())) as () => Date;
    timeoutMs = Math.max(1, Math.min(EA_RAINFALL_PUBLIC_DEMO_LIMITS.totalTimeoutMs,
      (suppliedTimeout as number | undefined) ?? EA_RAINFALL_PUBLIC_DEMO_LIMITS.totalTimeoutMs));
  } catch { return failed('invalid-options'); }
  const controller = new AbortController();
  const monotonicNow = performance.now.bind(performance), deadline = monotonicNow() + timeoutMs;
  let timedOut = false, activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout>;
  const cancelBody = (response: Response) => { try { void response.body?.cancel().catch(() => {}); } catch { /* Refusal never waits for cancellation. */ } };
  const stopForTimeout = () => {
    if (timedOut) return;
    timedOut = true; controller.abort();
    try { void activeReader?.cancel().catch(() => {}); } catch { /* An ignored abort must still settle the caller. */ }
  };
  const expired = () => {
    // A delayed timer cannot grant permission to publish a late response.
    if (!timedOut && monotonicNow() >= deadline) stopForTimeout();
    return timedOut;
  };
  const timeout = new Promise<Failure>(resolve => {
    timer = setTimeout(() => { stopForTimeout(); resolve(failed('timeout')); }, timeoutMs);
  });
  async function request(): Promise<EaRainfallPublicDemoResult> {
    stage = 'request';
    if (expired()) return failed('timeout');
    let response: Response;
    try {
      response = await fetcher(endpoint, { signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/json' } });
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
      const contentType = response.headers.get('content-type');
      // Combined conflicting media types are not a single JSON response, even
      // when a valid-looking prefix appears before the first charset parameter.
      if (!contentType || contentType.includes(',') || contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
        cancelBody(response); return failed('malformed-response');
      }
      const length = response.headers.get('content-length');
      if (length !== null && /^\d+$/.test(length) && Number(length) > EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes) {
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
          if (bytes > EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes) {
            try { void reader.cancel().catch(() => {}); } catch { /* Byte refusal does not depend on cancellation success. */ }
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
        try { fetchedAt = Date.prototype.toISOString.call(clock()); }
        catch { return failed(expired() ? 'timeout' : 'invalid-options'); }
        if (expired()) { fetchedAt = null; return failed('timeout'); }
        stage = 'decode';
        try {
          const decoded = decodeEaRainfallReference(value, fetchedAt);
          if (expired()) { fetchedAt = null; return failed('timeout'); }
          return decoded;
        } catch { return failed(expired() ? 'timeout' : 'malformed-response'); }
      } finally {
        if (activeReader === reader) activeReader = null;
        try { reader.releaseLock(); } catch { /* Timed-out body work cannot hold delivery open. */ }
      }
    } catch { cancelBody(response); return failed(expired() ? 'timeout' : 'malformed-response'); }
  }
  try {
    const result = await Promise.race([request(), timeout]);
    return expired() ? failed('timeout') : result;
  } finally { clearTimeout(timer!); }
}
