import { coordinateSiteIdParts, canonicalCoordinateSiteId } from './site-id';
import type { LocationData } from './types';

export const PVGIS_URL = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';
export const PVGIS_GUIDE = 'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/grid-connected-pv_en';
export const WIND_ATLAS_URL = 'https://globalwindatlas.info/en/';

export interface ElevationEvidence {
  model?: { siteId: string; elevationM: number; source: 'OpenTopoData SRTM30m'; sampleBaselineM: number };
  benchmark?: { elevationM: number | null; method: 'reported' | 'surveyed'; source?: string; datum?: string; observedOn?: string };
}
export interface SolarReference {
  provider: 'European Commission JRC PVGIS'; version: '5.3'; siteId: string; fetchedAt: string;
  radiationDatabase: string; meteorologicalDatabase: string; startYear: number; endYear: number;
  capacityKwp: 1; lossPercent: 14; technology: 'c-Si'; mounting: 'free-standing'; terrainHorizon: true;
  tiltDegrees: number; azimuthDegreesFromSouth: number;
  annualKwh: number; annualIrradiationKwhM2: number;
  months: { month: number; energyKwh: number; irradiationKwhM2: number }[];
}
export interface WindEvidence {
  kind: 'atlas' | 'measured'; meanSpeedMs: number | null; heightM: number | null;
  source: string; period: string; recordedOn?: string;
  exposure?: 'open' | 'sheltered' | 'mixed' | 'unknown'; obstacles?: string;
}
export interface SiteEnergyEvidence { solar?: SolarReference; solarShadeNotes?: string; wind?: WindEvidence }
export interface SurveyEnergyInputs { benchmarkElevation: string; windSpeed: string; windHeight: string }

/** Raw strings belong in the recoverable draft; invalid entries must be corrected, not erased. */
export function surveyEnergyInputErrors(inputs: SurveyEnergyInputs, windKind?: WindEvidence['kind']): Partial<Record<keyof SurveyEnergyInputs, string>> {
  const errors: Partial<Record<keyof SurveyEnergyInputs, string>> = {};
  const invalid = (raw: string, min: number, max: number) => raw !== '' && (!raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < min || Number(raw) > max);
  if (invalid(inputs.benchmarkElevation, -12000, 10000)) errors.benchmarkElevation = 'Enter a benchmark elevation between −12,000 and 10,000 m, or leave it blank.';
  if (invalid(inputs.windSpeed, 0, 100)) errors.windSpeed = 'Enter a mean wind speed from 0 to 100 m/s, or leave it blank.';
  if (invalid(inputs.windHeight, 0.1, 1000) || (inputs.windHeight !== '' && windKind === 'atlas' && ![10,50,100,150,200].includes(Number(inputs.windHeight)))) errors.windHeight = 'Enter a valid measurement height, or select an available atlas height.';
  return errors;
}

const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const finite = (v: unknown, min = 0, max = Number.MAX_VALUE): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max = 500): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const date = (v: unknown): string | undefined => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v ? v : undefined;

export function energyCoordinatesMatch(siteId: string, lat: unknown, lon: unknown): boolean {
  const expected = canonicalCoordinateSiteId(siteId);
  return expected !== null && finite(lat, -90, 90) && finite(lon, -180, 180)
    && `site:${Number(lat.toFixed(5)).toFixed(5)},${Number(lon.toFixed(5)).toFixed(5)}` === expected;
}

/** Legacy location fallbacks contain a plausible zero without source evidence. Do not call it
 * sea level; a genuine sampled zero still has the sampling provenance and is retained. */
export function locationElevationReference(location: LocationData | undefined, siteId: string): ElevationEvidence['model'] | undefined {
  const e = location?.elevation;
  if (!location || !energyCoordinatesMatch(siteId, location.lat, location.lon) || !e
    || !finite(e.elevation, -12000, 10000) || !finite(e.sampleBaselineM, 1)
    || !['site-local-indicative', 'unconfirmed'].includes(e.directionConfidence ?? '')) return undefined;
  return { siteId, elevationM: e.elevation, source: 'OpenTopoData SRTM30m', sampleBaselineM: e.sampleBaselineM };
}

export function normaliseElevationEvidence(value: unknown, siteId: string): ElevationEvidence | undefined {
  const v = object(value), model = object(v.model), benchmark = object(v.benchmark);
  const result: ElevationEvidence = {};
  if (model.siteId === siteId && model.source === 'OpenTopoData SRTM30m' && finite(model.elevationM, -12000, 10000) && finite(model.sampleBaselineM, 1)) {
    result.model = { siteId, elevationM: model.elevationM, source: model.source, sampleBaselineM: model.sampleBaselineM };
  }
  if (['reported', 'surveyed'].includes(benchmark.method)) {
    result.benchmark = { elevationM: finite(benchmark.elevationM, -12000, 10000) ? benchmark.elevationM : null, method: benchmark.method,
      ...(text(benchmark.source) ? { source: text(benchmark.source) } : {}),
      ...(text(benchmark.datum, 120) ? { datum: text(benchmark.datum, 120) } : {}),
      ...(date(benchmark.observedOn) ? { observedOn: date(benchmark.observedOn) } : {}) };
  }
  return Object.keys(result).length ? result : undefined;
}

