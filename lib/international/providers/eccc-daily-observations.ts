import { addGrowerUtcDays, isGrowerRecordedAt, isGrowerUtcDate } from '../grower-planning.ts';

const ITEMS = 'https://api.weather.gc.ca/collections/climate-daily/items';
const MAX_WINDOW_DAYS = 366;
const MAX_RETURNED_FEATURES = MAX_WINDOW_DAYS + 1;
const MILLISECONDS_PER_DAY = 86_400_000;

export const ECCC_DAILY_RESPONSE_LIMIT = 1_048_576;
export const ECCC_DAILY_ATTRIBUTION = 'Data Source: Environment and Climate Change Canada';
export const ECCC_DAILY_LICENCE = 'https://eccc-msc.github.io/open-data/licence/readme_en/';
export const ECCC_DAILY_SCHEMA = 'https://api.weather.gc.ca/collections/climate-daily/schema?f=html';

export interface EcccDailySelection {
  readonly stationClimateId: string;
  readonly firstLocalDay: string;
  readonly lastLocalDay: string;
}

export interface EcccDailySource {
  readonly url: string;
  readonly retrievedAt: string;
  readonly temperatureUnit: 'celsius';
}

export type EcccTemperatureCell =
  | { readonly kind: 'observed'; readonly celsius: number }
  | { readonly kind: 'estimated'; readonly celsius: number; readonly flag: 'E' }
  | { readonly kind: 'missing'; readonly flag: 'M' | null }
  | { readonly kind: 'withheld-flag'; readonly flag: string };

interface StationSegment {
  readonly id: number;
  readonly name: string;
  readonly province: string;
}

interface ReturnedDay {
  readonly kind: 'returned';
  readonly localDay: string;
  readonly minimum: EcccTemperatureCell;
  readonly mean: EcccTemperatureCell;
  readonly maximum: EcccTemperatureCell;
}

export type EcccObservationDay = ReturnedDay | { readonly kind: 'no-record'; readonly localDay: string };

type HoldReason = 'invalid-selection' | 'source-mismatch' | 'invalid-response' | 'incomplete-response'
  | 'wrong-station' | 'invalid-day' | 'segment-conflict' | 'duplicate-conflict';

export type EcccDailyObservations =
  | { readonly status: 'held'; readonly reason: HoldReason }
  | {
    readonly status: 'available';
    readonly selection: EcccDailySelection;
    readonly source: EcccDailySource;
    readonly station: StationSegment | null;
    readonly requestedDays: number;
    readonly returnedDays: number;
    readonly fullyObservedDays: number;
    readonly days: readonly EcccObservationDay[];
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function admittedSelection(value: unknown): EcccDailySelection & { readonly requestedDays: number } | null {
  if (!isRecord(value)) return null;
  const { stationClimateId, firstLocalDay, lastLocalDay } = value;
  if (typeof stationClimateId !== 'string' || stationClimateId.length !== 7 || !/^[A-Z0-9]{7}$/.test(stationClimateId)
    || !isGrowerUtcDate(firstLocalDay) || !isGrowerUtcDate(lastLocalDay)) return null;
  // UTC midnights are used only to count Gregorian calendar days. Provider observations
  // retain their local dates and are never converted to UTC observations.
  const days = (Date.parse(lastLocalDay) - Date.parse(firstLocalDay)) / MILLISECONDS_PER_DAY + 1;
  if (days < 1 || days > MAX_WINDOW_DAYS) return null;
  return { stationClimateId, firstLocalDay, lastLocalDay, requestedDays: days };
}

function windowQuery(firstLocalDay: string, lastLocalDay: string): string {
  return `${firstLocalDay}T00:00:00Z/${lastLocalDay}T23:59:59Z`;
}

export function ecccDailyObservationUrl(selection: unknown): string | null {
  const validated = admittedSelection(selection);
  if (!validated) return null;
  const query = new URLSearchParams({
    f: 'json',
    CLIMATE_IDENTIFIER: validated.stationClimateId,
    datetime: windowQuery(validated.firstLocalDay, validated.lastLocalDay),
    limit: String(validated.requestedDays + 1),
  });
  return `${ITEMS}?${query}`;
}

function boundSourceUrl(value: unknown, selection: EcccDailySelection, requestedDays: number): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const params = url.searchParams;
    const limitText = params.get('limit');
    const limit = Number(limitText);
    if (`${url.origin}${url.pathname}` !== ITEMS || url.username || url.password || url.hash
      || params.size !== 4 || params.get('f') !== 'json'
      || params.get('CLIMATE_IDENTIFIER') !== selection.stationClimateId
      || params.get('datetime') !== windowQuery(selection.firstLocalDay, selection.lastLocalDay)
      || String(limit) !== limitText || !Number.isInteger(limit) || limit < requestedDays || limit > MAX_RETURNED_FEATURES) return null;
    params.sort();
    return url;
  } catch {
    return null;
  }
}

function localDayOf(row: Record<string, unknown>): string | null {
  const raw = row.LOCAL_DATE;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T ]00:00:00)?$/.test(raw)) return null;
  const localDay = raw.slice(0, 10);
  if (!isGrowerUtcDate(localDay) || raw.trim() !== raw) return null;
  const [year, month, day] = localDay.split('-').map(Number);
  return row.LOCAL_YEAR === year && row.LOCAL_MONTH === month && row.LOCAL_DAY === day ? localDay : null;
}

