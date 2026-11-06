import { DWD_MOSMIX_PROVIDER_ID, dwdMosmixStationEndpoint, parseDwdMosmixProvenance,
  parseDwdStationRequest, type DwdMosmixProvenance } from './dwd-mosmix-request.ts';
import { snapshotDwdMosmixBytes } from './dwd-mosmix-byte-snapshot.ts';

/** Engineering ceilings for one retrieval, not DWD quotas or forecast validity. */
export const DWD_MOSMIX_HTTP_LIMITS = Object.freeze({ responseBytes: 1_048_576, totalTimeoutMs: 12_000 });
export type DwdMosmixHttpFailureReason = 'invalid-station' | 'invalid-options' | 'timeout'
  | 'network-error' | 'rate-limited' | 'http-error' | 'malformed-response' | 'response-too-large';
export type DwdMosmixHttpResult = Readonly<{
  status: 'retrieved'; archive: Blob; provenance: Readonly<DwdMosmixProvenance>;
}> | Readonly<{
  status: 'failed'; reason: DwdMosmixHttpFailureReason; endpoint: string | null;
  stationId: string | null; provenance: null; httpStatus?: number; retryAfterSeconds?: number | null;
}>;
export interface DwdMosmixHttpOptions { fetcher?: typeof fetch; now?: () => Date; timeoutMs?: number }

const MIME_TYPES = new Set(['application/vnd.google-earth.kmz', 'application/zip', 'application/octet-stream']);
function option(record: object, key: string): unknown {
  const property = Object.getOwnPropertyDescriptor(record, key);
  if (property && !Object.hasOwn(property, 'value')) throw Error('Unsafe option');
  return property?.value;
}

/** SERVER-INTENDED. The caller explicitly chooses a public station, never an
 * arbitrary URL or a farm point. Retrieved bytes are not yet a weather result. */
