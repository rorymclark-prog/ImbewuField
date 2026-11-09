import { ZipReader, Uint8ArrayReader, type Entry } from '@zip.js/zip.js/index-native.js';
import { snapshotDwdMosmixBytes } from './dwd-mosmix-byte-snapshot.ts';
import { parseDwdMosmixProvenance, type DwdMosmixProvenance } from './dwd-mosmix-request.ts';

/**
 * Hard software-engineering limits for DWD MOSMIX archive extraction.
 *
 * Why: Untrusted inputs from network transports must be bounded before decompression.
 * These limits represent strict software-engineering safety ceilings (1 MiB compressed archive,
 * 2 MiB uncompressed KML, exactly 1 archive entry). They are not DWD quota rules or farming limits.
 */
export const DWD_MOSMIX_ARCHIVE_LIMITS = Object.freeze({
  compressedBytes: 1048576,
  uncompressedBytes: 2097152,
  entries: 1,
});

export type DwdMosmixArchiveExtractionFailureReason =
  | 'invalid-provenance'
  | 'invalid-archive'
  | 'software-bound'
  | 'unsupported-archive'
  | 'aborted';

export type DwdMosmixArchiveExtractionResult =
  | {
      readonly status: 'failed';
      readonly reason: DwdMosmixArchiveExtractionFailureReason;
      readonly provenance: Readonly<DwdMosmixProvenance> | null;
    }
  | {
      readonly status: 'extracted';
      readonly kml: Blob;
      readonly filename: string;
      readonly provenance: Readonly<DwdMosmixProvenance>;
    };

/**
 * Validates the expected KML entry filename within the DWD MOSMIX KMZ archive.
 *
 * Why: The entry must match the exact naming contract MOSMIX_L_YYYYMMDDHH_<expectedStationId>.kml
 * with no path components, directory separators, null bytes, or traversal. The expected stationId
 * must match exactly (preserving case and leading zeros).
 */
function isValidDwdMosmixEntryFilename(filename: string, expectedStationId: string): boolean {
  if (typeof filename !== 'string') {
    return false;
  }
  if (filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    return false;
  }
  // YYYYMMDDHH: 10 digits
  const prefix = 'MOSMIX_L_';
  const suffix = `_${expectedStationId}.kml`;
  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) {
    return false;
  }
  const issuePart = filename.slice(prefix.length, filename.length - suffix.length);
  if (issuePart.length !== 10) {
    return false;
  }
  const match = /^[0-9]{10}$/.exec(issuePart);
  return match !== null && match[0] === issuePart;
}

/**
 * Validates and extracts a single KML document from an untrusted DWD MOSMIX KMZ archive.
 *
 * Why:
 * 1. Validates caller-supplied provenance before doing any codec work.
 * 2. Detaches and bounds input bytes via snapshotDwdMosmixBytes before any async boundary.
 * 3. Enforces an explicit narrow profile: exactly one unencrypted, non-directory, non-symlink
 *    DEFLATE (compressionMethod 8) entry whose filename matches MOSMIX_L_YYYYMMDDHH_<expectedStationId>.kml.
 * 4. Uses @zip.js/zip.js in strict mode with CRC-32 and local/central consistency checks.
 * 5. Streams decompression into an owned custom WritableStream, enforcing cumulative size limits
 *    before retaining each detached chunk copy, discarding all partial chunks on error or abort.
 * 6. Checks abort status before, during, and after enumeration (getEntriesGenerator has no signal
 *    option in pinned declarations), as well as after getData resolution immediately prior to publishing
 *    the immutable Blob snapshot.
 * 7. Explicitly aborts owned codec work during final cleanup before close, ensuring close alone
 *    is not relied upon for active extraction cancellation, while preserving the true failure reason.
 */
