import { powerClimatologyPeriod } from '../../climate-temperature';

/** Separate from the SA climate authority: this adapter demonstrates public
 * reference access only. It never resolves a growing zone or crop calendar. */
export const NASA_REFERENCE_PROVIDER = {
  id: 'nasa-power-t2m-reference',
  name: 'NASA POWER monthly temperature reference',
  docsUrl: 'https://power.larc.nasa.gov/docs/services/api/temporal/climatology/',
  methodologyUrl: 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/',
  coverage: 'Global modelled meteorological reference; public coarse demonstration places only in this interface.',
  resolution: 'MERRA-2 native meteorology grid: 0.5° latitude × 0.625° longitude; not a farm measurement.',
  units: 'C for T2M, checked against the response parameter metadata.',
  updateCadence: 'Climatology refresh cadence unknown. Response period is retained; no current-weather freshness claim.',
  licence: 'Specific reuse licence not verified in the pages read; confirm terms before redistribution beyond this reference proof.',
  attribution: 'NASA POWER Project, NASA Langley Research Center; MERRA-2 meteorological reference.',
  authentication: 'Public demonstration request requires no account or API key; no authenticated capability is implied.',
  limits: 'One T2M parameter, one fixed coarse point, one request, maximum 12 seconds and 64 KiB; no automatic retry. These are app safeguards, not provider quotas.',
  limitations: 'Monthly climatological means cannot establish frost dates, local crop suitability, yield, soil conditions or plant legality.',
  accessedOn: '2026-11-01',
} as const;

export const COUNTRY_CLIMATE_DEMOS = {
  KE: { label: 'Nairobi public coarse demo', latitude: -1.3, longitude: 36.8 },
  GB: { label: 'London public coarse demo', latitude: 51.5, longitude: -0.1 },
  US: { label: 'Washington public coarse demo', latitude: 38.9, longitude: -77.0 },
  BR: { label: 'Brasília public coarse demo', latitude: -15.8, longitude: -47.9 },
} as const;
export type ClimateDemoCode = keyof typeof COUNTRY_CLIMATE_DEMOS;
const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const MAX_BYTES = 65_536;
export interface ClimateProvenance {
  providerId: typeof NASA_REFERENCE_PROVIDER.id;
  attribution: string;
  fetchedAt: string;
  endpoint: string | null;
  demoPlace: string | null;
  referenceOnly: true;
}
export type ClimateMonth = { month: number; state: 'value'; valueC: number } | { month: number; state: 'missing'; valueC: null };
export type ClimateFailure = 'unsupported-demo' | 'timeout' | 'network-error' | 'rate-limited' | 'http-error'
  | 'malformed-response' | 'wrong-units' | 'missing-measurement' | 'response-too-large';
export type ClimateReferenceResult = {
  status: 'available' | 'partial';
  monthly: ClimateMonth[];
  period: { start: string; end: string; description: string };
  dataset: { apiVersion: string | null; sources: string[]; timeStandard: string | null };
  units: 'C';
  provenance: ClimateProvenance;
} | { status: 'failed'; reason: ClimateFailure; httpStatus?: number; retryAfterSeconds?: number | null; provenance: ClimateProvenance };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function decodeNasaReference(value: unknown, provenance: ClimateProvenance, expectedPoint?: { latitude: number; longitude: number }): ClimateReferenceResult {
  const root = record(value); const header = record(root.header);
  const parameter = record(record(root.properties).parameter);
  const metadata = record(record(root.parameters).T2M);
  if (metadata.units !== 'C') return { status: 'failed', reason: 'wrong-units', provenance };
  // The live v2.10.1 response replaced separate start/end fields with range.
  // Retain that source label and accept the older explicit fields as well.
  const period = powerClimatologyPeriod(header);
  const coordinates = record(root.geometry).coordinates;
  const validPoint = root.type === 'Feature' && record(root.geometry).type === 'Point'
    && Array.isArray(coordinates) && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number'
    && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])
    && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90
    && (!expectedPoint || (Math.abs(coordinates[0] - expectedPoint.longitude) < 0.00001 && Math.abs(coordinates[1] - expectedPoint.latitude) < 0.00001));
  if (!period || !validPoint
    || typeof header.fill_value !== 'number' || !Number.isFinite(header.fill_value)) {
    return { status: 'failed', reason: 'malformed-response', provenance };
  }
  const values = record(parameter.T2M);
  const monthly: ClimateMonth[] = MONTH_KEYS.map((key, index) => {
    const measurement = values[key];
    if (measurement === undefined || measurement === null || measurement === header.fill_value) return { month: index + 1, state: 'missing', valueC: null };
    if (typeof measurement !== 'number' || !Number.isFinite(measurement)) return { month: index + 1, state: 'missing', valueC: null };
    return { month: index + 1, state: 'value', valueC: measurement };
  });
  // A numeric-looking string is a schema error, not evidence that a month was measured.
  if (MONTH_KEYS.some((key) => values[key] !== undefined && values[key] !== null
    && (typeof values[key] !== 'number' || !Number.isFinite(values[key])))) {
    return { status: 'failed', reason: 'malformed-response', provenance };
  }
  if (monthly.every((month) => month.state === 'missing')) return { status: 'failed', reason: 'missing-measurement', provenance };
  return { status: monthly.some((month) => month.state === 'missing') ? 'partial' : 'available',
    monthly, period, units: 'C',
    dataset: { apiVersion: typeof record(header.api).version === 'string' ? record(header.api).version as string : null,
      sources: Array.isArray(header.sources) ? header.sources.filter((source): source is string => typeof source === 'string' && source.length <= 120) : [],
      timeStandard: typeof header.time_standard === 'string' ? header.time_standard : null }, provenance };
}

