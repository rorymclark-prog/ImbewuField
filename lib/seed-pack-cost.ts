import { parseExactUnitDecimal, type ExactUnitDecimal } from './length-units.ts';
import {
  inspectInvoiceCurrencyBasis,
  type InvoicePilotCurrency,
} from './invoice-currency.ts';
import { exactDecimalQuantityProduct } from './farm-records.ts';

/**
 * Software entry boundary for seed-pack price text input.
 * Protects against memory consumption from oversized inputs before trim/parse.
 * This is an engineering ceiling, not a price or farming boundary.
 */
export const SEED_PACK_PRICE_INPUT_MAX_CHARS = 256;

export type SeedPackPriceInputStatus = 'ready' | 'unknown' | 'invalid';

export interface SeedPackPriceInputResult {
  readonly status: SeedPackPriceInputStatus;
  readonly rawText: string | null;
  readonly value: number | null;
  readonly reason: string | null;
}

export type SeedPackCostStatus = 'complete' | 'unknown' | 'invalid' | 'held';

export interface SeedPackCostReview {
  readonly status: SeedPackCostStatus;
  readonly packsNeeded: number | null;
  readonly unitPrice: number | null;
  readonly currency: InvoicePilotCurrency | null;
  readonly estimatedCost: number | null;
  readonly reason: string | null;
}

/**
 * Pure parsing of seed pack price text inputs.
 *
 * Why:
 * 1. Accepts primitive string text only; non-string inputs are invalid (zero coercion).
 * 2. Bounded by SEED_PACK_PRICE_INPUT_MAX_CHARS (256) before trimming.
 * 3. Blank or whitespace-only primitive text yields status 'unknown' (value: null, reason: null).
 * 4. Reuses parseExactUnitDecimal from length-units.ts for plain decimal grammar (dot OR comma decimal, no grouping).
 * 5. Rejects negative values and signed zero (-0).
 * 6. Forwards representation loss and finite-range errors from the decimal parser.
 * 7. Returns deeply frozen result with reason null on ready/unknown, or an informative reason on invalid.
 */
export function parseSeedPackPriceInput(raw: unknown): SeedPackPriceInputResult {
  if (typeof raw !== 'string') {
    return Object.freeze({
      status: 'invalid',
      rawText: null,
      value: null,
      reason: 'string-required',
    });
  }

  if (raw.length > SEED_PACK_PRICE_INPUT_MAX_CHARS) {
    return Object.freeze({
      status: 'invalid',
      rawText: raw,
      value: null,
      reason: 'input-length-exceeded',
    });
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Object.freeze({
      status: 'unknown',
      rawText: raw,
      value: null,
      reason: null,
    });
  }

  const parsed: ExactUnitDecimal = parseExactUnitDecimal(trimmed);
  if (parsed.status !== 'ready') {
    return Object.freeze({
      status: 'invalid',
      rawText: raw,
      value: null,
      reason: parsed.reason,
    });
  }

  // Reject negative prices and signed zero (-0)
  if (parsed.value < 0 || Object.is(parsed.value, -0)) {
    return Object.freeze({
      status: 'invalid',
      rawText: raw,
      value: null,
      reason: 'negative-price-rejected',
    });
  }

  return Object.freeze({
    status: 'ready',
    rawText: raw,
    value: parsed.value,
    reason: null,
  });
}

function isValidPackCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

/**
 * Pure line-cost review for estimated seed pack purchasing.
 *
 * Why:
 * 1. Consumes the scalar packsNeeded count directly; does not recalculate allocations or demand.
 * 2. PacksNeeded must be a primitive nonnegative safe integer (excluding -0); null/undefined is unknown.
 * 3. Parses priceText using parseSeedPackPriceInput.
 * 4. Inspects currencyCode strictly via inspectInvoiceCurrencyBasis({ currencyCode });
 *    null/undefined/blank primitive text is unknown; non-recorded or unreadable codes fail without coercion.
 * 5. Precedence: checks invalidity first across count, price, then currency.
 *    Any invalid input yields status: 'invalid', reporting the first failure reason while preserving
 *    independently valid fields and setting invalid/missing fields and estimatedCost to null.
 * 6. If no inputs are invalid, but any of count, price, or currency is unknown, status is 'unknown'
 *    with estimatedCost null, preserving known factors (missing is never silently free).
 * 7. When all three inputs are known, calls exactDecimalQuantityProduct([packsNeeded, unitPrice]).
 *    Returns 'complete' with exact product, or forwards specific arithmetic hold reason with estimatedCost null.
 * 8. Never rounds, stores data, converts currency (FX), or generates invoices.
 */