export function normaliseSolarReference(value: unknown, siteId: string): SolarReference | undefined {
  const v = object(value), months = v.months;
  if (v.provider !== 'European Commission JRC PVGIS' || v.version !== '5.3' || v.siteId !== siteId
    || !coordinateSiteIdParts(siteId) || typeof v.fetchedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.fetchedAt) || !Number.isFinite(Date.parse(v.fetchedAt))
    || !text(v.radiationDatabase, 80) || !text(v.meteorologicalDatabase, 80)
    || !Number.isInteger(v.startYear) || !Number.isInteger(v.endYear) || v.startYear < 1900 || v.endYear < v.startYear || v.endYear > new Date().getFullYear()
    || v.capacityKwp !== 1 || v.lossPercent !== 14 || v.technology !== 'c-Si' || v.mounting !== 'free-standing' || v.terrainHorizon !== true
    || !finite(v.tiltDegrees, 0, 90) || !finite(v.azimuthDegreesFromSouth, -180, 180)
    || !finite(v.annualKwh) || !finite(v.annualIrradiationKwhM2)
    || !Array.isArray(months) || months.length !== 12) return undefined;
  const cleanMonths = months.map((raw: unknown) => object(raw));
  if (cleanMonths.some((m, i) => m.month !== i + 1 || !finite(m.energyKwh) || !finite(m.irradiationKwhM2))) return undefined;
  // Monthly/annual values are rounded by PVGIS; tolerate rounding, not a unit or series mismatch.
  if (Math.abs(cleanMonths.reduce((sum, m) => sum + m.energyKwh, 0) - v.annualKwh) > 1
    || Math.abs(cleanMonths.reduce((sum, m) => sum + m.irradiationKwhM2, 0) - v.annualIrradiationKwhM2) > 1) return undefined;
  return { provider: v.provider, version: v.version, siteId, fetchedAt: v.fetchedAt,
    radiationDatabase: text(v.radiationDatabase, 80), meteorologicalDatabase: text(v.meteorologicalDatabase, 80), startYear: v.startYear, endYear: v.endYear,
    capacityKwp: 1, lossPercent: 14, technology: 'c-Si', mounting: 'free-standing', terrainHorizon: true,
    tiltDegrees: v.tiltDegrees, azimuthDegreesFromSouth: v.azimuthDegreesFromSouth, annualKwh: v.annualKwh, annualIrradiationKwhM2: v.annualIrradiationKwhM2,
    months: cleanMonths.map(m => ({ month: m.month, energyKwh: m.energyKwh, irradiationKwhM2: m.irradiationKwhM2 })) };
}

export function normaliseSiteEnergy(value: unknown, siteId: string): SiteEnergyEvidence | undefined {
  const v = object(value), wind = object(v.wind), result: SiteEnergyEvidence = {};
  const solar = normaliseSolarReference(v.solar, siteId);
  if (solar) result.solar = solar;
  if (text(v.solarShadeNotes)) result.solarShadeNotes = text(v.solarShadeNotes);
  // Keep incomplete observations recoverable; an incomplete row never becomes a yield claim.
  if (['atlas', 'measured'].includes(wind.kind)) {
    const height = finite(wind.heightM, 0.1, 1000) && (wind.kind !== 'atlas' || [10, 50, 100, 150, 200].includes(wind.heightM)) ? wind.heightM : null;
    result.wind = { kind: wind.kind, meanSpeedMs: finite(wind.meanSpeedMs, 0, 100) ? wind.meanSpeedMs : null, heightM: height,
      source: text(wind.source), period: text(wind.period, 150),
      ...(date(wind.recordedOn) ? { recordedOn: date(wind.recordedOn) } : {}),
      ...(['open', 'sheltered', 'mixed', 'unknown'].includes(wind.exposure) ? { exposure: wind.exposure } : {}),
      ...(text(wind.obstacles) ? { obstacles: text(wind.obstacles) } : {}) };
  }
  return Object.keys(result).length ? result : undefined;
}

export function pvgisRequestUrl(lat: number, lon: number): string {
  if (!finite(lat, -90, 90) || !finite(lon, -180, 180)) throw new Error('Invalid site coordinates.');
  const url = new URL(PVGIS_URL);
  url.search = new URLSearchParams({ lat: lat.toFixed(5), lon: lon.toFixed(5), peakpower: '1', loss: '14', optimalangles: '1',
    pvtechchoice: 'crystSi', mountingplace: 'free', usehorizon: '1', outputformat: 'json' }).toString();
  return url.toString();
}

