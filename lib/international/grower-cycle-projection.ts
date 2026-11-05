import type { Planting } from '../crop-plan';
import { cropByKey } from '../crop-catalog';
import { resolvePlantingBasis, type GrowerCycleContext } from './grower-cycle';
import type { GrowerReadyAssessment } from './grower-autoplan';
import type { GrowerPlanningScope } from './grower-planning';

export type GrowerCycleEventKind = 'nursery-start' | 'field-entry' | 'first-pick' | 'picking-end' | 'field-clear' | 'next-entry';
export interface GrowerCyclePlannedEvent {
  readonly kind: GrowerCycleEventKind;
  readonly date: string;
  readonly status: 'planned';
  /** End boundaries are not an extra day of picking or nursery occupancy. */
  readonly endExclusive: boolean;
}
export interface GrowerCycleNurseryDemand {
  /** Target final stand only; this is not a seed/tray quantity after losses. */
  readonly targetPositions: number;
  readonly interval: { readonly start: string; readonly endExclusive: string };
  readonly seedQuantity: null;
  readonly trayQuantity: null;
  readonly spaceM2: null;
}
export interface ProjectedGrowerCycle {
  readonly rowIndex: number;
  readonly plantingId: string;
  readonly cycleId: string;
  readonly demandId: string;
  readonly profileId: string;
  readonly cropKey: string;
  readonly bedId: string;
  readonly scope: GrowerPlanningScope;
  readonly assessment: GrowerReadyAssessment;
  readonly plannedEvents: readonly GrowerCyclePlannedEvent[];
  readonly totalCycleKg: number;
  readonly targetPlantCount: number;
  readonly reservation: { readonly start: string; readonly endExclusive: string };
  readonly nurseryDemand: GrowerCycleNurseryDemand | null;
  readonly sourceVerification: 'not-verified';
}
export interface LegacyProjectionRow {
  readonly rowIndex: number;
  /** Pass-through for existing gated consumers; this is not catalogue approval. */
  readonly row: Readonly<Planting>;
  readonly basis: 'legacy-unapproved';
}
export interface HeldProjectionRow {
  readonly rowIndex: number | null;
  readonly row: unknown;
  readonly plantingId: string | null;
  readonly reasons: readonly string[];
}
export interface GrowerCycleProjection {
  readonly legacyRows: readonly LegacyProjectionRow[];
  readonly ownCycles: readonly ProjectedGrowerCycle[];
  readonly heldRows: readonly HeldProjectionRow[];
  readonly reservationCoverage: 'valid-own-cycles-only';
  readonly legacyOccupancy: 'not-assessed';
  readonly sourceVerification: 'not-verified';
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}
function rowId(row: unknown): string | null {
  try { return record(row) && identity(row.id) ? row.id : null; } catch { return null; }
}
function legacyShape(row: unknown): row is Planting {
  try {
    return record(row) && identity(row.id) && identity(row.bedId) && typeof row.cropKey === 'string'
      && !!cropByKey(row.cropKey) && typeof row.sowMonth === 'number'
      && Number.isInteger(row.sowMonth) && row.sowMonth >= 1 && row.sowMonth <= 12;
  } catch { return false; }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Read-only review projection. Valid own reservations do not prove availability:
 * legacy rows and other uses of this land require the caller's separate checks. */
export function projectGrowerCycles(rows: unknown, context: GrowerCycleContext | null | undefined): GrowerCycleProjection {
  const legacyRows: LegacyProjectionRow[] = [], heldRows: HeldProjectionRow[] = [], candidates: ProjectedGrowerCycle[] = [];
  const overlaps = new Set<number>();
  const hold = (rowIndex: number | null, row: unknown, reasons: readonly string[]) => {
    // Raw rows are caller-owned. Freeze the result wrapper, never their stored data.
    heldRows.push(Object.freeze({ rowIndex, row, plantingId: rowId(row), reasons: Object.freeze([...reasons]) }));
  };
  if (!Array.isArray(rows)) hold(null, rows, ['invalid-row-list']);
  else {
    const counts = new Map<string, number>();
    for (const row of rows) { const id = rowId(row); if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
    rows.forEach((row: unknown, rowIndex) => {
      const id = rowId(row);
      if (id && counts.get(id)! > 1) { hold(rowIndex, row, ['ambiguous-planting-id']); return; }
      const resolution = resolvePlantingBasis(row, context);
      if (resolution.kind === 'held') { hold(rowIndex, row, resolution.reasons); return; }
      if (resolution.kind === 'legacy') {
        if (!legacyShape(row)) { hold(rowIndex, row, ['invalid-legacy-row']); return; }
        legacyRows.push(Object.freeze({ rowIndex, row, basis: 'legacy-unapproved' })); return;
      }
      const { attachment, assessment, reservation } = resolution;
      const dates = assessment.schedule;
      const event = (kind: GrowerCycleEventKind, date: string, endExclusive = false): GrowerCyclePlannedEvent =>
        ({ kind, date, status: 'planned', endExclusive });
      const plannedEvents = [
        ...(dates.nurseryStartDate === null ? [] : [event('nursery-start', dates.nurseryStartDate)]),
        event('field-entry', dates.fieldEntryDate), event('first-pick', dates.firstHarvestDate),
        event('picking-end', dates.harvestEndExclusiveDate, true), event('field-clear', dates.fieldClearDate, true),
        event('next-entry', dates.nextFieldEntryDate),
      ];
      candidates.push(freeze({ rowIndex, plantingId: attachment.plantingId, cycleId: attachment.cycleId,
        demandId: attachment.demandId, profileId: assessment.snapshot.profile.profileId,
        cropKey: assessment.snapshot.profile.cropKey, bedId: attachment.bedId, scope: assessment.snapshot.scope,
        assessment, plannedEvents, totalCycleKg: assessment.capacity.estimatedYieldKg,
        targetPlantCount: assessment.capacity.estimatedPlantCount, reservation,
        nurseryDemand: dates.nurseryStartDate === null ? null : { targetPositions: assessment.capacity.estimatedPlantCount,
          interval: { start: dates.nurseryStartDate, endExclusive: dates.fieldEntryDate }, seedQuantity: null, trayQuantity: null, spaceM2: null },
        sourceVerification: 'not-verified' as const }));
    });
    // A running furthest end identifies all involved whole-bed overlaps without
    // choosing an arbitrary winner or making quadratic pairs for a corrupted book.
    const byBed = new Map<string, ProjectedGrowerCycle[]>();
    for (const cycle of candidates) {
      const group = byBed.get(cycle.bedId);
      if (group) group.push(cycle); else byBed.set(cycle.bedId, [cycle]);
    }
    for (const cycles of byBed.values()) {
      cycles.sort((a, b) => compare(a.reservation.start, b.reservation.start)
        || compare(a.reservation.endExclusive, b.reservation.endExclusive) || a.rowIndex - b.rowIndex);
      let furthest: ProjectedGrowerCycle | undefined;
      for (const cycle of cycles) {
        if (furthest && cycle.reservation.start < furthest.reservation.endExclusive) {
          overlaps.add(furthest.rowIndex); overlaps.add(cycle.rowIndex);
        }
        if (!furthest || cycle.reservation.endExclusive > furthest.reservation.endExclusive) furthest = cycle;
      }
    }
    for (const cycle of candidates) if (overlaps.has(cycle.rowIndex)) hold(cycle.rowIndex, rows[cycle.rowIndex], ['overlapping-own-reservation']);
  }
  heldRows.sort((a, b) => (a.rowIndex ?? -1) - (b.rowIndex ?? -1));
  return Object.freeze({ legacyRows: Object.freeze(legacyRows), ownCycles: Object.freeze(candidates.filter(cycle => !overlaps.has(cycle.rowIndex))), heldRows: Object.freeze(heldRows),
    reservationCoverage: 'valid-own-cycles-only', legacyOccupancy: 'not-assessed', sourceVerification: 'not-verified' });
}
