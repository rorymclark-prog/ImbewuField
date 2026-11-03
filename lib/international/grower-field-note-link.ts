import type { GrowerCycleContext } from './grower-cycle';
import { projectGrowerCycles } from './grower-cycle-projection';
import { growerPlanningScopeKey, type GrowerPlanningScope } from './grower-planning';

export interface GrowerFieldNoteLink {
  readonly version: 1;
  readonly plantingId: string;
  readonly cycleId: string;
  readonly bedId: string;
  readonly scope: GrowerPlanningScope;
}

export type GrowerFieldNoteLinkResult =
  | { readonly status: 'resolved'; readonly link: GrowerFieldNoteLink }
  | { readonly status: 'held'; readonly reason: 'invalid-selection' | 'scope-changed' | 'cycle-unavailable' | 'selection-changed' };

/** Resolve a grower's explicit choice against the whole current book. The
 * caller must establish the actor, fresh source and current journal write
 * context before using the link. A resolved link carries no observed facts. */
export function resolveGrowerFieldNoteLink(
  rows: unknown,
  context: GrowerCycleContext | null,
  selection: unknown,
): GrowerFieldNoteLinkResult {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    return { status: 'held', reason: 'invalid-selection' };
  }
  const { plantingId, cycleId, bedId, scope } = selection as Record<string, unknown>;
  const scopeKey = growerPlanningScopeKey(scope);
  if (!scopeKey || typeof plantingId !== 'string' || !plantingId.trim()
    || typeof cycleId !== 'string' || !cycleId.trim() || typeof bedId !== 'string' || !bedId.trim()) {
    return { status: 'held', reason: 'invalid-selection' };
  }
  if (!context || scopeKey !== growerPlanningScopeKey(context.scope)) return { status: 'held', reason: 'scope-changed' };

  // A proposal ordinal can repeat. Membership starts with the persistent row
  // ID and the shared projection holds duplicates, overlaps and stale geometry.
  const cycle = projectGrowerCycles(rows, context).ownCycles.find(row => row.plantingId === plantingId);
  if (!cycle) return { status: 'held', reason: 'cycle-unavailable' };
  if (cycle.cycleId !== cycleId || cycle.bedId !== bedId) return { status: 'held', reason: 'selection-changed' };

  return { status: 'resolved', link: Object.freeze({
    version: 1, plantingId: cycle.plantingId, cycleId: cycle.cycleId, bedId: cycle.bedId, scope: cycle.scope,
  }) };
}
