// Multi-ring orchestration for the farmer-invoked Snap action.
//
// The single-ring safety engine remains lib/snap-edges.ts. This module never weakens or repeats
// those guards: it applies that engine to a stable id-sorted selection, accepts each safe result,
// and leaves each vetoed ring byte-for-byte alone. Later rings see earlier accepted geometry so
// two selected neighbours do not chase each other's former edge and swap/overlap their seam.

import {
  snapToNeighbours,
  type SnapEdgesOptions,
  type SnapEdgesReason,
  type SnapNeighbourRing,
  type SnapRingKind,
} from '@/lib/snap-edges';

export interface BulkSnapRing {
  id: string;
  label: string;
  kind: SnapRingKind;
  points: Array<[number, number]>;
}

export interface BulkSnapUpdate {
  id: string;
  label: string;
  points: Array<[number, number]>;
  moved: number;
  maxMovedM: number;
}

export interface BulkSnapSkipped {
  id: string;
  label: string;
  reason: SnapEdgesReason | 'boundary_excluded';
}

export interface BulkSnapResult {
  updates: BulkSnapUpdate[];
  skipped: BulkSnapSkipped[];
  changed: boolean;
  movedCorners: number;
  maxMovedM: number;
}

/** Per-ring policy: safe rings move, vetoed rings remain untouched and are named in the preview. */
export function snapSelectedRings(
  selected: BulkSnapRing[],
  allRings: BulkSnapRing[],
  opts: SnapEdgesOptions,
): BulkSnapResult {
  const selectedIds = new Set(selected.map((ring) => ring.id));
  const working = new Map(allRings.map((ring) => [ring.id, ring]));
  const updates: BulkSnapUpdate[] = [];
  const skipped: BulkSnapSkipped[] = [];

  for (const original of [...selected].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!selectedIds.has(original.id)) continue;
    if (original.kind === 'boundary') {
      skipped.push({ id: original.id, label: original.label, reason: 'boundary_excluded' });
      continue;
    }
    const current = working.get(original.id) ?? original;
    const neighbours: SnapNeighbourRing[] = [...working.values()]
      .filter((ring) => ring.id !== current.id)
      .map((ring) => ({ id: ring.id, kind: ring.kind, points: ring.points }));
    const result = snapToNeighbours(
      { id: current.id, kind: current.kind, points: current.points },
      neighbours,
      opts,
    );
    if (!result.changed) {
      skipped.push({ id: current.id, label: current.label, reason: result.reason });
      continue;
    }
    const update = {
      id: current.id,
      label: current.label,
      points: result.points,
      moved: result.moved,
      maxMovedM: result.maxMovedM,
    };
    updates.push(update);
    working.set(current.id, { ...current, points: result.points });
  }

  return {
    updates,
    skipped,
    changed: updates.length > 0,
    movedCorners: updates.reduce((sum, update) => sum + update.moved, 0),
    maxMovedM: updates.reduce((max, update) => Math.max(max, update.maxMovedM), 0),
  };
}

function skippedReason(reason: BulkSnapSkipped['reason']): string {
  switch (reason) {
    case 'boundary_excluded': return 'property boundary never moves';
    case 'nothing_in_tolerance': return 'no edge close enough';
    case 'too_few_points': return 'too few points';
    case 'invalid_frame': return 'map scale not ready';
    case 'would_self_intersect': return 'would cross itself';
    case 'would_change_winding': return 'would flip direction';
    case 'area_change_exceeded': return 'would change area too much';
    case 'would_merge_vertices': return 'would merge corners';
    case 'movement_exceeded_tolerance': return 'would move too far';
    case 'snapped': return 'unchanged';
  }
}

/** Names every moved and vetoed ring so a partial batch can never masquerade as "all snapped". */
export function snapSelectedRingsSummary(result: BulkSnapResult): string {
  const moved = result.updates.map((update) => update.label).join(', ');
  const skipped = result.skipped
    .map((entry) => `${entry.label} (${skippedReason(entry.reason)})`)
    .join(', ');
  const movement = result.changed
    ? ` Moves ${result.movedCorners} ${result.movedCorners === 1 ? 'corner' : 'corners'}; nothing moves more than ${result.maxMovedM.toFixed(1)} m.`
    : '';
  if (moved && skipped) return `Snaps ${moved}. Leaves unchanged: ${skipped}.${movement}`;
  if (moved) return `Snaps ${moved}.${movement}`;
  return `No selected ring can snap safely.${skipped ? ` Leaves unchanged: ${skipped}.` : ''}`;
}
