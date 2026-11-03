import { decimalQuantityProduct } from './farm-records';
import {
  createCanonicalUnitDraft, editCanonicalUnitDraft, readCanonicalUnitDraft, switchCanonicalUnitDraft,
  formatCanonicalUnitValue, representableUnitValue,
  type CanonicalUnitSpec, type CanonicalUnitDraft, type CanonicalUnitDraftRead, type CanonicalUnitDraftSwitch,
} from './length-units';

/** Exact avoirdupois pound from NIST SP 811 footnote 22, not the rounded
 * B.8/B.9 row 0.4535924. Supplied primary body/receipt checked 2026-11-03:
 * https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes */
export const AVOIRDUPOIS_POUND_IN_KILOGRAMS = 0.45359237;
export type MassUnit = 'kg' | 'lb';
const supported = (unit: unknown): unit is MassUnit => unit === 'kg' || unit === 'lb';
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
