import { addGrowerUtcDays, isGrowerRecordedAt, isGrowerUtcDate } from '../grower-planning.ts';

export const DWD_KL_STATION = { id: '00433', name: 'Berlin-Tempelhof' } as const;
export const DWD_KL_ARCHIVE_NAME = 'tageswerte_KL_00433_akt.zip';
const DATASET = 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl';
export const DWD_KL_ARCHIVE_URL = `${DATASET}/recent/${DWD_KL_ARCHIVE_NAME}`;
export const DWD_KL_SPECIFICATION = `${DATASET}/DESCRIPTION_obsgermany-climate-daily-kl_en.pdf`;
export const DWD_KL_LICENCE = 'https://creativecommons.org/licenses/by/4.0/';
export const DWD_KL_ATTRIBUTION = 'Deutscher Wetterdienst (DWD CDC), Daily station observations for Germany, KL v24.3';

const MAX_WINDOW_DAYS = 366;
const DOCUMENTED_RECENT_DAYS = 500;
// DWD's retained product spans 550 days. Allow headroom for the archive while
// keeping the grower-selectable range within the documented rolling window.
const MAX_ARCHIVE_DAYS = 600;
export const DWD_KL_MAX_MEMBER_BYTES = 512 * 1024;
const DAY_MS = 86_400_000;
const QUALITY_LEVELS = new Set([1, 2, 3, 5, 7, 8, 9, 10]);
export const DWD_KL_PRODUCT = /^produkt_klima_tag_(\d{8})_(\d{8})_00433\.txt$/;
export const DWD_KL_METADATA_FILES = {
  geography: 'Metadaten_Geographie_00433.txt',
  parameters: 'Metadaten_Parameter_klima_tag_00433.txt',
  minimum: 'Metadaten_Geraete_Lufttemperatur_Minimum_00433.txt',
  mean: 'Metadaten_Geraete_Lufttemperatur_00433.txt',
  maximum: 'Metadaten_Geraete_Lufttemperatur_Maximum_00433.txt',
  nearGroundMinimum: 'Metadaten_Geraete_Lufttemp_Am_Erdb_Minimum_00433.txt',
} as const;

export interface DwdKlSelection {
  readonly stationId: string;
  readonly firstDay: string;
  readonly lastDay: string;
}

export type DwdKlMetadata = Readonly<Record<keyof typeof DWD_KL_METADATA_FILES, string>>;

export interface DwdKlRecentProduct {
  readonly archiveName: string;
  readonly memberName: string;
  readonly observations: string;
  readonly metadata: DwdKlMetadata;
  readonly retrievedAt: string;
}

interface DwdKlReturnedDay {
  readonly kind: 'returned';
  readonly day: string;
  readonly airMinimum: number | null;
  readonly airMean: number | null;
  readonly airMaximum: number | null;
  readonly nearGroundMinimum: number | null;
  readonly precipitationMm: number | null;
  readonly qn3: number | null;
  readonly qn4: number | null;
}

export type DwdKlObservationDay = DwdKlReturnedDay | { readonly kind: 'no-record'; readonly day: string };
type HoldReason = 'invalid-selection' | 'station-not-admitted' | 'source-mismatch' |
  'wrong-product' | 'wrong-station' | 'invalid-day' | 'duplicate-day' | 'metadata-mismatch';

export type DwdKlObservations = { readonly status: 'held'; readonly reason: HoldReason } | {
  readonly status: 'available';
  readonly selection: DwdKlSelection;
  readonly station: typeof DWD_KL_STATION;
  readonly source: {
    readonly series: 'recent-preliminary';
    readonly url: typeof DWD_KL_ARCHIVE_URL;
    readonly memberName: string;
    readonly retrievedAt: string;
    readonly firstArchiveDay: string;
    readonly lastArchiveDay: string;
  };
  readonly requestedDays: number;
  readonly returnedDays: number;
  readonly days: readonly DwdKlObservationDay[];
};

export function dwdKlRequestableDays(now: Date) {
  const today = now.toISOString().slice(0, 10);
  return {
    firstDay: addGrowerUtcDays(today, -DOCUMENTED_RECENT_DAYS)!,
    lastDay: addGrowerUtcDays(today, -1)!,
  };
}

