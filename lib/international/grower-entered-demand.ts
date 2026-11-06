import { rawJsonIsLossless } from '../lossless-json';
import { MASS_QUANTITY_ENTRY_MAX_TEXT, readMassQuantityEntry, type MassQuantityEntry } from '../mass-units';
import { GROWER_AUTOPLAN_MAX_ASSESSMENTS, type GrowerAutoPlanDemand, type GrowerUtcWindow } from './grower-autoplan';
import {
  growerPlanningScopeKey, isGrowerRecordedAt, isGrowerUtcDate, normaliseGrowerInput,
  normaliseGrowerPlanningProfile, normaliseGrowerPlanningProfiles, normaliseGrowerPlanningScope,
  type GrowerInputProvenance, type GrowerPlanningProfile,
} from './grower-planning';

/** Reuse the engine's assessment ceiling instead of inventing a second row
 * limit. Reaching this software bound holds the review; it never trims rows. */
export const GROWER_DEMAND_SELECTION_MAX_ROWS = GROWER_AUTOPLAN_MAX_ASSESSMENTS;
/** Representation guard only, not a farming quantity limit. The decimal
 * round-trip check below separately rejects fractional precision loss. */
const MAX_REPRESENTABLE_KG = Number.MAX_SAFE_INTEGER;
const MAX_KG_TEXT = MASS_QUANTITY_ENTRY_MAX_TEXT;
const MAX_KG_DECIMALS = 6;
const MAX_ENTRY_ID = 120;

/** Engine demand namespace. Rows carrying it are never buyer harvest targets. */
export const GROWER_ENTERED_DEMAND_ID_PREFIX = 'grower-entered:';

export type GrowerEnteredDemandPurpose = 'household' | 'trial';

/** One editor row exactly as entered. Quantity and dates stay text so a blank
 * ('' = not entered) can never be confused with a known zero ('0'). */
interface GrowerEnteredDemandEntryFields {
  readonly kind: 'grower-entered';
  /** Editor identity chosen once per row; not a buyer, outlet or harvest-target identity. */
  readonly entryId: string;
  readonly purpose: GrowerEnteredDemandPurpose;
  /** Existing catalogue identity the grower chose; must equal the chosen profile's crop. */
  readonly cropKey: string;
  readonly profileId: string;
  /** Inclusive UTC start date, or '' when not entered. */
  readonly harvestStart: string;
  /** Exclusive UTC end date, or '' when not entered. */
  readonly harvestEndExclusive: string;
}
export type GrowerEnteredDemandEntry = GrowerEnteredDemandEntryFields & (
  | { readonly grossKg: string; readonly quantityEntry?: never }
  | { readonly grossKg?: never; readonly quantityEntry: MassQuantityEntry }
);

export interface GrowerEnteredDemandMetadata {
  readonly demandId: string;
  readonly entryId: string;
  readonly purpose: GrowerEnteredDemandPurpose;
  readonly cropKey: string;
  readonly profileId: string;
  /** null = not entered. 0 = an explicit known zero. */
  readonly grossCapacityKg: number | null;
  /** Actual authored entry, never reconstructed from converted kg or display. */
  readonly quantityEntry: MassQuantityEntry;
  readonly harvestWindow: GrowerUtcWindow | null;
  readonly quantityBasis: 'grower-entered-gross-cycle-capacity';
  readonly buyer: 'none';
  readonly saleableOutput: 'not-applicable';
  readonly nutritionSufficiency: 'not-assessed';
  readonly agronomicEvidence: 'not-established';
  readonly sourceVerification: 'not-verified';
}

export interface GrowerEnteredDemandRow {
  readonly entryId: string;
  readonly demand: GrowerAutoPlanDemand;
  readonly profile: GrowerPlanningProfile;
  readonly metadata: GrowerEnteredDemandMetadata;
}

export type GrowerEnteredDemand =
  | { readonly status: 'held'; readonly reasons: readonly string[] }
  | ({ readonly status: 'ready' } & GrowerEnteredDemandRow);

export type GrowerEnteredDemandSet =
  | { readonly status: 'held'; readonly reasons: readonly string[]; readonly entryIndex: number | null }
  | { readonly status: 'ready'; readonly rows: readonly GrowerEnteredDemandRow[] };

