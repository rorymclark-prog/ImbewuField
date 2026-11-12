import { cropByKey } from '../crop-catalog';
import { canonicalCoordinateSiteId } from '../site-id';
import { validWorkspacePlanningId } from './workspace-context';
import { growerEstimateSourceQuantity, normaliseGrowerEstimateSourceReceipt, type GrowerEstimateSourceReceipt,
  type GrowerEstimateSourceField, normaliseGrowerSpacingSelectionReceipt, growerSpacingSourceQuantities, type GrowerSpacingSelectionReceipt } from '../grower-estimate-units';
import { addDecimalQuantity, floorDecimalQuantityRatio, floorExactDecimalQuantityRatio } from '../farm-records';
import { INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES } from '../length-units';
import { regionalSpacingReference } from './providers/regional-spacing-reference';

export type GrowerPlanningScope =
  | { readonly kind: 'mapped-site'; readonly siteId: string }
  | { readonly kind: 'unmapped-workspace'; readonly workspaceId: string };

/** These are the grower's provenance claims, not evidence that a source was checked. */
export type GrowerInputProvenance =
  | { readonly kind: 'grower-estimate'; readonly recordedAt: string; readonly note?: string }
  | { readonly kind: 'grower-record'; readonly recordedAt: string; readonly reference: string }
  | { readonly kind: 'external-reference'; readonly recordedAt: string; readonly reference: string; readonly sourceUrl: string };

export type GrowerInput<T, U extends string> =
  | { readonly state: 'missing'; readonly reason: 'not-entered' | 'not-known' | 'not-applicable' }
  | { readonly state: 'provided'; readonly value: T; readonly unit: U; readonly provenance: GrowerInputProvenance };

/** Canonical saved rectangle dimensions, never inferred original feet or survey accuracy. */
export interface GrowerAreaArithmeticBasis {
  readonly kind: 'saved-rectangle-metres-v1';
  readonly widthM: number;
  readonly heightM: number;
}
export type GrowerMeasuredAreaInput = GrowerInput<number, 'm2'> & { readonly arithmeticBasis?: GrowerAreaArithmeticBasis };

export interface GrowerPlanningInputs {
  readonly plantsPerM2: GrowerInput<number, 'plants/m2'>;
  readonly yieldKgPerM2: GrowerInput<number, 'kg/m2/cycle'>;
  readonly establishment: GrowerInput<'direct' | 'transplant', 'method'>;
  readonly nurseryDays: GrowerInput<number, 'days'>;
  readonly fieldEntryToFirstHarvestDays: GrowerInput<number, 'days'>;
  readonly pickingDays: GrowerInput<number, 'days'>;
  readonly fieldOccupancyDays: GrowerInput<number, 'days'>;
  readonly turnaroundDays: GrowerInput<number, 'days'>;
  /** An explicit empty window permits no entry dates; missing never means all year. */
  readonly allowedEntryMonths: GrowerInput<readonly number[], 'utc-months'>;
}

export interface GrowerPlanningProfile {
  readonly version: 1;
  readonly profileId: string;
  /** Existing catalogue identity only; no catalogue agronomy is read. */
  readonly cropKey: string;
  readonly scope: GrowerPlanningScope;
  readonly inputs: GrowerPlanningInputs;
  /** Optional entered-unit origin, not source verification or measured area. */
  readonly exactDensitySources?: Readonly<Partial<Record<GrowerEstimateSourceField, GrowerEstimateSourceReceipt>>>;
  readonly plantCountOrigin?: GrowerSpacingSelectionReceipt;
}

export interface GrowerCountAreaBinding { readonly bedId: string }

export interface GrowerPlanningRequest {
  readonly profile: unknown;
  readonly scope: unknown;
  readonly measuredAreaM2: unknown;
  readonly fieldEntryDate: unknown;
  readonly countAreaBinding?: GrowerCountAreaBinding;
}

export const GROWER_COUNT_ARITHMETIC = 'exact-declared-decimal-v1' as const;
export interface GrowerPlanningSnapshot {
  /** Old float reviews must be rechecked, including their saved-cycle markers. */
  readonly countArithmetic: typeof GROWER_COUNT_ARITHMETIC;
  readonly profile: GrowerPlanningProfile;
  readonly scope: GrowerPlanningScope;
  readonly measuredAreaM2: GrowerMeasuredAreaInput;
  readonly fieldEntryDate: GrowerInput<string, 'utc-date'>;
}

