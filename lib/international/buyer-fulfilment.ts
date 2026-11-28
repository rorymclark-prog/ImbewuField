import { addDecimalQuantity, compareDecimalQuantities, validRecordQuantity, type DecimalQuantity, type RecordUnit } from '../farm-records';
import { isGrowerUtcDate } from './grower-planning';

export interface BuyerFulfilmentEntry {
  readonly kind: 'harvest-allocation' | 'delivery';
  readonly sourceId: string;
  readonly sourceFingerprint: string;
  readonly start: string;
  readonly endExclusive: string;
  readonly on: string;
  readonly unit: RecordUnit;
  readonly quantity: number;
}

export interface CheckedFulfilmentSource {
  readonly kind: 'harvest' | 'sale';
  readonly id: string;
  /** An invoice line and its sale mirror must resolve to the same source. */
  readonly canonicalId: string;
  readonly fingerprint: string;
  readonly siteId: string | null;
  readonly cropKey: string;
  /** Checked picking date or ledger date. A ledger date does not attest handover. */
  readonly sourceOn: string;
  readonly unit: RecordUnit;
  readonly quantity: number;
}

interface FulfilmentTarget {
  readonly id: string;
  readonly siteId: string;
  readonly cropKey: string;
  readonly mappedSiteId?: string;
  readonly fulfilment?: readonly BuyerFulfilmentEntry[];
}

type HeldReason = 'source-unavailable' | 'source-ambiguous' | 'source-changed' | 'invalid-evidence-date' | 'outside-quantity' | 'source-needs-reconciliation';

export type FulfilmentLine = { readonly targetId: string; readonly entry: BuyerFulfilmentEntry } & (
  { readonly status: 'checked' } | { readonly status: 'held'; readonly reason: HeldReason }
);

function validSourceId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim() && !value.includes('/');
}

export function normaliseBuyerFulfilment(
  value: unknown, unit: RecordUnit, periods: readonly { start: string; endExclusive: string }[],
): BuyerFulfilmentEntry[] | null {
  if (!Array.isArray(value)) return null;
  const known = new Map(periods.map(period => [period.start, period.endExclusive]));
  const seen = new Set<string>();
  const entries: BuyerFulfilmentEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Object.keys(raw).length !== 8) return null;
    const { kind, sourceId, sourceFingerprint, start, endExclusive, on, unit: entryUnit, quantity } =
      raw as Partial<BuyerFulfilmentEntry>;
    if (kind !== 'harvest-allocation' && kind !== 'delivery' || !validSourceId(sourceId)
      || typeof sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(sourceFingerprint)
      || typeof start !== 'string' || typeof endExclusive !== 'string' || known.get(start) !== endExclusive
      || !isGrowerUtcDate(on) || on < start || on >= endExclusive || entryUnit !== unit
      || quantity !== 0 && !validRecordQuantity(quantity, unit)) return null;
    const key = JSON.stringify([start, kind, sourceId]);
    if (seen.has(key)) return null;
    seen.add(key);
    entries.push({ kind, sourceId, sourceFingerprint, start, endExclusive, on, unit, quantity: quantity === 0 ? 0 : quantity });
  }
  return entries;
}

function sourceKey(kind: CheckedFulfilmentSource['kind'], id: string) {
  return JSON.stringify([kind, id]);
}

interface PendingLine {
  targetId: string;
  entry: BuyerFulfilmentEntry;
  reason?: HeldReason;
}

/** Project all of the owner's known targets together. An unchecked or changed
 * source stays held, and a source shared across orders has only one ceiling. */
export function projectBuyerFulfilment(
  targets: readonly FulfilmentTarget[], sources: readonly CheckedFulfilmentSource[], checkedOn: string,
): FulfilmentLine[] {
  const byId = new Map<string, CheckedFulfilmentSource[]>();
  const canonicalCounts = new Map<string, number>();
  for (const source of sources) {
    const key = sourceKey(source.kind, source.id);
    const matches = byId.get(key) ?? [];
    matches.push(source);
    byId.set(key, matches);
    const canonical = sourceKey(source.kind, source.canonicalId);
    canonicalCounts.set(canonical, (canonicalCounts.get(canonical) ?? 0) + 1);
  }
  const pending: PendingLine[] = [];
  const groups = new Map<string, { source: CheckedFulfilmentSource; members: PendingLine[] }>();
  for (const target of targets) {
    for (const entry of target.fulfilment ?? []) {
      const line: PendingLine = { targetId: target.id, entry };
      pending.push(line);
      const matches = byId.get(sourceKey(entry.kind === 'delivery' ? 'sale' : 'harvest', entry.sourceId)) ?? [];
      if (matches.length !== 1) {
        line.reason = matches.length === 0 ? 'source-unavailable' : 'source-ambiguous';
        continue;
      }
      const [source] = matches;
      const canonical = sourceKey(source.kind, source.canonicalId);
      if (canonicalCounts.get(canonical) !== 1) {
        line.reason = 'source-ambiguous';
        continue;
      }
      if (source.fingerprint !== entry.sourceFingerprint
        || (source.kind === 'harvest' || source.siteId !== null) && source.siteId !== (target.mappedSiteId ?? target.siteId)
        || source.cropKey !== target.cropKey || source.unit !== entry.unit
        || source.quantity !== 0 && !validRecordQuantity(source.quantity, source.unit)) line.reason = 'source-changed';
      else if (!isGrowerUtcDate(checkedOn) || !isGrowerUtcDate(source.sourceOn) || source.sourceOn > checkedOn
        || entry.on > checkedOn || source.kind === 'harvest' && source.sourceOn > entry.on) line.reason = 'invalid-evidence-date';
      const group = groups.get(canonical) ?? { source, members: [] };
      group.members.push(line);
      groups.set(canonical, group);
    }
  }
  for (const { source, members } of groups.values()) {
    if (members.some(member => member.reason)) {
      for (const member of members) member.reason ??= 'source-needs-reconciliation';
      continue;
    }
    const total = members.reduce<DecimalQuantity | undefined>(
      (sum, member) => addDecimalQuantity(sum, member.entry.quantity), undefined,
    );
    if (compareDecimalQuantities(total, addDecimalQuantity(undefined, source.quantity)) > 0) {
      for (const member of members) member.reason = 'outside-quantity';
    }
  }
  return pending.map(({ targetId, entry, reason }) => reason
    ? { targetId, entry, status: 'held', reason }
    : { targetId, entry, status: 'checked' });
}
