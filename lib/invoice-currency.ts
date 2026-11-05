export const INVOICE_PILOT_CURRENCIES = Object.freeze([
  'ZAR',
  'KES',
  'GBP',
  'USD',
  'EUR',
  'BRL',
] as const);

export type InvoicePilotCurrency = typeof INVOICE_PILOT_CURRENCIES[number];

export type InvoiceCurrencyBasis =
  | { status: 'legacy-rand'; currency: 'ZAR' }
  | { status: 'recorded'; currency: InvoicePilotCurrency }
  | {
      status: 'held';
      reason:
        | 'invoice-shape-unreadable'
        | 'currency-property-unreadable'
        | 'currency-outside-pilot';
    };

export type InvoiceRandConsumerEligibility =
  | { status: 'eligible'; basis: 'legacy-rand' | 'recorded-rand' }
  | {
      status: 'held';
      reason: 'foreign-recorded-currency' | 'unreadable-currency';
    };

function isPilotCurrency(value: string): value is InvoicePilotCurrency {
  return (INVOICE_PILOT_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Inspects only the currency denomination basis of a potential invoice-shaped container.
 *
 * Only plain objects (Object.prototype or null prototype) are accepted as possible containers.
 * Arrays, primitives, null, functions, and exotic prototype instances yield 'invoice-shape-unreadable'.
 *
 * Distinguishes descriptor kind: an accessor descriptor (having 'get' or 'set' properties, even if undefined)
 * yields 'currency-property-unreadable'. A data descriptor with value present is verified against pilot codes.
 * Genuinely absent own currencyCode on a plain container yields 'legacy-rand', matching established
 * unlabelled historical invoice records.
 *
 * Reflection exceptions are caught and held. Arbitrary Proxy traps can run user code, so caller traps
 * are not assumed zero-effect, but reflection throws yield 'held' rather than propagating.
 */
export function inspectInvoiceCurrencyBasis(value: unknown): InvoiceCurrencyBasis {
  if (typeof value !== 'object' || value === null) {
    return { status: 'held', reason: 'invoice-shape-unreadable' };
  }

  let proto: unknown;
  try {
    proto = Object.getPrototypeOf(value);
  } catch {
    return { status: 'held', reason: 'invoice-shape-unreadable' };
  }

  if (proto !== Object.prototype && proto !== null) {
    return { status: 'held', reason: 'invoice-shape-unreadable' };
  }

  let ownDesc: PropertyDescriptor | undefined;
  try {
    ownDesc = Object.getOwnPropertyDescriptor(value, 'currencyCode');
  } catch {
    return { status: 'held', reason: 'currency-property-unreadable' };
  }

  if (ownDesc === undefined) {
    // If currencyCode is not an own property, check whether an inherited property exists.
    // Inherited currencyCode must never be trusted or evaluated.
    try {
      if ('currencyCode' in value) {
        return { status: 'held', reason: 'currency-property-unreadable' };
      }
    } catch {
      return { status: 'held', reason: 'currency-property-unreadable' };
    }
    // Own currencyCode is genuinely absent on this plain object container.
    // Established legacy basis: historical unlabelled invoices are legacy Rand.
    return { status: 'legacy-rand', currency: 'ZAR' };
  }

  // Detect descriptor kind per ECMAScript specification:
  // An accessor descriptor has 'get' or 'set' fields (even if undefined).
  // Accessors must never be evaluated or trusted for currency denomination.
  if ('get' in ownDesc || 'set' in ownDesc) {
    return { status: 'held', reason: 'currency-property-unreadable' };
  }

  // Data descriptor. Check the value without invoking methods.
  const rawValue = ownDesc.value;

  if (typeof rawValue === 'string') {
    if (isPilotCurrency(rawValue)) {
      return { status: 'recorded', currency: rawValue };
    }
    return { status: 'held', reason: 'currency-outside-pilot' };
  }

  // Any other present primitive or object (undefined, null, number, boolean, symbol, object)
  // is present but not an exact supported pilot string.
  return { status: 'held', reason: 'currency-outside-pilot' };
}

/**
 * Determines whether an invoice-shaped value is eligible to be consumed by legacy Rand-only
 * calculations, views, or reports.
 *
 * Dispatches strictly through inspectInvoiceCurrencyBasis.
 * Legacy Rand and explicitly recorded ZAR are eligible.
 * Foreign recorded currencies and unreadable/held structures are held with specific reasons.
 */
export function invoiceRandConsumerEligibility(value: unknown): InvoiceRandConsumerEligibility {
  const basis = inspectInvoiceCurrencyBasis(value);

  if (basis.status === 'legacy-rand') {
    return { status: 'eligible', basis: 'legacy-rand' };
  }

  if (basis.status === 'recorded') {
    if (basis.currency === 'ZAR') {
      return { status: 'eligible', basis: 'recorded-rand' };
    }
    return { status: 'held', reason: 'foreign-recorded-currency' };
  }

  return { status: 'held', reason: 'unreadable-currency' };
}
