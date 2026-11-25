import { produceEntryOption } from './crop-entry';
import { isJournalDate, type GrowerJournalLink } from './field-journal';
import { recordQuantity, recordUnit, type RecordUnit } from './farm-records';
import { growerPlanningScopeKey } from './international/grower-planning';
import type { ProductionLog } from './db/types';

export const CYCLE_HARVEST_LINK_KIND = 'cycle-harvest-link';
export const cycleHarvestDocumentId = (recordId: string) => `${CYCLE_HARVEST_LINK_KIND}-${recordId}`;

export interface CycleHarvestOption {
  readonly recordId: string;
  readonly crop: string;
  readonly quantity: number;
  readonly unit: RecordUnit;
  readonly enteredAt: string | null;
}

export interface CycleHarvestSelection {
  readonly recordId: string;
  readonly observedOn: string;
}

export interface CycleHarvestLink extends CycleHarvestSelection {
  readonly kind: typeof CYCLE_HARVEST_LINK_KIND;
  readonly version: 1;
  readonly plantingId: string;
  readonly bedId: string;
  readonly scopeKey: string;
  readonly cropKey: string;
}

export function validCycleHarvestRecordId(id: unknown): id is string {
  return typeof id === 'string' && !!id && id !== '.' && id !== '..'
    && !/[\/\u0000-\u001f\u007f]/.test(id) && new TextEncoder().encode(id).byteLength <= 1400;
}

export function cycleHarvestOption(id: string, row: ProductionLog, owner: string): CycleHarvestOption | null {
  if (!validCycleHarvestRecordId(id) || row.profile_id !== owner || typeof row.crop !== 'string' || !row.crop.trim()) return null;
  const quantity = recordQuantity(row);
  const unit = recordUnit(row);
  if (quantity === null || unit === null) return null;
  const enteredAt = typeof row.logged_at === 'string' && isJournalDate(row.logged_at.slice(0, 10))
    ? row.logged_at.slice(0, 10) : null;
  return { recordId: id, quantity, unit, enteredAt, crop: row.crop };
}

export function cycleHarvestCropMatches(option: CycleHarvestOption, cropKey: string): boolean {
  // This only excludes a mismatched product. The grower still chooses the exact record and cycle.
  return produceEntryOption(option.crop)?.key === cropKey;
}

export function makeCycleHarvestLink(
  reference: GrowerJournalLink, cropKey: string, input: CycleHarvestSelection,
): CycleHarvestLink | null {
  const scopeKey = growerPlanningScopeKey(reference.scope);
  if (!scopeKey || !validCycleHarvestRecordId(input.recordId) || !isJournalDate(input.observedOn)) return null;
  return { kind: CYCLE_HARVEST_LINK_KIND, version: 1, scopeKey, cropKey,
    plantingId: reference.plantingId, bedId: reference.bedId, recordId: input.recordId, observedOn: input.observedOn };
}

/** The storage key is bound to one canonical record across all of an owner's cycles. */
export function sameCycleHarvestLink(a: Partial<CycleHarvestLink>, b: CycleHarvestLink): boolean {
  return a.kind === b.kind && a.version === b.version && a.scopeKey === b.scopeKey && a.cropKey === b.cropKey
    && a.plantingId === b.plantingId && a.bedId === b.bedId && a.recordId === b.recordId && a.observedOn === b.observedOn;
}

export function sameCycleHarvestOption(a: CycleHarvestOption, b: CycleHarvestOption): boolean {
  return a.recordId === b.recordId && a.crop === b.crop && a.quantity === b.quantity
    && a.unit === b.unit && a.enteredAt === b.enteredAt;
}