/** Only fixed public demo coordinates enter the network. No user URL, private
 * farm coordinates, authentication, logs or silent SA fallback is accepted. */
export async function fetchCountryClimateReference(code: string, options: {
  fetcher?: typeof fetch; timeoutMs?: number; now?: () => Date;
} = {}): Promise<ClimateReferenceResult> {
  const demo = Object.hasOwn(COUNTRY_CLIMATE_DEMOS, code) ? COUNTRY_CLIMATE_DEMOS[code as ClimateDemoCode] : null;
  const provenance: ClimateProvenance = { providerId: NASA_REFERENCE_PROVIDER.id, attribution: NASA_REFERENCE_PROVIDER.attribution,
    fetchedAt: (options.now?.() ?? new Date()).toISOString(), endpoint: null, demoPlace: demo?.label ?? null, referenceOnly: true };
  if (!demo) return { status: 'failed', reason: 'unsupported-demo', provenance };
  const url = new URL('https://power.larc.nasa.gov/api/temporal/climatology/point');
  url.search = new URLSearchParams({ parameters: 'T2M', community: 'AG', longitude: String(demo.longitude), latitude: String(demo.latitude), format: 'JSON' }).toString();
  provenance.endpoint = url.toString();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, Math.min(12_000, options.timeoutMs!)) : 12_000;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ClimateReferenceResult>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve({ status: 'failed', reason: 'timeout', provenance }); }, timeoutMs);
  });
  const request = async (): Promise<ClimateReferenceResult> => {
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(url.toString(), { signal: controller.signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/json' } });
    } catch { return { status: 'failed', reason: controller.signal.aborted ? 'timeout' : 'network-error', provenance }; }
    if (response.status === 429) {
      const retry = response.headers.get('retry-after');
      return { status: 'failed', reason: 'rate-limited', httpStatus: 429,
        retryAfterSeconds: retry && /^\d+$/.test(retry) && Number.isSafeInteger(Number(retry)) ? Number(retry) : null, provenance };
    }
    if (!response.ok) return { status: 'failed', reason: 'http-error', httpStatus: response.status, provenance };
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) return { status: 'failed', reason: 'malformed-response', provenance };
    const length = response.headers.get('content-length');
    if (length && Number(length) > MAX_BYTES) { controller.abort(); return { status: 'failed', reason: 'response-too-large', provenance }; }
    if (!response.body) return { status: 'failed', reason: 'malformed-response', provenance };
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > MAX_BYTES) { controller.abort(); await reader.cancel().catch(() => {}); return { status: 'failed', reason: 'response-too-large', provenance }; }
        chunks.push(next.value);
      }
      const buffer = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
      return decodeNasaReference(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)), provenance, demo);
    } catch { return { status: 'failed', reason: controller.signal.aborted ? 'timeout' : 'malformed-response', provenance }; }
    finally { reader.releaseLock(); }
  };
  try { return await Promise.race([request(), timeout]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