const ENTRY_KEYS = ['kind', 'entryId', 'purpose', 'cropKey', 'profileId', 'grossKg', 'quantityEntry', 'harvestStart', 'harvestEndExclusive'] as const;
type EntryFields = Record<(typeof ENTRY_KEYS)[number], unknown>;

const NOTES: Record<GrowerEnteredDemandPurpose, string> = {
  household: 'Grower-entered household gross harvest weight (kg, whole window) for this review. Not a nutrition or food-security sufficiency assessment, a buyer, a sale or an observed harvest.',
  trial: 'Grower-entered trial gross harvest weight (kg, whole window) for this review. A trial label is not agronomic evidence, a suitability or safety finding, or an approval.',
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
}
function entryIdentity(value: unknown): value is string {
  return identity(value) && value.length <= MAX_ENTRY_ID && value === value.trim();
}
const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const utcWindow = (value: unknown): value is GrowerUtcWindow => record(value)
  && isGrowerUtcDate(value.start) && isGrowerUtcDate(value.endExclusive) && value.start < value.endExclusive;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/** Read every field once from a plain data record. An accessor could answer
 * differently between validation and use, and an unknown key (a buyer link,
 * price or outlet) has no meaning on a grower-entered row, so both hold. */
function readEntry(value: unknown): { status: 'ready'; fields: EntryFields } | { status: 'held'; reason: string } {
  if (!record(value)) return { status: 'held', reason: 'entry-unreadable' };
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return { status: 'held', reason: 'entry-unreadable' };
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (descriptors.grossKg && descriptors.quantityEntry) return { status: 'held', reason: 'quantity-entry-conflict' };
  if (descriptors.quantityEntry && !descriptors.quantityEntry.enumerable) return { status: 'held', reason: 'entry-unreadable' };
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !(ENTRY_KEYS as readonly string[]).includes(key))) {
    return { status: 'held', reason: 'entry-shape-invalid' };
  }
  const fields = {} as EntryFields;
  for (const key of ENTRY_KEYS) {
    const property = descriptors[key];
    if (property && !('value' in property)) return { status: 'held', reason: 'entry-unreadable' };
    fields[key] = property?.value;
  }
  return { status: 'ready', fields };
}

type Parsed<T> = { status: 'provided'; value: T } | { status: 'missing' } | { status: 'held'; reason: string };

/** Plain decimal kilograms only. Signs, exponents, locale separators and
 * display units are not converted here; that stays a separate reviewed boundary. */
function parseGrossKg(value: unknown): Parsed<number> {
  if (typeof value !== 'string') return { status: 'held', reason: 'gross-kg-invalid' };
  if (value.length > MAX_KG_TEXT) return { status: 'held', reason: 'gross-kg-format' };
  const text = value.trim();
  if (!text) return { status: 'missing' };
  if (/^-\s*\d/.test(text)) return { status: 'held', reason: 'gross-kg-negative' };
  if (!/^\d+(?:\.\d+)?$/.test(text)) return { status: 'held', reason: 'gross-kg-format' };
  if ((text.split('.')[1] ?? '').length > MAX_KG_DECIMALS) return { status: 'held', reason: 'gross-kg-precision' };
  const kg = Number(text);
  if (!Number.isFinite(kg) || kg > MAX_REPRESENTABLE_KG) return { status: 'held', reason: 'gross-kg-range' };
  // The saved snapshot promises the original request, not Number's rounded
  // replacement. Reuse the raw-number authority after allowing form zero padding.
  if (!rawJsonIsLossless(text.replace(/^0+(?=\d)/, ''))) return { status: 'held', reason: 'gross-kg-representation-loss' };
  return { status: 'provided', value: kg };
}

function parseHarvestWindow(start: unknown, endExclusive: unknown): Parsed<GrowerUtcWindow> {
  if (typeof start !== 'string' || typeof endExclusive !== 'string') return { status: 'held', reason: 'harvest-window-invalid' };
  if (!start && !endExclusive) return { status: 'missing' };
  if (!start || !endExclusive) return { status: 'held', reason: 'harvest-window-incomplete' };
  if (!isGrowerUtcDate(start) || !isGrowerUtcDate(endExclusive) || start >= endExclusive) {
    return { status: 'held', reason: 'harvest-window-invalid' };
  }
  return { status: 'provided', value: { start, endExclusive } };
}

export function growerEnteredDemandId(entryId: string): string {
  return `${GROWER_ENTERED_DEMAND_ID_PREFIX}${entryId}`;
}

