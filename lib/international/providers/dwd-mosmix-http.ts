import {
  DWD_MOSMIX_PROVIDER_ID,
  dwdMosmixStationEndpoint,
  parseDwdMosmixProvenance,
  parseDwdStationRequest,
  type DwdMosmixProvenance,
} from './dwd-mosmix-request.ts';
import { snapshotDwdMosmixBytes } from './dwd-mosmix-byte-snapshot.ts';
import {
  parseDwdMosmixCatalogSearchQuery,
  searchDwdMosmixStationCatalogBytes,
  type DwdMosmixCatalogSearchResult,
} from './dwd-mosmix-catalog-search.ts';
import { isGrowerRecordedAt } from '../grower-planning.ts';

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

export const DWD_MOSMIX_CATALOG_ENDPOINT =
  'https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg?view=nasPublication&nn=16102';

export interface DwdMosmixCatalogProvenance {
  readonly providerId: 'dwd-mosmix-station-catalog-reference';
  readonly kind: 'public-station-catalog';
  readonly endpoint: typeof DWD_MOSMIX_CATALOG_ENDPOINT;
  readonly fetchedAt: string;
  readonly referenceOnly: true;
}

export type DwdMosmixCatalogTransportFailure = Readonly<{
  status: 'failed';
  reason: Exclude<DwdMosmixHttpFailureReason, 'invalid-station'>;
  endpoint: typeof DWD_MOSMIX_CATALOG_ENDPOINT;
  provenance: null;
  httpStatus?: number;
  retryAfterSeconds?: number | null;
}>;

export type DwdMosmixLiveCatalogSearchResult =
  | Extract<DwdMosmixCatalogSearchResult, { status: 'failed' }>
  | DwdMosmixCatalogTransportFailure
  | Readonly<
      Extract<DwdMosmixCatalogSearchResult, { status: 'matches' | 'no-matches' }> & {
        provenance: Readonly<DwdMosmixCatalogProvenance>;
      }
    >;

const ARCHIVE_MIME_TYPES = new Set(['application/vnd.google-earth.kmz', 'application/zip', 'application/octet-stream']);
const CATALOG_MIME_TYPES = new Set(['text/plain']);

function option(record: object, key: string): unknown {
  const property = Object.getOwnPropertyDescriptor(record, key);
  if (property && !Object.hasOwn(property, 'value')) throw Error('Unsafe option');
  return property?.value;
}

interface BoundedBodyPolicy<TSuccess, TFailure> {
  readonly endpoint: string;
  readonly acceptHeader: string;
  readonly allowedMimes: ReadonlySet<string>;
  readonly createFailure: (
    reason: DwdMosmixHttpFailureReason,
    extra?: { httpStatus?: number; retryAfterSeconds?: number | null }
  ) => TFailure;
  readonly finalize: (
    chunks: readonly Uint8Array<ArrayBuffer>[],
    totalBytes: number,
    now: () => Date
  ) => TSuccess | TFailure;
}

