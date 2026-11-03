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
  const parsed = parseLengthDecimal(text);
  const metres = parsed.status === 'ready' ? lengthToMetres(parsed.value, draft.unit) : null;
  const field: LengthDraftField = Object.freeze(parsed.status !== 'ready'
    ? { text, inputUnit: draft.unit, edited: true, status: parsed.status, canonicalMetres: null, reason: parsed.reason }
    : metres === null ? { text, inputUnit: draft.unit, edited: true, status: 'invalid', canonicalMetres: null, reason: 'outside-finite-range' }
      : { text, inputUnit: draft.unit, edited: true, status: 'ready', canonicalMetres: metres });
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