/** Convert one grower-entered row into an engine kg-total demand. Missing stays
 * missing for the engine to report; nothing is borrowed from a catalogue, a
 * buyer target or a country profile. A ready demand is not a ready crop plan. */
export function growerDemandFromEnteredEntry(request: {
  readonly entry: unknown; readonly profile: unknown; readonly scope: unknown; readonly recordedAt: unknown;
}): GrowerEnteredDemand {
  const held = (...reasons: string[]): GrowerEnteredDemand => freeze({ status: 'held', reasons: [...new Set(reasons)] });
  try {
    const scope = normaliseGrowerPlanningScope(request.scope);
    if (!scope || scope.kind !== 'mapped-site') return held('mapped-site-required');
    if (!isGrowerRecordedAt(request.recordedAt)) return held('review-time-invalid');
    const read = readEntry(request.entry);
    if (read.status === 'held') return held(read.reason);
    const entry = read.fields;
    if (entry.kind !== 'grower-entered') return held('entry-kind-invalid');
    if (!entryIdentity(entry.entryId)) return held('entry-id-invalid');
    if (!identity(entry.profileId)) return held('profile-required');
    if (!identity(entry.cropKey)) return held('crop-required');
    const profile = normaliseGrowerPlanningProfile(request.profile);
    if (!profile) return held('profile-invalid');
    if (profile.profileId !== entry.profileId) return held('profile-identity-mismatch');
    if (growerPlanningScopeKey(profile.scope) !== growerPlanningScopeKey(scope)) return held('scope-mismatch');
    if (profile.cropKey !== entry.cropKey) return held('crop-identity-mismatch');
    const reasons: string[] = [];
    const purpose = entry.purpose === 'household' || entry.purpose === 'trial' ? entry.purpose : null;
    if (!purpose) reasons.push('purpose-invalid');
    const mass = Object.hasOwn(request.entry as object, 'quantityEntry') ? readMassQuantityEntry(entry.quantityEntry) : null;
    let quantity: Parsed<number> = mass
      ? mass.status === 'held' ? mass : mass.status === 'missing' ? { status: 'missing' } : { status: 'provided', value: mass.kilograms }
      : parseGrossKg(entry.grossKg);
    if (mass?.status === 'provided' && (mass.kilograms < 0 || mass.kilograms > MAX_REPRESENTABLE_KG)) {
      quantity = { status: 'held', reason: mass.kilograms < 0 ? 'gross-kg-negative' : 'gross-kg-range' };
    }
    if (quantity.status === 'held') reasons.push(quantity.reason);
    const window = parseHarvestWindow(entry.harvestStart, entry.harvestEndExclusive);
    if (window.status === 'held') reasons.push(window.reason);
    if (reasons.length || !purpose || quantity.status === 'held' || window.status === 'held') return held(...reasons);
    const quantityEntry: MassQuantityEntry = mass && mass.status !== 'held' ? mass.entry : { unit: 'kg', text: entry.grossKg as string };
    const provenance: GrowerInputProvenance = { kind: 'grower-estimate', recordedAt: request.recordedAt, note: NOTES[purpose] };
    const knownZero = quantity.status === 'provided' && quantity.value === 0;
    // Re-parse through the shared input authority, so provenance/unit rules stay single-sourced.
    const totalKg = normaliseGrowerInput(quantity.status === 'provided'
      ? { state: 'provided', value: quantity.value, unit: 'kg-total', provenance }
      : { state: 'missing', reason: 'not-entered' }, 'kg-total', nonNegative);
    const harvestWindow = normaliseGrowerInput(window.status === 'provided'
      ? { state: 'provided', value: { ...window.value }, unit: 'utc-date-window', provenance }
      // A known zero needs no window; a blank window for unknown or positive demand stays not-entered.
      : { state: 'missing', reason: knownZero ? 'not-applicable' : 'not-entered' }, 'utc-date-window', utcWindow);
    if (!totalKg || !harvestWindow) return held('entry-unrepresentable');
    const demandId = growerEnteredDemandId(entry.entryId);
    const demand: GrowerAutoPlanDemand = { demandId, profileId: profile.profileId, scope, totalKg,
      harvestWindow: harvestWindow.state === 'provided'
        ? { ...harvestWindow, value: { start: harvestWindow.value.start, endExclusive: harvestWindow.value.endExclusive } } : harvestWindow };
    const metadata: GrowerEnteredDemandMetadata = { demandId, entryId: entry.entryId, purpose, cropKey: profile.cropKey,
      profileId: profile.profileId, grossCapacityKg: totalKg.state === 'provided' ? totalKg.value : null, quantityEntry,
      harvestWindow: window.status === 'provided' ? { ...window.value } : null,
      quantityBasis: 'grower-entered-gross-cycle-capacity', buyer: 'none', saleableOutput: 'not-applicable',
      nutritionSufficiency: 'not-assessed', agronomicEvidence: 'not-established', sourceVerification: 'not-verified' };
    return freeze({ status: 'ready', entryId: entry.entryId, demand, profile, metadata });
  } catch { return held('entry-unreadable'); }
}