async function fetchDwdBoundedBody<TSuccess, TFailure>(
  policy: BoundedBodyPolicy<TSuccess, TFailure>,
  options: DwdMosmixHttpOptions
): Promise<TSuccess | TFailure> {
  let fetcher: typeof fetch, now: () => Date, timeoutMs: number;
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return policy.createFailure('invalid-options');
    }
    const suppliedFetcher = option(options, 'fetcher'), suppliedNow = option(options, 'now');
    const suppliedTimeout = option(options, 'timeoutMs');
    if (
      (suppliedFetcher !== undefined && typeof suppliedFetcher !== 'function') ||
      (suppliedNow !== undefined && typeof suppliedNow !== 'function') ||
      (suppliedTimeout !== undefined &&
        (typeof suppliedTimeout !== 'number' || !Number.isFinite(suppliedTimeout) || suppliedTimeout <= 0))
    ) {
      return policy.createFailure('invalid-options');
    }
    fetcher = (suppliedFetcher ?? fetch) as typeof fetch;
    now = (suppliedNow ?? (() => new Date())) as () => Date;
    timeoutMs = Math.max(
      1,
      Math.min(
        DWD_MOSMIX_HTTP_LIMITS.totalTimeoutMs,
        (suppliedTimeout as number | undefined) ?? DWD_MOSMIX_HTTP_LIMITS.totalTimeoutMs
      )
    );
  } catch {
    return policy.createFailure('invalid-options');
  }

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
    if (!timedOut && performance.now() >= deadline) expire();
    return timedOut;
  };
  const timeoutPromise = new Promise<TSuccess | TFailure>(resolve => {
    timer = setTimeout(() => { expire(); resolve(policy.createFailure('timeout')); }, timeoutMs);
  });

  async function retrieve(): Promise<TSuccess | TFailure> {
    let response: Response;
    try {
      response = await fetcher(policy.endpoint, {
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Accept: policy.acceptHeader,
          'User-Agent': 'ImbewuField/1.0 (https://imbewufield.vercel.app)',
        },
      });
    } catch {
      return policy.createFailure(expired() ? 'timeout' : 'network-error');
    }
    if (expired()) {
      cancel(response);
      return policy.createFailure('timeout');
    }

    try {
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const match = raw === null ? null : /^[0-9]+$/.exec(raw);
        const seconds = match?.[0] === raw ? Number(raw) : NaN;
        cancel(response);
        return policy.createFailure('rate-limited', {
          httpStatus: 429,
          retryAfterSeconds: Number.isSafeInteger(seconds) ? seconds : null,
        });
      }
      if (!response.ok || response.redirected) {
        cancel(response);
        return policy.createFailure('http-error', { httpStatus: response.status });
      }
      if (response.url && response.url !== policy.endpoint) {
        cancel(response);
        return policy.createFailure('malformed-response');
      }

      const contentType = response.headers.get('content-type');
      const mime = contentType?.split(';')[0].trim().toLowerCase();
      if (!contentType || contentType.includes(',') || !mime || !policy.allowedMimes.has(mime)) {
        cancel(response);
        return policy.createFailure('malformed-response');
      }

      const rawLength = response.headers.get('content-length');
      if (rawLength !== null) {
        const match = /^[0-9]+$/.exec(rawLength);
        if (match?.[0] !== rawLength) {
          cancel(response);
          return policy.createFailure('malformed-response');
        }
        const length = Number(rawLength);
        if (!Number.isSafeInteger(length) || length > DWD_MOSMIX_HTTP_LIMITS.responseBytes) {
          cancel(response);
          return policy.createFailure('response-too-large');
        }
      }

      if (!response.body) return policy.createFailure('malformed-response');
      const reader = response.body.getReader();
      activeReader = reader;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let byteLength = 0, complete = false;

      try {
        while (!expired()) {
          let part: ReadableStreamReadResult<Uint8Array>;
          try {
            part = await reader.read();
          } catch {
            return policy.createFailure(expired() ? 'timeout' : 'network-error');
          }
          if (expired()) return policy.createFailure('timeout');
          if (part.done) {
            complete = true;
            break;
          }
          const chunk = snapshotDwdMosmixBytes(part.value, DWD_MOSMIX_HTTP_LIMITS.responseBytes - byteLength);
          if (typeof chunk === 'string') {
            return policy.createFailure(chunk === 'software-bound' ? 'response-too-large' : 'malformed-response');
          }
          if (!chunk.byteLength) continue;
          byteLength += chunk.byteLength;
          chunks.push(chunk);
        }
        if (expired()) return policy.createFailure('timeout');
        if (!byteLength) return policy.createFailure('malformed-response');

        // Check deadline before synchronous finalization
        if (expired()) return policy.createFailure('timeout');

        const finalized = policy.finalize(chunks, byteLength, now);

        // Check deadline after synchronous finalization
        if (expired()) return policy.createFailure('timeout');

        return finalized;
      } finally {
        if (!complete) {
          try { void reader.cancel().catch(() => {}); } catch { /* Partial input is never retained for another attempt. */ }
        }
        if (activeReader === reader) activeReader = null;
        try { reader.releaseLock(); } catch { /* A timed-out read can still be settling. */ }
      }
    } catch {
      cancel(response);
      return policy.createFailure('malformed-response');
    }
  }

  try {
    const result = await Promise.race([retrieve(), timeoutPromise]);
    return expired() ? policy.createFailure('timeout') : result;
  } finally {
    clearTimeout(timer!);
  }
}

