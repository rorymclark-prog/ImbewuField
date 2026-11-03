/** Station observations are a separate authority from the planner's monthly
 * climate. This public reference never selects a farm's station or crop advice. */
export const NWS_OBSERVATION_PROVIDER = Object.freeze({
  id: 'nws-station-observation',
  name: 'US National Weather Service station observation',
  docsUrl: 'https://www.weather.gov/documentation/services-web-api',
  schemaUrl: 'https://api.weather.gov/openapi.json',
  attribution: 'NOAA National Weather Service; station provider retained separately.',
  licence: 'The NWS API documentation states that API information is open data, free to use for any purpose.',
  authentication: 'An identifying application User-Agent is required; no API key is currently required.',
  userAgent: 'ImbewuField/1.0 (https://imbewufield.vercel.app)',
  coverage: 'One explicitly selected public Sonoma County airport station reference, not a farm measurement or worldwide observation service.',
  cadence: 'No fixed observation cadence established. Observations can be delayed; observed and retrieved times remain separate.',
  limitations: 'The API retains seven days of observations. This adapter fetches only the latest published observation; it supplies no forecast, planting date, frost assurance or irrigation recommendation.',
  accessedOn: '2026-11-03',
} as const);

export const SONOMA_NWS_REFERENCE = Object.freeze({
  key: 'sonoma-ksts',
  countryCode: 'US',
  stationId: 'KSTS',
  label: 'Santa Rosa Sonoma County Airport public station reference',
  metadataUrl: 'https://api.weather.gov/stations/KSTS',
  observationUrl: 'https://api.weather.gov/stations/KSTS/observations/latest?require_qc=true',
} as const);

/** These are transport safeguards, not provider quotas or agronomic limits. */
export const NWS_OBSERVATION_LIMITS = Object.freeze({ timeoutMs: 12_000, maxBodyBytes: 65_536, maxRequests: 2 } as const);

export type NwsPublicPoint = { type: 'Point'; coordinates: [number, number] | [number, number, number] };
type MeasurementMetadata = { unitCode: string | null; qualityControl: string | null };
const INVALID_MEASUREMENT_REASONS = ['invalid-shape', 'invalid-value', 'invalid-unit', 'invalid-quality-control'] as const;
export type NwsMeasurement = MeasurementMetadata & (
  | { state: 'value'; value: number }
  | { state: 'missing'; value: null }
  | { state: 'unsupported-unit'; value: null }
  | { state: 'invalid'; value: null; reason: typeof INVALID_MEASUREMENT_REASONS[number] }
);
const MEASUREMENT_UNITS = {
  temperature: 'wmoUnit:degC', dewpoint: 'wmoUnit:degC', relativeHumidity: 'wmoUnit:percent',
  windSpeed: 'wmoUnit:km_h-1', windGust: 'wmoUnit:km_h-1', windDirection: 'wmoUnit:degree_(angle)',
  precipitationLastHour: 'wmoUnit:mm', precipitationLast3Hours: 'wmoUnit:mm', precipitationLast6Hours: 'wmoUnit:mm',
  minTemperatureLast24Hours: 'wmoUnit:degC', maxTemperatureLast24Hours: 'wmoUnit:degC',
} as const;
export type NwsMeasurements = { [Key in keyof typeof MEASUREMENT_UNITS]: NwsMeasurement };
const FAILURE_REASONS = ['unsupported-reference', 'timeout', 'network-error', 'rate-limited', 'http-error',
  'redirect-not-allowed', 'response-too-large', 'malformed-response', 'station-mismatch', 'invalid-timestamp'] as const;