export function reviewSeedPackCost(
  packsNeeded: unknown,
  priceText: unknown,
  currencyCode: unknown
): SeedPackCostReview {
  // 1. Evaluate packsNeeded
  const countIsUnknown = packsNeeded === null || packsNeeded === undefined;
  const countIsValid = !countIsUnknown && isValidPackCount(packsNeeded);
  const countIsInvalid = !countIsUnknown && !countIsValid;

  // 2. Evaluate priceText
  const priceResult = parseSeedPackPriceInput(priceText);
  const priceIsInvalid = priceResult.status === 'invalid';
  const priceIsUnknown = priceResult.status === 'unknown';
  const priceIsValid = priceResult.status === 'ready';

  // 3. Evaluate currencyCode
  const currencyIsUnknown =
    currencyCode === null ||
    currencyCode === undefined ||
    (typeof currencyCode === 'string' && currencyCode.trim().length === 0);

  let currencyIsInvalid = false;
  let currencyReason: string | null = null;
  let validCurrency: InvoicePilotCurrency | null = null;

  if (!currencyIsUnknown) {
    if (typeof currencyCode !== 'string') {
      currencyIsInvalid = true;
      currencyReason = 'currency-code-string-required';
    } else {
      const container = { currencyCode };
      const basis = inspectInvoiceCurrencyBasis(container);
      if (basis.status === 'recorded') {
        validCurrency = basis.currency;
      } else {
        currencyIsInvalid = true;
        currencyReason = basis.status === 'held' ? basis.reason : 'unsupported-currency-basis';
      }
    }
  }

  // Precedence 1: Check invalidity in order (count -> price -> currency)
  if (countIsInvalid || priceIsInvalid || currencyIsInvalid) {
    let failureReason: string;
    if (countIsInvalid) {
      failureReason = 'invalid-pack-count';
    } else if (priceIsInvalid) {
      failureReason = priceResult.reason ?? 'invalid-unit-price';
    } else {
      failureReason = currencyReason ?? 'invalid-currency';
    }

    return Object.freeze({
      status: 'invalid',
      packsNeeded: countIsValid ? (packsNeeded as number) : null,
      unitPrice: priceIsValid ? priceResult.value : null,
      currency: validCurrency,
      estimatedCost: null,
      reason: failureReason,
    });
  }

  // Precedence 2: If any input is unknown, review is unknown with estimatedCost null
  if (countIsUnknown || priceIsUnknown || currencyIsUnknown) {
    return Object.freeze({
      status: 'unknown',
      packsNeeded: countIsValid ? (packsNeeded as number) : null,
      unitPrice: priceIsValid ? priceResult.value : null,
      currency: validCurrency,
      estimatedCost: null,
      reason: null,
    });
  }

  // Precedence 3: All inputs are known and valid. Compute exact decimal product
  const validPacks = packsNeeded as number;
  const validPrice = priceResult.value as number;

  const productResult = exactDecimalQuantityProduct([validPacks, validPrice]);
  if (productResult.status !== 'ready') {
    return Object.freeze({
      status: 'held',
      packsNeeded: validPacks,
      unitPrice: validPrice,
      currency: validCurrency,
      estimatedCost: null,
      reason: productResult.reason,
    });
  }

  return Object.freeze({
    status: 'complete',
    packsNeeded: validPacks,
    unitPrice: validPrice,
    currency: validCurrency,
    estimatedCost: productResult.value,
    reason: null,
  });
}
