import { produceEntryOption } from '../crop-entry';
import { cropByKey } from '../crop-catalog';
import { validCycleHarvestRecordId } from '../cycle-harvest';
import type { SalesLog } from '../db/types';
import { recordQuantity, recordUnit } from '../farm-records';
import { isGrowerUtcDate } from './grower-planning';
import type { CheckedFulfilmentSource } from './buyer-fulfilment';

type SourceFacts = Omit<CheckedFulfilmentSource, 'fingerprint'>;

export async function fingerprintFulfilmentSource(facts: SourceFacts, details: readonly unknown[] = []): Promise<CheckedFulfilmentSource> {
  const bytes = new TextEncoder().encode(JSON.stringify([
    facts.kind, facts.id, facts.canonicalId, facts.siteId, facts.cropKey, facts.sourceOn, facts.unit, facts.quantity, details,
  ]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ ...facts, fingerprint });
}

function saleLedgerDay(value: unknown): string | null {
  if (isGrowerUtcDate(value)) return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !isGrowerUtcDate(value.slice(0, 10))) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

export interface SaleEvidenceRow {
  readonly id: string;
  readonly value: SalesLog;
  readonly pending?: boolean;
}

function saleIdentity(row: SaleEvidenceRow) {
  const invoice = row.value.invoice_id;
  if (invoice === undefined || invoice === null) {
    return row.value.invoice_line == null && row.value.invoice_source_sale !== true
      ? { canonicalId: JSON.stringify(['sale', row.id]), invoice: null } : null;
  }
  if (!validCycleHarvestRecordId(invoice) || !Number.isSafeInteger(row.value.invoice_line) || row.value.invoice_line! < 0) return null;
  return { canonicalId: JSON.stringify(['invoice-line', invoice, row.value.invoice_line]), invoice };
}

/** Mixed generations of invoices can contain a manual sale and its generated
 * mirror. Count every owner's line before admitting a quantity. */
export async function checkBuyerSaleRows(rows: readonly SaleEvidenceRow[], owner: string) {
  const owned = rows.filter(row => row.value.profile_id === owner);
  const identities = owned.map(row => ({ row, identity: saleIdentity(row) }));
  const blockedInvoices = new Set(identities.flatMap(({ row, identity }) =>
    !identity && typeof row.value.invoice_id === 'string' ? [row.value.invoice_id] : []));
  const counts = new Map<string, number>();
  const documentCounts = new Map<string, number>();
  for (const { row, identity } of identities) {
    documentCounts.set(row.id, (documentCounts.get(row.id) ?? 0) + 1);
    if (identity) counts.set(identity.canonicalId, (counts.get(identity.canonicalId) ?? 0) + 1);
  }

  const results = await Promise.all(identities.map(async ({ row, identity }) => {
    const { id, value, pending } = row;
    if (pending || !validCycleHarvestRecordId(id) || documentCounts.get(id) !== 1
      || !identity || counts.get(identity.canonicalId) !== 1 || identity.invoice && blockedInvoices.has(identity.invoice)) return null;
    const crop = typeof value.crop === 'string' ? produceEntryOption(value.crop) : null;
    const unit = recordUnit(value), quantity = recordQuantity(value), sourceOn = saleLedgerDay(value.sold_at);
    if (!crop || !cropByKey(crop.key) || !unit || quantity === null || !sourceOn) return null;
    return fingerprintFulfilmentSource({
      kind: 'sale', id, canonicalId: identity.canonicalId,
      // Sales garden membership is independent of the Design Studio's mapped site.
      siteId: null, cropKey: crop.key, sourceOn, unit, quantity,
      recordedBuyer: typeof value.buyer === 'string' ? value.buyer.trim() || null : null,
    }, [value.sold_at, value.garden_id ?? null, value.invoice_source_sale === true, value.buyer ?? null]);
  }));
  const sources = Object.freeze(results.flatMap(source => source ? [source] : []).sort((a, b) => a.id.localeCompare(b.id)));
  return { sources, incomplete: sources.length !== owned.length };
}