export type NwsFailureReason = typeof FAILURE_REASONS[number];
export interface NwsObservationProvenance {
  providerId: typeof NWS_OBSERVATION_PROVIDER.id;
  referenceKey: typeof SONOMA_NWS_REFERENCE.key | null;
  metadataEndpoint: string | null;
  observationEndpoint: string | null;
  fetchedAt: string | null;
  attribution: string;
  referenceOnly: true;
}
export type NwsObservationResult = {
  status: 'available' | 'partial';
  stationId: typeof SONOMA_NWS_REFERENCE.stationId;
  stationName: string;
  stationProvider: string | null;
  stationSubProvider: string | null;
  timeZone: string;
  stationPoint: NwsPublicPoint;
  observationPoint: NwsPublicPoint;
  observationId: string;
  observedAt: string;
  timing: 'at-or-before-retrieval' | 'after-retrieval';
  freshness: 'not-assessed';
  measurements: NwsMeasurements;
  provenance: NwsObservationProvenance;
} | { status: 'failed'; reason: NwsFailureReason; httpStatus?: number; retryAfterSeconds?: number | null; provenance: NwsObservationProvenance };

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;

/** Date.parse normalises impossible dates such as 30 February. A source time
 * must instead identify an actual instant with an explicit offset. */
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59
    || (m[7] !== 'Z' && (Number(m[8]) > 23 || Number(m[9]) > 59))) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function point(value: unknown): NwsPublicPoint | null {
  const p = record(value); const coordinates = p?.coordinates;
  if (p?.type !== 'Point' || !Array.isArray(coordinates) || (coordinates.length !== 2 && coordinates.length !== 3)
    || coordinates.some(v => typeof v !== 'number' || !Number.isFinite(v))
    || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return null;
  return { type: 'Point', coordinates: [...coordinates] as NwsPublicPoint['coordinates'] };
}

function measurement(value: unknown, expectedUnit: string): NwsMeasurement {
  if (value === null || value === undefined) return { state: 'missing', value: null, unitCode: null, qualityControl: null };
  const v = record(value);
  const unitCode = typeof v?.unitCode === 'string' ? v.unitCode : null;
  const qualityControl = typeof v?.qualityControl === 'string' ? v.qualityControl : null;
  const metadata = { unitCode, qualityControl };
  if (!v) return { ...metadata, state: 'invalid', value: null, reason: 'invalid-shape' };
  if (v.qualityControl !== undefined && (typeof v.qualityControl !== 'string' || !/^[ZCSVXQGBT]$/.test(v.qualityControl))) {
    return { ...metadata, state: 'invalid', value: null, reason: 'invalid-quality-control' };
  }
  if (v.value !== null && v.value !== undefined && (typeof v.value !== 'number' || !Number.isFinite(v.value))) {
    return { ...metadata, state: 'invalid', value: null, reason: 'invalid-value' };
  }
  // No measurement remains unknown even when the provider supplies unit metadata.
  if (v.value === null || v.value === undefined) return { ...metadata, state: 'missing', value: null };
  if (!text(v.unitCode)) return { ...metadata, state: 'invalid', value: null, reason: 'invalid-unit' };
  if (v.unitCode !== expectedUnit) return { ...metadata, state: 'unsupported-unit', value: null };
  return { ...metadata, state: 'value', value: v.value as number };
}

function provenance(fetchedAt: string | null, supported = true): NwsObservationProvenance {
  return { providerId: NWS_OBSERVATION_PROVIDER.id, referenceKey: supported ? SONOMA_NWS_REFERENCE.key : null,
    metadataEndpoint: supported ? SONOMA_NWS_REFERENCE.metadataUrl : null,
    observationEndpoint: supported ? SONOMA_NWS_REFERENCE.observationUrl : null,
    fetchedAt, attribution: NWS_OBSERVATION_PROVIDER.attribution, referenceOnly: true };
}

function stationMetadata(value: unknown): { ok: true; properties: Record<string, unknown>; point: NwsPublicPoint; name: string; timeZone: string }
  | { ok: false; reason: 'malformed-response' | 'station-mismatch' } {
  const root = record(value); const properties = record(root?.properties); const stationPoint = point(root?.geometry);
  if (root?.type !== 'Feature' || !properties || !stationPoint || !text(properties.name) || !text(properties.timeZone)) {
    return { ok: false, reason: 'malformed-response' };
  }
  if (root.id !== SONOMA_NWS_REFERENCE.metadataUrl || properties.stationIdentifier !== SONOMA_NWS_REFERENCE.stationId
    || (properties['@id'] !== undefined && properties['@id'] !== root.id)) return { ok: false, reason: 'station-mismatch' };
  return { ok: true, properties, point: stationPoint, name: properties.name, timeZone: properties.timeZone };
}

/** No fetch or ambient clock: the two payloads and retrieval instant are explicit.
 * Missing optional stationId is accepted only when the station URI binds KSTS. */
export function decodeNwsObservation(stationPayload: unknown, observationPayload: unknown, fetchedAt: string): NwsObservationResult {
  const p = provenance(instant(fetchedAt) === null ? null : fetchedAt);
  const failed = (reason: NwsFailureReason): NwsObservationResult => ({ status: 'failed', reason, provenance: p });
  const station = stationMetadata(stationPayload);
  if (!station.ok) return failed(station.reason);
  const s = station.properties; const observation = record(observationPayload); const o = record(observation?.properties);
  const observationPoint = point(observation?.geometry);
  if (observation?.type !== 'Feature' || !o || !observationPoint) return failed('malformed-response');
  if (o.station !== SONOMA_NWS_REFERENCE.metadataUrl
    || (o.stationId !== undefined && o.stationId !== SONOMA_NWS_REFERENCE.stationId)) return failed('station-mismatch');
  const observedTime = instant(o.timestamp); const fetchedTime = instant(fetchedAt);
  if (observedTime === null || fetchedTime === null) return failed('invalid-timestamp');
  const observationId = `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/${o.timestamp}`;
  if (observation.id !== observationId || (o['@id'] !== undefined && o['@id'] !== observationId)) return failed('station-mismatch');
  // The station and its observation actually publish different points. Never
  // force coordinate equality or rewrite one using the other.
  const measurements = Object.fromEntries(Object.entries(MEASUREMENT_UNITS)
    .map(([key, unit]) => [key, measurement(o[key], unit)])) as NwsMeasurements;
  return { status: Object.values(measurements).every(m => m.state === 'value') ? 'available' : 'partial',
    stationId: SONOMA_NWS_REFERENCE.stationId, stationName: station.name,
    stationProvider: text(s.provider) ? s.provider : null, stationSubProvider: text(s.subProvider) ? s.subProvider : null,
    timeZone: station.timeZone, stationPoint: station.point, observationPoint, observationId, observedAt: o.timestamp as string,
    timing: observedTime > fetchedTime ? 'after-retrieval' : 'at-or-before-retrieval', freshness: 'not-assessed', measurements, provenance: p };
}

/** The normalized API response crosses another unknown JSON boundary. Reuse the
 * source unit/time/point authorities here so a leaf cannot accept a temperature
 * merely because its unit happens to be a known wind-speed unit. */
export function parseNwsObservationResult(value: unknown): NwsObservationResult | null {
  const root = record(value); const p = record(root?.provenance);
  if (!root || !p || p.providerId !== NWS_OBSERVATION_PROVIDER.id || p.referenceOnly !== true
    || p.attribution !== NWS_OBSERVATION_PROVIDER.attribution
    || (p.fetchedAt !== null && instant(p.fetchedAt) === null)) return null;
  const unsupported = root.status === 'failed' && root.reason === 'unsupported-reference';
  if (p.referenceKey !== (unsupported ? null : SONOMA_NWS_REFERENCE.key)
    || p.metadataEndpoint !== (unsupported ? null : SONOMA_NWS_REFERENCE.metadataUrl)
    || p.observationEndpoint !== (unsupported ? null : SONOMA_NWS_REFERENCE.observationUrl)) return null;
  const parsedProvenance = provenance(p.fetchedAt as string | null, !unsupported);
  if (root.status === 'failed') {
    if (!FAILURE_REASONS.some(reason => reason === root.reason)) return null;
    if (root.reason === 'rate-limited' && root.httpStatus !== 429) return null;
    if (root.reason === 'http-error' && (typeof root.httpStatus !== 'number' || !Number.isInteger(root.httpStatus)
      || root.httpStatus < 400 || root.httpStatus > 599 || root.httpStatus === 429)) return null;
    if (!['rate-limited', 'http-error'].includes(root.reason as string) && root.httpStatus !== undefined) return null;
    if (root.retryAfterSeconds !== undefined && (root.reason !== 'rate-limited' || (root.retryAfterSeconds !== null
      && (typeof root.retryAfterSeconds !== 'number' || !Number.isSafeInteger(root.retryAfterSeconds) || root.retryAfterSeconds < 0)))) return null;
    return { status: 'failed', reason: root.reason as NwsFailureReason, provenance: parsedProvenance,
      ...(root.httpStatus === undefined ? {} : { httpStatus: root.httpStatus as number }),
      ...(root.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: root.retryAfterSeconds as number | null }) };
  }
  if ((root.status !== 'available' && root.status !== 'partial') || root.stationId !== SONOMA_NWS_REFERENCE.stationId
    || !text(root.stationName) || !text(root.timeZone) || root.freshness !== 'not-assessed'
    || (root.stationProvider !== null && !text(root.stationProvider))
    || (root.stationSubProvider !== null && !text(root.stationSubProvider))) return null;
  const stationPoint = point(root.stationPoint); const observationPoint = point(root.observationPoint);
  const observedTime = instant(root.observedAt); const fetchedTime = instant(p.fetchedAt);
  if (!stationPoint || !observationPoint || observedTime === null || fetchedTime === null
    || root.observationId !== `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/${root.observedAt}`
    || root.timing !== (observedTime > fetchedTime ? 'after-retrieval' : 'at-or-before-retrieval')) return null;
  const values = record(root.measurements);
  if (!values) return null;
  const pairs: [string, NwsMeasurement][] = [];
  for (const [key, unit] of Object.entries(MEASUREMENT_UNITS)) {
    const m = record(values[key]);
    if (!m || (m.unitCode !== null && typeof m.unitCode !== 'string')
      || (m.qualityControl !== null && typeof m.qualityControl !== 'string')) return null;
    const metadata = { unitCode: m.unitCode as string | null, qualityControl: m.qualityControl as string | null };
    // null is the normalized representation of an absent optional source QC
    // field. Passing literal null to the raw decoder would wrongly reject it.
    const raw = { value: m.value, unitCode: m.unitCode, ...(m.qualityControl === null ? {} : { qualityControl: m.qualityControl }) };
    if (m.state === 'value') {
      if (m.reason !== undefined) return null;
      const checked = measurement(raw, unit);
      if (checked.state !== 'value') return null;
      pairs.push([key, checked]);
    } else {
      if (m.value !== null) return null;
      if (m.state === 'invalid') {
        const reason = INVALID_MEASUREMENT_REASONS.find(reason => reason === m.reason);
        if (!reason) return null;
        pairs.push([key, { ...metadata, state: 'invalid', value: null, reason }]);
      } else {
        if (m.reason !== undefined || measurement(raw, unit).state !== 'missing') return null;
        if (m.state === 'missing') pairs.push([key, { ...metadata, state: 'missing', value: null }]);
        else if (m.state === 'unsupported-unit' && text(m.unitCode) && m.unitCode !== unit) {
          pairs.push([key, { ...metadata, state: 'unsupported-unit', value: null }]);
        } else return null;
      }
    }
  }
  const measurements = Object.fromEntries(pairs) as NwsMeasurements;
  if ((Object.values(measurements).every(m => m.state === 'value') ? 'available' : 'partial') !== root.status) return null;
  return { status: root.status, stationId: SONOMA_NWS_REFERENCE.stationId, stationName: root.stationName,
    stationProvider: root.stationProvider as string | null, stationSubProvider: root.stationSubProvider as string | null, timeZone: root.timeZone,
    stationPoint, observationPoint, observationId: root.observationId as string, observedAt: root.observedAt as string,
    timing: root.timing as 'at-or-before-retrieval' | 'after-retrieval', freshness: 'not-assessed', measurements, provenance: parsedProvenance };
}