/** Convert all grower-entered rows of one review. Identity questions are
 * answered over the whole set first, so array order never chooses a winner.
 * `reservedDemandIds` must list every buyer-target identity in the book,
 * selected or not, damaged or duplicated; a namespaced entry that matches one
 * holds rather than silently becoming (or shadowing) a buyer target. */
export function growerDemandsFromEnteredEntries(request: {
  readonly entries: unknown; readonly profiles: unknown; readonly scope: unknown; readonly recordedAt: unknown;
  readonly reservedDemandIds?: Iterable<unknown>;
}): GrowerEnteredDemandSet {
  const held = (entryIndex: number | null, ...reasons: string[]): GrowerEnteredDemandSet =>
    freeze({ status: 'held', reasons: [...new Set(reasons)], entryIndex });
  try {
    const scope = normaliseGrowerPlanningScope(request.scope);
    if (!scope || scope.kind !== 'mapped-site') return held(null, 'mapped-site-required');
    if (!isGrowerRecordedAt(request.recordedAt)) return held(null, 'review-time-invalid');
    const entries = request.entries, rawProfiles = request.profiles;
    if (!Array.isArray(entries)) return held(null, 'entries-invalid');
    if (entries.length > GROWER_DEMAND_SELECTION_MAX_ROWS) return held(null, 'entry-row-limit');
    if (!Array.isArray(rawProfiles) || rawProfiles.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return held(null, 'profiles-invalid');
    const reserved = new Set<string>();
    let reservedCount = 0;
    for (const id of request.reservedDemandIds ?? []) {
      if (++reservedCount > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return held(null, 'reserved-identities-limit');
      if (typeof id === 'string') reserved.add(id);
    }
    const profileCounts = new Map<string, number>();
    for (const row of rawProfiles) {
      if (record(row) && typeof row.profileId === 'string') profileCounts.set(row.profileId, (profileCounts.get(row.profileId) ?? 0) + 1);
    }
    const profiles = normaliseGrowerPlanningProfiles(rawProfiles);
    const reads = entries.map(readEntry);
    const entryCounts = new Map<string, number>();
    for (const read of reads) {
      if (read.status === 'ready' && typeof read.fields.entryId === 'string') {
        entryCounts.set(read.fields.entryId, (entryCounts.get(read.fields.entryId) ?? 0) + 1);
      }
    }
    const rows: GrowerEnteredDemandRow[] = [];
    for (let index = 0; index < entries.length; index++) {
      const read = reads[index];
      if (read.status === 'held') return held(index, read.reason);
      const { entryId, profileId } = read.fields;
      if (read.fields.kind !== 'grower-entered') return held(index, 'entry-kind-invalid');
      if (!entryIdentity(entryId)) return held(index, 'entry-id-invalid');
      if (entryCounts.get(entryId) !== 1) return held(index, 'entry-ambiguous');
      if (reserved.has(growerEnteredDemandId(entryId))) return held(index, 'demand-id-collision');
      if (identity(profileId)) {
        const count = profileCounts.get(profileId) ?? 0;
        if (count > 1) return held(index, 'profile-ambiguous');
        if (count === 0) return held(index, 'profile-missing');
      }
      const profile = identity(profileId) ? profiles.find(row => row.profileId === profileId) ?? null : null;
      const converted = growerDemandFromEnteredEntry({ entry: entries[index], profile, scope, recordedAt: request.recordedAt });
      if (converted.status === 'held') return held(index, ...converted.reasons);
      rows.push({ entryId: converted.entryId, demand: converted.demand, profile: converted.profile, metadata: converted.metadata });
    }
    return freeze({ status: 'ready', rows });
  } catch { return held(null, 'entries-unreadable'); }
}