export function parsePvgisResponse(value: unknown, siteId: string, fetchedAt: string): SolarReference {
  const v = object(value), inputs = object(v.inputs), loc = object(inputs.location), meteo = object(inputs.meteo_data);
  const fixed = object(object(inputs.mounting_system).fixed), module = object(inputs.pv_module), outputs = object(v.outputs);
  const totals = object(object(outputs.totals).fixed), monthly = object(outputs.monthly).fixed;
  const meta = object(v.meta), units = object(object(object(meta.outputs).totals).variables), monthUnits = object(object(object(meta.outputs).monthly).variables);
  if (!energyCoordinatesMatch(siteId, loc.latitude, loc.longitude)
    || object(units.E_y).units !== 'kWh/y' || object(units['H(i)_y']).units !== 'kWh/m2/y'
    || object(monthUnits.E_m).units !== 'kWh/mo' || object(monthUnits['H(i)_m']).units !== 'kWh/m2/mo'
    || object(fixed.slope).optimal !== true || object(fixed.azimuth).optimal !== true || meteo.use_horizon !== true) {
    throw new Error('PVGIS returned an incompatible location, units or model configuration. No estimate was saved.');
  }
  const result = normaliseSolarReference({ provider: 'European Commission JRC PVGIS', version: '5.3', siteId, fetchedAt,
    radiationDatabase: meteo.radiation_db, meteorologicalDatabase: meteo.meteo_db, startYear: meteo.year_min, endYear: meteo.year_max,
    capacityKwp: module.peak_power, lossPercent: module.system_loss, technology: module.technology, mounting: fixed.type,
    terrainHorizon: meteo.use_horizon, tiltDegrees: object(fixed.slope).value, azimuthDegreesFromSouth: object(fixed.azimuth).value,
    annualKwh: totals.E_y, annualIrradiationKwhM2: totals['H(i)_y'],
    months: Array.isArray(monthly) ? monthly.map(m => ({ month: m.month, energyKwh: m.E_m, irradiationKwhM2: m['H(i)_m'] })) : undefined }, siteId);
  if (!result) throw new Error('PVGIS returned incomplete or inconsistent solar data. No estimate was saved.');
  return result;
}

export function siteEnergyPrompt(elevation: ElevationEvidence | undefined, energy: SiteEnergyEvidence | undefined, siteId: string): string {
  const e = normaliseElevationEvidence(elevation, siteId), s = normaliseSiteEnergy(energy, siteId), lines: string[] = [];
  if (e?.model) lines.push(`Approximate elevation reference: ${e.model.elevationM} m above sea level; ${e.model.source}; five-point baseline ${e.model.sampleBaselineM} m; retrieval date not recorded. Not surveyed contours or a construction benchmark.`);
  if (e?.benchmark) lines.push(`Separate ${e.benchmark.method} elevation benchmark: ${e.benchmark.elevationM === null ? 'not recorded' : `${e.benchmark.elevationM} m`}; source: ${e.benchmark.source || 'not recorded'}; datum: ${e.benchmark.datum || 'unknown'}; date: ${e.benchmark.observedOn || 'not recorded'}. Do not overwrite model elevation, contours or geometry.`);
  if (s?.solar) {
    const pv = s.solar;
    lines.push(`SOLAR SCREENING (not installed capacity): ${pv.annualKwh} kWh/year for assumed ${pv.capacityKwp} kWp crystalline silicon, free-standing, PVGIS-optimised tilt ${pv.tiltDegrees}°, azimuth ${pv.azimuthDegreesFromSouth}° from south (0=S, 90=W, -90=E), assumed losses ${pv.lossPercent}%, terrain horizon included. Irradiation ${pv.annualIrradiationKwhM2} kWh/m²/year on that plane. ${pv.provider} ${pv.version}, ${pv.radiationDatabase}/${pv.meteorologicalDatabase}, ${pv.startYear}–${pv.endYear}, retrieved ${pv.fetchedAt}.`);
    lines.push(`Monthly reference PV electricity (kWh, Jan–Dec): ${pv.months.map(m => m.energyKwh).join(', ')}. Nearby shade, usable roof area, structural/electrical suitability, storage, cost and grid connection remain unverified.`);
  }
  if (s?.solarShadeNotes) lines.push(`Farmer-reported solar shade observations: ${s.solarShadeNotes}`);
  if (s?.wind) {
    const w = s.wind;
    lines.push(`WIND RESOURCE (${w.kind === 'atlas' ? 'manually transcribed regional atlas, not an on-site measurement' : 'reported measurement'}): mean ${w.meanSpeedMs === null ? 'unknown' : `${w.meanSpeedMs} m/s`} at ${w.heightM === null ? 'unknown height' : `${w.heightM} m above ground`}; source ${w.source || 'not recorded'}; averaging period ${w.period || 'not recorded'}; recorded ${w.recordedOn || 'not recorded'}; exposure ${w.exposure || 'unknown'}; obstacles ${w.obstacles || 'not recorded'}.`);
    if (w.meanSpeedMs === null || w.heightM === null || !w.source || !w.period) lines.push('Wind reference is incomplete and cannot yet be compared or used for energy assessment.');
    if (w.kind === 'atlas') lines.push('Global Wind Atlas: DTU Wind and Energy Systems / World Bank / ESMAP, CC BY 4.0. Regional model, approximately 250 m grid; local turbulence/obstacles are unresolved.');
    lines.push('Do not infer turbine kWh, a suitable turbine or investment viability from this mean speed. A power curve, hub height, speed distribution, local measurements and siting checks are needed.');
  }
  return lines.join('\n');
}
