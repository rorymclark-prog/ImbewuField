/** International foot, not the former U.S. survey foot. NIST SP 811 B.8
 * prints 3.048 E-01 m in bold (exact):
 * https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
 * Supplied primary body verified 2026-11-03. No crop or country inference. */
export const INTERNATIONAL_FOOT_IN_METRES = 0.3048;
export type LengthUnit = 'm' | 'ft';

function supported(unit: unknown): unit is LengthUnit { return unit === 'm' || unit === 'ft'; }
function representable(before: number, after: number): number | null {
  return Number.isFinite(before) && Number.isFinite(after) && (before === 0 || after !== 0) ? after : null;
}
export function lengthToMetres(value: number, unit: LengthUnit): number | null {
  if (!supported(unit) || !Number.isFinite(value)) return null;
  return unit === 'm' ? value : representable(value, value * INTERNATIONAL_FOOT_IN_METRES);
}
export function metresToLength(value: number, unit: LengthUnit): number | null {
  if (!supported(unit) || !Number.isFinite(value)) return null;
  return unit === 'm' ? value : representable(value, value / INTERNATIONAL_FOOT_IN_METRES);
}

export type LengthDecimal =
  | { readonly status: 'ready'; readonly value: number }
  | { readonly status: 'incomplete' | 'invalid'; readonly reason: 'incomplete-number' | 'plain-decimal-required' | 'outside-finite-range' };
/** Dot OR comma is explicitly a decimal separator. Neither is a grouping mark.
 * Signs belong to numeric entry; whether a length/path is permitted belongs
 * to the caller's existing geometry authority. This does not parse angles. */
export function parseLengthDecimal(text: string): LengthDecimal {
  if (typeof text !== 'string') return { status: 'invalid', reason: 'plain-decimal-required' };
  const raw = text.trim();
  if (/^[+-]?[.,]?$/.test(raw)) return { status: 'incomplete', reason: 'incomplete-number' };
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(raw)) return { status: 'invalid', reason: 'plain-decimal-required' };
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value === 0 && /[1-9]/.test(raw)) return { status: 'invalid', reason: 'outside-finite-range' };
  return { status: 'ready', value };
}

