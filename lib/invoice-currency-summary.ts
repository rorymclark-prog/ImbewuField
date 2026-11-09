import {
  type SavedInvoice,
  invoiceReadCoverage,
} from './invoices';
import {
  inspectInvoiceCurrencyBasis,
  type InvoicePilotCurrency,
} from './invoice-currency';
import { detachJsonData } from './lossless-json';

export interface InvoiceCurrencySummaryTotals {
  readonly count: number;
  readonly total: number;
}

export type InvoiceCurrencySummaryResult =
  | {
      readonly status: 'ready';
      readonly currencyCode: InvoicePilotCurrency;
      readonly issued: InvoiceCurrencySummaryTotals;
      readonly recordedPaid: InvoiceCurrencySummaryTotals;
      readonly unpaid: InvoiceCurrencySummaryTotals;
    }
  | {
      readonly status: 'held';
      readonly reason: string;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  try {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    return false;
  }
}

/**
 * Projects all-loaded-time invoice totals in one explicitly selected pilot currency.
 *
 * This is a pure projection helper over canonical SavedInvoice records:
 * - Sums supplied recorded `total` fields without recomputing prices or quantities.
 * - Enforces collection coverage on the original array before filtering or cloning.
 * - Inspects native denomination basis on original descriptor-safe rows before copying.
 * - Validates source row integrity, non-empty IDs, and ID uniqueness across all rows BEFORE currency exclusion.
 * - Rejects any supplied `paid` invoice that lacks a usable `paidAt` date string (cleanInvoice owns normalization).
 * - Segregates issued, recordedPaid, and unpaid totals.
 * - Catches reflection failures at the public boundary without propagating exceptions; does not execute property getters or perform storage I/O.
 */
export function invoiceCurrencySummary(
  invoices: readonly SavedInvoice[],
  currencyCode: unknown,
): InvoiceCurrencySummaryResult {
  try {
    // 1. Validate currency selection using sole denomination authority
    let targetBasis: ReturnType<typeof inspectInvoiceCurrencyBasis>;
    try {
      targetBasis = inspectInvoiceCurrencyBasis({ currencyCode });
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'currency-outside-pilot',
      });
    }

    if (targetBasis.status !== 'recorded') {
      return Object.freeze({
        status: 'held',
        reason: 'currency-outside-pilot',
      });
    }
    const targetCurrency: InvoicePilotCurrency = targetBasis.currency;

    // 2. Validate original collection coverage prior to filtering or cloning
    let isArr = false;
    try {
      isArr = Array.isArray(invoices);
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'invoices-unreadable',
      });
    }

    if (!isArr) {
      return Object.freeze({
        status: 'held',
        reason: 'invoices-unreadable',
      });
    }

    let coverage: ReturnType<typeof invoiceReadCoverage>;
    try {
      coverage = invoiceReadCoverage(invoices);
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'invoices-unreadable',
      });
    }

    if (coverage.status === 'held') {
      return Object.freeze({
        status: 'held',
        reason: coverage.reason,
      });
    }

    let issuedCount = 0;
    let issuedTotal = 0;
    let recordedPaidCount = 0;
    let recordedPaidTotal = 0;
    let unpaidCount = 0;
    let unpaidTotal = 0;

    const seenIds = new Set<string>();

    let length = 0;
    try {
      length = invoices.length;
    } catch {
      return Object.freeze({
        status: 'held',
        reason: 'invoices-unreadable',
      });
    }

    // 3. Scan invoices in original collection without invoking array index accessors
    for (let idx = 0; idx < length; idx++) {
      const indexKey = String(idx);

      let indexDesc: PropertyDescriptor | undefined;
      try {
        indexDesc = Object.getOwnPropertyDescriptor(invoices, indexKey);
      } catch {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-row-unreadable',
        });
      }

      if (!indexDesc || !Object.hasOwn(indexDesc, 'value') || typeof indexDesc.get === 'function') {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-row-unreadable',
        });
      }

      const rawInvoice = indexDesc.value;
      if (!isPlainObject(rawInvoice)) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-row-unreadable',
        });
      }

      // Inspect native denomination basis directly on the original container
      // BEFORE attempting any cloning or field extraction.
      let invBasis: ReturnType<typeof inspectInvoiceCurrencyBasis>;
      try {
        invBasis = inspectInvoiceCurrencyBasis(rawInvoice);
      } catch {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-row-unreadable',
        });
      }

      if (invBasis.status === 'held') {
        return Object.freeze({
          status: 'held',
          reason: invBasis.reason,
        });
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
        });
      }

      // Validate required invoice metadata on every supplied row BEFORE currency exclusion
      const id = safeInvoice.id;
      const no = safeInvoice.no;
      const total = safeInvoice.total;
      const dateISO = safeInvoice.dateISO;
      const status = safeInvoice.status;
      const paidAt = safeInvoice.paidAt;

      if (
        typeof id !== 'string' ||
        !id.trim() ||
        typeof no !== 'number' ||
        !Number.isSafeInteger(no) ||
        no <= 0 ||
        typeof dateISO !== 'string' ||
        !Number.isFinite(Date.parse(dateISO))
      ) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-row-unreadable',
        });
      }

      // Source ID uniqueness must be verified across ALL supplied rows, regardless of currency
      if (seenIds.has(id)) {
        return Object.freeze({
          status: 'held',
          reason: 'duplicate-invoice-id',
        });
      }
      seenIds.add(id);

      // Validate total: must be a finite number >= 0 (zero total is legitimate)
      if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-total-invalid',
        });
      }

      // Validate status: must be 'paid' or 'unpaid'
      if (status !== 'paid' && status !== 'unpaid') {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-status-invalid',
        });
      }

      // A supplied row with status 'paid' MUST have a usable date string in paidAt.
      // cleanInvoice alone owns normalizing paid-without-date; this pure projection must hold invalid input.
      if (status === 'paid' && (typeof paidAt !== 'string' || !Number.isFinite(Date.parse(paidAt)))) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-paid-date-invalid',
        });
      }

      const invCurrency: InvoicePilotCurrency =
        invBasis.status === 'legacy-rand' ? 'ZAR' : invBasis.currency;

      if (invCurrency !== targetCurrency) {
        // Exclude nonmatching currency cleanly after full row verification
        continue;
      }

      // Accumulate issued totals
      issuedCount += 1;
      issuedTotal += total;

      if (status === 'paid') {
        recordedPaidCount += 1;
        recordedPaidTotal += total;
      } else {
        unpaidCount += 1;
        unpaidTotal += total;
      }

      // Check for aggregate overflow or non-finite numbers
      if (
        !Number.isFinite(issuedTotal) ||
        !Number.isFinite(recordedPaidTotal) ||
        !Number.isFinite(unpaidTotal)
      ) {
        return Object.freeze({
          status: 'held',
          reason: 'invoice-total-overflow',
        });
      }
    }

    return Object.freeze({
      status: 'ready',
      currencyCode: targetCurrency,
      issued: Object.freeze({
        count: issuedCount,
        total: issuedTotal,
      }),
      recordedPaid: Object.freeze({
        count: recordedPaidCount,
        total: recordedPaidTotal,
      }),
      unpaid: Object.freeze({
        count: unpaidCount,
        total: unpaidTotal,
      }),
    });
  } catch {
    // Top-level reflection boundary: catch any unexpected throws from exotic/revoked proxies
    return Object.freeze({
      status: 'held',
      reason: 'invoices-unreadable',
    });
  }
}
