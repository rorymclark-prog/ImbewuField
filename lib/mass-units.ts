import { decimalQuantityProduct, exactDecimalQuantityProduct } from './farm-records';
import { detachJsonData } from './lossless-json';
import { numberLabel } from './format-figures';
import {
  createCanonicalUnitDraft, editCanonicalUnitDraft, readCanonicalUnitDraft, switchCanonicalUnitDraft,
  formatCanonicalUnitValue, representableUnitValue, parseExactUnitDecimal,
  type CanonicalUnitSpec, type CanonicalUnitDraft, type CanonicalUnitDraftRead, type CanonicalUnitDraftSwitch,
} from './length-units';

/** Exact avoirdupois pound from NIST SP 811 footnote 22, not the rounded
 * B.8/B.9 row 0.4535924. Supplied primary body/receipt checked 2026-11-03:
 * https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes */
export const AVOIRDUPOIS_POUND_IN_KILOGRAMS = 0.45359237;
export type MassUnit = 'kg' | 'lb';
const supported = (unit: unknown): unit is MassUnit => unit === 'kg' || unit === 'lb';
/** Existing entered-demand text work bound, shared by both entry branches. */
export const MASS_QUANTITY_ENTRY_MAX_TEXT = 64;
export interface MassQuantityEntry { readonly unit: MassUnit; readonly text: string }
export type MassQuantityEntryRead =
  | { readonly status: 'missing'; readonly entry: MassQuantityEntry }
  | { readonly status: 'provided'; readonly entry: MassQuantityEntry; readonly kilograms: number }
  | { readonly status: 'held'; readonly reason: string };

/** A request's original unit/text is separate from a rounded display draft.
 * This is numeric evidence, not freshness, actor or write authorisation. */
export function readMassQuantityEntry(value: unknown): MassQuantityEntryRead {
  try {
    const detached = detachJsonData(value);
    if (!detached || typeof detached !== 'object' || Array.isArray(detached)) return { status: 'held', reason: 'mass-entry-invalid' };
    const fields = detached as Record<string, unknown>;
    if (JSON.stringify(Object.keys(fields).sort()) !== JSON.stringify(['text', 'unit'])
      || !supported(fields.unit) || typeof fields.text !== 'string') return { status: 'held', reason: 'mass-entry-invalid' };
    if (fields.text.length > MASS_QUANTITY_ENTRY_MAX_TEXT) return { status: 'held', reason: 'mass-entry-format' };
    const entry = Object.freeze({ unit: fields.unit, text: fields.text });
    if (!entry.text.trim()) return { status: 'missing', entry };
    const parsed = parseExactUnitDecimal(entry.text);
    if (parsed.status !== 'ready') return { status: 'held', reason: parsed.reason };
    const product = exactDecimalQuantityProduct(entry.unit === 'kg' ? [parsed.value] : [parsed.value, AVOIRDUPOIS_POUND_IN_KILOGRAMS]);
    return product.status === 'ready' ? { status: 'provided', entry, kilograms: product.value } : product;
  } catch { return { status: 'held', reason: 'mass-entry-unreadable' }; }
}
export function massToKilograms(value: number, unit: MassUnit): number | null {
  if (!supported(unit) || !Number.isFinite(value)) return null;
  if (unit === 'kg' || value === 0) return value;
  // An extra binary-multiplication ULP can request a whole extra growing cycle.
  // Reuse decimal quantity arithmetic, then convert only its final product.
  const kilograms = decimalQuantityProduct([value, AVOIRDUPOIS_POUND_IN_KILOGRAMS]);
  return kilograms === null ? null : representableUnitValue(value, kilograms);
}
export function kilogramsToMass(value: number, unit: MassUnit): number | null {
  if (!supported(unit) || !Number.isFinite(value)) return null;
  return unit === 'kg' ? value : representableUnitValue(value, value / AVOIRDUPOIS_POUND_IN_KILOGRAMS);
}
const massUnits = Object.freeze<CanonicalUnitSpec<MassUnit, 'mass'>>({
  kind: unit => supported(unit) ? 'mass' : null,
  toCanonical: massToKilograms, fromCanonical: kilogramsToMass,
  optional: kind => kind === 'mass', nonnegative: () => false, pristineBlankSwitch: kind => kind === 'mass',
});
export function formatMassKilograms(kilograms: number, unit: MassUnit): string | null {
  return formatCanonicalUnitValue(massUnits, kilograms, unit);
}
/** Display text for a DERIVED total (weekly amount x weeks, unallocated volume,
 * capacity). formatMassKilograms preserves every digit a grower typed so a
 * readback matches the entry; applied to a product it prints "260.714286".
 * Same rule as projectedKgLabel: one decimal from 1 up, up to three below,
 * "<0.001" for a positive sliver so it never reads as zero. Never use this for
 * entry readback or saved values. Returns null for non-finite or negative input. */
export function formatDerivedMassKilograms(kilograms: number, unit: MassUnit): string | null {
  if (!Number.isFinite(kilograms) || kilograms < 0) return null;
  const value = kilogramsToMass(kilograms, unit);
  if (value === null || value < 0) return null;
  if (value === 0) return kilograms === 0 ? '0' : '<0.001';
  if (value < 0.001) return '<0.001';
  return numberLabel(value >= 1 ? Math.round(value * 10) / 10 : value, 3);
}
export interface MassDraft<K extends string> extends CanonicalUnitDraft<K, MassUnit, 'mass'> {
  readonly originalKilograms: Readonly<Record<K, number | undefined>>;
}
export type MassDraftRead<K extends string> =
  | { readonly status: 'ready'; readonly kilograms: Readonly<Record<K, number | undefined>> }
  | Extract<CanonicalUnitDraftRead<K>, { status: 'held' }>;
export type MassDraftSwitch<K extends string> = CanonicalUnitDraftSwitch<MassDraft<K>>;
/** Required weekly mass and optional pack weight share conversion, not schema.
 * The existing harvest-target authority still decides positive-known masses,
 * pack quantities, dates and saleable share. No pack weight is supplied here. */
export function createMassDraft<K extends string>({ kilograms, ...rest }: {
  sourceKey: string; unit: MassUnit; kilograms: Readonly<Record<K, number | undefined>>; optionalFields?: readonly K[];
}): MassDraft<K> {
  const draft = createCanonicalUnitDraft(massUnits, { ...rest, values: kilograms });
  return Object.freeze({ ...draft, originalKilograms: draft.originalCanonical });
}
export function editMassDraft<K extends string>(draft: MassDraft<K>, key: NoInfer<K>, text: string): MassDraft<K> {
  return editCanonicalUnitDraft(massUnits, draft, key, text) as MassDraft<K>;
}
export function readMassDraft<K extends string>(draft: MassDraft<K>, currentSourceKey: string): MassDraftRead<K> {
  const read = readCanonicalUnitDraft(massUnits, draft, currentSourceKey);
  return read.status === 'ready' ? { status: 'ready', kilograms: read.values } : read;
}
export function switchMassDraftUnit<K extends string>(draft: MassDraft<K>, nextUnit: MassUnit, currentSourceKey: string): MassDraftSwitch<K> {
  return switchCanonicalUnitDraft(massUnits, draft, nextUnit, currentSourceKey) as MassDraftSwitch<K>;
}
