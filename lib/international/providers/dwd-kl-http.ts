import { Uint8ArrayReader, ZipReader, type FileEntry } from '@zip.js/zip.js/index-native.js';
import {
  DWD_KL_MAX_MEMBER_BYTES, DWD_KL_METADATA_PREFIXES, dwdKlArchiveName, dwdKlArchiveUrl,
  dwdKlProductMatch, dwdKlSelectionProblem, findDwdKlStation, parseDwdKlRecentObservations,
  type DwdKlMetadata, type DwdKlObservations, type DwdKlRecentProduct, type DwdKlSelection, type DwdKlStation,
} from './dwd-kl-observations.ts';

export type DwdKlLoad = DwdKlObservations | {
  readonly status: 'held';
  readonly reason: 'unavailable' | 'rate-limited' | 'invalid-archive';
};

const MAX_ZIP_BYTES = 256 * 1024;
const MAX_ENTRIES = 64;
const DEADLINE_MS = 12_000;
const MEMBER_NAME = /^[A-Za-z0-9_]+\.[a-z]+$/;

async function readBoundedZip(stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = stream.getReader();
  const bytes = new Uint8Array(MAX_ZIP_BYTES);
  let length = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      signal.throwIfAborted();
      if (length + chunk.value.byteLength > MAX_ZIP_BYTES) return null;
      bytes.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
    return bytes.subarray(0, length);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function readMember(entry: FileEntry, signal: AbortSignal): Promise<string> {
  const decoder = new TextDecoder('windows-1252');
  let bytes = 0;
  let text = '';
  await entry.getData(new WritableStream<Uint8Array>({
    write(chunk) {
      signal.throwIfAborted();
      bytes += chunk.byteLength;
      if (bytes > entry.uncompressedSize) throw new Error('DWD member exceeded its declared size');
      text += decoder.decode(chunk, { stream: true });
    },
  }), { signal, useWebWorkers: false, checkCrc32: true });
  if (bytes !== entry.uncompressedSize) throw new Error('Incomplete DWD member');
  return text + decoder.decode();
}

export async function extractDwdKlRecentProduct(
  bytes: Uint8Array, retrievedAt: string, signal: AbortSignal, stationId: DwdKlStation['id'],
): Promise<DwdKlRecentProduct | null> {
  if (bytes.byteLength < 4 || bytes.byteLength > MAX_ZIP_BYTES || bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4 || signal.aborted) return null;
  const archive = new ZipReader(new Uint8ArrayReader(bytes), {
    strictness: 'strict', checkCrc32: true, checkOverlappingEntry: true, checkLocalDirectory: true,
    checkLocalFilename: true, filenameValidation: 'strict', useWebWorkers: false,
  });
  try {
    const entries = new Map<string, FileEntry>();
    let product: FileEntry | null = null;
    for await (const entry of archive.getEntriesGenerator()) {
      signal.throwIfAborted();
      if (entries.size >= MAX_ENTRIES || entry.directory || entry.encrypted || entry.symlink || entry.zip64 ||
        !MEMBER_NAME.test(entry.filename) || entries.has(entry.filename) ||
        !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 ||
        entry.uncompressedSize > DWD_KL_MAX_MEMBER_BYTES || ![0, 8].includes(entry.compressionMethod)) return null;
      entries.set(entry.filename, entry);
      if (entry.filename.startsWith('produkt_')) {
        if (product || !dwdKlProductMatch(entry.filename, stationId)) return null;
        product = entry;
      }
    }
    if (!product) return null;
    const metadata: Partial<Record<keyof DwdKlMetadata, string>> = {};
    for (const key of Object.keys(DWD_KL_METADATA_PREFIXES) as (keyof DwdKlMetadata)[]) {
      const entry = entries.get(`${DWD_KL_METADATA_PREFIXES[key]}_${stationId}.txt`);
      if (!entry) return null;
      metadata[key] = await readMember(entry, signal);
    }
    const observations = await readMember(product, signal);
    signal.throwIfAborted();
    return { archiveName: dwdKlArchiveName(stationId), memberName: product.filename, observations,
      metadata: metadata as DwdKlMetadata, retrievedAt };
  } catch {
    return null;
  } finally {
    await archive.close();
  }
}

export async function loadDwdKlRecentObservations(
  selection: DwdKlSelection, caller: AbortSignal, now = new Date(),
): Promise<DwdKlLoad> {
  const problem = dwdKlSelectionProblem(selection, now);
  if (problem) return { status: 'held', reason: problem };
  const station = findDwdKlStation(selection.stationId)!;
  const url = dwdKlArchiveUrl(station.id);
  const signal = AbortSignal.any([caller, AbortSignal.timeout(DEADLINE_MS)]);
  try {
    signal.throwIfAborted();
    const response = await fetch(url, {
      signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      headers: { Accept: 'application/zip' },
    });
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (response.status === 429 || !response.ok || response.redirected || response.url !== url ||
      !response.body || mime !== 'application/zip' || Number(response.headers.get('content-length')) > MAX_ZIP_BYTES) {
      void response.body?.cancel().catch(() => {});
      return { status: 'held', reason: response.status === 429 ? 'rate-limited' : !response.ok ? 'unavailable' : 'invalid-archive' };
    }
    const bytes = await readBoundedZip(response.body, signal);
    const product = bytes && await extractDwdKlRecentProduct(bytes, now.toISOString(), signal, station.id);
    if (signal.aborted) return { status: 'held', reason: 'unavailable' };
    return product ? parseDwdKlRecentObservations(product, selection) : { status: 'held', reason: 'invalid-archive' };
  } catch {
    return { status: 'held', reason: 'unavailable' };
  }
}
