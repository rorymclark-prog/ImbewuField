import { parseExactUnitDecimal } from './length-units';

export type SeedPurchaseCountKind = 'allocation' | 'pack';

export type SeedPurchaseCountInputReason =
  | 'whole-count-required'
  | 'outside-safe-integer-range'
  | 'positive-pack-size-required'
  | 'unsupported-count-kind';

export interface SeedPurchaseCountInput {
  readonly status: 'ready' | 'unknown' | 'invalid';
  readonly rawText: string | null;
  readonly value: number | null;
  readonly reason: SeedPurchaseCountInputReason | null;
}

function freezeInput(
  status: 'ready' | 'unknown' | 'invalid',
  rawText: string | null,
  value: number | null,
  reason: SeedPurchaseCountInputReason | null
): SeedPurchaseCountInput {
  return Object.freeze({
    status,
    rawText,
    value,
    reason,
  });
}

export function parseSeedPurchaseCountInput(
  raw: unknown,
  kind: SeedPurchaseCountKind
): SeedPurchaseCountInput {
  const isString = typeof raw === 'string';
  const rawText = isString ? raw : null;

  // Step 1: Validate kind by primitive equality
  if (kind !== 'allocation' && kind !== 'pack') {
    return freezeInput('invalid', rawText, null, 'unsupported-count-kind');
  }

  // Step 2: Validate raw is primitive string
  if (!isString) {
    return freezeInput('invalid', null, null, 'whole-count-required');
  }

  // Step 3: Trimmed empty check => unknown with null value and null reason, rawText preserved
  const trimmed = raw.trim();
  if (trimmed === '') {
    return freezeInput('unknown', rawText, null, null);
  }

  // Step 4: ASCII digits check ^[0-9]+$
  // Signs, decimal dots, commas, exponents, group separators, Unicode digits are invalid whole-count-required
  if (!/^[0-9]+$/.test(trimmed)) {
    return freezeInput('invalid', rawText, null, 'whole-count-required');
  }

  // Step 5: Call parseExactUnitDecimal(trimmed)
  const exact = parseExactUnitDecimal(trimmed);
  if (
    exact.status !== 'ready' ||
    !Number.isSafeInteger(exact.value) ||
    exact.value < 0
  ) {
    return freezeInput('invalid', rawText, null, 'outside-safe-integer-range');
  }

  const numericValue = exact.value;

  // Step 6: Allocation vs pack semantics
  if (kind === 'pack' && numericValue === 0) {
    return freezeInput('invalid', rawText, null, 'positive-pack-size-required');
  }

  return freezeInput('ready', rawText, numericValue, null);
}
