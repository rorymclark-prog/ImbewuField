import { fetchDwdMosmixArchive, type DwdMosmixHttpOptions, type DwdMosmixHttpResult } from './dwd-mosmix-http.ts';
import { extractDwdMosmixArchive, type DwdMosmixArchiveExtractionResult } from './dwd-mosmix-archive.ts';
import { decodeDwdMosmixKmlBytes, type DwdMosmixByteResult } from './dwd-mosmix-encoding.ts';
import { type DwdMosmixProvenance } from './dwd-mosmix-request.ts';
import { type DwdMosmixResult } from './dwd-mosmix-reference.ts';

/**
 * Total pipeline timeout limit for composed DWD MOSMIX import.
 *
 * Why: Untrusted network retrieval, archive decompression, and XML decoding must settle
 * within an overall engineering pipeline ceiling (24,000 ms). This is a software boundary,
 * not a provider quota or farming deadline.
 */
export const DWD_MOSMIX_IMPORT_LIMITS = Object.freeze({
  totalTimeoutMs: 24_000,
});

export type DwdMosmixImportFailure =
  | Extract<DwdMosmixHttpResult, { status: 'failed' }>
  | Extract<DwdMosmixArchiveExtractionResult, { status: 'failed' }>
  | Extract<DwdMosmixByteResult, { status: 'failed' }>
  | Readonly<{
      status: 'failed';
      reason: 'timeout';
      provenance: Readonly<DwdMosmixProvenance> | null;
    }>;

export type DwdMosmixImportResult = DwdMosmixResult | DwdMosmixImportFailure;

/**
 * SERVER-INTENDED. Composes retrieval, archive extraction, and XML decoding for a public
 * DWD station forecast reference.
 *
 * Why:
 * 1. A single monotonic 24-second deadline starts before retrieval and spans HTTP download,
 *    Blob byte consumption, ZIP archive extraction, and XML decoding.
 * 2. If the deadline expires at any point, owned archive operations are aborted and a static
 *    timeout failure is delivered. A late async step or delayed timer callback cannot authorize
 *    a late result.
 * 3. On HTTP failure, its exact result (including rate-limiting retry headers) is forwarded unchanged.
 * 4. On archive extraction failure, its static failure is returned.
 * 5. On decoding failure, its static failure is returned.
 * 6. Unexpected internal errors are caught and returned as static invalid-archive failures without
 *    exposing internal paths, raw exception messages, or partial bytes.
 * 7. No caching, automatic retries, farm coordinates, or unit mutations are applied.
 */
export async function fetchDwdMosmixStationReference(
  input: unknown,
  options: DwdMosmixHttpOptions = {}
): Promise<DwdMosmixImportResult> {
  const start = performance.now();
  const deadline = start + DWD_MOSMIX_IMPORT_LIMITS.totalTimeoutMs;

  const archiveController = new AbortController();
  let timedOut = false;
  let activeProvenance: Readonly<DwdMosmixProvenance> | null = null;

  const isExpired = (): boolean => {
    if (!timedOut && performance.now() >= deadline) {
      timedOut = true;
      if (!archiveController.signal.aborted) {
        archiveController.abort();
      }
    }
    return timedOut;
  };

  const timeoutFailure = (): DwdMosmixImportResult =>
    Object.freeze({
      status: 'failed',
      reason: 'timeout',
      provenance: activeProvenance,
    });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<DwdMosmixImportResult>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      if (!archiveController.signal.aborted) {
        archiveController.abort();
      }
      resolve(timeoutFailure());
    }, DWD_MOSMIX_IMPORT_LIMITS.totalTimeoutMs);
  });

  async function executePipeline(): Promise<DwdMosmixImportResult> {
    // 1. Initial expiry check
    if (isExpired()) {
      return timeoutFailure();
    }

    // 2. HTTP Retrieval
    let httpResult: DwdMosmixHttpResult;
    try {
      httpResult = await fetchDwdMosmixArchive(input, options);
    } catch {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance: null,
      });
    }

    if (isExpired()) {
      return timeoutFailure();
    }

    if (httpResult.status === 'failed') {
      return httpResult;
    }

    activeProvenance = httpResult.provenance;

    // 3. Extract bytes from HTTP archive Blob
    let archiveBytes: Uint8Array;
    try {
      const buffer = await httpResult.archive.arrayBuffer();
      archiveBytes = new Uint8Array(buffer);
    } catch {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance: activeProvenance,
      });
    }

    if (isExpired()) {
      return timeoutFailure();
    }

    // 4. Archive extraction
    let extractResult: DwdMosmixArchiveExtractionResult;
    try {
      extractResult = await extractDwdMosmixArchive(
        archiveBytes,
        activeProvenance,
        archiveController.signal
      );
    } catch {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance: activeProvenance,
      });
    }

    if (isExpired()) {
      return timeoutFailure();
    }

    if (extractResult.status === 'failed') {
      return extractResult;
    }

    activeProvenance = extractResult.provenance;

    // 5. Read extracted KML Blob bytes
    let kmlBytes: Uint8Array;
    try {
      const kmlBuffer = await extractResult.kml.arrayBuffer();
      kmlBytes = new Uint8Array(kmlBuffer);
    } catch {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance: activeProvenance,
      });
    }

    if (isExpired()) {
      return timeoutFailure();
    }

    // 6. Decode KML bytes synchronously
    let decodeResult: DwdMosmixByteResult;
    try {
      decodeResult = decodeDwdMosmixKmlBytes(kmlBytes, activeProvenance);
    } catch {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance: activeProvenance,
      });
    }

    if (isExpired()) {
      return timeoutFailure();
    }

    return decodeResult;
  }

  try {
    const winner = await Promise.race([executePipeline(), timeoutPromise]);
    if (isExpired()) {
      return timeoutFailure();
    }
    return winner;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (!archiveController.signal.aborted) {
      archiveController.abort();
    }
  }
}