export interface GrowerCapacityEstimate {
  readonly measuredAreaM2: number;
  readonly estimatedPlantCount: number;
  readonly budgetedStations?: number;
  readonly estimatedYieldKg: number;
  readonly densityEstimateNotLayoutClearance: true;
}

export interface GrowerDateEstimate {
  readonly fieldEntryDate: string;
  readonly nurseryStartDate: string | null;
  readonly firstHarvestDate: string;
  readonly harvestEndExclusiveDate: string;
  readonly fieldClearDate: string;
  readonly nextFieldEntryDate: string;
}

interface AssessmentBasis {
  readonly basis: 'grower-input-arithmetic';
  readonly sourceVerification: 'not-verified';
}

export type GrowerPlanningAssessment = AssessmentBasis & (
  | { readonly status: 'ready'; readonly snapshot: GrowerPlanningSnapshot; readonly fingerprint: string;
      readonly capacity: GrowerCapacityEstimate; readonly schedule: GrowerDateEstimate }
  | { readonly status: 'missing-inputs' | 'scope-mismatch' | 'entry-window-excluded';
      readonly issues: readonly string[]; readonly snapshot: GrowerPlanningSnapshot; readonly fingerprint: string }
  | { readonly status: 'invalid-inputs'; readonly issues: readonly string[];
      readonly snapshot: GrowerPlanningSnapshot | null; readonly fingerprint: string | null }
);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000
    && !/[\u0000-\u001f\u007f]/.test(value);
}

export function isGrowerRecordedAt(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}
const instant = isGrowerRecordedAt;

export function isGrowerUtcDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}
const utcDate = isGrowerUtcDate;

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function normaliseGrowerPlanningScope(value: unknown): GrowerPlanningScope | null {
  if (!record(value)) return null;
  if (value.kind === 'mapped-site' && canonicalCoordinateSiteId(value.siteId) && value.workspaceId === undefined) {
    return freeze({ kind: 'mapped-site', siteId: value.siteId as string });
  }
  if (value.kind === 'unmapped-workspace' && validWorkspacePlanningId(value.workspaceId) && value.siteId === undefined) {
    return freeze({ kind: 'unmapped-workspace', workspaceId: value.workspaceId });
  }
  return null;
}

export function growerPlanningScopeKey(value: unknown): string | null {
  const scope = normaliseGrowerPlanningScope(value);
  return scope ? scope.kind === 'mapped-site' ? `mapped-site:${scope.siteId}` : `unmapped-workspace:${scope.workspaceId}` : null;
}