function temperatureCell(value: unknown, flag: unknown): EcccTemperatureCell | null {
  if ((value !== null && (typeof value !== 'number' || !Number.isFinite(value)))
    || (flag !== null && (typeof flag !== 'string' || !/^[A-Z]?$/.test(flag) || flag.trim() !== flag))) return null;
  if (flag === 'M') return { kind: 'missing', flag };
  if (flag === 'E' && typeof value === 'number') return { kind: 'estimated', celsius: value, flag };
  if (flag) return { kind: 'withheld-flag', flag };
  return value === null ? { kind: 'missing', flag: null } : { kind: 'observed', celsius: value };
}

function observedInOrder(minimum: EcccTemperatureCell, mean: EcccTemperatureCell, maximum: EcccTemperatureCell): boolean {
  const observed = [minimum, mean, maximum].flatMap(cell => cell.kind === 'observed' ? [cell.celsius] : []);
  return observed.every((value, index) => index === 0 || observed[index - 1] <= value);
}

export function parseEcccDailyObservations(
  body: string, selection: unknown, source: unknown,
): EcccDailyObservations {
  const validated = admittedSelection(selection);
  if (!validated) return { status: 'held', reason: 'invalid-selection' };
  const { requestedDays, ...chosen } = validated;
  if (!isRecord(source) || typeof source.url !== 'string' || source.temperatureUnit !== 'celsius'
    || !isGrowerRecordedAt(source.retrievedAt) || chosen.lastLocalDay > source.retrievedAt.slice(0, 10))
    return { status: 'held', reason: 'source-mismatch' };
  const boundUrl = boundSourceUrl(source.url, chosen, requestedDays);
  if (!boundUrl) return { status: 'held', reason: 'source-mismatch' };

  let raw: unknown;
  try {
    if (body.length <= ECCC_DAILY_RESPONSE_LIMIT) raw = JSON.parse(body);
  } catch {
    return { status: 'held', reason: 'invalid-response' };
  }
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features) || !Array.isArray(raw.links))
    return { status: 'held', reason: 'invalid-response' };
  const selfLinks = raw.links.filter(link => isRecord(link) && link.rel === 'self');
  if (selfLinks.length !== 1 || boundSourceUrl(selfLinks[0].href, chosen, requestedDays)?.href !== boundUrl.href)
    return { status: 'held', reason: 'source-mismatch' };
  if (raw.features.length > Number(boundUrl.searchParams.get('limit')) || raw.numberMatched !== raw.features.length
    || raw.numberReturned !== raw.features.length || raw.links.some(link => isRecord(link) && link.rel === 'next'))
    return { status: 'held', reason: 'incomplete-response' };

  const byDay = new Map<string, { readonly row: ReturnedDay; readonly wire: string }>();
  let station: StationSegment | null = null;
  for (const feature of raw.features) {
    if (!isRecord(feature) || feature.type !== 'Feature' || !isRecord(feature.properties))
      return { status: 'held', reason: 'invalid-response' };
    const row = feature.properties;
    if (row.CLIMATE_IDENTIFIER !== chosen.stationClimateId) return { status: 'held', reason: 'wrong-station' };
    const id = row.STN_ID;
    const name = row.STATION_NAME;
    const province = row.PROVINCE_CODE;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || typeof name !== 'string' || !name.trim()
      || typeof province !== 'string' || !/^[A-Z]{2}$/.test(province) || province.length !== 2)
      return { status: 'held', reason: 'invalid-response' };
    if (station && (station.id !== id || station.name !== name || station.province !== province))
      return { status: 'held', reason: 'segment-conflict' };
    station ??= { id, name, province };

    const localDay = localDayOf(row);
    const minimum = temperatureCell(row.MIN_TEMPERATURE, row.MIN_TEMPERATURE_FLAG);
    const mean = temperatureCell(row.MEAN_TEMPERATURE, row.MEAN_TEMPERATURE_FLAG);
    const maximum = temperatureCell(row.MAX_TEMPERATURE, row.MAX_TEMPERATURE_FLAG);
    if (!localDay || localDay < chosen.firstLocalDay || localDay > chosen.lastLocalDay || !minimum || !mean || !maximum
      || !observedInOrder(minimum, mean, maximum)) return { status: 'held', reason: 'invalid-day' };

    const wire = JSON.stringify([row.MIN_TEMPERATURE, row.MIN_TEMPERATURE_FLAG, row.MEAN_TEMPERATURE,
      row.MEAN_TEMPERATURE_FLAG, row.MAX_TEMPERATURE, row.MAX_TEMPERATURE_FLAG]);
    const duplicate = byDay.get(localDay);
    if (duplicate && duplicate.wire !== wire) return { status: 'held', reason: 'duplicate-conflict' };
    byDay.set(localDay, { row: { kind: 'returned', localDay, minimum, mean, maximum }, wire });
  }

  const days: EcccObservationDay[] = [];
  let fullyObservedDays = 0;
  for (let offset = 0; offset < requestedDays; offset++) {
    const localDay = addGrowerUtcDays(chosen.firstLocalDay, offset)!;
    const entry = byDay.get(localDay)?.row;
    if (entry?.minimum.kind === 'observed' && entry.mean.kind === 'observed' && entry.maximum.kind === 'observed') fullyObservedDays++;
    days.push(entry ?? { kind: 'no-record', localDay });
  }
  return { status: 'available', selection: chosen,
    source: { url: source.url, retrievedAt: source.retrievedAt, temperatureUnit: source.temperatureUnit }, station, requestedDays,
    returnedDays: byDay.size, fullyObservedDays, days };
}