export async function fetchDwdMosmixArchive(input: unknown, options: DwdMosmixHttpOptions = {}): Promise<DwdMosmixHttpResult> {
  const request = parseDwdStationRequest(input);
  const endpoint = request ? dwdMosmixStationEndpoint(request) : null;
  const failed = (reason: DwdMosmixHttpFailureReason, extra: { httpStatus?: number; retryAfterSeconds?: number | null } = {}): DwdMosmixHttpResult =>
    Object.freeze({ status: 'failed', reason, endpoint, stationId: request?.stationId ?? null, provenance: null, ...extra });
  // Invalid selection must not inspect custom options or contact a provider.
  if (!request || !endpoint) return failed('invalid-station');

  let fetcher: typeof fetch, now: () => Date, timeoutMs: number;
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return failed('invalid-options');
    const suppliedFetcher = option(options, 'fetcher'), suppliedNow = option(options, 'now');
    const suppliedTimeout = option(options, 'timeoutMs');
    if (suppliedFetcher !== undefined && typeof suppliedFetcher !== 'function'
      || suppliedNow !== undefined && typeof suppliedNow !== 'function'
      || suppliedTimeout !== undefined && (typeof suppliedTimeout !== 'number' || !Number.isFinite(suppliedTimeout) || suppliedTimeout <= 0)) return failed('invalid-options');
    fetcher = (suppliedFetcher ?? fetch) as typeof fetch;
    now = (suppliedNow ?? (() => new Date())) as () => Date;
    timeoutMs = Math.max(1, Math.min(DWD_MOSMIX_HTTP_LIMITS.totalTimeoutMs, (suppliedTimeout as number | undefined) ?? DWD_MOSMIX_HTTP_LIMITS.totalTimeoutMs));
  } catch { return failed('invalid-options'); }

  const controller = new AbortController(), deadline = performance.now() + timeoutMs;
  let timedOut = false, activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timer: ReturnType<typeof setTimeout>;
  const cancel = (response: Response) => {
    try { void response.body?.cancel().catch(() => {}); } catch { /* Do not wait for cancellation acknowledgement. */ }
  };
  const expire = () => {
    if (timedOut) return;
    timedOut = true; controller.abort();
    try { void activeReader?.cancel().catch(() => {}); } catch { /* A stalled body does not hold delivery open. */ }
  };
  const expired = () => {
    // A fulfilled promise can run before a delayed timeout callback.
    if (!timedOut && performance.now() >= deadline) expire();
    return timedOut;
  };
  const timeout = new Promise<DwdMosmixHttpResult>(resolve => {
    timer = setTimeout(() => { expire(); resolve(failed('timeout')); }, timeoutMs);
  });

  async function retrieve(): Promise<DwdMosmixHttpResult> {
    let response: Response;
    try {
      response = await fetcher(endpoint!, { signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/vnd.google-earth.kmz, application/zip, application/octet-stream',
          'User-Agent': 'ImbewuField/1.0 (https://imbewufield.vercel.app)' } });
    } catch { return failed(expired() ? 'timeout' : 'network-error'); }
    if (expired()) { cancel(response); return failed('timeout'); }
    try {
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const match = raw === null ? null : /^[0-9]+$/.exec(raw);
        const seconds = match?.[0] === raw ? Number(raw) : NaN;
        cancel(response);
        return failed('rate-limited', { httpStatus: 429, retryAfterSeconds: Number.isSafeInteger(seconds) ? seconds : null });
      }
      if (!response.ok || response.redirected) { cancel(response); return failed('http-error', { httpStatus: response.status }); }
      if (response.url && response.url !== endpoint) { cancel(response); return failed('malformed-response'); }
      const contentType = response.headers.get('content-type');
      const mime = contentType?.split(';')[0].trim().toLowerCase();
      // A permitted prefix before a semicolon cannot hide a conflicting second
      // media type. This narrow archive profile also holds comma parameters.
      if (!contentType || contentType.includes(',') || !mime || !MIME_TYPES.has(mime)) {
        cancel(response); return failed('malformed-response');
      }
      const rawLength = response.headers.get('content-length');
      if (rawLength !== null) {
        const match = /^[0-9]+$/.exec(rawLength);
        if (match?.[0] !== rawLength) { cancel(response); return failed('malformed-response'); }
        const length = Number(rawLength);
        if (!Number.isSafeInteger(length) || length > DWD_MOSMIX_HTTP_LIMITS.responseBytes) {
          cancel(response); return failed('response-too-large');
        }
      }
      if (!response.body) return failed('malformed-response');
      const reader = response.body.getReader(); activeReader = reader;
      const chunks: Uint8Array<ArrayBuffer>[] = []; let byteLength = 0, complete = false;
      try {
        while (!expired()) {
          let part: ReadableStreamReadResult<Uint8Array>;
          try { part = await reader.read(); } catch { return failed(expired() ? 'timeout' : 'network-error'); }
          if (expired()) return failed('timeout');
          if (part.done) { complete = true; break; }
          const chunk = snapshotDwdMosmixBytes(part.value, DWD_MOSMIX_HTTP_LIMITS.responseBytes-byteLength);
          if (typeof chunk === 'string') return failed(chunk === 'software-bound' ? 'response-too-large' : 'malformed-response');
          if (!chunk.byteLength) continue;
          byteLength += chunk.byteLength;
          // A stream may reuse buffers. The returned Blob must contain the bytes
          // seen in each chunk, rather than a later mutation of the last buffer.
          chunks.push(chunk);
        }
        if (expired()) return failed('timeout');
        if (!byteLength) return failed('malformed-response');
        let fetchedAt: string;
        try { fetchedAt = Date.prototype.toISOString.call(now()); }
        catch { return failed('invalid-options'); }
        const provenance = parseDwdMosmixProvenance({ providerId: DWD_MOSMIX_PROVIDER_ID, endpoint, fetchedAt,
          expectedStationId: request!.stationId, kind: 'public-station', referenceOnly: true });
        if (!provenance) return failed('invalid-options');
        if (expired()) return failed('timeout');
        return Object.freeze({ status: 'retrieved', archive: new Blob(chunks, { type: 'application/vnd.google-earth.kmz' }), provenance });
      } finally {
        if (!complete) {
          try { void reader.cancel().catch(() => {}); } catch { /* Partial input is never retained for another attempt. */ }
        }
        if (activeReader === reader) activeReader = null;
        try { reader.releaseLock(); } catch { /* A timed-out read can still be settling. */ }
      }
    } catch { cancel(response); return failed('malformed-response'); }
  }

  // Fetch and custom streams may ignore AbortSignal. Race the whole retrieval;
  // the late result cannot turn a timed-out attempt into retrieved weather data.
  try {
    const result = await Promise.race([retrieve(), timeout]);
    return expired() ? failed('timeout') : result;
  } finally { clearTimeout(timer!); }
}