export async function extractDwdMosmixArchive(
  bytes: Uint8Array,
  source: unknown,
  signal?: AbortSignal
): Promise<Readonly<DwdMosmixArchiveExtractionResult>> {
  // 1. Validate provenance first
  const provenance = parseDwdMosmixProvenance(source);
  if (!provenance) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-provenance',
      provenance: null,
    });
  }

  // 2. Pre-check caller abort signal
  if (signal?.aborted) {
    return Object.freeze({
      status: 'failed',
      reason: 'aborted',
      provenance,
    });
  }

  // 3. Detach and bound compressed input bytes
  const inputSnapshot = snapshotDwdMosmixBytes(bytes, DWD_MOSMIX_ARCHIVE_LIMITS.compressedBytes);
  if (inputSnapshot === 'software-bound') {
    return Object.freeze({
      status: 'failed',
      reason: 'software-bound',
      provenance,
    });
  }
  if (inputSnapshot === 'invalid-byte-input') {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-archive',
      provenance,
    });
  }
  // Reject empty archive
  if (inputSnapshot.byteLength === 0) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-archive',
      provenance,
    });
  }

  // Set up internal abort controller linked to caller signal
  const internalController = new AbortController();
  const onCallerAbort = () => {
    internalController.abort();
  };
  if (signal) {
    signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let zipReader: ZipReader<Uint8Array> | null = null;
  const collectedChunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;
  let successPrepared = false;

  try {
    const reader = new Uint8ArrayReader(inputSnapshot);
    zipReader = new ZipReader(reader, {
      strictness: 'strict',
      checkCrc32: true,
      checkOverlappingEntry: true,
      checkLocalDirectory: true,
      checkLocalFilename: true,
      filenameValidation: 'strict',
      useWebWorkers: false,
    });

    let entryCount = 0;
    let targetEntry: Entry | null = null;

    // Check abort immediately before enumeration
    if (signal?.aborted || internalController.signal.aborted) {
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }

    // getEntriesGenerator has no signal option in the pinned declarations;
    // check abort on each yielded entry and again after the generator loop finishes.
    const entriesGenerator = zipReader.getEntriesGenerator();

    for await (const entry of entriesGenerator) {
      if (signal?.aborted || internalController.signal.aborted) {
        return Object.freeze({
          status: 'failed',
          reason: 'aborted',
          provenance,
        });
      }
      entryCount += 1;
      if (entryCount > DWD_MOSMIX_ARCHIVE_LIMITS.entries) {
        return Object.freeze({
          status: 'failed',
          reason: 'unsupported-archive',
          provenance,
        });
      }
      targetEntry = entry;
    }

    // Check abort after enumeration finishes (even when the generator ends empty)
    if (signal?.aborted || internalController.signal.aborted) {
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }

    if (entryCount !== 1 || !targetEntry) {
      return Object.freeze({
        status: 'failed',
        reason: entryCount === 0 ? 'invalid-archive' : 'unsupported-archive',
        provenance,
      });
    }

    // Validate target entry characteristics
    if (targetEntry.directory || targetEntry.symlink || targetEntry.encrypted) {
      return Object.freeze({
        status: 'failed',
        reason: 'unsupported-archive',
        provenance,
      });
    }

    // Must be DEFLATE (method 8)
    if (targetEntry.compressionMethod !== 8) {
      return Object.freeze({
        status: 'failed',
        reason: 'unsupported-archive',
        provenance,
      });
    }

    // Reject ZIP64 entry
    if (targetEntry.zip64) {
      return Object.freeze({
        status: 'failed',
        reason: 'unsupported-archive',
        provenance,
      });
    }

    // Check declared sizes
    const { compressedSize, uncompressedSize } = targetEntry;
    if (
      !Number.isSafeInteger(compressedSize) ||
      compressedSize < 0 ||
      compressedSize > DWD_MOSMIX_ARCHIVE_LIMITS.compressedBytes
    ) {
      return Object.freeze({
        status: 'failed',
        reason: compressedSize > DWD_MOSMIX_ARCHIVE_LIMITS.compressedBytes ? 'software-bound' : 'invalid-archive',
        provenance,
      });
    }

    if (
      !Number.isSafeInteger(uncompressedSize) ||
      uncompressedSize < 0 ||
      uncompressedSize > DWD_MOSMIX_ARCHIVE_LIMITS.uncompressedBytes
    ) {
      return Object.freeze({
        status: 'failed',
        reason: uncompressedSize > DWD_MOSMIX_ARCHIVE_LIMITS.uncompressedBytes ? 'software-bound' : 'invalid-archive',
        provenance,
      });
    }

    // Empty output file is invalid for DWD KML
    if (uncompressedSize === 0) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance,
      });
    }

    // Validate filename
    const filename = targetEntry.filename;
    if (!isValidDwdMosmixEntryFilename(filename, provenance.expectedStationId)) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance,
      });
    }

    // Stream extraction with size bounding
    let sinkFailureReason: DwdMosmixArchiveExtractionFailureReason | null = null;

    const customWritableStream = new WritableStream<Uint8Array>({
      write(chunk) {
        if (signal?.aborted || internalController.signal.aborted) {
          sinkFailureReason = 'aborted';
          throw new Error('Extraction aborted');
        }

        // Pass remaining output budget to snapshot helper before copying
        const remainingBudget = DWD_MOSMIX_ARCHIVE_LIMITS.uncompressedBytes - totalBytes;
        if (remainingBudget < 0) {
          sinkFailureReason = 'software-bound';
          throw new Error('Decompressed size exceeded software bounds');
        }

        const chunkSnapshot = snapshotDwdMosmixBytes(chunk, remainingBudget);
        if (chunkSnapshot === 'software-bound') {
          sinkFailureReason = 'software-bound';
          throw new Error('Decompressed size exceeded software bounds');
        }
        if (chunkSnapshot === 'invalid-byte-input') {
          sinkFailureReason = 'invalid-archive';
          throw new Error('Invalid chunk data encountered');
        }

        // Empty emitted chunks may be ignored
        if (chunkSnapshot.byteLength === 0) {
          return;
        }

        totalBytes += chunkSnapshot.byteLength;
        collectedChunks.push(chunkSnapshot);
      },
      abort() {
        collectedChunks.length = 0;
        totalBytes = 0;
      },
    });

    try {
      await (targetEntry as import('@zip.js/zip.js').FileEntry).getData(customWritableStream, {
        signal: internalController.signal,
        useWebWorkers: false,
        checkCrc32: true,
      });
    } catch {
      collectedChunks.length = 0;
      totalBytes = 0;
      if (signal?.aborted || sinkFailureReason === 'aborted') {
        return Object.freeze({
          status: 'failed',
          reason: 'aborted',
          provenance,
        });
      }
      if (sinkFailureReason) {
        return Object.freeze({
          status: 'failed',
          reason: sinkFailureReason,
          provenance,
        });
      }
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance,
      });
    }

    // Final abort check immediately after getData resolves before publishing Blob
    if (signal?.aborted || internalController.signal.aborted) {
      collectedChunks.length = 0;
      totalBytes = 0;
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }

    // Verify actual decompressed size equals declared uncompressed size
    if (totalBytes !== uncompressedSize) {
      collectedChunks.length = 0;
      totalBytes = 0;
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-archive',
        provenance,
      });
    }

    // Final check before publishing
    if (signal?.aborted || internalController.signal.aborted) {
      collectedChunks.length = 0;
      totalBytes = 0;
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }

    // Assemble immutable Blob
    const kmlBlob = new Blob(collectedChunks, { type: 'application/vnd.google-earth.kml+xml' });
    collectedChunks.length = 0;

    successPrepared = true;
    return Object.freeze({
      status: 'extracted',
      kml: kmlBlob,
      filename,
      provenance,
    });
  } catch {
    collectedChunks.length = 0;
    totalBytes = 0;
    if (signal?.aborted || internalController.signal.aborted) {
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-archive',
      provenance,
    });
  } finally {
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
    // Explicitly abort owned codec work during cleanup before closing
    if (!internalController.signal.aborted) {
      internalController.abort();
    }
    if (zipReader) {
      try {
        await zipReader.close();
      } catch {
        // Hygiene close only; do not leak or overwrite prior outcome
      }
    }
    // Asynchronous-close boundary: if caller aborted while awaiting close,
    // directly return failed/aborted to override only pending success.
    if (successPrepared && signal?.aborted) {
      return Object.freeze({
        status: 'failed',
        reason: 'aborted',
        provenance,
      });
    }
  }
}