export function dwdKlSelectionProblem(selection: DwdKlSelection, now: Date): HoldReason | null {
  const { stationId, firstDay, lastDay } = selection;
  if (typeof stationId !== 'string' || stationId.length !== 5 || !/^\d{5}$/.test(stationId)
    || !isGrowerUtcDate(firstDay) || !isGrowerUtcDate(lastDay)) return 'invalid-selection';
  // The reviewed catalogue marks Berlin-Tempelhof Frei. An ID matching the syntax
  // does not establish a different station's access, sensor heights, or day basis.
  if (stationId !== DWD_KL_STATION.id) return 'station-not-admitted';
  const allowed = dwdKlRequestableDays(now);
  if (firstDay < allowed.firstDay || lastDay > allowed.lastDay || firstDay > lastDay
    || (Date.parse(lastDay) - Date.parse(firstDay)) / DAY_MS >= MAX_WINDOW_DAYS) return 'invalid-selection';
  return null;
}

function providerDay(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  return isGrowerUtcDate(iso) ? iso : null;
}

function providerStationMatches(raw: string): boolean {
  return /^\d{1,5}$/.test(raw) && raw.padStart(5, '0') === DWD_KL_STATION.id;
}

const DATA_HEADER = 'STATIONS_ID;MESS_DATUM;QN_3;FX;FM;QN_4;RSK;RSKF;SDK;SHK_TAG;NM;VPM;PM;TMK;UPM;TXK;TNK;TGK;eor';
const PARAMETER_HEADER = 'Stations_ID;Von_Datum;Bis_Datum;Stationsname;Parameter;Parameterbeschreibung;Einheit;Datenquelle (Strukturversion=SV);Zusatz-Info;Besonderheiten;Literaturhinweis;eor;';
const SENSOR_HEADER = 'Stations_ID;Stationsname;Geo. Laenge [Grad];Geo. Breite [Grad];Stationshoehe [m];Geberhoehe ueber Grund [m];Von_Datum;Bis_Datum;Geraetetyp Name;Messverfahren;eor;';
const GEOGRAPHY_HEADER = 'Stations_id;Stationshoehe;Geogr.Breite;Geogr.Laenge;von_datum;bis_datum;Stationsname';

function table(text: string, header: string, metadata = false): string[][] | null {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > DWD_KL_MAX_MEMBER_BYTES) return null;
  const [first, ...lines] = text.trimEnd().split(/\r?\n/);
  const cells = (line: string) => line.split(';').map(cell => cell.trim());
  if (cells(first).join(';') !== header) return null;
  if (metadata && lines.at(-1)?.startsWith('generiert:')) lines.pop();
  if (header === PARAMETER_HEADER && lines.at(-1)?.trim() === 'Legende: FT  = Folgetag; GZ = Gesetzliche Zeit') lines.pop();
  const width = header.split(';').length;
  const rows = lines.map(cells);
  return rows.length > 0 && rows.every(row => row.length === width && (!header.includes('eor') || row.at(metadata ? -2 : -1) === 'eor'))
    ? rows : null;
}

function covers(row: string[], day: string, first: number, last: number, allowOpenEnd = false): boolean {
  const start = providerDay(row[first]);
  const end = providerDay(row[last]);
  return start !== null && start <= day && (end !== null ? day <= end : allowOpenEnd && row[last] === '');
}

function readMetadata(metadata: DwdKlMetadata): ((day: string) => boolean) | null {
  const locations = table(metadata.geography, GEOGRAPHY_HEADER, true);
  const parameters = table(metadata.parameters, PARAMETER_HEADER, true);
  const sensors = (['minimum', 'mean', 'maximum', 'nearGroundMinimum'] as const)
    .map(field => ({ rows: table(metadata[field], SENSOR_HEADER, true), height: field === 'nearGroundMinimum' ? 0.05 : 2 }));
  if (!locations || !parameters || sensors.some(sensor => !sensor.rows)
    || ![locations, parameters, ...sensors.map(sensor => sensor.rows!)].every(rows => rows.every(row => providerStationMatches(row[0])))) return null;

  // RSK is a different observation interval from the temperature extrema. Displaying
  // it as a midnight-to-midnight total would misstate the actual archive metadata.
  const specs = [
    ['TNK', '°C', /^00:00 - 24:00 UTC\b/],
    ['TMK', '°C', /^arithm\.Mittel aus mind\. 21 Stundenwerten$/],
    ['TXK', '°C', /^00:00 - 24:00 UTC\b/],
    ['TGK', '°C', /^00:00 - 24:00 UTC\b/],
    ['RSK', 'mm', /^06:00 - 06:00 FT\. UTC\b/],
  ] as const;
  return day => {
    const location = locations.filter(row => covers(row, day, 4, 5, true));
    return location.length === 1 && location[0][6] === DWD_KL_STATION.name &&
      sensors.every(({ rows, height }) => {
        const active = rows!.filter(row => covers(row, day, 6, 7));
        return active.length === 1 && active[0][1] === DWD_KL_STATION.name && Number(active[0][5]) === height;
      }) && specs.every(([code, unit, method]) => {
        const active = parameters.filter(row => row[4] === code && covers(row, day, 1, 2));
        return active.length === 1 && active[0][3] === DWD_KL_STATION.name && active[0][6] === unit &&
          method.test(active[0][8]) && (code !== 'TMK' || active[0][7].includes('nach 1.4.2001'));
      });
  };
}