type FetchFailure = { ok: false; reason: NwsFailureReason; httpStatus?: number; retryAfterSeconds?: number | null };
type FetchPayload = { ok: true; payload: unknown } | FetchFailure;

/** Server caller supplies fetch so no browser silently starts third-party I/O.
 * One whole-operation deadline also covers body reads and both sequential calls. */
export async function fetchNwsStationReference(referenceKey: string, options: {
  fetcher: typeof fetch; timeoutMs?: number; now?: () => Date;
}): Promise<NwsObservationResult> {
  const supported = referenceKey === SONOMA_NWS_REFERENCE.key;
  const clock = (): string | null => {
    try { const value = (options.now?.() ?? new Date()).toISOString(); return instant(value) === null ? null : value; }
    catch { return null; }
  };
  const failed = ({ reason, httpStatus, retryAfterSeconds }: Omit<FetchFailure, 'ok'>): NwsObservationResult => ({
    status: 'failed', reason, ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }), provenance: provenance(clock(), supported),
  });
  if (!supported) return failed({ reason: 'unsupported-reference' });
  if (clock() === null) return failed({ reason: 'invalid-timestamp' });
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.min(NWS_OBSERVATION_LIMITS.timeoutMs, options.timeoutMs!)) : NWS_OBSERVATION_LIMITS.timeoutMs;
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<NwsObservationResult>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      // Cancellation itself may stall in an injected stream; it cannot extend
      // the response deadline or replace the original timeout diagnosis.
      void reader?.cancel().catch(() => {});
      resolve(failed({ reason: 'timeout' }));
    }, timeoutMs);
  });
  const fetchJson = async (url: string): Promise<FetchPayload> => {
    if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
    let response: Response;
    try {
      response = await options.fetcher(url, { signal: controller.signal, redirect: 'error', credentials: 'omit',
        headers: { Accept: 'application/geo+json', 'User-Agent': NWS_OBSERVATION_PROVIDER.userAgent } });
    } catch { return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network-error' }; }
    const reject = (failure: FetchFailure): FetchFailure => {
      void response.body?.cancel().catch(() => {});
      return failure;
    };
    if (controller.signal.aborted) return reject({ ok: false, reason: 'timeout' });
    if (response.redirected || (response.url && response.url !== url) || (response.status >= 300 && response.status < 400)) {
      return reject({ ok: false, reason: 'redirect-not-allowed' });
    }
    if (response.status === 429) {
      const retry = response.headers.get('retry-after');
      return reject({ ok: false, reason: 'rate-limited', httpStatus: 429,
        retryAfterSeconds: retry && /^\d+$/.test(retry) && Number.isSafeInteger(Number(retry)) ? Number(retry) : null });
    }
    if (!response.ok) return reject({ ok: false, reason: 'http-error', httpStatus: response.status });
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/geo+json' && contentType !== 'application/json') return reject({ ok: false, reason: 'malformed-response' });
    const length = response.headers.get('content-length');
    if (length && Number(length) > NWS_OBSERVATION_LIMITS.maxBodyBytes) return reject({ ok: false, reason: 'response-too-large' });
    if (!response.body) return { ok: false, reason: 'malformed-response' };
    const bodyReader = response.body.getReader(); reader = bodyReader;
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const next = await bodyReader.read();
        if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > NWS_OBSERVATION_LIMITS.maxBodyBytes) {
          void bodyReader.cancel().catch(() => {});
          return { ok: false, reason: 'response-too-large' };
        }
        chunks.push(next.value);
      }
      const buffer = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      return { ok: true, payload: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) };
    } catch { return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'malformed-response' }; }
    finally { reader = undefined; bodyReader.releaseLock(); }
  };
  const run = async (): Promise<NwsObservationResult> => {
    const station = await fetchJson(SONOMA_NWS_REFERENCE.metadataUrl);
    if (!station.ok) return failed(station);
    // Invalid metadata must not cause an unnecessary second provider request.
    const metadata = stationMetadata(station.payload);
    if (!metadata.ok) return failed(metadata);
    const observation = await fetchJson(SONOMA_NWS_REFERENCE.observationUrl);
    if (!observation.ok) return failed(observation);
    const fetchedAt = clock();
    return fetchedAt === null ? failed({ reason: 'invalid-timestamp' }) : decodeNwsObservation(station.payload, observation.payload, fetchedAt);
  };
  try { return await Promise.race([run(), timeout]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