function provenance(value: unknown): GrowerInputProvenance | null {
  if (!record(value) || !instant(value.recordedAt)) return null;
  if (value.kind === 'grower-estimate') {
    if (value.note !== undefined && !text(value.note)) return null;
    return { kind: value.kind, recordedAt: value.recordedAt, ...(value.note === undefined ? {} : { note: value.note as string }) };
  }
  if (!text(value.reference)) return null;
  if (value.kind === 'grower-record') return { kind: value.kind, recordedAt: value.recordedAt, reference: value.reference };
  if (value.kind !== 'external-reference' || !text(value.sourceUrl)) return null;
  try {
    const url = new URL(value.sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  } catch { return null; }
  return { kind: value.kind, recordedAt: value.recordedAt, reference: value.reference, sourceUrl: value.sourceUrl };
}

export function normaliseGrowerInput<T, U extends string>(value: unknown, unit: U, valid: (v: unknown) => v is T): GrowerInput<T, U> | null {
  if (!record(value)) return null;
  if (value.state === 'missing') {
    // A recorded zero cannot disappear just because an importer also marks it missing.
    if (value.value !== undefined || value.unit !== undefined || value.provenance !== undefined) return null;
    if (value.reason !== 'not-entered' && value.reason !== 'not-known' && value.reason !== 'not-applicable') return null;
    return { state: 'missing', reason: value.reason };
  }
  if (value.state !== 'provided' || value.unit !== unit || !valid(value.value)) return null;
  const source = provenance(value.provenance);
  if (!source) return null;
  return { state: 'provided', value: value.value, unit, provenance: source };
}
const input = normaliseGrowerInput;

const nonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Validate a supplied arithmetic basis against the existing numeric area
 * projection. The actual geometry/source authority supplies the dimensions. */
export function normaliseGrowerMeasuredAreaInput(value: unknown): GrowerMeasuredAreaInput | null {
  const area = input(value, 'm2', nonNegative);
  if (!area || !record(value)) return null;
  const marker = Object.getOwnPropertyDescriptor(value, 'arithmeticBasis');
  if (!marker) return 'arithmeticBasis' in value ? null : area;
  if (!('value' in marker) || area.state !== 'provided' || !record(marker.value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(marker.value);
  if (Reflect.ownKeys(descriptors).length !== 3 || !['kind', 'widthM', 'heightM'].every(key => descriptors[key]?.enumerable && 'value' in descriptors[key])) return null;
  const kind = descriptors.kind.value, widthM = descriptors.widthM.value, heightM = descriptors.heightM.value;
  if (kind !== 'saved-rectangle-metres-v1' || !nonNegative(widthM) || widthM === 0 || !nonNegative(heightM) || heightM === 0
    || !Number.isFinite(widthM * heightM) || widthM * heightM <= 0 || widthM * heightM !== area.value) return null;
  return { ...area, arithmeticBasis: Object.freeze({ kind, widthM, heightM }) };
}
const days = (v: unknown): v is number => nonNegative(v) && Number.isSafeInteger(v);
const method = (v: unknown): v is 'direct' | 'transplant' => v === 'direct' || v === 'transplant';
const months = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 12
  && Array.from(v).every(m => Number.isInteger(m) && m >= 1 && m <= 12) && new Set(v).size === v.length;

/** Invalid supplied data is rejected, never silently replaced with a missing/default value. */
export function normaliseGrowerPlanningProfile(value: unknown): GrowerPlanningProfile | null {
  if (!record(value) || value.version !== 1 || !text(value.profileId) || typeof value.cropKey !== 'string'
    || !cropByKey(value.cropKey) || !record(value.inputs)) return null;
  const scope = normaliseGrowerPlanningScope(value.scope);
  const raw = value.inputs;
  const plantsPerM2 = input(raw.plantsPerM2, 'plants/m2', nonNegative);
  const yieldKgPerM2 = input(raw.yieldKgPerM2, 'kg/m2/cycle', nonNegative);
  const establishment = input(raw.establishment, 'method', method);
  const nurseryDays = input(raw.nurseryDays, 'days', days);
  const fieldEntryToFirstHarvestDays = input(raw.fieldEntryToFirstHarvestDays, 'days', days);
  const pickingDays = input(raw.pickingDays, 'days', days);
  const fieldOccupancyDays = input(raw.fieldOccupancyDays, 'days', days);
  const turnaroundDays = input(raw.turnaroundDays, 'days', days);
  const allowedEntryMonths = input(raw.allowedEntryMonths, 'utc-months', months);
  if (!scope || !plantsPerM2 || !yieldKgPerM2 || !establishment || !nurseryDays || !fieldEntryToFirstHarvestDays
    || !pickingDays || !fieldOccupancyDays || !turnaroundDays || !allowedEntryMonths) return null;
  const window: GrowerPlanningInputs['allowedEntryMonths'] = allowedEntryMonths.state === 'missing' ? allowedEntryMonths
    : { ...allowedEntryMonths, value: [...allowedEntryMonths.value].sort((a, b) => a - b) };
  let exactDensitySources: GrowerPlanningProfile['exactDensitySources'];
  // A malformed present marker must not fall back to legacy arithmetic. The
  // raw-book writer admission also keeps a display load from erasing it.
  if (Object.prototype.hasOwnProperty.call(value, 'exactDensitySources')) {
    if (!record(value.exactDensitySources)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value.exactDensitySources);
    const keys = Reflect.ownKeys(descriptors);
    if (!keys.length || keys.length > 2 || keys.some(key => typeof key !== 'string'
      || !['plantsPerM2', 'yieldKgPerM2'].includes(key)
      || !descriptors[key].enumerable || !('value' in descriptors[key]))) return null;
    const sources: Partial<Record<GrowerEstimateSourceField, GrowerEstimateSourceReceipt>> = {};
    for (const key of ['plantsPerM2', 'yieldKgPerM2'] as const) {
      if (!Object.prototype.hasOwnProperty.call(descriptors, key)) continue;
      const canonical = key === 'plantsPerM2' ? plantsPerM2 : yieldKgPerM2;
      if (canonical.state !== 'provided') return null;
      const receipt = normaliseGrowerEstimateSourceReceipt(descriptors[key].value, {
        scopeKey: growerPlanningScopeKey(scope)!, profileId: value.profileId, cropKey: value.cropKey, field: key,
      }, canonical.value);
      if (!receipt) return null;
      sources[key] = receipt;
    }
    exactDensitySources = sources;
  }
  let plantCountOrigin: GrowerSpacingSelectionReceipt | null = null;
  if ('plantCountOrigin' in value) {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'plantCountOrigin');
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
    plantCountOrigin = normaliseGrowerSpacingSelectionReceipt(descriptor.value,
      { scopeKey: growerPlanningScopeKey(scope)!, profileId: value.profileId, cropKey: value.cropKey });
    if (!plantCountOrigin || plantsPerM2.state !== 'missing' || exactDensitySources?.plantsPerM2
      || establishment.state !== 'provided' || establishment.value !== regionalSpacingReference(
        plantCountOrigin.countryCode, plantCountOrigin.cropKey, plantCountOrigin.regionReference, plantCountOrigin)?.establishment) return null;
  }
  return freeze({ version: 1, profileId: value.profileId, cropKey: value.cropKey, scope,
    inputs: { plantsPerM2, yieldKgPerM2, establishment, nurseryDays, fieldEntryToFirstHarvestDays,
      pickingDays, fieldOccupancyDays, turnaroundDays, allowedEntryMonths: window },
    ...(exactDensitySources ? { exactDensitySources } : {}), ...(plantCountOrigin ? { plantCountOrigin } : {}) });
}

/** Duplicate identities are ambiguous even across scopes, or when one duplicate is
 * damaged. Importing them must not silently choose the first/last profile as truth. */
export function normaliseGrowerPlanningProfiles(value: unknown): GrowerPlanningProfile[] {
  if (!Array.isArray(value)) return [];
  const counts = new Map<string, number>();
  for (const row of value) {
    if (record(row) && typeof row.profileId === 'string') counts.set(row.profileId, (counts.get(row.profileId) ?? 0) + 1);
  }
  const result: GrowerPlanningProfile[] = [];
  for (const row of value) {
    const profile = normaliseGrowerPlanningProfile(row);
    if (profile && counts.get(profile.profileId) === 1) result.push(profile);
  }
  return result;
}

export function addGrowerUtcDays(date: string, count: number): string | null {
  if (!isGrowerUtcDate(date) || !Number.isSafeInteger(count)) return null;
  const ms = Date.parse(`${date}T00:00:00.000Z`) + count * 86_400_000;
  if (!Number.isSafeInteger(ms)) return null;
  const result = new Date(ms);
  if (!Number.isFinite(result.getTime())) return null;
  const iso = result.toISOString().slice(0, 10);
  return utcDate(iso) ? iso : null;
}
const addDays = addGrowerUtcDays;

const basis: AssessmentBasis = { basis: 'grower-input-arithmetic', sourceVerification: 'not-verified' };

function densityPlantCountFor(profile: GrowerPlanningProfile, area: GrowerMeasuredAreaInput): number | null {
  if (area.state !== 'provided' || profile.inputs.plantsPerM2.state !== 'provided') return null;
  const source = profile.exactDensitySources?.plantsPerM2;
  const quantity = source ? growerEstimateSourceQuantity(source) : null;
  const areaFactors = area.arithmeticBasis ? [area.arithmeticBasis.widthM, area.arithmeticBasis.heightM] : [area.value];
  // Both assessors use the declared rectangle factors and original density receipt;
  // a partial plan must not regain the floating-point rounding error the full plan avoids.
  const count = source
    ? quantity ? floorExactDecimalQuantityRatio({ factors: [...areaFactors.map(value => addDecimalQuantity(undefined, value)), quantity],
      divisors: source.unit === 'plants/ft2' ? [addDecimalQuantity(undefined, INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES)] : [] })
      : { status: 'held' as const, reason: 'source-unavailable' }
    : floorDecimalQuantityRatio({ factors: [...areaFactors, profile.inputs.plantsPerM2.value] });
  return count.status === 'ready' ? count.whole : null;
}

/** An area identity excludes the read timestamp, which is not a measurement. */
export function growerCountAreaBasisKey(area: GrowerMeasuredAreaInput): string | null {
  return area.state === 'provided' ? JSON.stringify([area.value, area.arithmeticBasis ?? null]) : null;
}

function plantCountFor(profile: GrowerPlanningProfile, area: GrowerMeasuredAreaInput, binding?: GrowerCountAreaBinding) {
  const origin = profile.plantCountOrigin;
  if (!origin) return { stations: null, value: densityPlantCountFor(profile, area), issue: 'plantsPerM2-or-count' };
  const quantities = growerSpacingSourceQuantities(origin);
  if (!quantities || area.state !== 'provided' || !binding || binding.bedId !== origin.bedId
    || growerCountAreaBasisKey(area) !== origin.areaBasisKey) return { stations: null, value: null, issue: 'spacing-area-binding' };
  const areaFactors = area.arithmeticBasis ? [area.arithmeticBasis.widthM, area.arithmeticBasis.heightM] : [area.value];
  const stations = floorExactDecimalQuantityRatio({ factors: [...areaFactors, 10000].map(v => addDecimalQuantity(undefined, v)),
    divisors: [quantities.rowCm, quantities.inRowCm] });
  if (stations.status !== 'ready') return { stations: null, value: null, issue: 'spacing-station-range' };
  if (!quantities.finalStand) return { stations: stations.whole, value: null, issue: 'spacing-final-stand' };
  const plants = floorExactDecimalQuantityRatio({ factors: [addDecimalQuantity(undefined, stations.whole), quantities.finalStand] });
  return { stations: stations.whole, value: plants.status === 'ready' ? plants.whole : null, issue: 'spacing-plant-range' };
}

export interface ProvisionalPlanningValue<T> {
  readonly status: 'ready' | 'missing-inputs' | 'invalid-inputs' | 'excluded' | 'not-applicable';
  readonly value: T | null;
  readonly issues: readonly string[];
}

export interface ProvisionalGrowerPlanningAssessment extends AssessmentBasis {
  readonly provisional: true;
  readonly status: 'ready' | 'partial-ready' | 'held' | 'invalid-inputs' | 'scope-mismatch';
  readonly snapshot: GrowerPlanningSnapshot | null;
  readonly fingerprint: string | null;
  readonly estimatedPlantCount: ProvisionalPlanningValue<number>;
  readonly budgetedStations: ProvisionalPlanningValue<number>;
  readonly estimatedYieldKg: ProvisionalPlanningValue<number>;
  readonly entryWindow: 'allowed' | 'unknown' | 'excluded' | 'missing-date';
  readonly schedule: Readonly<Record<keyof Omit<GrowerDateEstimate, 'fieldEntryDate'>, ProvisionalPlanningValue<string>>>;
  readonly uncertainties: readonly string[];
}

/** Missing yield should not erase a supported date calculation, and missing density
 * should not erase a supported yield estimate. These are conditional input arithmetic,
 * never a claim that the chosen date, evidence or crop is locally suitable. */
export function assessProvisionalGrowerPlanning(request: GrowerPlanningRequest): ProvisionalGrowerPlanningAssessment {
  const result = <T>(status: ProvisionalPlanningValue<T>['status'], value: T | null, issues: string[] = []): ProvisionalPlanningValue<T> =>
    ({ status, value, issues });
  const missing = <T>(...issues: string[]) => result<T>('missing-inputs', null, issues);
  const invalid = <T>(...issues: string[]) => result<T>('invalid-inputs', null, issues);
  const profile = normaliseGrowerPlanningProfile(request.profile);
  const scope = normaliseGrowerPlanningScope(request.scope);
  const area = normaliseGrowerMeasuredAreaInput(request.measuredAreaM2);
  const entry = input(request.fieldEntryDate, 'utc-date', utcDate);
  const valid = !!profile && !!scope && !!area && !!entry;
  const snapshot = valid ? freeze({ countArithmetic: GROWER_COUNT_ARITHMETIC, profile, scope,
    measuredAreaM2: area, fieldEntryDate: entry }) : null;
  const fingerprint = snapshot ? JSON.stringify(snapshot) : null;
  const emptySchedule = (issue: string) => ({ nurseryStartDate: invalid<string>(issue), firstHarvestDate: invalid<string>(issue),
    harvestEndExclusiveDate: invalid<string>(issue), fieldClearDate: invalid<string>(issue), nextFieldEntryDate: invalid<string>(issue) });
  if (!profile || !scope || !area || !entry) return freeze({ ...basis, provisional: true, status: 'invalid-inputs',
    snapshot, fingerprint, estimatedPlantCount: invalid<number>('input-shape'), budgetedStations: invalid<number>('input-shape'), estimatedYieldKg: invalid<number>('input-shape'),
    entryWindow: 'missing-date', schedule: emptySchedule('input-shape'), uncertainties: ['input-shape'] });
  if (growerPlanningScopeKey(profile.scope) !== growerPlanningScopeKey(scope)) return freeze({ ...basis, provisional: true,
    status: 'scope-mismatch', snapshot, fingerprint, estimatedPlantCount: invalid<number>('scope'), budgetedStations: invalid<number>('scope'), estimatedYieldKg: invalid<number>('scope'),
    entryWindow: 'missing-date', schedule: emptySchedule('scope'), uncertainties: ['scope'] });

  const values = profile.inputs;
  const countResult = plantCountFor(profile, area, request.countAreaBinding);
  const origin = profile.plantCountOrigin;
  let count = missing<number>(...(area.state === 'missing' ? ['measuredAreaM2'] : []),
    ...(!origin && values.plantsPerM2.state === 'missing' ? ['plantsPerM2'] : []));
  let budgetedStations = result<number>('not-applicable', null);
  if (origin) {
    budgetedStations = countResult.stations === null ? (area.state === 'missing' ? missing<number>('measuredAreaM2') : invalid<number>(countResult.issue))
      : result('ready', countResult.stations);
    count = countResult.value !== null ? result('ready', countResult.value)
      : origin.finalStand === null && countResult.stations !== null ? missing<number>('spacing-final-stand') : invalid<number>(countResult.issue);
  } else if (area.state === 'provided' && values.plantsPerM2.state === 'provided') {
    count = countResult.value === null || values.plantsPerM2.value === 0 ? invalid<number>('plantsPerM2-or-count') : result('ready', countResult.value);
  }
  let yieldKg = missing<number>(...(area.state === 'missing' ? ['measuredAreaM2'] : []),
    ...(values.yieldKgPerM2.state === 'missing' ? ['yieldKgPerM2'] : []));
  if (area.state === 'provided' && values.yieldKgPerM2.state === 'provided') {
    const value = area.value * values.yieldKgPerM2.value;
    yieldKg = Number.isFinite(value) ? result('ready', value) : invalid<number>('estimatedYieldKg');
  }
  const entryWindow = entry.state === 'missing' ? 'missing-date' : values.allowedEntryMonths.state === 'missing' ? 'unknown'
    : values.allowedEntryMonths.value.includes(Number(entry.value.slice(5, 7))) ? 'allowed' : 'excluded';
  const uncertainties: string[] = [];
  if (entryWindow === 'unknown') uncertainties.push('entry-window-unknown');
  if (values.establishment.state === 'missing') uncertainties.push('establishment-unknown');
  const offset = (start: GrowerInput<string, 'utc-date'> | ProvisionalPlanningValue<string>, daysInput: GrowerInput<number, 'days'>,
    key: string): ProvisionalPlanningValue<string> => {
    if (entryWindow === 'excluded') return result<string>('excluded', null, ['allowedEntryMonths']);
    const startValue = 'state' in start ? start.state === 'provided' ? start.value : null : start.status === 'ready' ? start.value : null;
    if (!startValue || daysInput.state === 'missing') return missing<string>(...(!startValue ? ['upstream-date'] : []),
      ...(daysInput.state === 'missing' ? [key] : []));
    const value = addDays(startValue, daysInput.value);
    return value === null ? invalid<string>('date-range') : result('ready', value);
  };
  let nurseryStartDate: ProvisionalPlanningValue<string> = missing('establishment');
  if (values.establishment.state === 'provided') {
    nurseryStartDate = values.establishment.value === 'direct' ? result<string>('not-applicable', null)
      : entry.state === 'missing' || values.nurseryDays.state === 'missing' ? missing<string>('fieldEntryDate-or-nurseryDays')
        : entryWindow === 'excluded' ? result<string>('excluded', null, ['allowedEntryMonths'])
          : (() => { const value = addDays(entry.value, -values.nurseryDays.value);
            return value === null ? invalid<string>('date-range') : result('ready', value); })();
  }
  const firstHarvestDate = offset(entry, values.fieldEntryToFirstHarvestDays, 'fieldEntryToFirstHarvestDays');
  const harvestEndExclusiveDate = values.pickingDays.state === 'provided' && values.pickingDays.value === 0
    ? invalid<string>('pickingDays') : offset(firstHarvestDate, values.pickingDays, 'pickingDays');
  let fieldClearDate = offset(entry, values.fieldOccupancyDays, 'fieldOccupancyDays');
  if (values.fieldOccupancyDays.state === 'provided') {
    const first = values.fieldEntryToFirstHarvestDays, picking = values.pickingDays;
    if (values.fieldOccupancyDays.value === 0 || (first.state === 'provided' && picking.state === 'provided'
      && (!Number.isSafeInteger(first.value + picking.value) || values.fieldOccupancyDays.value < first.value + picking.value))) {
      fieldClearDate = invalid<string>('fieldOccupancyDays');
    } else if (first.state === 'missing' || picking.state === 'missing') uncertainties.push('occupancy-compatibility-unknown');
  }
  const nextFieldEntryDate = offset(fieldClearDate, values.turnaroundDays, 'turnaroundDays');
  const schedule = { nurseryStartDate, firstHarvestDate, harvestEndExclusiveDate, fieldClearDate, nextFieldEntryDate };
  const components = [count, yieldKg, ...Object.values(schedule)];
  const complete = components.every(value => value.status === 'ready' || value.status === 'not-applicable') && entryWindow === 'allowed';
  return freeze({ ...basis, provisional: true, status: complete ? 'ready' : components.some(value => value.status === 'ready') ? 'partial-ready' : 'held',
    snapshot, fingerprint, estimatedPlantCount: count, budgetedStations, estimatedYieldKg: yieldKg, entryWindow, schedule, uncertainties });
}

/** Arithmetic readiness does not certify suitability, legality, source truth or a harvest.
 * No country-policy authority is called or overridden by this independent calculation. */
export function assessGrowerPlanning(request: GrowerPlanningRequest): GrowerPlanningAssessment {
  const profile = normaliseGrowerPlanningProfile(request.profile);
  const scope = normaliseGrowerPlanningScope(request.scope);
  const measuredAreaM2 = normaliseGrowerMeasuredAreaInput(request.measuredAreaM2);
  const fieldEntryDate = input(request.fieldEntryDate, 'utc-date', utcDate);
  const invalid = [!profile && 'profile', !scope && 'scope', !measuredAreaM2 && 'measuredAreaM2', !fieldEntryDate && 'fieldEntryDate'].filter(Boolean) as string[];
  if (!profile || !scope || !measuredAreaM2 || !fieldEntryDate) {
    return freeze({ ...basis, status: 'invalid-inputs', issues: invalid, snapshot: null, fingerprint: null });
  }
  // Normalisation constructs fresh objects in canonical field order. Unordered month
  // selections are sorted; editing input values/provenance cannot mutate this review.
  const snapshot = freeze({ countArithmetic: GROWER_COUNT_ARITHMETIC, profile, scope, measuredAreaM2, fieldEntryDate });
  const fingerprint = JSON.stringify(snapshot);
  const held = (status: 'missing-inputs' | 'invalid-inputs' | 'scope-mismatch' | 'entry-window-excluded', issues: string[]): GrowerPlanningAssessment =>
    freeze({ ...basis, status, issues, snapshot, fingerprint });
  if (growerPlanningScopeKey(profile.scope) !== growerPlanningScopeKey(scope)) return held('scope-mismatch', ['scope']);
  const values = profile.inputs;
  const required: Array<[string, GrowerInput<unknown, string>]> = Object.entries(values).filter(([key]) => key !== 'nurseryDays' && !(profile.plantCountOrigin && key === 'plantsPerM2'));
  required.push(['measuredAreaM2', measuredAreaM2], ['fieldEntryDate', fieldEntryDate]);
  if (values.establishment.state === 'provided' && values.establishment.value === 'transplant') required.push(['nurseryDays', values.nurseryDays]);
  const missing = required.filter(([, value]) => value.state === 'missing').map(([key]) => key);
  if (profile.plantCountOrigin?.finalStand === null) missing.push('spacing-final-stand');
  if (missing.length) return held('missing-inputs', missing);
  // All required values were checked together so callers receive the complete missing list.
  const supplied = <T, U extends string>(value: GrowerInput<T, U>): T => {
    if (value.state !== 'provided') throw new Error('Required grower input is missing');
    return value.value;
  };
  const area = supplied(measuredAreaM2), density = profile.plantCountOrigin ? null : supplied(values.plantsPerM2), yieldPerM2 = supplied(values.yieldKgPerM2);
  const toFirst = supplied(values.fieldEntryToFirstHarvestDays), picking = supplied(values.pickingDays);
  const occupancy = supplied(values.fieldOccupancyDays), turnaround = supplied(values.turnaroundDays);
  const invalidArithmetic: string[] = [];
  if (density === 0) invalidArithmetic.push('plantsPerM2');
  if (picking === 0) invalidArithmetic.push('pickingDays');
  if (occupancy === 0 || !Number.isSafeInteger(toFirst + picking) || occupancy < toFirst + picking) invalidArithmetic.push('fieldOccupancyDays');
  const countResult = plantCountFor(profile, measuredAreaM2, request.countAreaBinding);
  const estimatedPlantCount = countResult.value, estimatedYieldKg = area * yieldPerM2;
  if (estimatedPlantCount === null) invalidArithmetic.push(countResult.issue);
  if (!Number.isFinite(estimatedYieldKg)) invalidArithmetic.push('estimatedYieldKg');
  if (invalidArithmetic.length || estimatedPlantCount === null) return held('invalid-inputs', invalidArithmetic);
  const entryDate = supplied(fieldEntryDate);
  if (!supplied(values.allowedEntryMonths).includes(Number(entryDate.slice(5, 7)))) return held('entry-window-excluded', ['allowedEntryMonths']);
  const nurseryStartDate = supplied(values.establishment) === 'transplant' ? addDays(entryDate, -supplied(values.nurseryDays)) : null;
  const firstHarvestDate = addDays(entryDate, toFirst);
  const harvestEndExclusiveDate = firstHarvestDate ? addDays(firstHarvestDate, picking) : null;
  const fieldClearDate = addDays(entryDate, occupancy);
  const nextFieldEntryDate = fieldClearDate ? addDays(fieldClearDate, turnaround) : null;
  if ((supplied(values.establishment) === 'transplant' && !nurseryStartDate)
    || !firstHarvestDate || !harvestEndExclusiveDate || !fieldClearDate || !nextFieldEntryDate) return held('invalid-inputs', ['date-range']);
  return freeze({ ...basis, status: 'ready', snapshot, fingerprint,
    capacity: { measuredAreaM2: area, estimatedPlantCount, estimatedYieldKg,
      ...(countResult.stations !== null ? { budgetedStations: countResult.stations } : {}), densityEstimateNotLayoutClearance: true },
    schedule: { fieldEntryDate: entryDate, nurseryStartDate, firstHarvestDate, harvestEndExclusiveDate, fieldClearDate, nextFieldEntryDate } });
}

/** Reassess immediately before accepting/exporting a result: both scope and assumptions
 * may have changed while a review was open. A timestamp or crop identity alone is insufficient. */
export function isGrowerPlanningAssessmentCurrent(assessment: GrowerPlanningAssessment, request: GrowerPlanningRequest): boolean {
  if (assessment.status !== 'ready') return false;
  const current = assessGrowerPlanning(request);
  return current.status === 'ready' && assessment.fingerprint === current.fingerprint;
}
