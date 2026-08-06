/**
 * Spotting the same sale counted twice.
 *
 * THE PROBLEM. A farmer can still manually enter a sale that is already represented by a paid
 * invoice. Invoice-generated crop rows now carry invoice_id and are excluded from cash totals;
 * this heuristic is for older and manually duplicated rows that carry no such exact link.
 *
 * Paid invoice lines measured in kg now create exact linked sale rows. Those rows give harvest
 * reconciliation the crop and weight it needs without asking the farmer to enter the sale again,
 * while invoice_id keeps the linked row out of cash totals on the device holding that invoice.
 * Older invoices and manually duplicated sales have no exact link, so this heuristic still matters.
 *
 * WHAT THIS DOES AND DELIBERATELY DOES NOT DO. It flags suspicion. It does not merge or suppress
 * unlinked historical rows, because what a farmer's books say is not a decision a heuristic gets
 * to make. Exact invoice-created rows are handled by their invoice_id, not by this amount matcher.
 *
 * The rule is deliberately narrow so it does not cry wolf: the same amount, within a few days. Two
 * genuinely separate sales of the same value in the same week will occasionally be flagged, and
 * that is the right way round — the flag says "check this", not "this is wrong".
 */

export interface IncomeEntry {
  /** Stable id within its own kind. */
  id: string;
  kind: 'sale' | 'invoice';
  /** Money in, in rand. */
  amount: number;
  /** ISO date the money is attributed to. */
  iso: string;
}

/** How far apart two records of the same amount may be and still be one sale. */
export const DUPLICATE_WINDOW_DAYS = 3;

const DAY_MS = 86_400_000;

/** Rand compared in whole cents, so floating point cannot hide an exact match. */
function sameAmount(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a <= 0 || b <= 0) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

function withinWindow(aIso: string, bIso: string): boolean {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= DUPLICATE_WINDOW_DAYS * DAY_MS;
}

/**
 * Ids of every entry that looks like the other side of a double entry.
 *
 * Only ever pairs a SALE with an INVOICE — two sales of the same amount are two sales, and two
 * invoices of the same amount are two invoices. It is the crossing of the two routes that creates
 * the double count.
 */
export function suspectedDuplicateIncomeIds(entries: readonly IncomeEntry[]): Set<string> {
  const flagged = new Set<string>();
  const sales = entries.filter((e) => e.kind === 'sale');
  const invoices = entries.filter((e) => e.kind === 'invoice');
  for (const sale of sales) {
    for (const invoice of invoices) {
      if (!sameAmount(sale.amount, invoice.amount)) continue;
      if (!withinWindow(sale.iso, invoice.iso)) continue;
      flagged.add(sale.id);
      flagged.add(invoice.id);
    }
  }
  return flagged;
}

/** Shown on a flagged row. Says what to check, not what is wrong. */
export const DUPLICATE_ROW_NOTE =
  'Possibly the same sale — a paid invoice is already counted as income.';

/** Shown once under the ledger, whether or not anything is flagged. */
export const DUPLICATE_LEDGER_FOOTER =
  'Paid invoice crop lines enter the sales book automatically and count once. Do not enter them again.';
