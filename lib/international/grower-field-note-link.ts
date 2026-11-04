import type { GrowerCycleContext } from './grower-cycle';
import { projectGrowerCycles, type ProjectedGrowerCycle } from './grower-cycle-projection';
import type { JournalEntry } from '../field-journal';
import { growerPlanningScopeKey, normaliseGrowerPlanningScope, type GrowerPlanningScope } from './grower-planning';

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

// Read only the expected own data properties. Accessors and inherited values
// are not part of a grower's confirmed selection.
function readOwnFields(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const fields: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (property && !Object.hasOwn(property, 'value')) return null;
      fields[key] = property?.value;
    }
    return fields;
  } catch {
    return null;
  }
}

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !CONTROL_CHARS_RE.test(value);
}

const EXPECTED_LINK_KEYS = Object.freeze(['version', 'plantingId', 'cycleId', 'bedId', 'scope']);

/** Pure shape decoder for a stored grower field note link.
 * Validation is structural only: it reads no book or journal rows, establishes
 * no actor or sample boundary, and adds no authorization or observation date. */
export function normaliseGrowerFieldNoteLink(value: unknown): GrowerFieldNoteLink | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const outerKeys = Reflect.ownKeys(value);
    if (outerKeys.length !== 5) return null;
    for (const key of EXPECTED_LINK_KEYS) {
      if (!outerKeys.includes(key)) return null;
    }

    const fields = readOwnFields(value, EXPECTED_LINK_KEYS);
    if (!fields) return null;
    const { version, plantingId, cycleId, bedId, scope: rawScope } = fields;

    if (version !== 1) return null;
    if (!validId(plantingId) || !validId(cycleId) || !validId(bedId)) return null;

    if (!rawScope || typeof rawScope !== 'object' || Array.isArray(rawScope)) return null;
    const scopeKeys = Reflect.ownKeys(rawScope);
    if (scopeKeys.length !== 2) return null;

    const kindDesc = Object.getOwnPropertyDescriptor(rawScope, 'kind');
    if (!kindDesc || !Object.hasOwn(kindDesc, 'value') || typeof kindDesc.value !== 'string') return null;
    const kind = kindDesc.value;

    let scopeSnapshot: Record<string, unknown> | null = null;
    if (kind === 'mapped-site') {
      if (!scopeKeys.includes('kind') || !scopeKeys.includes('siteId')) return null;
      scopeSnapshot = readOwnFields(rawScope, ['kind', 'siteId']);
    } else if (kind === 'unmapped-workspace') {
      if (!scopeKeys.includes('kind') || !scopeKeys.includes('workspaceId')) return null;
      scopeSnapshot = readOwnFields(rawScope, ['kind', 'workspaceId']);
    } else {
      return null;
    }

    if (!scopeSnapshot) return null;

    const normalisedScope = normaliseGrowerPlanningScope(scopeSnapshot);
    if (!normalisedScope) return null;

    return Object.freeze({
      version: 1,
      plantingId,
      cycleId,
      bedId,
      scope: normalisedScope,
    });
  } catch {
    return null;
  }
}

/** Resolve a grower's explicit choice against the whole current book. The
 * caller must establish the actor, fresh source and current journal write
 * context before using the link. A resolved link carries no observed facts. */
export function resolveGrowerFieldNoteLink(
  rows: unknown,
  context: GrowerCycleContext | null,
  selection: unknown,
): GrowerFieldNoteLinkResult {
  return resolveFieldNoteChoice(context, selection, (admitted, plantingId) =>
    projectGrowerCycles(rows, admitted).ownCycles.find(row => row.plantingId === plantingId));
}

function resolveFieldNoteChoice(
  context: GrowerCycleContext | null,
  selection: unknown,
  findOwnCycle: (context: GrowerCycleContext, plantingId: string) => ProjectedGrowerCycle | undefined,
): GrowerFieldNoteLinkResult {
  const fields = readOwnFields(selection, ['plantingId', 'cycleId', 'bedId', 'scope']);
  if (!fields) return { status: 'held', reason: 'invalid-selection' };
  const { plantingId, cycleId, bedId, scope } = fields;
  const scopeKey = growerPlanningScopeKey(readOwnFields(scope, ['kind', 'siteId', 'workspaceId']));
  if (!scopeKey || typeof plantingId !== 'string' || !plantingId.trim()
    || typeof cycleId !== 'string' || !cycleId.trim() || typeof bedId !== 'string' || !bedId.trim()) {
    return { status: 'held', reason: 'invalid-selection' };
  }
  if (!context || scopeKey !== growerPlanningScopeKey(context.scope)) return { status: 'held', reason: 'scope-changed' };

  // A proposal ordinal can repeat. Membership starts with the persistent row
  // ID and the shared projection holds duplicates, overlaps and stale geometry.
  const cycle = findOwnCycle(context, plantingId);
  if (!cycle) return { status: 'held', reason: 'cycle-unavailable' };
  if (cycle.cycleId !== cycleId || cycle.bedId !== bedId) return { status: 'held', reason: 'selection-changed' };

  return { status: 'resolved', link: Object.freeze({
    version: 1, plantingId: cycle.plantingId, cycleId: cycle.cycleId, bedId: cycle.bedId, scope: cycle.scope,
  }) };
}

/** Journal-only display status. The caller supplies the freshly checked
 * source. Reuse one whole-book projection for all notes in a scope. */
export function projectJournalFieldNoteLinks(
  entries: readonly JournalEntry[],
  rows: unknown,
  contexts: readonly GrowerCycleContext[],
): ReadonlyMap<string, 'matched' | 'held'> {
  const byScope = new Map<string, GrowerCycleContext | null>();
  for (const context of contexts) {
    const key = growerPlanningScopeKey(context.scope);
    if (key) byScope.set(key, byScope.has(key) ? null : context);
  }
  const projections = new Map<GrowerCycleContext, Map<string, ProjectedGrowerCycle>>();
  const statuses = new Map<string, 'matched' | 'held'>();
  for (const entry of entries) {
    const property = Object.getOwnPropertyDescriptor(entry, 'growerCycleLink');
    if (!property) continue;
    const link = normaliseGrowerFieldNoteLink(property.value);
    const key = link && growerPlanningScopeKey(link.scope);
    const context = key ? byScope.get(key) : null;
    if (!link || !context || entry.bedId !== link.bedId) { statuses.set(entry.id, 'held'); continue; }
    const result = resolveFieldNoteChoice(context, link, (admitted, plantingId) => {
      let own = projections.get(admitted);
      if (!own) {
        own = new Map(projectGrowerCycles(rows, admitted).ownCycles.map(cycle => [cycle.plantingId, cycle]));
        projections.set(admitted, own);
      }
      return own.get(plantingId);
    });
    statuses.set(entry.id, result.status === 'resolved' ? 'matched' : 'held');
  }
  return statuses;
}