/** SERVER-INTENDED. The caller explicitly chooses a public station, never an
 * arbitrary URL or a farm point. Retrieved bytes are not yet a weather result. */
export async function fetchDwdMosmixArchive(
  input: unknown,
  options: DwdMosmixHttpOptions = {}
): Promise<DwdMosmixHttpResult> {
  const request = parseDwdStationRequest(input);
  const endpoint = request ? dwdMosmixStationEndpoint(request) : null;
  const failed = (
    reason: DwdMosmixHttpFailureReason,
    extra: { httpStatus?: number; retryAfterSeconds?: number | null } = {}
  ): DwdMosmixHttpResult =>
    Object.freeze({
      status: 'failed',
      reason,
      endpoint,
      stationId: request?.stationId ?? null,
      provenance: null,
      ...extra,
    });

  // Invalid selection must not inspect custom options or contact a provider.
  if (!request || !endpoint) return failed('invalid-station');

  return fetchDwdBoundedBody<DwdMosmixHttpResult, DwdMosmixHttpResult>(
    {
      endpoint,
      acceptHeader: 'application/vnd.google-earth.kmz, application/zip, application/octet-stream',
      allowedMimes: ARCHIVE_MIME_TYPES,
      createFailure: failed,
      finalize: (chunks, _totalBytes, now) => {
        let fetchedAt: string;
        try {
          fetchedAt = Date.prototype.toISOString.call(now());
        } catch {
          return failed('invalid-options');
        }
        const provenance = parseDwdMosmixProvenance({
          providerId: DWD_MOSMIX_PROVIDER_ID,
          endpoint,
          fetchedAt,
          expectedStationId: request.stationId,
          kind: 'public-station',
          referenceOnly: true,
        });
        if (!provenance) return failed('invalid-options');
        return Object.freeze({
          status: 'retrieved',
          archive: new Blob([...chunks], { type: 'application/vnd.google-earth.kmz' }),
          provenance,
        });
      },
    },
    options
  );
}

/**
 * SERVER-INTENDED. Explicitly searches the official public DWD MOSMIX station catalogue.
 * Validates query FIRST before options or network dispatch.
 */
export async function fetchDwdMosmixCatalogSearch(
  query: unknown,
  options: DwdMosmixHttpOptions = {}
): Promise<DwdMosmixLiveCatalogSearchResult> {
  const sanitizedQuery = parseDwdMosmixCatalogSearchQuery(query);
  if (sanitizedQuery === null) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-query',
    });
  }

  const endpoint = DWD_MOSMIX_CATALOG_ENDPOINT;
  const failed = (
    reason: DwdMosmixHttpFailureReason,
    extra: { httpStatus?: number; retryAfterSeconds?: number | null } = {}
  ): DwdMosmixCatalogTransportFailure =>
    Object.freeze({
      status: 'failed',
      reason: reason as Exclude<DwdMosmixHttpFailureReason, 'invalid-station'>,
      endpoint,
      provenance: null,
      ...extra,
    });

  return fetchDwdBoundedBody<DwdMosmixLiveCatalogSearchResult, DwdMosmixCatalogTransportFailure>(
    {
      endpoint,
      acceptHeader: 'text/plain',
      allowedMimes: CATALOG_MIME_TYPES,
      createFailure: failed,
      finalize: (chunks, totalBytes, now) => {
        let fetchedAt: string;
        try {
          fetchedAt = Date.prototype.toISOString.call(now());
        } catch {
          return failed('invalid-options');
        }
        if (!isGrowerRecordedAt(fetchedAt)) {
          return failed('invalid-options');
        }

        const buffer = new Uint8Array(totalBytes);
        let offset = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          buffer.set(chunk, offset);
          offset += chunk.byteLength;
        }

        const searchResult = searchDwdMosmixStationCatalogBytes(buffer, sanitizedQuery);
        if (searchResult.status === 'failed') {
          return searchResult;
        }

        const provenance: Readonly<DwdMosmixCatalogProvenance> = Object.freeze({
          providerId: 'dwd-mosmix-station-catalog-reference',
          kind: 'public-station-catalog',
          endpoint,
          fetchedAt,
          referenceOnly: true,
        });

        return Object.freeze({
          ...searchResult,
          provenance,
        });
      },
    },
    options
  );
}