function plainDecimal(raw: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(raw);
  if (!match) return raw;
  const digits = match[2] + (match[3] ?? ''), point = match[2].length + Number(match[4]);
  return match[1] + (point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`);
}
/** Six decimal places are presentation precision, never saved precision. Very
 * small nonzero values use a plain decimal rather than a misleading zero. */
export function formatLengthMetres(metres: number, unit: LengthUnit): string | null {
  const value = metresToLength(metres, unit); if (value === null) return null;
  return formatFiniteDimension(value);
}
function formatFiniteDimension(value: number): string {
  const rounded = value.toFixed(6);
  const plain = plainDecimal(Number(rounded) === 0 && value !== 0 ? String(value) : rounded);
  return plain.includes('.') ? plain.replace(/0+$/, '').replace(/\.$/, '') : plain;
}

export type LengthDraftField = Readonly<{
  text: string;
  inputUnit: LengthUnit;
  edited: boolean;
} & ({ status: 'ready'; canonicalMetres: number }
  | { status: 'incomplete' | 'invalid'; canonicalMetres: null; reason: string })>;
export interface LengthDraft<K extends string> {
  readonly sourceKey: string;
  readonly unit: LengthUnit;
  readonly originalMetres: Readonly<Record<K, number>>;
  readonly fields: Readonly<Record<K, LengthDraftField>>;
}
export type LengthDraftRead<K extends string> =
  | { readonly status: 'ready'; readonly metres: Readonly<Record<K, number>> }
  | { readonly status: 'held'; readonly reason: string; readonly fields?: readonly K[] };
export type LengthDraftSwitch<K extends string> =
  | { readonly status: 'ready'; readonly draft: LengthDraft<K> }
  | { readonly status: 'held'; readonly reason: string; readonly draft: LengthDraft<K> };

type StagedDimension = { status: 'ready'; canonical: number | undefined }
  | { status: 'incomplete' | 'invalid'; reason: string };
function stageDimension(text: string, convert: (value: number) => number | null, optionalBlank = false, nonnegative = false): StagedDimension {
  if (optionalBlank && typeof text === 'string' && !text.trim()) return { status: 'ready', canonical: undefined };
  const parsed = parseLengthDecimal(text);
  if (parsed.status !== 'ready') return parsed;
  const canonical = convert(parsed.value);
  return canonical === null || nonnegative && canonical < 0 ? { status: 'invalid', reason: 'outside-finite-range' }
    : { status: 'ready', canonical };
}
function fieldFromMetres(metres: number, unit: LengthUnit, edited: boolean): LengthDraftField {
  const text = formatLengthMetres(metres, unit);
  return Object.freeze(text === null ? { text: '', inputUnit: unit, edited, status: 'invalid', canonicalMetres: null, reason: 'outside-finite-range' }
    : { text, inputUnit: unit, edited, status: 'ready', canonicalMetres: metres });
}
function frozenDraft<K extends string>(draft: LengthDraft<K>): LengthDraft<K> {
  return Object.freeze({ ...draft, fields: Object.freeze(draft.fields) });
}
/** Snapshot numbers, not a mutable geometry reference. The source key is supplied
 * by the caller from its actual selection/source identity, never inferred here. */
export function createLengthDraft<K extends string>({ sourceKey, unit, metres }: {
  sourceKey: string; unit: LengthUnit; metres: Readonly<Record<K, number>>;
}): LengthDraft<K> {
  const originalMetres = Object.freeze({ ...metres });
  const fields = Object.fromEntries((Object.keys(originalMetres) as K[]).map(key => [key, fieldFromMetres(originalMetres[key], unit, false)])) as Record<K, LengthDraftField>;
  return frozenDraft({ sourceKey, unit, originalMetres, fields });
}
/** A valid edited entry is converted once and staged. Later preview/toggle/apply
 * reads that canonical number; rounded display text is never its authority. */
export function editLengthDraft<K extends string>(draft: LengthDraft<K>, key: NoInfer<K>, text: string): LengthDraft<K> {
  if (!Object.hasOwn(draft.fields, key)) throw Error('Unknown length field');
  if (text === draft.fields[key].text) return draft;
  const staged = stageDimension(text, value => lengthToMetres(value, draft.unit));
  const field: LengthDraftField = Object.freeze(staged.status !== 'ready'
    ? { text, inputUnit: draft.unit, edited: true, status: staged.status, canonicalMetres: null, reason: staged.reason }
    : { text, inputUnit: draft.unit, edited: true, status: 'ready', canonicalMetres: staged.canonical! });
  return frozenDraft({ ...draft, fields: { ...draft.fields, [key]: field } });
}
export function readLengthDraft<K extends string>(draft: LengthDraft<K>, currentSourceKey: string): LengthDraftRead<K> {
  if (draft.sourceKey !== currentSourceKey) return { status: 'held', reason: 'source-changed' };
  if (!supported(draft.unit)) return { status: 'held', reason: 'unsupported-unit' };
  const keys = Object.keys(draft.originalMetres) as K[];
  if (keys.length !== Object.keys(draft.fields).length || keys.some(key => !Object.hasOwn(draft.fields, key))) return { status: 'held', reason: 'fields-changed' };
  const mixed = keys.filter(key => draft.fields[key].inputUnit !== draft.unit);
  if (mixed.length) return { status: 'held', reason: 'mixed-units', fields: Object.freeze(mixed) };
  const invalid = keys.filter(key => draft.fields[key].status !== 'ready' || !Number.isFinite(draft.fields[key].canonicalMetres));
  if (invalid.length) return { status: 'held', reason: 'unfinished-lengths', fields: Object.freeze(invalid) };
  return { status: 'ready', metres: Object.freeze(Object.fromEntries(keys.map(key => [key, draft.fields[key].canonicalMetres])) as Record<K, number>) };
}
export function switchLengthDraftUnit<K extends string>(draft: LengthDraft<K>, nextUnit: LengthUnit, currentSourceKey: string): LengthDraftSwitch<K> {
  if (!supported(nextUnit)) return { status: 'held', reason: 'unsupported-unit', draft };
  const read = readLengthDraft(draft, currentSourceKey);
  if (read.status !== 'ready') return { status: 'held', reason: read.reason, draft };
  if (nextUnit === draft.unit) return { status: 'ready', draft };
  const fields = Object.fromEntries((Object.keys(draft.fields) as K[]).map(key => [key, fieldFromMetres(read.metres[key], nextUnit, draft.fields[key].edited)])) as Record<K, LengthDraftField>;
  if (Object.values<LengthDraftField>(fields).some(field => field.status !== 'ready')) return { status: 'held', reason: 'outside-finite-range', draft };
  return { status: 'ready', draft: frozenDraft({ ...draft, unit: nextUnit, fields }) };
}


/** NIST SP 811 B.8/B.9 print these international inch/area rows in bold
 * (exact). Centimetres follow 0.0254 m × 100 cm/m, also corroborated by the
 * printed inch→centimetre row. Inverse arithmetic is derived, not a new fact.
 * Primary bodies and receipt digests were checked on 2026-11-03. */
export const INTERNATIONAL_INCH_IN_METRES = 0.0254;
export const INTERNATIONAL_INCH_IN_CENTIMETRES = INTERNATIONAL_INCH_IN_METRES * 100;
export const INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES = 0.09290304;
export type NurseryDimensionUnit = 'cm' | 'in' | 'm2' | 'ft2';
type NurseryDimensionKind = 'tray-length' | 'surface-area';
function nurseryKind(unit: unknown): NurseryDimensionKind | null {
  return unit === 'cm' || unit === 'in' ? 'tray-length' : unit === 'm2' || unit === 'ft2' ? 'surface-area' : null;
}
/** Canonical centimetres for tray lengths, square metres for usable surface.
 * Bounds such as a positive paired tray footprint remain nursery-settings rules. */
export function nurseryDimensionToCanonical(value: number, unit: NurseryDimensionUnit): number | null {
  if (!nurseryKind(unit) || !Number.isFinite(value)) return null;
  return unit === 'in' ? representable(value, value * INTERNATIONAL_INCH_IN_CENTIMETRES)
    : unit === 'ft2' ? representable(value, value * INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES) : value;
}
export function canonicalToNurseryDimension(value: number, unit: NurseryDimensionUnit): number | null {
  if (!nurseryKind(unit) || !Number.isFinite(value)) return null;
  return unit === 'in' ? representable(value, value / INTERNATIONAL_INCH_IN_CENTIMETRES)
    : unit === 'ft2' ? representable(value, value / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES) : value;
}
export function formatNurseryDimension(value: number, unit: NurseryDimensionUnit): string | null {
  const converted = canonicalToNurseryDimension(value, unit);
  return converted === null ? null : formatFiniteDimension(converted);
}
/** A closed unit facade supplies conversion facts and family/blank policy.
 * Drafts remain numeric entry evidence, never actor or write authorisation. */
export interface CanonicalUnitSpec<U extends string, F extends string> {
  readonly kind: (unit: unknown) => F | null;
  readonly toCanonical: (value: number, unit: U) => number | null;
  readonly fromCanonical: (value: number, unit: U) => number | null;
  readonly optional: (kind: F | null) => boolean;
  readonly nonnegative: (kind: F | null) => boolean;
  readonly pristineBlankSwitch: (kind: F | null) => boolean;
}
export type CanonicalUnitDraftField<U extends string> = Readonly<{
  text: string; inputUnit: U; edited: boolean;
} & ({ status: 'ready'; canonicalValue: number | undefined }
  | { status: 'incomplete' | 'invalid'; canonicalValue: null; reason: string })>;
export interface CanonicalUnitDraft<K extends string, U extends string, F extends string> {
  readonly sourceKey: string;
  readonly kind: F | null;
  readonly unit: U;
  readonly originalCanonical: Readonly<Record<K, number | undefined>>;
  readonly optionalFields: readonly K[];
  readonly fields: Readonly<Record<K, CanonicalUnitDraftField<U>>>;
}
export type CanonicalUnitDraftRead<K extends string> =
  | { readonly status: 'ready'; readonly values: Readonly<Record<K, number | undefined>> }
  | { readonly status: 'held'; readonly reason: string; readonly fields?: readonly K[] };
export type CanonicalUnitDraftSwitch<D> =
  | { readonly status: 'ready'; readonly draft: D }
  | { readonly status: 'held'; readonly reason: string; readonly draft: D };
export function representableUnitValue(before: number, after: number): number | null { return representable(before, after); }
export function formatCanonicalUnitValue<U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, value: number, unit: U): string | null {
  const converted = spec.fromCanonical(value, unit);
  return converted === null ? null : formatFiniteDimension(converted);
}
function canonicalField<U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, value: number | undefined, unit: U, optional: boolean, edited: boolean): CanonicalUnitDraftField<U> {
  const kind = spec.kind(unit);
  if (value === undefined && optional && spec.optional(kind)) return Object.freeze({ text: '', inputUnit: unit, edited, status: 'ready', canonicalValue: undefined });
  const text = value === undefined ? null : formatCanonicalUnitValue(spec, value, unit);
  if (text === null || spec.nonnegative(kind) && value! < 0) return Object.freeze({ text: '', inputUnit: unit, edited, status: 'invalid', canonicalValue: null, reason: value === undefined ? 'required-dimension' : 'outside-finite-range' });
  return Object.freeze({ text, inputUnit: unit, edited, status: 'ready', canonicalValue: value });
}
function frozenCanonicalDraft<D extends { readonly fields: object }>(draft: D): D {
  return Object.freeze({ ...draft, fields: Object.freeze(draft.fields) });
}
export function createCanonicalUnitDraft<K extends string, U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, { sourceKey, unit, values, optionalFields = [] }: {
  sourceKey: string; unit: U; values: Readonly<Record<K, number | undefined>>; optionalFields?: readonly K[];
}): CanonicalUnitDraft<K, U, F> {
  const originalCanonical = Object.freeze({ ...values }), optional = Object.freeze([...optionalFields]);
  const fields = Object.fromEntries((Object.keys(originalCanonical) as K[]).map(key => [key, canonicalField(spec, originalCanonical[key], unit, optional.includes(key), false)])) as Record<K, CanonicalUnitDraftField<U>>;
  return frozenCanonicalDraft({ sourceKey, kind: spec.kind(unit), unit, originalCanonical, optionalFields: optional, fields });
}
export function editCanonicalUnitDraft<K extends string, U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, draft: CanonicalUnitDraft<K, U, F>, key: NoInfer<K>, text: string): CanonicalUnitDraft<K, U, F> {
  if (!Object.hasOwn(draft.fields, key)) throw Error('Unknown nursery dimension field');
  if (text === draft.fields[key].text) return draft;
  const staged = stageDimension(text, value => spec.toCanonical(value, draft.unit),
    spec.optional(draft.kind) && draft.optionalFields.includes(key), spec.nonnegative(draft.kind));
  const field: CanonicalUnitDraftField<U> = Object.freeze(staged.status !== 'ready'
    ? { text, inputUnit: draft.unit, edited: true, status: staged.status, canonicalValue: null, reason: staged.reason }
    : { text, inputUnit: draft.unit, edited: true, status: 'ready', canonicalValue: staged.canonical });
  return frozenCanonicalDraft({ ...draft, fields: { ...draft.fields, [key]: field } });
}
export function readCanonicalUnitDraft<K extends string, U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, draft: CanonicalUnitDraft<K, U, F>, currentSourceKey: string): CanonicalUnitDraftRead<K> {
  if (draft.sourceKey !== currentSourceKey) return { status: 'held', reason: 'source-changed' };
  if (!spec.kind(draft.unit)) return { status: 'held', reason: 'unsupported-unit' };
  if (draft.kind !== spec.kind(draft.unit)) return { status: 'held', reason: 'mixed-dimensions' };
  const keys = Object.keys(draft.originalCanonical) as K[];
  if (keys.length !== Object.keys(draft.fields).length || keys.some(key => !Object.hasOwn(draft.fields, key))
    || draft.optionalFields.some(key => !keys.includes(key)) || new Set(draft.optionalFields).size !== draft.optionalFields.length
    || !spec.optional(draft.kind) && draft.optionalFields.length > 0) return { status: 'held', reason: 'fields-changed' };
  const mixed = keys.filter(key => draft.fields[key].inputUnit !== draft.unit);
  if (mixed.length) return { status: 'held', reason: 'mixed-units', fields: Object.freeze(mixed) };
  const invalid = keys.filter(key => {
    const field = draft.fields[key];
    if (field.status !== 'ready') return true;
    if (field.canonicalValue === undefined) return !spec.optional(draft.kind) || !draft.optionalFields.includes(key);
    return !Number.isFinite(field.canonicalValue) || spec.nonnegative(draft.kind) && field.canonicalValue < 0;
  });
  if (invalid.length) return { status: 'held', reason: 'unfinished-dimensions', fields: Object.freeze(invalid) };
  return { status: 'ready', values: Object.freeze(Object.fromEntries(keys.map(key => [key, draft.fields[key].canonicalValue])) as Record<K, number | undefined>) };
}
export function switchCanonicalUnitDraft<K extends string, U extends string, F extends string>(spec: CanonicalUnitSpec<U, F>, draft: CanonicalUnitDraft<K, U, F>, nextUnit: U, currentSourceKey: string): CanonicalUnitDraftSwitch<CanonicalUnitDraft<K, U, F>> {
  if (!spec.kind(nextUnit)) return { status: 'held', reason: 'unsupported-unit', draft };
  if (spec.kind(nextUnit) !== draft.kind) return { status: 'held', reason: 'mixed-dimensions', draft };
  const read = readCanonicalUnitDraft(spec, draft, currentSourceKey), keys = Object.keys(draft.fields) as K[];
  // Unit choice precedes entry on a new form. This exception changes only the
  // label of an untouched blank, never converts absence into a saved measurement.
  const pristineBlank = (key: K) => spec.pristineBlankSwitch(draft.kind) && draft.originalCanonical[key] === undefined
    && !draft.fields[key].edited && draft.fields[key].text === '' && draft.fields[key].status === 'invalid'
    && draft.fields[key].reason === 'required-dimension';
  const unenteredOnly = read.status === 'held' && read.reason === 'unfinished-dimensions'
    && keys.every(key => draft.fields[key].status === 'ready' || pristineBlank(key));
  if (read.status !== 'ready' && !unenteredOnly) return { status: 'held', reason: read.reason, draft };
  if (nextUnit === draft.unit) return { status: 'ready', draft };
  const fields = Object.fromEntries(keys.map(key => [key, canonicalField(spec,
    read.status === 'ready' ? read.values[key] : pristineBlank(key) ? undefined : draft.fields[key].canonicalValue!,
    nextUnit, draft.optionalFields.includes(key), draft.fields[key].edited)])) as Record<K, CanonicalUnitDraftField<U>>;
  if (keys.some(key => fields[key].status !== 'ready' && !pristineBlank(key))) return { status: 'held', reason: 'outside-finite-range', draft };
  return { status: 'ready', draft: frozenCanonicalDraft({ ...draft, unit: nextUnit, fields }) };
}
const nurseryUnits = Object.freeze<CanonicalUnitSpec<NurseryDimensionUnit, NurseryDimensionKind>>({
  kind: nurseryKind, toCanonical: nurseryDimensionToCanonical, fromCanonical: canonicalToNurseryDimension,
  optional: kind => kind === 'tray-length', nonnegative: kind => kind === 'surface-area', pristineBlankSwitch: kind => kind === 'surface-area',
});
export type NurseryDimensionDraftField = CanonicalUnitDraftField<NurseryDimensionUnit>;
export interface NurseryDimensionDraft<K extends string> extends CanonicalUnitDraft<K, NurseryDimensionUnit, NurseryDimensionKind> {}
export type NurseryDimensionDraftRead<K extends string> = CanonicalUnitDraftRead<K>;
export type NurseryDimensionDraftSwitch<K extends string> = CanonicalUnitDraftSwitch<NurseryDimensionDraft<K>>;
export function createNurseryDimensionDraft<K extends string>(input: {
  sourceKey: string; unit: NurseryDimensionUnit; values: Readonly<Record<K, number | undefined>>; optionalFields?: readonly K[];
}): NurseryDimensionDraft<K> { return createCanonicalUnitDraft(nurseryUnits, input); }
export function editNurseryDimensionDraft<K extends string>(draft: NurseryDimensionDraft<K>, key: NoInfer<K>, text: string): NurseryDimensionDraft<K> {
  return editCanonicalUnitDraft(nurseryUnits, draft, key, text);
}
export function readNurseryDimensionDraft<K extends string>(draft: NurseryDimensionDraft<K>, currentSourceKey: string): NurseryDimensionDraftRead<K> {
  return readCanonicalUnitDraft(nurseryUnits, draft, currentSourceKey);
}
export function switchNurseryDimensionDraftUnit<K extends string>(draft: NurseryDimensionDraft<K>, nextUnit: NurseryDimensionUnit, currentSourceKey: string): NurseryDimensionDraftSwitch<K> {
  return switchCanonicalUnitDraft(nurseryUnits, draft, nextUnit, currentSourceKey);
}
