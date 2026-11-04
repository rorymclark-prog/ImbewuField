import {
  type SavedInvoice,
  type InvoiceItem,
  invoiceReadCoverage,
} from './invoices';
import {
  inspectInvoiceCurrencyBasis,
  type InvoicePilotCurrency,
} from './invoice-currency';
import { detachJsonData } from './lossless-json';

export interface InvoicePriceChoice {
  readonly invoiceId: string;
  readonly invoiceNo: number;
  readonly lineIndex: number;
  readonly desc: string;
  readonly unit: string;
  readonly price: number;
  readonly currencyCode: InvoicePilotCurrency;
  readonly buyer: string;
  readonly issuedISO: string;
}

export type InvoicePriceHistoryResult =
  | {
      readonly status: 'ready';
      readonly choices: readonly InvoicePriceChoice[];
    }
  | {
      readonly status: 'held';
      readonly reason: string;
      readonly choices: readonly [];
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasAccessorDescriptor(obj: object, prop: string): boolean {
  try {
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    return !!desc && ('get' in desc || 'set' in desc);
  } catch {
    return true;
  }
}

/**
 * Projects historical prices for a given item and unit from saved invoices,
 * matching only recorded prices in the explicitly selected currency.
 *
 * This is a pure projection helper; it performs no storage reads/writes,
 * makes no financial mutations or conversions, and does not alter input order or spellings.
 */
export function invoicePriceHistory(
  invoices: readonly SavedInvoice[],
  selection: { currencyCode: unknown; desc: string; unit: string },
): InvoicePriceHistoryResult {
  // 1. Check selection container shape and accessors
  if (!isPlainObject(selection)) {
    return Object.freeze({
      status: 'held',
      reason: 'invalid-selection',
      choices: Object.freeze([]) as readonly [],
    });
  }

  // Reject any accessors on selection properties (currencyCode, desc, unit) with zero getter invocations
  if (
    hasAccessorDescriptor(selection, 'currencyCode') ||
    hasAccessorDescriptor(selection, 'desc') ||
    hasAccessorDescriptor(selection, 'unit')
  ) {
    return Object.freeze({
      status: 'held',
      reason: 'selection-property-unreadable',
      choices: Object.freeze([]) as readonly [],
    });
  }

  // Check selection currency basis directly on the original selection container
  let rawCurrencyDesc: PropertyDescriptor | undefined;
  try {
    rawCurrencyDesc = Object.getOwnPropertyDescriptor(selection, 'currencyCode');
  } catch {
    return Object.freeze({
      status: 'held',
      reason: 'selection-property-unreadable',
      choices: Object.freeze([]) as readonly [],
    });
  }

  if (!rawCurrencyDesc || !Object.hasOwn(rawCurrencyDesc, 'value')) {
    return Object.freeze({
      status: 'held',
      reason: 'currency-outside-pilot',
      choices: Object.freeze([]) as readonly [],
    });
  }

  const targetBasis = inspectInvoiceCurrencyBasis({ currencyCode: rawCurrencyDesc.value });
  if (targetBasis.status !== 'recorded') {
    return Object.freeze({
      status: 'held',
      reason: 'currency-outside-pilot',
      choices: Object.freeze([]) as readonly [],
    });
  }
  const targetCurrency: InvoicePilotCurrency = targetBasis.currency;

  let safeSelection: Record<string, unknown>;
  try {
    safeSelection = detachJsonData(selection, { allowUndefinedObjectFields: true }) as Record<
      string,
      unknown
    >;
  } catch {
    return Object.freeze({
      status: 'held',
      reason: 'invalid-selection',
      choices: Object.freeze([]) as readonly [],
    });
  }

  const targetDesc = safeSelection.desc;
  const targetUnit = safeSelection.unit;

  if (typeof targetDesc !== 'string' || typeof targetUnit !== 'string') {
    return Object.freeze({
      status: 'held',
      reason: 'invalid-selection',
      choices: Object.freeze([]) as readonly [],
    });
  }

  // 2. Consult original collection coverage before filtering or cloning.
  // An incomplete, hidden, or held collection must never be projected as complete empty history.
  if (!Array.isArray(invoices)) {
    return Object.freeze({
      status: 'held',
      reason: 'invoices-unreadable',
      choices: Object.freeze([]) as readonly [],
    });
  }

  const coverage = invoiceReadCoverage(invoices);
  if (coverage.status === 'held') {
    return Object.freeze({
      status: 'held',
      reason: coverage.reason,
      choices: Object.freeze([]) as readonly [],
    });
  }

  const choices: InvoicePriceChoice[] = [];

  // 3. Scan invoices in their given input order without indexing accessors directly on unsafe arrays
  for (let invIdx = 0; invIdx < invoices.length; invIdx++) {
    const indexKey = String(invIdx);

    // Guard against index accessors on the array
    let indexDesc: PropertyDescriptor | undefined;
    try {
      indexDesc = Object.getOwnPropertyDescriptor(invoices, indexKey);
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-row-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    if (!indexDesc || !Object.hasOwn(indexDesc, 'value') || typeof indexDesc.get === 'function') {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-row-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    const rawInvoice = indexDesc.value;
    if (!isPlainObject(rawInvoice)) {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-row-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    // Inspect native denomination basis directly on the original container
    // BEFORE attempting any cloning or field extraction.
    // This ensures present undefined or unreadable currency properties are detected
    // as held and never omitted/misinterpreted as legacy Rand.
    const invBasis = inspectInvoiceCurrencyBasis(rawInvoice);
    if (invBasis.status === 'held') {
      return Object.freeze({
        status: 'held',
        reason: invBasis.reason,
        choices: Object.freeze([]) as readonly [],
      });
    }

    // If the invoice currency denomination matches our targetCurrency, inspect its line items
    const invCurrency: InvoicePilotCurrency =
      invBasis.status === 'legacy-rand' ? 'ZAR' : invBasis.currency;

    if (invCurrency !== targetCurrency) {
      // Exclude nonmatching currency cleanly without holding or converting
      continue;
    }

    // Safely detach/read the invoice fields without executing getters or functions.
    // Canonical optional undefined fields are omitted safely by allowUndefinedObjectFields.
    let safeInvoice: Record<string, unknown>;
    try {
      safeInvoice = detachJsonData(rawInvoice, { allowUndefinedObjectFields: true }) as Record<
        string,
        unknown
      >;
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-row-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    // Validate required invoice metadata:
    // Positive safe invoice number (> 0), non-empty ID and buyer, and valid parseable date string
    const id = safeInvoice.id;
    const no = safeInvoice.no;
    const billTo = safeInvoice.billTo;
    const dateISO = safeInvoice.dateISO;

    if (
      typeof id !== 'string' ||
      !id.trim() ||
      typeof no !== 'number' ||
      !Number.isSafeInteger(no) ||
      no <= 0 ||
      typeof billTo !== 'string' ||
      typeof dateISO !== 'string' ||
      !Number.isFinite(Date.parse(dateISO))
    ) {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-row-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    const items = safeInvoice.items;
    if (!Array.isArray(items)) {
      return Object.freeze({
        status: 'held',
        reason: 'invoice-items-unreadable',
        choices: Object.freeze([]) as readonly [],
      });
    }

    // Scan line items with stable zero-based lineIndex
    for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
      const item = items[lineIndex];
      if (!isPlainObject(item)) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-item-unreadable',
          choices: Object.freeze([]) as readonly [],
        });
      }

      // Check price safety: finite number >= 0
      const price = item.price;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-price-invalid',
          choices: Object.freeze([]) as readonly [],
        });
      }

      // Exact match on item description and unit (case and whitespace sensitive, exact source spelling)
      if (item.desc === targetDesc && item.unit === targetUnit) {
        choices.push(
          Object.freeze({
            invoiceId: id,
            invoiceNo: no,
            lineIndex,
            desc: item.desc,
            unit: item.unit,
            price,
            currencyCode: invCurrency,
            buyer: billTo,
            issuedISO: dateISO,
          }),
        );
      }
    }
  }

  return Object.freeze({
    status: 'ready',
    choices: Object.freeze(choices),
  });
}