function reading(raw: string): number | null | undefined {
  if (/^-999(?:\.0+)?$/.test(raw)) return null;
  if (!/^-?\d{1,4}(?:\.\d+)?$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? (parsed === 0 ? 0 : parsed) : undefined;
}

function quality(raw: string): number | null | undefined {
  const value = reading(raw);
  return value === null ? null : value !== undefined && /^\d{1,2}$/.test(raw) && QUALITY_LEVELS.has(value) ? value : undefined;
}

export function parseDwdKlRecentObservations(product: DwdKlRecentProduct, selection: DwdKlSelection): DwdKlObservations {
  if (product.archiveName !== DWD_KL_ARCHIVE_NAME || !isGrowerRecordedAt(product.retrievedAt))
    return { status: 'held', reason: 'source-mismatch' };
  const problem = dwdKlSelectionProblem(selection, new Date(product.retrievedAt));
  if (problem) return { status: 'held', reason: problem };
  const memberMatch = DWD_KL_PRODUCT.exec(product.memberName);
  const firstArchiveDay = memberMatch && providerDay(memberMatch[1]);
  const lastArchiveDay = memberMatch && providerDay(memberMatch[2]);
  const rows = table(product.observations, DATA_HEADER);
  if (!rows || !firstArchiveDay || !lastArchiveDay || firstArchiveDay > lastArchiveDay
    || (Date.parse(lastArchiveDay) - Date.parse(firstArchiveDay)) / DAY_MS >= MAX_ARCHIVE_DAYS
    || firstArchiveDay < '2001-04-01' || lastArchiveDay >= product.retrievedAt.slice(0, 10))
    return { status: 'held', reason: 'wrong-product' };
  const metadataCovers = readMetadata(product.metadata);
  if (!metadataCovers) return { status: 'held', reason: 'metadata-mismatch' };

  const byDay = new Map<string, DwdKlReturnedDay>();
  for (const row of rows) {
    if (!providerStationMatches(row[0])) return { status: 'held', reason: 'wrong-station' };
    const day = providerDay(row[1]);
    const [airMinimum, airMean, airMaximum, nearGroundMinimum, precipitationMm] =
      [row[16], row[13], row[15], row[17], row[6]].map(reading);
    const qn3 = quality(row[2]);
    const qn4 = quality(row[5]);
    const air = [airMinimum, airMean, airMaximum].filter((value): value is number => value !== null && value !== undefined);
    if (!day || day < firstArchiveDay || day > lastArchiveDay || airMinimum === undefined ||
      airMean === undefined || airMaximum === undefined || nearGroundMinimum === undefined ||
      precipitationMm === undefined || (precipitationMm !== null && precipitationMm < 0) ||
      qn3 === undefined || qn4 === undefined || air.some((value, index) => index > 0 && air[index - 1] > value))
      return { status: 'held', reason: 'invalid-day' };
    if (byDay.has(day)) return { status: 'held', reason: 'duplicate-day' };
    byDay.set(day, { kind: 'returned', day, airMinimum, airMean, airMaximum, nearGroundMinimum, precipitationMm, qn3, qn4 });
  }
  if (!byDay.has(firstArchiveDay) || !byDay.has(lastArchiveDay)) return { status: 'held', reason: 'wrong-product' };

  const days: DwdKlObservationDay[] = [];
  let returnedDays = 0;
  for (let day = selection.firstDay; day <= selection.lastDay; day = addGrowerUtcDays(day, 1)!) {
    const observation = byDay.get(day);
    if (observation && !metadataCovers(day)) return { status: 'held', reason: 'metadata-mismatch' };
    if (observation) returnedDays++;
    days.push(observation ?? { kind: 'no-record', day });
  }
  return {
    status: 'available', station: DWD_KL_STATION, selection, requestedDays: days.length, returnedDays, days,
    source: { series: 'recent-preliminary', url: DWD_KL_ARCHIVE_URL, memberName: product.memberName,
      retrievedAt: product.retrievedAt, firstArchiveDay, lastArchiveDay },
  };
}
